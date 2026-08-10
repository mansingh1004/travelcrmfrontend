import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Filter as FiFilter, RefreshCw as FiRefreshCw, Download as FiDownload, ArrowLeft as FiArrowLeft, ChevronDown as FiChevronDown, ChevronUp as FiChevronUp, Search as FiSearch, ChevronLeft as FiChevronLeft, ChevronRight as FiChevronRight, Eye as FiEye, Pen as FiEdit2, TriangleAlert as FiAlertTriangle, X as FiX, Printer as FiPrinter, IndianRupee as FaRupeeSign, ChartLine as FaChartLine, Percent as FaPercentage, Globe as FaGlobe, House as FaHome, CircleCheck as FaCheckCircle, CircleX as FaTimesCircle, ChevronsLeft as FaAngleDoubleLeft, ChevronsRight as FaAngleDoubleRight, ReceiptText as FaFileInvoiceDollar, ArrowLeftRight as FaExchangeAlt, HandCoins as FaHandHoldingUsd, ChartColumn as MdOutlineBarChart, ReceiptText as MdOutlineReceiptLong } from "lucide-react";


import { bookingService } from "@features/bookings";

/* ─── MOCK DATA ──────────────────────────────────────────────── */
/* ─── DATA NORMALISATION ─────────────────────────────────────
   Maps raw backend booking fields → the shape this page uses.
   Matches BookingsPage.jsx normalizeBooking exactly.           */
const titleCase = s => s ? s.charAt(0).toUpperCase()+s.slice(1).toLowerCase() : s;

function normalizeBooking(b = {}) {
  const customerAmount = Number(b.customerAmount) || 0;
  const vendorCost     = Number(b.vendorCost)     || 0;
  const tcs            = Number(b.tcs)            || 0;
  const gst            = Number(b.gst)            || 0;
  const totalPayable   = Number(b.totalPayable)   || 0;
  const paid           = Number(b.paidAmount)     || 0;
  const due            = Math.max(0, totalPayable - paid);
  const netProfit      = Number(b.netProfit) || (customerAmount - vendorCost);
  const netMargin      = customerAmount > 0
    ? parseFloat(((netProfit / customerAmount) * 100).toFixed(1))
    : 0;

  /* Destination used as travel-type heuristic:
     mark International if destination includes common intl prefixes.
     Backend may return a travelType field — use that first.         */
  const destination = b.destinationSnapshot || b.destination || "";
  const intlKeywords = ["Nepal","Bhutan","Thailand","Dubai","Singapore",
                        "Maldives","Sri Lanka","Vietnam","Bali","Europe",
                        "Australia","USA","UK","Europe","International"];
  const isIntl = b.travelType === "INTERNATIONAL" ||
    intlKeywords.some(k => destination.toLowerCase().includes(k.toLowerCase()));

  const status    = titleCase(b.status);
  const payStatus = titleCase(b.paymentStatus);

  // Format dates for display (backend sends ISO strings)
  const fmtD = d => d ? new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}) : "—";

  return {
    id:             b.publicId || String(b.id || ""),
    numericId:      b.id,
    code:           b.bookingCode || b.code || "—",
    customer:       b.customerNameSnapshot || b.customerName || "—",
    customerDetail: `${b.customerNameSnapshot || b.customerName || "—"} - ${destination}`,
    customerPhone:  b.customerPhone || b.phone || "",
    destination,
    services:       Array.isArray(b.services) ? b.services : [],
    bookingDate:    b.bookingDate,
    travelDate:     b.travelDate,
    createdDate:    fmtD(b.createdAt || b.bookingDate),
    customerAmount,
    vendorCost,
    gst,
    tcs,
    totalPayable,
    paid,
    due,
    netProfit,
    netMargin,
    type:           isIntl ? "International" : "Domestic",
    status,
    payStatus,
  };
}

const DATE_TYPES      = ["Booking Date","Travel Date","Created Date"];
const STATUS_OPTS     = ["All Statuses","Confirmed","Pending","Cancelled","Completed"];
const PAYMENT_OPTS    = ["All Payment Statuses","Fully Paid","Partially Paid","Unpaid","Refunded"];
const SHOW_ENTRIES    = ["10","25","50","100"];

const TYPE_CFG = {
  Domestic:      { bg:"bg-blue-100",   text:"text-blue-700",   label:"Domestic"      },
  International: { bg:"bg-purple-100", text:"text-purple-700", label:"International" },
};
const STATUS_CFG = {
  Confirmed:  { bg:"bg-green-500",  text:"text-white" },
  Pending:    { bg:"bg-amber-500",  text:"text-white" },
  Cancelled:  { bg:"bg-red-500",    text:"text-white" },
  Completed:  { bg:"bg-blue-500",   text:"text-white" },
};

const fmt = (n) => `₹${Number(n).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}`;

/* ─── TOAST ──────────────────────────────────────────────────── */
function Toast({ msg, type, onClose }) {
  useEffect(()=>{ const t=setTimeout(onClose,3500); return()=>clearTimeout(t); },[onClose]);
  return (
    <div className={`fixed top-5 right-5 z-[999] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl max-w-xs
      ${type==="success"?"bg-green-50 border-green-200 text-green-800":"bg-red-50 border-red-200 text-red-800"}`}
      style={{animation:"slideIn .3s ease both"}}>
      <span className="text-lg">{type==="success"?"✅":"❌"}</span>
      <p className="text-sm font-semibold flex-1">{msg}</p>
      <button onClick={onClose} className="opacity-50 hover:opacity-100 text-lg ml-1">×</button>
    </div>
  );
}

/* ─── BIG STAT CARD (4 large hero cards) ────────────────────── */
function BigStatCard({ value, label, subLabel, bg, icon, isPercent, delay=0 }) {
  return (
    <div className={`${bg} rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group
      hover:-translate-y-1 hover:shadow-xl transition-all duration-300`}
      style={{animation:"fadeUp .4s ease both", animationDelay:`${delay}ms`}}>
      <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 group-hover:scale-110 transition-transform"/>
      <div className="absolute -right-4 -bottom-10 w-40 h-40 rounded-full bg-white/10"/>
      <div className="relative z-10">
        <p className="text-3xl sm:text-4xl font-extrabold leading-none mb-1 tracking-tight">
          {isPercent ? `${value}%` : fmt(value)}
        </p>
        <p className="text-sm font-extrabold uppercase tracking-widest opacity-90 mb-1">{label}</p>
        {subLabel && <p className="text-xs opacity-70">{subLabel}</p>}
      </div>
      <div className="absolute right-5 bottom-5 text-white/20 text-6xl">{icon}</div>
    </div>
  );
}

/* ─── MINI STAT (Revenue Breakdown + Booking Statistics) ─────── */
function MiniStat({ icon, label, value, iconBg, isNumber }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center text-white flex-shrink-0 text-sm`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 font-medium leading-none mb-0.5">{label}</p>
        <p className="text-base font-extrabold text-slate-800">
          {isNumber ? value : fmt(value)}
        </p>
      </div>
    </div>
  );
}

/* ─── SKELETON ROW ───────────────────────────────────────────── */
function SkeletonRow() {
  return (
    <tr>
      {[...Array(9)].map((_,i)=>(
        <td key={i} className="px-3 py-4">
          <div className="h-4 rounded-lg bg-slate-200 animate-pulse" style={{width:`${30+Math.random()*55}%`}}/>
        </td>
      ))}
    </tr>
  );
}

const selectCls = "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 font-medium focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none appearance-none cursor-pointer transition-all hover:border-slate-300";
const inputCls  = "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 font-medium placeholder-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none transition-all hover:border-slate-300";

/* ─── MAIN PAGE ──────────────────────────────────────────────── */

/* ─── BOOKING VIEW MODAL ─────────────────────────────────────
   Same look/feel as BookingsPage BookingModal.
   Triggered by the 👁 View button on each row.
   Edit button inside → navigate to /EditBooking/:id         */
const STATUS_STYLE_M = {
  Confirmed: "bg-green-100 text-green-700 border-green-200",
  Pending:   "bg-amber-100 text-amber-700 border-amber-200",
  Cancelled: "bg-red-100   text-red-600   border-red-200",
  Completed: "bg-blue-100  text-blue-700  border-blue-200",
  Refunded:  "bg-purple-100 text-purple-700 border-purple-200",
};
const STATUS_DOT_M = {
  Confirmed: "bg-green-500", Pending:  "bg-amber-500",
  Cancelled: "bg-red-500",   Completed:"bg-blue-500", Refunded:"bg-purple-500",
};
const PAY_STYLE_M = {
  Paid:    "bg-emerald-100 text-emerald-700",
  Partial: "bg-orange-100 text-orange-700",
  Unpaid:  "bg-rose-100   text-rose-700",
  Refunded:"bg-slate-100  text-slate-600",
};

function BookingViewModal({ booking, onClose, onEdit }) {
  if (!booking) return null;
  const payPct = booking.totalPayable > 0
    ? Math.round((booking.paid / booking.totalPayable) * 100)
    : 0;
  const profit    = booking.netProfit ?? (booking.customerAmount - booking.vendorCost);
  const payStatus = booking.payStatus || (payPct === 100 ? "Paid" : payPct > 0 ? "Partial" : "Unpaid");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto z-10"
        style={{animation:"popIn .25s ease both"}}>

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-500 px-6 py-5 rounded-t-3xl flex items-start justify-between">
          <div>
            <p className="text-blue-200 text-[10px] font-extrabold uppercase tracking-widest mb-1">Booking Detail</p>
            <h2 className="text-white text-xl font-extrabold tracking-tight">{booking.code}</h2>
            <p className="text-blue-100 text-sm mt-0.5 capitalize">{booking.customer}</p>
            {booking.customerPhone && (
              <p className="text-blue-200 text-xs mt-0.5">📞 {booking.customerPhone}</p>
            )}
          </div>
          <button onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-all flex-shrink-0">
            <FiX className="w-4 h-4"/>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            <span className={`px-3 py-1.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 border
              ${STATUS_STYLE_M[booking.status] || "bg-slate-100 text-slate-700 border-slate-200"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT_M[booking.status] || "bg-slate-400"}`}/>
              {booking.status}
            </span>
            <span className={`px-3 py-1.5 rounded-full text-xs font-extrabold
              ${PAY_STYLE_M[payStatus] || "bg-slate-100 text-slate-600"}`}>
              💳 {payStatus}
            </span>
            <span className={`px-2.5 py-1.5 rounded-full text-xs font-bold
              ${booking.type === "International" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
              {booking.type === "International" ? "🌍" : "🏠"} {booking.type}
            </span>
          </div>

          {/* Detail grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              ["📅", "Travel Date",    booking.travelDate],
              ["🗓️", "Created Date",   booking.createdDate],
              ["👤", "Customer",       booking.customer],
              ["💰", "Customer Amt",   fmt(booking.customerAmount)],
              ["🏷️", "Vendor Cost",    fmt(booking.vendorCost)],
              ["🧾", "TCS",            fmt(booking.tcs)],
              ["💳", "Total Payable",  fmt(booking.totalPayable)],
              ["✅", "Paid",           fmt(booking.paid)],
              ["⏳", "Due",            fmt(booking.due)],
            ].map(([icon, label, val]) => (
              <div key={label} className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mb-1">{icon} {label}</p>
                <p className="text-sm font-extrabold text-slate-700">{val || "—"}</p>
              </div>
            ))}
          </div>

          {/* Payment progress */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-extrabold text-slate-600">Payment Progress</p>
              <p className={`text-sm font-extrabold ${payPct === 100 ? "text-green-600" : "text-blue-600"}`}>{payPct}%</p>
            </div>
            <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700
                ${payPct === 100
                  ? "bg-gradient-to-r from-green-500 to-emerald-500"
                  : payPct > 0 ? "bg-gradient-to-r from-blue-500 to-indigo-500"
                  : "bg-slate-300"}`}
                style={{width:`${payPct}%`}}/>
            </div>
            <div className="flex justify-between text-xs font-medium text-slate-400">
              <span>Paid: {fmt(booking.paid)}</span>
              <span>Due: {fmt(booking.due)}</span>
            </div>
          </div>

          {/* Net profit */}
          <div className={`rounded-2xl p-4 border flex items-center gap-4
            ${profit >= 0 ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl
              ${profit >= 0 ? "bg-green-100" : "bg-red-100"}`}>
              {profit >= 0 ? "📈" : "📉"}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500">Net Profit / Margin</p>
              <p className={`text-xl font-extrabold ${profit >= 0 ? "text-green-700" : "text-red-600"}`}>
                {fmt(profit)}
              </p>
              {booking.netMargin != null && (
                <p className="text-xs text-slate-400 mt-0.5">Margin: {booking.netMargin}%</p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2.5 pt-1">
            <button onClick={() => { onClose(); onEdit(booking); }}
              className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 rounded-2xl
                bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-700 hover:to-indigo-600
                text-white text-sm font-bold shadow-md shadow-blue-200 transition-all">
              <FiEdit2 className="w-4 h-4"/> Edit Booking
            </button>
            <button onClick={onClose}
              className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 rounded-2xl
                bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-sm font-bold transition-all">
              <FiPrinter className="w-4 h-4"/> Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BookingRevenueAnalysis() {
  const navigate = useNavigate();

  /* filter state */
  const [startDate,    setStartDate]    = useState("2026-05-23");
  const [endDate,      setEndDate]      = useState("2026-06-22");
  const [dateType,     setDateType]     = useState("Booking Date");
  const [status,       setStatus]       = useState("All Statuses");
  const [paymentStatus,setPaymentStatus]= useState("All Payment Statuses");
  const [minAmount,    setMinAmount]    = useState("");
  const [maxAmount,    setMaxAmount]    = useState("");
  const [filtersOpen,  setFiltersOpen]  = useState(true);
  const [search,       setSearch]       = useState("");
  const [showEntries,  setShowEntries]  = useState("25");
  const [page,         setPage]         = useState(1);

  const [revenueStatsOpen, setRevenueStatsOpen] = useState(false);

  const [applied,      setApplied]      = useState({
    startDate:"2026-05-23", endDate:"2026-06-22",
    dateType:"Booking Date", status:"All Statuses",
    paymentStatus:"All Payment Statuses", minAmount:"", maxAmount:"",
  });

  /* data state */
  const [bookings, setBookings] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [toast,    setToast]    = useState(null);
  const [viewBooking, setViewBooking] = useState(null); // booking shown in View modal

  const showToast = useCallback((msg,type="success")=>setToast({msg,type}),[]);

  /* ── FETCH REAL DATA ──────────────────────────────────────── */
  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await bookingService.getAll(0, 1000);
      const body = res.data;
      let raw = [];
      if      (Array.isArray(body?.data))          raw = body.data;
      else if (Array.isArray(body?.data?.content)) raw = body.data.content;
      else if (Array.isArray(body?.content))       raw = body.content;
      else if (Array.isArray(body))                raw = body;

      setBookings(raw.map(normalizeBooking));
    } catch (err) {
      console.error("BookingRevenueAnalysis fetch error:", err);
      showToast("Failed to load bookings. Please try again.", "error");
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  /* apply / reset */
  const handleApply = () => {
    setApplied({ startDate, endDate, dateType, status, paymentStatus, minAmount, maxAmount });
    setPage(1); showToast("Filters applied.");
  };
  const handleReset = () => {
    setStartDate("2026-05-23"); setEndDate("2026-06-22");
    setDateType("Booking Date"); setStatus("All Statuses");
    setPaymentStatus("All Payment Statuses");
    setMinAmount(""); setMaxAmount("");
    setApplied({ startDate:"2026-05-23", endDate:"2026-06-22", dateType:"Booking Date",
      status:"All Statuses", paymentStatus:"All Payment Statuses", minAmount:"", maxAmount:"" });
    setSearch(""); setPage(1); showToast("Filters reset.");
  };

  /* export CSV */
  const handleExportCSV = () => {
    const headers = ["Booking Code","Customer","Customer Amount","TCS","Total Payable","Paid","Due","Vendor Cost","Net Profit","Net Margin %","Type","Status","Travel Date"];
    const rows = filtered.map(b=>[
      b.code, b.customer, b.customerAmount, b.tcs, b.totalPayable,
      b.paid, b.due, b.vendorCost, b.netProfit, `${b.netMargin}%`,
      b.type, b.status, b.travelDate,
    ]);
    const csv = [headers,...rows].map(r=>r.join(",")).join("\n");
    const blob = new Blob([csv],{type:"text/csv"});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href=url;
    a.download = `booking-revenue-${applied.startDate}-to-${applied.endDate}.csv`;
    a.click(); URL.revokeObjectURL(url);
    showToast("CSV exported successfully.");
  };

  /* filtered */
  const filtered = useMemo(()=>
    bookings.filter(b=>{
      const q = search.toLowerCase();
      if(q && !b.code.toLowerCase().includes(q) && !b.customer.toLowerCase().includes(q)) return false;
      if(applied.status !== "All Statuses" && b.status !== applied.status) return false;
      if(applied.minAmount && b.customerAmount < Number(applied.minAmount)) return false;
      if(applied.maxAmount && b.customerAmount > Number(applied.maxAmount)) return false;
      return true;
    })
  ,[bookings,search,applied]);

  /* totals */
  const totals = useMemo(()=>({
    customerAmount: filtered.reduce((s,b)=>s+b.customerAmount,0),
    tcs:            filtered.reduce((s,b)=>s+b.tcs,0),
    totalPayable:   filtered.reduce((s,b)=>s+b.totalPayable,0),
    paid:           filtered.reduce((s,b)=>s+b.paid,0),
    due:            filtered.reduce((s,b)=>s+b.due,0),
    vendorCost:     filtered.reduce((s,b)=>s+b.vendorCost,0),
    netProfit:      filtered.reduce((s,b)=>s+b.netProfit,0),
    avgMargin:      filtered.length > 0
      ? (filtered.reduce((s,b)=>s+b.netMargin,0) / filtered.length).toFixed(1)
      : "0.0",
  }),[filtered]);

  /* summary stats */
  const summary = {
    totalRevenue:   totals.customerAmount,
    netProfit:      totals.netProfit,
    avgNetMargin:   Number(totals.avgMargin),
    outstandingDue: totals.due,
    tcs:            totals.tcs,
    totalPayable:   totals.totalPayable,
    paidAmount:     totals.paid,
    refunded:       0,
    international:  filtered.filter(b=>b.type==="International").length,
    domestic:       filtered.filter(b=>b.type==="Domestic").length,
    confirmed:      filtered.filter(b=>b.status==="Confirmed").length,
    completed:      filtered.filter(b=>b.status==="Completed").length,
    cancelled:      filtered.filter(b=>b.status==="Cancelled").length,
  };

  /* pagination */
  const pp         = Number(showEntries);
  const totalPages = Math.max(1,Math.ceil(filtered.length/pp));
  const pageData   = filtered.slice((page-1)*pp, page*pp);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100"
      style={{fontFamily:"'Plus Jakarta Sans', system-ui, sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes slideIn { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes popIn   { from{transform:scale(.92);opacity:0} to{transform:scale(1);opacity:1} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .fade-up { animation: fadeUp .4s ease both; }
        select { -webkit-appearance:none; appearance:none; }
        .line-clamp-1 { display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical; overflow:hidden; }
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#f1f5f9;border-radius:99px}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:99px}
      `}</style>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
      {viewBooking && (
        <BookingViewModal
          booking={viewBooking}
          onClose={()=>setViewBooking(null)}
          onEdit={b=>navigate(`/EditBooking/${b.id}`)}
        />
      )}

      {/* ── PAGE HEADER ── */}
      <div className="bg-white/70 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-green-200 flex-shrink-0">
                <FaChartLine className="w-5 h-5"/>
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Booking Revenue Analysis</h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  Comprehensive revenue and profit analysis
                  <span className="hidden sm:inline ml-3 text-slate-300">|</span>
                  <span className="hidden sm:inline ml-3 text-xs">
                    <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={()=>navigate("/")}>Home</span>
                    <span className="mx-1 text-slate-300">/</span>
                    <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={()=>navigate("/ReportsDashboard")}>Reports</span>
                    <span className="mx-1 text-slate-300">/</span>
                    <span className="text-blue-600 font-bold">Revenue Analysis</span>
                  </span>
                </p>
              </div>
            </div>
            <button onClick={()=>navigate("/ReportsDashboard")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200
                hover:border-blue-300 bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-600
                text-sm font-bold transition-all shadow-sm">
              <FiArrowLeft className="w-4 h-4"/> Back to Reports
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* ── FILTERS & SETTINGS ── */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden fade-up">
          <button type="button" onClick={()=>setFiltersOpen(v=>!v)}
            className="w-full flex items-center justify-between px-5 py-4 bg-slate-600 hover:bg-slate-700 transition-colors">
            <div className="flex items-center gap-2.5">
              <FiFilter className="w-4 h-4 text-white"/>
              <span className="text-sm font-extrabold text-white">Filters &amp; Settings</span>
            </div>
            {filtersOpen
              ? <FiChevronUp   className="w-4 h-4 text-white"/>
              : <FiChevronDown className="w-4 h-4 text-white"/>}
          </button>

          {filtersOpen && (
            <div className="p-5 space-y-4">
              {/* Row 1: Start Date | End Date | Date Type | Status | Payment Status | Apply */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">Start Date</label>
                  <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className={inputCls}/>
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">End Date</label>
                  <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className={inputCls}/>
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">Date Type</label>
                  <div className="relative">
                    <select value={dateType} onChange={e=>setDateType(e.target.value)} className={selectCls+" pr-8"}>
                      {DATE_TYPES.map(o=><option key={o}>{o}</option>)}
                    </select>
                    <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none"/>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">Status</label>
                  <div className="relative">
                    <select value={status} onChange={e=>setStatus(e.target.value)} className={selectCls+" pr-8"}>
                      {STATUS_OPTS.map(o=><option key={o}>{o}</option>)}
                    </select>
                    <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none"/>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">Payment Status</label>
                  <div className="relative">
                    <select value={paymentStatus} onChange={e=>setPaymentStatus(e.target.value)} className={selectCls+" pr-8"}>
                      {PAYMENT_OPTS.map(o=><option key={o}>{o}</option>)}
                    </select>
                    <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none"/>
                  </div>
                </div>
                <button onClick={handleApply}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700
                    text-white text-sm font-bold shadow-md shadow-blue-200 transition-all h-[42px]">
                  <FiSearch className="w-3.5 h-3.5"/> Apply
                </button>
              </div>

              {/* Row 2: Min Amount | Max Amount | Reset | Export CSV */}
              <div className="flex flex-col sm:flex-row items-end gap-4">
                <div className="flex-1 max-w-[180px]">
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">
                    Min Amount (₹)
                  </label>
                  <input type="number" value={minAmount} onChange={e=>setMinAmount(e.target.value)}
                    placeholder="0" className={inputCls}/>
                </div>
                <div className="flex-1 max-w-[180px]">
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">
                    Max Amount (₹)
                  </label>
                  <input type="number" value={maxAmount} onChange={e=>setMaxAmount(e.target.value)}
                    placeholder="No limit" className={inputCls}/>
                </div>
                <div className="flex gap-3 pb-0">
                  <button onClick={handleReset}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-slate-200 hover:border-slate-300
                      bg-white hover:bg-slate-50 text-slate-600 text-sm font-bold transition-all h-[42px]">
                    <FiRefreshCw className="w-3.5 h-3.5"/> Reset
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
        </div>

        {/* ── 4 BIG HERO STAT CARDS ── */}
        {/* <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <BigStatCard
            value={summary.totalRevenue}
            label="Total Revenue"
            bg="bg-gradient-to-br from-teal-500 to-cyan-600"
            icon={<FaRupeeSign/>}
            delay={0}
          />
          <BigStatCard
            value={summary.netProfit}
            label="Net Profit"
            bg="bg-gradient-to-br from-green-500 to-emerald-600"
            icon={<FaChartLine/>}
            delay={60}
          />
          <BigStatCard
            value={summary.avgNetMargin}
            label="Avg Net Margin"
            subLabel={`Normal: 71.6%`}
            bg="bg-gradient-to-br from-amber-500 to-orange-500"
            icon={<FaPercentage/>}
            isPercent
            delay={120}
          />
          <BigStatCard
            value={summary.outstandingDue}
            label="Outstanding Due"
            bg="bg-gradient-to-br from-red-500 to-rose-600"
            icon={<FiAlertTriangle/>}
            delay={180}
          />
        </div> */}

        {/* ── COLLAPSIBLE REVENUE ANALYTICS ── */}
<div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden fade-up">

  {/* Toggle header */}
  <button
    type="button"
    onClick={() =>
      setRevenueStatsOpen((previous) => !previous)
    }
    aria-expanded={revenueStatsOpen}
    className="w-full px-4 sm:px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
  >
    <div className="flex items-center gap-3 flex-wrap min-w-0">
      <div className="flex items-center gap-2">
        <FaChartLine className="w-4 h-4 text-emerald-600" />

        <span className="text-sm font-extrabold text-slate-700">
          Revenue Analytics
        </span>
      </div>

      {/* Compact values shown when cards are closed */}
      {!revenueStatsOpen && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-full bg-teal-100 text-teal-700 text-[11px] font-bold">
            Revenue {fmt(summary.totalRevenue)}
          </span>

          <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-[11px] font-bold">
            Profit {fmt(summary.netProfit)}
          </span>

          <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold">
            Margin {summary.avgNetMargin}%
          </span>

          <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-[11px] font-bold">
            Due {fmt(summary.outstandingDue)}
          </span>
        </div>
      )}
    </div>

    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
      {revenueStatsOpen ? (
        <FiChevronUp className="w-4 h-4" />
      ) : (
        <FiChevronDown className="w-4 h-4" />
      )}
    </div>
  </button>

  {/* Expandable cards */}
  <div
    className={`grid transition-all duration-300 ease-in-out ${
      revenueStatsOpen
        ? "grid-rows-[1fr] opacity-100"
        : "grid-rows-[0fr] opacity-0"
    }`}
  >
    <div className="min-h-0 overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 pt-1">

        <BigStatCard
          value={summary.totalRevenue}
          label="Total Revenue"
          bg="bg-gradient-to-br from-teal-500 to-cyan-600"
          icon={<FaRupeeSign />}
          delay={0}
        />

        <BigStatCard
          value={summary.netProfit}
          label="Net Profit"
          bg="bg-gradient-to-br from-green-500 to-emerald-600"
          icon={<FaChartLine />}
          delay={60}
        />

        <BigStatCard
          value={summary.avgNetMargin}
          label="Avg Net Margin"
          subLabel="Normal: 71.6%"
          bg="bg-gradient-to-br from-amber-500 to-orange-500"
          icon={<FaPercentage />}
          isPercent
          delay={120}
        />

        <BigStatCard
          value={summary.outstandingDue}
          label="Outstanding Due"
          bg="bg-gradient-to-br from-red-500 to-rose-600"
          icon={<FiAlertTriangle />}
          delay={180}
        />

      </div>
    </div>
  </div>
</div>

        {/* ── REVENUE BREAKDOWN + BOOKING STATISTICS ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Revenue Breakdown */}
          <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm p-5 fade-up">
            <h3 className="text-sm font-extrabold text-slate-700 mb-4 flex items-center gap-2">
              <MdOutlineReceiptLong className="w-4 h-4 text-green-500"/>
              Revenue Breakdown
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
              <MiniStat icon={<FaRupeeSign/>}         label="TCS (5%)"       value={summary.tcs}         iconBg="bg-blue-500"/>
              <MiniStat icon={<FaFileInvoiceDollar/>} label="Total Payable"  value={summary.totalPayable} iconBg="bg-green-500"/>
              <MiniStat icon={<FaHandHoldingUsd/>}    label="Paid Amount"    value={summary.paidAmount}   iconBg="bg-teal-500"/>
              <MiniStat icon={<FaExchangeAlt/>}       label="Refunded"       value={summary.refunded}     iconBg="bg-red-500"/>
            </div>
          </div>

          {/* Booking Statistics */}
          <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm p-5 fade-up">
            <h3 className="text-sm font-extrabold text-slate-700 mb-4 flex items-center gap-2">
              <MdOutlineBarChart className="w-4 h-4 text-blue-500"/>
              Booking Statistics
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { icon:<FaGlobe/>,       label:"International", value:summary.international, iconBg:"bg-blue-500",   isNumber:true },
                { icon:<FaHome/>,        label:"Domestic",      value:summary.domestic,      iconBg:"bg-slate-500",  isNumber:true },
                { icon:<FaCheckCircle/>, label:"Confirmed",     value:summary.confirmed,     iconBg:"bg-green-500",  isNumber:true },
                { icon:<FaChartLine/>,   label:"Completed",     value:summary.completed,     iconBg:"bg-teal-500",   isNumber:true },
                { icon:<FaTimesCircle/>, label:"Cancelled",     value:summary.cancelled,     iconBg:"bg-red-500",    isNumber:true },
              ].map(s=>(
                <div key={s.label} className="bg-slate-50 rounded-xl px-3 py-3 text-center">
                  <div className={`w-8 h-8 rounded-lg ${s.iconBg} flex items-center justify-center text-white text-sm mx-auto mb-1.5`}>
                    {s.icon}
                  </div>
                  <p className="text-xl font-extrabold text-slate-800">{s.value}</p>
                  <p className="text-[11px] text-slate-500 font-medium">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── BOOKING DETAILS TABLE ── */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden fade-up">

          {/* Card header */}
          <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <MdOutlineReceiptLong className="w-4 h-4 text-green-500"/>
              <h2 className="text-base font-extrabold text-slate-700">Booking Details</h2>
              <span className="text-xs font-extrabold bg-green-600 text-white px-2.5 py-1 rounded-full">
                {filtered.length} bookings
              </span>
            </div>
          </div>

          {/* Show N entries + Search */}
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Show</span>
                <div className="relative">
                  <select value={showEntries} onChange={e=>{ setShowEntries(e.target.value); setPage(1); }}
                    className="pl-2.5 pr-6 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 font-bold focus:outline-none appearance-none cursor-pointer">
                    {SHOW_ENTRIES.map(o=><option key={o}>{o}</option>)}
                  </select>
                  <FiChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none"/>
                </div>
                <span className="text-xs text-slate-500 font-medium">entries</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Search:</span>
                <div className="relative">
                  <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400"/>
                  <input value={search} onChange={e=>{ setSearch(e.target.value); setPage(1); }}
                    placeholder="Booking code, customer…"
                    className="pl-7 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 placeholder-slate-400
                      focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none transition-all w-52"/>
                </div>
              </div>
            </div>
          </div>

          {/* ── DESKTOP TABLE ── */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full min-w-[1200px]">
              <thead className="bg-slate-50/80 border-b border-slate-100">
                <tr>
                  {[
                    "Booking Code","Customer","Customer Amount","TCS",
                    "Total Payable","Paid/Due","Vendor Cost","Net Profit","Net Margin %",
                    "Type","Status","Travel Date","Actions"
                  ].map(h=>(
                    <th key={h} className="px-3 py-3.5 text-left text-xs font-extrabold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading
                  ? [...Array(3)].map((_,i)=><SkeletonRow key={i}/>)
                  : pageData.length===0
                  ? (
                    <tr>
                      <td colSpan={13} className="text-center py-16">
                        <div className="text-5xl mb-3">💼</div>
                        <p className="text-base font-extrabold text-slate-600 mb-1">No Bookings Found</p>
                        <p className="text-sm text-slate-400 mb-4">Try adjusting your filters.</p>
                        <button onClick={handleReset}
                          className="px-4 py-2 rounded-xl bg-blue-50 text-blue-600 font-bold text-sm hover:bg-blue-100 transition-all">
                          Reset Filters
                        </button>
                      </td>
                    </tr>
                  )
                  : (
                    <>
                      {pageData.map((b,idx)=>{
                        const tc = TYPE_CFG[b.type]     || TYPE_CFG.Domestic;
                        const sc = STATUS_CFG[b.status] || STATUS_CFG.Pending;
                        return (
                          <tr key={b.id}
                            className="group hover:bg-blue-50/30 hover:shadow-[inset_3px_0_0_#16a34a] transition-all duration-150"
                            style={{animation:"fadeUp .35s ease both", animationDelay:`${idx*30}ms`}}>
                            {/* Booking Code */}
                            <td className="px-3 py-3.5">
                              <p className="text-sm font-extrabold text-blue-600">{b.code}</p>
                            </td>
                            {/* Customer */}
                            <td className="px-3 py-3.5">
                              <p className="text-sm font-bold text-slate-800">{b.customer}</p>
                              <p className="text-xs text-slate-400 line-clamp-1 max-w-[160px]">{b.customerDetail}</p>
                              <p className="text-xs text-slate-400 font-mono">{b.customerPhone}</p>
                            </td>
                            {/* Customer Amount */}
                            <td className="px-3 py-3.5">
                              <p className="text-sm font-bold text-blue-600">{fmt(b.customerAmount)}</p>
                            </td>
                            {/* TCS */}
                            <td className="px-3 py-3.5">
                              <p className="text-xs font-bold text-slate-500">{fmt(b.tcs)}</p>
                            </td>
                            {/* Total Payable */}
                            <td className="px-3 py-3.5">
                              <p className="text-sm font-bold text-slate-700">{fmt(b.totalPayable)}</p>
                            </td>
                            {/* Paid / Due */}
                            <td className="px-3 py-3.5">
                              <p className="text-xs text-slate-500">{fmt(b.paid)}</p>
                              {b.due > 0 && (
                                <p className="text-xs font-bold text-red-500">Due: {fmt(b.due)}</p>
                              )}
                            </td>
                            {/* Vendor Cost */}
                            <td className="px-3 py-3.5">
                              <p className="text-xs font-medium text-slate-600">{fmt(b.vendorCost)}</p>
                            </td>
                            {/* Net Profit */}
                            <td className="px-3 py-3.5">
                              <p className="text-sm font-extrabold text-green-600">{fmt(b.netProfit)}</p>
                            </td>
                            {/* Net Margin % */}
                            <td className="px-3 py-3.5">
                              <span className={`text-xs font-extrabold px-2 py-1 rounded-lg
                                ${b.netMargin>=70?"bg-green-100 text-green-700":b.netMargin>=30?"bg-amber-100 text-amber-700":"bg-red-100 text-red-700"}`}>
                                {b.netMargin}%
                              </span>
                            </td>
                            {/* Type */}
                            <td className="px-3 py-3.5">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${tc.bg} ${tc.text}`}>
                                {b.type}
                              </span>
                            </td>
                            {/* Status */}
                            <td className="px-3 py-3.5">
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${sc.bg} ${sc.text}`}>
                                {b.status}
                              </span>
                            </td>
                            {/* Travel Date */}
                            <td className="px-3 py-3.5">
                              <p className="text-xs font-bold text-slate-700">{b.travelDate}</p>
                              <p className="text-[11px] text-slate-400">Cr: {b.createdDate}</p>
                            </td>
                            {/* Actions */}
                            <td className="px-3 py-3.5">
                              <div className="flex flex-col gap-1.5">
                                <button onClick={()=>setViewBooking(b)} title="View Booking"
                                  className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-600
                                    flex items-center justify-center transition-all">
                                  <FiEye className="w-3.5 h-3.5"/>
                                </button>
                                <button onClick={()=>navigate(`/EditBooking/${b.id}`)} title="Edit Booking"
                                  className="w-8 h-8 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-600
                                    flex items-center justify-center transition-all">
                                  <FiEdit2 className="w-3.5 h-3.5"/>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {/* ── TOTALS ROW ── */}
                      <tr className="bg-slate-50 border-t-2 border-slate-200 font-extrabold">
                        <td className="px-3 py-3.5 text-sm font-extrabold text-slate-800">TOTALS</td>
                        <td className="px-3 py-3.5"/>
                        <td className="px-3 py-3.5 text-sm font-extrabold text-blue-700">{fmt(totals.customerAmount)}</td>
                        <td className="px-3 py-3.5 text-xs text-slate-500">{fmt(totals.tcs)}</td>
                        <td className="px-3 py-3.5 text-sm font-extrabold text-slate-700">{fmt(totals.totalPayable)}</td>
                        <td className="px-3 py-3.5">
                          <p className="text-xs text-slate-500">{fmt(totals.paid)}</p>
                          {totals.due>0&&<p className="text-xs font-bold text-red-500">{fmt(totals.due)}</p>}
                        </td>
                        <td className="px-3 py-3.5 text-xs text-slate-600">{fmt(totals.vendorCost)}</td>
                        <td className="px-3 py-3.5 text-sm font-extrabold text-green-600">{fmt(totals.netProfit)}</td>
                        <td className="px-3 py-3.5 text-sm font-extrabold text-slate-700">{totals.avgMargin}%</td>
                        <td className="px-3 py-3.5 text-xs text-slate-500">{filtered.length} bookings</td>
                        <td colSpan={3}/>
                      </tr>
                    </>
                  )}
              </tbody>
            </table>
          </div>

          {/* ── MOBILE CARDS ── */}
          <div className="lg:hidden p-4 space-y-3">
            {loading
              ? [...Array(3)].map((_,i)=>(
                  <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2 animate-pulse">
                    {[...Array(4)].map((_,j)=><div key={j} className="h-4 bg-slate-200 rounded-lg" style={{width:`${40+Math.random()*50}%`}}/>)}
                  </div>
                ))
              : pageData.length===0
              ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-3">💼</div>
                  <p className="font-extrabold text-slate-600 mb-2">No Bookings Found</p>
                  <button onClick={handleReset} className="px-4 py-2 rounded-xl bg-blue-50 text-blue-600 font-bold text-sm">Reset</button>
                </div>
              )
              : pageData.map((b,idx)=>{
                const tc = TYPE_CFG[b.type]     || TYPE_CFG.Domestic;
                const sc = STATUS_CFG[b.status] || STATUS_CFG.Pending;
                return (
                  <div key={b.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3 fade-up"
                    style={{animationDelay:`${idx*40}ms`}}>
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-extrabold text-blue-600">{b.code}</p>
                        <p className="text-sm font-bold text-slate-800">{b.customer}</p>
                        <p className="text-xs text-slate-400 font-mono">{b.customerPhone}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${sc.bg} ${sc.text}`}>{b.status}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${tc.bg} ${tc.text}`}>{b.type}</span>
                      </div>
                    </div>
                    {/* Amounts grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        {label:"Customer Amount", value:fmt(b.customerAmount), cls:"text-blue-600 font-bold"},
                        {label:"Total Payable",   value:fmt(b.totalPayable),   cls:"text-slate-700 font-bold"},
                        {label:"Net Profit",      value:fmt(b.netProfit),      cls:"text-green-600 font-bold"},
                        {label:"Outstanding Due", value:fmt(b.due),            cls:"text-red-600 font-bold"},
                      ].map(({label,value,cls})=>(
                        <div key={label} className="bg-slate-50 rounded-xl px-3 py-2">
                          <p className="text-slate-400">{label}</p>
                          <p className={cls}>{value}</p>
                        </div>
                      ))}
                    </div>
                    {/* Net margin + travel */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <div>
                        <span className={`text-xs font-extrabold px-2 py-1 rounded-lg
                          ${b.netMargin>=70?"bg-green-100 text-green-700":b.netMargin>=30?"bg-amber-100 text-amber-700":"bg-red-100 text-red-700"}`}>
                          {b.netMargin}% margin
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-700">Travel: {b.travelDate}</p>
                        <p className="text-[11px] text-slate-400">Cr: {b.createdDate}</p>
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={()=>setViewBooking(b)} title="View Booking"
                          className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-600 flex items-center justify-center transition-all">
                          <FiEye className="w-3 h-3"/>
                        </button>
                        <button onClick={()=>navigate(`/EditBooking/${b.id}`)} title="Edit Booking"
                          className="w-7 h-7 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-600 flex items-center justify-center transition-all">
                          <FiEdit2 className="w-3 h-3"/>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* ── PAGINATION ── */}
          {filtered.length > 0 && (
            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-slate-400 font-medium">
                Showing <span className="font-bold text-slate-600">{(page-1)*pp+1}</span> to{" "}
                <span className="font-bold text-slate-600">{Math.min(page*pp,filtered.length)}</span> of{" "}
                <span className="font-bold text-slate-600">{filtered.length}</span> entries
              </p>
              <div className="flex items-center gap-2">
                <button disabled={page===1} onClick={()=>setPage(1)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-500 hover:border-blue-300 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                  <FaAngleDoubleLeft className="inline"/>
                </button>
                <button disabled={page===1} onClick={()=>setPage(p=>p-1)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-500 hover:border-blue-300 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1">
                  <FiChevronLeft className="w-3 h-3"/> Previous
                </button>
                {Array.from({length:totalPages},(_,i)=>i+1)
                  .filter(p=>p===1||p===totalPages||Math.abs(p-page)<=1)
                  .reduce((acc,p,i,arr)=>{ if(i>0&&p-arr[i-1]>1) acc.push("…"); acc.push(p); return acc; },[])
                  .map((p,i)=>
                    typeof p==="string"
                      ? <span key={`e${i}`} className="px-1 text-xs text-slate-400">…</span>
                      : <button key={p} onClick={()=>setPage(p)}
                          className={`w-8 h-8 rounded-lg text-xs font-bold border transition-all
                            ${page===p?"bg-blue-600 border-blue-600 text-white shadow-sm":"bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600"}`}>
                          {p}
                        </button>
                  )}
                <button disabled={page===totalPages} onClick={()=>setPage(p=>p+1)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-500 hover:border-blue-300 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1">
                  Next <FiChevronRight className="w-3 h-3"/>
                </button>
                <button disabled={page===totalPages} onClick={()=>setPage(totalPages)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-500 hover:border-blue-300 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                  <FaAngleDoubleRight className="inline"/>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}