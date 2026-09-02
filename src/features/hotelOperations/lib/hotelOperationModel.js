import { formatMoney } from "@shared/lib/currency";

export const BOOKING_STATUS = {
  REQUESTED: { label: "Requested", dot: "bg-amber-500", tone: "text-amber-700" },
  UNDER_REVIEW: { label: "Under review", dot: "bg-blue-500", tone: "text-blue-700" },
  TENANT_APPROVAL_REQUIRED: { label: "Needs your OK", dot: "bg-orange-500", tone: "text-orange-700" },
  TENANT_ACCEPTED: { label: "You accepted", dot: "bg-indigo-500", tone: "text-indigo-700" },
  CONFIRMED: { label: "Confirmed", dot: "bg-emerald-500", tone: "text-emerald-700" },
  REJECTED: { label: "Rejected", dot: "bg-red-500", tone: "text-red-700" },
  CANCEL_REQUESTED: { label: "Cancelling", dot: "bg-orange-500", tone: "text-orange-700" },
  // The platform has priced the cancellation and is waiting for the tenant to accept the charge.
  // Was missing here, so a row in this state rendered as a bare grey dot with the raw enum name.
  CANCELLATION_QUOTED: { label: "Charge quoted", dot: "bg-rose-500", tone: "text-rose-700" },
  CANCELLED: { label: "Cancelled", dot: "bg-slate-400", tone: "text-slate-600" },
  EXPIRED: { label: "Expired", dot: "bg-slate-400", tone: "text-slate-600" },
};

export const STATUS_TABS = [
  { key: "ALL", label: "All" },
  { key: "REQUESTED", label: "New" },
  { key: "UNDER_REVIEW", label: "Pending" },
  { key: "TENANT_APPROVAL_REQUIRED", label: "Needs your approval" },
  { key: "TENANT_ACCEPTED", label: "Accepted" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "CANCEL_REQUESTED", label: "Cancelling" },
  { key: "CANCELLATION_QUOTED", label: "Charge quoted" },
  { key: "REJECTED", label: "Rejected" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "EXPIRED", label: "Expired" },
];

const TERMINAL_UNCONFIRMED = new Set(["REJECTED", "CANCELLED", "EXPIRED"]);

export function statusLabel(status) {
  return BOOKING_STATUS[status]?.label ?? status ?? "Not recorded";
}

export function confirmationState(status) {
  if (status === "CONFIRMED") return { label: "Confirmed", tone: "green" };
  if (TERMINAL_UNCONFIRMED.has(status)) return { label: "Not confirmed", tone: "slate" };
  return { label: "Pending", tone: "amber" };
}

export function voucherState(status) {
  if (status === "ISSUED") return { label: "Issued", tone: "green" };
  if (status === "REVOKED") return { label: "Revoked", tone: "red" };
  if (status === "NOT_ISSUED") return { label: "Not issued", tone: "amber" };
  if (!status) return { label: "Not recorded", tone: "slate" };
  return { label: String(status).replaceAll("_", " "), tone: "slate" };
}

/**
 * Settlement of what the tenant owes the PLATFORM — the four values of
 * `MarketplacePaymentStatus`, and only those.
 *
 * An earlier version matched `PARTIALLY_PAID` / `UNPAID` / `SETTLED`, which are not in the enum: it
 * had been written against the demo fixtures rather than the API, so live `PART_PAID` and `PENDING`
 * both fell through to the red default. WRITTEN_OFF reads as "not collected", never as "paid" — the
 * platform did not receive that money.
 */
export function paymentState(status) {
  const value = String(status || "").toUpperCase();
  switch (value) {
    case "PAID":        return { label: "Paid", tone: "green" };
    case "PART_PAID":   return { label: "Part paid", tone: "amber" };
    case "PENDING":     return { label: "Payment pending", tone: "amber" };
    case "WRITTEN_OFF": return { label: "Not collected", tone: "slate" };
    case "":            return { label: "Not recorded", tone: "slate" };
    // An enum value added on the server before this map knew about it. Show it rather than blank it,
    // and stay neutral — a guessed tone on an unknown state is a guess the user cannot see.
    default:
      return {
        label: value.replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()),
        tone: "slate",
      };
  }
}

function sumKnown(...values) {
  const known = values.filter((value) => value !== null && value !== undefined && value !== "");
  if (known.length === 0) return null;
  return known.reduce((total, value) => total + (Number(value) || 0), 0);
}

export function toOperationBooking(raw = {}) {
  return {
    raw,
    publicId: raw.publicId,
    bookingCode: raw.bookingCode || raw.publicId || "Not recorded",
    bookingDate: raw.createdAt || null,
    crmBookingPublicId: raw.crmBookingPublicId || null,
    crmBookingCode: raw.crmBookingCode || null,
    hotelPublicId: raw.hotelPublicId || null,
    hotelName: raw.hotelName || "Hotel not recorded",
    hotelPropertyName: raw.hotelPropertyName || raw.hotelName || "Property not recorded",
    location: raw.cityName || raw.location || "Location not recorded",
    address: raw.address || null,
    state: raw.stateName || raw.state || null,
    country: raw.countryName || raw.countryCode || null,
    leadGuestName: raw.leadGuestName || "Guest not recorded",
    leadGuestPhone: raw.leadGuestPhone || null,
    leadGuestEmail: raw.leadGuestEmail || null,
    guestOrigin: raw.guestOrigin || null,
    adults: raw.adults ?? null,
    children: raw.children ?? null,
    infants: raw.infants ?? null,
    totalPax: sumKnown(raw.adults, raw.children, raw.infants),
    checkIn: raw.checkIn || null,
    checkOut: raw.checkOut || null,
    nights: raw.nights ?? null,
    rooms: raw.rooms ?? null,
    roomName: raw.roomName || null,
    mealPlan: raw.mealPlan || null,
    bedType: raw.bedType || null,
    bookingStatus: raw.status || null,
    confirmation: confirmationState(raw.status),
    confirmationNumber: raw.supplierConfirmationNumber || null,
    voucher: voucherState(raw.voucherStatus),
    voucherStatus: raw.voucherStatus || "NOT_ISSUED",
    voucherNumber: raw.voucherNumber || null,
    payment: paymentState(raw.paymentStatus),
    paymentStatus: raw.paymentStatus || null,
    operationStatus: null,
    specialRequest: raw.specialRequests || null,
    opsNotes: raw.opsNotes || null,
    arrivalFrom: raw.arrivalFrom || null,
    nextDestination: raw.nextDestination || null,

    // ── Money ───────────────────────────────────────────────────────────────
    // All of this was already on every response and was being dropped here. `supplierTotal` and
    // `platformEarning` are absent from the tenant DTO by construction — there is nothing to filter.
    currency: raw.currency || null,
    tenantPayable: num(raw.tenantPayable),
    quotedTenantPayable: num(raw.quotedTenantPayable),
    sellingAmount: num(raw.tenantCustomerSellingAmount),
    amountPaid: num(raw.amountPaid),
    // SERVER-DERIVED. Never `tenantPayable − amountPaid`: after a settled cancellation the debt is
    // the retained charge, not the original payable, and subtracting here would chase the tenant for
    // a room they never used.
    amountOutstanding: num(raw.amountOutstanding),

    // ── An open price revision ──────────────────────────────────────────────
    revision: revisionOffer(raw),
    priceRevisionReason: raw.priceRevisionReason || null,
    rejectionReason: raw.rejectionReason || null,
    cancellationTerms: raw.cancellationTerms || null,

    // ── Cancellation ────────────────────────────────────────────────────────
    cancelRequestedAt: raw.cancelRequestedAt || null,
    cancelRequestReason: raw.cancelRequestReason || null,
    cancelledAt: raw.cancelledAt || null,
    cancellationReason: raw.cancellationReason || null,
    quotedCancellationCharge: num(raw.quotedCancellationCharge),
    cancellationQuoteNote: raw.cancellationQuoteNote || null,
    cancellationQuotedAt: raw.cancellationQuotedAt || null,
    cancellationQuoteExpiresAt: raw.cancellationQuoteExpiresAt || null,
    // Derived here rather than in the view: a component that reads the clock during render is
    // impure, and the React Compiler rejects it. Same reason `revision.expired` lives on the model.
    cancellationQuoteExpired: expired(raw.cancellationQuoteExpiresAt),
    cancellationCharge: num(raw.cancellationCharge),
    refundAmount: num(raw.tenantRefundAmount),

    voucherIssuedAt: raw.voucherIssuedAt || null,
    approvedAt: raw.approvedAt || null,
  };
}

/** Whether a deadline has passed. Absent deadline ⇒ not expired, never "expired unknown". */
function expired(at) {
  return Boolean(at) && new Date(at).getTime() < Date.now();
}

/** `null` unless the value is genuinely a finite number — `0` is a real amount and must survive. */
function num(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * The open price revision, pre-computed so the view never does the arithmetic.
 *
 * <p>Two things are easy to get wrong here and both are load-bearing: `tenantPayable` is still the
 * OLD number while an offer is open (the proposal lives in `revisedTenantPayable`), and an offer past
 * `revisionExpiresAt` is dead — the server 409s an acceptance — so it must never read as live.</p>
 */
export function revisionOffer(raw = {}) {
  const revised = num(raw.revisedTenantPayable);
  if (revised === null) return null;

  const previous = num(raw.revisionPreviousPayable) ?? num(raw.tenantPayable);
  const delta = previous === null ? null : revised - previous;

  return {
    revised,
    previous,
    delta,
    reason: raw.priceRevisionReason || null,
    newTerms: raw.revisedCancellationTerms || null,
    requestedAt: raw.revisionRequestedAt || null,
    expiresAt: raw.revisionExpiresAt || null,
    expired: expired(raw.revisionExpiresAt),
    count: raw.revisionCount ?? null,
    open: raw.status === "TENANT_APPROVAL_REQUIRED",
  };
}

/**
 * What has actually happened to this request, in order.
 *
 * <p><b>Only steps the response can answer.</b> The previous version printed nine fixed rows of
 * which four — "Hotel acknowledged", "Check-in", "Check-out", "Completed" — were hard-coded
 * `done: false` because no field backs them, so every booking ever confirmed still showed its stay
 * as not started. A permanently grey step is not a pending step; it teaches the reader that the
 * whole timeline is decoration. Cancellation and revision rows appear only once they exist, which is
 * why this is built rather than declared.</p>
 */
export function operationTimeline(raw = {}) {
  const steps = [
    { label: "Request sent to platform", done: Boolean(raw.createdAt), at: raw.createdAt || null },
  ];

  if (raw.revisionRequestedAt || raw.revisedTenantPayable != null) {
    steps.push({
      label: raw.revisionCount > 1 ? `Price revised (${raw.revisionCount} times)` : "Price revised by the platform",
      done: true,
      at: raw.revisionRequestedAt || null,
    });
  }

  if (raw.status === "TENANT_ACCEPTED") {
    // No `acceptedAt` on the DTO — the status is the evidence, so the row is honest about the time.
    steps.push({ label: "You accepted the revised price", done: true, at: null });
  }

  if (raw.status === "REJECTED") {
    steps.push({ label: "Request closed without a booking", done: true, at: null });
    return steps;
  }

  steps.push({
    label: "Hotel confirmed",
    done: raw.status === "CONFIRMED" || Boolean(raw.approvedAt),
    at: raw.approvedAt || null,
  });

  steps.push({
    label: "Confirmation number received",
    done: Boolean(raw.supplierConfirmationNumber),
    at: null,
  });

  steps.push({
    label: "Voucher issued",
    done: raw.voucherStatus === "ISSUED",
    at: raw.voucherIssuedAt || null,
  });

  if (raw.cancelRequestedAt || raw.cancellationQuotedAt || raw.cancelledAt) {
    steps.push({ label: "Cancellation requested", done: Boolean(raw.cancelRequestedAt), at: raw.cancelRequestedAt || null });
    steps.push({ label: "Cancellation charge quoted", done: Boolean(raw.cancellationQuotedAt), at: raw.cancellationQuotedAt || null });
    steps.push({ label: "Cancelled", done: Boolean(raw.cancelledAt), at: raw.cancelledAt || null });
  }

  return steps;
}

/**
 * Money, or an em dash.
 *
 * <p>`null` and `undefined` mean "the platform has not set a price yet" — a REQUESTED row has no
 * agreed payable — and rendering those as a zero would state a fact nobody has established.
 * `formatMoney` needs a finite number and a code, so both are guarded here rather than at each of
 * the dozen call sites.</p>
 */
export function fmtMoney(value, currency) {
  if (value === null || value === undefined || value === "") return "—";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return formatMoney(amount, currency || "INR");
}

export function fmtDate(value) {
  if (!value) return "—";
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return String(value);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
