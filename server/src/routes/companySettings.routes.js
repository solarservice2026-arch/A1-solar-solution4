import { Router } from "express";
import mongoose from "mongoose";
import { asyncHandler, AppError, success } from "../lib/http.js";
import { connectMongoDB } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
import { generatePrefix } from "../lib/sequenceCounter.js";

const getMongoDb = async () => {
  if (!process.env.MONGODB_URI) throw new AppError(503, "MongoDB is not configured", "SERVICE_UNAVAILABLE");
  await connectMongoDB();
  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    return mongoose.connection.db;
  }
  throw new AppError(503, "Database connection failed", "SERVICE_UNAVAILABLE");
};

export const companySettingsRouter = Router();
companySettingsRouter.use(requireAuth);

/**
 * GET /company-settings
 * Returns current company settings including name, prefix, and counter stats
 */
companySettingsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();

    // Check if user is admin or super_admin
    const roles = req.user?.roles || [];
    const isAdmin = roles.includes("super_admin") || roles.includes("admin");
    if (!isAdmin) {
      throw new AppError(403, "Only admins can view company settings", "FORBIDDEN");
    }

    let settings = await mongo.collection("company_settings").findOne({ _id: "primary" });

    if (!settings) {
      // Initialize with default
      const companyName = process.env.COMPANY_NAME || "Ayush Infotech";
      const prefix = generatePrefix(companyName);
      settings = {
        _id: "primary",
        company_name: companyName,
        prefix,
        created_at: new Date(),
        updated_at: new Date(),
      };
      await mongo.collection("company_settings").insertOne(settings);
    }

    // Fetch current counter values for display
    const counters = await mongo.collection("counters").find({}).toArray();
    const counterMap = {};
    for (const c of counters) {
      counterMap[c._id] = c.seq;
    }

    return success(res, "Company settings retrieved", {
      company_name: settings.company_name,
      prefix: settings.prefix,
      counters: counterMap,
      updated_at: settings.updated_at,
    });
  }),
);

/**
 * PUT /company-settings
 * Updates company name and auto-regenerates the prefix.
 * Only admins / super_admins can update.
 */
companySettingsRouter.put(
  "/",
  asyncHandler(async (req, res) => {
    const mongo = await getMongoDb();

    // Check if user is admin or super_admin
    const roles = req.user?.roles || [];
    const isAdmin = roles.includes("super_admin") || roles.includes("admin");
    if (!isAdmin) {
      throw new AppError(403, "Only admins can update company settings", "FORBIDDEN");
    }

    const { companyName } = req.body;
    if (!companyName || typeof companyName !== "string" || companyName.trim().length < 2) {
      throw new AppError(400, "Company name must be at least 2 characters", "VALIDATION_ERROR");
    }

    const trimmedName = companyName.trim();
    const prefix = generatePrefix(trimmedName);

    await mongo.collection("company_settings").updateOne(
      { _id: "primary" },
      {
        $set: {
          company_name: trimmedName,
          prefix,
          updated_at: new Date(),
        },
        $setOnInsert: {
          _id: "primary",
          created_at: new Date(),
        },
      },
      { upsert: true },
    );

    return success(res, "Company settings updated", {
      company_name: trimmedName,
      prefix,
    });
  }),
);
