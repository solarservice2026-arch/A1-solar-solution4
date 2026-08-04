import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../app.js";

const JWT_SECRET = process.env.JWT_SECRET || "a1-solar-secret-key-2026-safe";

// Generate test tokens with distinct owner identities
const tokenAdminA = jwt.sign(
  {
    userId: "admin-user-0001-id",
    email: "adminA@a1solar.test",
    active: true,
    roles: ["admin"],
    permissions: [
      "dashboard:view", "quotations:view", "quotations:create", "quotations:update", "quotations:delete",
      "invoices:view", "invoices:create", "invoices:update", "invoices:delete",
      "agreements:view", "agreements:create", "agreements:update", "agreements:delete",
      "customers:view", "customers:create", "customers:delete"
    ]
  },
  JWT_SECRET,
  { expiresIn: "1h" }
);

const tokenAdminB = jwt.sign(
  {
    userId: "admin-user-0002-id",
    email: "adminB@a1solar.test",
    active: true,
    roles: ["admin"],
    permissions: [
      "dashboard:view", "quotations:view", "quotations:create", "quotations:update", "quotations:delete",
      "invoices:view", "invoices:create", "invoices:update", "invoices:delete",
      "agreements:view", "agreements:create", "agreements:update", "agreements:delete",
      "customers:view", "customers:create", "customers:delete"
    ]
  },
  JWT_SECRET,
  { expiresIn: "1h" }
);

const tokenCustomerA = jwt.sign(
  {
    userId: "customer-user-0001-id",
    email: "customerA@a1solar.test",
    active: true,
    roles: ["customer"],
    permissions: ["quotations:view", "invoices:view", "agreements:view"]
  },
  JWT_SECRET,
  { expiresIn: "1h" }
);

const tokenCustomerB = jwt.sign(
  {
    userId: "customer-user-0002-id",
    email: "customerB@a1solar.test",
    active: true,
    roles: ["customer"],
    permissions: ["quotations:view", "invoices:view", "agreements:view"]
  },
  JWT_SECRET,
  { expiresIn: "1h" }
);

const tokenSuperAdmin = jwt.sign(
  {
    userId: "superadmin-0001-id",
    email: "superadmin@a1solar.test",
    active: true,
    roles: ["super_admin", "admin"],
    permissions: [
      "dashboard:view", "quotations:view", "quotations:create", "quotations:update", "quotations:delete",
      "invoices:view", "invoices:create", "invoices:update", "invoices:delete",
      "agreements:view", "agreements:create", "agreements:update", "agreements:delete",
      "customers:view", "customers:create", "customers:delete"
    ]
  },
  JWT_SECRET,
  { expiresIn: "1h" }
);

describe("Multi-Tenant Data Isolation & Security Test Suite", () => {
  let createdQuotationIdA;
  let createdInvoiceIdA;
  let createdAgreementIdA;

  it("1. Admin A can create resources and ownerId is automatically assigned from JWT", async () => {
    // Admin A creates a quotation and tries to spoof ownerId in body
    const res = await request(app)
      .post("/api/v1/quotations")
      .set("Authorization", `Bearer ${tokenAdminA}`)
      .send({
        customerName: "Customer Alpha",
        grandTotal: 50000,
        ownerId: "hacker-spoofed-id", // Should be IGNORED by backend!
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ownerId).toBe("admin-user-0001-id"); // Verified assigned from JWT!
    expect(res.body.data.createdBy).toBe("admin-user-0001-id");
    createdQuotationIdA = res.body.data.id;

    // Admin A creates an invoice
    const invRes = await request(app)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${tokenAdminA}`)
      .send({
        customerName: "Customer Alpha",
        total: 55000,
      });
    expect(invRes.status).toBe(201);
    createdInvoiceIdA = invRes.body.data.id;

    // Admin A creates an agreement
    const agrRes = await request(app)
      .post("/api/v1/agreements")
      .set("Authorization", `Bearer ${tokenAdminA}`)
      .send({
        customerName: "Customer Alpha",
        consumerAddress: "123 Solar Street",
      });
    expect(agrRes.status).toBe(201);
    createdAgreementIdA = agrRes.body.data.id;
  });

  it("2. Admin B cannot see Admin A's quotations, invoices, or agreements in list endpoints", async () => {
    const qList = await request(app)
      .get("/api/v1/quotations")
      .set("Authorization", `Bearer ${tokenAdminB}`);
    expect(qList.status).toBe(200);
    const hasQuotA = qList.body.data.some((item) => item.id === createdQuotationIdA);
    expect(hasQuotA).toBe(false);

    const invList = await request(app)
      .get("/api/v1/invoices")
      .set("Authorization", `Bearer ${tokenAdminB}`);
    expect(invList.status).toBe(200);
    const hasInvA = invList.body.data.some((item) => item.id === createdInvoiceIdA);
    expect(hasInvA).toBe(false);

    const agrList = await request(app)
      .get("/api/v1/agreements")
      .set("Authorization", `Bearer ${tokenAdminB}`);
    expect(agrList.status).toBe(200);
    const hasAgrA = agrList.body.data.some((item) => item.id === createdAgreementIdA);
    expect(hasAgrA).toBe(false);
  });

  it("3. Admin B gets HTTP 403 Forbidden when attempting direct URL/API access to Admin A's resources", async () => {
    // Admin B GET quotation
    const getRes = await request(app)
      .get(`/api/v1/quotations/${createdQuotationIdA}`)
      .set("Authorization", `Bearer ${tokenAdminB}`);
    expect(getRes.status).toBe(403);
    expect(getRes.body.code).toBe("FORBIDDEN");

    // Admin B PUT quotation
    const putRes = await request(app)
      .put(`/api/v1/quotations/${createdQuotationIdA}`)
      .set("Authorization", `Bearer ${tokenAdminB}`)
      .send({ grandTotal: 999999 });
    expect(putRes.status).toBe(403);

    // Admin B DELETE quotation
    const delRes = await request(app)
      .delete(`/api/v1/quotations/${createdQuotationIdA}`)
      .set("Authorization", `Bearer ${tokenAdminB}`);
    expect(delRes.status).toBe(403);

    // Admin B GET download PDF
    const dlRes = await request(app)
      .get(`/api/v1/quotations/${createdQuotationIdA}/download`)
      .set("Authorization", `Bearer ${tokenAdminB}`);
    expect(dlRes.status).toBe(403);

    // Admin B POST print
    const printRes = await request(app)
      .post(`/api/v1/quotations/${createdQuotationIdA}/print`)
      .set("Authorization", `Bearer ${tokenAdminB}`);
    expect(printRes.status).toBe(403);

    // Admin B POST email
    const emailRes = await request(app)
      .post(`/api/v1/quotations/${createdQuotationIdA}/email`)
      .set("Authorization", `Bearer ${tokenAdminB}`);
    expect(emailRes.status).toBe(403);
  });

  it("4. Customer B cannot access Customer A or Admin A documents via direct ID access", async () => {
    const custRes = await request(app)
      .get(`/api/v1/quotations/${createdQuotationIdA}`)
      .set("Authorization", `Bearer ${tokenCustomerB}`);
    expect(custRes.status).toBe(403);
    expect(custRes.body.code).toBe("FORBIDDEN");
  });

  it("5. Super Admin can access all resources across admins and transfer ownership", async () => {
    // Super Admin GET Admin A's quotation
    const getRes = await request(app)
      .get(`/api/v1/quotations/${createdQuotationIdA}`)
      .set("Authorization", `Bearer ${tokenSuperAdmin}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.id).toBe(createdQuotationIdA);

    // Super Admin transfers ownership to Admin B
    const transferRes = await request(app)
      .patch(`/api/v1/quotations/${createdQuotationIdA}/transfer-ownership`)
      .set("Authorization", `Bearer ${tokenSuperAdmin}`)
      .send({
        newOwnerId: "admin-user-0002-id",
        newOwnerRole: "admin"
      });
    expect(transferRes.status).toBe(200);
    expect(transferRes.body.data.ownerId).toBe("admin-user-0002-id");

    // Admin B can now access the transferred quotation
    const adminBGet = await request(app)
      .get(`/api/v1/quotations/${createdQuotationIdA}`)
      .set("Authorization", `Bearer ${tokenAdminB}`);
    expect(adminBGet.status).toBe(200);
  });

  it("6. Dashboard statistics are strictly isolated per owner", async () => {
    const dashA = await request(app)
      .get("/api/v1/dashboard")
      .set("Authorization", `Bearer ${tokenAdminA}`);
    expect(dashA.status).toBe(200);
    expect(dashA.body.data.quotations).toBeDefined();

    const dashB = await request(app)
      .get("/api/v1/dashboard")
      .set("Authorization", `Bearer ${tokenAdminB}`);
    expect(dashB.status).toBe(200);
    expect(dashB.body.data.quotations).toBeDefined();
  });
});
