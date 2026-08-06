import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import bookingService                from "../api/bookingService";
import CancelBookingModal            from "../components/CancelBookingModal";
import BookingExpenseModal           from "../components/BookingExpenseModal"
import { hasPermission, P }          from "@shared/lib/access";
import { useToast }                  from "@shared/ui/toast";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { downloadBlob, hydrateBlobError }     from "@shared/lib/download";
import { Search as FiSearch, RefreshCw as FiRefreshCw, Filter as FiFilter, 
        Download as FiDownload, ChevronDown as FiChevronDown, ChevronUp as 
        FiChevronUp, Eye as FiEye, Pen as FiEdit2, Trash2 as FiTrash2, X as FiX,
         FileText as FiFileText, ChevronLeft as FiChevronLeft, ChevronRight as FiChevronRight, 
         Plane as FaPlane, ChevronsLeft as FaAngleDoubleLeft, ChevronsRight as FaAngleDoubleRight, 
         IndianRupee as FaRupeeSign, CircleCheck as FaCheckCircle, CircleX as FaTimesCircle, 
         ReceiptText as FaFileInvoiceDollar, HandCoins as FaHandHoldingUsd, 
         ReceiptText as MdOutlineReceiptLong , WalletCards as FiWalletCards} from "lucide-react";

/* ─── SHARED PDF DOWNLOAD HELPERS ────────────────────────────── */
async function downloadDoc(kind, booking, showToast) {
  const label = kind === "invoice" ? "Invoice" : "Voucher";
  try {
    // Invoice = the accounting GST invoice (same doc the accountant issues). Download the latest
    // ISSUED one; if none exists yet, point the user to generate it from the booking.
    if (kind === "invoice") {
      const listRes = await bookingService.getGstInvoices(booking.id);
      const invoices = Array.isArray(listRes?.data?.data) ? listRes.data.data : [];
      const issued = invoices.find((i) => i.status === "ISSUED");
      if (!issued) {
        showToast("No GST invoice yet — open the booking to generate one.", "info");
        return;
      }
      const res = await bookingService.gstInvoicePdf(booking.id, issued.publicId);
      const name = (issued.invoiceNumber || booking.code || booking.id).replace(/\//g, "_");
      downloadBlob(res.data, `GST-Invoice-${name}.pdf`);
      showToast("GST invoice downloaded.", "success");
      return;
    }
    const res = await bookingService.getVoucher(booking.id);
    downloadBlob(res.data, `${label}-${booking.code || booking.id}.pdf`);
    showToast(`${label} downloaded.`, "success");
  } catch (error) {
    if (isAlreadyReported(error)) return;
    await hydrateBlobError(error);
    showToast(getErrorMessage(error, `Couldn't generate the ${label.toLowerCase()}.`), "error");
  }
}


/* ─── CONSTANTS ──────────────────────────────────────────────── */
export const BOOKING_STATUSES = ["Confirmed","Pending","Cancelled","Completed","Refunded"];
export const PAY_STATUSES     = ["Paid","Partial","Unpaid","Refunded"];
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const STATUS_STYLE = {
  Confirmed: "bg-green-100  text-green-700  border border-green-200",
  Pending:   "bg-amber-100  text-amber-700  border border-amber-200",
  Cancelled: "bg-red-100    text-red-600    border border-red-200",
  Completed: "bg-blue-100   text-blue-700   border border-blue-200",
  Refunded:  "bg-purple-100 text-purple-700 border border-purple-200",
};
const PAY_STYLE = {
  Paid:     "bg-emerald-100 text-emerald-700",
  Partial:  "bg-orange-100  text-orange-700",
  Unpaid:   "bg-rose-100    text-rose-700",
  Refunded: "bg-slate-100   text-slate-600",
};
const STATUS_DOT = {
  Confirmed:"bg-green-500", Pending:"bg-amber-500",
  Cancelled:"bg-red-500",   Completed:"bg-blue-500", Refunded:"bg-purple-500",
};

const STAT_CARDS = [
  { key:"total",     label:"Total Bookings", icon:<FaPlane/>,             gradient:"from-blue-600   to-indigo-500",     money:false },
  { key:"confirmed", label:"Confirmed",      icon:<FaCheckCircle/>,       gradient:"from-green-500  to-emerald-600",  money:false },
  { key:"revenue",   label:"Total Revenue",  icon:<FaRupeeSign/>,         gradient:"from-amber-500  to-orange-500",   money:true  },
  { key:"net",       label:"Net Revenue",    icon:<FaHandHoldingUsd/>,    gradient:"from-blue-700   to-indigo-600",     money:true  },
  { key:"refunds",   label:"Refunds",        icon:<FaTimesCircle/>,       gradient:"from-rose-500   to-red-600",      money:true  },
  { key:"profit",    label:"Net Profit",     icon:<FaFileInvoiceDollar/>, gradient:"from-slate-600  to-slate-700",    money:true  },
];

/* ─── HELPERS ────────────────────────────────────────────────── */
export const fmtINR  = n => "₹" + Number(n||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
export const fmtDate = d => d ? new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}) : "—";
const titleCase = s => s ? s.charAt(0).toUpperCase()+s.slice(1).toLowerCase() : s;

function normalizeBooking(b={}) {
  return {
    id:             b.publicId,
    code:           b.bookingCode,
    customer:       b.customerNameSnapshot,
    createdBy:      b.createdBy,
    destination:    b.destinationSnapshot,
    services:       Array.isArray(b.services) ? b.services : [],
    bookingDate:    b.bookingDate,
    travelDate:     b.travelDate,
    customerAmount: Number(b.customerAmount)||0,
    vendorCost:     Number(b.vendorCost)||0,
    gst:            Number(b.gst)||0,
    tcs:            Number(b.tcs)||0,
    totalPayable:   Number(b.totalPayable)||0,
    paid:           Number(b.paidAmount)||0,
    netProfit:      Number(b.netProfit)||0,
    status:         titleCase(b.status),
    payStatus:      titleCase(b.paymentStatus),
  };
}

const EMPTY = [];

// AllBookings sort-column key (the normalised display field) → the Booking ENTITY field the backend
// can ORDER BY. Anything not here falls back to createdAt server-side (see BOOKING_SORTS whitelist).
const BOOKING_SORT_MAP = {
  id: "id", code: "bookingCode", customer: "customerNameSnapshot", destination: "destinationSnapshot",
  bookingDate: "bookingDate", travelDate: "travelDate", customerAmount: "customerAmount",
  status: "status", payStatus: "paymentStatus",
};

const selectCls = "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 font-medium focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none appearance-none cursor-pointer transition-all hover:border-slate-300";
const inputCls  = "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder-slate-400 font-medium focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all hover:border-slate-300";

/* ─── STAT CARD with animate counter ────────────────────────── */
function StatCard({ card, value }) {
  const [disp, setDisp] = useState(0);
  const raf = useRef(null);
  useEffect(()=>{
    cancelAnimationFrame(raf.current);
    const target = Number(value)||0;
    if (!target) { setDisp(0); return; }
    const start = performance.now();
    const step = ts => {
      const p = Math.min((ts-start)/1000,1);
      const ease = 1-Math.pow(1-p,3);
      setDisp(Math.round(ease*target));
      if (p<1) raf.current=requestAnimationFrame(step);
    };
    raf.current=requestAnimationFrame(step);
    return()=>cancelAnimationFrame(raf.current);
  },[value]);

  return (
    <div className={`bg-gradient-to-br ${card.gradient} rounded-2xl p-5 text-white
      shadow-lg relative overflow-hidden group hover:-translate-y-1 hover:shadow-xl transition-all duration-300`}>
      <div className="absolute -right-5 -top-5 w-24 h-24 rounded-full bg-white/10 group-hover:scale-110 transition-transform duration-500"/>
      <div className="absolute -right-2 -bottom-7 w-20 h-20 rounded-full bg-white/10"/>
      <div className="relative z-10 flex items-start justify-between">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-widest opacity-80 mb-1">{card.label}</p>
          <p className="text-2xl sm:text-3xl font-extrabold leading-none">
            {card.money ? fmtINR(disp) : disp}
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl flex-shrink-0">
          {card.icon}
        </div>
      </div>
    </div>
  );
}

/* ─── BOOKING DETAIL MODAL ───────────────────────────────────── */
// Statuses settable from the detail select — Cancelled goes through the Cancel flow, not here.
const MODAL_STATUSES = ["Confirmed","Pending","Completed","Refunded"];

function BookingModal({ booking, onClose, onEdit, onCancel, onRefresh }) {
  const { showToast } = useToast();
  const [downloading, setDownloading]   = useState(null);   // "invoice" | "voucher" | null
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusVal, setStatusVal]       = useState(booking?.status || "");

  useEffect(()=>{ setStatusVal(booking?.status || ""); },[booking?.status]);

  if (!booking) return null;
  const canCancel = hasPermission(P.BOOKING_CANCEL) &&
    booking.status!=="Completed" && booking.status!=="Cancelled";
  const canRead   = hasPermission(P.BOOKING_READ);
  const canUpdate = hasPermission(P.BOOKING_UPDATE);
  const payPct = booking.totalPayable>0 ? Math.round(booking.paid/booking.totalPayable*100) : 0;

  const runDownload = async kind => {
    setDownloading(kind);
    try { await downloadDoc(kind, booking, showToast); }
    finally { setDownloading(null); }
  };

  const handleStatusChange = async next => {
    if (!next || next===booking.status) return;
    const prev = statusVal;
    setStatusVal(next);
    setStatusSaving(true);
    try {
      await bookingService.updateStatus(booking.id, next);
      showToast(`Status updated to ${next}.`, "success");
      onRefresh?.();
      onClose();
    } catch (error) {
      setStatusVal(prev);
      if (isAlreadyReported(error)) return;
      showToast(getErrorMessage(error, "Couldn't update the status."), "error");
    } finally { setStatusSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto"
        style={{animation:"popIn .25s ease both"}}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-500 px-6 py-5 rounded-t-3xl flex items-start justify-between">
          <div>
            <p className="text-white/80 text-[10px] font-extrabold uppercase tracking-widest mb-1">Booking Detail</p>
            <h2 className="text-white text-xl font-extrabold tracking-tight">{booking.code}</h2>
            <p className="text-white/90 text-sm mt-0.5">{booking.customer}</p>
          </div>
          <button onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-all">
            <FiX className="w-4 h-4"/>
          </button>
        </div>
        <div className="p-6 space-y-5">
          {/* Badges + status control */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-3 py-1.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 ${STATUS_STYLE[booking.status]}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[booking.status]}`}/>{booking.status}
            </span>
            <span className={`px-3 py-1.5 rounded-full text-xs font-extrabold ${PAY_STYLE[booking.payStatus]}`}>
              💳 {booking.payStatus}
            </span>
            {booking.services?.map(s=>(
              <span key={s} className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">{s}</span>
            ))}
            {canUpdate && (
              <div className="ml-auto flex items-center gap-1.5">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide">Set status</span>
                <div className="relative">
                  <select value={statusVal} disabled={statusSaving}
                    onChange={e=>handleStatusChange(e.target.value)}
                    className="pl-3 pr-8 py-1.5 rounded-lg border border-blue-200 bg-white text-xs font-bold text-blue-700
                      focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none appearance-none cursor-pointer
                      disabled:opacity-50 disabled:cursor-not-allowed">
                    {(MODAL_STATUSES.includes(statusVal)?MODAL_STATUSES:[statusVal,...MODAL_STATUSES]).map(s=>(
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  {statusSaving
                    ? <FiRefreshCw className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-blue-500 animate-spin pointer-events-none"/>
                    : <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-blue-500 pointer-events-none"/>}
                </div>
              </div>
            )}
          </div>
          {/* Detail grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              ["📍","Destination",  booking.destination],
              ["📅","Travel Date",  fmtDate(booking.travelDate)],
              ["🗓️","Booking Date", fmtDate(booking.bookingDate)],
              ["👤","Created By",   booking.createdBy],
              ["💰","Customer Amt", fmtINR(booking.customerAmount)],
              ["🏷️","Vendor Cost",  fmtINR(booking.vendorCost)],
              ["🧾","GST (5%)",     fmtINR(booking.gst)],
              ["📋","TCS (5%)",     fmtINR(booking.tcs)],
              ["💳","Total Payable",fmtINR(booking.totalPayable)],
            ].map(([icon,label,val])=>(
              <div key={label} className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mb-1">{icon} {label}</p>
                <p className="text-sm font-extrabold text-slate-700">{val}</p>
              </div>
            ))}
          </div>
          {/* Payment progress */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-extrabold text-slate-600">Payment Progress</p>
              <p className={`text-sm font-extrabold ${payPct===100?"text-green-600":"text-blue-600"}`}>{payPct}%</p>
            </div>
            <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700
                ${payPct===100?"bg-gradient-to-r from-green-500 to-emerald-500"
                :payPct>0?"bg-gradient-to-r from-blue-600 to-indigo-500":"bg-slate-300"}`}
                style={{width:`${payPct}%`}}/>
            </div>
            <div className="flex justify-between text-xs font-medium text-slate-400">
              <span>Paid: {fmtINR(booking.paid)}</span>
              <span>Due: {fmtINR(Math.max(0,booking.totalPayable-booking.paid))}</span>
            </div>
          </div>
          {/* Net profit */}
          <div className={`rounded-2xl p-4 border flex items-center gap-4
            ${booking.netProfit>=0?"bg-green-50 border-green-100":"bg-red-50 border-red-100"}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl
              ${booking.netProfit>=0?"bg-green-100":"bg-red-100"}`}>
              {booking.netProfit>=0?"📈":"📉"}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500">Net Profit</p>
              <p className={`text-xl font-extrabold ${booking.netProfit>=0?"text-green-700":"text-red-600"}`}>
                {fmtINR(booking.netProfit)}
              </p>
            </div>
          </div>
          {/* Actions */}
          <div className="flex flex-wrap gap-2.5 pt-1">
            <button onClick={()=>{onClose();onEdit?.(booking);}}
              className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 rounded-2xl
                bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-700 hover:to-indigo-600
                text-white text-sm font-bold shadow-md shadow-blue-200 transition-all">
              <FiEdit2 className="w-4 h-4"/> Edit Booking
            </button>
            {canCancel && (
              <button onClick={()=>{onClose();onCancel?.(booking);}}
                className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 rounded-2xl
                  bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-sm font-bold transition-all">
                <FiX className="w-4 h-4"/> Cancel Booking
              </button>
            )}
          </div>
          {/* Documents */}
          {canRead && (
            <div className="flex flex-wrap gap-2.5">
              <button onClick={()=>runDownload("invoice")} disabled={downloading!==null}
                className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 rounded-2xl
                  bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-200
                  transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                {downloading==="invoice"
                  ? <FiRefreshCw className="w-4 h-4 animate-spin"/>
                  : <FiFileText className="w-4 h-4"/>}
                Invoice
              </button>
              <button onClick={()=>runDownload("voucher")} disabled={downloading!==null}
                className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 rounded-2xl
                  border border-blue-200 text-blue-700 bg-white hover:bg-blue-50 text-sm font-bold
                  transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                {downloading==="voucher"
                  ? <FiRefreshCw className="w-4 h-4 animate-spin"/>
                  : <MdOutlineReceiptLong className="w-4 h-4"/>}
                Voucher
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── MOBILE BOOKING CARD ────────────────────────────────────── */
function MobileBookingCard({ b, onView, onEdit, onCancel, onDelete, onInvoice, downloading }) {
  const canCancel = hasPermission(P.BOOKING_CANCEL) && b.status!=="Completed" && b.status!=="Cancelled";
  const canDelete = hasPermission(P.BOOKING_DELETE);
  const canRead   = hasPermission(P.BOOKING_READ);
  const payPct = b.totalPayable>0 ? Math.round(b.paid/b.totalPayable*100) : 0;
  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 space-y-3
      hover:shadow-md hover:border-blue-200 transition-all duration-200">
      <div className="h-1 -mx-4 -mt-4 rounded-t-2xl bg-gradient-to-r from-blue-600 to-indigo-500 mb-3"/>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
              {b.code}
            </span>
            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 ${STATUS_STYLE[b.status]}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[b.status]}`}/>{b.status}
            </span>
          </div>
          <p className="font-extrabold text-slate-800 text-sm truncate">{b.customer}</p>
          <p className="text-xs text-slate-400 mt-0.5">📍 {b.destination}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-base font-extrabold text-slate-800">{fmtINR(b.totalPayable)}</p>
          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${PAY_STYLE[b.payStatus]}`}>
            {b.payStatus}
          </span>
        </div>
      </div>
      {b.services?.length>0&&(
        <div className="flex flex-wrap gap-1.5">
          {b.services.map(s=>(
            <span key={s} className="text-[10px] bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded-full">{s}</span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>📅 {fmtDate(b.travelDate)}</span>
        <span className={`font-extrabold ${b.netProfit>=0?"text-green-600":"text-red-500"}`}>
          {b.netProfit>=0?"📈":"📉"} {fmtINR(b.netProfit)}
        </span>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-slate-400 font-medium">
          <span>Payment Progress</span><span>{payPct}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700
            ${payPct===100?"bg-green-500":payPct>0?"bg-blue-500":"bg-slate-200"}`}
            style={{width:`${payPct}%`}}/>
        </div>
      </div>
      {/* 2×2 amount grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {[
          {label:"Customer Amt",value:fmtINR(b.customerAmount),cls:"text-blue-600 font-bold"},
          {label:"Total Payable",value:fmtINR(b.totalPayable),  cls:"text-slate-700 font-bold"},
          {label:"GST + TCS",   value:fmtINR(b.gst+b.tcs),    cls:"text-amber-600 font-bold"},
          {label:"Vendor Cost", value:fmtINR(b.vendorCost),    cls:"text-slate-600 font-bold"},
        ].map(({label,value,cls})=>(
          <div key={label} className="bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
            <p className="text-slate-400 text-[10px]">{label}</p>
            <p className={cls}>{value}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <button onClick={()=>onView(b)}
          className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-700 hover:to-indigo-600
            text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-200">
          <FiEye className="w-3.5 h-3.5"/> View
        </button>
        <button onClick={()=>onEdit?.(b)}
          className="flex-1 py-2.5 rounded-xl bg-green-50 hover:bg-green-100 text-green-700 border border-green-200
            text-xs font-bold transition-all flex items-center justify-center gap-1.5">
          <FiEdit2 className="w-3.5 h-3.5"/> Edit
        </button>
        {canRead&&(
          <button onClick={()=>onInvoice?.(b)} disabled={downloading===`${b.id}:invoice`}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white
              text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-200
              disabled:opacity-60 disabled:cursor-not-allowed">
            {downloading===`${b.id}:invoice`
              ? <FiRefreshCw className="w-3.5 h-3.5 animate-spin"/>
              : <FiFileText className="w-3.5 h-3.5"/>} Invoice
          </button>
        )}
        {canCancel&&(
          <button onClick={()=>onCancel?.(b)}
            className="flex-1 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200
              text-xs font-bold transition-all flex items-center justify-center gap-1.5">
            <FiX className="w-3.5 h-3.5"/> Cancel
          </button>
        )}
        {canDelete&&(
          <button onClick={()=>onDelete(b.id)}
            className="w-10 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 border border-red-200
              text-xs font-bold transition-all flex items-center justify-center">
            <FiTrash2 className="w-3.5 h-3.5"/>
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── SKELETON ROW ───────────────────────────────────────────── */
function SkeletonRow() {
  return (
    <tr>
      {[...Array(13)].map((_,i)=>(
        <td key={i} className="px-3 py-4">
          <div className="h-4 rounded-lg bg-slate-200 animate-pulse" style={{width:`${35+Math.random()*55}%`}}/>
        </td>
      ))}
    </tr>
  );
}

/* ─── SORTABLE HEADER ────────────────────────────────────────── */
function TH({ label, sKey, sortKey, sortDir, onSort, right }) {
  const active = sortKey===sKey;
  return (
    <th onClick={sKey?()=>onSort(sKey):undefined}
      className={`px-3 py-3.5 text-left text-[10px] font-extrabold text-slate-500 uppercase tracking-wider
        whitespace-nowrap select-none ${sKey?"cursor-pointer hover:text-blue-600 transition-colors":""}
        ${right?"text-right":""}`}>
      <span className={`inline-flex items-center gap-1 ${right?"justify-end w-full":""}`}>
        {label}
        {sKey&&<span className={active?"text-blue-600":"opacity-25"}>{active?(sortDir==="asc"?"↑":"↓"):"↕"}</span>}
      </span>
    </th>
  );
}

/* ─── SELECT WRAPPER ─────────────────────────────────────────── */
function Sel({ value, onChange, options, className="" }) {
  return (
    <div className={`relative ${className}`}>
      <select value={value} onChange={e=>onChange(e.target.value)}
        className={selectCls+" pr-9"}>
        {options.map(o=><option key={o}>{o}</option>)}
      </select>
      <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none"/>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   MAIN PAGE
═════════════════════════════════════════════════════════════ */
export default function BookingsPage({
  bookings: propBookings = EMPTY,
  loading:  propLoading  = false,
  onEdit,
  onRefresh,
}) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [bookings,      setBookings]      = useState(propBookings);
  const [loading,       setLoading]       = useState(propLoading);
  // filters
  // ?code=BK10001 pre-seeds the search box, so a booking reminder can deep-link to its booking.
  // The existing filter already matches on b.code, so this needs no new filtering logic. Read
  // once as the initial value — typing afterwards must not be overwritten by the URL.
  const [urlParams] = useSearchParams();
  const [search,        setSearch]        = useState(urlParams.get("code") ?? "");
  const [filterStatus,  setFilterStatus]  = useState("All Status");
  const [filterPay,     setFilterPay]     = useState("All Payment Status");
  const [filterMonth,   setFilterMonth]   = useState("All Booking Months");
  const [filterTravel,  setFilterTravel]  = useState("All Travel Months");
  const [filtersOpen,   setFiltersOpen]   = useState(false);

  const [statsOpen, setStatsOpen] = useState(false);
  // sort + page
  const [sortKey,  setSortKey]  = useState("id");
  const [sortDir,  setSortDir]  = useState("desc");
  const [page,     setPage]     = useState(1);
  const perPage = 10;
  const [meta,     setMeta]     = useState(null);   // server pagination block (standalone mode)
  const [overview, setOverview] = useState(EMPTY);  // stat-card source (standalone mode, capped)
  const [debouncedSearch, setDebouncedSearch] = useState("");  // settled search that hits the server
  // selection + modals
  const [selected,      setSelected]      = useState(new Set());
  const [modal,         setModal]         = useState(null);
  const [cancelBooking, setCancelBooking] = useState(null);
  const [expenseBooking, setExpenseBooking] = useState(null);
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [rowDownloading, setRowDownloading] = useState(null); // `${publicId}:${kind}` of doc downloading
  const [deletingId,    setDeletingId]    = useState(null);  // publicId of row being deleted
  const [bulkDeleting,  setBulkDeleting]  = useState(false);

  const selfManaged = propBookings.length===0;

  // Debounce the search box so a keystroke isn't a request (standalone mode).
  useEffect(()=>{ const t=setTimeout(()=>setDebouncedSearch(search.trim()),300); return ()=>clearTimeout(t); },[search]);

  // Filters + sort → the server params the backend understands. "All …" sentinels ⇒ undefined
  // (no filter); month names ⇒ 1-12; sort key ⇒ its entity field.
  const serverParams = useMemo(()=>({
    q:             debouncedSearch || undefined,
    status:        filterStatus !== "All Status"          ? filterStatus : undefined,
    paymentStatus: filterPay    !== "All Payment Status"  ? filterPay    : undefined,
    bookingMonth:  filterMonth  !== "All Booking Months"  ? MONTHS.indexOf(filterMonth)+1  : undefined,
    travelMonth:   filterTravel !== "All Travel Months"   ? MONTHS.indexOf(filterTravel)+1 : undefined,
    sortBy:        BOOKING_SORT_MAP[sortKey] || "createdAt",
    sortDir,
  }),[debouncedSearch,filterStatus,filterPay,filterMonth,filterTravel,sortKey,sortDir]);
  const serverParamsKey = JSON.stringify(serverParams);

  // Any change to WHAT is listed resets to page 1 (1-based here).
  useEffect(()=>{ setPage(1); },[serverParamsKey]);

  // Guards against out-of-order responses: only the newest request may render.
  const reqId = useRef(0);

  // Standalone TABLE data source — one SERVER page (search/filter/sort/paging all in the DB, so a
  // match on booking #900 is found even though only ~10 rows are ever in memory).
  const fetchBookings = useCallback(async()=>{
    if (!selfManaged) return;
    const id = ++reqId.current;
    setLoading(true);
    try {
      const res = await bookingService.list({ page: page-1, size: perPage, ...JSON.parse(serverParamsKey) });
      if (id !== reqId.current) return;
      const body = res?.data ?? {};
      setBookings((Array.isArray(body.data)?body.data:[]).map(normalizeBooking));
      setMeta(body.pagination ?? null);
    } catch (error) {
      if (id !== reqId.current) return;
      setBookings(EMPTY); setMeta(null);
      if (!isAlreadyReported(error)) showToast(getErrorMessage(error,"Failed to load bookings."),"error");
    } finally { if (id===reqId.current) setLoading(false); }
  },[selfManaged,page,perPage,serverParamsKey,showToast]);

  useEffect(()=>{
    if (selfManaged){fetchBookings();return;}
    setBookings(propBookings); setLoading(propLoading);
  },[propBookings,propLoading,selfManaged,fetchBookings]);

  // Separate overview fetch for the stat cards only (standalone). Capped at 500 — same as before;
  // the searchable TABLE above is server-paged and uncapped.
  useEffect(()=>{
    if (!selfManaged) return;
    bookingService.getAll(0,500)
      .then(res=>{ const b=res.data; const raw=Array.isArray(b?.data)?b.data:Array.isArray(b)?b:[]; setOverview(raw.map(normalizeBooking)); })
      .catch(()=>setOverview(EMPTY));
  },[selfManaged]);

  /* stats — from the overview set in standalone mode (so the page size doesn't shrink the numbers),
     from the provided list when embedded. */
  const statsSource = selfManaged ? overview : bookings;
  const stats = useMemo(()=>({
    total:     statsSource.length,
    confirmed: statsSource.filter(b=>b.status==="Confirmed").length,
    revenue:   statsSource.reduce((s,b)=>s+(b.customerAmount||0),0),
    net:       statsSource.reduce((s,b)=>s+(b.paid||0),0),
    refunds:   statsSource.filter(b=>b.payStatus==="Refunded").reduce((s,b)=>s+(b.paid||0),0),
    profit:    statsSource.reduce((s,b)=>s+(b.netProfit||0),0),
  }),[statsSource]);

  /* Embedded mode still filters/sorts/paginates client-side over the provided list. In standalone
     mode the server already did all three, so `bookings` IS the current page. */
  const clientFiltered = useMemo(()=>{
    let out=[...bookings];
    const q=search.toLowerCase();
    if(q) out=out.filter(b=>(b.code||"").toLowerCase().includes(q)||(b.customer||"").toLowerCase().includes(q)||(b.destination||"").toLowerCase().includes(q));
    if(filterStatus!=="All Status")         out=out.filter(b=>b.status===filterStatus);
    if(filterPay!=="All Payment Status")    out=out.filter(b=>b.payStatus===filterPay);
    if(filterMonth!=="All Booking Months"){ const mi=MONTHS.indexOf(filterMonth)+1; out=out.filter(b=>new Date(b.bookingDate).getMonth()+1===mi); }
    if(filterTravel!=="All Travel Months"){ const mi=MONTHS.indexOf(filterTravel)+1; out=out.filter(b=>new Date(b.travelDate).getMonth()+1===mi); }
    out.sort((a,b)=>{
      let av=a[sortKey],bv=b[sortKey];
      if(typeof av==="string"){av=av.toLowerCase();bv=bv.toLowerCase();}
      if(av<bv) return sortDir==="asc"?-1:1;
      if(av>bv) return sortDir==="asc"?1:-1;
      return 0;
    });
    return out;
  },[bookings,search,filterStatus,filterPay,filterMonth,filterTravel,sortKey,sortDir]);

  const pageData   = selfManaged ? bookings : clientFiltered.slice((page-1)*perPage,page*perPage);
  const totalCount = selfManaged ? (meta?.totalElements ?? 0) : clientFiltered.length;
  const totalPages = Math.max(1, selfManaged ? (meta?.totalPages ?? 1) : Math.ceil(clientFiltered.length/perPage));

  /* handlers */
  const handleSort = key => {
    if(sortKey===key) setSortDir(d=>d==="asc"?"desc":"asc");
    else { setSortKey(key); setSortDir("asc"); }
  };
  const toggleSelect = id => setSelected(s=>{const n=new Set(s);n.has(id)?n.delete(id):n.add(id);return n;});
  const toggleAll    = () => selected.size===pageData.length?setSelected(new Set()):setSelected(new Set(pageData.map(b=>b.id)));
  const openEdit   = b => {
    if (onEdit) { onEdit(b); return; }
    navigate(`/EditBooking/${b.id}`);
  };
  const openCancel = b => setCancelBooking(b);
  const openExpense = booking => {
  setExpenseBooking(booking);
};
const saveBookingExpenses = async (expenses) => {
  if (!expenseBooking?.id) return;

  setExpenseSaving(true);

  try {
    await bookingService.addExpenses(expenseBooking.id, {
      expenses,
    });

    showToast(
      `${expenses.length} booking expense(s) saved successfully.`,
      "success"
    );

    setExpenseBooking(null);
    refreshList?.();
  } catch (error) {
    if (isAlreadyReported(error)) return;

    showToast(
      getErrorMessage(error, "Couldn't save booking expenses."),
      "error"
    );
  } finally {
    setExpenseSaving(false);
  }
};
  const refreshList = onRefresh||fetchBookings;

  const runRowDownload = useCallback(async (kind, b)=>{
    setRowDownloading(`${b.id}:${kind}`);
    try { await downloadDoc(kind, b, showToast); }
    finally { setRowDownloading(null); }
  },[showToast]);

  const handleDelete = useCallback(async id=>{
    if (!hasPermission(P.BOOKING_DELETE)) return;
    setDeletingId(id);
    try {
      await bookingService.delete(id);
      setBookings(p=>p.filter(b=>b.id!==id));
      setSelected(s=>{const n=new Set(s);n.delete(id);return n;});
      showToast("Booking deleted successfully.","success");
    } catch (error) {
      if (isAlreadyReported(error)) return;
      showToast(getErrorMessage(error,"Couldn't delete the booking."),"error");
    } finally { setDeletingId(null); }
  },[showToast]);

  const handleBulkDelete = async () => {
    if (!hasPermission(P.BOOKING_DELETE) || selected.size===0) return;
    const ids = [...selected];
    setBulkDeleting(true);
    try {
      const results = await Promise.allSettled(ids.map(id=>bookingService.delete(id)));
      const okIds  = ids.filter((_,i)=>results[i].status==="fulfilled");
      const failed = results.length - okIds.length;
      if (okIds.length) {
        const okSet = new Set(okIds);
        setBookings(p=>p.filter(b=>!okSet.has(b.id)));
      }
      setSelected(new Set());
      if (failed===0)          showToast(`${okIds.length} booking(s) deleted.`,"success");
      else if (okIds.length)   showToast(`${okIds.length} deleted, ${failed} failed.`,"warning");
      else                     showToast(`Couldn't delete ${failed} booking(s).`,"error");
      refreshList?.();
    } finally { setBulkDeleting(false); }
  };

  const resetFilters = () => {
    setSearch("");setFilterStatus("All Status");setFilterPay("All Payment Status");
    setFilterMonth("All Booking Months");setFilterTravel("All Travel Months");setPage(1);
  };

  const anyFilter = search||filterStatus!=="All Status"||filterPay!=="All Payment Status"
    ||filterMonth!=="All Booking Months"||filterTravel!=="All Travel Months";

  const activeFilterCount = [search,filterStatus!=="All Status",filterPay!=="All Payment Status",
    filterMonth!=="All Booking Months",filterTravel!=="All Travel Months"].filter(Boolean).length;

  /* page-level sums (tax strip) */
  const pageSum = {
    totalPayable: pageData.reduce((s,b)=>s+(b.totalPayable||0),0),
    profit:       pageData.reduce((s,b)=>s+(b.netProfit||0),0),
    gst:          pageData.reduce((s,b)=>s+(b.gst||0),0),
    tcs:          pageData.reduce((s,b)=>s+(b.tcs||0),0),
  };

  const thProps = { sortKey, sortDir, onSort:handleSort };

  /* CSV export */
  const handleExportCSV = async () => {
    const headers = ["Booking Code","Customer","Destination","Travel Date","Customer Amt","GST","TCS","Total Payable","Paid","Net Profit","Status","Payment Status"];
    // Standalone: export ALL rows matching the current filter (up to the backend max), not just the
    // visible page. Embedded: the already-filtered client list.
    let source = clientFiltered;
    if (selfManaged) {
      try {
        const res = await bookingService.list({ page:0, size:200, ...serverParams });
        source = (Array.isArray(res?.data?.data)?res.data.data:[]).map(normalizeBooking);
      } catch (error) {
        if (isAlreadyReported(error)) return;
        showToast(getErrorMessage(error,"Couldn't export bookings."),"error"); return;
      }
    }
    const rows = source.map(b=>[b.code,b.customer,b.destination,fmtDate(b.travelDate),b.customerAmount,b.gst,b.tcs,b.totalPayable,b.paid,b.netProfit,b.status,b.payStatus]);
    const csv  = [headers,...rows].map(r=>r.join(",")).join("\n");
    const blob = new Blob([csv],{type:"text/csv"});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href=url; a.download="bookings-export.csv"; a.click();
    URL.revokeObjectURL(url);
    showToast("CSV exported successfully.");
  };

  /* ─── RENDER ──────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-slate-100"
      style={{fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes slideIn { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes popIn   { from{transform:scale(.92);opacity:0} to{transform:scale(1);opacity:1} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .fade-up { animation:fadeUp .4s ease both; }
        select   { -webkit-appearance:none; appearance:none; }
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#f1f5f9;border-radius:99px}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:99px}
      `}</style>

      {/* modals */}
      {modal && <BookingModal booking={modal} onClose={() => setModal(null)} onEdit={openEdit} onCancel={openCancel} onRefresh={refreshList} />}
      {cancelBooking && <CancelBookingModal booking={cancelBooking} onClose={() => setCancelBooking(null)} onCancelled={refreshList} onToast={showToast} />}

      {/* Booking Expense Modal */}
      {expenseBooking && (
        <BookingExpenseModal
          booking={expenseBooking}
          saving={expenseSaving}
          onClose={() => {
            if (!expenseSaving) {
              setExpenseBooking(null);
            }
          }}
          onSave={saveBookingExpenses}
        />
      )}

      {/* ── PAGE HEADER ── */}
      <div className="bg-white/70 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-500
                flex items-center justify-center text-white shadow-lg shadow-blue-200 flex-shrink-0">
                <FaPlane className="w-5 h-5"/>
              </div>
              <div>
                <h1 className="text-lg font-extrabold text-slate-800 tracking-tight">Bookings</h1>
                <p className="text-xs text-slate-400 hidden sm:block">
                  <span className="hover:text-blue-600 cursor-pointer transition-colors">Home</span>
                  <span className="mx-1 text-slate-300">/</span>
                  <span className="text-blue-600 font-bold">All Bookings</span>
                </p>
              </div>
            </div>
            <button onClick={()=>window.location.href="/allleads"}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl
                bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-700 hover:to-indigo-600
                text-white text-sm font-bold shadow-md shadow-blue-200 hover:shadow-lg transition-all self-start sm:self-auto">
              ＋ Create from Lead
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5 space-y-5">

        {/* ── 6 STAT CARDS ── */}
        {/* <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
          {STAT_CARDS.map((card,i)=>(
            <div key={card.key} className="fade-up" style={{animationDelay:`${i*40}ms`}}>
              <StatCard card={card} value={stats[card.key]}/>
            </div>
          ))}
        </div> */}

        {/* ── COLLAPSIBLE BOOKING ANALYTICS ── */}
<div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden fade-up">

  {/* Toggle header */}
  <button
    type="button"
    onClick={() => setStatsOpen((previous) => !previous)}
    aria-expanded={statsOpen}
    className="w-full px-4 sm:px-5 py-3 flex items-center justify-between gap-3
      hover:bg-slate-50 transition-colors"
  >
    <div className="flex items-center gap-3 flex-wrap min-w-0">
      <div className="flex items-center gap-2">
        <FaPlane className="w-4 h-4 text-blue-600" />

        <span className="text-sm font-extrabold text-slate-700">
          Booking Analytics
        </span>
      </div>

      {/* Compact values when cards are closed */}
      {!statsOpen && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold">
            {stats.total} Bookings
          </span>

          <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-[11px] font-bold">
            {stats.confirmed} Confirmed
          </span>

          <span className="px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 text-[11px] font-bold">
            Revenue {fmtINR(stats.revenue)}
          </span>

          <span className="px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-bold">
            Net {fmtINR(stats.net)}
          </span>

          <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-[11px] font-bold">
            Refunds {fmtINR(stats.refunds)}
          </span>

          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold">
            Profit {fmtINR(stats.profit)}
          </span>
        </div>
      )}
    </div>

    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
      {statsOpen ? (
        <FiChevronUp className="w-4 h-4" />
      ) : (
        <FiChevronDown className="w-4 h-4" />
      )}
    </div>
  </button>

  {/* Expandable cards */}
  <div
    className={`grid transition-all duration-300 ease-in-out ${
      statsOpen
        ? "grid-rows-[1fr] opacity-100"
        : "grid-rows-[0fr] opacity-0"
    }`}
  >
    <div className="min-h-0 overflow-hidden">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 p-4 pt-1">
        {STAT_CARDS.map((card, i) => (
          <div
            key={card.key}
            className="fade-up"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <StatCard
              card={card}
              value={stats[card.key]}
            />
          </div>
        ))}
      </div>
    </div>
  </div>
</div>

        {/* ── TAX & PROFIT SUMMARY ── */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm px-5 py-4 fade-up">
          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <MdOutlineReceiptLong className="w-3.5 h-3.5 text-blue-500"/>
            Tax &amp; Profit Summary — Current Page ({pageData.length} bookings)
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {icon:"💵",label:"Total Charges",  value:pageSum.totalPayable, bg:"bg-blue-50",   border:"border-blue-100",   text:"text-blue-600"   },
              {icon:"📈",label:"Net Profit",     value:pageSum.profit,       bg:"bg-green-50",  border:"border-green-100",  text:"text-green-700"  },
              {icon:"🧾",label:"GST Collected",  value:pageSum.gst,          bg:"bg-amber-50",  border:"border-amber-100",  text:"text-amber-700"  },
              {icon:"📋",label:"TCS Collected",  value:pageSum.tcs,          bg:"bg-purple-50", border:"border-purple-100", text:"text-purple-700" },
            ].map(({icon,label,value,bg,border,text})=>(
              <div key={label} className={`${bg} border ${border} rounded-xl px-4 py-3`}>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mb-0.5">{icon} {label}</p>
                <p className={`text-base font-extrabold ${text}`}>{fmtINR(value)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── BOOKING LIST CARD ── */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden fade-up">

          {/* ── COLLAPSIBLE FILTER HEADER (dark slate — matches Reports pages) ── */}
          <button type="button" onClick={()=>setFiltersOpen(v=>!v)}
            className="w-full flex items-center justify-between px-5 py-4 bg-slate-600 hover:bg-slate-700 transition-colors">
            <div className="flex items-center gap-2.5">
              <FiFilter className="w-4 h-4 text-white"/>
              <span className="text-sm font-extrabold text-white">Filters &amp; Search</span>
              {activeFilterCount>0 && (
                <span className="bg-blue-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                  {activeFilterCount} active
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {anyFilter && (
                <button type="button" onClick={e=>{e.stopPropagation();resetFilters();}}
                  className="text-white/70 hover:text-white text-xs font-bold transition-colors">
                  Clear all
                </button>
              )}
              {filtersOpen
                ?<FiChevronUp   className="w-4 h-4 text-white"/>
                :<FiChevronDown className="w-4 h-4 text-white"/>}
            </div>
          </button>

          {/* Filter body */}
          {filtersOpen && (
            <div className="p-5 space-y-4 border-b border-slate-100 bg-slate-50/60"
              style={{animation:"fadeUp .25s ease both"}}>
              {/* Row 1: Search + Status + Payment */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div className="lg:col-span-2">
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">Search</label>
                  <div className="relative">
                    <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                    <input type="text" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}
                      placeholder="Booking code, customer, destination…"
                      className={inputCls+" pl-10"}/>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">Status</label>
                  <Sel value={filterStatus} onChange={v=>{setFilterStatus(v);setPage(1);}}
                    options={["All Status",...BOOKING_STATUSES]}/>
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">Payment</label>
                  <Sel value={filterPay} onChange={v=>{setFilterPay(v);setPage(1);}}
                    options={["All Payment Status",...PAY_STATUSES]}/>
                </div>
              </div>
              {/* Row 2: Month filters + action buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">Booking Month</label>
                  <Sel value={filterMonth} onChange={v=>{setFilterMonth(v);setPage(1);}}
                    options={["All Booking Months",...MONTHS]}/>
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">Travel Month</label>
                  <Sel value={filterTravel} onChange={v=>{setFilterTravel(v);setPage(1);}}
                    options={["All Travel Months",...MONTHS]}/>
                </div>
                <div className="flex items-end gap-3 lg:col-span-2">
                  <button onClick={refreshList}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-slate-200 hover:border-slate-300
                      bg-white hover:bg-slate-50 text-slate-600 text-sm font-bold transition-all h-[42px]">
                    <FiRefreshCw className={`w-3.5 h-3.5 ${loading?"animate-spin":""}`}/> Refresh
                  </button>
                  <button onClick={handleExportCSV}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700
                      text-white text-sm font-bold shadow-md shadow-emerald-200 transition-all h-[42px]">
                    <FiDownload className="w-3.5 h-3.5"/> Export CSV
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── TABLE TOOLBAR ── */}
          <div className="px-5 py-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-extrabold bg-blue-100 text-blue-600 px-2.5 py-1 rounded-full border border-blue-100">
                {totalCount} bookings
              </span>
              {selected.size>0 && hasPermission(P.BOOKING_DELETE) && (
                <button onClick={handleBulkDelete} disabled={bulkDeleting}
                  className="flex items-center gap-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-600
                    border border-red-200 font-bold px-3 py-1.5 rounded-xl transition-all
                    disabled:opacity-60 disabled:cursor-not-allowed">
                  {bulkDeleting ? <FiRefreshCw className="w-3 h-3 animate-spin"/> : <FiTrash2 className="w-3 h-3"/>}
                  Delete {selected.size} selected
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Page {page} of {totalPages} · {pageData.length} shown
            </p>
          </div>

          {/* ── DESKTOP TABLE ── */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead className="bg-slate-50/80 border-b border-slate-100">
                <tr>
                  <th className="px-3 py-3.5 w-10">
                    <input type="checkbox"
                      checked={pageData.length>0&&selected.size===pageData.length}
                      onChange={toggleAll}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer accent-blue-600"/>
                  </th>
                  <TH label="Booking Code" sKey="code"           {...thProps}/>
                  <TH label="Customer"     sKey="customer"       {...thProps}/>
                  <TH label="Destination"/>
                  <TH label="Travel Date"  sKey="travelDate"     {...thProps}/>
                  <TH label="Amt"          sKey="customerAmount" {...thProps} right/>
                  <TH label="GST"          right/>
                  <TH label="TCS"          right/>
                  <TH label="Total"        sKey="totalPayable"   {...thProps} right/>
                  <TH label="Payment"/>
                  <TH label="Profit"       sKey="netProfit"      {...thProps} right/>
                  <TH label="Status"       sKey="status"         {...thProps}/>
                  <TH label="Actions"/>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading
                  ? [...Array(6)].map((_,i)=><SkeletonRow key={i}/>)
                  : pageData.length===0
                  ? (
                    <tr>
                      <td colSpan={13} className="text-center py-20">
                        <FaPlane className="text-5xl text-slate-200 mx-auto mb-3"/>
                        <p className="text-base font-extrabold text-slate-600 mb-1">No Bookings Found</p>
                        <p className="text-sm text-slate-400 mb-4">Try adjusting your filters.</p>
                        {anyFilter && (
                          <button onClick={resetFilters}
                            className="px-5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold text-sm transition-all">
                            Reset Filters
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                  : pageData.map((b,idx)=>{
                    const payPct=b.totalPayable>0?Math.round(b.paid/b.totalPayable*100):0;
                    return (
                      <tr key={b.id}
                        className="group hover:bg-blue-50/40 hover:shadow-[inset_3px_0_0_#b8891f] transition-all duration-150"
                        style={{animation:"fadeUp .35s ease both",animationDelay:`${idx*18}ms`}}>
                        {/* checkbox */}
                        <td className="px-3 py-3.5">
                          <input type="checkbox" checked={selected.has(b.id)} onChange={()=>toggleSelect(b.id)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer accent-blue-600"/>
                        </td>
                        {/* code */}
                        <td className="px-3 py-3.5">
                          <span className="text-xs font-extrabold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                            {b.code}
                          </span>
                        </td>
                        {/* customer */}
                        <td className="px-3 py-3.5">
                          <p className="text-sm font-bold text-slate-800">{b.customer}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{b.createdBy}</p>
                        </td>
                        {/* destination */}
                        <td className="px-3 py-3.5">
                          <p className="text-xs font-semibold text-slate-600 max-w-[120px] truncate">{b.destination}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {b.services?.slice(0,2).map(s=>(
                              <span key={s} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{s}</span>
                            ))}
                            {b.services?.length>2&&<span className="text-[10px] text-slate-400">+{b.services.length-2}</span>}
                          </div>
                        </td>
                        {/* travel date */}
                        <td className="px-3 py-3.5 text-sm font-semibold text-slate-600 whitespace-nowrap">
                          {fmtDate(b.travelDate)}
                        </td>
                        {/* customer amount */}
                        <td className="px-3 py-3.5 text-sm font-bold text-blue-600 text-right whitespace-nowrap">
                          {fmtINR(b.customerAmount)}
                        </td>
                        {/* gst */}
                        <td className="px-3 py-3.5 text-xs text-slate-500 text-right whitespace-nowrap">
                          {fmtINR(b.gst)}
                        </td>
                        {/* tcs */}
                        <td className="px-3 py-3.5 text-xs text-slate-500 text-right whitespace-nowrap">
                          {fmtINR(b.tcs)}
                        </td>
                        {/* total + mini bar */}
                        <td className="px-3 py-3.5 text-right">
                          <p className="text-sm font-extrabold text-slate-800 whitespace-nowrap">{fmtINR(b.totalPayable)}</p>
                          <div className="w-full h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                            <div className={`h-full rounded-full ${payPct===100?"bg-green-500":payPct>0?"bg-blue-500":"bg-slate-200"}`}
                              style={{width:`${payPct}%`}}/>
                          </div>
                          {b.totalPayable>b.paid&&<p className="text-[10px] text-red-500 font-bold mt-0.5 text-right">Due: {fmtINR(b.totalPayable-b.paid)}</p>}
                        </td>
                        {/* payment */}
                        <td className="px-3 py-3.5">
                          <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full ${PAY_STYLE[b.payStatus]}`}>
                            {b.payStatus}
                          </span>
                        </td>
                        {/* net profit */}
                        <td className="px-3 py-3.5 text-right whitespace-nowrap">
                          <span className={`text-sm font-extrabold ${b.netProfit>=0?"text-green-600":"text-red-500"}`}>
                            {fmtINR(b.netProfit)}
                          </span>
                        </td>
                        {/* status */}
                        <td className="px-3 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 text-[10px] font-extrabold px-2.5 py-1 rounded-full ${STATUS_STYLE[b.status]}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[b.status]}`}/>{b.status}
                          </span>
                        </td>
                        {/* actions (fade in on hover) */}
                        <td className="px-3 py-3.5">
                          <div className="flex items-center gap-1.5 opacity-50 group-hover:opacity-100 transition-opacity duration-150">
                            <button onClick={()=>navigate(`/BookingDetails/${b.id}`)} title="View"
                              className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition-all border border-blue-100">
                              <FiEye className="w-3.5 h-3.5"/>
                            </button>
                            <button onClick={()=>openEdit(b)} title="Edit"
                              className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 flex items-center justify-center transition-all border border-slate-200">
                              <FiEdit2 className="w-3.5 h-3.5"/>
                            </button>
                            {hasPermission(P.BOOKING_UPDATE) && (
                              <button
                                onClick={() => openExpense(b)}
                                title="Add Booking Expense"
                                className="w-8 h-8 rounded-lg bg-purple-50 hover:bg-purple-100
                                  text-purple-600 flex items-center justify-center
                                  transition-all border border-purple-200"
                              >
                                <FiWalletCards className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {hasPermission(P.BOOKING_READ)&&(
                              <>
                                <button onClick={()=>runRowDownload("invoice",b)} title="Download Invoice"
                                  disabled={rowDownloading===`${b.id}:invoice`}
                                  className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-all shadow-sm shadow-blue-200 disabled:opacity-60 disabled:cursor-not-allowed">
                                  {rowDownloading===`${b.id}:invoice`
                                    ? <FiRefreshCw className="w-3.5 h-3.5 animate-spin"/>
                                    : <FiFileText className="w-3.5 h-3.5"/>}
                                </button>
                                <button onClick={()=>runRowDownload("voucher",b)} title="Download Voucher"
                                  disabled={rowDownloading===`${b.id}:voucher`}
                                  className="w-8 h-8 rounded-lg border border-blue-200 bg-white hover:bg-blue-50 text-blue-700 flex items-center justify-center transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                                  {rowDownloading===`${b.id}:voucher`
                                    ? <FiRefreshCw className="w-3.5 h-3.5 animate-spin"/>
                                    : <MdOutlineReceiptLong className="w-3.5 h-3.5"/>}
                                </button>
                              </>
                            )}
                            {hasPermission(P.BOOKING_CANCEL)&&b.status!=="Completed"&&b.status!=="Cancelled"&&(
                              <button onClick={()=>openCancel(b)} title="Cancel"
                                className="w-8 h-8 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-600 flex items-center justify-center transition-all border border-amber-100">
                                <FiX className="w-3.5 h-3.5"/>
                              </button>
                            )}
                            {hasPermission(P.BOOKING_DELETE)&&(
                              <button onClick={()=>handleDelete(b.id)} title="Delete"
                                disabled={deletingId===b.id}
                                className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 flex items-center justify-center transition-all border border-red-100 disabled:opacity-60 disabled:cursor-not-allowed">
                                {deletingId===b.id
                                  ? <FiRefreshCw className="w-3.5 h-3.5 animate-spin"/>
                                  : <FiTrash2 className="w-3.5 h-3.5"/>}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* ── MOBILE CARDS ── */}
          <div className="md:hidden p-4 space-y-3">
            {loading
              ? [...Array(3)].map((_,i)=>(
                  <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2 animate-pulse">
                    {[...Array(4)].map((_,j)=>(
                      <div key={j} className="h-4 rounded-lg bg-slate-200" style={{width:`${40+Math.random()*50}%`}}/>
                    ))}
                  </div>
                ))
              : pageData.length===0
              ? (
                <div className="text-center py-16">
                  <FaPlane className="text-5xl text-slate-200 mx-auto mb-3"/>
                  <p className="text-base font-extrabold text-slate-600 mb-1">No Bookings Found</p>
                  {anyFilter&&<button onClick={resetFilters} className="mt-2 text-sm text-blue-600 hover:underline font-bold">Clear filters</button>}
                </div>
              )
              // onView={setModal}
              : pageData.map(b=>(
                  <MobileBookingCard key={b.id} b={b} onView={b=>navigate(`/BookingDetails/${b.id}`)} onEdit={openEdit} onCancel={openCancel} onDelete={handleDelete}
                    onInvoice={b=>runRowDownload("invoice",b)} downloading={rowDownloading}/>
                ))
            }
          </div>

          {/* ── PAGINATION ── */}
          {totalCount>0&&(
            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/60
              flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-slate-400 font-medium">
                Showing{" "}
                <span className="font-bold text-slate-600">{(page-1)*perPage+1}</span>–
                <span className="font-bold text-slate-600">{Math.min(page*perPage,totalCount)}</span>
                {" "}of{" "}
                <span className="font-bold text-slate-600">{totalCount}</span>
              </p>
              <div className="flex items-center gap-1.5">
                <button disabled={page===1} onClick={()=>setPage(1)}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 text-xs font-bold
                    hover:border-blue-300 hover:text-blue-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center">
                  <FaAngleDoubleLeft className="text-xs"/>
                </button>
                <button disabled={page===1} onClick={()=>setPage(p=>p-1)}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 text-xs font-bold
                    hover:border-blue-300 hover:text-blue-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center">
                  <FiChevronLeft className="w-3.5 h-3.5"/>
                </button>
                {Array.from({length:totalPages},(_,i)=>i+1)
                  .filter(p=>p===1||p===totalPages||Math.abs(p-page)<=1)
                  .reduce((acc,p,i,arr)=>{if(i>0&&p-arr[i-1]>1)acc.push("…");acc.push(p);return acc;},[])
                  .map((p,i)=>
                    typeof p==="string"
                      ?<span key={`e${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-slate-400">…</span>
                      :<button key={p} onClick={()=>setPage(p)}
                          className={`w-8 h-8 rounded-lg text-xs font-bold transition-all border
                            ${page===p?"bg-blue-600 border-blue-600 text-white shadow-sm":"bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600"}`}>
                          {p}
                        </button>
                  )}
                <button disabled={page===totalPages} onClick={()=>setPage(p=>p+1)}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 text-xs font-bold
                    hover:border-blue-300 hover:text-blue-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center">
                  <FiChevronRight className="w-3.5 h-3.5"/>
                </button>
                <button disabled={page===totalPages} onClick={()=>setPage(totalPages)}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 text-xs font-bold
                    hover:border-blue-300 hover:text-blue-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center">
                  <FaAngleDoubleRight className="text-xs"/>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}