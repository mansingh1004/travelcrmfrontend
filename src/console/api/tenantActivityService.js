import ConsoleAPI, { unwrap } from "./consoleHttp";

/**
 * Tenant activity across every tenant — what their staff did inside their own workspaces.
 *
 * <p>Distinct from `auditService`, which reads the PLATFORM audit ledger: what a SuperAdmin did
 * TO a tenant. Same console, adjacent screens, different tables, and merging them would produce a
 * feed where "we suspended them" and "they created a booking" sit in one list with no way to tell
 * which kind of event you are reading.
 */
const BASE = "/super-admin/activity-logs";

export const tenantActivityService = {
  list: async ({ tenantPublicId = "", from = "", to = "", action = "", userType = "", q = "", page = 0, size = 25 } = {}) => {
    const params = { page, size };
    if (tenantPublicId) params.tenantPublicId = tenantPublicId;
    if (from) params.from = from;
    if (to) params.to = to;
    if (action) params.action = action;
    if (userType) params.userType = userType;
    if (q) params.q = q;
    const res = await ConsoleAPI.get(BASE, { params });
    const body = res?.data ?? {};
    return { rows: body.data ?? [], pagination: body.pagination ?? {} };
  },

  detail: (publicId) => ConsoleAPI.get(`${BASE}/${publicId}`).then(unwrap),

  /** From the enum, so the dropdown cannot drift from what the backend accepts. */
  actions: () => ConsoleAPI.get(`${BASE}/actions`).then(unwrap),
};

export default tenantActivityService;
