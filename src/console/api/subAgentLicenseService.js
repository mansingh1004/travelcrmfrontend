import ConsoleAPI, { unwrap } from "./consoleHttp";
import { SUPERADMIN_MFA_HEADER } from "./userService";

const stepUpHeaders = (mfaCode) => ({
  headers: { [SUPERADMIN_MFA_HEADER]: mfaCode },
});

/**
 * Platform sub-agent (Travel Partner) seat-license request review API — the seat add-on sibling of
 * {@link upgradeRequestService}. `list` takes an optional status filter (PENDING/APPROVED/REJECTED/
 * CANCELLED; blank = all). Approve/reject are keyed by request `publicId` (UUID); approving grants the
 * seats + activates the pending partner, rejecting leaves them PENDING_LICENSE.
 *
 * These requests surface alongside plan upgrades in the one Subscription & Add-on Requests queue.
 */
export const subAgentLicenseService = {
  list: (status) =>
    ConsoleAPI.get("/super-admin/subagent-license-requests", { params: status ? { status } : {} }).then(unwrap),

  pendingCount: () =>
    ConsoleAPI.get("/super-admin/subagent-license-requests/pending-count").then(unwrap),

  approve: (publicId, mfaCode) =>
    ConsoleAPI.post(
      `/super-admin/subagent-license-requests/${publicId}/approve`,
      null,
      stepUpHeaders(mfaCode)
    ).then(unwrap),

  reject: (publicId, reason, mfaCode) =>
    ConsoleAPI.post(
      `/super-admin/subagent-license-requests/${publicId}/reject`,
      { reason },
      stepUpHeaders(mfaCode)
    ).then(unwrap),
};

export default subAgentLicenseService;
