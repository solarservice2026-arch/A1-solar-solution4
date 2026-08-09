import {
  ArrowLeft,
  Building2,
  ChevronRight,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useAuth } from "../auth/AuthProvider.jsx";
import { api } from "../../lib/api.js";
import { removeImageBackground } from "../../lib/imageUtils.js";
import logo from "../../assets/a1-solar-logo-transparent.png";

const items = [
  {
    to: "/app",
    label: "Dashboard",
    icon: LayoutDashboard,
    permission: "dashboard:view",
  },
  {
    to: "/app/customers",
    label: "Customers",
    icon: Users,
    permission: "customers:view",
  },
  {
    to: "/app/products",
    label: "Products",
    icon: FileText,
    permission: "products:view",
  },
  {
    to: "/app/quotations",
    label: "Quotations",
    icon: FileText,
    permission: "quotations:view",
  },
  {
    to: "/app/invoices",
    label: "Invoices",
    icon: FileText,
    permission: "invoices:view",
  },
  {
    to: "/app/agreements",
    label: "Agreements",
    icon: FileText,
    permission: "agreements:view",
  },
  { to: "/app/staff", label: "Staff", icon: Users, permission: "users:view" },
  {
    to: "/app/profile",
    label: "Profile & password",
    icon: UserCircle,
    permission: "dashboard:view",
  },
];

export function AppShell() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.roles?.includes("customer") && location.pathname === "/app") {
      navigate("/app/agreements", { replace: true });
    }
  }, [user, location.pathname, navigate]);

  const allowed = (permission, to) => {
    if (!user) return false;
    const isSuperAdmin = user.roles?.includes("super_admin") || user.roles?.includes("superadmin");

    // Roles & permissions button removed from frontend UI completely
    if (to === "/app/roles" || permission === "roles:view") {
      return false;
    }

    // ONLY Super Admin can access or view Staff
    if (to === "/app/staff" || permission === "users:view") {
      return isSuperAdmin;
    }

    if (isSuperAdmin || user.roles?.includes("admin")) {
      return true;
    }
    if (user.roles?.includes("installation_staff")) {
      return to === "/app" || to === "/app/projects" || to === "/app/profile";
    }
    if (user.roles?.includes("service_technician")) {
      return to === "/app" || to === "/app/tickets" || to === "/app/profile";
    }
    if (user.roles?.includes("accountant")) {
      return (
        to === "/app" ||
        to === "/app/customers" ||
        to === "/app/quotations" ||
        to === "/app/agreements" ||
        to === "/app/invoices" ||
        to === "/app/profile"
      );
    }
    if (user.roles?.includes("customer")) {
      return to === "/app/quotations" || to === "/app/invoices" || to === "/app/agreements" || to === "/app/profile";
    }
    return user.permissions?.includes(permission);
  };

  const crumb =
    items.find((i) => i.to === location.pathname)?.label ?? "Workspace";

  const userLogo = user?.company_logo_url || user?.companyLogoUrl || user?.companyLogo || user?.logo;
  const [cleanLogo, setCleanLogo] = useState(userLogo || null);

  useEffect(() => {
    let active = true;
    if (userLogo) {
      removeImageBackground(userLogo)
        .then((cleaned) => {
          if (active) setCleanLogo(cleaned);
        })
        .catch(() => {
          if (active) setCleanLogo(userLogo);
        });
    } else {
      setCleanLogo(null);
    }
    return () => {
      active = false;
    };
  }, [userLogo]);

  return (
    <div className="app-layout">
      <aside className={open ? "app-sidebar open" : "app-sidebar"}>
        <div className="app-logo" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link to="/app" style={{ display: "flex", alignItems: "center" }}>
            <img
              src={cleanLogo || userLogo || logo}
              alt={user?.company_name || "A1 Solar Solution"}
              style={{ height: "55px", maxWidth: "180px", width: "auto", objectFit: "contain", maxHeight: "55px" }}
            />
          </Link>
          <button onClick={() => setOpen(false)} aria-label="Close menu">
            <X />
          </button>
        </div>
        <nav>
          {items
            .filter((i) => allowed(i.permission, i.to))
            .map(({ to, label, icon: Icon }) => (
              <NavLink
                end={to === "/app"}
                key={to}
                to={to}
                onClick={() => setOpen(false)}
              >
                <Icon />
                {label}
                <ChevronRight />
              </NavLink>
            ))}
        </nav>
        <button className="logout" onClick={() => void signOut()}>
          <LogOut /> Sign out
        </button>
      </aside>
      <div className="app-main">
        <header className="app-top">
          <div className="header-context">
            <button
              className="drawer"
              aria-label="Open menu"
              onClick={() => setOpen(true)}
            >
              <Menu />
            </button>
            <button
              className="back-button"
              aria-label="Go back"
              onClick={() =>
                location.pathname === "/app" ? navigate("/") : navigate(-1)
              }
            >
              <ArrowLeft />
              <span>Back</span>
            </button>
            <div className="header-title-box">
              <small>WORKSPACE</small>
              <b>{crumb}</b>
            </div>
          </div>
          <div className="app-user">
            <div className="user-profile-badge">
              <span>{user?.fullName || user?.full_name || user?.name || "User"}</span>
              <small>{(user?.roles ?? ["super_admin"]).map(r => r === "customer" ? "Customer" : r === "super_admin" ? "Super Admin" : r).join(", ").replaceAll("_", " ")}</small>
            </div>
            <button
              className="icon-button logout-header-button"
              aria-label="Sign out"
              onClick={() => void signOut()}
              title="Sign out"
              style={{
                marginLeft: "12px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState({});

  useEffect(() => {
    api("/dashboard")
      .then((res) => setData(res || {}))
      .catch(() => setData({}));
  }, []);

  return (
    <main className="app-page">
      <span className="kicker">OVERVIEW</span>
      <h1>Welcome, {user?.fullName}.</h1>
      <p>Your live role-authorized business overview.</p>
      <div className="role-grid">
        {Object.entries(data).map(([key, value]) => (
          <article className="card" key={key}>
            <small>{key.replaceAll("_", " ")}</small>
            <h2>{Number(value).toLocaleString("en-IN")}</h2>
          </article>
        ))}
      </div>
      {Object.keys(data).length === 0 && (
        <div className="empty-state">
          <LayoutDashboard />
          <h2>No operational data yet</h2>
          <p>Create your first business record to populate this dashboard.</p>
        </div>
      )}
    </main>
  );
}

export function Forbidden() {
  return (
    <main className="page center-page">
      <h1>403</h1>
      <h2>Access denied</h2>
      <p>Your account does not have permission to open this page.</p>
      <Link className="primary" to="/app">
        Back to dashboard
      </Link>
    </main>
  );
}
