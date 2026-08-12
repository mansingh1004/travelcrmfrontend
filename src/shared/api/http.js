// src/shared/api/http.js
//
// The staff app's axios client. Attaches the JWT, and routes every failure through the shared
// error policy in authRealm.js.
//
// What changed and why:
//  • 401 used to redirect once per failing request. Six parallel requests meant six redirects racing
//    six localStorage clears. The realm latch collapses that into one.
//  • 403 and 500 were `console.error`-only — invisible to the user. They now toast.
//  • Every error hit an unconditional `console.error`, including in production. Gone; the interceptor
//    logs nothing the user isn't already being shown, and callers still get the rejection.
//  • `error.response?.data?.message || "Something went wrong."` is replaced by normalizeError(), which
//    also copes with the responses that carry no body at all (401 from the security entry point) and
//    with the ones that aren't JSON (a proxy's 502 HTML page).

import axios from "axios";
import { createAuthRealm, matchesAuthPath } from "./authRealm";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8080/api",
  // 30s, not 10s: CSV exports and server-rendered quotation PDFs routinely run past ten seconds,
  // and an axios timeout produces no `error.response` at all — so a slow export used to surface as
  // an indistinguishable "Something went wrong."
  timeout: 30000,
  headers: {
    // "Content-Type": "application/json",
    Accept: "application/json",
  },
});

/* ── REQUEST INTERCEPTOR ──────────────────────────────────────
   Attach JWT token to every request if available in localStorage
─────────────────────────────────────────────────────────────── */
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/* ── ERROR POLICY ─────────────────────────────────────────────
   Staff realm: "token" + "tenantModules", login at /login.
─────────────────────────────────────────────────────────────── */
const staffRealm = createAuthRealm({
  loginPath: "/login",
  // Login endpoints answer 401 for "wrong credentials". LoginService probes the superadmin endpoint
  // first and expects to catch that 401 before falling back to the user endpoint — redirecting here
  // would break the probe.
  isAuthUrl: (url) => matchesAuthPath(url),
  clearSession: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("tenantModules");
  },
  // Maintenance keeps its existing surface: a full-screen overlay, not a toast.
  // MaintenanceOverlay listens for this event and mirrors it in sessionStorage.
  onMaintenance: (message) => {
    sessionStorage.setItem("app:maintenance", message);
    window.dispatchEvent(new CustomEvent("app:maintenance", { detail: { message } }));
  },
});

/* ── RESPONSE INTERCEPTOR ─────────────────────────────────────
   Auth, transport, server and quota errors are handled here.
   Validation / not-found / conflict are passed through untouched
   for the call site to render inline.
─────────────────────────────────────────────────────────────── */
API.interceptors.response.use(
  (response) => response,
  (error) => {
    staffRealm.handleError(error);
    return Promise.reject(error);
  }
);

export default API;