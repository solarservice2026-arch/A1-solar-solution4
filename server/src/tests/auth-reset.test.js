import { describe, it, expect } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../app.js";

if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/a1_solar_test";
}

const JWT_SECRET = process.env.JWT_SECRET || "a1-solar-secret-key-2026-safe";

describe("Password Reset & Authentication Endpoints Test Suite", () => {
  let validResetToken = "";

  it("1. POST /api/v1/auth/forgot-password route exists and validates missing email", async () => {
    const res = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/email/i);
  });

  it("2. POST /api/v1/auth/forgot-password returns success for valid email without exposing account status", async () => {
    const res = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "admin@a1solar.test" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain("password reset instructions have been sent");
  });

  it("3. POST /api/auth/forgot-password works via legacy alias path as well", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "testuser@a1solar.com" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("4. POST /api/v1/auth/reset-password rejects missing, invalid, or expired tokens", async () => {
    // Missing token
    const res1 = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ password: "NewPassword123!" });
    expect(res1.status).toBe(400);
    expect(res1.body.code).toBe("VALIDATION_ERROR");

    // Invalid token
    const res2 = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token: "invalid-garbage-token", password: "NewPassword123!" });
    expect(res2.status).toBe(400);
    expect(res2.body.code).toBe("INVALID_TOKEN");

    // Expired token
    const expiredToken = jwt.sign(
      { email: "admin@a1solar.test", purpose: "password_reset" },
      JWT_SECRET,
      { expiresIn: "-1s" }
    );
    const res3 = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token: expiredToken, password: "NewPassword123!" });
    expect(res3.status).toBe(400);
    expect(res3.body.code).toBe("INVALID_TOKEN");
  });

  it("5. POST /api/v1/auth/reset-password successfully updates password for valid token", async () => {
    validResetToken = jwt.sign(
      { email: "test@a1solar.com", purpose: "password_reset" },
      JWT_SECRET,
      { expiresIn: "15m" }
    );

    const res = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token: validResetToken, password: "NewPassword123!" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain("Password updated successfully");
  });

  it("6. Reset password endpoint supports URL parameter format /api/v1/auth/reset-password/:token", async () => {
    const urlToken = jwt.sign(
      { email: "testuser@a1solar.com", purpose: "password_reset" },
      JWT_SECRET,
      { expiresIn: "15m" }
    );

    const res = await request(app)
      .post(`/api/v1/auth/reset-password/${encodeURIComponent(urlToken)}`)
      .send({ password: "NewPassword123!" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
