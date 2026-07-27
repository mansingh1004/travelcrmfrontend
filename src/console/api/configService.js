import ConsoleAPI, { unwrap } from "./consoleHttp";
import { SUPERADMIN_MFA_HEADER } from "./userService";

const stepUpHeaders = (mfaCode) => ({
  headers: { [SUPERADMIN_MFA_HEADER]: mfaCode },
});

/** Global platform config + maintenance mode. */
export const configService = {
  listConfig: () => ConsoleAPI.get("/super-admin/config").then(unwrap),
  setConfig: (key, value, description, mfaCode) =>
    ConsoleAPI.put(
      `/super-admin/config/${encodeURIComponent(key)}`,
      { value, description },
      stepUpHeaders(mfaCode)
    ).then(unwrap),
  getMaintenance: () => ConsoleAPI.get("/super-admin/maintenance").then(unwrap),
  setMaintenance: (enabled, message, mfaCode) =>
    ConsoleAPI.put("/super-admin/maintenance", { enabled, message }, stepUpHeaders(mfaCode)).then(unwrap),
};
