import ConsoleAPI, { unwrap } from "./consoleHttp";
import { SUPERADMIN_MFA_HEADER } from "./userService";

const stepUpHeaders = (mfaCode) => ({
  headers: { [SUPERADMIN_MFA_HEADER]: mfaCode },
});

/** Platform billing (SuperAdmin → tenant invoices). */
export const billingService = {
  list: async ({ search = "", status = "", overdue = false, page = 0, size = 25 } = {}) => {
    const params = { page, size, overdue };
    if (search) params.search = search;
    if (status) params.status = status;
    const res = await ConsoleAPI.get("/super-admin/billing", { params });
    return { rows: res?.data?.data ?? [], pagination: res?.data?.pagination ?? {} };
  },
  listForTenant: (tenantPublicId) =>
    ConsoleAPI.get(`/super-admin/tenants/${tenantPublicId}/billing`).then(unwrap),
  create: (tenantPublicId, payload, mfaCode) =>
    ConsoleAPI.post(`/super-admin/tenants/${tenantPublicId}/billing`, payload, stepUpHeaders(mfaCode)).then(unwrap),
  markPaid: (publicId, mfaCode) =>
    ConsoleAPI.post(`/super-admin/billing/${publicId}/mark-paid`, null, stepUpHeaders(mfaCode)).then(unwrap),
  markUnpaid: (publicId, mfaCode) =>
    ConsoleAPI.post(`/super-admin/billing/${publicId}/mark-unpaid`, null, stepUpHeaders(mfaCode)).then(unwrap),
};
