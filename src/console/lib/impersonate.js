import { clearMyEntitlements, clearMyPermissions, primeSessionCaches } from "@shared/lib/access";

import { userService } from "../api/userService";

/**
 * Open a tenant session as one of that tenant's users.
 *
 * <p>This lives in one place because the sequence is a security boundary, not a convenience. The
 * staff realm caches permissions and module entitlements in localStorage, and those caches survive a
 * token swap — so writing the impersonation token WITHOUT clearing them leaves the previous
 * session's permission set in front of the impersonated user. That is the known impersonation leak,
 * and it is a copy-paste away from coming back every time a second screen grows an "Open as" button.
 *
 * <p>Order matters and is not cosmetic:
 * <ol>
 *   <li>write the token first — {@link primeSessionCaches} authenticates with it;</li>
 *   <li>clear both caches BEFORE priming, or the prime merges onto stale keys;</li>
 *   <li>await the prime, so the new tab opens against caches that are already correct rather than
 *       racing a fetch it cannot see.</li>
 * </ol>
 *
 * <p>Step-up MFA is required by the endpoint, not by this function — the caller collects the code.
 *
 * @param {{publicId: string}} user  the tenant user to open a session as
 * @param {string} mfaCode           the SuperAdmin's current authenticator code
 * @returns {Promise<object>}        the impersonation payload, for the caller's toast
 */
export async function startImpersonation(user, mfaCode) {
  const data = await userService.impersonate(user.publicId, mfaCode);

  localStorage.setItem("token", data.token);
  localStorage.setItem("userEmail", data.email);
  localStorage.setItem("userRole", data.role);
  /* Read by app/chrome/ImpersonationBanner — a persistent banner for the whole session is the
     point, not decoration: an operator who forgets they are inside someone else's account will
     eventually act as them by accident. */
  localStorage.setItem("impersonation", JSON.stringify({
    name: data.name,
    email: data.email,
    tenantName: data.tenantName,
    tenantCode: data.tenantCode,
    startedAt: Date.now(),
  }));

  clearMyPermissions();
  clearMyEntitlements();
  await primeSessionCaches(data.token);

  /* A NEW TAB, never this one. The console runs on `sa_token` and the tenant app on `token`; both
     live in the same origin's localStorage, so navigating this tab would leave the operator inside
     a tenant with no way back to the console except retyping the URL. */
  window.open("/", "_blank", "noopener");
  return data;
}

export default startImpersonation;
