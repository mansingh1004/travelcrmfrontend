import ConsoleAPI, { unwrap } from "./consoleHttp";
import { SUPERADMIN_MFA_HEADER } from "./userService";

const stepUpHeaders = (mfaCode) => ({
  headers: { [SUPERADMIN_MFA_HEADER]: mfaCode },
});

export const superAdminInviteService = {
  listAccounts: () => ConsoleAPI.get("/super-admin/accounts").then(unwrap),

  list: () => ConsoleAPI.get("/super-admin/invites").then(unwrap),

  create: ({ name, email, role }, mfaCode) =>
    ConsoleAPI.post("/super-admin/invites", { name, email, role }, stepUpHeaders(mfaCode)).then(unwrap),

  resendInvite: (publicId, mfaCode) =>
    ConsoleAPI.post(`/super-admin/invites/${publicId}/resend`, null, stepUpHeaders(mfaCode)).then(unwrap),

  revokeInvite: (publicId, mfaCode) =>
    ConsoleAPI.delete(`/super-admin/invites/${publicId}`, stepUpHeaders(mfaCode)).then(unwrap),

  resetMfa: (publicId, mfaCode) =>
    ConsoleAPI.post(`/super-admin/accounts/${publicId}/mfa/reset`, null, stepUpHeaders(mfaCode)).then(unwrap),

  changeRole: (publicId, role, mfaCode) =>
    ConsoleAPI.put(`/super-admin/accounts/${publicId}/role`, { role }, stepUpHeaders(mfaCode)).then(unwrap),

  setEnabled: (publicId, enabled, mfaCode) =>
    ConsoleAPI.post(`/super-admin/accounts/${publicId}/${enabled ? "enable" : "disable"}`, null,
      stepUpHeaders(mfaCode)).then(unwrap),

  unlock: (publicId, mfaCode) =>
    ConsoleAPI.post(`/super-admin/accounts/${publicId}/unlock`, null, stepUpHeaders(mfaCode)).then(unwrap),

  revokeSessions: (publicId, mfaCode) =>
    ConsoleAPI.post(`/super-admin/accounts/${publicId}/revoke-sessions`, null, stepUpHeaders(mfaCode)).then(unwrap),

  setup: (token) =>
    ConsoleAPI.get(`/auth/superadmin/invites/${encodeURIComponent(token)}/setup`).then(unwrap),

  accept: (token, { password, code }) =>
    ConsoleAPI.post(`/auth/superadmin/invites/${encodeURIComponent(token)}/accept`, {
      password,
      code,
    }).then(unwrap),
};

export default superAdminInviteService;
