import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { resetPasswordSchema } from "../../lib/validation.js";
import { useAuth } from "./AuthProvider.jsx";
import { apiBaseUrl } from "../../lib/api-base.js";

export function LoginPage() {
  const { signIn, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (user) return <Navigate to="/app" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await signIn(email, password);
      navigate("/app", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    }
  };

  return (
    <AuthCard
      title="Welcome back."
      subtitle="Sign in to your secure A1 Solar workspace."
    >
      <form onSubmit={submit}>
        <label>
          Email
          <input
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            required
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <div className="form-error" role="alert" style={{ background: "#fee2e2", border: "1px solid #ef4444", color: "#b91c1c", padding: "12px 14px", borderRadius: "6px", margin: "14px 0", fontSize: "13px", fontWeight: 600, lineHeight: 1.4 }}>
            🚫 {error}
          </div>
        )}
        <button disabled={loading} className="primary">
          {loading ? "Signing in…" : "Sign in"} <ArrowRight />
        </button>
      </form>
      <Link to="/forgot-password">Forgot password?</Link>
    </AuthCard>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error?.message || data?.message || "Failed to send reset link");
      }
      setSent(true);
      toast.success(data?.message || "If an account exists for this email, password reset instructions have been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset link");
      toast.error(err instanceof Error ? err.message : "Failed to send reset link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Reset access."
      subtitle="We’ll send a secure reset link if the account exists."
    >
      {sent ? (
        <div className="success-box" style={{ padding: "16px", borderRadius: "6px", background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", margin: "14px 0", fontSize: "14px" }}>
          📧 Check your registered email for the reset link and instructions.
        </div>
      ) : (
        <form onSubmit={submit}>
          <label>
            Email
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {error && (
            <div className="form-error" role="alert" style={{ background: "#fee2e2", border: "1px solid #ef4444", color: "#b91c1c", padding: "12px 14px", borderRadius: "6px", margin: "14px 0", fontSize: "13px", fontWeight: 600 }}>
              🚫 {error}
            </div>
          )}
          <button disabled={loading} className="primary">
            {loading ? "Sending link…" : "Send reset link"} <ArrowRight />
          </button>
        </form>
      )}
      <Link to="/login">Back to sign in</Link>
    </AuthCard>
  );
}

export function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const queryParams = new URLSearchParams(location.search);
  const token = queryParams.get("token");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!token) {
      setError("Reset token missing from URL link. Please request a new password reset.");
      return;
    }

    const parsed = resetPasswordSchema.safeParse({ password, confirmation });
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid password";
      setError(msg);
      return toast.error(msg);
    }

    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmation }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error?.message || data?.message || "Failed to update password");
      }

      setSuccessMsg("Password updated successfully! Redirecting to sign in…");
      toast.success("Password updated successfully!");
      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password");
      toast.error(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Choose a new password."
      subtitle="Use at least 10 characters with upper/lowercase and a number."
    >
      {!token && (
        <div className="form-error" role="alert" style={{ background: "#fee2e2", border: "1px solid #ef4444", color: "#b91c1c", padding: "12px 14px", borderRadius: "6px", margin: "14px 0", fontSize: "13px", fontWeight: 600 }}>
          🚫 Invalid link. Reset token is missing. Please click the reset link sent to your email or request a new one.
        </div>
      )}
      {successMsg ? (
        <div className="success-box" style={{ padding: "16px", borderRadius: "6px", background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", margin: "14px 0", fontSize: "14px" }}>
          ✅ {successMsg}
        </div>
      ) : (
        <form onSubmit={submit}>
          <label>
            New password
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label>
            Confirm password
            <input
              required
              type="password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </label>
          {error && (
            <div className="form-error" role="alert" style={{ background: "#fee2e2", border: "1px solid #ef4444", color: "#b91c1c", padding: "12px 14px", borderRadius: "6px", margin: "14px 0", fontSize: "13px", fontWeight: 600 }}>
              🚫 {error}
            </div>
          )}
          <button disabled={loading || !token} className="primary">
            {loading ? "Updating password…" : "Update password"} <ArrowRight />
          </button>
        </form>
      )}
      <Link to="/login">Back to sign in</Link>
    </AuthCard>
  );
}

function AuthCard({ title, subtitle, children }) {
  return (
    <main className="page auth">
      <div className="card">

        <span className="kicker">SECURE PORTAL</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        {children}
      </div>
    </main>
  );
}
