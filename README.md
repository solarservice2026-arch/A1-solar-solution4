# A1 Solar Solution Platform (Enterprise MERN Architecture & Multi-Tenant Data Isolation)

Enterprise-grade MERN stack platform (MongoDB, Express.js, React, Node.js) for **A1 Solar Solution**. Includes CRM, Customer Portal, Admin Dashboard, Automated Document Management (Quotations, Invoices, Agreements, Contracts, Estimates, Attachments, Notes), and complete Multi-Tenant Owner-Based Data Isolation.

---

## 🏗️ Project Architecture

```
                               ┌──────────────────────────┐
                               │    React + Vite Client   │
                               │     (Dashboard & UI)     │
                               └────────────┬─────────────┘
                                            │ JWT Auth & API Requests
                                            ▼
                               ┌──────────────────────────┐
                               │   Express REST API Server│
                               └────────────┬─────────────┘
                                            │
               ┌────────────────────────────┼────────────────────────────┐
               ▼                            ▼                            ▼
   ┌───────────────────────┐   ┌────────────────────────┐   ┌────────────────────────┐
   │  requireAuth & JWT    │   │ authorizeOwner(Model)  │   │   Zod Input & Model    │
   │  Context Injection    │   │ Ownership Middleware   │   │  Validation Layer      │
   └───────────┬───────────┘   └───────────┬────────────┘   └───────────┬────────────┘
               │                           │                            │
               └───────────────────────────┼────────────────────────────┘
                                           │ Query Execution (Scoped by ownerId)
                                           ▼
                               ┌──────────────────────────┐
                               │  MongoDB Database        │
                               │  (Indexed Collections)   │
                               └──────────────────────────┘
```

The application is structured into a clean monorepo architecture:

- **`client/`**: Modern React SPA created with Vite, styled with CSS Design System tokens, state-managed dashboard, tables, search, export PDF/Excel, analytics, and customer/admin views.
- **`server/`**: Express.js REST API with Mongoose schemas, JWT Authentication, Role-Based Access Control (RBAC), multi-tenant data isolation middleware, and unit/RLS security test suite.

---

## 🔒 Multi-Tenant Data Isolation & Security Architecture

The application enforces **strict, enterprise-grade owner-based data isolation** across all business resources. No user can view, edit, delete, download, print, or email another user's records.

### 1. Resource Ownership Schema
Every resource schema includes mandatory ownership fields:
- `ownerId`: MongoDB ObjectId / Unique User String of the owner (Indexed).
- `ownerRole`: Role of the owner (`super_admin`, `admin`, `customer`, etc.).
- `createdBy`: User ID of the document creator.
- `updatedBy`: User ID of the last user who updated the record.

**Protected Resources:**
- 📄 **Quotations**
- 🧾 **Invoices**
- 📑 **Agreements**
- 📜 **Contracts**
- 🧮 **Estimates**
- 📎 **Attachments**
- 📝 **Notes**
- 👥 **Customers**, 🏗️ **Projects**, 🎟️ **Tickets**, 📦 **Products**

---

### 2. Backend Ownership Security & Automatic Assignment
- **JWT Context**: Authentication middleware parses the JWT token and injects `req.user = { _id, role, roles, email }`.
- **Frontend `ownerId` Stripping**: Any `ownerId` sent in the request body from the frontend is **strictly ignored**.
- **Automatic Assignment**: On resource creation (`POST`), the server automatically binds:
  ```js
  ownerId = req.user._id;
  ownerRole = req.user.role;
  createdBy = req.user._id;
  updatedBy = req.user._id;
  ```

---

### 3. Reusable Ownership Authorization Middleware (`authorizeOwner`)

Every API endpoint operating on a specific resource (`GET /:id`, `PUT /:id`, `PATCH /:id`, `DELETE /:id`, `GET /:id/download`, `POST /:id/print`, `POST /:id/email`) is protected by the `authorizeOwner(Model)` middleware:

```js
export const authorizeOwner = (ModelOrCollectionName) => async (req, res, next) => {
  // 1. Fetch document by ID
  // 2. If role == superadmin -> allow access
  // 3. Else if document.ownerId == req.user._id -> allow access
  // 4. Else return HTTP 403 Forbidden
};
```

---

### 4. Scoped MongoDB Query Rules

| Role | Query Rule | Behavior |
| :--- | :--- | :--- |
| **Admin A** | `find({ ownerId: req.user._id })` | Admin A sees **ONLY** Admin A's quotations, invoices, agreements, etc. |
| **Admin B** | `find({ ownerId: req.user._id })` | Admin B sees **ONLY** Admin B's data. Cannot access Admin A's data. |
| **Customer** | `find({ ownerId: req.user._id })` | Customer views **ONLY** their owned documents and profile records. |
| **Super Admin** | `find({})` | Full system visibility. Can filter by admin (`?ownerId=...`) & transfer ownership. |

---

### 5. MongoDB Performance Indexes

Indexes are applied across all Mongoose models (`Quotation`, `Invoice`, `Agreement`, `Contract`, `Estimate`, `Attachment`, `Note`, `Customer`, `Project`, `Ticket`, `Product`):
- `ownerId`: `1`
- `createdAt`: `-1`
- `status`: `1`
- Compound Index: `{ ownerId: 1, createdAt: -1 }` & `{ ownerId: 1, status: 1 }`

---

## ⚡ Quick Start & Installation

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **MongoDB**: Local MongoDB instance or MongoDB Atlas cluster

### 2. Environment Setup

Create `.env` inside the `server/` directory:
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/a1solar
JWT_SECRET=a1-solar-secret-key-2026-safe
WEB_URL=http://localhost:5173
```

Create `.env` inside the `client/` directory:
```env
VITE_API_URL=http://localhost:5000/api/v1
```

### 3. Install Dependencies

From the project root directory:
```bash
npm install
```

---

## 🚀 Running the Application

### Concurrent Development Mode (Client + Server)
Starts both Vite frontend (`http://localhost:5173`) and Express backend (`http://localhost:5000`) simultaneously:
```bash
npm run dev
```

### Individual Service Commands
- **Run Frontend Only**:
  ```bash
  npm run client
  ```
- **Run Backend API Server Only**:
  ```bash
  npm run server
  ```

### Production Build & Launch
- **Build Client**:
  ```bash
  npm run build
  ```
- **Start Production Server**:
  ```bash
  npm start
  ```

---

## 🧪 Testing & Data Isolation Verification

The test suite validates data isolation boundaries across all roles:

```bash
npm test --prefix server
```

### Verified Security Controls:
- [x] Admin A cannot see Admin B invoices, quotations, or agreements.
- [x] Customer A cannot see Customer B documents.
- [x] Direct URL / API document ID guessing is blocked with **HTTP 403 Forbidden**.
- [x] Super Admin can view all data, filter by owner, and transfer ownership (`PATCH /api/v1/:resource/:id/transfer-ownership`).
- [x] Dashboard statistics & counts strictly reflect the logged-in owner's records.
- [x] Export PDF, Excel, and Print functions only process records owned by the logged-in user.

---

## 📄 License

Copyright © 2026 A1 Solar Solution. All Rights Reserved.
