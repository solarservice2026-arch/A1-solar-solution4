import "dotenv/config";
import { readFileSync } from "node:fs";

export function credential(label) {
  const email = process.env[`E2E_${label}_EMAIL`];
  const password = process.env[`E2E_${label}_PASSWORD`];
  if (email && password) return { email, password };
  try {
    const stored = JSON.parse(readFileSync(".auth/e2e-credentials.json", "utf8"));
    return stored[label] ?? null;
  } catch {
    return null;
  }
}
