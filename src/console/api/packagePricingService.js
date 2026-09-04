// src/console/api/packagePricingService.js
// ─────────────────────────────────────────────────────────────────────────────
// The platform's markup on PACKAGES.
//
// Third of three, and the same shape as the hotel rules (marketplaceAdminService)
// and the transport rules (transportPricingService) — one list, one options call,
// and three step-up-gated writes. Kept as its own file rather than folded into
// platformPackageService for the reason the other two are separate: a margin is a
// different subject from a catalog, answered by a different screen, and a reader
// looking for "where do we set our cut" should find one file called pricing.
//
// SuperAdmin only. There is no tenant-facing read of a commercial rule anywhere —
// an agency that could read one could compute the platform's cut on every package
// it buys.
// ─────────────────────────────────────────────────────────────────────────────

import ConsoleAPI, { unwrap } from "./consoleHttp";
import { SUPERADMIN_MFA_HEADER } from "./userService";

const RULES = "/super-admin/package-marketplace/commercial-rules";

/* Editing a margin is not a routine save. Every write carries the step-up code, which doubles as
   the confirmation a form with a Save button would otherwise lack — the same gate the other two
   marketplaces put on theirs. */
const stepUpHeaders = (mfaCode) => ({ headers: { [SUPERADMIN_MFA_HEADER]: mfaCode } });

export const packagePricingService = {
  /**
   * Every rule, or one package's.
   *
   * Catalog-wide rules come back in BOTH cases — they price that package too, and a list that hid
   * them would show a package as having "no rules" while it is in fact being marked up.
   */
  list: async (packagePublicId) =>
    unwrap(await ConsoleAPI.get(RULES, {
      params: packagePublicId ? { packagePublicId } : undefined,
    })) ?? [],

  /** The catalog-wide defaults alone. */
  listGlobal: async () => unwrap(await ConsoleAPI.get(`${RULES}/global`)) ?? [],

  /** Enum vocabularies from the server, so the selects cannot drift from the constants. */
  options: async () => unwrap(await ConsoleAPI.get(`${RULES}/options`)) ?? {},

  create: async (payload, mfaCode) =>
    unwrap(await ConsoleAPI.post(RULES, payload, stepUpHeaders(mfaCode))),

  update: async (publicId, payload, mfaCode) =>
    unwrap(await ConsoleAPI.put(`${RULES}/${publicId}`, payload, stepUpHeaders(mfaCode))),

  remove: async (publicId, mfaCode) =>
    unwrap(await ConsoleAPI.delete(`${RULES}/${publicId}`, stepUpHeaders(mfaCode))),
};

export default packagePricingService;
