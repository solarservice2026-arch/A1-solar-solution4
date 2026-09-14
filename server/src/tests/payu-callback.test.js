import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { app } from "../app.js";
import { verifyPayUResponseHash } from "../routes/business.routes.js";
import { connectMongoDB } from "../config/db.js";
import mongoose from "mongoose";

if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/a1_solar_test";
}

const key = process.env.PAYU_KEY || process.env.PAYU_MERCHANT_KEY || "DQDKZp";
const salt = process.env.PAYU_SALT || process.env.PAYU_MERCHANT_SALT || "8gBtURI31zwtIeMKBPi1o9x8pvxwB3r5";

describe("PayU Payment Callback & Initiation Test Suite", () => {
  const testTxnid = `PAYU_TEST_${Date.now()}`;
  const testAgreementNum = `AGR-TEST-${Date.now()}`;
  const amount = "1.00";
  const productinfo = `Agreement ${testAgreementNum}`;
  const firstname = "TestCustomer";
  const email = "customer@solarservice.co.in";

  beforeAll(async () => {
    await connectMongoDB();
    const mongo = mongoose.connection.db;
    if (mongo) {
      await mongo.collection("agreements").insertOne({
        agreement_number: testAgreementNum,
        customer_name: firstname,
        customer_email: email,
        payment_status: "Pending",
        payu_txnid: testTxnid,
        payu_amount: amount,
        created_at: new Date().toISOString(),
      });
    }
  });

  it("1. verifyPayUResponseHash calculates correctly and detects tampering", () => {
    const status = "success";
    const hashString = `${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${testTxnid}|${key}`;
    const validHash = crypto.createHash("sha512").update(hashString).digest("hex");

    const payload = {
      key,
      txnid: testTxnid,
      amount,
      productinfo,
      firstname,
      email,
      status,
      hash: validHash,
    };

    expect(verifyPayUResponseHash(payload, salt)).toBe(true);

    // Tampered amount
    expect(verifyPayUResponseHash({ ...payload, amount: "999.00" }, salt)).toBe(false);

    // Tampered status
    expect(verifyPayUResponseHash({ ...payload, status: "failure" }, salt)).toBe(false);

    // Invalid hash string
    expect(verifyPayUResponseHash({ ...payload, hash: "invalid_hash" }, salt)).toBe(false);
  });

  it("2. POST /api/v1/payments/payu/callback handles application/x-www-form-urlencoded and redirects on valid success", async () => {
    const status = "success";
    const mihpayid = `MIH_${Date.now()}`;
    const hashString = `${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${testTxnid}|${key}`;
    const validHash = crypto.createHash("sha512").update(hashString).digest("hex");

    const res = await request(app)
      .post("/api/v1/payments/payu/callback")
      .type("form")
      .send({
        key,
        txnid: testTxnid,
        mihpayid,
        amount,
        productinfo,
        firstname,
        email,
        status,
        hash: validHash,
      });

    expect(res.status).toBe(303);
    expect(res.headers.location).toContain("status=success");
  });

  it("3. POST /api/v1/payments/payu/callback rejects invalid hash with redirect to failed", async () => {
    const res = await request(app)
      .post("/api/v1/payments/payu/callback")
      .type("form")
      .send({
        key,
        txnid: testTxnid,
        amount,
        productinfo,
        firstname,
        email,
        status: "success",
        hash: "invalid_hash_value",
      });

    expect(res.status).toBe(303);
    expect(res.headers.location).toContain("status=failed");
    expect(res.headers.location).toContain("reason=invalid_hash");
  });

  it("4. POST /api/v1/payments/payu/callback rejects wrong transaction amount", async () => {
    const status = "success";
    const wrongAmount = "5000.00";
    const hashString = `${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${wrongAmount}|${testTxnid}|${key}`;
    const hash = crypto.createHash("sha512").update(hashString).digest("hex");

    const res = await request(app)
      .post("/api/v1/payments/payu/callback")
      .type("form")
      .send({
        key,
        txnid: testTxnid,
        amount: wrongAmount,
        productinfo,
        firstname,
        email,
        status,
        hash,
      });

    expect(res.status).toBe(303);
    expect(res.headers.location).toContain("status=failed");
    expect(res.headers.location).toContain("reason=amount_mismatch");
  });

  it("5. POST /api/v1/payments/payu/callback handles idempotency for repeat callbacks", async () => {
    const status = "success";
    const mihpayid = `MIH_${Date.now()}`;
    const hashString = `${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${testTxnid}|${key}`;
    const validHash = crypto.createHash("sha512").update(hashString).digest("hex");

    // First call
    await request(app)
      .post("/api/v1/payments/payu/callback")
      .type("form")
      .send({ key, txnid: testTxnid, mihpayid, amount, productinfo, firstname, email, status, hash: validHash });

    // Repeat call with identical data
    const repeatRes = await request(app)
      .post("/api/v1/payments/payu/callback")
      .type("form")
      .send({ key, txnid: testTxnid, mihpayid, amount, productinfo, firstname, email, status, hash: validHash });

    expect(repeatRes.status).toBe(303);
    expect(repeatRes.headers.location).toContain("status=success");
  });

  it("6. POST /api/v1/agreements/payu-callback works as alias callback route", async () => {
    const status = "success";
    const hashString = `${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${testTxnid}|${key}`;
    const validHash = crypto.createHash("sha512").update(hashString).digest("hex");

    const res = await request(app)
      .post("/api/v1/agreements/payu-callback")
      .type("form")
      .send({ key, txnid: testTxnid, amount, productinfo, firstname, email, status, hash: validHash });

    expect(res.status).toBe(303);
    expect(res.headers.location).toContain("status=success");
  });
});
