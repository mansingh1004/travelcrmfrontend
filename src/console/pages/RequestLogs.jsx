import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Eye, RotateCcw, Timer, X, XCircle } from "lucide-react";
import { requestLogService } from "../api/requestLogService";
import { tenantService } from "../api/tenantService";
import { ConsoleTable, ConsolePager } from "../components/ConsoleTable";

const inputCls =
  "rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus";

const HTTP_STATUSES = [200, 201, 204, 400, 401, 403, 404, 409, 422, 429, 500, 502, 503];
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

/**
 * Taken from ModuleAccessFilter.RULES on the backend — the same list that gates the endpoints is
 * what labels them here. Adding a module there means adding it here; a missing entry only costs a
 * filter option, never a wrong row.
 */
const MODULES = [
  "LEADS", "BOOKINGS", "QUOTATIONS", "CUSTOMERS", "VENDORS", "REPORTS", "FLEET",
  "ACCOUNTING", "MARKETING", "TASKS", "REMINDERS", "DASHBOARD", "MASTERS",
  "COMMUNICATION", "SUBAGENT", "WHATSAPP", "HOTEL_MARKETPLACE",
  "TRANSPORT_MARKETPLACE", "TRANSPORT_SUPPLIER", "PACKAGE_MARKETPLACE",
];

const EMPTY = {
  tenantPublicId: "", from: "", to: "", outcome: "", httpStatus: "",
  httpMethod: "", module: "", user: "", endpoint: "", traceId: "", errorCode: "",
};

const fmtTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

/** Sub-second durations read better as ms; past that, seconds. 1.8s beats 1800ms at a glance. */
const fmtDuration = (ms) => {
  if (ms == null) return "—";
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)}s`;
};

const methodTone = (m) => ({
  GET: "text-hue-sky", POST: "text-hue-emerald", PUT: "text-hue-amber",
  PATCH: "text-hue-amber", DELETE: "text-hue-rose",
}[m] || "text-muted");

export default function RequestLogs() {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({});
  const [summary, setSummary] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState(null);

  // Two copies on purpose. `draft` is what the form holds; `applied` is what the last Search
  // actually ran. Without the split every keystroke in the endpoint box would fire a query
  // against a table that grows by a row per request.
  const [draft, setDraft] = useState(EMPTY);
  const [applied, setApplied] = useState(EMPTY);

  useEffect(() => {
    tenantService.list({ size: 200 })
      .then((r) => setTenants(r?.rows ?? r?.data ?? []))
      .catch(() => setTenants([]));   // the picker degrades to "All tenants"; the page still works
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [list, sum] = await Promise.all([
        requestLogService.list(applied, { page, size: 25 }),
        requestLogService.summary(applied),
      ]);
      setRows(list.rows);
      setPagination(list.pagination);
      setSummary(sum);
    } catch (e) {
      setError(e?.response?.data?.message || "Could not load request logs.");
      setRows([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [applied, page]);

  useEffect(() => { load(); }, [load]);

  const search = () => { setPage(0); setApplied(draft); };
  const reset = () => { setPage(0); setDraft(EMPTY); setApplied(EMPTY); };
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const dirty = useMemo(() => JSON.stringify(applied) !== JSON.stringify(EMPTY), [applied]);

  const columns = useMemo(() => [
    {
      id: "time", header: "Time",
      cell: ({ row }) => <span className="whitespace-nowrap text-xs text-muted">{fmtTime(row.original.requestedAt)}</span>,
    },
    {
      id: "tenant", header: "Tenant",
      cell: ({ row }) => (row.original.tenantCode
        ? <span className="font-mono text-xs font-semibold text-body">{row.original.tenantCode}</span>
        // No tenant is not missing data — a failed login or a public link genuinely has none.
        : <span className="text-xs text-muted">—</span>),
    },
    {
      id: "request", header: "Request",
      cell: ({ row }) => (
        <div className="min-w-0">
          <span className={`font-mono text-[11px] font-bold ${methodTone(row.original.httpMethod)}`}>
            {row.original.httpMethod}
          </span>
          <span className="ml-2 font-mono text-xs text-heading">{row.original.endpoint}</span>
          {row.original.module && <div className="text-[11px] text-muted">{row.original.module}</div>}
        </div>
      ),
    },
    {
      id: "user", header: "User",
      cell: ({ row }) => <span className="text-xs text-body">{row.original.username || "—"}</span>,
    },
    {
      id: "status", header: "Status",
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          {row.original.outcome === "SUCCESS"
            ? <CheckCircle2 size={13} className="shrink-0 text-hue-emerald" />
            : <XCircle size={13} className="shrink-0 text-hue-rose" />}
          <span className="font-mono text-xs text-body">{row.original.httpStatus}</span>
        </span>
      ),
    },
    {
      id: "duration", header: "Duration",
      cell: ({ row }) => (
        <span className={`whitespace-nowrap font-mono text-xs ${row.original.durationMs >= 1000 ? "font-semibold text-hue-amber" : "text-muted"}`}>
          {fmtDuration(row.original.durationMs)}
        </span>
      ),
    },
    {
      id: "trace", header: "Trace ID",
      cell: ({ row }) => <span className="font-mono text-[11px] text-muted">{row.original.traceId || "—"}</span>,
    },
    {
      id: "actions", header: "",
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => setDetail(row.original.publicId)}
          aria-label="View request details"
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-md p-1.5 text-muted hover:bg-surface-hover hover:text-heading"
        >
          <Eye size={15} />
        </button>
      ),
    },
  ], []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-heading">Request Logs</h1>
        <p className="text-sm text-body">
          Every API request across all tenants, newest first. Select a tenant to narrow the view.
        </p>
      </div>

      <SummaryCards summary={summary} loading={loading} />

      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Tenant">
            <select value={draft.tenantPublicId} onChange={(e) => set("tenantPublicId", e.target.value)} className={`${inputCls} w-full`}>
              <option value="">All tenants</option>
              {tenants.map((t) => (
                <option key={t.publicId} value={t.publicId}>
                  {t.organizationCode ? `${t.organizationCode} — ${t.name || ""}`.trim() : t.name || t.publicId}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date from">
            <input type="date" value={draft.from} onChange={(e) => set("from", e.target.value)} className={`${inputCls} w-full`} />
          </Field>
          <Field label="Date to">
            <input type="date" value={draft.to} onChange={(e) => set("to", e.target.value)} className={`${inputCls} w-full`} />
          </Field>
          <Field label="Status">
            <select value={draft.outcome} onChange={(e) => set("outcome", e.target.value)} className={`${inputCls} w-full`}>
              <option value="">All</option>
              <option value="SUCCESS">Success</option>
              <option value="ERROR">Error</option>
            </select>
          </Field>
          <Field label="Method">
            <select value={draft.httpMethod} onChange={(e) => set("httpMethod", e.target.value)} className={`${inputCls} w-full`}>
              <option value="">All</option>
              {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="HTTP status">
            <select value={draft.httpStatus} onChange={(e) => set("httpStatus", e.target.value)} className={`${inputCls} w-full`}>
              <option value="">All</option>
              {HTTP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Module">
            <select value={draft.module} onChange={(e) => set("module", e.target.value)} className={`${inputCls} w-full`}>
              <option value="">All</option>
              {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="User">
            <input value={draft.user} onChange={(e) => set("user", e.target.value)} placeholder="username or id" className={`${inputCls} w-full`} />
          </Field>
          <Field label="Endpoint">
            <input value={draft.endpoint} onChange={(e) => set("endpoint", e.target.value)} placeholder="/api/bookings" className={`${inputCls} w-full`} />
          </Field>
          <Field label="Trace ID">
            <input value={draft.traceId} onChange={(e) => set("traceId", e.target.value)} placeholder="exact match" className={`${inputCls} w-full`} />
          </Field>
          <Field label="Error code">
            <input value={draft.errorCode} onChange={(e) => set("errorCode", e.target.value)} placeholder="MODULE_NOT_ENABLED" className={`${inputCls} w-full`} />
          </Field>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button" onClick={search}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent hover:opacity-90"
          >
            Search
          </button>
          <button
            type="button" onClick={reset}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus inline-flex items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm font-semibold text-muted hover:bg-surface-hover hover:text-body"
          >
            <RotateCcw size={14} /> Reset
          </button>
        </div>
      </div>

      <ConsoleTable
        columns={columns}
        rows={rows}
        state={loading ? "loading" : error ? "error" : "ready"}
        error={error}
        onRetry={load}
        filtered={dirty}
        emptyTitle="No requests logged"
        emptyHint="Requests appear here within a second or two of being served."
      />
      <ConsolePager page={page} size={25} total={pagination.totalElements || 0} onPage={setPage} />

      {detail && <DetailDrawer publicId={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}

/** Metrics for the CURRENT filters — see requestLogService.summary. */
function SummaryCards({ summary, loading }) {
  const cards = [
    { label: "Total requests", value: summary?.totalRequests, icon: Activity, tone: "text-body" },
    { label: "Successful", value: summary?.successful, icon: CheckCircle2, tone: "text-hue-emerald" },
    { label: "Failed", value: summary?.failed, icon: XCircle, tone: "text-hue-rose" },
    { label: "Avg response", value: summary?.averageDurationMs, icon: Timer, tone: "text-body", suffix: "ms" },
    {
      label: `Slow (≥${summary?.slowThresholdMs ?? 1000}ms)`,
      value: summary?.slowRequests, icon: AlertTriangle, tone: "text-hue-amber",
    },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
            <c.icon size={13} /> {c.label}
          </div>
          <div className={`mt-1.5 text-2xl font-bold tabular-nums ${c.tone}`}>
            {loading || c.value == null ? "—" : `${c.value.toLocaleString()}${c.suffix || ""}`}
          </div>
        </div>
      ))}
    </div>
  );
}

function DetailDrawer({ publicId, onClose }) {
  const [row, setRow] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    requestLogService.detail(publicId)
      .then((d) => { if (alive) setRow(d); })
      .catch((e) => { if (alive) setError(e?.response?.data?.message || "Could not load this request."); });
    return () => { alive = false; };
  }, [publicId]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-2xl overflow-y-auto bg-page p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Request details"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-heading">Request details</h2>
            {row && (
              <p className="font-mono text-xs text-muted">
                {row.httpMethod} {row.uri}
              </p>
            )}
          </div>
          <button
            type="button" onClick={onClose} aria-label="Close"
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-md p-1.5 text-muted hover:bg-surface-hover hover:text-heading"
          >
            <X size={18} />
          </button>
        </div>

        {error && <p className="rounded-lg border border-border bg-surface p-4 text-sm text-hue-rose">{error}</p>}
        {!row && !error && <p className="text-sm text-muted">Loading…</p>}

        {row && (
          <div className="space-y-4">
            <Section title="Request">
              <KV k="Tenant" v={row.tenantCode || "—"} />
              <KV k="Tenant ID" v={row.tenantId ?? "—"} mono />
              <KV k="Trace ID" v={row.traceId} mono />
              <KV k="Status" v={`${row.outcome} · ${row.httpStatus}`} />
              <KV k="Duration" v={fmtDuration(row.durationMs)} />
              <KV k="Endpoint" v={row.endpoint} mono />
              <KV k="URL" v={row.uri} mono />
              <KV k="Query" v={row.queryString || "—"} mono />
              <KV k="Module" v={row.module || "—"} />
              <KV k="Requested at" v={fmtTime(row.requestedAt)} />
              <KV k="Recorded at" v={fmtTime(row.recordedAt)} />
              <KV k="Environment" v={row.environment || "—"} />
              <KV k="Service" v={row.serviceName || "—"} />
            </Section>

            <Section title="User">
              <KV k="User ID" v={row.userId ?? "—"} mono />
              <KV k="Username" v={row.username || "—"} />
              <KV k="Role" v={row.userRole || "—"} />
              <KV k="Type" v={row.userType || "—"} />
              <KV k="IP" v={row.ipAddress || "—"} mono />
              <KV k="User agent" v={row.userAgent || "—"} />
            </Section>

            <Payload title="Request headers" body={row.requestHeaders} />
            <Payload title="Request body" body={row.requestBody} />
            <Payload title="Response headers" body={row.responseHeaders} />
            <Payload title="Response body" body={row.responseBody} />

            {(row.errorCode || row.errorMessage || row.stackTrace) && (
              <Section title="Error" tone="error">
                <KV k="Code" v={row.errorCode || "—"} mono />
                <KV k="Message" v={row.errorMessage || "—"} />
                <KV k="Exception" v={row.exceptionClass || "—"} mono />
              </Section>
            )}
            {row.stackTrace && <Payload title="Stack trace" body={row.stackTrace} />}

            <p className="text-[11px] text-muted">
              Passwords, tokens, MFA codes and the lead-ingest webhook credential are removed before
              a row is written — a masked value reads as ***REDACTED***.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, tone, children }) {
  return (
    <div className={`rounded-xl border bg-surface p-4 ${tone === "error" ? "border-hue-rose/40" : "border-border"}`}>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{title}</h3>
      <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">{children}</dl>
    </div>
  );
}

function KV({ k, v, mono }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted">{k}</dt>
      <dd className={`truncate text-xs text-heading ${mono ? "font-mono" : ""}`} title={String(v)}>{v}</dd>
    </div>
  );
}

/** Payloads can be long and are not always JSON, so they scroll in their own box. */
function Payload({ title, body }) {
  if (!body) return null;
  let text = body;
  try {
    text = JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    // Already plain text, truncated mid-object, or a "not stored" marker — show it as it is.
  }
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{title}</h3>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-page p-3 font-mono text-[11px] leading-relaxed text-body">
        {text}
      </pre>
    </div>
  );
}
