// src/features/bookings/pages/BookingServices.jsx
// Route: /BookingServices/:id
// ─────────────────────────────────────────────────────────────────────────────
// The OPERATIONAL breakdown of a booking — what the traveller actually gets, who
// supplies it, what it costs us and what we bill for it. (Money IN from the
// customer is /BookingPayments/:id; agency cash-out is the Expense Ledger. None
// of the three derives from another — see BookingExpense's javadoc.)
//
// Rebuilt around the numbers instead of around the form:
//
//   • a KPI strip reads the whole booking at a glance, and the two exception
//     cards (awaiting confirmation / no vendor) are BUTTONS that filter the
//     table — the count and the worklist are the same click.
//   • the table is the page. The add/edit form moved into a right-side drawer,
//     so it no longer squeezes ten columns into half the width.
//   • search + status/type filters, sortable money columns, a totals footer,
//     and a real card layout on phones rather than a 900px sideways scroll.
//
// Two things the old screen showed that were not true, corrected here:
//   • "Balance Due" was cost − vendorCost, i.e. the MARGIN, and nothing on this
//     screen has ever been a balance. Renamed and coloured by sign.
//   • the detail modal's profit fell back to the WHOLE booking's customerAmount
//     whenever a line's own cost was 0, so a ₹0 service reported the booking's
//     entire value as its profit. It now reads the line, and only the line.
//   • the per-row "Payment History" modal is gone: no per-service payment data
//     exists on the API (BookingPaymentResponse has no service link), so it
//     could only ever render its own empty state. The header links to the real
//     payment ledger instead, which is what that modal's text told you to do.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import bookingService from "../api/bookingService";
import { useToast } from "@shared/ui/toast";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { downloadBlob, hydrateBlobError } from "@shared/lib/download";
import { hasPermission, P } from "@shared/lib/access";
import {
  FiPlus, FiX, FiArrowLeft, FiRefreshCw, FiSearch, FiPackage,
  FiEdit2, FiTrash2, FiEye, FiDownload, FiCreditCard, FiLayers,
  FiAlertTriangle, FiUserX, FiTrendingUp, FiChevronUp, FiChevronDown,
} from "react-icons/fi";
import {
  FaWhatsapp, FaHotel, FaPlane, FaCar, FaShip, FaPassport,
  FaUmbrellaBeach, FaShieldAlt,
} from "react-icons/fa";

/* ─── CONSTANTS ──────────────────────────────────────────────── */
const SERVICE_TYPES = ["Hotel","Flight","Transport","Vehicle","Cruise","Sightseeing","Visa","Insurance","Passport","Other"];

// Icon + chip tint per service type. One map, so the table chip, the drawer and
// the mobile cards can never drift into three different colours for "Hotel".
const SVC_META = {
  Hotel:       { Icon: FaHotel,         chip: "bg-blue-50 text-blue-700 border-blue-200" },
  Flight:      { Icon: FaPlane,         chip: "bg-sky-50 text-sky-700 border-sky-200" },
  Transport:   { Icon: FaCar,           chip: "bg-teal-50 text-teal-700 border-teal-200" },
  Vehicle:     { Icon: FaCar,           chip: "bg-teal-50 text-teal-700 border-teal-200" },
  Cruise:      { Icon: FaShip,          chip: "bg-purple-50 text-purple-700 border-purple-200" },
  Sightseeing: { Icon: FaUmbrellaBeach, chip: "bg-green-50 text-green-700 border-green-200" },
  Visa:        { Icon: FaPassport,      chip: "bg-amber-50 text-amber-700 border-amber-200" },
  Insurance:   { Icon: FaShieldAlt,     chip: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  Passport:    { Icon: FaPassport,      chip: "bg-rose-50 text-rose-700 border-rose-200" },
  Other:       { Icon: FiPackage,       chip: "bg-slate-50 text-slate-600 border-slate-200" },
};
const svcMeta = (t) => SVC_META[t] || SVC_META.Other;

// Backend enum is PENDING / CONFIRMED / CANCELLED (ServiceItemStatus); the UI
// shows Title case and bookingService.toEnum uppercases on the way out.
const STATUS_META = {
  PENDING:   { label:"Pending",   chip:"bg-amber-50 text-amber-700 border-amber-200",       dot:"bg-amber-500"   },
  CONFIRMED: { label:"Confirmed", chip:"bg-emerald-50 text-emerald-700 border-emerald-200", dot:"bg-emerald-500" },
  CANCELLED: { label:"Cancelled", chip:"bg-rose-50 text-rose-600 border-rose-200",          dot:"bg-rose-500"    },
};
const statusMeta = (s) => STATUS_META[String(s || "PENDING").toUpperCase()] || STATUS_META.PENDING;
const SERVICE_STATUS = ["Pending","Confirmed","Cancelled"];

/* ─── HELPERS ────────────────────────────────────────────────── */
const fmtINR = n => n != null
  ? "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits:2, maximumFractionDigits:2 })
  : "₹0.00";
// Compact form for the KPI tiles, where ₹12,45,000.00 would wrap in a 200px card.
const fmtShort = n => {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}₹${(abs/1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs/1e5).toFixed(2)} L`;
  return sign + "₹" + abs.toLocaleString("en-IN", { maximumFractionDigits:0 });
};
const fmtDate = d => d
  ? new Date(d).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })
  : "—";
const fmtDateShort = d => d
  ? new Date(d).toLocaleDateString("en-IN", { day:"2-digit", month:"short" })
  : "—";
const titleCase = s => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "—";

/** Normalize a BookingServiceItemResponse DTO into the shape the table/drawer consume. */
function mapService(s, i) {
  const cost       = Number(s.cost) || 0;
  const vendorCost = Number(s.vendorCost) || 0;
  return {
    id: s.publicId,
    publicId: s.publicId,
    serviceType: s.serviceType || "Other",
    title: s.title || "",
    description: s.description || "",
    details: s.description || s.title || "",
    status: String(s.status || "PENDING").toUpperCase(),
    cost,
    vendorCost,
    margin: cost - vendorCost,
    vendorPublicId: s.vendorPublicId || "",
    vendorName: s.vendorName || null,
    confirmationNumber: s.confirmationNumber || "",
    notes: s.notes || "",
    serviceDate: s.serviceDate || null,
    endDate: s.endDate || null,
    sequence: i + 1,
    createdAt: s.createdAt,
  };
}

/* ─── KPI TILE ───────────────────────────────────────────────── */
// `onClick` turns a tile into a filter for the table below. A tile that filters
// renders as a real <button> so it is tabbable and announces its pressed state —
// the exception counts are a worklist, not decoration.
const KPI_TONE = {
  slate:   { icon:"bg-slate-100 text-slate-600",     value:"text-slate-800",   ring:"ring-slate-300"   },
  blue:    { icon:"bg-blue-50 text-blue-600",        value:"text-slate-800",   ring:"ring-blue-300"    },
  amber:   { icon:"bg-amber-50 text-amber-600",      value:"text-slate-800",   ring:"ring-amber-300"   },
  emerald: { icon:"bg-emerald-50 text-emerald-600",  value:"text-emerald-700", ring:"ring-emerald-300" },
  rose:    { icon:"bg-rose-50 text-rose-600",        value:"text-rose-700",    ring:"ring-rose-300"    },
  violet:  { icon:"bg-violet-50 text-violet-600",    value:"text-slate-800",   ring:"ring-violet-300"  },
};

function Kpi({ label, value, sub, Icon, tone = "slate", onClick, active, title, delay = 0 }) {
  const t = KPI_TONE[tone] || KPI_TONE.slate;
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      title={title || label}
      aria-pressed={onClick ? !!active : undefined}
      className={`w-full text-left bg-white/80 backdrop-blur-md rounded-2xl border p-3.5 shadow-sm transition-all ${
        active ? `border-transparent ring-2 ${t.ring}` : "border-slate-200/60"
      } ${onClick ? "hover:shadow-md hover:-translate-y-0.5 cursor-pointer" : ""}`}
      style={{ animation:`fadeUp .4s ease both ${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-slate-400 truncate">{label}</p>
        <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${t.icon}`}>
          <Icon className="w-3.5 h-3.5" />
        </span>
      </div>
      <p className={`mt-1.5 text-[21px] leading-none font-extrabold tabular-nums ${t.value}`}>{value}</p>
      <p className="mt-1.5 text-[11px] font-semibold text-slate-400 truncate">{sub}</p>
    </Tag>
  );
}

/* ─── SERVICE DETAILS MODAL ───────────────────────────────────── */
function ServiceDetailModal({ svc, onClose }) {
  useEffect(() => {
    const onKey = e => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!svc) return null;
  const st = statusMeta(svc.status);
  const { Icon } = svcMeta(svc.serviceType);
  // This LINE's own economics. The old version fell back to the booking's whole
  // customerAmount when cost was 0, which reported the entire booking as one
  // service's profit.
  const base    = svc.cost;
  const profit  = svc.margin;
  const marginPct = base > 0 ? ((profit / base) * 100).toFixed(1) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg z-10 overflow-hidden" style={{animation:"popIn .22s ease both"}}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`w-9 h-9 rounded-xl border flex items-center justify-center ${svcMeta(svc.serviceType).chip}`}>
              <Icon className="w-4 h-4"/>
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-slate-800 truncate">{svc.title || svc.serviceType}</h3>
              <p className="text-[11px] font-semibold text-slate-400">{svc.serviceType}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="shrink-0 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center"><FiX className="w-4 h-4"/></button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {[
              ["Status", <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full border ${st.chip}`}><span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}/>{st.label}</span>],
              ["Vendor", svc.vendorName || "Unassigned"],
              ["Confirmation #", svc.confirmationNumber || "—"],
              ["Service Date", fmtDate(svc.serviceDate)],
              ["End Date", fmtDate(svc.endDate)],
              ["Added", fmtDate(svc.createdAt)],
            ].map(([l,v]) => (
              <div key={l}>
                <p className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">{l}</p>
                <p className="text-sm font-bold text-slate-700 mt-0.5">{v}</p>
              </div>
            ))}
          </div>

          {svc.description && (
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400 mb-1">Service Details</p>
              <p className="text-sm text-slate-700 bg-slate-50 rounded-xl p-3 border border-slate-100 whitespace-pre-wrap">{svc.description}</p>
            </div>
          )}
          {svc.notes && (
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400 mb-1">Notes</p>
              <p className="text-sm text-slate-700 bg-slate-50 rounded-xl p-3 border border-slate-100 whitespace-pre-wrap">{svc.notes}</p>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
              <p className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-slate-500">Line economics</p>
            </div>
            <div className="divide-y divide-slate-100">
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm text-slate-500 font-medium">Service amount</span>
                <span className="text-sm font-bold text-slate-700 tabular-nums">{fmtINR(base)}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm text-slate-500 font-medium">Vendor cost</span>
                <span className="text-sm font-bold text-slate-700 tabular-nums">− {fmtINR(svc.vendorCost)}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50/60">
                <span className="text-sm font-extrabold text-slate-700">Margin</span>
                <span className={`text-sm font-extrabold tabular-nums ${profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {fmtINR(profit)}{marginPct != null && <span className="text-slate-400 font-bold"> · {marginPct}%</span>}
                </span>
              </div>
            </div>
            {base === 0 && (
              <p className="px-4 py-2 text-[11px] font-semibold text-amber-600 bg-amber-50 border-t border-amber-100">
                No service amount set on this line — margin is shown against ₹0, not against the booking total.
              </p>
            )}
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-slate-100 flex justify-end">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold transition-all">Close</button>
        </div>
      </div>
    </div>
  );
}

/* ─── ADD/EDIT SERVICE DRAWER ─────────────────────────────────── */
function ServiceDrawer({ booking, editSvc, onClose, onSaved, showToast }) {
  const isEdit = !!editSvc;
  const [form, setForm] = useState({
    serviceType: editSvc?.serviceType || "",
    title:       editSvc?.title || "",
    description: editSvc?.description || "",
    status:      statusMeta(editSvc?.status).label,
    cost:        editSvc?.cost != null ? String(editSvc.cost) : "0",
    vendorCost:  editSvc?.vendorCost != null ? String(editSvc.vendorCost) : "0",
    serviceDate: editSvc?.serviceDate ? String(editSvc.serviceDate).slice(0,10) : "",
    endDate:     editSvc?.endDate ? String(editSvc.endDate).slice(0,10) : "",
    confirmationNumber: editSvc?.confirmationNumber || "",
    notes:       editSvc?.notes || "",
    vendorPublicId: editSvc?.vendorPublicId || "",
  });
  const [vendors, setVendors] = useState([]);
  const [saving, setSaving]   = useState(false);
  const [errors, setErrors]   = useState({});
  const firstFieldRef = useRef(null);

  const set = (k,v) => { setForm(p=>({...p,[k]:v})); setErrors(p=>({...p,[k]:""})); };

  // Load vendor dropdown once when the drawer opens.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await bookingService.getVendors();
        const list = res.data?.data?.content ?? res.data?.data ?? res.data ?? [];
        if (alive) setVendors(Array.isArray(list) ? list : []);
      } catch (error) {
        if (isAlreadyReported(error)) return;
        // Non-fatal — the rest of the form still saves without the vendor list.
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    firstFieldRef.current?.focus();
    const onKey = e => { if (e.key === "Escape" && !saving) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const validate = () => {
    const e = {};
    if (!form.serviceType) e.serviceType = "Select a service type";
    if (!form.title.trim()) e.title = "Enter a title";
    if (form.endDate && form.serviceDate && form.endDate < form.serviceDate) e.endDate = "End date is before the service date";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    // Empty strings, not nulls: the backend reads null as "leave unchanged", so a
    // note or a confirmation number cleared in the form would silently come back.
    const body = {
      serviceType: form.serviceType,
      title: form.title.trim(),
      description: form.description.trim(),
      serviceDate: form.serviceDate || null,
      endDate: form.endDate || null,
      status: form.status,
      cost: Number(form.cost) || 0,
      vendorCost: Number(form.vendorCost) || 0,
      confirmationNumber: form.confirmationNumber.trim(),
      notes: form.notes.trim(),
    };
    try {
      let serviceId = editSvc?.publicId;
      if (isEdit) {
        await bookingService.updateService(booking.id, serviceId, body);
      } else {
        const res = await bookingService.addService(booking.id, body);
        serviceId = res.data?.data?.publicId ?? res.data?.publicId;
      }
      // Vendor assignment is its own endpoint, not part of the service body.
      if (form.vendorPublicId && serviceId && form.vendorPublicId !== (editSvc?.vendorPublicId || "")) {
        await bookingService.assignVendor(booking.id, serviceId, {
          vendorPublicId: form.vendorPublicId,
          vendorCost: Number(form.vendorCost) || 0,
          confirmationNumber: form.confirmationNumber.trim() || null,
        });
      }
      showToast(isEdit ? "Service updated." : "Service added.", "success");
      onSaved();
      onClose();
    } catch (error) {
      if (isAlreadyReported(error)) { setSaving(false); return; }
      showToast(getErrorMessage(error, "Couldn't save the service."), "error");
    } finally { setSaving(false); }
  };

  const inputCls = err =>
    `w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium outline-none transition-all ${
      err ? "border-red-300 bg-red-50 focus:ring-2 focus:ring-red-50"
          : "border-slate-200 bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 hover:border-slate-300"}`;
  const selectCls = err => inputCls(err) + " appearance-none cursor-pointer pr-9";
  const labelCls = "text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 block";
  const err = k => errors[k] && <p className="text-[11px] text-red-500 font-semibold mt-1">{errors[k]}</p>;

  const liveMargin = (Number(form.cost) || 0) - (Number(form.vendorCost) || 0);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={isEdit ? "Edit service" : "Add service"}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={()=>!saving && onClose()}/>
      <aside
        className="absolute right-0 top-0 h-full w-full sm:max-w-[440px] bg-white shadow-2xl flex flex-col"
        style={{ animation:"slideIn .25s cubic-bezier(.16,1,.3,1) both" }}
      >
        {/* Header */}
        <div className="shrink-0 bg-gradient-to-r from-blue-600 to-indigo-500 px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-white">{isEdit ? "Edit Service" : "Add New Service"}</h3>
            <p className="text-[11px] font-semibold text-white/70 mt-0.5">{booking?.code} · {booking?.customer}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center"><FiX className="w-4 h-4"/></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className={labelCls}>Service Type <span className="text-red-400">*</span></label>
            {/* A ten-item picker as chips: one tap, no dropdown, and the icon set
                doubles as the legend for the type column in the table. */}
            <div className="flex flex-wrap gap-1.5">
              {SERVICE_TYPES.map(t => {
                const { Icon, chip } = svcMeta(t);
                const on = form.serviceType === t;
                return (
                  <button
                    key={t} type="button" onClick={()=>set("serviceType", t)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11.5px] font-bold transition-all ${
                      on ? `${chip} ring-2 ring-blue-200` : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"}`}
                  >
                    <Icon className="w-3 h-3"/> {t}
                  </button>
                );
              })}
            </div>
            {err("serviceType")}
          </div>

          <div>
            <label className={labelCls}>Title <span className="text-red-400">*</span></label>
            <input ref={firstFieldRef} value={form.title} onChange={e=>set("title",e.target.value)} placeholder="e.g. 3 nights at Taj Palace" className={inputCls(errors.title)}/>
            {err("title")}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Service Amount</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-bold">₹</span>
                <input type="number" step="0.01" min="0" inputMode="decimal" value={form.cost} onChange={e=>set("cost",e.target.value)} className={inputCls(false)+" pl-8 tabular-nums"}/>
              </div>
            </div>
            <div>
              <label className={labelCls}>Vendor Cost</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-bold">₹</span>
                <input type="number" step="0.01" min="0" inputMode="decimal" value={form.vendorCost} onChange={e=>set("vendorCost",e.target.value)} className={inputCls(false)+" pl-8 tabular-nums"}/>
              </div>
            </div>
          </div>

          {/* Live margin — the one number that decides whether this line is worth
              booking, shown while it is being typed rather than after saving. */}
          <div className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 ${
            liveMargin >= 0 ? "bg-emerald-50/60 border-emerald-200" : "bg-rose-50/60 border-rose-200"}`}>
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Margin on this line</span>
            <span className={`text-sm font-extrabold tabular-nums ${liveMargin >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{fmtINR(liveMargin)}</span>
          </div>

          <div>
            <label className={labelCls}>Vendor</label>
            <div className="relative">
              <select value={form.vendorPublicId} onChange={e=>set("vendorPublicId",e.target.value)} className={selectCls(false)}>
                <option value="">Select vendor (optional)</option>
                {vendors.map(v => <option key={v.publicId} value={v.publicId}>{v.vendorName ?? v.name}</option>)}
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none">▼</span>
            </div>
            {isEdit && editSvc?.vendorName && (
              <p className="text-[11px] font-semibold text-slate-400 mt-1">
                Currently {editSvc.vendorName}. A vendor can be changed here, but not removed — delete the line to undo an assignment.
              </p>
            )}
          </div>

          <div>
            <label className={labelCls}>Confirmation # / PNR</label>
            <input value={form.confirmationNumber} onChange={e=>set("confirmationNumber",e.target.value)} placeholder="Vendor confirmation or PNR" className={inputCls(false)}/>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Service Date</label>
              <input type="date" value={form.serviceDate} onChange={e=>set("serviceDate",e.target.value)} className={inputCls(false)}/>
            </div>
            <div>
              <label className={labelCls}>End Date</label>
              <input type="date" value={form.endDate} onChange={e=>set("endDate",e.target.value)} className={inputCls(errors.endDate)}/>
              {err("endDate")}
            </div>
          </div>

          <div>
            <label className={labelCls}>Status</label>
            <div className="flex gap-1.5">
              {SERVICE_STATUS.map(s => {
                const meta = statusMeta(s);
                const on = form.status === s;
                return (
                  <button key={s} type="button" onClick={()=>set("status", s)}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl border text-[12px] font-bold transition-all ${
                      on ? meta.chip + " ring-2 ring-blue-100" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${on ? meta.dot : "bg-slate-300"}`}/>{s}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className={labelCls}>Service Details</label>
            <textarea value={form.description} onChange={e=>set("description",e.target.value)} rows={3} placeholder="Inclusions, requirements, special instructions…" className={inputCls(false)+" resize-none"}/>
          </div>

          <div>
            <label className={labelCls}>Internal Notes</label>
            <textarea value={form.notes} onChange={e=>set("notes",e.target.value)} rows={2} placeholder="Not shown on the voucher" className={inputCls(false)+" resize-none"}/>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-100 p-4 flex items-center gap-2.5 bg-white">
          <button onClick={onClose} disabled={saving} className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm font-bold hover:bg-slate-50 transition-all disabled:opacity-60">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-700 hover:to-indigo-600 text-white font-extrabold text-sm shadow-md shadow-blue-200 transition-all disabled:opacity-60">
            {saving
              ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/>{isEdit ? "Updating…" : "Adding…"}</>
              : <><FiPlus className="w-4 h-4"/>{isEdit ? "Update Service" : "Add Service"}</>}
          </button>
        </div>
      </aside>
    </div>
  );
}

/* ─── SORTABLE HEADER CELL ───────────────────────────────────── */
function Th({ label, sortKey, sort, onSort, align = "left", className = "" }) {
  const active = sort?.key === sortKey;
  // The alignment has to live on the <th> as well as the button: the button is an
  // inline element, so a right-aligned column with only `justify-end` on it still
  // sits flush left inside the cell.
  const alignCls = align === "right" ? "text-right" : "text-left";
  if (!sortKey) {
    return <th className={`px-3 py-2.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider whitespace-nowrap ${alignCls} ${className}`}>{label}</th>;
  }
  return (
    <th className={`px-3 py-2.5 whitespace-nowrap ${alignCls} ${className}`}>
      <button type="button" onClick={()=>onSort(sortKey)}
        className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider transition-colors ${active ? "text-blue-600" : "text-slate-400 hover:text-slate-600"}`}>
        {label}
        {active
          ? (sort.dir === "asc" ? <FiChevronUp className="w-3 h-3"/> : <FiChevronDown className="w-3 h-3"/>)
          : <FiChevronDown className="w-3 h-3 opacity-0 group-hover/head:opacity-40"/>}
      </button>
    </th>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */
export default function BookingServices() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const canUpdate = hasPermission(P.BOOKING_UPDATE);
  const canDelete = hasPermission(P.BOOKING_DELETE);

  const [booking,     setBooking]     = useState(null);
  const [services,    setServices]    = useState([]);
  const [loading,     setLoading]     = useState(true);   // first paint only
  const [refreshing,  setRefreshing]  = useState(false);  // background reload keeps the page up
  const [drawer,      setDrawer]      = useState(null);   // null | {mode:'new'} | {mode:'edit', svc}
  const [detailSvc,   setDetailSvc]   = useState(null);
  const [deleting,    setDeleting]    = useState(null);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [downloading, setDownloading] = useState(null);
  const [selected,    setSelected]    = useState(() => new Set());

  /* Filters + sort — all client-side; a booking's service list is a handful of
     rows, so there is no server-side filtering to reach for here. */
  const [q,          setQ]          = useState("");
  const [statusFltr, setStatusFltr] = useState("ALL");
  const [typeFltr,   setTypeFltr]   = useState("ALL");
  const [noVendor,   setNoVendor]   = useState(false);
  const [sort,       setSort]       = useState({ key:"seq", dir:"asc" });
  const searchRef = useRef(null);

  const toggleSort = (key) =>
    setSort(p => p.key === key ? { key, dir: p.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "seq" || key === "date" ? "asc" : "desc" });

  const fetchData = useCallback(async (background = false) => {
    if (!id) return;
    if (background) setRefreshing(true); else setLoading(true);
    try {
      const [bRes, sRes] = await Promise.all([
        bookingService.getById(id),
        bookingService.getServices(id),
      ]);
      const b = bRes.data?.data ?? bRes.data;
      setBooking({
        id: b.publicId || b.id,
        code: b.bookingCode || b.code || "—",
        title: b.title || `${b.customerNameSnapshot || b.customerName || ""} - ${b.destinationSnapshot || b.destination || ""}`,
        customer: b.customerNameSnapshot || b.customerName || "—",
        customerAmount: Number(b.customerAmount) || 0,
        vendorCost: Number(b.vendorCost) || 0,
        gst: Number(b.gst) || 0,
        tcs: Number(b.tcs) || 0,
        totalPayable: Number(b.totalPayable) || 0,
        status: (b.status || "PENDING").toUpperCase(),
        travelDate: b.travelDate,
        travelEndDate: b.travelEndDate || b.returnDate,
      });
      const rawSvcs = sRes.data?.data ?? sRes.data ?? [];
      setServices((Array.isArray(rawSvcs) ? rawSvcs : []).map(mapService));
    } catch (error) {
      if (isAlreadyReported(error)) return;
      showToast(getErrorMessage(error, "Couldn't load booking services."), "error");
    } finally { setLoading(false); setRefreshing(false); }
  }, [id, showToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // "/" focuses search — this is a list screen people scan, not a form.
  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.isContentEditable;
      if (e.key === "/" && !typing) { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ── Derived: KPI numbers ── */
  const stats = useMemo(() => {
    const live = services.filter(s => s.status !== "CANCELLED");
    const amount = live.reduce((t,s) => t + s.cost, 0);
    const vendor = live.reduce((t,s) => t + s.vendorCost, 0);
    return {
      count: services.length,
      confirmed: services.filter(s => s.status === "CONFIRMED").length,
      pending:   services.filter(s => s.status === "PENDING").length,
      cancelled: services.filter(s => s.status === "CANCELLED").length,
      amount,
      vendor,
      margin: amount - vendor,
      marginPct: amount > 0 ? ((amount - vendor) / amount) * 100 : 0,
      withVendor: live.filter(s => s.vendorName).length,
      noVendor:   live.filter(s => !s.vendorName).length,
      // "Awaiting" = still PENDING, i.e. the vendor has not confirmed the line.
      awaiting:   services.filter(s => s.status === "PENDING").length,
      noConfirmation: live.filter(s => !s.confirmationNumber).length,
    };
  }, [services]);

  // What is on the booking but not itemised into services. Cancelled lines are
  // excluded from `amount`, so a fully cancelled service does not read as billed.
  const unallocated = (booking?.customerAmount || 0) - stats.amount;

  /* ── Derived: the visible rows ── */
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let rows = services.filter(s => {
      if (statusFltr !== "ALL" && s.status !== statusFltr) return false;
      if (typeFltr !== "ALL" && s.serviceType !== typeFltr) return false;
      if (noVendor && s.vendorName) return false;
      if (!needle) return true;
      return [s.title, s.description, s.serviceType, s.vendorName, s.confirmationNumber, s.notes]
        .some(v => String(v || "").toLowerCase().includes(needle));
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    const val = (s) => ({
      seq: s.sequence,
      date: s.serviceDate ? new Date(s.serviceDate).getTime() : Number.POSITIVE_INFINITY, // undated sinks
      cost: s.cost, vendor: s.vendorCost, margin: s.margin,
      type: s.serviceType, status: s.status,
    }[sort.key]);
    rows = [...rows].sort((a,b) => {
      const av = val(a), bv = val(b);
      if (typeof av === "string") return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
    return rows;
  }, [services, q, statusFltr, typeFltr, noVendor, sort]);

  const filtered = q.trim() !== "" || statusFltr !== "ALL" || typeFltr !== "ALL" || noVendor;
  const clearFilters = () => { setQ(""); setStatusFltr("ALL"); setTypeFltr("ALL"); setNoVendor(false); };

  // Totals for the footer follow the FILTER, not the whole list — a footer that
  // ignored the filter would contradict the rows printed directly above it.
  const visibleTotals = useMemo(() => visible.reduce(
    (t,s) => ({ cost: t.cost + s.cost, vendor: t.vendor + s.vendorCost, margin: t.margin + s.margin }),
    { cost:0, vendor:0, margin:0 },
  ), [visible]);

  /* ── Selection ── */
  const visibleIds = visible.map(s => s.id);
  const selectedVisible = visibleIds.filter(i => selected.has(i));
  const allSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;
  const toggleAll = () => setSelected(prev => {
    const next = new Set(prev);
    if (allSelected) visibleIds.forEach(i => next.delete(i));
    else visibleIds.forEach(i => next.add(i));
    return next;
  });
  const toggleOne = (rowId) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(rowId)) next.delete(rowId); else next.add(rowId);
    return next;
  });

  /* ── Mutations ── */
  const handleDelete = async (svcId) => {
    try {
      await bookingService.deleteService(booking.id, svcId);
      showToast("Service removed.", "success");
      setSelected(prev => { const n = new Set(prev); n.delete(svcId); return n; });
      fetchData(true);
    } catch (error) {
      if (!isAlreadyReported(error)) showToast(getErrorMessage(error, "Couldn't remove the service."), "error");
    }
    setDeleting(null);
  };

  const handleBulkDelete = async () => {
    const ids = selectedVisible;
    setBulkConfirm(false);
    // allSettled, not all: one rejected line must not hide the ones that worked.
    const results = await Promise.allSettled(ids.map(sid => bookingService.deleteService(booking.id, sid)));
    const failed = results.filter(r => r.status === "rejected").length;
    if (failed === 0) showToast(`${ids.length} service${ids.length > 1 ? "s" : ""} removed.`, "success");
    else showToast(`${ids.length - failed} removed, ${failed} could not be deleted.`, failed === ids.length ? "error" : "info");
    setSelected(new Set());
    fetchData(true);
  };

  const downloadVoucher = async (svc) => {
    setDownloading(svc.publicId);
    try {
      const res = await bookingService.getServiceVoucher(booking.id, svc.publicId);
      const safeTitle = (svc.title || svc.serviceType || "service").replace(/[^\w-]+/g,"_").slice(0,40);
      downloadBlob(res.data, `Voucher-${booking?.code || "booking"}-${safeTitle}.pdf`);
      showToast("Voucher downloaded.", "success");
    } catch (error) {
      if (isAlreadyReported(error)) return;
      await hydrateBlobError(error);
      showToast(getErrorMessage(error, "Couldn't generate the voucher."), "error");
    } finally { setDownloading(null); }
  };

  /* ── Loading skeleton ── */
  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-slate-100 p-6" style={{fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif"}}>
      <div className="max-w-screen-2xl mx-auto space-y-5 animate-pulse">
        <div className="h-14 bg-white/70 rounded-2xl"/>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {Array.from({length:6}).map((_,i)=><div key={i} className="h-[104px] bg-white/70 rounded-2xl"/>)}
        </div>
        <div className="h-72 bg-white/70 rounded-2xl"/>
      </div>
    </div>
  );

  const bookingStatusChip = booking?.status === "CONFIRMED"
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : booking?.status === "CANCELLED" ? "bg-rose-50 text-rose-600 border-rose-200"
    : "bg-amber-50 text-amber-700 border-amber-200";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-slate-100" style={{fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes popIn{from{transform:scale(.94);opacity:0}to{transform:scale(1);opacity:1}}
        @keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
        select{-webkit-appearance:none;appearance:none}
      `}</style>

      {detailSvc && <ServiceDetailModal svc={detailSvc} onClose={()=>setDetailSvc(null)}/>}
      {drawer && canUpdate && (
        <ServiceDrawer
          booking={booking}
          editSvc={drawer.mode === "edit" ? drawer.svc : null}
          onClose={()=>setDrawer(null)}
          onSaved={()=>fetchData(true)}
          showToast={showToast}
        />
      )}

      {/* ══ PAGE HEADER ══ */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/60">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={()=>navigate(-1)} aria-label="Back" className="shrink-0 w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-all"><FiArrowLeft className="w-4 h-4 text-slate-600"/></button>
            <div className="min-w-0">
              <h1 className="text-lg font-extrabold text-slate-800 leading-tight">Booking Services</h1>
              <p className="text-[11px] text-slate-400 mt-0.5 hidden sm:block font-medium">
                <span className="cursor-pointer hover:text-blue-600" onClick={()=>navigate("/")}>Home</span>
                <span className="mx-1 text-slate-300">/</span>
                <span className="cursor-pointer hover:text-blue-600" onClick={()=>navigate("/Allbookings")}>Bookings</span>
                <span className="mx-1 text-slate-300">/</span>
                <span className="cursor-pointer hover:text-blue-600" onClick={()=>navigate(`/BookingDetails/${id}`)}>View Booking</span>
                <span className="mx-1 text-slate-300">/</span>
                <span className="text-blue-600 font-bold">Services</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={()=>navigate(`/BookingPayments/${id}`)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-blue-600 hover:border-blue-200 text-xs font-bold transition-all">
              <FiCreditCard className="w-3.5 h-3.5"/> Payments
            </button>
            <button onClick={()=>fetchData(true)} disabled={refreshing}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-blue-600 hover:border-blue-200 text-xs font-bold transition-all disabled:opacity-60">
              <FiRefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}/> Refresh
            </button>
            {canUpdate && (
              <button onClick={()=>setDrawer({ mode:"new" })}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-700 hover:to-indigo-600 text-white text-xs font-extrabold shadow-md shadow-blue-200 transition-all">
                <FiPlus className="w-3.5 h-3.5"/> Add Service
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5 space-y-4">

        {/* ══ KPI STRIP ══ */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <Kpi
            label="Services" tone="blue" Icon={FiLayers} delay={0}
            value={stats.count}
            sub={`${stats.confirmed} confirmed · ${stats.pending} pending${stats.cancelled ? ` · ${stats.cancelled} cancelled` : ""}`}
          />
          <Kpi
            label="Service Amount" tone="violet" Icon={FiPackage} delay={40}
            value={fmtShort(stats.amount)}
            title={fmtINR(stats.amount)}
            sub={Math.abs(unallocated) >= 1
              ? `${fmtShort(Math.abs(unallocated))} ${unallocated > 0 ? "not itemised" : "over booking value"}`
              : "matches the booking value"}
          />
          <Kpi
            label="Vendor Cost" tone="amber" Icon={FiTrendingUp} delay={80}
            value={fmtShort(stats.vendor)}
            title={fmtINR(stats.vendor)}
            sub={`${stats.withVendor} of ${stats.count - stats.cancelled} line${stats.count - stats.cancelled === 1 ? "" : "s"} assigned`}
          />
          <Kpi
            label="Margin" tone={stats.margin >= 0 ? "emerald" : "rose"} Icon={FiTrendingUp} delay={120}
            value={fmtShort(stats.margin)}
            title={fmtINR(stats.margin)}
            sub={stats.amount > 0 ? `${stats.marginPct.toFixed(1)}% of service amount` : "no service amount billed yet"}
          />
          <Kpi
            label="Awaiting" tone={stats.awaiting ? "amber" : "slate"} Icon={FiAlertTriangle} delay={160}
            value={stats.awaiting}
            sub={stats.noConfirmation ? `${stats.noConfirmation} without a confirmation #` : "all lines confirmed"}
            active={statusFltr === "PENDING"}
            onClick={()=>setStatusFltr(p => p === "PENDING" ? "ALL" : "PENDING")}
            title="Show only pending lines"
          />
          <Kpi
            label="No Vendor" tone={stats.noVendor ? "rose" : "slate"} Icon={FiUserX} delay={200}
            value={stats.noVendor}
            sub={stats.noVendor ? "nobody is supplying these" : "every line has a vendor"}
            active={noVendor}
            onClick={()=>setNoVendor(v => !v)}
            title="Show only lines with no vendor assigned"
          />
        </div>

        {/* ══ BOOKING CONTEXT STRIP ══ */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-2" style={{animation:"fadeUp .4s ease both 240ms"}}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] font-extrabold px-2 py-1 rounded-lg bg-slate-900 text-white tracking-wide">{booking?.code}</span>
            <span className="text-sm font-bold text-slate-700 truncate max-w-[260px]" title={booking?.title}>{booking?.title}</span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${bookingStatusChip}`}>{titleCase(booking?.status)}</span>
          </div>
          <div className="h-4 w-px bg-slate-200 hidden sm:block"/>
          {[
            ["Customer", booking?.customer],
            ["Travel", `${fmtDateShort(booking?.travelDate)} → ${fmtDateShort(booking?.travelEndDate)}`],
            ["Customer Amount", fmtINR(booking?.customerAmount)],
            ["Total Payable", fmtINR(booking?.totalPayable)],
            ...(booking?.gst ? [["GST", fmtINR(booking.gst)]] : []),
            ...(booking?.tcs ? [["TCS", fmtINR(booking.tcs)]] : []),
          ].map(([l,v]) => (
            <div key={l} className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{l}</p>
              <p className="text-[13px] font-bold text-slate-700 truncate tabular-nums">{v}</p>
            </div>
          ))}
        </div>

        {/* ══ TOOLBAR ══ */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
            <input
              ref={searchRef} value={q} onChange={e=>setQ(e.target.value)}
              placeholder="Search title, vendor, confirmation #…   (press /)"
              className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 placeholder-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
            />
            {q && <button onClick={()=>setQ("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><FiX className="w-4 h-4"/></button>}
          </div>

          {/* Status pills — the three the backend actually has, plus All. */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white border border-slate-200">
            {[["ALL","All"],["PENDING","Pending"],["CONFIRMED","Confirmed"],["CANCELLED","Cancelled"]].map(([v,l]) => (
              <button key={v} onClick={()=>setStatusFltr(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFltr === v ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}>
                {l}
              </button>
            ))}
          </div>

          <div className="relative">
            <select value={typeFltr} onChange={e=>setTypeFltr(e.target.value)}
              className="pl-3.5 pr-9 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 cursor-pointer focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none">
              <option value="ALL">All types</option>
              {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none">▼</span>
          </div>

          {filtered && (
            <button onClick={clearFilters} className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-500 hover:text-rose-600 hover:border-rose-200 transition-all">
              Clear filters
            </button>
          )}
          <span className="text-xs font-bold text-slate-400 ml-auto">
            {visible.length} of {services.length} service{services.length === 1 ? "" : "s"}
          </span>
        </div>

        {/* ══ BULK BAR ══ */}
        {selectedVisible.length > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-2.5" style={{animation:"fadeUp .2s ease both"}}>
            <p className="text-xs font-bold text-blue-700">{selectedVisible.length} selected</p>
            <div className="flex items-center gap-2">
              <button onClick={()=>setSelected(new Set())} className="text-xs font-bold text-slate-500 hover:text-slate-700 px-3 py-1.5">Clear</button>
              {canDelete && (bulkConfirm ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-rose-600">Delete {selectedVisible.length}?</span>
                  <button onClick={handleBulkDelete} className="text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-700 px-3 py-1.5 rounded-lg">Yes, delete</button>
                  <button onClick={()=>setBulkConfirm(false)} className="text-xs font-bold text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-lg">Cancel</button>
                </div>
              ) : (
                <button onClick={()=>setBulkConfirm(true)} className="flex items-center gap-1.5 text-xs font-bold text-rose-600 bg-white border border-rose-200 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-all">
                  <FiTrash2 className="w-3.5 h-3.5"/> Delete selected
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ══ TABLE (md+) ══ */}
        <div className="hidden md:block bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden" style={{animation:"fadeUp .4s ease both 280ms"}}>
          {visible.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1040px]">
                <thead className="bg-slate-50/80 border-b border-slate-200/70 group/head">
                  <tr>
                    <th className="px-3 py-2.5 w-10">
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all visible"
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer"/>
                    </th>
                    <Th label="#"        sortKey="seq"    sort={sort} onSort={toggleSort} className="w-12"/>
                    <Th label="Service"  sortKey="type"   sort={sort} onSort={toggleSort}/>
                    <Th label="Vendor"   sort={sort} onSort={toggleSort}/>
                    <Th label="Dates"    sortKey="date"   sort={sort} onSort={toggleSort}/>
                    <Th label="Vendor Cost"    sortKey="vendor" sort={sort} onSort={toggleSort} align="right"/>
                    <Th label="Service Amount" sortKey="cost"   sort={sort} onSort={toggleSort} align="right"/>
                    <Th label="Margin"         sortKey="margin" sort={sort} onSort={toggleSort} align="right"/>
                    <Th label="Status"   sortKey="status" sort={sort} onSort={toggleSort}/>
                    <Th label="Actions"/>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((svc,i) => {
                    const { Icon, chip } = svcMeta(svc.serviceType);
                    const st = statusMeta(svc.status);
                    const isSel = selected.has(svc.id);
                    return (
                      <tr key={svc.id || i}
                        className={`group transition-colors ${isSel ? "bg-blue-50/60" : "hover:bg-slate-50/70"} ${svc.status === "CANCELLED" ? "opacity-60" : ""}`}
                        style={{animation:`fadeUp .25s ease both ${Math.min(i,12)*20}ms`}}>
                        <td className="px-3 py-2.5">
                          <input type="checkbox" checked={isSel} onChange={()=>toggleOne(svc.id)} aria-label={`Select ${svc.title}`}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer"/>
                        </td>
                        <td className="px-3 py-2.5 text-xs font-semibold text-slate-400 tabular-nums">{svc.sequence}</td>

                        {/* Service — type chip carries the icon, title + detail below */}
                        <td className="px-3 py-2.5 max-w-[300px]">
                          <div className="flex items-start gap-2.5">
                            <span className={`shrink-0 mt-0.5 w-7 h-7 rounded-lg border flex items-center justify-center ${chip}`}>
                              <Icon className="w-3.5 h-3.5"/>
                            </span>
                            <div className="min-w-0">
                              <button onClick={()=>setDetailSvc(svc)} className="block text-left text-[13px] font-bold text-slate-700 truncate hover:text-blue-600 transition-colors">
                                {svc.title || "Untitled service"}
                              </button>
                              <p className="text-[11px] text-slate-400 truncate">{svc.description || svc.serviceType}</p>
                            </div>
                          </div>
                        </td>

                        {/* Vendor + confirmation number, one column, two lines */}
                        <td className="px-3 py-2.5 max-w-[190px]">
                          {svc.vendorName
                            ? <p className="text-[12.5px] font-semibold text-slate-600 truncate">{svc.vendorName}</p>
                            : <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200"><FiUserX className="w-3 h-3"/> Unassigned</span>}
                          <p className="text-[11px] text-slate-400 truncate tabular-nums">{svc.confirmationNumber || "no confirmation #"}</p>
                        </td>

                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <p className="text-[12.5px] font-semibold text-slate-600">{svc.serviceDate ? fmtDateShort(svc.serviceDate) : "Not set"}</p>
                          {svc.endDate && <p className="text-[11px] text-slate-400">to {fmtDateShort(svc.endDate)}</p>}
                        </td>

                        <td className="px-3 py-2.5 text-right text-[12.5px] font-semibold text-slate-600 tabular-nums whitespace-nowrap">{fmtINR(svc.vendorCost)}</td>
                        <td className="px-3 py-2.5 text-right text-[12.5px] font-bold text-slate-700 tabular-nums whitespace-nowrap">{fmtINR(svc.cost)}</td>
                        <td className={`px-3 py-2.5 text-right text-[12.5px] font-extrabold tabular-nums whitespace-nowrap ${svc.margin > 0 ? "text-emerald-600" : svc.margin < 0 ? "text-rose-600" : "text-slate-400"}`}>{fmtINR(svc.margin)}</td>

                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full border ${st.chip}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}/>{st.label}
                          </span>
                        </td>

                        {/* Actions — the icon row stays quiet until the row is hovered/focused */}
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                            <button title="Download voucher" disabled={downloading === svc.publicId} onClick={()=>downloadVoucher(svc)}
                              className="w-7 h-7 rounded-lg bg-white hover:bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200 transition-all disabled:opacity-60">
                              {downloading === svc.publicId
                                ? <span className="w-3 h-3 border-2 border-blue-500/40 border-t-blue-600 rounded-full animate-spin"/>
                                : <FiDownload className="w-3 h-3"/>}
                            </button>
                            {svc.vendorName && (
                              <a href={`https://wa.me/?text=${encodeURIComponent(`Booking ${booking?.code} — ${svc.serviceType}: ${svc.title}`)}`}
                                target="_blank" rel="noreferrer" title="Share on WhatsApp"
                                className="w-7 h-7 rounded-lg bg-white hover:bg-green-50 text-green-600 flex items-center justify-center border border-green-200 transition-all"><FaWhatsapp className="w-3 h-3"/></a>
                            )}
                            <button onClick={()=>setDetailSvc(svc)} title="View details"
                              className="w-7 h-7 rounded-lg bg-white hover:bg-slate-100 text-slate-500 flex items-center justify-center border border-slate-200 transition-all"><FiEye className="w-3 h-3"/></button>
                            {canUpdate && (
                              <button onClick={()=>setDrawer({ mode:"edit", svc })} title="Edit"
                                className="w-7 h-7 rounded-lg bg-white hover:bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 transition-all"><FiEdit2 className="w-3 h-3"/></button>
                            )}
                            {canDelete && (deleting === svc.id ? (
                              <div className="flex gap-1">
                                <button onClick={()=>handleDelete(svc.publicId)} className="text-[11px] font-extrabold text-white bg-rose-600 px-2 py-1 rounded-lg">Yes</button>
                                <button onClick={()=>setDeleting(null)} className="text-[11px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded-lg">No</button>
                              </div>
                            ) : (
                              <button onClick={()=>setDeleting(svc.id)} title="Delete"
                                className="w-7 h-7 rounded-lg bg-white hover:bg-rose-50 text-rose-500 flex items-center justify-center border border-rose-200 transition-all"><FiTrash2 className="w-3 h-3"/></button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Totals follow the filter — see the note on `visibleTotals`. */}
                <tfoot className="bg-slate-50/80 border-t border-slate-200/70">
                  <tr>
                    <td colSpan={5} className="px-3 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                      {filtered ? `Total (${visible.length} filtered)` : "Total"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[12.5px] font-extrabold text-slate-700 tabular-nums">{fmtINR(visibleTotals.vendor)}</td>
                    <td className="px-3 py-2.5 text-right text-[12.5px] font-extrabold text-slate-700 tabular-nums">{fmtINR(visibleTotals.cost)}</td>
                    <td className={`px-3 py-2.5 text-right text-[12.5px] font-extrabold tabular-nums ${visibleTotals.margin >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmtINR(visibleTotals.margin)}</td>
                    <td colSpan={2}/>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <EmptyState filtered={filtered} canUpdate={canUpdate} onAdd={()=>setDrawer({ mode:"new" })} onClear={clearFilters}/>
          )}
        </div>

        {/* ══ CARDS (mobile) ══ */}
        <div className="md:hidden space-y-2.5">
          {visible.length > 0 ? visible.map((svc,i) => {
            const { Icon, chip } = svcMeta(svc.serviceType);
            const st = statusMeta(svc.status);
            return (
              <div key={svc.id || i} className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-3.5" style={{animation:`fadeUp .25s ease both ${Math.min(i,10)*25}ms`}}>
                <div className="flex items-start gap-2.5">
                  <span className={`shrink-0 w-9 h-9 rounded-xl border flex items-center justify-center ${chip}`}><Icon className="w-4 h-4"/></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-bold text-slate-700 truncate">{svc.title || "Untitled service"}</p>
                      <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.chip}`}>{st.label}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">{svc.vendorName || "No vendor"} · {svc.serviceDate ? fmtDateShort(svc.serviceDate) : "no date"}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 border border-slate-100 p-2.5">
                  {[["Vendor", fmtINR(svc.vendorCost), "text-slate-600"],
                    ["Amount", fmtINR(svc.cost), "text-slate-700"],
                    ["Margin", fmtINR(svc.margin), svc.margin >= 0 ? "text-emerald-600" : "text-rose-600"]].map(([l,v,c]) => (
                    <div key={l}>
                      <p className="text-[9.5px] font-bold uppercase tracking-wide text-slate-400">{l}</p>
                      <p className={`text-[12px] font-extrabold tabular-nums ${c}`}>{v}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-2.5 flex items-center gap-1.5">
                  <button onClick={()=>setDetailSvc(svc)} className="flex-1 py-2 rounded-lg border border-slate-200 text-[11.5px] font-bold text-slate-600">Details</button>
                  <button onClick={()=>downloadVoucher(svc)} disabled={downloading === svc.publicId} className="flex-1 py-2 rounded-lg border border-blue-200 text-[11.5px] font-bold text-blue-600 disabled:opacity-60">Voucher</button>
                  {canUpdate && <button onClick={()=>setDrawer({ mode:"edit", svc })} className="w-9 h-9 rounded-lg border border-amber-200 text-amber-600 flex items-center justify-center"><FiEdit2 className="w-3.5 h-3.5"/></button>}
                  {canDelete && (deleting === svc.id
                    ? <button onClick={()=>handleDelete(svc.publicId)} className="px-3 h-9 rounded-lg bg-rose-600 text-white text-[11.5px] font-extrabold">Confirm</button>
                    : <button onClick={()=>setDeleting(svc.id)} className="w-9 h-9 rounded-lg border border-rose-200 text-rose-500 flex items-center justify-center"><FiTrash2 className="w-3.5 h-3.5"/></button>)}
                </div>
              </div>
            );
          }) : (
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm">
              <EmptyState filtered={filtered} canUpdate={canUpdate} onAdd={()=>setDrawer({ mode:"new" })} onClear={clearFilters}/>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── EMPTY STATE ────────────────────────────────────────────── */
function EmptyState({ filtered, canUpdate, onAdd, onClear }) {
  return (
    <div className="text-center py-14 px-6">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
        {filtered ? <FiSearch className="w-5 h-5"/> : <FiPackage className="w-5 h-5"/>}
      </div>
      <p className="text-sm font-extrabold text-slate-600">{filtered ? "No services match these filters" : "No services on this booking yet"}</p>
      <p className="text-xs text-slate-400 mt-1 mb-4">
        {filtered ? "Try a different search, or clear the filters." : "Add the hotels, flights and transfers that make up this booking."}
      </p>
      {filtered
        ? <button onClick={onClear} className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:border-blue-200 hover:text-blue-600 transition-all">Clear filters</button>
        : canUpdate && (
          <button onClick={onAdd} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-500 text-white text-xs font-extrabold shadow-md shadow-blue-200 transition-all">
            <FiPlus className="w-3.5 h-3.5"/> Add Service
          </button>
        )}
    </div>
  );
}
