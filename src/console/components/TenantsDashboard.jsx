// src/console/components/TenantsDashboard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The CRM-subscription business: who is on the platform, what they pay, and who
// is about to leave.
//
// A dashboard of its own because it is a different JOB from the supply queues.
// The person chasing an overdue invoice and the person approving a hotel request
// are not the same person on the same afternoon, and until now both were reading
// the same page.
//
// ── The two widgets that are not just relocated numbers ─────────────────────
// Most of this view is material that already existed on Platform overview. Two
// things are new, and they are the reason this dashboard earns its place:
//
//   1. QUIET TENANTS — ACTIVE accounts with no booking this month. This is the
//      earliest churn signal the platform has, and it costs nothing: the usage
//      endpoint already returns bookingsThisMonth per tenant from a native
//      cross-tenant query. Nobody was looking at it.
//   2. GRACE — PAST_DUE tenants, which the status distribution buries inside a
//      bar. A tenant in grace is a decision with a deadline, not a statistic.
//
// ── What is deliberately NOT here ───────────────────────────────────────────
// Churn rate, cohort retention, month-over-month lapse. There is no data for any
// of it: the only historical series that exist are new-tenants-by-month and
// revenue-by-month, and the Subscription table that would carry CANCELLED is
// never written to. A churn tile would have to be invented, and an invented
// number on a money dashboard is worse than a missing one.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Banknote, Clock3, CreditCard, Gauge, Loader2, MoonStar,
  RefreshCw, TrendingUp, Users,
} from "lucide-react";

import { getErrorMessage } from "@shared/api/apiError";
import { toast } from "@shared/ui/toast";

import { analyticsService } from "../api/analyticsService";
import { usageService } from "../api/usageService";
import { upgradeRequestService } from "../api/upgradeRequestService";
import { platformHealthService } from "../api/platformHealthService";
import { ConsolePanel } from "./ConsoleUi";
import { Bars, Distribution, PLAN_COLORS, STATUS_COLORS } from "./consoleCharts";
import { ActionLink, DegradedNote, Metric, SmallLink, money } from "./marketplaceDashboardUi";
import { NowTag } from "./RangePicker";

const number = (value) => Number(value || 0).toLocaleString("en-IN");

const compactMoney = (currency) => (value) => {
  const symbol = currency === "INR" ? "₹" : currency ? `${currency} ` : "";
  const n = Number(value || 0);
  if (Math.abs(n) >= 10000000) return `${symbol}${(n / 10000000).toFixed(1)}Cr`;
  if (Math.abs(n) >= 100000) return `${symbol}${(n / 100000).toFixed(1)}L`;
  if (Math.abs(n) >= 1000) return `${symbol}${Math.round(n / 1000)}k`;
  return `${symbol}${n}`;
};

export default function TenantsDashboard({ range, periodLabel = "this month" }) {
  const [data, setData] = useState(null);
  const [usage, setUsage] = useState(null);
  const [upgrades, setUpgrades] = useState(null);
  const [pulse, setPulse] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [degraded, setDegraded] = useState(false);

  const load = useCallback(async (background = false) => {
    if (background) setRefreshing(true); else setLoading(true);

    const results = await Promise.allSettled([
      analyticsService.overview(),
      usageService.dashboard(),
      upgradeRequestService.pendingCount(),
      range?.from && range?.to ? platformHealthService.pulse(range) : Promise.resolve(null),
      // Already carries subscriptionEndDate and daysToExpiry per tenant, so the renewals list below
      // needs no endpoint of its own — and cannot disagree with the health list on the overview.
      platformHealthService.tenantHealth(),
    ]);

    setData(results[0].status === "fulfilled" ? results[0].value : null);
    setUsage(results[1].status === "fulfilled" ? results[1].value : null);
    setUpgrades(results[2].status === "fulfilled"
      ? Number(results[2].value?.count ?? results[2].value ?? 0)
      : null);
    setPulse(results[3].status === "fulfilled" ? results[3].value : null);
    setHealth(results[4].status === "fulfilled" ? results[4].value : null);
    setDegraded(results.some((r) => r.status === "rejected"));
    setLoading(false);
    setRefreshing(false);
  }, [range?.from, range?.to]);

  useEffect(() => { load(); }, [load]);

  const refresh = () =>
    load(true).catch((err) => toast.error(getErrorMessage(err, "Could not refresh.")));

  /* ACTIVE accounts that have not confirmed a booking this month.
     Not "logged out" and not "cancelled" — there is no last-login on a tenant and no cancellation
     record. This is the honest proxy the data supports: an agency paying for a CRM it is not
     booking through. TRIAL is excluded on purpose — a trial with no bookings yet is a tenant that
     has not started, which is the onboarding funnel's problem, not churn. */
  const quiet = useMemo(() => {
    const rows = usage?.tenants ?? [];
    return rows
      .filter((t) => t.status === "ACTIVE" && Number(t.bookingsThisMonth || 0) === 0)
      .sort((a, b) => Number(b.activeUsers || 0) - Number(a.activeUsers || 0));
  }, [usage]);

  if (loading && !data) {
    return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-muted" /></div>;
  }

  const currency = data?.currency ?? "INR";

  /* Renewals due in the next 30 days, soonest first.
     Forward-looking, so the period picker above deliberately does not touch it — a renewal on the
     14th is due on the 14th whichever window the reader happens to be looking at.
     Expired rows (negative daysToExpiry) are included: an access date that has already passed and
     was never renewed is more urgent than one three weeks out, and dropping it would make the list
     read as "nothing overdue". */
  const renewals = (health?.tenants ?? [])
    .filter((t) => t.daysToExpiry !== null && t.daysToExpiry !== undefined && t.daysToExpiry <= 30)
    .sort((a, b) => a.daysToExpiry - b.daysToExpiry);
  const overview = usage?.overview ?? null;

  const planRows = (data?.tenantsByPlan ?? []).filter((r) => Number(r.value || 0) > 0);
  const planTotal = planRows.reduce((sum, r) => sum + Number(r.value || 0), 0);
  const statusRows = data?.tenantsByStatus ?? [];
  const statusTotal = statusRows.reduce((sum, r) => sum + Number(r.value || 0), 0);
  const revenueSeries = (data?.revenueByMonth ?? []).map((r) => ({ label: r.month, value: r.amount }));

  return (
    <div className="space-y-5">
      {degraded && <DegradedNote />}

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          The subscription business — who is on the platform, what they pay, and who is going quiet.
        </p>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-body hover:bg-surface-hover disabled:opacity-60"
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label={<>Monthly recurring revenue<NowTag /></>}
          value={money(data?.mrr, currency)}
          helper={`${number(data?.trialTenants)} trial account(s) in the pipeline`}
          Icon={CreditCard}
          tone="violet"
        />
        <Metric
          label={`Collected · ${periodLabel}`}
          value={pulse ? money(pulse.collectedAmount, currency) : money(data?.collectedThisMonth, currency)}
          helper={pulse
            ? `${number(pulse.invoicesPaid)} invoice(s) paid, by settlement date`
            : "By settlement date, not invoice date"}
          Icon={TrendingUp}
          tone="emerald"
        />
        <Metric
          label={<>Outstanding<NowTag /></>}
          value={money(data?.outstanding, currency)}
          helper={Number(data?.outstanding) > 0 ? "Unpaid, not yet past due" : "Nothing unpaid"}
          Icon={Banknote}
          tone="sky"
        />
        <Metric
          label={<>Overdue<NowTag /></>}
          value={money(data?.overdueAmount, currency)}
          helper={`${number(data?.overdueInvoices)} invoice(s) past due`}
          Icon={Banknote}
          tone="orange"
          danger={Number(data?.overdueInvoices || 0) > 0}
        />
      </div>

      {/* FAILED PAYMENTS IS DELIBERATELY ABSENT.
          BillingStatus has three values — UNPAID, PAID, VOID — and no FAILED. A declined charge
          leaves the invoice UNPAID, indistinguishable from one nobody has attempted yet. A "failed
          payments" tile would therefore either read 0 forever or silently relabel every unpaid
          invoice as a failure. Recording the attempt outcome is the fix; a tile is not. */}
      <ConsolePanel
        title="Renewals due"
        description={renewals.length === 0
          ? "Nothing expiring in the next 30 days."
          : `${renewals.length} tenant(s) expiring within 30 days`}
        action={<SmallLink to="/console/tenants">All tenants</SmallLink>}
      >
        {renewals.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">
            No subscription reaches its end date in the next 30 days.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {renewals.map((t) => {
              const overdue = t.daysToExpiry < 0;
              return (
                <li key={t.publicId}>
                  <Link to={`/console/tenants/${t.publicId}`}
                    className="group flex items-center gap-3 px-5 py-3 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-heading">
                        {t.organizationName || "Unnamed tenant"}
                      </div>
                      <div className="truncate text-xs text-muted">
                        {[t.plan, t.status, t.subscriptionEndDate].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <span className={`shrink-0 text-sm font-semibold ${overdue ? "text-hue-rose" : t.daysToExpiry <= 7 ? "text-hue-orange" : "text-body"}`}>
                      {overdue ? `${Math.abs(t.daysToExpiry)}d ago` : `in ${t.daysToExpiry}d`}
                    </span>
                    <ArrowRight size={15} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </ConsolePanel>

      {pulse && (
        <ConsolePanel title={`New business · ${periodLabel}`}
          description="Signups and invoicing over the selected period.">
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <Metric label="New tenants" value={number(pulse.newTenants)}
              helper="Signed up in this period" Icon={Users} tone="violet" />
            <Metric label="Invoiced" value={money(pulse.invoicedAmount, currency)}
              helper={`${number(pulse.invoicesIssued)} invoice(s) issued`} Icon={CreditCard} tone="sky" />
            <Metric label="Tenants booking" value={number(pulse.tenantsBooking)}
              helper={`${number(pulse.bookingsCreated)} booking(s) across the platform`}
              Icon={TrendingUp} tone="emerald" />
          </div>
        </ConsolePanel>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <ConsolePanel
          title="Needs a decision"
          description="Subscription work with a deadline attached."
          className="xl:col-span-3"
        >
          <ActionLink
            to="/console/billing?overdue=true"
            label="Overdue invoices"
            helper={`${money(data?.overdueAmount, currency)} to chase`}
            value={Number(data?.overdueInvoices || 0)}
            Icon={Banknote}
            urgent
          />
          <ActionLink
            to="/console/upgrade-requests"
            label="Plan and add-on requests"
            helper="Tenants waiting on a plan decision"
            value={upgrades ?? 0}
            Icon={CreditCard}
          />
          {/* Counted, not listed — there is no endpoint that says WHICH tenants expire in the
              window, so this links to the tenant list unfiltered. Adding a date filter to the
              tenant search is what would make this row land on the right rows. */}
          <ActionLink
            to="/console/tenants"
            label="Access expiring in 14 days"
            helper="Renew or contact before it lapses"
            value={Number(data?.expiringSubscriptions || 0)}
            Icon={Clock3}
            urgent
          />
          <ActionLink
            to="/console/tenants?status=PAST_DUE"
            label="In grace"
            helper="Past due and still operating — the window closes"
            value={Number(data?.pastDueTenants || 0)}
            Icon={Clock3}
            urgent
          />
          <ActionLink
            to="/console/usage"
            label="Over quota"
            helper={`${number(overview?.tenantsNearLimit)} more approaching a limit`}
            value={Number(overview?.tenantsOverLimit || 0)}
            Icon={Gauge}
          />
        </ConsolePanel>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:col-span-2 xl:grid-cols-1">
          <ConsolePanel title="Tenant health" description="Current lifecycle distribution">
            <Distribution
              rows={statusRows}
              total={statusTotal}
              colorFor={(row) => STATUS_COLORS[row.label] ?? "#94a3b8"}
            />
          </ConsolePanel>
          <ConsolePanel title="Plan mix" description="Live portfolio by subscription">
            <Distribution
              rows={planRows}
              total={planTotal}
              colorFor={(_row, index) => PLAN_COLORS[index % PLAN_COLORS.length]}
            />
          </ConsolePanel>
        </div>
      </div>

      {/* The churn early-warning. Deliberately a LIST, not a count — "14 quiet tenants" is a
          statistic, "Sharma Travels, 6 users, nothing booked" is a phone call. */}
      <ConsolePanel
        title="Gone quiet"
        description="Active, paying, and no booking confirmed this month — the earliest churn signal the data supports."
        action={<SmallLink to="/console/usage">All usage</SmallLink>}
      >
        {!usage ? (
          <p className="px-5 py-10 text-center text-sm text-muted">Usage data could not be loaded.</p>
        ) : quiet.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">
            Every active tenant has booked this month.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {quiet.slice(0, 8).map((t) => (
              <li key={t.tenantPublicId}>
                <Link
                  to={`/console/tenants/${t.tenantPublicId}`}
                  className="group flex items-center gap-3 px-5 py-3.5 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-hue-amber-soft text-hue-amber">
                    <MoonStar size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-heading">
                      {t.organizationName || t.organizationCode}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {number(t.activeUsers)} user(s) · {number(t.activeLeads)} live lead(s) · {t.plan}
                    </span>
                  </span>
                  <ArrowRight size={15} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
                </Link>
              </li>
            ))}
            {quiet.length > 8 && (
              <li className="px-5 py-3 text-xs text-muted">
                and {quiet.length - 8} more
              </li>
            )}
          </ul>
        )}
      </ConsolePanel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Bars
          title="Tenant acquisition"
          description="New accounts created by month"
          data={data?.newTenantsByMonth ?? []}
          id="grad-tenants-dash"
          from="#a855f7"
          to="#7c3aed"
        />
        <Bars
          title="Cash collected"
          description="Settled invoice value by paid month"
          data={revenueSeries}
          id="grad-revenue-dash"
          from="#34d399"
          to="#059669"
          tickFormatter={compactMoney(currency)}
          tooltipFormatter={(value) => money(value, currency)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Tenants" value={number(data?.totalTenants)} helper="All accounts, live and lapsed" Icon={Users} tone="violet" />
        <Metric label="Active" value={number(data?.activeTenants)} helper="Paying and operating" Icon={Users} tone="emerald" />
        <Metric label="Platform users" value={number(data?.totalUsers)} helper="Staff across every tenant" Icon={Users} tone="sky" />
        <Metric label="Storage used" value={`${Math.round(Number(overview?.totalStorageBytes || 0) / (1024 * 1024))} MB`} helper="Across every tenant" Icon={Gauge} tone="sky" />
      </div>
    </div>
  );
}
