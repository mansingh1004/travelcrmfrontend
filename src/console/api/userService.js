import ConsoleAPI, { unwrap } from "./consoleHttp";

export const SUPERADMIN_MFA_HEADER = "X-SuperAdmin-Mfa-Code";

const mfaHeaders = (mfaCode) => ({
  headers: { [SUPERADMIN_MFA_HEADER]: mfaCode },
});

/**
 * Cross-tenant user control (SuperAdmin). `list` returns the paged envelope split into
 * `{ rows, pagination }`; the mutations return the unwrapped updated user.
 */
export const userService = {
  list: async ({ search = "", tenantId = "", page = 0, size = 20 } = {}) => {
    const params = { page, size };
    if (search) params.search = search;
    if (tenantId) params.tenantId = tenantId;
    const res = await ConsoleAPI.get("/super-admin/users", { params });
    const body = res?.data ?? {};
    return { rows: body.data ?? [], pagination: body.pagination ?? {} };
  },

  lock: (publicId, mfaCode) =>
    ConsoleAPI.post(`/super-admin/users/${publicId}/lock`, null, mfaHeaders(mfaCode)).then(unwrap),
  unlock: (publicId, mfaCode) =>
    ConsoleAPI.post(`/super-admin/users/${publicId}/unlock`, null, mfaHeaders(mfaCode)).then(unwrap),
  resetPassword: (publicId, newPassword, mfaCode) =>
    ConsoleAPI.post(
      `/super-admin/users/${publicId}/reset-password`,
      { newPassword },
      mfaHeaders(mfaCode)
    ).then(unwrap),

  impersonate: (publicId, mfaCode) =>
    ConsoleAPI.post(
      `/super-admin/users/${publicId}/impersonate`,
      null,
      mfaHeaders(mfaCode)
    ).then(unwrap),
};
