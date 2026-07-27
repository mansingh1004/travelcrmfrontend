// import { useState, useMemo, useEffect, useCallback } from "react";
// import { useNavigate } from "react-router-dom";

// import { UserPlus as FiUserPlus, Search as FiSearch, Pen as FiEdit2, Trash2 as FiTrash2, ChevronLeft as FiChevronLeft, ChevronRight as FiChevronRight, Shield as FiShield, Users as FaUsers, UserCheck as FaUserCheck, UserX as FaUserTimes, ShieldUser as FaUserShield, ChevronsLeft as FaAngleDoubleLeft, ChevronsRight as FaAngleDoubleRight, ChevronDown as FiChevronDown,
// ChevronUp as FiChevronUp } from "lucide-react";


// import userService from "../api/profileUserService";
// import { hasPermission, P } from "@shared/lib/access";

// /* Users are loaded from the API — see profileUserService.getAll(). */

// const AVATAR_GRADS = [
//   "from-blue-500 to-blue-600","from-purple-500 to-purple-600",
//   "from-teal-500 to-teal-600","from-rose-500 to-rose-600",
//   "from-amber-500 to-amber-600","from-indigo-500 to-indigo-600",
//   "from-green-500 to-green-600","from-cyan-500 to-cyan-600",
// ];

// const initials = (name="") =>
//   name.trim().split(" ").filter(Boolean).map(w=>w[0]).join("").slice(0,2).toUpperCase()||"U";
// // id is a UUID string — hash it to a stable gradient index.
// const avatarGrad = (id) => {
//   const s = String(id || "");
//   let h = 0;
//   for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i)) % AVATAR_GRADS.length;
//   return AVATAR_GRADS[h];
// };

// const ROLE_CFG = {
//   "Organization Admin": { bg:"bg-purple-100", text:"text-purple-700", border:"border-purple-200" },
//   Manager:        { bg:"bg-indigo-100", text:"text-indigo-700", border:"border-indigo-200" },
//   "Travel Agent": { bg:"bg-blue-100",   text:"text-blue-700",   border:"border-blue-200"   },
//   Staff:          { bg:"bg-slate-100",  text:"text-slate-700",  border:"border-slate-200"  },
//   Account:        { bg:"bg-amber-100",  text:"text-amber-700",  border:"border-amber-200"  },
// };
// const STATUS_CFG = {
//   Active:   { bg:"bg-emerald-100", text:"text-emerald-700", dot:"bg-emerald-500" },
//   Inactive: { bg:"bg-slate-100",   text:"text-slate-500",   dot:"bg-slate-400"   },
// };


// /* ─── TOAST ──────────────────────────────────────────────────── */
// function Toast({ msg, type, onClose }) {
//   useEffect(()=>{ const t=setTimeout(onClose,3500); return()=>clearTimeout(t); },[onClose]);
//   return (
//     <div className={`fixed top-5 right-5 z-[999] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl max-w-xs
//       ${type==="success"?"bg-green-50 border-green-200 text-green-800":"bg-red-50 border-red-200 text-red-800"}`}
//       style={{animation:"slideIn .3s ease both"}}>
//       <span className="text-lg">{type==="success"?"✅":"❌"}</span>
//       <p className="text-sm font-semibold flex-1">{msg}</p>
//       <button onClick={onClose} className="opacity-50 hover:opacity-100 text-lg ml-1">×</button>
//     </div>
//   );
// }

// /* ─── STAT CARD ──────────────────────────────────────────────── */
// function StatCard({ icon:Icon, label, value, gradient, sub, delay=0 }) {
//   const [displayed, setDisplayed] = useState(0);
//   useEffect(()=>{
//     if(!value){ setDisplayed(0); return; }
//     let s=0; const step=Math.max(1,Math.ceil(value/50));
//     const iv=setInterval(()=>{ s=Math.min(s+step,value); setDisplayed(s); if(s>=value)clearInterval(iv); },16);
//     return()=>clearInterval(iv);
//   },[value]);
//   return (
//     <div className={`bg-gradient-to-br ${gradient} rounded-2xl p-5 text-white shadow-lg relative overflow-hidden group
//       hover:-translate-y-1 hover:shadow-xl transition-all duration-300 cursor-pointer`}
//       style={{animationDelay:`${delay}ms`}}>
//       <div className="absolute -right-5 -top-5 w-24 h-24 rounded-full bg-white/10 group-hover:scale-110 transition-transform duration-300"/>
//       <div className="absolute -right-3 -bottom-8 w-32 h-32 rounded-full bg-white/10"/>
//       <div className="relative z-10">
//         <div className="flex items-start justify-between mb-3">
//           <div className="w-10 h-10 rounded-xl bg-white/20 group-hover:bg-white/30 flex items-center justify-center transition-all">
//             <Icon className="w-5 h-5"/>
//           </div>
//           {sub&&<span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">{sub}</span>}
//         </div>
//         <p className="text-2xl sm:text-3xl font-extrabold leading-none mb-1">{displayed}</p>
//         <p className="text-xs font-bold uppercase tracking-widest opacity-80">{label}</p>
//       </div>
//     </div>
//   );
// }

// /* ─── SKELETON ROW ───────────────────────────────────────────── */
// function SkeletonRow() {
//   return (
//     <tr>
//       {[...Array(9)].map((_,i)=>(
//         <td key={i} className="px-4 py-4">
//           <div className="h-4 rounded-lg bg-slate-200 animate-pulse" style={{width:`${40+Math.random()*50}%`}}/>
//         </td>
//       ))}
//     </tr>
//   );
// }

// /* ─── DELETE CONFIRM MODAL — kept inline ─────────────────────── */
// function DeleteConfirm({ user, onClose, onConfirm }) {
//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
//       onClick={e=>e.target===e.currentTarget&&onClose()}>
//       <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}/>
//       <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm z-10 p-6 text-center"
//         style={{animation:"popIn .25s ease both"}}>
//         <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-3xl mx-auto mb-4">🗑️</div>
//         <h3 className="text-lg font-extrabold text-slate-800 mb-1">Delete User?</h3>
//         <p className="text-sm text-slate-500 mb-5">
//           Are you sure you want to delete{" "}
//           <span className="font-bold text-slate-700">{user?.fullName}</span>?
//           This action cannot be undone.
//         </p>
//         <div className="flex gap-3">
//           <button onClick={onClose}
//             className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all">
//             Cancel
//           </button>
//           <button onClick={onConfirm}
//             className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md shadow-red-200 transition-all">
//             Yes, Delete
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }


// /* ─── MAIN PAGE ──────────────────────────────────────────────── */
// export default function Users() {
//   const navigate = useNavigate();

//   const [users,      setUsers]      = useState([]);
//   const [search,     setSearch]     = useState("");
//   const [activeTab,  setActiveTab]  = useState("All");
//   const [loading,    setLoading]    = useState(true);
//   const [toast,      setToast]      = useState(null);
//   const [page,       setPage]       = useState(1);

//   const [userStatsOpen, setUserStatsOpen] = useState(false);

//   const perPage = 8;



//   // Only delete + reset modals remain inline
//   const [deleteUser, setDeleteUser] = useState(null);

//   const showToast = useCallback((msg, type="success")=>setToast({msg,type}),[]);

//   useEffect(() => {
//   setLoading(true);

//   userService
//     .getAll()
//     .then((res) => {
//       setUsers(res.data);
//     })
//     .catch(() => {
//       showToast("Failed to load users.", "error");
//     })
//     .finally(() => {
//       setLoading(false);
//     });
// }, [showToast]);

  

//   /* stats */
//   const stats = useMemo(()=>({
//     total:    users.length,
//     active:   users.filter(u=>u.status==="Active").length,
//     inactive: users.filter(u=>u.status==="Inactive").length,
//     admins:   users.filter(u=>u.role==="Organization Admin").length,
//   }),[users]);

//   /* filtered list */
//   const filtered = useMemo(()=>{
//     let out = [...users];
//     const q = search.toLowerCase();
//     if(q) out = out.filter(u=>
//       (u.username || "").toLowerCase().includes(q)||
//       (u.username || "").toLowerCase().includes(q)||
//       (u.email || "").toLowerCase().includes(q)||
//       String(u.id).includes(q)
//     );
//     if(activeTab==="Active")   out = out.filter(u=>u.status==="Active");
//     if(activeTab==="Inactive") out = out.filter(u=>u.status==="Inactive");
//     return out;
//   },[users,search,activeTab]);

//   const totalPages = Math.max(1,Math.ceil(filtered.length/perPage));
//   const pageData   = filtered.slice((page-1)*perPage, page*perPage);

//   /* delete handler */
//   const handleDelete = async () => {
//   try {
//     await userService.delete(deleteUser.id);

//     setUsers((prev) =>
//       prev.filter((u) => u.id !== deleteUser.id)
//     );

//     showToast(
//       `"${deleteUser.fullName}" deleted.`
//     );
//   } catch (err) {
//     showToast(
//       err?.response?.data?.message ||
//       "Failed to delete user.",
//       "error"
//     );
//   } finally {
//     setDeleteUser(null);
//   }
// };

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100"
//       style={{fontFamily:"'Plus Jakarta Sans', system-ui, sans-serif"}}>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
//         @keyframes slideIn { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
//         @keyframes fadeUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
//         @keyframes popIn   { from{transform:scale(.92);opacity:0} to{transform:scale(1);opacity:1} }
//         .fade-up { animation: fadeUp .4s ease both; }
//         select { -webkit-appearance:none; appearance:none; }
//         ::-webkit-scrollbar{width:5px;height:5px}
//         ::-webkit-scrollbar-track{background:#f1f5f9;border-radius:99px}
//         ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:99px}
//       `}</style>

//       {toast      && <Toast msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
//       {deleteUser && <DeleteConfirm user={deleteUser} onClose={()=>setDeleteUser(null)} onConfirm={handleDelete}/>}

//       {/* ── PAGE HEADER ── */}
//       <div className="bg-white/70 backdrop-blur-md border-b border-slate-100">
//         <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5">
//           <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
//             <div className="flex items-center gap-4">
//               <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-white text-xl shadow-lg shadow-blue-200 flex-shrink-0">
//                 <FaUsers className="w-5 h-5"/>
//               </div>
//               <div>
//                 <h1 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
//                   Users
//                   <span className="hidden sm:inline text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">
//                     {users.length} total
//                   </span>
//                 </h1>
//                 <p className="text-sm text-slate-400 mt-0.5">
//                   Manage staff accounts, roles &amp; permissions
//                   <span className="hidden sm:inline ml-3 text-slate-300">|</span>
//                   <span className="hidden sm:inline ml-3 text-xs">
//                     <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={()=>navigate("/")}>Home</span>
//                     <span className="mx-1 text-slate-300">/</span>
//                     <span className="text-blue-600 font-bold">Users</span>
//                   </span>
//                 </p>
//               </div>
//             </div>

//             {/* ── ADD NEW USER → navigates to /CreateUser (USER_CREATE only) ── */}
//             {hasPermission(P.USER_CREATE) && (
//             <button onClick={()=>navigate("/CreateUser")}
//               className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold
//                 shadow-md shadow-blue-200 hover:shadow-lg transition-all">
//               <FiUserPlus className="w-4 h-4"/> Add New User
//             </button>
//             )}
//           </div>
//         </div>
//       </div>

//       <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">

//         {/* ── STAT CARDS ── */}
//         {/* <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
//           {[
//             { icon:FaUsers,      label:"Total Users",    value:stats.total,    gradient:"from-cyan-500 to-cyan-600",     delay:0   },
//             { icon:FaUserCheck,  label:"Active Users",   value:stats.active,   gradient:"from-green-500 to-emerald-600", delay:60  },
//             { icon:FaUserTimes,  label:"Inactive Users", value:stats.inactive, gradient:"from-slate-500 to-slate-600",   delay:120 },
//             { icon:FaUserShield, label:"Admins",         value:stats.admins,   gradient:"from-purple-500 to-purple-600", delay:180 },
//           ].map(c=>(
//             <div key={c.label} className="fade-up" style={{animationDelay:`${c.delay}ms`}}>
//               <StatCard {...c}/>
//             </div>
//           ))}
//         </div> */}

//         {/* ── COLLAPSIBLE USER ANALYTICS ── */}
// <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden fade-up">

//   {/* Toggle header */}
//   <button
//     type="button"
//     onClick={() =>
//       setUserStatsOpen((previous) => !previous)
//     }
//     aria-expanded={userStatsOpen}
//     className="w-full px-4 sm:px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
//   >
//     <div className="flex items-center gap-3 flex-wrap min-w-0">
//       <div className="flex items-center gap-2">
//         <FaUsers className="w-4 h-4 text-blue-600" />

//         <span className="text-sm font-extrabold text-slate-700">
//           User Analytics
//         </span>
//       </div>

//       {/* Compact values displayed when cards are closed */}
//       {!userStatsOpen && (
//         <div className="flex items-center gap-2 flex-wrap">
//           <span className="px-2.5 py-1 rounded-full bg-cyan-100 text-cyan-700 text-[11px] font-bold">
//             {stats.total} Users
//           </span>

//           <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-[11px] font-bold">
//             {stats.active} Active
//           </span>

//           <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold">
//             {stats.inactive} Inactive
//           </span>

//           <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 text-[11px] font-bold">
//             {stats.admins} Admins
//           </span>
//         </div>
//       )}
//     </div>

//     <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
//       {userStatsOpen ? (
//         <FiChevronUp className="w-4 h-4" />
//       ) : (
//         <FiChevronDown className="w-4 h-4" />
//       )}
//     </div>
//   </button>

//   {/* Expandable cards */}
//   <div
//     className={`grid transition-all duration-300 ease-in-out ${
//       userStatsOpen
//         ? "grid-rows-[1fr] opacity-100"
//         : "grid-rows-[0fr] opacity-0"
//     }`}
//   >
//     <div className="min-h-0 overflow-hidden">
//       <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 pt-1">
//         {[
//           {
//             icon: FaUsers,
//             label: "Total Users",
//             value: stats.total,
//             gradient: "from-cyan-500 to-cyan-600",
//             delay: 0,
//           },
//           {
//             icon: FaUserCheck,
//             label: "Active Users",
//             value: stats.active,
//             gradient: "from-green-500 to-emerald-600",
//             delay: 60,
//           },
//           {
//             icon: FaUserTimes,
//             label: "Inactive Users",
//             value: stats.inactive,
//             gradient: "from-slate-500 to-slate-600",
//             delay: 120,
//           },
//           {
//             icon: FaUserShield,
//             label: "Admins",
//             value: stats.admins,
//             gradient: "from-purple-500 to-purple-600",
//             delay: 180,
//           },
//         ].map((card) => (
//           <div
//             key={card.label}
//             className="fade-up"
//             style={{
//               animationDelay: `${card.delay}ms`,
//             }}
//           >
//             <StatCard {...card} />
//           </div>
//         ))}
//       </div>
//     </div>
//   </div>
// </div>

//         {/* ── USER LIST CARD ── */}
//         <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">

//           {/* List header */}
//           <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
//             <div className="flex items-center gap-3">
//               <h2 className="text-base font-extrabold text-slate-700">User List</h2>
//               <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2.5 py-1 rounded-full">
//                 {filtered.length} results
//               </span>
//             </div>
//             {hasPermission(P.USER_CREATE) && (
//             <button onClick={()=>navigate("/CreateUser")}
//               className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-200 transition-all">
//               <FiUserPlus className="w-3.5 h-3.5"/> Add New User
//             </button>
//             )}
//           </div>

//           {/* Search + Status filter tabs */}
//           <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60">
//             <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
//               <div className="relative flex-1 min-w-[200px]">
//                 <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
//                 <input value={search} onChange={e=>{ setSearch(e.target.value); setPage(1); }}
//                   placeholder="Search by name, username, email, ID..."
//                   className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder-slate-400
//                     focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none transition-all"/>
//               </div>

//               <div className="flex rounded-xl border border-slate-200 overflow-hidden flex-shrink-0">
//                 {["Active","Inactive","All"].map(tab=>(
//                   <button key={tab} onClick={()=>{ setActiveTab(tab); setPage(1); }}
//                     className={`px-4 py-2.5 text-xs font-bold transition-all whitespace-nowrap
//                       ${activeTab===tab
//                         ? tab==="Active"    ? "bg-emerald-500 text-white"
//                           : tab==="Inactive" ? "bg-slate-500 text-white"
//                           : "bg-blue-600 text-white"
//                         : "bg-white text-slate-500 hover:bg-slate-50"}`}>
//                     {tab}
//                   </button>
//                 ))}
//               </div>
//             </div>
//           </div>

//           {/* ── DESKTOP TABLE ── */}
//           <div className="hidden lg:block overflow-x-auto">
//             <table className="w-full min-w-[900px]">
//               <thead className="bg-slate-50/80 border-b border-slate-100">
//                 <tr>
//                   {["ID","Username","Full Name","Email","Role","Status","Last Login","Created","Actions"].map(h=>(
//                     <th key={h} className="px-4 py-3.5 text-left text-xs font-extrabold text-slate-500 uppercase tracking-wider whitespace-nowrap">
//                       {h}
//                     </th>
//                   ))}
//                 </tr>
//               </thead>
//               <tbody className="divide-y divide-slate-50">
//                 {loading
//                   ? [...Array(5)].map((_,i)=><SkeletonRow key={i}/>)
//                   : pageData.length===0
//                   ? (
//                     <tr>
//                       <td colSpan={9} className="text-center py-20">
//                         <div className="text-5xl mb-3">👥</div>
//                         <p className="text-base font-extrabold text-slate-600 mb-1">No Users Found</p>
//                         <p className="text-sm text-slate-400 mb-4">
//                           {search||activeTab!=="All"
//                             ? "Try adjusting your search or filters."
//                             : "Add your first user to get started."}
//                         </p>
//                         {search||activeTab!=="All"
//                           ? <button onClick={()=>{ setSearch(""); setActiveTab("All"); }}
//                               className="px-4 py-2 rounded-xl bg-blue-50 text-blue-600 font-bold text-sm hover:bg-blue-100 transition-all">
//                               Clear Filters
//                             </button>
//                           : <button onClick={()=>navigate("/CreateUser")}
//                               className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-md hover:bg-blue-700 transition-all flex items-center gap-2 mx-auto">
//                               <FiUserPlus/> Add First User
//                             </button>}
//                       </td>
//                     </tr>
//                   )
//                   : pageData.map((u,idx)=>{
//                     const rc = ROLE_CFG[u.role]    || ROLE_CFG.Staff;
//                     const sc = STATUS_CFG[u.status] || STATUS_CFG.Inactive;
//                     return (
//                       <tr key={u.id}
//                         className="group transition-all duration-150 hover:bg-blue-50/40 hover:shadow-[inset_3px_0_0_#2563eb]"
//                         style={{animation:"fadeUp .35s ease both", animationDelay:`${idx*30}ms`}}>

//                         {/* ID */}
//                         <td className="px-4 py-3.5">
//                           <span className="text-xs font-extrabold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg" title={u.id}>{String(u.id).slice(0,8)}</span>
//                         </td>

//                         {/* Username + avatar */}
//                         <td className="px-4 py-3.5">
//                           <div className="flex items-center gap-2.5">
//                             <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${avatarGrad(u.id)} flex items-center justify-center text-white text-xs font-extrabold flex-shrink-0`}>
//                               {initials(u.fullName)}
//                             </div>
//                             <span className="text-sm font-bold text-blue-600">{u.username}</span>
//                           </div>
//                         </td>

//                         {/* Full Name */}
//                         <td className="px-4 py-3.5">
//                           <p className="text-sm font-semibold text-slate-800">{u.fullName}</p>
//                         </td>

//                         {/* Email */}
//                         <td className="px-4 py-3.5">
//                           <p className="text-sm text-slate-600 truncate max-w-[200px]">{u.email}</p>
//                         </td>

//                         {/* Role */}
//                         <td className="px-4 py-3.5">
//                           <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${rc.border} ${rc.bg} ${rc.text}`}>
//                             {u.role}
//                           </span>
//                         </td>

//                         {/* Status */}
//                         <td className="px-4 py-3.5">
//                           <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-full ${sc.bg} ${sc.text}`}>
//                             <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}/>
//                             {u.status}
//                           </span>
//                         </td>

//                         {/* Last Login */}
//                         <td className="px-4 py-3.5">
//                           <p className="text-xs text-slate-500 font-medium">{u.lastLogin}</p>
//                         </td>

//                         {/* Created */}
//                         <td className="px-4 py-3.5">
//                           <p className="text-xs text-slate-500 font-medium">{u.createdAt}</p>
//                         </td>

//                         {/* Actions */}
//                         <td className="px-4 py-3.5">
//                           <div className="flex items-center gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
//                             {/* ── EDIT → navigates to /EditUser/:id ── */}
//                              {/* <button onClick={()=>navigate(`/EditUser`)} */}
//                             {hasPermission(P.USER_UPDATE) && (
//                             <button onClick={()=>navigate(`/EditUser/${u.id}`)}
//                              title="Edit User"
//                               className="w-8 h-8 rounded-lg bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition-all text-sm shadow-sm">
//                               <FiEdit2 className="w-3.5 h-3.5"/>
//                             </button>
//                             )}

//                             {/* DELETE → inline modal */}
//                             {hasPermission(P.USER_DELETE) && (
//                             <button onClick={()=>setDeleteUser(u)} title="Delete User"
//                               className="w-8 h-8 rounded-lg bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all text-sm shadow-sm">
//                               <FiTrash2 className="w-3.5 h-3.5"/>
//                             </button>
//                             )}

//                             {/* MANAGE PERMISSIONS → navigates to /UserPermissions/:id */}
//                             {/* <button onClick={()=>navigate(`/UserPermissions`)}  */}
//                             {hasPermission(P.USER_UPDATE) && (
//                             <button onClick={()=>navigate(`/UserPermissions/${u.id}`)}
//                             title="Manage Permissions"
//                               className="w-8 h-8 rounded-lg bg-teal-500 hover:bg-teal-600 text-white flex items-center justify-center transition-all text-sm shadow-sm">
//                               <FiShield className="w-3.5 h-3.5"/>
//                             </button>
//                             )}
//                           </div>
//                         </td>
//                       </tr>
//                     );
//                   })}
//               </tbody>
//             </table>
//           </div>

//           {/* ── MOBILE CARDS ── */}
//           <div className="lg:hidden p-4 space-y-3">
//             {loading
//               ? [...Array(4)].map((_,i)=>(
//                   <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
//                     {[...Array(3)].map((_,j)=>(
//                       <div key={j} className="h-4 rounded-lg bg-slate-200 animate-pulse" style={{width:`${40+Math.random()*50}%`}}/>
//                     ))}
//                   </div>
//                 ))
//               : pageData.length===0
//               ? (
//                 <div className="text-center py-14">
//                   <div className="text-5xl mb-3">👥</div>
//                   <p className="text-base font-extrabold text-slate-600 mb-1">No Users Found</p>
//                   <p className="text-sm text-slate-400 mb-4">
//                     {search||activeTab!=="All" ? "Adjust filters." : "Add your first user."}
//                   </p>
//                   {!search&&activeTab==="All"&&(
//                     <button onClick={()=>navigate("/CreateUser")}
//                       className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm">
//                       + Add User
//                     </button>
//                   )}
//                 </div>
//               )
//               : pageData.map((u,idx)=>{
//                 const rc = ROLE_CFG[u.role]    || ROLE_CFG.Staff;
//                 const sc = STATUS_CFG[u.status] || STATUS_CFG.Inactive;
//                 return (
//                   <div key={u.id}
//                     className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3 fade-up"
//                     style={{animationDelay:`${idx*40}ms`}}>
//                     <div className="flex items-start justify-between">
//                       <div className="flex items-center gap-3">
//                         <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${avatarGrad(u.id)} flex items-center justify-center text-white text-sm font-extrabold flex-shrink-0`}>
//                           {initials(u.fullName)}
//                         </div>
//                         <div>
//                           <p className="font-extrabold text-slate-800 text-sm">{u.fullName}</p>
//                           <p className="text-xs font-bold text-blue-600">{u.username}</p>
//                           <p className="text-xs text-slate-400" title={u.id}>#{String(u.id).slice(0,8)}</p>
//                         </div>
//                       </div>
//                       <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${sc.bg} ${sc.text}`}>
//                         <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}/>{u.status}
//                       </span>
//                     </div>

//                     <div className="grid grid-cols-2 gap-2 text-xs">
//                       <div className="bg-slate-50 rounded-lg px-3 py-2">
//                         <p className="text-slate-400">Email</p>
//                         <p className="font-bold text-slate-700 truncate">{u.email}</p>
//                       </div>
//                       <div className="bg-slate-50 rounded-lg px-3 py-2">
//                         <p className="text-slate-400">Role</p>
//                         <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${rc.border} ${rc.bg} ${rc.text}`}>{u.role}</span>
//                       </div>
//                       <div className="bg-slate-50 rounded-lg px-3 py-2">
//                         <p className="text-slate-400">Last Login</p>
//                         <p className="font-bold text-slate-700">{u.lastLogin}</p>
//                       </div>
//                       <div className="bg-slate-50 rounded-lg px-3 py-2">
//                         <p className="text-slate-400">Created</p>
//                         <p className="font-bold text-slate-700">{u.createdAt}</p>
//                       </div>
//                     </div>

//                     <div className="flex gap-2">
//                       {/* Edit → navigate to EditUser page */}
//                       {/* <button onClick={()=>navigate(`/EditUser`)} */}
//                       {hasPermission(P.USER_UPDATE) && (
//                       <button onClick={()=>navigate(`/EditUser/${u.id}`)}
//                         className="flex-1 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all">
//                         <FiEdit2 className="w-3 h-3"/> Edit
//                       </button>
//                       )}

//                       {/* Manage Permissions → navigate to /UserPermissions/:id */}
//                       {/* <button onClick={()=>navigate(`/UserPermissions`)} */}
//                       {hasPermission(P.USER_UPDATE) && (
//                       <button onClick={()=>navigate(`/UserPermissions/${u.id}`)}
//                         className="flex-1 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all">
//                         <FiShield className="w-3 h-3"/> Permissions
//                       </button>
//                       )}

//                       {/* Delete → inline modal */}
//                       {hasPermission(P.USER_DELETE) && (
//                       <button onClick={()=>setDeleteUser(u)}
//                         className="w-9 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold flex items-center justify-center transition-all">
//                         <FiTrash2 className="w-3.5 h-3.5"/>
//                       </button>
//                       )}
//                     </div>
//                   </div>
//                 );
//               })}
//           </div>

//           {/* ── PAGINATION ── */}
//           {filtered.length > 0 && (
//             <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3">
//               <p className="text-xs text-slate-400 font-medium">
//                 Showing{" "}
//                 <span className="font-bold text-slate-600">{(page-1)*perPage+1}</span>–
//                 <span className="font-bold text-slate-600">{Math.min(page*perPage,filtered.length)}</span>
//                 {" "}of{" "}
//                 <span className="font-bold text-slate-600">{filtered.length}</span> users
//               </p>
//               <div className="flex items-center gap-1.5">
//                 <button disabled={page===1} onClick={()=>setPage(1)}
//                   className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center">
//                   <FaAngleDoubleLeft className="text-xs"/>
//                 </button>
//                 <button disabled={page===1} onClick={()=>setPage(p=>p-1)}
//                   className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center">
//                   <FiChevronLeft className="text-xs"/>
//                 </button>
//                 {Array.from({length:totalPages},(_,i)=>i+1)
//                   .filter(p=>p===1||p===totalPages||Math.abs(p-page)<=1)
//                   .reduce((acc,p,i,arr)=>{ if(i>0&&p-arr[i-1]>1) acc.push("…"); acc.push(p); return acc; },[])
//                   .map((p,i)=>
//                     typeof p==="string"
//                       ? <span key={`e${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-slate-400">…</span>
//                       : <button key={p} onClick={()=>setPage(p)}
//                           className={`w-8 h-8 rounded-lg text-xs font-bold transition-all border
//                             ${page===p
//                               ?"bg-blue-600 border-blue-600 text-white shadow-sm"
//                               :"bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600"}`}>
//                           {p}
//                         </button>
//                   )}
//                 <button disabled={page===totalPages} onClick={()=>setPage(p=>p+1)}
//                   className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center">
//                   <FiChevronRight className="text-xs"/>
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


import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { UserPlus as FiUserPlus, Search as FiSearch, Pen as FiEdit2, Trash2 as FiTrash2, ChevronLeft as FiChevronLeft, ChevronRight as FiChevronRight, Shield as FiShield, Users as FaUsers, UserCheck as FaUserCheck, UserX as FaUserTimes, ShieldUser as FaUserShield, ChevronsLeft as FaAngleDoubleLeft, ChevronsRight as FaAngleDoubleRight, ChevronDown as FiChevronDown,
ChevronUp as FiChevronUp } from "lucide-react";


import userService from "../api/profileUserService";
import { hasPermission, P } from "@shared/lib/access";

/* Users are loaded from the API — see profileUserService.getAll(). */

const AVATAR_GRADS = [
  "from-blue-500 to-blue-600","from-purple-500 to-purple-600",
  "from-teal-500 to-teal-600","from-rose-500 to-rose-600",
  "from-amber-500 to-amber-600","from-indigo-500 to-indigo-600",
  "from-green-500 to-green-600","from-cyan-500 to-cyan-600",
];

const initials = (name="") =>
  name.trim().split(" ").filter(Boolean).map(w=>w[0]).join("").slice(0,2).toUpperCase()||"U";
// id is a UUID string — hash it to a stable gradient index.
const avatarGrad = (id) => {
  const s = String(id || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i)) % AVATAR_GRADS.length;
  return AVATAR_GRADS[h];
};

const ROLE_CFG = {
  "Organization Admin": { bg:"bg-purple-100", text:"text-purple-700", border:"border-purple-200" },
  Manager:        { bg:"bg-indigo-100", text:"text-indigo-700", border:"border-indigo-200" },
  "Travel Agent": { bg:"bg-blue-100",   text:"text-blue-700",   border:"border-blue-200"   },
  Staff:          { bg:"bg-slate-100",  text:"text-slate-700",  border:"border-slate-200"  },
  Account:        { bg:"bg-amber-100",  text:"text-amber-700",  border:"border-amber-200"  },
};
const STATUS_CFG = {
  Active:   { bg:"bg-emerald-100", text:"text-emerald-700", dot:"bg-emerald-500" },
  Inactive: { bg:"bg-slate-100",   text:"text-slate-500",   dot:"bg-slate-400"   },
};


/* ─── TOAST ──────────────────────────────────────────────────── */
function Toast({ msg, type, onClose }) {
  useEffect(()=>{ const t=setTimeout(onClose,3500); return()=>clearTimeout(t); },[onClose]);
  return (
    <div className={`fixed top-5 right-5 z-[999] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl max-w-xs
      ${type==="success"?"bg-green-50 border-green-200 text-green-800":"bg-red-50 border-red-200 text-red-800"}`}
      style={{animation:"slideIn .3s ease both"}}>
      <span className="text-lg">{type==="success"?"✅":"❌"}</span>
      <p className="text-sm font-semibold flex-1 min-w-0 truncate">{msg}</p>
      <button onClick={onClose} className="opacity-50 hover:opacity-100 text-lg ml-1 flex-shrink-0">×</button>
    </div>
  );
}

/* ─── STAT CARD ──────────────────────────────────────────────── */
function StatCard({ icon:Icon, label, value, gradient, sub, delay=0 }) {
  const [displayed, setDisplayed] = useState(0);
  useEffect(()=>{
    if(!value){ setDisplayed(0); return; }
    let s=0; const step=Math.max(1,Math.ceil(value/50));
    const iv=setInterval(()=>{ s=Math.min(s+step,value); setDisplayed(s); if(s>=value)clearInterval(iv); },16);
    return()=>clearInterval(iv);
  },[value]);
  return (
    <div className={`bg-gradient-to-br ${gradient} rounded-2xl p-4 sm:p-5 text-white shadow-lg relative overflow-hidden group
      hover:-translate-y-1 hover:shadow-xl transition-all duration-300 cursor-pointer w-full`}
      style={{animationDelay:`${delay}ms`}}>
      <div className="absolute -right-5 -top-5 w-24 h-24 rounded-full bg-white/10 group-hover:scale-110 transition-transform duration-300"/>
      <div className="absolute -right-3 -bottom-8 w-32 h-32 rounded-full bg-white/10"/>
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 group-hover:bg-white/30 flex items-center justify-center transition-all flex-shrink-0">
            <Icon className="w-5 h-5"/>
          </div>
          {sub&&<span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full flex-shrink-0">{sub}</span>}
        </div>
        <p className="text-2xl sm:text-3xl font-extrabold leading-none mb-1 truncate">{displayed}</p>
        <p className="text-xs font-bold uppercase tracking-widest opacity-80 truncate">{label}</p>
      </div>
    </div>
  );
}

/* ─── SKELETON ROW ───────────────────────────────────────────── */
function SkeletonRow() {
  return (
    <tr>
      {[...Array(9)].map((_,i)=>(
        <td key={i} className="px-4 py-4">
          <div className="h-4 rounded-lg bg-slate-200 animate-pulse" style={{width:`${40+Math.random()*50}%`}}/>
        </td>
      ))}
    </tr>
  );
}

/* ─── DELETE CONFIRM MODAL — kept inline ─────────────────────── */
function DeleteConfirm({ user, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm z-10 p-6 text-center"
        style={{animation:"popIn .25s ease both"}}>
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-3xl mx-auto mb-4">🗑️</div>
        <h3 className="text-lg font-extrabold text-slate-800 mb-1">Delete User?</h3>
        <p className="text-sm text-slate-500 mb-5">
          Are you sure you want to delete{" "}
          <span className="font-bold text-slate-700">{user?.fullName}</span>?
          This action cannot be undone.
        </p>
        <div className="flex gap-3 flex-wrap sm:flex-nowrap">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all w-full sm:w-auto">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md shadow-red-200 transition-all w-full sm:w-auto">
            Yes, Delete
          </button>
        </div>
      </div>
    </div>
  );
}


/* ─── MAIN PAGE ──────────────────────────────────────────────── */
export default function Users() {
  const navigate = useNavigate();

  const [users,      setUsers]      = useState([]);
  const [search,     setSearch]     = useState("");
  const [activeTab,  setActiveTab]  = useState("All");
  const [loading,    setLoading]    = useState(true);
  const [toast,      setToast]      = useState(null);
  const [page,       setPage]       = useState(1);

  const [userStatsOpen, setUserStatsOpen] = useState(false);

  const perPage = 8;

  // Only delete + reset modals remain inline
  const [deleteUser, setDeleteUser] = useState(null);

  const showToast = useCallback((msg, type="success")=>setToast({msg,type}),[]);

  useEffect(() => {
  setLoading(true);

  userService
    .getAll()
    .then((res) => {
      setUsers(res.data);
    })
    .catch(() => {
      showToast("Failed to load users.", "error");
    })
    .finally(() => {
      setLoading(false);
    });
}, [showToast]);

  

  /* stats */
  const stats = useMemo(()=>({
    total:    users.length,
    active:   users.filter(u=>u.status==="Active").length,
    inactive: users.filter(u=>u.status==="Inactive").length,
    admins:   users.filter(u=>u.role==="Organization Admin").length,
  }),[users]);

  /* filtered list */
  const filtered = useMemo(()=>{
    let out = [...users];
    const q = search.toLowerCase();
    if(q) out = out.filter(u=>
      (u.username || "").toLowerCase().includes(q)||
      (u.username || "").toLowerCase().includes(q)||
      (u.email || "").toLowerCase().includes(q)||
      String(u.id).includes(q)
    );
    if(activeTab==="Active")   out = out.filter(u=>u.status==="Active");
    if(activeTab==="Inactive") out = out.filter(u=>u.status==="Inactive");
    return out;
  },[users,search,activeTab]);

  const totalPages = Math.max(1,Math.ceil(filtered.length/perPage));
  const pageData   = filtered.slice((page-1)*perPage, page*perPage);

  /* delete handler */
  const handleDelete = async () => {
  try {
    await userService.delete(deleteUser.id);

    setUsers((prev) =>
      prev.filter((u) => u.id !== deleteUser.id)
    );

    showToast(
      `"${deleteUser.fullName}" deleted.`
    );
  } catch (err) {
    showToast(
      err?.response?.data?.message ||
      "Failed to delete user.",
      "error"
    );
  } finally {
    setDeleteUser(null);
  }
};

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100"
      style={{fontFamily:"'Plus Jakarta Sans', system-ui, sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes slideIn { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes popIn   { from{transform:scale(.92);opacity:0} to{transform:scale(1);opacity:1} }
        .fade-up { animation: fadeUp .4s ease both; }
        select { -webkit-appearance:none; appearance:none; }
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#f1f5f9;border-radius:99px}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:99px}
      `}</style>

      {toast      && <Toast msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
      {deleteUser && <DeleteConfirm user={deleteUser} onClose={()=>setDeleteUser(null)} onConfirm={handleDelete}/>}

      {/* ── PAGE HEADER ── */}
      <div className="bg-white/70 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-white text-xl shadow-lg shadow-blue-200 flex-shrink-0">
                <FaUsers className="w-5 h-5"/>
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2 flex-wrap">
                  Users
                  <span className="inline-block text-[10px] sm:text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                    {users.length} total
                  </span>
                </h1>
                <p className="text-sm text-slate-400 mt-0.5 truncate">
                  Manage staff accounts, roles &amp; permissions
                  <span className="hidden sm:inline ml-3 text-slate-300">|</span>
                  <span className="hidden sm:inline ml-3 text-xs">
                    <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={()=>navigate("/")}>Home</span>
                    <span className="mx-1 text-slate-300">/</span>
                    <span className="text-blue-600 font-bold">Users</span>
                  </span>
                </p>
              </div>
            </div>

            {/* ── ADD NEW USER → navigates to /CreateUser (USER_CREATE only) ── */}
            {hasPermission(P.USER_CREATE) && (
            <button onClick={()=>navigate("/CreateUser")}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold
                shadow-md shadow-blue-200 hover:shadow-lg transition-all">
              <FiUserPlus className="w-4 h-4"/> Add New User
            </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── COLLAPSIBLE USER ANALYTICS ── */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden fade-up">
          {/* Toggle header */}
          <button
            type="button"
            onClick={() => setUserStatsOpen((previous) => !previous)}
            aria-expanded={userStatsOpen}
            className="w-full px-4 sm:px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3 flex-wrap min-w-0">
              <div className="flex items-center gap-2 flex-shrink-0">
                <FaUsers className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-extrabold text-slate-700 whitespace-nowrap">
                  User Analytics
                </span>
              </div>

              {/* Compact values displayed when cards are closed */}
              {!userStatsOpen && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-1 rounded-full bg-cyan-100 text-cyan-700 text-[11px] font-bold">
                    {stats.total} Users
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-[11px] font-bold hidden sm:inline-flex">
                    {stats.active} Active
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold hidden sm:inline-flex">
                    {stats.inactive} Inactive
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 text-[11px] font-bold">
                    {stats.admins} Admins
                  </span>
                </div>
              )}
            </div>

            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
              {userStatsOpen ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {/* Expandable cards */}
          <div
            className={`grid transition-all duration-300 ease-in-out ${
              userStatsOpen
                ? "grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 pt-1">
                {[
                  { icon: FaUsers, label: "Total Users", value: stats.total, gradient: "from-cyan-500 to-cyan-600", delay: 0 },
                  { icon: FaUserCheck, label: "Active Users", value: stats.active, gradient: "from-green-500 to-emerald-600", delay: 60 },
                  { icon: FaUserTimes, label: "Inactive Users", value: stats.inactive, gradient: "from-slate-500 to-slate-600", delay: 120 },
                  { icon: FaUserShield, label: "Admins", value: stats.admins, gradient: "from-purple-500 to-purple-600", delay: 180 },
                ].map((card) => (
                  <div key={card.label} className="fade-up" style={{ animationDelay: `${card.delay}ms` }}>
                    <StatCard {...card} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── USER LIST CARD ── */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">

          {/* List header */}
          <div className="px-4 sm:px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-extrabold text-slate-700">User List</h2>
              <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2.5 py-1 rounded-full">
                {filtered.length} results
              </span>
            </div>
            {hasPermission(P.USER_CREATE) && (
            <button onClick={()=>navigate("/CreateUser")}
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-200 transition-all">
              <FiUserPlus className="w-3.5 h-3.5"/> Add New User
            </button>
            )}
          </div>

          {/* Search + Status filter tabs */}
          <div className="px-4 sm:px-5 py-4 border-b border-slate-100 bg-slate-50/60">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="relative flex-1 w-full sm:w-auto min-w-0 sm:min-w-[200px]">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                <input value={search} onChange={e=>{ setSearch(e.target.value); setPage(1); }}
                  placeholder="Search by name, username, email, ID..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder-slate-400
                    focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none transition-all"/>
              </div>

              <div className="flex w-full sm:w-auto rounded-xl border border-slate-200 overflow-hidden flex-shrink-0">
                {["Active","Inactive","All"].map(tab=>(
                  <button key={tab} onClick={()=>{ setActiveTab(tab); setPage(1); }}
                    className={`flex-1 sm:flex-none px-4 py-2.5 text-xs font-bold transition-all whitespace-nowrap
                      ${activeTab===tab
                        ? tab==="Active"    ? "bg-emerald-500 text-white"
                          : tab==="Inactive" ? "bg-slate-500 text-white"
                          : "bg-blue-600 text-white"
                        : "bg-white text-slate-500 hover:bg-slate-50"}`}>
                    {tab}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── DESKTOP TABLE ── */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-slate-50/80 border-b border-slate-100">
                <tr>
                  {["ID","Username","Full Name","Email","Role","Status","Last Login","Created","Actions"].map(h=>(
                    <th key={h} className="px-4 py-3.5 text-left text-xs font-extrabold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading
                  ? [...Array(5)].map((_,i)=><SkeletonRow key={i}/>)
                  : pageData.length===0
                  ? (
                    <tr>
                      <td colSpan={9} className="text-center py-20">
                        <div className="text-5xl mb-3">👥</div>
                        <p className="text-base font-extrabold text-slate-600 mb-1">No Users Found</p>
                        <p className="text-sm text-slate-400 mb-4">
                          {search||activeTab!=="All"
                            ? "Try adjusting your search or filters."
                            : "Add your first user to get started."}
                        </p>
                        {search||activeTab!=="All"
                          ? <button onClick={()=>{ setSearch(""); setActiveTab("All"); }}
                              className="px-4 py-2 rounded-xl bg-blue-50 text-blue-600 font-bold text-sm hover:bg-blue-100 transition-all">
                              Clear Filters
                            </button>
                          : <button onClick={()=>navigate("/CreateUser")}
                              className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-md hover:bg-blue-700 transition-all flex items-center gap-2 mx-auto">
                              <FiUserPlus/> Add First User
                            </button>}
                      </td>
                    </tr>
                  )
                  : pageData.map((u,idx)=>{
                    const rc = ROLE_CFG[u.role]    || ROLE_CFG.Staff;
                    const sc = STATUS_CFG[u.status] || STATUS_CFG.Inactive;
                    return (
                      <tr key={u.id}
                        className="group transition-all duration-150 hover:bg-blue-50/40 hover:shadow-[inset_3px_0_0_#2563eb]"
                        style={{animation:"fadeUp .35s ease both", animationDelay:`${idx*30}ms`}}>

                        {/* ID */}
                        <td className="px-4 py-3.5">
                          <span className="text-xs font-extrabold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg" title={u.id}>{String(u.id).slice(0,8)}</span>
                        </td>

                        {/* Username + avatar */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${avatarGrad(u.id)} flex items-center justify-center text-white text-xs font-extrabold flex-shrink-0`}>
                              {initials(u.fullName)}
                            </div>
                            <span className="text-sm font-bold text-blue-600">{u.username}</span>
                          </div>
                        </td>

                        {/* Full Name */}
                        <td className="px-4 py-3.5">
                          <p className="text-sm font-semibold text-slate-800">{u.fullName}</p>
                        </td>

                        {/* Email */}
                        <td className="px-4 py-3.5">
                          <p className="text-sm text-slate-600 truncate max-w-[200px]">{u.email}</p>
                        </td>

                        {/* Role */}
                        <td className="px-4 py-3.5">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${rc.border} ${rc.bg} ${rc.text} whitespace-nowrap`}>
                            {u.role}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-full ${sc.bg} ${sc.text} whitespace-nowrap`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}/>
                            {u.status}
                          </span>
                        </td>

                        {/* Last Login */}
                        <td className="px-4 py-3.5">
                          <p className="text-xs text-slate-500 font-medium">{u.lastLogin}</p>
                        </td>

                        {/* Created */}
                        <td className="px-4 py-3.5">
                          <p className="text-xs text-slate-500 font-medium">{u.createdAt}</p>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                            {/* ── EDIT → navigates to /EditUser/:id ── */}
                            {hasPermission(P.USER_UPDATE) && (
                            <button onClick={()=>navigate(`/EditUser/${u.id}`)}
                             title="Edit User"
                              className="w-8 h-8 rounded-lg bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition-all text-sm shadow-sm">
                              <FiEdit2 className="w-3.5 h-3.5"/>
                            </button>
                            )}

                            {/* DELETE → inline modal */}
                            {hasPermission(P.USER_DELETE) && (
                            <button onClick={()=>setDeleteUser(u)} title="Delete User"
                              className="w-8 h-8 rounded-lg bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all text-sm shadow-sm">
                              <FiTrash2 className="w-3.5 h-3.5"/>
                            </button>
                            )}

                            {/* MANAGE PERMISSIONS → navigates to /UserPermissions/:id */}
                            {hasPermission(P.USER_UPDATE) && (
                            <button onClick={()=>navigate(`/UserPermissions/${u.id}`)}
                            title="Manage Permissions"
                              className="w-8 h-8 rounded-lg bg-teal-500 hover:bg-teal-600 text-white flex items-center justify-center transition-all text-sm shadow-sm">
                              <FiShield className="w-3.5 h-3.5"/>
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
          <div className="lg:hidden p-4 space-y-3">
            {loading
              ? [...Array(4)].map((_,i)=>(
                  <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
                    {[...Array(3)].map((_,j)=>(
                      <div key={j} className="h-4 rounded-lg bg-slate-200 animate-pulse" style={{width:`${40+Math.random()*50}%`}}/>
                    ))}
                  </div>
                ))
              : pageData.length===0
              ? (
                <div className="text-center py-14">
                  <div className="text-5xl mb-3">👥</div>
                  <p className="text-base font-extrabold text-slate-600 mb-1">No Users Found</p>
                  <p className="text-sm text-slate-400 mb-4">
                    {search||activeTab!=="All" ? "Adjust filters." : "Add your first user."}
                  </p>
                  {!search&&activeTab==="All"&&(
                    <button onClick={()=>navigate("/CreateUser")}
                      className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm">
                      + Add User
                    </button>
                  )}
                </div>
              )
              : pageData.map((u,idx)=>{
                const rc = ROLE_CFG[u.role]    || ROLE_CFG.Staff;
                const sc = STATUS_CFG[u.status] || STATUS_CFG.Inactive;
                return (
                  <div key={u.id}
                    className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3 fade-up overflow-hidden"
                    style={{animationDelay:`${idx*40}ms`}}>
                    
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${avatarGrad(u.id)} flex items-center justify-center text-white text-sm font-extrabold flex-shrink-0`}>
                          {initials(u.fullName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-extrabold text-slate-800 text-sm truncate">{u.fullName}</p>
                          <p className="text-xs font-bold text-blue-600 truncate">{u.username}</p>
                          <p className="text-xs text-slate-400 truncate" title={u.id}>#{String(u.id).slice(0,8)}</p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${sc.bg} ${sc.text} flex-shrink-0`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}/>{u.status}
                      </span>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="col-span-2 bg-slate-50 rounded-lg px-3 py-2 min-w-0 flex flex-col justify-center">
                        <p className="text-slate-400 mb-0.5">Email</p>
                        <p className="font-bold text-slate-700 truncate">{u.email || "—"}</p>
                      </div>
                      <div className="col-span-2 bg-slate-50 rounded-lg px-3 py-2 min-w-0 flex items-center justify-between gap-2">
                        <p className="text-slate-400">Role</p>
                        <span className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full border ${rc.border} ${rc.bg} ${rc.text} whitespace-nowrap truncate`}>
                          {u.role}
                        </span>
                      </div>
                      <div className="bg-slate-50 rounded-lg px-3 py-2 min-w-0 flex flex-col justify-center">
                        <p className="text-slate-400 mb-0.5">Last Login</p>
                        <p className="font-bold text-slate-700 truncate">{u.lastLogin || "—"}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg px-3 py-2 min-w-0 flex flex-col justify-center">
                        <p className="text-slate-400 mb-0.5">Created</p>
                        <p className="font-bold text-slate-700 truncate">{u.createdAt || "—"}</p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {hasPermission(P.USER_UPDATE) && (
                      <button onClick={()=>navigate(`/EditUser/${u.id}`)}
                        className="flex-1 min-w-[70px] py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm">
                        <FiEdit2 className="w-3.5 h-3.5"/> <span className="hidden sm:inline">Edit</span>
                      </button>
                      )}
                      {hasPermission(P.USER_UPDATE) && (
                      <button onClick={()=>navigate(`/UserPermissions/${u.id}`)}
                        className="flex-1 min-w-[70px] py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm">
                        <FiShield className="w-3.5 h-3.5"/> <span className="hidden sm:inline">Permissions</span>
                      </button>
                      )}
                      {hasPermission(P.USER_DELETE) && (
                      <button onClick={()=>setDeleteUser(u)}
                        className="flex-1 max-w-[60px] min-w-[50px] py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold flex items-center justify-center transition-all shadow-sm">
                        <FiTrash2 className="w-4 h-4"/>
                      </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* ── PAGINATION ── */}
          {filtered.length > 0 && (
            <div className="px-4 sm:px-5 py-4 border-t border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-slate-400 font-medium text-center sm:text-left">
                Showing{" "}
                <span className="font-bold text-slate-600">{(page-1)*perPage+1}</span>–
                <span className="font-bold text-slate-600">{Math.min(page*perPage,filtered.length)}</span>
                {" "}of{" "}
                <span className="font-bold text-slate-600">{filtered.length}</span> users
              </p>
              <div className="flex items-center justify-center flex-wrap gap-1.5">
                <button disabled={page===1} onClick={()=>setPage(1)}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center">
                  <FaAngleDoubleLeft className="text-xs"/>
                </button>
                <button disabled={page===1} onClick={()=>setPage(p=>p-1)}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center">
                  <FiChevronLeft className="text-xs"/>
                </button>
                {Array.from({length:totalPages},(_,i)=>i+1)
                  .filter(p=>p===1||p===totalPages||Math.abs(p-page)<=1)
                  .reduce((acc,p,i,arr)=>{ if(i>0&&p-arr[i-1]>1) acc.push("…"); acc.push(p); return acc; },[])
                  .map((p,i)=>
                    typeof p==="string"
                      ? <span key={`e${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-slate-400">…</span>
                      : <button key={p} onClick={()=>setPage(p)}
                          className={`w-8 h-8 rounded-lg text-xs font-bold transition-all border
                            ${page===p
                              ?"bg-blue-600 border-blue-600 text-white shadow-sm"
                              :"bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600"}`}>
                          {p}
                        </button>
                  )}
                <button disabled={page===totalPages} onClick={()=>setPage(p=>p+1)}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center">
                  <FiChevronRight className="text-xs"/>
                </button>
                <button disabled={page===totalPages} onClick={()=>setPage(totalPages)}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center">
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