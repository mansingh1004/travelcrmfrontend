// src/features/vendors/pages/VendorDetails.jsx
// ─────────────────────────────────────────────────────────────
// Vendor Details (View) Page — Travel CRM
// Route: /VendorDetails/:id
//
// Data:
//   vendorService.getById(id)    → profile, financials, services
//   vendorService.getBookings(id)→ vendor bookings table
//
// Layout (reference screenshot, TravelCRM design system):
//   LEFT  : Profile card + Contact Info + Services + Bank & Tax
//           + Notes + Special Conditions
//   RIGHT : 4 stat cards + Payment Overview + Vendor Bookings
//
// Actions: Edit → /EditVendor/:id | WhatsApp | Email
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Handshake as FaHandshake, ArrowLeft as FiArrowLeft, SquarePen as FaEdit,
  User as FiUser, Phone as FaMobileAlt, Mail as FaEnvelope,
  MapPin as FaMapMarkerAlt, Building as MdLocationCity,
  Calendar as FaCalendarAlt, Plane as FaPlane, IndianRupee as FaRupeeSign,
  TrendingUp as FiTrendingUp, Percent as FaPercentage,
  Banknote as FaMoneyBillWave, History as FaHistory, Eye as FaEye,
  Star as FaStar, Star as FaRegStar, BadgeCheck as MdVerified,
  StickyNote as FaStickyNote, TriangleAlert as FiAlertTriangle,
  MessageCircleMore as FaCommentDots, Contact as MdOutlineContactPhone,
  CreditCard as FaCreditCard, FileText as FiFileText,
  Hotel as FaHotel, Bus as FaBus, MapPinned as FaMapMarkedAlt,
  Ship as FaShip, FileSignature as FaFileContract,
} from "lucide-react";
import { WhatsAppIcon as FaWhatsapp } from "@shared/ui/WhatsAppIcon";

import vendorService from "../api/vendorService";
// Through the barrel. features/whatsapp rather than features/communication: that one is routed and
// lazily chunked, so importing it here would drag the whole Communication Center into this page.
import { conversationService } from "@features/whatsapp";

const FONT = "'Plus Jakarta Sans', system-ui, sans-serif";

/* ─── HELPERS ────────────────────────────────────────────────── */
const fmtINR   = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
const fmtDate  = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) : "—";
const initials = (name) => (name || "").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "V";
const enumLabel = (v) =>
  (v || "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const AVATAR_COLORS = [
  "from-blue-500 to-blue-600","from-purple-500 to-purple-600","from-teal-500 to-teal-600",
  "from-rose-500 to-rose-600","from-amber-500 to-amber-600","from-indigo-500 to-indigo-600",
  "from-green-500 to-green-600","from-cyan-500 to-cyan-600","from-pink-500 to-pink-600",
  "from-orange-500 to-orange-600",
];
const avatarGrad = (id) => {
  const n = parseInt(String(id).replace(/\D/g, ""), 10) || 0;
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
};

/* ─── BADGE CONFIGS (same as AllVendors / VendorInformation) ── */
const TYPE_CONFIG = {
  Hotel:          { icon:FaHotel,        bg:"bg-blue-100",   text:"text-blue-700",   border:"border-blue-200"   },
  Airlines:       { icon:FaPlane,        bg:"bg-sky-100",    text:"text-sky-700",    border:"border-sky-200"    },
  Transport:      { icon:FaBus,          bg:"bg-orange-100", text:"text-orange-700", border:"border-orange-200" },
  DMC:            { icon:FaMapMarkedAlt, bg:"bg-teal-100",   text:"text-teal-700",   border:"border-teal-200"   },
  "Travel Agency":{ icon:FaHandshake,    bg:"bg-purple-100", text:"text-purple-700", border:"border-purple-200" },
  "Car Rental":   { icon:FaBus,          bg:"bg-amber-100",  text:"text-amber-700",  border:"border-amber-200"  },
  Cruise:         { icon:FaShip,         bg:"bg-indigo-100", text:"text-indigo-700", border:"border-indigo-200" },
  Insurance:      { icon:FaFileContract, bg:"bg-rose-100",   text:"text-rose-700",   border:"border-rose-200"   },
};
const STATUS_CONFIG = {
  ACTIVE:      { bg:"bg-emerald-100", text:"text-emerald-700", dot:"bg-emerald-500" },
  INACTIVE:    { bg:"bg-slate-100",   text:"text-slate-500",   dot:"bg-slate-400"   },
  SUSPENDED:   { bg:"bg-amber-100",   text:"text-amber-700",   dot:"bg-amber-500"   },
  BLACKLISTED: { bg:"bg-red-100",     text:"text-red-600",     dot:"bg-red-500"     },
};
const PAY_CONFIG = {
  PAID:           { bg:"bg-green-100",  text:"text-green-700"  },
  UNPAID:         { bg:"bg-red-100",    text:"text-red-600"    },
  PARTIALLY_PAID: { bg:"bg-amber-100",  text:"text-amber-700"  },
  OVERDUE:        { bg:"bg-orange-100", text:"text-orange-700" },
};
const BOOKING_STATUS = {
  COMPLETED: { bg:"bg-green-100", text:"text-green-700" },
  CONFIRMED: { bg:"bg-blue-100",  text:"text-blue-700"  },
  PENDING:   { bg:"bg-amber-100", text:"text-amber-700" },
  CANCELLED: { bg:"bg-red-100",   text:"text-red-600"   },
};

/* ─── TOAST ──────────────────────────────────────────────────── */
function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed top-5 right-5 z-[999] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl max-w-xs
      ${type === "success" ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}
      style={{ animation:"slideIn .3s ease both" }}>
      <span className="text-lg">{type === "success" ? "✅" : "❌"}</span>
      <p className="text-sm font-semibold flex-1">{msg}</p>
      <button onClick={onClose} className="opacity-50 hover:opacity-100 text-lg ml-1 leading-none">×</button>
    </div>
  );
}

/* ─── SKELETON ───────────────────────────────────────────────── */
function SkeletonBlock({ h = "h-64" }) {
  return <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm ${h} animate-pulse`}/>;
}

/* ─── STAR RATING (same as AllVendors) ───────────────────────── */
function StarRating({ rating }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i =>
        i <= Math.floor(rating)
          ? <FaStar    key={i} className="w-3 h-3 text-amber-400 fill-amber-400"/>
          : <FaRegStar key={i} className="w-3 h-3 text-slate-300"/>
      )}
      <span className="text-xs font-bold text-slate-600 ml-1">{Number(rating || 0).toFixed(1)}</span>
    </div>
  );
}

/* ─── ANIMATED STAT CARD ─────────────────────────────────────── */
function StatCard({ icon: Icon, label, value, gradient, currency, percent, sub, delay = 0 }) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    let start = 0;
    const target = Math.round(Number(value) || 0);
    if (target === 0) { setDisplayed(0); return; }
    const step = Math.max(1, Math.ceil(target / 60));
    const interval = setInterval(() => {
      start = Math.min(start + step, target);
      setDisplayed(start);
      if (start >= target) clearInterval(interval);
    }, 16);
    return () => clearInterval(interval);
  }, [value]);

  const display = percent
    ? `${displayed}%`
    : currency
    ? fmtINR(displayed)
    : displayed.toLocaleString("en-IN");

  return (
    <div className={`bg-gradient-to-br ${gradient} rounded-2xl p-5 text-white shadow-lg relative overflow-hidden group
      hover:-translate-y-1 hover:shadow-xl transition-all duration-300 fade-up`}
      style={{ animationDelay:`${delay}ms` }}>
      <div className="absolute -right-5 -top-5 w-24 h-24 rounded-full bg-white/10 group-hover:scale-110 transition-transform duration-300"/>
      <div className="absolute -right-3 -bottom-8 w-32 h-32 rounded-full bg-white/10 group-hover:scale-110 transition-transform duration-300"/>
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 group-hover:bg-white/30 flex items-center justify-center transition-all">
            <Icon className="w-5 h-5"/>
          </div>
          {sub && <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">{sub}</span>}
        </div>
        <p className="text-2xl font-extrabold leading-none mb-1">{display}</p>
        <p className="text-xs font-bold uppercase tracking-widest opacity-80">{label}</p>
      </div>
    </div>
  );
}

/* ─── INFO ROW (contact card) ────────────────────────────────── */
function InfoRow({ icon: Icon, label, value, iconClass }) {
  return (
    <div className="flex items-start gap-3 px-5 py-3 border-b border-slate-50 last:border-0">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconClass}`}>
        <Icon className="w-3.5 h-3.5"/>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-400 font-medium">{label}</p>
        <p className="text-sm font-bold text-slate-700 break-words">{value || "—"}</p>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   MAIN COMPONENT
═════════════════════════════════════════════════════════════ */
export default function VendorDetails() {
  const navigate = useNavigate();
  const { id }   = useParams();

  const [vendor, setVendor]       = useState(null);
  const [bookings, setBookings]   = useState([]);
  const [threads, setThreads]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [loadingBk, setLoadingBk] = useState(true);
  const [loadingTh, setLoadingTh] = useState(true);
  const [notFound, setNotFound]   = useState(false);
  const [toast, setToast]         = useState(null);

  const showToast = useCallback((msg, type = "success") => setToast({ msg, type }), []);

  /* ── Load vendor + bookings ──────────────────────────────── */
  useEffect(() => {
    if (!id) { setNotFound(true); setLoading(false); setLoadingBk(false); return; }

    setLoading(true);
    vendorService
      .getById(id)
      .then((res) => {
        const v = res.data?.data ?? res.data;
        if (!v || !(v.name || v.vendorName || v.companyName || v.code || v.vendorCode)) {
          setNotFound(true);
          return;
        }
        // Normalize backend DTO fields (same pattern as AllVendors)
        setVendor({
          ...v,
          name:     v.name    || v.vendorName || v.companyName || "",
          type:     v.type    || v.vendorType || "",
          contact:  v.contact || v.contactPerson || "",
          phone:    v.phone   || v.mobile || "",
          code:     v.code    || v.vendorCode || "",
          services: (Array.isArray(v.services) ? v.services : [])
            .map(s => typeof s === "string" ? s : (s.label || s.name || "")),
          rating:        Number(v.rating        || 0),
          totalBusiness: Number(v.totalBusiness || 0),
          totalPaid:     Number(v.totalPaid     || 0),
          outstanding:   Number(v.outstanding   ?? Math.max(0, (v.totalBusiness || 0) - (v.totalPaid || 0))),
          bookings:      Number(v.bookings      || 0),
        });
      })
      .catch(() => {
        setNotFound(true);
        showToast("Failed to load vendor details.", "error");
      })
      .finally(() => setLoading(false));

    setLoadingBk(true);
    vendorService
      .getBookings(id)
      .then((res) => {
        const raw = res.data?.data ?? res.data ?? [];
        setBookings(Array.isArray(raw) ? raw : []);
      })
      .catch(() => setBookings([]))   // bookings API optional — fail silently
      .finally(() => setLoadingBk(false));
  }, [id, showToast]);

  /* ── Load conversations ──────────────────────────────────────
     Keyed on the vendor's publicId, not the route's numeric id: the conversations
     endpoint is keyed by publicId and we only have it once the vendor has loaded.
     A separate effect rather than a chained .then() so a slow vendor fetch does not
     also delay the bookings table below.

     Fails silently, like bookings. A vendor with no COMMUNICATION module, or a user
     without COMM_READ, gets a 403 here — and an empty card is the honest answer for
     them, not a toast about a feature they do not have. */
  const vendorPublicId = vendor?.publicId;
  useEffect(() => {
    if (!vendorPublicId) return;
    let cancelled = false;

    setLoadingTh(true);
    conversationService
      .forVendor(vendorPublicId, { size: 25 })
      .then(({ items }) => { if (!cancelled) setThreads(Array.isArray(items) ? items : []); })
      .catch(() => { if (!cancelled) setThreads([]); })
      .finally(() => { if (!cancelled) setLoadingTh(false); });

    return () => { cancelled = true; };
  }, [vendorPublicId]);

  /* ── Normalize booking fields (backend DTO safe) ────────── */
  const normBookings = useMemo(() => bookings.map((b) => ({
    id:     b.publicId || b.bookingId || b.id || null,   // UUID → BookingDetails navigation
    code:   b.bookingCode || b.code || "—",              // display code (e.g. BKG-26-0002)
    title:  b.title || b.packageName || b.destination || b.dest || "—",
    date:   b.travelDate || b.date || b.startDate || null,
    amount: Number(b.amount ?? b.totalAmount ?? b.amt ?? 0),
    status: b.status || "Pending",
  })), [bookings]);

  /* ── Stats (bookings + vendor fields fallback) ───────────── */
  const stats = useMemo(() => {
    const totalBookings = normBookings.length || Number(vendor?.bookings || 0);
    const totalCosts = vendor?.totalBusiness
      ? Number(vendor.totalBusiness)
      : normBookings.reduce((s, b) => s + b.amount, 0);
    const avg = totalBookings ? Math.round(totalCosts / totalBookings) : 0;
    const confirmedCount = normBookings.filter(b =>
      ["CONFIRMED", "COMPLETED"].includes((b.status || "").toUpperCase())
    ).length;
    const confirmation = normBookings.length
      ? Math.round((confirmedCount / normBookings.length) * 100)
      : 0;
    const totalPaid   = Number(vendor?.totalPaid   || 0);
    const outstanding = Number(vendor?.outstanding || 0);
    const payPct = totalCosts > 0 ? Math.min(100, Math.round((totalPaid / totalCosts) * 100)) : 0;
    return { totalBookings, totalCosts, avg, confirmation, totalPaid, outstanding, payPct };
  }, [normBookings, vendor]);

  const code = vendor?.code || id;
  const tc   = TYPE_CONFIG[vendor?.type];
  const sc   = STATUS_CONFIG[vendor?.status] || STATUS_CONFIG.INACTIVE;
  const pc   = PAY_CONFIG[vendor?.payStatus] || PAY_CONFIG.UNPAID;
  const grad = avatarGrad(code);
  const waNumber = vendor?.whatsapp || vendor?.phone || "";
  const waLink   = `https://wa.me/${waNumber.replace(/\D/g, "")}`;
  const hasBank  = vendor && (vendor.bankName || vendor.accountNumber || vendor.upiId || vendor.gstNumber || vendor.panNumber);
  const hasCredit= vendor && (vendor.creditLimit || vendor.creditPeriod || vendor.openingBalance);

  /* ── RENDER ──────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100"
      style={{ fontFamily: FONT }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes slideIn { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .fade-up { animation: fadeUp .4s ease both; }
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#f1f5f9;border-radius:99px}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:99px}
      `}</style>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)}/>}

      {/* ── PAGE HEADER (scrolls with page) ── */}
      <div className="bg-white/70 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-400
                flex items-center justify-center text-white shadow-lg shadow-blue-200 flex-shrink-0">
                <FaHandshake className="w-5 h-5"/>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-extrabold text-slate-800 tracking-tight">Vendor Details</h1>
                  {vendor && (
                    <span className="text-xs font-extrabold text-blue-600 bg-blue-50 px-2.5 py-1
                      rounded-full border border-blue-200">
                      {code}
                    </span>
                  )}
                  {loading && <span className="text-xs text-slate-400 font-medium animate-pulse">Loading…</span>}
                </div>
                <p className="text-xs text-slate-400 hidden sm:block mt-0.5">
                  <span className="hover:text-blue-600 cursor-pointer" onClick={() => navigate("/")}>Home</span>
                  <span className="mx-1 text-slate-300">/</span>
                  <span className="hover:text-blue-600 cursor-pointer" onClick={() => navigate("/AllVendors")}>Vendors</span>
                  <span className="mx-1 text-slate-300">/</span>
                  <span className="text-blue-600 font-bold">View</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button type="button" onClick={() => navigate("/AllVendors")}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200
                  hover:border-blue-300 bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-700
                  text-sm font-bold transition-all shadow-sm">
                <FiArrowLeft className="w-4 h-4"/> Back
              </button>
              {vendor && (
                <button type="button" onClick={() => navigate(`/EditVendor/${id}`)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500
                    hover:from-indigo-700 hover:to-indigo-600 text-white text-sm font-bold
                    shadow-md shadow-indigo-200 hover:shadow-lg transition-all">
                  <FaEdit className="w-4 h-4"/> Edit Vendor
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">

        {/* ── LOADING SKELETON ── */}
        {loading ? (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="w-full lg:w-80 xl:w-96 flex-shrink-0 space-y-5">
              <SkeletonBlock h="h-96"/>
              <SkeletonBlock h="h-72"/>
            </div>
            <div className="flex-1 space-y-5">
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => <SkeletonBlock key={i} h="h-32"/>)}
              </div>
              <SkeletonBlock h="h-48"/>
              <SkeletonBlock h="h-80"/>
            </div>
          </div>

        /* ── NOT FOUND ── */
        ) : notFound || !vendor ? (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm text-center py-24 px-6 fade-up">
            <div className="text-6xl mb-4">🤝</div>
            <p className="text-lg font-extrabold text-slate-600 mb-1">Vendor Not Found</p>
            <p className="text-sm text-slate-400 mb-6">
              This vendor may have been deleted or the link is invalid.
            </p>
            <button onClick={() => navigate("/AllVendors")}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm
                shadow-md shadow-blue-200 transition-all inline-flex items-center gap-2">
              <FiArrowLeft className="w-4 h-4"/> Back to Vendors
            </button>
          </div>

        /* ── DETAILS ── */
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">

            {/* ══ LEFT COLUMN ══ */}
            <div className="w-full lg:w-80 xl:w-96 flex-shrink-0 space-y-5">

              {/* ── PROFILE CARD ── */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden fade-up">
                <div className="relative pt-8 pb-6 px-6 text-center">
                  <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-blue-600 to-blue-400"/>
                  <div className={`relative w-20 h-20 rounded-3xl bg-gradient-to-br ${grad} flex items-center
                    justify-center text-white text-2xl font-extrabold shadow-lg mx-auto border-4 border-white`}>
                    {initials(vendor.name)}
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-1.5">
                    <h2 className="text-lg font-extrabold text-slate-800">{vendor.name}</h2>
                    {vendor.verified && <MdVerified className="w-4 h-4 text-blue-500"/>}
                  </div>
                  <p className="text-xs font-extrabold text-blue-600 mt-0.5">{code}</p>

                  {/* Badges */}
                  <div className="flex items-center justify-center gap-1.5 mt-3 flex-wrap">
                    {tc && (
                      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border ${tc.border} ${tc.bg} ${tc.text}`}>
                        <tc.icon className="w-2.5 h-2.5"/> {vendor.type}
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${sc.bg} ${sc.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}/>
                      {enumLabel(vendor.status)}
                    </span>
                    {vendor.payStatus && (
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${pc.bg} ${pc.text}`}>
                        {enumLabel(vendor.payStatus)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Key/value rows */}
                <div className="border-t border-slate-50">
                  {[
                    ["Vendor Type",   vendor.type],
                    ["Contract",      vendor.contractType],
                    ["Payment Terms", vendor.paymentTerms],
                    ["Commission",    vendor.commissionRate != null && vendor.commissionRate !== "" ? `${vendor.commissionRate}%` : null],
                    ["Added On",      fmtDate(vendor.joinDate || vendor.createdAt)],
                  ].map(([label, val]) => (
                    <div key={label} className="flex items-center justify-between px-6 py-3 border-b border-slate-50 last:border-0">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
                      <span className="text-sm font-extrabold text-slate-700">{val || "—"}</span>
                    </div>
                  ))}
                  {/* Performance row (stars) */}
                  <div className="flex items-center justify-between px-6 py-3">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Performance</span>
                    <StarRating rating={vendor.rating}/>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="p-5 space-y-2.5 bg-slate-50/60 border-t border-slate-100">
                  <button onClick={() => navigate(`/EditVendor/${id}`)}
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500
                      hover:from-indigo-700 hover:to-indigo-600 text-white text-sm font-bold flex items-center
                      justify-center gap-2 shadow-md shadow-indigo-200 transition-all">
                    <FaEdit className="w-4 h-4"/> Edit Vendor
                  </button>
                  <div className="flex gap-2.5">
                    <a href={waLink} target="_blank" rel="noreferrer"
                      className="flex-1 py-3 rounded-2xl bg-green-500 hover:bg-green-600 text-white
                        text-sm font-bold flex items-center justify-center gap-2 transition-all">
                      <FaWhatsapp className="w-4 h-4"/> WhatsApp
                    </a>
                    <a href={`mailto:${vendor.email || ""}`}
                      className="flex-1 py-3 rounded-2xl bg-white hover:bg-slate-100 text-slate-600
                        text-sm font-bold flex items-center justify-center gap-2 transition-all
                        border border-slate-200">
                      <FaEnvelope className="w-4 h-4"/> Email
                    </a>
                  </div>
                </div>
              </div>

              {/* ── CONTACT INFORMATION ── */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden fade-up"
                style={{ animationDelay:"60ms" }}>
                <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-xl">📞</div>
                  <div>
                    <h2 className="text-white font-extrabold text-base">Contact Information</h2>
                    <p className="text-blue-100 text-xs">Contact person, phone, email & address</p>
                  </div>
                </div>
                <div className="py-2">
                  <InfoRow icon={FiUser} label="Contact Person" value={vendor.contact}
                    iconClass="bg-blue-50 text-blue-600"/>
                  <InfoRow icon={FaMobileAlt} label="Phone" value={vendor.phone}
                    iconClass="bg-green-50 text-green-600"/>
                  {vendor.alternatePhone && (
                    <InfoRow icon={MdOutlineContactPhone} label="Alternate Phone" value={vendor.alternatePhone}
                      iconClass="bg-teal-50 text-teal-600"/>
                  )}
                  {vendor.whatsapp && (
                    <InfoRow icon={FaWhatsapp} label="WhatsApp" value={vendor.whatsapp}
                      iconClass="bg-emerald-50 text-emerald-600"/>
                  )}
                  <InfoRow icon={FaEnvelope} label="Email" value={vendor.email}
                    iconClass="bg-indigo-50 text-indigo-600"/>
                  {vendor.commPref && (
                    <InfoRow icon={FaCommentDots} label="Communication Preference" value={vendor.commPref}
                      iconClass="bg-purple-50 text-purple-600"/>
                  )}
                  <InfoRow icon={MdLocationCity} label="Location"
                    value={[vendor.city, vendor.state, vendor.country].filter(Boolean).join(", ")}
                    iconClass="bg-orange-50 text-orange-600"/>
                  {(vendor.address || vendor.pincode) && (
                    <InfoRow icon={FaMapMarkerAlt} label="Full Address"
                      value={[vendor.address, vendor.pincode].filter(Boolean).join(" — ")}
                      iconClass="bg-rose-50 text-rose-600"/>
                  )}
                  {vendor.coverageAreas && (
                    <InfoRow icon={FaMapMarkedAlt} label="Coverage Areas" value={vendor.coverageAreas}
                      iconClass="bg-cyan-50 text-cyan-600"/>
                  )}
                </div>
              </div>

              {/* ── SERVICES OFFERED (agar available) ── */}
              {(vendor.services.length > 0 || vendor.serviceDescription) && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden fade-up"
                  style={{ animationDelay:"100ms" }}>
                  <div className="bg-gradient-to-r from-green-600 to-emerald-500 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-xl">⚙️</div>
                      <div>
                        <h2 className="text-white font-extrabold text-base">Services Offered</h2>
                        <p className="text-green-100 text-xs">What this vendor provides</p>
                      </div>
                    </div>
                    {vendor.services.length > 0 && (
                      <span className="text-xs bg-white/20 text-white font-bold px-3 py-1.5 rounded-full">
                        {vendor.services.length}
                      </span>
                    )}
                  </div>
                  <div className="p-5 space-y-3">
                    {vendor.services.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {vendor.services.map((s, i) => (
                          <span key={`${s}-${i}`}
                            className="text-xs font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
                            ✓ {s}
                          </span>
                        ))}
                      </div>
                    )}
                    {vendor.serviceDescription && (
                      <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                        {vendor.serviceDescription}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* ── BANK & TAX (agar available) ── */}
              {hasBank && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden fade-up"
                  style={{ animationDelay:"140ms" }}>
                  <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 px-6 py-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-xl">🏦</div>
                    <div>
                      <h2 className="text-white font-extrabold text-base">Bank & Tax Details</h2>
                      <p className="text-indigo-100 text-xs">For payment processing</p>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="grid grid-cols-1 gap-2">
                      {[["Bank",       vendor.bankName],
                        ["Account",    vendor.accountName],
                        ["Account No.",vendor.accountNumber],
                        ["IFSC / SWIFT", vendor.ifscCode],
                        ["UPI ID",     vendor.upiId],
                        ["GST No.",    vendor.gstNumber],
                        ["PAN No.",    vendor.panNumber]]
                        .filter(([, v]) => v)
                        .map(([l, v]) => (
                          <div key={l} className="flex items-center justify-between bg-indigo-50/60 rounded-xl px-4 py-2.5 border border-indigo-100">
                            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">{l}</span>
                            <span className="text-sm font-extrabold text-indigo-800 break-all text-right ml-3">{v}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── NOTES (agar available) ── */}
              {vendor.notes && (
                <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100 fade-up"
                  style={{ animationDelay:"180ms" }}>
                  <p className="text-xs font-extrabold text-amber-700 mb-2 flex items-center gap-1.5">
                    <FaStickyNote className="w-3.5 h-3.5"/> Vendor Notes
                  </p>
                  <p className="text-sm text-amber-800 leading-relaxed">{vendor.notes}</p>
                </div>
              )}

              {/* ── SPECIAL CONDITIONS (agar available) ── */}
              {vendor.specialConditions && (
                <div className="bg-red-50 rounded-2xl p-5 border border-red-100 fade-up"
                  style={{ animationDelay:"200ms" }}>
                  <p className="text-xs font-extrabold text-red-700 mb-2 flex items-center gap-1.5">
                    <FiAlertTriangle className="w-3.5 h-3.5"/> Special Conditions
                  </p>
                  <p className="text-sm text-red-700 leading-relaxed">{vendor.specialConditions}</p>
                </div>
              )}
            </div>

            {/* ══ RIGHT COLUMN ══ */}
            <div className="flex-1 min-w-0 space-y-6">

              {/* ── STAT CARDS ── */}
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard icon={FaPlane}         label="Total Bookings" value={stats.totalBookings}
                  gradient="from-cyan-500 to-cyan-600" delay={0}/>
                <StatCard icon={FaRupeeSign}     label="Total Costs" value={stats.totalCosts} currency
                  gradient="from-blue-600 to-blue-700" delay={60}/>
                <StatCard icon={FiTrendingUp}    label="Avg. Booking" value={stats.avg} currency
                  gradient="from-indigo-500 to-indigo-600" delay={120}/>
                <StatCard icon={FaPercentage}    label="Confirmation" value={stats.confirmation} percent
                  gradient="from-emerald-500 to-green-600" delay={180} sub="reliability"/>
              </div>

              {/* ── PAYMENT OVERVIEW ── */}
              <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm p-5 fade-up"
                style={{ animationDelay:"100ms" }}>
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h2 className="text-base font-extrabold text-slate-700 flex items-center gap-2">
                    <FaMoneyBillWave className="w-4 h-4 text-green-500"/> Payment Overview
                  </h2>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${pc.bg} ${pc.text}`}>
                    {enumLabel(vendor.payStatus || "UNPAID")}
                  </span>
                </div>

                {/* Trio */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    ["Total Business", fmtINR(stats.totalCosts),  "bg-blue-50 text-blue-700 border-blue-100"],
                    ["Total Paid",     fmtINR(stats.totalPaid),   "bg-green-50 text-green-700 border-green-100"],
                    ["Outstanding",    fmtINR(stats.outstanding),
                      stats.outstanding > 0 ? "bg-amber-50 text-amber-700 border-amber-100" : "bg-slate-50 text-slate-500 border-slate-100"],
                  ].map(([label, val, style]) => (
                    <div key={label} className={`rounded-xl p-3 border text-center ${style}`}>
                      <p className="text-xs font-medium opacity-70 mb-0.5">{label}</p>
                      <p className="text-sm font-extrabold">{val}</p>
                    </div>
                  ))}
                </div>

                {/* Progress bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-medium text-slate-400">
                    <span>Payment Progress</span>
                    <span className="font-bold text-slate-600">{stats.payPct}%</span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700
                      ${stats.payPct === 100 ? "bg-gradient-to-r from-green-500 to-emerald-500"
                      : stats.payPct > 0 ? "bg-gradient-to-r from-blue-500 to-indigo-500" : "bg-slate-200"}`}
                      style={{ width:`${stats.payPct}%` }}/>
                  </div>
                  <div className="flex justify-between text-xs font-medium text-slate-400">
                    <span>Paid: {fmtINR(stats.totalPaid)}</span>
                    <span>Due: {fmtINR(stats.outstanding)}</span>
                  </div>
                </div>

                {/* Credit info (agar available) */}
                {hasCredit && (
                  <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100">
                    {[
                      [FaCreditCard,     "Credit Limit",    vendor.creditLimit ? fmtINR(vendor.creditLimit) : "—"],
                      [FaCalendarAlt,    "Credit Period",   vendor.creditPeriod || "—"],
                      [FiFileText,       "Opening Balance", vendor.openingBalance ? fmtINR(vendor.openingBalance) : "—"],
                    ].map(([Icon, label, val]) => (
                      <div key={label} className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
                        <Icon className="w-3.5 h-3.5 text-slate-400 mx-auto mb-1"/>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mb-0.5">{label}</p>
                        <p className="text-sm font-extrabold text-slate-700">{val}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── CONVERSATIONS CARD ──
                  Every thread with this supplier, across every booking. Read-only on purpose:
                  replying goes through the service line on the booking, which is what moves that
                  line to REQUESTED. A "reply" button here would send without moving anything and
                  leave the operations board calling the line never-contacted. */}
              <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden fade-up"
                style={{ animationDelay:"120ms" }}>

                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
                  <h2 className="text-base font-extrabold text-slate-700 flex items-center gap-2">
                    <FaCommentDots className="w-4 h-4 text-blue-500"/> Conversations
                  </h2>
                  {!loadingTh && threads.length > 0 && (
                    <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2.5 py-1 rounded-full">
                      {threads.length} {threads.length === 1 ? "thread" : "threads"}
                    </span>
                  )}
                </div>

                {loadingTh ? (
                  <div className="p-5 space-y-3">
                    {[...Array(2)].map((_, i) => (
                      <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse"/>
                    ))}
                  </div>

                ) : threads.length === 0 ? (
                  <div className="text-center py-14 px-6">
                    <div className="text-5xl mb-3">💬</div>
                    <p className="text-base font-extrabold text-slate-600 mb-1">Nothing Sent Yet</p>
                    <p className="text-sm text-slate-400">
                      Email and WhatsApp sent to this supplier from a booking&rsquo;s services
                      will appear here.
                    </p>
                  </div>

                ) : (
                  <div className="divide-y divide-slate-50">
                    {threads.map((t, idx) => {
                      const isWa = String(t.channel).toUpperCase() === "WHATSAPP";
                      return (
                        <button
                          key={t.publicId || idx}
                          type="button"
                          /* ?c= opens the Communication Center on this exact thread — the same
                             deep link the record drawers use. */
                          onClick={() => navigate(`/communication?c=${t.publicId}`)}
                          className="w-full text-left px-5 py-3.5 hover:bg-slate-50/70 transition-colors
                            flex items-start gap-3 group">
                          <span className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center border
                            ${isWa ? "bg-emerald-50 border-emerald-100" : "bg-blue-50 border-blue-100"}`}>
                            {isWa
                              ? <FaWhatsapp className="w-4 h-4 text-emerald-600"/>
                              : <FaEnvelope className="w-4 h-4 text-blue-600"/>}
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {/* The subject is "BKD-0012 — Stay in Calangute", so the row already
                                  says which booking and which line without another lookup. */}
                              <p className="text-sm font-bold text-slate-800 truncate group-hover:text-blue-700">
                                {t.subject || t.contactName || (isWa ? "WhatsApp" : "Email")}
                              </p>
                              {t.unreadCount > 0 && (
                                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full
                                  bg-rose-100 text-rose-600 flex-shrink-0">
                                  {t.unreadCount}
                                </span>
                              )}
                            </div>
                            {t.lastMessagePreview && (
                              <p className="text-[11.5px] text-slate-400 truncate mt-0.5">
                                {t.lastMessagePreview}
                              </p>
                            )}
                          </div>

                          <span className="text-[11px] font-semibold text-slate-400 flex-shrink-0 pt-0.5">
                            {fmtDate(t.lastMessageAt)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── VENDOR BOOKINGS CARD ── */}
              <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden fade-up"
                style={{ animationDelay:"140ms" }}>

                {/* Card header */}
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
                  <h2 className="text-base font-extrabold text-slate-700 flex items-center gap-2">
                    <FaHistory className="w-4 h-4 text-blue-500"/> Vendor Bookings
                  </h2>
                  <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2.5 py-1 rounded-full">
                    {normBookings.length} bookings
                  </span>
                </div>

                {/* ── Loading rows ── */}
                {loadingBk ? (
                  <div className="p-5 space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse"/>
                    ))}
                  </div>

                /* ── Empty state ── */
                ) : normBookings.length === 0 ? (
                  <div className="text-center py-20 px-6">
                    <div className="text-5xl mb-3">🧳</div>
                    <p className="text-base font-extrabold text-slate-600 mb-1">No Bookings Yet</p>
                    <p className="text-sm text-slate-400">
                      No bookings have been linked to this vendor so far.
                    </p>
                  </div>

                ) : (
                  <>
                    {/* ── DESKTOP TABLE ── */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full min-w-[680px]">
                        <thead className="bg-slate-50/80 border-b border-slate-100">
                          <tr>
                            {["Booking Code","Title","Travel Date","Amount","Status","Actions"].map(h => (
                              <th key={h} className="px-4 py-3.5 text-left text-xs font-extrabold text-slate-500
                                uppercase tracking-wider whitespace-nowrap">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {normBookings.map((b, idx) => {
                            const bsc = BOOKING_STATUS[(b.status || "").toUpperCase()] || { bg:"bg-slate-100", text:"text-slate-600" };
                            return (
                              <tr key={`${b.code}-${idx}`}
                                className="group transition-all duration-150 hover:bg-blue-50/40 hover:shadow-[inset_3px_0_0_#2563eb]"
                                style={{ animation:"fadeUp .35s ease both", animationDelay:`${idx * 30}ms` }}>
                                <td className="px-4 py-3.5">
                                  <span className="text-xs font-extrabold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
                                    {b.code}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5">
                                  <p className="text-sm font-bold text-slate-700 max-w-[240px] truncate">{b.title}</p>
                                </td>
                                <td className="px-4 py-3.5">
                                  <p className="text-sm font-semibold text-slate-600 whitespace-nowrap">{fmtDate(b.date)}</p>
                                </td>
                                <td className="px-4 py-3.5">
                                  <p className="text-sm font-extrabold text-slate-800 whitespace-nowrap">{fmtINR(b.amount)}</p>
                                </td>
                                <td className="px-4 py-3.5">
                                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${bsc.bg} ${bsc.text}`}>
                                    {enumLabel(b.status)}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5">
                                  <button onClick={() => navigate(`/BookingDetails/${b.id || b.code}`)} title="View Booking"
                                    className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600
                                      flex items-center justify-center transition-all">
                                    <FaEye className="w-4 h-4"/>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* ── MOBILE CARDS ── */}
                    <div className="md:hidden p-4 space-y-3">
                      {normBookings.map((b, idx) => {
                        const bsc = BOOKING_STATUS[(b.status || "").toUpperCase()] || { bg:"bg-slate-100", text:"text-slate-600" };
                        return (
                          <div key={`${b.code}-m-${idx}`}
                            className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3 fade-up"
                            style={{ animationDelay:`${idx * 40}ms` }}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <span className="text-xs font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">
                                  {b.code}
                                </span>
                                <p className="text-sm font-bold text-slate-800 mt-1.5 truncate">{b.title}</p>
                              </div>
                              <span className={`text-xs font-bold px-2 py-1 rounded-full flex-shrink-0 ${bsc.bg} ${bsc.text}`}>
                                {enumLabel(b.status)}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="bg-slate-50 rounded-lg px-3 py-2">
                                <p className="text-slate-400">Travel</p>
                                <p className="font-bold text-slate-700">{fmtDate(b.date)}</p>
                              </div>
                              <div className="bg-slate-50 rounded-lg px-3 py-2">
                                <p className="text-slate-400">Amount</p>
                                <p className="font-extrabold text-slate-800">{fmtINR(b.amount)}</p>
                              </div>
                            </div>
                            <button onClick={() => navigate(`/BookingDetails/${b.id || b.code}`)}
                              className="w-full py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600
                                border border-blue-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all">
                              <FaEye className="w-3.5 h-3.5"/> View Booking
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}