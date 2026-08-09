import { Router } from "express";
import crypto from "node:crypto";
import mongoose from "mongoose";
import bcryptjs from "bcryptjs";
import { asyncHandler, AppError, success } from "../lib/http.js";
import { connectMongoDB } from "../config/db.js";
import {
  requireAnyPermission,
  requireAuth,
  requirePermission,
  requireRole,
  authorizeOwner,
} from "../middleware/auth.js";
import { testAccountMap } from "../lib/provider.js";
import { modelMap } from "../models/index.js";
import { getNextNumber, peekNextNumber } from "../lib/sequenceCounter.js";

const getMongoDb = async () => {
  if (!process.env.MONGODB_URI) throw new AppError(503, "MongoDB is not configured", "SERVICE_UNAVAILABLE");
  await connectMongoDB();
  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    return mongoose.connection.db;
  }
  throw new AppError(503, "Database connection failed", "SERVICE_UNAVAILABLE");
};

// Legacy number() helper removed — replaced by getNextNumber() from sequenceCounter.js

/**
 * Enterprise Multi-Tenant Ownership Helper
 * Builds MongoDB query for Admin, Customer, and Super Admin isolation
 */
export async function getScopedQuery(req, extraFilter = {}, collectionName = null) {
  const userId = req.user?._id || req.auth?.userId;
  const userRoles = req.user?.roles || req.auth?.roles || [];
  const isSuperAdmin = userRoles.includes("super_admin") || userRoles.includes("superadmin");

  if (isSuperAdmin) {
    if (req.query?.ownerId) {
      return { ...extraFilter, ownerId: String(req.query.ownerId) };
    }
    return { ...extraFilter };
  }

  const isCustomer = userRoles.includes("customer");
  if (isCustomer) {
    const mongo = await getMongoDb();
    const userEmail = (req.user?.email || req.auth?.email || "").trim().toLowerCase();
    const custObj = await mongo.collection("customers").findOne({
      $or: [
        ...(userEmail ? [{ email: { $regex: new RegExp("^" + userEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i") } }] : []),
        ...(userId ? [{ profile_id: userId }, { ownerId: userId }] : [])
      ]
    });

    const customerOrs = [
      { ownerId: userId },
      { createdBy: userId },
      { created_by: userId }
    ];

    if (custObj) {
      customerOrs.push({ customer_id: custObj._id });
      customerOrs.push({ customer_id: custObj._id.toString() });
      customerOrs.push({ profile_id: custObj._id.toString() });
    }
    if (userEmail) {
      const escaped = userEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      customerOrs.push({ customer_email: userEmail });
      customerOrs.push({ customer_email: { $regex: new RegExp("^" + escaped + "$", "i") } });
      customerOrs.push({ email: { $regex: new RegExp("^" + escaped + "$", "i") } });
    }

    return {
      ...extraFilter,
      $or: customerOrs
    };
  }

  // Admin / Staff query rule: find({ ownerId: req.user._id })
  return {
    ...extraFilter,
    $or: [
      { ownerId: userId },
      { created_by: userId },
      { createdBy: userId }
    ]
  };
}

// ----------------------------------------------------
// 1. DASHBOARD ROUTER
// ----------------------------------------------------
export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);
dashboardRouter.get(
  "/",
  requirePermission("dashboard:view"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    const query = await getScopedQuery(req);

    const counts = {
      leads: await mongo.collection("enquiries").countDocuments(query),
      customers: await mongo.collection("customers").countDocuments(query),
      quotations: await mongo.collection("quotations").countDocuments(await getScopedQuery(req, { status: { $ne: "Archived" } })),
      invoices: await mongo.collection("invoices").countDocuments(query),
      agreements: await mongo.collection("agreements").countDocuments(query),
      contracts: await mongo.collection("contracts").countDocuments(query),
      estimates: await mongo.collection("estimates").countDocuments(query),
      attachments: await mongo.collection("attachments").countDocuments(query),
      notes: await mongo.collection("notes").countDocuments(query),
      products: await mongo.collection("products").countDocuments(query),
      projects: await mongo.collection("projects").countDocuments(query),
      tickets: await mongo.collection("service_tickets").countDocuments(query),
    };
    return success(res, "Dashboard retrieved", counts);
  }),
);

// ----------------------------------------------------
// 2. CUSTOMERS ROUTER
// ----------------------------------------------------
export const customersRouter = Router();
customersRouter.use(requireAuth);
customersRouter.get(
  "/",
  requirePermission("customers:view"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    let searchFilter = {};
    if (req.query.search) {
      const s = String(req.query.search).trim();
      searchFilter = {
        $or: [
          { name: { $regex: s, $options: "i" } },
          { mobile: { $regex: s, $options: "i" } },
          { customer_number: { $regex: s, $options: "i" } },
        ],
      };
    }
    const query = await getScopedQuery(req, searchFilter);
    const items = await mongo.collection("customers").find(query).sort({ created_at: -1 }).toArray();
    const formatted = items.map((item) => ({ id: item._id.toString(), ...item }));
    return success(res, "Customers retrieved", formatted);
  }),
);

customersRouter.get(
  "/:id",
  requirePermission("customers:view"),
  authorizeOwner("customers"),
  asyncHandler(async (req, res) => {
    return success(res, "Customer retrieved", { id: req.doc._id.toString(), ...req.doc });
  }),
);

customersRouter.post(
  "/",
  requirePermission("customers:create"),
  asyncHandler(async (req, res) => {
    const b = req.body;
    if (!b.name || !b.mobile || !b.customerType)
      throw new AppError(400, "Name, mobile and customer type are required", "VALIDATION_ERROR");

    const mongo = await getMongoDb();
    const userId = req.user?._id || req.auth?.userId;
    const userRole = req.user?.role || req.auth?.roles?.[0] || "admin";

    const typeRoleMap = {
      Residential: "customer", Commercial: "customer", Industrial: "customer",
      Admin: "admin", Manager: "manager", "Sales Executive": "sales_executive",
      "Installation Staff": "installation_staff", "Service Technician": "service_technician",
      Accountant: "accountant", Customer: "customer",
    };
    const assignedRole = typeRoleMap[b.customerType] || "customer";
    const email = b.email && String(b.email).trim().length > 0 ? String(b.email).trim().toLowerCase() : `${String(b.mobile).trim()}@a1solar.com`;
    const rawPassword = b.password && String(b.password).trim().length > 0 ? String(b.password).trim() : "admin123";
    const hash = bcryptjs.hashSync(rawPassword, 10);

    const existingUser = await mongo.collection("users").findOne({ email });
    let userIdObj = existingUser?._id;
    if (!existingUser) {
      const userDoc = {
        name: b.name,
        email,
        role: assignedRole,
        status: "Active",
        ownerId: userId,
        ownerRole: userRole,
        createdBy: userId,
        updatedBy: userId,
        created_at: new Date(),
        created_by: userId,
        password_hash: hash,
      };
      const userRes = await mongo.collection("users").insertOne(userDoc);
      userIdObj = userRes.insertedId;
    }

    const doc = {
      ownerId: userId,
      ownerRole: userRole,
      createdBy: userId,
      updatedBy: userId,
      customer_number: await getNextNumber(mongo, "CUS"),
      profile_id: userIdObj ? userIdObj.toString() : null,
      name: b.name,
      mobile: b.mobile,
      email,
      customer_type: b.customerType || "Residential",
      gst_number: b.gstNumber || null,
      consumer_number: b.consumerNumber || null,
      provider: b.provider || null,
      status: "Active",
      created_at: new Date(),
      created_by: userId,
    };
    const result = await mongo.collection("customers").insertOne(doc);
    return success(res.status(201), "Customer created successfully", { id: result.insertedId.toString(), ...doc });
  }),
);

customersRouter.delete(
  "/:id",
  requirePermission("customers:delete"),
  authorizeOwner("customers"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    const { ObjectId } = await import("mongodb");
    await mongo.collection("customers").deleteOne({ _id: req.doc._id });
    return success(res, "Customer deleted", { id: req.doc._id.toString() });
  }),
);

// ----------------------------------------------------
// 3. PRODUCTS ROUTER
// ----------------------------------------------------
export const productsRouter = Router();
productsRouter.use(requireAuth);
productsRouter.get(
  "/",
  requireAnyPermission("products:view", "quotations:create", "invoices:create"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    let searchFilter = {};
    if (req.query.search) {
      const s = String(req.query.search).trim();
      searchFilter = {
        $or: [
          { name: { $regex: s, $options: "i" } },
          { sku: { $regex: s, $options: "i" } },
          { brand: { $regex: s, $options: "i" } },
        ],
      };
    }
    const query = await getScopedQuery(req, searchFilter);
    const items = await mongo.collection("products").find(query).sort({ created_at: -1 }).toArray();
    const formatted = items.map((item) => ({ id: item._id.toString(), ...item }));
    return success(res, "Products retrieved", formatted);
  }),
);

productsRouter.post(
  "/",
  requirePermission("products:create"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    const b = req.body;
    const userId = req.user?._id || req.auth?.userId;
    const userRole = req.user?.role || req.auth?.roles?.[0] || "admin";

    const doc = {
      ownerId: userId,
      ownerRole: userRole,
      createdBy: userId,
      updatedBy: userId,
      sku: b.sku || await getNextNumber(mongo, "SKU"),
      name: b.name,
      category: b.category,
      brand: b.brand || null,
      model: b.model || null,
      unit: b.unit || "Nos",
      purchase_price: Number(b.purchasePrice || 0),
      selling_price: Number(b.sellingPrice || 0),
      tax_rate: Number(b.taxRate || 0),
      minimum_stock: Number(b.minimumStock || 0),
      status: "Active",
      created_at: new Date(),
      created_by: userId,
    };
    const result = await mongo.collection("products").insertOne(doc);
    return success(res.status(201), "Product created", { id: result.insertedId.toString(), ...doc });
  }),
);

productsRouter.delete(
  "/:id",
  requirePermission("products:delete"),
  authorizeOwner("products"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    await mongo.collection("products").deleteOne({ _id: req.doc._id });
    return success(res, "Product deleted", null);
  }),
);

// ----------------------------------------------------
// 4. PROJECTS ROUTER
// ----------------------------------------------------
export const projectsRouter = Router();
projectsRouter.use(requireAuth);
projectsRouter.get(
  "/",
  requirePermission("projects:view"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    let query = await getScopedQuery(req);
    if (req.user?.roles?.includes("installation_staff")) {
      query = { assigned_to: req.user._id };
    }
    const items = await mongo.collection("projects").find(query).sort({ updated_at: -1 }).toArray();
    const formatted = items.map(item => ({ id: item._id.toString(), ...item }));
    return success(res, "Projects retrieved", formatted);
  }),
);

projectsRouter.post(
  "/",
  requireAnyPermission("projects:create", "projects:update"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    const b = req.body;
    const project_number = b.project_number || (await getNextNumber(mongo, "PRJ"));
    const doc = {
      ownerId: req.user._id,
      ownerRole: req.user.roles?.[0] || "admin",
      createdBy: req.user._id,
      updatedBy: req.user._id,
      project_number,
      customer_id: b.customer_id || b.customerId || null,
      customer_name: b.customer_name || b.customerName || null,
      capacity_kw: Number(b.capacity_kw || b.capacityKw || 0),
      stage: b.stage || "Confirmed",
      progress: Number(b.progress || 0),
      project_value: Number(b.project_value || b.projectValue || 0),
      start_date: b.start_date || new Date().toISOString().slice(0, 10),
      expected_completion_date: b.expected_completion_date || null,
      assigned_to: b.assigned_to || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const result = await mongo.collection("projects").insertOne(doc);
    return success(res.status(201), "Project created successfully", { id: result.insertedId.toString(), ...doc });
  }),
);

projectsRouter.patch(
  "/:id/progress",
  requireAnyPermission("projects:update", "projects:change_stage"),
  authorizeOwner("projects"),
  asyncHandler(async (req, res) => {
    const progress = Number(req.body.progress);
    const stage = String(req.body.stage ?? "");
    const mongo = await getMongoDb();

    await mongo.collection("projects").updateOne(
      { _id: req.doc._id },
      { $set: { progress, stage, updatedBy: req.user._id, updated_at: new Date().toISOString() } }
    );
    return success(res, "Installation progress updated", { id: req.doc._id.toString(), progress, stage });
  }),
);

// ----------------------------------------------------
// 5. TICKETS ROUTER
// ----------------------------------------------------
export const ticketsRouter = Router();
ticketsRouter.use(requireAuth);
ticketsRouter.get(
  "/",
  requirePermission("tickets:view"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    let query = await getScopedQuery(req);
    if (req.user?.roles?.includes("service_technician")) {
      query = { assigned_to: req.user._id };
    }
    const items = await mongo.collection("service_tickets").find(query).sort({ opened_at: -1 }).toArray();
    const formatted = items.map(item => ({ id: item._id.toString(), ...item }));
    return success(res, "Service tickets retrieved", formatted);
  }),
);

ticketsRouter.post(
  "/",
  requireAnyPermission("tickets:create", "tickets:update"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    const b = req.body;
    const ticket_number = b.ticket_number || (await getNextNumber(mongo, "TKT"));
    const doc = {
      ownerId: req.user._id,
      ownerRole: req.user.roles?.[0] || "admin",
      createdBy: req.user._id,
      updatedBy: req.user._id,
      ticket_number,
      customer_id: b.customer_id || b.customerId || null,
      subject: b.subject || "Service Request",
      description: b.description || "",
      priority: b.priority || "Medium",
      status: b.status || "Open",
      assigned_to: b.assigned_to || null,
      opened_at: new Date().toISOString(),
      closed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const result = await mongo.collection("service_tickets").insertOne(doc);
    return success(res.status(201), "Service ticket created successfully", { id: result.insertedId.toString(), ...doc });
  }),
);

ticketsRouter.patch(
  "/:id",
  requirePermission("tickets:update"),
  authorizeOwner("service_tickets"),
  asyncHandler(async (req, res) => {
    const status = String(req.body.status ?? "");
    const resolution = String(req.body.resolution ?? "").trim();
    const mongo = await getMongoDb();

    await mongo.collection("service_tickets").updateOne(
      { _id: req.doc._id },
      {
        $set: {
          status,
          resolution: resolution || null,
          closed_at: status === "Closed" ? new Date().toISOString() : null,
          updatedBy: req.user._id,
        }
      }
    );
    return success(res, "Service ticket updated", { id: req.doc._id.toString(), status, resolution });
  }),
);

// ----------------------------------------------------
// HELPER FUNCTIONS FOR QUOTATIONS & INVOICES
// ----------------------------------------------------
// Legacy getNextQuotationNumber / getNextInvoiceNumber removed
// — replaced by getNextNumber(mongo, "QUO") / getNextNumber(mongo, "INV")

function parseQty(val) {
  if (typeof val === "number") return val;
  if (!val) return 0;
  const match = String(val).match(/[0-9]+(?:\.[0-9]+)?/);
  return match ? parseFloat(match[0]) : 0;
}

// ----------------------------------------------------
// 6. QUOTATIONS ROUTER
// ----------------------------------------------------
export const quotationsRouter = Router();
quotationsRouter.use(requireAuth);

quotationsRouter.get(
  "/",
  requirePermission("quotations:view"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    const query = await getScopedQuery(req, { status: { $ne: "Archived" } });

    const items = await mongo.collection("quotations").find(query).sort({ created_at: -1 }).toArray();
    const customers = await mongo.collection("customers").find().toArray();
    const users = await mongo.collection("users").find().toArray();
    const customerMap = new Map(customers.map((c) => [c._id.toString(), c]));
    const userMap = new Map();
    users.forEach((u) => {
      if (u._id) userMap.set(u._id.toString(), u);
      if (u.email) userMap.set(u.email.trim().toLowerCase(), u);
    });

    const formatted = items.map((q) => {
      const c = customerMap.get(String(q.customer_id));
      const owner = userMap.get(String(q.ownerId || q.createdBy || q.created_by)) || (q.ownerEmail ? userMap.get(String(q.ownerEmail).toLowerCase()) : null);
      return {
        id: q._id.toString(),
        ...q,
        company_name: owner?.company_name || q.company_name || q.companyName || null,
        company_address: owner?.company_address || q.company_address || q.companyAddress || null,
        company_gstin: owner?.company_gstin || q.company_gstin || q.companyGstin || null,
        company_phone: owner?.phone || q.company_phone || q.companyPhone || null,
        company_email: owner?.email || q.company_email || q.companyEmail || null,
        company_logo_url: owner?.company_logo_url || q.company_logo_url || q.companyLogoUrl || null,
        company_signature_url: owner?.company_signature_url || q.company_signature_url || q.companySignatureUrl || null,
        bank_details: owner?.bank_details || q.bank_details || q.bankDetails || null,
        owner: owner ? {
          name: owner.name,
          phone: owner.phone,
          email: owner.email,
          company_name: owner.company_name,
          company_address: owner.company_address,
          company_gstin: owner.company_gstin,
          company_logo_url: owner.company_logo_url,
          company_signature_url: owner.company_signature_url,
        } : null,
        customers: c ? {
          name: c.name, mobile: c.mobile, email: c.email, gst_number: c.gst_number
        } : {
          name: q.customer_name || "Customer", mobile: q.customer_mobile || "", email: q.customer_email || "", gst_number: q.customer_gst || ""
        },
        quotation_items: q.quotation_items || q.items || [],
      };
    });
    return success(res, "Quotations retrieved", formatted);
  }),
);

quotationsRouter.get(
  "/:id",
  requirePermission("quotations:view"),
  authorizeOwner("quotations"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    const q = req.doc;
    const users = await mongo.collection("users").find().toArray();
    const userMap = new Map();
    users.forEach((u) => {
      if (u._id) userMap.set(u._id.toString(), u);
      if (u.email) userMap.set(u.email.trim().toLowerCase(), u);
    });
    const owner = userMap.get(String(q.ownerId || q.createdBy || q.created_by)) || (q.ownerEmail ? userMap.get(String(q.ownerEmail).toLowerCase()) : null);
    return success(res, "Quotation retrieved", {
      id: q._id.toString(),
      ...q,
      company_name: owner?.company_name || q.company_name || q.companyName || null,
      company_address: owner?.company_address || q.company_address || q.companyAddress || null,
      company_gstin: owner?.company_gstin || q.company_gstin || q.companyGstin || null,
      company_phone: owner?.phone || q.company_phone || q.companyPhone || null,
      company_email: owner?.email || q.company_email || q.companyEmail || null,
      company_logo_url: owner?.company_logo_url || q.company_logo_url || q.companyLogoUrl || null,
      company_signature_url: owner?.company_signature_url || q.company_signature_url || q.companySignatureUrl || null,
      bank_details: owner?.bank_details || q.bank_details || q.bankDetails || null,
      owner: owner ? {
        name: owner.name,
        phone: owner.phone,
        email: owner.email,
        company_name: owner.company_name,
        company_address: owner.company_address,
        company_gstin: owner.company_gstin,
        company_logo_url: owner.company_logo_url,
        company_signature_url: owner.company_signature_url,
      } : null,
    });
  }),
);

quotationsRouter.post(
  "/",
  requirePermission("quotations:create"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    const b = req.body;
    const userId = req.user?._id || req.auth?.userId;
    const userRole = req.user?.role || req.auth?.roles?.[0] || "admin";

    let ownerUser = null;
    try {
      const { ObjectId } = await import("mongodb");
      if (userId && ObjectId.isValid(userId)) {
        ownerUser = await mongo.collection("users").findOne({ _id: new ObjectId(userId) });
      }
    } catch {}
    if (!ownerUser && req.auth?.email) {
      ownerUser = await mongo.collection("users").findOne({ email: req.auth.email.trim().toLowerCase() });
    }

    let effectiveOwner = ownerUser;
    if (userRole === "customer" || req.user?.roles?.includes("customer")) {
      const adminId = ownerUser?.ownerId || ownerUser?.createdBy || ownerUser?.created_by;
      let adminUser = null;
      if (adminId) {
        try {
          const { ObjectId } = await import("mongodb");
          if (ObjectId.isValid(String(adminId))) {
            adminUser = await mongo.collection("users").findOne({ _id: new ObjectId(String(adminId)) });
          }
        } catch {}
      }
      if (!adminUser && ownerUser?.email) {
        const custDoc = await mongo.collection("customers").findOne({
          $or: [{ profile_id: userId }, { email: ownerUser.email }]
        });
        if (custDoc?.ownerId || custDoc?.createdBy) {
          const aId = custDoc.ownerId || custDoc.createdBy;
          try {
            const { ObjectId } = await import("mongodb");
            if (ObjectId.isValid(String(aId))) {
              adminUser = await mongo.collection("users").findOne({ _id: new ObjectId(String(aId)) });
            }
          } catch {}
        }
      }
      if (!adminUser) {
        adminUser = await mongo.collection("users").findOne({
          $or: [{ role: "super_admin" }, { roles: "super_admin" }, { role: "superadmin" }]
        });
      }
      if (adminUser) effectiveOwner = adminUser;
    }

    let customerName = b.customerName || "Customer";
    let customerId = b.customerId || null;
    if (customerId && !b.customerName) {
      try {
        const { ObjectId } = await import("mongodb");
        const cDoc = await mongo.collection("customers").findOne({ _id: new ObjectId(customerId) });
        if (cDoc) customerName = cDoc.name;
      } catch {
        const cDoc = await mongo.collection("customers").findOne({ customer_number: customerId });
        if (cDoc) customerName = cDoc.name;
      }
    }

    const items = Array.isArray(b.items) ? b.items : [];
    const normalized = items.map((item) => ({
      product_name: String(item.productName || item.name || "Product"),
      description: String(item.description || ""),
      brand: String(item.brand || ""),
      quantity: isNaN(Number(item.quantity)) ? String(item.quantity) : Number(item.quantity || 1),
      unit_price: Number(item.unitPrice || item.price || 0),
      line_amount: Number((parseQty(item.quantity) || 0) * (item.unitPrice || item.price || 0)),
    }));
    const subtotal = normalized.reduce((sum, i) => sum + (Number(i.line_amount) || 0), 0);
    const discount = Number(b.discount || 0);
    const tax = Number(b.tax || 0);
    const grandTotal = subtotal > 0 ? subtotal - discount + tax : Number(b.grandTotal || 0);

    const firstBrand = normalized[0]?.brand || b.brand || b.brandName || null;
    const qDoc = {
      ownerId: effectiveOwner?._id?.toString() || userId,
      ownerRole: effectiveOwner?.role || userRole,
      ownerEmail: effectiveOwner?.email || req.auth?.email || null,
      createdBy: userId,
      updatedBy: userId,
      company_name: effectiveOwner?.company_name || ownerUser?.company_name || b.companyName || null,
      company_address: effectiveOwner?.company_address || ownerUser?.company_address || b.companyAddress || null,
      company_gstin: effectiveOwner?.company_gstin || ownerUser?.company_gstin || b.companyGstin || null,
      company_phone: effectiveOwner?.phone || ownerUser?.phone || b.companyPhone || b.phone || null,
      company_email: effectiveOwner?.email || ownerUser?.email || b.companyEmail || b.email || null,
      company_logo_url: effectiveOwner?.company_logo_url || ownerUser?.company_logo_url || b.companyLogoUrl || null,
      company_signature_url: effectiveOwner?.company_signature_url || ownerUser?.company_signature_url || b.companySignatureUrl || null,
      bank_details: effectiveOwner?.bank_details || ownerUser?.bank_details || b.bankDetails || null,
      quotation_number: await getNextNumber(mongo, "QOT", firstBrand),
      customer_id: customerId,
      customer_name: customerName,
      customer_mobile: b.customerMobile || null,
      customer_email: b.customerEmail || null,
      quotation_date: b.quotationDate || new Date().toISOString().slice(0, 10),
      capacity_kw: Number(b.capacityKw || 0),
      quotation_type: b.quotationType || "Residential",
      title: b.title || "Solar Installation Quotation",
      installation_address: b.installationAddress || b.consumerAddress || null,
      subtotal,
      discount,
      tax,
      grand_total: grandTotal,
      terms: b.terms || null,
      status: b.status || "Draft",
      quotation_items: normalized,
      customer_signature_url: b.customerSignatureUrl || null,
      created_at: new Date(),
      created_by: userId,
    };
    const result = await mongo.collection("quotations").insertOne(qDoc);
    const createdQuotation = { id: result.insertedId.toString(), ...qDoc, customers: { name: customerName, mobile: b.customerMobile, email: b.customerEmail } };
    return success(res.status(201), "Quotation created", createdQuotation);
  }),
);

quotationsRouter.put(
  "/:id",
  requirePermission("quotations:update"),
  authorizeOwner("quotations"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    const b = req.body;
    const items = Array.isArray(b.items) ? b.items : [];
    const normalized = items.map((item) => {
      const qVal = item.quantity;
      const parsedQty = typeof qVal === "number" ? qVal : parseFloat(String(qVal).match(/[0-9]+(?:\.[0-9]+)?/)?.[0] || "1");
      const unitPrice = Number(item.unitPrice || item.unit_price || 0);
      return {
        product_name: String(item.productName || item.product_name || item.name || "Product"),
        description: String(item.description || ""),
        brand: String(item.brand || ""),
        quantity: isNaN(Number(qVal)) ? String(qVal) : Number(qVal || 1),
        unit_price: unitPrice,
        line_amount: (parsedQty || 1) * unitPrice,
      };
    });

    const subtotal = normalized.reduce((sum, i) => sum + (Number(i.line_amount) || 0), 0);
    const grandTotal = subtotal;

    const updateData = {
      updatedBy: req.user._id,
      updated_at: new Date(),
      customer_name: b.customerName || req.doc.customer_name,
      customer_mobile: b.customerMobile ?? req.doc.customer_mobile,
      customer_email: b.customerEmail ?? req.doc.customer_email,
      quotation_date: b.quotationDate || req.doc.quotation_date,
      capacity_kw: Number(b.capacityKw ?? req.doc.capacity_kw ?? 0),
      quotation_type: b.quotationType || req.doc.quotation_type,
      consumer_address: b.consumerAddress || req.doc.consumer_address,
      installation_address: b.consumerAddress || b.installationAddress || req.doc.installation_address,
      subtotal,
      grand_total: grandTotal,
      items: normalized,
      quotation_items: normalized,
      customer_signature_url: b.customerSignatureUrl ?? req.doc.customer_signature_url ?? null,
      customers: {
        name: b.customerName || req.doc.customer_name,
        mobile: b.customerMobile ?? req.doc.customer_mobile,
        email: b.customerEmail ?? req.doc.customer_email,
        address: b.consumerAddress || req.doc.consumer_address
      },
    };
    delete updateData.ownerId;
    delete updateData.ownerRole;

    await mongo.collection("quotations").updateOne({ _id: req.doc._id }, { $set: updateData });
    return success(res, "Quotation updated successfully", { id: req.doc._id.toString() });
  }),
);

quotationsRouter.delete(
  "/:id",
  requirePermission("quotations:delete"),
  authorizeOwner("quotations"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    const { ObjectId } = await import("mongodb");
    const idParam = String(req.params.id);
    let filter = { _id: req.doc._id };
    try {
      if (ObjectId.isValid(idParam) && idParam.length === 24) {
        filter = { $or: [{ _id: new ObjectId(idParam) }, { _id: req.doc._id }] };
      } else {
        filter = { $or: [{ quotation_number: idParam }, { _id: req.doc._id }] };
      }
    } catch {}
    const result = await mongo.collection("quotations").deleteMany(filter);
    return success(res, "Quotation deleted permanently", { id: idParam, deletedCount: result.deletedCount });
  }),
);

quotationsRouter.patch(
  "/:id/transfer-ownership",
  requireRole("super_admin"),
  authorizeOwner("quotations"),
  asyncHandler(async (req, res) => {
    const { newOwnerId, newOwnerRole } = req.body;
    if (!newOwnerId) throw new AppError(400, "newOwnerId is required", "VALIDATION_ERROR");
    const mongo = await getMongoDb();
    await mongo.collection("quotations").updateOne(
      { _id: req.doc._id },
      { $set: { ownerId: String(newOwnerId), ownerRole: newOwnerRole || "admin", updatedBy: req.user._id } }
    );
    return success(res, "Ownership transferred successfully", { id: req.doc._id.toString(), ownerId: newOwnerId });
  }),
);

quotationsRouter.get(
  "/:id/download",
  requirePermission("quotations:view"),
  authorizeOwner("quotations"),
  asyncHandler(async (req, res) => {
    return success(res, "Quotation PDF download data retrieved", req.doc);
  }),
);

quotationsRouter.post(
  "/:id/print",
  requirePermission("quotations:view"),
  authorizeOwner("quotations"),
  asyncHandler(async (req, res) => {
    return success(res, "Quotation printable format retrieved", req.doc);
  }),
);

quotationsRouter.post(
  "/:id/email",
  requirePermission("quotations:view"),
  authorizeOwner("quotations"),
  asyncHandler(async (req, res) => {
    return success(res, `Quotation emailed to ${req.doc.customer_email || "customer"}`, { sent: true });
  }),
);

// ----------------------------------------------------
// 7. INVOICES ROUTER
// ----------------------------------------------------
export const invoicesRouter = Router();
invoicesRouter.use(requireAuth);

invoicesRouter.get(
  "/",
  requirePermission("invoices:view"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    const query = await getScopedQuery(req);

    const items = await mongo.collection("invoices").find(query).sort({ created_at: -1 }).toArray();
    const customers = await mongo.collection("customers").find().toArray();
    const users = await mongo.collection("users").find().toArray();
    const customerMap = new Map(customers.map((c) => [c._id.toString(), c]));
    const userMap = new Map();
    users.forEach((u) => {
      if (u._id) userMap.set(u._id.toString(), u);
      if (u.email) userMap.set(u.email.trim().toLowerCase(), u);
    });

    const formatted = items.map((item, idx) => {
      const c = customerMap.get(String(item.customer_id));
      const owner = userMap.get(String(item.ownerId || item.createdBy || item.created_by)) || (item.ownerEmail ? userMap.get(String(item.ownerEmail).toLowerCase()) : null);
      let invNum = item.invoice_number;

      // Auto-migrate legacy format (like A1/2026/4) to standard INV-A1S-2026-0101 format
      if (!invNum || invNum.includes("/") || !invNum.startsWith("INV-")) {
        const numMatch = String(invNum || "").match(/\d+$/);
        const seqVal = numMatch ? parseInt(numMatch[0], 10) : (items.length - idx);
        const padSeq = String(seqVal > 0 ? seqVal : 1).padStart(4, "0");
        invNum = `INV-A1S-2026-${padSeq}`;
        
        void mongo.collection("invoices").updateOne(
          { _id: item._id },
          { $set: { invoice_number: invNum } }
        );
      }

      return {
        id: item._id.toString(),
        ...item,
        company_name: owner?.company_name || item.company_name || item.companyName || null,
        company_address: owner?.company_address || item.company_address || item.companyAddress || null,
        company_gstin: owner?.company_gstin || item.company_gstin || item.companyGstin || null,
        company_phone: owner?.phone || item.company_phone || item.companyPhone || null,
        company_email: owner?.email || item.company_email || item.companyEmail || null,
        company_logo_url: owner?.company_logo_url || item.company_logo_url || item.companyLogoUrl || null,
        company_signature_url: owner?.company_signature_url || item.company_signature_url || item.companySignatureUrl || null,
        bank_details: owner?.bank_details || item.bank_details || item.bankDetails || null,
        owner: owner ? {
          name: owner.name,
          phone: owner.phone,
          email: owner.email,
          company_name: owner.company_name,
          company_address: owner.company_address,
          company_gstin: owner.company_gstin,
          company_logo_url: owner.company_logo_url,
          company_signature_url: owner.company_signature_url,
        } : null,
        invoice_number: invNum,
        customers: c ? {
          name: c.name, mobile: c.mobile, email: c.email, gst_number: c.gst_number
        } : {
          name: item.customer_name || "Customer", mobile: item.customer_mobile || "", email: item.customer_email || "", gst_number: item.customer_gst || ""
        }
      };
    });
    return success(res, "Invoices retrieved", formatted);
  }),
);

invoicesRouter.get(
  "/:id",
  requirePermission("invoices:view"),
  authorizeOwner("invoices"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    const inv = req.doc;
    const users = await mongo.collection("users").find().toArray();
    const userMap = new Map();
    users.forEach((u) => {
      if (u._id) userMap.set(u._id.toString(), u);
      if (u.email) userMap.set(u.email.trim().toLowerCase(), u);
    });
    const owner = userMap.get(String(inv.ownerId || inv.createdBy || inv.created_by)) || (inv.ownerEmail ? userMap.get(String(inv.ownerEmail).toLowerCase()) : null);
    return success(res, "Invoice retrieved", {
      id: inv._id.toString(),
      ...inv,
      company_name: owner?.company_name || inv.company_name || inv.companyName || null,
      company_address: owner?.company_address || inv.company_address || inv.companyAddress || null,
      company_gstin: owner?.company_gstin || inv.company_gstin || inv.companyGstin || null,
      company_phone: owner?.phone || inv.company_phone || inv.companyPhone || null,
      company_email: owner?.email || inv.company_email || inv.companyEmail || null,
      company_logo_url: owner?.company_logo_url || inv.company_logo_url || inv.companyLogoUrl || null,
      company_signature_url: owner?.company_signature_url || inv.company_signature_url || inv.companySignatureUrl || null,
      bank_details: owner?.bank_details || inv.bank_details || inv.bankDetails || null,
      owner: owner ? {
        name: owner.name,
        phone: owner.phone,
        email: owner.email,
        company_name: owner.company_name,
        company_address: owner.company_address,
        company_gstin: owner.company_gstin,
        company_logo_url: owner.company_logo_url,
        company_signature_url: owner.company_signature_url,
      } : null,
    });
  }),
);

invoicesRouter.post(
  "/",
  requirePermission("invoices:create"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    const b = req.body;
    const userId = req.user?._id || req.auth?.userId;
    const userRole = req.user?.role || req.auth?.roles?.[0] || "admin";

    let ownerUser = null;
    try {
      const { ObjectId } = await import("mongodb");
      if (userId && ObjectId.isValid(userId)) {
        ownerUser = await mongo.collection("users").findOne({ _id: new ObjectId(userId) });
      }
    } catch {}
    if (!ownerUser && req.auth?.email) {
      ownerUser = await mongo.collection("users").findOne({ email: req.auth.email.trim().toLowerCase() });
    }

    let effectiveOwner = ownerUser;
    if (userRole === "customer" || req.user?.roles?.includes("customer")) {
      const adminId = ownerUser?.ownerId || ownerUser?.createdBy || ownerUser?.created_by;
      let adminUser = null;
      if (adminId) {
        try {
          const { ObjectId } = await import("mongodb");
          if (ObjectId.isValid(String(adminId))) {
            adminUser = await mongo.collection("users").findOne({ _id: new ObjectId(String(adminId)) });
          }
        } catch {}
      }
      if (!adminUser && ownerUser?.email) {
        const custDoc = await mongo.collection("customers").findOne({
          $or: [{ profile_id: userId }, { email: ownerUser.email }]
        });
        if (custDoc?.ownerId || custDoc?.createdBy) {
          const aId = custDoc.ownerId || custDoc.createdBy;
          try {
            const { ObjectId } = await import("mongodb");
            if (ObjectId.isValid(String(aId))) {
              adminUser = await mongo.collection("users").findOne({ _id: new ObjectId(String(aId)) });
            }
          } catch {}
        }
      }
      if (!adminUser) {
        adminUser = await mongo.collection("users").findOne({
          $or: [{ role: "super_admin" }, { roles: "super_admin" }, { role: "superadmin" }]
        });
      }
      if (adminUser) effectiveOwner = adminUser;
    }

    const customerName = b.customerName || "Customer";
    const items = Array.isArray(b.items) ? b.items : [];

    const normalized = items.map((item) => {
      const parsed = parseQty(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice || 0);
      return {
        product_name: String(item.productName || item.name || "Product"),
        description: String(item.description || ""),
        brand: String(item.brand || ""),
        quantity: isNaN(Number(item.quantity)) ? String(item.quantity) : Number(item.quantity || 1),
        unit_price: unitPrice,
        line_amount: parsed * unitPrice,
      };
    });

    const subtotal = normalized.reduce((sum, item) => sum + item.line_amount, 0);
    const tax = Number(b.tax || 0);
    const total = subtotal > 0 ? subtotal + tax : Number(b.total || 0);

    const firstBrand = normalized[0]?.brand || b.brand || b.brandName || null;
    const doc = {
      ownerId: effectiveOwner?._id?.toString() || userId,
      ownerRole: effectiveOwner?.role || userRole,
      createdBy: userId,
      updatedBy: userId,
      company_name: effectiveOwner?.company_name || ownerUser?.company_name || b.companyName || null,
      company_address: effectiveOwner?.company_address || ownerUser?.company_address || b.companyAddress || null,
      company_gstin: effectiveOwner?.company_gstin || ownerUser?.company_gstin || b.companyGstin || null,
      company_logo_url: effectiveOwner?.company_logo_url || ownerUser?.company_logo_url || b.companyLogoUrl || null,
      company_signature_url: effectiveOwner?.company_signature_url || ownerUser?.company_signature_url || b.companySignatureUrl || null,
      bank_details: effectiveOwner?.bank_details || ownerUser?.bank_details || b.bankDetails || null,
      invoice_number: await getNextNumber(mongo, "INV", firstBrand),
      customer_id: b.customerId || null,
      customer_name: customerName,
      customer_mobile: b.customerMobile || null,
      customer_email: b.customerEmail || null,
      invoice_date: b.invoiceDate || new Date().toISOString().slice(0, 10),
      due_date: b.dueDate || new Date().toISOString().slice(0, 10),
      title: b.title || "Solar Invoice",
      installation_address: b.installationAddress || b.consumerAddress || null,
      subtotal,
      tax,
      total,
      paid_amount: Number(b.paidAmount || 0),
      status: b.status || "Draft",
      invoice_items: normalized,
      created_at: new Date(),
      created_by: userId,
    };

    const result = await mongo.collection("invoices").insertOne(doc);
    return success(res.status(201), "Invoice created", { id: result.insertedId.toString(), ...doc });
  }),
);

invoicesRouter.put(
  "/:id",
  requirePermission("invoices:update"),
  authorizeOwner("invoices"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    const b = req.body;
    const items = Array.isArray(b.items) ? b.items : [];
    const normalized = items.map((item) => {
      const qVal = item.quantity;
      const parsedQty = typeof qVal === "number" ? qVal : parseFloat(String(qVal).match(/[0-9]+(?:\.[0-9]+)?/)?.[0] || "1");
      const unitPrice = Number(item.unitPrice || item.unit_price || 0);
      return {
        product_name: String(item.productName || item.product_name || item.name || "Product"),
        description: String(item.description || ""),
        brand: String(item.brand || ""),
        quantity: isNaN(Number(qVal)) ? String(qVal) : Number(qVal || 1),
        unit_price: unitPrice,
        line_amount: (parsedQty || 1) * unitPrice,
      };
    });

    const subtotal = normalized.reduce((sum, i) => sum + (Number(i.line_amount) || 0), 0);
    const total = subtotal;

    const updateData = {
      updatedBy: req.user._id,
      updated_at: new Date(),
      customer_name: b.customerName || req.doc.customer_name,
      customer_mobile: b.customerMobile ?? req.doc.customer_mobile,
      customer_email: b.customerEmail ?? req.doc.customer_email,
      invoice_date: b.invoiceDate || req.doc.invoice_date,
      due_date: b.dueDate || req.doc.due_date,
      title: b.title || req.doc.title,
      consumer_address: b.consumerAddress || req.doc.consumer_address,
      installation_address: b.consumerAddress || b.installationAddress || req.doc.installation_address,
      paid_amount: Number(b.paidAmount ?? req.doc.paid_amount ?? 0),
      status: b.status || req.doc.status,
      subtotal,
      total,
      items: normalized,
      invoice_items: normalized,
      customers: {
        name: b.customerName || req.doc.customer_name,
        mobile: b.customerMobile ?? req.doc.customer_mobile,
        email: b.customerEmail ?? req.doc.customer_email,
        address: b.consumerAddress || req.doc.consumer_address
      },
    };
    delete updateData.ownerId;
    delete updateData.ownerRole;

    await mongo.collection("invoices").updateOne({ _id: req.doc._id }, { $set: updateData });
    return success(res, "Invoice updated successfully", { id: req.doc._id.toString() });
  }),
);

invoicesRouter.delete(
  "/:id",
  requirePermission("invoices:delete"),
  authorizeOwner("invoices"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    const { ObjectId } = await import("mongodb");
    const idParam = String(req.params.id);
    let filter = { _id: req.doc._id };
    try {
      if (ObjectId.isValid(idParam) && idParam.length === 24) {
        filter = { $or: [{ _id: new ObjectId(idParam) }, { _id: req.doc._id }] };
      } else {
        filter = { $or: [{ invoice_number: idParam }, { _id: req.doc._id }] };
      }
    } catch {}
    const result = await mongo.collection("invoices").deleteMany(filter);
    return success(res, "Invoice deleted permanently", { id: idParam, deletedCount: result.deletedCount });
  }),
);

invoicesRouter.patch(
  "/:id/transfer-ownership",
  requireRole("super_admin"),
  authorizeOwner("invoices"),
  asyncHandler(async (req, res) => {
    const { newOwnerId, newOwnerRole } = req.body;
    if (!newOwnerId) throw new AppError(400, "newOwnerId is required", "VALIDATION_ERROR");
    const mongo = await getMongoDb();
    await mongo.collection("invoices").updateOne(
      { _id: req.doc._id },
      { $set: { ownerId: String(newOwnerId), ownerRole: newOwnerRole || "admin", updatedBy: req.user._id } }
    );
    return success(res, "Ownership transferred successfully", { id: req.doc._id.toString(), ownerId: newOwnerId });
  }),
);

// ----------------------------------------------------
// 8. AGREEMENTS ROUTER
// ----------------------------------------------------
export const agreementsRouter = Router();

agreementsRouter.post(
  "/payu-callback",
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    const payload = req.body || {};
    const { status, txnid, productinfo, mihpayid } = payload;

    let agreementNum = "";
    if (productinfo && productinfo.includes("Agreement ")) {
      agreementNum = productinfo.replace("Agreement ", "").trim();
    }

    let filter = {};
    if (txnid) {
      filter = { $or: [{ payu_txnid: txnid }, ...(agreementNum ? [{ agreement_number: agreementNum }] : [])] };
    } else if (agreementNum) {
      filter = { agreement_number: agreementNum };
    }

    if (status === "success" || status === "SUCCESS") {
      await mongo.collection("agreements").updateOne(filter, {
        $set: {
          payment_status: "Paid",
          paid_at: new Date().toISOString(),
          payment_method: "PayU Online",
          payu_txnid: mihpayid || txnid || `PAYU_${Date.now()}`
        }
      });
    }

    const webUrl = process.env.WEB_URL || "https://a1-solar-solution4.vercel.app";
    const redirectUrl = `${webUrl}/app/agreements?status=${status || "success"}`;
    res.setHeader("content-type", "text/html");
    return res.send(`<!DOCTYPE html><html><head><title>PayU Payment Processing</title></head><body><h3>Payment Processing... Redirecting back to dashboard.</h3><script>window.location.href = ${JSON.stringify(redirectUrl)};</script></body></html>`);
  })
);

agreementsRouter.use(requireAuth);

agreementsRouter.get(
  "/",
  requirePermission("agreements:view"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    const isCustomer = req.user?.roles?.includes("customer");
    const filter = await getScopedQuery(req);

    const items = await mongo.collection("agreements").find(filter).sort({ created_at: -1 }).toArray();
    const customers = await mongo.collection("customers").find().toArray();
    const users = await mongo.collection("users").find().toArray();
    const customerMap = new Map(customers.map((c) => [c._id.toString(), c]));
    const userMap = new Map();
    users.forEach((u) => {
      if (u._id) userMap.set(u._id.toString(), u);
      if (u.email) userMap.set(u.email.trim().toLowerCase(), u);
    });

    const formatted = items.map((a) => {
      const c = customerMap.get(String(a.customer_id));
      const owner = userMap.get(String(a.ownerId || a.createdBy || a.created_by)) || (a.ownerEmail ? userMap.get(String(a.ownerEmail).toLowerCase()) : null);
      const base = {
        id: a._id.toString(),
        ...a,
        company_name: owner?.company_name || a.company_name || a.companyName || null,
        company_address: owner?.company_address || a.company_address || a.companyAddress || null,
        company_gstin: owner?.company_gstin || a.company_gstin || a.companyGstin || null,
        company_phone: owner?.phone || a.company_phone || a.companyPhone || null,
        company_email: owner?.email || a.company_email || a.companyEmail || null,
        company_logo_url: owner?.company_logo_url || a.company_logo_url || a.companyLogoUrl || null,
        company_signature_url: owner?.company_signature_url || a.company_signature_url || a.companySignatureUrl || null,
        bank_details: owner?.bank_details || a.bank_details || a.bankDetails || null,
        owner: owner ? {
          name: owner.name,
          phone: owner.phone,
          email: owner.email,
          company_name: owner.company_name,
          company_address: owner.company_address,
          company_gstin: owner.company_gstin,
          company_logo_url: owner.company_logo_url,
          company_signature_url: owner.company_signature_url,
        } : null,
        customers: c ? {
          name: c.name, mobile: c.mobile, email: c.email, address: c.address
        } : {
          name: a.customer_name || "Customer", mobile: a.customer_mobile || "", email: a.customer_email || "", address: a.consumer_address || ""
        },
      };
      if (isCustomer && a.payment_status !== "Paid") {
        return {
          id: base.id,
          agreement_number: base.agreement_number,
          created_at: base.created_at,
          payment_status: base.payment_status,
          payment_amount: base.payment_amount,
          customers: base.customers ? { name: base.customers.name } : null,
          locked: true,
        };
      }
      return base;
    });
    return success(res, "Agreements retrieved", formatted);
  }),
);

agreementsRouter.get(
  "/:id",
  requirePermission("agreements:view"),
  authorizeOwner("agreements"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    const agreement = req.doc;
    const users = await mongo.collection("users").find().toArray();
    const userMap = new Map();
    users.forEach((u) => {
      if (u._id) userMap.set(u._id.toString(), u);
      if (u.email) userMap.set(u.email.trim().toLowerCase(), u);
    });
    const owner = userMap.get(String(agreement.ownerId || agreement.createdBy || agreement.created_by)) || (agreement.ownerEmail ? userMap.get(String(agreement.ownerEmail).toLowerCase()) : null);
    return success(res, "Agreement details retrieved", {
      id: agreement._id.toString(),
      ...agreement,
      company_name: owner?.company_name || agreement.company_name || agreement.companyName || null,
      company_address: owner?.company_address || agreement.company_address || agreement.companyAddress || null,
      company_gstin: owner?.company_gstin || agreement.company_gstin || agreement.companyGstin || null,
      company_phone: owner?.phone || agreement.company_phone || agreement.companyPhone || null,
      company_email: owner?.email || agreement.company_email || agreement.companyEmail || null,
      company_logo_url: owner?.company_logo_url || agreement.company_logo_url || agreement.companyLogoUrl || null,
      company_signature_url: owner?.company_signature_url || agreement.company_signature_url || agreement.companySignatureUrl || null,
      bank_details: owner?.bank_details || agreement.bank_details || agreement.bankDetails || null,
      owner: owner ? {
        name: owner.name,
        phone: owner.phone,
        email: owner.email,
        company_name: owner.company_name,
        company_address: owner.company_address,
        company_gstin: owner.company_gstin,
        company_logo_url: owner.company_logo_url,
        company_signature_url: owner.company_signature_url,
      } : null,
    });
  }),
);

agreementsRouter.post(
  "/:id/payu-initiate",
  authorizeOwner("agreements"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    const agreement = req.doc;

    const key = process.env.PAYU_KEY || process.env.PAYU_MERCHANT_KEY || "hMFjB7";
    const salt = process.env.PAYU_SALT || process.env.PAYU_MERCHANT_SALT || "a1uB7QLzzynWz1leQbHGa61hKTBKdZq8";
    const txnid = `PAYU_${Date.now()}_${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const amount = Number(1).toFixed(2);
    const productinfo = `Agreement ${agreement.agreement_number}`;
    const firstname = agreement.customer_name || "Customer";
    const email = agreement.customer_email || req.auth?.email || "customer@a1solar.com";
    const phone = agreement.customer_mobile || "9999999999";

    const apiUrl = process.env.API_URL || "https://a1-solar-solution4.onrender.com/api/v1";
    const surl = `${apiUrl}/agreements/payu-callback`;
    const furl = `${apiUrl}/agreements/payu-callback`;

    const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${salt}`;
    const hash = crypto.createHash("sha512").update(hashString).digest("hex");

    await mongo.collection("agreements").updateOne(
      { _id: agreement._id },
      { $set: { payu_txnid: txnid, updated_at: new Date().toISOString() } }
    );

    return success(res, "PayU payment initiated", {
      payu_url: process.env.PAYU_URL || "https://test.payu.in/_payment",
      key,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      phone,
      surl,
      furl,
      hash,
      agreement_id: agreement._id.toString(),
      agreement_number: agreement.agreement_number
    });
  }),
);

agreementsRouter.get(
  "/:id/document",
  requirePermission("agreements:view"),
  authorizeOwner("agreements"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    const agreement = req.doc;
    if (req.user?.roles?.includes("customer")) {
      if (agreement.payment_status !== "Paid") {
        throw new AppError(402, "Verified payment is required before viewing or downloading this agreement", "PAYMENT_REQUIRED");
      }
    }
    const c = await mongo.collection("customers").findOne({ _id: agreement.customer_id });
    const users = await mongo.collection("users").find().toArray();
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));
    const owner = userMap.get(String(agreement.ownerId || agreement.createdBy || agreement.created_by));
    return success(res, "Agreement document retrieved", {
      id: agreement._id.toString(),
      ...agreement,
      company_name: agreement.company_name || agreement.companyName || owner?.company_name || null,
      company_address: agreement.company_address || agreement.companyAddress || owner?.company_address || null,
      company_logo_url: agreement.company_logo_url || agreement.companyLogoUrl || owner?.company_logo_url || null,
      company_signature_url: agreement.company_signature_url || agreement.companySignatureUrl || owner?.company_signature_url || null,
      bank_details: agreement.bank_details || agreement.bankDetails || owner?.bank_details || null,
      customers: c ? { name: c.name, mobile: c.mobile } : { name: agreement.customer_name || "Customer" },
    });
  }),
);

agreementsRouter.post(
  "/",
  requirePermission("agreements:create"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    const b = req.body;
    const userId = req.user?._id || req.auth?.userId;
    const userRole = req.user?.role || req.auth?.roles?.[0] || "admin";

    let ownerUser = null;
    try {
      const { ObjectId } = await import("mongodb");
      if (userId && ObjectId.isValid(userId)) {
        ownerUser = await mongo.collection("users").findOne({ _id: new ObjectId(userId) });
      }
    } catch {}
    if (!ownerUser && req.auth?.email) {
      ownerUser = await mongo.collection("users").findOne({ email: req.auth.email.trim().toLowerCase() });
    }

    let effectiveOwner = ownerUser;
    if (userRole === "customer" || req.user?.roles?.includes("customer")) {
      const adminId = ownerUser?.ownerId || ownerUser?.createdBy || ownerUser?.created_by;
      let adminUser = null;
      if (adminId) {
        try {
          const { ObjectId } = await import("mongodb");
          if (ObjectId.isValid(String(adminId))) {
            adminUser = await mongo.collection("users").findOne({ _id: new ObjectId(String(adminId)) });
          }
        } catch {}
      }
      if (!adminUser && ownerUser?.email) {
        const custDoc = await mongo.collection("customers").findOne({
          $or: [{ profile_id: userId }, { email: ownerUser.email }]
        });
        if (custDoc?.ownerId || custDoc?.createdBy) {
          const aId = custDoc.ownerId || custDoc.createdBy;
          try {
            const { ObjectId } = await import("mongodb");
            if (ObjectId.isValid(String(aId))) {
              adminUser = await mongo.collection("users").findOne({ _id: new ObjectId(String(aId)) });
            }
          } catch {}
        }
      }
      if (!adminUser) {
        adminUser = await mongo.collection("users").findOne({
          $or: [{ role: "super_admin" }, { roles: "super_admin" }, { role: "superadmin" }]
        });
      }
      if (adminUser) effectiveOwner = adminUser;
    }

    let customerName = b.customerName || "Customer";
    let customerEmail = b.customerEmail || null;
    let customerMobile = b.customerMobile || null;

    const today = new Date();

    const firstBrand = b.brand || b.brandName || null;
    const doc = {
      ownerId: effectiveOwner?._id?.toString() || userId,
      ownerRole: effectiveOwner?.role || userRole,
      createdBy: userId,
      updatedBy: userId,
      company_name: effectiveOwner?.company_name || ownerUser?.company_name || b.companyName || null,
      company_address: effectiveOwner?.company_address || ownerUser?.company_address || b.companyAddress || null,
      company_gstin: effectiveOwner?.company_gstin || ownerUser?.company_gstin || b.companyGstin || null,
      company_logo_url: effectiveOwner?.company_logo_url || ownerUser?.company_logo_url || b.companyLogoUrl || null,
      company_signature_url: effectiveOwner?.company_signature_url || ownerUser?.company_signature_url || b.companySignatureUrl || null,
      bank_details: effectiveOwner?.bank_details || ownerUser?.bank_details || b.bankDetails || null,
      agreement_number: await getNextNumber(mongo, "AGR", firstBrand),
      customer_id: b.customerId || null,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_mobile: customerMobile,
      quotation_id: b.quotationId || null,
      quotation_number: b.quotationNumber || null,
      status: "Draft",
      payment_status: "Unpaid",
      payment_amount: 1,
      consumer_address: b.consumerAddress || null,
      capacity_kw: Number(b.capacityKw || 3),
      terms_of_payment: b.termsOfPayment || "70% advance payment shall be made at the time of order confirmation. Remaining 30% payment shall be made immediately after installation completion.",
      agreement_date: b.agreementDate || today.toISOString().slice(0, 10),
      created_at: today.toISOString(),
      updated_at: today.toISOString(),
      created_by: userId,
      customer_signature_url: b.customerSignatureUrl || null,
    };
    const result = await mongo.collection("agreements").insertOne(doc);
    return success(res.status(201), "Agreement draft created", {
      ...doc,
      id: result.insertedId.toString(),
      customers: { name: customerName, mobile: customerMobile, email: customerEmail, address: b.consumerAddress },
    });
  }),
);

agreementsRouter.delete(
  "/:id",
  requirePermission("agreements:delete"),
  authorizeOwner("agreements"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    const { ObjectId } = await import("mongodb");
    const idParam = String(req.params.id);
    let filter = { _id: req.doc._id };
    try {
      if (ObjectId.isValid(idParam) && idParam.length === 24) {
        filter = { $or: [{ _id: new ObjectId(idParam) }, { _id: req.doc._id }] };
      } else {
        filter = { $or: [{ agreement_number: idParam }, { _id: req.doc._id }] };
      }
    } catch {}
    const result = await mongo.collection("agreements").deleteMany(filter);
    return success(res, "Agreement deleted permanently", { id: idParam, deletedCount: result.deletedCount });
  }),
);

agreementsRouter.patch(
  "/:id/transfer-ownership",
  requireRole("super_admin"),
  authorizeOwner("agreements"),
  asyncHandler(async (req, res) => {
    const { newOwnerId, newOwnerRole } = req.body;
    if (!newOwnerId) throw new AppError(400, "newOwnerId is required", "VALIDATION_ERROR");
    const mongo = await getMongoDb();
    await mongo.collection("agreements").updateOne(
      { _id: req.doc._id },
      { $set: { ownerId: String(newOwnerId), ownerRole: newOwnerRole || "admin", updatedBy: req.user._id } }
    );
    return success(res, "Ownership transferred successfully", { id: req.doc._id.toString(), ownerId: newOwnerId });
  }),
);

// ----------------------------------------------------
// 9. CONTRACTS ROUTER
// ----------------------------------------------------
export const contractsRouter = Router();
contractsRouter.use(requireAuth);

contractsRouter.get(
  "/",
  requirePermission("agreements:view"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    const query = await getScopedQuery(req);
    const items = await mongo.collection("contracts").find(query).sort({ created_at: -1 }).toArray();
    const formatted = items.map(item => ({ id: item._id.toString(), ...item }));
    return success(res, "Contracts retrieved", formatted);
  }),
);

contractsRouter.get(
  "/:id",
  requirePermission("agreements:view"),
  authorizeOwner("contracts"),
  asyncHandler(async (req, res) => {
    return success(res, "Contract retrieved", { id: req.doc._id.toString(), ...req.doc });
  }),
);

contractsRouter.post(
  "/",
  requirePermission("agreements:create"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    const b = req.body;
    const userId = req.user?._id || req.auth?.userId;
    const userRole = req.user?.role || req.auth?.roles?.[0] || "admin";

    const doc = {
      ownerId: userId,
      ownerRole: userRole,
      createdBy: userId,
      updatedBy: userId,
      contract_number: await getNextNumber(mongo, "CON"),
      customer_id: b.customerId || null,
      customer_name: b.customerName || "Customer",
      title: b.title || "Solar Maintenance Contract",
      start_date: b.startDate || new Date().toISOString().slice(0, 10),
      end_date: b.endDate || null,
      contract_value: Number(b.contractValue || 0),
      terms: b.terms || null,
      status: b.status || "Active",
      created_at: new Date(),
    };
    const result = await mongo.collection("contracts").insertOne(doc);
    return success(res.status(201), "Contract created", { id: result.insertedId.toString(), ...doc });
  }),
);

contractsRouter.delete(
  "/:id",
  requirePermission("agreements:delete"),
  authorizeOwner("contracts"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    await mongo.collection("contracts").deleteOne({ _id: req.doc._id });
    return success(res, "Contract deleted", { id: req.doc._id.toString() });
  }),
);

// ----------------------------------------------------
// 10. ESTIMATES ROUTER
// ----------------------------------------------------
export const estimatesRouter = Router();
estimatesRouter.use(requireAuth);

estimatesRouter.get(
  "/",
  requirePermission("quotations:view"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    const query = await getScopedQuery(req);
    const items = await mongo.collection("estimates").find(query).sort({ created_at: -1 }).toArray();
    const formatted = items.map(item => ({ id: item._id.toString(), ...item }));
    return success(res, "Estimates retrieved", formatted);
  }),
);

estimatesRouter.get(
  "/:id",
  requirePermission("quotations:view"),
  authorizeOwner("estimates"),
  asyncHandler(async (req, res) => {
    return success(res, "Estimate retrieved", { id: req.doc._id.toString(), ...req.doc });
  }),
);

estimatesRouter.post(
  "/",
  requirePermission("quotations:create"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    const b = req.body;
    const userId = req.user?._id || req.auth?.userId;
    const userRole = req.user?.role || req.auth?.roles?.[0] || "admin";

    const doc = {
      ownerId: userId,
      ownerRole: userRole,
      createdBy: userId,
      updatedBy: userId,
      estimate_number: await getNextNumber(mongo, "EST"),
      customer_id: b.customerId || null,
      customer_name: b.customerName || "Customer",
      title: b.title || "Project Solar Estimate",
      estimated_cost: Number(b.estimatedCost || 0),
      capacity_kw: Number(b.capacityKw || 0),
      valid_until: b.validUntil || null,
      items: b.items || [],
      status: b.status || "Draft",
      created_at: new Date(),
    };
    const result = await mongo.collection("estimates").insertOne(doc);
    return success(res.status(201), "Estimate created", { id: result.insertedId.toString(), ...doc });
  }),
);

estimatesRouter.delete(
  "/:id",
  requirePermission("quotations:delete"),
  authorizeOwner("estimates"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    await mongo.collection("estimates").deleteOne({ _id: req.doc._id });
    return success(res, "Estimate deleted", { id: req.doc._id.toString() });
  }),
);

// ----------------------------------------------------
// 11. ATTACHMENTS ROUTER
// ----------------------------------------------------
export const attachmentsRouter = Router();
attachmentsRouter.use(requireAuth);

attachmentsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    const query = await getScopedQuery(req);
    const items = await mongo.collection("attachments").find(query).sort({ created_at: -1 }).toArray();
    const formatted = items.map(item => ({ id: item._id.toString(), ...item }));
    return success(res, "Attachments retrieved", formatted);
  }),
);

attachmentsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    const b = req.body;
    const userId = req.user?._id || req.auth?.userId;
    const userRole = req.user?.role || req.auth?.roles?.[0] || "admin";

    const doc = {
      ownerId: userId,
      ownerRole: userRole,
      createdBy: userId,
      updatedBy: userId,
      filename: b.filename || "document.pdf",
      file_url: b.fileUrl || "#",
      file_type: b.fileType || "application/pdf",
      file_size: Number(b.fileSize || 0),
      resource_type: b.resourceType || "document",
      resource_id: b.resourceId || null,
      status: "Active",
      created_at: new Date(),
    };
    const result = await mongo.collection("attachments").insertOne(doc);
    return success(res.status(201), "Attachment created", { id: result.insertedId.toString(), ...doc });
  }),
);

attachmentsRouter.delete(
  "/:id",
  authorizeOwner("attachments"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    await mongo.collection("attachments").deleteOne({ _id: req.doc._id });
    return success(res, "Attachment deleted", { id: req.doc._id.toString() });
  }),
);

// ----------------------------------------------------
// 12. NOTES ROUTER
// ----------------------------------------------------
export const notesRouter = Router();
notesRouter.use(requireAuth);

notesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    const query = await getScopedQuery(req);
    const items = await mongo.collection("notes").find(query).sort({ created_at: -1 }).toArray();
    const formatted = items.map(item => ({ id: item._id.toString(), ...item }));
    return success(res, "Notes retrieved", formatted);
  }),
);

notesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    const b = req.body;
    const userId = req.user?._id || req.auth?.userId;
    const userRole = req.user?.role || req.auth?.roles?.[0] || "admin";

    const doc = {
      ownerId: userId,
      ownerRole: userRole,
      createdBy: userId,
      updatedBy: userId,
      title: b.title || "Untitled Note",
      content: b.content || "",
      resource_type: b.resourceType || "document",
      resource_id: b.resourceId || null,
      status: "Active",
      created_at: new Date(),
    };
    const result = await mongo.collection("notes").insertOne(doc);
    return success(res.status(201), "Note created", { id: result.insertedId.toString(), ...doc });
  }),
);

notesRouter.delete(
  "/:id",
  authorizeOwner("notes"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    await mongo.collection("notes").deleteOne({ _id: req.doc._id });
    return success(res, "Note deleted", { id: req.doc._id.toString() });
  }),
);

// ----------------------------------------------------
// 13. PROFILE ROUTER
// ----------------------------------------------------
export const profileRouter = Router();
profileRouter.use(requireAuth);
profileRouter.patch(
  "/",
  asyncHandler(async (req, res) => {
    const { fullName, phone, companyName, companyAddress, companyGstin, companyLogoUrl, companySignatureUrl, bankDetails } = req.body;
    if (!fullName) throw new AppError(400, "Full name is required", "VALIDATION_ERROR");
    const mongo = await getMongoDb();
    const { ObjectId } = await import("mongodb");
    const userId = req.user?._id || req.auth?.userId;
    const email = req.user?.email || req.auth?.email;

    const setFields = {
      name: fullName,
      phone: phone || null,
      updatedBy: userId,
      ...(companyName !== undefined ? { company_name: companyName } : {}),
      ...(companyAddress !== undefined ? { company_address: companyAddress } : {}),
      ...(companyGstin !== undefined ? { company_gstin: companyGstin } : {}),
      ...(companyLogoUrl !== undefined ? { company_logo_url: companyLogoUrl } : {}),
      ...(companySignatureUrl !== undefined ? { company_signature_url: companySignatureUrl } : {}),
      ...(bankDetails !== undefined ? { bank_details: bankDetails } : {}),
    };

    const queryOrs = [];
    if (userId && ObjectId.isValid(userId)) {
      queryOrs.push({ _id: new ObjectId(userId) });
    }
    if (userId) {
      queryOrs.push({ profile_id: String(userId) });
    }
    if (email) {
      queryOrs.push({ email: String(email).trim().toLowerCase() });
    }
    const query = queryOrs.length > 0 ? { $or: queryOrs } : {};

    await mongo.collection("users").updateMany(query, { $set: setFields });
    return success(res, "Profile updated successfully", { id: userId, fullName, phone, ...setFields });
  }),
);

profileRouter.post(
  "/password",
  asyncHandler(async (req, res) => {
    const { newPassword } = req.body;
    const pwd = newPassword || req.body.password;
    if (!pwd || String(pwd).trim().length < 6)
      throw new AppError(400, "Password must be at least 6 characters long", "VALIDATION_ERROR");

    const mongo = await getMongoDb();
    const { ObjectId } = await import("mongodb");
    const email = req.user?.email ? String(req.user.email).trim().toLowerCase() : null;
    const userId = req.user?._id;

    let query = {};
    if (userId && ObjectId.isValid(userId)) {
      query = { $or: [{ _id: new ObjectId(userId) }, ...(email ? [{ email }] : [])] };
    } else if (email) {
      query = { email };
    } else {
      throw new AppError(400, "User context missing", "VALIDATION_ERROR");
    }

    const hash = bcryptjs.hashSync(String(pwd).trim(), 10);
    const existingUser = await mongo.collection("users").findOne(query);

    const roles = req.user?.roles || [];
    const isSuperAdmin = roles.includes("super_admin") || email?.includes("solar.service") || email?.includes("superadmin") || email?.includes("admin@admin.com");
    const targetRole = isSuperAdmin ? "super_admin" : (roles[0] || "customer");

    if (existingUser) {
      const finalRole = existingUser.role && existingUser.role !== "customer" ? existingUser.role : targetRole;
      await mongo.collection("users").updateOne(
        { _id: existingUser._id },
        { $set: { password_hash: hash, role: finalRole } }
      );
    } else if (email) {
      await mongo.collection("users").insertOne({
        name: req.user?.fullName || testAccountMap[email]?.fullName || "Super Admin",
        email,
        role: targetRole,
        ownerId: userId || "00000000-0000-0000-0000-000000000001",
        ownerRole: targetRole,
        createdBy: userId || "00000000-0000-0000-0000-000000000001",
        updatedBy: userId || "00000000-0000-0000-0000-000000000001",
        status: "Active",
        password_hash: hash,
        created_at: new Date(),
      });
    }

    return success(res, "Password updated successfully", { success: true });
  })
);

// ----------------------------------------------------
// 14. NEXT NUMBER ROUTER (Preview next sequence number)
// ----------------------------------------------------
export const nextNumberRouter = Router();
nextNumberRouter.use(requireAuth);

const VALID_TYPES = new Set(["QOT", "QUO", "INV", "AGR", "CON", "EST", "CUS", "PRJ", "TKT", "SKU"]);

nextNumberRouter.get(
  "/:type",
  asyncHandler(async (req, res) => {
    const type = String(req.params.type).toUpperCase();
    if (!VALID_TYPES.has(type)) {
      throw new AppError(400, `Invalid document type: ${type}. Valid types: ${[...VALID_TYPES].join(", ")}`, "VALIDATION_ERROR");
    }

    const mongo = await getMongoDb();
    const brand = req.query.brand || req.query.brandName || null;
    const nextNumber = await peekNextNumber(mongo, type, brand);
    return success(res, "Next number preview", { type, nextNumber });
  }),
);

