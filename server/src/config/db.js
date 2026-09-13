import mongoose from "mongoose";
import dns from "node:dns";

try {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
} catch {
  // fallback if DNS setting isn't permitted in current runtime
}

let connectionPromise = null;

const fullPermissions = [
  "users:view", "users:create", "users:update", "users:disable", "users:remove", "users:assign_roles",
  "roles:view", "roles:assign_permissions",
  "business:view", "business:update",
  "leads:view", "leads:create", "leads:update",
  "quotations:view", "quotations:create", "quotations:update",
  "agreements:view", "agreements:create", "agreements:update",
  "invoices:view", "invoices:create", "invoices:update",
  "installations:view", "installations:update",
  "technicians:view", "technicians:update",
  "payments:view", "payments:verify",
  "dashboard:view", "customers:view", "products:view", "projects:view", "tickets:view"
];

export async function connectMongoDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    return null;
  }
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    }).then((m) => {
      // Run heavy DB seeding & field purges asynchronously in background
      // so API requests respond instantly (<300ms) without hitting Render 15s gateway timeouts
      void (async () => {
        try {
          const db = m.connection.db;
          if (db) {
            const count = await db.collection("roles").countDocuments();
            if (count === 0) {
              console.log("[MongoDB] Seeding roles and permissions...");
              const permissionsList = fullPermissions.map((key) => ({
                key,
                description: `Permission to ${key.replace(":", " ")}`
              }));
              const permResult = await db.collection("permissions").insertMany(permissionsList);
              const permIds = Object.values(permResult.insertedIds);
              
              const rolesList = [
                { name: "super_admin", description: "Primary Super Admin" },
                { name: "admin", description: "A1 Solar Admin" },
                { name: "manager", description: "Sales Manager" },
                { name: "sales_executive", description: "Sales Executive User" },
                { name: "installation_staff", description: "Installation Staff User" },
                { name: "service_technician", description: "Service Technician User" },
                { name: "accountant", description: "Finance & Accounts User" },
                { name: "customer", description: "Rohan Sharma (Customer)" },
              ];
              
              for (const r of rolesList) {
                const rDoc = await db.collection("roles").insertOne(r);
                let assignedPerms = [];
                if (r.name === "super_admin" || r.name === "admin") {
                  assignedPerms = permissionsList.map((p, idx) => ({
                    role_id: rDoc.insertedId.toString(),
                    permission_id: permIds[idx].toString(),
                    permissions: p
                  }));
                } else if (r.name === "installation_staff") {
                  const targets = ["dashboard:view", "projects:view", "projects:update", "quotations:view", "agreements:view", "invoices:view"];
                  assignedPerms = permissionsList
                    .filter(p => targets.includes(p.key))
                    .map((p) => ({
                      role_id: rDoc.insertedId.toString(),
                      permission_id: permIds[permissionsList.indexOf(p)].toString(),
                      permissions: p
                    }));
                } else if (r.name === "service_technician") {
                  const targets = ["dashboard:view", "tickets:view", "tickets:update", "quotations:view", "agreements:view", "invoices:view"];
                  assignedPerms = permissionsList
                    .filter(p => targets.includes(p.key))
                    .map((p) => ({
                      role_id: rDoc.insertedId.toString(),
                      permission_id: permIds[permissionsList.indexOf(p)].toString(),
                      permissions: p
                    }));
                } else if (r.name === "accountant") {
                  const targets = ["dashboard:view", "customers:view", "quotations:view", "agreements:view", "invoices:view", "invoices:create", "invoices:update", "payments:view", "payments:verify"];
                  assignedPerms = permissionsList
                    .filter(p => targets.includes(p.key))
                    .map((p) => ({
                      role_id: rDoc.insertedId.toString(),
                      permission_id: permIds[permissionsList.indexOf(p)].toString(),
                      permissions: p
                    }));
                } else {
                  const targets = ["agreements:view", "payments:create"];
                  assignedPerms = permissionsList
                    .filter(p => targets.includes(p.key))
                    .map((p) => ({
                      role_id: rDoc.insertedId.toString(),
                      permission_id: permIds[permissionsList.indexOf(p)].toString(),
                      permissions: p
                    }));
                }
                if (assignedPerms.length > 0) {
                  await db.collection("role_permissions").insertMany(assignedPerms);
                }
              }
              console.log("[MongoDB] Seeding completed successfully!");
            }

            // ─── 1. Create performance indexes FIRST ───────────────────────────────
            try {
              const indexOpts = { background: true };
              const sparseOpts = { background: true, sparse: true };

              // quotations — covers ownerId, createdBy, created_by, ownerEmail, status, created_at
              const q = db.collection("quotations");
              await Promise.all([
                q.createIndex({ ownerId: 1, created_at: -1 }, indexOpts),
                q.createIndex({ createdBy: 1, created_at: -1 }, indexOpts),
                q.createIndex({ created_by: 1, created_at: -1 }, indexOpts),
                q.createIndex({ ownerEmail: 1, created_at: -1 }, sparseOpts),
                q.createIndex({ status: 1, created_at: -1 }, indexOpts),
                q.createIndex({ created_at: -1 }, indexOpts),
              ]);

              // invoices — same pattern
              const inv = db.collection("invoices");
              await Promise.all([
                inv.createIndex({ ownerId: 1, created_at: -1 }, indexOpts),
                inv.createIndex({ createdBy: 1, created_at: -1 }, indexOpts),
                inv.createIndex({ created_by: 1, created_at: -1 }, indexOpts),
                inv.createIndex({ created_at: -1 }, indexOpts),
              ]);

              // agreements
              const agr = db.collection("agreements");
              await Promise.all([
                agr.createIndex({ ownerId: 1, created_at: -1 }, indexOpts),
                agr.createIndex({ createdBy: 1, created_at: -1 }, indexOpts),
                agr.createIndex({ created_at: -1 }, indexOpts),
              ]);

              // customers
              const cust = db.collection("customers");
              await Promise.all([
                cust.createIndex({ ownerId: 1 }, indexOpts),
                cust.createIndex({ createdBy: 1 }, indexOpts),
                cust.createIndex({ email: 1 }, sparseOpts),
                cust.createIndex({ profile_id: 1 }, sparseOpts),
              ]);

              // users — covers targeted user lookup by _id/email and staffDocs query
              const usr = db.collection("users");
              await Promise.all([
                usr.createIndex({ email: 1 }, { ...sparseOpts, unique: false }),
                usr.createIndex({ ownerId: 1 }, sparseOpts),
                usr.createIndex({ createdBy: 1 }, sparseOpts),
                usr.createIndex({ role: 1 }, indexOpts),
              ]);

              console.log("[MongoDB] Performance indexes ensured on quotations, invoices, agreements, customers, users");
            } catch (idxErr) {
              console.warn("[MongoDB] Index creation warning (non-fatal):", idxErr.message);
            }

            // ─── 2. Purge customer GST, valid_until, and agreement payment_amount fields ───
            const collectionsToPurge = ["quotations", "invoices", "agreements", "customers", "estimates", "contracts"];
            for (const colName of collectionsToPurge) {
              await db.collection(colName).updateMany(
                {},
                {
                  $unset: {
                    customer_gst: "",
                    customer_gstin: "",
                    customerGst: "",
                    customerGstin: "",
                    gst_number: "",
                    valid_until: "",
                    validUntil: "",
                    valid_date: "",
                    "customers.gst_number": "",
                    "customers.gstNumber": ""
                  }
                }
              );
            }
            await db.collection("agreements").updateMany(
              {},
              {
                $unset: {
                  payment_amount: "",
                  paymentAmount: "",
                  project_value: "",
                  projectValue: "",
                  customer_email: "",
                  customerEmail: "",
                  "customers.email": ""
                }
              }
            );
            await db.collection("customers").updateMany(
              { $or: [{ customer_type: "Vendor" }, { customer_type: "vendor" }] },
              { $set: { customer_type: "Customer" } }
            );
            await db.collection("users").updateMany(
              { $or: [{ role: "vendor" }, { roles: "vendor" }] },
              { $set: { role: "customer", roles: ["customer"] } }
            );
          }
        } catch (err) {
          console.error("[MongoDB] Seeding/Purge error:", err.message);
        }
      })();
      return m;
    }).catch((err) => {
      connectionPromise = null;
      console.error("[MongoDB] Connection error:", err.message);
      throw err;
    });
  }
  return connectionPromise;
}
