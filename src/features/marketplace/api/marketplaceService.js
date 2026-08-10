// src/features/marketplace/api/marketplaceService.js
//
// The tenant's read-only window onto the Superadmin-owned hotel catalog, plus the writes it is
// allowed to make: importing a catalog hotel into its own Hotel Master, requesting a booking, and
// answering what the platform puts back to it (a revised price, or ending the request).
//
// Realm: staff. Uses the shared client (`@shared/api/http`) — never its own axios instance, so the
// JWT, the 30s timeout and the shared error policy all apply. Every id in a URL is the UUID
// `publicId`; the catalog never exposes an internal numeric id.
//
// Envelope handling: this client has no `unwrap` helper (that lives on consoleHttp), so each call
// peels `ApiResponse.data` itself. The paged search additionally returns the server's
// `pagination` block — note the rows live in `data`, NOT `content`.

import API from "@shared/api/http";
import { hydrateBlobError } from "@shared/lib/download";

const BASE = "/hotel-marketplace";

/**
 * The read-only half, DELIBERATELY not under `BASE`.
 *
 * `ModuleAccessFilter` hard-gates `/api/hotel-marketplace/**` on the HOTEL_MARKETPLACE add-on, and
 * `/api/me/**` is in its always-allowed set. A tenant whose subscription lapses must keep the voucher
 * for a stay that may be next week, so routing this through `BASE` would take a guest's document away
 * with the renewal (TenantHotelBookingHistoryController). Never move a write onto this prefix.
 */
const HISTORY_BASE = "/me/hotel-bookings";

/** `ApiResponse<T>` → `T`. Falls back to the raw body if a proxy ever answers without the envelope. */
const body = (res) => res?.data?.data ?? res?.data ?? null;

/**
 * Strips empty filters so they never reach the wire as `city=` — an empty string is a *value* to
 * a Spring `@RequestParam`, and would filter everything out instead of meaning "no filter".
 * `0` and `false` are deliberately kept (page 0 is a real page).
 */
function clean(params) {
  const out = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === "" || value === null || value === undefined) continue;
    out[key] = value;
  }
  return out;
}

export const marketplaceService = {
  /**
   * GET /hotel-marketplace/hotels — paged MarketplaceHotelSummaryDto.
   *
   * @returns {Promise<{items: Array, pagination: Object|null}>} `items` is always an array, so a
   *          call site never has to guard `.map` against a malformed body.
   */
  searchHotels: async (
    { page = 0, size = 12, sortBy, sortDir, q, city, countryCode, minStars } = {},
    config = {},
  ) => {
    const res = await API.get(`${BASE}/hotels`, {
      params: clean({ page, size, sortBy, sortDir, q, city, countryCode, minStars }),
      ...config,
    });
    const rows = res?.data?.data;
    return {
      items: Array.isArray(rows) ? rows : [],
      pagination: res?.data?.pagination ?? null,
    };
  },

  /**
   * POST /hotel-marketplace/hotels/import-all — BulkImportResultDto.
   *
   * Two modes: pass `publicIds` to import an explicit selection, or pass the current search filters
   * to import everything matching them.
   *
   * ALWAYS resolves 200, even when some hotels failed — this is a partial-success report, not a
   * pass/fail. A projection needs a real City in the tenant's own geography master, so importing a
   * large catalog legitimately succeeds for some and returns "add this city first" for the rest.
   * Call sites must render `failures` as a to-do list, and check `truncated` — the server caps each
   * call, and ignoring it reads as "finished" when it is not.
   */
  importAllHotels: async ({ publicIds, q, city, countryCode, minStars } = {}) =>
    body(await API.post(`${BASE}/hotels/import-all`,
      clean({ publicIds, q, city, countryCode, minStars }), { timeout: 120000 })),

  /** GET /hotel-marketplace/hotels/{publicId} — MarketplaceHotelDetailDto (rooms + meal plans, no prices). */
  getHotel: async (publicId, config = {}) =>
    body(await API.get(`${BASE}/hotels/${publicId}`, config)),

  /**
   * POST /hotel-marketplace/hotels/{publicId}/import — HotelImportResultDto.
   *
   * Idempotent: a second call returns `created:false` and re-syncs the existing tenant hotel.
   * Can legitimately reject with 409 and an *actionable* message ("Add a city named 'Goa' under
   * country 'IN' in your masters, then import again") — call sites must surface it verbatim.
   */
  importHotel: async (publicId) =>
    body(await API.post(`${BASE}/hotels/${publicId}/import`)),

  // ── Booking requests ────────────────────────────────────────────────────
  //
  // The verb is REQUEST, never confirm. Nothing reachable from here can put a booking into a
  // confirmed state — only a SuperAdmin approval does that, so the UI must never promise otherwise.

  /**
   * POST /hotel-marketplace/bookings — submit a request. Returns MarketplaceBookingTenantDto.
   *
   * `payload.idempotencyKey` is REQUIRED and must be stable across retries of the same intent:
   * the server has no other guard against a double-click minting two CRM bookings. Reuse the key
   * when retrying a failure; mint a new one only for a genuinely new request.
   *
   * Link-or-create: send `crmBookingPublicId` to attach to an existing trip, OR omit it and send
   * `customer` + `destination` + `tenantCustomerSellingAmount` to have one minted in the same
   * transaction. Sending neither is a 400.
   *
   * A 403 here is expected and actionable — it means the tenant's booking quota is full. The shared
   * interceptor toasts 403s, so call sites should not duplicate that, but should still offer the
   * remedy (upgrade, or link to an existing booking instead of creating one).
   */
  submitBooking: async (payload) =>
    body(await API.post(`${BASE}/bookings`, payload)),

  /**
   * GET /hotel-marketplace/bookings — the tenant's own requests, newest first.
   *
   * `status` is ONE MarketplaceBookingStatus name, or omitted for all — the server takes a single
   * value and treats an unknown or blank one as "all", so a caller must never send a comma list
   * expecting it to widen the result.
   *
   * @returns {Promise<{items: Array, pagination: Object|null}>} rows live in `data`, NOT `content`.
   */
  listMyBookings: async ({ page = 0, size = 20, status } = {}, config = {}) => {
    const res = await API.get(`${BASE}/bookings`, { params: clean({ page, size, status }), ...config });
    const rows = res?.data?.data;
    return {
      items: Array.isArray(rows) ? rows : [],
      pagination: res?.data?.pagination ?? null,
    };
  },

  /** GET /hotel-marketplace/bookings/{publicId} — one request. 404 for another tenant's id, never data. */
  getMyBooking: async (publicId, config = {}) =>
    body(await API.get(`${BASE}/bookings/${publicId}`, config)),

  // ── Answering a revised price ───────────────────────────────────────────
  //
  // Both answer a TENANT_APPROVAL_REQUIRED and both 409 when there is no open revision, or when the
  // offer has expired. The shared interceptor is SILENT on 409 by design, so a call site that does
  // not render the message shows the user a button that appears to do nothing.

  /**
   * POST /hotel-marketplace/bookings/{publicId}/accept-revision — commits to the revised payable.
   *
   * Idempotent on the server (an already-accepted row is returned unchanged), so a double-click is
   * not a second acceptance. Returns the updated MarketplaceBookingTenantDto — but re-read the row
   * afterwards rather than trusting it as the final state: an approval may land in between.
   */
  acceptRevision: async (publicId) =>
    body(await API.post(`${BASE}/bookings/${publicId}/accept-revision`)),

  /**
   * POST /hotel-marketplace/bookings/{publicId}/decline-revision — ends the request as REJECTED.
   *
   * `reason` is a QUERY param, not a body — sending it as JSON silently drops it.
   */
  declineRevision: async (publicId, reason) =>
    body(await API.post(`${BASE}/bookings/${publicId}/decline-revision`, null, {
      params: clean({ reason }),
    })),

  /**
   * POST /hotel-marketplace/bookings/{publicId}/cancel — withdraw, or ask to cancel.
   *
   * ONE endpoint for both: a CONFIRMED booking becomes CANCEL_REQUESTED (the platform has to settle
   * the charge with the hotel), anything earlier is withdrawn outright and free. **The server picks
   * which from the row's state** — only it knows whether a room is being held — so the UI must never
   * try to choose, only describe the outcome the current status implies.
   *
   * `reason` is a QUERY param, not a body.
   */
  cancelBooking: async (publicId, reason) =>
    body(await API.post(`${BASE}/bookings/${publicId}/cancel`, null, {
      params: clean({ reason }),
    })),

  /**
   * GET /me/hotel-bookings/{publicId}/voucher.pdf — the issued voucher as a Blob; pair with
   * `downloadBlob` from `@shared/lib/download`.
   *
   * Note the prefix: this is the un-gated history route, not `BASE` (see HISTORY_BASE).
   *
   * A failure on a blob request arrives as a Blob too, so the JSON ApiError is hydrated back into the
   * error here — otherwise the 404 the server answers until the platform issues the voucher reads at
   * the call site as a generic failure with no message.
   */
  downloadVoucher: async (publicId) => {
    try {
      const res = await API.get(`${HISTORY_BASE}/${publicId}/voucher.pdf`, { responseType: "blob" });
      return res?.data ?? null;
    } catch (e) {
      throw await hydrateBlobError(e);
    }
  },
};

export default marketplaceService;
