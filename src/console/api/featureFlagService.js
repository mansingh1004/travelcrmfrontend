import ConsoleAPI, { unwrap } from "./consoleHttp";
import { SUPERADMIN_MFA_HEADER } from "./userService";

const stepUpHeaders = (mfaCode) => ({
  headers: { [SUPERADMIN_MFA_HEADER]: mfaCode },
});

/** Per-tenant module entitlements (Feature Flags). */
export const featureFlagService = {
  getModules: (publicId) =>
    ConsoleAPI.get(`/super-admin/tenants/${publicId}/modules`).then(unwrap),
  updateModules: (publicId, modules, mfaCode) =>
    ConsoleAPI.put(`/super-admin/tenants/${publicId}/modules`, { modules }, stepUpHeaders(mfaCode)).then(unwrap),
};
