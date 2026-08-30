import axios from "axios";
import { apiBaseUrl } from "./api-base.js";

const baseURL = import.meta.env.VITE_API_URL?.trim() || apiBaseUrl;

export const axiosClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken") || localStorage.getItem("a1_mongo_access_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("a1_mongo_access_token");
      localStorage.removeItem("user");
      localStorage.removeItem("a1_admin_auth_email");
    }

    return Promise.reject(error);
  },
);

// ── AGGRESSIVE CACHE NUKE: Wipe ALL stale business data from localStorage ──
try {
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("a1_db_cache_")) keysToRemove.push(key);
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
} catch {}

const transientStatuses = new Set([401, 500, 502, 503, 504]);

const sessionToken = async (_refresh = false) => {
  try {
    const token = localStorage.getItem("accessToken") || localStorage.getItem("a1_mongo_access_token");
    if (token) return token;
  } catch {}

  try {
    const email = localStorage.getItem("a1_admin_auth_email");
    if (email) return `local-admin-token:${email}`;
  } catch {}
  return "local-admin-token";
};

export async function api(
  path,
  options = {},
) {
  let token = await sessionToken();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        ...options,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
      });

      const body = await response.json().catch(() => ({
        success: false,
        message: `Request failed with status ${response.status}`,
        data: null,
      }));

      if (response.ok) {
        if (body.data !== undefined && body.data !== null) {
          return body.data;
        }
        return body;
      }

      if (response.status === 403) {
        throw new Error(body.message || "Access denied: You do not have permission to access this resource");
      }

      if (attempt === 0 && transientStatuses.has(response.status)) {
        if (response.status === 401) token = await sessionToken(true);
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
        continue;
      }

      if (options.method && options.method !== "GET") {
        throw new Error(body.message || body.error || `Request failed with status ${response.status}`);
      }

      return [];
    } catch (err) {
      if (options.method && options.method !== "GET") {
        throw err;
      }
      if (err.message && err.message.includes("Access denied")) {
        throw err;
      }
      return [];
    }
  }

  return [];
}
