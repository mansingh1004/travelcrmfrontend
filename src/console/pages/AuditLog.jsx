import { useCallback, useEffect, useState } from "react";
import {
  Search, CheckCircle2, XCircle, RotateCcw,
} from "lucide-react";
import { auditService } from "../api/auditService";
import { ConsoleTable, ConsolePager } from "../components/ConsoleTable";

const inputCls =
  "rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus";

// Actions that change security posture or are destructive — chipped amber so they stand out.
const SENSITIVE = new Set([
  "LOGIN_FAILED", "TENANT_SUSPEND", "TENANT_SOFT_DELETE", "TENANT_HARD_DELETE",
  "USER_LOCK", "USER_FORCE_RESET", "IMPERSONATION_START", "IMPERSONATION_END",
  "MAINTENANCE_TOGGLE", "DATA_EXPORT",
]);

function ActionChip({ action, success }) {
  const cls = !success
    ? "bg-hue-rose-soft text-hue-rose"
    : SENSITIVE.has(action)
      ? "bg-hue-amber-soft text-hue-amber"
      : "bg-surface-hover text-body";
  return <span className={`inline-block rounded px-2 py-0.5 font-mono text-[11px] font-semibold ${cls}`}>{action}</span>;
}

const fmt = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
};

export default function AuditLog() {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actions, setActions] = useState([]);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState({ action: "", success: "", from: "", to: "" });
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    auditService.actions().then((a) => setActions(Array.isArray(a) ? a : [])).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(0); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { rows, pagination } = await auditService.list({
        ...filters, q: debounced, page, size: 25,
      });
      setRows(rows);
      setPagination(pagination);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load audit logs.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filters, debounced, page]);

  useEffect(() => { load(); }, [load]);

  const setFilter = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(0); };
  const reset = () => {
    setFilters({ action: "", success: "", from: "", to: "" });
    setSearch("");
    setPage(0);
  };

  const auditColumns = [
    { id: "time", header: "Time", accessorKey: "createdAt",
      cell: ({ row }) => <span className="whitespace-nowrap text-xs text-muted">{fmt(row.original.createdAt)}</span> },
    { id: "actor", header: "Actor", accessorKey: "actorEmail",
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-heading">{row.original.actorEmail || "—"}</div>
          {row.original.ipAddress && <div className="font-mono text-[11px] text-muted">{row.original.ipAddress}</div>}
        </div>
      ) },
    { id: "action", header: "Action", accessorKey: "action",
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5">
          {row.original.success
            ? <CheckCircle2 size={13} className="shrink-0 text-hue-emerald" />
            : <XCircle size={13} className="shrink-0 text-hue-rose" />}
          <ActionChip action={row.original.action} success={row.original.success} />
        </span>
      ) },
    { id: "target", header: "Target", accessorKey: "targetTenantCode",
      cell: ({ row }) => (
        <span className="text-xs">
          {row.original.targetTenantCode
            ? <span className="font-mono font-semibold text-body">{row.original.targetTenantCode}</span>
            : <span className="text-muted">platform</span>}
          {row.original.targetType && <span className="ml-1 text-muted">· {row.original.targetType}</span>}
        </span>
      ) },
    { id: "details", header: "Details", enableSorting: false,
      cell: ({ row }) => <span className="block max-w-[360px] text-xs text-body">{row.original.description || "—"}</span> },
  ];
  const hasFilters = filters.action || filters.success !== "" || filters.from || filters.to || search;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-heading">Audit Log</h1>
        <p className="text-sm text-body">Every platform action — logins, tenant lifecycle, plan/billing, impersonation, locks, config.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search actor / tenant / description…" className={`${inputCls} w-full pl-9`} />
        </div>
        <select value={filters.action} onChange={(e) => setFilter("action", e.target.value)} className={inputCls}>
          <option value="">All actions</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filters.success} onChange={(e) => setFilter("success", e.target.value)} className={inputCls}>
          <option value="">Any result</option>
          <option value="true">Success</option>
          <option value="false">Failed</option>
        </select>
        <input type="date" value={filters.from} onChange={(e) => setFilter("from", e.target.value)} className={inputCls} title="From" />
        <input type="date" value={filters.to} onChange={(e) => setFilter("to", e.target.value)} className={inputCls} title="To" />
        {hasFilters && (
          <button onClick={reset} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus inline-flex items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm font-semibold text-muted hover:bg-surface-hover hover:text-body">
            <RotateCcw size={14} /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <ConsoleTable
        columns={auditColumns}
        rows={rows}
        state={loading ? "loading" : error ? "error" : "ready"}
        error={error}
        onRetry={load}
        filtered={Boolean(filters.action || filters.success !== "" || filters.from || filters.to || debounced)}
        emptyTitle="No audit entries"
        emptyHint="Platform actions are recorded here as they happen."
      />
      <ConsolePager page={page} size={20} total={pagination.totalElements || 0} onPage={setPage} />
    </div>
  );
}