import ConsoleAPI, { unwrap } from "./consoleHttp";
import { SUPERADMIN_MFA_HEADER } from "./userService";

/**
 * The SuperAdmin's own account.
 *
 * Distinct from userService, which administers tenant users: `userService.resetPassword` acts on
 * someone else's account by publicId and needs no current password. This one is self-service and
 * proves possession of the existing password first.
 */
const profileService = {
  /** GET the authenticated SuperAdmin's profile. */
  me: () => ConsoleAPI.get("/super-admin/me").then(unwrap),

  /**
   * Change the SuperAdmin's own password.
   *
   * This is the only way to rotate it. Bootstrap passwords are read only when a missing fixed
   * SuperAdmin row is first created, so editing the env file afterwards does nothing. The tenant
   * flow at /auth/change-password 401s a SuperAdmin principal outright.
   */
  changePassword: ({ currentPassword, newPassword, mfaCode }) =>
    ConsoleAPI.post(
      "/super-admin/me/change-password",
      { currentPassword, newPassword },
      { headers: { [SUPERADMIN_MFA_HEADER]: mfaCode } }
    ).then(unwrap),
};

export default profileService;
