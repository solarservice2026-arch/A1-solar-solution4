const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const frontendHostname = window.location.hostname.toLowerCase();
const isLocalFrontend =
  frontendHostname === "localhost" || frontendHostname === "127.0.0.1";

const selectedApiUrl = isLocalFrontend
  ? configuredApiUrl || "http://localhost:5000"
  : window.location.origin;

const apiOrigin = selectedApiUrl.replace(/\/+$/, "");

export const apiBaseUrl = apiOrigin.endsWith("/api/v1")
  ? apiOrigin
  : `${apiOrigin}/api/v1`;
