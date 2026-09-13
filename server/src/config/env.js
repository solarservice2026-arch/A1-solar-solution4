import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";

try {
  config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true, override: false });
} catch {}
try {
  config({ path: fileURLToPath(new URL("../../.env", import.meta.url)), quiet: true, override: false });
} catch {}

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  WEB_URL: z.string().default("http://localhost:5173"),
  CLIENT_URL: z.string().optional(),
  CORS_ALLOWED_ORIGINS: z.string().optional(),
  MONGODB_URI: z.string().optional(),
  JWT_SECRET: z.string().default("a1-solar-secret-key-2026-safe"),
});

export const env = envSchema.parse(process.env);
