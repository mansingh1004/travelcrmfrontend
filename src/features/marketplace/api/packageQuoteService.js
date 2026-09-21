// src/features/marketplace/api/packageQuoteService.js
//
// The package quotation WEBLINK — a separate document from the CRM quotation, and a separate
// service from `packageMarketplaceService`.
//
// Why separate at all: `packageMarketplaceService.toQuotation` flattens a package into the six
// priced sections of a normal quotation, which is the right thing when the agent wants to keep
// editing it in the builder. This one composes the package as it actually is — gallery, day plan
// with photos, hotels per stop, the full rate card, and every tier side by side — and hands back a
// link the customer can open. Neither replaces the other.
//
// Realm: staff. Uses the shared client (`@shared/api/http`) for the authenticated half, so the JWT,
// the 30s timeout and the shared error policy all apply. The PUBLIC read deliberately does not —
// see `getPublic` below.

import API from "@shared/api/http";

const BASE = "/package-marketplace/quotes";

/** `ApiResponse<T>` → `T`. Falls back to the raw body if a proxy ever answers without the envelope. */
const body = (res) => res?.data?.data ?? res?.data ?? null;

/** Paged reads answer `{items, pagination}`; `items` is always an array so no call site guards `.map`. */
const paged = (res) => ({
  items: res?.data?.data ?? [],
  pagination: res?.data?.pagination ?? null,
});

/** Strips empty values. `0` and `false` are kept — page 0 is a real page. */
function clean(params) {
  const out = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === "" || value === null || value === undefined) continue;
    out[key] = value;
  }
  return out;
}

/**
 * The absolute link to hand a customer.
 *
 * Built from the browser's own origin rather than from the server's `shareUrl`. The server can only
 * guess the SPA origin from `app.web-base-url`, and a deploy that forgets it produces a localhost
 * link that looks fine in the UI and 404s for the customer — exactly the failure `VITE_API_URL`
 * already produces elsewhere in this app. The page we are standing on knows its own origin for
 * certain.
 */
export function packageQuoteLink(quote) {
  if (!quote) return "";
  const path = quote.sharePath || `/pq/${quote.publicId}`;
  if (typeof window === "undefined") return quote.shareUrl || path;
  return `${window.location.origin}${path}`;
}

export const packageQuoteService = {
  /**
   * POST /package-marketplace/quotes/from-package/{packagePublicId}
   *
   * Everything in the payload is optional. No lead, no travel date, no occupancy and no markup are
   * all ordinary — the agent is on a call and wants a link now. A blank field is a section the page
   * does not render, never a validation error.
   *
   * `mode: "COMPARISON"` puts every active tier side by side; omit `compareVariantPublicIds` to
   * publish all of them, which is what "send them the options" means.
   */
  create: async (packagePublicId, payload) =>
    body(await API.post(`${BASE}/from-package/${packagePublicId}`, payload)),

  /** GET the agency's quotations. Rows carry no document — fetch one to preview it. */
  list: async (params = {}) => paged(await API.get(BASE, { params: clean(params) })),

  /** GET one, WITH its full document. */
  get: async (publicId) => body(await API.get(`${BASE}/${publicId}`)),

  /** SENT / ACCEPTED / DECLINED. EXPIRED is refused — it comes from the validity date. */
  setStatus: async (publicId, status) =>
    body(await API.patch(`${BASE}/${publicId}/status`, null, { params: { status } })),

  /** Withdraw it. The weblink stops resolving immediately. */
  remove: async (publicId) => body(await API.delete(`${BASE}/${publicId}`)),
};

// ── The public read ────────────────────────────────────────────────────────────────────────────
//
// Plain `fetch`, not the shared client, and that is deliberate on three counts:
//
//  1. The reader is a customer with no account. `http.js` attaches a JWT if one happens to be in
//     localStorage — which on an agent's own machine it is — and the endpoint is permitAll, so the
//     header is at best noise and at worst confusing in the access log.
//  2. The shared interceptor redirects to /login on a 401 and toasts on a 403. Neither is a thing
//     to do to somebody reading a quotation they were sent.
//  3. `fetch` does not reject on 4xx, so the status is checked explicitly below — the same idiom
//     `notificationService` uses.

const PUBLIC_API = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

/**
 * GET /public/package-quotes/{publicId} — no auth, by design.
 *
 * Throws a message fit to render. A withdrawn or unknown link is a 404 and reads as "not valid";
 * an EXPIRED quote is NOT an error — it comes back with `expired: true` and the page shows a banner,
 * because a customer opening a lapsed link should be told to call, not that the page never existed.
 *
 * Errors raised here carry `friendly = true`. The page prints `e.message` ONLY when that flag is
 * set, because everything else that can reject out of this function — a dropped connection, a
 * malformed body — rejects with the browser's own wording, and "Failed to fetch" is not something
 * to show a customer on a quotation.
 */
export async function getPublicPackageQuote(publicId) {
  const res = await fetch(`${PUBLIC_API}/public/package-quotes/${publicId}`);
  if (!res.ok) {
    console.warn("[packageQuote] public read failed", res.status);
    const err = new Error(
      res.status === 404
        ? "This quotation link is not valid, or has been withdrawn."
        : "Could not open this quotation. Please try again."
    );
    err.friendly = true;
    throw err;
  }
  const json = await res.json();
  return json?.data ?? json;
}
