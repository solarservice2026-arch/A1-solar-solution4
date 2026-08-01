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
} from "../middleware/auth.js";

const getMongoDb = async () => {
  if (!process.env.MONGODB_URI) throw new AppError(503, "MongoDB is not configured", "SERVICE_UNAVAILABLE");
  await connectMongoDB();
  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    return mongoose.connection.db;
  }
  throw new AppError(503, "Database connection failed", "SERVICE_UNAVAILABLE");
};

const number = (prefix) =>
  `${prefix}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
const invoiceNumber = () =>
  `A1-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);
dashboardRouter.get(
  "/",
  requirePermission("dashboard:view"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();

    const counts = {
      leads: await mongo.collection("enquiries").countDocuments(),
      customers: await mongo.collection("customers").countDocuments(),
      quotations: await mongo.collection("quotations").countDocuments(),
      invoices: await mongo.collection("agreements").countDocuments(),
      products: await mongo.collection("products").countDocuments(),
      staff: await mongo.collection("users").countDocuments(),
    };
    return success(res, "Dashboard retrieved", counts);
  }),
);

export const customersRouter = Router();
customersRouter.use(requireAuth);
customersRouter.get(
  "/",
  requirePermission("customers:view"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();

    let query = {};
    if (req.query.search) {
      const s = String(req.query.search).trim();
      query = {
        $or: [
          { name: { $regex: s, $options: "i" } },
          { mobile: { $regex: s, $options: "i" } },
          { customer_number: { $regex: s, $options: "i" } },
        ],
      };
    }
    const items = await mongo.collection("customers").find(query).sort({ created_at: -1 }).toArray();
    const formatted = items.map((item) => ({ id: item._id.toString(), ...item }));
    return success(res, "Customers retrieved", formatted);
  }),
);
customersRouter.post(
  "/",
  requirePermission("customers:create"),
  asyncHandler(async (req, res) => {
    const b = req.body;
    if (!b.name || !b.mobile || !b.customerType)
      throw new AppError(
        400,
        "Name, mobile and customer type are required",
        "VALIDATION_ERROR",
      );

    const mongo = await getMongoDb();
    
    const typeRoleMap = {
      "Residential": "customer",
      "Commercial": "customer",
      "Industrial": "customer",
      "Admin": "admin",
      "Manager": "manager",
      "Sales Executive": "sales_executive",
      "Installation Staff": "installation_staff",
      "Installer": "installation_staff",
      "Service Technician": "service_technician",
      "Technician": "service_technician",
      "Accountant": "accountant",
      "Customer": "customer",
    };
    const assignedRole = typeRoleMap[b.customerType] || "customer";

    const email = b.email && String(b.email).trim().length > 0
      ? String(b.email).trim().toLowerCase()
      : `${String(b.mobile).trim()}@a1solar.com`;

    const rawPassword = b.password && String(b.password).trim().length > 0
      ? String(b.password).trim()
      : "admin123";

    const hash = bcryptjs.hashSync(rawPassword, 10);
    const existingUser = await mongo.collection("users").findOne({ email });

    let userIdObj = existingUser?._id;
    if (!existingUser) {
      const userDoc = {
        name: b.name,
        email,
        role: assignedRole,
        status: "Active",
        created_at: new Date(),
        password_hash: hash,
      };
      const userRes = await mongo.collection("users").insertOne(userDoc);
      userIdObj = userRes.insertedId;
    } else {
      await mongo.collection("users").updateOne(
        { _id: existingUser._id },
        { $set: { password_hash: hash, role: assignedRole, name: b.name, status: "Active" } }
      );
    }

    const doc = {
      customer_number: number("CUS"),
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
    };
    const result = await mongo.collection("customers").insertOne(doc);
    const createdCustomer = { id: result.insertedId.toString(), ...doc };

    return success(res.status(201), "Customer created successfully", createdCustomer);
  }),
);

customersRouter.delete(
  "/:id",
  requirePermission("customers:delete"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    const idStr = String(req.params.id);

    const { ObjectId } = await import("mongodb");
    try {
      await mongo.collection("customers").deleteOne({ _id: new ObjectId(idStr) });
    } catch {
      await mongo.collection("customers").deleteOne({ customer_number: idStr });
    }
    return success(res, "Customer deleted", { id: idStr });
  }),
);

export const productsRouter = Router();
productsRouter.use(requireAuth);
productsRouter.get(
  "/",
  requireAnyPermission("products:view", "quotations:create", "invoices:create"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();

    let query = {};
    if (req.query.search) {
      const s = String(req.query.search).trim();
      query = {
        $or: [
          { name: { $regex: s, $options: "i" } },
          { sku: { $regex: s, $options: "i" } },
          { brand: { $regex: s, $options: "i" } },
        ],
      };
    }
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

    const doc = {
      sku: b.sku || number("SKU"),
      name: b.name,
      category: b.category,
      brand: b.brand || null,
      model: b.model || null,
      unit: b.unit || "Nos",
      purchase_price: Number(b.purchasePrice || 0),
      selling_price: Number(b.sellingPrice || 0),
      tax_rate: Number(b.taxRate || 0),
      minimum_stock: Number(b.minimumStock || 0),
      created_at: new Date(),
    };
    const result = await mongo.collection("products").insertOne(doc);
    const createdProduct = { id: result.insertedId.toString(), ...doc };
    return success(res.status(201), "Product created", createdProduct);
  }),
);
productsRouter.delete(
  "/:id",
  requirePermission("products:delete"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    const idStr = String(req.params.id);
    const { ObjectId } = await import("mongodb");
    try {
      await mongo.collection("products").deleteOne({ _id: new ObjectId(idStr) });
    } catch {
      await mongo.collection("products").deleteOne({ sku: idStr });
    }
    return success(res, "Product deleted", null);
  }),
);

export const projectsRouter = Router();
projectsRouter.use(requireAuth);
projectsRouter.get(
  "/",
  requirePermission("projects:view"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    let query = {};
    if (req.auth?.roles.includes("installation_staff")) {
      query = { assigned_to: req.auth.userId };
    }
    const items = await mongo.collection("projects").find(query).sort({ updated_at: -1 }).toArray();
    const formatted = items.map(item => ({ id: item._id.toString(), ...item }));
    return success(res, "Projects retrieved", formatted);
  }),
);

projectsRouter.patch(
  "/:id/progress",
  requireAnyPermission("projects:update", "projects:change_stage"),
  asyncHandler(async (req, res) => {
    const progress = Number(req.body.progress);
    const stage = String(req.body.stage ?? "");
    const mongo = await getMongoDb();
    const { ObjectId } = await import("mongodb");

    let filter = { _id: new ObjectId(req.params.id) };
    if (req.auth?.roles.includes("installation_staff")) {
      filter.assigned_to = req.auth.userId;
    }

    await mongo.collection("projects").updateOne(filter, {
      $set: { progress, stage, updated_at: new Date().toISOString() }
    });
    return success(res, "Installation progress updated", { id: req.params.id, progress, stage });
  }),
);

export const ticketsRouter = Router();
ticketsRouter.use(requireAuth);
ticketsRouter.get(
  "/",
  requirePermission("tickets:view"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    let query = {};
    if (req.auth?.roles.includes("service_technician")) {
      query = { assigned_to: req.auth.userId };
    }
    const items = await mongo.collection("service_tickets").find(query).sort({ opened_at: -1 }).toArray();
    const formatted = items.map(item => ({ id: item._id.toString(), ...item }));
    return success(res, "Service tickets retrieved", formatted);
  }),
);

ticketsRouter.patch(
  "/:id",
  requirePermission("tickets:update"),
  asyncHandler(async (req, res) => {
    const status = String(req.body.status ?? "");
    const resolution = String(req.body.resolution ?? "").trim();
    const mongo = await getMongoDb();
    const { ObjectId } = await import("mongodb");

    await mongo.collection("service_tickets").updateOne(
      { _id: new ObjectId(req.params.id) },
      {
        $set: {
          status,
          resolution: resolution || null,
          closed_at: status === "Closed" ? new Date().toISOString() : null,
        }
      }
    );
    return success(res, "Service ticket updated", { id: req.params.id, status, resolution });
  }),
);

export const quotationsRouter = Router();
quotationsRouter.use(requireAuth);
quotationsRouter.get(
  "/",
  requirePermission("quotations:view"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();

    const items = await mongo.collection("quotations").find({ status: { $ne: "Archived" } }).sort({ created_at: -1 }).toArray();
    const customers = await mongo.collection("customers").find().toArray();
    const customerMap = new Map(customers.map((c) => [c._id.toString(), c]));
    const formatted = items.map((q) => {
      const c = customerMap.get(String(q.customer_id));
      return {
        id: q._id.toString(),
        ...q,
        customers: c ? { name: c.name, mobile: c.mobile } : { name: q.customer_name || "Customer", mobile: "" },
        quotation_items: q.quotation_items || q.items || [],
      };
    });
    return success(res, "Quotations retrieved", formatted);
  }),
);

quotationsRouter.post(
  "/",
  requirePermission("quotations:create"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    const b = req.body;

    let customerName = "Customer";
    try {
      const { ObjectId } = await import("mongodb");
      const cDoc = await mongo.collection("customers").findOne({ _id: new ObjectId(b.customerId) });
      if (cDoc) customerName = cDoc.name;
    } catch {
      const cDoc = await mongo.collection("customers").findOne({ customer_number: b.customerId });
      if (cDoc) customerName = cDoc.name;
    }

    const items = Array.isArray(b.items) ? b.items : [];
    const normalized = items.map((item) => ({
      product_name: String(item.productName || item.name || "Product"),
      quantity: Number(item.quantity || 1),
      unit_price: Number(item.unitPrice || item.price || 0),
      line_amount: Number((item.quantity || 1) * (item.unitPrice || item.price || 0)),
    }));
    const subtotal = normalized.reduce((sum, i) => sum + i.line_amount, 0);
    const discount = Number(b.discount || 0);
    const tax = Number(b.tax || 0);

    const qDoc = {
      quotation_number: number("QUO"),
      customer_id: b.customerId,
      customer_name: customerName,
      quotation_date: b.quotationDate || new Date().toISOString().slice(0, 10),
      valid_until: b.validUntil,
      capacity_kw: Number(b.capacityKw || 0),
      quotation_type: b.quotationType || "Residential",
      title: b.title || "Solar Installation Quotation",
      installation_address: b.installationAddress || null,
      subtotal,
      discount,
      tax,
      grand_total: subtotal - discount + tax,
      terms: b.terms || null,
      status: "Draft",
      quotation_items: normalized,
      created_at: new Date(),
    };
    const result = await mongo.collection("quotations").insertOne(qDoc);
    const createdQuotation = { id: result.insertedId.toString(), ...qDoc, customers: { name: customerName } };
    return success(res.status(201), "Quotation created", createdQuotation);
  }),
);

quotationsRouter.delete(
  "/:id",
  requirePermission("quotations:delete"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    const idStr = String(req.params.id);

    const { ObjectId } = await import("mongodb");
    try {
      await mongo.collection("quotations").updateOne({ _id: new ObjectId(idStr) }, { $set: { status: "Archived" } });
    } catch {
      await mongo.collection("quotations").updateOne({ quotation_number: idStr }, { $set: { status: "Archived" } });
    }
    return success(res, "Quotation deleted", { id: idStr });
  }),
);

export const invoicesRouter = Router();
invoicesRouter.use(requireAuth);
invoicesRouter.get(
  "/",
  requirePermission("invoices:view"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    const items = await mongo.collection("invoices").find().sort({ created_at: -1 }).toArray();
    const formatted = items.map(item => ({ id: item._id.toString(), ...item }));
    return success(res, "Invoices retrieved", formatted);
  }),
);

invoicesRouter.post(
  "/",
  requirePermission("invoices:create"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    const b = req.body;
    const items = Array.isArray(b.items) ? b.items : [];
    if (!b.customerId || items.length === 0)
      throw new AppError(400, "Customer and products are required", "VALIDATION_ERROR");

    const normalized = items.map((item) => {
      const quantity = Number(item.quantity || 1);
      const unitPrice = Number(item.unitPrice || 0);
      return {
        product_name: String(item.productName || item.name || "Product"),
        quantity,
        unit_price: unitPrice,
        line_amount: quantity * unitPrice,
      };
    });

    const subtotal = normalized.reduce((sum, item) => sum + item.line_amount, 0);
    const tax = Number(b.tax || 0);
    const total = subtotal + tax;

    const doc = {
      invoice_number: invoiceNumber(),
      customer_id: b.customerId,
      invoice_date: b.invoiceDate || new Date().toISOString().slice(0, 10),
      due_date: b.dueDate || new Date().toISOString().slice(0, 10),
      title: b.title || "Solar Invoice",
      subtotal,
      tax,
      total,
      paid_amount: Number(b.paidAmount || 0),
      status: b.status || "Draft",
      invoice_items: normalized,
      created_at: new Date(),
    };

    const result = await mongo.collection("invoices").insertOne(doc);
    return success(res.status(201), "Invoice created", { id: result.insertedId.toString(), ...doc });
  }),
);

export const agreementsRouter = Router();
agreementsRouter.use(requireAuth);
agreementsRouter.get(
  "/",
  requirePermission("agreements:view"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();

    let filter = {};
    const isCustomer = req.auth?.roles.includes("customer");
    if (isCustomer) {
      const custObj = await mongo.collection("customers").findOne({
        email: { $regex: new RegExp("^" + req.auth.email.trim() + "$", "i") }
      });
      if (custObj) {
        filter = {
          $or: [
            { customer_id: custObj._id },
            { customer_id: custObj._id.toString() }
          ]
        };
      } else {
        return success(res, "Agreements retrieved", []);
      }
    }
    const items = await mongo.collection("agreements").find(filter).sort({ created_at: -1 }).toArray();
    const customers = await mongo.collection("customers").find().toArray();
    const customerMap = new Map(customers.map((c) => [c._id.toString(), c]));
    const formatted = items.map((a) => {
      const c = customerMap.get(String(a.customer_id));
      const base = {
        id: a._id.toString(),
        ...a,
        customers: c ? { name: c.name, mobile: c.mobile } : { name: a.customer_name || "Customer" },
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

agreementsRouter.post(
  "/:id/test-payment",
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    const idStr = String(req.params.id);
    const { ObjectId } = await import("mongodb");
    let filter = { agreement_number: idStr };
    try {
      if (idStr.length === 24) filter = { _id: new ObjectId(idStr) };
    } catch {}
    await mongo.collection("agreements").updateOne(filter, {
      $set: { payment_status: "Paid", paid_at: new Date().toISOString() }
    });
    return success(res, "Test payment completed successfully", { paid: true });
  }),
);

agreementsRouter.get(
  "/:id/document",
  requirePermission("agreements:view"),
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();
    const idStr = String(req.params.id);
    const { ObjectId } = await import("mongodb");
    let filter = { agreement_number: idStr };
    try {
      if (idStr.length === 24) filter = { _id: new ObjectId(idStr) };
    } catch {}

    if (req.auth?.roles.includes("customer")) {
      const custObj = await mongo.collection("customers").findOne({ email: req.auth.email.trim().toLowerCase() });
      if (custObj) {
        filter = { ...filter, customer_id: custObj._id };
      } else {
        throw new AppError(403, "Access denied", "FORBIDDEN");
      }
    }

    const agreement = await mongo.collection("agreements").findOne(filter);
    if (!agreement) throw new AppError(404, "Agreement not found", "NOT_FOUND");

    if (req.auth?.roles.includes("customer") && agreement.payment_status !== "Paid") {
      throw new AppError(
        402,
        "Verified payment is required before viewing or downloading this agreement",
        "PAYMENT_REQUIRED",
      );
    }
    const c = await mongo.collection("customers").findOne({ _id: agreement.customer_id });
    return success(res, "Agreement document retrieved", {
      id: agreement._id.toString(),
      ...agreement,
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
    const { ObjectId } = await import("mongodb");

    let customerName = "Customer";
    let customObjId = null;
    if (b.customerId) {
      try {
        customObjId = new ObjectId(b.customerId);
        const cust = await mongo.collection("customers").findOne({ _id: customObjId });
        if (cust) customerName = String(cust.name ?? "Customer");
      } catch {}
    }

    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    const agreementNumber = `AGR-${dateStr}-${rand}`;

    const doc = {
      agreement_number: agreementNumber,
      customer_id: customObjId ?? b.customerId,
      customer_name: customerName,
      quotation_id: b.quotationId || null,
      status: "Draft",
      payment_status: "Unpaid",
      payment_amount: Number(b.paymentAmount || 1),
      consumer_address: b.consumerAddress || null,
      created_at: today.toISOString(),
      updated_at: today.toISOString(),
    };
    const result = await mongo.collection("agreements").insertOne(doc);
    return success(res.status(201), "Agreement draft created", {
      ...doc,
      id: result.insertedId.toString(),
      customers: { name: customerName },
    });
  }),
);

export const profileRouter = Router();
profileRouter.use(requireAuth);
profileRouter.patch(
  "/",
  asyncHandler(async (req, res) => {
    const { fullName, phone } = req.body;
    if (!fullName)
      throw new AppError(400, "Full name is required", "VALIDATION_ERROR");
    const mongo = await getMongoDb();
    const { ObjectId } = await import("mongodb");
    await mongo.collection("users").updateOne(
      { _id: new ObjectId(req.auth.userId) },
      { $set: { name: fullName, phone: phone || null } }
    );
    return success(res, "Profile updated", { id: req.auth.userId, fullName, phone });
  }),
);
