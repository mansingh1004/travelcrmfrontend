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

/**
 * The tenant's own credit position. Also under `/api/me` rather than `BASE`, for the same reason
 * as HISTORY_BASE: what a tenant OWES must not disappear when the add-on lapses.
 */
const CREDIT_BASE = "/me/marketplace-credit";

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
    // A multi-select filter arrives as an array. An EMPTY one is "no filter" and must not reach the
    // wire at all — `stars=` is a value to a Spring @RequestParam, not an absence, and would bind to
    // an empty Set that matches nothing.
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      // Comma-joined, NOT axios's default `stars[]=4&stars[]=5`. Spring binds `stars=4,5` straight
      // into a `Set<Integer>` through its standard conversion service; the bracketed form binds to a
      // parameter literally named "stars[]" and the filter silently does nothing. Silently, because
      // an unbound optional @RequestParam is null, which means "no filter" — so the grid looks fine
      // and simply ignores what the agent ticked.
      out[key] = value.join(",");
      continue;
    }
    out[key] = value;
  }
  return out;
}

export const marketplaceService = {
  /**
   * GET /hotel-marketplace/hotels — paged MarketplaceHotelSummaryDto.
   *
   * @param {string} [stayDate] `YYYY-MM-DD`. Affects the `fromPricePerNight` on each row ONLY — a
   *        commercial rule's validity window is matched against the stay, so a December search
   *        priced at November's markup would be wrong. It is **not** an availability filter: this
   *        release holds no allotment, so no date narrows the result set.
   *
   * @returns {Promise<{items: Array, pagination: Object|null}>} `items` is always an array, so a
   *          call site never has to guard `.map` against a malformed body.
   */
  searchHotels: async (
    {
      page = 0, size = 12, sortBy, sortDir, q, city, countryCode, minStars, stayDate,
      stars, propertyTypes, mealPlans, amenities, refundableOnly, minPrice, maxPrice,
    } = {},
    config = {},
  ) => {
    const res = await API.get(`${BASE}/hotels`, {
      params: clean({
        page, size, sortBy, sortDir, q, city, countryCode, minStars, stayDate,
        stars, propertyTypes, mealPlans, amenities,
        // `false` is a real value to `clean`, so an unticked box would reach the wire as
        // `refundableOnly=false`. Harmless — Spring binds it to the same default — but it puts a
        // filter in the URL that is not filtering, which makes a shared link read as narrower than
        // it is. Only send it when it is on.
        refundableOnly: refundableOnly ? true : undefined,
        minPrice, maxPrice,
      }),
      ...config,
    });
    const rows = res?.data?.data;
    return {
      items: Array.isArray(rows) ? rows : [],
      pagination: res?.data?.pagination ?? null,
    };
  },

  /**
   * GET /hotel-marketplace/filters — CatalogFacetsDto.
   *
   * What the catalog can actually be narrowed by, read off the live catalog rather than off the
   * enums. Offering every constant would put "Houseboat" in the rail over a catalog holding none —
   * the agent ticks it, gets an empty grid, and concludes the search is broken. A filter option that
   * cannot return a result is worse than a missing one.
   *
   * Fetched once per screen, not per search: the answer moves when an operator edits the catalog,
   * not when the agent types.
   */
  getFilters: async (config = {}) => body(await API.get(`${BASE}/filters`, config)),

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
  importAllHotels: async ({
    publicIds, q, city, countryCode, minStars,
    stars, propertyTypes, mealPlans, amenities, refundableOnly, minPrice, maxPrice,
  } = {}) =>
    body(await API.post(`${BASE}/hotels/import-all`,
      // A JSON BODY, not query params — so the arrays stay arrays here rather than being comma-joined
      // the way `clean` does for the query string. `BulkImportRequest` binds them as `Set<...>`
      // directly. `clean` is still the right filter for empty values; it only rewrites arrays it puts
      // on a URL, and these never touch one.
      { ...clean({ q, city, countryCode, minStars, minPrice, maxPrice }),
        publicIds, stars, propertyTypes, mealPlans, amenities, refundableOnly },
      { timeout: 120000 })),

  /**
   * GET /hotel-marketplace/hotels/{publicId} — MarketplaceHotelDetailDto.
   *
   * Each room now carries `indicativePayablePerNight`. That is a TENANT PAYABLE — the catalog rate
   * already put through the platform's commercial rule — and the hotel's net rate is not on this
   * response and cannot be derived from it.
   *
   * @param {string} [stayDate] `YYYY-MM-DD`, same meaning as on `searchHotels`.
   */
  getHotel: async (publicId, stayDate, config = {}) =>
    body(await API.get(`${BASE}/hotels/${publicId}`, { params: clean({ stayDate }), ...config })),

  /**
   * GET /hotel-marketplace/hotels/{publicId}/reviews — PlaceReviewDto.
   *
   * DELIBERATELY a second request rather than another field on the detail response. The data is
   * Google's, fetched over a network the platform does not control, and folding it into the detail
   * call would put a third party in the critical path of the page that sells the hotel: one slow
   * Google round-trip and the photos, the rooms and the price all wait behind a review carousel
   * nobody opened the page for.
   *
   * `status: "UNAVAILABLE"` is a NORMAL answer, not a failure — a hotel with no `googlePlaceId`, an
   * exhausted quota and an upstream timeout all land there. Call sites must then render nothing at
   * all: an empty "Guest reviews" heading tells the reader the hotel has no reviews, which is a
   * different and probably false claim.
   */
  getHotelReviews: async (publicId, config = {}) =>
    body(await API.get(`${BASE}/hotels/${publicId}/reviews`, config)),

  // ── Pricing ─────────────────────────────────────────────────────────────

  /**
   * POST /hotel-marketplace/quote — IndicativePriceDto for one specific stay.
   *
   * The answer to "what will this cost me?" BEFORE the tenant fills in guest details. Until this
   * existed the payable first appeared at SuperAdmin approval, hours later, so a tenant could not
   * quote their own customer without guessing.
   *
   * **Indicative, and the UI must say so.** This release is ON_REQUEST — no rate calendar, no
   * allotment — so the platform is not bound by it; the SuperAdmin confirms the real amount with
   * the property, and any change still goes through the revision round-trip the tenant must accept.
   * The response carries `note` with that sentence already written, so render it rather than
   * inventing per-screen wording.
   *
   * `available:false` means the hotel has no rate card — a normal state for a newly onboarded
   * property. Render "Price on request"; **never render it as zero**, which a tenant could quote.
   */
  quote: async ({ hotelPublicId, roomPublicId, mealPlanPublicId, checkIn, checkOut,
                  rooms = 1, adults = 2, children = 0 } = {}, config = {}) =>
    body(await API.post(`${BASE}/quote`, clean({
      hotelPublicId, roomPublicId, mealPlanPublicId, checkIn, checkOut, rooms, adults, children,
    }), config)),

  // ── Nominating a hotel for the catalog ──────────────────────────────────

  /**
   * POST /hotel-marketplace/nominations — "we work with this hotel, put it on the platform".
   *
   * Pass `sourceHotelPublicId` (one of the tenant's OWN hotel-master rows) and the server copies
   * name, city, country and address off it — so suggesting a hotel they already work with is one
   * click plus an email address. `contactEmail` is required either way: accepting the nomination
   * sends the property a partner invitation, and there is nowhere to send it otherwise.
   *
   * Re-submitting a hotel that already has an OPEN nomination returns the existing one rather than
   * erroring, so a double-click is not a duplicate.
   */
  submitNomination: async (payload) =>
    body(await API.post(`${BASE}/nominations`, payload)),

  /** GET /hotel-marketplace/nominations — this tenant's own suggestions, newest first. */
  listNominations: async ({ page = 0, size = 25 } = {}, config = {}) => {
    const res = await API.get(`${BASE}/nominations`, { params: clean({ page, size }), ...config });
    const rows = res?.data?.data;
    return {
      items: Array.isArray(rows) ? rows : [],
      pagination: res?.data?.pagination ?? null,
    };
  },

  /**
   * POST /hotel-marketplace/nominations/{publicId}/withdraw — pull a suggestion.
   *
   * Only while it is still open; a decided one 409s. `reason` is a QUERY param, not a body.
   */
  withdrawNomination: async (publicId, reason) =>
    body(await API.post(`${BASE}/nominations/${publicId}/withdraw`, null, {
      params: clean({ reason }),
    })),

  // ── What this tenant owes the platform ──────────────────────────────────

  /**
   * GET /me/marketplace-credit — TenantCreditDto.
   *
   * Under `/api/me`, NOT `BASE`, and for the same reason the voucher is: a debt has to stay
   * readable after the add-on lapses. Hiding what a tenant owes behind the subscription that
   * lapsed would be the worst possible moment to hide it.
   *
   * `enforced:false` means no ceiling is being applied to this tenant — render the balance, but do
   * not present a limit as though it were binding.
   */
  myCredit: async (config = {}) =>
    body(await API.get(CREDIT_BASE, config)),

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
