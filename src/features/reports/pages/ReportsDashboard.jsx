import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChartColumn as FiBarChart2, Activity as FiActivity, Clock as FiClock, TrendingUp as FiTrendingUp, Calendar as FiCalendar, Globe as FiGlobe, Eye as FiEye, Download as FiDownload, RefreshCw as FiRefreshCw, ArrowRight as FiArrowRight, Users as FiUsers, FileText as FiFileText, MapPinned as FaMapMarkedAlt, IndianRupee as FaRupeeSign, Globe as FaGlobe, Clock as FaRegClock, ChevronDown as FiChevronDown,
ChevronUp as FiChevronUp } from "lucide-react";


import reportsDashboardService from "../api/reportsDashboardService";

/* ─── REPORT CARDS CONFIG ────────────────────────────────────── */
const REPORT_CARDS = [
  {
    id:       "activity",
    title:    "Activity Reports",
    desc:     "Track user activities and system events",
    icon:     <FiActivity className="w-7 h-7"/>,
    gradient: "from-blue-500 to-blue-600",
    btnColor: "bg-blue-600 hover:bg-blue-700 shadow-blue-200",
    btnIcon:  <FiEye className="w-3.5 h-3.5"/>,
    badge:    "System",
    badgeCls: "bg-blue-100 text-blue-700",
    path:     "/ActivityReports",
    delay:    0,
  },
  {
    id:       "geographic",
    title:    "Geographic Distribution",
    desc:     "Analyze leads by cities and destinations",
    icon:     <FaMapMarkedAlt className="w-7 h-7"/>,
    gradient: "from-green-500 to-emerald-600",
    btnColor: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200",
    btnIcon:  <FiEye className="w-3.5 h-3.5"/>,
    badge:    "Geo",
    badgeCls: "bg-emerald-100 text-emerald-700",
    path:     "/GeographicDistribution",
    delay:    60,
  },
  {
    id:       "followup",
    title:    "Follow-up Reports",
    desc:     "Track upcoming and overdue follow-ups",
    icon:     <FaRegClock className="w-7 h-7"/>,
    gradient: "from-amber-500 to-orange-500",
    btnColor: "bg-amber-500 hover:bg-amber-600 shadow-amber-200",
    btnIcon:  <FiClock className="w-3.5 h-3.5"/>,
    badge:    "CRM",
    badgeCls: "bg-amber-100 text-amber-700",
    path:     "/FollowupReports",
    delay:    120,
  },
  {
    id:       "revenue",
    title:    "Booking Revenue Analysis",
    desc:     "Comprehensive revenue and profit analysis",
    icon:     <FaRupeeSign className="w-7 h-7"/>,
    gradient: "from-green-600 to-teal-600",
    btnColor: "bg-green-600 hover:bg-green-700 shadow-green-200",
    btnIcon:  <FaRupeeSign className="w-3.5 h-3.5"/>,
    badge:    "Finance",
    badgeCls: "bg-green-100 text-green-700",
    path:     "/BookingRevenueAnalysis",
    delay:    180,
  },
  {
    id:       "traveldate",
    title:    "Travel Date Analysis",
    desc:     "Analyze booking trends by travel dates",
    icon:     <FiCalendar className="w-7 h-7"/>,
    gradient: "from-teal-500 to-cyan-600",
    btnColor: "bg-teal-600 hover:bg-teal-700 shadow-teal-200",
    btnIcon:  <FiBarChart2 className="w-3.5 h-3.5"/>,
    badge:    "Trends",
    badgeCls: "bg-teal-100 text-teal-700",
    path:     "/TravelDateAnalysis",
    delay:    240,
  },
  {
    id:       "international",
    title:    "International vs Domestic",
    desc:     "Compare international and domestic performance",
    icon:     <FaGlobe className="w-7 h-7"/>,
    gradient: "from-blue-600 to-indigo-600",
    btnColor: "bg-blue-600 hover:bg-blue-700 shadow-blue-200",
    btnIcon:  <FiGlobe className="w-3.5 h-3.5"/>,
    badge:    "Global",
    badgeCls: "bg-indigo-100 text-indigo-700",
    path:     "/InternationalDomestic",
    delay:    300,
  },
];

/* ─── STAT CARDS CONFIG ──────────────────────────────────────── */
const STAT_CARDS = [
  {
    icon:  <FiFileText className="w-5 h-5"/>,
    label: "Total Reports",
    value: 6,
    gradient: "from-blue-600 to-blue-700",
    delay: 0,
  },
  {
    icon:  <FiUsers className="w-5 h-5"/>,
    label: "Active Users",
    value: 5,
    gradient: "from-green-500 to-emerald-600",
    delay: 60,
  },
  {
    icon:  <FiTrendingUp className="w-5 h-5"/>,
    label: "This Month",
    value: 313,
    gradient: "from-amber-500 to-orange-500",
    delay: 120,
  },
  {
    icon:  <FaRupeeSign className="w-5 h-5"/>,
    label: "Revenue Tracked",
    value: "₹0",
    isString: true,
    gradient: "from-teal-500 to-teal-600",
    delay: 180,
  },
];

const DATE_FILTERS = [
  { id:"today",  label:"Today"     },
  { id:"week",   label:"This Week" },
  { id:"month",  label:"This Month"},
  { id:"quarter",label:"Quarter"   },
  { id:"year",   label:"This Year" },
  { id:"custom", label:"Custom"    },
];

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
function StatCard({ icon, label, value, gradient, isString, delay }) {
  const [displayed, setDisplayed] = useState(isString ? value : 0);
  useEffect(()=>{
    if(isString){ setDisplayed(value); return; }
    if(!value){ setDisplayed(0); return; }
    let s=0; const step=Math.max(1,Math.ceil(value/50));
    const iv=setInterval(()=>{ s=Math.min(s+step,value); setDisplayed(s); if(s>=value)clearInterval(iv); },16);
    return()=>clearInterval(iv);
  },[value,isString]);
  return (
    <div className={`bg-gradient-to-br ${gradient} rounded-2xl p-5 text-white shadow-lg relative overflow-hidden group
      hover:-translate-y-1 hover:shadow-xl transition-all duration-300`}
      style={{animation:"fadeUp .4s ease both", animationDelay:`${delay}ms`}}>
      <div className="absolute -right-5 -top-5 w-24 h-24 rounded-full bg-white/10 group-hover:scale-110 transition-transform duration-300"/>
      <div className="absolute -right-3 -bottom-8 w-32 h-32 rounded-full bg-white/10"/>
      <div className="relative z-10">
        <div className="w-10 h-10 rounded-xl bg-white/20 group-hover:bg-white/30 flex items-center justify-center mb-3 transition-all">
          {icon}
        </div>
        <p className="text-2xl sm:text-3xl font-extrabold leading-none mb-1">{displayed}</p>
        <p className="text-xs font-bold uppercase tracking-widest opacity-80">{label}</p>
      </div>
    </div>
  );
}

/* ─── REPORT CARD ────────────────────────────────────────────── */
function ReportCard({ card, onView }) {
  return (
    <div
      className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden
        hover:-translate-y-1 hover:shadow-lg transition-all duration-300 group cursor-pointer"
      style={{animation:"fadeUp .4s ease both", animationDelay:`${card.delay}ms`}}
      onClick={()=>onView(card)}>
      {/* Top color stripe */}
      <div className={`h-1.5 bg-gradient-to-r ${card.gradient}`}/>

      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Icon box */}
          <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${card.gradient} flex items-center justify-center
            text-white flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
            {card.icon}
          </div>

          {/* Title + desc + badge */}
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="text-sm font-extrabold text-slate-800 leading-snug group-hover:text-blue-600 transition-colors">
                {card.title}
              </h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${card.badgeCls}`}>
                {card.badge}
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">{card.desc}</p>
          </div>
        </div>

        {/* View Reports button */}
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={e=>{ e.stopPropagation(); onView(card); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-white text-xs font-bold
              transition-all shadow-md ${card.btnColor}`}>
            {card.btnIcon} View Reports
          </button>
          <FiArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 group-hover:translate-x-1 transition-all"/>
        </div>
      </div>
    </div>
  );
}

/* ─── MAIN PAGE ──────────────────────────────────────────────── */
export default function ReportsDashboard() {
  const navigate  = useNavigate();
  const [activeFilter, setActiveFilter] = useState("month");
  const [loading,      setLoading]      = useState(true);
  const [toast,        setToast]        = useState(null);
  const [summary,      setSummary]      = useState(null);

  const [reportStatsOpen, setReportStatsOpen] = useState(false);

  const showToast = useCallback((msg, type="success")=>setToast({msg,type}),[]);

  useEffect(()=>{
    let alive = true;
    setLoading(true);
    reportsDashboardService.getSummary(activeFilter)
      .then((res)=>{ if(alive) setSummary(res.data); })
      .catch(()=>{ if(alive) showToast("Failed to load report data.", "error"); })
      .finally(()=>{ if(alive) setLoading(false); });
    return ()=>{ alive = false; };
  },[activeFilter, showToast]);

  // Stat-card values from the live summary (fall back to 0 while loading)
  const statValues = {
    "Total Reports":   summary?.totalReports   ?? 6,
    "Active Users":    summary?.activeUsers     ?? 0,
    "This Month":      summary?.thisMonthLeads  ?? 0,
    "Revenue Tracked": `₹${Number(summary?.revenueTracked ?? 0).toLocaleString("en-IN")}`,
  };

  const handleExportAll = async () => {
    try {
      const res = await reportsDashboardService.exportAll(activeFilter, "csv");
      const url  = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href  = url;
      link.setAttribute("download", `reports-${activeFilter}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast("Reports exported.");
    } catch {
      showToast("Export failed. Try again.", "error");
    }
  };

  const handleView = (card) => {
    // Navigate to specific report page
    // BACKEND: will load data for that specific report
    showToast(`Opening ${card.title}…`);
    navigate(card.path);
  };

  const handleRefresh = () => {
    setLoading(true);
    reportsDashboardService.getSummary(activeFilter)
      .then((res)=>{ setSummary(res.data); showToast("Reports refreshed."); })
      .catch(()=>showToast("Failed to refresh.", "error"))
      .finally(()=>setLoading(false));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100"
      style={{fontFamily:"'Plus Jakarta Sans', system-ui, sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes slideIn { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .fade-up { animation: fadeUp .4s ease both; }
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
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-white shadow-lg shadow-blue-200 flex-shrink-0">
                <FiBarChart2 className="w-5 h-5"/>
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                  Reports Dashboard
                </h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  Comprehensive analytics and business insights
                  <span className="hidden sm:inline ml-3 text-slate-300">|</span>
                  <span className="hidden sm:inline ml-3 text-xs">
                    <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={()=>navigate("/")}>Home</span>
                    <span className="mx-1 text-slate-300">/</span>
                    <span className="text-blue-600 font-bold">Reports</span>
                  </span>
                </p>
              </div>
            </div>

            {/* Header actions */}
            <div className="flex items-center gap-2">
              <button onClick={handleRefresh}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200
                  hover:border-blue-300 bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-600
                  text-sm font-bold transition-all shadow-sm">
                <FiRefreshCw className={`w-4 h-4 ${loading?"animate-spin":""}`}/> Refresh
              </button>
              <button
                onClick={handleExportAll}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700
                  text-white text-sm font-bold shadow-md shadow-blue-200 transition-all">
                <FiDownload className="w-4 h-4"/> Export All
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── STAT CARDS ── */}
        {/* <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {STAT_CARDS.map(s=>(
            <StatCard key={s.label} {...s} value={statValues[s.label]}/>
          ))}
        </div> */}

        {/* ── COLLAPSIBLE REPORT DASHBOARD ANALYTICS ── */}
<div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden fade-up">

  {/* Toggle header */}
  <button
    type="button"
    onClick={() =>
      setReportStatsOpen((previous) => !previous)
    }
    aria-expanded={reportStatsOpen}
    className="w-full px-4 sm:px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
  >
    <div className="flex items-center gap-3 flex-wrap min-w-0">
      <div className="flex items-center gap-2">
        <FiBarChart2 className="w-4 h-4 text-blue-600" />

        <span className="text-sm font-extrabold text-slate-700">
          Reports Analytics
        </span>
      </div>

      {/* Compact values shown while cards are closed */}
      {!reportStatsOpen && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold">
            {statValues["Total Reports"]} Reports
          </span>

          <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-[11px] font-bold">
            {statValues["Active Users"]} Active Users
          </span>

          <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold">
            {statValues["This Month"]} This Month
          </span>

          <span className="px-2.5 py-1 rounded-full bg-teal-100 text-teal-700 text-[11px] font-bold">
            Revenue {statValues["Revenue Tracked"]}
          </span>
        </div>
      )}
    </div>

    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
      {reportStatsOpen ? (
        <FiChevronUp className="w-4 h-4" />
      ) : (
        <FiChevronDown className="w-4 h-4" />
      )}
    </div>
  </button>

  {/* Expandable cards */}
  <div
    className={`grid transition-all duration-300 ease-in-out ${
      reportStatsOpen
        ? "grid-rows-[1fr] opacity-100"
        : "grid-rows-[0fr] opacity-0"
    }`}
  >
    <div className="min-h-0 overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 pt-1">
        {STAT_CARDS.map((stat) => (
          <StatCard
            key={stat.label}
            {...stat}
            value={statValues[stat.label]}
          />
        ))}
      </div>
    </div>
  </div>
</div>

        {/* ── DATE FILTER BAR ── */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm p-4 fade-up">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider flex-shrink-0">
              Filter Period:
            </span>
            <div className="flex flex-wrap gap-2">
              {DATE_FILTERS.map(f=>(
                <button key={f.id} onClick={()=>setActiveFilter(f.id)}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all
                    ${activeFilter===f.id
                      ?"bg-blue-600 text-white shadow-md shadow-blue-200"
                      :"bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600"}`}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="sm:ml-auto text-xs text-slate-400 font-medium flex-shrink-0">
              📅 Showing data for:{" "}
              <span className="font-bold text-blue-600">
                {DATE_FILTERS.find(f=>f.id===activeFilter)?.label}
              </span>
            </div>
          </div>
        </div>

        {/* ── REPORT CARDS GRID ── */}
        <div>
          {/* Section label */}
          <div className="flex items-center gap-3 mb-4 fade-up">
            <h2 className="text-base font-extrabold text-slate-700">Available Reports</h2>
            <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2.5 py-1 rounded-full">
              {REPORT_CARDS.length} reports
            </span>
            <div className="flex-1 h-px bg-slate-200"/>
          </div>

          {/* Skeleton loading */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[...Array(6)].map((_,i)=>(
                <div key={i} className="bg-white/80 rounded-2xl border border-slate-200/60 p-5 space-y-3 animate-pulse">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-slate-200 flex-shrink-0"/>
                    <div className="flex-1 space-y-2 pt-1">
                      <div className="h-4 bg-slate-200 rounded-lg w-3/4"/>
                      <div className="h-3 bg-slate-200 rounded-lg w-full"/>
                      <div className="h-3 bg-slate-200 rounded-lg w-2/3"/>
                    </div>
                  </div>
                  <div className="h-8 bg-slate-200 rounded-xl w-36"/>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {REPORT_CARDS.map(card=>(
                <ReportCard key={card.id} card={card} onView={handleView}/>
              ))}
            </div>
          )}
        </div>

        {/* ── QUICK INSIGHTS BANNER ── */}
        {!loading && (
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white shadow-lg fade-up relative overflow-hidden">
            <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/10"/>
            <div className="absolute -left-6 -bottom-8 w-36 h-36 rounded-full bg-white/10"/>
            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <FiTrendingUp className="w-6 h-6"/>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-extrabold mb-1">Quick Insights</h3>
                <p className="text-sm text-white/80 leading-relaxed">
                  Select any report category above to view detailed analytics, charts and export options.
                  All reports are filtered by the selected time period.
                </p>
              </div>
              <button
                onClick={()=>showToast("Report generation coming soon.")}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-blue-600 font-bold text-sm
                  hover:bg-blue-50 transition-all shadow-md flex-shrink-0">
                <FiBarChart2 className="w-4 h-4"/> Generate Report
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}