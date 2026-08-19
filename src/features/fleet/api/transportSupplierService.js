// src/features/fleet/api/transportSupplierService.js
//
// The SUPPLY side of the Transport Marketplace: an operator's own platform listings, and the orders
// the platform has committed to them.
//
// It lives in `fleet/` on purpose. The operator is an ordinary tenant on the Vehicle Diary plan —
// not a separate realm — and fulfilling a platform order means naming one of THEIR OWN FleetVehicles
// and FleetDrivers. The job and the fleet that does it belong on the same screen family.
//
// Realm: staff, shared client, same JWT. Gated on the TRANSPORT_SUPPLIER module (a different key
// from the buying side's TRANSPORT_MARKETPLACE — an agency and an operator are different customers).
//
// ⚠ There is NO money on this surface, by design. `SupplierOrderDto` carries no payable, no supplier
// amount and no platform earning: an operator is told the job, and settlement happens outside the
// order. Do not add a money field here without the same decision being made server-side first.

import API from "@shared/api/http";

const LISTINGS = "/transport-supplier/listings";
const ORDERS = "/transport-supplier/orders";

const body = (res) => res?.data?.data ?? res?.data ?? null;
const paged = (res) => ({
  rows: res?.data?.data ?? [],
  pagination: res?.data?.pagination ?? null,
});

function clean(params) {
  const out = {};
  for (const [k, v] of Object.entries(params || {})) {
    if (v === "" || v === null || v === undefined) continue;
    out[k] = v;
  }
  return out;
}

export const transportSupplierService = {
  // ── My listings ─────────────────────────────────────────────────────────

  /**
   * The operator's own catalog rows.
   *
   * `editable` on each row is the server's answer, not a guess: once the platform has published a
   * listing, or an order exists against it, parts of it stop being the operator's to change. Respect
   * the flag rather than re-deriving it from `status`.
   */
  listListings: async (params = {}) => paged(await API.get(LISTINGS, { params: clean(params) })),

  getListing: async (publicId) => body(await API.get(`${LISTINGS}/${publicId}`)),

  /**
   * Creating never publishes. A listing lands as a DRAFT and a SuperAdmin still presses Publish —
   * so an operator can prepare their fleet without anything becoming sellable by accident.
   */
  createListing: async (payload) => body(await API.post(LISTINGS, payload)),

  updateListing: async (publicId, payload) => body(await API.put(`${LISTINGS}/${publicId}`, payload)),

  deleteListing: async (publicId) => body(await API.delete(`${LISTINGS}/${publicId}`)),

  // ── Orders the platform has sent me ──────────────────────────────────────

  /** Sorted by pickup ascending by default — the next job first, which is what an operator opens for. */
  listOrders: async ({ page = 0, size = 25, sortBy = "pickupAt", sortDir = "asc" } = {}) =>
    paged(await API.get(ORDERS, { params: clean({ page, size, sortBy, sortDir }) })),

  getOrder: async (publicId) => body(await API.get(`${ORDERS}/${publicId}`)),

  /**
   * Name the vehicle and driver for a leg.
   *
   * Pass `fleetVehiclePublicId` / `fleetDriverPublicId` where possible rather than typing a
   * registration: that is what lets the trip land in this operator's own Vehicle Diary with real
   * rows behind it instead of loose strings.
   *
   * Versioned server-side — a later change reissues the duty slip and moves no money.
   */
  assign: async (publicId, payload) => body(await API.post(`${ORDERS}/${publicId}/assignments`, payload)),
};

export default transportSupplierService;
