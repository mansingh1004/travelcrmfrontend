import ConsoleAPI, { unwrap } from "./consoleHttp";
import { SUPERADMIN_MFA_HEADER } from "./userService";

const stepUpHeaders = (mfaCode) => ({
  headers: { [SUPERADMIN_MFA_HEADER]: mfaCode },
});

/** Platform plan catalogue + subscription ops. */
export const planService = {
  list: () => ConsoleAPI.get("/super-admin/plans").then(unwrap),
  update: (publicId, payload, mfaCode) =>
    ConsoleAPI.put(`/super-admin/plans/${publicId}`, payload, stepUpHeaders(mfaCode)).then(unwrap),
  runExpiry: (mfaCode) =>
    ConsoleAPI.post("/super-admin/subscriptions/run-expiry", null, stepUpHeaders(mfaCode)).then(unwrap),
  // Invoice-dunning sweep: ACTIVE→PAST_DUE (overdue) and PAST_DUE→EXPIRED (past grace).
  runDunning: (mfaCode) =>
    ConsoleAPI.post("/super-admin/subscriptions/run-dunning", null, stepUpHeaders(mfaCode)).then(unwrap),
};

/** Canonical module keys a plan can unlock (display/edit only this phase; enforced in Feature Flags). */
export const ALL_MODULES = [
  "LEADS", "BOOKINGS", "QUOTATIONS", "CUSTOMERS", "MASTERS",
  "VENDORS", "REPORTS", "FLEET", "WHATSAPP", "DISHA_AI", "PORTAL",
];
