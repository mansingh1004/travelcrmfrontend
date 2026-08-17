// import { useNavigate } from "react-router-dom";
// import { useState, useMemo, useEffect, useCallback } from "react";
// import customerService from "../api/customerService";
// import { Users as FaUsers, UserCheck as FaUserCheck, Crown as FaCrown, IndianRupee as FaRupeeSign, Plane as FaPlane, RotateCw as FaRedoAlt, SquarePen as FaEdit, Trash2 as FaTrash, Eye as FaEye, Search as FaSearch, X as FaTimes, Download as FaDownload, UserPlus as FaUserPlus, ArrowUpDown as FaSort, ChevronUp as FaSortUp, ChevronDown as FaSortDown, MapPin as FaMapMarkerAlt, Mail as FaEnvelope, Smartphone as FaMobileAlt, Calendar as FaCalendarAlt, ChevronLeft as FaChevronLeft, ChevronRight as FaChevronRight, ChevronsLeft as FaAngleDoubleLeft, ChevronsRight as FaAngleDoubleRight, History as FaHistory, StickyNote as FaStickyNote, Share2 as FaShareAlt, Building as MdLocationCity } from "lucide-react";
// import { WhatsAppIcon as FaWhatsapp } from "@shared/ui/WhatsAppIcon";
// import { GridStyles, GridHead, GridRow, Cell, Avatar, GridSkeleton, GridEmpty } from "@shared/ui/gridTable";

// // Leads-directory grid columns (Customer, Contact, City, Type, Loyalty, Bookings, Spent, Status, Actions)
// const CUST_COLS = "1.7fr 1.3fr 0.8fr 0.7fr 0.95fr 0.6fr 1fr 0.85fr 150px";


// /* ─── BOOKING HISTORY MOCK (keep until backend booking history API ready) ── */
// const BOOKING_HISTORY = {
//   CUS001:[{code:"BK9001",dest:"Maldives",date:"2026-04-12",amt:125000,status:"Completed"}],
//   CUS005:[{code:"BK9032",dest:"Dubai Explorer",date:"2026-05-15",amt:185000,status:"Confirmed"}],
// };

// /* ─── HELPERS ────────────────────────────────────────────────── */
// const fmtINR   = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
// const fmtDate  = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) : "—";
// const initials = (name) => (name || "").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";

// const TIER_CONFIG = {
//   Platinum:{ bg:"bg-slate-800",  text:"text-slate-100", dot:"bg-slate-300", icon:"💎", border:"border-slate-400" },
//   Gold:    { bg:"bg-yellow-100", text:"text-yellow-800", dot:"bg-yellow-500", icon:"🥇", border:"border-yellow-400" },
//   Silver:  { bg:"bg-slate-100",  text:"text-slate-700", dot:"bg-slate-400", icon:"🥈", border:"border-slate-300" },
//   Bronze:  { bg:"bg-orange-100", text:"text-orange-700", dot:"bg-orange-400", icon:"🥉", border:"border-orange-300" },
// };
// const TYPE_CONFIG = {
//   VIP:      { bg:"bg-purple-100", text:"text-purple-700", border:"border-purple-200" },
//   Corporate:{ bg:"bg-blue-100",   text:"text-blue-700",   border:"border-blue-200"   },
//   Regular:  { bg:"bg-green-100",  text:"text-green-700",  border:"border-green-200"  },
// };
// const STATUS_CONFIG = {
//   Active:  { bg:"bg-emerald-100", text:"text-emerald-700", dot:"bg-emerald-500" },
//   Inactive:{ bg:"bg-slate-100",   text:"text-slate-500",   dot:"bg-slate-400"   },
//   Blocked: { bg:"bg-red-100",     text:"text-red-600",     dot:"bg-red-500"     },
// };
// const AVATAR_COLORS = [
//   "from-blue-500 to-blue-600","from-purple-500 to-purple-600","from-teal-500 to-teal-600",
//   "from-rose-500 to-rose-600","from-amber-500 to-amber-600","from-indigo-500 to-indigo-600",
//   "from-green-500 to-green-600","from-cyan-500 to-cyan-600","from-pink-500 to-pink-600",
//   "from-orange-500 to-orange-600",
// ];
// const avatarGrad = (id) => {
//   const n = parseInt(String(id).replace(/\D/g, ""), 10) || 0;
//   return AVATAR_COLORS[n % AVATAR_COLORS.length];
// };

// /* ─── VIEW MODAL (read-only — Edit → navigate) ───────────────── */
// function ViewModal({ customer, onClose, onNavigateEdit }) {
//   if (!customer) return null;
//   const tc  = TIER_CONFIG[customer.tier]    || TIER_CONFIG.Bronze;
//   const tyc = TYPE_CONFIG[customer.type]    || TYPE_CONFIG.Regular;
//   const sc  = STATUS_CONFIG[customer.status]|| STATUS_CONFIG.Inactive;
//   const history = BOOKING_HISTORY[customer.id] || [];
//   const grad = avatarGrad(customer.id);

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
//       <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}/>
//       <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto z-10"
//         style={{ animation:"popIn .25s ease both" }}>
//         {/* Header */}
//         <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-5 rounded-t-3xl">
//           <div className="flex items-start justify-between">
//             <div className="flex items-center gap-4">
//               <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${grad} flex items-center justify-center text-white text-xl font-extrabold shadow-lg flex-shrink-0`}>
//                 {initials(customer.name)}
//               </div>
//               <div>
//                 <div className="flex items-center gap-2 mb-1">
//                   <h2 className="text-white text-xl font-extrabold">{customer.name}</h2>
//                   {customer.type === "VIP" && <span className="text-yellow-400 text-lg">👑</span>}
//                 </div>
//                 <p className="text-slate-400 text-sm font-medium">{customer.id}</p>
//                 <div className="flex items-center gap-2 mt-1.5 flex-wrap">
//                   <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${tc.border} ${tc.bg} ${tc.text}`}>{tc.icon} {customer.tier}</span>
//                   <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${tyc.border} ${tyc.bg} ${tyc.text}`}>{customer.type}</span>
//                   <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
//                     <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}/>{customer.status}
//                   </span>
//                 </div>
//               </div>
//             </div>
//             <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-lg transition-all flex-shrink-0">×</button>
//           </div>
//         </div>

//         <div className="p-6 space-y-5">
//           {/* Contact info */}
//           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//             {[
//               [FaMobileAlt,    "Phone",        customer.phone, "bg-green-50 text-green-600"],
//               [FaEnvelope,     "Email",        customer.email, "bg-blue-50 text-blue-600"],
//               [MdLocationCity, "City",         customer.city,  "bg-purple-50 text-purple-600"],
//               [FaMapMarkerAlt, "State",        customer.state, "bg-orange-50 text-orange-600"],
//               [FaCalendarAlt,  "Last Booking", fmtDate(customer.lastBooking), "bg-teal-50 text-teal-600"],
//               [FaPlane,        "Total Trips",  `${customer.bookings || 0} Bookings`, "bg-indigo-50 text-indigo-600"],
//             ].map(([Icon, label, val, ic]) => (
//               <div key={label} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
//                 <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${ic}`}>
//                   <Icon className="w-3.5 h-3.5"/>
//                 </div>
//                 <div className="min-w-0">
//                   <p className="text-xs text-slate-400 font-medium">{label}</p>
//                   <p className="text-sm font-bold text-slate-700 truncate">{val || "—"}</p>
//                 </div>
//               </div>
//             ))}
//           </div>

//           {/* Total spent */}
//           <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-2xl p-4 flex items-center justify-between">
//             <div>
//               <p className="text-blue-200 text-xs font-bold uppercase tracking-widest">Total Lifetime Spent</p>
//               <p className="text-white text-2xl font-extrabold mt-0.5">{fmtINR(customer.spent)}</p>
//             </div>
//             <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-2xl">💰</div>
//           </div>

//           {/* Booking history */}
//           {history.length > 0 && (
//             <div>
//               <p className="text-sm font-extrabold text-slate-700 mb-3 flex items-center gap-2">
//                 <FaHistory className="text-blue-500"/> Booking History
//               </p>
//               <div className="space-y-2">
//                 {history.map(h => (
//                   <div key={h.code} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
//                     <div className="flex items-center gap-3">
//                       <span className="text-xs font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">{h.code}</span>
//                       <span className="text-sm font-semibold text-slate-700">{h.dest}</span>
//                     </div>
//                     <div className="flex items-center gap-3 text-right">
//                       <span className="text-xs text-slate-400">{fmtDate(h.date)}</span>
//                       <span className="text-sm font-extrabold text-slate-800">{fmtINR(h.amt)}</span>
//                       <span className={`text-xs font-bold px-2 py-0.5 rounded-full
//                         ${h.status === "Completed" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
//                         {h.status}
//                       </span>
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             </div>
//           )}

//           {/* Notes */}
//           {customer.notes && (
//             <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
//               <p className="text-xs font-extrabold text-amber-700 mb-1.5 flex items-center gap-1.5">
//                 <FaStickyNote/> Customer Notes
//               </p>
//               <p className="text-sm text-amber-800 leading-relaxed">{customer.notes}</p>
//             </div>
//           )}

//           {/* Document info if present */}
//           {(customer.passportNo || customer.panNo || customer.aadharNo) && (
//             <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100">
//               <p className="text-xs font-extrabold text-indigo-700 mb-2">🗂️ Documents</p>
//               <div className="grid grid-cols-3 gap-2 text-xs text-indigo-800">
//                 {[["Passport", customer.passportNo], ["PAN", customer.panNo], ["Aadhar", customer.aadharNo]]
//                   .filter(([, v]) => v)
//                   .map(([l, v]) => (
//                     <div key={l} className="bg-white/70 rounded-lg px-3 py-2">
//                       <p className="text-indigo-400 text-[10px] mb-0.5">{l}</p>
//                       <p className="font-bold truncate">{v}</p>
//                     </div>
//                   ))}
//               </div>
//             </div>
//           )}

//           {/* Actions */}
//           <div className="flex flex-wrap gap-2.5 pt-1">
//             {/* Edit → navigate */}
//             <button onClick={() => { onClose(); onNavigateEdit(customer.id); }}
//               className="flex-1 min-w-[100px] py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500
//                 hover:from-indigo-700 hover:to-indigo-600 text-white text-sm font-bold flex items-center
//                 justify-center gap-2 shadow-md shadow-indigo-200 transition-all">
//               <FaEdit/> Edit
//             </button>
//             <a href={`https://wa.me/${(customer.phone || "").replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
//               className="flex-1 min-w-[100px] py-3 rounded-2xl bg-green-500 hover:bg-green-600 text-white
//                 text-sm font-bold flex items-center justify-center gap-2 transition-all">
//               <FaWhatsapp/> WhatsApp
//             </a>
//             <button className="flex-1 min-w-[100px] py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600
//               text-sm font-bold flex items-center justify-center gap-2 transition-all border border-slate-200">
//               <FaShareAlt/> Share
//             </button>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// /* ─── DELETE CONFIRM ─────────────────────────────────────────── */
// function DeleteConfirm({ customer, onClose, onConfirm }) {
//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
//       <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}/>
//       <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm z-10 p-6 text-center"
//         style={{ animation:"popIn .25s ease both" }}>
//         <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center text-3xl mx-auto mb-4">🗑️</div>
//         <h3 className="text-lg font-extrabold text-slate-800 mb-1">Delete Customer?</h3>
//         <p className="text-sm text-slate-500 mb-5">
//           Are you sure you want to delete{" "}
//           <span className="font-bold text-slate-700">{customer?.name}</span>? This action cannot be undone.
//         </p>
//         <div className="flex gap-3">
//           <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all">Cancel</button>
//           <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md shadow-red-200 transition-all">Yes, Delete</button>
//         </div>
//       </div>
//     </div>
//   );
// }

// /* ─── TOAST ──────────────────────────────────────────────────── */
// function Toast({ msg, type, onClose }) {
//   useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
//   return (
//     <div className={`fixed top-5 right-5 z-[999] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl max-w-xs
//       ${type === "success" ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}
//       style={{ animation:"slideIn .3s ease both" }}>
//       <span className="text-lg">{type === "success" ? "✅" : "❌"}</span>
//       <p className="text-sm font-semibold flex-1">{msg}</p>
//       <button onClick={onClose} className="opacity-50 hover:opacity-100 text-lg ml-1">×</button>
//     </div>
//   );
// }

// /* ─── STAT CARD ──────────────────────────────────────────────── */
// function StatCard({ icon: Icon, label, value, gradient, sub, delay = 0 }) {
//   const [displayed, setDisplayed] = useState(0);
//   const isINR = typeof value === "number" && value > 999;

//   useEffect(() => {
//     let start = 0;
//     const target = typeof value === "number" ? value : 0;
//     if (target === 0) { setDisplayed(0); return; }
//     const step = Math.ceil(target / 60);
//     const interval = setInterval(() => {
//       start = Math.min(start + step, target);
//       setDisplayed(start);
//       if (start >= target) clearInterval(interval);
//     }, 16);
//     return () => clearInterval(interval);
//   }, [value]);

//   const display = typeof value === "number"
//     ? (isINR ? fmtINR(displayed) : displayed.toLocaleString("en-IN"))
//     : value;

//   return (
//     <div className={`bg-gradient-to-br ${gradient} rounded-2xl p-5 text-white shadow-lg relative overflow-hidden group
//       hover:-translate-y-1 hover:shadow-xl transition-all duration-300 cursor-pointer`}
//       style={{ animationDelay:`${delay}ms` }}>
//       <div className="absolute -right-5 -top-5 w-24 h-24 rounded-full bg-white/10 group-hover:scale-110 transition-transform duration-300"/>
//       <div className="absolute -right-3 -bottom-8 w-32 h-32 rounded-full bg-white/10 group-hover:scale-110 transition-transform duration-300"/>
//       <div className="relative z-10">
//         <div className="flex items-start justify-between mb-3">
//           <div className="w-10 h-10 rounded-xl bg-white/20 group-hover:bg-white/30 flex items-center justify-center transition-all">
//             <Icon className="w-5 h-5"/>
//           </div>
//           {sub && <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">{sub}</span>}
//         </div>
//         <p className="text-2xl sm:text-3xl font-extrabold leading-none mb-1">{display}</p>
//         <p className="text-xs font-bold uppercase tracking-widest opacity-80">{label}</p>
//       </div>
//     </div>
//   );
// }

// /* ─── SKELETON ROW ───────────────────────────────────────────── */
// function SkeletonRow() {
//   return (
//     <tr>
//       {[...Array(9)].map((_, i) => (
//         <td key={i} className="px-4 py-4">
//           <div className="h-4 rounded-lg bg-slate-200 animate-pulse" style={{ width:`${40 + Math.random() * 50}%` }}/>
//         </td>
//       ))}
//     </tr>
//   );
// }

// /* ─── SELECT WRAPPER ─────────────────────────────────────────── */
// function Sel({ value, onChange, opts }) {
//   return (
//     <div className="relative">
//       <select value={value} onChange={e => onChange(e.target.value)}
//         className="w-full pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-600
//           font-medium focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none appearance-none cursor-pointer transition-all hover:border-slate-300">
//         {opts.map(o => <option key={o}>{o}</option>)}
//       </select>
//       <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none">▼</span>
//     </div>
//   );
// }

// /* ═════════════════════════════════════════════════════════════
//    MAIN COMPONENT
// ═════════════════════════════════════════════════════════════ */
// export default function Customers() {
//   const navigate = useNavigate();

//   const [customers, setCustomers] = useState([]);
//   const [search, setSearch]         = useState("");
//   const [filterStatus, setFStatus]  = useState("All Status");
//   const [filterType, setFType]      = useState("All Types");
//   const [filterTier, setFTier]      = useState("All Tiers");
//   const [sortKey, setSortKey]       = useState("name");
//   const [sortDir, setSortDir]       = useState("asc");
//   const [page, setPage]             = useState(1);
//   const perPage = 8;

//   const [viewCustomer, setView]      = useState(null);
//   const [deleteTarget, setDelTarget] = useState(null);
//   const [loading, setLoading]        = useState(true);
//   const [toast, setToast]            = useState(null);

//   const [customerStatsOpen, setCustomerStatsOpen] = useState(false);

//   const showToast = useCallback((msg, type = "success") => setToast({ msg, type }), []);

//   /* ── Load customers ── */
//   useEffect(() => {
//     setLoading(true);
//     customerService
//       .getAll()
//       .then((res) => {
//         const raw = res.data?.data ?? res.data ?? [];
//         setCustomers(Array.isArray(raw) ? raw : []);
//       })
//       .catch(() => showToast("Failed to load customers.", "error"))
//       .finally(() => setLoading(false));
//   }, [showToast]);

//   /* ── Stats ── */
//   const stats = useMemo(() => ({
//     total:    customers.length,
//     active:   customers.filter(c => c.status === "Active").length,
//     vip:      customers.filter(c => c.type === "VIP").length,
//     revenue:  customers.reduce((s, c) => s + (c.spent || 0), 0),
//     bookings: customers.reduce((s, c) => s + (c.bookings || 0), 0),
//     repeat:   customers.filter(c => (c.bookings || 0) >= 3).length,
//   }), [customers]);

//   /* ── Filter + sort ── */
//   const filtered = useMemo(() => {
//     let out = [...customers];
//     const q = search.toLowerCase();
//     if (q) out = out.filter(c =>
//       (c.name || "").toLowerCase().includes(q) ||
//       (c.id   || "").toLowerCase().includes(q) ||
//       (c.phone|| "").includes(q) ||
//       (c.email|| "").toLowerCase().includes(q) ||
//       (c.city || "").toLowerCase().includes(q)
//     );
//     if (filterStatus !== "All Status") out = out.filter(c => c.status === filterStatus);
//     if (filterType   !== "All Types")  out = out.filter(c => c.type   === filterType);
//     if (filterTier   !== "All Tiers")  out = out.filter(c => c.tier   === filterTier);
//     out.sort((a, b) => {
//       let av = a[sortKey], bv = b[sortKey];
//       if (typeof av === "string") { av = av.toLowerCase(); bv = bv.toLowerCase(); }
//       if (av < bv) return sortDir === "asc" ? -1 : 1;
//       if (av > bv) return sortDir === "asc" ?  1 : -1;
//       return 0;
//     });
//     return out;
//   }, [customers, search, filterStatus, filterType, filterTier, sortKey, sortDir]);

//   const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
//   const pageData   = filtered.slice((page - 1) * perPage, page * perPage);
//   const anyFilter  = search || filterStatus !== "All Status" || filterType !== "All Types" || filterTier !== "All Tiers";

//   const handleSort = key => {
//     if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
//     else { setSortKey(key); setSortDir("asc"); }
//   };
//   const SortIcon = ({ k }) => {
//     if (sortKey !== k) return <FaSort className="opacity-30 inline ml-1 text-xs"/>;
//     return sortDir === "asc" ? <FaSortUp className="inline ml-1 text-blue-500 text-xs"/> : <FaSortDown className="inline ml-1 text-blue-500 text-xs"/>;
//   };

//   const resetFilters = () => { setSearch(""); setFStatus("All Status"); setFType("All Types"); setFTier("All Tiers"); setPage(1); };

//   /* ── Navigate to Edit page ── */
//   const handleNavigateEdit = useCallback((customerId) => {
//     navigate(`/EditCustomer/${customerId}`);
//   }, [navigate]);

//   /* ── Delete ── */
//   const handleDelete = async () => {
//     try {
//       await customerService.delete(deleteTarget.id);
//       setCustomers(prev => prev.filter(c => c.id !== deleteTarget.id));
//       showToast(`${deleteTarget.name} deleted.`);
//     } catch {
//       showToast("Failed to delete customer.", "error");
//     }
//     setDelTarget(null);
//   };

//   /* ── Export CSV ── */
//   const handleExport = async () => {
//     try {
//       const res = await customerService.exportCSV();
//       const url = URL.createObjectURL(new Blob([res.data]));
//       const a = document.createElement("a");
//       a.href = url; a.download = "customers.csv"; a.click();
//       showToast("Customers exported to CSV.");
//     } catch {
//       showToast("Export failed.", "error");
//     }
//   };

//   /* ── RENDER ──────────────────────────────────────────────── */
//   return (
//     <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 font-sans"
//       style={{ fontFamily:"'Plus Jakarta Sans', system-ui, sans-serif" }}>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
//         @keyframes slideIn { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
//         @keyframes fadeUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
//         @keyframes popIn   { from{transform:scale(.92);opacity:0} to{transform:scale(1);opacity:1} }
//         .fade-up { animation: fadeUp .4s ease both; }
//       `}</style>
//       <GridStyles/>

//       {/* Modals + Toast */}
//       {toast        && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)}/>}
//       {viewCustomer && <ViewModal customer={viewCustomer} onClose={() => setView(null)} onNavigateEdit={handleNavigateEdit}/>}
//       {deleteTarget && <DeleteConfirm customer={deleteTarget} onClose={() => setDelTarget(null)} onConfirm={handleDelete}/>}

//       {/* ── PAGE HEADER ── */}
//       <div className="bg-white/70 backdrop-blur-md border-b border-slate-100">
//         <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5">
//           <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
//             <div className="flex items-center gap-4">
//               <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-white text-2xl shadow-lg shadow-blue-200">
//                 <FaUsers/>
//               </div>
//               <div>
//                 <h1 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
//                   Customer Management
//                   <span className="hidden sm:inline text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">{customers.length} total</span>
//                 </h1>
//                 <p className="text-sm text-slate-400 mt-0.5">Manage your travel customers, loyalty tiers & history</p>
//               </div>
//             </div>
//             <div className="flex items-center gap-2">
//               <button onClick={handleExport}
//                 className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-blue-300 bg-white hover:bg-blue-50
//                   text-slate-600 hover:text-blue-600 text-sm font-bold transition-all shadow-sm">
//                 <FaDownload className="w-3.5 h-3.5"/> Export
//               </button>
//               <button onClick={() => navigate("/Createcustomer")}
//                 className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold
//                   shadow-md shadow-blue-200 hover:shadow-lg transition-all">
//                 <FaUserPlus className="w-3.5 h-3.5"/> Add Customer
//               </button>
//             </div>
//           </div>
//         </div>
//       </div>

//       <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">

//         {/* ── STAT CARDS ── */}
//         {/* <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
//           {[
//             { icon:FaUsers,     label:"Total Customers", value:stats.total,    gradient:"from-cyan-500 to-cyan-600",    delay:0   },
//             { icon:FaUserCheck, label:"Active Customers",value:stats.active,   gradient:"from-green-500 to-emerald-600",delay:60  },
//             { icon:FaCrown,     label:"VIP Customers",   value:stats.vip,      gradient:"from-amber-500 to-orange-500", delay:120 },
//             { icon:FaRupeeSign, label:"Total Revenue",   value:stats.revenue,  gradient:"from-blue-600 to-blue-700",    delay:180 },
//             { icon:FaPlane,     label:"Total Bookings",  value:stats.bookings, gradient:"from-indigo-500 to-indigo-600",delay:240 },
//             { icon:FaRedoAlt,   label:"Repeat Customers",value:stats.repeat,   gradient:"from-rose-500 to-pink-600",    delay:300, sub:"3+ trips" },
//           ].map(c => (
//             <div key={c.label} className="fade-up" style={{ animationDelay:`${c.delay}ms` }}>
//               <StatCard {...c}/>
//             </div>
//           ))}
//         </div> */}

//         {/* ── COLLAPSIBLE CUSTOMER ANALYTICS ── */}
// <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden fade-up">

//   {/* Toggle header */}
//   <button
//     type="button"
//     onClick={() => setCustomerStatsOpen((previous) => !previous)}
//     aria-expanded={customerStatsOpen}
//     className="w-full px-4 sm:px-5 py-3 flex items-center justify-between gap-3
//       hover:bg-slate-50 transition-colors"
//   >
//     <div className="flex items-center gap-3 flex-wrap min-w-0">
//       <div className="flex items-center gap-2">
//         <FaUsers className="w-4 h-4 text-blue-600" />

//         <span className="text-sm font-extrabold text-slate-700">
//           Customer Analytics
//         </span>
//       </div>

//       {/* Compact values visible when cards are closed */}
//       {!customerStatsOpen && (
//         <div className="flex items-center gap-2 flex-wrap">
//           <span className="px-2.5 py-1 rounded-full bg-cyan-100 text-cyan-700 text-[11px] font-bold">
//             {stats.total} Customers
//           </span>

//           <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-[11px] font-bold">
//             {stats.active} Active
//           </span>

//           <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold">
//             {stats.vip} VIP
//           </span>

//           <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold">
//             Revenue {fmtINR(stats.revenue)}
//           </span>

//           <span className="px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-bold">
//             {stats.bookings} Bookings
//           </span>

//           <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 text-[11px] font-bold">
//             {stats.repeat} Repeat
//           </span>
//         </div>
//       )}
//     </div>

//     <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
//       {customerStatsOpen ? (
//         <FaSortUp className="w-4 h-4" />
//       ) : (
//         <FaSortDown className="w-4 h-4" />
//       )}
//     </div>
//   </button>

//   {/* Expandable six cards */}
//   <div
//     className={`grid transition-all duration-300 ease-in-out ${
//       customerStatsOpen
//         ? "grid-rows-[1fr] opacity-100"
//         : "grid-rows-[0fr] opacity-0"
//     }`}
//   >
//     <div className="min-h-0 overflow-hidden">
//       <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 p-4 pt-1">
//         {[
//           {
//             icon: FaUsers,
//             label: "Total Customers",
//             value: stats.total,
//             gradient: "from-cyan-500 to-cyan-600",
//             delay: 0,
//           },
//           {
//             icon: FaUserCheck,
//             label: "Active Customers",
//             value: stats.active,
//             gradient: "from-green-500 to-emerald-600",
//             delay: 60,
//           },
//           {
//             icon: FaCrown,
//             label: "VIP Customers",
//             value: stats.vip,
//             gradient: "from-amber-500 to-orange-500",
//             delay: 120,
//           },
//           {
//             icon: FaRupeeSign,
//             label: "Total Revenue",
//             value: stats.revenue,
//             gradient: "from-blue-600 to-blue-700",
//             delay: 180,
//           },
//           {
//             icon: FaPlane,
//             label: "Total Bookings",
//             value: stats.bookings,
//             gradient: "from-indigo-500 to-indigo-600",
//             delay: 240,
//           },
//           {
//             icon: FaRedoAlt,
//             label: "Repeat Customers",
//             value: stats.repeat,
//             gradient: "from-rose-500 to-pink-600",
//             delay: 300,
//             sub: "3+ trips",
//           },
//         ].map((c) => (
//           <div
//             key={c.label}
//             className="fade-up"
//             style={{ animationDelay: `${c.delay}ms` }}
//           >
//             <StatCard {...c} />
//           </div>
//         ))}
//       </div>
//     </div>
//   </div>
// </div>

//         {/* ── CUSTOMER LIST CARD ── */}
//         <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">

//           {/* List header */}
//           <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
//             <div className="flex items-center gap-3 flex-wrap">
//               <h2 className="text-base font-extrabold text-slate-700">Customer List</h2>
//               <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2.5 py-1 rounded-full">{filtered.length} results</span>
//             </div>
//             {anyFilter && (
//               <button onClick={resetFilters}
//                 className="text-xs text-slate-400 hover:text-red-500 font-bold flex items-center gap-1.5 transition-colors">
//                 <FaTimes/> Clear all filters
//               </button>
//             )}
//           </div>

//           {/* Filters */}
//           <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60">
//             <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
//               <div className="relative flex-1 min-w-[200px]">
//                 <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"/>
//                 <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
//                   placeholder="Search by name, ID, phone, email, city..."
//                   className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder-slate-400
//                     focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none transition-all"/>
//               </div>
//               <Sel value={filterStatus} onChange={v => { setFStatus(v); setPage(1); }} opts={["All Status","Active","Inactive","Blocked"]}/>
//               <Sel value={filterType}   onChange={v => { setFType(v);   setPage(1); }} opts={["All Types","Regular","Corporate","VIP"]}/>
//               <Sel value={filterTier}   onChange={v => { setFTier(v);   setPage(1); }} opts={["All Tiers","Platinum","Gold","Silver","Bronze"]}/>
//             </div>
//           </div>

//           {/* ── DESKTOP GRID (Leads-directory style, no expandable) ── */}
//           <GridHead cols={CUST_COLS} bp="lg">
//             {[
//               { label:"Customer",    key:"name",     first:true },
//               { label:"Contact",     key:null   },
//               { label:"City",        key:"city" },
//               { label:"Type",        key:"type" },
//               { label:"Loyalty",     key:"tier" },
//               { label:"Bookings",    key:"bookings", right:true },
//               { label:"Total Spent", key:"spent",    right:true },
//               { label:"Status",      key:"status" },
//               { label:"Actions",     key:null,       right:true },
//             ].map(({ label, key, first, right }) => (
//               <Cell key={label} first={first} right={right} className={key ? "cursor-pointer hover:text-blue-600 select-none" : ""}>
//                 <span onClick={key ? () => handleSort(key) : undefined}>{label}{key && <SortIcon k={key}/>}</span>
//               </Cell>
//             ))}
//           </GridHead>

//           <div className="hidden lg:block">
//             {loading
//               ? <GridSkeleton cols={CUST_COLS} rows={6} />
//               : pageData.length === 0
//               ? <GridEmpty icon={FaUsers} title="No Customers Found"
//                   hint={anyFilter ? "Try adjusting your search or filters." : "Start by adding your first customer."}
//                   action={anyFilter
//                     ? <button onClick={resetFilters} className="px-4 py-2 rounded-xl bg-blue-50 text-blue-600 font-bold text-sm hover:bg-blue-100 transition-all">Clear Filters</button>
//                     : <button onClick={() => navigate("/Createcustomer")} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-md shadow-blue-200 hover:bg-blue-700 transition-all inline-flex items-center gap-2"><FaUserPlus/> Add First Customer</button>}/>
//               : pageData.map((c, idx) => {
//                 const tc  = TIER_CONFIG[c.tier]    || TIER_CONFIG.Bronze;
//                 const tyc = TYPE_CONFIG[c.type]    || TYPE_CONFIG.Regular;
//                 const sc  = STATUS_CONFIG[c.status]|| STATUS_CONFIG.Inactive;
//                 const grad = avatarGrad(c.id);
//                 return (
//                   <GridRow key={c.id} cols={CUST_COLS} bp="lg" index={idx}>
//                     {/* Customer */}
//                     <Cell first>
//                       <Avatar initials={initials(c.name)} gradient={grad}/>
//                       <div className="ml-3 min-w-0">
//                         <div className="flex items-center gap-1.5">
//                           <p className="text-sm font-bold text-slate-800 truncate">{c.name}</p>
//                           {c.type === "VIP" && <FaCrown className="w-3 h-3 text-amber-500 flex-shrink-0"/>}
//                         </div>
//                         <p className="text-xs text-blue-600 font-bold">{c.id}</p>
//                       </div>
//                     </Cell>
//                     {/* Contact */}
//                     <Cell>
//                       <div className="min-w-0 w-full">
//                         <p className="text-xs font-semibold text-slate-600 flex items-center gap-1 justify-center"><FaMobileAlt className="text-slate-400 flex-shrink-0"/> {c.phone}</p>
//                         <p className="text-xs text-slate-400 mt-0.5 truncate text-center">{c.email}</p>
//                       </div>
//                     </Cell>
//                     {/* City */}
//                     <Cell>
//                       <div className="text-center min-w-0">
//                         <p className="text-sm font-semibold text-slate-600 truncate">{c.city || "—"}</p>
//                         <p className="text-xs text-slate-400 truncate">{c.state}</p>
//                       </div>
//                     </Cell>
//                     {/* Type */}
//                     <Cell><span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${tyc.border} ${tyc.bg} ${tyc.text}`}>{c.type}</span></Cell>
//                     {/* Tier */}
//                     <Cell><span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${tc.border} ${tc.bg} ${tc.text}`}>{tc.icon} {c.tier}</span></Cell>
//                     {/* Bookings */}
//                     <Cell right><span className="text-sm font-extrabold text-slate-700">{c.bookings || 0}</span></Cell>
//                     {/* Spent */}
//                     <Cell right>
//                       <div className="text-right">
//                         <p className="text-sm font-extrabold text-slate-800">{fmtINR(c.spent)}</p>
//                         <p className="text-[11px] text-slate-400">Last: {fmtDate(c.lastBooking)}</p>
//                       </div>
//                     </Cell>
//                     {/* Status */}
//                     <Cell><span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-full ${sc.bg} ${sc.text}`}><span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}/>{c.status}</span></Cell>
//                     {/* Actions */}
//                     <Cell right>
//                       <div className="flex items-center justify-end gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
//                         <button onClick={() => navigate(`/CustomerDetails/${c.id}`)} title="View" className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition-all text-sm"><FaEye/></button>
//                         <button onClick={() => handleNavigateEdit(c.id)} title="Edit" className="w-8 h-8 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 flex items-center justify-center transition-all text-sm"><FaEdit/></button>
//                         <a href={`https://wa.me/${(c.phone || "").replace(/\D/g, "")}`} target="_blank" rel="noreferrer" title="WhatsApp" className="w-8 h-8 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 flex items-center justify-center transition-all text-sm"><FaWhatsapp/></a>
//                         <button onClick={() => setDelTarget(c)} title="Delete" className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 flex items-center justify-center transition-all text-sm"><FaTrash/></button>
//                       </div>
//                     </Cell>
//                   </GridRow>
//                 );
//               })}
//           </div>

//           {/* ── MOBILE / TABLET CARDS ── */}
//           <div className="lg:hidden p-4 space-y-3">
//             {loading
//               ? [...Array(4)].map((_, i) => (
//                   <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
//                     {[...Array(4)].map((_, j) => <div key={j} className="h-4 rounded-lg bg-slate-200 animate-pulse" style={{ width:`${40 + Math.random() * 50}%` }}/>)}
//                   </div>
//                 ))
//               : pageData.length === 0
//               ? (
//                 <div className="text-center py-16">
//                   <div className="text-5xl mb-3">👥</div>
//                   <p className="text-base font-extrabold text-slate-600 mb-1">No Customers Found</p>
//                   <p className="text-sm text-slate-400 mb-4">{anyFilter ? "Adjust filters to see results." : "Add your first customer."}</p>
//                   {!anyFilter && <button onClick={() => navigate("/Createcustomer")} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm">+ Add Customer</button>}
//                 </div>
//               )
//               : pageData.map((c, idx) => {
//                 const tc  = TIER_CONFIG[c.tier]    || TIER_CONFIG.Bronze;
//                 const tyc = TYPE_CONFIG[c.type]    || TYPE_CONFIG.Regular;
//                 const sc  = STATUS_CONFIG[c.status]|| STATUS_CONFIG.Inactive;
//                 const grad = avatarGrad(c.id);
//                 return (
//                   <div key={c.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3 fade-up" style={{ animationDelay:`${idx * 40}ms` }}>
//                     <div className="flex items-start justify-between">
//                       <div className="flex items-center gap-3">
//                         <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center text-white text-sm font-extrabold flex-shrink-0`}>
//                           {initials(c.name)}
//                         </div>
//                         <div>
//                           <div className="flex items-center gap-1.5">
//                             <p className="font-extrabold text-slate-800 text-sm">{c.name}</p>
//                             {c.type === "VIP" && <FaCrown className="w-3 h-3 text-amber-500"/>}
//                           </div>
//                           <p className="text-xs font-bold text-blue-600">{c.id}</p>
//                           <p className="text-xs text-slate-400">{c.city}, {c.state}</p>
//                         </div>
//                       </div>
//                       <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${sc.bg} ${sc.text}`}>
//                         <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}/>{c.status}
//                       </span>
//                     </div>
//                     <div className="grid grid-cols-2 gap-2 text-xs">
//                       <div className="bg-slate-50 rounded-lg px-3 py-2">
//                         <p className="text-slate-400">Phone</p>
//                         <p className="font-bold text-slate-700">{c.phone}</p>
//                       </div>
//                       <div className="bg-slate-50 rounded-lg px-3 py-2">
//                         <p className="text-slate-400">Total Spent</p>
//                         <p className="font-extrabold text-slate-800">{fmtINR(c.spent)}</p>
//                       </div>
//                       <div className="bg-slate-50 rounded-lg px-3 py-2">
//                         <p className="text-slate-400">Bookings</p>
//                         <p className="font-bold text-slate-700">{c.bookings || 0} trips</p>
//                       </div>
//                       <div className="bg-slate-50 rounded-lg px-3 py-2">
//                         <p className="text-slate-400">Last Booking</p>
//                         <p className="font-bold text-slate-700">{fmtDate(c.lastBooking)}</p>
//                       </div>
//                     </div>
//                     <div className="flex flex-wrap gap-1.5">
//                       <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${tyc.border} ${tyc.bg} ${tyc.text}`}>{c.type}</span>
//                       <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${tc.border} ${tc.bg} ${tc.text}`}>{tc.icon} {c.tier}</span>
//                     </div>
//                     <div className="flex gap-2">
//                       <button onClick={() => navigate(`/CustomerDetails/${c.id}`)} className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all">
//                         <FaEye/> View
//                       </button>
//                       {/* Edit → navigate */}
//                       <button onClick={() => handleNavigateEdit(c.id)} className="flex-1 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all">
//                         <FaEdit/> Edit
//                       </button>
//                       <a href={`https://wa.me/${(c.phone || "").replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
//                         className="flex-1 py-2 rounded-xl bg-green-50 hover:bg-green-100 text-green-600 border border-green-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all">
//                         <FaWhatsapp/> Chat
//                       </a>
//                       <button onClick={() => setDelTarget(c)} className="w-9 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 border border-red-200 text-xs font-bold flex items-center justify-center transition-all">
//                         <FaTrash/>
//                       </button>
//                     </div>
//                   </div>
//                 );
//               })
//             }
//           </div>

//           {/* ── PAGINATION ── */}
//           {filtered.length > 0 && (
//             <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3">
//               <p className="text-xs text-slate-400 font-medium">
//                 Showing <span className="font-bold text-slate-600">{(page-1)*perPage+1}</span>–<span className="font-bold text-slate-600">{Math.min(page*perPage,filtered.length)}</span> of <span className="font-bold text-slate-600">{filtered.length}</span> customers
//               </p>
//               <div className="flex items-center gap-1.5">
//                 <button disabled={page===1} onClick={()=>setPage(1)}
//                   className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center">
//                   <FaAngleDoubleLeft className="text-xs"/>
//                 </button>
//                 <button disabled={page===1} onClick={()=>setPage(p=>p-1)}
//                   className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center">
//                   <FaChevronLeft className="text-xs"/>
//                 </button>
//                 {Array.from({length:totalPages},(_,i)=>i+1)
//                   .filter(p=>p===1||p===totalPages||Math.abs(p-page)<=1)
//                   .reduce((acc,p,i,arr)=>{ if(i>0&&p-arr[i-1]>1) acc.push("…"); acc.push(p); return acc; },[])
//                   .map((p,i)=>
//                     typeof p==="string"
//                     ? <span key={`e${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-slate-400">…</span>
//                     : <button key={p} onClick={()=>setPage(p)}
//                         className={`w-8 h-8 rounded-lg text-xs font-bold transition-all border
//                           ${page===p?"bg-blue-600 border-blue-600 text-white shadow-sm":"bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600"}`}>
//                         {p}
//                       </button>
//                   )
//                 }
//                 <button disabled={page===totalPages} onClick={()=>setPage(p=>p+1)}
//                   className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center">
//                   <FaChevronRight className="text-xs"/>
//                 </button>
//                 <button disabled={page===totalPages} onClick={()=>setPage(totalPages)}
//                   className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center">
//                   <FaAngleDoubleRight className="text-xs"/>
//                 </button>
//               </div>
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }









import { useNavigate } from "react-router-dom";
import { useState, useMemo, useEffect, useCallback } from "react";
import customerService from "../api/customerService";
import { usePagedList } from "@shared/api/usePagedList";
import { Users as FaUsers, UserCheck as FaUserCheck, Crown as FaCrown, IndianRupee as FaRupeeSign, Plane as FaPlane, RotateCw as FaRedoAlt, SquarePen as FaEdit, Trash2 as FaTrash, Eye as FaEye, Search as FaSearch, Download as FaDownload, UserPlus as FaUserPlus, ArrowUpDown as FaSort, ChevronUp as FaSortUp, ChevronDown as FaSortDown, Filter as FaFilter, ChevronUp as FaChevronUp, ChevronDown as FaChevronDown, Smartphone as FaMobileAlt, ChevronLeft as FaChevronLeft, ChevronRight as FaChevronRight, ChevronsLeft as FaAngleDoubleLeft, ChevronsRight as FaAngleDoubleRight } from "lucide-react";
import { Mail as FaEnvelope } from "lucide-react";
import { WhatsAppIcon as FaWhatsapp } from "@shared/ui/WhatsAppIcon";
// The conversation drawer, through the whatsapp feature's barrel. Same component the leads list
// uses, so a message to a customer looks and behaves the same wherever it is written.
import { ConversationDrawer } from "@features/whatsapp";
import { GridStyles, GridHead, GridRow, Cell, Avatar, GridSkeleton, GridEmpty } from "@shared/ui/gridTable";
import { useToast } from "@shared/ui/toast";
import { hasPermission, hasModule, P } from "@shared/lib/access";

// Leads-directory grid columns (Customer, Contact, City, Type, Loyalty, Bookings, Spent, Status, Actions)
const CUST_COLS = "1.7fr 1.3fr 0.8fr 0.7fr 0.95fr 0.6fr 1fr 0.85fr 150px";

/* ─── HELPERS ────────────────────────────────────────────────── */
const fmtINR   = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
const fmtDate  = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) : "—";
const initials = (name) => (name || "").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";

const TIER_CONFIG = {
  Platinum:{ bg:"bg-slate-800",  text:"text-slate-100", dot:"bg-slate-300", icon:"💎", border:"border-slate-400" },
  Gold:    { bg:"bg-yellow-100", text:"text-yellow-800", dot:"bg-yellow-500", icon:"🥇", border:"border-yellow-400" },
  Silver:  { bg:"bg-slate-100",  text:"text-slate-700", dot:"bg-slate-400", icon:"🥈", border:"border-slate-300" },
  Bronze:  { bg:"bg-orange-100", text:"text-orange-700", dot:"bg-orange-400", icon:"🥉", border:"border-orange-300" },
};
/**
 * All SIX CustomerType values.
 *
 * This map used to hold three, so Individual — the default applied to every customer that does not
 * say otherwise — fell through to Regular's green chip and read as a type it was not. Group and
 * Agent did the same.
 */
const TYPE_CONFIG = {
  Individual:{ bg:"bg-slate-100",  text:"text-slate-700",  border:"border-slate-200"  },
  Regular:   { bg:"bg-green-100",  text:"text-green-700",  border:"border-green-200"  },
  Corporate: { bg:"bg-blue-100",   text:"text-blue-700",   border:"border-blue-200"   },
  VIP:       { bg:"bg-purple-100", text:"text-purple-700", border:"border-purple-200" },
  Group:     { bg:"bg-cyan-100",   text:"text-cyan-700",   border:"border-cyan-200"   },
  Agent:     { bg:"bg-amber-100",  text:"text-amber-700",  border:"border-amber-200"  },
};

/** Every CustomerType the backend accepts, so the filter cannot hide the commonest one. */
const TYPE_OPTIONS = ["All Types", "Individual", "Regular", "Corporate", "VIP", "Group", "Agent"];

/**
 * Columns the SERVER can actually sort by.
 *
 * The backend whitelist is {name, customerCode, phone, city, status, createdAt, updatedAt} and it
 * silently rewrites anything else to createdAt. The grid used to offer type / tier / bookings /
 * spent as well, so clicking those flipped the arrow while the server re-sorted by creation date.
 * `bookings` and `spent` are computed, not columns, so they cannot be added server-side as-is.
 */
const SORTABLE_KEYS = new Set(["name", "customerCode", "phone", "city", "status", "createdAt", "updatedAt"]);
const STATUS_CONFIG = {
  Active:  { bg:"bg-emerald-100", text:"text-emerald-700", dot:"bg-emerald-500" },
  Inactive:{ bg:"bg-slate-100",   text:"text-slate-500",   dot:"bg-slate-400"   },
  Blocked: { bg:"bg-red-100",     text:"text-red-600",     dot:"bg-red-500"     },
};
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

/* ─── DELETE CONFIRM ─────────────────────────────────────────── */
function DeleteConfirm({ customer, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm z-10 p-6 text-center"
        style={{ animation:"popIn .25s ease both" }}>
        <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center text-3xl mx-auto mb-4">🗑️</div>
        <h3 className="text-lg font-extrabold text-slate-800 mb-1">Delete Customer?</h3>
        <p className="text-sm text-slate-500 mb-5">
          Are you sure you want to delete <span className="font-bold text-slate-700">{customer?.name}</span>? This action cannot be undone.
        </p>
        <div className="flex gap-3 flex-wrap sm:flex-nowrap">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all w-full sm:w-auto">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md shadow-red-200 transition-all w-full sm:w-auto">Yes, Delete</button>
        </div>
      </div>
    </div>
  );
}

/* ─── STAT CARD ──────────────────────────────────────────────── */
/**
 * `currency` is explicit, not inferred.
 *
 * This used to decide with `value > 999`, so once a tenant passed a thousand customers the
 * "Total Customers" card rendered "₹1,000" — and the same for Active, VIP, Bookings and Repeat.
 * Only the caller knows whether a number is money.
 */
function StatCard({ icon: Icon, label, value, gradient, sub, delay = 0, currency = false }) {
  const [displayed, setDisplayed] = useState(0);
  const isINR = currency && typeof value === "number";

  useEffect(() => {
    let start = 0;
    const target = typeof value === "number" ? value : 0;
    if (target === 0) { setDisplayed(0); return; }
    const step = Math.ceil(target / 60);
    const interval = setInterval(() => {
      start = Math.min(start + step, target);
      setDisplayed(start);
      if (start >= target) clearInterval(interval);
    }, 16);
    return () => clearInterval(interval);
  }, [value]);

  const display = typeof value === "number"
    ? (isINR ? fmtINR(displayed) : displayed.toLocaleString("en-IN"))
    : value;

  return (
    <div className={`bg-gradient-to-br ${gradient} rounded-2xl p-4 sm:p-5 text-white shadow-lg relative overflow-hidden group
      hover:-translate-y-1 hover:shadow-xl transition-all duration-300 cursor-pointer w-full`}
      style={{ animationDelay:`${delay}ms` }}>
      <div className="absolute -right-5 -top-5 w-24 h-24 rounded-full bg-white/10 group-hover:scale-110 transition-transform duration-300"/>
      <div className="absolute -right-3 -bottom-8 w-32 h-32 rounded-full bg-white/10 group-hover:scale-110 transition-transform duration-300"/>
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 group-hover:bg-white/30 flex items-center justify-center transition-all flex-shrink-0">
            <Icon className="w-5 h-5"/>
          </div>
          {sub && <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full flex-shrink-0">{sub}</span>}
        </div>
        <p className="text-2xl sm:text-3xl font-extrabold leading-none mb-1 truncate">{display}</p>
        <p className="text-xs font-bold uppercase tracking-widest opacity-80 truncate">{label}</p>
      </div>
    </div>
  );
}

/* ─── SELECT WRAPPER ─────────────────────────────────────────── */
function Sel({ value, onChange, opts, className="w-full sm:w-auto flex-1 min-w-[120px]" }) {
  return (
    <div className={`relative ${className}`}>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-600
          font-medium focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none appearance-none cursor-pointer transition-all hover:border-slate-300">
        {opts.map(o => <option key={o}>{o}</option>)}
      </select>
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none">▼</span>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   MAIN COMPONENT
═════════════════════════════════════════════════════════════ */
export default function Customers() {
  const navigate = useNavigate();

  const [filterStatus, setFStatus]  = useState("All Status");
  const [filterType, setFType]      = useState("All Types");
  const [filterTier, setFTier]      = useState("All Tiers");
  const [sortKey, setSortKey]       = useState("name");
  const [sortDir, setSortDir]       = useState("asc");
  const [serverStats, setServerStats] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);   // collapsed by default, like All Bookings

  const [deleteTarget, setDelTarget] = useState(null);

  // { customer, channel } — which customer the conversation drawer is open on and which tab it
  // opened to. One state, not two: clicking Email on a customer whose WhatsApp drawer is already
  // open must switch the tab rather than stack a second panel.
  const [convo, setConvo] = useState(null);

  /* The drawer is a modal, so the Guard on /communication never runs for it — the gate has to be
     here or a plan without COMMUNICATION still shows comms buttons on every customer row. */
  const canMessage = hasPermission(P.COMM_READ) && hasModule("COMMUNICATION");

  const [customerStatsOpen, setCustomerStatsOpen] = useState(false);

  /* ── Permissions ──
     The list used to render Add / Edit / Delete / Export unconditionally while CustomerDetails
     gated all four, so the two screens disagreed about what a user could do. The backend is the
     real boundary either way; this just stops offering buttons that will 403. */
  const canCreateCustomer = hasPermission(P.CUSTOMER_CREATE);
  const canEditCustomer   = hasPermission(P.CUSTOMER_UPDATE);
  const canDeleteCustomer = hasPermission(P.CUSTOMER_DELETE);
  // /stats and /export are both CRM_FULL — a sub-agent gets 403 on each, and the shared
  // interceptor toasts 403s, so calling them unconditionally scolded sub-agents on every page load.
  const canSeeTenantWide  = hasPermission(P.CRM_FULL);

  const { showToast } = useToast();

  /* ── Server-side paged list ────────────────────────────────────────────────
     Search, the three filters, sorting and paging all run on the backend. Sub-agent row scoping
     is applied server-side too and cannot be widened from here by typing a search term. */
  const fetchCustomers = useCallback((params) => customerService.list(params), []);

  const {
    rows: customers, loading, error: listError,
    page, setPage, pageSize, setPageSize,
    q: search, setQ: setSearch,
    total, totalPages, reload,
  } = usePagedList(fetchCustomers, {
    size: 10,
    sortBy: sortKey,
    sortDir,
    filters: {
      status: filterStatus === "All Status" ? undefined : filterStatus,
      type:   filterType   === "All Types"  ? undefined : filterType,
      tier:   filterTier   === "All Tiers"  ? undefined : filterTier,
    },
  });

  useEffect(() => {
    if (listError) showToast("Failed to load customers.", "error");
  }, [listError, showToast]);

  /* ── Stats ──
     From GET /customers/stats, NOT from the rows on screen. These are tenant-wide COUNT/SUM
     figures; computing them from one page would make "Total Customers" mean "customers on this
     page" and understate revenue by however much the page happened to exclude. */
  useEffect(() => {
    // Skipped entirely without CRM_FULL rather than letting it 403 — see canSeeTenantWide.
    if (!canSeeTenantWide) return;
    customerService.getStats()
      .then(res => setServerStats(res.data?.data ?? res.data ?? null))
      .catch(() => setServerStats(null));   // cards degrade to 0, never a toast
  }, [canSeeTenantWide]);

  const stats = useMemo(() => ({
    total:    serverStats?.total ?? total ?? 0,
    active:   serverStats?.active ?? 0,
    vip:      serverStats?.vip ?? 0,
    revenue:  Number(serverStats?.totalRevenue ?? 0),
    bookings: serverStats?.totalBookings ?? 0,
    repeat:   serverStats?.repeatCustomers ?? 0,
  }), [serverStats, total]);

  // The server returns exactly the rows for this page, already narrowed and sorted — there is no
  // client-side `filtered` step any more.
  const filtered = customers;

  // `pageData` IS the server's page — no local slicing. `totalPages`/`total` come from the
  // response's pagination block, so the pager reflects the whole tenant, not what's in memory.
  const pageData   = filtered;
  const anyFilter  = search || filterStatus !== "All Status" || filterType !== "All Types" || filterTier !== "All Tiers";
  const activeFilterCount = [search, filterStatus !== "All Status", filterType !== "All Types",
    filterTier !== "All Tiers"].filter(Boolean).length;
  // Same input styling as the All Bookings filter panel, so the screens read as one product.
  const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder-slate-400 font-medium focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all hover:border-slate-300";

  const handleSort = key => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };
  const SortIcon = ({ k }) => {
    if (sortKey !== k) return <FaSort className="opacity-30 inline ml-1 text-xs"/>;
    return sortDir === "asc" ? <FaSortUp className="inline ml-1 text-blue-500 text-xs"/> : <FaSortDown className="inline ml-1 text-blue-500 text-xs"/>;
  };

  // No setPage here: usePagedList resets to page 0 itself whenever the query changes.
  const resetFilters = () => { setSearch(""); setFStatus("All Status"); setFType("All Types"); setFTier("All Tiers"); };

  /* ── Navigate ── */
  const handleNavigateEdit = useCallback((customerId) => {
    navigate(`/EditCustomer/${customerId}`);
  }, [navigate]);

  /** The full 360 profile. Previously this list opened a read-only modal instead, which is why
   *  /CustomerDetails/:id was reachable only from global search or a booking. */
  const handleNavigateView = useCallback((customerId) => {
    navigate(`/CustomerDetails/${customerId}`);
  }, [navigate]);

  /* ── Delete ── */
  const handleDelete = async () => {
    try {
      await customerService.delete(deleteTarget.id);
      // Re-query: deleting the last row on a page must pull the next page's rows up.
      await reload();
      // Stats are tenant-wide counts, so they go stale on a delete just like the page does.
      if (canSeeTenantWide) {
        customerService.getStats()
          .then(res => setServerStats(res.data?.data ?? res.data ?? null))
          .catch(() => {});
      }
      showToast(`${deleteTarget.name} deleted.`, "success");
    } catch {
      showToast("Failed to delete customer.", "error");
    }
    setDelTarget(null);
  };

  /* ── Export CSV ── */
  const handleExport = async () => {
    try {
      const res = await customerService.exportCSV();
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url; a.download = "customers.csv"; a.click();
      showToast("Customers exported to CSV.");
    } catch {
      showToast("Export failed.", "error");
    }
  };

  /* ── RENDER ──────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 font-sans"
      style={{ fontFamily:"'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes slideIn { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes popIn   { from{transform:scale(.92);opacity:0} to{transform:scale(1);opacity:1} }
        .fade-up { animation: fadeUp .4s ease both; }
      `}</style>
      <GridStyles/>

      {/* Toasts come from the app-wide <ToastHost/> mounted in App.jsx — this page used to carry
          its own local Toast component and state, which is the one convention every other screen
          follows through @shared/ui/toast. */}
      {deleteTarget && <DeleteConfirm customer={deleteTarget} onClose={() => setDelTarget(null)} onConfirm={handleDelete}/>}

      {/* ── PAGE HEADER ── */}
      <div className="bg-white/70 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-white text-2xl shadow-lg shadow-blue-200 flex-shrink-0">
                <FaUsers/>
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2 flex-wrap">
                  Customer Management
                  {/* `total` from the response's pagination block — `customers.length` is the page,
                      so this read "10 total" for a four-thousand-customer tenant. */}
                  <span className="inline-block text-[10px] sm:text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full whitespace-nowrap">{total} total</span>
                </h1>
                <p className="text-sm text-slate-400 mt-0.5 truncate">Manage your travel customers, loyalty tiers & history</p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {canSeeTenantWide && (
                <button onClick={handleExport}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-blue-300 bg-white hover:bg-blue-50
                    text-slate-600 hover:text-blue-600 text-sm font-bold transition-all shadow-sm">
                  <FaDownload className="w-3.5 h-3.5"/> Export
                </button>
              )}
              {canCreateCustomer && (
                <button onClick={() => navigate("/Createcustomer")}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold
                    shadow-md shadow-blue-200 hover:shadow-lg transition-all">
                  <FaUserPlus className="w-3.5 h-3.5"/> Add Customer
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── COLLAPSIBLE CUSTOMER ANALYTICS ── */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden fade-up">
          {/* Toggle header */}
          <button
            type="button"
            onClick={() => setCustomerStatsOpen((previous) => !previous)}
            aria-expanded={customerStatsOpen}
            className="w-full px-4 sm:px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3 flex-wrap min-w-0">
              <div className="flex items-center gap-2 flex-shrink-0">
                <FaUsers className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-extrabold text-slate-700 whitespace-nowrap">
                  Customer Analytics
                </span>
              </div>

              {/* Compact values visible when cards are closed */}
              {!customerStatsOpen && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-1 rounded-full bg-cyan-100 text-cyan-700 text-[11px] font-bold">
                    {stats.total} Customers
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-[11px] font-bold hidden sm:inline-flex">
                    {stats.active} Active
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold hidden sm:inline-flex">
                    {stats.vip} VIP
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold">
                    Revenue {fmtINR(stats.revenue)}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-bold hidden md:inline-flex">
                    {stats.bookings} Bookings
                  </span>
                </div>
              )}
            </div>

            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
              {customerStatsOpen ? <FaSortUp className="w-4 h-4" /> : <FaSortDown className="w-4 h-4" />}
            </div>
          </button>

          {/* Expandable six cards */}
          <div
            className={`grid transition-all duration-300 ease-in-out ${
              customerStatsOpen
                ? "grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 p-4 pt-1">
                {[
                  { icon: FaUsers, label: "Total Customers", value: stats.total, gradient: "from-cyan-500 to-cyan-600", delay: 0 },
                  { icon: FaUserCheck, label: "Active Customers", value: stats.active, gradient: "from-green-500 to-emerald-600", delay: 60 },
                  { icon: FaCrown, label: "VIP Customers", value: stats.vip, gradient: "from-amber-500 to-orange-500", delay: 120 },
                  { icon: FaRupeeSign, label: "Total Revenue", value: stats.revenue, gradient: "from-blue-600 to-blue-700", delay: 180, currency: true },
                  { icon: FaPlane, label: "Total Bookings", value: stats.bookings, gradient: "from-indigo-500 to-indigo-600", delay: 240 },
                  { icon: FaRedoAlt, label: "Repeat Customers", value: stats.repeat, gradient: "from-rose-500 to-pink-600", delay: 300, sub: "3+ trips" },
                ].map((c) => (
                  <div key={c.label} className="fade-up" style={{ animationDelay: `${c.delay}ms` }}>
                    <StatCard {...c} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── CUSTOMER LIST CARD ── */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">

          {/* ── COLLAPSIBLE FILTER HEADER — same control as All Bookings ── */}
          <button type="button" onClick={()=>setFiltersOpen(v=>!v)}
            className="w-full flex items-center justify-between px-5 py-4 bg-slate-600 hover:bg-slate-700 transition-colors">
            <div className="flex items-center gap-2.5">
              <FaFilter className="w-4 h-4 text-white"/>
              <span className="text-sm font-extrabold text-white">Filters &amp; Search</span>
              {activeFilterCount>0 && (
                <span className="bg-blue-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                  {activeFilterCount} active
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-white/70 text-xs font-bold">{total} customers</span>
              {anyFilter && (
                <button type="button" onClick={e=>{e.stopPropagation();resetFilters();}}
                  className="text-white/70 hover:text-white text-xs font-bold transition-colors">
                  Clear all
                </button>
              )}
              {filtersOpen
                ?<FaChevronUp   className="w-4 h-4 text-white"/>
                :<FaChevronDown className="w-4 h-4 text-white"/>}
            </div>
          </button>

          {/* Filter body — every control below queries the SERVER, not the loaded page */}
          {filtersOpen && (
            <div className="p-5 space-y-4 border-b border-slate-100 bg-slate-50/60"
              style={{animation:"fadeUp .25s ease both"}}>
              {/* Row 1: Search + Status + Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div className="lg:col-span-2">
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">Search</label>
                  <div className="relative">
                    <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                      placeholder="Name, customer code, phone, email, city…"
                      className={inputCls+" pl-10"}/>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">Status</label>
                  <Sel value={filterStatus} onChange={setFStatus} opts={["All Status","Active","Inactive","Blocked"]} className="w-full"/>
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">Type</label>
                  <Sel value={filterType} onChange={setFType} opts={TYPE_OPTIONS} className="w-full"/>
                </div>
              </div>
              {/* Row 2: Tier + action buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">Loyalty Tier</label>
                  <Sel value={filterTier} onChange={setFTier} opts={["All Tiers","Platinum","Gold","Silver","Bronze"]} className="w-full"/>
                </div>
                <div className="flex items-end gap-3 lg:col-span-3">
                  <button onClick={reload}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-slate-200 hover:border-slate-300
                      bg-white hover:bg-slate-50 text-slate-600 text-sm font-bold transition-all h-[42px]">
                    <FaRedoAlt className={`w-3.5 h-3.5 ${loading?"animate-spin":""}`}/> Refresh
                  </button>
                  {canSeeTenantWide && (
                    <button onClick={handleExport}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700
                        text-white text-sm font-bold shadow-md shadow-emerald-200 transition-all h-[42px]">
                      <FaDownload className="w-3.5 h-3.5"/> Export CSV
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── DESKTOP GRID (Leads-directory style, no expandable) ── */}
          <div className="hidden lg:block">
            <GridHead cols={CUST_COLS} bp="lg">
              {/* Only columns in SORTABLE_KEYS get a sort affordance — the rest are plain labels.
                  Offering a control the server ignores is worse than offering none: the arrow moved
                  while the order did not. */}
              {[
                { label:"Customer",    key:"name",     first:true },
                { label:"Contact",     key:null   },
                { label:"City",        key:"city" },
                { label:"Type",        key:null   },
                { label:"Loyalty",     key:null   },
                { label:"Bookings",    key:null,       right:true },
                { label:"Total Spent", key:null,       right:true },
                { label:"Status",      key:"status" },
                { label:"Actions",     key:null,       right:true },
              ].map(({ label, key, first, right }) => {
                const sortable = key && SORTABLE_KEYS.has(key);
                return (
                  <Cell key={label} first={first} right={right} className={sortable ? "cursor-pointer hover:text-blue-600 select-none" : ""}>
                    <span onClick={sortable ? () => handleSort(key) : undefined}>
                      {label}{sortable && <SortIcon k={key}/>}
                    </span>
                  </Cell>
                );
              })}
            </GridHead>

            {loading
              ? <GridSkeleton cols={CUST_COLS} rows={6} />
              : pageData.length === 0
              ? <GridEmpty icon={FaUsers} title="No Customers Found"
                  hint={anyFilter ? "Try adjusting your search or filters." : "Start by adding your first customer."}
                  action={anyFilter
                    ? <button onClick={resetFilters} className="px-4 py-2 rounded-xl bg-blue-50 text-blue-600 font-bold text-sm hover:bg-blue-100 transition-all">Clear Filters</button>
                    : <button onClick={() => navigate("/Createcustomer")} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-md shadow-blue-200 hover:bg-blue-700 transition-all inline-flex items-center gap-2"><FaUserPlus/> Add First Customer</button>}/>
              : pageData.map((c, idx) => {
                const tc  = TIER_CONFIG[c.tier]    || TIER_CONFIG.Bronze;
                const tyc = TYPE_CONFIG[c.type]    || TYPE_CONFIG.Individual;
                const sc  = STATUS_CONFIG[c.status]|| STATUS_CONFIG.Inactive;
                // Seed the avatar colour from the human code, not the UUID — the UUID's leading
                // digits are random, so the same customer changed colour for no reason.
                const grad = avatarGrad(c.customerId || c.id);
                return (
                  <GridRow key={c.id} cols={CUST_COLS} bp="lg" index={idx}>
                    {/* Customer */}
                    <Cell first>
                      <Avatar initials={initials(c.name)} gradient={grad}/>
                      <div className="ml-3 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-bold text-slate-800 truncate">{c.name}</p>
                          {c.type === "VIP" && <FaCrown className="w-3 h-3 text-amber-500 flex-shrink-0"/>}
                        </div>
                        {/* The human code (CUS10001), never the publicId UUID. */}
                        <p className="text-xs text-blue-600 font-bold truncate">{c.customerId}</p>
                      </div>
                    </Cell>
                    {/* Contact */}
                    <Cell>
                      <div className="min-w-0 w-full">
                        <p className="text-xs font-semibold text-slate-600 flex items-center gap-1 justify-center"><FaMobileAlt className="text-slate-400 flex-shrink-0"/> {c.phone}</p>
                        <p className="text-xs text-slate-400 mt-0.5 truncate text-center">{c.email}</p>
                      </div>
                    </Cell>
                    {/* City */}
                    <Cell>
                      <div className="text-center min-w-0">
                        <p className="text-sm font-semibold text-slate-600 truncate">{c.city || "—"}</p>
                        <p className="text-xs text-slate-400 truncate">{c.state}</p>
                      </div>
                    </Cell>
                    {/* Type */}
                    <Cell><span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${tyc.border} ${tyc.bg} ${tyc.text} whitespace-nowrap`}>{c.type}</span></Cell>
                    {/* Tier */}
                    <Cell><span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${tc.border} ${tc.bg} ${tc.text} whitespace-nowrap`}>{tc.icon} {c.tier}</span></Cell>
                    {/* Bookings */}
                    <Cell right><span className="text-sm font-extrabold text-slate-700">{c.bookings || 0}</span></Cell>
                    {/* Spent */}
                    <Cell right>
                      <div className="text-right min-w-0">
                        <p className="text-sm font-extrabold text-slate-800 truncate">{fmtINR(c.spent)}</p>
                        <p className="text-[11px] text-slate-400 truncate">Last: {fmtDate(c.lastBooking)}</p>
                      </div>
                    </Cell>
                    {/* Status */}
                    <Cell><span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-full ${sc.bg} ${sc.text} whitespace-nowrap`}><span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}/>{c.status}</span></Cell>
                    {/* Actions */}
                    <Cell right>
                      <div className="flex items-center justify-end gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                        {/* Opens the full profile. This used to open a modal instead, which left
                            /CustomerDetails/:id with no entry point from its own list. */}
                        <button onClick={() => handleNavigateView(c.id)} title="View profile" className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition-all text-sm"><FaEye/></button>
                        {canEditCustomer && <button onClick={() => handleNavigateEdit(c.id)} title="Edit" className="w-8 h-8 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 flex items-center justify-center transition-all text-sm"><FaEdit/></button>}
                        {/* Opens the conversation drawer, not wa.me. A deep link hands the message to
                            the operator's phone and the CRM never learns the customer was contacted —
                            the drawer still offers that as one of its send modes, and records it. */}
                        {canMessage && <button onClick={() => setConvo({ customer: c, channel: "WHATSAPP" })} title="WhatsApp" className="w-8 h-8 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 flex items-center justify-center transition-all text-sm"><FaWhatsapp/></button>}
                        {canMessage && c.email && <button onClick={() => setConvo({ customer: c, channel: "EMAIL" })} title={`Email ${c.email}`} className="w-8 h-8 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-600 flex items-center justify-center transition-all text-sm"><FaEnvelope/></button>}
                        {canDeleteCustomer && <button onClick={() => setDelTarget(c)} title="Delete" className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 flex items-center justify-center transition-all text-sm"><FaTrash/></button>}
                      </div>
                    </Cell>
                  </GridRow>
                );
              })}
          </div>

          {/* ── MOBILE / TABLET CARDS ── */}
          <div className="lg:hidden p-4 space-y-3">
            {loading
              ? [...Array(4)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
                    {[...Array(4)].map((_, j) => <div key={j} className="h-4 rounded-lg bg-slate-200 animate-pulse" style={{ width:`${40 + Math.random() * 50}%` }}/>)}
                  </div>
                ))
              : pageData.length === 0
              ? (
                <div className="text-center py-16">
                  <div className="text-5xl mb-3">👥</div>
                  <p className="text-base font-extrabold text-slate-600 mb-1">No Customers Found</p>
                  <p className="text-sm text-slate-400 mb-4">{anyFilter ? "Adjust filters to see results." : "Add your first customer."}</p>
                  {!anyFilter && <button onClick={() => navigate("/Createcustomer")} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm">+ Add Customer</button>}
                </div>
              )
              : pageData.map((c, idx) => {
                const tc  = TIER_CONFIG[c.tier]    || TIER_CONFIG.Bronze;
                const tyc = TYPE_CONFIG[c.type]    || TYPE_CONFIG.Individual;
                const sc  = STATUS_CONFIG[c.status]|| STATUS_CONFIG.Inactive;
                const grad = avatarGrad(c.customerId || c.id);
                return (
                  <div key={c.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3 fade-up overflow-hidden" style={{ animationDelay:`${idx * 40}ms` }}>
                    
                    {/* Fixed Card Header with truncate */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center text-white text-sm font-extrabold flex-shrink-0`}>
                          {initials(c.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="font-extrabold text-slate-800 text-sm truncate">{c.name}</p>
                            {c.type === "VIP" && <FaCrown className="w-3 h-3 text-amber-500 flex-shrink-0"/>}
                          </div>
                          <p className="text-xs font-bold text-blue-600 truncate w-full">{c.customerId}</p>
                          <p className="text-xs text-slate-400 truncate w-full">{c.city}, {c.state}</p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${sc.bg} ${sc.text} flex-shrink-0`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}/>{c.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-50 rounded-lg px-3 py-2 min-w-0">
                        <p className="text-slate-400">Phone</p>
                        <p className="font-bold text-slate-700 truncate">{c.phone}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg px-3 py-2 min-w-0">
                        <p className="text-slate-400">Total Spent</p>
                        <p className="font-extrabold text-slate-800 truncate">{fmtINR(c.spent)}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg px-3 py-2 min-w-0">
                        <p className="text-slate-400">Bookings</p>
                        <p className="font-bold text-slate-700 truncate">{c.bookings || 0} trips</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg px-3 py-2 min-w-0">
                        <p className="text-slate-400">Last Booking</p>
                        <p className="font-bold text-slate-700 truncate">{fmtDate(c.lastBooking)}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${tyc.border} ${tyc.bg} ${tyc.text} whitespace-nowrap`}>{c.type}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${tc.border} ${tc.bg} ${tc.text} whitespace-nowrap`}>{tc.icon} {c.tier}</span>
                    </div>
                    
                    {/* Fixed wrapping action buttons -> Now properly forced into a single row of squares */}
                    <div className="grid grid-cols-4 gap-2 pt-1">
                      <button onClick={() => handleNavigateView(c.id)} className="h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-all shadow-sm">
                        <FaEye className="w-[18px] h-[18px]"/>
                      </button>
                      {canEditCustomer && (
                        <button onClick={() => handleNavigateEdit(c.id)} className="h-10 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100 flex items-center justify-center transition-all">
                          <FaEdit className="w-[18px] h-[18px]"/>
                        </button>
                      )}
                      <a href={`https://wa.me/${(c.phone || "").replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                        className="h-10 rounded-xl bg-green-50 hover:bg-green-100 text-green-600 border border-green-100 flex items-center justify-center transition-all">
                        <FaWhatsapp className="w-[18px] h-[18px]"/>
                      </a>
                      {canDeleteCustomer && (
                        <button onClick={() => setDelTarget(c)} className="h-10 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 border border-red-100 flex items-center justify-center transition-all">
                          <FaTrash className="w-[18px] h-[18px]"/>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            }
          </div>

          {/* ── PAGINATION ──
              Same control, now server-driven. `page` is 0-based like the API; the buttons stay
              1-based for the user, so every number shown is `page + 1` and every click sends
              `n - 1`. `total`/`totalPages` come from the response's pagination block. */}
          {total > 0 && (
            <div className="px-4 sm:px-5 py-4 border-t border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-slate-400 font-medium text-center sm:text-left">
                Showing <span className="font-bold text-slate-600">{page*pageSize+1}</span>–<span className="font-bold text-slate-600">{Math.min((page+1)*pageSize,total)}</span> of <span className="font-bold text-slate-600">{total}</span> customers
              </p>
              <div className="flex items-center justify-center flex-wrap gap-1.5">
                <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))}
                  className="h-8 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-bold px-2 hover:border-blue-300 outline-none focus:border-blue-400"
                  aria-label="Rows per page">
                  {[10,25,50,100].map(s => <option key={s} value={s}>{s} / page</option>)}
                </select>
                <button disabled={page===0||loading} onClick={()=>setPage(0)}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center">
                  <FaAngleDoubleLeft className="text-xs"/>
                </button>
                <button disabled={page===0||loading} onClick={()=>setPage(p=>Math.max(0,p-1))}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center">
                  <FaChevronLeft className="text-xs"/>
                </button>
                {Array.from({length:totalPages},(_,i)=>i+1)
                  .filter(p=>p===1||p===totalPages||Math.abs(p-(page+1))<=1)
                  .reduce((acc,p,i,arr)=>{ if(i>0&&p-arr[i-1]>1) acc.push("…"); acc.push(p); return acc; },[])
                  .map((p,i)=>
                    typeof p==="string"
                    ? <span key={`e${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-slate-400">…</span>
                    : <button key={p} onClick={()=>setPage(p-1)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all border
                          ${page+1===p?"bg-blue-600 border-blue-600 text-white shadow-sm":"bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600"}`}>
                        {p}
                      </button>
                  )
                }
                <button disabled={page+1>=totalPages||loading} onClick={()=>setPage(p=>Math.min(totalPages-1,p+1))}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center">
                  <FaChevronRight className="text-xs"/>
                </button>
                <button disabled={page+1>=totalPages||loading} onClick={()=>setPage(Math.max(0,totalPages-1))}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center">
                  <FaAngleDoubleRight className="text-xs"/>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {convo && (
        /* Keyed on the customer so switching records remounts it: the thread, the templates and a
           half-typed message all belong to one contact and must not survive the change. */
        <ConversationDrawer
          key={convo.customer.publicId || convo.customer.id}
          customer={convo.customer}
          initialChannel={convo.channel}
          onClose={() => setConvo(null)}
        />
      )}
    </div>
  );
}
