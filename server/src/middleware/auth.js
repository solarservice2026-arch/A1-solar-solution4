import { AppError } from "../lib/http.js";
import { MongoAuthProvider } from "../lib/provider.js";
import mongoose from "mongoose";
import { modelMap } from "../models/index.js";

let provider = new MongoAuthProvider();
export const setAuthProvider = (next) => { provider = next; };
export const resetAuthProvider = () => { provider = new MongoAuthProvider(); };

export async function requireAuth(req, _res, next) {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) return next(new AppError(401, "Authentication required", "UNAUTHORIZED"));
  const context = await provider.resolve(header.slice(7));
  if (!context) return next(new AppError(401, "Session is invalid or expired", "INVALID_SESSION"));
  if (!context.active) return next(new AppError(403, "Your account has been disabled by the Super Admin. Kindly contact them for assistance.", "ACCOUNT_DISABLED"));
  
  req.auth = context;
  req.user = {
    _id: context.userId,
    role: context.roles?.[0] || "customer",
    roles: context.roles || [],
    email: context.email,
    active: context.active,
    permissions: context.permissions || [],
  };
  return next();
}

export const requireRole = (...roles) => (req, _res, next) => {
  const userRoles = req.user?.roles || req.auth?.roles || [];
  const isSuperAdmin = userRoles.includes("super_admin") || userRoles.includes("superadmin");

  if (isSuperAdmin || roles.some((role) => userRoles.includes(role))) {
    return next();
  }
  return next(new AppError(403, "Role is not authorized", "FORBIDDEN"));
};

export const requirePermission = (permission) => (req, _res, next) => {
  const userRoles = req.user?.roles || req.auth?.roles || [];
  const isSuperAdmin = userRoles.includes("super_admin") || userRoles.includes("superadmin");

  if (isSuperAdmin) return next();

  // ONLY Super Admin can access staff/users and roles/permissions
  if (permission.startsWith("users:") || permission.startsWith("roles:")) {
    return next(new AppError(403, "Forbidden: Only Super Admin has access to staff and roles management", "FORBIDDEN"));
  }

  const userPerms = req.user?.permissions || req.auth?.permissions || [];
  if (userRoles.includes("admin") || userPerms.includes(permission)) {
    return next();
  }
  return next(new AppError(403, "Permission denied", "FORBIDDEN"));
};

export const requireAnyPermission = (...permissions) => (req, _res, next) => {
  const userRoles = req.user?.roles || req.auth?.roles || [];
  const isSuperAdmin = userRoles.includes("super_admin") || userRoles.includes("superadmin");

  if (isSuperAdmin) return next();

  const userPerms = req.user?.permissions || req.auth?.permissions || [];
  if (userRoles.includes("admin") || permissions.some((key) => userPerms.includes(key))) {
    return next();
  }
  return next(new AppError(403, "Permission denied", "FORBIDDEN"));
};

/**
 * Reusable Middleware: authorizeOwner(Model)
 * - Load document by ID (req.params.id)
 * - If role == superadmin -> allow
 * - Else if document.ownerId == req.user._id -> allow
 * - Else return 403 Forbidden
 */
export const authorizeOwner = (ModelOrCollectionName) => async (req, _res, next) => {
  try {
    const idParam = req.params.id;
    if (!idParam) return next(new AppError(400, "Document ID parameter is required", "BAD_REQUEST"));

    const userId = req.user?._id || req.auth?.userId;
    const userRoles = req.user?.roles || req.auth?.roles || [];
    const isSuperAdmin = userRoles.includes("super_admin") || userRoles.includes("superadmin");

    let doc = null;
    const db = mongoose.connection.db;

    if (typeof ModelOrCollectionName === "string") {
      const collectionName = ModelOrCollectionName;
      if (db) {
        let filter = {};
        const { ObjectId } = await import("mongodb");
        if (ObjectId.isValid(idParam) && idParam.length === 24) {
          filter = { $or: [{ _id: new ObjectId(idParam) }, { _id: idParam }] };
        } else {
          // match custom number fields if not objectid
          filter = {
            $or: [
              { quotation_number: idParam },
              { invoice_number: idParam },
              { agreement_number: idParam },
              { contract_number: idParam },
              { estimate_number: idParam },
              { customer_number: idParam },
              { project_number: idParam },
              { ticket_number: idParam },
              { sku: idParam },
            ]
          };
        }
        doc = await db.collection(collectionName).findOne(filter);
      }
    } else if (ModelOrCollectionName && typeof ModelOrCollectionName.findById === "function") {
      doc = await ModelOrCollectionName.findById(idParam).lean();
      if (!doc) {
        doc = await ModelOrCollectionName.findOne({ _id: idParam }).lean();
      }
    }

    if (!doc) {
      return next(new AppError(404, "Resource not found", "NOT_FOUND"));
    }

    // Attach document to request
    req.doc = doc;

    // Super Admin access check
    if (isSuperAdmin) {
      return next();
    }

    // Owner check: compare ownerId or createdBy against req.user._id
    const docOwnerId = doc.ownerId || doc.owner_id || doc.createdBy || doc.created_by;
    const matchesOwner = docOwnerId && String(docOwnerId) === String(userId);

    // Customer email / profile check fallback for customer role
    let isCustomerMatch = false;
    if (userRoles.includes("customer")) {
      const userEmail = (req.user?.email || "").toLowerCase();
      if (userEmail && doc.customer_email && String(doc.customer_email).toLowerCase() === userEmail) {
        isCustomerMatch = true;
      }
      if (doc.customer_id && String(doc.customer_id) === String(userId)) {
        isCustomerMatch = true;
      }
      if (doc.createdBy && String(doc.createdBy) === String(userId)) {
        isCustomerMatch = true;
      }
    }

    if (matchesOwner || isCustomerMatch) {
      return next();
    }

    return next(new AppError(403, "Forbidden: You are not authorized to access this resource", "FORBIDDEN"));
  } catch (err) {
    return next(err);
  }
};
