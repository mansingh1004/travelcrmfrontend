// src/shared/lib/access.js
// ─────────────────────────────────────────────────────────────
// Frontend access control — the single source of truth for UI gating.
//
// This MIRRORS the backend permission model (see Permission.java /
// Permission.defaultsFor(Role) and EffectivePermissionResolver). The backend is
// always the real gate (every API is protected by @PreAuthorize); this module only
// decides what to SHOW / hide so users don't see buttons and menus they can't use.
//
// Role is read from localStorage ("userRole"), normalized to a canonical key, then
// mapped to the same default permission keys the backend grants that role.
// ─────────────────────────────────────────────────────────────

import API from "../api/http";

export const ROLES = {
  SUPERADMIN:   "SUPERADMIN",     // platform owner — manages organizations (tenants) only
  TENANT_ADMIN: "TENANT_ADMIN",   // organization admin — full control of its own tenant
  MANAGER:      "MANAGER",
  TRAVEL_AGENT: "TRAVEL_AGENT",
  STAFF:        "STAFF",
  ACCOUNTANT:   "ACCOUNTANT",
  SUB_AGENT:    "SUB_AGENT",      // B2B franchise broker — sees only its OWN rows (backend row-scoped)
};

// Wildcard — TENANT_ADMIN holds every tenant permission.
const ALL = "*";

// Canonical permission keys — identical strings to the backend Permission enum.
export const P = {
  LEAD_READ: "LEAD_READ", LEAD_CREATE: "LEAD_CREATE", LEAD_UPDATE: "LEAD_UPDATE", LEAD_DELETE: "LEAD_DELETE",
  LEAD_PERMANENT_DELETE: "LEAD_PERMANENT_DELETE",
  // Claim window: take a new lead off whoever the auto-assignment gave it to (open leads only),
  // and — separately, manager-only — move or reopen one AFTER first contact locked it.
  LEAD_CLAIM: "LEAD_CLAIM", LEAD_REASSIGN_LOCKED: "LEAD_REASSIGN_LOCKED",
  BOOKING_READ: "BOOKING_READ", BOOKING_CREATE: "BOOKING_CREATE", BOOKING_UPDATE: "BOOKING_UPDATE", BOOKING_CANCEL: "BOOKING_CANCEL", BOOKING_DELETE: "BOOKING_DELETE",
  BOOKING_PROFIT_READ: "BOOKING_PROFIT_READ",
  // High-privilege: override/waive a cancellation charge and disburse refunds. TENANT_ADMIN-only
  // until explicitly granted (mirrors LEAD_PERMANENT_DELETE — not in any non-admin role default).
  BOOKING_REFUND: "BOOKING_REFUND", CANCELLATION_POLICY_MANAGE: "CANCELLATION_POLICY_MANAGE",
  // Amend or delete an already-recorded payment entry. Deliberately asymmetric with RECORDING one,
  // which needs nothing beyond BOOKING_READ: whoever takes the customer's money must be able to book
  // it immediately, but rewriting what the ledger already says is admin territory. TENANT_ADMIN-only
  // until explicitly granted (same treatment as BOOKING_REFUND — in no non-admin role default).
  PAYMENT_MANAGE: "PAYMENT_MANAGE",
  // Work a booking's operations checkpoints — source, confirm, reassign. Its own key rather than
  // BOOKING_UPDATE on purpose: an operations executive marks a hotel confirmed, and must not be
  // able to edit the booking's amount, travel date or status while doing it. READS stay on
  // BOOKING_READ. Unlike PAYMENT_MANAGE this IS in the role defaults below — mirrors the backend.
  OPS_MANAGE: "OPS_MANAGE",
  CUSTOMER_READ: "CUSTOMER_READ", CUSTOMER_CREATE: "CUSTOMER_CREATE", CUSTOMER_UPDATE: "CUSTOMER_UPDATE", CUSTOMER_DELETE: "CUSTOMER_DELETE",
  QUOTATION_READ: "QUOTATION_READ", QUOTATION_CREATE: "QUOTATION_CREATE", QUOTATION_UPDATE: "QUOTATION_UPDATE", QUOTATION_DELETE: "QUOTATION_DELETE",
  VENDOR_READ: "VENDOR_READ", VENDOR_CREATE: "VENDOR_CREATE", VENDOR_UPDATE: "VENDOR_UPDATE", VENDOR_DELETE: "VENDOR_DELETE",
  REMINDER_READ: "REMINDER_READ", REMINDER_CREATE: "REMINDER_CREATE", REMINDER_UPDATE: "REMINDER_UPDATE", REMINDER_DELETE: "REMINDER_DELETE",
  TASK_READ: "TASK_READ", TASK_CREATE: "TASK_CREATE", TASK_UPDATE: "TASK_UPDATE", TASK_DELETE: "TASK_DELETE",
  MASTER_READ: "MASTER_READ", MASTER_MANAGE: "MASTER_MANAGE",
  // Hotel marketplace — the tenant side of the SuperAdmin-owned platform catalog. Separate from
  // MASTER_*: browsing a curated catalog is a different act from maintaining your own master data,
  // and importing (which writes into the hotel master) tracks MASTER_MANAGE-level trust.
  HOTEL_MARKETPLACE_VIEW: "HOTEL_MARKETPLACE_VIEW",
  HOTEL_MARKETPLACE_SYNC_MASTER: "HOTEL_MARKETPLACE_SYNC_MASTER",
  HOTEL_MARKETPLACE_BOOK: "HOTEL_MARKETPLACE_BOOK",
  // Withdraw a pending request, or ask the platform to cancel a confirmed one — one backend endpoint
  // for both, because the tenant's intention is the same and only the server knows whether a room is
  // being held. Separate from BOOK: placing an order and unwinding one confirmed with a hotel (which
  // can carry a cancellation charge) are different authorities.
  HOTEL_MARKETPLACE_CANCEL: "HOTEL_MARKETPLACE_CANCEL",
  // Sight of what the tenant owes the PLATFORM. Separate from BOOKING_PROFIT_READ because a payable
  // is a price, not a margin — gating it behind profit would hide it from TRAVEL_AGENT, the role that
  // actually places the orders and needs the number to quote a customer.
  // Transport marketplace — the same four verbs as hotel, over the platform vehicle catalog. A
  // separate family because the two are separately subscribable add-ons: an agency may buy stays
  // without cars, or cars without stays, and one key covering both would sell them together.
  TRANSPORT_MARKETPLACE_VIEW: "TRANSPORT_MARKETPLACE_VIEW",
  TRANSPORT_MARKETPLACE_SYNC_MASTER: "TRANSPORT_MARKETPLACE_SYNC_MASTER",
  TRANSPORT_MARKETPLACE_BOOK: "TRANSPORT_MARKETPLACE_BOOK",
  TRANSPORT_MARKETPLACE_CANCEL: "TRANSPORT_MARKETPLACE_CANCEL",
  // The SUPPLY side, held by a transport operator on the FLEET plan rather than by a buying agency.
  // Same tenant world, opposite end of the trade.
  TRANSPORT_SUPPLIER_LISTING_MANAGE: "TRANSPORT_SUPPLIER_LISTING_MANAGE",
  TRANSPORT_SUPPLIER_ORDER_MANAGE: "TRANSPORT_SUPPLIER_ORDER_MANAGE",
  // Sight of what the tenant owes the PLATFORM. Separate from BOOKING_PROFIT_READ because a payable
  // is a price, not a margin — gating it behind profit would hide it from TRAVEL_AGENT, the role that
  // actually places the orders and needs the number to quote a customer. Covers BOTH marketplaces:
  // hotel and transport payables share the CRM expense column its filter keys on.
  MARKETPLACE_PAYABLE_READ: "MARKETPLACE_PAYABLE_READ",
  USER_READ: "USER_READ", USER_CREATE: "USER_CREATE", USER_UPDATE: "USER_UPDATE", USER_DELETE: "USER_DELETE",
  REPORT_VIEW: "REPORT_VIEW",
  SETTINGS_MANAGE: "SETTINGS_MANAGE",
  // Communication. COMM_READ also gates the in-app Mailbox (features/mailbox) — reading the
  // agency's own inbox is the same authority as reading its conversations, so it deliberately
  // does NOT get a permission of its own.
  COMM_READ: "COMM_READ",
  // The RAW agency mailbox (/api/mailbox), deliberately NOT COMM_READ. COMM_READ carries the
  // own/team/all data scope the Communication Center enforces per conversation; the shared IMAP
  // mailbox has no assignee to scope by, so one key across both let an OWN-scoped agent read the
  // whole tenant's mail through a second URL. Backend default: MANAGER and TENANT_ADMIN only.
  COMM_MAILBOX_READ: "COMM_MAILBOX_READ",
  // Replying is a separate authority from reading, and the split is load-bearing: the backend's
  // viewer role deliberately holds READ without SEND, so reusing COMM_READ on a composer would hand
  // every viewer a send button the server then 403s.
  COMM_SEND: "COMM_SEND",
  // Triage: assign, snooze, close. A supervisor act — the backend gives it to MANAGER and
  // withholds it from TRAVEL_AGENT, whose job is answering conversations rather than deciding
  // whose they are.
  COMM_ASSIGN: "COMM_ASSIGN",
  // NOT in any role's defaults, on purpose — the backend grants templates, private notes, recordings
  // and workflow config PER USER, TENANT_ADMIN included (Permission.java). A tenant admin still sees
  // this screen because hasPermission() short-circuits for that role, but the save will 403 until the
  // key is granted under Users → permissions. That is the backend's rule, not a bug here.
  COMM_TEMPLATE_MANAGE: "COMM_TEMPLATE_MANAGE",
  TRASH_VIEW: "TRASH_VIEW", TRASH_RESTORE: "TRASH_RESTORE", TRASH_DELETE: "TRASH_DELETE",
  FLEET_READ: "FLEET_READ", FLEET_CREATE: "FLEET_CREATE", FLEET_UPDATE: "FLEET_UPDATE", FLEET_DELETE: "FLEET_DELETE",
  // Fleet MONEY is a separate authority from fleet operations: a dispatcher records forty cost rows
  // a day off a bundle of receipts without ever being able to settle a driver's cash or close a
  // period. FLEET_MONEY_SETTLE is granted deliberately per user — it is NOT inherited from managing
  // the fleet, because settling freezes a sheet and freezing is irreversible.
  FLEET_MONEY_READ: "FLEET_MONEY_READ", FLEET_MONEY_SETTLE: "FLEET_MONEY_SETTLE",
  FLEET_PERIOD_CLOSE: "FLEET_PERIOD_CLOSE",
  // Accounting / GST — invoices + tax masters, vendor bills + TDS/TCS, GST settings.
  ACCOUNTING_INVOICE_READ: "ACCOUNTING_INVOICE_READ", ACCOUNTING_INVOICE_MANAGE: "ACCOUNTING_INVOICE_MANAGE",
  ACCOUNTING_TDS_READ: "ACCOUNTING_TDS_READ", ACCOUNTING_TDS_MANAGE: "ACCOUNTING_TDS_MANAGE",
  ACCOUNTING_SETTINGS_MANAGE: "ACCOUNTING_SETTINGS_MANAGE",
  // Marketing & Campaigns — segments, broadcasts, drip sequences, auto-triggers.
  // MARKETING_SEND is the high-privilege "pull the trigger" gate (broadcast / activate a drip / fire a test).
  MARKETING_READ: "MARKETING_READ", MARKETING_CREATE: "MARKETING_CREATE", MARKETING_UPDATE: "MARKETING_UPDATE",
  MARKETING_DELETE: "MARKETING_DELETE", MARKETING_SEND: "MARKETING_SEND",
};

// Role → default permission keys. Mirrors backend Permission.defaultsFor(Role).
// (Per-user overrides will be layered on once the backend exposes the current
//  user's effective permissions; until then role defaults drive the UI.)
const ROLE_PERMISSIONS = {
  // Platform owner: NO tenant CRM permissions — only the Organizations area.
  [ROLES.SUPERADMIN]: [],

  // Organization admin: everything inside its tenant.
  [ROLES.TENANT_ADMIN]: [ALL],

  [ROLES.MANAGER]: [
    P.LEAD_READ, P.LEAD_CREATE, P.LEAD_UPDATE, P.LEAD_DELETE,
    // Works the pipeline AND supervises it. Mirrors Permission.defaultsFor(MANAGER) and the
    // V2 PART 18 backfill's MANAGER branch.
    P.LEAD_CLAIM, P.LEAD_REASSIGN_LOCKED,
    P.BOOKING_READ, P.BOOKING_CREATE, P.BOOKING_UPDATE, P.BOOKING_CANCEL, P.BOOKING_DELETE, P.BOOKING_PROFIT_READ,
    // Runs the operations board. Mirrors defaultsFor(MANAGER) and the V29 backfill.
    P.OPS_MANAGE,
    P.CUSTOMER_READ, P.CUSTOMER_CREATE, P.CUSTOMER_UPDATE, P.CUSTOMER_DELETE,
    P.QUOTATION_READ, P.QUOTATION_CREATE, P.QUOTATION_UPDATE, P.QUOTATION_DELETE,
    P.VENDOR_READ, P.VENDOR_CREATE, P.VENDOR_UPDATE,
    P.REMINDER_READ, P.REMINDER_CREATE, P.REMINDER_UPDATE, P.REMINDER_DELETE,
    P.TASK_READ, P.TASK_CREATE, P.TASK_UPDATE, P.TASK_DELETE,
    P.MASTER_READ, P.MASTER_MANAGE, P.REPORT_VIEW, P.USER_READ,
    // Importing a platform hotel writes into the hotel master, so it tracks MASTER_MANAGE.
    // Mirrors Permission.defaultsFor(MANAGER) — Permission.java:217-218.
    P.HOTEL_MARKETPLACE_VIEW, P.HOTEL_MARKETPLACE_SYNC_MASTER,
    P.HOTEL_MARKETPLACE_BOOK, P.HOTEL_MARKETPLACE_CANCEL, P.MARKETPLACE_PAYABLE_READ,
    // Transport mirrors hotel exactly — same four verbs, same audience. Permission.java:379-380.
    P.TRANSPORT_MARKETPLACE_VIEW, P.TRANSPORT_MARKETPLACE_SYNC_MASTER,
    P.TRANSPORT_MARKETPLACE_BOOK, P.TRANSPORT_MARKETPLACE_CANCEL,
    // Mirrors Permission.defaultsFor(MANAGER) exactly — sees fleet money, does NOT settle it.
    P.FLEET_READ, P.FLEET_CREATE, P.FLEET_UPDATE, P.FLEET_DELETE, P.FLEET_MONEY_READ,
    P.ACCOUNTING_INVOICE_READ, P.ACCOUNTING_TDS_READ,
    P.MARKETING_READ, P.MARKETING_CREATE, P.MARKETING_UPDATE, P.MARKETING_DELETE, P.MARKETING_SEND,
  ],

  // Travel Agent and Staff share the same access (matches backend).
  [ROLES.TRAVEL_AGENT]: [
    P.LEAD_READ, P.LEAD_CREATE, P.LEAD_UPDATE,
    // Claims open leads; deliberately NOT LEAD_REASSIGN_LOCKED — once a colleague has spoken to
    // the customer, taking the lead is a manager's call. Mirrors defaultsFor(TRAVEL_AGENT).
    P.LEAD_CLAIM,
    P.BOOKING_READ, P.BOOKING_CREATE, P.BOOKING_UPDATE,
    // Agents deliver the trips they sell — chasing a hotel is the job, not a privilege.
    P.OPS_MANAGE,
    P.CUSTOMER_READ, P.CUSTOMER_CREATE, P.CUSTOMER_UPDATE,
    P.QUOTATION_READ, P.QUOTATION_CREATE, P.QUOTATION_UPDATE,
    P.VENDOR_READ,
    P.REMINDER_READ, P.REMINDER_CREATE, P.REMINDER_UPDATE,
    P.TASK_READ, P.TASK_CREATE, P.TASK_UPDATE,
    P.MASTER_READ, P.REPORT_VIEW,
    // Browse the catalog, but no SYNC_MASTER: importing writes master data and this role holds only
    // MASTER_READ. Grant it per-user where an agent needs to import. Mirrors the backend.
    // BOOK and MARKETPLACE_PAYABLE_READ *are* granted (Permission.java:241): this is the role that
    // actually places marketplace orders, and the payable is a price it must know to quote the
    // customer — not a margin. Margin stays behind BOOKING_PROFIT_READ, which this role lacks.
    // CANCEL is granted too (Permission.java:252): the role that places the order is the one that
    // has to unwind it when the customer drops out, and withdrawing an unconfirmed request is free.
    P.HOTEL_MARKETPLACE_VIEW, P.HOTEL_MARKETPLACE_BOOK, P.HOTEL_MARKETPLACE_CANCEL,
    // No SYNC_MASTER, exactly as with hotels: a sales role books, it does not curate masters.
    // Permission.java:423.
    P.TRANSPORT_MARKETPLACE_VIEW, P.TRANSPORT_MARKETPLACE_BOOK, P.TRANSPORT_MARKETPLACE_CANCEL,
    P.MARKETPLACE_PAYABLE_READ,
    // Deliberately NO FLEET_MONEY_*: a sales role plans and runs trips, but tenant-wide driver cash
    // positions, vendor rates and cost structure are not its business. Mirrors the backend.
    P.FLEET_READ, P.FLEET_CREATE, P.FLEET_UPDATE,
    P.MARKETING_READ,
  ],

  [ROLES.ACCOUNTANT]: [
    P.BOOKING_READ, P.BOOKING_UPDATE, P.BOOKING_PROFIT_READ,
    P.CUSTOMER_READ,
    P.QUOTATION_READ,
    P.VENDOR_READ, P.VENDOR_UPDATE,
    P.TASK_READ, P.TASK_CREATE, P.TASK_UPDATE,
    P.REPORT_VIEW, P.MASTER_READ,
    // The settlement + period-close authority for fleet money — the role whose job it literally is.
    P.FLEET_READ, P.FLEET_MONEY_READ, P.FLEET_MONEY_SETTLE, P.FLEET_PERIOD_CLOSE,
    // Accounting is the accountant's core surface: full invoice + TDS/TCS + tax config.
    P.ACCOUNTING_INVOICE_READ, P.ACCOUNTING_INVOICE_MANAGE,
    P.ACCOUNTING_TDS_READ, P.ACCOUNTING_TDS_MANAGE, P.ACCOUNTING_SETTINGS_MANAGE,
  ],

  // B2B franchise broker: works ONLY on its own leads/quotes/bookings/customers/reminders
  // (backend row-scopes every read to the owner). Mirrors backend Permission.defaultsFor(SUB_AGENT).
  // NO USER_*, NO CRM_FULL, NO reports/settings — this is only the pre-cache fallback; the real
  // effective keys come from /permissions/me.
  [ROLES.SUB_AGENT]: [
    P.LEAD_READ, P.LEAD_CREATE, P.LEAD_UPDATE, P.LEAD_DELETE,
    P.QUOTATION_READ, P.QUOTATION_CREATE, P.QUOTATION_UPDATE, P.QUOTATION_DELETE,
    P.BOOKING_READ, P.BOOKING_CREATE, P.BOOKING_UPDATE,
    // Its OWN bookings only — the board already row-scopes a sub-agent's rows, so this
    // grants the work, not the reach. Mirrors backend Permission.defaultsFor(SUB_AGENT).
    P.OPS_MANAGE,
    P.CUSTOMER_READ, P.CUSTOMER_CREATE, P.CUSTOMER_UPDATE,
    P.REMINDER_READ, P.REMINDER_CREATE, P.REMINDER_UPDATE,
    P.TASK_READ, P.TASK_CREATE, P.TASK_UPDATE,
    P.MASTER_READ,
  ],
};
// STAFF is deny-by-default — no permissions until a TENANT_ADMIN grants them. This is only
// the pre-login fallback; once /permissions/me is cached, the real effective keys drive the UI.
ROLE_PERMISSIONS[ROLES.STAFF] = [];

// Normalize whatever login stored ("SUPER_ADMIN", "super_admin", "ROLE_SUPER_ADMIN",
// "Organization Admin", "admin", "user"…) to a canonical ROLES key.
export function getRole() {
  const raw = (localStorage.getItem("userRole") || "")
    .toString().trim().toUpperCase()
    .replace(/[\s-]+/g, "_")
    .replace(/^ROLE_/, "");

  const aliases = {
    SUPER_ADMIN: ROLES.SUPERADMIN, SUPERADMIN: ROLES.SUPERADMIN, PLATFORM_ADMIN: ROLES.SUPERADMIN,
    ORGANIZATION_ADMIN: ROLES.TENANT_ADMIN, TENANT_ADMIN: ROLES.TENANT_ADMIN, ADMIN: ROLES.TENANT_ADMIN,
    MANAGER: ROLES.MANAGER,
    TRAVEL_AGENT: ROLES.TRAVEL_AGENT, AGENT: ROLES.TRAVEL_AGENT,
    STAFF: ROLES.STAFF, USER: ROLES.STAFF,
    ACCOUNTANT: ROLES.ACCOUNTANT, ACCOUNT: ROLES.ACCOUNTANT,
    SUB_AGENT: ROLES.SUB_AGENT, SUBAGENT: ROLES.SUB_AGENT,
  };
  return aliases[raw] || raw || ROLES.STAFF;
}

export function isSuperAdmin()  { return getRole() === ROLES.SUPERADMIN; }
export function isTenantAdmin() { return getRole() === ROLES.TENANT_ADMIN; }
export function isManager()     { return getRole() === ROLES.MANAGER; }
export function isSubAgent()    { return getRole() === ROLES.SUB_AGENT; }

const PERMS_KEY = "userPermissions";
const MODULES_KEY = "tenantModules";
// Deployment product mode from /me/entitlements — cached alongside modules and cleared with them,
// so the two can never disagree about which product the user is looking at.
const MODE_KEY = "productMode";

// Base URL for the bare-fetch prime call (see primeSessionCaches) that must NOT go through the
// staff-realm axios interceptor. Mirrors http.js / ImpersonationBanner.
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

// Fetch the CURRENT user's EFFECTIVE permissions from the backend (role default
// overlaid with their saved per-user map) and cache them. Call right after login.
export async function loadMyPermissions() {
  try {
    const res  = await API.get("/permissions/me");
    const body = res?.data?.data ?? res?.data ?? {};
    const keys = Array.isArray(body.permissions) ? body.permissions : [];
    localStorage.setItem(PERMS_KEY, JSON.stringify(keys));
    localStorage.setItem("isPlatformAdmin", body.platformAdmin ? "1" : "0");
    return keys;
  } catch {
    localStorage.removeItem(PERMS_KEY);  // fall back to role defaults
    return null;
  }
}

export function clearMyPermissions() {
  localStorage.removeItem(PERMS_KEY);
  localStorage.removeItem("isPlatformAdmin");
  localStorage.removeItem(MODULES_KEY);
}

// ── Module entitlements (tenant plan) ─────────────────────────────────────────
// Which whole MODULES the tenant's plan unlocks (Feature Flags) — distinct from permissions,
// which gate a user's actions. The backend is always the real gate; this only HIDES modules the
// plan excludes so staff don't see menus their organization hasn't bought.

// Fetch + cache the tenant's effective modules. Call right after login (next to loadMyPermissions).
export async function loadMyEntitlements() {
  try {
    const res  = await API.get("/me/entitlements");
    const body = res?.data?.data ?? res?.data ?? {};
    const modules = Array.isArray(body.modules) ? body.modules : [];
    localStorage.setItem(MODULES_KEY, JSON.stringify(modules));
    if (body.productMode) localStorage.setItem(MODE_KEY, body.productMode);
    else localStorage.removeItem(MODE_KEY);
    return modules;
  } catch {
    localStorage.removeItem(MODULES_KEY);   // unknown → fail-open (show everything)
    localStorage.removeItem(MODE_KEY);
    return null;
  }
}

export function clearMyEntitlements() {
  localStorage.removeItem(MODULES_KEY);
  localStorage.removeItem(MODE_KEY);
}

// ── Product mode (deployment-level) ───────────────────────────────────────────
// Which PRODUCT this deployment is: "CRM_SUITE" or "FLEET_STANDALONE". Distinct from modules,
// and both matter — modules say what this TENANT bought, this says whether a CRM exists here at
// all. A fleet-only tenant on a CRM deployment still has an upgrade path to show them.

/** True when this deployment ships Vehicle Diary on its own, with no CRM behind it. */
export function isFleetStandalone() {
  return localStorage.getItem(MODE_KEY) === "FLEET_STANDALONE";
}

/**
 * True when this session should render the fleet-only shell — either the deployment IS the fleet
 * product, or this tenant's plan unlocks nothing but FLEET.
 *
 * FAILS CLOSED, unlike `hasModule`: an unknown or unloaded cache returns false, so a CRM customer
 * whose entitlement fetch hiccuped sees the full app rather than losing every menu they own. The
 * cost of being wrong is asymmetric here — hiding a fleet menu is a nuisance, hiding a whole CRM
 * looks like data loss.
 */
export function isFleetOnly() {
  if (isFleetStandalone()) return true;
  try {
    const stored = JSON.parse(localStorage.getItem(MODULES_KEY) || "null");
    return Array.isArray(stored) && stored.length === 1 && stored[0] === "FLEET";
  } catch {
    return false;
  }
}

// ── Impersonation session priming (role-agnostic) ─────────────────────────────
// Resolve + cache the effective permissions AND module entitlements for an EXPLICIT token, using a
// bare fetch that BYPASSES the staff-realm axios interceptor (so a transient 401 can never redirect
// the CONSOLE tab that primes the session). The impersonation hand-off calls this under the freshly
// minted token BEFORE opening the tenant tab, so the tenant app renders from the impersonated user's
// OWN access on its very first paint — never the browser's prior (possibly elevated) tenant cache.
//
// Works for EVERY role: /permissions/me returns exactly that user's effective keys (STAFF → none,
// MANAGER/AGENT/ACCOUNTANT → their set, TENANT_ADMIN → all). On any failure the relevant cache is
// CLEARED, so hasPermission falls back to the impersonated user's ROLE defaults — safe, never stale.
export async function primeSessionCaches(token) {
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };

  const permissions = (async () => {
    try {
      const res = await fetch(`${API_BASE}/permissions/me`, { headers });
      if (!res.ok) throw new Error(`permissions/me ${res.status}`);
      const body = await res.json();
      const data = body?.data ?? body ?? {};
      const keys = Array.isArray(data.permissions) ? data.permissions : [];
      localStorage.setItem(PERMS_KEY, JSON.stringify(keys));
      localStorage.setItem("isPlatformAdmin", data.platformAdmin ? "1" : "0");
    } catch {
      clearMyPermissions();   // → role-default fallback, never a stale elevated cache
    }
  })();

  const entitlements = (async () => {
    try {
      const res = await fetch(`${API_BASE}/me/entitlements`, { headers });
      if (!res.ok) throw new Error(`me/entitlements ${res.status}`);
      const body = await res.json();
      const data = body?.data ?? body ?? {};
      const modules = Array.isArray(data.modules) ? data.modules : [];
      localStorage.setItem(MODULES_KEY, JSON.stringify(modules));
      if (data.productMode) localStorage.setItem(MODE_KEY, data.productMode);
      else localStorage.removeItem(MODE_KEY);
    } catch {
      clearMyEntitlements();  // unknown → fail-open (hasModule shows all), same as login path
    }
  })();

  await Promise.all([permissions, entitlements]);
}

// True if the tenant's plan includes `moduleKey`. FAIL-OPEN: until entitlements load (or if the
// fetch failed) every module shows — the soft-gate only ever HIDES a module we KNOW is excluded,
// never blocks one on a missing/failed fetch. Module access is a tenant/plan property, so even
// TENANT_ADMIN is bound by it (no role bypass here, unlike hasPermission).
export function hasModule(moduleKey) {
  try {
    const stored = JSON.parse(localStorage.getItem(MODULES_KEY) || "null");
    if (Array.isArray(stored)) return stored.includes(moduleKey);
  } catch { /* malformed cache → fail-open */ }
  return true;
}

/**
 * Same question as {@link hasModule}, but FAILS CLOSED: an unloaded, missing or malformed
 * entitlements cache answers false.
 *
 * Use this when the module selects BETWEEN two working implementations rather than hiding a menu.
 * `hasModule` is fail-open so a failed fetch never blocks a customer out of something they bought —
 * right for a sidebar item, wrong here: fail-open would hand a plan-exclusive screen to every tenant
 * for the whole window before entitlements land, and again to anyone whose fetch failed. There is no
 * loss in failing closed, because the other branch is a complete, working form.
 *
 * Deliberately no TENANT_ADMIN bypass, matching `hasModule` — a module is a tenant/plan property,
 * not a role one, so an admin on a plan without the key is in the same position as their staff.
 */
export function hasModuleStrict(moduleKey) {
  try {
    const stored = JSON.parse(localStorage.getItem(MODULES_KEY) || "null");
    return Array.isArray(stored) && stored.includes(moduleKey);
  } catch {
    return false;
  }
}

/** Module key for the high-volume Create Lead / Create Booking screens. Carried by GROWTH alone. */
export const FAST_ENTRY_FORMS = "FAST_ENTRY_FORMS";

// True if the current user is allowed `permissionKey`.
// Prefers the user's REAL effective permissions (from /permissions/me); falls back
// to role defaults until that fetch has run (or if it failed).
export function hasPermission(permissionKey) {
  // Org admin holds EVERY tenant permission (mirrors the backend TENANT_ADMIN bypass). Short-circuit
  // so the admin always sees every action — including permission keys added after their cached login
  // snapshot — without needing to re-log in (e.g. a newly-introduced BOOKING_CANCEL button).
  if (isTenantAdmin()) return true;
  try {
    const stored = JSON.parse(localStorage.getItem(PERMS_KEY) || "null");
    if (Array.isArray(stored)) return stored.includes(permissionKey);
  } catch { /* malformed cache → fall through to role defaults */ }
  const perms = ROLE_PERMISSIONS[getRole()] || [];
  return perms.includes(ALL) || perms.includes(permissionKey);
}

// True if the user has ANY of the given keys (handy for whole sidebar sections).
export function hasAnyPermission(...keys) {
  return keys.some((k) => hasPermission(k));
}

export default { ROLES, P, getRole, isSuperAdmin, isTenantAdmin, isManager, isSubAgent, hasPermission, hasAnyPermission, hasModule, loadMyPermissions, clearMyPermissions, loadMyEntitlements, clearMyEntitlements, primeSessionCaches };
