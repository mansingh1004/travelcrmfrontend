// src/console/api/marketplaceBookingService.js
//
// The SuperAdmin queue for tenant hotel booking requests. Platform realm: ConsoleAPI carries
// `sa_token`, so a 401 bounces to the CONSOLE login and never the tenant one.
//
// Step-up MFA is required for irreversible financial decisions and voucher publication. Price
// revisions and cancellation quotes are proposals, so those calls intentionally carry no code.

import ConsoleAPI, { unwrap } from "./consoleHttp";
import { SUPERADMIN_MFA_HEADER } from "./userService";

const BASE = "/super-admin/marketplace/bookings";

const stepUpHeaders = (mfaCode) => ({
  headers: { [SUPERADMIN_MFA_HEADER]: mfaCode },
});

/** Drop empty filters — an empty string is a *value* to a Spring `@RequestParam`, not "no filter". */
function clean(params) {
  const out = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === "" || value === null || value === undefined) continue;
    out[key] = value;
  }
  return out;
}

export const marketplaceBookingService = {
  /**
   * Paged, cross-tenant queue. Unlike the tenant-facing list, this endpoint DOES accept `status`,
   * so the console's filter tabs narrow the real dataset rather than one loaded page.
   *
   * An unknown `status` string is treated by the server as "all" rather than rejected
   * (MarketplaceBookingAdminController.parseStatus), so a stale tab can never 400 the queue.
   *
   * @returns {Promise<{items: Array, pagination: Object|null}>} rows live in `data`, NOT `content`.
   */
  list: async ({ page = 0, size = 25, status, tenantId } = {}) => {
    const res = await ConsoleAPI.get(BASE, { params: clean({ page, size, status, tenantId }) });
    const rows = res?.data?.data;
    return {
      items: Array.isArray(rows) ? rows : [],
      pagination: res?.data?.pagination ?? null,
    };
  },

  /**
   * Badge count for the sidebar: REQUESTED + TENANT_ACCEPTED + CANCEL_REQUESTED — every state
   * waiting on the platform. TENANT_APPROVAL_REQUIRED is excluded because that one is waiting on
   * the tenant, and a badge that counts somebody else's work is one operators learn to ignore.
   */
  pendingCount: async () => {
    const data = unwrap(await ConsoleAPI.get(`${BASE}/pending-count`));
    return data?.count ?? 0;
  },

  /** Claim a request for review. No MFA — it changes no money and is reversible by approving/rejecting. */
  review: async (publicId) => unwrap(await ConsoleAPI.post(`${BASE}/${publicId}/review`)),

  /**
   * Confirm the booking.
   *
   * @param {object} payload ApproveMarketplaceBookingRequest — `supplierTotal` and `tenantPayable`
   *        are both required, and the server rejects `tenantPayable < supplierTotal` rather than
   *        silently confirming a loss-making sale. The difference becomes `platformEarning`.
   */
  approve: async (publicId, payload, mfaCode) =>
    unwrap(await ConsoleAPI.post(`${BASE}/${publicId}/approve`, payload, stepUpHeaders(mfaCode))),

  /** Reject. `reason` is a QUERY param, not a body — matches the controller signature. */
  reject: async (publicId, reason, mfaCode) =>
    unwrap(await ConsoleAPI.post(`${BASE}/${publicId}/reject`, null, {
      ...stepUpHeaders(mfaCode),
      params: clean({ reason }),
    })),

  /**
   * Put a revised price to the tenant instead of approving a number they never agreed to.
   *
   * No MFA, deliberately: this commits nobody to anything, and friction here would push operators
   * towards approving the moved price outright — the dangerous action — rather than away from it.
   *
   * @param {object} payload ReviseMarketplaceBookingRequest — both amounts and `reason` are
   *        required, and the server rejects `revisedTenantPayable < revisedSupplierTotal`.
   *        `validForHours` omitted falls back to the platform default.
   */
  requestRevision: async (publicId, payload) =>
    unwrap(await ConsoleAPI.post(`${BASE}/${publicId}/request-revision`, payload)),

  /** Normal cancellation path: propose the supplier charge and wait for tenant consent. */
  quoteCancellation: async (publicId, payload) =>
    unwrap(await ConsoleAPI.post(`${BASE}/${publicId}/quote-cancellation`, payload)),

  /**
   * Settle a cancellation. MFA — this is the call that decides the tenant's refund.
   *
   * @param {object} payload CancelMarketplaceBookingRequest. The refund is derived server-side from
   *        `tenantPayable - cancellationCharge` and is never posted by a client.
   */
  cancel: async (publicId, payload, mfaCode) =>
    unwrap(await ConsoleAPI.post(`${BASE}/${publicId}/cancel`, payload, stepUpHeaders(mfaCode))),

  // ── Voucher: a second axis, not a booking state (MarketplaceVoucherAdminController) ──────
  issueVoucher: async (publicId, mfaCode) =>
    unwrap(await ConsoleAPI.post(`${BASE}/${publicId}/voucher/issue`, null, stepUpHeaders(mfaCode))),

  /** Attach the hotel-supplied PDF/image. Uploading also issues the voucher server-side. */
  uploadVoucher: async (publicId, file, mfaCode, onUploadProgress) => {
    const body = new FormData();
    body.append("file", file);
    return unwrap(await ConsoleAPI.post(`${BASE}/${publicId}/voucher/upload`, body, {
      ...stepUpHeaders(mfaCode),
      onUploadProgress,
    }));
  },

  /** `reason` is a QUERY param here too. */
  revokeVoucher: async (publicId, reason, mfaCode) =>
    unwrap(await ConsoleAPI.post(`${BASE}/${publicId}/voucher/revoke`, null, {
      ...stepUpHeaders(mfaCode),
      params: clean({ reason }),
    })),

  /**
   * The operator's copy. Unlike the tenant route this does not require an ISSUED voucher — the PDF
   * carries a "Preview" stamp until then, because an operator has to read a document before
   * committing to it.
   *
   * @returns {Promise<Blob>}
   */
  voucherPdf: async (publicId) => {
    const res = await ConsoleAPI.get(`${BASE}/${publicId}/voucher.pdf`, { responseType: "blob" });
    return res.data;
  },
};

export default marketplaceBookingService;
