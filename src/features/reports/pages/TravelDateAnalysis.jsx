import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft as FiChevronLeft, ChevronRight as FiChevronRight, Filter as FiFilter, RefreshCw as FiRefreshCw, Download as FiDownload, ArrowLeft as FiArrowLeft, ChevronDown as FiChevronDown, ChevronUp as FiChevronUp, Search as FiSearch, Calendar as FiCalendar, Users as FiUsers, IndianRupee as FaRupeeSign, Calendar as FaCalendarAlt, CalendarCheck as FaCalendarCheck, ChartLine as FaChartLine, Clock as FaClock, ChartColumn as MdOutlineBarChart, Calendar as MdOutlineCalendarMonth } from "lucide-react";


import travelDateAnalysisService from "../api/travelDateAnalysisService";
import { todayISO, daysFromNowISO } from "../dateDefaults";

// Travel-date report looks forward: today → +6 months (kept relative so it never goes stale).
const TRAVEL_START = todayISO();
const TRAVEL_END   = daysFromNowISO(180);

const ANALYSIS_TYPES = ["Monthly","Weekly","Daily","Quarterly"];
const BOOKING_TYPES  = ["All Types","Domestic","International"];
const STATUS_OPTS    = ["All Statuses","Confirmed","Pending","Cancelled","Completed"];
const SHOW_ENTRIES   = ["10","25","50","100"];

const fmt = (n) =>
  n >= 100000
    ? `₹${(n/100000).toFixed(1)}L`
    : `₹${Number(n).toLocaleString("en-IN")}`;
const fmtFull = (n) =>
  `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits:2 })}`;

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

/* ─── HERO STAT CARD ─────────────────────────────────────────── */
function HeroCard({ value, label, bg, icon, isRevenue, isFloat, delay=0 }) {
  const [disp, setDisp] = useState(isRevenue ? "₹0.0L" : isFloat ? "0.0" : 0);
  useEffect(()=>{
    if (isRevenue) { setDisp(fmt(value)); return; }
    if (isFloat)   { setDisp(Number(value).toFixed(1)); return; }
    let s=0; const step=Math.max(1,Math.ceil(value/40));
    const iv=setInterval(()=>{ s=Math.min(s+step,value); setDisp(s); if(s>=value)clearInterval(iv); },16);
    return()=>clearInterval(iv);
  },[value, isRevenue, isFloat]);
  return (
    <div className={`${bg} rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group
      hover:-translate-y-1 hover:shadow-xl transition-all duration-300`}
      style={{animation:"fadeUp .4s ease both", animationDelay:`${delay}ms`}}>
      <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 group-hover:scale-110 transition-transform"/>
      <div className="absolute -right-4 -bottom-10 w-40 h-40 rounded-full bg-white/10"/>
      <div className="relative z-10">
        <p className="text-4xl font-extrabold leading-none mb-1 tracking-tight">{disp}</p>
        <p className="text-xs font-extrabold uppercase tracking-widest opacity-90">{label}</p>
      </div>
      <div className="absolute right-5 bottom-5 text-white/20 text-6xl">{icon}</div>
    </div>
  );
}

/* ─── TREND CHART (SVG bar chart simulation) ─────────────────── */
function TrendChart({ data, loading }) {
  if (loading) return <div className="h-64 bg-slate-100 rounded-xl animate-pulse"/>;
  if (!data || data.length === 0) return (
    <div className="h-64 flex flex-col items-center justify-center text-slate-400">
      <FaCalendarAlt className="text-4xl mb-2 opacity-30"/>
      <p className="text-sm font-bold">No Travel Data Found</p>
      <p className="text-xs">No bookings found for the selected travel date range.</p>
    </div>
  );

  const maxBookings = Math.max(...data.map(d=>d.bookings), 1);
  const maxRevenue  = Math.max(...data.map(d=>d.revenue),  1);

  return (
    <div className="w-full overflow-x-auto">
      {/* Legend */}
      <div className="flex items-center gap-6 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-3 rounded-sm bg-teal-400"/>
          <span className="text-xs text-slate-500 font-medium">Total Bookings</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-3 rounded-sm bg-rose-400"/>
          <span className="text-xs text-slate-500 font-medium">Revenue (₹)</span>
        </div>
      </div>
      {/* Chart */}
      <div className="relative">
        {/* Y-axis label left */}
        <div className="absolute left-0 top-0 bottom-6 w-8 flex flex-col justify-between items-end pr-1">
          {[1,.8,.6,.4,.2,0].map(v=>(
            <span key={v} className="text-[10px] text-slate-400">{(v*maxBookings).toFixed(0)}</span>
          ))}
        </div>
        {/* Bars */}
        <div className="ml-9 mr-9 overflow-x-auto">
          <div className="flex items-end gap-2 h-56 min-w-max pb-6 border-b border-slate-200 relative">
            {/* Gridlines */}
            {[0,.2,.4,.6,.8,1].map(v=>(
              <div key={v} className="absolute left-0 right-0 border-t border-slate-100"
                style={{bottom:`${v*100}%`, top:"auto"}}/>
            ))}
            {data.map((d,i)=>(
              <div key={i} className="flex flex-col items-center gap-1 group relative" style={{minWidth:"52px"}}>
                <div className="flex items-end gap-1 h-48">
                  {/* Bookings bar */}
                  <div className="w-5 rounded-t-md bg-teal-400 hover:bg-teal-500 transition-all relative"
                    style={{height:`${(d.bookings/maxBookings)*100}%`, minHeight:"2px"}}>
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-teal-600 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {d.bookings}
                    </span>
                  </div>
                  {/* Revenue bar */}
                  <div className="w-5 rounded-t-md bg-rose-400 hover:bg-rose-500 transition-all relative"
                    style={{height:`${(d.revenue/maxRevenue)*100}%`, minHeight:"2px"}}>
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {fmt(d.revenue)}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 font-medium text-center absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  {d.month.split(" ")[0]}
                </span>
              </div>
            ))}
          </div>
        </div>
        {/* X-axis label */}
        <p className="text-center text-xs text-slate-400 mt-8 font-medium">Month</p>
        {/* Y-axis label right (Revenue) */}
        <div className="absolute right-0 top-0 bottom-6 w-8 flex flex-col justify-between items-start pl-1">
          {[1,.8,.6,.4,.2,0].map(v=>(
            <span key={v} className="text-[10px] text-slate-400">{(v*maxRevenue/1000).toFixed(0)}k</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── SKELETON ROW ───────────────────────────────────────────── */
function SkeletonRow() {
  return (
    <tr>
      {[...Array(6)].map((_,i)=>(
        <td key={i} className="px-4 py-4">
          <div className="h-4 rounded-lg bg-slate-200 animate-pulse" style={{width:`${35+Math.random()*50}%`}}/>
        </td>
      ))}
    </tr>
  );
}

const selectCls = "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 font-medium focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none appearance-none cursor-pointer transition-all hover:border-slate-300";
const inputCls  = "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 font-medium focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none transition-all hover:border-slate-300";

/* ─── MAIN PAGE ──────────────────────────────────────────────── */
export default function TravelDateAnalysis() {
  const navigate = useNavigate();

  /* filter state */
  const [startDate,    setStartDate]    = useState(TRAVEL_START);
  const [endDate,      setEndDate]      = useState(TRAVEL_END);
  const [analysisType, setAnalysisType] = useState("Monthly");
  const [bookingType,  setBookingType]  = useState("All Types");
  const [status,       setStatus]       = useState("All Statuses");
  const [filtersOpen,  setFiltersOpen]  = useState(true);
  const [showEntries,  setShowEntries]  = useState("25");
  const [page,         setPage]         = useState(1);

  const [travelStatsOpen, setTravelStatsOpen] = useState(false);

  const [applied,      setApplied]      = useState({
    startDate:TRAVEL_START, endDate:TRAVEL_END,
    analysisType:"Monthly", bookingType:"All Types", status:"All Statuses",
  });

  /* data state */
  const [monthly,  setMonthly]  = useState([]);
  const [peak,     setPeak]     = useState([]);
  const [duration, setDuration] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [toast,    setToast]    = useState(null);

  const showToast = useCallback((msg,type="success")=>setToast({msg,type}),[]);

  useEffect(()=>{
    let alive = true;
    setLoading(true);
    Promise.all([
      travelDateAnalysisService.getTrends(applied),
      travelDateAnalysisService.getPeakDates(applied),
      travelDateAnalysisService.getDuration(applied),
    ])
      .then(([trendsRes, peakRes, durationRes])=>{
        if(!alive) return;
        setMonthly(trendsRes.data || []);
        setPeak(peakRes.data || []);
        setDuration(durationRes.data || []);
      })
      .catch(()=>{
        if(!alive) return;
        setMonthly([]); setPeak([]); setDuration([]);
        showToast("Failed to load travel-date data.", "error");
      })
      .finally(()=>{ if(alive) setLoading(false); });
    return ()=>{ alive = false; };
  },[applied, showToast]);

  /* apply / reset */
  const handleApply = () => {
    setApplied({ startDate, endDate, analysisType, bookingType, status });
    setPage(1); showToast("Filters applied.");
  };
  const handleReset = () => {
    setStartDate(TRAVEL_START); setEndDate(TRAVEL_END);
    setAnalysisType("Monthly"); setBookingType("All Types"); setStatus("All Statuses");
    setApplied({ startDate:TRAVEL_START, endDate:TRAVEL_END, analysisType:"Monthly", bookingType:"All Types", status:"All Statuses" });
    setPage(1); showToast("Filters reset.");
  };

  /* export CSV — server-side, honours the applied filters */
  const handleExportCSV = async () => {
    try {
      const res = await travelDateAnalysisService.exportCsv(applied);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a   = document.createElement("a");
      a.href    = url;
      a.download = `travel-date-analysis-${applied.startDate}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast("CSV exported successfully.");
    } catch {
      showToast("Export failed. Try again.", "error");
    }
  };

  /* summary */
  const summary = useMemo(()=>({
    totalBookings:  monthly.reduce((s,m)=>s+m.bookings,0),
    totalTravelers: monthly.reduce((s,m)=>s+m.travelers,0),
    avgPerPeriod:   monthly.length>0
      ? (monthly.reduce((s,m)=>s+m.bookings,0) / monthly.length)
      : 0,
    totalRevenue:   monthly.reduce((s,m)=>s+m.revenue,0),
  }),[monthly]);

  /* pagination for monthly table */
  const pp         = Number(showEntries);
  const totalPages = Math.max(1,Math.ceil(monthly.length/pp));
  const pageData   = monthly.slice((page-1)*pp, page*pp);

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
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white shadow-lg shadow-teal-200 flex-shrink-0">
                <FaCalendarAlt className="w-5 h-5"/>
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Travel Date Analysis</h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  Analyze booking trends by travel dates
                  <span className="hidden sm:inline ml-3 text-slate-300">|</span>
                  <span className="hidden sm:inline ml-3 text-xs">
                    <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={()=>navigate("/")}>Home</span>
                    <span className="mx-1 text-slate-300">/</span>
                    <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={()=>navigate("/ReportsDashboard")}>Reports</span>
                    <span className="mx-1 text-slate-300">/</span>
                    <span className="text-blue-600 font-bold">Travel Date Analysis</span>
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
              {/* Row: Travel Start Date | Travel End Date | Analysis Type | Booking Type | Status | Apply */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">Travel Start Date</label>
                  <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className={inputCls}/>
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">Travel End Date</label>
                  <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className={inputCls}/>
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">Analysis Type</label>
                  <div className="relative">
                    <select value={analysisType} onChange={e=>setAnalysisType(e.target.value)} className={selectCls+" pr-8"}>
                      {ANALYSIS_TYPES.map(o=><option key={o}>{o}</option>)}
                    </select>
                    <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none"/>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">Booking Type</label>
                  <div className="relative">
                    <select value={bookingType} onChange={e=>setBookingType(e.target.value)} className={selectCls+" pr-8"}>
                      {BOOKING_TYPES.map(o=><option key={o}>{o}</option>)}
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

        {/* ── 4 HERO STAT CARDS ── */}
        {/* <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <HeroCard value={summary.totalBookings}  label="Total Bookings"     bg="bg-gradient-to-br from-teal-500 to-cyan-600"     icon={<FaCalendarCheck/>}  delay={0}  />
          <HeroCard value={summary.totalTravelers} label="Total Travelers"    bg="bg-gradient-to-br from-green-500 to-emerald-600"  icon={<FiUsers/>}          delay={60} />
          <HeroCard value={summary.avgPerPeriod}   label="Avg Bookings/Period" bg="bg-gradient-to-br from-amber-500 to-orange-500"  icon={<MdOutlineBarChart/>} isFloat delay={120}/>
          <HeroCard value={summary.totalRevenue}   label="Total Revenue"      bg="bg-gradient-to-br from-red-500 to-rose-600"       icon={<FaRupeeSign/>}      isRevenue delay={180}/>
        </div> */}

        {/* ── COLLAPSIBLE TRAVEL DATE ANALYTICS ── */}
<div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden fade-up">

  {/* Toggle header */}
  <button
    type="button"
    onClick={() =>
      setTravelStatsOpen((previous) => !previous)
    }
    aria-expanded={travelStatsOpen}
    className="w-full px-4 sm:px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
  >
    <div className="flex items-center gap-3 flex-wrap min-w-0">
      <div className="flex items-center gap-2">
        <FaCalendarAlt className="w-4 h-4 text-teal-600" />

        <span className="text-sm font-extrabold text-slate-700">
          Travel Date Analytics
        </span>
      </div>

      {/* Compact values shown while cards are closed */}
      {!travelStatsOpen && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-full bg-teal-100 text-teal-700 text-[11px] font-bold">
            {summary.totalBookings} Bookings
          </span>

          <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-[11px] font-bold">
            {summary.totalTravelers} Travelers
          </span>

          <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold">
            Avg {Number(summary.avgPerPeriod).toFixed(1)} / Period
          </span>

          <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 text-[11px] font-bold">
            Revenue {fmt(summary.totalRevenue)}
          </span>
        </div>
      )}
    </div>

    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
      {travelStatsOpen ? (
        <FiChevronUp className="w-4 h-4" />
      ) : (
        <FiChevronDown className="w-4 h-4" />
      )}
    </div>
  </button>

  {/* Expandable cards */}
  <div
    className={`grid transition-all duration-300 ease-in-out ${
      travelStatsOpen
        ? "grid-rows-[1fr] opacity-100"
        : "grid-rows-[0fr] opacity-0"
    }`}
  >
    <div className="min-h-0 overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 pt-1">

        <HeroCard
          value={summary.totalBookings}
          label="Total Bookings"
          bg="bg-gradient-to-br from-teal-500 to-cyan-600"
          icon={<FaCalendarCheck />}
          delay={0}
        />

        <HeroCard
          value={summary.totalTravelers}
          label="Total Travelers"
          bg="bg-gradient-to-br from-green-500 to-emerald-600"
          icon={<FiUsers />}
          delay={60}
        />

        <HeroCard
          value={summary.avgPerPeriod}
          label="Avg Bookings/Period"
          bg="bg-gradient-to-br from-amber-500 to-orange-500"
          icon={<MdOutlineBarChart />}
          isFloat
          delay={120}
        />

        <HeroCard
          value={summary.totalRevenue}
          label="Total Revenue"
          bg="bg-gradient-to-br from-red-500 to-rose-600"
          icon={<FaRupeeSign />}
          isRevenue
          delay={180}
        />

      </div>
    </div>
  </div>
</div>

        {/* ── TREND CHART + PEAK DATES ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
          {/* Travel Date Trends */}
          <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm p-5 fade-up">
            <h3 className="text-sm font-extrabold text-slate-700 mb-4 flex items-center gap-2">
              <FaChartLine className="w-4 h-4 text-teal-500"/>
              Travel Date Trends
            </h3>
            <TrendChart data={loading ? null : monthly} loading={loading}/>
          </div>

          {/* Peak Travel Dates */}
          <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm p-5 fade-up">
            <h3 className="text-sm font-extrabold text-slate-700 mb-4 flex items-center gap-2">
              <FaCalendarCheck className="w-4 h-4 text-rose-500"/>
              Peak Travel Dates
            </h3>
            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_,i)=><div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse"/>)}
              </div>
            ) : peak.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <FaCalendarAlt className="text-4xl mb-2 opacity-30"/>
                <p className="text-sm font-bold">No peak dates found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {peak.map((p,i)=>(
                  <div key={i} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-rose-50 border border-rose-100">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-rose-500 text-white flex items-center justify-center text-xs font-extrabold">
                        {p.bookings}
                      </div>
                      <span className="text-xs font-bold text-slate-700">{p.date}</span>
                    </div>
                    <span className="text-[10px] font-extrabold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full">
                      {p.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── MONTHLY ANALYSIS TABLE + TRIP DURATION ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">

          {/* Monthly Analysis Table */}
          <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden fade-up">
            {/* Card header */}
            <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <MdOutlineCalendarMonth className="w-4 h-4 text-teal-500"/>
                <h2 className="text-base font-extrabold text-slate-700">{applied.analysisType} Analysis</h2>
                {monthly.length > 0 && (
                  <span className="text-xs font-extrabold bg-teal-500 text-white px-2.5 py-1 rounded-full">
                    {monthly.length} periods
                  </span>
                )}
              </div>
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
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead className="bg-slate-50/80 border-b border-slate-100">
                  <tr>
                    {["Month / Period","Total Bookings","Total Travelers","Revenue","Avg Duration","% of Total"].map(h=>(
                      <th key={h} className="px-4 py-3.5 text-left text-xs font-extrabold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading
                    ? [...Array(4)].map((_,i)=><SkeletonRow key={i}/>)
                    : pageData.length === 0
                    ? (
                      <tr>
                        <td colSpan={6} className="text-center py-16">
                          <FaCalendarAlt className="text-5xl mx-auto mb-3 text-slate-300"/>
                          <p className="text-base font-extrabold text-slate-600 mb-1">No Travel Data Found</p>
                          <p className="text-sm text-slate-400">No bookings found for the selected travel date range.</p>
                        </td>
                      </tr>
                    )
                    : (()=>{
                      const totalRev = monthly.reduce((s,m)=>s+m.revenue,0);
                      return pageData.map((m,idx)=>(
                        <tr key={idx}
                          className="hover:bg-teal-50/30 hover:shadow-[inset_3px_0_0_#14b8a6] transition-all"
                          style={{animation:"fadeUp .35s ease both", animationDelay:`${idx*30}ms`}}>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
                                <FiCalendar className="w-3.5 h-3.5 text-teal-600"/>
                              </div>
                              <span className="text-sm font-bold text-slate-800">{m.month}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-sm font-extrabold text-teal-600">{m.bookings}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-sm font-bold text-slate-700">{m.travelers}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-sm font-bold text-green-600">{fmtFull(m.revenue)}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-sm font-medium text-slate-600">{m.avgDuration} days</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-teal-500 h-1.5 rounded-full"
                                  style={{width:`${Math.round((m.revenue/totalRev)*100)}%`}}/>
                              </div>
                              <span className="text-xs font-bold text-slate-500 w-8">
                                {Math.round((m.revenue/totalRev)*100)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ));
                    })()}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {monthly.length > 0 && (
              <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-xs text-slate-400 font-medium">
                  Showing <span className="font-bold text-slate-600">{(page-1)*pp+1}</span> to{" "}
                  <span className="font-bold text-slate-600">{Math.min(page*pp,monthly.length)}</span> of{" "}
                  <span className="font-bold text-slate-600">{monthly.length}</span> entries
                </p>
                <div className="flex items-center gap-1.5">
                  <button disabled={page===1} onClick={()=>setPage(p=>p-1)}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-500 hover:border-blue-300 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1">
                    <FiChevronLeft className="w-3 h-3"/> Prev
                  </button>
                  {Array.from({length:totalPages},(_,i)=>i+1).map(p=>(
                    <button key={p} onClick={()=>setPage(p)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold border transition-all
                        ${page===p?"bg-teal-600 border-teal-600 text-white shadow-sm":"bg-white border-slate-200 text-slate-600 hover:border-teal-300 hover:text-teal-600"}`}>
                      {p}
                    </button>
                  ))}
                  <button disabled={page===totalPages} onClick={()=>setPage(p=>p+1)}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-500 hover:border-blue-300 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1">
                    Next <FiChevronRight className="w-3 h-3"/>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Trip Duration Analysis */}
          <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm p-5 fade-up">
            <h3 className="text-sm font-extrabold text-slate-700 mb-4 flex items-center gap-2">
              <FaClock className="w-4 h-4 text-blue-500"/>
              Trip Duration Analysis
            </h3>
            {loading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_,i)=><div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse"/>)}
              </div>
            ) : duration.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <FaClock className="text-4xl mb-2 opacity-30"/>
                <p className="text-sm font-bold">No duration data available</p>
              </div>
            ) : (
              <div className="space-y-3">
                {duration.map((d,i)=>(
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">{d.range}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-teal-600">{d.count}</span>
                        <span className="text-[11px] text-slate-400 font-medium">{d.pct}%</span>
                      </div>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-2 bg-gradient-to-r from-teal-400 to-teal-500 rounded-full transition-all duration-700"
                        style={{width:`${d.pct}%`}}/>
                    </div>
                  </div>
                ))}
                {/* Summary */}
                <div className="pt-3 border-t border-slate-100 mt-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-teal-50 rounded-xl px-3 py-2 text-center">
                      <p className="text-xl font-extrabold text-teal-600">
                        {duration.reduce((s,d)=>s+d.count,0)}
                      </p>
                      <p className="text-[11px] text-slate-500">Total Trips</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl px-3 py-2 text-center">
                      <p className="text-xl font-extrabold text-blue-600">
                        {monthly.length > 0
                          ? (monthly.reduce((s,m)=>s+m.avgDuration,0)/monthly.length).toFixed(1)
                          : "0.0"} d
                      </p>
                      <p className="text-[11px] text-slate-500">Avg Duration</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}