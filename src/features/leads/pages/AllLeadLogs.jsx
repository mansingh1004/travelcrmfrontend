import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search as FiSearch, ArrowLeft as FiArrowLeft, ChevronDown as FiChevronDown, Phone as FiPhone, FileText as FiFileText, Plus as FiPlus, List as FiList, ChevronLeft as FiChevronLeft, ChevronRight as FiChevronRight, Calendar as FiCalendar, User as FiUser, ClipboardList as FaClipboardList, Users as FaUsers, Calendar as FaCalendarAlt, ChevronsLeft as FaAngleDoubleLeft, ChevronsRight as FaAngleDoubleRight, Files as MdOutlinePages } from "lucide-react";


import { leadService } from "../api/leadService";
import { useToast } from "@shared/ui/toast";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { AddLogModal, LogsModal } from "../components/LeadLogModals";
import { STAGE_FILTER_OPTIONS } from "../lib/leadStages";

// Was a local list carrying a phantom "Ready to Book" (not in the backend enum, so filtering by
// it sent an unknown value) and missing "Reopened" (which LeadStage.REOPENED does define).
const STAGES = STAGE_FILTER_OPTIONS;

const STAGE_CFG = {
  "New Lead":      { bg:"bg-blue-500",   text:"text-white" },
  "Contacted":     { bg:"bg-cyan-500",   text:"text-white" },
  "Follow Up":     { bg:"bg-amber-500",  text:"text-white" },
  "Qualified":     { bg:"bg-indigo-500", text:"text-white" },
  "Proposal Sent": { bg:"bg-purple-500", text:"text-white" },
  "Converted":     { bg:"bg-green-600",  text:"text-white" },
  // Violet matches the REOPENED marker already used in LeadHistoryDrawer.
  "Reopened":      { bg:"bg-violet-500", text:"text-white" },
  "Lost":          { bg:"bg-red-500",    text:"text-white" },
};
const STAGE_DEF = { bg:"bg-slate-400", text:"text-white" };

const PER_PAGE = 12;


/* ─── HERO STAT CARD ─────────────────────────────────────────── */
function HeroCard({ value, label, bg, icon, isDate, delay=0 }) {
  const [disp, setDisp] = useState(isDate ? value : 0);
  useEffect(() => {
    if (isDate) { setDisp(value); return; }
    let s = 0;
    const step = Math.max(1, Math.ceil(value / 40));
    const iv = setInterval(() => {
      s = Math.min(s + step, value);
      setDisp(s);
      if (s >= value) clearInterval(iv);
    }, 16);
    return () => clearInterval(iv);
  }, [value, isDate]);

  return (
    <div className={`${bg} rounded-2xl p-5 sm:p-6 text-white shadow-lg relative overflow-hidden group
      hover:-translate-y-1 hover:shadow-xl transition-all duration-300`}
      style={{animation:"fadeUp .4s ease both", animationDelay:`${delay}ms`}}>
      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10 group-hover:scale-110 transition-transform"/>
      <div className="absolute -right-3 -bottom-8 w-32 h-32 rounded-full bg-white/10"/>
      <div className="relative z-10 flex items-start justify-between">
        <div>
          <p className={`font-extrabold leading-none mb-1 ${isDate ? "text-2xl sm:text-3xl" : "text-4xl sm:text-5xl"}`}>
            {disp}
          </p>
          <p className="text-xs font-extrabold uppercase tracking-widest opacity-85">{label}</p>
        </div>
        <div className="text-white/20 text-5xl sm:text-6xl flex-shrink-0 ml-2">{icon}</div>
      </div>
    </div>
  );
}

/* ─── SKELETON CARD ──────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3 animate-pulse">
      <div className="h-5 bg-slate-200 rounded-lg w-2/5"/>
      <div className="h-3.5 bg-slate-100 rounded-lg w-3/5"/>
      <div className="h-3 bg-slate-100 rounded-lg w-1/4"/>
      <div className="border-l-4 border-slate-200 pl-3 space-y-2 py-2">
        <div className="h-3.5 bg-slate-200 rounded w-full"/>
        <div className="h-3.5 bg-slate-100 rounded w-3/4"/>
      </div>
      <div className="h-3 bg-slate-100 rounded w-2/5"/>
    </div>
  );
}

/* ─── LEAD LOG CARD ──────────────────────────────────────────── */
function LeadCard({ lead, onNavigateLogs, onNavigateAddLog, idx }) {
  const sc = STAGE_CFG[lead.stage] || STAGE_DEF;
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm
      hover:shadow-md hover:border-blue-200 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
      style={{animation:"fadeUp .4s ease both", animationDelay:`${idx * 50}ms`}}>

      {/* Card top accent bar */}
      <div className="h-1 bg-gradient-to-r from-blue-500 to-teal-400"/>

      <div className="p-4 space-y-3">
        {/* Lead name + stage badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-base font-extrabold text-slate-800 leading-tight">{lead.leadName}</h3>
            {lead.leadCode && (
              <p className="text-[10px] font-bold text-slate-400 font-mono mt-0.5">{lead.leadCode}</p>
            )}
          </div>
          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full flex-shrink-0 ${sc.bg} ${sc.text}`}>
            ✦ {lead.stage}
          </span>
        </div>

        {/* Phone + log count */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <FiPhone className="w-3 h-3 text-slate-400 flex-shrink-0"/>
            <span className="font-mono">{lead.phone}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <FiFileText className="w-3 h-3"/>
            <span className="font-bold text-slate-600">{lead.logCount}</span>
            <span>log{lead.logCount !== 1 ? "s" : ""}</span>
          </div>
        </div>

        {/* Latest Log section */}
        {lead.latestLog && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-extrabold text-slate-600">Latest Log:</p>
              <p className="text-[11px] text-slate-400 font-mono">{lead.latestLog.date}</p>
            </div>

            {/* Comment with left border accent — matches screenshot */}
            <div className="border-l-4 border-blue-400 bg-blue-50/50 pl-3 py-1.5 rounded-r-lg">
              <p className="text-xs text-slate-700 leading-relaxed line-clamp-2 font-medium">
                {lead.latestLog.comment}
              </p>
            </div>

            {/* Added by */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <FiUser className="w-3 h-3 text-slate-400 flex-shrink-0"/>
              <span>{lead.latestLog.addedBy}</span>
            </div>

            {/* Follow-up date */}
            {lead.latestLog.followUpDate && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600">
                <FiCalendar className="w-3 h-3 flex-shrink-0"/>
                <span className="font-medium">Follow-up: {lead.latestLog.followUpDate}</span>
              </div>
            )}
          </div>
        )}

        {/* Action buttons — View Logs + Add Log (circular, matches screenshot) */}
        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
          {/* View Lead Logs */}
          <button
            title="View Lead Logs"
            onClick={() => onNavigateLogs(lead)}
            className="w-9 h-9 rounded-full border-2 border-teal-400 text-teal-500
              hover:bg-teal-50 flex items-center justify-center transition-all hover:scale-105">
            <FiList className="w-4 h-4"/>
          </button>
          {/* Add Log — navigates to AddLeadLog page */}
          <button
            title="Add Log"
            onClick={() => onNavigateAddLog(lead)}
            className="w-9 h-9 rounded-full border-2 border-green-400 text-green-500
              hover:bg-green-50 flex items-center justify-center transition-all hover:scale-105">
            <FiPlus className="w-4 h-4"/>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── MAIN PAGE ──────────────────────────────────────────────── */
export default function AllLeadLogs() {
  const navigate = useNavigate();

  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [stage,   setStage]   = useState("All Stages");
  const [user,    setUser]    = useState("All Users");
  const [page,    setPage]    = useState(1);
  // Lead whose log popup is open — replaces the old navigation to the duplicate routed pages.
  const [addLogLead, setAddLogLead] = useState(null);
  const [logsLead,   setLogsLead]   = useState(null);

  // Centralized toaster: <ToastHost/> (mounted beside the router in App.jsx) renders it.
  const { showToast } = useToast();

  useEffect(() => {
    let active = true;
    setLoading(true);
    // Load every lead-with-logs once; the grid's existing client-side search/stage/user
    // filter + pagination then work exactly as before.
    leadService.getLeadLogSummary({ page: 1, perPage: 1000 })
      .then((res) => {
        const body = res.data?.data ?? res.data;
        const leads = Array.isArray(body?.leads) ? body.leads
          : Array.isArray(body) ? body : [];
        if (active) setData(leads);
      })
      .catch((err) => {
        if (!active) return;
        setData([]);
        if (isAlreadyReported(err)) return;   // <ToastHost/> already showed it
        showToast(getErrorMessage(err, "Failed to load lead logs. Please try again."), "error");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [showToast]);

  /* client-side filter */
  const filtered = useMemo(() =>
    data.filter(l => {
      const q = search.toLowerCase();
      if (q && !l.leadName.toLowerCase().includes(q) &&
          !(l.leadCode?.toLowerCase().includes(q)) &&
          !(l.latestLog?.comment?.toLowerCase().includes(q))) return false;
      if (stage !== "All Stages" && l.stage !== stage) return false;
      if (user  !== "All Users"  && !l.latestLog?.addedBy?.toLowerCase().includes(user.toLowerCase())) return false;
      return true;
    })
  , [data, search, stage, user]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageData   = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE);

  /* User-filter options derived from the loaded data (no hardcoded user list). */
  const userOptions = useMemo(
    () => ["All Users", ...Array.from(new Set(data.map(l => l.latestLog?.addedBy).filter(Boolean)))],
    [data]
  );

  /* summary stats */
  const todayStr = new Date().toLocaleDateString("en-US", {
    month:"short", day:"numeric", year:"numeric"
  });
  const totalLogs = data.reduce((s, l) => s + l.logCount, 0);

  /* Log handlers — these used to navigate to the /LeadLogs and /AddLeadLog pages, which duplicated
     these popups and had drifted (the add page never persisted anything; its list had no delete).
     The modals take a `lead` shaped like the AllLeads row, so the grid's row is adapted here. */
  const toLeadShape = (lead) => ({
    publicId:  lead.leadId,
    id:        lead.leadId,
    customerName: lead.leadName,
    phone:     lead.phone,
    leadStage: lead.stage,
  });

  const handleNavigateLogs   = (lead) => setLogsLead(toLeadShape(lead));
  const handleNavigateAddLog = (lead) => setAddLogLead(toLeadShape(lead));

  const handleSearch = (e) => { e.preventDefault(); setPage(1); };

  const selectCls =
    "w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 font-medium " +
    "focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none appearance-none cursor-pointer " +
    "transition-all hover:border-slate-300";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100"
      style={{fontFamily:"'Plus Jakarta Sans', system-ui, sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes slideIn { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .fade-up { animation: fadeUp .4s ease both; }
        select { -webkit-appearance:none; appearance:none; }
        .line-clamp-2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#f1f5f9;border-radius:99px}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:99px}
      `}</style>

      {/* ── PAGE HEADER ── */}
      <div className="bg-white/70 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-white shadow-lg shadow-blue-200 flex-shrink-0">
                <FaClipboardList className="w-5 h-5"/>
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Lead Logs</h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  All log entries across all leads
                  <span className="hidden sm:inline ml-3 text-slate-300">|</span>
                  <span className="hidden sm:inline ml-3 text-xs">
                    <span className="hover:text-blue-600 cursor-pointer" onClick={() => navigate("/")}>Home</span>
                    <span className="mx-1 text-slate-300">/</span>
                    <span className="hover:text-blue-600 cursor-pointer" onClick={() => navigate("/allleads ")}>Leads</span>
                    <span className="mx-1 text-slate-300">/</span>
                    <span className="text-blue-600 font-bold">Lead Logs</span>
                  </span>
                </p>
              </div>
            </div>
            <button onClick={() => navigate("/allleads ")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200
                hover:border-blue-300 bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-600
                text-sm font-bold transition-all shadow-sm">
              <FiArrowLeft className="w-4 h-4"/> Back to Leads
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* ── 4 HERO STAT CARDS ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <HeroCard
            value={totalLogs}
            label="Total Logs"
            bg="bg-gradient-to-br from-teal-500 to-cyan-600"
            icon={<FaClipboardList/>}
            delay={0}
          />
          <HeroCard
            value={data.length}
            label="Total Leads"
            bg="bg-gradient-to-br from-green-500 to-emerald-600"
            icon={<FaUsers/>}
            delay={60}
          />
          <HeroCard
            value={todayStr}
            label="Today"
            bg="bg-gradient-to-br from-amber-500 to-orange-500"
            icon={<FaCalendarAlt/>}
            isDate
            delay={120}
          />
          <HeroCard
            value={totalPages}
            label="Total Pages"
            bg="bg-gradient-to-br from-red-500 to-rose-600"
            icon={<MdOutlinePages/>}
            delay={180}
          />
        </div>

        {/* ── SEARCH + FILTERS ── */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm p-4 fade-up">
          <form onSubmit={handleSearch}
            className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search in leads or comments..."
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm
                  text-slate-700 placeholder-slate-400 focus:border-blue-400 focus:ring-2
                  focus:ring-blue-50 outline-none transition-all hover:border-slate-300"
              />
            </div>
            {/* Search button */}
            <button type="submit"
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700
                text-white text-sm font-bold shadow-md shadow-blue-200 transition-all flex-shrink-0">
              <FiSearch className="w-4 h-4"/>
            </button>
            {/* Stage filter */}
            <div className="relative sm:w-52">
              <select value={stage} onChange={e => { setStage(e.target.value); setPage(1); }}
                className={selectCls + " pr-9"}>
                {STAGES.map(s => <option key={s}>{s}</option>)}
              </select>
              <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none"/>
            </div>
            {/* User filter */}
            <div className="relative sm:w-52">
              <select value={user} onChange={e => { setUser(e.target.value); setPage(1); }}
                className={selectCls + " pr-9"}>
                {userOptions.map(u => <option key={u}>{u}</option>)}
              </select>
              <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none"/>
            </div>
          </form>
        </div>

        {/* ── LEAD CARDS GRID ── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <SkeletonCard key={i}/>)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm
            flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="text-6xl mb-4">📋</div>
            <p className="text-lg font-extrabold text-slate-600 mb-2">No Logs Found</p>
            <p className="text-sm text-slate-400 mb-6 max-w-xs">
              No log entries match your search. Try adjusting the filters or search terms.
            </p>
            <button onClick={() => { setSearch(""); setStage("All Stages"); setUser("All Users"); setPage(1); }}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm
                shadow-md shadow-blue-200 transition-all">
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {pageData.map((lead, idx) => (
              <LeadCard
                key={lead.leadId}
                lead={lead}
                idx={idx}
                onNavigateLogs={handleNavigateLogs}
                onNavigateAddLog={handleNavigateAddLog}
              />
            ))}
          </div>
        )}

        {/* ── PAGINATION ── */}
        {filtered.length > PER_PAGE && (
          <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm
            px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 fade-up">
            <p className="text-xs text-slate-400 font-medium">
              Showing{" "}
              <span className="font-bold text-slate-600">{(page-1)*PER_PAGE+1}</span>–
              <span className="font-bold text-slate-600">{Math.min(page*PER_PAGE, filtered.length)}</span>
              {" "}of{" "}
              <span className="font-bold text-slate-600">{filtered.length}</span> leads
            </p>
            <div className="flex items-center gap-1.5">
              <button disabled={page===1} onClick={() => setPage(1)}
                className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500
                  hover:border-blue-300 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed
                  transition-all flex items-center justify-center">
                <FaAngleDoubleLeft className="text-xs"/>
              </button>
              <button disabled={page===1} onClick={() => setPage(p => p-1)}
                className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500
                  hover:border-blue-300 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed
                  transition-all flex items-center justify-center">
                <FiChevronLeft className="w-3.5 h-3.5"/>
              </button>
              {Array.from({length: totalPages}, (_, i) => i+1)
                .filter(p => p===1 || p===totalPages || Math.abs(p-page)<=1)
                .reduce((acc, p, i, arr) => {
                  if (i > 0 && p - arr[i-1] > 1) acc.push("…");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  typeof p === "string"
                    ? <span key={`e${i}`} className="px-1 text-xs text-slate-400">…</span>
                    : <button key={p} onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold border transition-all
                          ${page===p
                            ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                            : "bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600"}`}>
                        {p}
                      </button>
                )}
              <button disabled={page===totalPages} onClick={() => setPage(p => p+1)}
                className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500
                  hover:border-blue-300 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed
                  transition-all flex items-center justify-center">
                <FiChevronRight className="w-3.5 h-3.5"/>
              </button>
              <button disabled={page===totalPages} onClick={() => setPage(totalPages)}
                className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500
                  hover:border-blue-300 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed
                  transition-all flex items-center justify-center">
                <FaAngleDoubleRight className="text-xs"/>
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Log popups — the same components AllLeads uses, so the two screens cannot drift apart.
          A saved log bumps that row's count without a full refetch. */}
      {addLogLead && (
        <AddLogModal
          lead={addLogLead}
          onClose={() => setAddLogLead(null)}
          onLogAdded={() => {
            setData(prev => prev.map(l =>
              l.leadId === addLogLead.publicId ? { ...l, logCount: (l.logCount || 0) + 1 } : l));
            setAddLogLead(null);
          }}
        />
      )}
      {logsLead && (
        <LogsModal lead={logsLead} onClose={() => setLogsLead(null)} canDelete={false} />
      )}
    </div>
  );
}