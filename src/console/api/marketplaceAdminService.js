// src/console/api/marketplaceAdminService.js
//
// Three small SuperAdmin surfaces that share one realm and one shape: the platform's commercial
// rules, its tenant credit ledger, and the queue of hotels tenants have asked for.
//
// They are one file rather than three because each is a handful of calls against
// /super-admin/marketplace/*, and splitting them would mean three copies of `clean` and three
// near-identical headers. The commission ledger and the occupancy roll-up stay separate — those are
// substantial enough to earn their own modules.
//
// Platform realm: ConsoleAPI carries `sa_token`, so a 401 bounces to the CONSOLE login, never the
// tenant one.
//
// ⚠ THERE MUST NEVER BE A TENANT COUNTERPART TO THE RULES HALF. A commercial rule states the
// platform's margin; a tenant who could read one could compute the platform's cut on every booking
// against that hotel. The tenant-facing counterpart is the quote endpoint, which returns a payable
// and no way to decompose it.

import ConsoleAPI, { unwrap } from "./consoleHttp";

const RULES = "/super-admin/marketplace/commercial-rules";
const CREDIT = "/super-admin/marketplace/credit";
const NOMINATIONS = "/super-admin/marketplace/nominations";

/** Drop empty filters — an empty string is a *value* to a Spring `@RequestParam`, not "no filter". */
function clean(params) {
  const out = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === "" || value === null || value === undefined) continue;
    out[key] = value;
  }
  return out;
}

/* ── Commercial rules ─────────────────────────────────────────────────────── */

export const commercialRuleService = {
  /**
   * Every rule, or one hotel's. The unfiltered list includes the GLOBAL fallbacks — rules with no
   * hotel, which price every property that has none of its own.
   */
  list: async (hotelPublicId) =>
    unwrap(await ConsoleAPI.get(RULES, { params: clean({ hotelPublicId }) })) ?? [],

  /**
   * The enum vocabularies, read from the server rather than hardcoded.
   *
   * Deliberate: the tenant app has four files holding four different copies of the lead-stage
   * strings, two of which contain a value the backend never had. A select built from the server
   * cannot drift from it.
   *
   * @returns {Promise<{commercialModels: Array, calculationTypes: Array}>} each `{value, label}`.
   */
  options: async () => unwrap(await ConsoleAPI.get(`${RULES}/options`)) ?? {},

  /**
   * Create a rule. Omit `hotelPublicId` for the global fallback — "global" is the ABSENCE of a
   * hotel, not a separate flag, so the two can never disagree.
   *
   * A percentage above 100 is a 400: on a commission model it would drive the supplier total
   * negative, i.e. record that the hotel pays the platform to take the booking.
   */
  create: async (payload) => unwrap(await ConsoleAPI.post(RULES, payload)),

  /**
   * Update. Editing a rule reprices every FUTURE request against that hotel and no past one:
   * bookings carry their agreed amounts, so a March edit cannot restate what was earned in January.
   */
  update: async (publicId, payload) => unwrap(await ConsoleAPI.put(`${RULES}/${publicId}`, payload)),

  /** Soft-delete. A rule is the explanation for every price it produced, so it is never removed. */
  remove: async (publicId) => unwrap(await ConsoleAPI.delete(`${RULES}/${publicId}`)),
};

/* ── Tenant credit ────────────────────────────────────────────────────────── */

export const marketplaceCreditService = {
  /** Every tenant with a configured limit OR an outstanding balance, biggest debtor first. */
  list: async () => unwrap(await ConsoleAPI.get(CREDIT)) ?? [],

  get: async (tenantId) => unwrap(await ConsoleAPI.get(`${CREDIT}/${tenantId}`)),

  /**
   * Set a tenant's ceiling.
   *
   * `enforced:false` records a limit WITHOUT applying it — preferred over an absurdly large number,
   * which reads as a typo to whoever sees it next.
   *
   * Note what a tenant with no row means: NOT gated at all. The platform has made no decision about
   * them, and treating that as "zero credit" would refuse every approval for every tenant who has
   * not been configured yet.
   */
  setLimit: async (tenantId, payload) => unwrap(await ConsoleAPI.put(`${CREDIT}/${tenantId}`, payload)),

  /**
   * Record money actually received against one booking.
   *
   * Settlement is offline in this release — bank transfer, cheque, an existing arrangement — so
   * this is an operator act, not a gateway callback. A receipt larger than the outstanding amount
   * settles the booking rather than creating a negative balance that would then quietly net against
   * the tenant's other debts.
   */
  recordPayment: async (bookingPublicId, payload) =>
    unwrap(await ConsoleAPI.post(`${CREDIT}/bookings/${bookingPublicId}/payments`, payload)),

  /** Undo a recorded receipt — a bounced cheque, a misapplied transfer, a fat-fingered amount. */
  reversePayment: async (bookingPublicId, amount, reason) =>
    unwrap(await ConsoleAPI.post(`${CREDIT}/bookings/${bookingPublicId}/payments/reverse`, null, {
      params: clean({ amount, reason }),
    })),
};

/* ── Hotel nominations ────────────────────────────────────────────────────── */

export const hotelNominationService = {
  /**
   * The queue of hotels tenants have proposed for the catalog.
   *
   * @returns {Promise<{items: Array, pagination: Object|null}>} rows live in `data`, NOT `content`.
   */
  list: async ({ page = 0, size = 25, status, tenantId } = {}) => {
    const res = await ConsoleAPI.get(NOMINATIONS, { params: clean({ page, size, status, tenantId }) });
    const rows = res?.data?.data;
    return { items: Array.isArray(rows) ? rows : [], pagination: res?.data?.pagination ?? null };
  },

  /** Sidebar badge — nominations still waiting on the platform. Swallow errors at the call site. */
  openCount: async () => Number(unwrap(await ConsoleAPI.get(`${NOMINATIONS}/open-count`))?.count ?? 0),

  review: async (publicId) => unwrap(await ConsoleAPI.post(`${NOMINATIONS}/${publicId}/review`)),

  /**
   * Accept — the PROPERTY receives a partner invitation.
   *
   * This does not create a catalog hotel. The hotel fills in its own details and rate card through
   * the normal onboarding form, so the commercial terms come from the property rather than from the
   * tenant's guess at them.
   *
   * Not idempotent by design: a second call on a decided nomination 409s rather than sending a
   * second invite. Re-inviting a silent hotel is the invite's own `resend`.
   */
  accept: async (publicId, note) =>
    unwrap(await ConsoleAPI.post(`${NOMINATIONS}/${publicId}/accept`, null, { params: clean({ note }) })),

  /** Reject. The reason is TENANT-VISIBLE — one they cannot read is one they will simply re-send. */
  reject: async (publicId, reason) =>
    unwrap(await ConsoleAPI.post(`${NOMINATIONS}/${publicId}/reject`, null, { params: clean({ reason }) })),
};

export default { commercialRuleService, marketplaceCreditService, hotelNominationService };
