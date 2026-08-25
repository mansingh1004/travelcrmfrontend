// src/features/marketplace/api/transportMarketplaceService.js
//
// The tenant's window onto the SuperAdmin-owned platform TRANSPORT catalog, and the orders it
// places against it. Sibling of `marketplaceService` (hotels); same realm, same conventions, same
// envelope handling — a different platform module behind it.
//
// Realm: staff. Uses the shared client (`@shared/api/http`) — never its own axios instance, so the
// JWT, the 30s timeout and the shared error policy all apply. Every id in a URL is the UUID
// `publicId`; the catalog never exposes an internal numeric id.

import API from "@shared/api/http";
import { hydrateBlobError } from "@shared/lib/download";

/**
 * The gated half. `ModuleAccessFilter` hard-gates `/api/transport-marketplace/**` on the
 * TRANSPORT_MARKETPLACE add-on, so everything that could SELL lives here.
 */
const BASE = "/transport-marketplace";

/**
 * The read-only half, DELIBERATELY not under `BASE`.
 *
 * `/api/me/**` is in the filter's always-allowed set. A confirmed journey may be next week, and the
 * passenger is travelling whether or not the agency renewed this month — so reading an order and
 * downloading its duty slip must outlive the add-on. Mirrors `TenantTransportOrderController`.
 *
 * **Never move a write onto this prefix.** The split IS the entitlement boundary: a write here
 * silently sells to a suspended tenant.
 */
const HISTORY_BASE = "/me/transport-orders";

/** `ApiResponse<T>` → `T`. Falls back to the raw body if a proxy ever answers without the envelope. */
const body = (res) => res?.data?.data ?? res?.data ?? null;

/**
 * The whole paged answer, not just the rows.
 *
 * `PagedApiResponse` puts the rows in `data` (NOT `content`) and the meta in `pagination`. Call
 * sites need the total to render a pager, so both come back together.
 */
const paged = (res) => ({
  rows: res?.data?.data ?? [],
  pagination: res?.data?.pagination ?? null,
});

/**
 * Strips empty filters so they never reach the wire as `q=` — an empty string is a *value* to a
 * Spring `@RequestParam`, not an absence. `0` and `false` are kept deliberately (page 0 is a page).
 */
function clean(params) {
  const out = {};
  for (const [key, value] of Object.entries(params || {})) {
    if (value === "" || value === null || value === undefined) continue;
    out[key] = value;
  }
  return out;
}

export const transportMarketplaceService = {
  // ── Catalog (gated: browsing is the first step of selling) ───────────────

  /**
   * GET /transport-marketplace/vehicles — paged `MarketplaceVehicleSummaryDto`.
   *
   * `onRequest` on every row is still the honest state of v1: a listed vehicle is an enquiry, not
   * held inventory, and only a SuperAdmin decision confirms one.
   *
   * Each row now also carries `fromPrice` / `fromPriceCurrency` / `fromPriceRateModel` — an
   * INDICATIVE payable for ONE unit of that rate model (one transfer, one day, one kilometre…), so
   * the unit must be rendered from the enum or the number means nothing. `fromPrice` is `null` for a
   * vehicle the engine cannot price yet, and null means "quoted on request" — **never zero**.
   */
  searchVehicles: async ({ page = 0, size = 25, sortBy = "name", sortDir = "asc", q } = {}) =>
    paged(await API.get(`${BASE}/vehicles`, { params: clean({ page, size, sortBy, sortDir, q }) })),

  /** GET /transport-marketplace/vehicles/{publicId} — `MarketplaceVehicleDetailDto`, same price fields. */
  getVehicle: async (publicId) => body(await API.get(`${BASE}/vehicles/${publicId}`)),

  /**
   * POST /transport-marketplace/vehicles/{publicId}/import — projects the catalog product into
   * this tenant's own Vehicle Master.
   *
   * Idempotent by catalog version: a second call re-syncs the existing projection rather than
   * creating a second one. Can legitimately reject with 409 carrying an ACTIONABLE message (the
   * city the vehicle reports from does not exist in the tenant's masters, and — unlike hotels —
   * transport deliberately does NOT invent it). Surface that message verbatim.
   */
  importVehicle: async (publicId) => body(await API.post(`${BASE}/vehicles/${publicId}/import`)),

  // ── Pricing ─────────────────────────────────────────────────────────────

  /**
   * POST /transport-marketplace/quote — `TransportIndicativePriceDto` for one specific journey.
   *
   * The answer to "what will this cost me?" while the agent is still on the phone. Until it existed
   * the payable first appeared at SuperAdmin approval, hours later, so a tenant either quoted their
   * own customer from a guess or made them wait.
   *
   * <b>Always answers 200 — never treat it as a failure.</b> When the engine cannot price the
   * journey (no rate card for that service type, no rule, a rate model the inputs do not describe)
   * it still returns 200 with `tenantPayable` ABSENT and `note` explaining it is quoted on request.
   * That is a legitimate state of an ON_REQUEST marketplace, not an error, so it must not toast and
   * must never render as ₹0 — a zero is a number a tenant could quote and then be held to.
   *
   * <b>There is exactly one money field.</b> `tenantPayable` is what the TENANT pays. The operator's
   * net and the platform's earning are not on this response and cannot be recovered from it — the
   * backend has an ArchUnit test keeping it that way. Do not compute a "you save ₹X" line from it.
   *
   * Send whichever of `days` / `hours` / `km` the journey actually describes; the server reads the
   * ones its rate model needs and ignores the rest, so the caller does not have to know the model.
   * `serviceDate` matters because a commercial rule carries `validFrom`/`validTo` — the same journey
   * next quarter can price differently.
   */
  quoteVehicle: async ({ platformVehiclePublicId, platformRatePublicId, serviceType, serviceDate,
                         vehicleCount = 1, days = 1, hours = 0, km = 0 } = {}, config = {}) =>
    body(await API.post(`${BASE}/quote`, clean({
      platformVehiclePublicId, platformRatePublicId, serviceType, serviceDate,
      vehicleCount, days, hours, km,
    }), config)),

  // ── Placing and answering an order (gated: these commit) ─────────────────

  /**
   * POST /transport-marketplace/orders — submit a request.
   *
   * A REQUEST, never a confirmation: the tenant cannot self-confirm, and the platform team approves.
   * Pass `idempotencyKey` (one per form mount, not per click) so a double-submit or a retry after a
   * dropped response replays the same order instead of creating a second journey.
   */
  submitOrder: async (payload) => body(await API.post(`${BASE}/orders`, payload)),

  /**
   * Accepting a revision is consent to an AMOUNT, not a confirmation — the order goes back to the
   * platform for a final approval which then refuses to confirm at any other figure. Say that in
   * the UI, or an agent reads "accept" as "booked".
   */
  acceptRevision: async (publicId) => body(await API.post(`${BASE}/orders/${publicId}/accept-revision`)),
  declineRevision: async (publicId, reason) =>
    body(await API.post(`${BASE}/orders/${publicId}/decline-revision`, null, { params: clean({ reason }) })),

  /** Withdraw a request the platform has not yet committed to. */
  withdrawOrder: async (publicId, reason) =>
    body(await API.post(`${BASE}/orders/${publicId}/withdraw`, null, { params: clean({ reason }) })),

  /** Ask to cancel a CONFIRMED journey. The platform quotes a charge; it is not cancelled yet. */
  requestCancellation: async (publicId, reason) =>
    body(await API.post(`${BASE}/orders/${publicId}/cancel`, null, { params: clean({ reason }) })),

  acceptCancellationQuote: async (publicId) =>
    body(await API.post(`${BASE}/orders/${publicId}/accept-cancellation`)),
  declineCancellationQuote: async (publicId) =>
    body(await API.post(`${BASE}/orders/${publicId}/decline-cancellation`)),

  // ── Reading them back (ungated — survives a lapsed add-on) ───────────────

  /** GET /me/transport-orders — paged `TransportOrderTenantDto`. */
  listOrders: async ({ page = 0, size = 25, sortBy = "createdAt", sortDir = "desc", status } = {}) =>
    paged(await API.get(HISTORY_BASE, { params: clean({ page, size, sortBy, sortDir, status }) })),

  /** GET /me/transport-orders/{publicId} — one `TransportOrderTenantDto`, 404 if it is not ours. */
  getOrder: async (publicId) => body(await API.get(`${HISTORY_BASE}/${publicId}`)),

  /**
   * GET /me/transport-orders/{publicId}/voucher.pdf — the duty slip, as a Blob.
   *
   * The path ends `.pdf` but the bytes may be an IMAGE: when the operator uploaded their own slip,
   * the server sends that file with its real content type. Read `blob.type` rather than assuming
   * `application/pdf`, or the preview breaks on exactly the documents drivers actually carry.
   *
   * A blob response makes an error body a Blob too, which is unreadable at the call site;
   * `hydrateBlobError` turns it back into the normal shape so the shared error policy still works.
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

export default transportMarketplaceService;
