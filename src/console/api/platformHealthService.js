import ConsoleAPI, { unwrap } from "./consoleHttp";

/**
 * The three questions a platform owner actually has.
 *
 * `pulse` — is money landing? Everything it returns is a FLOW: something that happened between two
 * dates. That is why it is a separate call from `analyticsService.overview`, which returns STOCKS
 * (how many tenants exist, what is outstanding right now). A date range applies to one and is
 * meaningless on the other, and a picker that silently drove both would make half the screen lie.
 *
 * `tenantHealth` — is anyone about to churn? Comes back already sorted worst-first, with the
 * attention chips precomputed, so the console filters client-side instead of asking again per chip.
 *
 * `activation` — did the new ones ever start? The cross-tenant funnel; the tenant-facing
 * `/api/me/onboarding` answers a different question for one tenant and cannot be summed into this.
 */
export const platformHealthService = {
  /** @param {{from?: string, to?: string}} range ISO dates. Omit both for the current month. */
  pulse: ({ from, to } = {}) =>
    ConsoleAPI.get("/super-admin/pulse", { params: clean({ from, to }) }).then(unwrap),

  tenantHealth: () => ConsoleAPI.get("/super-admin/tenant-health").then(unwrap),

  /** @param {{days?: number, stalledFor?: number}} opts window in days, and the stall threshold. */
  activation: ({ days, stalledFor } = {}) =>
    ConsoleAPI.get("/super-admin/onboarding-funnel", { params: clean({ days, stalledFor }) }).then(unwrap),

  /* Sign-ins, failures, impersonations and destructive actions, grouped. Takes no arguments by
     design: the window and the set of actions that count as destructive are decided server-side,
     so this panel cannot be narrowed into looking clean. */
  securityEvents: () => ConsoleAPI.get("/super-admin/security-events").then(unwrap),

  /* Commission across ALL supply lines. Never marketplaceCommissionService for a platform total —
     that path is an alias of the HOTEL controller, so it answers for one line while looking like
     the whole platform, which is the bug this endpoint exists to end. */
  earnings: ({ from, to } = {}) =>
    ConsoleAPI.get("/super-admin/earnings/summary", { params: clean({ from, to }) }).then(unwrap),
};

/**
 * Platform-private notes about a tenant.
 *
 * Written BY the platform ABOUT a tenant and never shown to them — there is no tenant-facing
 * counterpart to these endpoints, and there must not be one.
 */
export const tenantNoteService = {
  list: (tenantPublicId) =>
    ConsoleAPI.get(`/super-admin/tenants/${tenantPublicId}/notes`).then(unwrap),
  add: (tenantPublicId, body) =>
    ConsoleAPI.post(`/super-admin/tenants/${tenantPublicId}/notes`, { body }).then(unwrap),
  edit: (tenantPublicId, notePublicId, body) =>
    ConsoleAPI.put(`/super-admin/tenants/${tenantPublicId}/notes/${notePublicId}`, { body }).then(unwrap),
  remove: (tenantPublicId, notePublicId) =>
    ConsoleAPI.delete(`/super-admin/tenants/${tenantPublicId}/notes/${notePublicId}`).then(unwrap),
};

/**
 * The signed-in operator's own saved console layout.
 *
 * Always "mine" — there is no path to another operator's, because one person rearranging another's
 * view of what needs attention is not a feature anybody asked for.
 *
 * `get` answers 200 with a null `stateJson` when nothing has been saved. That is the normal case
 * for a new operator, not an error, which is why it is not a 404 the caller has to special-case.
 */
export const uiStateService = {
  get: (stateKey) => ConsoleAPI.get(`/super-admin/ui-state/${stateKey}`).then(unwrap),
  save: (stateKey, stateJson, stateVersion) =>
    ConsoleAPI.put(`/super-admin/ui-state/${stateKey}`, { stateJson, stateVersion }).then(unwrap),
  reset: (stateKey) => ConsoleAPI.delete(`/super-admin/ui-state/${stateKey}`).then(unwrap),
};

/** Drop empty params so the server applies its own defaults rather than parsing "". */
function clean(params) {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  );
}

export default platformHealthService;
