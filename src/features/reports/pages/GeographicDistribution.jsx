import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Filter as FiFilter, RefreshCw as FiRefreshCw, Download as FiDownload, ArrowLeft as FiArrowLeft, ChevronDown as FiChevronDown, ChevronUp as FiChevronUp, Search as FiSearch, MapPin as FiMapPin, ChevronLeft as FiChevronLeft, ChevronRight as FiChevronRight, MapPinned as FaMapMarkedAlt, Flame as FaFire, Snowflake as FaSnowflake, Users as FaUsers, CircleCheck as FaCheckCircle, Thermometer as FaThermometerHalf, ChevronsLeft as FaAngleDoubleLeft, ChevronsRight as FaAngleDoubleRight, ChartNoAxesColumn as MdOutlineLeaderboard } from "lucide-react";


import geographicDistributionService from "../api/geographicDistributionService";
import { DEFAULT_START, DEFAULT_END } from "../dateDefaults";

const VIEW_TYPES   = ["Departing Cities","Destinations","States","Countries"];
const LEAD_TYPES   = ["All Types","Domestic","International","Corporate","Individual"];
const LEAD_STAGES  = ["All Stages","New Lead","Contacted","Follow Up","Qualified","Proposal Sent","Converted","Lost"];
const SHOW_ENTRIES = ["10","25","50","100"];

/* ─── HELPERS ────────────────────────────────────────────────── */
const pct = (part, total) => total > 0 ? ((part / total) * 100).toFixed(1) : "0.0";
const convRate = (converted, total) => total > 0 ? ((converted / total) * 100).toFixed(1) : "0.0";

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
function StatCard({ icon, label, value, bg, delay=0 }) {
  const [displayed, setDisplayed] = useState(0);
  useEffect(()=>{
    if(!value){ setDisplayed(0); return; }
    let s=0; const step=Math.max(1,Math.ceil(value/40));
    const iv=setInterval(()=>{ s=Math.min(s+step,value); setDisplayed(s); if(s>=value)clearInterval(iv); },16);
    return()=>clearInterval(iv);
  },[value]);
  return (
    <div className={`${bg} rounded-2xl p-5 text-white shadow-lg relative overflow-hidden group
      hover:-translate-y-1 hover:shadow-xl transition-all duration-300`}
      style={{animation:"fadeUp .4s ease both", animationDelay:`${delay}ms`}}>
      <div className="absolute -right-5 -top-5 w-20 h-20 rounded-full bg-white/10 group-hover:scale-110 transition-transform"/>
      <div className="absolute -right-2 -bottom-6 w-28 h-28 rounded-full bg-white/10"/>
      <div className="relative z-10 flex items-center justify-between">
        <div>
          <p className="text-3xl font-extrabold leading-none mb-1">{displayed}</p>
          <p className="text-xs font-bold uppercase tracking-widest opacity-85">{label}</p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-white/20 group-hover:bg-white/30 flex items-center justify-center text-2xl transition-all">
          {icon}
        </div>
      </div>
    </div>
  );
}

/* ─── DISTRIBUTION BAR ───────────────────────────────────────── */
function DistBar({ value, max, color }) {
  const width = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden min-w-[60px]">
        <div className={`h-2 rounded-full transition-all duration-700 ${color}`}
          style={{width:`${width}%`}}/>
      </div>
      <span className="text-xs text-slate-500 font-bold w-10 text-right">{width}%</span>
    </div>
  );
}

/* ─── BADGE NUMBER ───────────────────────────────────────────── */
function NumBadge({ value, color }) {
  return (
    <span className={`inline-flex items-center justify-center w-7 h-6 rounded-md text-xs font-extrabold text-white ${color}`}>
      {value}
    </span>
  );
}

/* ─── SKELETON ROW ───────────────────────────────────────────── */
function SkeletonRow() {
  return (
    <tr>
      {[...Array(9)].map((_,i)=>(
        <td key={i} className="px-4 py-3.5">
          <div className="h-4 rounded-lg bg-slate-200 animate-pulse" style={{width:`${35+Math.random()*45}%`}}/>
        </td>
      ))}
    </tr>
  );
}

const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 font-medium focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none transition-all hover:border-slate-300 appearance-none";

/* ─── MAIN PAGE ──────────────────────────────────────────────── */
export default function GeographicDistribution() {
  const navigate = useNavigate();

  /* filter state */
  const [startDate,    setStartDate]    = useState(DEFAULT_START);
  const [endDate,      setEndDate]      = useState(DEFAULT_END);
  const [viewType,     setViewType]     = useState("Departing Cities");
  const [leadType,     setLeadType]     = useState("All Types");
  const [leadStage,    setLeadStage]    = useState("All Stages");
  const [filtersOpen,  setFiltersOpen]  = useState(true);
  const [search,       setSearch]       = useState("");
  const [showEntries,  setShowEntries]  = useState("25");
  const [page,         setPage]         = useState(1);

  const [geographicStatsOpen, setGeographicStatsOpen] = useState(false);

  const [applied,      setApplied]      = useState({ startDate:DEFAULT_START, endDate:DEFAULT_END, viewType:"Departing Cities", leadType:"All Types", leadStage:"All Stages" });

  /* data state */
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast,   setToast]   = useState(null);

  const showToast = useCallback((msg, type="success")=>setToast({msg,type}),[]);

  useEffect(()=>{
    let alive = true;
    setLoading(true);
    geographicDistributionService.getData({
      startDate: applied.startDate,
      endDate:   applied.endDate,
      viewType:  applied.viewType,
      leadType:  applied.leadType,
      leadStage: applied.leadStage,
      perPage:   1000,
      page:      1,
    })
      // The array was guarded (`|| []`) but the fields inside it were not, so a lead saved with a
      // blank country put a null straight into state and into every consumer. Normalised once
      // here so nothing downstream has to keep re-guarding the same two fields.
      .then((res)=>{
        if (!alive) return;
        setData((res.data?.rows || []).map(r => ({
          ...r,
          city:    r.city    ?? "",
          country: r.country ?? "",
        })));
      })
      .catch(()=>{ if(alive){ setData([]); showToast("Failed to load geographic data.", "error"); } })
      .finally(()=>{ if(alive) setLoading(false); });
    return ()=>{ alive = false; };
  },[applied, showToast]);

  /* apply / reset */
  const handleApply = () => {
    setApplied({ startDate, endDate, viewType, leadType, leadStage });
    setPage(1);
    showToast("Filters applied.");
  };
  const handleReset = () => {
    setStartDate(DEFAULT_START); setEndDate(DEFAULT_END);
    setViewType("Departing Cities"); setLeadType("All Types"); setLeadStage("All Stages");
    setApplied({ startDate:DEFAULT_START, endDate:DEFAULT_END, viewType:"Departing Cities", leadType:"All Types", leadStage:"All Stages" });
    setSearch(""); setPage(1);
    showToast("Filters reset.");
  };

  /* export csv — server-side, honours the applied filters + search */
  const handleExportCSV = async () => {
    try {
      const res = await geographicDistributionService.exportCsv({
        startDate: applied.startDate,
        endDate:   applied.endDate,
        viewType:  applied.viewType,
        leadType:  applied.leadType,
        leadStage: applied.leadStage,
        search,
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a   = document.createElement("a");
      a.href    = url;
      a.download = `geographic-report-${applied.startDate}-to-${applied.endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast("CSV exported successfully.");
    } catch {
      showToast("Export failed. Try again.", "error");
    }
  };

  /* filtered + searched */
  // Was `r.city.toLowerCase() || r.country.toLowerCase()` with no guard. A row with a null
  // country only blew up ONCE SOMETHING WAS TYPED: with an empty box the left side matches
  // (every string contains "") and `||` short-circuits, so the country was never touched. Type
  // anything, the left side goes false, the right side runs, and null.toLowerCase() throws —
  // inside a useMemo, during render, so the whole reports route hit the error boundary.
  // `|| ""` and not `?.`: r.city?.toLowerCase() yields undefined, and undefined.includes() throws
  // exactly the same way.
  const filtered = useMemo(()=>{
    const q = search.trim().toLowerCase();
    if (!q) return data;                       // nothing typed — skip the pass entirely
    return data.filter(r=>
      (r.city    || "").toLowerCase().includes(q) ||
      (r.country || "").toLowerCase().includes(q)
    );
  },[data,search]);

  /* totals row */
  const totals = useMemo(()=>({
    total:     filtered.reduce((s,r)=>s+r.total,0),
    hot:       filtered.reduce((s,r)=>s+r.hot,0),
    warm:      filtered.reduce((s,r)=>s+r.warm,0),
    cold:      filtered.reduce((s,r)=>s+r.cold,0),
    fresh:     filtered.reduce((s,r)=>s+r.fresh,0),
    converted: filtered.reduce((s,r)=>s+r.converted,0),
  }),[filtered]);

  /* pagination */
  const pp         = Number(showEntries);
  const totalPages = Math.max(1,Math.ceil(filtered.length/pp));
  const pageData   = filtered.slice((page-1)*pp, page*pp);
  const maxTotal   = Math.max(...filtered.map(r=>r.total),1);

  /* summary stat card values */
  const summary = {
    total:     totals.total,
    hot:       totals.hot,
    warm:      totals.warm,
    cold:      totals.cold,
    fresh:     totals.fresh,
    converted: totals.converted,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100"
      style={{fontFamily:"'Plus Jakarta Sans', system-ui, sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes slideIn { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .fade-up { animation: fadeUp .4s ease both; }
        select { -webkit-appearance:none; appearance:none; }
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#f1f5f9;border-radius:99px}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:99px}
      `}</style>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}

      {/* ── PAGE HEADER ── */}
      <div className="bg-white/70 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white shadow-lg shadow-green-200 flex-shrink-0">
                <FaMapMarkedAlt className="w-5 h-5"/>
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Lead Geographic Distribution</h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  Analyze leads by cities and destinations
                  <span className="hidden sm:inline ml-3 text-slate-300">|</span>
                  <span className="hidden sm:inline ml-3 text-xs">
                    <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={()=>navigate("/")}>Home</span>
                    <span className="mx-1 text-slate-300">/</span>
                    <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={()=>navigate("/ReportsDashboard")}>Reports</span>
                    <span className="mx-1 text-slate-300">/</span>
                    <span className="text-blue-600 font-bold">Geographic Distribution</span>
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

        {/* ── FILTERS & SETTINGS PANEL ── */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden fade-up">
          {/* Collapsible header */}
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
              {/* Row: Start Date | End Date | View Type | Lead Type | Lead Stage | Apply */}
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
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">View Type</label>
                  <div className="relative">
                    <select value={viewType} onChange={e=>setViewType(e.target.value)} className={inputCls+" pr-8 cursor-pointer"}>
                      {VIEW_TYPES.map(o=><option key={o}>{o}</option>)}
                    </select>
                    <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none"/>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">Lead Type</label>
                  <div className="relative">
                    <select value={leadType} onChange={e=>setLeadType(e.target.value)} className={inputCls+" pr-8 cursor-pointer"}>
                      {LEAD_TYPES.map(o=><option key={o}>{o}</option>)}
                    </select>
                    <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none"/>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">Lead Stage</label>
                  <div className="relative">
                    <select value={leadStage} onChange={e=>setLeadStage(e.target.value)} className={inputCls+" pr-8 cursor-pointer"}>
                      {LEAD_STAGES.map(o=><option key={o}>{o}</option>)}
                    </select>
                    <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none"/>
                  </div>
                </div>
                {/* Apply button — same column */}
                <button onClick={handleApply}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700
                    text-white text-sm font-bold shadow-md shadow-blue-200 transition-all h-[42px]">
                  <FiSearch className="w-3.5 h-3.5"/> Apply
                </button>
              </div>

              {/* Reset + Export CSV */}
              <div className="flex flex-wrap gap-3">
                <button onClick={handleReset}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-slate-200 hover:border-slate-300
                    bg-white hover:bg-slate-50 text-slate-600 text-sm font-bold transition-all">
                  <FiRefreshCw className="w-3.5 h-3.5"/> Reset
                </button>
                <button onClick={handleExportCSV}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700
                    text-white text-sm font-bold shadow-md shadow-emerald-200 transition-all">
                  <FiDownload className="w-3.5 h-3.5"/> Export CSV
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── STAT CARDS (6 cards matching screenshot colors) ── */}
        {/* <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { icon:<FaUsers className="text-2xl"/>,         label:"Total Leads", value:summary.total,     bg:"bg-gradient-to-br from-cyan-500 to-cyan-600",     delay:0   },
            { icon:<FaFire  className="text-2xl"/>,         label:"Hot Leads",   value:summary.hot,       bg:"bg-gradient-to-br from-red-500 to-red-600",       delay:50  },
            { icon:<FaThermometerHalf className="text-2xl"/>,label:"Warm Leads", value:summary.warm,      bg:"bg-gradient-to-br from-amber-500 to-amber-600",   delay:100 },
            { icon:<FaSnowflake className="text-2xl"/>,     label:"Cold Leads",  value:summary.cold,      bg:"bg-gradient-to-br from-slate-500 to-slate-600",   delay:150 },
            { icon:<span className="text-2xl">🌿</span>,    label:"Fresh Leads", value:summary.fresh,     bg:"bg-gradient-to-br from-blue-500 to-blue-600",     delay:200 },
            { icon:<FaCheckCircle className="text-2xl"/>,   label:"Converted",   value:summary.converted, bg:"bg-gradient-to-br from-green-500 to-emerald-600", delay:250 },
          ].map(s=><StatCard key={s.label} {...s}/>)}
        </div> */}

        {/* ── COLLAPSIBLE GEOGRAPHIC LEAD ANALYTICS ── */}
<div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden fade-up">

  {/* Toggle header */}
  <button
    type="button"
    onClick={() =>
      setGeographicStatsOpen((previous) => !previous)
    }
    aria-expanded={geographicStatsOpen}
    className="w-full px-4 sm:px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
  >
    <div className="flex items-center gap-3 flex-wrap min-w-0">
      <div className="flex items-center gap-2">
        <FaMapMarkedAlt className="w-4 h-4 text-emerald-600" />

        <span className="text-sm font-extrabold text-slate-700">
          Geographic Lead Analytics
        </span>
      </div>

      {/* Compact values displayed while cards are closed */}
      {!geographicStatsOpen && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-full bg-cyan-100 text-cyan-700 text-[11px] font-bold">
            {summary.total} Total
          </span>

          <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-[11px] font-bold">
            {summary.hot} Hot
          </span>

          <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold">
            {summary.warm} Warm
          </span>

          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold">
            {summary.cold} Cold
          </span>

          <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold">
            {summary.fresh} Fresh
          </span>

          <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-[11px] font-bold">
            {summary.converted} Converted
          </span>
        </div>
      )}
    </div>

    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
      {geographicStatsOpen ? (
        <FiChevronUp className="w-4 h-4" />
      ) : (
        <FiChevronDown className="w-4 h-4" />
      )}
    </div>
  </button>

  {/* Expandable cards */}
  <div
    className={`grid transition-all duration-300 ease-in-out ${
      geographicStatsOpen
        ? "grid-rows-[1fr] opacity-100"
        : "grid-rows-[0fr] opacity-0"
    }`}
  >
    <div className="min-h-0 overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 p-4 pt-1">
        {[
          {
            icon: <FaUsers className="text-2xl" />,
            label: "Total Leads",
            value: summary.total,
            bg: "bg-gradient-to-br from-cyan-500 to-cyan-600",
            delay: 0,
          },
          {
            icon: <FaFire className="text-2xl" />,
            label: "Hot Leads",
            value: summary.hot,
            bg: "bg-gradient-to-br from-red-500 to-red-600",
            delay: 50,
          },
          {
            icon: <FaThermometerHalf className="text-2xl" />,
            label: "Warm Leads",
            value: summary.warm,
            bg: "bg-gradient-to-br from-amber-500 to-amber-600",
            delay: 100,
          },
          {
            icon: <FaSnowflake className="text-2xl" />,
            label: "Cold Leads",
            value: summary.cold,
            bg: "bg-gradient-to-br from-slate-500 to-slate-600",
            delay: 150,
          },
          {
            icon: <span className="text-2xl">🌿</span>,
            label: "Fresh Leads",
            value: summary.fresh,
            bg: "bg-gradient-to-br from-blue-500 to-blue-600",
            delay: 200,
          },
          {
            icon: <FaCheckCircle className="text-2xl" />,
            label: "Converted",
            value: summary.converted,
            bg: "bg-gradient-to-br from-green-500 to-emerald-600",
            delay: 250,
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

        {/* ── DISTRIBUTION TABLE CARD ── */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden fade-up">

          {/* Card header */}
          <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <MdOutlineLeaderboard className="w-4 h-4 text-blue-500"/>
              <h2 className="text-base font-extrabold text-slate-700">
                Lead Distribution by {applied.viewType}
              </h2>
              <span className="text-xs font-extrabold bg-teal-500 text-white px-2.5 py-1 rounded-full">
                {filtered.length} locations
              </span>
            </div>
          </div>

          {/* Show entries + Search */}
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Show</span>
                <div className="relative">
                  <select value={showEntries} onChange={e=>{setShowEntries(e.target.value);setPage(1);}}
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
                  <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}
                    placeholder="City or country…"
                    className="pl-7 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 placeholder-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none transition-all w-48"/>
                </div>
              </div>
            </div>
          </div>

          {/* ── DESKTOP TABLE ── */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead className="bg-slate-50/80 border-b border-slate-100">
                <tr>
                  {[
                    "Departing City","Country","Total Leads","Hot","Warm","Cold","Fresh","Converted","Conversion Rate","Distribution"
                  ].map(h=>(
                    <th key={h} className="px-4 py-3.5 text-left text-xs font-extrabold text-slate-600 uppercase tracking-wider whitespace-nowrap">
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
                      <td colSpan={10} className="text-center py-16">
                        <div className="text-5xl mb-3">🗺️</div>
                        <p className="text-base font-extrabold text-slate-600 mb-1">No Data Found</p>
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
                      {pageData.map((row,idx)=>(
                        <tr key={row.id}
                          className="group hover:bg-blue-50/40 hover:shadow-[inset_3px_0_0_#2563eb] transition-all duration-150"
                          style={{animation:"fadeUp .35s ease both",animationDelay:`${idx*30}ms`}}>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <FiMapPin className="w-3.5 h-3.5 text-green-500 flex-shrink-0"/>
                              <span className="text-sm font-semibold text-slate-800">{row.city}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-sm text-slate-600 font-medium">{row.country}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <NumBadge value={row.total}     color="bg-cyan-500"/>
                          </td>
                          <td className="px-4 py-3.5">
                            <NumBadge value={row.hot}       color="bg-red-500"/>
                          </td>
                          <td className="px-4 py-3.5">
                            <NumBadge value={row.warm}      color="bg-amber-500"/>
                          </td>
                          <td className="px-4 py-3.5">
                            <NumBadge value={row.cold}      color="bg-slate-500"/>
                          </td>
                          <td className="px-4 py-3.5">
                            <NumBadge value={row.fresh}     color="bg-blue-500"/>
                          </td>
                          <td className="px-4 py-3.5">
                            <NumBadge value={row.converted} color="bg-green-500"/>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-sm font-bold text-slate-700">
                              {convRate(row.converted,row.total)}%
                            </span>
                          </td>
                          <td className="px-4 py-3.5 min-w-[140px]">
                            <DistBar value={row.total} max={maxTotal} color="bg-blue-500"/>
                            <p className="text-[11px] text-slate-400 mt-1">{pct(row.total,totals.total)}%</p>
                          </td>
                        </tr>
                      ))}

                      {/* TOTALS ROW */}
                      <tr className="bg-slate-50 border-t-2 border-slate-200">
                        <td className="px-4 py-3.5">
                          <span className="text-sm font-extrabold text-slate-800">TOTALS</span>
                        </td>
                        <td className="px-4 py-3.5"/>
                        <td className="px-4 py-3.5"><NumBadge value={totals.total}     color="bg-cyan-500"/></td>
                        <td className="px-4 py-3.5"><NumBadge value={totals.hot}       color="bg-red-500"/></td>
                        <td className="px-4 py-3.5"><NumBadge value={totals.warm}      color="bg-amber-500"/></td>
                        <td className="px-4 py-3.5"><NumBadge value={totals.cold}      color="bg-slate-500"/></td>
                        <td className="px-4 py-3.5"><NumBadge value={totals.fresh}     color="bg-blue-500"/></td>
                        <td className="px-4 py-3.5"><NumBadge value={totals.converted} color="bg-green-500"/></td>
                        <td className="px-4 py-3.5">
                          <span className="text-sm font-extrabold text-slate-800">
                            {convRate(totals.converted,totals.total)}%
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-sm font-extrabold text-slate-800">100%</span>
                        </td>
                      </tr>
                    </>
                  )}
              </tbody>
            </table>
          </div>

          {/* ── MOBILE CARDS ── */}
          <div className="lg:hidden p-4 space-y-3">
            {loading
              ? [...Array(4)].map((_,i)=>(
                  <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2 animate-pulse">
                    {[...Array(3)].map((_,j)=><div key={j} className="h-4 bg-slate-200 rounded-lg" style={{width:`${40+Math.random()*50}%`}}/>)}
                  </div>
                ))
              : pageData.length===0
              ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-3">🗺️</div>
                  <p className="font-extrabold text-slate-600 mb-2">No Data Found</p>
                  <button onClick={handleReset} className="px-4 py-2 rounded-xl bg-blue-50 text-blue-600 font-bold text-sm">Reset Filters</button>
                </div>
              )
              : pageData.map((row,idx)=>(
                <div key={row.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3 fade-up"
                  style={{animationDelay:`${idx*40}ms`}}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FiMapPin className="w-4 h-4 text-green-500"/>
                      <div>
                        <p className="text-sm font-extrabold text-slate-800">{row.city}</p>
                        <p className="text-xs text-slate-400">{row.country}</p>
                      </div>
                    </div>
                    <NumBadge value={row.total} color="bg-cyan-500"/>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {label:"Hot",       value:row.hot,       color:"bg-red-500"   },
                      {label:"Warm",      value:row.warm,      color:"bg-amber-500" },
                      {label:"Cold",      value:row.cold,      color:"bg-slate-500" },
                      {label:"Fresh",     value:row.fresh,     color:"bg-blue-500"  },
                      {label:"Converted", value:row.converted, color:"bg-green-500" },
                      {label:"Conv. Rate",value:`${convRate(row.converted,row.total)}%`, isText:true},
                    ].map(({label,value,color,isText})=>(
                      <div key={label} className="bg-slate-50 rounded-xl px-3 py-2 text-center">
                        <p className="text-[11px] text-slate-400 font-medium mb-1">{label}</p>
                        {isText
                          ? <p className="text-sm font-extrabold text-slate-700">{value}</p>
                          : <NumBadge value={value} color={color}/>}
                      </div>
                    ))}
                  </div>
                  <div>
                    <DistBar value={row.total} max={maxTotal} color="bg-blue-500"/>
                    <p className="text-[11px] text-slate-400 mt-1">{pct(row.total,totals.total)}% of total</p>
                  </div>
                </div>
              ))}
          </div>

          {/* ── PAGINATION + ENTRIES INFO ── */}
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