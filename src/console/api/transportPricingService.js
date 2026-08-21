// src/console/api/transportPricingService.js
//
// The two SuperAdmin surfaces that decide what a transport order costs: the commercial rules that
// price a vehicle, and the preview of what those rules make of one particular order.
//
// One file rather than two because they are the two ends of the same machine. A rule is only ever
// read through a price it produced, and the approve screen shows both at once — the figures and the
// rule that got there. The order queue, the vehicle catalog and the earnings ledger stay in
// `transportAdminService`: those are an order's lifecycle, not its price.
//
// Platform realm: ConsoleAPI carries `sa_token`, so a 401 bounces to the CONSOLE login, never the
// tenant one.
//
// ⚠ NEITHER HALF MAY EVER GAIN A TENANT COUNTERPART, and the second half is the dangerous one. A
// rule states the platform's margin verbatim; the preview additionally carries `supplierTotal` and
// an `explanation` that IS the operator's contracted rate card written out in prose ("Driver
// allowance ₹300 × 1 vehicle × 2 days"). A tenant holding either could compute what the platform
// keeps on every journey, and from that what the operator is paid. The tenant-facing counterpart is
// `POST /transport-marketplace/quote`, which returns one payable and no way to decompose it; the
// backend has an ArchUnit test that fails the build if that ever stops being true.

import ConsoleAPI, { unwrap } from "./consoleHttp";
import { SUPERADMIN_MFA_HEADER } from "./userService";

const RULES = "/super-admin/transport-marketplace/commercial-rules";
const ORDERS = "/super-admin/transport-marketplace/orders";

/**
 * Step-up MFA. The three rule WRITES carry it; every read here deliberately does not — prompting for
 * a second factor to look at a list is friction that gets worked around, and the controller's
 * `hasRole('SUPER_ADMIN')` is already the access boundary.
 *
 * Server-side these ride the existing MARKETPLACE_RULE_* risk actions rather than transport-specific
 * ones, so the console's existing step-up flow already satisfies them.
 */
const stepUpHeaders = (mfaCode) => ({ headers: { [SUPERADMIN_MFA_HEADER]: mfaCode } });

/** Drop empty filters — an empty string is a *value* to a Spring `@RequestParam`, not "no filter". */
function clean(params) {
  const out = {};
  for (const [key, value] of Object.entries(params || {})) {
    if (value === "" || value === null || value === undefined) continue;
    out[key] = value;
  }
  return out;
}

/* ── Commercial rules ─────────────────────────────────────────────────────── */

export const transportCommercialRuleService = {
  /**
   * Every rule, or one vehicle's.
   *
   * Paged, where the hotel equivalent returns a flat array: a transport rule is scoped on TWO axes
   * (vehicle × journey type), so a mature platform carries several per vehicle rather than one.
   * Returns `{rows, pagination}` for the same reason `transportAdminService.listVehicles` does —
   * `unwrap` would drop the meta half the pager needs.
   *
   * `size` is clamped to 100 server-side. The screen asks for the ceiling in one call because it
   * regroups the rules by specificity, and a group assembled from half the rules would show a
   * precedence order that is not the one the resolver applies.
   *
   * ⚠ Filtering by vehicle does NOT fold in the global rules that would also apply to it — that is
   * the server's deliberate choice, not an omission. This screen EDITS rules, and showing a global
   * row under a vehicle filter invites someone to edit it there and move the margin on every other
   * vehicle at the same time. Any UI that filters must say so.
   */
  list: async ({ vehiclePublicId, page = 0, size = 100 } = {}) => {
    const res = await ConsoleAPI.get(RULES, { params: clean({ vehiclePublicId, page, size }) });
    const body = res?.data ?? {};
    return { rows: body.data ?? [], pagination: body.pagination ?? {} };
  },

  /**
   * The enum vocabularies, read from the server rather than hardcoded.
   *
   * Deliberate: the tenant app has four files holding four different copies of the lead-stage
   * strings, two of which contain a value the backend never had. A select built from the server
   * cannot drift from it.
   *
   * ⚠ It carries the two MODEL vocabularies only. The journey types (`TransportServiceType`) are not
   * on this response, so the rule form has to hold that list locally — and therefore has to tolerate
   * a value it does not know rather than silently rewriting it.
   *
   * @returns {Promise<{commercialModels: Array, calculationTypes: Array}>} each `{value, label}`.
   */
  options: async () => unwrap(await ConsoleAPI.get(`${RULES}/options`)) ?? {},

  get: async (publicId) => unwrap(await ConsoleAPI.get(`${RULES}/${publicId}`)),

  /**
   * Create a rule. Omit `platformVehiclePublicId` for a rule that covers every vehicle, and
   * `serviceType` for one that covers every journey type — "global" and "any" are the ABSENCE of a
   * scope, not separate flags, so the two can never disagree.
   *
   * A percentage above 100 is a 400: on an operator-paid commission it drives the supplier total
   * negative, i.e. records that the operator pays the platform to run the journey.
   */
  create: async (payload, mfaCode) =>
    unwrap(await ConsoleAPI.post(RULES, payload, stepUpHeaders(mfaCode))),

  /**
   * Update. Editing a rule reprices every FUTURE order and no past one: an order stores its agreed
   * amounts AND the publicId of the rule that produced them, so a March edit cannot restate what was
   * earned in January and the rule behind any historical price stays identifiable.
   */
  update: async (publicId, payload, mfaCode) =>
    unwrap(await ConsoleAPI.put(`${RULES}/${publicId}`, payload, stepUpHeaders(mfaCode))),

  /** Soft-delete. A rule is the explanation for every price it produced, so it is never removed. */
  remove: async (publicId, mfaCode) =>
    unwrap(await ConsoleAPI.delete(`${RULES}/${publicId}`, stepUpHeaders(mfaCode))),
};

/* ── The price behind one order ───────────────────────────────────────────── */

export const transportPriceService = {
  /**
   * What the rules make of this order — the prefill behind the approve screen.
   *
   * ⚠ A journey the engine cannot price answers **200 with `priceable:false`**, never a 404 and
   * never a zero. A `CUSTOM_QUOTE` rate, a per-kilometre rate on a journey with no distance, or a
   * vehicle with no rate card at all are all normal states in which a human types the number, and
   * `unpriceableReason` is the sentence to show beside the empty fields. Treating a false here as an
   * error would hide the one case the screen exists for.
   *
   * `fallbackRule:true` means no configured rule matched and the built-in default markup was used —
   * surfaced rather than hidden, because a margin nobody chose is its own hazard and the operator
   * about to approve is the right person to notice the vehicle still has no rule.
   *
   * @returns {Promise<Object>} `TransportPricePreviewDto`.
   */
  preview: async (orderPublicId) =>
    unwrap(await ConsoleAPI.get(`${ORDERS}/${orderPublicId}/price-preview`)),
};

export default { transportCommercialRuleService, transportPriceService };
