import ConsoleAPI, { unwrap } from "./consoleHttp";
import { SUPERADMIN_MFA_HEADER } from "./userService";

const stepUpHeaders = (mfaCode) => ({
  headers: { [SUPERADMIN_MFA_HEADER]: mfaCode },
});

/**
 * Platform tenant management API. All operations are keyed by `publicId` (UUID). `list` returns
 * the paged envelope split into `{ rows, pagination }`; the rest return the unwrapped payload.
 */
export const tenantService = {
  list: async ({ search = "", status = "", deleted = false, page = 0, size = 20 } = {}) => {
    const params = { page, size, deleted };
    if (search) params.search = search;
    if (status) params.status = status;
    const res = await ConsoleAPI.get("/super-admin/tenants", { params });
    const body = res?.data ?? {};
    return { rows: body.data ?? [], pagination: body.pagination ?? {} };
  },

  get: (publicId) => ConsoleAPI.get(`/super-admin/tenants/${publicId}`).then(unwrap),
  create: (payload) => ConsoleAPI.post("/super-admin/tenants", payload).then(unwrap),
  update: (publicId, payload) => ConsoleAPI.put(`/super-admin/tenants/${publicId}`, payload).then(unwrap),

  changePlan: (publicId, plan, mfaCode) =>
    ConsoleAPI.post(`/super-admin/tenants/${publicId}/plan`, { plan }, stepUpHeaders(mfaCode)).then(unwrap),

  // Sub-agent seat fee. GET returns { effectiveRate, usingPlatformDefault, overrideRate,
  // activeSeats, monthlyTotal }. PUT { monthlySeatFee } sets the per-tenant override;
  // monthlySeatFee=null clears it (revert to the platform-flat default).
  getSeatFee: (publicId) =>
    ConsoleAPI.get(`/super-admin/tenants/${publicId}/seat-fee`).then(unwrap),
  setSeatFee: (publicId, payload, mfaCode) =>
    ConsoleAPI.put(`/super-admin/tenants/${publicId}/seat-fee`, payload, stepUpHeaders(mfaCode)).then(unwrap),

  suspend: (publicId) => ConsoleAPI.post(`/super-admin/tenants/${publicId}/suspend`),
  reactivate: (publicId) => ConsoleAPI.post(`/super-admin/tenants/${publicId}/reactivate`),
  remove: (publicId, mfaCode) =>
    ConsoleAPI.delete(`/super-admin/tenants/${publicId}`, stepUpHeaders(mfaCode)),
  restore: (publicId) => ConsoleAPI.post(`/super-admin/tenants/${publicId}/restore`),
};
