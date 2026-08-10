/* ═══════════════════════════════════════════════════════════════════════════════
   BookingDetails — redesigned layout (Aug 2026).
   Sticky action header → KPI strip → [340px rail | tabbed main content].
   Tabs: Overview · Trip & Travellers · Services · Finance · Communication · Documents · Activity.
   Colour language: blue/indigo = identity & primary actions, green = money IN,
   amber/orange = money OUT & pending, teal = customer, purple = quotation,
   slate = neutral, rose/red = destructive & overdue only.
   Every figure is server-derived — normalizeBooking documents the only fallbacks.
   The previous implementation is preserved (commented) above this banner.
═══════════════════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import bookingService from "../api/bookingService";
import { useToast } from "@shared/ui/toast";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { downloadBlob, hydrateBlobError } from "@shared/lib/download";
import { hasPermission, P } from "@shared/lib/access";
import RefundBookingModal from "../components/RefundBookingModal";
import BookingInvoiceModal from "../components/BookingInvoiceModal";
import CancelBookingModal from "../components/CancelBookingModal";
import BookingExpenseModal from "../components/BookingExpenseModal";
import BookingVariationModal from "../components/BookingVariationModal";
import BookingAttentionBar from "../components/BookingAttentionBar";
import BookingTabs from "../components/BookingTabs";
import BookingActivityTimeline from "../components/BookingActivityTimeline";
// Cross-feature reads go through the barrels, never a deep import.
import { quotationService } from "@features/quotation";
import { bookingReminderService } from "@features/reminders";
import { customerService } from "@features/customers";
import {
  FiArrowLeft, FiEdit2, FiTrash2, FiCheck, FiX, FiAlertCircle,
  FiPlus, FiExternalLink, FiRefreshCw, FiCreditCard, FiUser,
  FiTruck, FiDownload, FiPhone, FiEye, FiBell, FiFileText,
  FiGrid, FiMap, FiFolder, FiCornerUpLeft, FiMail, FiMapPin,
  FiClock, FiUsers, FiInfo,
} from "react-icons/fi";
import {
  FaPlane, FaHotel, FaCar, FaShip, FaPassport,
  FaUmbrellaBeach, FaReceipt, FaTrain, FaBus,
} from "react-icons/fa";
import { MdOutlineAssignment, MdPayment } from "react-icons/md";

/* ─── CONSTANTS ──────────────────────────────────────────────── */
const STATUS_STYLE = {
  CONFIRMED: "bg-green-100 text-green-700 border-green-200",
  PENDING:   "bg-amber-100 text-amber-700 border-amber-200",
  CANCELLED: "bg-red-100   text-red-600   border-red-200",
  COMPLETED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  REFUNDED:  "bg-purple-100 text-purple-700 border-purple-200",
};
const STATUS_DOT = {
  CONFIRMED:"bg-green-500", PENDING:"bg-amber-500",
  CANCELLED:"bg-red-500",   COMPLETED:"bg-emerald-500", REFUNDED:"bg-purple-500",
};
const PAY_STYLE = {
  PAID:     "bg-emerald-100 text-emerald-700",
  PARTIAL:  "bg-orange-100  text-orange-700",
  UNPAID:   "bg-rose-100    text-rose-700",
  REFUNDED: "bg-slate-100   text-slate-600",
};
/* Expense line settlement — the money-OUT vocabulary (CREDIT = udhar, nothing paid yet).
   Colors match the stamps inside BookingExpenseModal so the two surfaces read as one ledger. */
const EXP_STATUS_STYLE = {
  CREDIT:  "bg-amber-50  text-amber-700  border-amber-200",
  PARTIAL: "bg-violet-50 text-violet-700 border-violet-200",
  PAID:    "bg-green-50  text-green-700  border-green-200",
};
const EXP_PAYMENT_MODES = ["Cash", "UPI", "Bank Transfer", "Credit Card", "Debit Card", "Cheque", "Wallet", "Other"];
const SVC_ICON = {
  Hotel: <FaHotel/>, Flight: <FaPlane/>, Transport: <FaCar/>,
  Vehicle: <FaCar/>, Cruise: <FaShip/>, Sightseeing: <FaUmbrellaBeach/>,
  Visa: <FaPassport/>, Insurance: "🛡️", Passport: <FaPassport/>,
};
/* Refund position chip — vocabulary of CancellationSummaryDTO.refundStatus. */
const REFUND_STATUS_STYLE = {
  NOT_APPLICABLE: "bg-slate-100 text-slate-600 border-slate-200",
  PENDING:        "bg-amber-100 text-amber-700 border-amber-200",
  PARTIALLY_PAID: "bg-violet-100 text-violet-700 border-violet-200",
  PAID:           "bg-green-100 text-green-700 border-green-200",
};

/* Section accents — full literal class strings (Tailwind scans source; no interpolation). */
const TONE = {
  blue:   { chip: "bg-blue-100 text-blue-600",     bar: "from-blue-500 to-indigo-500"   },
  indigo: { chip: "bg-indigo-100 text-indigo-600", bar: "from-indigo-500 to-violet-500" },
  teal:   { chip: "bg-teal-100 text-teal-600",     bar: "from-teal-500 to-cyan-500"     },
  green:  { chip: "bg-green-100 text-green-600",   bar: "from-green-500 to-emerald-500" },
  amber:  { chip: "bg-amber-100 text-amber-600",   bar: "from-amber-500 to-orange-500"  },
  purple: { chip: "bg-purple-100 text-purple-600", bar: "from-purple-500 to-fuchsia-500"},
  slate:  { chip: "bg-slate-100 text-slate-600",   bar: "from-slate-500 to-slate-400"   },
  rose:   { chip: "bg-rose-100 text-rose-600",     bar: "from-rose-500 to-red-500"      },
  sky:    { chip: "bg-sky-100 text-sky-600",       bar: "from-sky-500 to-blue-500"      },
};

/* ─── HELPERS ────────────────────────────────────────────────── */
const fmtINR = n => n != null
  ? "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits:2, maximumFractionDigits:2 })
  : "₹0.00";
/* Money that can legitimately go either way — a variation's deltas, and the net they produce.
   The sign is carried EXPLICITLY rather than implied by colour: "+₹2,000" and "−₹500" read the
   same in a screenshot, in a printout and to someone who cannot distinguish red from green. */
const signedINR = n => {
  const v = Number(n) || 0;
  if (v === 0) return "₹0.00";
  return (v > 0 ? "+" : "−") + fmtINR(Math.abs(v));
};
const fmtDate = d => d
  ? new Date(d).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })
  : "—";
const fmtDateTime = d => d
  ? new Date(d).toLocaleString("en-IN", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })
  : "—";
const titleCase = s => s
  ? String(s).replace(/_/g, " ").split(" ").filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ")
  : "—";
const unwrap = res => res?.data?.data ?? res?.data;
/* Customer/Vendor detail pages navigate here with `b.id || b.code` — resolve codes
   through GET /bookings/code/{code} instead of failing the UUID endpoint. */
const looksLikeUuid = v =>
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(String(v || ""));

function normalizeBooking(b = {}) {
  const customerAmount = Number(b.customerAmount) || 0;
  const vendorCost     = Number(b.vendorCost)     || 0;
  const gst            = Number(b.gst)            || 0;
  const tcs            = Number(b.tcs)            || 0;
  const totalPayable   = Number(b.totalPayable)   || customerAmount + gst + tcs;
  const paid           = Number(b.paidAmount)     || 0;
  const totalInternalCosts = Number(b.totalInternalCosts) || 0;
  // Supplier cost the agency itemised in the expense ledger, over and above the vendorCost typed on
  // the booking. The two are ADDITIVE — the typed figure is what was declared up front, this is what
  // was itemised afterwards — so totalSupplierCost is the one to show as "what this trip cost".
  const totalVendorCosts  = Number(b.totalVendorCosts) || 0;
  const totalSupplierCost = b.totalSupplierCost != null
    ? Number(b.totalSupplierCost)
    : vendorCost + totalVendorCosts;
  // The server settles every rupee, so its netProfit wins whenever it sent one — including a
  // legitimate 0. `Number(b.netProfit) || (...)` swallowed that zero and fell through to a
  // recomputation using different maths, so a zero-margin booking displayed an invented profit.
  const netProfit      = b.netProfit != null
    ? Number(b.netProfit)
    : (customerAmount - totalSupplierCost - totalInternalCosts);
  const netMargin      = customerAmount > 0 ? ((netProfit / customerAmount) * 100).toFixed(1) : 0;
  const due            = b.pendingAmount != null ? Number(b.pendingAmount) : Math.max(0, totalPayable - paid);
  // Clamped: an overpaid booking (the ledger permits paid > totalPayable) reads 100%, not 105%.
  const payPct         = totalPayable > 0 ? Math.min(100, Math.round((paid / totalPayable) * 100)) : 0;
  const refunded       = Number(b.refundedAmount) || 0;
  // The variation ledger's two net figures, both already inside the totals above: the customer side
  // is part of totalPayable, the cost side is part of netProfit. Surfaced separately so the screen
  // can say WHY the numbers moved — "₹1,10,000 payable, of which ₹2,000 came from changes after
  // booking" is a different sentence from "₹1,10,000 payable".
  const customerAdjustments = Number(b.totalCustomerAdjustments) || 0;
  const costVariations      = Number(b.totalCostVariations) || 0;

  // Traveller counts live on tripSnapshot.travellers — the top-level keys were never part of
  // BookingResponseDTO and are kept only as fallbacks for pre-normalised callers.
  const snap = b.tripSnapshot || null;
  const trav = snap?.travellers || {};
  const adults   = Number(trav.totalAdults ?? b.adults ?? b.numAdults ?? 0) || 0;
  const children = Number(trav.children   ?? b.children ?? b.numChildren ?? 0) || 0;
  const infants  = Number(trav.infants    ?? b.infants  ?? b.numInfants  ?? 0) || 0;
  // Total nights = the sum of the snapshot's trip legs; drives the derived travel-end date
  // (check-out after N nights) — derived, never invented.
  const totalNights = Array.isArray(snap?.itinerary)
    ? snap.itinerary.reduce((s, leg) => s + (Number(leg?.nights) || 0), 0)
    : 0;

  return {
    id:              b.publicId || b.id,
    code:            b.bookingCode || b.code || "—",
    customer:        b.customerNameSnapshot || b.customerName || "—",
    customerPhone:   b.customerPhone || b.phone || "",
    customerId:      b.customerId || null,          // customer's publicId (UUID)
    destination:     b.destinationSnapshot || b.destination || "—",
    bookingDate:     b.bookingDate || b.createdAt,
    travelDate:      b.travelDate,
    travelEndDate:   b.travelEndDate || b.returnDate,
    adults, children, infants,
    rooms:           Number(trav.rooms)     || 0,
    extraBeds:       Number(trav.extraBeds) || 0,
    leadName:        b.leadName || b.customerNameSnapshot || b.customerName || "—",
    leadPhone:       b.leadPhone || b.customerPhone || b.phone || "",
    assignedUser:    b.assignedUserName || b.assignedUser?.fullName || b.assignedUser?.name || b.assignedTo || "—",
    customerAmount,  vendorCost, gst, tcs, totalInternalCosts, totalPayable, paid, due,
    totalVendorCosts, totalSupplierCost,
    // Supplier the typed vendorCost is owed to. Snapshot name, so it still reads after a rename.
    vendorPublicId:  b.vendorPublicId || null,
    vendorName:      b.vendorName || "",
    netProfit, netMargin, payPct, refunded,
    customerAdjustments, costVariations,
    overseas:        !!b.overseasTourPackage,
    status:          (b.status || "PENDING").toUpperCase(),
    payStatus:       (b.paymentStatus || b.payStatus || "UNPAID").toUpperCase(),
    notes:           b.notes || "",
    reminders:       Array.isArray(b.reminders) ? b.reminders : [],
    quotation:       b.quotation || null,
    leadId:          b.leadId || b.leadPublicId || null,
    // The two public UUIDs the API actually ships. `leadId` above is kept for pre-normalised
    // callers; these are what the lead link and the itinerary fetch use.
    leadPublicId:      b.sourceLeadPublicId || b.leadPublicId || null,
    quotationPublicId: b.sourceQuotationPublicId || null,
    // Service tags live on the booking itself and are the only operational hint a direct booking
    // (one with no linked quotation) has to offer.
    services:        Array.isArray(b.services) ? b.services : [],
    tripSnapshot:    snap,
    totalNights,
    createdBy:       b.createdBy || "—",
    createdAt:       b.createdAt || null,
    updatedAt:       b.updatedAt || null,
  };
}

/* ─── UI PRIMITIVES ──────────────────────────────────────────── */

/* Section card — white glass body, thin gradient accent bar + tinted icon chip.
   Semantic colour without a solid painted header. */
function Section({ title, sub, icon, tone = "slate", action, children, className = "" }) {
  const t = TONE[tone] || TONE.slate;
  return (
    <section className={`bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden ${className}`}
      style={{animation:"fadeUp .4s ease both"}}>
      <div className={`h-1 bg-gradient-to-r ${t.bar}`}/>
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${t.chip}`}>
            {icon}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-slate-800">{title}</h3>
            {sub && <p className="text-[11px] text-slate-400 font-medium">{sub}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

/* KPI hero card — the one place the new colour language goes full gradient. */
function StatCard({ label, value, sub, icon, gradient, delay = 0 }) {
  return (
    <div className={`bg-gradient-to-br ${gradient} rounded-2xl p-4 sm:p-5 text-white shadow-lg relative overflow-hidden min-w-0`}
      style={{animation:`fadeUp .4s ease both ${delay}ms`}}>
      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10 pointer-events-none"/>
      <div className="absolute -right-2 -bottom-10 w-24 h-24 rounded-full bg-white/10 pointer-events-none"/>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center text-xs flex-shrink-0">{icon}</span>
        <p className="text-[11px] font-bold text-white/90 uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-lg sm:text-2xl font-extrabold leading-tight truncate"
        title={typeof value === "string" ? value : undefined}>{value}</p>
      {sub && <p className="text-[11px] text-white/90 mt-1 font-medium leading-relaxed line-clamp-2">{sub}</p>}
    </div>
  );
}

/* Label / value row. */
function KV({ label, value, valueClass = "" }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-slate-400 font-medium flex-shrink-0">{label}</span>
      <span className={`text-xs font-bold text-slate-700 text-right ${valueClass}`}>{value ?? "—"}</span>
    </div>
  );
}

function EmptyState({ icon, text, hint, action }) {
  return (
    <div className="text-center py-8">
      <div className="text-3xl mb-2">{icon}</div>
      <p className="text-sm text-slate-400 font-medium">{text}</p>
      {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}

/* Departure mode icon — the wire format is DepartureMode's display name ("Train / Rail"). */
function depModeIcon(mode) {
  const m = String(mode || "");
  if (/flight|air/i.test(m)) return <FaPlane className="w-4 h-4"/>;
  if (/train|rail/i.test(m)) return <FaTrain className="w-4 h-4"/>;
  if (/bus/i.test(m))        return <FaBus className="w-4 h-4"/>;
  if (/car|road/i.test(m))   return <FaCar className="w-4 h-4"/>;
  return <FiMapPin className="w-4 h-4"/>;
}

/* ─── ADD PAYMENT MODAL ──────────────────────────────────────── */
function AddPaymentModal({ booking, onClose, onAdded, showToast }) {
  const [form,   setForm]   = useState({
    amount:"", paymentMethod:"Cash", reference:"", notes:"",
    paymentDate: new Date().toISOString().slice(0,10),
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleAdd = async () => {
    if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0) {
      setErr("Enter a valid amount."); return;
    }
    setSaving(true);
    try {
      await bookingService.addPayment(booking.id, {
        amount:        Number(form.amount),
        paymentMethod: form.paymentMethod,
        paymentDate:   form.paymentDate,
        reference:     form.reference || undefined,
        notes:         form.notes || undefined,
      });
      showToast("Payment recorded.", "success");
      onAdded();
      onClose();
    } catch (error) {
      if (isAlreadyReported(error)) { onClose(); return; }
      setErr(getErrorMessage(error, "Failed to record payment."));
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}/>
      <div role="dialog" aria-modal="true" aria-labelledby="add-payment-title"
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 p-6" style={{animation:"popIn .25s ease both"}}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
            <MdPayment className="w-5 h-5 text-green-600"/>
          </div>
          <div>
            <h3 id="add-payment-title" className="text-base font-extrabold text-slate-800">Record Payment</h3>
            <p className="text-xs text-slate-400">{booking.code} · Due: {fmtINR(booking.due)}</p>
          </div>
          <button onClick={onClose} aria-label="Close"
            className="ml-auto w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200"><FiX className="w-4 h-4"/></button>
        </div>
        {err && <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-600 font-semibold mb-4 flex items-center gap-2"><FiAlertCircle className="w-3.5 h-3.5"/>{err}</div>}
        <div className="space-y-4">
          <div>
            <label htmlFor="pay-amount" className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Amount (₹) *</label>
            <input id="pay-amount" type="number" step="0.01" min="0" value={form.amount} autoFocus
              onChange={e=>{ setForm(p=>({...p,amount:e.target.value})); setErr(""); }}
              placeholder="e.g. 10000"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:border-green-400 focus:ring-2 focus:ring-green-50 outline-none"/>
          </div>
          <div>
            <label htmlFor="pay-method" className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Payment Method</label>
            <select id="pay-method" value={form.paymentMethod} onChange={e=>setForm(p=>({...p,paymentMethod:e.target.value}))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:border-green-400 outline-none appearance-none cursor-pointer">
              {["Cash","Card","UPI","Bank Transfer","Cheque","Other"].map(m=><option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="pay-date" className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Payment Date</label>
            <input id="pay-date" type="date" value={form.paymentDate} onChange={e=>setForm(p=>({...p,paymentDate:e.target.value}))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:border-green-400 outline-none"/>
          </div>
          <div>
            <label htmlFor="pay-ref" className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Reference (optional)</label>
            <input id="pay-ref" value={form.reference} onChange={e=>setForm(p=>({...p,reference:e.target.value}))}
              placeholder="e.g. UTR / txn id"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:border-green-400 outline-none"/>
          </div>
          <div>
            <label htmlFor="pay-notes" className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Note (optional)</label>
            <input id="pay-notes" value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))}
              placeholder="e.g. First instalment"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:border-green-400 outline-none"/>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all">Cancel</button>
          <button onClick={handleAdd} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-md shadow-green-200">
            {saving&&<span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/>}
            {saving?"Saving…":"Record Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── ASSIGN VENDOR MODAL ────────────────────────────────────── */
function AssignVendorModal({ booking, service, onClose, onAssigned, showToast }) {
  const [vendors, setVendors]         = useState([]);
  const [loadingVendors, setLoading]  = useState(true);
  const [vendorPublicId, setVendorId] = useState(service?.vendorPublicId || "");
  const [vendorCost, setVendorCost]   = useState(service?.vendorCost ?? "");
  const [saving, setSaving]           = useState(false);
  const [err, setErr]                 = useState("");

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res  = await bookingService.getVendors();
        const list = res?.data?.data?.content ?? res?.data?.data ?? res?.data ?? [];
        if (alive) setVendors(Array.isArray(list) ? list : []);
      } catch (error) {
        if (!isAlreadyReported(error)) showToast(getErrorMessage(error, "Couldn't load vendors."), "error");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [showToast]);

  const handleAssign = async () => {
    if (!vendorPublicId) { setErr("Select a vendor."); return; }
    setSaving(true);
    try {
      await bookingService.assignVendor(booking.id, service.publicId, {
        vendorPublicId,
        vendorCost: vendorCost === "" ? undefined : Number(vendorCost),
      });
      showToast("Vendor assigned.", "success");
      onAssigned();
      onClose();
    } catch (error) {
      if (isAlreadyReported(error)) { onClose(); return; }
      setErr(getErrorMessage(error, "Failed to assign vendor."));
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}/>
      <div role="dialog" aria-modal="true" aria-labelledby="assign-vendor-title"
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 p-6" style={{animation:"popIn .25s ease both"}}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <FiTruck className="w-5 h-5 text-blue-600"/>
          </div>
          <div>
            <h3 id="assign-vendor-title" className="text-base font-extrabold text-slate-800">Assign Vendor</h3>
            <p className="text-xs text-slate-400">Service: {service?.title || service?.serviceType || "—"}</p>
          </div>
          <button onClick={onClose} aria-label="Close"
            className="ml-auto w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200"><FiX className="w-4 h-4"/></button>
        </div>
        {err && <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-600 font-semibold mb-4">{err}</div>}
        <div className="space-y-4">
          <div>
            <label htmlFor="vendor-select" className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Vendor *</label>
            <select id="vendor-select" value={vendorPublicId} onChange={e=>{ setVendorId(e.target.value); setErr(""); }}
              disabled={loadingVendors} autoFocus
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none appearance-none cursor-pointer disabled:opacity-60">
              <option value="">{loadingVendors ? "Loading vendors…" : "Select a vendor"}</option>
              {vendors.map(v => (
                <option key={v.publicId} value={v.publicId}>{v.vendorName ?? v.name ?? "Unnamed vendor"}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="vendor-cost" className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Vendor Cost (₹)</label>
            <input id="vendor-cost" type="number" step="0.01" min="0" value={vendorCost} onChange={e=>setVendorCost(e.target.value)}
              placeholder="0.00"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:border-blue-400 outline-none"/>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all">Cancel</button>
          <button onClick={handleAssign} disabled={saving||loadingVendors}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-700 hover:to-indigo-600 text-white font-bold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-md shadow-blue-200">
            {saving&&<span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/>}
            {saving?"Saving…":"Assign Vendor"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */
export default function BookingDetails() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const { showToast } = useToast();

  const canUpdate = hasPermission(P.BOOKING_UPDATE);
  const canRefund = hasPermission(P.BOOKING_REFUND);
  const canSeeMargin = hasPermission(P.BOOKING_PROFIT_READ);
  const canCancel = hasPermission(P.BOOKING_CANCEL);
  const canReadReminders = hasPermission(P.REMINDER_READ);
  const canSendReminders = hasPermission(P.REMINDER_UPDATE);
  /* Customer enrichment is fetched only when the user can read customers — avoids a guaranteed
     403 (and its interceptor toast) for booking-only roles. */
  const canReadCustomer = hasPermission(P.CUSTOMER_READ);

  const [booking,     setBooking]     = useState(null);
  const [services,    setServices]    = useState([]);
  const [payments,    setPayments]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [tab,         setTab]         = useState("overview");
  const [showAddPay,  setShowAddPay]  = useState(false);
  const [assignSvc,   setAssignSvc]   = useState(null);
  const [deletingPay, setDeletingPay] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [showRefund,  setShowRefund]  = useState(false);
  const [showCancel,  setShowCancel]  = useState(false);
  const [gstOpen,     setGstOpen]     = useState(false);
  /* ── Expense ledger (money OUT — the mirror of the payment ledger) ──
     Entry is one-shot: the whole batch goes in through BookingExpenseModal in a single save.
     This card is therefore a READ + SETTLE surface — CREDIT/PARTIAL (udhar) lines get their
     disbursements recorded here over time. */
  const [expenses,       setExpenses]       = useState([]);
  const [expenseSummary, setExpenseSummary] = useState(null);
  const [variations,        setVariations]        = useState([]);
  const [variationSummary,  setVariationSummary]  = useState(null);
  const [variationCategories, setVariationCategories] = useState([]);
  const [showVariationModal, setShowVariationModal] = useState(false);
  const [editVariation,      setEditVariation]      = useState(null);
  const [variationSaving,    setVariationSaving]    = useState(false);
  const [variationBusy,      setVariationBusy]      = useState(null);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expenseSaving,  setExpenseSaving]  = useState(false);
  const [settleExp,      setSettleExp]      = useState(null);   // publicId whose settle form is open
  const [settleForm,     setSettleForm]     = useState({ amount: "", mode: "", reference: "" });
  const [settleErr,      setSettleErr]      = useState("");
  const [settleSaving,   setSettleSaving]   = useState(false);
  const [deletingExp,    setDeletingExp]    = useState(null);   // publicId in two-step delete confirm
  const [expBusy,        setExpBusy]        = useState(null);   // publicId with a mark-paid/delete in flight
  // The booking payload carries no quotation object and no reminders array — both are separate
  // reads. Same for the customer profile (customerId UUID) and the frozen cancellation position.
  const [quotation,   setQuotation]   = useState(null);
  const [quotLoading, setQuotLoading] = useState(false);
  const [reminders,   setReminders]   = useState([]);
  const [sendingRem,  setSendingRem]  = useState(null);
  const [customer,    setCustomer]    = useState(null);
  const [cancelSummary, setCancelSummary] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [sectionLoading, setSectionLoading] = useState(null);
  const [dataEpoch, setDataEpoch] = useState(0);

  /* The route param is normally the booking publicId, but Customer/Vendor details navigate
     here with `b.id || b.code` — so the param may be a booking CODE. Sub-resource endpoints
     (/payments, /services, /expenses) only accept the UUID, so they key off this ref, which
     fetchBooking resolves before they run on the code path. */
  const bookingIdRef = useRef(looksLikeUuid(id) ? id : null);
  const loadedSectionsRef = useRef(new Set());

  /* ── FETCH ── */
  const fetchBooking = useCallback(async () => {
    if (!id) return;
    try {
      const res = looksLikeUuid(id)
        ? await bookingService.getById(id)
        : await bookingService.getByCode(id);
      const norm = normalizeBooking(unwrap(res));
      bookingIdRef.current = norm.id || bookingIdRef.current;
      setBooking(norm);
    } catch (error) {
      if (isAlreadyReported(error)) return;
      showToast(getErrorMessage(error, "Failed to load booking."), "error");
    }
  }, [id, showToast]);

  const fetchServices = useCallback(async () => {
    const bid = bookingIdRef.current;
    if (!bid) return;
    try {
      const res  = await bookingService.getServices(bid);
      const list = unwrap(res);
      setServices(Array.isArray(list) ? list : []);
    } catch (error) {
      if (isAlreadyReported(error)) return;
      showToast(getErrorMessage(error, "Couldn't load booking services."), "error");
    }
  }, [showToast]);

  const fetchPayments = useCallback(async () => {
    const bid = bookingIdRef.current;
    if (!bid) return;
    try {
      const res  = await bookingService.getPayments(bid);
      const list = unwrap(res);
      setPayments(Array.isArray(list) ? list : []);
    } catch (error) {
      if (isAlreadyReported(error)) return;
      showToast(getErrorMessage(error, "Couldn't load payment history."), "error");
    }
  }, [showToast]);

  const fetchExpenses = useCallback(async () => {
    const bid = bookingIdRef.current;
    if (!bid) return;
    try {
      // List + summary together — the card renders both, and the summary is the server's rollup
      // (never recomputed client-side from the rows).
      const [listRes, summaryRes] = await Promise.all([
        bookingService.getExpenses(bid),
        bookingService.getExpenseSummary(bid),
      ]);
      const list = unwrap(listRes);
      setExpenses(Array.isArray(list) ? list : []);
      setExpenseSummary(unwrap(summaryRes) || null);
    } catch (error) {
      if (isAlreadyReported(error)) return;
      showToast(getErrorMessage(error, "Couldn't load the expense ledger."), "error");
    }
  }, [showToast]);

  /* The variation ledger — rows, the server's rollup, and the category list off the backend enum. */
  const fetchVariations = useCallback(async () => {
    const bid = bookingIdRef.current;
    if (!bid) return;
    try {
      const [listRes, summaryRes, catRes] = await Promise.all([
        bookingService.getVariations(bid),
        bookingService.getVariationSummary(bid),
        bookingService.getVariationCategories(bid),
      ]);
      const list = unwrap(listRes);
      setVariations(Array.isArray(list) ? list : []);
      setVariationSummary(unwrap(summaryRes) || null);
      const cats = unwrap(catRes);
      setVariationCategories(Array.isArray(cats) ? cats : []);
    } catch (error) {
      if (isAlreadyReported(error)) return;
      showToast(getErrorMessage(error, "Couldn't load cost variations."), "error");
    }
  }, [showToast]);

  /**
   * The two money ROLLUPS, loaded on mount rather than with their tab.
   *
   * The ledger ROWS stay lazy behind the Finance tab — they are long and most visits never open it.
   * The summaries are different: they drive cards in the always-visible KPI strip, and a card that
   * reads ₹0 until you happen to click Finance is worse than no card. Two small rollups.
   *
   * Failures are swallowed: these enrich cards that already have a booking-level fallback, and the
   * user did not ask for them, so a failure is not an outcome worth interrupting them about.
   */
  const fetchMoneySummaries = useCallback(async () => {
    const bid = bookingIdRef.current;
    if (!bid || !canSeeMargin) return;
    const [exp, vari] = await Promise.allSettled([
      bookingService.getExpenseSummary(bid),
      bookingService.getVariationSummary(bid),
    ]);
    if (exp.status === "fulfilled")  setExpenseSummary(unwrap(exp.value) || null);
    if (vari.status === "fulfilled") setVariationSummary(unwrap(vari.value) || null);
  }, [canSeeMargin]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    // Reset — never carry a previous booking's UUID across a param change: on the code path the
    // sub-fetches must wait for fetchBooking to resolve the new publicId, or they'd render the
    // previous booking's ledgers under the new booking's header.
    bookingIdRef.current = looksLikeUuid(id) ? id : null;
    loadedSectionsRef.current.clear();
    setPayments([]);
    setExpenses([]);
    setExpenseSummary(null);
    setVariations([]);
    setVariationSummary(null);
    setReminders([]);
    setTimeline([]);
    setDataEpoch(v => v + 1);
    await fetchBooking();
    await fetchServices();
    // After fetchBooking, because it is what resolves bookingIdRef on the booking-code route.
    await fetchMoneySummaries();
    setLoading(false);
  }, [id, fetchBooking, fetchServices, fetchMoneySummaries]);

  useEffect(() => { loadAll(); }, [loadAll]);

  /* ── LINKED QUOTATION (the itinerary source) ──
     A Booking never embeds its quotation; it only carries sourceQuotationPublicId, stamped at
     lead conversion. A direct booking has none — that absence is the genuine "no linked
     quotation" branch. */
  useEffect(() => {
    const qid = booking?.quotationPublicId;
    if (!qid) { setQuotation(null); return; }
    let cancelled = false;
    setQuotLoading(true);
    (async () => {
      try {
        const res = await quotationService.getQuotationById(qid);
        if (!cancelled) setQuotation(unwrap(res) || null);
      } catch {
        // A deleted quotation or a 403 must not take the whole details page down — fall back to
        // the direct-booking view. The interceptor has already surfaced anything worth a toast.
        if (!cancelled) setQuotation(null);
      } finally {
        if (!cancelled) setQuotLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [booking?.quotationPublicId]);

  /* ── CUSTOMER PROFILE (sync fields: contact, tier, birthday, anniversary) ──
     BookingResponseDTO ships customerId as the customer's publicId precisely so this screen can
     enrich the snapshot name with the live profile. Failure only degrades the card. */
  useEffect(() => {
    const cid = booking?.customerId;
    if (!cid || !canReadCustomer) { setCustomer(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await customerService.getById(cid);
        if (!cancelled) setCustomer(unwrap(res) || null);
      } catch {
        if (!cancelled) setCustomer(null);   // supplementary — never blank the page over it
      }
    })();
    return () => { cancelled = true; };
  }, [booking?.customerId, canReadCustomer]);

  /* ── CANCELLATION POSITION (frozen refund ledger) ──
     Only exists once a booking has been cancelled; 404 on anything else is expected and silent
     (the interceptor never toasts 404s). */
  const fetchCancelSummary = useCallback(async () => {
    const bid = booking?.id;
    const st  = booking?.status;
    if (!bid || (st !== "CANCELLED" && st !== "REFUNDED")) { setCancelSummary(null); return; }
    try {
      const res = await bookingService.getCancellationSummary(bid);
      setCancelSummary(unwrap(res) || null);
    } catch {
      setCancelSummary(null);
    }
  }, [booking?.id, booking?.status]);

  useEffect(() => { fetchCancelSummary(); }, [fetchCancelSummary]);

  /* ── BOOKING REMINDERS ──
     BookingReminder carries no FK to Booking — it is matched on the bookingCode string, so this
     is a separate read keyed by code rather than publicId. */
  const fetchReminders = useCallback(async () => {
    const code = booking?.code;
    if (!code || code === "—") return;
    try {
      const res  = await bookingReminderService.getByBookingCode(code);
      const list = unwrap(res);
      setReminders(Array.isArray(list) ? list : []);
    } catch {
      setReminders([]);   // reminders are supplementary; never blank the page over them
    }
  }, [booking?.code]);

  const fetchTimeline = useCallback(async () => {
    const bid = booking?.id;
    if (!bid) return;
    try {
      const res = await bookingService.getTimeline(bid);
      const list = unwrap(res);
      setTimeline(Array.isArray(list) ? list : []);
    } catch (error) {
      if (!isAlreadyReported(error)) {
        showToast(getErrorMessage(error, "Couldn't load booking activity."), "error");
      }
      setTimeline([]);
    }
  }, [booking?.id, showToast]);

  useEffect(() => {
    if (!booking?.id) return;
    const jobs = [];
    if (tab === "payments" && !loadedSectionsRef.current.has("payments")) {
      loadedSectionsRef.current.add("payments");
      jobs.push(fetchPayments());
      if (canSeeMargin) {
        jobs.push(fetchExpenses());
        jobs.push(fetchVariations());
      }
    }
    if (tab === "reminders" && canReadReminders && !loadedSectionsRef.current.has("reminders")) {
      loadedSectionsRef.current.add("reminders");
      jobs.push(fetchReminders());
    }
    if (tab === "activity" && !loadedSectionsRef.current.has("activity")) {
      loadedSectionsRef.current.add("activity");
      jobs.push(fetchTimeline());
    }
    if (jobs.length === 0) return;
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return undefined;
      setSectionLoading(tab);
      return Promise.allSettled(jobs);
    }).finally(() => {
      if (active) setSectionLoading(null);
    });
    return () => { active = false; };
  }, [booking?.id, tab, dataEpoch, canSeeMargin, canReadReminders, fetchPayments, fetchExpenses,
      fetchVariations, fetchReminders, fetchTimeline]);

  const handleSendReminder = async (remId) => {
    if (remId == null) return;
    setSendingRem(remId);
    try {
      await bookingReminderService.sendNow(remId);
      showToast("Reminder sent.", "success");
      await fetchReminders();
    } catch (error) {
      if (!isAlreadyReported(error)) {
        showToast(getErrorMessage(error, "Failed to send reminder."), "error");
      }
    } finally {
      setSendingRem(null);
    }
  };

  /* ── STATUS UPDATE ── */
  const handleStatusChange = async (newStatus) => {
    if (!canUpdate) return;
    // Cancellation is not a status edit. PATCH /status rejects CANCELLED outright (see
    // bookingService.updateStatus) because cancelling has to price the cancellation charge and
    // decide what happens to the source lead — so "Cancelled" opens the flow that can do it.
    if (String(newStatus).toUpperCase() === "CANCELLED") {
      setShowCancel(true);
      return;
    }
    const prev = booking.status;
    setBooking(p => ({ ...p, status: newStatus.toUpperCase() }));
    try {
      await bookingService.updateStatus(booking.id, newStatus);
      showToast(`Booking status updated to ${titleCase(newStatus)}.`, "success");
      fetchBooking();
    } catch (error) {
      setBooking(p => ({ ...p, status: prev }));
      if (isAlreadyReported(error)) return;
      showToast(getErrorMessage(error, "Failed to update status."), "error");
    }
  };

  /* ── DELETE PAYMENT ── */
  const handleDeletePayment = async (payPublicId) => {
    try {
      await bookingService.deletePayment(booking.id, payPublicId);
      showToast("Payment removed.", "success");
      await Promise.all([fetchPayments(), fetchBooking()]);
    } catch (error) {
      if (!isAlreadyReported(error)) showToast(getErrorMessage(error, "Failed to remove payment."), "error");
    } finally {
      setDeletingPay(null);
    }
  };

  /* ── EXPENSE LEDGER OPS ──
     Every mutation re-reads the booking too: INTERNAL lines move totalInternalCosts and
     netProfit, and only the server settles those figures. */
  const refreshExpenseMoney = useCallback(async () => {
    await Promise.all([fetchExpenses(), fetchBooking()]);
  }, [fetchExpenses, fetchBooking]);

  const saveExpenses = async (rows) => {
    if (!booking?.id) return;
    setExpenseSaving(true);
    try {
      await bookingService.addExpenses(booking.id, { expenses: rows });
      showToast(`${rows.length} expense(s) recorded.`, "success");
      setShowAddExpense(false);
      await refreshExpenseMoney();
    } catch (error) {
      if (isAlreadyReported(error)) return;
      showToast(getErrorMessage(error, "Couldn't save booking expenses."), "error");
    } finally {
      setExpenseSaving(false);
    }
  };

  /* A variation write moves BOTH ledgers' consequences: the customer side changes totalPayable and
     can flip the payment status, the cost side changes netProfit. So the booking itself is refetched
     alongside the ledger — refreshing only the rows would leave the header cards quoting the old
     totals until the next navigation. */
  const refreshVariationMoney = useCallback(async () => {
    await Promise.all([fetchVariations(), fetchBooking()]);
  }, [fetchVariations, fetchBooking]);

  const saveVariations = async (payload) => {
    if (!booking?.id) return;
    setVariationSaving(true);
    try {
      if (editVariation) {
        await bookingService.updateVariation(booking.id, editVariation.publicId, payload);
        showToast("Change updated.", "success");
      } else {
        await bookingService.addVariations(booking.id, payload);
        showToast(`${payload.length} change(s) recorded.`, "success");
      }
      setShowVariationModal(false);
      setEditVariation(null);
      await refreshVariationMoney();
    } catch (error) {
      if (isAlreadyReported(error)) return;
      showToast(getErrorMessage(error, "Couldn't save the change."), "error");
    } finally {
      setVariationSaving(false);
    }
  };

  const handleDeleteVariation = async (variation) => {
    if (!booking?.id) return;
    setVariationBusy(variation.publicId);
    try {
      await bookingService.deleteVariation(booking.id, variation.publicId);
      showToast("Change removed.", "success");
      await refreshVariationMoney();
    } catch (error) {
      if (isAlreadyReported(error)) return;
      showToast(getErrorMessage(error, "Couldn't remove the change."), "error");
    } finally {
      setVariationBusy(null);
    }
  };

  const openSettle = (exp) => {
    setSettleExp(exp.publicId);
    setSettleErr("");
    // Default to clearing the whole balance — the common case is "vendor ko baaki de diya".
    setSettleForm({
      amount: exp.outstandingAmount != null ? String(exp.outstandingAmount) : "",
      mode: "",
      reference: "",
    });
  };

  const submitSettle = async (exp) => {
    const payment = Number(settleForm.amount);
    const alreadyPaid = Number(exp.paidAmount) || 0;
    const lineTotal = Number(exp.amount) || 0;
    if (!payment || payment <= 0) { setSettleErr("Enter a valid payment amount."); return; }
    if (alreadyPaid + payment > lineTotal + 0.009) {
      setSettleErr(`Only ${fmtINR(Math.max(0, lineTotal - alreadyPaid))} is outstanding on this line.`);
      return;
    }
    setSettleSaving(true);
    try {
      // The PUT contract takes the CUMULATIVE paid figure ("disbursed so far"), not the delta.
      // No status is sent — the server derives PARTIAL/PAID back from the money.
      await bookingService.updateExpense(booking.id, exp.publicId, {
        paidAmount: alreadyPaid + payment,
        ...(settleForm.mode ? { paymentMode: settleForm.mode } : {}),
        ...(settleForm.reference.trim() ? { referenceNumber: settleForm.reference.trim() } : {}),
      });
      showToast(`${fmtINR(payment)} recorded against "${exp.description}".`, "success");
      setSettleExp(null);
      await refreshExpenseMoney();
    } catch (error) {
      if (isAlreadyReported(error)) return;
      showToast(getErrorMessage(error, "Couldn't record the payment."), "error");
    } finally {
      setSettleSaving(false);
    }
  };

  const markExpensePaid = async (exp) => {
    setExpBusy(exp.publicId);
    try {
      await bookingService.updateExpense(booking.id, exp.publicId, { paymentStatus: "PAID" });
      showToast(`"${exp.description}" marked fully paid.`, "success");
      await refreshExpenseMoney();
    } catch (error) {
      if (isAlreadyReported(error)) return;
      showToast(getErrorMessage(error, "Couldn't settle the expense."), "error");
    } finally {
      setExpBusy(null);
    }
  };

  const handleDeleteExpense = async (exp) => {
    setExpBusy(exp.publicId);
    try {
      await bookingService.deleteExpense(booking.id, exp.publicId);
      showToast("Expense removed.", "success");
      setDeletingExp(null);
      await refreshExpenseMoney();
    } catch (error) {
      if (!isAlreadyReported(error)) showToast(getErrorMessage(error, "Couldn't remove the expense."), "error");
    } finally {
      setExpBusy(null);
    }
  };

  /* ── PDF DOWNLOADS ── */
  const downloadVoucher = async () => {
    setDownloading("voucher");
    try {
      const res = await bookingService.getVoucher(booking.id);
      downloadBlob(res.data, `Voucher-${booking.code}.pdf`);
      showToast("Voucher downloaded.", "success");
    } catch (error) {
      if (isAlreadyReported(error)) return;
      await hydrateBlobError(error);
      showToast(getErrorMessage(error, "Couldn't generate the voucher."), "error");
    } finally { setDownloading(null); }
  };

  const downloadServiceVoucher = async (svc) => {
    setDownloading(`svc-${svc.publicId}`);
    try {
      const res = await bookingService.getServiceVoucher(booking.id, svc.publicId);
      const safe = String(svc.title || svc.serviceType || "service").replace(/[^\w-]+/g, "_");
      downloadBlob(res.data, `Voucher-${booking.code}-${safe}.pdf`);
      showToast("Service voucher downloaded.", "success");
    } catch (error) {
      if (isAlreadyReported(error)) return;
      await hydrateBlobError(error);
      showToast(getErrorMessage(error, "Couldn't generate the service voucher."), "error");
    } finally { setDownloading(null); }
  };

  const downloadCreditNote = async () => {
    setDownloading("credit-note");
    try {
      const res = await bookingService.getCreditNote(booking.id);
      downloadBlob(res.data, `CancellationNote-${booking.code}.pdf`);
      showToast("Cancellation note downloaded.", "success");
    } catch (error) {
      if (isAlreadyReported(error)) return;
      await hydrateBlobError(error);
      showToast(getErrorMessage(error, "Couldn't generate the cancellation note."), "error");
    } finally { setDownloading(null); }
  };

  const downloadRefundVoucher = async () => {
    setDownloading("refund-voucher");
    try {
      const res = await bookingService.getRefundVoucher(booking.id);
      downloadBlob(res.data, `RefundVoucher-${booking.code}.pdf`);
      showToast("Refund voucher downloaded.", "success");
    } catch (error) {
      if (isAlreadyReported(error)) return;
      await hydrateBlobError(error);
      showToast(getErrorMessage(error, "No refund voucher yet — it's issued once a refund is disbursed."), "error");
    } finally { setDownloading(null); }
  };

  /* ── LOADING ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-slate-100 flex items-center justify-center"
        style={{fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif"}}>
        <div className="text-center">
          <div className="w-14 h-14 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"/>
          <p className="text-slate-500 font-semibold">Loading booking details…</p>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-slate-100 flex items-center justify-center"
        style={{fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif"}}>
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <p className="text-lg font-extrabold text-slate-600 mb-2">Booking Not Found</p>
          <button onClick={()=>navigate("/Allbookings")}
            className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-all mx-auto">
            <FiArrowLeft className="w-4 h-4"/> Back to Bookings
          </button>
        </div>
      </div>
    );
  }

  const b = booking;
  const statusStyle = STATUS_STYLE[b.status] || STATUS_STYLE.PENDING;
  const statusDot   = STATUS_DOT[b.status]   || STATUS_DOT.PENDING;
  const payStyle    = PAY_STYLE[b.payStatus]  || PAY_STYLE.UNPAID;
  const isCancelled = b.status === "CANCELLED" || b.status === "REFUNDED";
  const isTerminal = isCancelled || b.status === "COMPLETED";
  const canEditBooking = canUpdate && !isTerminal;
  const canAddPayment = canEditBooking && b.due > 0;
  const netCollected = Math.max(0, b.paid - b.refunded);
  const hasRefundVoucher = Number(cancelSummary?.totalRefunded ?? b.refunded) > 0;
  const totalTravellers = (Number(b.adults) || 0) + (Number(b.children) || 0) + (Number(b.infants) || 0);
  // Check-out after the itinerary's total nights — derived from the snapshot legs, otherwise
  // whatever end date a pre-normalised caller provided.
  const travelEnd = b.travelEndDate
    ? b.travelEndDate
    : (b.travelDate && b.totalNights > 0
        ? new Date(new Date(b.travelDate).getTime() + b.totalNights * 86400000)
        : null);
  const travelWindow = b.travelDate
    ? `${fmtDate(b.travelDate)}${travelEnd ? ` → ${fmtDate(travelEnd)}` : ""}${b.totalNights ? ` · ${b.totalNights}N` : ""}`
    : "—";
  const receiptCount = payments.filter(p => String(p.entryType || "RECEIPT").toUpperCase() !== "REFUND").length;

  /* What is still owed to suppliers. Straight off the server's expense rollup — the ledger rows
     themselves stay behind the Finance tab, so this is null until the summary loads. */
  const vendorOutstanding = Number(expenseSummary?.totalOutstanding) || 0;

  /* The collection deadline, said in the only terms that matter to whoever is chasing it: how long
     is left before the customer travels. Derived from travelDate rather than a reminder row, so it
     needs no extra fetch and cannot disagree with the date on the booking. */
  /* Parsed as `${date}T00:00:00` — a bare "YYYY-MM-DD" is parsed as UTC midnight, so comparing it
     against a local midnight silently shifts the count by a day west of Greenwich. */
  const daysToTravel = b.travelDate
    ? Math.ceil((new Date(`${b.travelDate}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000)
    : null;
  const nextDueLabel = b.due <= 0 || daysToTravel == null
    ? ""
    : daysToTravel < 0 ? "travel date passed"
      : daysToTravel === 0 ? "travels today"
        : `${daysToTravel} day${daysToTravel === 1 ? "" : "s"} to travel`;
  const snap = b.tripSnapshot;
  const dep  = snap?.departure || null;
  const sa   = snap?.specialAssistance || null;
  const legs = Array.isArray(snap?.itinerary) ? snap.itinerary : [];
  const depPoint = dep
    ? (dep.airport
        ? `${dep.airport}${dep.airportCode ? ` (${dep.airportCode})` : ""}`
        : dep.railwayStation || null)
    : null;

  // daysToTravel is declared once, above, where nextDueLabel first needs it.
  const missingVendors = services.filter(s => !s.vendorPublicId && !s.vendorName).length;
  const alerts = [
    b.due > 0 && { tone: "rose", title: `${fmtINR(b.due)} customer payment pending`, action: "Open Finance", tab: "payments" },
    missingVendors > 0 && { tone: "amber", title: `${missingVendors} service${missingVendors === 1 ? "" : "s"} need vendor assignment`, action: "Review Services", tab: "services" },
    Number(expenseSummary?.overdueCount) > 0 && { tone: "rose", title: `${fmtINR(expenseSummary.overdueOutstanding)} supplier payment overdue`, action: "Open Finance", tab: "payments" },
    sa && (sa.required || sa.types?.length > 0) && { tone: "amber", title: "Special assistance requires operational attention", action: "View Travellers", tab: "overview" },
    !b.assignedUser || b.assignedUser === "—" ? { tone: "slate", title: "No booking owner assigned", action: "Edit Booking", route: `/EditBooking/${b.id}` } : null,
    daysToTravel != null && daysToTravel >= 0 && daysToTravel <= 7 && { tone: "blue", title: `Travel starts ${daysToTravel === 0 ? "today" : `in ${daysToTravel} day${daysToTravel === 1 ? "" : "s"}`}`, action: "Check Trip", tab: "itinerary" },
  ].filter(Boolean);

  const TABS = [
    { key: "overview",  label: "Overview",  icon: <FiGrid className="w-3.5 h-3.5"/> },
    { key: "itinerary", label: "Trip & Travellers", icon: <FiMap className="w-3.5 h-3.5"/> },
    { key: "services",  label: "Services",  icon: <MdOutlineAssignment className="w-3.5 h-3.5"/>, count: services.length },
    { key: "payments",  label: "Finance",  icon: <FiCreditCard className="w-3.5 h-3.5"/>, count: payments.length + (canSeeMargin ? expenses.length : 0) },
    ...(canReadReminders ? [{ key: "reminders", label: "Communication", icon: <FiBell className="w-3.5 h-3.5"/>, count: reminders.length }] : []),
    { key: "documents", label: "Documents", icon: <FiFolder className="w-3.5 h-3.5"/> },
    { key: "activity", label: "Activity", icon: <FiClock className="w-3.5 h-3.5"/>, count: timeline.length },
  ];

  /* ─── RENDER ──────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-slate-100"
      style={{fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif"}}>
      <style>{`
        @keyframes slideIn { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes popIn   { from{transform:scale(.92);opacity:0} to{transform:scale(1);opacity:1} }
      `}</style>

      {/* Modals */}
      {showAddPay  && <AddPaymentModal booking={b} showToast={showToast}
        onClose={()=>setShowAddPay(false)}
        onAdded={()=>{ fetchPayments(); fetchBooking(); }}/>}
      {showAddExpense && <BookingExpenseModal booking={b} saving={expenseSaving}
        onClose={()=>{ if (!expenseSaving) setShowAddExpense(false); }}
        onSave={saveExpenses}/>}
      {showVariationModal && <BookingVariationModal booking={b}
        categories={variationCategories}
        variation={editVariation}
        saving={variationSaving}
        onClose={()=>{ if (!variationSaving) { setShowVariationModal(false); setEditVariation(null); } }}
        onSave={saveVariations}/>}
      {assignSvc   && <AssignVendorModal booking={b} service={assignSvc} showToast={showToast}
        onClose={()=>setAssignSvc(null)}
        onAssigned={()=>{ fetchServices(); fetchBooking(); }}/>}
      {showRefund  && <RefundBookingModal booking={b} onToast={showToast}
        onClose={()=>setShowRefund(false)}
        onRefunded={()=>{ fetchBooking(); fetchPayments(); fetchCancelSummary(); }}/>}
      {gstOpen     && <BookingInvoiceModal bookingId={b.id} bookingCode={b.code}
        onClose={()=>setGstOpen(false)}/>}
      {/* The modal compares `booking.status === "Completed"` in title case to block cancelling a
          completed booking, but this page normalises status to UPPERCASE — pass it back in the
          shape the modal expects or that guard silently never fires. */}
      {showCancel  && <CancelBookingModal booking={{ ...b, status: titleCase(b.status) }}
        onToast={showToast}
        onClose={()=>setShowCancel(false)}
        onCancelled={()=>{ fetchBooking(); fetchPayments(); }}/>}

      {/* ── PAGE HEADER ──
          Not sticky: the app Navbar above this page is already sticky top-0 z-40, and a second
          sticky bar at top-0 would slide underneath it. */}
      <div className="bg-white/70 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3.5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={()=>navigate("/Allbookings")} aria-label="Back to bookings"
                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-all flex-shrink-0">
                <FiArrowLeft className="w-4 h-4 text-slate-600"/>
              </button>
              {/* The three facts that identify the booking sit HERE, in the header.
                  The customer's name and the booking date used to be buried inside the Overview
                  tab's Customer and Booking Snapshot sections, so the one line that answers "whose
                  booking is this, and when was it taken?" required opening a tab and scrolling. */}
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-lg font-extrabold text-slate-800 truncate max-w-[22ch] sm:max-w-none"
                    title={b.customer}>{b.customer}</h1>
                  <span className="text-sm font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-lg">{b.code}</span>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${statusStyle}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`}/>
                    {titleCase(b.status)}
                  </span>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${payStyle}`}>
                    💳 {titleCase(b.payStatus)}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400 mt-1">
                  <span className="font-semibold text-slate-500">Booked {fmtDate(b.bookingDate)}</span>
                  <span className="text-slate-300">·</span>
                  <span className="font-semibold text-slate-500">Travel {fmtDate(b.travelDate)}</span>
                  {b.destination && b.destination !== "—" && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="font-semibold text-slate-500 truncate max-w-[18ch]" title={b.destination}>
                        {b.destination}
                      </span>
                    </>
                  )}
                  <nav aria-label="Breadcrumb" className="hidden lg:flex items-center">
                    <span className="text-slate-300 mx-1">·</span>
                    <button type="button" onClick={()=>navigate("/")} className="hover:text-blue-600">Home</button>
                    <span className="mx-1">/</span>
                    <button type="button" onClick={()=>navigate("/Allbookings")} className="hover:text-blue-600">Bookings</button>
                    <span className="mx-1">/</span>
                    <span className="text-blue-600 font-bold" aria-current="page">View</span>
                  </nav>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={loadAll}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 hover:border-blue-300 bg-white text-slate-600 hover:text-blue-600 text-xs font-bold transition-all">
                <FiRefreshCw className={`w-3.5 h-3.5 ${loading?"animate-spin":""}`}/> Refresh
              </button>
              {canAddPayment && (
                <button onClick={()=>setShowAddPay(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white text-xs font-bold shadow-sm transition-all">
                  <MdPayment className="w-3.5 h-3.5"/> Add Payment
                </button>
              )}
              {canEditBooking && (
                <button onClick={()=>navigate(`/EditBooking/${b.id}`)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-700 hover:to-indigo-600 text-white text-xs font-bold shadow-sm shadow-blue-200 transition-all">
                  <FiEdit2 className="w-3.5 h-3.5"/> Edit
                </button>
              )}
              <button onClick={()=>setTab("documents")}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-bold transition-all">
                <FiFolder className="w-3.5 h-3.5"/> Documents
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5 space-y-5">

        <BookingAttentionBar alerts={alerts}
          onOpen={(alert)=>alert.route ? navigate(alert.route) : setTab(alert.tab)}/>

        {/* ── KPI STRIP ──
            ONE row: what the customer owes, what changed, what came in, what is left, what we made,
            and what we still owe suppliers. Six on a wide screen, wrapping to three and then two.

            No Taxes card — GST and TCS are the BREAKUP of Total Payable, and a card whose value was
            their sum said nothing the first card's sub-line does not say better. No Trip card
            either: dates and pax are trip facts, not money, and they already have a home in Trip &
            Travellers. Both were crowding the one row this strip is supposed to be.

            Net Profit and Vendor Outstanding are gated on canSeeMargin — UI courtesy, the API is the
            real boundary — so a sales user sees four cards, not six. */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Total Payable" value={fmtINR(b.totalPayable)}
            sub={`Base ${fmtINR(b.customerAmount)} · GST ${fmtINR(b.gst)} · TCS ${fmtINR(b.tcs)}${
              b.customerAdjustments !== 0 ? ` · Changes ${signedINR(b.customerAdjustments)}` : ""}`}
            icon="🧾" gradient="from-blue-600 to-indigo-600" delay={0}/>

          {/* Variations: the money that moved AFTER the booking was made. Its own card because
              "why is the total not what we quoted?" is otherwise unanswerable from this screen. */}
          <StatCard label="Changes & Extras"
            value={variationSummary ? signedINR(variationSummary.netCustomerAdjustment) : fmtINR(b.customerAdjustments)}
            sub={variationSummary
              ? `${variationSummary.variationCount} event${variationSummary.variationCount === 1 ? "" : "s"}`
                + (Number(variationSummary.totalWaived) > 0 ? ` · ${fmtINR(variationSummary.totalWaived)} waived` : "")
                + (canSeeMargin && Number(variationSummary.netCostVariation) !== 0
                    ? ` · cost ${signedINR(variationSummary.netCostVariation)}` : "")
              : "Charges & waivers after booking"}
            icon="🔀" gradient="from-violet-600 to-purple-600" delay={60}/>

          <StatCard label="Net Collected" value={fmtINR(netCollected)}
            sub={`${fmtINR(b.paid)} gross · ${receiptCount} receipt${receiptCount === 1 ? "" : "s"}${b.refunded > 0 ? ` · ${fmtINR(b.refunded)} refunded` : ""}`}
            icon="✓" gradient="from-green-600 to-emerald-600" delay={120}/>

          <StatCard label="Pending" value={fmtINR(b.due)}
            sub={`${b.payPct}% collected${nextDueLabel ? ` · ${nextDueLabel}` : ""}`}
            icon="⏳" gradient="from-amber-600 to-orange-600" delay={180}/>

          {canSeeMargin && (
            <StatCard label="Net Profit" value={fmtINR(b.netProfit)}
              sub={`Margin ${b.netMargin}% · Supplier ${fmtINR(b.totalSupplierCost)}${b.totalInternalCosts > 0 ? ` · Company ${fmtINR(b.totalInternalCosts)}` : ""}`}
              icon="📈" gradient="from-teal-600 to-cyan-600" delay={240}/>
          )}

          {canSeeMargin && (
            <StatCard label="Vendor Outstanding" value={fmtINR(vendorOutstanding)}
              sub={expenseSummary
                ? `${fmtINR(expenseSummary.totalExpense)} billed · ${fmtINR(expenseSummary.totalPaid)} paid${
                    Number(expenseSummary.overdueOutstanding) > 0 ? ` · ${fmtINR(expenseSummary.overdueOutstanding)} overdue` : ""}`
                : "Payable to suppliers"}
              icon="🏦" gradient="from-rose-600 to-pink-600" delay={300}/>
          )}
        </div>

        {/* ── CANCELLATION / REFUND POSITION — frozen ledger, only after a real cancellation ── */}
        {cancelSummary && (
          <section className="bg-white/80 backdrop-blur-md rounded-2xl border border-rose-200/70 shadow-sm overflow-hidden"
            style={{animation:"fadeUp .4s ease both"}}>
            <div className="h-1 bg-gradient-to-r from-rose-500 to-red-500"/>
            <div className="px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
                  <FiAlertCircle className="w-4 h-4"/>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-extrabold text-slate-800">Cancellation &amp; Refund Position</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${REFUND_STATUS_STYLE[cancelSummary.refundStatus] || REFUND_STATUS_STYLE.NOT_APPLICABLE}`}>
                      {titleCase(cancelSummary.refundStatus)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Cancelled {fmtDate(cancelSummary.cancelledOn)}
                    {cancelSummary.reason ? ` · ${cancelSummary.reason}` : ""}
                    {cancelSummary.creditNoteNumber ? ` · Note ${cancelSummary.creditNoteNumber}` : ""}
                  </p>
                  {cancelSummary.customerOwes && Number(cancelSummary.customerBalanceOwed) > 0 && (
                    <p className="text-xs font-bold text-red-600 mt-1">
                      Customer owes {fmtINR(cancelSummary.customerBalanceOwed)} — retention exceeds what was paid.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
                {[
                  ["Refund Due",  cancelSummary.refundDue,           "text-slate-800"],
                  ["Refunded",    cancelSummary.totalRefunded,        "text-green-600"],
                  ["Remaining",   cancelSummary.remainingRefundable,  Number(cancelSummary.remainingRefundable) > 0 ? "text-rose-600" : "text-green-600"],
                ].map(([label, val, cls]) => (
                  <div key={label} className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                    <p className={`text-sm font-extrabold ${cls}`}>{fmtINR(val)}</p>
                  </div>
                ))}
                {canRefund && !cancelSummary.fullyRefunded && (
                  <button onClick={()=>setShowRefund(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-xs font-bold shadow-sm transition-all">
                    <MdPayment className="w-3.5 h-3.5"/> Record Refund
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5 items-start">

          {/* ════════════════ LEFT RAIL ════════════════ */}
          <div className="space-y-5">

            {/* Identity & payment position */}
            <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden"
              style={{animation:"fadeUp .4s ease both"}}>
              <div className="bg-gradient-to-br from-blue-600 via-indigo-500 to-indigo-600 px-5 py-6 text-center relative overflow-hidden">
                <div className="absolute -left-8 -top-8 w-28 h-28 rounded-full bg-white/10 pointer-events-none"/>
                <div className="absolute -right-6 -bottom-10 w-28 h-28 rounded-full bg-white/10 pointer-events-none"/>
                <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-3 relative">
                  <FaPlane className="w-7 h-7 text-white"/>
                </div>
                <p className="text-2xl font-extrabold text-white tracking-widest relative">{b.code}</p>
                <p className="text-white/80 text-sm mt-1 relative">{b.customer} · {b.destination}</p>
                {b.overseas && (
                  <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold text-white bg-white/20 rounded-full px-2.5 py-0.5 relative">
                    🌍 Overseas Tour Package
                  </span>
                )}
              </div>

              {/* Status rows */}
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Status</span>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${statusStyle}`}>
                  {titleCase(b.status)}
                </span>
              </div>
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Payment Status</span>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${payStyle}`}>{titleCase(b.payStatus)}</span>
              </div>

              {/* Payment position */}
              <div className="px-5 py-4 space-y-2.5">
                {[
                  ["Customer Amount", b.customerAmount, "text-slate-700"],
                  ["GST",             b.gst,            "text-slate-500"],
                  ["TCS",             b.tcs,            "text-slate-500"],
                  ["Total Payable",   b.totalPayable,   "text-blue-600 font-extrabold"],
                  ["Paid Amount",     b.paid,           "text-green-600 font-bold"],
                  ["Due Amount",      b.due,            b.due > 0 ? "text-red-600 font-bold" : "text-green-600 font-bold"],
                  ...(b.refunded > 0 ? [
                    ["Refunded",      b.refunded,       "text-rose-600 font-bold"],
                  ] : []),
                  // Every term of netProfit = customerAmount − vendorCost − totalVendorCosts −
                  // totalInternalCosts is listed, so the subtraction is readable off the panel
                  // rather than being an unexplained number. The two ledger lines are hidden when
                  // zero to keep an un-itemised booking's panel as short as it was before.
                  ...(canSeeMargin ? [
                    [b.vendorName ? `Vendor Cost — ${b.vendorName}` : "Vendor Cost (typed)",
                                          b.vendorCost, "text-slate-500"],
                    ...(b.totalVendorCosts > 0 ? [
                      ["Vendor Costs (ledger)", b.totalVendorCosts, "text-slate-500"],
                    ] : []),
                    ...(b.totalInternalCosts > 0 ? [
                      ["Company Costs (ledger)", b.totalInternalCosts, "text-slate-500"],
                    ] : []),
                    ["Net Profit",    b.netProfit,      b.netProfit >= 0 ? "text-green-600 font-bold" : "text-red-600 font-bold"],
                  ] : []),
                ].map(([label, val, cls])=>(
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">{label}</span>
                    <span className={`text-sm ${cls || "text-slate-700"}`}>{fmtINR(val)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <span className="text-xs text-slate-500 font-medium">Travellers</span>
                  <span className="text-sm font-bold text-slate-700">
                    {totalTravellers > 0 ? `${totalTravellers} pax` : "—"}
                    {b.adults > 0 && <span className="text-slate-400 font-normal text-xs ml-1">({b.adults}A{b.children > 0 ? ` · ${b.children}C` : ""}{b.infants > 0 ? ` · ${b.infants}I` : ""})</span>}
                  </span>
                </div>
              </div>

              {/* Payment progress */}
              <div className="px-5 pb-4">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                  <span>Payment Progress</span>
                  <span className={b.payPct===100?"text-green-600 font-bold":"text-blue-600 font-bold"}>{b.payPct}% collected</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden" role="progressbar"
                  aria-valuenow={b.payPct} aria-valuemin={0} aria-valuemax={100} aria-label="Payment progress">
                  <div className={`h-full rounded-full transition-all duration-700
                    ${b.payPct===100?"bg-gradient-to-r from-green-500 to-emerald-500":"bg-gradient-to-r from-blue-600 to-indigo-500"}`}
                    style={{width:`${b.payPct}%`}}/>
                </div>
              </div>

              {/* Quick actions */}
              <div className="px-5 pb-5 space-y-2">
                {canEditBooking && (
                  <button onClick={()=>navigate(`/EditBooking/${b.id}`)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-700 hover:to-indigo-600 text-white text-sm font-bold transition-all shadow-sm shadow-blue-200">
                    <FiEdit2 className="w-4 h-4"/> Edit Booking
                  </button>
                )}
                {canAddPayment && (
                  <button onClick={()=>setShowAddPay(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-sm font-bold transition-all shadow-sm shadow-green-200">
                    <MdPayment className="w-4 h-4"/> Add Payment
                  </button>
                )}
                {canEditBooking && b.status === "PENDING" && (
                  <button onClick={()=>handleStatusChange("CONFIRMED")}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 text-sm font-bold transition-all">
                    <FiCheck className="w-4 h-4"/> Confirm Booking
                  </button>
                )}
                {canEditBooking && b.status === "CONFIRMED" && (
                  <button onClick={()=>handleStatusChange("COMPLETED")}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-sm font-bold transition-all">
                    <FiCheck className="w-4 h-4"/> Mark Completed
                  </button>
                )}
                {canCancel && !isTerminal && (
                  <button onClick={()=>setShowCancel(true)}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold transition-all">
                    <FiX className="w-3.5 h-3.5"/> Cancel Booking
                  </button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={()=>setGstOpen(true)}
                    className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all">
                    <FaReceipt className="w-3 h-3"/> GST Invoice
                  </button>
                  <button onClick={downloadVoucher} disabled={downloading==="voucher"}
                    className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-blue-200 bg-white text-blue-700 hover:bg-blue-50 text-xs font-bold transition-all disabled:opacity-60">
                    {downloading==="voucher"
                      ? <span className="w-3 h-3 border-2 border-blue-200 border-t-blue-700 rounded-full animate-spin"/>
                      : <FiDownload className="w-3 h-3"/>}
                    Voucher
                  </button>
                </div>

                {/* Cancellation documents — only once the booking is cancelled/refunded */}
                {isCancelled && (
                  <div className="pt-2 mt-1 border-t border-slate-100 space-y-2">
                    {canRefund && (
                      <button onClick={()=>setShowRefund(true)}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-xs font-bold transition-all shadow-sm">
                        <MdPayment className="w-3.5 h-3.5"/> Record Refund
                      </button>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={downloadCreditNote} disabled={downloading==="credit-note"}
                        className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-bold transition-all disabled:opacity-60">
                        {downloading==="credit-note"
                          ? <span className="w-3 h-3 border-2 border-red-300 border-t-red-700 rounded-full animate-spin"/>
                          : <FaReceipt className="w-3 h-3"/>}
                        Credit Note
                      </button>
                      <button onClick={downloadRefundVoucher} disabled={downloading==="refund-voucher"}
                        className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 text-xs font-bold transition-all disabled:opacity-60">
                        {downloading==="refund-voucher"
                          ? <span className="w-3 h-3 border-2 border-green-300 border-t-green-700 rounded-full animate-spin"/>
                          : <FiDownload className="w-3 h-3"/>}
                        Refund Voucher
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Customer */}
            <Section title="Customer" icon={<FiUser className="w-4 h-4"/>} tone="teal"
              action={ canReadCustomer && b.customerId && (
                <button onClick={()=>navigate(`/CustomerDetails/${b.customerId}`)}
                  className="flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-800 hover:underline">
                  Profile <FiExternalLink className="w-3 h-3"/>
                </button>
              )}>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white font-extrabold text-sm flex-shrink-0">
                    {(b.customer||"U").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-extrabold text-slate-800 capitalize">{b.customer}</p>
                      {customer?.tier && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gold-100 text-gold-800 border border-gold-200">
                          {customer.tier}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">{customer?.type || "Customer"}</p>
                  </div>
                </div>

                {/* Live contact detail — from the customer profile (the booking payload only
                    carries the name snapshot). */}
                {(customer?.phone || b.customerPhone) && (
                  <a href={`tel:${customer?.phone || b.customerPhone}`}
                    className="flex items-center gap-2 text-xs text-teal-700 hover:text-teal-800 font-semibold">
                    <FiPhone className="w-3.5 h-3.5"/> {customer?.phone || b.customerPhone}
                  </a>
                )}
                {customer?.email && (
                  <a href={`mailto:${customer.email}`}
                    className="flex items-center gap-2 text-xs text-teal-700 hover:text-teal-800 font-semibold break-all">
                    <FiMail className="w-3.5 h-3.5 flex-shrink-0"/> {customer.email}
                  </a>
                )}

                <div className="pt-2 space-y-2 border-t border-slate-100">
                  <KV label="Booking Date" value={fmtDateTime(b.bookingDate)}/>
                  <KV label="Travel Dates" value={travelWindow}/>
                  <KV label="Assigned To"  value={b.assignedUser}/>
                  <KV label="Created By"   value={b.createdBy}/>
                </div>

                {/* Profile sync fields — rendered only when present on the live profile. */}
                {customer && (customer.birthday || customer.anniversary || customer.city || customer.commPref) && (
                  <div className="pt-2 space-y-2 border-t border-slate-100">
                    {customer.birthday    && <KV label="Birthday"    value={fmtDate(customer.birthday)}/>}
                    {customer.anniversary && <KV label="Anniversary" value={fmtDate(customer.anniversary)}/>}
                    {(customer.city || customer.state) &&
                      <KV label="City" value={[customer.city, customer.state].filter(Boolean).join(", ")}/>}
                    {customer.commPref    && <KV label="Prefers" value={customer.commPref}/>}
                  </div>
                )}

                {/* Keyed by the public UUID, never b.leadId — that is kept only for pre-normalised
                    callers; the leads list highlights on publicId. */}
                {b.leadPublicId && (
                  <button onClick={()=>navigate(`/AllLeads?highlight=${b.leadPublicId}`)}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200 transition-all mt-2">
                    <FiExternalLink className="w-3.5 h-3.5"/> View Source Lead
                  </button>
                )}
              </div>
            </Section>

            {/* Departure — trip snapshot facts, only when the booking captured them */}
            {dep && (
              <Section title="Departure" icon={depModeIcon(dep.mode)} tone="sky">
                <div className="space-y-2">
                  {dep.mode && <KV label="Mode" value={dep.mode}/>}
                  {(dep.city || dep.country) &&
                    <KV label="From" value={[dep.city, dep.country].filter(Boolean).join(", ")}/>}
                  {depPoint && <KV label="Boarding Point" value={depPoint}/>}
                  {dep.trainClass && <KV label="Class" value={dep.trainClass}/>}
                  {dep.preferredTime && <KV label="Preferred Time" value={dep.preferredTime}/>}
                  {dep.pickupAddress && <KV label="Pickup From" value={dep.pickupAddress}/>}
                  {dep.pickupDateTime && <KV label="Pickup At" value={fmtDateTime(dep.pickupDateTime)}/>}
                  {dep.vehiclePreference && <KV label="Vehicle" value={dep.vehiclePreference}/>}
                </div>
              </Section>
            )}
          </div>

          {/* ════════════════ MAIN COLUMN ════════════════ */}
          <div className="space-y-5 min-w-0">

            {/* Tab bar */}
            <BookingTabs tabs={TABS} activeKey={tab} loadingKey={sectionLoading} onChange={setTab}/>

            {/* ══ OVERVIEW ══ */}
            {tab === "overview" && (
              <div id="panel-overview" role="tabpanel" aria-labelledby="tab-overview" className="space-y-5">

                {/* Booking snapshot */}
                <Section title="Booking Snapshot" sub="Core trip, assignment and traveller facts"
                  icon={<FiInfo className="w-4 h-4"/>} tone="blue">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
                    <KV label="Booking Code" value={b.code}/>
                    <KV label="Destination"  value={b.destination}/>
                    <KV label="Travel Dates" value={travelWindow}/>
                    <KV label="Booking Date" value={fmtDate(b.bookingDate)}/>
                    <KV label="Assigned To"  value={b.assignedUser}/>
                    <KV label="Created By"   value={b.createdBy}/>
                    {snap?.packageType && <KV label="Package Type" value={snap.packageType}/>}
                    {b.overseas && <KV label="Tour Type" value="Overseas Tour Package"/>}
                  </div>

                  {/* Traveller composition — from the trip snapshot */}
                  {(totalTravellers > 0 || b.rooms > 0 || b.extraBeds > 0) && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <FiUsers className="w-3.5 h-3.5"/> Travellers
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {b.adults   > 0 && <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">{b.adults} Adult{b.adults > 1 ? "s" : ""}</span>}
                        {b.children > 0 && <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">{b.children} Child{b.children > 1 ? "ren" : ""}</span>}
                        {b.infants  > 0 && <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-100">{b.infants} Infant{b.infants > 1 ? "s" : ""}</span>}
                        {b.rooms    > 0 && <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-50 text-slate-600 border border-slate-200">{b.rooms} Room{b.rooms > 1 ? "s" : ""}</span>}
                        {b.extraBeds> 0 && <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-50 text-slate-600 border border-slate-200">{b.extraBeds} Extra Bed{b.extraBeds > 1 ? "s" : ""}</span>}
                        {totalTravellers > 0 && <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-900 text-white">Total {totalTravellers} pax</span>}
                      </div>
                    </div>
                  )}
                </Section>

                {/* Special assistance — surfaced prominently: ops must not miss it */}
                {sa && (sa.required || sa.types?.length > 0) && (
                  <Section title="Special Assistance" sub="Requested at booking time"
                    icon={<FiAlertCircle className="w-4 h-4"/>} tone="amber">
                    <div className="space-y-2.5">
                      {sa.types?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {sa.types.map((t) => (
                            <span key={t} className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">{t}</span>
                          ))}
                        </div>
                      )}
                      {sa.passengerCount != null && <KV label="Passengers Needing Assistance" value={sa.passengerCount}/>}
                      {sa.notes && <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{sa.notes}</p>}
                    </div>
                  </Section>
                )}

                {/* Source traceability */}
                <Section title="Source Traceability" sub="Customer, lead and quotation linkage"
                  icon={<FiExternalLink className="w-4 h-4"/>} tone="indigo">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                      <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Customer</p>
                      <p className="text-sm font-bold text-slate-700 capitalize">{b.customer}</p>
                      {canReadCustomer && b.customerId && (
                        <button onClick={()=>navigate(`/CustomerDetails/${b.customerId}`)}
                          className="mt-1.5 text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1">
                          Open profile <FiExternalLink className="w-3 h-3"/>
                        </button>
                      )}
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                      <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Source Lead</p>
                      {b.leadPublicId ? (
                        <>
                          <p className="text-sm font-bold text-slate-700">Converted from a lead</p>
                          <button onClick={()=>navigate(`/AllLeads?highlight=${b.leadPublicId}`)}
                            className="mt-1.5 text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1">
                            View lead <FiExternalLink className="w-3 h-3"/>
                          </button>
                        </>
                      ) : (
                        <p className="text-sm text-slate-400">Direct booking</p>
                      )}
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                      <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Source Quotation</p>
                      {quotation ? (
                        <>
                          <p className="text-sm font-bold text-slate-700 truncate">
                            {quotation.title || "Quotation"}
                            {(quotation.version || quotation.versionNumber) && (
                              <span className="text-slate-400 font-medium"> · V{quotation.version || quotation.versionNumber}</span>
                            )}
                          </p>
                          <button onClick={()=>window.open(`/q/${quotation.publicId}`,"_blank","noopener")}
                            className="mt-1.5 text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1">
                            Open weblink <FiExternalLink className="w-3 h-3"/>
                          </button>
                        </>
                      ) : b.quotationPublicId ? (
                        <p className="text-sm text-slate-400">{quotLoading ? "Loading…" : "Linked (unavailable)"}</p>
                      ) : (
                        <p className="text-sm text-slate-400">None — created directly</p>
                      )}
                    </div>
                  </div>
                </Section>

                {/* Notes */}
                {(b.notes || snap?.notes) && (
                  <Section title="Notes" icon={<FiFileText className="w-4 h-4"/>} tone="slate">
                    <div className="space-y-3">
                      {b.notes && (
                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{b.notes}</p>
                      )}
                      {snap?.notes && (
                        <div className={b.notes ? "pt-3 border-t border-slate-100" : ""}>
                          <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Trip Notes</p>
                          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{snap.notes}</p>
                        </div>
                      )}
                    </div>
                  </Section>
                )}

                {/* Audit */}
                <Section title="Audit" sub="Operational timestamps"
                  icon={<FiClock className="w-4 h-4"/>} tone="slate">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-2.5">
                    <KV label="Created At"   value={fmtDateTime(b.createdAt)}/>
                    <KV label="Last Updated" value={fmtDateTime(b.updatedAt)}/>
                    <KV label="Created By"   value={b.createdBy}/>
                  </div>
                </Section>
              </div>
            )}

            {/* ══ ITINERARY ══ */}
            {tab === "itinerary" && (
              <div id="panel-itinerary" role="tabpanel" aria-labelledby="tab-itinerary" className="space-y-5">

                {/* Route legs from the booking's own trip snapshot */}
                {legs.length > 0 && (
                  <Section title="Route" sub="Trip legs captured on the booking"
                    icon={<FiMap className="w-4 h-4"/>} tone="sky">
                    <div className="flex flex-wrap items-center gap-2">
                      {legs.map((leg, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="rounded-xl border border-sky-100 bg-sky-50/60 px-3 py-2">
                            <p className="text-sm font-bold text-slate-700">{leg.city || leg.destination || "—"}</p>
                            <p className="text-[11px] text-slate-400 font-medium">
                              {leg.nights ? `${leg.nights} night${leg.nights > 1 ? "s" : ""}` : "—"}
                            </p>
                          </div>
                          {i < legs.length - 1 && <span className="text-slate-300 font-bold">→</span>}
                        </div>
                      ))}
                      {b.totalNights > 0 && (
                        <span className="ml-1 text-xs font-bold px-2.5 py-1 rounded-full bg-slate-900 text-white">
                          {b.totalNights}N total
                        </span>
                      )}
                    </div>
                  </Section>
                )}

                {/* Linked quotation — the package proposal this booking confirmed.
                    Quotation owns the itinerary; Booking owns the confirmed commercial record. */}
                <Section title="Quotation & Itinerary" sub="Read from the linked quotation, never duplicated onto the booking"
                  icon={<FaReceipt className="w-4 h-4"/>} tone="purple"
                  action={
                    quotation?.publicId && (
                      <button onClick={()=>window.open(`/q/${quotation.publicId}`,"_blank","noopener")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold transition-all">
                        <FiEye className="w-3 h-3"/> View Quotation
                      </button>
                    )
                  }>
                  {quotLoading ? (
                    <div className="text-center py-6">
                      <FiRefreshCw className="w-5 h-5 text-slate-300 animate-spin mx-auto mb-2"/>
                      <p className="text-sm text-slate-400">Loading itinerary…</p>
                    </div>
                  ) : quotation ? (
                    <div className="space-y-5">
                      {/* Summary */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                        {[
                          ["Title",     quotation.title || "—"],
                          ["Version",   quotation.version || quotation.versionNumber || "—"],
                          ["Quote No",  quotation.quoteNo != null ? `#${quotation.quoteNo}` : "—"],
                          ["Stage",     quotation.quotationStage ? titleCase(quotation.quotationStage) : "—"],
                          ["Duration",  quotation.nights != null
                            ? `${quotation.nights}N / ${quotation.days ?? quotation.nights + 1}D` : "—"],
                          ["Grand Total", fmtINR(quotation.totals?.grandTotal)],
                          ["Travellers", (() => {
                            const c = quotation.customer || {};
                            const parts = [];
                            if (c.adults)   parts.push(`${c.adults} Adult${c.adults > 1 ? "s" : ""}`);
                            if (c.children) parts.push(`${c.children} Child${c.children > 1 ? "ren" : ""}`);
                            if (c.infants)  parts.push(`${c.infants} Infant${c.infants > 1 ? "s" : ""}`);
                            return parts.length ? parts.join(" · ") : "—";
                          })()],
                          ["Created",   fmtDate(quotation.createdAt)],
                        ].map(([label,val])=>(
                          <div key={label} className="flex items-center justify-between gap-2">
                            <span className="text-xs text-slate-400 font-medium">{label}</span>
                            <span className="text-sm font-bold text-slate-700 text-right">{val}</span>
                          </div>
                        ))}
                      </div>

                      {/* Hotels */}
                      {quotation.hotel?.hotels?.length > 0 && (
                        <div>
                          <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                            <FaHotel className="text-purple-500"/> Hotels
                          </h4>
                          <div className="space-y-2">
                            {quotation.hotel.hotels.map((h, i) => (
                              <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                                <div className="flex items-start justify-between gap-2 flex-wrap">
                                  <span className="text-sm font-bold text-slate-700">
                                    {h.name || "—"}{h.stars ? ` · ${h.stars}★` : ""}
                                  </span>
                                  <span className="text-xs text-slate-500">{h.city || ""}</span>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  {[h.roomType, h.mealPlan,
                                    (h.checkIn || h.checkOut) ? `${fmtDate(h.checkIn)} → ${fmtDate(h.checkOut)}` : null,
                                    h.rooms ? `${h.rooms} room${h.rooms > 1 ? "s" : ""}` : null,
                                  ].filter(Boolean).join(" · ") || "—"}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Day-wise sightseeing */}
                      {quotation.sightseeing?.days?.length > 0 && (
                        <div>
                          <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                            <FaUmbrellaBeach className="text-purple-500"/> Day-wise Itinerary
                          </h4>
                          <div className="space-y-2">
                            {[...quotation.sightseeing.days]
                              .sort((x, y) => (x.day ?? 99) - (y.day ?? 99))
                              .map((d, i) => (
                              <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-extrabold text-purple-700 bg-purple-100 rounded-full px-2 py-0.5">
                                    Day {d.day ?? i + 1}
                                  </span>
                                  <span className="text-xs text-slate-400">{d.date ? fmtDate(d.date) : ""}</span>
                                </div>
                                {d.activities?.length > 0 && (
                                  <ul className="mt-1.5 space-y-0.5">
                                    {d.activities.map((a, j) => (
                                      <li key={j} className="text-xs text-slate-600 flex gap-1.5">
                                        <span className="text-slate-300">•</span>
                                        <span>
                                          <span className="font-semibold text-slate-700">{a.attraction || "—"}</span>
                                          {a.startTime ? ` · ${a.startTime}` : ""}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Transport */}
                      {quotation.vehicle?.vehicles?.length > 0 && (
                        <div>
                          <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                            <FaCar className="text-purple-500"/> Transport
                          </h4>
                          <div className="space-y-1.5">
                            {quotation.vehicle.vehicles.map((v, i) => (
                              <p key={i} className="text-xs text-slate-600">
                                <span className="font-semibold text-slate-700">{v.type || v.vehicleType || "Vehicle"}</span>
                                {(v.pickup || v.drop) ? ` · ${v.pickup || "—"} → ${v.drop || "—"}` : ""}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Inclusions / exclusions */}
                      {(quotation.inclusions?.length > 0 || quotation.exclusions?.length > 0) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {[["Inclusions", quotation.inclusions, "text-green-600"],
                            ["Exclusions", quotation.exclusions, "text-rose-600"]].map(([label, list, tone]) =>
                            list?.length > 0 ? (
                              <div key={label}>
                                <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">{label}</h4>
                                <ul className="space-y-0.5">
                                  {list.map((x, i) => (
                                    <li key={i} className="text-xs text-slate-600 flex gap-1.5">
                                      <span className={tone}>{label === "Inclusions" ? "✓" : "✕"}</span>
                                      <span>{x}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Direct booking — a real branch on the absence of a linked quotation.
                       Service tags are the only package hint such a booking carries. */
                    <div className="py-4">
                      <EmptyState icon="📄" text="No linked quotation itinerary"
                        hint="This booking was created directly. Operational detail lives in the Services tab."/>
                      {b.services?.length > 0 && (
                        <div className="mt-2">
                          <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-2 text-center">
                            Booked services
                          </h4>
                          <div className="flex flex-wrap gap-1.5 justify-center">
                            {b.services.map((s) => (
                              <span key={s} className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-purple-100 text-purple-700">
                                {SVC_ICON[s] || null}{s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Section>
              </div>
            )}

            {/* ══ SERVICES ══ */}
            {tab === "services" && (
              <div id="panel-services" role="tabpanel" aria-labelledby="tab-services" className="space-y-5">
                <Section title="Booking Services" sub="Operational line items, vendor assignment and per-service vouchers"
                  icon={<MdOutlineAssignment className="w-4 h-4"/>} tone="slate"
                  action={
                    canEditBooking && <button onClick={()=>navigate(`/BookingServices/${b.id}`)}
                      className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-700 hover:underline">
                      Manage <FiExternalLink className="w-3 h-3"/>
                    </button>
                  }>
                  {services.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[640px]">
                        <thead className="bg-slate-50 border-b border-slate-100">
                          <tr>
                            {["Service","Date","Vendor",...(canSeeMargin?["Vendor Cost"]:[]),"Cost","Status","Reference","Voucher"].map(h=>(
                              <th key={h} className="px-3 py-2.5 text-left text-[10px] font-extrabold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {services.map((svc) => (
                            <tr key={svc.publicId} className="hover:bg-blue-50/40 transition-colors group">
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-base">{SVC_ICON[svc.serviceType] || SVC_ICON[svc.title] || "📋"}</span>
                                  <div>
                                    <span className="font-semibold text-slate-700 text-sm block">{svc.title || svc.serviceType || "—"}</span>
                                    {svc.serviceType && svc.title && <span className="text-[11px] text-slate-400">{titleCase(svc.serviceType)}</span>}
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <span className="text-sm text-slate-500">{svc.serviceDate ? fmtDate(svc.serviceDate) : "—"}</span>
                              </td>
                              <td className="px-3 py-3">
                                {svc.vendorName
                                  ? <span className="text-sm text-slate-700 font-medium">{svc.vendorName}</span>
                                  : canEditBooking
                                    ? <button onClick={()=>setAssignSvc(svc)}
                                        className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 hover:underline">
                                        <FiPlus className="w-3 h-3"/> Assign vendor
                                      </button>
                                    : <span className="text-xs text-slate-400">No vendor</span>
                                }
                              </td>
                              {canSeeMargin && (
                                <td className="px-3 py-3">
                                  <span className={`text-sm font-bold ${(svc.vendorCost||0)>0?"text-slate-700":"text-slate-400"}`}>
                                    {fmtINR(svc.vendorCost||0)}
                                  </span>
                                </td>
                              )}
                              <td className="px-3 py-3">
                                <span className="text-sm text-slate-500">{fmtINR(svc.cost||0)}</span>
                              </td>
                              <td className="px-3 py-3">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLE[(svc.status||"PENDING").toUpperCase()] || STATUS_STYLE.PENDING}`}>
                                  {titleCase(svc.status||"Pending")}
                                </span>
                              </td>
                              <td className="px-3 py-3">
                                <span className="text-sm text-slate-400">{svc.confirmationNumber||"—"}</span>
                              </td>
                              <td className="px-3 py-3">
                                <button onClick={()=>downloadServiceVoucher(svc)} disabled={downloading===`svc-${svc.publicId}`}
                                  title="Download service voucher" aria-label={`Download voucher for ${svc.title || svc.serviceType || "service"}`}
                                  className="w-7 h-7 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 flex items-center justify-center transition-all disabled:opacity-60">
                                  {downloading===`svc-${svc.publicId}`
                                    ? <span className="w-3 h-3 border-2 border-blue-200 border-t-blue-700 rounded-full animate-spin"/>
                                    : <FiFileText className="w-3.5 h-3.5"/>}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState icon="🗂️" text="No services added yet"/>
                  )}
                </Section>
              </div>
            )}

            {/* ══ PAYMENTS ══ */}
            {tab === "payments" && (
              <div id="panel-payments" role="tabpanel" aria-labelledby="tab-payments" className="space-y-5">

                {/* Money IN */}
                <Section title="Payment History" sub="Money in — customer receipts and refund entries"
                  icon={<FiCreditCard className="w-4 h-4"/>} tone="green"
                  action={
                    <div className="flex items-center gap-2">
                      <button onClick={()=>navigate(`/BookingPayments/${b.id}`)}
                        className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-600 hover:underline">
                        Full page <FiExternalLink className="w-3 h-3"/>
                      </button>
                      {canAddPayment && (
                        <button onClick={()=>setShowAddPay(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 text-xs font-bold transition-all">
                          <FiPlus className="w-3 h-3"/> Add Payment
                        </button>
                      )}
                    </div>
                  }>
                  {payments.length > 0 ? (
                    <div className="space-y-2">
                      {payments.map((pay) => {
                        const isRefundRow = String(pay.entryType || "RECEIPT").toUpperCase() === "REFUND";
                        return (
                          <div key={pay.publicId} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-100 group">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isRefundRow ? "bg-rose-100" : "bg-green-100"}`}>
                                {isRefundRow
                                  ? <FiCornerUpLeft className="w-4 h-4 text-rose-600"/>
                                  : <FiCheck className="w-4 h-4 text-green-600"/>}
                              </div>
                              <div>
                                <p className={`text-sm font-bold ${isRefundRow ? "text-rose-600" : "text-slate-800"}`}>
                                  {isRefundRow ? `− ${fmtINR(pay.amount)}` : fmtINR(pay.amount)}
                                  {isRefundRow && (
                                    <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 align-middle">Refund</span>
                                  )}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {/* paymentMethod is a free display label stored as-is ("UPI") — no titleCase */}
                                  {pay.paymentMethod || "—"} · {fmtDate(pay.paymentDate||pay.createdAt)}
                                  {pay.reference && <span className="ml-1">· {pay.reference}</span>}
                                </p>
                                {pay.notes && <p className="text-xs text-slate-400 italic">{pay.notes}</p>}
                              </div>
                            </div>
                            {canEditBooking && !isRefundRow && (deletingPay===pay.publicId ? (
                              <div className="flex items-center gap-1.5">
                                <button onClick={()=>handleDeletePayment(pay.publicId)}
                                  className="text-xs font-bold text-red-600 px-2 py-1 rounded-lg bg-red-50 border border-red-200 hover:bg-red-100">Delete</button>
                                <button onClick={()=>setDeletingPay(null)}
                                  className="text-xs font-bold text-slate-500 px-2 py-1 rounded-lg bg-white border border-slate-200">Cancel</button>
                              </div>
                            ) : (
                              <button onClick={()=>setDeletingPay(pay.publicId)} aria-label="Remove payment"
                                className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 flex items-center justify-center transition-all">
                                <FiTrash2 className="w-3 h-3"/>
                              </button>
                            ))}
                          </div>
                        );
                      })}
                      {/* Rollups — server figures, never client sums */}
                      <div className="flex items-center justify-between px-4 py-2.5 bg-green-50 rounded-xl border border-green-100 mt-1">
                        <span className="text-xs font-bold text-green-700">Total Paid</span>
                        <span className="text-sm font-extrabold text-green-700">{fmtINR(b.paid)}</span>
                      </div>
                      {b.refunded > 0 && (
                        <div className="flex items-center justify-between px-4 py-2.5 bg-rose-50 rounded-xl border border-rose-100">
                          <span className="text-xs font-bold text-rose-700">Refunded to Customer</span>
                          <span className="text-sm font-extrabold text-rose-700">− {fmtINR(b.refunded)}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <EmptyState icon="💳" text="No payments recorded yet"
                      action={canUpdate && (
                        <button onClick={()=>setShowAddPay(true)}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-xs font-bold transition-all">
                          <FiPlus className="w-3.5 h-3.5"/> Record Payment
                        </button>
                      )}/>
                  )}
                </Section>

                {/* Money OUT — read + settle surface. Entry happens once, as a batch, through
                    BookingExpenseModal; what lives here is the vendor-payable position. Every
                    figure is server-derived — summary from /expenses/summary, per-row
                    outstanding/overdue from the row DTO — never recomputed in the browser. */}
                {canSeeMargin && <Section title="Expense Ledger" sub="Money out — vendor payables and internal costs"
                  icon={<FiFileText className="w-4 h-4"/>} tone="amber"
                  action={ canEditBooking && expenses.length > 0 && (
                    <button onClick={()=>setShowAddExpense(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-bold transition-all">
                      <FiPlus className="w-3 h-3"/> Add More
                    </button>
                  )}>
                  {expenses.length > 0 ? (
                    <div className="space-y-3">
                      {expenseSummary && (
                        <>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div className="bg-slate-50 rounded-xl border border-slate-100 px-3 py-2">
                              <p className="text-[11px] font-semibold text-slate-400">Total Expense</p>
                              <p className="text-sm font-extrabold text-slate-800">{fmtINR(expenseSummary.totalExpense)}</p>
                            </div>
                            <div className="bg-green-50 rounded-xl border border-green-100 px-3 py-2">
                              <p className="text-[11px] font-semibold text-green-600">Paid</p>
                              <p className="text-sm font-extrabold text-green-700">{fmtINR(expenseSummary.totalPaid)}</p>
                            </div>
                            <div className={`rounded-xl border px-3 py-2 ${Number(expenseSummary.totalOutstanding) > 0 ? "bg-rose-50 border-rose-100" : "bg-green-50 border-green-100"}`}>
                              <p className={`text-[11px] font-semibold ${Number(expenseSummary.totalOutstanding) > 0 ? "text-rose-500" : "text-green-600"}`}>Outstanding</p>
                              <p className={`text-sm font-extrabold ${Number(expenseSummary.totalOutstanding) > 0 ? "text-rose-600" : "text-green-700"}`}>{fmtINR(expenseSummary.totalOutstanding)}</p>
                            </div>
                            {Number(expenseSummary.overdueCount) > 0 && (
                              <div className="bg-red-50 rounded-xl border border-red-100 px-3 py-2">
                                <p className="text-[11px] font-semibold text-red-500">Overdue</p>
                                <p className="text-sm font-extrabold text-red-600">
                                  {fmtINR(expenseSummary.overdueOutstanding)} · {expenseSummary.overdueCount} line{Number(expenseSummary.overdueCount) === 1 ? "" : "s"}
                                </p>
                              </div>
                            )}
                          </div>
                          <p className="text-[11px] font-semibold text-slate-400">
                            Vendor {fmtINR(expenseSummary.totalVendorExpense)} · Company {fmtINR(expenseSummary.totalInternalCosts)}
                            <span className="font-normal"> (every line reduces profit)</span>
                          </p>
                          {canSeeMargin && Number(b.vendorCost) > 0 && (
                            <p className="text-[11px] text-slate-400">
                              These lines are <span className="font-semibold">on top of</span> the booking's typed vendor
                              cost {fmtINR(b.vendorCost)} — together {fmtINR(b.totalSupplierCost)} of supplier cost. Do not
                              re-enter here what that figure already covers, or it is deducted twice.
                            </p>
                          )}
                        </>
                      )}

                      {expenses.map((exp) => {
                        const outstanding = Number(exp.outstandingAmount) || 0;
                        const unsettled = outstanding > 0;
                        const busy = expBusy === exp.publicId;
                        return (
                          <div key={exp.publicId} className="bg-slate-50 rounded-xl border border-slate-100 px-4 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-800 truncate">{exp.description}</p>
                                <p className="text-xs text-slate-400">
                                  {exp.category || "Other"}
                                  {exp.costType === "INTERNAL" && (
                                    <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 text-[10px] font-bold align-middle">Company</span>
                                  )}
                                  {exp.vendorName && <span> · {exp.vendorName}</span>}
                                  <span> · {fmtDate(exp.expenseDate)}</span>
                                  {exp.paymentMode && <span> · {exp.paymentMode}</span>}
                                  {exp.referenceNumber && <span> · {exp.referenceNumber}</span>}
                                </p>
                                {unsettled && (
                                  <p className={`text-xs font-semibold mt-0.5 ${exp.overdue ? "text-red-600" : "text-amber-700"}`}>
                                    {fmtINR(outstanding)} payable
                                    {exp.dueDate && ` · due ${fmtDate(exp.dueDate)}`}
                                    {exp.overdue && " · OVERDUE"}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                <p className="text-sm font-extrabold text-slate-800">{fmtINR(exp.amount)}</p>
                                <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${EXP_STATUS_STYLE[exp.paymentStatus] || "bg-slate-50 text-slate-500 border-slate-200"}`}>
                                  {titleCase(exp.paymentStatus)}
                                </span>
                              </div>
                            </div>

                            {canEditBooking && (
                              <div className="flex items-center gap-1.5 mt-2">
                                {unsettled && settleExp !== exp.publicId && (
                                  <>
                                    <button onClick={()=>openSettle(exp)} disabled={busy}
                                      className="text-xs font-bold text-amber-700 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 hover:bg-amber-100 disabled:opacity-50">
                                      ₹ Record Payment
                                    </button>
                                    <button onClick={()=>markExpensePaid(exp)} disabled={busy}
                                      className="text-xs font-bold text-green-700 px-2.5 py-1 rounded-lg bg-green-50 border border-green-200 hover:bg-green-100 disabled:opacity-50">
                                      {busy ? "…" : "Mark Paid"}
                                    </button>
                                  </>
                                )}
                                <div className="ml-auto">
                                  {deletingExp === exp.publicId ? (
                                    <div className="flex items-center gap-1.5">
                                      <button onClick={()=>handleDeleteExpense(exp)} disabled={busy}
                                        className="text-xs font-bold text-red-600 px-2 py-1 rounded-lg bg-red-50 border border-red-200 hover:bg-red-100 disabled:opacity-50">
                                        {busy ? "Removing…" : "Delete"}
                                      </button>
                                      <button onClick={()=>setDeletingExp(null)} disabled={busy}
                                        className="text-xs font-bold text-slate-500 px-2 py-1 rounded-lg bg-white border border-slate-200">Cancel</button>
                                    </div>
                                  ) : (
                                    <button onClick={()=>setDeletingExp(exp.publicId)} disabled={busy} aria-label="Remove expense"
                                      className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 flex items-center justify-center transition-all">
                                      <FiTrash2 className="w-3 h-3"/>
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}

                            {canEditBooking && settleExp === exp.publicId && (
                              <div className="mt-2 bg-white rounded-xl border border-amber-200 p-3">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                  <div>
                                    <label htmlFor={`settle-amt-${exp.publicId}`} className="block text-[11px] font-bold text-slate-500 mb-1">Amount Paying Now</label>
                                    <input id={`settle-amt-${exp.publicId}`} type="number" min="0" step="0.01" autoFocus value={settleForm.amount}
                                      onChange={(e)=>{ setSettleForm(f=>({ ...f, amount: e.target.value })); setSettleErr(""); }}
                                      onKeyDown={(e)=>{ if (e.key === "Enter") { e.preventDefault(); submitSettle(exp); } }}
                                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:border-amber-400 outline-none"/>
                                  </div>
                                  <div>
                                    <label htmlFor={`settle-mode-${exp.publicId}`} className="block text-[11px] font-bold text-slate-500 mb-1">Mode</label>
                                    <select id={`settle-mode-${exp.publicId}`} value={settleForm.mode}
                                      onChange={(e)=>setSettleForm(f=>({ ...f, mode: e.target.value }))}
                                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:border-amber-400 outline-none bg-white">
                                      <option value="">Select</option>
                                      {EXP_PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                  </div>
                                  <div>
                                    <label htmlFor={`settle-ref-${exp.publicId}`} className="block text-[11px] font-bold text-slate-500 mb-1">Ref. No.</label>
                                    <input id={`settle-ref-${exp.publicId}`} type="text" maxLength={120} value={settleForm.reference}
                                      onChange={(e)=>setSettleForm(f=>({ ...f, reference: e.target.value }))}
                                      placeholder="UTR / cheque no."
                                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:border-amber-400 outline-none"/>
                                  </div>
                                </div>
                                {settleErr && <p className="text-xs text-red-500 mt-1.5">{settleErr}</p>}
                                <p className="text-[11px] text-slate-400 mt-1.5">
                                  {fmtINR(exp.paidAmount)} paid so far of {fmtINR(exp.amount)} — outstanding {fmtINR(outstanding)}.
                                </p>
                                <div className="flex gap-2 mt-2">
                                  <button onClick={()=>submitSettle(exp)} disabled={settleSaving}
                                    className="text-xs font-bold text-white px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-60">
                                    {settleSaving ? "Saving…" : "Save Payment"}
                                  </button>
                                  <button onClick={()=>setSettleExp(null)} disabled={settleSaving}
                                    className="text-xs font-bold text-slate-500 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50">
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState icon="🧾" text="No expenses recorded yet"
                      action={canEditBooking && (
                        <button onClick={()=>setShowAddExpense(true)}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white text-xs font-bold transition-all">
                          <FiPlus className="w-3.5 h-3.5"/> Add Expenses
                        </button>
                      )}/>
                  )}
                </Section>}

                {/* ══ COST VARIATIONS ══
                    Money that moved AFTER the booking was confirmed. Deliberately its own section
                    rather than rows in the expense ledger: the two are disjoint by design (planned
                    cost vs unplanned event) and each feeds profit through its own total, so mixing
                    them on screen would invite recording an event in both — which subtracts the same
                    rupees twice. */}
                {canSeeMargin && <Section title="Changes After Booking"
                  sub="Itinerary changes, extra activities, permits, route & hotel changes — and what each did to the money"
                  icon={<FiRefreshCw className="w-4 h-4"/>} tone="purple"
                  action={ canEditBooking && variations.length > 0 && (
                    <button onClick={()=>{ setEditVariation(null); setShowVariationModal(true); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 text-xs font-bold transition-all">
                      <FiPlus className="w-3.5 h-3.5"/> Record change
                    </button>
                  )}>

                  {variations.length > 0 ? (
                    <div className="space-y-3">
                      {/* Profit before vs after — the "was going off-plan worth it?" line. */}
                      {variationSummary && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                            <p className="text-[11px] font-semibold text-slate-400">Charged extra</p>
                            <p className="text-sm font-extrabold text-slate-800">{fmtINR(variationSummary.totalExtraCharged)}</p>
                            {Number(variationSummary.totalWaived) > 0 && (
                              <p className="text-[10px] text-amber-600 font-semibold">{fmtINR(variationSummary.totalWaived)} waived</p>
                            )}
                          </div>
                          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                            <p className="text-[11px] font-semibold text-slate-400">Extra cost</p>
                            <p className="text-sm font-extrabold text-slate-800">{fmtINR(variationSummary.totalExtraCost)}</p>
                            {Number(variationSummary.totalCostRecovered) > 0 && (
                              <p className="text-[10px] text-emerald-600 font-semibold">{fmtINR(variationSummary.totalCostRecovered)} recovered</p>
                            )}
                          </div>
                          <div className={`rounded-xl border px-3 py-2 ${Number(variationSummary.netImpact) >= 0 ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"}`}>
                            <p className={`text-[11px] font-semibold ${Number(variationSummary.netImpact) >= 0 ? "text-emerald-600" : "text-rose-500"}`}>Net effect</p>
                            <p className={`text-sm font-extrabold ${Number(variationSummary.netImpact) >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                              {signedINR(variationSummary.netImpact)}
                            </p>
                          </div>
                          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                            <p className="text-[11px] font-semibold text-slate-400">Profit</p>
                            <p className="text-sm font-extrabold text-slate-800">{fmtINR(variationSummary.netProfit)}</p>
                            <p className="text-[10px] text-slate-400 font-semibold">
                              was {fmtINR(variationSummary.profitBeforeVariations)}
                            </p>
                          </div>
                        </div>
                      )}

                      {variations.map((v) => {
                        const net = Number(v.netImpact) || 0;
                        const busy = variationBusy === v.publicId;
                        return (
                          <div key={v.publicId} className="bg-slate-50 rounded-xl border border-slate-100 px-4 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-bold text-slate-800 truncate">{v.description}</p>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                                    {v.categoryLabel || v.category}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {fmtDate(v.variationDate)}
                                  {v.vendorName ? ` · ${v.vendorName}` : ""}
                                  {v.referenceNumber ? ` · ${v.referenceNumber}` : ""}
                                </p>
                                <div className="flex items-center gap-3 mt-1.5 text-[11px] font-semibold flex-wrap">
                                  <span className="text-slate-500">
                                    Customer <span className="text-slate-800">{signedINR(v.customerAmountDelta)}</span>
                                  </span>
                                  <span className="text-slate-500">
                                    Cost <span className="text-slate-800">{signedINR(v.agencyCostDelta)}</span>
                                  </span>
                                  <span className={net >= 0 ? "text-emerald-600" : "text-rose-600"}>
                                    Net {signedINR(net)}
                                  </span>
                                </div>
                                {v.notes && <p className="text-[11px] text-slate-400 mt-1">{v.notes}</p>}
                              </div>

                              {canEditBooking && (
                                <div className="flex items-center gap-1 shrink-0">
                                  <button onClick={()=>{ setEditVariation(v); setShowVariationModal(true); }}
                                    disabled={busy} title="Edit"
                                    className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-violet-600 hover:border-violet-200 flex items-center justify-center disabled:opacity-40">
                                    <FiEdit2 className="w-3 h-3"/>
                                  </button>
                                  <button onClick={()=>handleDeleteVariation(v)}
                                    disabled={busy} title="Remove"
                                    className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 flex items-center justify-center disabled:opacity-40">
                                    <FiTrash2 className="w-3 h-3"/>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState icon="🔀" text="Nothing changed after this booking was made"
                      action={canEditBooking && (
                        <button onClick={()=>{ setEditVariation(null); setShowVariationModal(true); }}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white text-xs font-bold transition-all">
                          <FiPlus className="w-3.5 h-3.5"/> Record a change
                        </button>
                      )}/>
                  )}
                </Section>}
              </div>
            )}

            {/* ══ REMINDERS ══ */}
            {tab === "reminders" && (
              <div id="panel-reminders" role="tabpanel" aria-labelledby="tab-reminders" className="space-y-5">
                {/* Fetched separately by bookingCode: BookingReminder has no FK to Booking, so the
                    booking payload cannot and does not carry them. */}
                <Section title="Booking Reminders" sub={`Matched on booking code ${b.code}`}
                  icon={<FiBell className="w-4 h-4"/>} tone="amber">
                  {reminders.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[520px]">
                        <thead className="bg-slate-50 border-b border-slate-100">
                          <tr>
                            {["Reminder Date","Type","Message","Status",""].map((h,i)=>(
                              <th key={h||i} className="px-3 py-2.5 text-left text-[10px] font-extrabold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {reminders.map((rem, i) => {
                            const st = String(rem.status || "Pending");
                            const stStyle = /sent/i.test(st)      ? "bg-green-100 text-green-700 border-green-200"
                                          : /complete/i.test(st)  ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                          : /cancel/i.test(st)    ? "bg-red-100 text-red-600 border-red-200"
                                          :                         "bg-amber-100 text-amber-700 border-amber-200";
                            const sent = /sent|complete/i.test(st);
                            return (
                              <tr key={rem.id ?? i} className="hover:bg-amber-50/40">
                                <td className="px-3 py-3 text-sm font-semibold text-slate-700 whitespace-nowrap">
                                  {fmtDateTime(rem.reminderDate)}
                                </td>
                                <td className="px-3 py-3 text-sm text-slate-600 whitespace-nowrap">
                                  {titleCase(rem.reminderType)}
                                </td>
                                <td className="px-3 py-3 text-sm text-slate-600 max-w-[260px]">
                                  <span className="line-clamp-2">{rem.message || "—"}</span>
                                </td>
                                <td className="px-3 py-3">
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${stStyle}`}>
                                    {titleCase(st)}
                                  </span>
                                </td>
                                <td className="px-3 py-3 text-right">
                                  {canSendReminders && !sent && (
                                    <button
                                      onClick={()=>handleSendReminder(rem.id)}
                                      disabled={sendingRem === rem.id}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-xs font-bold transition-all whitespace-nowrap">
                                      {sendingRem === rem.id
                                        ? <FiRefreshCw className="w-3 h-3 animate-spin"/>
                                        : <FiBell className="w-3 h-3"/>}
                                      Send now
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState icon="🔔" text="No reminders set"/>
                  )}
                </Section>
              </div>
            )}

            {/* ══ DOCUMENTS ══ */}
            {tab === "documents" && (
              <div id="panel-documents" role="tabpanel" aria-labelledby="tab-documents" className="space-y-5">
                <Section title="Documents" sub="Server-rendered PDFs — generated on the fly, never cached publicly"
                  icon={<FiFolder className="w-4 h-4"/>} tone="indigo">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                    {/* Booking voucher */}
                    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                        <FiFileText className="w-4 h-4"/>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-extrabold text-slate-800">Booking Voucher</p>
                        <p className="text-xs text-slate-400 mt-0.5">Customer-facing trip voucher for {b.code}.</p>
                        <button onClick={downloadVoucher} disabled={downloading==="voucher"}
                          className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all disabled:opacity-60">
                          {downloading==="voucher"
                            ? <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin"/>
                            : <FiDownload className="w-3 h-3"/>}
                          Download
                        </button>
                      </div>
                    </div>

                    {/* GST invoices */}
                    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
                        <FaReceipt className="w-4 h-4"/>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-extrabold text-slate-800">GST / Tax Invoice</p>
                        <p className="text-xs text-slate-400 mt-0.5">Issue, view and cancel the accounting tax invoices for this booking.</p>
                        <button onClick={()=>setGstOpen(true)}
                          className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all">
                          <FiEye className="w-3 h-3"/> Open Manager
                        </button>
                      </div>
                    </div>

                    {/* Cancellation documents — only meaningful once cancelled */}
                    {isCancelled && (
                      <>
                        <div className="rounded-xl border border-red-100 bg-red-50/50 p-4 flex items-start gap-3">
                          <div className="w-9 h-9 rounded-xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                            <FaReceipt className="w-4 h-4"/>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-extrabold text-slate-800">Cancellation Note</p>
                            <p className="text-xs text-slate-400 mt-0.5">Credit note — or debit note when the customer owes.</p>
                            <button onClick={downloadCreditNote} disabled={downloading==="credit-note"}
                              className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50 text-xs font-bold transition-all disabled:opacity-60">
                              {downloading==="credit-note"
                                ? <span className="w-3 h-3 border-2 border-red-300 border-t-red-700 rounded-full animate-spin"/>
                                : <FiDownload className="w-3 h-3"/>}
                              Download
                            </button>
                          </div>
                        </div>
                        <div className="rounded-xl border border-green-100 bg-green-50/50 p-4 flex items-start gap-3">
                          <div className="w-9 h-9 rounded-xl bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0">
                            <FiCornerUpLeft className="w-4 h-4"/>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-extrabold text-slate-800">Refund Voucher</p>
                            <p className="text-xs text-slate-400 mt-0.5">Issued once a refund has been disbursed.</p>
                            {hasRefundVoucher ? (
                              <button onClick={downloadRefundVoucher} disabled={downloading==="refund-voucher"}
                                className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-200 bg-white text-green-700 hover:bg-green-50 text-xs font-bold transition-all disabled:opacity-60">
                                {downloading==="refund-voucher"
                                  ? <span className="w-3 h-3 border-2 border-green-300 border-t-green-700 rounded-full animate-spin"/>
                                  : <FiDownload className="w-3 h-3"/>}
                                Download
                              </button>
                            ) : (
                              <span className="mt-2 inline-flex rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-400">
                                Not issued yet
                              </span>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Per-service vouchers — same handler as the Services tab */}
                  {services.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">Service Vouchers</p>
                      <div className="space-y-1.5">
                        {services.map((svc) => (
                          <div key={svc.publicId} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-2.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-base flex-shrink-0">{SVC_ICON[svc.serviceType] || SVC_ICON[svc.title] || "📋"}</span>
                              <span className="text-sm font-semibold text-slate-700 truncate">{svc.title || svc.serviceType || "—"}</span>
                              {svc.vendorName && <span className="text-xs text-slate-400 truncate hidden sm:inline">· {svc.vendorName}</span>}
                            </div>
                            <button onClick={()=>downloadServiceVoucher(svc)} disabled={downloading===`svc-${svc.publicId}`}
                              aria-label={`Download voucher for ${svc.title || svc.serviceType || "service"}`}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 text-xs font-bold transition-all disabled:opacity-60 flex-shrink-0">
                              {downloading===`svc-${svc.publicId}`
                                ? <span className="w-3 h-3 border-2 border-blue-200 border-t-blue-700 rounded-full animate-spin"/>
                                : <FiDownload className="w-3 h-3"/>}
                              PDF
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Section>
              </div>
            )}

            {tab === "activity" && (
              <div id="panel-activity" role="tabpanel" aria-labelledby="tab-activity" className="space-y-5">
                <Section title="Booking Activity" sub="Who changed what, and when"
                  icon={<FiClock className="w-4 h-4"/>} tone="blue">
                  <BookingActivityTimeline events={timeline} loading={sectionLoading === "activity"}
                    formatMoney={fmtINR} formatDateTime={fmtDateTime}/>
                </Section>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
