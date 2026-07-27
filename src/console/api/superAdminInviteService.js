import ConsoleAPI, { unwrap } from "./consoleHttp";
import { SUPERADMIN_MFA_HEADER } from "./userService";

const stepUpHeaders = (mfaCode) => ({
  headers: { [SUPERADMIN_MFA_HEADER]: mfaCode },
});

export const superAdminInviteService = {
  listAccounts: () => ConsoleAPI.get("/super-admin/accounts").then(unwrap),

  list: () => ConsoleAPI.get("/super-admin/invites").then(unwrap),

  create: ({ name, email }, mfaCode) =>
    ConsoleAPI.post("/super-admin/invites", { name, email }, stepUpHeaders(mfaCode)).then(unwrap),

  resetMfa: (publicId, mfaCode) =>
    ConsoleAPI.post(`/super-admin/accounts/${publicId}/mfa/reset`, null, stepUpHeaders(mfaCode)).then(unwrap),

  setup: (token) =>
    ConsoleAPI.get(`/auth/superadmin/invites/${encodeURIComponent(token)}/setup`).then(unwrap),

  accept: (token, { password, code }) =>
    ConsoleAPI.post(`/auth/superadmin/invites/${encodeURIComponent(token)}/accept`, {
      password,
      code,
    }).then(unwrap),
};

export default superAdminInviteService;
