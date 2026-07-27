import ConsoleAPI, { unwrap } from "./consoleHttp";
import { SUPERADMIN_MFA_HEADER } from "./userService";

const stepUpHeaders = (mfaCode) => ({
  headers: { [SUPERADMIN_MFA_HEADER]: mfaCode },
});

/**
 * Platform plan-upgrade request review API. `list` takes an optional status filter (PENDING/APPROVED/
 * REJECTED/CANCELLED; blank = all). Approve/reject are keyed by request `publicId` (UUID); approving
 * activates the tenant's plan, rejecting keeps them put.
 */
export const upgradeRequestService = {
  list: (status) =>
    ConsoleAPI.get("/super-admin/upgrade-requests", { params: status ? { status } : {} }).then(unwrap),

  pendingCount: () =>
    ConsoleAPI.get("/super-admin/upgrade-requests/pending-count").then(unwrap),

  approve: (publicId, mfaCode) =>
    ConsoleAPI.post(`/super-admin/upgrade-requests/${publicId}/approve`, null, stepUpHeaders(mfaCode)).then(unwrap),

  reject: (publicId, reason, mfaCode) =>
    ConsoleAPI.post(`/super-admin/upgrade-requests/${publicId}/reject`, { reason }, stepUpHeaders(mfaCode)).then(unwrap),
};

export default upgradeRequestService;
