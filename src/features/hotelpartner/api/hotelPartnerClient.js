import axios from "axios";

/**
 * Axios instance for the hotel-partner registration link — the app's FOURTH realm.
 *
 * Deliberately NOT `@shared/api/http`, and deliberately NOT wired to `createAuthRealm`:
 *
 *  - The visitor is a hotel owner with no CRM account. There is no token in localStorage to attach
 *    and no session to clear.
 *  - The shared realm's 401 handler calls `logout()` → clears `token` + `tenantModules` →
 *    `window.location.assign("/login")`. On this page that would throw a stranger at a staff login
 *    screen. `/public/themes/{code}` is the live example of that mistake (it rides the staff client),
 *    which is exactly why this file exists.
 *
 * Errors are therefore owned entirely by the page: nothing here toasts, redirects, or swallows.
 * `isAlreadyReported()` is always false for these, so the caller renders 100% of the error surface.
 */
const partnerClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8080/api",
  // Longer than the 30s shared default: this is a whole property record — rooms, rates, meal plans —
  // saved in one request, often from a phone on mobile data.
  timeout: 45000,
  headers: { "Content-Type": "application/json", Accept: "application/json" },
});

export default partnerClient;
