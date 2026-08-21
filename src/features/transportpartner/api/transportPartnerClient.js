import axios from "axios";

/**
 * Axios instance for the transport-partner registration link — a public, token-only realm.
 *
 * Deliberately NOT `@shared/api/http`, and deliberately NOT wired to `createAuthRealm`, for the same
 * reasons its hotel-partner twin isn't:
 *
 *  - The visitor is a coach or cab operator with no CRM account. There is no token in localStorage
 *    to attach and no session to clear.
 *  - The shared realm's 401 handler calls `logout()` → clears `token` + `tenantModules` →
 *    `window.location.assign("/login")`. On this page that would throw a stranger at a staff login
 *    screen. `/public/themes/{code}` is the live example of that mistake (it rides the staff client),
 *    which is exactly why this file exists.
 *
 * One thing is true here that is not true of the hotel client: this realm is genuinely rate limited
 * on the server (`RateLimitFilter` matches `/api/transport-partner/` and caps one address at 240
 * requests a minute). That ceiling is set for the autosave, so the page must keep saves debounced
 * and serialised rather than retrying in a loop — a client that hammers this endpoint locks the
 * operator out of their own form for a minute.
 *
 * Errors are owned entirely by the page: nothing here toasts, redirects, or swallows.
 * `isAlreadyReported()` is always false for these, so the caller renders 100% of the error surface.
 */
const partnerClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8080/api",
  // Longer than the 30s shared default, and for a bigger document than the hotel form's: a whole
  // fleet — every vehicle, every rate card on every vehicle — is saved in one request, often from a
  // phone on mobile data. A twenty-vehicle operator is a normal case, not an outlier.
  timeout: 45000,
  headers: { "Content-Type": "application/json", Accept: "application/json" },
});

export default partnerClient;
