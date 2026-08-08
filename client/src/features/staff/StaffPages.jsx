import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../../lib/api.js";
import { useAuth } from "../auth/AuthProvider.jsx";
import { removeImageBackground } from "../../lib/imageUtils.js";

export function StaffList() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await api(`/staff?search=${encodeURIComponent(search)}&limit=20`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load staff");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const status = async (row, active) => {
    if (!confirm(`${active ? "Activate" : "Disable"} ${row.full_name}?`)) return;
    try {
      await api(`/staff/${row.id}/${active ? "activate" : "disable"}`, { method: "POST" });
      toast.success(active ? "User activated" : "User disabled");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to update user");
    }
  };

  const archive = async (row) => {
    if (!confirm(`Delete ${row.full_name}? The account will be securely archived and its business history preserved.`)) return;
    try {
      await api(`/staff/${row.id}`, { method: "DELETE" });
      toast.success("User archived");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to delete user");
    }
  };

  const canAdd = user?.roles?.includes("super_admin") || user?.permissions?.includes("users:create");
  const canRemove = user?.roles?.includes("super_admin") || user?.permissions?.includes("users:remove");

  return (
    <main className="app-page">
      <div className="page-bar">
        <div>
          <span className="kicker">TEAM ACCESS</span>
          <h1>Staff</h1>
        </div>
        {canAdd && <Link className="primary" to="/app/staff/new">Add user</Link>}
      </div>
      <div className="toolbar">
        <input aria-label="Search staff" placeholder="Search by name" value={search} onChange={e => setSearch(e.target.value)} />
        <button onClick={() => void load()}>Search</button>
      </div>
      {loading ? (
        <div className="skeleton">Loading staff…</div>
      ) : error ? (
        <div className="form-error">{error} <button onClick={() => void load()}>Retry</button></div>
      ) : rows.length === 0 ? (
        <div className="empty-state"><h2>No staff found</h2></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id}>
                  <td><Link to={`/app/staff/${row.id}`}>{row.full_name}</Link></td>
                  <td>{row.user_roles?.map(x => x.roles.name.replaceAll("_", " ")).join(", ") || "No role"}</td>
                  <td><span className={row.active ? "pill active" : "pill"}>{row.active ? "Active" : "Disabled"}</span></td>
                  <td>{row.last_login_at ? new Date(row.last_login_at).toLocaleString("en-IN") : "Never"}</td>
                  <td>
                    <div className="row-actions">
                      <button className="secondary" onClick={() => void status(row, !row.active)}>{row.active ? "Disable" : "Activate"}</button>
                      {canRemove && <button className="danger" onClick={() => void archive(row)}>Delete</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

export function StaffForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [roles, setRoles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [selectedRole, setSelectedRole] = useState("admin");
  const [companyLogoUrl, setCompanyLogoUrl] = useState(null);
  const [companySignatureUrl, setCompanySignatureUrl] = useState(null);

  useEffect(() => {
    void api("/roles").then(setRoles).catch(e => toast.error(e instanceof Error ? e.message : "Unable to load roles"));
  }, []);

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const raw = String(ev.target?.result || "");
      const clean = await removeImageBackground(raw);
      setCompanyLogoUrl(clean);
    };
    reader.readAsDataURL(file);
  };

  const handleSignatureUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const raw = String(ev.target?.result || "");
      const clean = await removeImageBackground(raw);
      setCompanySignatureUrl(clean);
    };
    reader.readAsDataURL(file);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const role = String(form.get("role") || selectedRole);

    const accountHolder = String(form.get("accountHolder") || "").trim();
    const bankName = String(form.get("bankName") || "").trim();
    const bankBranch = String(form.get("bankBranch") || "").trim();
    const accountNo = String(form.get("accountNo") || "").trim();
    const ifscCode = String(form.get("ifscCode") || "").trim();

    const bankDetails = (role === "admin" && (accountHolder || bankName || accountNo)) ? {
      accountHolder: accountHolder || "A1 SOLAR SOLUTION",
      bankName: bankName || "PUNJAB NATIONAL BANK",
      branch: bankBranch || "TAJPUR",
      accountNo: accountNo || "9335002100003167",
      ifscCode: ifscCode || "PUNB0933500",
    } : undefined;

    try {
      await api("/staff", {
        method: "POST",
        body: JSON.stringify({
          fullName: form.get("fullName"),
          email: form.get("email"),
          password: form.get("password"),
          phone: form.get("phone") || undefined,
          role,
          active: true,
          ...(role === "admin" ? {
            companyName: String(form.get("companyName") || "A1 SOLAR SOLUTION").trim(),
            companyAddress: String(form.get("companyAddress") || "VISHNUPUR KAIJU PATEHPUR VAISHALI BIHAR").trim(),
            companyLogoUrl: companyLogoUrl || undefined,
            companySignatureUrl: companySignatureUrl || undefined,
            bankDetails,
          } : {})
        }),
      });
      toast.success("Staff account created");
      navigate("/app/staff");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to create staff account");
    } finally {
      setSaving(false);
    }
  };

  const allowed = roles.filter(role => user?.roles?.includes("super_admin") ? role.name !== "super_admin" : !["super_admin", "admin"].includes(role.name));

  return (
    <main className="app-page">
      <span className="kicker">ACCOUNT MANAGEMENT</span>
      <h1>{user?.roles?.includes("super_admin") ? "Create an administrator or user" : "Create a user"}</h1>
      <p>Access is enforced by the server. Admins can manage operational users only.</p>
      <form className="card operational-form" onSubmit={submit}>
        <label>Full name<input name="fullName" required minLength={2} /></label>
        <label>Email<input name="email" type="email" required /></label>
        <label>Password<input name="password" type="password" required minLength={6} /></label>
        <label>Mobile<input name="phone" pattern="[6-9][0-9]{9}" /></label>
        <label>Role
          <select name="role" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} required>
            {allowed.map(r => <option key={r.id} value={r.name}>{r.name.replaceAll("_", " ")}</option>)}
          </select>
        </label>

        {selectedRole === "admin" && (
          <>
            <div style={{ gridColumn: "1 / -1", marginTop: "12px", paddingTop: "12px", borderTop: "1px dashed #cbd5e1" }}>
              <h3 style={{ margin: "0 0 6px", color: "#1e3a8a", fontSize: "15px", fontWeight: 700 }}>
                🏢 Admin Company &amp; Branding Setup
              </h3>
              <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#64748b" }}>
                Set custom company logo, stamp signature, address and bank details for this administrator.
              </p>
            </div>

            <label className="span-2">
              Company Name
              <input name="companyName" placeholder="e.g. A1 SOLAR SOLUTION" defaultValue="A1 SOLAR SOLUTION" required />
            </label>

            <label className="span-2">
              Company Registered Address
              <textarea name="companyAddress" placeholder="e.g. VISHNUPUR KAIJU PATEHPUR VAISHALI BIHAR" defaultValue="VISHNUPUR KAIJU PATEHPUR VAISHALI BIHAR" rows={2} required />
            </label>

            <label>
              Company Logo
              <div style={{ marginTop: "4px", display: "flex", alignItems: "center", gap: "10px" }}>
                <input type="file" accept="image/*" onChange={handleLogoUpload} />
                {companyLogoUrl && <img src={companyLogoUrl} alt="Logo preview" style={{ height: "36px", objectFit: "contain", border: "1px solid #ddd", borderRadius: "4px" }} />}
              </div>
            </label>

            <label>
              Stamp / Proprietor Signature
              <div style={{ marginTop: "4px", display: "flex", alignItems: "center", gap: "10px" }}>
                <input type="file" accept="image/*" onChange={handleSignatureUpload} />
                {companySignatureUrl && <img src={companySignatureUrl} alt="Stamp preview" style={{ height: "36px", objectFit: "contain", border: "1px solid #ddd", borderRadius: "4px" }} />}
              </div>
            </label>

            <div style={{ gridColumn: "1 / -1", marginTop: "8px" }}>
              <h4 style={{ margin: "0 0 8px", color: "#334155", fontSize: "13px", fontWeight: 700 }}>
                💳 Payment Details (Bank Account Info)
              </h4>
            </div>

            <label>
              Account Holder
              <input name="accountHolder" placeholder="e.g. A1 SOLAR SOLUTION" defaultValue="A1 SOLAR SOLUTION" required />
            </label>

            <label>
              Bank Name
              <input name="bankName" placeholder="e.g. PUNJAB NATIONAL BANK" defaultValue="PUNJAB NATIONAL BANK" required />
            </label>

            <label>
              Branch
              <input name="bankBranch" placeholder="e.g. TAJPUR" defaultValue="TAJPUR" required />
            </label>

            <label>
              Account Number
              <input name="accountNo" placeholder="e.g. 9335002100003167" defaultValue="9335002100003167" required />
            </label>

            <label>
              IFSC Code
              <input name="ifscCode" placeholder="e.g. PUNB0933500" defaultValue="PUNB0933500" required />
            </label>
          </>
        )}

        <button className="primary" disabled={saving} style={{ gridColumn: "1 / -1", marginTop: "12px" }}>
          {saving ? "Creating account…" : "Create account"}
        </button>
      </form>
    </main>
  );
}

export function StaffDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [staff, setStaff] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [roles, setRoles] = useState([]);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const [member, effective, available] = await Promise.all([
        api(`/staff/${id}`),
        api(`/staff/${id}/permissions`),
        api("/roles")
      ]);
      setStaff(member);
      setPermissions(effective);
      setRoles(available.filter(role => role.name !== "super_admin" && (user?.roles?.includes("super_admin") || role.name !== "admin")));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load staff");
    }
  };

  useEffect(() => {
    void load();
  }, [id, user?.roles?.join(",")]);

  const status = async (active) => {
    if (!confirm(`${active ? "Activate" : "Disable"} this account?`)) return;
    try {
      await api(`/staff/${id}/${active ? "activate" : "disable"}`, { method: "POST" });
      toast.success("Account updated");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const assign = async (e) => {
    e.preventDefault();
    const roleId = String(new FormData(e.currentTarget).get("roleId"));
    if (!canAssign || !allowedRoles.some(role => role.id === roleId)) return toast.error("You cannot assign this role");
    try {
      await api(`/staff/${id}/roles`, { method: "POST", body: JSON.stringify({ roleId }) });
      toast.success("Role assigned");
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Role assignment failed");
    }
  };

  const remove = async (roleId) => {
    if (!confirm("Remove this role?")) return;
    try {
      await api(`/staff/${id}/roles/${roleId}`, { method: "DELETE" });
      toast.success("Role removed");
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Role removal failed");
    }
  };

  const canAssign = user?.roles?.includes("super_admin") || user?.permissions?.includes("users:assign_roles");
  const allowedRoles = roles.filter(role => role.name !== "super_admin" && (user?.roles?.includes("super_admin") || role.name !== "admin"));

  if (error) return <main className="app-page"><div className="form-error">{error}</div></main>;
  if (!staff) return <main className="app-page"><div className="skeleton">Loading profile…</div></main>;

  return (
    <main className="app-page">
      <div className="page-bar">
        <div>
          <span className="kicker">STAFF PROFILE</span>
          <h1>{staff.full_name}</h1>
        </div>
        <div>
          <Link className="secondary" to={`/app/staff/${id}/edit`}>Edit</Link>{" "}
          <button className="secondary" onClick={() => void status(!staff.active)}>{staff.active ? "Disable" : "Activate"}</button>
        </div>
      </div>
      <div className="detail-grid">
        <section className="card">
          <h2>Account</h2>
          <p>Status: <b>{staff.active ? "Active" : "Disabled"}</b></p>
          <p>Created: {new Date(staff.created_at).toLocaleString("en-IN")}</p>
          <p>Last login: {staff.last_login_at ? new Date(staff.last_login_at).toLocaleString("en-IN") : "Never"}</p>
          <h3>Assigned roles</h3>
          <div className="permission-list">
            {staff.user_roles?.map(item => <button key={item.role_id} onClick={() => void remove(item.role_id)}>{item.roles.name.replaceAll("_", " ")} ×</button>)}
          </div>
          <form className="toolbar" onSubmit={assign}>
            <select name="roleId">{roles.filter(role => !staff.user_roles?.some(item => item.role_id === role.id)).map(role => <option key={role.id} value={role.id}>{role.name.replaceAll("_", " ")}</option>)}</select>
            <button>Assign</button>
          </form>
        </section>
        <section className="card">
          <h2>Effective permissions</h2>
          <div className="permission-list">{permissions.map(p => <span key={p.key}>{p.key}</span>)}</div>
        </section>
      </div>
    </main>
  );
}

export function StaffEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [staff, setStaff] = useState(null);
  const [companyLogoUrl, setCompanyLogoUrl] = useState(null);

  useEffect(() => {
    void api(`/staff/${id}`).then(data => {
      setStaff(data);
      if (data?.company_logo_url || data?.companyLogoUrl) {
        setCompanyLogoUrl(data.company_logo_url || data.companyLogoUrl);
      }
    }).catch(e => toast.error(e instanceof Error ? e.message : "Unable to load staff"));
  }, [id]);

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const raw = String(ev.target?.result || "");
      const clean = await removeImageBackground(raw);
      setCompanyLogoUrl(clean);
    };
    reader.readAsDataURL(file);
  };

  const submit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const pwd = form.get("password");
    try {
      await api(`/staff/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          fullName: form.get("fullName"),
          phone: form.get("phone") || null,
          companyName: form.get("companyName") || null,
          companyAddress: form.get("companyAddress") || null,
          companyLogoUrl: companyLogoUrl,
          ...(pwd ? { password: String(pwd).trim() } : {}),
        }),
      });
      toast.success("Staff profile & company logo updated successfully");
      navigate(`/app/staff/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to update staff");
    }
  };

  if (!staff) return <main className="app-page"><div className="skeleton">Loading staff…</div></main>;

  return (
    <main className="app-page">
      <span className="kicker">STAFF MANAGEMENT</span>
      <h1>Edit staff profile</h1>
      <form className="card operational-form" onSubmit={submit}>
        <label>Full name<input name="fullName" required defaultValue={staff.full_name || staff.name} /></label>
        <label>Mobile<input name="phone" defaultValue={staff.phone} /></label>
        <label>Company Name<input name="companyName" defaultValue={staff.company_name || staff.companyName} placeholder="Company Name" /></label>
        <label>Company Address<textarea name="companyAddress" defaultValue={staff.company_address || staff.companyAddress} rows={2} placeholder="Company Address" /></label>
        
        <label style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
          <span>Company Logo (Top Left Corner Logo)</span>
          <input type="file" accept="image/*" onChange={handleLogoUpload} />
          {companyLogoUrl ? (
            <div style={{ marginTop: "8px", padding: "10px", background: "#0a2e36", borderRadius: "8px", display: "inline-flex", alignItems: "center", gap: "14px" }}>
              <img src={companyLogoUrl} alt="Logo Preview" style={{ height: "45px", maxWidth: "160px", objectFit: "contain" }} />
              <button type="button" onClick={() => setCompanyLogoUrl(null)} style={{ background: "#ef4444", color: "#fff", border: 0, padding: "4px 8px", borderRadius: "4px", cursor: "pointer", fontSize: "11px" }}>Remove Logo</button>
            </div>
          ) : (
            <small style={{ color: "#666" }}>Upload PNG/JPG logo (Background cleaned automatically)</small>
          )}
        </label>

        <label style={{ marginTop: "14px" }}>New password (optional)<input name="password" type="password" minLength={6} placeholder="Leave blank to keep existing password" /></label>
        <button className="primary" style={{ marginTop: "16px" }}>Save changes</button>
      </form>
    </main>
  );
}

export function RolesPage() {
  const [roles, setRoles] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void api("/roles").then(setRoles).catch(e => setError(e instanceof Error ? e.message : "Unable to load roles"));
  }, []);

  return (
    <main className="app-page">
      <span className="kicker">ACCESS CONTROL</span>
      <h1>Roles & permissions</h1>
      {error ? (
        <div className="form-error">{error}</div>
      ) : (
        <div className="role-grid">
          {roles.map(role => (
            <Link className="card" key={role.id} to={`/app/roles/${role.id}`}>
              <h2>{role.name.replaceAll("_", " ")}</h2>
              <p>{role.description}</p>
              <b>{role.role_permissions?.length ?? 0} permissions</b>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

export function RoleDetail() {
  const { id } = useParams();
  const [role, setRole] = useState(null);
  const [all, setAll] = useState([]);

  const load = async () => {
    try {
      const [selected, permissions] = await Promise.all([
        api(`/roles/${id}`),
        api("/roles/permissions")
      ]);
      setRole(selected);
      setAll(permissions);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to load role");
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  const add = async (e) => {
    e.preventDefault();
    const permissionId = String(new FormData(e.currentTarget).get("permissionId"));
    try {
      await api(`/roles/${id}/permissions`, { method: "POST", body: JSON.stringify({ permissionId }) });
      toast.success("Permission assigned");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Assignment failed");
    }
  };

  const remove = async (permissionId) => {
    if (!confirm("Remove this permission?")) return;
    try {
      await api(`/roles/${id}/permissions/${permissionId}`, { method: "DELETE" });
      toast.success("Permission removed");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Removal failed");
    }
  };

  const assigned = new Set(role?.role_permissions?.map(p => p.permissions.id));

  return (
    <main className="app-page">
      <span className="kicker">ROLE</span>
      <h1>{role?.name?.replaceAll("_", " ") ?? "Loading…"}</h1>
      <form className="toolbar" onSubmit={add}>
        <select name="permissionId" aria-label="Permission">
          {all.filter(p => !assigned.has(p.id)).map(p => (
            <option key={p.id} value={p.id}>{p.key}</option>
          ))}
        </select>
        <button className="primary">Assign permission</button>
      </form>
      <div className="permission-list">
        {role?.role_permissions?.map(p => (
          <button key={p.permissions.id} onClick={() => void remove(p.permissions.id)}>
            {p.permissions.key} ×
          </button>
        ))}
      </div>
    </main>
  );
}
