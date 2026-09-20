import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, Building2, CheckCircle2, Eye, RotateCcw, Timer, X, XCircle,
} from "lucide-react";
import { requestLogService } from "../api/requestLogService";
import { hasPermission, P } from "@shared/lib/access";

const FONT = { fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" };

const cardCls = "bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm";
const inputCls =
  "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 font-medium placeholder-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none";

const HTTP_STATUSES = [200, 201, 204, 400, 401, 403, 404, 409, 422, 429, 500, 502, 503];
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const MODULES = [
  "LEADS", "BOOKINGS", "QUOTATIONS", "CUSTOMERS", "VENDORS", "REPORTS", "FLEET",
  "ACCOUNTING", "MARKETING", "TASKS", "REMINDERS", "DASHBOARD", "MASTERS",
  "COMMUNICATION", "SUBAGENT", "WHATSAPP",
];

const EMPTY = {
  from: "", to: "", outcome: "", httpStatus: "", httpMethod: "",
  module: "", user: "", endpoint: "", traceId: "", errorCode: "",
};

const fmtTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

const fmtDuration = (ms) => (ms == null ? "—" : ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)}s`);

const methodTone = (m) => ({
  GET: "text-sky-600", POST: "text-emerald-600", PUT: "text-amber-600",
  PATCH: "text-amber-600", DELETE: "text-rose-600",
}[m] || "text-slate-500");

/**
 * The Request Logs tab of Activity Reports.
 *
 * <p>A panel, not a page: it renders inside the Activity Reports shell and therefore sets no
 * background, no page width and no heading of its own. The two tabs are one subject at two
 * heights — the activity log is what people DID, this is what the browser actually CALLED to do
 * it — so they belong behind one heading rather than as two entries in the nav.
 *
 * <p><b>No tenant selector, by design.</b> The tenant is whoever is signed in, and the server
 * decides it — there is no control here that could change it and no parameter it could send that
 * the backend would honour. See spec §6 and RequestLogQueryService#resolveScope.
 */
export default function RequestLogsPanel() {
  const allowed = hasPermission(P.REQUEST_LOG_VIEW);

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({});
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState(null);

  // draft vs applied: the endpoint box would otherwise query on every keystroke.
  const [draft, setDraft] = useState(EMPTY);
  const [applied, setApplied] = useState(EMPTY);

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

  useEffect(() => { if (allowed) load(); }, [load, allowed]);

  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const search = () => { setPage(0); setApplied(draft); };
  const reset = () => { setPage(0); setDraft(EMPTY); setApplied(EMPTY); };
  const dirty = useMemo(() => JSON.stringify(applied) !== JSON.stringify(EMPTY), [applied]);
  const totalPages = Math.max(1, Math.ceil((pagination.totalElements || 0) / 25));

  if (!allowed) {
    return (
      <div className={`${cardCls} mx-auto max-w-md p-8 text-center`}>
        <h2 className="text-lg font-extrabold text-slate-800">Access denied</h2>
        <p className="mt-2 text-sm text-slate-600">
          Ask a workspace administrator to grant you <strong>View request logs</strong> under
          Reports in Access Management.
        </p>
      </div>
    );
  }

  return (
    <div style={FONT}>
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

        <p className="flex items-center gap-1.5 text-sm text-slate-500">
          <Building2 size={14} className="text-blue-600" />
          {/* Stated, not selectable — this is the workspace you signed into. */}
          Your workspace only · newest first
        </p>

        <SummaryCards summary={summary} loading={loading} />

        <div className={`${cardCls} p-4`}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Date from">
              <input type="date" value={draft.from} onChange={(e) => set("from", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Date to">
              <input type="date" value={draft.to} onChange={(e) => set("to", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Status">
              <select value={draft.outcome} onChange={(e) => set("outcome", e.target.value)} className={inputCls}>
                <option value="">All</option>
                <option value="SUCCESS">Success</option>
                <option value="ERROR">Error</option>
              </select>
            </Field>
            <Field label="Method">
              <select value={draft.httpMethod} onChange={(e) => set("httpMethod", e.target.value)} className={inputCls}>
                <option value="">All</option>
                {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="HTTP status">
              <select value={draft.httpStatus} onChange={(e) => set("httpStatus", e.target.value)} className={inputCls}>
                <option value="">All</option>
                {HTTP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Module">
              <select value={draft.module} onChange={(e) => set("module", e.target.value)} className={inputCls}>
                <option value="">All</option>
                {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="User">
              <input value={draft.user} onChange={(e) => set("user", e.target.value)} placeholder="username or id" className={inputCls} />
            </Field>
            <Field label="Endpoint">
              <input value={draft.endpoint} onChange={(e) => set("endpoint", e.target.value)} placeholder="/api/bookings" className={inputCls} />
            </Field>
            <Field label="Trace ID">
              <input value={draft.traceId} onChange={(e) => set("traceId", e.target.value)} placeholder="exact match" className={inputCls} />
            </Field>
            <Field label="Error code">
              <input value={draft.errorCode} onChange={(e) => set("errorCode", e.target.value)} placeholder="e.g. VALIDATION_FAILED" className={inputCls} />
            </Field>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button" onClick={search}
              className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-500 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-200 hover:from-blue-700 hover:to-indigo-600"
            >
              Search
            </button>
            <button
              type="button" onClick={reset}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50"
            >
              <RotateCcw size={14} /> Reset
            </button>
          </div>
        </div>

        <div className={`${cardCls} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-slate-200/60 bg-slate-50/60">
                  {["Time", "Method", "Endpoint", "User", "Status", "HTTP", "Duration", "Trace", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">Loading…</td></tr>
                )}
                {!loading && error && (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-rose-600">{error}</td></tr>
                )}
                {!loading && !error && rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">
                      {dirty ? "No requests match these filters." : "No requests logged yet."}
                    </td>
                  </tr>
                )}
                {!loading && !error && rows.map((r) => (
                  <tr key={r.publicId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{fmtTime(r.requestedAt)}</td>
                    <td className={`px-4 py-3 font-mono text-[11px] font-bold ${methodTone(r.httpMethod)}`}>{r.httpMethod}</td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs text-slate-700">{r.endpoint}</div>
                      {r.module && <div className="text-[11px] text-slate-400">{r.module}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{r.username || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold">
                        {r.outcome === "SUCCESS"
                          ? <><CheckCircle2 size={13} className="text-emerald-600" /><span className="text-emerald-700">Success</span></>
                          : <><XCircle size={13} className="text-rose-600" /><span className="text-rose-700">Error</span></>}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.httpStatus}</td>
                    <td className={`whitespace-nowrap px-4 py-3 font-mono text-xs ${r.durationMs >= 1000 ? "font-bold text-amber-600" : "text-slate-500"}`}>
                      {fmtDuration(r.durationMs)}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-400">{r.traceId || "—"}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button" onClick={() => setDetail(r.publicId)} aria-label="View request details"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(pagination.totalElements || 0) > 25 && (
            <div className="flex items-center justify-between border-t border-slate-200/60 px-4 py-3">
              <span className="text-xs font-medium text-slate-500">
                Page {page + 1} of {totalPages} · {pagination.totalElements.toLocaleString()} requests
              </span>
              <div className="flex gap-2">
                <button
                  type="button" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-40 hover:bg-slate-50"
                >
                  Previous
                </button>
                <button
                  type="button" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-40 hover:bg-slate-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {detail && <DetailModal publicId={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function SummaryCards({ summary, loading }) {
  const cards = [
    { label: "Total requests", value: summary?.totalRequests, icon: Activity, tone: "text-slate-800" },
    { label: "Successful", value: summary?.successful, icon: CheckCircle2, tone: "text-emerald-600" },
    { label: "Failed", value: summary?.failed, icon: XCircle, tone: "text-rose-600" },
    { label: "Avg response", value: summary?.averageDurationMs, icon: Timer, tone: "text-slate-800", suffix: "ms" },
    { label: `Slow (≥${summary?.slowThresholdMs ?? 1000}ms)`, value: summary?.slowRequests, icon: AlertTriangle, tone: "text-amber-600" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((c) => (
        <div key={c.label} className={`${cardCls} p-4`}>
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <c.icon size={13} /> {c.label}
          </div>
          <div className={`mt-1.5 text-2xl font-extrabold tabular-nums ${c.tone}`}>
            {loading || c.value == null ? "—" : `${c.value.toLocaleString()}${c.suffix || ""}`}
          </div>
        </div>
      ))}
    </div>
  );
}

function DetailModal({ publicId, onClose }) {
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm" onClick={onClose} style={FONT}>
      <div
        className="my-8 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Request details"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-slate-800">Request details</h2>
            {row && <p className="truncate font-mono text-xs text-slate-500">{row.httpMethod} {row.uri}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
        {!row && !error && <p className="text-sm text-slate-500">Loading…</p>}

        {row && (
          <div className="space-y-4">
            <Section title="Request">
              <KV k="Trace ID" v={row.traceId} mono />
              <KV k="Status" v={`${row.outcome} · ${row.httpStatus}`} />
              <KV k="Duration" v={fmtDuration(row.durationMs)} />
              <KV k="Module" v={row.module || "—"} />
              <KV k="Endpoint" v={row.endpoint} mono />
              <KV k="URL" v={row.uri} mono />
              <KV k="Query" v={row.queryString || "—"} mono />
              <KV k="Requested at" v={fmtTime(row.requestedAt)} />
            </Section>

            <Section title="User">
              <KV k="Username" v={row.username || "—"} />
              <KV k="Role" v={row.userRole || "—"} />
              <KV k="IP" v={row.ipAddress || "—"} mono />
              <KV k="User agent" v={row.userAgent || "—"} />
            </Section>

            <Payload title="Request headers" body={row.requestHeaders} />
            <Payload title="Request body" body={row.requestBody} />
            <Payload title="Response body" body={row.responseBody} />

            {(row.errorCode || row.errorMessage) && (
              <Section title="Error" tone="error">
                <KV k="Code" v={row.errorCode || "—"} mono />
                <KV k="Message" v={row.errorMessage || "—"} />
              </Section>
            )}

            <p className="text-[11px] text-slate-400">
              Passwords, tokens and MFA codes are removed before a row is written — a masked value
              reads as ***REDACTED***.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, tone, children }) {
  return (
    <div className={`rounded-xl border p-4 ${tone === "error" ? "border-rose-200 bg-rose-50/40" : "border-slate-200 bg-slate-50/60"}`}>
      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">{children}</dl>
    </div>
  );
}

function KV({ k, v, mono }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-slate-400">{k}</dt>
      <dd className={`truncate text-xs font-medium text-slate-700 ${mono ? "font-mono" : ""}`} title={String(v)}>{v}</dd>
    </div>
  );
}

function Payload({ title, body }) {
  if (!body) return null;
  let text = body;
  try {
    text = JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    // Plain text, truncated, or a "not stored" marker — shown as-is.
  }
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-700">
        {text}
      </pre>
    </div>
  );
}
