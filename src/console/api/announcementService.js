import ConsoleAPI, { unwrap } from "./consoleHttp";
import { SUPERADMIN_MFA_HEADER } from "./userService";

const stepUpHeaders = (mfaCode) => ({
  headers: { [SUPERADMIN_MFA_HEADER]: mfaCode },
});

/** Platform announcements (broadcast → tenants). */
export const announcementService = {
  send: (payload, mfaCode) =>
    ConsoleAPI.post("/super-admin/announcements", payload, stepUpHeaders(mfaCode)).then(unwrap),
  history: async ({ page = 0, size = 20 } = {}) => {
    const res = await ConsoleAPI.get("/super-admin/announcements", { params: { page, size } });
    const body = res?.data ?? {};
    return { rows: body.data ?? [], pagination: body.pagination ?? {} };
  },
};
