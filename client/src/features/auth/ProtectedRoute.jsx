import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider.jsx";

export function ProtectedRoute({ permission, requireSuperAdmin }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading)
    return (
      <main className="auth-state">
        <div className="spinner" />
        <p>Restoring your secure session…</p>
      </main>
    );

  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!user.active) return <Navigate to="/forbidden" replace />;

  const isSuperAdmin = user.roles?.includes("super_admin") || user.roles?.includes("superadmin");

  // Roles & permissions page disabled on frontend UI for all users
  if (permission === "roles:view" || location.pathname.startsWith("/app/roles")) {
    return <Navigate to="/forbidden" replace />;
  }

  if ((requireSuperAdmin || permission === "users:view") && !isSuperAdmin) {
    return <Navigate to="/forbidden" replace />;
  }

  if (
    permission &&
    !isSuperAdmin &&
    !user.roles?.includes("admin") &&
    !user.permissions?.includes(permission)
  )
    return <Navigate to="/forbidden" replace />;

  return <Outlet />;
}
