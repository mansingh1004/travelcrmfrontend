// // src/trash/TrashPage.jsx
// // ─────────────────────────────────────────────────────────────
// // Universal Trash (Recycle Bin) page.
// // UPDATED: Uses same custom inline Toast as all other CRM pages
// //
// // Backed by the unified /api/trash endpoint which returns records grouped by
// // module. There is no server-side pagination / filtering / bulk, so this page
// // fetches once, flattens the groups into rows, and does search + filter +
// // pagination CLIENT-SIDE (matching the BookingsPage pattern).
// //
// // Records are addressed ONLY by { entityType key, publicId UUID } — never the
// // internal Long id. Restore is gated by TRASH_RESTORE, permanent delete by
// // TRASH_DELETE (tenant-admin only by default); the route itself by TRASH_VIEW.
// // ─────────────────────────────────────────────────────────────

// import { useState, useEffect, useMemo, useCallback } from "react";
// import {
//   Trash2, RotateCcw, AlertTriangle, Search, X, RefreshCw, Inbox, Clock,
//   ShieldAlert, Check, LayoutGrid, List,
// } from "lucide-react";


// import trashService from "../api/trashService";
// import { hasPermission, P } from "@shared/lib/access";


// /* ─────────────────────────────────────────
//    CUSTOM CRM TOAST
//    Same pattern used across all CRM pages —
//    no external library needed.
// ───────────────────────────────────────── */
// function CRMToast({ msg, type, onClose }) {
//   useEffect(() => {
//     const t = setTimeout(onClose, 3500);
//     return () => clearTimeout(t);
//   }, [onClose]);

//   return (
//     <div
//       className={`fixed top-5 right-5 z-[999] flex items-center gap-3 px-4 py-3.5
//         rounded-2xl border shadow-2xl max-w-sm
//         ${type === "success"
//           ? "bg-green-50 border-green-200 text-green-800"
//           : "bg-red-50 border-red-200 text-red-800"}`}
//       style={{ animation: "slideIn .3s ease both" }}
//     >
//       <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
//         ${type === "success" ? "bg-green-100" : "bg-red-100"}`}>
//         {type === "success"
//           ? <Check size={16} className="text-green-600"/>
//           : <AlertTriangle size={16} className="text-red-600"/>}
//       </div>
//       <p className="text-sm font-semibold flex-1">{msg}</p>
//       <button onClick={onClose} className="opacity-50 hover:opacity-100 transition-opacity">
//         <X size={16}/>
//       </button>
//     </div>
//   );
// }

// /* ─────────────────────────────────────────
//    CONSTANTS / HELPERS
// ───────────────────────────────────────── */
// const PER_PAGE = 10;

// // Per-module badge palette (keyed by the entityType registry key).
// const TYPE_BADGE = {
//   LEAD:        "bg-cyan-100 text-cyan-700 border-cyan-200",
//   CUSTOMER:    "bg-teal-100 text-teal-700 border-teal-200",
//   BOOKING:     "bg-orange-100 text-orange-700 border-orange-200",
//   QUOTATION:   "bg-emerald-100 text-emerald-700 border-emerald-200",
//   VENDOR:      "bg-amber-100 text-amber-700 border-amber-200",
//   REMINDER:    "bg-rose-100 text-rose-700 border-rose-200",
//   HOTEL:       "bg-purple-100 text-purple-700 border-purple-200",
//   AIRLINE:     "bg-sky-100 text-sky-700 border-sky-200",
//   CRUISE:      "bg-blue-100 text-blue-700 border-blue-200",
//   ADDON:       "bg-violet-100 text-violet-700 border-violet-200",
//   SIGHTSEEING: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
//   VEHICLE:     "bg-indigo-100 text-indigo-700 border-indigo-200",
//   CITY:        "bg-slate-100 text-slate-700 border-slate-200",
//   DESTINATION: "bg-slate-100 text-slate-700 border-slate-200",
//   COUNTRY:     "bg-slate-100 text-slate-700 border-slate-200",
// };
// const badgeFor = (t) => TYPE_BADGE[t] || "bg-slate-100 text-slate-700 border-slate-200";

// // Per-module gradient for the card avatar tile.
// const TYPE_GRAD = {
//   LEAD:        "from-cyan-500 to-blue-600",
//   CUSTOMER:    "from-teal-500 to-emerald-600",
//   BOOKING:     "from-orange-500 to-red-500",
//   QUOTATION:   "from-emerald-500 to-green-600",
//   VENDOR:      "from-amber-500 to-orange-600",
//   REMINDER:    "from-rose-500 to-pink-600",
//   HOTEL:       "from-purple-500 to-violet-600",
//   AIRLINE:     "from-sky-500 to-blue-600",
//   CRUISE:      "from-blue-500 to-indigo-600",
//   ADDON:       "from-violet-500 to-purple-600",
//   SIGHTSEEING: "from-fuchsia-500 to-pink-600",
//   VEHICLE:     "from-indigo-500 to-blue-600",
//   CITY:        "from-slate-500 to-slate-600",
//   DESTINATION: "from-slate-500 to-slate-600",
//   COUNTRY:     "from-slate-500 to-slate-600",
// };
// const gradFor = (t) => TYPE_GRAD[t] || "from-slate-500 to-slate-600";
// const moduleInitials = (m = "") =>
//   m.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "??";

// const FONT_STACK = '"Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, sans-serif';

// function fmtDateTime(d) {
//   if (!d) return "—";
//   return new Date(d).toLocaleString("en-IN", {
//     day: "2-digit", month: "short", year: "numeric",
//     hour: "2-digit", minute: "2-digit",
//   });
// }

// // Purge-countdown colour: urgent (<=7d) red, soon (<=30d) amber, else slate.
// function purgeStyle(days) {
//   if (days <= 7)  return "bg-red-50 text-red-600 border-red-200";
//   if (days <= 30) return "bg-amber-50 text-amber-700 border-amber-200";
//   return "bg-slate-50 text-slate-500 border-slate-200";
// }
// function purgeLabel(days) {
//   if (days <= 0)  return "Due now";
//   if (days === 1) return "1 day left";
//   return `${days} days left`;
// }

// /* ─────────────────────────────────────────
//    RESTORE CONFIRM MODAL (soft / blue)
// ───────────────────────────────────────── */
// function RestoreModal({ row, busy, onConfirm, onClose }) {
//   if (!row) return null;
//   return (
//     <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
//       onClick={(e) => e.target === e.currentTarget && onClose()}>
//       <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}/>
//       <div className="relative bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/60 w-full max-w-md z-10"
//         style={{ animation: "popIn .25s ease both" }}>

//         {/* Header */}
//         <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-5 rounded-t-2xl flex items-start justify-between">
//           <div>
//             <p className="text-blue-200 text-xs font-bold uppercase tracking-widest mb-0.5">Restore Record</p>
//             <h2 className="text-white text-lg font-extrabold leading-tight">{row.module}</h2>
//           </div>
//           <button onClick={onClose}
//             className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-all text-lg">
//             ✕
//           </button>
//         </div>

//         <div className="p-6 space-y-4">
//           <div className="flex items-start gap-3">
//             <span className="mt-0.5 w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
//               <RotateCcw size={20}/>
//             </span>
//             <p className="text-sm text-slate-600">
//               Restore <span className="font-bold text-slate-800">{row.label || "this record"}</span> back to{" "}
//               <span className="font-semibold">{row.module}</span>? It will reappear in its module and stop counting down to auto-purge.
//             </p>
//           </div>

//           <div className="flex gap-3 pt-1">
//             <button onClick={onClose} disabled={busy}
//               className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 hover:border-slate-300
//                 text-slate-600 font-bold text-sm transition-all bg-white hover:bg-slate-50 disabled:opacity-60">
//               Cancel
//             </button>
//             <button onClick={onConfirm} disabled={busy}
//               className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm transition-all shadow-md
//                 bg-blue-600 hover:bg-blue-700 shadow-blue-200 disabled:opacity-60 disabled:cursor-not-allowed">
//               {busy ? "Restoring…" : "Restore"}
//             </button>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// /* ─────────────────────────────────────────
//    PERMANENT DELETE CONFIRM MODAL (red, type-DELETE)
// ───────────────────────────────────────── */
// function DeleteModal({ row, busy, confirmText, setConfirmText, onConfirm, onClose }) {
//   if (!row) return null;
//   const ok = confirmText.trim().toUpperCase() === "DELETE";

//   return (
//     <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
//       onClick={(e) => e.target === e.currentTarget && onClose()}>
//       <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}/>
//       <div className="relative bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/60 w-full max-w-md z-10"
//         style={{ animation: "popIn .25s ease both" }}>

//         {/* Header */}
//         <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-5 rounded-t-2xl flex items-start justify-between">
//           <div>
//             <p className="text-slate-300 text-xs font-bold uppercase tracking-widest mb-0.5">Delete Permanently</p>
//             <h2 className="text-white text-lg font-extrabold leading-tight">{row.module}</h2>
//           </div>
//           <button onClick={onClose}
//             className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-all text-lg">
//             ✕
//           </button>
//         </div>

//         <div className="p-6 space-y-4">
//           {/* Warning box */}
//           <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
//             <AlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5"/>
//             <div>
//               <p className="text-sm font-extrabold text-red-700 mb-0.5">This cannot be undone</p>
//               <p className="text-xs text-red-600/90">
//                 <span className="font-bold">{row.label || "This record"}</span> and its dependent data will be
//                 permanently removed right now — bypassing the auto-purge window.
//               </p>
//             </div>
//           </div>

//           {/* Type DELETE */}
//           <div>
//             <p className="text-xs font-bold text-slate-600 mb-2">
//               Type <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-red-600">DELETE</span> to confirm.
//             </p>
//             <input
//               value={confirmText}
//               onChange={(e) => setConfirmText(e.target.value)}
//               placeholder="DELETE"
//               autoFocus
//               className="w-full px-3 py-2.5 rounded-lg border border-red-300 text-sm text-slate-700
//                 focus:border-red-400 focus:ring-2 focus:ring-red-50 outline-none transition-all"
//             />
//           </div>

//           <div className="flex gap-3 pt-1">
//             <button onClick={onClose} disabled={busy}
//               className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 hover:border-slate-300
//                 text-slate-600 font-bold text-sm transition-all bg-white hover:bg-slate-50 disabled:opacity-60">
//               Cancel
//             </button>
//             <button onClick={onConfirm} disabled={busy || !ok}
//               className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm transition-all shadow-md
//                 bg-red-600 hover:bg-red-700 shadow-red-200 disabled:opacity-60 disabled:cursor-not-allowed">
//               {busy ? "Deleting…" : "Delete Permanently"}
//             </button>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// /* ─────────────────────────────────────────
//    MAIN PAGE
// ───────────────────────────────────────── */
// export default function TrashPage() {
//   const canRestore = hasPermission(P.TRASH_RESTORE);
//   const canDelete  = hasPermission(P.TRASH_DELETE);

//   // ── Custom CRM toast state (same pattern as all other pages) ──
//   const [toastState, setToastState] = useState(null);
//   const showToast = useCallback((msg, type = "success") => setToastState({ msg, type }), []);

//   const [groups,  setGroups]  = useState([]);
//   const [rows,    setRows]    = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error,   setError]   = useState(null);

//   const [search,     setSearch]     = useState("");
//   const [filterType, setFilterType] = useState("ALL");
//   const [dateFrom,   setDateFrom]   = useState("");
//   const [dateTo,     setDateTo]     = useState("");
//   const [page,       setPage]       = useState(1);
//   const [view,       setView]       = useState("list"); // "list" | "grid"

//   const [restoreTarget, setRestoreTarget] = useState(null);
//   const [deleteTarget,  setDeleteTarget]  = useState(null);
//   const [confirmText,   setConfirmText]   = useState("");
//   const [busy,          setBusy]          = useState(false);

//   /* ── Load ── */
//   const load = useCallback(async () => {
//     setLoading(true);
//     setError(null);
//     try {
//       const data = await trashService.getTrash(); // TrashGroupDto[]
//       const safe = Array.isArray(data) ? data : [];
//       setGroups(safe);
//       const flat = safe.flatMap((g) =>
//         (g.items || []).map((it) => ({
//           entityType:     it.entityType || g.entityType,
//           module:         it.module     || g.module,
//           publicId:       it.publicId,
//           label:          it.label,
//           deletedAt:      it.deletedAt,
//           deletedBy:      it.deletedBy,
//           purgeAt:        it.purgeAt,
//           daysUntilPurge: Number(it.daysUntilPurge ?? 0),
//         }))
//       );
//       setRows(flat);
//     } catch (err) {
//       console.error("Failed to load trash:", err);
//       setError(err?.response?.data?.message || "Failed to load trash. Please try again.");
//       setGroups([]);
//       setRows([]);
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   useEffect(() => { load(); }, [load]);

//   /* ── Error helper ── */
//   const handleErr = (err, verb) => {
//     const status = err?.response?.status;
//     const msg    = err?.response?.data?.message;
//     if (status === 403) {
//       showToast("You don't have access to this. Please contact your administrator.", "error");
//     } else {
//       showToast(msg || `Failed to ${verb}. Please try again.`, "error");
//     }
//   };

//   /* ── Actions ── */
//   const confirmRestore = async () => {
//     if (!restoreTarget || busy) return;
//     setBusy(true);
//     try {
//       await trashService.restoreItem(restoreTarget.entityType, restoreTarget.publicId);
//       showToast(`${restoreTarget.module} restored successfully.`);
//       setRestoreTarget(null);
//       await load();
//     } catch (err) {
//       handleErr(err, "restore");
//     } finally {
//       setBusy(false);
//     }
//   };

//   const confirmDelete = async () => {
//     if (!deleteTarget || busy) return;
//     if (confirmText.trim().toUpperCase() !== "DELETE") return;
//     setBusy(true);
//     try {
//       await trashService.permanentlyDeleteItem(deleteTarget.entityType, deleteTarget.publicId);
//       showToast(`${deleteTarget.module} permanently deleted.`);
//       setDeleteTarget(null);
//       setConfirmText("");
//       await load();
//     } catch (err) {
//       handleErr(err, "delete");
//     } finally {
//       setBusy(false);
//     }
//   };

//   /* ── Type filter options ── */
//   const typeOptions = useMemo(() => {
//     const opts = groups
//       .filter((g) => (g.count ?? (g.items?.length || 0)) > 0)
//       .map((g) => ({
//         value: g.entityType,
//         label: `${g.module} (${g.count ?? g.items.length})`,
//       }));
//     return [{ value: "ALL", label: `All Types (${rows.length})` }, ...opts];
//   }, [groups, rows.length]);

//   /* ── Filter + sort ── */
//   const filtered = useMemo(() => {
//     let out = [...rows];
//     const q = search.trim().toLowerCase();
//     if (q) {
//       out = out.filter((r) =>
//         (r.label    || "").toLowerCase().includes(q) ||
//         (r.deletedBy|| "").toLowerCase().includes(q) ||
//         (r.module   || "").toLowerCase().includes(q)
//       );
//     }
//     if (filterType !== "ALL") out = out.filter((r) => r.entityType === filterType);
//     if (dateFrom) {
//       const start = new Date(dateFrom); start.setHours(0, 0, 0, 0);
//       out = out.filter((r) => r.deletedAt && new Date(r.deletedAt) >= start);
//     }
//     if (dateTo) {
//       const end = new Date(dateTo); end.setHours(23, 59, 59, 999);
//       out = out.filter((r) => r.deletedAt && new Date(r.deletedAt) <= end);
//     }
//     out.sort((a, b) => new Date(b.deletedAt || 0) - new Date(a.deletedAt || 0));
//     return out;
//   }, [rows, search, filterType, dateFrom, dateTo]);

//   const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
//   const safePage   = Math.min(page, totalPages);
//   const pageData   = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

//   const anyFilter  = search || filterType !== "ALL" || dateFrom || dateTo;
//   const resetFilters = () => {
//     setSearch(""); setFilterType("ALL"); setDateFrom(""); setDateTo(""); setPage(1);
//   };

//   const withReset = (setter) => (v) => { setter(v); setPage(1); };

//   const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
//     .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
//     .reduce((acc, p, i, arr) => {
//       if (i > 0 && p - arr[i - 1] > 1) acc.push("…");
//       acc.push(p);
//       return acc;
//     }, []);

//   /* ── Row action buttons ── */
//   const RowActions = ({ row }) => (
//     <div className="flex items-center gap-1.5 justify-end">
//       {canRestore && (
//         <button onClick={() => setRestoreTarget(row)} title="Restore"
//           className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg bg-blue-50 hover:bg-blue-100
//             text-blue-600 text-xs font-bold transition-all border border-blue-100 hover:border-blue-200">
//           <RotateCcw size={13}/> Restore
//         </button>
//       )}
//       {canDelete && (
//         <button onClick={() => { setDeleteTarget(row); setConfirmText(""); }} title="Delete permanently"
//           className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg bg-red-50 hover:bg-red-100
//             text-red-500 hover:text-red-600 text-xs font-bold transition-all border border-red-100 hover:border-red-200">
//           <Trash2 size={13}/> Delete
//         </button>
//       )}
//       {!canRestore && !canDelete && (
//         <span className="text-xs text-slate-400 italic">View only</span>
//       )}
//     </div>
//   );

//   /* ── Single trashed-item card (used by grid view + mobile list) ── */
//   const renderCard = (r, idx) => {
//     const stripe = r.daysUntilPurge <= 7 ? "bg-red-500"
//                  : r.daysUntilPurge <= 30 ? "bg-amber-400"
//                  : "bg-slate-300";
//     return (
//       <div key={`${r.entityType}-${r.publicId}`}
//         className="group bg-white rounded-2xl border border-slate-200/70 shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-slate-300 transition-all duration-300 flex flex-col overflow-hidden"
//         style={{ animation:"fadeUp .35s ease both", animationDelay:`${idx*40}ms` }}>

//         {/* Urgency stripe */}
//         <div className={`h-1 w-full ${stripe}`} />

//         <div className="p-4 flex flex-col flex-1">
//           {/* Badge row */}
//           <div className="flex items-center justify-between gap-2 mb-3.5">
//             <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full border ${badgeFor(r.entityType)}`}>
//               {r.module}
//             </span>
//             <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${purgeStyle(r.daysUntilPurge)}`}>
//               <Clock size={11}/> {purgeLabel(r.daysUntilPurge)}
//             </span>
//           </div>

//           {/* Identity row: gradient avatar + label */}
//           <div className="flex items-center gap-3 mb-3.5">
//             <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradFor(r.entityType)} flex items-center justify-center text-white text-sm font-black shadow-md flex-shrink-0 group-hover:scale-105 transition-transform`}>
//               {moduleInitials(r.module)}
//             </div>
//             <div className="min-w-0">
//               <p className="text-sm font-extrabold text-slate-800 leading-snug line-clamp-2" title={r.label}>{r.label || "—"}</p>
//               <p className="text-[11px] text-slate-400 mt-0.5">Deleted record</p>
//             </div>
//           </div>

//           {/* Meta boxes */}
//           <div className="grid grid-cols-2 gap-2 text-xs mb-3">
//             <div className="bg-slate-50 rounded-xl px-3 py-2 border border-slate-100 min-w-0">
//               <p className="text-slate-400 mb-0.5">Deleted by</p>
//               <p className="font-bold text-slate-700 truncate">{r.deletedBy || "—"}</p>
//             </div>
//             <div className="bg-slate-50 rounded-xl px-3 py-2 border border-slate-100 min-w-0">
//               <p className="text-slate-400 mb-0.5">Deleted at</p>
//               <p className="font-bold text-slate-700 truncate">{fmtDateTime(r.deletedAt)}</p>
//             </div>
//           </div>

//           {/* Actions */}
//           <div className="pt-3 mt-auto border-t border-slate-100">
//             <RowActions row={r}/>
//           </div>
//         </div>
//       </div>
//     );
//   };

//   /* ─────────────────────────────────────────
//      RENDER
//   ───────────────────────────────────────── */
//   return (
//     <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100"
//       style={{ fontFamily: FONT_STACK }}>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
//         @keyframes slideIn { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
//         @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
//         @keyframes popIn  { from{transform:scale(.92);opacity:0} to{transform:scale(1);opacity:1} }
//         .fade-up { animation: fadeUp .4s ease both; }
//         ::-webkit-scrollbar{width:5px;height:5px}
//         ::-webkit-scrollbar-track{background:#f1f5f9;border-radius:99px}
//         ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:99px}
//       `}</style>

//       {/* ── Custom CRM Toast (same pattern as all other pages) ── */}
//       {toastState && (
//         <CRMToast
//           msg={toastState.msg}
//           type={toastState.type}
//           onClose={() => setToastState(null)}
//         />
//       )}

//       {/* ── PAGE HEADER ── */}
//       <div className="bg-white/80 backdrop-blur-md border-b border-slate-200/60">
//         <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5">
//           <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
//             <div className="flex items-center gap-4">
//               <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-600
//                 flex items-center justify-center text-white shadow-lg shadow-slate-300 flex-shrink-0">
//                 <Trash2 size={22}/>
//               </div>
//               <div>
//                 <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Trash</h1>
//                 <p className="text-sm text-slate-400 mt-0.5">
//                   Deleted records are recoverable until they are auto-purged.
//                 </p>
//               </div>
//             </div>
//             <button onClick={load}
//               className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200
//                 hover:border-blue-300 text-slate-600 hover:text-blue-600 text-sm font-bold shadow-sm transition-all self-start sm:self-auto">
//               <RefreshCw size={16} className={loading ? "animate-spin" : ""}/> Refresh
//             </button>
//           </div>
//         </div>
//       </div>

//       <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">

//         {/* ── MAIN CARD ── */}
//         <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden fade-up">

//           {/* Card header */}
//           <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
//             <div className="flex items-center gap-3 flex-wrap">
//               <h2 className="text-base font-extrabold text-slate-700">Trashed Items</h2>
//               <span className="text-xs bg-slate-100 text-slate-600 font-bold px-2.5 py-1 rounded-full">
//                 {filtered.length} item{filtered.length === 1 ? "" : "s"}
//               </span>
//               {loading && (
//                 <span className="text-xs text-slate-400 font-medium animate-pulse">Loading…</span>
//               )}
//             </div>
//             <div className="flex items-center gap-3">
//               {anyFilter && (
//                 <button onClick={resetFilters}
//                   className="text-xs text-slate-400 hover:text-red-500 font-semibold flex items-center gap-1 transition-colors">
//                   <X size={14}/> Clear filters
//                 </button>
//               )}
//               {/* Grid / List toggle */}
//               <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1">
//                 {["grid", "list"].map((v) => (
//                   <button key={v} onClick={() => setView(v)}
//                     className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5
//                       ${view === v ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
//                     {v === "grid" ? <LayoutGrid size={13}/> : <List size={13}/>}
//                     <span className="hidden sm:inline">{v === "grid" ? "Grid" : "List"}</span>
//                   </button>
//                 ))}
//               </div>
//             </div>
//           </div>

//           {/* ── FILTER ROW ── */}
//           <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60">
//             <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
//               {/* Search */}
//               <div className="relative flex-1 min-w-[220px]">
//                 <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
//                 <input
//                   type="text" value={search}
//                   onChange={(e) => withReset(setSearch)(e.target.value)}
//                   placeholder="Search by name, deleted by, module…"
//                   className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm
//                     text-slate-700 placeholder-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-50
//                     outline-none transition-all hover:border-slate-300"
//                 />
//               </div>

//               {/* Type filter */}
//               <div className="relative min-w-[200px]">
//                 <select value={filterType} onChange={(e) => withReset(setFilterType)(e.target.value)}
//                   className="w-full pl-3.5 pr-9 py-2.5 rounded-xl border border-slate-200 bg-white text-sm
//                     text-slate-700 font-medium focus:border-blue-400 focus:ring-2 focus:ring-blue-50
//                     outline-none cursor-pointer appearance-none transition-all hover:border-slate-300">
//                   {typeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
//                 </select>
//                 <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">▼</span>
//               </div>

//               {/* Date range */}
//               <div className="flex items-center gap-2">
//                 <label className="text-xs text-slate-500 font-bold whitespace-nowrap">Deleted</label>
//                 <input type="date" value={dateFrom} onChange={(e) => withReset(setDateFrom)(e.target.value)}
//                   className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-600
//                     focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none transition-all hover:border-slate-300"/>
//                 <span className="text-slate-400 text-xs font-medium">to</span>
//                 <input type="date" value={dateTo} onChange={(e) => withReset(setDateTo)(e.target.value)}
//                   className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-600
//                     focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none transition-all hover:border-slate-300"/>
//               </div>
//             </div>
//           </div>

//           {/* ── ERROR STATE ── */}
//           {error && !loading && (
//             <div className="px-5 py-20 text-center">
//               <div className="w-16 h-16 mx-auto rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mb-4">
//                 <ShieldAlert size={28}/>
//               </div>
//               <p className="text-slate-600 font-bold text-sm mb-3">{error}</p>
//               <button onClick={load}
//                 className="px-5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold text-sm transition-all">
//                 Try again
//               </button>
//             </div>
//           )}

//           {/* ── DESKTOP TABLE (list view) ── */}
//           {!error && view === "list" && (
//             <div className="hidden md:block overflow-x-auto">
//               <table className="w-full min-w-[900px]">
//                 <thead className="bg-slate-50/80 border-b border-slate-100">
//                   <tr>
//                     {["Type","Item","Deleted By","Deleted At","Auto-purge","Actions"].map((h,i)=>(
//                       <th key={h} className={`px-4 py-3.5 text-xs font-extrabold text-slate-500 uppercase tracking-wider
//                         ${i===5?"text-right":"text-left"}`}>
//                         {h}
//                       </th>
//                     ))}
//                   </tr>
//                 </thead>
//                 <tbody className="divide-y divide-slate-50">
//                   {loading ? (
//                     [...Array(6)].map((_, i) => (
//                       <tr key={i}>
//                         {[...Array(6)].map((_, j) => (
//                           <td key={j} className="px-4 py-3.5">
//                             <div className="h-4 rounded-lg bg-slate-200 animate-pulse"
//                               style={{ width: `${35 + Math.random() * 50}%` }}/>
//                           </td>
//                         ))}
//                       </tr>
//                     ))
//                   ) : pageData.length === 0 ? (
//                     <tr>
//                       <td colSpan={6} className="text-center py-20">
//                         <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
//                           <Inbox size={28}/>
//                         </div>
//                         <p className="text-slate-500 font-bold text-sm mb-2">
//                           {anyFilter ? "No items match your filters" : "Trash is empty"}
//                         </p>
//                         <p className="text-slate-400 text-xs mb-4">
//                           {anyFilter ? "Try adjusting your search or filter." : "Deleted records will appear here for 30 days."}
//                         </p>
//                         {anyFilter && (
//                           <button onClick={resetFilters}
//                             className="px-5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold text-sm transition-all">
//                             Clear Filters
//                           </button>
//                         )}
//                       </td>
//                     </tr>
//                   ) : (
//                     pageData.map((r, idx) => (
//                       <tr key={`${r.entityType}-${r.publicId}`}
//                         className="group transition-all duration-150 hover:bg-blue-50/20 hover:shadow-[inset_3px_0_0_#64748b]"
//                         style={{ animation:"fadeUp .35s ease both", animationDelay:`${idx*20}ms` }}>
//                         {/* Type badge */}
//                         <td className="px-4 py-3.5">
//                           <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full border ${badgeFor(r.entityType)}`}>
//                             {r.module}
//                           </span>
//                         </td>
//                         {/* Label */}
//                         <td className="px-4 py-3.5">
//                           <p className="text-sm font-bold text-slate-700 max-w-[280px] truncate" title={r.label}>
//                             {r.label || "—"}
//                           </p>
//                         </td>
//                         {/* Deleted by */}
//                         <td className="px-4 py-3.5 text-sm text-slate-600">
//                           {r.deletedBy || "—"}
//                         </td>
//                         {/* Deleted at */}
//                         <td className="px-4 py-3.5 text-sm text-slate-500 whitespace-nowrap">
//                           {fmtDateTime(r.deletedAt)}
//                         </td>
//                         {/* Auto-purge countdown */}
//                         <td className="px-4 py-3.5">
//                           <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${purgeStyle(r.daysUntilPurge)}`}>
//                             <Clock size={11}/> {purgeLabel(r.daysUntilPurge)}
//                           </span>
//                         </td>
//                         {/* Actions */}
//                         <td className="px-4 py-3.5">
//                           <RowActions row={r}/>
//                         </td>
//                       </tr>
//                     ))
//                   )}
//                 </tbody>
//               </table>
//             </div>
//           )}

//           {/* ── MOBILE CARDS (list view) ── */}
//           {!error && view === "list" && (
//             <div className="md:hidden p-4 space-y-3">
//               {loading ? (
//                 [...Array(3)].map((_, i) => (
//                   <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3 animate-pulse">
//                     {[...Array(4)].map((_, j) => (
//                       <div key={j} className="h-4 rounded-lg bg-slate-200"
//                         style={{ width: `${40 + Math.random() * 45}%` }}/>
//                     ))}
//                   </div>
//                 ))
//               ) : pageData.length === 0 ? (
//                 <div className="text-center py-16">
//                   <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
//                     <Inbox size={24}/>
//                   </div>
//                   <p className="text-slate-400 font-semibold text-sm">
//                     {anyFilter ? "No items match your filters" : "Trash is empty"}
//                   </p>
//                   {anyFilter && (
//                     <button onClick={resetFilters}
//                       className="mt-3 px-4 py-2 rounded-xl bg-blue-50 text-blue-600 font-bold text-sm">
//                       Clear Filters
//                     </button>
//                   )}
//                 </div>
//               ) : (
//                 pageData.map(renderCard)
//               )}
//             </div>
//           )}

//           {/* ── GRID VIEW (all breakpoints) ── */}
//           {!error && view === "grid" && (
//             <div className="p-4 sm:p-5">
//               {loading ? (
//                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
//                   {[...Array(8)].map((_, i) => (
//                     <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 h-44 animate-pulse"/>
//                   ))}
//                 </div>
//               ) : pageData.length === 0 ? (
//                 <div className="text-center py-16">
//                   <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
//                     <Inbox size={28}/>
//                   </div>
//                   <p className="text-slate-500 font-bold text-sm mb-2">
//                     {anyFilter ? "No items match your filters" : "Trash is empty"}
//                   </p>
//                   <p className="text-slate-400 text-xs mb-4">
//                     {anyFilter ? "Try adjusting your search or filter." : "Deleted records will appear here for 30 days."}
//                   </p>
//                   {anyFilter && (
//                     <button onClick={resetFilters}
//                       className="px-5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold text-sm transition-all">
//                       Clear Filters
//                     </button>
//                   )}
//                 </div>
//               ) : (
//                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
//                   {pageData.map(renderCard)}
//                 </div>
//               )}
//             </div>
//           )}

//           {/* ── PAGINATION ── */}
//           {!error && !loading && filtered.length > 0 && (
//             <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/60
//               flex flex-col sm:flex-row items-center justify-between gap-3">
//               <p className="text-xs text-slate-400 font-medium">
//                 Showing{" "}
//                 <span className="font-bold text-slate-600">{(safePage-1)*PER_PAGE+1}</span>–
//                 <span className="font-bold text-slate-600">{Math.min(safePage*PER_PAGE,filtered.length)}</span>
//                 {" "}of{" "}
//                 <span className="font-bold text-slate-600">{filtered.length}</span>
//               </p>
//               <div className="flex items-center gap-1.5">
//                 <button disabled={safePage===1} onClick={()=>setPage(1)}
//                   className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 text-xs font-bold
//                     hover:border-blue-300 hover:text-blue-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
//                   «
//                 </button>
//                 <button disabled={safePage===1} onClick={()=>setPage(p=>Math.max(1,p-1))}
//                   className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 text-xs font-bold
//                     hover:border-blue-300 hover:text-blue-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
//                   ‹
//                 </button>
//                 {pageNumbers.map((p,i) =>
//                   typeof p==="string"
//                     ? <span key={`e${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-slate-400">…</span>
//                     : <button key={p} onClick={()=>setPage(p)}
//                         className={`w-8 h-8 rounded-lg text-xs font-bold transition-all border
//                           ${safePage===p
//                             ?"bg-blue-600 border-blue-600 text-white shadow-sm"
//                             :"bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600"}`}>
//                         {p}
//                       </button>
//                 )}
//                 <button disabled={safePage===totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}
//                   className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 text-xs font-bold
//                     hover:border-blue-300 hover:text-blue-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
//                   ›
//                 </button>
//                 <button disabled={safePage===totalPages} onClick={()=>setPage(totalPages)}
//                   className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 text-xs font-bold
//                     hover:border-blue-300 hover:text-blue-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
//                   »
//                 </button>
//               </div>
//             </div>
//           )}

//         </div>
//       </div>

//       {/* ── MODALS ── */}
//       <RestoreModal
//         row={restoreTarget}
//         busy={busy}
//         onConfirm={confirmRestore}
//         onClose={() => !busy && setRestoreTarget(null)}
//       />
//       <DeleteModal
//         row={deleteTarget}
//         busy={busy}
//         confirmText={confirmText}
//         setConfirmText={setConfirmText}
//         onConfirm={confirmDelete}
//         onClose={() => { if (!busy) { setDeleteTarget(null); setConfirmText(""); } }}
//       />
//     </div>
//   );
// }



// src/trash/TrashPage.jsx
// ─────────────────────────────────────────────────────────────
// Universal Trash (Recycle Bin) page.
// UPDATED: Uses same custom inline Toast as all other CRM pages
//
// Backed by the unified /api/trash endpoint which returns records grouped by
// module. There is no server-side pagination / filtering / bulk, so this page
// fetches once, flattens the groups into rows, and does search + filter +
// pagination CLIENT-SIDE (matching the BookingsPage pattern).
//
// Records are addressed ONLY by { entityType key, publicId UUID } — never the
// internal Long id. Restore is gated by TRASH_RESTORE, permanent delete by
// TRASH_DELETE (tenant-admin only by default); the route itself by TRASH_VIEW.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Trash2, RotateCcw, AlertTriangle, Search, X, RefreshCw, Inbox, Clock,
  ShieldAlert, Check, LayoutGrid, List, ChevronLeft, ChevronRight,
} from "lucide-react";


import trashService from "../api/trashService";
import { hasPermission, P } from "@shared/lib/access";


/* ─────────────────────────────────────────
   CUSTOM CRM TOAST
   Same pattern used across all CRM pages —
   no external library needed.
───────────────────────────────────────── */
function CRMToast({ msg, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`fixed top-5 right-5 z-[999] flex items-center gap-3 px-4 py-3.5
        rounded-2xl border shadow-2xl max-w-sm
        ${type === "success"
          ? "bg-green-50 border-green-200 text-green-800"
          : "bg-red-50 border-red-200 text-red-800"}`}
      style={{ animation: "slideIn .3s ease both" }}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
        ${type === "success" ? "bg-green-100" : "bg-red-100"}`}>
        {type === "success"
          ? <Check size={16} className="text-green-600"/>
          : <AlertTriangle size={16} className="text-red-600"/>}
      </div>
      <p className="text-sm font-semibold flex-1">{msg}</p>
      <button onClick={onClose} className="opacity-50 hover:opacity-100 transition-opacity">
        <X size={16}/>
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────
   CONSTANTS / HELPERS
───────────────────────────────────────── */
const PER_PAGE = 10;

// Per-module badge palette (keyed by the entityType registry key).
const TYPE_BADGE = {
  LEAD:        "bg-cyan-100 text-cyan-700 border-cyan-200",
  CUSTOMER:    "bg-teal-100 text-teal-700 border-teal-200",
  BOOKING:     "bg-orange-100 text-orange-700 border-orange-200",
  QUOTATION:   "bg-emerald-100 text-emerald-700 border-emerald-200",
  VENDOR:      "bg-amber-100 text-amber-700 border-amber-200",
  REMINDER:    "bg-rose-100 text-rose-700 border-rose-200",
  HOTEL:       "bg-purple-100 text-purple-700 border-purple-200",
  AIRLINE:     "bg-sky-100 text-sky-700 border-sky-200",
  CRUISE:      "bg-blue-100 text-blue-700 border-blue-200",
  ADDON:       "bg-violet-100 text-violet-700 border-violet-200",
  SIGHTSEEING: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
  VEHICLE:     "bg-indigo-100 text-indigo-700 border-indigo-200",
  CITY:        "bg-slate-100 text-slate-700 border-slate-200",
  DESTINATION: "bg-slate-100 text-slate-700 border-slate-200",
  COUNTRY:     "bg-slate-100 text-slate-700 border-slate-200",
};
const badgeFor = (t) => TYPE_BADGE[t] || "bg-slate-100 text-slate-700 border-slate-200";

// Per-module gradient for the card avatar tile.
const TYPE_GRAD = {
  LEAD:        "from-cyan-500 to-blue-600",
  CUSTOMER:    "from-teal-500 to-emerald-600",
  BOOKING:     "from-orange-500 to-red-500",
  QUOTATION:   "from-emerald-500 to-green-600",
  VENDOR:      "from-amber-500 to-orange-600",
  REMINDER:    "from-rose-500 to-pink-600",
  HOTEL:       "from-purple-500 to-violet-600",
  AIRLINE:     "from-sky-500 to-blue-600",
  CRUISE:      "from-blue-500 to-indigo-600",
  ADDON:       "from-violet-500 to-purple-600",
  SIGHTSEEING: "from-fuchsia-500 to-pink-600",
  VEHICLE:     "from-indigo-500 to-blue-600",
  CITY:        "from-slate-500 to-slate-600",
  DESTINATION: "from-slate-500 to-slate-600",
  COUNTRY:     "from-slate-500 to-slate-600",
};
const gradFor = (t) => TYPE_GRAD[t] || "from-slate-500 to-slate-600";
const moduleInitials = (m = "") =>
  m.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "??";

const FONT_STACK = '"Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, sans-serif';

function fmtDateTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// Purge-countdown colour: urgent (<=7d) red, soon (<=30d) amber, else slate.
function purgeStyle(days) {
  if (days <= 7)  return "bg-red-50 text-red-600 border-red-200";
  if (days <= 30) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-50 text-slate-500 border-slate-200";
}
function purgeLabel(days) {
  if (days <= 0)  return "Due now";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

/* ─────────────────────────────────────────
   RESTORE CONFIRM MODAL (soft / blue)
───────────────────────────────────────── */
function RestoreModal({ row, busy, onConfirm, onClose }) {
  if (!row) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/60 w-full max-w-md z-10"
        style={{ animation: "popIn .25s ease both" }}>

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-5 rounded-t-2xl flex items-start justify-between">
          <div>
            <p className="text-blue-200 text-xs font-bold uppercase tracking-widest mb-0.5">Restore Record</p>
            <h2 className="text-white text-lg font-extrabold leading-tight">{row.module}</h2>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-all text-lg">
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <RotateCcw size={20}/>
            </span>
            <p className="text-sm text-slate-600">
              Restore <span className="font-bold text-slate-800">{row.label || "this record"}</span> back to{" "}
              <span className="font-semibold">{row.module}</span>? It will reappear in its module and stop counting down to auto-purge.
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} disabled={busy}
              className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 hover:border-slate-300
                text-slate-600 font-bold text-sm transition-all bg-white hover:bg-slate-50 disabled:opacity-60">
              Cancel
            </button>
            <button onClick={onConfirm} disabled={busy}
              className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm transition-all shadow-md
                bg-blue-600 hover:bg-blue-700 shadow-blue-200 disabled:opacity-60 disabled:cursor-not-allowed">
              {busy ? "Restoring…" : "Restore"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   PERMANENT DELETE CONFIRM MODAL (red, type-DELETE)
───────────────────────────────────────── */
function DeleteModal({ row, busy, confirmText, setConfirmText, onConfirm, onClose }) {
  if (!row) return null;
  const ok = confirmText.trim().toUpperCase() === "DELETE";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/60 w-full max-w-md z-10"
        style={{ animation: "popIn .25s ease both" }}>

        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-5 rounded-t-2xl flex items-start justify-between">
          <div>
            <p className="text-slate-300 text-xs font-bold uppercase tracking-widest mb-0.5">Delete Permanently</p>
            <h2 className="text-white text-lg font-extrabold leading-tight">{row.module}</h2>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-all text-lg">
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Warning box */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5"/>
            <div>
              <p className="text-sm font-extrabold text-red-700 mb-0.5">This cannot be undone</p>
              <p className="text-xs text-red-600/90">
                <span className="font-bold">{row.label || "This record"}</span> and its dependent data will be
                permanently removed right now — bypassing the auto-purge window.
              </p>
            </div>
          </div>

          {/* Type DELETE */}
          <div>
            <p className="text-xs font-bold text-slate-600 mb-2">
              Type <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-red-600">DELETE</span> to confirm.
            </p>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              autoFocus
              className="w-full px-3 py-2.5 rounded-lg border border-red-300 text-sm text-slate-700
                focus:border-red-400 focus:ring-2 focus:ring-red-50 outline-none transition-all"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} disabled={busy}
              className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 hover:border-slate-300
                text-slate-600 font-bold text-sm transition-all bg-white hover:bg-slate-50 disabled:opacity-60">
              Cancel
            </button>
            <button onClick={onConfirm} disabled={busy || !ok}
              className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm transition-all shadow-md
                bg-red-600 hover:bg-red-700 shadow-red-200 disabled:opacity-60 disabled:cursor-not-allowed">
              {busy ? "Deleting…" : "Delete Permanently"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────── */
export default function TrashPage() {
  const canRestore = hasPermission(P.TRASH_RESTORE);
  const canDelete  = hasPermission(P.TRASH_DELETE);

  // ── Custom CRM toast state (same pattern as all other pages) ──
  const [toastState, setToastState] = useState(null);
  const showToast = useCallback((msg, type = "success") => setToastState({ msg, type }), []);

  const [groups,  setGroups]  = useState([]);
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const [search,     setSearch]     = useState("");
  const [filterType, setFilterType] = useState("ALL");
  const [dateFrom,   setDateFrom]   = useState("");
  const [dateTo,     setDateTo]     = useState("");
  const [page,       setPage]       = useState(1);
  const [view,       setView]       = useState("list"); // "list" | "grid"

  const [restoreTarget, setRestoreTarget] = useState(null);
  const [deleteTarget,  setDeleteTarget]  = useState(null);
  const [confirmText,   setConfirmText]   = useState("");
  const [busy,          setBusy]          = useState(false);

  /* ── Load ── */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await trashService.getTrash(); // TrashGroupDto[]
      const safe = Array.isArray(data) ? data : [];
      setGroups(safe);
      const flat = safe.flatMap((g) =>
        (g.items || []).map((it) => ({
          entityType:     it.entityType || g.entityType,
          module:         it.module     || g.module,
          publicId:       it.publicId,
          label:          it.label,
          deletedAt:      it.deletedAt,
          deletedBy:      it.deletedBy,
          purgeAt:        it.purgeAt,
          daysUntilPurge: Number(it.daysUntilPurge ?? 0),
        }))
      );
      setRows(flat);
    } catch (err) {
      console.error("Failed to load trash:", err);
      setError(err?.response?.data?.message || "Failed to load trash. Please try again.");
      setGroups([]);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Error helper ── */
  const handleErr = (err, verb) => {
    const status = err?.response?.status;
    const msg    = err?.response?.data?.message;
    if (status === 403) {
      showToast("You don't have access to this. Please contact your administrator.", "error");
    } else {
      showToast(msg || `Failed to ${verb}. Please try again.`, "error");
    }
  };

  /* ── Actions ── */
  const confirmRestore = async () => {
    if (!restoreTarget || busy) return;
    setBusy(true);
    try {
      await trashService.restoreItem(restoreTarget.entityType, restoreTarget.publicId);
      showToast(`${restoreTarget.module} restored successfully.`);
      setRestoreTarget(null);
      await load();
    } catch (err) {
      handleErr(err, "restore");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || busy) return;
    if (confirmText.trim().toUpperCase() !== "DELETE") return;
    setBusy(true);
    try {
      await trashService.permanentlyDeleteItem(deleteTarget.entityType, deleteTarget.publicId);
      showToast(`${deleteTarget.module} permanently deleted.`);
      setDeleteTarget(null);
      setConfirmText("");
      await load();
    } catch (err) {
      handleErr(err, "delete");
    } finally {
      setBusy(false);
    }
  };

  /* ── Type filter options ── */
  const typeOptions = useMemo(() => {
    const opts = groups
      .filter((g) => (g.count ?? (g.items?.length || 0)) > 0)
      .map((g) => ({
        value: g.entityType,
        label: `${g.module} (${g.count ?? g.items.length})`,
      }));
    return [{ value: "ALL", label: `All Types (${rows.length})` }, ...opts];
  }, [groups, rows.length]);

  /* ── Filter + sort ── */
  const filtered = useMemo(() => {
    let out = [...rows];
    const q = search.trim().toLowerCase();
    if (q) {
      out = out.filter((r) =>
        (r.label    || "").toLowerCase().includes(q) ||
        (r.deletedBy|| "").toLowerCase().includes(q) ||
        (r.module   || "").toLowerCase().includes(q)
      );
    }
    if (filterType !== "ALL") out = out.filter((r) => r.entityType === filterType);
    if (dateFrom) {
      const start = new Date(dateFrom); start.setHours(0, 0, 0, 0);
      out = out.filter((r) => r.deletedAt && new Date(r.deletedAt) >= start);
    }
    if (dateTo) {
      const end = new Date(dateTo); end.setHours(23, 59, 59, 999);
      out = out.filter((r) => r.deletedAt && new Date(r.deletedAt) <= end);
    }
    out.sort((a, b) => new Date(b.deletedAt || 0) - new Date(a.deletedAt || 0));
    return out;
  }, [rows, search, filterType, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const pageData   = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const anyFilter  = search || filterType !== "ALL" || dateFrom || dateTo;
  const resetFilters = () => {
    setSearch(""); setFilterType("ALL"); setDateFrom(""); setDateTo(""); setPage(1);
  };

  const withReset = (setter) => (v) => { setter(v); setPage(1); };

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
    .reduce((acc, p, i, arr) => {
      if (i > 0 && p - arr[i - 1] > 1) acc.push("…");
      acc.push(p);
      return acc;
    }, []);

  /* ── Row action buttons ── */
  const RowActions = ({ row }) => (
    <div className="flex items-center gap-1.5 justify-end">
      {canRestore && (
        <button onClick={() => setRestoreTarget(row)} title="Restore"
          className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg bg-blue-50 hover:bg-blue-100
            text-blue-600 text-xs font-bold transition-all border border-blue-100 hover:border-blue-200">
          <RotateCcw size={13}/> Restore
        </button>
      )}
      {canDelete && (
        <button onClick={() => { setDeleteTarget(row); setConfirmText(""); }} title="Delete permanently"
          className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg bg-red-50 hover:bg-red-100
            text-red-500 hover:text-red-600 text-xs font-bold transition-all border border-red-100 hover:border-red-200">
          <Trash2 size={13}/> Delete
        </button>
      )}
      {!canRestore && !canDelete && (
        <span className="text-xs text-slate-400 italic">View only</span>
      )}
    </div>
  );

  /* ── Single trashed-item card (used by grid view + mobile list) ──
     Meta boxes (Deleted by / Deleted at) stack full-width below `sm` instead
     of sharing a 2-col row — on a narrow phone the 2-col version squeezed
     "Deleted at" into a box too tight for the formatted date/time, which is
     what made it look like it wasn't rendering at all. */
  const renderCard = (r, idx) => {
    const stripe = r.daysUntilPurge <= 7 ? "bg-red-500"
                 : r.daysUntilPurge <= 30 ? "bg-amber-400"
                 : "bg-slate-300";
    return (
      <div key={`${r.entityType}-${r.publicId}`}
        className="group bg-white rounded-2xl border border-slate-200/70 shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-slate-300 transition-all duration-300 flex flex-col overflow-hidden"
        style={{ animation:"fadeUp .35s ease both", animationDelay:`${idx*40}ms` }}>

        {/* Urgency stripe */}
        <div className={`h-1 w-full ${stripe}`} />

        <div className="p-4 flex flex-col flex-1">
          {/* Badge row */}
          <div className="flex items-center justify-between gap-2 mb-3.5">
            <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full border ${badgeFor(r.entityType)}`}>
              {r.module}
            </span>
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${purgeStyle(r.daysUntilPurge)}`}>
              <Clock size={11}/> {purgeLabel(r.daysUntilPurge)}
            </span>
          </div>

          {/* Identity row: gradient avatar + label */}
          <div className="flex items-center gap-3 mb-3.5">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradFor(r.entityType)} flex items-center justify-center text-white text-sm font-black shadow-md flex-shrink-0 group-hover:scale-105 transition-transform`}>
              {moduleInitials(r.module)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-slate-800 leading-snug line-clamp-2" title={r.label}>{r.label || "—"}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Deleted record</p>
            </div>
          </div>

          {/* Meta boxes — single column on phones, 2-up from sm and up */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs mb-3">
            <div className="bg-slate-50 rounded-xl px-3 py-2 border border-slate-100 min-w-0">
              <p className="text-slate-400 mb-0.5">Deleted by</p>
              <p className="font-bold text-slate-700 truncate">{r.deletedBy || "—"}</p>
            </div>
            <div className="bg-slate-50 rounded-xl px-3 py-2 border border-slate-100 min-w-0">
              <p className="text-slate-400 mb-0.5">Deleted at</p>
              <p className="font-bold text-slate-700">{fmtDateTime(r.deletedAt)}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 mt-auto border-t border-slate-100">
            <RowActions row={r}/>
          </div>
        </div>
      </div>
    );
  };

  /* ─────────────────────────────────────────
     RENDER
  ───────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100"
      style={{ fontFamily: FONT_STACK }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes slideIn { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes popIn  { from{transform:scale(.92);opacity:0} to{transform:scale(1);opacity:1} }
        .fade-up { animation: fadeUp .4s ease both; }
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#f1f5f9;border-radius:99px}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:99px}
      `}</style>

      {/* ── Custom CRM Toast (same pattern as all other pages) ── */}
      {toastState && (
        <CRMToast
          msg={toastState.msg}
          type={toastState.type}
          onClose={() => setToastState(null)}
        />
      )}

      {/* ── PAGE HEADER ── */}
      <div className="bg-white/80 backdrop-blur-md border-b border-slate-200/60">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-600
                flex items-center justify-center text-white shadow-lg shadow-slate-300 flex-shrink-0">
                <Trash2 size={22}/>
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Trash</h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  Deleted records are recoverable until they are auto-purged.
                </p>
              </div>
            </div>
            <button onClick={load}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200
                hover:border-blue-300 text-slate-600 hover:text-blue-600 text-sm font-bold shadow-sm transition-all self-start sm:self-auto">
              <RefreshCw size={16} className={loading ? "animate-spin" : ""}/> Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* ── MAIN CARD ── */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden fade-up">

          {/* Card header */}
          <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-base font-extrabold text-slate-700">Trashed Items</h2>
              <span className="text-xs bg-slate-100 text-slate-600 font-bold px-2.5 py-1 rounded-full">
                {filtered.length} item{filtered.length === 1 ? "" : "s"}
              </span>
              {loading && (
                <span className="text-xs text-slate-400 font-medium animate-pulse">Loading…</span>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {anyFilter && (
                <button onClick={resetFilters}
                  className="text-xs text-slate-400 hover:text-red-500 font-semibold flex items-center gap-1 transition-colors">
                  <X size={14}/> Clear filters
                </button>
              )}
              {/* Grid / List toggle */}
              <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1">
                {["grid", "list"].map((v) => (
                  <button key={v} onClick={() => setView(v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5
                      ${view === v ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                    {v === "grid" ? <LayoutGrid size={13}/> : <List size={13}/>}
                    <span className="hidden sm:inline">{v === "grid" ? "Grid" : "List"}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── FILTER ROW ── */}
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60">
            <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                <input
                  type="text" value={search}
                  onChange={(e) => withReset(setSearch)(e.target.value)}
                  placeholder="Search by name, deleted by, module…"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm
                    text-slate-700 placeholder-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-50
                    outline-none transition-all hover:border-slate-300"
                />
              </div>

              {/* Type filter */}
              <div className="relative w-full sm:w-auto sm:min-w-[200px]">
                <select value={filterType} onChange={(e) => withReset(setFilterType)(e.target.value)}
                  className="w-full pl-3.5 pr-9 py-2.5 rounded-xl border border-slate-200 bg-white text-sm
                    text-slate-700 font-medium focus:border-blue-400 focus:ring-2 focus:ring-blue-50
                    outline-none cursor-pointer appearance-none transition-all hover:border-slate-300">
                  {typeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">▼</span>
              </div>

              {/* Date range — wraps onto two lines on very narrow phones
                  instead of overflowing the filter card sideways. */}
              <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                <label className="text-xs text-slate-500 font-bold whitespace-nowrap">Deleted</label>
                <input type="date" value={dateFrom} onChange={(e) => withReset(setDateFrom)(e.target.value)}
                  className="flex-1 min-w-[132px] sm:flex-none px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-600
                    focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none transition-all hover:border-slate-300"/>
                <span className="text-slate-400 text-xs font-medium">to</span>
                <input type="date" value={dateTo} onChange={(e) => withReset(setDateTo)(e.target.value)}
                  className="flex-1 min-w-[132px] sm:flex-none px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-600
                    focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none transition-all hover:border-slate-300"/>
              </div>
            </div>
          </div>

          {/* ── ERROR STATE ── */}
          {error && !loading && (
            <div className="px-5 py-20 text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mb-4">
                <ShieldAlert size={28}/>
              </div>
              <p className="text-slate-600 font-bold text-sm mb-3">{error}</p>
              <button onClick={load}
                className="px-5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold text-sm transition-all">
                Try again
              </button>
            </div>
          )}

          {/* ── DESKTOP TABLE (list view) ── */}
          {!error && view === "list" && (
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead className="bg-slate-50/80 border-b border-slate-100">
                  <tr>
                    {["Type","Item","Deleted By","Deleted At","Auto-purge","Actions"].map((h,i)=>(
                      <th key={h} className={`px-4 py-3.5 text-xs font-extrabold text-slate-500 uppercase tracking-wider
                        ${i===5?"text-right":"text-left"}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    [...Array(6)].map((_, i) => (
                      <tr key={i}>
                        {[...Array(6)].map((_, j) => (
                          <td key={j} className="px-4 py-3.5">
                            <div className="h-4 rounded-lg bg-slate-200 animate-pulse"
                              style={{ width: `${35 + Math.random() * 50}%` }}/>
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : pageData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-20">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
                          <Inbox size={28}/>
                        </div>
                        <p className="text-slate-500 font-bold text-sm mb-2">
                          {anyFilter ? "No items match your filters" : "Trash is empty"}
                        </p>
                        <p className="text-slate-400 text-xs mb-4">
                          {anyFilter ? "Try adjusting your search or filter." : "Deleted records will appear here for 30 days."}
                        </p>
                        {anyFilter && (
                          <button onClick={resetFilters}
                            className="px-5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold text-sm transition-all">
                            Clear Filters
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    pageData.map((r, idx) => (
                      <tr key={`${r.entityType}-${r.publicId}`}
                        className="group transition-all duration-150 hover:bg-blue-50/20 hover:shadow-[inset_3px_0_0_#64748b]"
                        style={{ animation:"fadeUp .35s ease both", animationDelay:`${idx*20}ms` }}>
                        {/* Type badge */}
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full border ${badgeFor(r.entityType)}`}>
                            {r.module}
                          </span>
                        </td>
                        {/* Label */}
                        <td className="px-4 py-3.5">
                          <p className="text-sm font-bold text-slate-700 max-w-[280px] truncate" title={r.label}>
                            {r.label || "—"}
                          </p>
                        </td>
                        {/* Deleted by */}
                        <td className="px-4 py-3.5 text-sm text-slate-600">
                          {r.deletedBy || "—"}
                        </td>
                        {/* Deleted at */}
                        <td className="px-4 py-3.5 text-sm text-slate-500 whitespace-nowrap">
                          {fmtDateTime(r.deletedAt)}
                        </td>
                        {/* Auto-purge countdown */}
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${purgeStyle(r.daysUntilPurge)}`}>
                            <Clock size={11}/> {purgeLabel(r.daysUntilPurge)}
                          </span>
                        </td>
                        {/* Actions */}
                        <td className="px-4 py-3.5">
                          <RowActions row={r}/>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ── MOBILE CARDS (list view) ── */}
          {!error && view === "list" && (
            <div className="md:hidden p-4 space-y-3">
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3 animate-pulse">
                    {[...Array(4)].map((_, j) => (
                      <div key={j} className="h-4 rounded-lg bg-slate-200"
                        style={{ width: `${40 + Math.random() * 45}%` }}/>
                    ))}
                  </div>
                ))
              ) : pageData.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                    <Inbox size={24}/>
                  </div>
                  <p className="text-slate-400 font-semibold text-sm">
                    {anyFilter ? "No items match your filters" : "Trash is empty"}
                  </p>
                  {anyFilter && (
                    <button onClick={resetFilters}
                      className="mt-3 px-4 py-2 rounded-xl bg-blue-50 text-blue-600 font-bold text-sm">
                      Clear Filters
                    </button>
                  )}
                </div>
              ) : (
                pageData.map(renderCard)
              )}
            </div>
          )}

          {/* ── GRID VIEW (all breakpoints) ── */}
          {!error && view === "grid" && (
            <div className="p-4 sm:p-5">
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 h-44 animate-pulse"/>
                  ))}
                </div>
              ) : pageData.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
                    <Inbox size={28}/>
                  </div>
                  <p className="text-slate-500 font-bold text-sm mb-2">
                    {anyFilter ? "No items match your filters" : "Trash is empty"}
                  </p>
                  <p className="text-slate-400 text-xs mb-4">
                    {anyFilter ? "Try adjusting your search or filter." : "Deleted records will appear here for 30 days."}
                  </p>
                  {anyFilter && (
                    <button onClick={resetFilters}
                      className="px-5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold text-sm transition-all">
                      Clear Filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {pageData.map(renderCard)}
                </div>
              )}
            </div>
          )}

          {/* ── PAGINATION ──
              The whole "MAIN CARD" wrapper above has overflow-hidden. On
              mobile the old markup (« ‹ 1 … n › » all in one flex row with
              no wrap and no scroll) could add up to wider than the phone
              screen — anything past the card's edge was silently clipped by
              that overflow-hidden, which is exactly what made the arrows
              disappear. Small screens now get a compact prev/next + "Page X
              of Y" control that can never overflow; the full first/prev/
              numbers/next/last row is back from sm upward. */}
          {!error && !loading && filtered.length > 0 && (
            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/60
              flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-slate-400 font-medium">
                Showing{" "}
                <span className="font-bold text-slate-600">{(safePage-1)*PER_PAGE+1}</span>–
                <span className="font-bold text-slate-600">{Math.min(safePage*PER_PAGE,filtered.length)}</span>
                {" "}of{" "}
                <span className="font-bold text-slate-600">{filtered.length}</span>
              </p>

              {/* Compact control — mobile only */}
              <div className="flex sm:hidden items-center gap-2">
                <button disabled={safePage===1} onClick={()=>setPage(p=>Math.max(1,p-1))}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600
                    hover:border-blue-300 hover:text-blue-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  <ChevronLeft size={16}/>
                </button>
                <span className="text-xs font-bold text-slate-600 px-2 whitespace-nowrap">
                  Page {safePage} of {totalPages}
                </span>
                <button disabled={safePage===totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600
                    hover:border-blue-300 hover:text-blue-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  <ChevronRight size={16}/>
                </button>
              </div>

              {/* Full control with page numbers — sm and up */}
              <div className="hidden sm:flex items-center gap-1.5">
                <button disabled={safePage===1} onClick={()=>setPage(1)}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 text-xs font-bold
                    hover:border-blue-300 hover:text-blue-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  «
                </button>
                <button disabled={safePage===1} onClick={()=>setPage(p=>Math.max(1,p-1))}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 text-xs font-bold
                    hover:border-blue-300 hover:text-blue-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  ‹
                </button>
                {pageNumbers.map((p,i) =>
                  typeof p==="string"
                    ? <span key={`e${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-slate-400">…</span>
                    : <button key={p} onClick={()=>setPage(p)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all border
                          ${safePage===p
                            ?"bg-blue-600 border-blue-600 text-white shadow-sm"
                            :"bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600"}`}>
                        {p}
                      </button>
                )}
                <button disabled={safePage===totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 text-xs font-bold
                    hover:border-blue-300 hover:text-blue-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  ›
                </button>
                <button disabled={safePage===totalPages} onClick={()=>setPage(totalPages)}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 text-xs font-bold
                    hover:border-blue-300 hover:text-blue-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  »
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── MODALS ── */}
      <RestoreModal
        row={restoreTarget}
        busy={busy}
        onConfirm={confirmRestore}
        onClose={() => !busy && setRestoreTarget(null)}
      />
      <DeleteModal
        row={deleteTarget}
        busy={busy}
        confirmText={confirmText}
        setConfirmText={setConfirmText}
        onConfirm={confirmDelete}
        onClose={() => { if (!busy) { setDeleteTarget(null); setConfirmText(""); } }}
      />
    </div>
  );
}