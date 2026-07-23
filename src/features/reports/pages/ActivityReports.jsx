import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Activity as FiActivity, Filter as FiFilter, RefreshCw as FiRefreshCw, Download as FiDownload, Eye as FiEye, ChevronDown as FiChevronDown, ChevronUp as FiChevronUp, ArrowLeft as FiArrowLeft, ChevronLeft as FiChevronLeft, ChevronRight as FiChevronRight, ChevronsLeft as FaAngleDoubleLeft, ChevronsRight as FaAngleDoubleRight, ChartColumn as MdOutlineBarChart } from "lucide-react";


import activityReportsService from "../api/activityReportsService";
import { DEFAULT_START, DEFAULT_END } from "../dateDefaults";

const ACTION_TYPES = ["All Actions","Login","Logout","Create","Update","Delete","Settings","Export"];
const USER_TYPES   = ["All Types","Admin","User","Manager","Staff"];
const PER_PAGE_OPT = ["10","25","50","100"];

const ACTION_CFG = {
  Login:    { bg:"bg-emerald-500", text:"text-white", label:"⬆ Login"    },
  Logout:   { bg:"bg-slate-500",   text:"text-white", label:"⬇ Logout"   },
  Create:   { bg:"bg-blue-500",    text:"text-white", label:"＋ Create"   },
  Update:   { bg:"bg-amber-500",   text:"text-white", label:"✏ Update"   },
  Delete:   { bg:"bg-red-500",     text:"text-white", label:"🗑 Delete"   },
  Settings: { bg:"bg-purple-500",  text:"text-white", label:"⚙ Settings" },
  Export:   { bg:"bg-teal-500",    text:"text-white", label:"⬇ Export"   },
};
const TYPE_CFG = {
  Admin:   { bg:"bg-slate-600",  text:"text-white" },
  User:    { bg:"bg-blue-500",   text:"text-white" },
  Manager: { bg:"bg-purple-500", text:"text-white" },
  Staff:   { bg:"bg-teal-500",   text:"text-white" },
};

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

/* ─── STAT CARD ──────────────────────────────────────────────── */
function StatCard({ icon, label, value, gradient, delay=0 }) {
  const [displayed, setDisplayed] = useState(0);
  useEffect(()=>{
    if(!value){ setDisplayed(0); return; }
    let s=0; const step=Math.max(1,Math.ceil(value/60));
    const iv=setInterval(()=>{ s=Math.min(s+step,value); setDisplayed(s); if(s>=value)clearInterval(iv); },16);
    return()=>clearInterval(iv);
  },[value]);
  return (
    <div className={`bg-gradient-to-br ${gradient} rounded-2xl p-5 text-white shadow-lg relative overflow-hidden group
      hover:-translate-y-1 hover:shadow-xl transition-all duration-300`}
      style={{animation:"fadeUp .4s ease both", animationDelay:`${delay}ms`}}>
      <div className="absolute -right-5 -top-5 w-24 h-24 rounded-full bg-white/10 group-hover:scale-110 transition-transform"/>
      <div className="absolute -right-3 -bottom-8 w-32 h-32 rounded-full bg-white/10"/>
      <div className="relative z-10">
        <div className="w-10 h-10 rounded-xl bg-white/20 group-hover:bg-white/30 flex items-center justify-center mb-3 transition-all text-xl">
          {icon}
        </div>
        <p className="text-2xl sm:text-3xl font-extrabold leading-none mb-1">{displayed}</p>
        <p className="text-xs font-bold uppercase tracking-widest opacity-80">{label}</p>
      </div>
    </div>
  );
}

/* ─── VIEW DETAIL MODAL ──────────────────────────────────────── */
function DetailModal({ log, onClose }) {
  if(!log) return null;
  const ac = ACTION_CFG[log.action] || ACTION_CFG.Login;
  const tc = TYPE_CFG[log.type]     || TYPE_CFG.User;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10"
        style={{animation:"popIn .25s ease both"}}>
        {/* Modal header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-5 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white">
              <FiEye className="w-4 h-4"/>
            </div>
            <div>
              <h2 className="text-white font-extrabold text-base">Activity Details</h2>
              <p className="text-white/70 text-xs mt-0.5">{log.date} {log.time}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-lg transition-all">×</button>
        </div>
        {/* Modal body */}
        <div className="p-6 space-y-3">
          {[
            { label:"User",        value:log.user         },
            { label:"Username",    value:log.username      },
            { label:"Date & Time", value:`${log.date} ${log.time}` },
            { label:"IP Address",  value:log.ip, mono:true },
            { label:"Description", value:log.description  },
          ].map(({label,value,mono})=>(
            <div key={label} className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wide w-28 flex-shrink-0 pt-0.5">{label}</span>
              <span className={`text-sm font-semibold text-slate-700 ${mono?"font-mono":""}`}>{value}</span>
            </div>
          ))}
          <div className="flex items-center gap-3 py-2.5 border-b border-slate-100">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wide w-28 flex-shrink-0">Type</span>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${tc.bg} ${tc.text}`}>{log.type}</span>
          </div>
          <div className="flex items-center gap-3 py-2.5">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wide w-28 flex-shrink-0">Action</span>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${ac.bg} ${ac.text}`}>{log.action}</span>
          </div>
          <button onClick={onClose}
            className="w-full mt-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-all shadow-md shadow-blue-200">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── SKELETON ROW ───────────────────────────────────────────── */
function SkeletonRow() {
  return (
    <tr>
      {[...Array(7)].map((_,i)=>(
        <td key={i} className="px-4 py-4">
          <div className="h-4 rounded-lg bg-slate-200 animate-pulse" style={{width:`${35+Math.random()*50}%`}}/>
        </td>
      ))}
    </tr>
  );
}

/* ─── SELECT INPUT ───────────────────────────────────────────── */
function FilterSelect({ value, onChange, options, className="" }) {
  return (
    <div className={`relative ${className}`}>
      <select value={value} onChange={e=>onChange(e.target.value)}
        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 font-medium
          focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none appearance-none cursor-pointer transition-all hover:border-slate-300">
        {options.map(o=><option key={o}>{o}</option>)}
      </select>
      <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"/>
    </div>
  );
}

/* ─── MAIN PAGE ──────────────────────────────────────────────── */
export default function ActivityReports() {
  const navigate = useNavigate();

  // Filter state
  const [startDate,   setStartDate]   = useState(DEFAULT_START);
  const [endDate,     setEndDate]     = useState(DEFAULT_END);
  const [action,      setAction]      = useState("All Actions");
  const [userType,    setUserType]    = useState("All Types");
  const [user,        setUser]        = useState("All Users");
  const [perPage,     setPerPage]     = useState("50");
  const [filtersOpen, setFiltersOpen] = useState(true);

  const [activityStatsOpen, setActivityStatsOpen] = useState(false);

  const [applied,     setApplied]     = useState({startDate:DEFAULT_START,endDate:DEFAULT_END,action:"All Actions",userType:"All Types",user:"All Users"});

  // Data state
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [page,    setPage]    = useState(1);
  const [toast,   setToast]   = useState(null);
  const [detail,  setDetail]  = useState(null);

  const showToast = useCallback((msg,type="success")=>setToast({msg,type}),[]);

  useEffect(()=>{
    let alive = true;
    setLoading(true);
    // Fetch all logs in the date range; action/userType/user filtering + pagination stay client-side.
    activityReportsService.getLogs({
      startDate: applied.startDate,
      endDate:   applied.endDate,
      perPage:   1000,
      page:      1,
    })
      .then((res)=>{ if(alive) setLogs(res.data?.logs || []); })
      .catch(()=>{ if(alive){ setLogs([]); showToast("Failed to load activity logs.", "error"); } })
      .finally(()=>{ if(alive) setLoading(false); });
    return ()=>{ alive = false; };
  },[applied, showToast]);

  /* apply filters */
  const handleApply = () => {
    setApplied({startDate,endDate,action,userType,user});
    setPage(1);
    showToast("Filters applied.");
  };

  /* reset filters */
  const handleReset = () => {
    setStartDate(DEFAULT_START); setEndDate(DEFAULT_END);
    setAction("All Actions"); setUserType("All Types");
    setUser("All Users"); setPerPage("50");
    setApplied({startDate:DEFAULT_START,endDate:DEFAULT_END,action:"All Actions",userType:"All Types",user:"All Users"});
    setPage(1);
    showToast("Filters reset.");
  };

  /* export CSV — server-side, honours the applied filters */
  const handleExportCSV = async () => {
    try {
      const res = await activityReportsService.exportCsv({
        startDate: applied.startDate,
        endDate:   applied.endDate,
        action:    applied.action,
        userType:  applied.userType,
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a   = document.createElement("a");
      a.href    = url;
      a.download = `activity-report-${applied.startDate}-to-${applied.endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast("CSV exported successfully.");
    } catch {
      showToast("Export failed. Try again.", "error");
    }
  };

  /* filtered data */
  const filtered = useMemo(()=>{
    return logs.filter(l=>{
      if(applied.action   !=="All Actions" && l.action!==applied.action)   return false;
      if(applied.userType !=="All Types"   && l.type  !==applied.userType) return false;
      if(applied.user     !=="All Users"   && l.user  !==applied.user)     return false;
      return true;
    });
  },[logs,applied]);

  /* user dropdown options — derived from the loaded logs (real data, not hardcoded) */
  const userOptions = useMemo(
    () => ["All Users", ...Array.from(new Set(logs.map(l=>l.user).filter(Boolean)))],
    [logs]
  );

  const pp         = Number(perPage);
  const totalPages = Math.max(1,Math.ceil(filtered.length/pp));
  const pageData   = filtered.slice((page-1)*pp, page*pp);

  /* stats */
  const stats = useMemo(()=>({
    total:   filtered.length,
    logins:  filtered.filter(l=>l.action==="Login").length,
    admins:  filtered.filter(l=>l.type==="Admin").length,
    unique:  [...new Set(filtered.map(l=>l.username))].length,
  }),[filtered]);

  const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 font-medium focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none transition-all hover:border-slate-300";

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

      {toast  && <Toast msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
      {detail && <DetailModal log={detail} onClose={()=>setDetail(null)}/>}

      {/* ── PAGE HEADER ── */}
      <div className="bg-white/70 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-white shadow-lg shadow-blue-200 flex-shrink-0">
                <FiActivity className="w-5 h-5"/>
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                  Activity Reports
                </h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  Track user activities and system events
                  <span className="hidden sm:inline ml-3 text-slate-300">|</span>
                  <span className="hidden sm:inline ml-3 text-xs">
                    <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={()=>navigate("/")}>Home</span>
                    <span className="mx-1 text-slate-300">/</span>
                    <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={()=>navigate("/ReportsDashboard")}>Reports</span>
                    <span className="mx-1 text-slate-300">/</span>
                    <span className="text-blue-600 font-bold">Activity</span>
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

        {/* ── STAT CARDS ── */}
        {/* <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon:"📋", label:"Total Activities", value:stats.total,  gradient:"from-blue-600 to-blue-700",     delay:0   },
            { icon:"⬆️", label:"Total Logins",     value:stats.logins, gradient:"from-green-500 to-emerald-600", delay:60  },
            { icon:"👤", label:"Admin Actions",    value:stats.admins, gradient:"from-purple-500 to-purple-600", delay:120 },
            { icon:"🧑‍💼", label:"Unique Users",    value:stats.unique, gradient:"from-amber-500 to-orange-500",  delay:180 },
          ].map(s=><StatCard key={s.label} {...s}/>)}
        </div> */}

        {/* ── COLLAPSIBLE ACTIVITY ANALYTICS ── */}
<div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden fade-up">

  {/* Toggle header */}
  <button
    type="button"
    onClick={() =>
      setActivityStatsOpen((previous) => !previous)
    }
    aria-expanded={activityStatsOpen}
    className="w-full px-4 sm:px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
  >
    <div className="flex items-center gap-3 flex-wrap min-w-0">
      <div className="flex items-center gap-2">
        <FiActivity className="w-4 h-4 text-blue-600" />

        <span className="text-sm font-extrabold text-slate-700">
          Activity Analytics
        </span>
      </div>

      {/* Compact values shown while cards are closed */}
      {!activityStatsOpen && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold">
            {stats.total} Activities
          </span>

          <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-[11px] font-bold">
            {stats.logins} Logins
          </span>

          <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 text-[11px] font-bold">
            {stats.admins} Admin Actions
          </span>

          <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold">
            {stats.unique} Unique Users
          </span>
        </div>
      )}
    </div>

    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
      {activityStatsOpen ? (
        <FiChevronUp className="w-4 h-4" />
      ) : (
        <FiChevronDown className="w-4 h-4" />
      )}
    </div>
  </button>

  {/* Expandable cards */}
  <div
    className={`grid transition-all duration-300 ease-in-out ${
      activityStatsOpen
        ? "grid-rows-[1fr] opacity-100"
        : "grid-rows-[0fr] opacity-0"
    }`}
  >
    <div className="min-h-0 overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 pt-1">
        {[
          {
            icon: "📋",
            label: "Total Activities",
            value: stats.total,
            gradient: "from-blue-600 to-blue-700",
            delay: 0,
          },
          {
            icon: "⬆️",
            label: "Total Logins",
            value: stats.logins,
            gradient: "from-green-500 to-emerald-600",
            delay: 60,
          },
          {
            icon: "👤",
            label: "Admin Actions",
            value: stats.admins,
            gradient: "from-purple-500 to-purple-600",
            delay: 120,
          },
          {
            icon: "🧑‍💼",
            label: "Unique Users",
            value: stats.unique,
            gradient: "from-amber-500 to-orange-500",
            delay: 180,
          },
        ].map((stat) => (
          <StatCard
            key={stat.label}
            {...stat}
          />
        ))}
      </div>
    </div>
  </div>
</div>

        {/* ── FILTERS & SEARCH PANEL ── */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden fade-up">
          {/* Filter header — collapsible */}
          <button type="button" onClick={()=>setFiltersOpen(v=>!v)}
            className="w-full flex items-center justify-between px-5 py-4 bg-slate-600 hover:bg-slate-700 transition-colors">
            <div className="flex items-center gap-2.5">
              <FiFilter className="w-4 h-4 text-white"/>
              <span className="text-sm font-extrabold text-white">Filters &amp; Search</span>
            </div>
            {filtersOpen
              ? <FiChevronUp   className="w-4 h-4 text-white"/>
              : <FiChevronDown className="w-4 h-4 text-white"/>}
          </button>

          {filtersOpen && (
            <div className="p-5 space-y-4">
              {/* Row 1: Start Date | End Date | Action | User Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">Start Date</label>
                  <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className={inputCls}/>
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">End Date</label>
                  <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className={inputCls}/>
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">Action</label>
                  <FilterSelect value={action} onChange={setAction} options={ACTION_TYPES}/>
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">User Type</label>
                  <FilterSelect value={userType} onChange={setUserType} options={USER_TYPES}/>
                </div>
              </div>

              {/* Row 2: User | Records per page */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">User</label>
                  <FilterSelect value={user} onChange={setUser} options={userOptions}/>
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">Records per page</label>
                  <FilterSelect value={perPage} onChange={v=>{setPerPage(v);setPage(1);}} options={PER_PAGE_OPT}/>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3 pt-1">
                <button onClick={handleApply}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold
                    shadow-md shadow-blue-200 transition-all">
                  <FiFilter className="w-3.5 h-3.5"/> Apply Filters
                </button>
                <button onClick={handleReset}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-slate-200 hover:border-slate-300
                    bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-800 text-sm font-bold transition-all">
                  <FiRefreshCw className="w-3.5 h-3.5"/> Reset
                </button>
                <button onClick={handleExportCSV}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold
                    shadow-md shadow-emerald-200 transition-all">
                  <FiDownload className="w-3.5 h-3.5"/> Export CSV
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── ACTIVITY LOG CARD ── */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden fade-up">

          {/* Card header */}
          <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <MdOutlineBarChart className="w-4 h-4 text-blue-500"/>
                <h2 className="text-base font-extrabold text-slate-700">Activity Log</h2>
              </div>
              <span className="text-xs font-extrabold bg-blue-600 text-white px-2.5 py-1 rounded-full">
                {filtered.length} records
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Showing {filtered.length > 0 ? (page-1)*pp+1 : 0} to {Math.min(page*pp,filtered.length)} of {filtered.length}
            </p>
          </div>

          {/* ── DESKTOP TABLE ── */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-slate-50/80 border-b border-slate-100">
                <tr>
                  {["Date & Time","User","Type","Action","Description","IP Address","Details"].map(h=>(
                    <th key={h} className="px-4 py-3.5 text-left text-xs font-extrabold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading
                  ? [...Array(6)].map((_,i)=><SkeletonRow key={i}/>)
                  : pageData.length===0
                  ? (
                    <tr>
                      <td colSpan={7} className="text-center py-16">
                        <div className="text-5xl mb-3">📋</div>
                        <p className="text-base font-extrabold text-slate-600 mb-1">No Activity Found</p>
                        <p className="text-sm text-slate-400 mb-4">Try adjusting your filters or date range.</p>
                        <button onClick={handleReset}
                          className="px-4 py-2 rounded-xl bg-blue-50 text-blue-600 font-bold text-sm hover:bg-blue-100 transition-all">
                          Reset Filters
                        </button>
                      </td>
                    </tr>
                  )
                  : pageData.map((log,idx)=>{
                    const ac = ACTION_CFG[log.action] || { bg:"bg-slate-400", text:"text-white", label:log.action };
                    const tc = TYPE_CFG[log.type]     || { bg:"bg-slate-400", text:"text-white" };
                    return (
                      <tr key={log.publicId}
                        className="group hover:bg-blue-50/40 hover:shadow-[inset_3px_0_0_#2563eb] transition-all duration-150"
                        style={{animation:"fadeUp .35s ease both", animationDelay:`${idx*25}ms`}}>
                        {/* Date & Time */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <p className="text-sm font-bold text-slate-800">{log.date}</p>
                          <p className="text-xs text-slate-400 font-mono">{log.time}</p>
                        </td>
                        {/* User */}
                        <td className="px-4 py-3.5">
                          <p className="text-sm font-semibold text-slate-800">{log.user}</p>
                          <p className="text-xs text-slate-400">{log.username}</p>
                        </td>
                        {/* Type badge */}
                        <td className="px-4 py-3.5">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${tc.bg} ${tc.text}`}>
                            {log.type}
                          </span>
                        </td>
                        {/* Action badge */}
                        <td className="px-4 py-3.5">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${ac.bg} ${ac.text}`}>
                            {ac.label}
                          </span>
                        </td>
                        {/* Description */}
                        <td className="px-4 py-3.5 max-w-xs">
                          <p className="text-sm text-slate-600 truncate">{log.description}</p>
                        </td>
                        {/* IP Address */}
                        <td className="px-4 py-3.5">
                          <p className="text-xs text-slate-500 font-mono">{log.ip}</p>
                        </td>
                        {/* Details button */}
                        <td className="px-4 py-3.5">
                          <button onClick={()=>setDetail(log)}
                            className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-500 hover:text-blue-600
                              flex items-center justify-center transition-all group-hover:opacity-100">
                            <FiEye className="w-3.5 h-3.5"/>
                          </button>
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
                  <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2 animate-pulse">
                    {[...Array(3)].map((_,j)=><div key={j} className="h-4 rounded-lg bg-slate-200" style={{width:`${40+Math.random()*50}%`}}/>)}
                  </div>
                ))
              : pageData.length===0
              ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-3">📋</div>
                  <p className="text-base font-extrabold text-slate-600 mb-2">No Activity Found</p>
                  <button onClick={handleReset} className="px-4 py-2 rounded-xl bg-blue-50 text-blue-600 font-bold text-sm">Reset Filters</button>
                </div>
              )
              : pageData.map((log,idx)=>{
                const ac = ACTION_CFG[log.action] || { bg:"bg-slate-400", text:"text-white", label:log.action };
                const tc = TYPE_CFG[log.type]     || { bg:"bg-slate-400", text:"text-white" };
                return (
                  <div key={log.publicId} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3 fade-up"
                    style={{animationDelay:`${idx*40}ms`}}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-extrabold text-slate-800">{log.user}</p>
                        <p className="text-xs text-slate-400">{log.username}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${tc.bg} ${tc.text}`}>{log.type}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${ac.bg} ${ac.text}`}>{log.action}</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{log.description}</p>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      <div>
                        <p className="text-xs font-bold text-slate-600">{log.date} <span className="text-slate-400">{log.time}</span></p>
                        <p className="text-xs text-slate-400 font-mono">{log.ip}</p>
                      </div>
                      <button onClick={()=>setDetail(log)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 text-xs font-bold transition-all hover:bg-blue-100">
                        <FiEye className="w-3 h-3"/> Details
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* ── PAGINATION ── */}
          {filtered.length > 0 && (
            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-slate-400 font-medium">
                Showing <span className="font-bold text-slate-600">{(page-1)*pp+1}</span>–
                <span className="font-bold text-slate-600">{Math.min(page*pp,filtered.length)}</span> of{" "}
                <span className="font-bold text-slate-600">{filtered.length}</span> records
              </p>
              <div className="flex items-center gap-1.5">
                {[
                  { icon:<FaAngleDoubleLeft/>,  onClick:()=>setPage(1),            disabled:page===1 },
                  { icon:<FiChevronLeft/>,       onClick:()=>setPage(p=>p-1),       disabled:page===1 },
                ].map((b,i)=>(
                  <button key={i} disabled={b.disabled} onClick={b.onClick}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center">
                    {b.icon}
                  </button>
                ))}
                {Array.from({length:totalPages},(_,i)=>i+1)
                  .filter(p=>p===1||p===totalPages||Math.abs(p-page)<=1)
                  .reduce((acc,p,i,arr)=>{ if(i>0&&p-arr[i-1]>1) acc.push("…"); acc.push(p); return acc; },[])
                  .map((p,i)=>
                    typeof p==="string"
                      ? <span key={`e${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-slate-400">…</span>
                      : <button key={p} onClick={()=>setPage(p)}
                          className={`w-8 h-8 rounded-lg text-xs font-bold transition-all border
                            ${page===p?"bg-blue-600 border-blue-600 text-white shadow-sm":"bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600"}`}>
                          {p}
                        </button>
                  )}
                {[
                  { icon:<FiChevronRight/>,      onClick:()=>setPage(p=>p+1),       disabled:page===totalPages },
                  { icon:<FaAngleDoubleRight/>,  onClick:()=>setPage(totalPages),   disabled:page===totalPages },
                ].map((b,i)=>(
                  <button key={i} disabled={b.disabled} onClick={b.onClick}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center">
                    {b.icon}
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