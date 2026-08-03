// src/console/api/marketplaceBookingService.js
//
// The SuperAdmin queue for tenant hotel booking requests. Platform realm: ConsoleAPI carries
// `sa_token`, so a 401 bounces to the CONSOLE login and never the tenant one.
//
// Approve and reject both require a step-up MFA code. They are not merely administrative: approving
// commits the platform to a supplier and puts a payable on a tenant's books, and rejecting kills a
// request a tenant may have already quoted to their customer.

import ConsoleAPI, { unwrap } from "./consoleHttp";
import { SUPERADMIN_MFA_HEADER } from "./userService";

const BASE = "/super-admin/marketplace/bookings";

const stepUpHeaders = (mfaCode) => ({
  headers: { [SUPERADMIN_MFA_HEADER]: mfaCode },
});

/** Drop empty filters — an empty string is a *value* to a Spring `@RequestParam`, not "no filter". */
function clean(params) {
  const out = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === "" || value === null || value === undefined) continue;
    out[key] = value;
  }
  return out;
}

export const marketplaceBookingService = {
  /**
   * Paged, cross-tenant queue. Unlike the tenant-facing list, this endpoint DOES accept `status`,
   * so the console's filter tabs narrow the real dataset rather than one loaded page.
   *
   * An unknown `status` string is treated by the server as "all" rather than rejected
   * (MarketplaceBookingAdminController.parseStatus), so a stale tab can never 400 the queue.
   *
   * @returns {Promise<{items: Array, pagination: Object|null}>} rows live in `data`, NOT `content`.
   */
  list: async ({ page = 0, size = 25, status, tenantId } = {}) => {
    const res = await ConsoleAPI.get(BASE, { params: clean({ page, size, status, tenantId }) });
    const rows = res?.data?.data;
    return {
      items: Array.isArray(rows) ? rows : [],
      pagination: res?.data?.pagination ?? null,
    };
  },

  /** Badge count for the sidebar: REQUESTED + TENANT_ACCEPTED — the two states waiting on us. */
  pendingCount: async () => {
    const data = unwrap(await ConsoleAPI.get(`${BASE}/pending-count`));
    return data?.count ?? 0;
  },

  /** Claim a request for review. No MFA — it changes no money and is reversible by approving/rejecting. */
  review: async (publicId) => unwrap(await ConsoleAPI.post(`${BASE}/${publicId}/review`)),

  /**
   * Confirm the booking.
   *
   * @param {object} payload ApproveMarketplaceBookingRequest — `supplierTotal` and `tenantPayable`
   *        are both required, and the server rejects `tenantPayable < supplierTotal` rather than
   *        silently confirming a loss-making sale. The difference becomes `platformEarning`.
   */
  approve: async (publicId, payload, mfaCode) =>
    unwrap(await ConsoleAPI.post(`${BASE}/${publicId}/approve`, payload, stepUpHeaders(mfaCode))),

  /** Reject. `reason` is a QUERY param, not a body — matches the controller signature. */
  reject: async (publicId, reason, mfaCode) =>
    unwrap(await ConsoleAPI.post(`${BASE}/${publicId}/reject`, null, {
      ...stepUpHeaders(mfaCode),
      params: clean({ reason }),
    })),
};

export default marketplaceBookingService;
