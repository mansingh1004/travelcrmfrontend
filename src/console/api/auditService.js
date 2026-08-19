import ConsoleAPI, { unwrap } from "./consoleHttp";

/** Read-only platform audit ledger. */
export const auditService = {
  /**
   * `q` is the search box: free text over actor email, description and tenant code.
   * `tenantPublicId` is an ownership filter and is NOT interchangeable with it — asking "what
   * happened to this tenant" through `q` also returns rows about other tenants whose description or
   * code merely contains the term, which is how the tenant workspace was leaking them.
   */
  list: async ({ action = "", success = "", from = "", to = "", q = "", tenantPublicId = "", page = 0, size = 20 } = {}) => {
    const params = { page, size };
    if (action) params.action = action;
    if (success !== "") params.success = success;
    if (from) params.from = from;
    if (to) params.to = to;
    if (q) params.q = q;
    if (tenantPublicId) params.tenantPublicId = tenantPublicId;
    const res = await ConsoleAPI.get("/super-admin/audit-logs", { params });
    const body = res?.data ?? {};
    return { rows: body.data ?? [], pagination: body.pagination ?? {} };
  },
  actions: () => ConsoleAPI.get("/super-admin/audit-logs/actions").then(unwrap),
};