import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, RotateCcw, Search, X } from "lucide-react";
import { tenantActivityService } from "../api/tenantActivityService";
import { tenantService } from "../api/tenantService";
import { ConsoleTable, ConsolePager } from "../components/ConsoleTable";

const inputCls =
  "rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus";

const USER_TYPES = ["TENANT_ADMIN", "MANAGER", "TRAVEL_AGENT", "STAFF", "SUB_AGENT"];

const EMPTY = { tenantPublicId: "", from: "", to: "", action: "", userType: "", q: "" };

const fmt = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

/** Destructive or security-shaped actions read differently from routine ones. */
const actionTone = (a) => ({
  Delete: "text-hue-rose", Login: "text-hue-sky", Logout: "text-muted",
  Settings: "text-hue-amber", Export: "text-hue-amber",
}[a] || "text-body");

/**
 * Tenant activity, across every tenant.
 *
 * <p>Deliberately a second screen rather than a tab on Audit Log. That one is the platform ledger —
 * what a SuperAdmin did TO a tenant. This is what tenants' own staff did inside their workspaces.
 * One list holding both would mix "we suspended them" with "they created a booking" and give the
 * reader no way to tell which kind of event they are looking at.
 */
export default function TenantActivity() {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({});
  const [tenants, setTenants] = useState([]);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState(null);

  const [draft, setDraft] = useState(EMPTY);
  const [applied, setApplied] = useState(EMPTY);

  useEffect(() => {
    tenantService.list({ size: 200 })
      .then((r) => setTenants(r?.rows ?? r?.data ?? []))
      .catch(() => setTenants([]));       // picker degrades to "All tenants"
    tenantActivityService.actions()
      .then((a) => setActions(a || []))
      .catch(() => setActions([]));       // dropdown degrades to "All actions"
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await tenantActivityService.list({ ...applied, page, size: 25 });
      setRows(r.rows);
      setPagination(r.pagination);
    } catch (e) {
      setError(e?.response?.data?.message || "Could not load activity logs.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [applied, page]);

  useEffect(() => { load(); }, [load]);

  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const search = () => { setPage(0); setApplied(draft); };
  const reset = () => { setPage(0); setDraft(EMPTY); setApplied(EMPTY); };
  const dirty = useMemo(() => JSON.stringify(applied) !== JSON.stringify(EMPTY), [applied]);

  const columns = useMemo(() => [
    {
      id: "time", header: "Time",
      cell: ({ row }) => <span className="whitespace-nowrap text-xs text-muted">{fmt(row.original.at)}</span>,
    },
    {
      id: "tenant", header: "Tenant",
      cell: ({ row }) => (row.original.tenantCode
        ? <span className="font-mono text-xs font-semibold text-body">{row.original.tenantCode}</span>
        : <span className="text-xs text-muted">—</span>),
    },
    {
      id: "action", header: "Action",
      cell: ({ row }) => (
        <span className={`text-xs font-semibold ${actionTone(row.original.action)}`}>
          {row.original.action || "—"}
        </span>
      ),
    },
    {
      id: "user", header: "User",
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-heading">{row.original.user || row.original.username || "—"}</div>
          {row.original.userType && <div className="text-[11px] text-muted">{row.original.userType}</div>}
        </div>
      ),
    },
    {
      id: "description", header: "What happened",
      cell: ({ row }) => (
        <span className="block max-w-[380px] truncate text-xs text-body" title={row.original.description || ""}>
          {row.original.description || "—"}
        </span>
      ),
    },
    {
      id: "actions", header: "",
      cell: ({ row }) => (
        <button
          type="button" onClick={() => setDetail(row.original.publicId)} aria-label="View activity details"
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
        <h1 className="text-xl font-bold text-heading">Tenant Activity</h1>
        <p className="text-sm text-body">
          What tenants&rsquo; own staff did inside their workspaces, across every tenant. For what the
          platform did <em>to</em> a tenant, see Audit Log.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Tenant</span>
            <select value={draft.tenantPublicId} onChange={(e) => set("tenantPublicId", e.target.value)} className={`${inputCls} w-full`}>
              <option value="">All tenants</option>
              {tenants.map((t) => (
                <option key={t.publicId} value={t.publicId}>
                  {t.organizationCode ? `${t.organizationCode} — ${t.name || ""}`.trim() : t.name || t.publicId}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Date from</span>
            <input type="date" value={draft.from} onChange={(e) => set("from", e.target.value)} className={`${inputCls} w-full`} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Date to</span>
            <input type="date" value={draft.to} onChange={(e) => set("to", e.target.value)} className={`${inputCls} w-full`} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Action</span>
            <select value={draft.action} onChange={(e) => set("action", e.target.value)} className={`${inputCls} w-full`}>
              <option value="">All actions</option>
              {actions.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">User type</span>
            <select value={draft.userType} onChange={(e) => set("userType", e.target.value)} className={`${inputCls} w-full`}>
              <option value="">All types</option>
              {USER_TYPES.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Search</span>
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={draft.q} onChange={(e) => set("q", e.target.value)}
                placeholder="user, email or description" className={`${inputCls} w-full pl-9`}
              />
            </div>
          </label>
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
          {!dirty && (
            // Said plainly, because an unbounded feed would scan the whole table to draw 25 rows.
            <span className="text-[11px] text-muted">Showing the last 30 days</span>
          )}
        </div>
      </div>

      <ConsoleTable
        columns={columns}
        rows={rows}
        state={loading ? "loading" : error ? "error" : "ready"}
        error={error}
        onRetry={load}
        filtered={dirty}
        emptyTitle="No activity"
        emptyHint="Tenant staff actions appear here as they happen."
      />
      <ConsolePager page={page} size={25} total={pagination.totalElements || 0} onPage={setPage} />

      {detail && <DetailDrawer publicId={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function DetailDrawer({ publicId, onClose }) {
  const [row, setRow] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    tenantActivityService.detail(publicId)
      .then((d) => { if (alive) setRow(d); })
      .catch((e) => { if (alive) setError(e?.response?.data?.message || "Could not load this entry."); });
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
        className="h-full w-full max-w-lg overflow-y-auto bg-page p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Activity details"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-heading">Activity details</h2>
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
            {row.description && (
              <div className="rounded-xl border border-border bg-surface p-4">
                <p className="text-sm text-heading">{row.description}</p>
              </div>
            )}
            <div className="rounded-xl border border-border bg-surface p-4">
              <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
                <KV k="When" v={fmt(row.at)} />
                <KV k="Action" v={row.action || "—"} />
                <KV k="Tenant" v={row.tenantCode || "—"} />
                <KV k="Tenant ID" v={row.tenantId ?? "—"} mono />
                <KV k="User" v={row.user || "—"} />
                <KV k="Username" v={row.username || "—"} mono />
                <KV k="Email" v={row.userEmail || "—"} />
                <KV k="Type" v={row.userType || "—"} />
                <KV k="IP" v={row.ipAddress || "—"} mono />
                <KV k="User agent" v={row.userAgent || "—"} />
              </dl>
            </div>
          </div>
        )}
      </div>
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
