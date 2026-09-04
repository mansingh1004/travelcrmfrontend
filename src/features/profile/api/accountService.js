// src/features/profile/api/accountService.js
// ─────────────────────────────────────────────────────────────────────────────
// The signed-in user's own account. Thin passthrough over @shared/api/http.
//
// Kept in this feature rather than imported from features/subagents (whose
// meService carries the same call for MyProfile): a page in features/profile must
// not reach into another feature's api/, and that barrel does not export it.
// ─────────────────────────────────────────────────────────────────────────────

import API from "@shared/api/http";

const accountService = {
  /**
   * POST /api/auth/change-password  { currentPassword, newPassword } -> ApiResponse<void>
   *
   * Answers the caller directly rather than through the interceptor:
   *   400  "Current password is incorrect."
   *   400  "New password must be different from the current password."
   *   400  validation (blank, or newPassword shorter than 6)
   *   401  no/invalid token, or a SuperAdmin principal — that realm has its own flow at
   *        /api/super-admin/me/change-password
   *
   * All four are the CALL SITE's to render: shared/api/authRealm.js leaves 400 silent by
   * design, and its 401 handling skips any URL with an `auth/` segment, so a wrong password
   * here can never bounce someone to /login mid-form.
   */
  changePassword: (currentPassword, newPassword) =>
    API.post("/auth/change-password", { currentPassword, newPassword }),
};

export default accountService;
