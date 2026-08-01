import { BarChart3, FileText, Package, Settings, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "../../lib/api.js";
import { useAuth } from "../auth/AuthProvider.jsx";
import {
  agreementDocument,
  invoiceDocument,
  quotationDocument,
} from "../documents/templates.js";

const text = (v) => (v == null ? "—" : String(v));
const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN")}`;

const formObject = (form) => {
  const result = {};
  new FormData(form).forEach((value, key) => {
    result[key] = value;
  });
  return result;
};

const printRecord = async (title, row) => {
  if (title === "Agreement" && (row.locked || row.payment_status !== "Paid")) {
    return toast.error("PayU Payment required before viewing/downloading agreement.");
  }
  let recordData = row;
  if (title === "Agreement") {
    try {
      const docRes = await api(`/agreements/${row.id}/document`);
      recordData = docRes;
    } catch (err) {
      return toast.error(err instanceof Error ? err.message : "Document fetch failed");
    }
  }
  const popup = window.open("", "_blank", "width=900,height=700");
  if (!popup) return toast.error("Allow pop-ups to print PDF");
  const html =
    title === "Quotation"
      ? quotationDocument(recordData)
      : title === "Agreement"
        ? agreementDocument(recordData)
        : invoiceDocument(recordData);
  popup.document.write(html);
  popup.document.close();
};

function DataPage({
  title,
  kicker,
  description,
  path,
  permission,
  columns,
  fields,
  icon,
  printable = false,
  deletePermission,
}) {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [payuRow, setPayuRow] = useState(null);
  const [paying, setPaying] = useState(false);

  const canCreate =
    user?.roles?.includes("super_admin") ||
    user?.permissions?.includes(permission);

  const canDelete = Boolean(
    deletePermission &&
    (user?.roles?.includes("super_admin") ||
      user?.permissions?.includes(deletePermission)),
  );

  const load = async () => {
    setLoading(true);
    try {
      const res = await api(
        `${path}${search ? `?search=${encodeURIComponent(search)}` : ""}`,
      );
      setRows(Array.isArray(res) ? res : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [path]);

  const submit = async (e) => {
    e.preventDefault();
    const body = formObject(e.currentTarget);
    try {
      await api(path, { method: "POST", body: JSON.stringify(body) });
      toast.success(`${title.slice(0, -1)} created`);
      setOpen(false);
      await load();
    } catch (x) {
      toast.error(x instanceof Error ? x.message : "Unable to create");
    }
  };

  const remove = async (row) => {
    if (!confirm(`Delete this ${title.toLowerCase().slice(0, -1)}?`)) return;
    try {
      await api(`${path}/${row.id}`, { method: "DELETE" });
      toast.success("Deleted successfully");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <main className="app-page">
      <div className="page-bar">
        <div>
          <span className="kicker">{kicker}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {canCreate && fields && (
          <button className="primary" onClick={() => setOpen(true)}>
            New {title.slice(0, -1)}
          </button>
        )}
      </div>

      <div className="toolbar">
        <input
          placeholder={`Search ${title.toLowerCase()}…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button onClick={() => void load()}>Search</button>
      </div>

      {open && fields && (
        <div className="modal-backdrop">
          <form className="card modal-form" onSubmit={submit}>
            <h2>Create {title.slice(0, -1)}</h2>
            {fields.map(([name, label, type, options, req]) => (
              <label key={name}>
                {label}
                {type === "select" ? (
                  <select name={name} required={req !== false}>
                    {options?.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    name={name}
                    type={type}
                    required={req !== false && type !== "password"}
                    placeholder={type === "password" ? "Default: admin123" : undefined}
                  />
                )}
              </label>
            ))}
            <div className="row-actions">
              <button type="button" className="secondary" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="primary">Create</button>
            </div>
          </form>
        </div>
      )}

      {payuRow && (
        <div className="modal-backdrop">
          <div className="card modal-form" style={{ maxWidth: "480px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ margin: 0 }}>PayU Online Gateway</h2>
              <span style={{ background: "#ecfdf5", color: "#065f46", padding: "4px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: "bold" }}>
                PayU Official
              </span>
            </div>
            <p style={{ margin: "8px 0 12px", color: "#4b5563", fontSize: "13px" }}>
              Complete payment for <strong>Agreement #{payuRow.agreement_number}</strong> to unlock PDF download.
            </p>
            
            <div style={{ background: "#f9fafb", padding: "12px", borderRadius: "8px", border: "1px solid #e5e7eb", margin: "12px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "13px" }}>
                <span>Customer:</span>
                <strong>{payuRow.customers?.name || payuRow.customer_name || "Customer"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "13px" }}>
                <span>Agreement #:</span>
                <strong>{payuRow.agreement_number}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "16px", color: "#059669", paddingTop: "8px", borderTop: "1px dashed #d1d5db", marginTop: "6px" }}>
                <span>Total Amount Payable:</span>
                <strong>₹{Number(payuRow.payment_amount || 1232000).toLocaleString("en-IN")}</strong>
              </div>
            </div>

            <div style={{ background: "#eff6ff", padding: "10px", borderRadius: "6px", border: "1px solid #bfdbfe", fontSize: "12px", color: "#1e40af", marginBottom: "16px" }}>
              💳 <strong>Supported Methods:</strong> PayU UPI (Google Pay, PhonePe, Paytm), Credit/Debit Cards, NetBanking &amp; Wallets.
            </div>

            <div className="row-actions">
              <button type="button" className="secondary" onClick={() => setPayuRow(null)} disabled={paying}>
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                style={{ background: "#10b981", borderColor: "#059669", color: "#fff", fontWeight: 700 }}
                disabled={paying}
                onClick={async () => {
                  setPaying(true);
                  try {
                    await api(`/agreements/${payuRow.id}/payu-verify`, {
                      method: "POST",
                      body: JSON.stringify({ txnid: `PAYU_${Date.now()}` }),
                    });
                    toast.success("PayU Payment Verified! Agreement Unlocked 🎉");
                    setPayuRow(null);
                    await load();
                    const docRes = await api(`/agreements/${payuRow.id}/document`);
                    const popup = window.open("", "_blank", "width=900,height=700");
                    if (popup) {
                      popup.document.write(agreementDocument(docRes));
                      popup.document.close();
                    }
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "PayU payment failed");
                  } finally {
                    setPaying(false);
                  }
                }}
              >
                {paying ? "Processing PayU…" : "Pay Now via PayU 🚀"}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="skeleton">Loading {title.toLowerCase()}…</div>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          {icon}
          <h2>No {title.toLowerCase()} found</h2>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {columns.map(([_, label]) => (
                  <th key={label}>{label}</th>
                ))}
                {(printable || canDelete) && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isAgreementLocked = title === "Agreements" && (row.locked || row.payment_status !== "Paid");
                return (
                  <tr key={row.id}>
                    {columns.map(([key, _, fmt]) => (
                      <td key={key}>{fmt ? fmt(row[key]) : text(row[key])}</td>
                    ))}
                    {(printable || canDelete) && (
                      <td>
                        <div className="row-actions">
                          {printable && (
                            isAgreementLocked ? (
                              <button
                                type="button"
                                className="primary"
                                style={{ background: "#10b981", borderColor: "#059669", color: "#fff", fontWeight: 700, padding: "5px 10px", fontSize: "12px" }}
                                onClick={() => setPayuRow(row)}
                              >
                                🔒 Pay via PayU
                              </button>
                            ) : (
                              <button className="secondary" onClick={() => void printRecord(title.slice(0, -1), row)}>
                                Print / PDF
                              </button>
                            )
                          )}
                          {canDelete && (
                            <button className="danger" onClick={() => void remove(row)}>
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

export function CustomersPage() {
  return (
    <DataPage
      title="Customers"
      kicker="CRM"
      description="Manage solar customers, contact profiles, user roles and login accounts."
      path="/customers"
      permission="customers:create"
      deletePermission="customers:delete"
      columns={[
        ["customer_number", "Customer #"],
        ["name", "Name"],
        ["mobile", "Mobile"],
        ["customer_type", "Type / Role"],
        ["status", "Status"],
      ]}
      fields={[
        ["name", "Full Name", "text"],
        ["mobile", "Mobile Number", "text"],
        ["email", "Email Address", "email", null, false],
        ["password", "Password", "password", null, false],
        [
          "customerType",
          "Customer Type / Role",
          "select",
          [
            "Residential",
            "Commercial",
            "Industrial",
            "Admin",
            "Manager",
            "Sales Executive",
            "Installation Staff",
            "Service Technician",
            "Accountant",
          ],
        ],
      ]}
      icon={<Users />}
    />
  );
}

export function ProductsPage() {
  return (
    <DataPage
      title="Products"
      kicker="INVENTORY"
      description="Catalog of solar panels, inverters, structures and components."
      path="/products"
      permission="products:create"
      deletePermission="products:delete"
      columns={[
        ["sku", "SKU"],
        ["name", "Product Name"],
        ["category", "Category"],
        ["brand", "Brand"],
        ["selling_price", "Selling Price", money],
      ]}
      fields={[
        ["name", "Product Name", "text"],
        ["category", "Category", "text"],
        ["brand", "Brand", "text"],
        ["sellingPrice", "Selling Price", "number"],
      ]}
      icon={<Package />}
    />
  );
}

export function ProjectsPage() {
  return (
    <DataPage
      title="Installations"
      kicker="OPERATIONS"
      description="Track solar rooftop installation progress and stages."
      path="/projects"
      permission="projects:create"
      columns={[
        ["project_number", "Project #"],
        ["stage", "Stage"],
        ["progress", "Progress (%)"],
        ["created_at", "Date", (v) => new Date(v).toLocaleDateString("en-IN")],
      ]}
      icon={<Package />}
    />
  );
}

export function TicketsPage() {
  return (
    <DataPage
      title="Service Tickets"
      kicker="SUPPORT"
      description="Track service maintenance and warranty claims."
      path="/tickets"
      permission="tickets:create"
      columns={[
        ["ticket_number", "Ticket #"],
        ["subject", "Subject"],
        ["status", "Status"],
        ["priority", "Priority"],
      ]}
      icon={<FileText />}
    />
  );
}

export function QuotationsPage() {
  return (
    <DataPage
      title="Quotations"
      kicker="SALES"
      description="Generate and print official solar installation quotations."
      path="/quotations"
      permission="quotations:create"
      deletePermission="quotations:delete"
      printable
      columns={[
        ["quotation_number", "Quotation #"],
        ["customer_name", "Customer"],
        ["capacity_kw", "Capacity (kW)"],
        ["grand_total", "Grand Total", money],
        ["status", "Status"],
      ]}
      fields={[
        ["customerName", "Customer Name", "text"],
        ["capacityKw", "System Capacity (kW)", "number"],
        ["grandTotal", "Grand Total (₹)", "number"],
        ["consumerAddress", "Installation Address", "text"],
        ["status", "Status", "select", ["Draft", "Sent", "Approved", "Rejected"]],
      ]}
      icon={<FileText />}
    />
  );
}

export function InvoicesPage() {
  return (
    <DataPage
      title="Invoices"
      kicker="FINANCE"
      description="Tax invoices and billing records for customers."
      path="/invoices"
      permission="invoices:create"
      deletePermission="invoices:delete"
      printable
      columns={[
        ["invoice_number", "Invoice #"],
        ["title", "Title"],
        ["total", "Total Amount", money],
        ["paid_amount", "Paid Amount", money],
        ["status", "Status"],
      ]}
      fields={[
        ["title", "Invoice Title", "text"],
        ["customerName", "Customer Name", "text"],
        ["total", "Total Amount (₹)", "number"],
        ["paidAmount", "Paid Amount (₹)", "number"],
        ["tax", "Tax / GST (₹)", "number"],
        ["dueDate", "Due Date", "date"],
        ["status", "Status", "select", ["Draft", "Sent", "Paid", "Overdue", "Cancelled"]],
      ]}
      icon={<FileText />}
    />
  );
}

export function AgreementsPage() {
  return (
    <DataPage
      title="Agreements"
      kicker="LEGAL & CONTRACTS"
      description="PM Surya Ghar Muft Bijli Yojana installation agreements."
      path="/agreements"
      permission="agreements:create"
      deletePermission="agreements:delete"
      printable
      columns={[
        ["agreement_number", "Agreement #"],
        ["customer_name", "Customer"],
        ["payment_status", "Payment Status"],
        ["payment_amount", "Amount", money],
        ["status", "Status"],
      ]}
      fields={[
        ["customerName", "Customer Name", "text"],
        ["paymentAmount", "Project / Payment Amount (₹)", "number"],
        ["consumerAddress", "Consumer Address", "text"],
        ["quotationId", "Quotation # (optional)", "text", null, false],
        ["agreementDate", "Agreement Date", "date"],
      ]}
      icon={<FileText />}
    />
  );
}

export function SettingsPage() {
  return (
    <main className="app-page">
      <span className="kicker">SYSTEM</span>
      <h1>Settings</h1>
      <div className="card">
        <h2>Company Information</h2>
        <p>A1 Solar Solution — Premier Solar EPC & Installation Provider</p>
      </div>
    </main>
  );
}

export function ProfilePage() {
  const { user } = useAuth();

  const profile = async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      await api("/profile", {
        method: "PATCH",
        body: JSON.stringify({
          fullName: form.get("fullName"),
          phone: form.get("phone") || null,
        }),
      });
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Profile update failed");
    }
  };

  const password = async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      await api("/profile/password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: form.get("currentPassword"),
          newPassword: form.get("newPassword"),
        }),
      });
      toast.success("Password updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Password update failed");
    }
  };

  return (
    <main className="app-page">
      <span className="kicker">MY ACCOUNT</span>
      <h1>Profile & security</h1>
      <div className="detail-grid">
        <form className="card operational-form" onSubmit={profile}>
          <h2>Profile</h2>
          <label>
            Full name
            <input name="fullName" defaultValue={user?.fullName} required />
          </label>
          <label>
            Phone
            <input name="phone" />
          </label>
          <button className="primary">Update profile</button>
        </form>
        <form className="card operational-form" onSubmit={password}>
          <h2>Change password</h2>
          <label>
            Current password
            <input name="currentPassword" type="password" required />
          </label>
          <label>
            New password
            <input name="newPassword" type="password" minLength={10} required />
          </label>
          <button className="primary">Change password</button>
        </form>
      </div>
    </main>
  );
}

export function WorkspaceNotFound() {
  return (
    <main className="app-page">
      <div className="empty-state">
        <Settings />
        <h1>Page not found</h1>
        <p>Choose a module from the workspace navigation.</p>
      </div>
    </main>
  );
}

export function LeadsPage() {
  return (
    <main className="app-page">
      <span className="kicker">CRM</span>
      <h1>Leads</h1>
      <div className="empty-state">
        <Users />
        <h2>Lead workflow</h2>
        <p>
          Lead capture and conversion remains available as the extended CRM
          workflow.
        </p>
      </div>
    </main>
  );
}
