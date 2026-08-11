// src/console/api/marketplaceOccupancyService.js
//
// "On the 14th, how many rooms do I have at this hotel?" — the platform's stay calendar.
//
// Platform realm: ConsoleAPI carries `sa_token`, so a 401 bounces to the CONSOLE login. There is no
// tenant counterpart and there must not be one: this aggregates across every tenant, so a per-tenant
// version would either leak how much other agencies are selling at the same property, or be a
// differently-shaped copy of the list the tenant already has.
//
// WHAT THIS IS NOT: inventory. The platform holds no allotment, so it cannot say how many rooms are
// FREE at a property — only how many it has SOLD. The two questions are routinely confused, and the
// distinction is the whole reason this could be built before the rate-calendar work.

import ConsoleAPI, { unwrap } from "./consoleHttp";

const BASE = "/super-admin/marketplace/occupancy";

/**
 * Longest window the server will answer in one call, mirrored here so the UI can clamp its own date
 * pickers instead of letting the user compose a request that is guaranteed to 400.
 *
 * Keep in step with `MarketplaceOccupancyService.MAX_WINDOW_DAYS`.
 */
export const MAX_WINDOW_DAYS = 92;

function clean(params) {
  const out = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === "" || value === null || value === undefined) continue;
    out[key] = value;
  }
  return out;
}

export const marketplaceOccupancyService = {
  /**
   * GET /super-admin/marketplace/occupancy — one row per hotel, busiest first.
   *
   * Each row carries `days`: EVERY night in the requested window, including empty ones, so a caller
   * can render a calendar strip without reconstructing the axis (and without a missing day silently
   * shifting everything after it).
   *
   * Per night: `roomsCommitted` (what the platform has actually promised a supplier — CONFIRMED plus
   * the two cancellation-in-progress states, because the hotel is still holding those rooms) and
   * `roomsPending` (requests not yet decided). They are separate on purpose: a pipeline is not a
   * holding, and adding them would overstate what the platform owes a property.
   *
   * @param {string} from  inclusive first night, ISO `YYYY-MM-DD`. Defaults server-side to today.
   * @param {string} to    inclusive last night. Defaults to 30 days out; more than
   *                       {@link MAX_WINDOW_DAYS} apart is a 400, not a silent truncation.
   * @returns {Promise<Array>} always an array, so a call site never guards `.map`.
   */
  list: async ({ from, to, hotelPublicId, tenantId } = {}, config = {}) => {
    const rows = unwrap(await ConsoleAPI.get(BASE, {
      params: clean({ from, to, hotelPublicId, tenantId }),
      ...config,
    }));
    return Array.isArray(rows) ? rows : [];
  },
};

export default marketplaceOccupancyService;
