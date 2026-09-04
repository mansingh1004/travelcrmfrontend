// src/features/marketplace/api/packageSubmissionClient.js
//
// The public package-submission link. NO REALM, no credential, no interceptor.
//
// This deliberately does NOT use `@shared/api/http`, and that is not a style choice:
//
//  - That client attaches the staff JWT. Sending a logged-in agent's token to a public endpoint is
//    pointless at best and, on a shared machine, leaks it to a surface that has no business seeing
//    one.
//  - Its interceptor treats 401 as "log out and redirect to /login". A stranger following this link
//    has no session to lose and no /login to be sent to, and a stale `token` in localStorage would
//    be cleared out from under whoever owns the browser.
//
// It also does not create a fourth `axios.create`, because the three-clients-one-per-realm rule is
// worth keeping. `fetch` is the honest primitive for a surface with no realm at all, and
// `notificationService` already establishes it in this codebase.
//
// `fetch` DOES NOT REJECT ON 4xx/5xx — every call below checks `res.ok` itself and throws a message
// a stranger can act on. Forgetting that check is how a failed save renders as a successful one.

const BASE = "/api/package-submission";

/** `ApiResponse<T>` → `T`, with the server's own message surfaced on failure. */
async function call(path, { method = "GET", body, isForm } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: isForm || body === undefined ? undefined : { "Content-Type": "application/json" },
      body: isForm ? body : body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // A network failure, not an HTTP one — fetch only rejects for these.
    throw new Error("Could not reach the server. Check your connection and try again.");
  }

  let payload = null;
  try { payload = await res.json(); } catch { /* a 204 or an HTML error page */ }

  if (!res.ok) {
    // The server's message is written for this audience — an expired link, a photo cap, a missing
    // contact — so prefer it over anything invented here.
    throw new Error(payload?.message || `That did not work (${res.status}).`);
  }
  return payload?.data ?? payload ?? null;
}

export const packageSubmissionClient = {
  /**
   * Mint a link. Returns the raw token — the ONLY time it exists outside the browser's URL, so the
   * caller must put it in the address bar immediately or it is lost.
   */
  start: () => call("/start", { method: "POST" }).then((d) => d?.token),

  /** Load a link. Also how the form recovers after a reload. */
  resolve: (token) => call(`/${token}`),

  saveDetails: (token, payload) => call(`/${token}/details`, { method: "PUT", body: payload }),
  saveSubmitter: (token, payload) => call(`/${token}/submitter`, { method: "PUT", body: payload }),
  saveItinerary: (token, payload) => call(`/${token}/itinerary`, { method: "PUT", body: payload }),
  saveRates: (token, slabs) => call(`/${token}/rates`, { method: "PUT", body: { slabs } }),

  /**
   * The package's levels — Basic / Deluxe / Super Deluxe — with their hotels and their own rates.
   *
   * <p>The endpoint shipped with tiers and nothing called it, so a package submitted through the
   * public link could never carry the one thing that makes a listing sell against its neighbours.
   * Same wire shape as the tenant editor's, so both authoring surfaces produce identical
   * packages.</p>
   */
  saveVariants: (token, variants) => call(`/${token}/variants`, { method: "PUT", body: { variants } }),

  addPhoto: (token, file) => {
    const fd = new FormData();
    fd.append("file", file);
    return call(`/${token}/photos`, { method: "POST", body: fd, isForm: true });
  },

  /**
   * Upload a photo and get its URL back, attached to nothing.
   *
   * <p>For pictures that live INSIDE a payload still being edited — a day's photos, a tier hotel's
   * room shots. `addPhoto` cannot serve those: it attaches to the package gallery, and these have
   * to travel with the itinerary or the tiers when those save.</p>
   *
   * <p>Returns the URL string, not the session.</p>
   */
  uploadPhoto: (token, file) => {
    const fd = new FormData();
    fd.append("file", file);
    return call(`/${token}/upload`, { method: "POST", body: fd, isForm: true })
      .then((d) => d?.imagePath);
  },

  removePhoto: (token, imagePublicId) =>
    call(`/${token}/photos/${imagePublicId}`, { method: "DELETE" }),

  /** Hand it over. After this the link is read-only. */
  submit: (token) => call(`/${token}/submit`, { method: "POST" }),
};

export default packageSubmissionClient;
