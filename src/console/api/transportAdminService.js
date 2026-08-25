// src/console/api/transportAdminService.js
//
// The SuperAdmin side of the Transport Marketplace: the vehicle catalog the platform owns, the queue
// of orders tenants have asked for, and the duty slips issued against them.
//
// Platform realm: ConsoleAPI carries `sa_token`, so a 401 bounces to the CONSOLE login, never the
// tenant one.
//
// ⚠ MONEY ASYMMETRY, and it is the point. The admin DTO carries `supplierAmount` and
// `platformEarning`; the tenant DTO carries neither, and an ArchUnit test fails the build if one
// ever appears there. Nothing in this file may be mirrored into a tenant service.

import ConsoleAPI, { unwrap } from "./consoleHttp";
import { SUPERADMIN_MFA_HEADER } from "./userService";

const CATALOG = "/super-admin/transport-marketplace";
const ORDERS = "/super-admin/transport-marketplace/orders";
const COMMISSIONS = "/super-admin/transport-marketplace/commissions";

/**
 * Step-up MFA. Every verb that commits a journey, moves a document or touches the earnings ledger
 * carries it; reads and the two triage verbs (review, request-revision) do not.
 */
const stepUpHeaders = (mfaCode) => ({ headers: { [SUPERADMIN_MFA_HEADER]: mfaCode } });

/** Drop empty filters — an empty string is a *value* to a Spring `@RequestParam`, not "no filter". */
function clean(params) {
  const out = {};
  for (const [key, value] of Object.entries(params || {})) {
    if (value === "" || value === null || value === undefined) continue;
    out[key] = value;
  }
  return out;
}

export const transportAdminService = {
  // ── The catalog ─────────────────────────────────────────────────────────

  /**
   * Paged, so it returns `{rows, pagination}` rather than going through `unwrap` — the envelope puts
   * the rows in `data` and the meta in `pagination`, and unwrapping would drop the half the pager
   * needs. Same shape as `announcementService.history`.
   */
  listVehicles: async (params = {}) => {
    const res = await ConsoleAPI.get(`${CATALOG}/vehicles`, { params: clean(params) });
    const body = res?.data ?? {};
    return { rows: body.data ?? [], pagination: body.pagination ?? {} };
  },

  getVehicle: async (publicId) => unwrap(await ConsoleAPI.get(`${CATALOG}/vehicles/${publicId}`)),

  /*
   * EVERY WRITE BELOW TAKES `mfaCode`, and every one of them needs it.
   *
   * The backend has always required step-up on these — create, update, publish, unpublish, delete
   * and all three rate verbs each carry `@RequireSuperAdminStepUp`, and `SuperAdminStepUpAspect`
   * reads `X-SuperAdmin-Mfa-Code` off the request. This file used to send none of them. It looked
   * like it worked because `SuperAdminStepUpService.requireCode` returns early when dev-login mode
   * is on, which it is locally and is not in production: there, every save on this screen was a 403
   * nobody could get past. Do not drop the argument to "simplify" a call — a missing code is not a
   * silent no-op.
   */

  createVehicle: async (payload, mfaCode) =>
    unwrap(await ConsoleAPI.post(`${CATALOG}/vehicles`, payload, stepUpHeaders(mfaCode))),

  updateVehicle: async (publicId, payload, mfaCode) =>
    unwrap(await ConsoleAPI.put(`${CATALOG}/vehicles/${publicId}`, payload, stepUpHeaders(mfaCode))),

  /**
   * Put a photo on the CDN and hand back its URL; the URL only becomes catalog when the vehicle is
   * saved, which is why this one carries NO step-up. The twin of `platformHotelService.uploadImage`.
   *
   * Content-Type is set explicitly here to match that twin. The browser would set a correct
   * multipart boundary on its own, so this is belt-and-braces rather than load-bearing.
   */
  uploadImage: async (file, onUploadProgress) => {
    const body = new FormData();
    body.append("file", file);
    const res = await ConsoleAPI.post(`${CATALOG}/vehicles/upload-image`, body, {
      headers: { "Content-Type": "multipart/form-data" },
      // Generous on purpose: a 10 MB photo on a slow uplink beats the shared 30s default, and an
      // axios timeout arrives with no `error.response` at all, so it reads as a network failure.
      timeout: 120000,
      onUploadProgress,
    });
    return unwrap(res)?.imagePath ?? null;
  },

  /**
   * Publish is what makes a product visible to tenants; approve/create only mints a DRAFT.
   *
   * Unpublishing blocks NEW sale and damages nothing already sold — existing orders, assignments and
   * duty slips are untouched, and tenants that imported a projection keep it.
   */
  publishVehicle: async (publicId, mfaCode) =>
    unwrap(await ConsoleAPI.post(`${CATALOG}/vehicles/${publicId}/publish`, null, stepUpHeaders(mfaCode))),
  unpublishVehicle: async (publicId, mfaCode) =>
    unwrap(await ConsoleAPI.post(`${CATALOG}/vehicles/${publicId}/unpublish`, null, stepUpHeaders(mfaCode))),

  /** Refuses while any tenant holds a projection — the count is what makes it refuse. */
  deleteVehicle: async (publicId, mfaCode) =>
    unwrap(await ConsoleAPI.delete(`${CATALOG}/vehicles/${publicId}`, stepUpHeaders(mfaCode))),

  // Rate cards are DISPLAY-ONLY in v1: they drive no pricing and no tenant ever sees `netRate`.
  // They exist so the operator's contracted terms are on screen while an approval figure is typed.
  addRate: async (publicId, payload, mfaCode) =>
    unwrap(await ConsoleAPI.post(`${CATALOG}/vehicles/${publicId}/rates`, payload, stepUpHeaders(mfaCode))),
  updateRate: async (publicId, ratePublicId, payload, mfaCode) =>
    unwrap(await ConsoleAPI.put(`${CATALOG}/vehicles/${publicId}/rates/${ratePublicId}`, payload, stepUpHeaders(mfaCode))),
  deleteRate: async (publicId, ratePublicId, mfaCode) =>
    unwrap(await ConsoleAPI.delete(`${CATALOG}/vehicles/${publicId}/rates/${ratePublicId}`, stepUpHeaders(mfaCode))),

  // ── The order queue ─────────────────────────────────────────────────────

  /** Paged — returns `{rows, pagination}`. See the note on `listVehicles`. */
  listOrders: async (params = {}) => {
    const res = await ConsoleAPI.get(ORDERS, { params: clean(params) });
    const body = res?.data ?? {};
    return { rows: body.data ?? [], pagination: body.pagination ?? {} };
  },

  /** For the nav badge. Cheap enough to poll; returns a bare count. */
  pendingCount: async () => unwrap(await ConsoleAPI.get(`${ORDERS}/pending-count`)),

  getOrder: async (publicId) => unwrap(await ConsoleAPI.get(`${ORDERS}/${publicId}`)),

  /** Triage only — "I am looking at this". No step-up: it commits nothing. */
  review: async (publicId) => unwrap(await ConsoleAPI.post(`${ORDERS}/${publicId}/review`)),

  /**
   * Put a different price back to the tenant. No step-up either: the tenant still has to accept it,
   * and a final approval — which DOES carry step-up — is what commits the journey.
   */
  requestRevision: async (publicId, payload) =>
    unwrap(await ConsoleAPI.post(`${ORDERS}/${publicId}/request-revision`, payload)),

  /**
   * Confirm the journey. Creates ONE CRM service line on the tenant's booking and exactly one
   * PENDING commission accrual; after a revision it refuses any figure the tenant did not accept.
   */
  approve: async (publicId, payload, mfaCode) =>
    unwrap(await ConsoleAPI.post(`${ORDERS}/${publicId}/approve`, payload, stepUpHeaders(mfaCode))),

  reject: async (publicId, reason, mfaCode) =>
    unwrap(await ConsoleAPI.post(`${ORDERS}/${publicId}/reject`, null, {
      ...stepUpHeaders(mfaCode),
      params: clean({ reason }),
    })),

  /** Answer a tenant's cancellation request with a charge. They then accept or decline it. */
  quoteCancellation: async (publicId, payload, mfaCode) =>
    unwrap(await ConsoleAPI.post(`${ORDERS}/${publicId}/quote-cancellation`, payload, stepUpHeaders(mfaCode))),

  cancel: async (publicId, payload, mfaCode) =>
    unwrap(await ConsoleAPI.post(`${ORDERS}/${publicId}/cancel`, payload, stepUpHeaders(mfaCode))),

  /**
   * Name the vehicle and driver. Versioned: a change reissues the duty slip and moves NO money.
   * This is also the step that provisions a FleetTrip in the OPERATOR's own tenant.
   */
  assign: async (publicId, payload, mfaCode) =>
    unwrap(await ConsoleAPI.post(`${ORDERS}/${publicId}/assignments`, payload, stepUpHeaders(mfaCode))),

  unassign: async (publicId, reason, mfaCode) =>
    unwrap(await ConsoleAPI.delete(`${ORDERS}/${publicId}/assignments`, {
      ...stepUpHeaders(mfaCode),
      params: clean({ reason }),
    })),

  // ── The duty slip ───────────────────────────────────────────────────────

  issueVoucher: async (publicId, mfaCode) =>
    unwrap(await ConsoleAPI.post(`${ORDERS}/${publicId}/voucher/issue`, null, stepUpHeaders(mfaCode))),

  revokeVoucher: async (publicId, reason, mfaCode) =>
    unwrap(await ConsoleAPI.post(`${ORDERS}/${publicId}/voucher/revoke`, null, {
      ...stepUpHeaders(mfaCode),
      params: clean({ reason }),
    })),

  /**
   * Attach the operator's OWN duty slip, and serve that from then on.
   *
   * Uploading IS issuing — it puts a document into a passenger's hands — which is why it rides the
   * ISSUE step-up rather than an upload-specific one.
   *
   * The Content-Type header is deliberately NOT set: the browser sets `multipart/form-data` with a
   * correct boundary, and setting it by hand at best duplicates that and at worst omits the boundary.
   */
  uploadVoucher: async (publicId, file, mfaCode, onUploadProgress) => {
    const body = new FormData();
    body.append("file", file);
    return unwrap(await ConsoleAPI.post(`${ORDERS}/${publicId}/voucher/upload`, body, {
      ...stepUpHeaders(mfaCode),
      onUploadProgress,
    }));
  },

  /** Drop the uploaded slip and go back to the rendered one. Not a revoke: the order stays ISSUED. */
  removeUploadedVoucher: async (publicId, mfaCode) =>
    unwrap(await ConsoleAPI.delete(`${ORDERS}/${publicId}/voucher/upload`, stepUpHeaders(mfaCode))),

  /**
   * The platform's copy of the slip.
   *
   * @returns {Promise<Blob>} — read `blob.type` rather than assuming PDF: when the operator uploaded
   * their own slip the bytes may be an image, and the server sends its real content type.
   */
  downloadVoucher: async (publicId) => {
    const res = await ConsoleAPI.get(`${ORDERS}/${publicId}/voucher.pdf`, { responseType: "blob" });
    return res?.data ?? null;
  },

  // ── Earnings ────────────────────────────────────────────────────────────

  /** Paged — returns `{rows, pagination}`. See the note on `listVehicles`. */
  listCommissions: async (params = {}) => {
    const res = await ConsoleAPI.get(COMMISSIONS, { params: clean(params) });
    const body = res?.data ?? {};
    return { rows: body.data ?? [], pagination: body.pagination ?? {} };
  },
  commissionSummary: async (params = {}) =>
    unwrap(await ConsoleAPI.get(`${COMMISSIONS}/summary`, { params: clean(params) })),
  commissionsForOrder: async (orderPublicId) =>
    unwrap(await ConsoleAPI.get(`${COMMISSIONS}/orders/${orderPublicId}`)),

  /** Append-only: an adjustment ADDS a row, it never edits the accrual. Both move reported revenue. */
  adjustCommission: async (orderPublicId, payload, mfaCode) =>
    unwrap(await ConsoleAPI.post(`${COMMISSIONS}/orders/${orderPublicId}/adjust`, payload, stepUpHeaders(mfaCode))),
  /** `reference` is a QUERY param, not a body — a settlement note, e.g. a bank UTR. */
  settleCommission: async (publicId, reference, mfaCode) =>
    unwrap(await ConsoleAPI.post(`${COMMISSIONS}/${publicId}/settle`, null, {
      ...stepUpHeaders(mfaCode),
      params: clean({ reference }),
    })),
};

export default transportAdminService;
