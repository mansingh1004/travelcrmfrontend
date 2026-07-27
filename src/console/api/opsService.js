import ConsoleAPI from "./consoleHttp";
import { SUPERADMIN_MFA_HEADER } from "./userService";

const stepUpHeaders = (mfaCode) => ({
  headers: { [SUPERADMIN_MFA_HEADER]: mfaCode },
});

/** Ops / Danger Zone — data export + irreversible tenant hard-delete. */
export const opsService = {
  downloadTenantsCsv: async (mfaCode) => {
    const res = await ConsoleAPI.get("/super-admin/export/tenants.csv", {
      responseType: "blob",
      ...stepUpHeaders(mfaCode),
    });
    return res.data; // Blob
  },
  hardDeleteTenant: (publicId, organizationCode, mfaCode) =>
    ConsoleAPI.post(
      `/super-admin/tenants/${publicId}/hard-delete`,
      { organizationCode },
      stepUpHeaders(mfaCode)
    ),
};
