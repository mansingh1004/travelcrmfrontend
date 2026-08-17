// src/console/api/marketplaceCommissionService.js
//
// The platform earning ledger for hotel marketplace bookings. Platform realm: ConsoleAPI carries
// `sa_token`, so a 401 bounces to the CONSOLE login and never the tenant one.
//
// There is no tenant counterpart to this service and there must never be one — every row carries the
// supplier cost and the platform's margin on a tenant's booking.
//
import ConsoleAPI, { unwrap } from "./consoleHttp";
import { SUPERADMIN_MFA_HEADER } from "./userService";

const BASE = "/super-admin/marketplace/commissions";
const stepUpHeaders = (mfaCode) => ({ headers: { [SUPERADMIN_MFA_HEADER]: mfaCode } });

/** Drop empty filters — an empty string is a *value* to a Spring `@RequestParam`, not "no filter". */
function clean(params) {
  const out = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === "" || value === null || value === undefined) continue;
    out[key] = value;
  }
  return out;
}

export const marketplaceCommissionService = {
  /**
   * Paged, cross-tenant ledger, newest first. `from`/`to` filter on the entry's EFFECTIVE date (when
   * the event happened) rather than when the row was written, and must be ISO `YYYY-MM-DD`.
   *
   * An unknown `status` or `entryType` is read by the server as "all" rather than rejected, so a
   * stale filter can never 400 the ledger.
   *
   * @returns {Promise<{items: Array, pagination: Object|null}>} rows live in `data`, NOT `content`.
   */
  list: async ({ page = 0, size = 25, tenantId, status, entryType, from, to } = {}) => {
    const res = await ConsoleAPI.get(BASE, {
      params: clean({ page, size, tenantId, status, entryType, from, to }),
    });
    const body = res?.data ?? {};
    return {
      items: Array.isArray(body.data) ? body.data : [],
      pagination: body.pagination ?? null,
    };
  },

  /**
   * The earning report over the same rows.
   *
   * Note the narrower filter set: the summary takes tenant + date range only. `status` and
   * `entryType` are not parameters because the response already breaks the slice down along both
   * axes — asking for "the ACCRUAL total of the ACCRUAL rows" would just be `grossAccrued` again.
   */
  summary: async ({ tenantId, from, to } = {}) =>
    unwrap(await ConsoleAPI.get(`${BASE}/summary`, { params: clean({ tenantId, from, to }) })),

  /**
   * Append a manual signed correction.
   *
   * Keyed by the BOOKING's publicId, not a ledger row's — a correction is a new row, and the row it
   * corrects may not exist at all (an accrual that was never written is exactly what an adjustment
   * fixes). `referenceSuffix` is what makes a retry land once, so the caller owns it.
   */
  adjust: async (bookingPublicId, { amount, reason, referenceSuffix }, mfaCode) =>
    unwrap(await ConsoleAPI.post(`${BASE}/${bookingPublicId}/adjust`, {
      amount,
      reason,
      referenceSuffix,
    }, stepUpHeaders(mfaCode))),

  /** Keyed by the LEDGER ROW's publicId — settlement is a claim about one specific entry. */
  settle: async (publicId, reason, mfaCode) =>
    unwrap(await ConsoleAPI.post(`${BASE}/${publicId}/settle`, null, {
      ...stepUpHeaders(mfaCode),
      params: clean({ reason }),
    })),
};

export default marketplaceCommissionService;
