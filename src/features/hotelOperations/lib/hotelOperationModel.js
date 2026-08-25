export const BOOKING_STATUS = {
  REQUESTED: { label: "Requested", dot: "bg-amber-500", tone: "text-amber-700" },
  UNDER_REVIEW: { label: "Under review", dot: "bg-blue-500", tone: "text-blue-700" },
  TENANT_APPROVAL_REQUIRED: { label: "Needs your OK", dot: "bg-orange-500", tone: "text-orange-700" },
  TENANT_ACCEPTED: { label: "You accepted", dot: "bg-indigo-500", tone: "text-indigo-700" },
  CONFIRMED: { label: "Confirmed", dot: "bg-emerald-500", tone: "text-emerald-700" },
  REJECTED: { label: "Rejected", dot: "bg-red-500", tone: "text-red-700" },
  CANCEL_REQUESTED: { label: "Cancelling", dot: "bg-orange-500", tone: "text-orange-700" },
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

export function paymentState(status) {
  const value = String(status || "").toUpperCase();
  if (value === "PAID" || value === "SETTLED") return { label: value === "PAID" ? "Paid" : "Settled", tone: "green" };
  if (value === "PARTIALLY_PAID" || value === "PARTIAL") return { label: "Part paid", tone: "amber" };
  if (!value) return { label: "Not recorded", tone: "slate" };
  return { label: value.replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()), tone: "red" };
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
  };
}

export function operationTimeline(raw = {}) {
  const confirmed = raw.status === "CONFIRMED" || Boolean(raw.approvedAt);
  return [
    { label: "Booking received", done: Boolean(raw.createdAt), at: raw.createdAt || null },
    { label: "Request sent to platform", done: Boolean(raw.createdAt), at: raw.createdAt || null },
    { label: "Hotel acknowledged", done: false, at: null },
    { label: "Hotel confirmed", done: confirmed, at: raw.approvedAt || null },
    { label: "Confirmation number received", done: Boolean(raw.supplierConfirmationNumber), at: null },
    { label: "Voucher generated", done: raw.voucherStatus === "ISSUED", at: raw.voucherIssuedAt || null },
    { label: "Check-in", done: false, at: null },
    { label: "Check-out", done: false, at: null },
    { label: "Completed", done: false, at: null },
  ];
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
