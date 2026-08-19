import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CheckCircle2,
  Database,
  Mail,
  RefreshCw,
  ServerCog,
  TimerReset,
  XCircle,
} from "lucide-react";
import { platformHealthService } from "../api/platformHealthService";
import { ConsoleTable, ConsolePager } from "../components/ConsoleTable";
import {
  ConsoleErrorState,
  ConsoleLoadingState,
  ConsolePageHeader,
  ConsolePanel,
} from "../components/ConsoleUi";

const JOB_LABELS = {
  SUBSCRIPTION_EXPIRY: "Subscription expiry",
  SUBSCRIPTION_DUNNING: "Invoice dunning",
};

const STATUS_STYLE = {
  UP: "bg-hue-emerald-soft text-hue-emerald",
  READY: "bg-hue-emerald-soft text-hue-emerald",
  SUCCEEDED: "bg-hue-emerald-soft text-hue-emerald",
  RUNNING: "bg-hue-sky-soft text-hue-sky",
  DEGRADED: "bg-hue-amber-soft text-hue-amber",
  DISABLED: "bg-hue-amber-soft text-hue-amber",
  FAILED: "bg-hue-rose-soft text-hue-rose",
  DOWN: "bg-hue-rose-soft text-hue-rose",
  ERROR: "bg-hue-rose-soft text-hue-rose",
  NEVER_RUN: "bg-surface-hover text-muted",
};

const fmtDateTime = (value) => {
  if (!value) return "Not run yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
  });
};

const fmtDuration = (value) => {
  if (value === null || value === undefined) return "—";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(value < 10000 ? 1 : 0)} s`;
};

const number = (value) => Number(value || 0).toLocaleString("en-IN");

function StatusPill({ status }) {
  const value = status || "NEVER_RUN";
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold tracking-wide ${STATUS_STYLE[value] || STATUS_STYLE.NEVER_RUN}`}>
      {value.replaceAll("_", " ")}
    </span>
  );
}

function HealthMetric({ label, value, helper, Icon, status }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-[var(--sa-card-shadow)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted">{label}</p>
          <p className="mt-2 truncate font-mono text-xl font-bold text-heading">{value}</p>
        </div>
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <Icon size={17} />
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="min-w-0 text-xs text-body">{helper}</p>
        {status && <StatusPill status={status} />}
      </div>
    </div>
  );
}

function BacklogLink({ to, label, value, helper }) {
  const urgent = Number(value) > 0;
  return (
    <Link to={to} className="group flex items-center gap-3 border-b border-border px-5 py-3.5 last:border-b-0 hover:bg-surface-hover">
      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${urgent ? "bg-hue-amber-soft text-hue-amber" : "bg-hue-emerald-soft text-hue-emerald"}`}>
        {urgent ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-heading">{label}</span>
        <span className="block truncate text-xs text-muted">{urgent ? helper : "No action waiting"}</span>
      </span>
      <span className="font-mono text-lg font-bold text-heading">{number(value)}</span>
      <ArrowRight size={14} className="text-muted transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export default function PlatformHealth() {
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({});
  const [page, setPage] = useState(0);
  const [jobKey, setJobKey] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (background = false) => {
    background ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [health, history] = await Promise.all([
        platformHealthService.summary(),
        platformHealthService.jobs({ page, size: 25, jobKey, status }),
      ]);
      setSummary(health);
      setRows(history.rows);
      setPagination(history.pagination);
    } catch (failure) {
      setError(failure?.response?.data?.message || "Platform health could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [jobKey, page, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => load(false), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (loading) return <ConsoleLoadingState label="Loading platform health…" />;
  if (error && !summary) return <ConsoleErrorState message={error} onRetry={() => load(false)} />;

  const database = summary?.database ?? {};
  const mail = summary?.mail ?? {};
  const delivery = summary?.notificationDelivery ?? {};
  const backlog = summary?.backlog ?? {};
  const jobColumns = [
    { id: "job", header: "Job", accessorKey: "jobKey",
      cell: ({ row }) => <span className="font-semibold text-heading">{JOB_LABELS[row.original.jobKey] || row.original.jobKey}</span> },
    { id: "status", header: "Status", accessorKey: "status",
      cell: ({ row }) => <StatusPill status={row.original.status} /> },
    { id: "trigger", header: "Trigger / actor", accessorKey: "trigger",
      cell: ({ row }) => (
        <div>
          <p className="font-semibold text-body">{row.original.trigger}</p>
          <p className="mt-0.5 text-xs text-muted">{row.original.actorEmail || "System scheduler"}</p>
        </div>
      ) },
    { id: "started", header: "Started", accessorKey: "startedAt",
      cell: ({ row }) => (
        <div>
          <p className="text-xs text-body">{fmtDateTime(row.original.startedAt)}</p>
          <p className="mt-0.5 font-mono text-[11px] text-muted">{fmtDuration(row.original.durationMs)}</p>
        </div>
      ) },
    { id: "result", header: "Result", accessorKey: "resultCount", meta: { numeric: true },
      cell: ({ row }) => <span className="font-bold text-heading">{row.original.resultCount ?? "—"}</span> },
    { id: "node", header: "Node / detail", enableSorting: false,
      cell: ({ row }) => (
        <div className="max-w-xs">
          <p className="font-mono text-[11px] text-muted">{row.original.nodeId}</p>
          {row.original.failureDetail && (
            <p className="mt-1 text-xs text-hue-rose"><XCircle size={12} className="mr-1 inline" />{row.original.failureDetail}</p>
          )}
        </div>
      ) },
  ];

  return (
    <div className="space-y-5">
      <ConsolePageHeader eyebrow="Platform operations" title="Platform health"
        description="Live dependency readiness, operational backlog and durable subscription-job history."
        meta={`Generated ${fmtDateTime(summary?.generatedAt)} · uptime ${fmtDuration(Number(summary?.uptimeSeconds || 0) * 1000)}`}
        actions={(
          <button type="button" onClick={() => load(true)} disabled={refreshing}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 text-xs font-semibold text-heading hover:bg-surface-hover disabled:opacity-60">
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>
        )} />

      {error && <div className="rounded-xl border border-hue-amber/30 bg-hue-amber-soft px-4 py-3 text-sm text-body">{error}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <HealthMetric label="Overall platform" value={summary?.overallStatus || "UNKNOWN"}
          helper={`${number(summary?.failedJobsLastSevenDays)} failed job(s) in 7 days`} Icon={ServerCog} status={summary?.overallStatus} />
        <HealthMetric label="Database" value={`${number(database.latencyMs)} ms`}
          helper={database.detail || "Connection state unavailable"} Icon={Database} status={database.status} />
        <HealthMetric label="Platform mail" value={mail.fromEmail || "Not configured"}
          helper={mail.detail || "Mail state unavailable"} Icon={Mail} status={mail.status} />
        <HealthMetric label="Notification delivery" value={number(delivery.tenantNotificationsLast24Hours)}
          helper={`${number(delivery.platformNotificationsLast24Hours)} platform notifications persisted in 24h`} Icon={BellRing} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <ConsolePanel title="Scheduled subscription jobs" description="Last committed result and next cron occurrence" className="xl:col-span-3"
          action={<Link to="/console/plans" className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">Manual controls <ArrowRight size={13} /></Link>}>
          <div className="divide-y divide-border">
            {(summary?.jobs || []).map((job) => (
              <div key={job.jobKey} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <TimerReset size={15} className="text-accent" />
                      <p className="text-sm font-bold text-heading">{job.label}</p>
                      <StatusPill status={job.lastRun?.status} />
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-muted">{job.cron} · {job.zoneId}</p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="font-semibold text-heading">Next {fmtDateTime(job.nextRunAt)}</p>
                    <p className="mt-1 text-muted">Last {fmtDateTime(job.lastRun?.startedAt)}</p>
                  </div>
                </div>
                {job.lastRun && (
                  <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-surface-hover p-3 text-xs sm:grid-cols-4">
                    <div><p className="text-[10px] uppercase text-muted">Trigger</p><p className="mt-1 font-semibold text-body">{job.lastRun.trigger}</p></div>
                    <div><p className="text-[10px] uppercase text-muted">Actor</p><p className="mt-1 truncate font-semibold text-body">{job.lastRun.actorEmail || "System"}</p></div>
                    <div><p className="text-[10px] uppercase text-muted">Result</p><p className="mt-1 font-mono font-semibold text-body">{job.lastRun.resultCount ?? "—"}</p></div>
                    <div><p className="text-[10px] uppercase text-muted">Duration</p><p className="mt-1 font-mono font-semibold text-body">{fmtDuration(job.lastRun.durationMs)}</p></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ConsolePanel>

        <div className="space-y-4 xl:col-span-2">
          <ConsolePanel title="Operational backlog" description="Work that currently needs an operator">
            <BacklogLink to="/console/billing?overdue=true" label="Overdue invoices" value={backlog.overdueInvoices} helper="Past-due invoices need collection follow-up" />
            <BacklogLink to="/console/upgrade-requests" label="Upgrade requests" value={backlog.pendingUpgradeRequests} helper="Tenant plan decisions are waiting" />
            <BacklogLink to="/console/hotel-requests" label="Marketplace decisions" value={backlog.marketplaceDecisions} helper="Booking or cancellation action is waiting" />
            <BacklogLink to="/console/hotel-requests" label="CRM sync failures" value={backlog.crmSyncFailures} helper="Confirmed hotel data needs recovery" />
          </ConsolePanel>

          <ConsolePanel title="Notification persistence" description="Durable in-app rows written during the last 24 hours">
            <div className="grid grid-cols-3 divide-x divide-border px-2 py-4 text-center">
              <div><p className="font-mono text-lg font-bold text-heading">{number(delivery.tenantNotificationsLast24Hours)}</p><p className="text-[10px] text-muted">Tenant</p></div>
              <div><p className="font-mono text-lg font-bold text-heading">{number(delivery.platformNotificationsLast24Hours)}</p><p className="text-[10px] text-muted">Platform</p></div>
              <div><p className="font-mono text-lg font-bold text-hue-amber">{number(delivery.unreadForCurrentOperator)}</p><p className="text-[10px] text-muted">Your unread</p></div>
            </div>
          </ConsolePanel>
        </div>
      </div>

      <ConsolePanel title="Job history" description="Manual and scheduled executions survive application and business-transaction failures">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <select value={jobKey} onChange={(event) => { setJobKey(event.target.value); setPage(0); }}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-body">
            <option value="">All subscription jobs</option>
            <option value="SUBSCRIPTION_EXPIRY">Subscription expiry</option>
            <option value="SUBSCRIPTION_DUNNING">Invoice dunning</option>
          </select>
          <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-body">
            <option value="">All statuses</option>
            <option value="RUNNING">Running</option>
            <option value="SUCCEEDED">Succeeded</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>

        <ConsoleTable
          columns={jobColumns}
          rows={rows}
          state="ready"
          filtered={Boolean(jobKey || status)}
          emptyTitle="No job runs recorded yet"
          emptyHint="Scheduled sweeps and manual runs appear here once they execute."
        />
        <ConsolePager page={page} size={25} total={pagination.totalElements || 0} onPage={setPage} />
      </ConsolePanel>
    </div>
  );
}
