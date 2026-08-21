import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  BedDouble,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  FileCheck2,
  Gauge,
  Handshake,
  RefreshCw,
  ScrollText,
  TrendingUp,
  UserRound,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { actionInboxService } from "../api/actionInboxService";
import { analyticsService } from "../api/analyticsService";
import { auditService } from "../api/auditService";
import { marketplaceBookingService } from "../api/marketplaceBookingService";
import { marketplaceCommissionService } from "../api/marketplaceCommissionService";
import { hotelNominationService } from "../api/marketplaceAdminService";
import { hotelPartnerService } from "../api/hotelPartnerService";
import { subAgentLicenseService } from "../api/subAgentLicenseService";
import { upgradeRequestService } from "../api/upgradeRequestService";
import { usageService } from "../api/usageService";
import {
  ConsoleErrorState,
  ConsoleLoadingState,
  ConsolePageHeader,
  ConsolePanel,
} from "../components/ConsoleUi";
import HotelMarketplaceDashboard from "../components/HotelMarketplaceDashboard";
import { useConsoleTheme } from "../theme/ConsoleThemeProvider";

const HUE = {
  indigo: "bg-hue-indigo-soft text-hue-indigo",
  emerald: "bg-hue-emerald-soft text-hue-emerald",
  amber: "bg-hue-amber-soft text-hue-amber",
  sky: "bg-hue-sky-soft text-hue-sky",
  violet: "bg-hue-violet-soft text-hue-violet",
  rose: "bg-hue-rose-soft text-hue-rose",
};

const STATUS_COLORS = {
  ACTIVE: "#10b981",
  TRIAL: "#f59e0b",
  PAST_DUE: "#f97316",
  SUSPENDED: "#ef4444",
  EXPIRED: "#64748b",
  INACTIVE: "#94a3b8",
};
const PLAN_COLORS = ["#7c3aed", "#0ea5e9", "#10b981", "#f59e0b", "#db2777"];

const symbol = (currency) => (currency === "INR" ? "₹" : currency ? `${currency} ` : "");
const money = (value, currency) => symbol(currency) + Number(value || 0).toLocaleString("en-IN", {
  maximumFractionDigits: 0,
});
const compactMoney = (currency) => (value) => {
  const amount = Number(value || 0);
  return amount >= 1000
    ? `${symbol(currency)}${(amount / 1000).toFixed(amount >= 10000 ? 0 : 1)}k`
    : `${symbol(currency)}${amount}`;
};
const number = (value) => Number(value || 0).toLocaleString("en-IN");
const countFrom = (value) => Number(value?.count ?? value ?? 0);

function useChartTheme() {
  const { isDark } = useConsoleTheme();
  return {
    axis: isDark ? "#7b749f" : "#948eb0",
    tooltip: {
      background: isDark ? "#1b1836" : "#ffffff",
      border: `1px solid ${isDark ? "#3a3560" : "#e7e5f2"}`,
      borderRadius: 10,
      color: isDark ? "#f3f1ff" : "#17143a",
      fontSize: 12,
      boxShadow: "0 12px 32px -14px rgb(30 27 75 / 0.4)",
    },
    tooltipItem: { color: isDark ? "#f3f1ff" : "#17143a" },
    tooltipLabel: { color: isDark ? "#b4aed6" : "#514c70", fontWeight: 600 },
  };
}

/* One cell of a hairline-divided strip, not a card.
   Six identical bordered-and-shadowed tiles in a 3x2 grid is the shape every admin template ships,
   and it flattens hierarchy: "Outstanding invoices" and "Platform users" were rendered with exactly
   the same weight. A strip divided by hairlines reads as one instrument with several readings, which
   is what these numbers actually are.
   Numerals are tabular-nums on the UI face rather than font-mono: mono is for identifiers (audit
   actions, tenant codes), and using it for money costs legibility and reads as a developer tool. */
function MetricCard({ label, value, helper, Icon, hue = "violet", danger = false, to }) {
  const Card = to ? Link : "div";
  return (
    <Card {...(to ? { to } : {})}
      className="group rounded-2xl border border-border bg-surface p-4 shadow-[var(--sa-card-shadow)] transition-colors hover:border-accent/40 hover:bg-surface-hover/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted">{label}</div>
          <div className={`mt-2 truncate font-mono text-2xl font-bold tracking-tight ${danger ? "text-hue-rose" : "text-heading"}`}>
            {value}
          </div>
        </div>
        <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${HUE[hue]}`}>
          <Icon size={17} strokeWidth={2.2} />
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-body">
        <span>{helper}</span>{to && <ArrowRight size={13} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />}
      </div>
    </Card>
  );
}

function QueueItem({ path, label, hint, count, Icon, tone = "violet" }) {
  return (
    <Link to={path}
      className="group flex items-center gap-3 border-b border-border px-5 py-3.5 transition-colors last:border-b-0 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent">
      <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${HUE[tone]}`}>
        <Icon size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-heading">{label}</span>
        <span className="block truncate text-xs text-muted">{hint}</span>
      </span>
      <span className="font-mono text-lg font-bold text-heading">{count}</span>
      <ArrowRight size={15} className="text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
    </Link>
  );
}

/* Everything with nothing waiting, folded into one quiet line. The operator needs to know these
   queues were checked and are clear — but they should cost one row, not seven. */
function ClearQueues({ labels }) {
  if (!labels.length) return null;
  return (
    <div className="flex items-start gap-2.5 px-5 py-3 text-xs text-muted">
      <CheckCircle2 size={15} className="mt-px shrink-0 text-hue-emerald" />
      <span>
        <span className="font-semibold text-body">{labels.length} clear</span>
        {" — "}{labels.join(" · ")}
      </span>
    </div>
  );
}

function Distribution({ rows, total, colorFor }) {
  if (!rows?.length || total <= 0) {
    return <div className="px-5 py-10 text-center text-sm text-muted">No portfolio data yet.</div>;
  }
  return (
    <div className="space-y-3 px-5 py-4">
      {rows.map((row, index) => {
        const percent = Math.round((Number(row.value || 0) / total) * 100);
        return (
          <div key={row.label}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
              <span className="font-medium text-body">{row.label}</span>
              <span className="font-mono text-muted">{number(row.value)} · {percent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-hover">
              <div className="h-full rounded-full" style={{ width: `${Math.max(percent, 2)}%`, background: colorFor(row, index) }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Bars({ title, description, data, id, from, to, tickFormatter, tooltipFormatter }) {
  const theme = useChartTheme();
  return (
    <ConsolePanel title={title} description={description}>
      <div className="h-72 px-3 pb-4 pt-5">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={from} stopOpacity={0.95} />
                <stop offset="100%" stopColor={to} stopOpacity={0.88} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.axis} strokeOpacity={0.15} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: theme.axis, fontSize: 11 }}
              axisLine={{ stroke: theme.axis, strokeOpacity: 0.3 }} tickLine={false} />
            <YAxis tick={{ fill: theme.axis, fontSize: 11 }} axisLine={false} tickLine={false}
              width={tickFormatter ? 52 : 32} tickFormatter={tickFormatter} allowDecimals={false} />
            <Tooltip contentStyle={theme.tooltip} itemStyle={theme.tooltipItem} labelStyle={theme.tooltipLabel}
              cursor={{ fill: theme.axis, fillOpacity: 0.1 }}
              formatter={(value) => (tooltipFormatter ? tooltipFormatter(value) : value)} />
            <Bar dataKey="value" fill={`url(#${id})`} radius={[6, 6, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ConsolePanel>
  );
}

/**
 * How long the oldest item in a queue has been waiting, as a compact "6d" / "4h" / "12m".
 *
 * Deliberately terse and deliberately not `relativeTime` — that one produces "3 days ago", which reads
 * as when something happened. This reads as how long it has been ignored, which is the operator's
 * actual question. Returns null when there is nothing to report, so callers can omit it entirely
 * rather than render "0m".
 */
function waitedFor(iso) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${Math.max(minutes, 1)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function relativeTime(value) {
  if (!value) return "Unknown time";
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const ranges = [[60, "second"], [60, "minute"], [24, "hour"], [7, "day"]];
  let amount = seconds;
  for (const [limit, unit] of ranges) {
    if (Math.abs(amount) < limit) return formatter.format(Math.round(amount), unit);
    amount /= limit;
  }
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export default function ConsoleHome() {
  const [searchParams, setSearchParams] = useSearchParams();
  const dashboardView = searchParams.get("view") === "hotel" ? "hotel" : "platform";
  const [data, setData] = useState(null);
  const [ops, setOps] = useState({
    upgrades: 0, hotelRequests: 0, nominations: 0, partnerRegistrations: 0,
    overLimit: 0, nearLimit: 0,
  });
  const [activity, setActivity] = useState([]);
  const [platformEarning, setPlatformEarning] = useState(null);
  const [queueAges, setQueueAges] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [degraded, setDegraded] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (background = false) => {
    background ? setRefreshing(true) : setLoading(true);
    setError("");
    const results = await Promise.allSettled([
      analyticsService.overview(),
      usageService.dashboard(),
      upgradeRequestService.pendingCount(),
      subAgentLicenseService.pendingCount(),
      marketplaceBookingService.pendingCount(),
      hotelNominationService.openCount(),
      hotelPartnerService.listRegistrations({ status: "SUBMITTED", page: 0, size: 1 }),
      auditService.list({ page: 0, size: 6 }),
      marketplaceCommissionService.summary({}),
      actionInboxService.ages(),
    ]);

    const [analytics, usage, upgrades, licenses, hotelRequests, nominations, registrations, audit, earning, ages] = results;
    if (analytics.status === "rejected") {
      setError(analytics.reason?.response?.data?.message || "Failed to load platform analytics.");
    } else {
      setData(analytics.value);
      const usageOverview = usage.status === "fulfilled" ? usage.value?.overview : null;
      setOps({
        upgrades: (upgrades.status === "fulfilled" ? countFrom(upgrades.value) : 0)
          + (licenses.status === "fulfilled" ? countFrom(licenses.value) : 0),
        hotelRequests: hotelRequests.status === "fulfilled" ? countFrom(hotelRequests.value) : 0,
        nominations: nominations.status === "fulfilled" ? countFrom(nominations.value) : 0,
        partnerRegistrations: registrations.status === "fulfilled"
          ? Number(registrations.value?.pagination?.totalElements ?? registrations.value?.rows?.length ?? 0)
          : 0,
        overLimit: Number(usageOverview?.tenantsOverLimit ?? 0),
        nearLimit: Number(usageOverview?.tenantsNearLimit ?? 0),
      });
      setActivity(audit.status === "fulfilled" ? audit.value?.rows ?? [] : []);
      setPlatformEarning(earning.status === "fulfilled" ? earning.value : null);
      // Age is decoration on top of the counts, so a failure here must not raise the degraded banner:
      // the inbox simply shows what it always showed.
      setQueueAges(ages.status === "fulfilled" ? ages.value : {});
      setDegraded(results.slice(1, -1).some((result) => result.status === "rejected"));
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <ConsoleLoadingState label="Loading platform command center…" />;
  if (error || !data) return <ConsoleErrorState message={error || "No platform data is available."} onRetry={() => load()} />;

  const currency = data.currency;
  const operationalTenants = Number(data.activeTenants || 0) + Number(data.trialTenants || 0)
    + Number(data.pastDueTenants || 0);
  const activePercent = data.totalTenants > 0 ? Math.round((operationalTenants / data.totalTenants) * 100) : 0;
  const totalStatus = (data.tenantsByStatus || []).reduce((sum, row) => sum + Number(row.value || 0), 0);
  const totalPlans = (data.tenantsByPlan || []).reduce((sum, row) => sum + Number(row.value || 0), 0);
  const revenueSeries = (data.revenueByMonth || []).map((row) => ({ label: row.month, value: row.amount }));
  const queueTotal = ops.upgrades + ops.hotelRequests + ops.nominations + ops.partnerRegistrations
    + ops.overLimit + Number(data.overdueInvoices || 0) + Number(data.expiringSubscriptions || 0);

  /* One declared list, partitioned into "has work" and "clear", then ordered by size. The queue with
     the most waiting work is the first thing on the page.
     NOTE: ordering by COUNT is a stand-in for ordering by AGE, which is what an operator actually
     needs — twelve requests from this morning matter less than one that has waited three weeks. No
     endpoint currently returns an oldest-pending timestamp per queue, so this is deliberately not
     faked; adding that field is tracked in the audit doc. */
  const queues = [
    { path: "/console/upgrade-requests", label: "Subscription and add-on decisions", short: "Subscriptions",
      inboxKey: "UPGRADE_REQUESTS",
      hint: "Review tenant plan or seat requests", count: ops.upgrades, Icon: FileCheck2, tone: "violet" },
    { path: "/console/hotel-requests", label: "Hotel booking requests", short: "Booking requests",
      inboxKey: "HOTEL_BOOKING_REQUESTS",
      hint: "Tenant is waiting for a platform decision", count: ops.hotelRequests, Icon: Clock3, tone: "amber" },
    { path: "/console/hotel-nominations", label: "Hotel nominations", short: "Nominations",
      inboxKey: "HOTEL_NOMINATIONS",
      hint: "Review tenant-suggested properties", count: ops.nominations, Icon: Handshake, tone: "sky" },
    { path: "/console/hotel-partners", label: "Hotel partner registrations", short: "Partner registrations",
      inboxKey: "HOTEL_PARTNER_REGISTRATIONS",
      hint: "Review submitted supplier profiles", count: ops.partnerRegistrations, Icon: Building2, tone: "amber" },
    { path: "/console/billing?overdue=true", label: "Overdue invoices", short: "Overdue invoices",
      inboxKey: "OVERDUE_INVOICES",
      hint: `${money(data.overdueAmount, currency)} needs collection follow-up`,
      count: Number(data.overdueInvoices || 0), Icon: Banknote, tone: "rose" },
    // The last two are computed from current state, so nothing was ever "queued" and there is no age
    // to report — the backend deliberately omits them rather than sending a misleading null.
    { path: "/console/tenants", label: "Subscriptions expiring in 14 days", short: "Expiring access",
      hint: "Contact or renew access before expiry", count: Number(data.expiringSubscriptions || 0), Icon: Clock3, tone: "amber" },
    { path: "/console/usage", label: "Tenants over quota", short: "Quota breaches",
      hint: `${ops.nearLimit} more tenant(s) approaching their limit`, count: ops.overLimit, Icon: Gauge, tone: "rose" },
  ].map((q) => {
    const waited = waitedFor(queueAges[q.inboxKey]?.oldestPendingAt);
    return {
      ...q,
      waitedMs: waited ? Date.now() - new Date(queueAges[q.inboxKey].oldestPendingAt).getTime() : -1,
      hint: waited ? `${q.hint} · oldest ${waited}` : q.hint,
    };
  });

  /* Ordered by NEGLECT, not by volume: the queue whose oldest item has waited longest comes first.
     One partner who submitted three weeks ago outranks twelve booking requests raised this morning.
     Queues with no age (live-computed, or a feed that failed) fall back to depth so they still rank
     sensibly instead of sinking to the bottom. */
  const activeQueues = queues.filter((q) => q.count > 0)
    .sort((a, b) => (b.waitedMs - a.waitedMs) || (b.count - a.count));
  const clearQueues = queues.filter((q) => q.count === 0);

  const setDashboardView = (nextView) => {
    const next = new URLSearchParams(searchParams);
    if (nextView === "hotel") next.set("view", "hotel");
    else next.delete("view");
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-xl border border-border bg-surface p-1 shadow-sm" role="tablist" aria-label="Dashboard view">
        <button type="button" role="tab" aria-selected={dashboardView === "platform"} onClick={() => setDashboardView("platform")}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${dashboardView === "platform" ? "bg-accent text-white shadow-sm" : "text-body hover:bg-surface-hover"}`}>
          <Building2 size={14} /> Platform overview
        </button>
        <button type="button" role="tab" aria-selected={dashboardView === "hotel"} onClick={() => setDashboardView("hotel")}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${dashboardView === "hotel" ? "bg-accent text-white shadow-sm" : "text-body hover:bg-surface-hover"}`}>
          <BedDouble size={14} /> Hotel marketplace
        </button>
      </div>

      {dashboardView === "hotel" ? (
        <HotelMarketplaceDashboard pendingBookings={ops.hotelRequests} openNominations={ops.nominations} />
      ) : (
        <>
      <ConsolePageHeader eyebrow="SuperAdmin command center" title="Platform overview"
        description="Prioritise tenant risk, pending decisions and cash collection across the platform."
        meta={`${number(data.totalUsers)} users across ${number(data.totalTenants)} tenant accounts`}
        actions={(
          <>
            <Link to="/console/tenants"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3 text-xs font-semibold text-white shadow-sm hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
              <Building2 size={14} /> Manage tenants
            </Link>
            <button type="button" onClick={() => load(true)} disabled={refreshing}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 text-xs font-semibold text-heading hover:bg-surface-hover disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh
            </button>
          </>
        )} />

      {degraded && (
        <div className="flex items-start gap-3 rounded-xl border border-hue-amber/30 bg-hue-amber-soft px-4 py-3 text-sm text-body" role="status">
          <AlertTriangle size={17} className="mt-0.5 shrink-0 text-hue-amber" />
          <div><span className="font-semibold text-heading">Some live feeds are unavailable.</span> Core analytics are current; unavailable queue counts are shown as zero. Refresh to retry.</div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Link to="/console/hotel-commissions"
          className="group rounded-2xl p-5 text-white shadow-[var(--sa-card-shadow)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          style={{ backgroundImage: "var(--sa-gradient)" }}>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide opacity-80">Platform earning</span>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
              <CircleDollarSign size={17} strokeWidth={2.2} />
            </span>
          </div>
          <div className="mt-4 font-mono text-3xl font-bold tracking-tight">
            {platformEarning ? money(platformEarning.netEarning, platformEarning.currency || "INR") : "Unavailable"}
          </div>
          <p className="mt-2 text-xs font-medium opacity-80">
            {platformEarning
              ? `${money(platformEarning.pendingBalance, platformEarning.currency || "INR")} pending settlement · ${number(platformEarning.entryCount)} ledger entries`
              : "Marketplace earning feed could not be loaded"}
          </p>
          <span className="mt-5 inline-flex items-center gap-1 text-xs font-semibold">
            Open earning ledger <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard label="Operational tenant health" value={`${activePercent}%`} helper={`${number(operationalTenants)} of ${number(data.totalTenants)} accounts can operate`}
            Icon={CheckCircle2} hue="emerald" to="/console/tenants" />
          <MetricCard label="Monthly recurring revenue" value={money(data.mrr, currency)} helper={`${number(data.trialTenants)} trial accounts in pipeline`}
            Icon={TrendingUp} hue="violet" to="/console/plans" />
          <MetricCard label="Collected this month" value={money(data.collectedThisMonth, currency)} helper="Based on settlement date, not invoice date"
            Icon={CreditCard} hue="sky" to="/console/billing?status=PAID" />
          <MetricCard label="Outstanding invoices" value={money(data.outstanding, currency)} helper={Number(data.outstanding) > 0 ? "Requires collection follow-up" : "No unpaid balance"}
            Icon={AlertTriangle} hue="rose" danger={Number(data.outstanding) > 0} to="/console/billing?status=UNPAID" />
          <MetricCard label="Overdue now" value={money(data.overdueAmount, currency)} helper={`${number(data.overdueInvoices)} invoice(s) past due`}
            Icon={Banknote} hue="amber" danger={Number(data.overdueInvoices) > 0} to="/console/billing?overdue=true" />
          <MetricCard label="Platform users" value={number(data.totalUsers)} helper={`${number(data.pastDueTenants)} tenant(s) currently in grace`}
            Icon={UserRound} hue="indigo" to="/console/users" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        {/* Kept from the rework: queues with work are listed first and ordered by size, and the ones
            with nothing waiting collapse into a single line instead of seven near-identical empty
            rows. The panel itself is unchanged. */}
        <ConsolePanel title="Action inbox" description={`${queueTotal} platform decisions or risks need attention`} className="xl:col-span-3">
          {activeQueues.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
              <CheckCircle2 size={22} className="text-hue-emerald" />
              <p className="text-sm font-semibold text-heading">Every queue is clear</p>
              <p className="text-xs text-muted">No approvals, overdue invoices, expiring access or quota breaches.</p>
            </div>
          ) : (
            <>
              {activeQueues.map((q) => <QueueItem key={q.path + q.label} {...q} />)}
              <ClearQueues labels={clearQueues.map((q) => q.short)} />
            </>
          )}
        </ConsolePanel>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:col-span-2 xl:grid-cols-1">
          <ConsolePanel title="Tenant health" description="Current lifecycle distribution">
            <Distribution rows={data.tenantsByStatus || []} total={totalStatus}
              colorFor={(row) => STATUS_COLORS[row.label] || "#64748b"} />
          </ConsolePanel>
          <ConsolePanel title="Plan mix" description="Live tenant portfolio by subscription">
            <Distribution rows={data.tenantsByPlan || []} total={totalPlans}
              colorFor={(_, index) => PLAN_COLORS[index % PLAN_COLORS.length]} />
          </ConsolePanel>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Bars title="Tenant acquisition" description="New accounts created by month" data={data.newTenantsByMonth || []}
          id="grad-tenants" from="#a855f7" to="#7c3aed" />
        <Bars title="Cash collected" description="Settled invoice value by paid month" data={revenueSeries}
          id="grad-revenue" from="#34d399" to="#059669" tickFormatter={compactMoney(currency)}
          tooltipFormatter={(value) => money(value, currency)} />
      </div>

      <ConsolePanel title="Recent platform activity" description="Latest audited SuperAdmin actions"
        action={<Link to="/console/audit" className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">View audit log <ArrowRight size={13} /></Link>}>
        {activity.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted"><ScrollText size={24} className="mx-auto mb-2 opacity-50" />No recent audit activity.</div>
        ) : (
          <div className="divide-y divide-border">
            {activity.map((row) => (
              <div key={row.publicId} className="flex items-start gap-3 px-5 py-3.5">
                <span className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${row.success ? HUE.emerald : HUE.rose}`}>
                  {row.success ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-mono text-[11px] font-bold text-heading">{row.action}</span>
                    <span className="text-xs text-muted">by {row.actorEmail || "system"}</span>
                    {row.targetTenantCode && <span className="rounded bg-surface-hover px-1.5 py-0.5 font-mono text-[10px] text-body">{row.targetTenantCode}</span>}
                  </div>
                  <p className="mt-1 truncate text-xs text-body">{row.description || "No description recorded"}</p>
                </div>
                <time dateTime={row.createdAt} className="shrink-0 text-[11px] text-muted">{relativeTime(row.createdAt)}</time>
              </div>
            ))}
          </div>
        )}
      </ConsolePanel>
        </>
      )}
    </div>
  );
}
