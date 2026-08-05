import { useState, useEffect, useRef, useCallback } from "react";
import { leadService } from "@features/leads";
import { bookingService } from "@features/bookings";
import dashboardService from "../api/dashboardService";
import { profileUserService as userService } from "@features/profile";
import { companyService } from "@features/settings";
import { activityReportsService } from "@features/reports";
import { useNavigate } from "react-router-dom";
import { Users as FiUsers, TrendingUp as FiTrendingUp, RefreshCw as FiRefreshCw, Target as FiTarget, Filter as FiFilter, ChevronRight as FiChevronRight, MapPin as FiMapPin, Phone as FiPhone, Calendar as FiCalendar, Check as FiCheck, CreditCard as FiCreditCard, Activity as FiActivity, Settings as FiSettings, ChartColumn as FiBarChart2, Pen as FiEdit2, Plus as FiPlus, DollarSign as FiDollarSign, ArrowUp as FiArrowUp, ArrowDown as FiArrowDown, LayoutGrid as FiGrid, Flame as FaFire, Users as FaUsers, Trophy as FaTrophy, IndianRupee as FaRupeeSign, CircleCheck as FaCheckCircle, Calendar as FaRegCalendarAlt, Plane as FaPlane, Building2 as FaBuilding, ChartLine as FaChartLine, Gem as FaGem, LayoutDashboard as MdOutlineDashboard } from "lucide-react";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area } from "recharts";

/* ─── DEFAULT EMPTY STATE ───────────────────────────────────── */
const EMPTY_D = {
  totalLeads:0, convertedLeads:0, conversionRate:0, revenue:0,
  profit:0, netMargin:0, refunds:0, winRate:0, hotLeads:0,
  leadSources:[], topDestinations:[], revenueTimeline:[],
  topPerformersConv:[], topPerformersProfit:[],
  priorityFollowups:[], nearTravelDates:[],
};

const EMPTY_O = {
  totalUsers:0, activeUsers:0,
  subEndDate:"—",
  userLimit:{ max:0, used:0 },
  plan:{ name:"—", status:"—", daysLeft:0, startDate:"—", endDate:"—" },
  company:{ name:"—", email:"—", phone:"—", address:"—", status:"—" },
  recentUsers:[], recentActivity:[],
};

const DEFAULT_PERIOD = "month";
const periodOptions = [
  { label: "Today", value: "today" },
  { label: "Weekly", value: "week" },
  { label: "Monthly", value: "month" },
  { label: "Yearly", value: "year" },
  { label: "Custom", value: "custom" },
];
const TIER = { gold:"🥇", silver:"🥈", bronze:"🥉" };
const fmtINR = n => `₹${Number(n).toLocaleString("en-IN")}`;

/* ─── ANIMATED COUNTER ───────────────────────────────────────── */
function Counter({ to, prefix="", suffix="", decimals=0, duration=1200 }) {
  const [val, setVal] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const start = performance.now();
    const step = (ts) => {
      const p = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      const cur = ease * to;
      setVal(decimals > 0 ? parseFloat(cur.toFixed(decimals)) : Math.round(cur));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [to, duration, decimals]);
  return <>{prefix}{decimals > 0 ? val.toFixed(decimals) : val.toLocaleString("en-IN")}{suffix}</>;
}

/* ─── HERO STAT CARD ─────────────────────────────────────────── */
function HeroCard({ icon, label, value, sub, from, to, delay=0, isINR, decimals=0, suffix="", trend }) {
  return (
    <div className={`bg-gradient-to-br ${from} ${to} rounded-2xl p-4 sm:p-5 text-white relative overflow-hidden
      group hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 shadow-lg ring-1 ring-white/10`}
      style={{animation:`fadeUp .5s ease both`,animationDelay:`${delay}ms`}}>
      {/* Glossy top highlight */}
      <div className="absolute inset-x-0 -top-1/2 h-full bg-gradient-to-b from-white/25 to-transparent opacity-60 pointer-events-none"/>
      {/* BG circles */}
      <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10 group-hover:scale-110 transition-transform duration-500"/>
      <div className="absolute -right-2 -bottom-8 w-20 h-20 rounded-full bg-white/10"/>
      <div className="relative z-10 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] sm:text-xs font-extrabold uppercase tracking-widest opacity-80 truncate">{label}</p>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-base sm:text-lg flex-shrink-0 shadow-inner group-hover:scale-110 transition-transform">{icon}</div>
        </div>
        <p className="text-2xl sm:text-3xl font-extrabold leading-none tracking-tight">
          {isINR
            ? <><span className="text-lg sm:text-xl">₹</span><Counter to={value}/></>
            : <Counter to={value} suffix={suffix} decimals={decimals}/>}
        </p>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {sub && <p className="text-[11px] sm:text-xs opacity-70">{sub}</p>}
          {trend != null && (
            <div className={`flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-full ml-auto
              ${trend >= 0 ? "bg-white/20 text-white" : "bg-red-300/30 text-red-100"}`}>
              {trend >= 0 ? <FiArrowUp className="w-3 h-3"/> : <FiArrowDown className="w-3 h-3"/>}
              {Math.abs(trend)}%
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── MINI METRIC CARD ───────────────────────────────────────── */
function MiniCard({ icon, label, value, sub, bg, delay=0 }) {
  return (
    <div className={`${bg} rounded-2xl px-4 sm:px-5 py-4 text-white flex items-center gap-3 sm:gap-4 relative overflow-hidden
      shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 ring-1 ring-white/10`}
      style={{animation:`fadeUp .5s ease both`,animationDelay:`${delay}ms`}}>
      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white/15 flex items-center justify-center text-lg sm:text-xl flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-extrabold uppercase tracking-widest opacity-70 truncate">{label}</p>
        <p className="text-lg sm:text-xl font-extrabold leading-tight mt-0.5">{value}</p>
        {sub && <p className="text-[11px] opacity-60 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

/* ─── SECTION CARD WRAPPER ───────────────────────────────────── */
function SectionCard({ headerBg, headerIcon, title, badge, action, children, delay=0 }) {
  return (
    <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden fade-up"
      style={{animationDelay:`${delay}ms`}}>
      {/* Header */}
      <div className={`${headerBg} px-5 py-3.5 flex items-center justify-between`}>
        <div className="flex items-center gap-2.5 text-white">
          <span className="opacity-80">{headerIcon}</span>
          <span className="text-sm font-extrabold tracking-tight">{title}</span>
          {badge != null && (
            <span className="bg-white/25 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full min-w-[18px] text-center">
              {badge}
            </span>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/* ─── OPS STAT CARD ──────────────────────────────────────────── */
function OpsCard({ label, mainValue, sub, icon, gradient, delay=0 }) {
  return (
    <div className={`${gradient} rounded-2xl p-4 sm:p-5 text-white relative overflow-hidden group
      hover:-translate-y-1 hover:shadow-xl transition-all duration-300 shadow-lg ring-1 ring-white/10`}
      style={{animation:`fadeUp .5s ease both`,animationDelay:`${delay}ms`}}>
      <div className="absolute inset-x-0 -top-1/2 h-full bg-gradient-to-b from-white/20 to-transparent opacity-60 pointer-events-none"/>
      <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/10 group-hover:scale-110 transition-transform"/>
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-[10px] font-extrabold uppercase tracking-widest opacity-70 truncate">{label}</p>
          <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center text-base flex-shrink-0">{icon}</div>
        </div>
        <p className="text-2xl sm:text-3xl font-extrabold leading-none break-words">{mainValue}</p>
        {sub && <p className="text-[11px] sm:text-xs opacity-70 mt-2 border-t border-white/20 pt-2 truncate">{sub}</p>}
      </div>
    </div>
  );
}

/* ─── DONUT LABEL ────────────────────────────────────────────── */
const DonutLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.06) return null;
  const R = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  return (
    <text x={cx + r * Math.cos(-midAngle * R)} y={cy + r * Math.sin(-midAngle * R)}
      fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={800}>
      {`${(percent*100).toFixed(0)}%`}
    </text>
  );
};

/* ─── CUSTOM TOOLTIP ─────────────────────────────────────────── */
const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xl px-4 py-3 text-xs">
      <p className="font-extrabold text-slate-700 mb-1.5">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{color:p.color}} className="font-bold">
          {p.name}: {p.name === "revenue" ? fmtINR(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

/* ─── LOADING SKELETONS ──────────────────────────────────────── */
function SkelBox({ className = "" }) {
  return <div className={`relative overflow-hidden bg-slate-200/70 rounded-2xl ${className}`}>
    <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
  </div>;
}

function AnalyticsSkeleton() {
  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5 space-y-5">
      <div className="flex flex-wrap gap-3">
        <SkelBox className="h-11 w-44" />
        <SkelBox className="h-11 w-32" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <SkelBox key={i} className="h-32" />)}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <SkelBox key={i} className="h-20" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">
        <SkelBox className="h-72" />
        <SkelBox className="h-72" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5">
        <SkelBox className="h-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <SkelBox className="h-64" />
          <SkelBox className="h-64" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[...Array(3)].map((_, i) => <SkelBox key={i} className="h-64" />)}
      </div>
    </div>
  );
}

function OperationsSkeleton() {
  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5 space-y-5">
      <SkelBox className="h-20" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <SkelBox key={i} className="h-32" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SkelBox className="h-80" />
        <SkelBox className="h-80" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SkelBox className="h-72" />
        <SkelBox className="h-72" />
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   MAIN DASHBOARD COMPONENT
═════════════════════════════════════════════════════════════ */
/* ─── DATA BUILDER HELPERS ──────────────────────────────────── */
const toToken = (value) =>
  String(value || "").trim().toUpperCase().replace(/[\s-]+/g, "_");

const parseValidDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfDay = (date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const getDateRange = (period, fromDate, toDate) => {
  const now = new Date();

  if (period === "custom") {
    const from = parseValidDate(fromDate);
    const to = parseValidDate(toDate);
    return {
      from: from ? startOfDay(from) : null,
      to: to ? endOfDay(to) : null,
    };
  }

  const to = endOfDay(now);
  const from = startOfDay(now);

  if (period === "week") from.setDate(from.getDate() - 6);
  if (period === "month") from.setDate(1);
  if (period === "year") {
    from.setMonth(0);
    from.setDate(1);
  }

  return { from, to };
};

const rowDate = (row, fields) => {
  for (const field of fields) {
    const date = parseValidDate(row?.[field]);
    if (date) return date;
  }
  return null;
};

const withinRange = (date, from, to) =>
  !!date && (!from || date >= from) && (!to || date <= to);

function filterDashboardData(leads, bookings, period, fromDate, toDate) {
  const { from, to } = getDateRange(period, fromDate, toDate);
  return {
    leads: leads.filter(l => withinRange(rowDate(l, ["createdAt", "travelDate"]), from, to)),
    bookings: bookings.filter(b => withinRange(rowDate(b, ["bookingDate", "createdAt", "travelDate"]), from, to)),
  };
}

function buildAnalytics(leads, bookings) {
  const total     = leads.length;
  const converted = leads.filter(l => ["CONVERTED", "READY_TO_BOOK"].includes(toToken(l.leadStage))).length;
  const hotLeads  = leads.filter(l => ["HOT", "VIP"].includes(toToken(l.leadType))).length;
  const rate      = total > 0 ? +((converted / total) * 100).toFixed(2) : 0;
  const activeBookings = bookings.filter(b => !["CANCELLED", "REFUNDED"].includes(toToken(b.status)));

  // Revenue / profit from bookings
  const revenue = activeBookings.reduce((s, b) => s + (Number(b.customerAmount) || 0), 0);
  const profit  = activeBookings.reduce((s, b) => s + (Number(b.netProfit)      || 0), 0);
  const refunds = bookings.filter(b => toToken(b.status) === "REFUNDED")
                          .reduce((s, b) => s + (Number(b.totalPayable) || 0), 0);
  const netMargin = revenue > 0 ? +((profit / revenue) * 100).toFixed(1) : 0;
  const wins      = activeBookings.filter(b => ["CONFIRMED", "COMPLETED"].includes(toToken(b.status))).length;
  const winRate   = activeBookings.length > 0 ? +((wins / activeBookings.length) * 100).toFixed(2) : 0;

  // Lead sources
  const srcMap = {};
  leads.forEach(l => { const s = l.leadSource || "Other"; srcMap[s] = (srcMap[s] || 0) + 1; });
  const SRC_COLORS = ["#f472b6","#60a5fa","#fbbf24","#34d399","#a78bfa","#fb923c"];
  const leadSources = Object.entries(srcMap)
    .sort((a,b) => b[1]-a[1]).slice(0,7)
    .map(([name,value],i) => ({ name, value, color: SRC_COLORS[i] || "#94a3b8" }));
  // Top destinations from bookings
  const destMap = {};
  activeBookings.forEach(b => {
    const d = b.destinationSnapshot || b.destination || "Other";
    if (!destMap[d]) destMap[d] = { bookings:0, revenue:0 };
    destMap[d].bookings++;
    destMap[d].revenue += Number(b.customerAmount) || 0;
  });

  const topDestinations = Object.entries(destMap)
    .sort((a,b) => b[1].bookings - a[1].bookings).slice(0,5)
    .map(([name,v]) => ({ name, ...v }));

  // Revenue timeline (last 6 months)
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const timeMap = {};
  activeBookings.forEach(b => {
    const d = new Date(b.bookingDate || b.createdAt || Date.now());
    const k = MONTHS[d.getMonth()];
    if (!timeMap[k]) timeMap[k] = { month:k, revenue:0, bookings:0 };
    timeMap[k].revenue  += Number(b.customerAmount) || 0;
    timeMap[k].bookings += 1;
  });
  const now = new Date();
  const revenueTimeline = Array.from({length:6}, (_,i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const k = MONTHS[d.getMonth()];
    return timeMap[k] || { month:k, revenue:0, bookings:0 };
  });

  // Top performers by conversions
  const perfMap = {};
  leads.forEach(l => {
    const u = l.assignedUser?.fullName || l.assignedUser?.name || l.assignTo || "Unassigned";
    if (!perfMap[u]) perfMap[u] = { name:u, leads:0, conversions:0, revenue:0, profit:0 };
    perfMap[u].leads++;
    if (toToken(l.leadStage) === "CONVERTED") perfMap[u].conversions++;
  });
  activeBookings.forEach(b => {
    const u = b.assignedUserName || b.assignedUser?.fullName || b.assignedUser?.name || "Unassigned";
    if (!perfMap[u]) perfMap[u] = { name:u, leads:0, conversions:0, revenue:0, profit:0 };
    perfMap[u].revenue += Number(b.customerAmount) || 0;
    perfMap[u].profit  += Number(b.netProfit)      || 0;
  });
  const tiers = ["gold","silver","bronze"];
  const topPerformersConv = Object.values(perfMap)
    .sort((a,b) => b.conversions - a.conversions).slice(0,5)
    .map((p,i) => ({ ...p, rank:i+1, rate: p.leads>0 ? +((p.conversions/p.leads)*100).toFixed(2) : 0, tier: tiers[i] || null }));
  const topPerformersProfit = Object.values(perfMap)
    .sort((a,b) => b.profit - a.profit).slice(0,5)
    .map((p,i) => ({ ...p, rank:i+1, margin: p.revenue>0 ? +((p.profit/p.revenue)*100).toFixed(1) : 0, converted: p.conversions, tier: tiers[i] || null }));

  // Priority followups — leads with upcoming travel dates or overdue reminders
  const today = new Date(); today.setHours(0,0,0,0);
  const priorityFollowups = leads
    .filter(l => !["CONVERTED", "LOST"].includes(toToken(l.leadStage)))
    .filter(l => l.leadLogs?.some(log => log.followUpDate && new Date(log.followUpDate) <= today))
    .slice(0, 5)
    .map(l => {
      const log = l.leadLogs?.find(lg => lg.followUpDate && new Date(lg.followUpDate) <= today);
      return {
        name:     l.customerName, phone: l.phone,
        note:     log?.comment || "Follow-up required",
        dueDate:  log?.followUpDate ? new Date(log.followUpDate).toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "—",
        urgency:  new Date(log?.followUpDate) < today ? "Overdue" : "Today",
      };
    });

  // Near travel dates
  const nearTravelDates = leads
    .filter(l => l.travelDate)
    .map(l => {
      const travel = new Date(l.travelDate); travel.setHours(0,0,0,0);
      const diff   = Math.round((travel - today) / 86400000);
      return { name:l.customerName, phone:l.phone,
               travelDate: travel.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}),
               stage:l.leadStage, daysLeft:diff };
    })
    .filter(l => l.daysLeft >= 0 && l.daysLeft <= 10)
    .sort((a,b) => a.daysLeft - b.daysLeft)
    .slice(0, 5);

  return {
    totalLeads:total, convertedLeads:converted, conversionRate:rate,
    revenue, profit, netMargin, refunds, winRate, hotLeads,
    leadSources, topDestinations, revenueTimeline,
    topPerformersConv, topPerformersProfit,
    priorityFollowups, nearTravelDates,
  };
}

/* Pulls the payload out of an ApiResponse envelope ({ data: {...} }),
   falling back to the raw body for endpoints that return it unwrapped. */
const unwrapRes = (r) =>
  (r?.data && typeof r.data === "object" && "data" in r.data) ? r.data.data : r?.data;

const metricNumber = (value) => Number(value) || 0;
const asArray = (value) => Array.isArray(value) ? value : [];
const numberFields = (item = {}, fields = []) => {
  const base = item && typeof item === "object" ? item : {};
  return fields.reduce((acc, field) => ({ ...acc, [field]: metricNumber(acc[field]) }), { ...base });
};

const normalizeDashboardAnalytics = (data = {}) => {
  const next = { ...EMPTY_D, ...(data || {}) };
  return {
    ...next,
    totalLeads: metricNumber(next.totalLeads),
    convertedLeads: metricNumber(next.convertedLeads),
    conversionRate: metricNumber(next.conversionRate),
    revenue: metricNumber(next.revenue),
    profit: metricNumber(next.profit),
    netMargin: metricNumber(next.netMargin),
    refunds: metricNumber(next.refunds),
    winRate: metricNumber(next.winRate),
    hotLeads: metricNumber(next.hotLeads),
    leadSources: asArray(next.leadSources).map(item => numberFields(item, ["value"])),
    topDestinations: asArray(next.topDestinations).map(item => numberFields(item, ["bookings", "revenue"])),
    revenueTimeline: asArray(next.revenueTimeline).map(item => numberFields(item, ["revenue", "bookings"])),
    topPerformersConv: asArray(next.topPerformersConv).map(item =>
      numberFields(item, ["rank", "leads", "conversions", "revenue", "profit", "rate"])),
    topPerformersProfit: asArray(next.topPerformersProfit).map(item =>
      numberFields(item, ["rank", "leads", "conversions", "revenue", "profit", "margin", "converted"])),
    priorityFollowups: asArray(next.priorityFollowups),
    nearTravelDates: asArray(next.nearTravelDates).map(item => numberFields(item, ["daysLeft"])),
  };
};

async function fetchClientAnalytics({ period = DEFAULT_PERIOD, from = "", to = "" } = {}) {
  const [leadsRes, bookingsRes] = await Promise.all([
    leadService.getAllLeads(),
    bookingService.getAll(0, 500),
  ]);

  const leadsRaw = leadsRes.data?.data ?? leadsRes.data ?? [];
  const leads = Array.isArray(leadsRaw?.content) ? leadsRaw.content
              : Array.isArray(leadsRaw) ? leadsRaw : [];

  const bookRaw = bookingsRes.data?.data ?? bookingsRes.data ?? [];
  const bookings = Array.isArray(bookRaw?.content) ? bookRaw.content
                 : Array.isArray(bookRaw) ? bookRaw : [];

  const filtered = filterDashboardData(leads, bookings, period, from, to);
  return {
    leads,
    bookings,
    analytics: buildAnalytics(filtered.leads, filtered.bookings),
  };
}

/* Initials from a name, e.g. "Nepal Tours And Travels" → "NT" */
// (name || "") — NOT a `= ""` default parameter. A default only fires on `undefined`, so a null
// company.name (a tenant that has not filled its profile yet — i.e. every fresh deployment) reached
// null.trim() and took the whole Dashboard down through RouteErrorBoundary.
const initials = (name) =>
  (name || "").trim().split(/\s+/).slice(0, 2).map(w => w[0] || "").join("").toUpperCase() || "—";

function buildOperations({ users, company, subscription, activity }) {
  const usersList   = Array.isArray(users) ? users : [];
  const totalUsers  = usersList.length;
  const activeUsers = usersList.filter(u => u.status === "Active").length;

  const recentUsers = usersList.slice(0, 5).map(u => ({
    username: u.username,
    fullName: u.fullName || u.name,
    role:     u.role,
    status:   u.status,
    created:  u.createdAt,
  }));

  const sub      = subscription || {};
  const daysLeft = Number(sub.daysLeft) || 0;
  const plan = {
    name:      sub.plan || sub.planName || "—",
    status:    sub.status || (daysLeft >= 0 ? "Active" : "Expired"),
    daysLeft,
    startDate: sub.startDate || "—",
    endDate:   sub.endDate   || "—",
  };

  const co = company || {};
  const companyObj = {
    name:    co.name    || "—",
    email:   co.email   || "—",
    phone:   co.phone   || "—",
    address: co.address || "—",
    status:  co.status  || "Active",
  };

  const maxUsers = Number(sub.maxUsers) || Number(co.userLimit) || totalUsers || 0;

  const recentActivity = (Array.isArray(activity) ? activity : []).slice(0, 10).map(a => ({
    user:   a.username || a.user || "—",
    role:   a.type || a.role || "User",
    action: a.description || a.action || "—",
    time:   [a.date, a.time].filter(Boolean).join(", ") || a.time || "—",
  }));

  return {
    totalUsers, activeUsers,
    subEndDate: plan.endDate,
    userLimit: { max: maxUsers, used: totalUsers },
    plan, company: companyObj,
    recentUsers, recentActivity,
  };
}

export default function Dashboard() {
  const navigate   = useNavigate();
  const [tab,      setTab]     = useState("analytics");
  const [period,   setPeriod]  = useState(DEFAULT_PERIOD);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [greeting, setGreeting] = useState("");


  // Real data state
  const [D,       setD]       = useState(EMPTY_D);
  const [O,       setO]       = useState(EMPTY_O);
  const [allLeads, setAllLeads] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [opsLoaded, setOpsLoaded] = useState(false);
  const [opsLoading, setOpsLoading] = useState(true);
  const [toast,   setToast]   = useState(null);

  // Display name derived from the logged-in user's email (no name column at login)
  const userName = (localStorage.getItem("userEmail") || "").split("@")[0]
    .replace(/[._-]+/g, " ").trim()
    .replace(/\b\w/g, c => c.toUpperCase()) || "there";

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");
  }, []);

  /* ── FETCH REAL DATA ── */
  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const analytics = await dashboardService.getAnalytics({ period: DEFAULT_PERIOD });
      setD(normalizeDashboardAnalytics(analytics));
      setAllLeads([]);
      setAllBookings([]);
    } catch {
      try {
        const fallback = await fetchClientAnalytics({ period: DEFAULT_PERIOD });
        setAllLeads(fallback.leads);
        setAllBookings(fallback.bookings);
        setD(normalizeDashboardAnalytics(fallback.analytics));
      } catch (fallbackErr) {
        console.error("Dashboard fetch error:", fallbackErr);
        setToast({ msg:"Failed to load dashboard data.", type:"error" });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const applyCurrentFilter = useCallback(async () => {
    if (period === "custom") {
      const from = parseValidDate(fromDate);
      const to = parseValidDate(toDate);

      if (!from || !to) {
        setToast({ msg:"Please select both custom dates.", type:"error" });
        return;
      }
      if (from > to) {
        setToast({ msg:"From date cannot be after to date.", type:"error" });
        return;
      }
    }

    setLoading(true);
    try {
      const analytics = await dashboardService.getAnalytics({ period, from: fromDate, to: toDate });
      setD(normalizeDashboardAnalytics(analytics));
    } catch {
      try {
        if (allLeads.length || allBookings.length) {
          const filtered = filterDashboardData(allLeads, allBookings, period, fromDate, toDate);
          setD(normalizeDashboardAnalytics(buildAnalytics(filtered.leads, filtered.bookings)));
        } else {
          const fallback = await fetchClientAnalytics({ period, from: fromDate, to: toDate });
          setAllLeads(fallback.leads);
          setAllBookings(fallback.bookings);
          setD(normalizeDashboardAnalytics(fallback.analytics));
        }
      } catch (fallbackErr) {
        console.error("Dashboard filter error:", fallbackErr);
        setToast({ msg:"Failed to apply dashboard filter.", type:"error" });
      }
    } finally {
      setLoading(false);
    }
  }, [allLeads, allBookings, period, fromDate, toDate]);

  /* ── FETCH OPERATIONS DATA (users · company · subscription · activity) ── */
  const fetchOperations = useCallback(async () => {
    setOpsLoading(true);
    // allSettled → a single failing endpoint won't blank the whole tab
    const [usersRes, companyRes, subRes, actRes] = await Promise.allSettled([
      userService.getAll(),
      companyService.get(),
      companyService.getSubscription(),
      activityReportsService.getLogs({ perPage: 10, page: 1 }),
    ]);

    const users     = usersRes.status   === "fulfilled" ? (usersRes.value?.data || []) : [];
    const company   = companyRes.status === "fulfilled" ? unwrapRes(companyRes.value)   : null;
    const subscription = subRes.status  === "fulfilled" ? unwrapRes(subRes.value)       : null;
    const actBody   = actRes.status     === "fulfilled" ? unwrapRes(actRes.value)       : null;
    const activity  = actBody?.logs || (Array.isArray(actBody) ? actBody : []);

    // Only surface an error if we got literally nothing back
    if (usersRes.status === "rejected" && companyRes.status === "rejected") {
      setToast({ msg: "Failed to load operations data.", type: "error" });
    }

    setO(buildOperations({ users, company, subscription, activity }));
    setOpsLoading(false);
  }, []);

  // Load the Operations tab lazily the first time it's opened
  useEffect(() => {
    if (tab === "operations" && !opsLoaded) {
      setOpsLoaded(true);
      fetchOperations();
    }
  }, [tab, opsLoaded, fetchOperations]);

  const selectedPeriodLabel = periodOptions.find(p => p.value === period)?.label || "Monthly";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100"
      style={{fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes fadeUp  { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse2  { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes shimmer { 100%{transform:translateX(100%)} }
        .fade-up { animation:fadeUp .5s ease both; }
        .live-dot { animation:pulse2 2s ease infinite; }
        select { -webkit-appearance:none; appearance:none; }
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:#f1f5f9;border-radius:99px}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:99px}
      `}</style>

      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-[999] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl max-w-xs bg-red-50 border-red-200 text-red-800"
          style={{animation:"slideIn .3s ease both"}}>
          <span>❌</span>
          <p className="text-sm font-semibold flex-1">{toast.msg}</p>
          <button onClick={()=>setToast(null)} className="text-lg opacity-50 hover:opacity-100">×</button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          PAGE HEADER  (sticky)
      ══════════════════════════════════════════════════ */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">

            {/* Left: icon + title + greeting */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600
                flex items-center justify-center text-white shadow-lg shadow-blue-200 flex-shrink-0">
                <MdOutlineDashboard className="w-5 h-5"/>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-lg font-extrabold text-slate-800 leading-none">Dashboard</h1>
                  <span className="hidden sm:flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700
                    text-[10px] font-extrabold px-2.5 py-1 rounded-full">
                    <span className="live-dot w-1.5 h-1.5 rounded-full bg-green-500 inline-block"/>
                    Live Data
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">
                  <span className="cursor-pointer hover:text-blue-600 transition-colors" onClick={()=>navigate("/")}>Home</span>
                  <span className="mx-1">/</span>
                  <span className="text-blue-600 font-bold">Dashboard</span>
                </p>
              </div>
            </div>

            {/* Right: greeting + date */}
            <div className="hidden sm:flex flex-col items-end text-right flex-shrink-0">
              <p className="text-xs sm:text-sm font-extrabold text-slate-700 truncate max-w-[200px]">{greeting}, {userName} 👋</p>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                {new Date().toLocaleDateString("en-IN",{weekday:"long",year:"numeric",month:"short",day:"numeric"})}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          TAB BAR
      ══════════════════════════════════════════════════ */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 pt-5">
        <div className="flex rounded-2xl overflow-hidden border border-slate-200/60 shadow-sm bg-white/60 backdrop-blur-md">
          {[
            { id:"analytics",  label:"Analytics",  icon:<FiBarChart2 className="w-4 h-4"/>,  desc:"Business insights"  },
            { id:"operations", label:"Operations", icon:<FiGrid className="w-4 h-4"/>, desc:"System overview" },
          ].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2.5 py-3.5 text-sm font-extrabold
                transition-all duration-250
                ${tab===t.id
                  ?"bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow-sm"
                  :"text-slate-500 hover:text-slate-700 hover:bg-slate-50/60"}`}>
              {t.icon}
              <span>{t.label}</span>
              <span className={`text-[10px] font-bold hidden sm:inline ${tab===t.id?"text-white/60":"text-slate-400"}`}>
                {t.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          ANALYTICS TAB
      ══════════════════════════════════════════════════ */}
      {tab==="analytics" && loading && <AnalyticsSkeleton/>}
      {tab==="analytics" && !loading && (
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5 space-y-5">

          {/* Period Filter Strip */}
          <div className="flex flex-wrap items-center gap-3 fade-up">
            <div className="flex items-center gap-2 bg-white/80 backdrop-blur-md
              px-4 py-2.5 rounded-xl border border-slate-200/60 shadow-sm text-sm">
              <FiCalendar className="w-4 h-4 text-blue-500"/>
              <span className="font-bold text-slate-600">Period:</span>
              <select value={period} onChange={e=>setPeriod(e.target.value)}
                className="bg-transparent text-slate-700 font-bold text-sm outline-none cursor-pointer pl-1">
                {periodOptions.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            {period === "custom" && (
              <>
                <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)}
                  className="px-3 py-2.5 rounded-xl border border-slate-200/60 bg-white/80 text-sm font-bold text-slate-700 outline-none shadow-sm" />
                <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)}
                  className="px-3 py-2.5 rounded-xl border border-slate-200/60 bg-white/80 text-sm font-bold text-slate-700 outline-none shadow-sm" />
              </>
            )}
            <button onClick={applyCurrentFilter} className="flex items-center gap-2 px-4 py-2.5 rounded-xl
              bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold
              shadow-md shadow-blue-200 hover:shadow-lg transition-all">
              <FiFilter className="w-3.5 h-3.5"/> Apply Filter
            </button>
            <div className="ml-auto text-xs text-slate-400 font-medium hidden sm:block">
              Last updated: just now
            </div>
          </div>

          {/* ── Row 1: 4 Hero Cards ── */}
          {/* `trend` is deliberately NOT passed. These carried trend={12} / {0} / {28} / {15} —
              four literals that never moved when the period changed, rendered as green ▲ pills
              beside a "Live Data" badge and a genuinely live value. Nothing distinguished the
              invented number from the real one.
              /dashboard/analytics returns a single period with no previous/growth/delta field, so
              there is nothing to point these at yet. HeroCard already skips the pill when `trend`
              is null, so re-adding it later is one prop per card — once the backend supplies the
              comparison and someone has defined what the period is measured against. */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <HeroCard icon={<FaUsers/>}      label="Total Leads"     value={D.totalLeads}     sub={`${selectedPeriodLabel} overview`}      from="from-blue-600"   to="to-indigo-700"  delay={0}/>
            <HeroCard icon={<FaCheckCircle/>} label="Converted Leads" value={D.convertedLeads} sub={`${D.conversionRate}% rate`} from="from-green-500" to="to-emerald-700" delay={60}/>
            <HeroCard icon={<FaRupeeSign/>}  label="Agency Revenue"  value={D.revenue}        sub="Total bookings value" from="from-teal-500"   to="to-cyan-700"    delay={120} isINR/>
            <HeroCard icon={<FaChartLine/>}  label="Net Profit"      value={D.profit}         sub={`${D.netMargin}% margin`}  from="from-amber-500" to="to-orange-700"  delay={180} isINR/>
          </div>

          {/* ── Row 2: 4 Mini Metric Cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MiniCard icon={<FiRefreshCw/>}  label="Refunds"         value={fmtINR(D.refunds)}         bg="bg-gradient-to-br from-red-500 to-rose-600"       delay={0}  />
            <MiniCard icon={<FiTarget/>}     label="Win Rate"        value={`${D.winRate}%`}           bg="bg-gradient-to-br from-slate-600 to-slate-800"    delay={50} />
            <MiniCard icon={<FaFire/>}       label="Hot Leads"       value={D.hotLeads} sub="Potential conversions" bg="bg-gradient-to-br from-orange-500 to-amber-600"  delay={100}/>
            <MiniCard icon={<FiTrendingUp/>} label="Conversion Rate" value={`${D.conversionRate}%`}   bg="bg-gradient-to-br from-green-500 to-teal-600"     delay={150}/>
          </div>

          {/* ── Row 3: Revenue Trend Chart + Lead Sources Donut ── */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">

            {/* Revenue Area Chart */}
            <SectionCard headerBg="bg-gradient-to-r from-blue-600 to-indigo-600"
              headerIcon={<FiTrendingUp className="w-4 h-4"/>}
              title="Revenue & Bookings Trend"
              action={<span className="text-white/60 text-xs">2026</span>}
              delay={0}>
              <div className="p-5">
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={D.revenueTimeline} margin={{top:5,right:5,left:-15,bottom:0}}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                    <XAxis dataKey="month" tick={{fontSize:11,fontWeight:700,fill:"#64748b"}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:10,fill:"#94a3b8"}} axisLine={false} tickLine={false}
                      tickFormatter={v=>v>=1000?`₹${v/1000}k`:`₹${v}`}/>
                    <Tooltip content={<ChartTip/>}/>
                    <Area type="monotone" dataKey="revenue" name="revenue"
                      stroke="#3b82f6" strokeWidth={2.5} fill="url(#revGrad)"/>
                    <Bar dataKey="bookings" name="bookings" fill="#10b981" radius={[4,4,0,0]} barSize={16}/>
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-5 mt-2 text-xs font-bold text-slate-500">
                  <div className="flex items-center gap-1.5"><div className="w-4 h-1.5 rounded bg-blue-500"/><span>Revenue (₹)</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-4 h-1.5 rounded bg-emerald-500"/><span>Bookings</span></div>
                </div>
              </div>
            </SectionCard>

            {/* Lead Sources Donut */}
            <SectionCard headerBg="bg-blue-600"
              headerIcon={<FiActivity className="w-4 h-4"/>}
              title="Lead Sources"
              delay={80}>
              <div className="p-5 flex flex-col items-center gap-4">
                <ResponsiveContainer width={190} height={190}>
                  <PieChart>
                    <Pie data={D.leadSources} cx="50%" cy="50%"
                      innerRadius={52} outerRadius={88}
                      labelLine={false} label={DonutLabel} dataKey="value" paddingAngle={3}>
                      {D.leadSources.map((e,i)=><Cell key={i} fill={e.color}/>)}
                    </Pie>
                    <Tooltip formatter={(v,n)=>[v,n]}/>
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full space-y-2.5">
                  {D.leadSources.map(s=>(
                    <div key={s.name} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{background:s.color}}/>
                      <span className="text-sm font-medium text-slate-700 flex-1">{s.name}</span>
                      <span className="text-sm font-extrabold text-slate-800">{s.value}</span>
                      <span className="text-xs text-slate-400 w-10 text-right">
                        {Math.round(s.value/D.totalLeads*100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>
          </div>

          {/* ── Row 4: Destination Bar + Top Performers 2 cols ── */}
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5">

            {/* Destination Bar Chart */}
            <SectionCard headerBg="bg-teal-500"
              headerIcon={<FiMapPin className="w-4 h-4"/>}
              title="Top 5 Destination Inquiries"
              delay={0}>
              <div className="p-5">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={D.topDestinations} margin={{top:5,right:5,left:-20,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f9ff"/>
                    <XAxis dataKey="name" tick={{fontSize:11,fontWeight:700,fill:"#64748b"}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:10,fill:"#94a3b8"}} axisLine={false} tickLine={false}/>
                    <Tooltip content={<ChartTip/>}/>
                    <Bar dataKey="bookings" name="bookings" fill="#14b8a6" radius={[6,6,0,0]}>
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            {/* Performers tables side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

              {/* Conversion Rate */}
              <SectionCard headerBg="bg-gradient-to-r from-green-500 to-emerald-600"
                headerIcon={<FaTrophy className="w-4 h-4"/>}
                title="Top: Conversion"
                delay={60}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[260px]">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>{["#","Name","Rate"].map(h=>(
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {D.topPerformersConv.map(p=>(
                        <tr key={p.rank} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-4 py-3 text-sm">{p.tier?TIER[p.tier]:p.rank}</td>
                          <td className="px-4 py-3">
                            <p className="text-xs font-bold text-slate-800 capitalize leading-tight">{p.name}</p>
                            <p className="text-[10px] text-slate-400">{p.leads}L · {p.conversions}C</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-10 h-1.5 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                                <div className="h-1.5 bg-green-500 rounded-full" style={{width:`${p.rate}%`}}/>
                              </div>
                              <span className="text-xs font-extrabold text-green-700 whitespace-nowrap">{p.rate}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>

              {/* Profit Earned */}
              <SectionCard headerBg="bg-gradient-to-r from-amber-500 to-orange-500"
                headerIcon={<FaRupeeSign className="w-4 h-4"/>}
                title="Top: Profits"
                delay={120}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[260px]">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>{["#","Name","Profit"].map(h=>(
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {D.topPerformersProfit.map(p=>(
                        <tr key={p.rank} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-4 py-3 text-sm">{p.tier?TIER[p.tier]:p.rank}</td>
                          <td className="px-4 py-3">
                            <p className="text-xs font-bold text-slate-800 capitalize leading-tight">{p.name}</p>
                            <p className="text-[10px] text-slate-400">{fmtINR(p.revenue)} rev</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className={`text-sm font-extrabold ${p.profit>0?"text-green-600":"text-slate-300"}`}>
                              {fmtINR(p.profit)}
                            </p>
                            {p.margin>0&&<p className="text-[10px] text-slate-400">{p.margin}%</p>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>
          </div>

          {/* ── Row 5: Priority Follow-ups | Near Travel | Upcoming Trips ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            {/* Priority Follow-ups */}
            <SectionCard headerBg="bg-gradient-to-r from-red-500 to-rose-600"
              headerIcon={<FiBell className="w-4 h-4"/>}
              title="Priority Follow-ups"
              badge={D.priorityFollowups.length}
              delay={0}>
              <div className="p-4 space-y-3">
                {D.priorityFollowups.map((f,i)=>(
                  <div key={i} className="p-3.5 bg-red-50 border border-red-200 rounded-xl space-y-2 hover:bg-red-100/60 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-extrabold text-slate-800">{f.name}</span>
                      <span className="text-[10px] font-extrabold bg-red-600 text-white px-2 py-0.5 rounded-full">{f.urgency}</span>
                    </div>
                    <p className="text-xs text-slate-500 flex items-center gap-1.5"><FiPhone className="w-3 h-3"/>{f.phone}</p>
                    <p className="text-xs text-slate-700 font-medium">{f.note}</p>
                    <p className="text-[11px] font-bold text-red-600 flex items-center gap-1"><FiClock className="w-3 h-3"/> Due: {f.dueDate}</p>
                  </div>
                ))}
                <button onClick={()=>navigate("/Reminders")}
                  className="w-full py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50
                    text-xs font-bold transition-all flex items-center justify-center gap-2">
                  <FiBell className="w-3.5 h-3.5"/> View All Reminders
                </button>
              </div>
            </SectionCard>

            {/* Near Travel Dates */}
            <SectionCard headerBg="bg-gradient-to-r from-amber-500 to-orange-500"
              headerIcon={<FiCalendar className="w-4 h-4"/>}
              title="Near Travel Dates (10 Days)"
              badge={D.nearTravelDates.length}
              delay={60}>
              <div className="p-4 space-y-3">
                {D.nearTravelDates.map((l,i)=>(
                  <div key={i} className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5 hover:bg-amber-100/60 transition-colors cursor-pointer"
                    onClick={()=>navigate("/allleads")}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-extrabold text-slate-800">{l.name}</span>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full
                        ${l.daysLeft===0?"bg-red-100 text-red-700":l.daysLeft<=2?"bg-amber-100 text-amber-700":"bg-blue-100 text-blue-700"}`}>
                        {l.daysLeft===0?"Today":`${l.daysLeft}d`}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1"><FiPhone className="w-3 h-3"/>{l.phone}</p>
                    <p className="text-[11px] text-slate-600 flex items-center gap-1"><FaRegCalendarAlt className="w-3 h-3 text-amber-500"/> {l.travelDate}</p>
                    <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">{l.stage}</span>
                  </div>
                ))}
                <button onClick={()=>navigate("/allleads")}
                  className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold
                    transition-all flex items-center justify-center gap-2">
                  View All Leads <FiChevronRight className="w-3.5 h-3.5"/>
                </button>
              </div>
            </SectionCard>

            {/* Upcoming Trips */}
            <SectionCard headerBg="bg-gradient-to-r from-green-500 to-emerald-600"
              headerIcon={<FaPlane className="w-4 h-4"/>}
              title="Upcoming Trips (25 Days)"
              badge={0}
              delay={120}>
              <div className="p-8 flex flex-col items-center justify-center min-h-[200px] text-slate-400">
                <FaPlane className="text-5xl mb-3 text-slate-200"/>
                <p className="text-sm font-bold text-slate-500">No upcoming trips</p>
                <p className="text-xs mt-1 text-slate-400">No bookings in the next 25 days</p>
                <button onClick={()=>navigate("/Allbookings")}
                  className="mt-4 px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-500
                    hover:border-green-300 hover:text-green-600 hover:bg-green-50 transition-all">
                  View All Bookings
                </button>
              </div>
            </SectionCard>
          </div>

          {/* ── Row 6: 4 Status Cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {label:"Pending Completion (25d)", count:0, icon:<FiCheck/>,       bg:"bg-gradient-to-r from-blue-600 to-blue-700",    msg:"All completed"       },
              {label:"Client Payments (25d)",    count:0, icon:<FiCreditCard/>,  bg:"bg-gradient-to-r from-amber-500 to-orange-500", msg:"All payments received"},
              {label:"Vendor Payments (25d)",    count:0, icon:<FiDollarSign/>,  bg:"bg-gradient-to-r from-red-500 to-rose-500",     msg:"All payments made"   },
              {label:"Get Reviews (15d)",        count:0, icon:<FiStar/>,        bg:"bg-gradient-to-r from-green-500 to-emerald-600",msg:"No recent completions"},
            ].map(c=>(
              <div key={c.label} className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden fade-up">
                <div className={`${c.bg} px-4 py-3 flex items-center gap-2`}>
                  <span className="text-white/60">{c.icon}</span>
                  <span className="text-white text-xs font-extrabold flex-1 leading-tight">{c.label}</span>
                  <span className="bg-white/25 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">{c.count}</span>
                </div>
                <div className="p-5 flex flex-col items-center min-h-[90px] justify-center gap-1.5 text-slate-400">
                  <FiCheck className="text-3xl text-slate-200"/>
                  <p className="text-xs font-medium">{c.msg}</p>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════
          OPERATIONS TAB
      ══════════════════════════════════════════════════ */}
      {tab==="operations" && opsLoading && <OperationsSkeleton/>}
      {tab==="operations" && !opsLoading && (
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5 space-y-5">

          {/* Welcome banner */}
          <div className="bg-gradient-to-r from-teal-500 to-cyan-500 rounded-2xl px-6 py-4 text-white
            flex items-start gap-4 shadow-lg fade-up">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 text-xl">ℹ️</div>
            <div>
              <p className="font-extrabold">Welcome to Operations Dashboard!</p>
              <p className="text-sm text-white/80 mt-0.5">
                Welcome back, <strong>{userName}!</strong> Manage your company settings, users, and access operational features.
              </p>
            </div>
          </div>

          {/* 4 Ops stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <OpsCard label="Total Users"  mainValue={O.totalUsers}         sub="System users"          icon={<FaUsers/>}          gradient="bg-gradient-to-br from-teal-500 to-cyan-700"    delay={0}  />
            <OpsCard label="Active Users" mainValue={O.activeUsers}        sub={`${O.totalUsers>0?Math.round(O.activeUsers/O.totalUsers*100):0}% of total users`}   icon={<FiUsers/>}          gradient="bg-gradient-to-br from-green-500 to-emerald-700" delay={60} />
            <OpsCard label="Subscription" mainValue={O.subEndDate}         sub="Expires on"            icon={<FiCalendar/>}       gradient="bg-gradient-to-br from-amber-500 to-orange-700"  delay={120}/>
            <OpsCard label="User Limit"   mainValue={O.userLimit.max}      sub={`${O.userLimit.used}/${O.userLimit.max} used`}   icon={<FiUsers/>} gradient="bg-gradient-to-br from-red-500 to-rose-700" delay={180}/>
          </div>

          {/* Subscription + Company info */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Subscription Information */}
            <SectionCard headerBg="bg-blue-600"
              headerIcon={<FaGem className="w-4 h-4"/>}
              title="Subscription Information"
              badge={<span className="bg-green-400 text-green-900 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">Active</span>}
              delay={0}>
              <div className="p-6 space-y-5">
                {/* Plan name + status */}
                <div className="flex flex-col items-center text-center gap-3 py-2">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100
                    flex items-center justify-center">
                    <FaGem className="text-3xl text-blue-600"/>
                  </div>
                  <div>
                    <p className="text-base font-extrabold text-blue-700 leading-tight">{O.plan.name}</p>
                    <span className="mt-1 inline-flex items-center gap-1.5 bg-green-100 text-green-700
                      text-xs font-extrabold px-3 py-1 rounded-full border border-green-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 live-dot inline-block"/> {O.plan.status}
                    </span>
                  </div>
                </div>
                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 bg-teal-50 border border-teal-200 rounded-2xl">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 rounded-lg bg-teal-500 flex items-center justify-center"><FiCalendar className="w-3 h-3 text-white"/></div>
                      <p className="text-[10px] font-extrabold text-teal-700 uppercase tracking-wide">Start Date</p>
                    </div>
                    <p className="text-sm font-extrabold text-slate-800">{O.plan.startDate}</p>
                  </div>
                  <div className={`p-3.5 rounded-2xl border ${O.plan.daysLeft<=5?"bg-red-50 border-red-200":"bg-amber-50 border-amber-200"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${O.plan.daysLeft<=5?"bg-red-500":"bg-amber-500"}`}>
                        <FiCalendar className="w-3 h-3 text-white"/>
                      </div>
                      <p className={`text-[10px] font-extrabold uppercase tracking-wide ${O.plan.daysLeft<=5?"text-red-700":"text-amber-700"}`}>End Date</p>
                    </div>
                    <p className="text-sm font-extrabold text-slate-800">{O.plan.endDate}</p>
                    {O.plan.daysLeft<=5&&<p className="text-[10px] text-red-600 font-extrabold mt-0.5">⚠ {O.plan.daysLeft} days left!</p>}
                  </div>
                </div>
                {/* Days remaining bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-slate-600">
                    <span>Subscription Period</span>
                    <span className={O.plan.daysLeft<=5?"text-red-600":"text-green-600"}>{O.plan.daysLeft} days left</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-2 rounded-full transition-all duration-1000
                      ${O.plan.daysLeft<=5?"bg-gradient-to-r from-red-500 to-rose-500":"bg-gradient-to-r from-blue-500 to-indigo-500"}`}
                      style={{width:`${Math.max(2,(O.plan.daysLeft/30)*100)}%`}}/>
                  </div>
                </div>
                <button onClick={()=>navigate("/SubscriptionInfo")}
                  className="w-full py-2.5 rounded-xl border-2 border-blue-200 text-blue-700
                    hover:bg-blue-50 text-sm font-bold transition-all flex items-center justify-center gap-2">
                  View Full Plan Details <FiChevronRight className="w-4 h-4"/>
                </button>
              </div>
            </SectionCard>

            {/* Company Information */}
            <SectionCard headerBg="bg-gradient-to-r from-green-600 to-emerald-600"
              headerIcon={<FaBuilding className="w-4 h-4"/>}
              title="Company Information"
              action={
                <button onClick={()=>navigate("/CompanyProfile")}
                  className="flex items-center gap-1.5 text-white/80 hover:text-white text-xs font-bold transition-colors">
                  <FiEdit2 className="w-3.5 h-3.5"/> Edit
                </button>
              }
              delay={80}>
              <div className="p-6 space-y-4">
                {/* Logo + name */}
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-100 to-teal-100
                    flex items-center justify-center text-xl font-extrabold text-green-700 flex-shrink-0">
                    {initials(O.company.name)}
                  </div>
                  <div>
                    <p className="text-base font-extrabold text-green-700">{O.company.name}</p>
                    <span className="text-[10px] font-extrabold text-green-700 bg-green-100 px-2 py-0.5 rounded-full border border-green-200">
                      ● {O.company.status}
                    </span>
                  </div>
                </div>
                {/* Details */}
                <div className="space-y-2">
                  {[
                    {icon:<FiMailIcon className="w-3.5 h-3.5 text-blue-500"/>,  label:"Email",   val:O.company.email  },
                    {icon:<FiPhone    className="w-3.5 h-3.5 text-green-500"/>, label:"Phone",   val:O.company.phone  },
                    {icon:<FiMapPin   className="w-3.5 h-3.5 text-red-500"/>,   label:"Address", val:O.company.address},
                  ].map(f=>(
                    <div key={f.label} className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <div className="flex-shrink-0 mt-0.5">{f.icon}</div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide">{f.label}</p>
                        <p className="text-xs font-semibold text-slate-700 mt-0.5 break-words">{f.val}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={()=>navigate("/CompanySettings")}
                  className="w-full py-2.5 rounded-xl border-2 border-slate-200 hover:border-green-300
                    text-slate-600 hover:text-green-700 hover:bg-green-50 text-sm font-bold transition-all
                    flex items-center justify-center gap-2">
                  <FiSettings className="w-4 h-4"/> Go to Settings
                </button>
              </div>
            </SectionCard>
          </div>

          {/* Recent Users + Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Recent Users */}
            <SectionCard headerBg="bg-teal-500"
              headerIcon={<FaUsers className="w-4 h-4"/>}
              title="Recent Users"
              action={
                <button onClick={()=>navigate("/CreateUser")}
                  className="flex items-center gap-1.5 text-white/80 hover:text-white text-xs font-bold transition-colors">
                  <FiPlus className="w-3.5 h-3.5"/> Add User
                </button>
              }
              delay={0}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[380px]">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>{["Username","Full Name","Role","Status","Created"].map(h=>(
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {O.recentUsers.map(u=>(
                      <tr key={u.username} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 text-xs font-extrabold text-blue-600">{u.username}</td>
                        <td className="px-4 py-3 text-xs font-medium text-slate-700">{u.fullName}</td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-extrabold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md">{u.role}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-extrabold bg-green-100 text-green-700 px-2 py-0.5 rounded-md">{u.status}</span>
                        </td>
                        <td className="px-4 py-3 text-[10px] text-slate-400">{u.created}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t border-slate-100">
                <button onClick={()=>navigate("/Users")}
                  className="w-full py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600
                    hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all
                    flex items-center justify-center gap-2">
                  <FiUsers className="w-3.5 h-3.5"/> View All Users
                </button>
              </div>
            </SectionCard>

            {/* Recent Activity */}
            <SectionCard headerBg="bg-slate-700"
              headerIcon={<FiActivity className="w-4 h-4"/>}
              title="Recent Activity"
              delay={80}>
              <div className="p-4 space-y-3 max-h-72 overflow-y-auto">
                {O.recentActivity.map((a,i)=>(
                  <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 hover:bg-white
                    border border-transparent hover:border-slate-200 rounded-xl transition-all cursor-pointer">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-800
                      flex items-center justify-center text-white text-xs font-extrabold flex-shrink-0">
                      {a.user.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-extrabold text-slate-800">{a.user}</span>
                        <span className="text-[10px] font-extrabold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{a.role}</span>
                        <span className="text-[10px] text-slate-400 ml-auto whitespace-nowrap">{a.time}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{a.action}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-slate-100">
                <button onClick={()=>navigate("/ActivityReports")}
                  className="w-full py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600
                    hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all
                    flex items-center justify-center gap-2">
                  <FiActivity className="w-3.5 h-3.5"/> View All Activity
                </button>
              </div>
            </SectionCard>

          </div>
        </div>
      )}
    </div>
  );
}

/* ─── inline icon shims ────────────────────────────────────── */
function FiMailIcon({className}){
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
  </svg>;
}
function FiBell({className}){
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
  </svg>;
}
function FiClock({className}){
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>;
}
function FiStar({className}){
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
  </svg>;
}






// new 

// import { useState, useEffect, useRef, useCallback } from "react";
// import { leadService } from "@features/leads";
// import { bookingService } from "@features/bookings";
// import { profileUserService as userService } from "@features/profile";
// import { companyService } from "@features/settings";
// import { activityReportsService } from "@features/reports";
// import { useNavigate } from "react-router-dom";
// import { Users as FiUsers, TrendingUp as FiTrendingUp, RefreshCw as FiRefreshCw, Target as FiTarget, Filter as FiFilter, ChevronRight as FiChevronRight, MapPin as FiMapPin, Phone as FiPhone, Calendar as FiCalendar, Check as FiCheck, CreditCard as FiCreditCard, Activity as FiActivity, Settings as FiSettings, ChartColumn as FiBarChart2, Pen as FiEdit2, Plus as FiPlus, DollarSign as FiDollarSign, ArrowUp as FiArrowUp, ArrowDown as FiArrowDown, LayoutGrid as FiGrid, Flame as FaFire, Users as FaUsers, Trophy as FaTrophy, IndianRupee as FaRupeeSign, CircleCheck as FaCheckCircle, Calendar as FaRegCalendarAlt, Plane as FaPlane, Building2 as FaBuilding, ChartLine as FaChartLine, Gem as FaGem, LayoutDashboard as MdOutlineDashboard } from "lucide-react";

// import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area } from "recharts";

// /* ─── DEFAULT EMPTY STATE ───────────────────────────────────── */
// const EMPTY_D = {
//   totalLeads:0, convertedLeads:0, conversionRate:0, revenue:0,
//   profit:0, netMargin:0, refunds:0, winRate:0, hotLeads:0,
//   leadSources:[], topDestinations:[], revenueTimeline:[],
//   topPerformersConv:[], topPerformersProfit:[],
//   priorityFollowups:[], nearTravelDates:[],
// };

// const EMPTY_O = {
//   totalUsers:0, activeUsers:0,
//   subEndDate:"—",
//   userLimit:{ max:0, used:0 },
//   plan:{ name:"—", status:"—", daysLeft:0, startDate:"—", endDate:"—" },
//   company:{ name:"—", email:"—", phone:"—", address:"—", status:"—" },
//   recentUsers:[], recentActivity:[],
// };

// const PERIODS = ["Today","Weekly","Monthly","Yearly"];
// const TIER = { gold:"🥇", silver:"🥈", bronze:"🥉" };
// const fmtINR = n => `₹${Number(n).toLocaleString("en-IN")}`;

// /* ─── ANIMATED COUNTER ───────────────────────────────────────── */
// function Counter({ to, prefix="", suffix="", decimals=0, duration=1200 }) {
//   const [val, setVal] = useState(0);
//   const raf = useRef(null);
//   useEffect(() => {
//     const start = performance.now();
//     const step = (ts) => {
//       const p = Math.min((ts - start) / duration, 1);
//       const ease = 1 - Math.pow(1 - p, 3);
//       const cur = ease * to;
//       setVal(decimals > 0 ? parseFloat(cur.toFixed(decimals)) : Math.round(cur));
//       if (p < 1) raf.current = requestAnimationFrame(step);
//     };
//     raf.current = requestAnimationFrame(step);
//     return () => cancelAnimationFrame(raf.current);
//   }, [to, duration, decimals]);
//   return <>{prefix}{decimals > 0 ? val.toFixed(decimals) : val.toLocaleString("en-IN")}{suffix}</>;
// }

// /* ─── HERO STAT CARD ─────────────────────────────────────────── */
// function HeroCard({ icon, label, value, sub, from, to, delay=0, isINR, decimals=0, suffix="", trend }) {
//   return (
//     <div className={`bg-gradient-to-br ${from} ${to} rounded-2xl p-4 sm:p-5 text-white relative overflow-hidden
//       group hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 shadow-lg ring-1 ring-white/10`}
//       style={{animation:`fadeUp .5s ease both`,animationDelay:`${delay}ms`}}>
//       {/* Glossy top highlight */}
//       <div className="absolute inset-x-0 -top-1/2 h-full bg-gradient-to-b from-white/25 to-transparent opacity-60 pointer-events-none"/>
//       {/* BG circles */}
//       <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10 group-hover:scale-110 transition-transform duration-500"/>
//       <div className="absolute -right-2 -bottom-8 w-20 h-20 rounded-full bg-white/10"/>
//       <div className="relative z-10 space-y-2">
//         <div className="flex items-center justify-between gap-2">
//           <p className="text-[10px] sm:text-xs font-extrabold uppercase tracking-widest opacity-80 truncate">{label}</p>
//           <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-base sm:text-lg flex-shrink-0 shadow-inner group-hover:scale-110 transition-transform">{icon}</div>
//         </div>
//         <p className="text-2xl sm:text-3xl font-extrabold leading-none tracking-tight">
//           {isINR
//             ? <><span className="text-lg sm:text-xl">₹</span><Counter to={value}/></>
//             : <Counter to={value} suffix={suffix} decimals={decimals}/>}
//         </p>
//         <div className="flex items-center justify-between gap-2 flex-wrap">
//           {sub && <p className="text-[11px] sm:text-xs opacity-70">{sub}</p>}
//           {trend != null && (
//             <div className={`flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-full ml-auto
//               ${trend >= 0 ? "bg-white/20 text-white" : "bg-red-300/30 text-red-100"}`}>
//               {trend >= 0 ? <FiArrowUp className="w-3 h-3"/> : <FiArrowDown className="w-3 h-3"/>}
//               {Math.abs(trend)}%
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }

// /* ─── MINI METRIC CARD ───────────────────────────────────────── */
// function MiniCard({ icon, label, value, sub, bg, delay=0 }) {
//   return (
//     <div className={`${bg} rounded-2xl px-4 sm:px-5 py-4 text-white flex items-center gap-3 sm:gap-4 relative overflow-hidden
//       shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 ring-1 ring-white/10`}
//       style={{animation:`fadeUp .5s ease both`,animationDelay:`${delay}ms`}}>
//       <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white/15 flex items-center justify-center text-lg sm:text-xl flex-shrink-0">{icon}</div>
//       <div className="min-w-0">
//         <p className="text-[10px] font-extrabold uppercase tracking-widest opacity-70 truncate">{label}</p>
//         <p className="text-lg sm:text-xl font-extrabold leading-tight mt-0.5">{value}</p>
//         {sub && <p className="text-[11px] opacity-60 mt-0.5 truncate">{sub}</p>}
//       </div>
//     </div>
//   );
// }

// /* ─── SECTION CARD WRAPPER ───────────────────────────────────── */
// function SectionCard({ headerBg, headerIcon, title, badge, action, children, delay=0 }) {
//   return (
//     <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden fade-up"
//       style={{animationDelay:`${delay}ms`}}>
//       {/* Header */}
//       <div className={`${headerBg} px-5 py-3.5 flex items-center justify-between`}>
//         <div className="flex items-center gap-2.5 text-white">
//           <span className="opacity-80">{headerIcon}</span>
//           <span className="text-sm font-extrabold tracking-tight">{title}</span>
//           {badge != null && (
//             <span className="bg-white/25 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full min-w-[18px] text-center">
//               {badge}
//             </span>
//           )}
//         </div>
//         {action}
//       </div>
//       {children}
//     </div>
//   );
// }

// /* ─── OPS STAT CARD ──────────────────────────────────────────── */
// function OpsCard({ label, mainValue, sub, icon, gradient, delay=0 }) {
//   return (
//     <div className={`${gradient} rounded-2xl p-4 sm:p-5 text-white relative overflow-hidden group
//       hover:-translate-y-1 hover:shadow-xl transition-all duration-300 shadow-lg ring-1 ring-white/10`}
//       style={{animation:`fadeUp .5s ease both`,animationDelay:`${delay}ms`}}>
//       <div className="absolute inset-x-0 -top-1/2 h-full bg-gradient-to-b from-white/20 to-transparent opacity-60 pointer-events-none"/>
//       <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/10 group-hover:scale-110 transition-transform"/>
//       <div className="relative z-10">
//         <div className="flex items-center justify-between gap-2 mb-2">
//           <p className="text-[10px] font-extrabold uppercase tracking-widest opacity-70 truncate">{label}</p>
//           <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center text-base flex-shrink-0">{icon}</div>
//         </div>
//         <p className="text-2xl sm:text-3xl font-extrabold leading-none break-words">{mainValue}</p>
//         {sub && <p className="text-[11px] sm:text-xs opacity-70 mt-2 border-t border-white/20 pt-2 truncate">{sub}</p>}
//       </div>
//     </div>
//   );
// }

// /* ─── DONUT LABEL ────────────────────────────────────────────── */
// /* Uses the pre-computed `pct` from each lead-source entry so the slice label matches the legend
//    exactly (same denominator = total leads). Recharts may expose it at top level or under
//    `payload`, so we read both. Tiny slices (<6%) stay unlabelled to avoid clutter. */
// const DonutLabel = (props) => {
//   const { cx, cy, midAngle, innerRadius, outerRadius } = props;
//   const pct = props.pct ?? props.payload?.pct ?? 0;
//   if (pct < 6) return null;
//   const R = Math.PI / 180;
//   const r = innerRadius + (outerRadius - innerRadius) * 0.5;
//   return (
//     <text x={cx + r * Math.cos(-midAngle * R)} y={cy + r * Math.sin(-midAngle * R)}
//       fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={800}>
//       {`${pct}%`}
//     </text>
//   );
// };

// /* ─── CUSTOM TOOLTIP ─────────────────────────────────────────── */
// const ChartTip = ({ active, payload, label }) => {
//   if (!active || !payload?.length) return null;
//   return (
//     <div className="bg-white border border-slate-200 rounded-xl shadow-xl px-4 py-3 text-xs">
//       <p className="font-extrabold text-slate-700 mb-1.5">{label}</p>
//       {payload.map(p => (
//         <p key={p.name} style={{color:p.color}} className="font-bold">
//           {p.name}: {p.name === "revenue" ? fmtINR(p.value) : p.value}
//         </p>
//       ))}
//     </div>
//   );
// };

// /* ─── LOADING SKELETONS ──────────────────────────────────────── */
// function SkelBox({ className = "" }) {
//   return <div className={`relative overflow-hidden bg-slate-200/70 rounded-2xl ${className}`}>
//     <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
//   </div>;
// }

// function AnalyticsSkeleton() {
//   return (
//     <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5 space-y-5">
//       <div className="flex flex-wrap gap-3">
//         <SkelBox className="h-11 w-44" />
//         <SkelBox className="h-11 w-32" />
//       </div>
//       <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
//         {[...Array(4)].map((_, i) => <SkelBox key={i} className="h-32" />)}
//       </div>
//       <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
//         {[...Array(4)].map((_, i) => <SkelBox key={i} className="h-20" />)}
//       </div>
//       <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">
//         <SkelBox className="h-72" />
//         <SkelBox className="h-72" />
//       </div>
//       <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5">
//         <SkelBox className="h-64" />
//         <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
//           <SkelBox className="h-64" />
//           <SkelBox className="h-64" />
//         </div>
//       </div>
//       <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
//         {[...Array(3)].map((_, i) => <SkelBox key={i} className="h-64" />)}
//       </div>
//     </div>
//   );
// }

// function OperationsSkeleton() {
//   return (
//     <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5 space-y-5">
//       <SkelBox className="h-20" />
//       <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
//         {[...Array(4)].map((_, i) => <SkelBox key={i} className="h-32" />)}
//       </div>
//       <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
//         <SkelBox className="h-80" />
//         <SkelBox className="h-80" />
//       </div>
//       <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
//         <SkelBox className="h-72" />
//         <SkelBox className="h-72" />
//       </div>
//     </div>
//   );
// }

// /* ═════════════════════════════════════════════════════════════
//    MAIN DASHBOARD COMPONENT
// ═════════════════════════════════════════════════════════════ */
// /* ─── DATA BUILDER HELPERS ──────────────────────────────────── */
// function buildAnalytics(leads, bookings) {
//   const total     = leads.length;
//   const converted = leads.filter(l => l.leadStage === "Converted" || l.leadStage === "Ready to Book").length;
//   const hotLeads  = leads.filter(l => l.leadType === "Hot").length;
//   const rate      = total > 0 ? +((converted / total) * 100).toFixed(2) : 0;

//   // Revenue / profit from bookings
//   const revenue = bookings.reduce((s, b) => s + (Number(b.customerAmount) || 0), 0);
//   const profit  = bookings.reduce((s, b) => s + (Number(b.netProfit)      || 0), 0);
//   const refunds = bookings.filter(b => b.status === "Refunded")
//                           .reduce((s, b) => s + (Number(b.totalPayable) || 0), 0);
//   const netMargin = revenue > 0 ? +((profit / revenue) * 100).toFixed(1) : 0;
//   const wins      = bookings.filter(b => b.status === "Confirmed" || b.status === "Completed").length;
//   const winRate   = bookings.length > 0 ? +((wins / bookings.length) * 100).toFixed(2) : 0;

//   // ── Lead sources ─────────────────────────────────────────────
//   // Every lead has a source ("Other" when null), so all counts sum to `total`. We keep the 6
//   // biggest sources by name and fold everything else into a single "Other" slice. Then each
//   // entry carries a pre-computed `pct = value / total` — the ONE denominator shared by the
//   // donut arc, its slice labels (DonutLabel) and the legend below, so all three add up to 100%.
//   const srcMap = {};
//   leads.forEach(l => { const s = l.leadSource || "Other"; srcMap[s] = (srcMap[s] || 0) + 1; });
//   const SRC_COLORS = ["#f472b6","#60a5fa","#fbbf24","#34d399","#a78bfa","#fb923c","#94a3b8"];

//   const srcSorted = Object.entries(srcMap).sort((a, b) => b[1] - a[1]);
//   const srcTop    = srcSorted.slice(0, 6).map(([n, v]) => [n, v]); // shallow-clone the pairs
//   const srcRest   = srcSorted.slice(6).reduce((sum, [, v]) => sum + v, 0);
//   if (srcRest > 0) {
//     // Merge the tail into "Other" — reusing an existing "Other" bucket so it never appears twice.
//     const existing = srcTop.find(e => e[0] === "Other");
//     if (existing) existing[1] += srcRest;
//     else srcTop.push(["Other", srcRest]);
//   }
//   const leadSources = srcTop.map(([name, value], i) => ({
//     name, value,
//     color: SRC_COLORS[i] || "#94a3b8",
//     pct: total > 0 ? Math.round((value / total) * 100) : 0,
//   }));

//   // Top destinations from bookings
//   const destMap = {};
//   bookings.forEach(b => {
//     const d = b.destinationSnapshot || b.destination || "Other";
//     if (!destMap[d]) destMap[d] = { bookings:0, revenue:0 };
//     destMap[d].bookings++;
//     destMap[d].revenue += Number(b.customerAmount) || 0;
//   });

//   const topDestinations = Object.entries(destMap)
//     .sort((a,b) => b[1].bookings - a[1].bookings).slice(0,5)
//     .map(([name,v]) => ({ name, ...v }));

//   // Revenue timeline (last 6 months)
//   const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
//   const timeMap = {};
//   bookings.forEach(b => {
//     const d = new Date(b.bookingDate || b.createdAt || Date.now());
//     const k = MONTHS[d.getMonth()];
//     if (!timeMap[k]) timeMap[k] = { month:k, revenue:0, bookings:0 };
//     timeMap[k].revenue  += Number(b.customerAmount) || 0;
//     timeMap[k].bookings += 1;
//   });
//   const now = new Date();
//   const revenueTimeline = Array.from({length:6}, (_,i) => {
//     const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
//     const k = MONTHS[d.getMonth()];
//     return timeMap[k] || { month:k, revenue:0, bookings:0 };
//   });

//   // Top performers by conversions
//   const perfMap = {};
//   leads.forEach(l => {
//     const u = l.assignedUser?.fullName || l.assignedUser?.name || l.assignTo || "Unassigned";
//     if (!perfMap[u]) perfMap[u] = { name:u, leads:0, conversions:0, revenue:0, profit:0 };
//     perfMap[u].leads++;
//     if (l.leadStage === "Converted") perfMap[u].conversions++;
//   });
//   bookings.forEach(b => {
//     const u = b.assignedUser?.fullName || b.assignedUser?.name || "Unassigned";
//     if (!perfMap[u]) perfMap[u] = { name:u, leads:0, conversions:0, revenue:0, profit:0 };
//     perfMap[u].revenue += Number(b.customerAmount) || 0;
//     perfMap[u].profit  += Number(b.netProfit)      || 0;
//   });
//   const tiers = ["gold","silver","bronze"];
//   const topPerformersConv = Object.values(perfMap)
//     .sort((a,b) => b.conversions - a.conversions).slice(0,5)
//     .map((p,i) => ({ ...p, rank:i+1, rate: p.leads>0 ? +((p.conversions/p.leads)*100).toFixed(2) : 0, tier: tiers[i] || null }));
//   const topPerformersProfit = Object.values(perfMap)
//     .sort((a,b) => b.profit - a.profit).slice(0,5)
//     .map((p,i) => ({ ...p, rank:i+1, margin: p.revenue>0 ? +((p.profit/p.revenue)*100).toFixed(1) : 0, converted: p.conversions, tier: tiers[i] || null }));

//   // Priority followups — leads with upcoming travel dates or overdue reminders
//   const today = new Date(); today.setHours(0,0,0,0);
//   const priorityFollowups = leads
//     .filter(l => l.leadStage !== "Converted" && l.leadStage !== "Lost")
//     .filter(l => l.leadLogs?.some(log => log.followUpDate && new Date(log.followUpDate) <= today))
//     .slice(0, 5)
//     .map(l => {
//       const log = l.leadLogs?.find(lg => lg.followUpDate && new Date(lg.followUpDate) <= today);
//       return {
//         name:     l.customerName, phone: l.phone,
//         note:     log?.comment || "Follow-up required",
//         dueDate:  log?.followUpDate ? new Date(log.followUpDate).toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "—",
//         urgency:  new Date(log?.followUpDate) < today ? "Overdue" : "Today",
//       };
//     });

//   // Near travel dates
//   const nearTravelDates = leads
//     .filter(l => l.travelDate)
//     .map(l => {
//       const travel = new Date(l.travelDate); travel.setHours(0,0,0,0);
//       const diff   = Math.round((travel - today) / 86400000);
//       return { name:l.customerName, phone:l.phone,
//                travelDate: travel.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}),
//                stage:l.leadStage, daysLeft:diff };
//     })
//     .filter(l => l.daysLeft >= 0 && l.daysLeft <= 30)
//     .sort((a,b) => a.daysLeft - b.daysLeft)
//     .slice(0, 5);

//   return {
//     totalLeads:total, convertedLeads:converted, conversionRate:rate,
//     revenue, profit, netMargin, refunds, winRate, hotLeads,
//     leadSources, topDestinations, revenueTimeline,
//     topPerformersConv, topPerformersProfit,
//     priorityFollowups, nearTravelDates,
//   };
// }

// /* Pulls the payload out of an ApiResponse envelope ({ data: {...} }),
//    falling back to the raw body for endpoints that return it unwrapped. */
// const unwrapRes = (r) =>
//   (r?.data && typeof r.data === "object" && "data" in r.data) ? r.data.data : r?.data;

// /* Initials from a name, e.g. "Nepal Tours And Travels" → "NT" */
// const initials = (name = "") =>
//   name.trim().split(/\s+/).slice(0, 2).map(w => w[0] || "").join("").toUpperCase() || "—";

// function buildOperations({ users, company, subscription, activity }) {
//   const usersList   = Array.isArray(users) ? users : [];
//   const totalUsers  = usersList.length;
//   const activeUsers = usersList.filter(u => u.status === "Active").length;

//   const recentUsers = usersList.slice(0, 5).map(u => ({
//     username: u.username,
//     fullName: u.fullName || u.name,
//     role:     u.role,
//     status:   u.status,
//     created:  u.createdAt,
//   }));

//   const sub      = subscription || {};
//   const daysLeft = Number(sub.daysLeft) || 0;
//   const plan = {
//     name:      sub.plan || sub.planName || "—",
//     status:    sub.status || (daysLeft >= 0 ? "Active" : "Expired"),
//     daysLeft,
//     startDate: sub.startDate || "—",
//     endDate:   sub.endDate   || "—",
//   };

//   const co = company || {};
//   const companyObj = {
//     name:    co.name    || "—",
//     email:   co.email   || "—",
//     phone:   co.phone   || "—",
//     address: co.address || "—",
//     status:  co.status  || "Active",
//   };

//   const maxUsers = Number(sub.maxUsers) || Number(co.userLimit) || totalUsers || 0;

//   const recentActivity = (Array.isArray(activity) ? activity : []).slice(0, 10).map(a => ({
//     user:   a.username || a.user || "—",
//     role:   a.type || a.role || "User",
//     action: a.description || a.action || "—",
//     time:   [a.date, a.time].filter(Boolean).join(", ") || a.time || "—",
//   }));

//   return {
//     totalUsers, activeUsers,
//     subEndDate: plan.endDate,
//     userLimit: { max: maxUsers, used: totalUsers },
//     plan, company: companyObj,
//     recentUsers, recentActivity,
//   };
// }

// export default function Dashboard() {
//   const navigate   = useNavigate();
//   const [tab,      setTab]     = useState("analytics");
//   const [period,   setPeriod]  = useState("Yearly");
//   const [greeting, setGreeting] = useState("");

//   // Real data state
//   const [D,       setD]       = useState(EMPTY_D);
//   const [O,       setO]       = useState(EMPTY_O);
//   const [loading, setLoading] = useState(true);
//   const [opsLoaded, setOpsLoaded] = useState(false);
//   const [opsLoading, setOpsLoading] = useState(true);
//   const [toast,   setToast]   = useState(null);

//   // Display name derived from the logged-in user's email (no name column at login)
//   const userName = (localStorage.getItem("userEmail") || "").split("@")[0]
//     .replace(/[._-]+/g, " ").trim()
//     .replace(/\b\w/g, c => c.toUpperCase()) || "there";

//   useEffect(() => {
//     const h = new Date().getHours();
//     setGreeting(h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");
//   }, []);

//   /* ── FETCH REAL DATA ── */
//   const fetchDashboard = useCallback(async () => {
//     setLoading(true);
//     try {
//       const [leadsRes, bookingsRes] = await Promise.all([
//         leadService.getAllLeads(),
//         bookingService.getAll(0, 500),
//       ]);

//       // Normalise leads
//       const leadsRaw  = leadsRes.data?.data ?? leadsRes.data ?? [];
//       const leads     = Array.isArray(leadsRaw?.content) ? leadsRaw.content
//                       : Array.isArray(leadsRaw) ? leadsRaw : [];

//       // Normalise bookings
//       const bookRaw   = bookingsRes.data?.data ?? bookingsRes.data ?? [];
//       const bookings  = Array.isArray(bookRaw?.content) ? bookRaw.content
//                       : Array.isArray(bookRaw) ? bookRaw : [];

//       setD(buildAnalytics(leads, bookings));
//     } catch (err) {
//       console.error("Dashboard fetch error:", err);
//       setToast({ msg:"Failed to load dashboard data.", type:"error" });
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

//   /* ── FETCH OPERATIONS DATA (users · company · subscription · activity) ── */
//   const fetchOperations = useCallback(async () => {
//     setOpsLoading(true);
//     // allSettled → a single failing endpoint won't blank the whole tab
//     const [usersRes, companyRes, subRes, actRes] = await Promise.allSettled([
//       userService.getAll(),
//       companyService.get(),
//       companyService.getSubscription(),
//       activityReportsService.getLogs({ perPage: 10, page: 1 }),
//     ]);

//     const users     = usersRes.status   === "fulfilled" ? (usersRes.value?.data || []) : [];
//     const company   = companyRes.status === "fulfilled" ? unwrapRes(companyRes.value)   : null;
//     const subscription = subRes.status  === "fulfilled" ? unwrapRes(subRes.value)       : null;
//     const actBody   = actRes.status     === "fulfilled" ? unwrapRes(actRes.value)       : null;
//     const activity  = actBody?.logs || (Array.isArray(actBody) ? actBody : []);

//     // Only surface an error if we got literally nothing back
//     if (usersRes.status === "rejected" && companyRes.status === "rejected") {
//       setToast({ msg: "Failed to load operations data.", type: "error" });
//     }

//     setO(buildOperations({ users, company, subscription, activity }));
//     setOpsLoading(false);
//   }, []);

//   // Load the Operations tab lazily the first time it's opened
//   useEffect(() => {
//     if (tab === "operations" && !opsLoaded) {
//       setOpsLoaded(true);
//       fetchOperations();
//     }
//   }, [tab, opsLoaded, fetchOperations]);

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100"
//       style={{fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif"}}>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
//         @keyframes fadeUp  { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
//         @keyframes pulse2  { 0%,100%{opacity:1} 50%{opacity:.4} }
//         @keyframes shimmer { 100%{transform:translateX(100%)} }
//         .fade-up { animation:fadeUp .5s ease both; }
//         .live-dot { animation:pulse2 2s ease infinite; }
//         select { -webkit-appearance:none; appearance:none; }
//         ::-webkit-scrollbar{width:4px;height:4px}
//         ::-webkit-scrollbar-track{background:#f1f5f9;border-radius:99px}
//         ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:99px}
//       `}</style>

//       {/* Toast */}
//       {toast && (
//         <div className="fixed top-5 right-5 z-[999] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl max-w-xs bg-red-50 border-red-200 text-red-800"
//           style={{animation:"slideIn .3s ease both"}}>
//           <span>❌</span>
//           <p className="text-sm font-semibold flex-1">{toast.msg}</p>
//           <button onClick={()=>setToast(null)} className="text-lg opacity-50 hover:opacity-100">×</button>
//         </div>
//       )}

//       {/* ══════════════════════════════════════════════════
//           PAGE HEADER  (sticky)
//       ══════════════════════════════════════════════════ */}
//       <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-30 shadow-sm">
//         <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-4">
//           <div className="flex items-center justify-between gap-4">

//             {/* Left: icon + title + greeting */}
//             <div className="flex items-center gap-3 min-w-0">
//               <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600
//                 flex items-center justify-center text-white shadow-lg shadow-blue-200 flex-shrink-0">
//                 <MdOutlineDashboard className="w-5 h-5"/>
//               </div>
//               <div className="min-w-0">
//                 <div className="flex items-center gap-2.5 flex-wrap">
//                   <h1 className="text-lg font-extrabold text-slate-800 leading-none">Dashboard</h1>
//                   <span className="hidden sm:flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700
//                     text-[10px] font-extrabold px-2.5 py-1 rounded-full">
//                     <span className="live-dot w-1.5 h-1.5 rounded-full bg-green-500 inline-block"/>
//                     Live Data
//                   </span>
//                 </div>
//                 <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">
//                   <span className="cursor-pointer hover:text-blue-600 transition-colors" onClick={()=>navigate("/")}>Home</span>
//                   <span className="mx-1">/</span>
//                   <span className="text-blue-600 font-bold">Dashboard</span>
//                 </p>
//               </div>
//             </div>

//             {/* Right: greeting + date */}
//             <div className="hidden sm:flex flex-col items-end text-right flex-shrink-0">
//               <p className="text-xs sm:text-sm font-extrabold text-slate-700 truncate max-w-[200px]">{greeting}, {userName} 👋</p>
//               <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
//                 {new Date().toLocaleDateString("en-IN",{weekday:"long",year:"numeric",month:"short",day:"numeric"})}
//               </p>
//             </div>
//           </div>
//         </div>
//       </div>

//       {/* ══════════════════════════════════════════════════
//           TAB BAR
//       ══════════════════════════════════════════════════ */}
//       <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 pt-5">
//         <div className="flex rounded-2xl overflow-hidden border border-slate-200/60 shadow-sm bg-white/60 backdrop-blur-md">
//           {[
//             { id:"analytics",  label:"Analytics",  icon:<FiBarChart2 className="w-4 h-4"/>,  desc:"Business insights"  },
//             { id:"operations", label:"Operations", icon:<FiGrid className="w-4 h-4"/>, desc:"System overview" },
//           ].map(t=>(
//             <button key={t.id} onClick={()=>setTab(t.id)}
//               className={`flex-1 flex items-center justify-center gap-2.5 py-3.5 text-sm font-extrabold
//                 transition-all duration-250
//                 ${tab===t.id
//                   ?"bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow-sm"
//                   :"text-slate-500 hover:text-slate-700 hover:bg-slate-50/60"}`}>
//               {t.icon}
//               <span>{t.label}</span>
//               <span className={`text-[10px] font-bold hidden sm:inline ${tab===t.id?"text-white/60":"text-slate-400"}`}>
//                 {t.desc}
//               </span>
//             </button>
//           ))}
//         </div>
//       </div>

//       {/* ══════════════════════════════════════════════════
//           ANALYTICS TAB
//       ══════════════════════════════════════════════════ */}
//       {tab==="analytics" && loading && <AnalyticsSkeleton/>}
//       {tab==="analytics" && !loading && (
//         <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5 space-y-5">

//           {/* Period Filter Strip */}
//           <div className="flex flex-wrap items-center gap-3 fade-up">
//             <div className="flex items-center gap-2 bg-white/80 backdrop-blur-md
//               px-4 py-2.5 rounded-xl border border-slate-200/60 shadow-sm text-sm">
//               <FiCalendar className="w-4 h-4 text-blue-500"/>
//               <span className="font-bold text-slate-600">Period:</span>
//               <select value={period} onChange={e=>setPeriod(e.target.value)}
//                 className="bg-transparent text-slate-700 font-bold text-sm outline-none cursor-pointer pl-1">
//                 {PERIODS.map(p=><option key={p}>{p}</option>)}
//               </select>
//             </div>
//             <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl
//               bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold
//               shadow-md shadow-blue-200 hover:shadow-lg transition-all">
//               <FiFilter className="w-3.5 h-3.5"/> Apply Filter
//             </button>
//             <div className="ml-auto text-xs text-slate-400 font-medium hidden sm:block">
//               Last updated: just now
//             </div>
//           </div>

//           {/* ── Row 1: 4 Hero Cards ── */}
//           <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
//             <HeroCard icon={<FaUsers/>}      label="Total Leads"     value={D.totalLeads}     sub="Yearly overview"      from="from-blue-600"   to="to-indigo-700"  delay={0}   trend={12}/>
//             <HeroCard icon={<FaCheckCircle/>} label="Converted Leads" value={D.convertedLeads} sub={`${D.conversionRate}% rate`} from="from-green-500" to="to-emerald-700" delay={60}  trend={0}/>
//             <HeroCard icon={<FaRupeeSign/>}  label="Agency Revenue"  value={D.revenue}        sub="Total bookings value" from="from-teal-500"   to="to-cyan-700"    delay={120} isINR trend={28}/>
//             <HeroCard icon={<FaChartLine/>}  label="Net Profit"      value={D.profit}         sub={`${D.netMargin}% margin`}  from="from-amber-500" to="to-orange-700"  delay={180} isINR trend={15}/>
//           </div>

//           {/* ── Row 2: 4 Mini Metric Cards ── */}
//           <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
//             <MiniCard icon={<FiRefreshCw/>}  label="Refunds"         value={fmtINR(D.refunds)}         bg="bg-gradient-to-br from-red-500 to-rose-600"       delay={0}  />
//             <MiniCard icon={<FiTarget/>}     label="Win Rate"        value={`${D.winRate}%`}           bg="bg-gradient-to-br from-slate-600 to-slate-800"    delay={50} />
//             <MiniCard icon={<FaFire/>}       label="Hot Leads"       value={D.hotLeads} sub="Potential conversions" bg="bg-gradient-to-br from-orange-500 to-amber-600"  delay={100}/>
//             <MiniCard icon={<FiTrendingUp/>} label="Conversion Rate" value={`${D.conversionRate}%`}   bg="bg-gradient-to-br from-green-500 to-teal-600"     delay={150}/>
//           </div>

//           {/* ── Row 3: Revenue Trend Chart + Lead Sources Donut ── */}
//           <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">

//             {/* Revenue Area Chart */}
//             <SectionCard headerBg="bg-gradient-to-r from-blue-600 to-indigo-600"
//               headerIcon={<FiTrendingUp className="w-4 h-4"/>}
//               title="Revenue & Bookings Trend"
//               action={<span className="text-white/60 text-xs">2026</span>}
//               delay={0}>
//               <div className="p-5">
//                 <ResponsiveContainer width="100%" height={220}>
//                   <AreaChart data={D.revenueTimeline} margin={{top:5,right:5,left:-15,bottom:0}}>
//                     <defs>
//                       <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
//                         <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25}/>
//                         <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
//                       </linearGradient>
//                     </defs>
//                     <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
//                     <XAxis dataKey="month" tick={{fontSize:11,fontWeight:700,fill:"#64748b"}} axisLine={false} tickLine={false}/>
//                     <YAxis tick={{fontSize:10,fill:"#94a3b8"}} axisLine={false} tickLine={false}
//                       tickFormatter={v=>v>=1000?`₹${v/1000}k`:`₹${v}`}/>
//                     <Tooltip content={<ChartTip/>}/>
//                     <Area type="monotone" dataKey="revenue" name="revenue"
//                       stroke="#3b82f6" strokeWidth={2.5} fill="url(#revGrad)"/>
//                     <Bar dataKey="bookings" name="bookings" fill="#10b981" radius={[4,4,0,0]} barSize={16}/>
//                   </AreaChart>
//                 </ResponsiveContainer>
//                 <div className="flex items-center gap-5 mt-2 text-xs font-bold text-slate-500">
//                   <div className="flex items-center gap-1.5"><div className="w-4 h-1.5 rounded bg-blue-500"/><span>Revenue (₹)</span></div>
//                   <div className="flex items-center gap-1.5"><div className="w-4 h-1.5 rounded bg-emerald-500"/><span>Bookings</span></div>
//                 </div>
//               </div>
//             </SectionCard>

//             {/* Lead Sources Donut */}
//             <SectionCard headerBg="bg-blue-600"
//               headerIcon={<FiActivity className="w-4 h-4"/>}
//               title="Lead Sources"
//               delay={80}>
//               <div className="p-5 flex flex-col items-center gap-4">
//                 <ResponsiveContainer width={190} height={190}>
//                   <PieChart>
//                     <Pie data={D.leadSources} cx="50%" cy="50%"
//                       innerRadius={52} outerRadius={88}
//                       labelLine={false} label={DonutLabel} dataKey="value" paddingAngle={3}>
//                       {D.leadSources.map((e,i)=><Cell key={i} fill={e.color}/>)}
//                     </Pie>
//                     <Tooltip formatter={(v,n)=>[v,n]}/>
//                   </PieChart>
//                 </ResponsiveContainer>
//                 <div className="w-full space-y-2.5">
//                   {D.leadSources.map(s=>(
//                     <div key={s.name} className="flex items-center gap-3">
//                       <div className="w-3 h-3 rounded-full flex-shrink-0" style={{background:s.color}}/>
//                       <span className="text-sm font-medium text-slate-700 flex-1">{s.name}</span>
//                       <span className="text-sm font-extrabold text-slate-800">{s.value}</span>
//                       <span className="text-xs text-slate-400 w-10 text-right">{s.pct}%</span>
//                     </div>
//                   ))}
//                 </div>
//               </div>
//             </SectionCard>
//           </div>

//           {/* ── Row 4: Destination Bar + Top Performers 2 cols ── */}
//           <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5">

//             {/* Destination Bar Chart */}
//             <SectionCard headerBg="bg-teal-500"
//               headerIcon={<FiMapPin className="w-4 h-4"/>}
//               title="Top 5 Destination Inquiries"
//               delay={0}>
//               <div className="p-5">
//                 <ResponsiveContainer width="100%" height={200}>
//                   <BarChart data={D.topDestinations} margin={{top:5,right:5,left:-20,bottom:0}}>
//                     <CartesianGrid strokeDasharray="3 3" stroke="#f0f9ff"/>
//                     <XAxis dataKey="name" tick={{fontSize:11,fontWeight:700,fill:"#64748b"}} axisLine={false} tickLine={false}/>
//                     <YAxis tick={{fontSize:10,fill:"#94a3b8"}} axisLine={false} tickLine={false}/>
//                     <Tooltip content={<ChartTip/>}/>
//                     <Bar dataKey="bookings" name="bookings" fill="#14b8a6" radius={[6,6,0,0]}>
//                     </Bar>
//                   </BarChart>
//                 </ResponsiveContainer>
//               </div>
//             </SectionCard>

//             {/* Performers tables side by side */}
//             <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

//               {/* Conversion Rate */}
//               <SectionCard headerBg="bg-gradient-to-r from-green-500 to-emerald-600"
//                 headerIcon={<FaTrophy className="w-4 h-4"/>}
//                 title="Top: Conversion"
//                 delay={60}>
//                 <div className="overflow-x-auto">
//                   <table className="w-full min-w-[260px]">
//                     <thead className="bg-slate-50 border-b border-slate-100">
//                       <tr>{["#","Name","Rate"].map(h=>(
//                         <th key={h} className="px-4 py-2.5 text-left text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">{h}</th>
//                       ))}</tr>
//                     </thead>
//                     <tbody className="divide-y divide-slate-50">
//                       {D.topPerformersConv.map(p=>(
//                         <tr key={p.rank} className="hover:bg-slate-50/60 transition-colors">
//                           <td className="px-4 py-3 text-sm">{p.tier?TIER[p.tier]:p.rank}</td>
//                           <td className="px-4 py-3">
//                             <p className="text-xs font-bold text-slate-800 capitalize leading-tight">{p.name}</p>
//                             <p className="text-[10px] text-slate-400">{p.leads}L · {p.conversions}C</p>
//                           </td>
//                           <td className="px-4 py-3">
//                             <div className="flex items-center gap-2">
//                               <div className="w-10 h-1.5 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
//                                 <div className="h-1.5 bg-green-500 rounded-full" style={{width:`${p.rate}%`}}/>
//                               </div>
//                               <span className="text-xs font-extrabold text-green-700 whitespace-nowrap">{p.rate}%</span>
//                             </div>
//                           </td>
//                         </tr>
//                       ))}
//                     </tbody>
//                   </table>
//                 </div>
//               </SectionCard>

//               {/* Profit Earned */}
//               <SectionCard headerBg="bg-gradient-to-r from-amber-500 to-orange-500"
//                 headerIcon={<FaRupeeSign className="w-4 h-4"/>}
//                 title="Top: Profits"
//                 delay={120}>
//                 <div className="overflow-x-auto">
//                   <table className="w-full min-w-[260px]">
//                     <thead className="bg-slate-50 border-b border-slate-100">
//                       <tr>{["#","Name","Profit"].map(h=>(
//                         <th key={h} className="px-4 py-2.5 text-left text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">{h}</th>
//                       ))}</tr>
//                     </thead>
//                     <tbody className="divide-y divide-slate-50">
//                       {D.topPerformersProfit.map(p=>(
//                         <tr key={p.rank} className="hover:bg-slate-50/60 transition-colors">
//                           <td className="px-4 py-3 text-sm">{p.tier?TIER[p.tier]:p.rank}</td>
//                           <td className="px-4 py-3">
//                             <p className="text-xs font-bold text-slate-800 capitalize leading-tight">{p.name}</p>
//                             <p className="text-[10px] text-slate-400">{fmtINR(p.revenue)} rev</p>
//                           </td>
//                           <td className="px-4 py-3">
//                             <p className={`text-sm font-extrabold ${p.profit>0?"text-green-600":"text-slate-300"}`}>
//                               {fmtINR(p.profit)}
//                             </p>
//                             {p.margin>0&&<p className="text-[10px] text-slate-400">{p.margin}%</p>}
//                           </td>
//                         </tr>
//                       ))}
//                     </tbody>
//                   </table>
//                 </div>
//               </SectionCard>
//             </div>
//           </div>

//           {/* ── Row 5: Priority Follow-ups | Near Travel | Upcoming Trips ── */}
//           <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

//             {/* Priority Follow-ups */}
//             <SectionCard headerBg="bg-gradient-to-r from-red-500 to-rose-600"
//               headerIcon={<FiBell className="w-4 h-4"/>}
//               title="Priority Follow-ups"
//               badge={D.priorityFollowups.length}
//               delay={0}>
//               <div className="p-4 space-y-3">
//                 {D.priorityFollowups.map((f,i)=>(
//                   <div key={i} className="p-3.5 bg-red-50 border border-red-200 rounded-xl space-y-2 hover:bg-red-100/60 transition-colors">
//                     <div className="flex items-center justify-between gap-2">
//                       <span className="text-sm font-extrabold text-slate-800">{f.name}</span>
//                       <span className="text-[10px] font-extrabold bg-red-600 text-white px-2 py-0.5 rounded-full">{f.urgency}</span>
//                     </div>
//                     <p className="text-xs text-slate-500 flex items-center gap-1.5"><FiPhone className="w-3 h-3"/>{f.phone}</p>
//                     <p className="text-xs text-slate-700 font-medium">{f.note}</p>
//                     <p className="text-[11px] font-bold text-red-600 flex items-center gap-1"><FiClock className="w-3 h-3"/> Due: {f.dueDate}</p>
//                   </div>
//                 ))}
//                 <button onClick={()=>navigate("/Reminders")}
//                   className="w-full py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50
//                     text-xs font-bold transition-all flex items-center justify-center gap-2">
//                   <FiBell className="w-3.5 h-3.5"/> View All Reminders
//                 </button>
//               </div>
//             </SectionCard>

//             {/* Near Travel Dates */}
//             <SectionCard headerBg="bg-gradient-to-r from-amber-500 to-orange-500"
//               headerIcon={<FiCalendar className="w-4 h-4"/>}
//               title="Near Travel Dates (10 Days)"
//               badge={D.nearTravelDates.length}
//               delay={60}>
//               <div className="p-4 space-y-3">
//                 {D.nearTravelDates.map((l,i)=>(
//                   <div key={i} className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5 hover:bg-amber-100/60 transition-colors cursor-pointer"
//                     onClick={()=>navigate("/allleads")}>
//                     <div className="flex items-center justify-between gap-2">
//                       <span className="text-sm font-extrabold text-slate-800">{l.name}</span>
//                       <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full
//                         ${l.daysLeft===0?"bg-red-100 text-red-700":l.daysLeft<=2?"bg-amber-100 text-amber-700":"bg-blue-100 text-blue-700"}`}>
//                         {l.daysLeft===0?"Today":`${l.daysLeft}d`}
//                       </span>
//                     </div>
//                     <p className="text-[11px] text-slate-500 flex items-center gap-1"><FiPhone className="w-3 h-3"/>{l.phone}</p>
//                     <p className="text-[11px] text-slate-600 flex items-center gap-1"><FaRegCalendarAlt className="w-3 h-3 text-amber-500"/> {l.travelDate}</p>
//                     <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">{l.stage}</span>
//                   </div>
//                 ))}
//                 <button onClick={()=>navigate("/allleads")}
//                   className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold
//                     transition-all flex items-center justify-center gap-2">
//                   View All Leads <FiChevronRight className="w-3.5 h-3.5"/>
//                 </button>
//               </div>
//             </SectionCard>

//             {/* Upcoming Trips */}
//             <SectionCard headerBg="bg-gradient-to-r from-green-500 to-emerald-600"
//               headerIcon={<FaPlane className="w-4 h-4"/>}
//               title="Upcoming Trips (25 Days)"
//               badge={0}
//               delay={120}>
//               <div className="p-8 flex flex-col items-center justify-center min-h-[200px] text-slate-400">
//                 <FaPlane className="text-5xl mb-3 text-slate-200"/>
//                 <p className="text-sm font-bold text-slate-500">No upcoming trips</p>
//                 <p className="text-xs mt-1 text-slate-400">No bookings in the next 25 days</p>
//                 <button onClick={()=>navigate("/Allbookings")}
//                   className="mt-4 px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-500
//                     hover:border-green-300 hover:text-green-600 hover:bg-green-50 transition-all">
//                   View All Bookings
//                 </button>
//               </div>
//             </SectionCard>
//           </div>

//           {/* ── Row 6: 4 Status Cards ── */}
//           <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
//             {[
//               {label:"Pending Completion (25d)", count:0, icon:<FiCheck/>,       bg:"bg-gradient-to-r from-blue-600 to-blue-700",    msg:"All completed"       },
//               {label:"Client Payments (25d)",    count:0, icon:<FiCreditCard/>,  bg:"bg-gradient-to-r from-amber-500 to-orange-500", msg:"All payments received"},
//               {label:"Vendor Payments (25d)",    count:0, icon:<FiDollarSign/>,  bg:"bg-gradient-to-r from-red-500 to-rose-500",     msg:"All payments made"   },
//               {label:"Get Reviews (15d)",        count:0, icon:<FiStar/>,        bg:"bg-gradient-to-r from-green-500 to-emerald-600",msg:"No recent completions"},
//             ].map(c=>(
//               <div key={c.label} className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden fade-up">
//                 <div className={`${c.bg} px-4 py-3 flex items-center gap-2`}>
//                   <span className="text-white/60">{c.icon}</span>
//                   <span className="text-white text-xs font-extrabold flex-1 leading-tight">{c.label}</span>
//                   <span className="bg-white/25 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">{c.count}</span>
//                 </div>
//                 <div className="p-5 flex flex-col items-center min-h-[90px] justify-center gap-1.5 text-slate-400">
//                   <FiCheck className="text-3xl text-slate-200"/>
//                   <p className="text-xs font-medium">{c.msg}</p>
//                 </div>
//               </div>
//             ))}
//           </div>

//         </div>
//       )}

//       {/* ══════════════════════════════════════════════════
//           OPERATIONS TAB
//       ══════════════════════════════════════════════════ */}
//       {tab==="operations" && opsLoading && <OperationsSkeleton/>}
//       {tab==="operations" && !opsLoading && (
//         <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5 space-y-5">

//           {/* Welcome banner */}
//           <div className="bg-gradient-to-r from-teal-500 to-cyan-500 rounded-2xl px-6 py-4 text-white
//             flex items-start gap-4 shadow-lg fade-up">
//             <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 text-xl">ℹ️</div>
//             <div>
//               <p className="font-extrabold">Welcome to Operations Dashboard!</p>
//               <p className="text-sm text-white/80 mt-0.5">
//                 Welcome back, <strong>{userName}!</strong> Manage your company settings, users, and access operational features.
//               </p>
//             </div>
//           </div>

//           {/* 4 Ops stat cards */}
//           <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
//             <OpsCard label="Total Users"  mainValue={O.totalUsers}         sub="System users"          icon={<FaUsers/>}          gradient="bg-gradient-to-br from-teal-500 to-cyan-700"    delay={0}  />
//             <OpsCard label="Active Users" mainValue={O.activeUsers}        sub={`${O.totalUsers>0?Math.round(O.activeUsers/O.totalUsers*100):0}% of total users`}   icon={<FiUsers/>}          gradient="bg-gradient-to-br from-green-500 to-emerald-700" delay={60} />
//             <OpsCard label="Subscription" mainValue={O.subEndDate}         sub="Expires on"            icon={<FiCalendar/>}       gradient="bg-gradient-to-br from-amber-500 to-orange-700"  delay={120}/>
//             <OpsCard label="User Limit"   mainValue={O.userLimit.max}      sub={`${O.userLimit.used}/${O.userLimit.max} used`}   icon={<FiUsers/>} gradient="bg-gradient-to-br from-red-500 to-rose-700" delay={180}/>
//           </div>

//           {/* Subscription + Company info */}
//           <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

//             {/* Subscription Information */}
//             <SectionCard headerBg="bg-blue-600"
//               headerIcon={<FaGem className="w-4 h-4"/>}
//               title="Subscription Information"
//               badge={<span className="bg-green-400 text-green-900 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">Active</span>}
//               delay={0}>
//               <div className="p-6 space-y-5">
//                 {/* Plan name + status */}
//                 <div className="flex flex-col items-center text-center gap-3 py-2">
//                   <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100
//                     flex items-center justify-center">
//                     <FaGem className="text-3xl text-blue-600"/>
//                   </div>
//                   <div>
//                     <p className="text-base font-extrabold text-blue-700 leading-tight">{O.plan.name}</p>
//                     <span className="mt-1 inline-flex items-center gap-1.5 bg-green-100 text-green-700
//                       text-xs font-extrabold px-3 py-1 rounded-full border border-green-200">
//                       <span className="w-1.5 h-1.5 rounded-full bg-green-500 live-dot inline-block"/> {O.plan.status}
//                     </span>
//                   </div>
//                 </div>
//                 {/* Dates */}
//                 <div className="grid grid-cols-2 gap-3">
//                   <div className="p-3.5 bg-teal-50 border border-teal-200 rounded-2xl">
//                     <div className="flex items-center gap-2 mb-1">
//                       <div className="w-6 h-6 rounded-lg bg-teal-500 flex items-center justify-center"><FiCalendar className="w-3 h-3 text-white"/></div>
//                       <p className="text-[10px] font-extrabold text-teal-700 uppercase tracking-wide">Start Date</p>
//                     </div>
//                     <p className="text-sm font-extrabold text-slate-800">{O.plan.startDate}</p>
//                   </div>
//                   <div className={`p-3.5 rounded-2xl border ${O.plan.daysLeft<=5?"bg-red-50 border-red-200":"bg-amber-50 border-amber-200"}`}>
//                     <div className="flex items-center gap-2 mb-1">
//                       <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${O.plan.daysLeft<=5?"bg-red-500":"bg-amber-500"}`}>
//                         <FiCalendar className="w-3 h-3 text-white"/>
//                       </div>
//                       <p className={`text-[10px] font-extrabold uppercase tracking-wide ${O.plan.daysLeft<=5?"text-red-700":"text-amber-700"}`}>End Date</p>
//                     </div>
//                     <p className="text-sm font-extrabold text-slate-800">{O.plan.endDate}</p>
//                     {O.plan.daysLeft<=5&&<p className="text-[10px] text-red-600 font-extrabold mt-0.5">⚠ {O.plan.daysLeft} days left!</p>}
//                   </div>
//                 </div>
//                 {/* Days remaining bar */}
//                 <div className="space-y-1.5">
//                   <div className="flex justify-between text-xs font-bold text-slate-600">
//                     <span>Subscription Period</span>
//                     <span className={O.plan.daysLeft<=5?"text-red-600":"text-green-600"}>{O.plan.daysLeft} days left</span>
//                   </div>
//                   <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
//                     <div className={`h-2 rounded-full transition-all duration-1000
//                       ${O.plan.daysLeft<=5?"bg-gradient-to-r from-red-500 to-rose-500":"bg-gradient-to-r from-blue-500 to-indigo-500"}`}
//                       style={{width:`${Math.max(2,(O.plan.daysLeft/30)*100)}%`}}/>
//                   </div>
//                 </div>
//                 <button onClick={()=>navigate("/SubscriptionInfo")}
//                   className="w-full py-2.5 rounded-xl border-2 border-blue-200 text-blue-700
//                     hover:bg-blue-50 text-sm font-bold transition-all flex items-center justify-center gap-2">
//                   View Full Plan Details <FiChevronRight className="w-4 h-4"/>
//                 </button>
//               </div>
//             </SectionCard>

//             {/* Company Information */}
//             <SectionCard headerBg="bg-gradient-to-r from-green-600 to-emerald-600"
//               headerIcon={<FaBuilding className="w-4 h-4"/>}
//               title="Company Information"
//               action={
//                 <button onClick={()=>navigate("/CompanyProfile")}
//                   className="flex items-center gap-1.5 text-white/80 hover:text-white text-xs font-bold transition-colors">
//                   <FiEdit2 className="w-3.5 h-3.5"/> Edit
//                 </button>
//               }
//               delay={80}>
//               <div className="p-6 space-y-4">
//                 {/* Logo + name */}
//                 <div className="flex items-center gap-4">
//                   <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-100 to-teal-100
//                     flex items-center justify-center text-xl font-extrabold text-green-700 flex-shrink-0">
//                     {initials(O.company.name)}
//                   </div>
//                   <div>
//                     <p className="text-base font-extrabold text-green-700">{O.company.name}</p>
//                     <span className="text-[10px] font-extrabold text-green-700 bg-green-100 px-2 py-0.5 rounded-full border border-green-200">
//                       ● {O.company.status}
//                     </span>
//                   </div>
//                 </div>
//                 {/* Details */}
//                 <div className="space-y-2">
//                   {[
//                     {icon:<FiMailIcon className="w-3.5 h-3.5 text-blue-500"/>,  label:"Email",   val:O.company.email  },
//                     {icon:<FiPhone    className="w-3.5 h-3.5 text-green-500"/>, label:"Phone",   val:O.company.phone  },
//                     {icon:<FiMapPin   className="w-3.5 h-3.5 text-red-500"/>,   label:"Address", val:O.company.address},
//                   ].map(f=>(
//                     <div key={f.label} className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl">
//                       <div className="flex-shrink-0 mt-0.5">{f.icon}</div>
//                       <div className="min-w-0">
//                         <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide">{f.label}</p>
//                         <p className="text-xs font-semibold text-slate-700 mt-0.5 break-words">{f.val}</p>
//                       </div>
//                     </div>
//                   ))}
//                 </div>
//                 <button onClick={()=>navigate("/CompanySettings")}
//                   className="w-full py-2.5 rounded-xl border-2 border-slate-200 hover:border-green-300
//                     text-slate-600 hover:text-green-700 hover:bg-green-50 text-sm font-bold transition-all
//                     flex items-center justify-center gap-2">
//                   <FiSettings className="w-4 h-4"/> Go to Settings
//                 </button>
//               </div>
//             </SectionCard>
//           </div>

//           {/* Recent Users + Recent Activity */}
//           <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

//             {/* Recent Users */}
//             <SectionCard headerBg="bg-teal-500"
//               headerIcon={<FaUsers className="w-4 h-4"/>}
//               title="Recent Users"
//               action={
//                 <button onClick={()=>navigate("/CreateUser")}
//                   className="flex items-center gap-1.5 text-white/80 hover:text-white text-xs font-bold transition-colors">
//                   <FiPlus className="w-3.5 h-3.5"/> Add User
//                 </button>
//               }
//               delay={0}>
//               <div className="overflow-x-auto">
//                 <table className="w-full min-w-[380px]">
//                   <thead className="bg-slate-50 border-b border-slate-100">
//                     <tr>{["Username","Full Name","Role","Status","Created"].map(h=>(
//                       <th key={h} className="px-4 py-3 text-left text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">{h}</th>
//                     ))}</tr>
//                   </thead>
//                   <tbody className="divide-y divide-slate-50">
//                     {O.recentUsers.map(u=>(
//                       <tr key={u.username} className="hover:bg-slate-50/50 transition-colors">
//                         <td className="px-4 py-3 text-xs font-extrabold text-blue-600">{u.username}</td>
//                         <td className="px-4 py-3 text-xs font-medium text-slate-700">{u.fullName}</td>
//                         <td className="px-4 py-3">
//                           <span className="text-[10px] font-extrabold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md">{u.role}</span>
//                         </td>
//                         <td className="px-4 py-3">
//                           <span className="text-[10px] font-extrabold bg-green-100 text-green-700 px-2 py-0.5 rounded-md">{u.status}</span>
//                         </td>
//                         <td className="px-4 py-3 text-[10px] text-slate-400">{u.created}</td>
//                       </tr>
//                     ))}
//                   </tbody>
//                 </table>
//               </div>
//               <div className="p-4 border-t border-slate-100">
//                 <button onClick={()=>navigate("/Users")}
//                   className="w-full py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600
//                     hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all
//                     flex items-center justify-center gap-2">
//                   <FiUsers className="w-3.5 h-3.5"/> View All Users
//                 </button>
//               </div>
//             </SectionCard>

//             {/* Recent Activity */}
//             <SectionCard headerBg="bg-slate-700"
//               headerIcon={<FiActivity className="w-4 h-4"/>}
//               title="Recent Activity"
//               delay={80}>
//               <div className="p-4 space-y-3 max-h-72 overflow-y-auto">
//                 {O.recentActivity.map((a,i)=>(
//                   <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 hover:bg-white
//                     border border-transparent hover:border-slate-200 rounded-xl transition-all cursor-pointer">
//                     <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-800
//                       flex items-center justify-center text-white text-xs font-extrabold flex-shrink-0">
//                       {a.user.charAt(0).toUpperCase()}
//                     </div>
//                     <div className="flex-1 min-w-0">
//                       <div className="flex items-center gap-2 flex-wrap">
//                         <span className="text-xs font-extrabold text-slate-800">{a.user}</span>
//                         <span className="text-[10px] font-extrabold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{a.role}</span>
//                         <span className="text-[10px] text-slate-400 ml-auto whitespace-nowrap">{a.time}</span>
//                       </div>
//                       <p className="text-xs text-slate-500 mt-0.5 truncate">{a.action}</p>
//                     </div>
//                   </div>
//                 ))}
//               </div>
//               <div className="p-4 border-t border-slate-100">
//                 <button onClick={()=>navigate("/ActivityReports")}
//                   className="w-full py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600
//                     hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all
//                     flex items-center justify-center gap-2">
//                   <FiActivity className="w-3.5 h-3.5"/> View All Activity
//                 </button>
//               </div>
//             </SectionCard>

//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// /* ─── inline icon shims ────────────────────────────────────── */
// function FiMailIcon({className}){
//   return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
//     <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
//   </svg>;
// }
// function FiBell({className}){
//   return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
//     <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
//   </svg>;
// }
// function FiClock({className}){
//   return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
//     <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
//   </svg>;
// }
// function FiStar({className}){
//   return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
//     <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
//   </svg>;
// }
