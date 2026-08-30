import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import compression from "compression";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { enquirySchema, paginationSchema } from "./validation/index.js";
import { connectMongoDB } from "./config/db.js";
import { authRouter, rolesRouter, usersRouter } from "./routes/auth.routes.js";
import {
  agreementsRouter,
  attachmentsRouter,
  contractsRouter,
  customersRouter,
  dashboardRouter,
  estimatesRouter,
  invoicesRouter,
  notesRouter,
  productsRouter,
  profileRouter,
  projectsRouter,
  quotationsRouter,
  ticketsRouter,
  nextNumberRouter,
} from "./routes/business.routes.js";
import { companySettingsRouter } from "./routes/companySettings.routes.js";
import mongoose from "mongoose";

export const app = express();
app.disable("x-powered-by");

// Universal bulletproof CORS & OPTIONS preflight handler for any domain (Vercel, custom domain, local)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-request-id, Accept, Origin, X-Requested-With");
  res.setHeader("Access-Control-Expose-Headers", "x-request-id");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

app.use(cors({
  origin: true,
  credentials: true,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-request-id", "Accept", "Origin", "X-Requested-With"],
  exposedHeaders: ["x-request-id"],
  optionsSuccessStatus: 200,
}));

app.use((req, res, next) => {
  res.setHeader(
    "x-request-id",
    req.header("x-request-id") ?? crypto.randomUUID(),
  );
  next();
});
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
app.use(compression());
app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: "10mb" }));
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: process.env.NODE_ENV === "production" ? 120 : 1_000,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
);
app.use(morgan("combined", { skip: () => process.env.NODE_ENV === "test" }));
app.use(async (_req, _res, next) => {
  if (process.env.MONGODB_URI && mongoose.connection.readyState !== 1) {
    try {
      await connectMongoDB();
    } catch {}
  }
  next();
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", usersRouter);
app.use("/api/v1/staff", usersRouter);
app.use("/api/v1/roles", rolesRouter);
app.use("/api/v1/dashboard", dashboardRouter);
app.use("/api/v1/customers", customersRouter);
app.use("/api/v1/products", productsRouter);
app.use("/api/v1/projects", projectsRouter);
app.use("/api/v1/tickets", ticketsRouter);
app.use("/api/v1/quotations", quotationsRouter);
app.use("/api/v1/invoices", invoicesRouter);
app.use("/api/v1/agreements", agreementsRouter);
app.use("/api/v1/contracts", contractsRouter);
app.use("/api/v1/estimates", estimatesRouter);
app.use("/api/v1/attachments", attachmentsRouter);
app.use("/api/v1/notes", notesRouter);
app.use("/api/v1/profile", profileRouter);
app.use("/api/v1/company-settings", companySettingsRouter);
app.use("/api/v1/next-number", nextNumberRouter);

const ok = (res, message, data, meta = {}) =>
  res.json({ success: true, message, data, meta });

app.get(["/ping", "/api/v1/ping"], (_req, res) => {
  return res.status(200).json({
    success: true,
    message: "pong",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get(["/health", "/api/v1/health"], async (_req, res) => {
  let mongoStatus = "disconnected";
  try {
    if (process.env.MONGODB_URI) {
      await connectMongoDB();
      mongoStatus = mongoose.connection.readyState === 1 ? "connected" : "connecting";
    }
  } catch (err) {
    mongoStatus = `error: ${err.message}`;
  }
  return ok(res, "API is healthy", {
    status: "ok",
    database: {
      mongodb: mongoStatus,
    },
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/v1/public/settings", async (_req, res) => {
  let companyName = process.env.COMPANY_NAME ?? "Ayush Infotech";
  try {
    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      const settings = await mongoose.connection.db
        .collection("company_settings")
        .findOne({ _id: "primary" });
      if (settings?.company_name) companyName = settings.company_name;
    }
  } catch {}
  return ok(res, "Public settings", {
    companyName,
    currency: "INR",
    locale: "en-IN",
  });
});

app.post("/api/v1/public/enquiries", async (req, res, next) => {
  try {
    const input = enquirySchema.parse(req.body);
    return ok(res.status(201), "Enquiry received", {
      accepted: true,
      type: input.type,
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/v1/leads", (req, res, next) => {
  try {
    paginationSchema.parse(req.query);
    return ok(res, "Leads endpoint", []);
  } catch (error) {
    return next(error);
  }
});

if (process.env.NODE_ENV === "production") {
  const webDist = fileURLToPath(new URL("../../client/dist/", import.meta.url));
  const webIndex = fileURLToPath(
    new URL("../../client/dist/index.html", import.meta.url),
  );
  app.use(express.static(webDist));
  app.use((req, res, next) => {
    if (
      req.method === "GET" &&
      !req.path.startsWith("/api/") &&
      req.accepts("html")
    ) {
      return res.sendFile(webIndex);
    }
    return next();
  });
}

app.use((_req, res) =>
  res.status(404).json({
    success: false,
    message: "Route not found",
    code: "NOT_FOUND",
    errors: [],
  }),
);

app.use((error, _req, res, _next) => {
  const errObj = typeof error === "object" && error !== null ? error : {};
  const isZod = errObj.name === "ZodError" || Array.isArray(errObj.issues);
  const status = typeof errObj.status === "number" && errObj.status >= 400 && errObj.status < 600 ? errObj.status : 400;
  const rawMsg = typeof errObj.message === "string" ? errObj.message.trim() : error instanceof Error ? error.message : "";
  const message = rawMsg || "Invalid request parameters";
  const code = typeof errObj.code === "string" ? errObj.code : isZod ? "VALIDATION_ERROR" : "BAD_REQUEST";
  const errors = Array.isArray(errObj.errors) ? errObj.errors : Array.isArray(errObj.issues) ? errObj.issues : [];

  return res.status(status).json({
    success: false,
    message,
    code,
    errors,
  });
});
