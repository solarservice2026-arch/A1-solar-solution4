const configuredApiUrl =
  import.meta.env.VITE_API_BASE_URL?.trim() ||
  import.meta.env.VITE_API_URL?.trim();

const frontendHostname = window.location.hostname.toLowerCase();
const isLocalFrontend =
  frontendHostname === "localhost" || frontendHostname === "127.0.0.1";

const selectedApiUrl = isLocalFrontend
  ? configuredApiUrl || "http://localhost:5000"
  : configuredApiUrl || "https://a1-solar-solution4.onrender.com";

const apiOrigin = selectedApiUrl.replace(/\/+$/, "");

export const apiBaseUrl = apiOrigin.endsWith("/api/v1")
  ? apiOrigin
  : `${apiOrigin}/api/v1`;
