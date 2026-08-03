// src/features/marketplace/api/marketplaceService.js
//
// The tenant's read-only window onto the Superadmin-owned hotel catalog, plus the one write it is
// allowed to make: importing a catalog hotel into its own Hotel Master.
//
// Realm: staff. Uses the shared client (`@shared/api/http`) — never its own axios instance, so the
// JWT, the 30s timeout and the shared error policy all apply. Every id in a URL is the UUID
// `publicId`; the catalog never exposes an internal numeric id.
//
// Envelope handling: this client has no `unwrap` helper (that lives on consoleHttp), so each call
// peels `ApiResponse.data` itself. The paged search additionally returns the server's
// `pagination` block — note the rows live in `data`, NOT `content`.

import API from "@shared/api/http";

const BASE = "/hotel-marketplace";

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
   * @returns {Promise<{items: Array, pagination: Object|null}>} rows live in `data`, NOT `content`.
   */
  listMyBookings: async ({ page = 0, size = 20 } = {}, config = {}) => {
    const res = await API.get(`${BASE}/bookings`, { params: clean({ page, size }), ...config });
    const rows = res?.data?.data;
    return {
      items: Array.isArray(rows) ? rows : [],
      pagination: res?.data?.pagination ?? null,
    };
  },

  /** GET /hotel-marketplace/bookings/{publicId} — one request. 404 for another tenant's id, never data. */
  getMyBooking: async (publicId, config = {}) =>
    body(await API.get(`${BASE}/bookings/${publicId}`, config)),
};

export default marketplaceService;
