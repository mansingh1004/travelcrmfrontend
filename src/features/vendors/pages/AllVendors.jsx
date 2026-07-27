import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import vendorService from "../api/vendorService";
import { Search as FiSearch, Plus as FiPlus, Pen as FiEdit2, Trash2 as FiTrash2, Eye as FiEye, Download as FiDownload, Phone as FiPhone, Mail as FiMail, MapPin as FiMapPin, Star as FiStar, ChevronDown as FiChevronDown,
         ChevronUp as FiChevronUp, CircleCheck as FiCheckCircle, Hotel as FaHotel, Plane as FaPlane, Bus as FaBus, MapPinned as FaMapMarkedAlt, Handshake as FaHandshake, Percent as FaPercentage, Star as FaStar, Banknote as FaMoneyBillWave, Star as FaRegStar, BadgeCheck as MdVerified, Sparkles as HiSparkles } from "lucide-react";
import { WhatsAppIcon as FaWhatsapp } from "@shared/ui/WhatsAppIcon";


/* ─── CONSTANTS ──────────────────────────────────────────────── */
const VENDOR_TYPES = ["Hotel", "Airlines", "Transport", "DMC"];
const STATUSES     = ["ACTIVE", "INACTIVE", "SUSPENDED", "BLACKLISTED"];

const enumLabel = (v) =>
  (v || "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const TYPE_CONFIG = {
  Hotel:    { icon:FaHotel,       bg:"bg-blue-100",   text:"text-blue-700",   border:"border-blue-200",   grad:"from-blue-500 to-blue-600"    },
  Airlines: { icon:FaPlane,       bg:"bg-sky-100",    text:"text-sky-700",    border:"border-sky-200",    grad:"from-sky-500 to-sky-600"      },
  Transport:{ icon:FaBus,         bg:"bg-orange-100", text:"text-orange-700", border:"border-orange-200", grad:"from-orange-500 to-orange-600" },
  DMC:      { icon:FaMapMarkedAlt,bg:"bg-teal-100",   text:"text-teal-700",   border:"border-teal-200",   grad:"from-teal-500 to-teal-600"    },
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
const DIST_CARDS = [
  { key:"Hotel",    label:"Hotels",     icon:FaHotel,       color:"bg-blue-500"   },
  { key:"Airlines", label:"Airlines",   icon:FaPlane,       color:"bg-sky-500"    },
  { key:"Transport",label:"Transport",  icon:FaBus,         color:"bg-orange-500" },
  { key:"DMC",      label:"DMCs",       icon:FaMapMarkedAlt,color:"bg-teal-500"   },
  { key:"bookings", label:"Bookings",   icon:FaHandshake,   color:"bg-indigo-500" },
  { key:"cost",     label:"Total Costs",icon:FaPercentage,  color:"bg-slate-600"  },
];

/* ─── HELPERS ────────────────────────────────────────────────── */
const fmtINR    = n  => "₹" + Number(n || 0).toLocaleString("en-IN");
const fmtDate   = d  => d ? new Date(d).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) : "—";
const fmtRating = r  => Number(r).toFixed(1);
const initials  = n  => (n||"").split(" ").map(w=>w[0]||"").join("").slice(0,2).toUpperCase() || "V";

const AVATAR_GRADS = [
  "from-blue-500 to-blue-600","from-purple-500 to-purple-600",
  "from-teal-500 to-teal-600","from-rose-500 to-rose-600",
  "from-amber-500 to-amber-600","from-indigo-500 to-indigo-600",
  "from-cyan-500 to-cyan-600","from-green-500 to-green-600",
];
const avatarGrad = v => AVATAR_GRADS[(v.id || 0) % AVATAR_GRADS.length];

function StarRating({ rating }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i =>
        i <= Math.floor(rating)
          ? <FaStar    key={i} className="w-3 h-3 text-amber-400"/>
          : <FaRegStar key={i} className="w-3 h-3 text-slate-300"/>
      )}
      <span className="text-xs font-bold text-slate-600 ml-1">{fmtRating(rating)}</span>
    </div>
  );
}

/* ─── TOAST ──────────────────────────────────────────────────── */
function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed top-5 right-5 z-[999] flex items-center gap-3 px-4 py-3.5 rounded-2xl border shadow-2xl max-w-sm
      ${type==="success" ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}
      style={{ animation:"slideIn .3s ease both" }}>
      <span className="text-lg">{type==="success" ? "✅" : "❌"}</span>
      <p className="text-sm font-semibold flex-1">{msg}</p>
      <button onClick={onClose} className="opacity-50 hover:opacity-100 text-lg ml-1">×</button>
    </div>
  );
}

/* ─── ANIMATED NUMBER ────────────────────────────────────────── */
function AnimNum({ target, prefix="" }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let s = 0;
    const step = Math.max(1, Math.ceil(target / 60));
    const iv = setInterval(() => { s = Math.min(s+step,target); setV(s); if(s>=target) clearInterval(iv); }, 14);
    return () => clearInterval(iv);
  }, [target]);
  return <span>{prefix}{v.toLocaleString("en-IN")}</span>;
}

/* ─── STAT CARD ──────────────────────────────────────────────── */
function StatCard({ gradient, icon:Icon, label, value, money, delay=0 }) {
  return (
    <div className={`bg-gradient-to-br ${gradient} rounded-2xl p-5 text-white shadow-lg relative overflow-hidden
      group hover:-translate-y-1 hover:shadow-xl transition-all duration-300`}
      style={{ animationDelay:`${delay}ms` }}>
      <div className="absolute -right-5 -top-5 w-24 h-24 rounded-full bg-white/10 group-hover:scale-110 transition-transform"/>
      <div className="absolute -right-3 -bottom-8 w-32 h-32 rounded-full bg-white/10"/>
      <div className="relative z-10">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
          <Icon className="w-5 h-5"/>
        </div>
        <p className="text-2xl sm:text-3xl font-extrabold leading-none mb-1">
          {money ? <AnimNum target={value} prefix="₹"/> : <AnimNum target={value}/>}
        </p>
        <p className="text-xs font-bold uppercase tracking-widest opacity-80">{label}</p>
      </div>
    </div>
  );
}

/* ─── VIEW MODAL (read-only, full data) ──────────────────────── */
function ViewModal({ vendor, onClose, onEdit }) {
  if (!vendor) return null;
  const tc = TYPE_CONFIG[vendor.type] || TYPE_CONFIG.Hotel;
  const sc = STATUS_CONFIG[vendor.status] || STATUS_CONFIG.INACTIVE;
  const pc = PAY_CONFIG[vendor.payStatus] || PAY_CONFIG.UNPAID;
  const payPct = vendor.totalBusiness > 0
    ? Math.round(vendor.totalPaid / vendor.totalBusiness * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto z-10"
        style={{ animation:"popIn .25s ease both" }}>

        {/* Header */}
        <div className={`bg-gradient-to-r ${tc.grad} px-6 py-5 rounded-t-3xl`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${avatarGrad(vendor)}
                flex items-center justify-center text-white font-extrabold text-lg shadow-lg flex-shrink-0`}>
                {initials(vendor.name)}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-white text-xl font-extrabold">{vendor.name}</h2>
                  {vendor.verified && <MdVerified className="w-5 h-5 text-white/80"/>}
                </div>
                <p className="text-white/70 text-sm">{vendor.code}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">
                    {vendor.type}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}/>{enumLabel(vendor.status)}
                  </span>
                </div>
              </div>
            </div>
            <button onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-lg transition-all flex-shrink-0">
              ×
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Rating */}
          <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
            <StarRating rating={vendor.rating || 0}/>
            <span className="text-xs text-slate-500 font-medium">{vendor.bookings || 0} bookings total</span>
          </div>

          {/* Contact grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              [FiPhone,  "Contact",  vendor.contact,  "bg-blue-50 text-blue-600"  ],
              [FiPhone,  "Phone",    vendor.phone,    "bg-green-50 text-green-600"],
              [FiMail,   "Email",    vendor.email,    "bg-indigo-50 text-indigo-600"],
              [FiMapPin, "Location", [vendor.city, vendor.state].filter(Boolean).join(", "), "bg-teal-50 text-teal-600"],
            ].map(([Icon, label, val, ic]) => (
              <div key={label} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm ${ic}`}>
                  <Icon className="w-3.5 h-3.5"/>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 font-medium">{label}</p>
                  <p className="text-sm font-bold text-slate-700 truncate">{val || "—"}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Extra info: contract type, payment terms, commission */}
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Contract",   vendor.contractType  || "—"],
              ["Pay Terms",  vendor.paymentTerms  || "—"],
              ["Commission", vendor.commissionRate != null ? `${vendor.commissionRate}%` : "—"],
            ].map(([label, val]) => (
              <div key={label} className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mb-0.5">{label}</p>
                <p className="text-sm font-extrabold text-slate-700">{val}</p>
              </div>
            ))}
          </div>

          {/* Services */}
          {vendor.services?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Services Offered</p>
              <div className="flex flex-wrap gap-2">
                {vendor.services.map(s => (
                  <span key={s} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Financials */}
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Total Business", fmtINR(vendor.totalBusiness || 0), "bg-blue-50 text-blue-700"  ],
              ["Total Paid",     fmtINR(vendor.totalPaid     || 0), "bg-green-50 text-green-700"],
              ["Outstanding",    fmtINR(vendor.outstanding   || 0),
                (vendor.outstanding || 0) > 0 ? "bg-amber-50 text-amber-700" : "bg-slate-50 text-slate-500"],
            ].map(([label, val, style]) => (
              <div key={label} className={`rounded-xl p-3 border border-current/10 text-center ${style}`}>
                <p className="text-xs font-medium opacity-70 mb-0.5">{label}</p>
                <p className="text-sm font-extrabold">{val}</p>
              </div>
            ))}
          </div>

          {/* Payment progress */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-600">Payment Progress</p>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pc.bg} ${pc.text}`}>
                {enumLabel(vendor.payStatus)}
              </span>
            </div>
            <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700
                ${payPct===100?"bg-gradient-to-r from-green-500 to-emerald-500"
                :payPct>0?"bg-gradient-to-r from-blue-500 to-indigo-500":"bg-slate-300"}`}
                style={{ width:`${payPct}%` }}/>
            </div>
            <div className="flex justify-between text-xs font-medium text-slate-400">
              <span>Paid: {fmtINR(vendor.totalPaid || 0)}</span>
              <span>Due: {fmtINR(vendor.outstanding || 0)}</span>
            </div>
          </div>

          {/* Notes */}
          {vendor.notes && (
            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
              <p className="text-xs font-extrabold text-amber-700 mb-1.5">📝 Vendor Notes</p>
              <p className="text-sm text-amber-800 leading-relaxed">{vendor.notes}</p>
            </div>
          )}

          {/* Special conditions */}
          {vendor.specialConditions && (
            <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
              <p className="text-xs font-extrabold text-red-700 mb-1.5">⚠️ Special Conditions</p>
              <p className="text-sm text-red-700 leading-relaxed">{vendor.specialConditions}</p>
            </div>
          )}

          {/* Bank info */}
          {vendor.bankName && (
            <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100">
              <p className="text-xs font-extrabold text-indigo-700 mb-2">🏦 Bank Details</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-indigo-800">
                {[
                  ["Bank",    vendor.bankName],
                  ["Account",vendor.accountName],
                  ["Number", vendor.accountNumber],
                  ["IFSC",   vendor.ifscCode],
                  ["UPI",    vendor.upiId],
                  ["GST",    vendor.gstNumber],
                ].filter(([,v])=>v).map(([l,v])=>(
                  <div key={l} className="bg-white/70 rounded-lg px-3 py-2">
                    <p className="text-indigo-400 text-[10px] mb-0.5">{l}</p>
                    <p className="font-bold truncate">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2.5 pt-1">
            {/* ── Edit → navigate to edit page ── */}
            <button
              onClick={() => { onClose(); onEdit(vendor); }}
              className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 rounded-2xl
                bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600
                text-white text-sm font-bold shadow-md shadow-indigo-200 transition-all">
              <FiEdit2 className="w-4 h-4"/> Edit Vendor
            </button>
            <a href={`https://wa.me/${(vendor.phone||"").replace(/\D/g,"")}`}
              target="_blank" rel="noreferrer"
              className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 rounded-2xl
                bg-green-500 hover:bg-green-600 text-white text-sm font-bold transition-all">
              <FaWhatsapp className="w-4 h-4"/> WhatsApp
            </a>
            <a href={`mailto:${vendor.email}`}
              className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 rounded-2xl
                bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold transition-all border border-slate-200">
              <FiMail className="w-4 h-4"/> Email
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── DELETE CONFIRM ─────────────────────────────────────────── */
function DeleteConfirm({ vendor, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm z-10 p-6 text-center"
        style={{ animation:"popIn .25s ease both" }}>
        <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center text-3xl mx-auto mb-4">🗑️</div>
        <h3 className="text-lg font-extrabold text-slate-800 mb-1">Delete Vendor?</h3>
        <p className="text-sm text-slate-500 mb-5">
          Are you sure you want to delete{" "}
          <span className="font-bold text-slate-700">{vendor?.name}</span>? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md transition-all">
            Yes, Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── MOBILE VENDOR CARD ─────────────────────────────────────── */
function MobileVendorCard({ v, onView, onNavigateEdit, onDelete, idx }) {
  const tc = TYPE_CONFIG[v.type] || TYPE_CONFIG.Hotel;
  const sc = STATUS_CONFIG[v.status] || STATUS_CONFIG.INACTIVE;
  const pc = PAY_CONFIG[v.payStatus] || PAY_CONFIG.UNPAID;
  const payPct = v.totalBusiness > 0 ? Math.round(v.totalPaid / v.totalBusiness * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 space-y-3
      hover:shadow-md hover:border-blue-200 transition-all duration-200"
      style={{ animation:"fadeUp .35s ease both", animationDelay:`${idx*40}ms` }}>

      <div className="h-1 -mx-4 -mt-4 rounded-t-2xl bg-gradient-to-r from-blue-500 to-indigo-500 mb-3"/>

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${avatarGrad(v)} flex items-center justify-center text-white text-sm font-extrabold flex-shrink-0`}>
            {initials(v.name)}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="font-extrabold text-slate-800 text-sm">{v.name}</p>
              {v.verified && <MdVerified className="w-3.5 h-3.5 text-blue-500"/>}
            </div>
            <p className="text-xs font-bold text-blue-600">{v.code}</p>
            <p className="text-xs text-slate-400">{[v.city, v.state].filter(Boolean).join(", ")}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${sc.bg} ${sc.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}/>{enumLabel(v.status)}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${tc.border} ${tc.bg} ${tc.text}`}>
          <tc.icon className="w-2.5 h-2.5"/> {v.type}
        </span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pc.bg} ${pc.text}`}>
          {enumLabel(v.payStatus)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-50 rounded-lg px-3 py-2">
          <p className="text-slate-400">Business</p>
          <p className="font-extrabold text-slate-800">{fmtINR(v.totalBusiness || 0)}</p>
        </div>
        <div className="bg-slate-50 rounded-lg px-3 py-2">
          <p className="text-slate-400">Outstanding</p>
          <p className={`font-extrabold ${(v.outstanding||0)>0?"text-amber-600":"text-green-600"}`}>
            {fmtINR(v.outstanding || 0)}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <StarRating rating={v.rating || 0}/>
        <span className="text-slate-400">{v.bookings || 0} bookings</span>
      </div>

      <div>
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>Payment</span><span>{payPct}%</span>
        </div>
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${payPct===100?"bg-green-500":payPct>0?"bg-blue-500":"bg-slate-200"}`}
            style={{ width:`${payPct}%` }}/>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={() => onView(v)}
          className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1">
          <FiEye className="w-3 h-3"/> View
        </button>
        {/* ── Edit → navigate ── */}
        <button onClick={() => onNavigateEdit(v.id)}
          className="flex-1 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 text-xs font-bold transition-all flex items-center justify-center gap-1">
          <FiEdit2 className="w-3 h-3"/> Edit
        </button>
        <a href={`https://wa.me/${(v.phone||"").replace(/\D/g,"")}`} target="_blank" rel="noreferrer"
          className="flex-1 py-2.5 rounded-xl bg-green-50 text-green-600 border border-green-200 text-xs font-bold flex items-center justify-center transition-all">
          <FaWhatsapp/>
        </a>
        <button onClick={() => onDelete(v)}
          className="w-10 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 border border-red-200 text-xs font-bold flex items-center justify-center transition-all">
          <FiTrash2 className="w-3 h-3"/>
        </button>
      </div>
    </div>
  );
}

/* ─── SELECT WRAPPER ─────────────────────────────────────────── */
function Sel({ val, onChange, opts, fmt }) {
  return (
    <div className="relative">
      <select value={val} onChange={e => onChange(e.target.value)}
        className="w-full pl-3.5 pr-9 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700
          font-medium focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none appearance-none cursor-pointer transition-all hover:border-slate-300">
        {opts.map(o => <option key={o} value={o}>{fmt ? fmt(o) : o}</option>)}
      </select>
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none">▼</span>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   MAIN PAGE
═════════════════════════════════════════════════════════════ */
export default function Vendors() {
  const navigate = useNavigate();

  const [vendors,  setVendors]  = useState([]);
  const [search,   setSearch]   = useState("");
  const [fStatus,  setFStatus]  = useState("All Status");
  const [fType,    setFType]    = useState("All Types");
  const [sortKey,  setSortKey]  = useState("id");
  const [sortDir,  setSortDir]  = useState("asc");
  const [page,     setPage]     = useState(1);

  const [vendorStatsOpen, setVendorStatsOpen] = useState(false);

  const [vendorDistributionOpen, setVendorDistributionOpen] =
  useState(false);

  const PER = 8;

  const [viewV,    setView]     = useState(null);
  const [deleteV,  setDeleteV]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [toast,    setToast]    = useState(null);

  const showToast = useCallback((msg, type="success") => setToast({msg, type}), []);

  /* ── Load vendors ── */
  useEffect(() => {
    setLoading(true);
    vendorService.getAll()
      .then((res) => {
        const raw = res.data?.data ?? res.data ?? [];
        const list = Array.isArray(raw) ? raw : [];
        setVendors(list.map(v => ({
          ...v,
          name:          v.name         || v.companyName    || "",
          contact:       v.contact      || v.contactPerson  || "",
          phone:         v.phone        || v.mobile         || "",
          state:         v.state        || v.country        || "",
          services:      Array.isArray(v.services) ? v.services : [],
          rating:        v.rating       || 0,
          totalBusiness: v.totalBusiness || 0,
          totalPaid:     v.totalPaid    || 0,
          outstanding:   v.outstanding  || 0,
          bookings:      v.bookings     || 0,
        })));
      })
      .catch(() => showToast("Failed to load vendors.", "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  /* ── Stats ── */
  const stats = useMemo(() => ({
    total:     vendors.length,
    active:    vendors.filter(v => v.status==="ACTIVE").length,
    cost:      vendors.reduce((s,v) => s+(v.totalBusiness||0), 0),
    avgRating: vendors.length ? vendors.reduce((s,v) => s+(v.rating||0), 0) / vendors.length : 0,
  }), [vendors]);

  const distStats = useMemo(() => ({
    Hotel:     vendors.filter(v=>v.type==="Hotel").length,
    Airlines:  vendors.filter(v=>v.type==="Airlines").length,
    Transport: vendors.filter(v=>v.type==="Transport").length,
    DMC:       vendors.filter(v=>v.type==="DMC").length,
    bookings:  vendors.reduce((s,v)=>s+(v.bookings||0),0),
    cost:      vendors.reduce((s,v)=>s+(v.totalBusiness||0),0),
  }), [vendors]);

  /* ── Filter + sort ── */
  const filtered = useMemo(() => {
    let out = [...vendors];
    const q = search.toLowerCase();
    if (q) out = out.filter(v =>
      (v.name||"").toLowerCase().includes(q) ||
      (v.code||"").toLowerCase().includes(q) ||
      (v.contact||"").toLowerCase().includes(q) ||
      (v.city||"").toLowerCase().includes(q) ||
      (v.email||"").toLowerCase().includes(q)
    );
    if (fStatus !== "All Status") out = out.filter(v => v.status === fStatus);
    if (fType   !== "All Types")  out = out.filter(v => v.type   === fType);
    out.sort((a,b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (typeof av === "string") { av = av.toLowerCase(); bv = bv.toLowerCase(); }
      if (av < bv) return sortDir==="asc" ? -1 : 1;
      if (av > bv) return sortDir==="asc" ?  1 : -1;
      return 0;
    });
    return out;
  }, [vendors, search, fStatus, fType, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER));
  const pageData   = filtered.slice((page-1)*PER, page*PER);
  const anyFilter  = search || fStatus !== "All Status" || fType !== "All Types";

  const handleSort = key => {
    if (sortKey === key) setSortDir(d => d==="asc"?"desc":"asc");
    else { setSortKey(key); setSortDir("asc"); }
  };
  const SI = ({ k }) => (
    <span className="ml-1 opacity-40 text-xs">
      {sortKey===k ? (sortDir==="asc"?"↑":"↓") : "↕"}
    </span>
  );

  const resetFilters = () => { setSearch(""); setFStatus("All Status"); setFType("All Types"); setPage(1); };

  /* ── Navigate to edit page ── */
  const handleNavigateEdit = useCallback((vendorId) => {
    navigate(`/EditVendor/${vendorId}`);
  }, [navigate]);

  /* ── View: onEdit navigates to edit page ── */
  const handleViewEdit = useCallback((vendor) => {
    navigate(`/EditVendor/${vendor.id}`);
  }, [navigate]);

  /* ── Delete ── */
  const handleDelete = async () => {
    try {
      await vendorService.delete(deleteV.id);
      setVendors(prev => prev.filter(v => v.id !== deleteV.id));
      showToast(`${deleteV.name} deleted.`);
    } catch {
      showToast("Failed to delete vendor.", "error");
    }
    setDeleteV(null);
  };

  /* ── Export CSV ── */
  const handleExport = async () => {
    try {
      const res = await vendorService.exportCSV();
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url; a.download = "vendors.csv"; a.click();
      showToast("Vendors exported.");
    } catch {
      showToast("Export failed.", "error");
    }
  };

  /* ── RENDER ──────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-100"
      style={{ fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes slideIn { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes popIn   { from{transform:scale(.92);opacity:0} to{transform:scale(1);opacity:1} }
        .fade-up { animation:fadeUp .4s ease both; }
        select { -webkit-appearance:none; appearance:none; }
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#f1f5f9;border-radius:99px}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:99px}
      `}</style>

      {/* Modals + Toast */}
      {toast   && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)}/>}
      {viewV   && <ViewModal vendor={viewV} onClose={() => setView(null)} onEdit={handleViewEdit}/>}
      {deleteV && <DeleteConfirm vendor={deleteV} onClose={() => setDeleteV(null)} onConfirm={handleDelete}/>}

      {/* ── PAGE HEADER ── */}
      <div className="bg-white/70 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-400
                flex items-center justify-center text-white shadow-lg shadow-blue-200 flex-shrink-0">
                <FaHandshake className="w-5 h-5"/>
              </div>
              <div>
                <h1 className="text-lg font-extrabold text-slate-800 tracking-tight">Vendors</h1>
                <p className="text-xs text-slate-400 hidden sm:block mt-0.5">Manage hotels, airlines, transport &amp; DMC partners</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-blue-300
                  bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-600 text-sm font-bold transition-all shadow-sm">
                <FiDownload className="w-3.5 h-3.5"/> Export
              </button>
              <button onClick={() => navigate("/CreateVendor")}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold
                  shadow-md shadow-blue-200 hover:shadow-lg transition-all">
                <FiPlus className="w-4 h-4"/> Add Vendor
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5 space-y-5">

        {/* ── STAT CARDS ── */}
        {/* <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { gradient:"from-cyan-500 to-cyan-600",    icon:FaHandshake,    label:"Total Vendors",    value:stats.total,    money:false, delay:0   },
            { gradient:"from-green-500 to-emerald-600",icon:FiCheckCircle,  label:"Active Vendors",   value:stats.active,   money:false, delay:60  },
            { gradient:"from-amber-500 to-orange-500", icon:FaMoneyBillWave,label:"Total Vendor Costs",value:stats.cost,    money:true,  delay:120 },
            { gradient:"from-rose-500 to-red-500",     icon:FiStar,         label:"Avg. Rating",      value:Math.round(stats.avgRating*10)/10, money:false, delay:180 },
          ].map((c) => (
            <div key={c.label} className="fade-up" style={{ animationDelay:`${c.delay}ms` }}>
              <StatCard {...c}/>
            </div>
          ))}
        </div> */}

        {/* ── COLLAPSIBLE VENDOR ANALYTICS ── */}
<div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden fade-up">

  {/* Toggle header */}
  <button
    type="button"
    onClick={() =>
      setVendorStatsOpen((previous) => !previous)
    }
    aria-expanded={vendorStatsOpen}
    className="w-full px-4 sm:px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
  >
    <div className="flex items-center gap-3 flex-wrap min-w-0">
      <div className="flex items-center gap-2">
        <FaHandshake className="w-4 h-4 text-blue-600" />

        <span className="text-sm font-extrabold text-slate-700">
          Vendor Analytics
        </span>
      </div>

      {/* Compact values shown while cards are closed */}
      {!vendorStatsOpen && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-full bg-cyan-100 text-cyan-700 text-[11px] font-bold">
            {stats.total} Vendors
          </span>

          <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-[11px] font-bold">
            {stats.active} Active
          </span>

          <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold">
            Cost {fmtINR(stats.cost)}
          </span>

          <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 text-[11px] font-bold">
            Rating {stats.avgRating.toFixed(1)}
          </span>
        </div>
      )}
    </div>

    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
      {vendorStatsOpen ? (
        <FiChevronUp className="w-4 h-4" />
      ) : (
        <FiChevronDown className="w-4 h-4" />
      )}
    </div>
  </button>

  {/* Expandable cards */}
  <div
    className={`grid transition-all duration-300 ease-in-out ${
      vendorStatsOpen
        ? "grid-rows-[1fr] opacity-100"
        : "grid-rows-[0fr] opacity-0"
    }`}
  >
    <div className="min-h-0 overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 pt-1">
        {[
          {
            gradient: "from-cyan-500 to-cyan-600",
            icon: FaHandshake,
            label: "Total Vendors",
            value: stats.total,
            money: false,
            delay: 0,
          },
          {
            gradient: "from-green-500 to-emerald-600",
            icon: FiCheckCircle,
            label: "Active Vendors",
            value: stats.active,
            money: false,
            delay: 60,
          },
          {
            gradient: "from-amber-500 to-orange-500",
            icon: FaMoneyBillWave,
            label: "Total Vendor Costs",
            value: stats.cost,
            money: true,
            delay: 120,
          },
          {
            gradient: "from-rose-500 to-red-500",
            icon: FiStar,
            label: "Avg. Rating",
            value: Math.round(stats.avgRating * 10) / 10,
            money: false,
            delay: 180,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="fade-up"
            style={{
              animationDelay: `${card.delay}ms`,
            }}
          >
            <StatCard {...card} />
          </div>
        ))}
      </div>
    </div>
  </div>
</div>

        {/* ── VENDOR DISTRIBUTION ── */}
        {/* <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm p-5 fade-up">
          <p className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <HiSparkles className="text-blue-500 w-4 h-4"/> Vendor Distribution
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {DIST_CARDS.map(c => {
              const val = distStats[c.key] || 0;
              const isMoney = c.key === "cost";
              return (
                <div key={c.key} className={`${c.color} rounded-2xl p-4 text-white relative overflow-hidden
                  hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 cursor-default`}>
                  <div className="absolute -right-4 -bottom-4 w-16 h-16 rounded-full bg-white/10"/>
                  <c.icon className="w-6 h-6 mb-2 opacity-90"/>
                  <p className="text-lg font-extrabold leading-none">
                    {isMoney ? <AnimNum target={val} prefix="₹"/> : <AnimNum target={val}/>}
                  </p>
                  <p className="text-xs font-bold opacity-80 mt-0.5">{c.label}</p>
                </div>
              );
            })}
          </div>
        </div> */}


{/* ── COLLAPSIBLE VENDOR DISTRIBUTION ── */}
<div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden fade-up">

  {/* Toggle header */}
  <button
    type="button"
    onClick={() =>
      setVendorDistributionOpen((previous) => !previous)
    }
    aria-expanded={vendorDistributionOpen}
    className="w-full px-4 sm:px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
  >
    <div className="flex items-center gap-3 flex-wrap min-w-0">
      <div className="flex items-center gap-2">
        <HiSparkles className="w-4 h-4 text-blue-500" />

        <span className="text-sm font-extrabold text-slate-700">
          Vendor Distribution
        </span>
      </div>

      {!vendorDistributionOpen && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold">
            {distStats.Hotel} Hotels
          </span>

          <span className="px-2.5 py-1 rounded-full bg-sky-100 text-sky-700 text-[11px] font-bold">
            {distStats.Airlines} Airlines
          </span>

          <span className="px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 text-[11px] font-bold">
            {distStats.Transport} Transport
          </span>

          <span className="px-2.5 py-1 rounded-full bg-teal-100 text-teal-700 text-[11px] font-bold">
            {distStats.DMC} DMCs
          </span>

          <span className="px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-bold">
            {distStats.bookings} Bookings
          </span>

          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold">
            Cost {fmtINR(distStats.cost)}
          </span>
        </div>
      )}
    </div>

    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
      {vendorDistributionOpen ? (
        <FiChevronUp className="w-4 h-4" />
      ) : (
        <FiChevronDown className="w-4 h-4" />
      )}
    </div>
  </button>

  <div
    className={`grid transition-all duration-300 ease-in-out ${
      vendorDistributionOpen
        ? "grid-rows-[1fr] opacity-100"
        : "grid-rows-[0fr] opacity-0"
    }`}
  >
    <div className="min-h-0 overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 p-4 pt-1">
        {DIST_CARDS.map((card) => {
          const value = distStats[card.key] || 0;
          const isMoney = card.key === "cost";
          const Icon = card.icon;

          return (
            <div
              key={card.key}
              className={`${card.color} rounded-2xl p-4 text-white relative overflow-hidden
                hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 cursor-default`}
            >
              <div className="absolute -right-4 -bottom-4 w-16 h-16 rounded-full bg-white/10" />

              <Icon className="w-6 h-6 mb-2 opacity-90" />

              <p className="text-lg font-extrabold leading-none">
                {isMoney ? (
                  <AnimNum target={value} prefix="₹" />
                ) : (
                  <AnimNum target={value} />
                )}
              </p>

              <p className="text-xs font-bold opacity-80 mt-0.5">
                {card.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  </div>
</div>



        {/* ── VENDOR LIST CARD ── */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden fade-up">

          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-base font-extrabold text-slate-700">Vendor List</h2>
              <span className="text-xs bg-blue-100 text-blue-700 font-extrabold px-2.5 py-1 rounded-full border border-blue-200">
                {filtered.length} vendors
              </span>
            </div>
            {anyFilter && (
              <button onClick={resetFilters}
                className="text-xs text-red-400 hover:text-red-600 font-bold flex items-center gap-1 transition-colors">
                ✕ Clear filters
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60">
            <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search by name, code, contact, city…"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700
                    placeholder-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none transition-all hover:border-slate-300"/>
              </div>
              <Sel val={fStatus} onChange={v => { setFStatus(v); setPage(1); }}
                opts={["All Status", ...STATUSES]} fmt={enumLabel}/>
              <Sel val={fType} onChange={v => { setFType(v); setPage(1); }}
                opts={["All Types", ...VENDOR_TYPES]}/>
            </div>
          </div>

          {/* ── DESKTOP TABLE ── */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead className="bg-slate-50/80 border-b border-slate-100">
                <tr>
                  {[
                    ["Vendor",          "name"],
                    ["Type",            "type"],
                    ["Contact",         null],
                    ["Services",        null],
                    ["Performance",     "rating"],
                    ["Total Business",  "totalBusiness"],
                    ["Total Paid",      "totalPaid"],
                    ["Outstanding",     "outstanding"],
                    ["Pay Status",      "payStatus"],
                    ["Status",          "status"],
                    ["Actions",         null],
                  ].map(([label, key]) => (
                    <th key={label} onClick={key ? () => handleSort(key) : undefined}
                      className={`px-4 py-3.5 text-left text-[10px] font-extrabold text-slate-500 uppercase
                        tracking-wider whitespace-nowrap ${key ? "cursor-pointer hover:text-blue-600 select-none transition-colors" : ""}`}>
                      {label}{key && <SI k={key}/>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  [...Array(6)].map((_,i) => (
                    <tr key={i}>
                      {[...Array(11)].map((_,j) => (
                        <td key={j} className="px-4 py-4">
                          <div className="h-4 rounded-lg bg-slate-200 animate-pulse" style={{ width:`${35+Math.random()*55}%` }}/>
                        </td>
                      ))}
                    </tr>
                  ))
                ) : pageData.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-20">
                      <div className="text-5xl mb-3">🤝</div>
                      <p className="text-base font-extrabold text-slate-600 mb-1">No Vendors Found</p>
                      <p className="text-sm text-slate-400 mb-4">
                        {anyFilter ? "Adjust your filters to see results." : "Start by adding your first vendor."}
                      </p>
                      {anyFilter
                        ? <button onClick={resetFilters} className="px-4 py-2 rounded-xl bg-blue-50 text-blue-600 font-bold text-sm hover:bg-blue-100 transition-all">Clear Filters</button>
                        : <button onClick={() => navigate("/CreateVendor")} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-md hover:bg-blue-700 transition-all">＋ Add First Vendor</button>
                      }
                    </td>
                  </tr>
                ) : (
                  pageData.map((v, idx) => {
                    const tc = TYPE_CONFIG[v.type] || TYPE_CONFIG.Hotel;
                    const sc = STATUS_CONFIG[v.status] || STATUS_CONFIG.INACTIVE;
                    const pc = PAY_CONFIG[v.payStatus] || PAY_CONFIG.UNPAID;
                    const payPct = v.totalBusiness > 0 ? Math.round(v.totalPaid/v.totalBusiness*100) : 0;
                    return (
                      <tr key={v.id}
                        className="group transition-all duration-150 hover:bg-blue-50/30 hover:shadow-[inset_3px_0_0_#2563eb]"
                        style={{ animation:"fadeUp .35s ease both", animationDelay:`${idx*25}ms` }}>
                        {/* Vendor */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${avatarGrad(v)} flex items-center justify-center text-white text-xs font-extrabold flex-shrink-0 shadow-sm`}>
                              {initials(v.name)}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-bold text-slate-800 leading-tight">{v.name}</p>
                                {v.verified && <MdVerified className="w-3.5 h-3.5 text-blue-500 flex-shrink-0"/>}
                              </div>
                              <p className="text-xs font-bold text-blue-600">{v.code}</p>
                            </div>
                          </div>
                        </td>
                        {/* Type */}
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${tc.border} ${tc.bg} ${tc.text}`}>
                            <tc.icon className="w-2.5 h-2.5"/> {v.type}
                          </span>
                        </td>
                        {/* Contact */}
                        <td className="px-4 py-3.5">
                          <p className="text-xs font-semibold text-slate-700">{v.contact}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{v.phone}</p>
                          <p className="text-xs text-slate-400 truncate max-w-[120px]">
                            {[v.city, v.state].filter(Boolean).join(", ")}
                          </p>
                        </td>
                        {/* Services */}
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {v.services?.slice(0,2).map(s => (
                              <span key={s} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{s}</span>
                            ))}
                            {v.services?.length > 2 && <span className="text-[10px] text-slate-400">+{v.services.length-2}</span>}
                          </div>
                        </td>
                        {/* Performance */}
                        <td className="px-4 py-3.5">
                          <StarRating rating={v.rating || 0}/>
                          <p className="text-xs text-slate-400 mt-0.5">{v.bookings || 0} bookings</p>
                        </td>
                        {/* Total Business */}
                        <td className="px-4 py-3.5">
                          <p className="text-sm font-extrabold text-slate-800">{fmtINR(v.totalBusiness || 0)}</p>
                          <p className="text-xs text-slate-400">Joined {fmtDate(v.joinDate)}</p>
                        </td>
                        {/* Paid + mini bar */}
                        <td className="px-4 py-3.5">
                          <p className="text-sm font-bold text-green-700">{fmtINR(v.totalPaid || 0)}</p>
                          <div className="w-full h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                            <div className={`h-full rounded-full ${payPct===100?"bg-green-500":payPct>0?"bg-blue-400":"bg-slate-200"}`}
                              style={{ width:`${payPct}%` }}/>
                          </div>
                        </td>
                        {/* Outstanding */}
                        <td className="px-4 py-3.5">
                          <p className={`text-sm font-bold ${(v.outstanding||0)>0?"text-amber-600":"text-slate-400"}`}>
                            {fmtINR(v.outstanding || 0)}
                          </p>
                        </td>
                        {/* Pay Status */}
                        <td className="px-4 py-3.5">
                          <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full ${pc.bg} ${pc.text}`}>
                            {enumLabel(v.payStatus)}
                          </span>
                        </td>
                        {/* Status */}
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 text-[10px] font-extrabold px-2.5 py-1 rounded-full ${sc.bg} ${sc.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}/>{enumLabel(v.status)}
                          </span>
                        </td>
                        {/* ── Actions — buttons fade in on row hover ── */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity duration-150">
                            {/* View */}
                            <button onClick={() => navigate(`/VendorDetails/${v.id}`)} title="View"
                              className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition-all border border-blue-100">
                              <FiEye className="w-3.5 h-3.5"/>
                            </button>
                            {/* Edit → navigate to /EditVendor/:id */}
                            <button onClick={() => handleNavigateEdit(v.id)} title="Edit"
                              className="w-8 h-8 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 flex items-center justify-center transition-all border border-indigo-100">
                              <FiEdit2 className="w-3.5 h-3.5"/>
                            </button>
                            {/* WhatsApp */}
                            <a href={`https://wa.me/${(v.phone||"").replace(/\D/g,"")}`}
                              target="_blank" rel="noreferrer" title="WhatsApp"
                              className="w-8 h-8 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 flex items-center justify-center transition-all border border-green-100">
                              <FaWhatsapp className="w-3.5 h-3.5"/>
                            </a>
                            {/* Delete */}
                            <button onClick={() => setDeleteV(v)} title="Delete"
                              className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 flex items-center justify-center transition-all border border-red-100">
                              <FiTrash2 className="w-3.5 h-3.5"/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ── MOBILE CARDS ── */}
          <div className="lg:hidden p-4 space-y-3">
            {loading ? (
              [...Array(3)].map((_,i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3 animate-pulse">
                  {[...Array(4)].map((_,j) => <div key={j} className="h-4 rounded-lg bg-slate-200"/>)}
                </div>
              ))
            ) : pageData.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-5xl mb-3">🤝</div>
                <p className="text-base font-extrabold text-slate-600">No Vendors Found</p>
              </div>
            ) : (
              pageData.map((v, idx) => (
                <MobileVendorCard key={v.id} v={v} idx={idx}
                  onView={setView}
                  onNavigateEdit={handleNavigateEdit}
                  onDelete={setDeleteV}/>
              ))
            )}
          </div>

          {/* ── PAGINATION ── */}
          {filtered.length > 0 && (
            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/60
              flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-slate-400 font-medium">
                Showing{" "}
                <span className="font-bold text-slate-600">{(page-1)*PER+1}</span>–
                <span className="font-bold text-slate-600">{Math.min(page*PER,filtered.length)}</span>
                {" "}of{" "}
                <span className="font-bold text-slate-600">{filtered.length}</span> vendors
              </p>
              <div className="flex items-center gap-1.5">
                {[["«",()=>setPage(1)],["‹",()=>setPage(p=>Math.max(1,p-1))]].map(([l,fn]) => (
                  <button key={l} disabled={page===1} onClick={fn}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500
                      hover:border-blue-300 hover:text-blue-600 text-xs font-bold transition-all
                      disabled:opacity-40 disabled:cursor-not-allowed">
                    {l}
                  </button>
                ))}
                {Array.from({length:totalPages},(_,i)=>i+1)
                  .filter(p=>p===1||p===totalPages||Math.abs(p-page)<=1)
                  .reduce((acc,p,i,arr)=>{ if(i>0&&p-arr[i-1]>1) acc.push("…"); acc.push(p); return acc; },[])
                  .map((p,i) =>
                    typeof p==="string"
                      ? <span key={`e${i}`} className="w-8 text-center text-xs text-slate-400">…</span>
                      : <button key={p} onClick={()=>setPage(p)}
                          className={`w-8 h-8 rounded-lg text-xs font-bold transition-all border
                            ${page===p?"bg-blue-600 border-blue-600 text-white shadow-sm":"bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600"}`}>
                          {p}
                        </button>
                  )}
                {[["›",()=>setPage(p=>Math.min(totalPages,p+1))],["»",()=>setPage(totalPages)]].map(([l,fn]) => (
                  <button key={l} disabled={page===totalPages} onClick={fn}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500
                      hover:border-blue-300 hover:text-blue-600 text-xs font-bold transition-all
                      disabled:opacity-40 disabled:cursor-not-allowed">
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}