import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle, Banknote, CheckCircle2, CircleDollarSign,
  CreditCard, RefreshCw, RotateCcw, Search,
} from "lucide-react";
import { analyticsService } from "../api/analyticsService";
import { billingService } from "../api/billingService";
import SuperAdminMfaActionModal from "../components/SuperAdminMfaActionModal";
import { ConsoleErrorState, ConsoleLoadingState, ConsolePageHeader } from "../components/ConsoleUi";
import { ConsoleTable, ConsolePager } from "../components/ConsoleTable";

const STATUSES = ["", "UNPAID", "PAID", "CREDIT", "VOID"];
const STATUS_STYLE = {
  PAID: "bg-hue-emerald-soft text-hue-emerald",
  UNPAID: "bg-hue-amber-soft text-hue-amber",
  CREDIT: "bg-hue-sky-soft text-hue-sky",
  VOID: "bg-surface-hover text-muted",
};
const inputCls = "rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus";
const money = (value, currency = "INR") => `${currency === "INR" ? "₹" : `${currency} `}${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const date = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function Metric({ label, value, helper, Icon, danger = false }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-[var(--sa-card-shadow)]">
      <div className="flex items-start justify-between gap-3">
        <div><div className="text-xs font-medium text-muted">{label}</div><div className={`mt-2 font-mono text-xl font-bold ${danger ? "text-hue-rose" : "text-heading"}`}>{value}</div></div>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent"><Icon size={17} /></span>
      </div>
      <p className="mt-2 text-xs text-body">{helper}</p>
    </div>
  );
}

export default function Billing() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get("q") || "";
  const [search, setSearch] = useState(initialSearch);
  const [query, setQuery] = useState(initialSearch);
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [overdue, setOverdue] = useState(searchParams.get("overdue") === "true");
  const [page, setPage] = useState(() => Math.max(0, Number.parseInt(searchParams.get("page") || "0", 10) || 0));
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({});
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [action, setAction] = useState(null);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search === query) return;
      setQuery(search.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [search, query]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (status) next.set("status", status);
    if (overdue) next.set("overdue", "true");
    if (page > 0) next.set("page", String(page));
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [query, status, overdue, page, searchParams, setSearchParams]);

  const load = useCallback(async (background = false) => {
    background ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [invoices, analytics] = await Promise.all([
        billingService.list({ search: query, status, overdue, page, size: 25 }),
        analyticsService.overview(),
      ]);
      setRows(invoices.rows);
      setPagination(invoices.pagination);
      setOverview(analytics);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load platform billing.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query, status, overdue, page]);

  useEffect(() => { load(); }, [load]);

  const requestStateChange = (record) => {
    setActionError("");
    setAction({ record, nextPaid: record.status === "UNPAID" });
  };

  const confirmStateChange = async (mfaCode) => {
    if (!action) return;
    setBusy(true);
    setActionError("");
    try {
      if (action.nextPaid) await billingService.markPaid(action.record.publicId, mfaCode);
      else await billingService.markUnpaid(action.record.publicId, mfaCode);
      setAction(null);
      await load(true);
    } catch (e) {
      setActionError(e?.response?.data?.message || "Invoice state could not be updated.");
    } finally {
      setBusy(false);
    }
  };

  /* Column defs live next to the render rather than at module scope: several cells close over
     `requestStateChange`, and hoisting them out would mean threading it through as a prop. */
  const columns = [
    {
      id: "invoice",
      header: "Invoice",
      accessorKey: "invoiceNumber",
      cell: ({ row }) => (
        <div>
          <div className="font-mono text-xs font-bold text-heading">{row.original.invoiceNumber}</div>
          <div className="mt-0.5 text-xs text-muted">{row.original.plan || "Custom"}</div>
        </div>
      ),
    },
    {
      id: "tenant",
      header: "Tenant",
      accessorKey: "tenantName",
      cell: ({ row }) => (
        <div className="min-w-0">
          <Link to={`/console/tenants?q=${encodeURIComponent(row.original.tenantCode || row.original.tenantName || "")}`}
            className="truncate font-semibold text-heading hover:text-accent hover:underline">
            {row.original.tenantName || "Unknown tenant"}
          </Link>
          <div className="font-mono text-[11px] text-muted">{row.original.tenantCode || "—"}</div>
        </div>
      ),
    },
    {
      id: "dates",
      header: "Issued / due",
      accessorKey: "dueDate",
      cell: ({ row }) => (
        <div className="text-xs">
          <div className="text-body">{date(row.original.issueDate)}</div>
          <div className={row.original.overdue ? "font-semibold text-hue-rose" : "text-muted"}>
            Due {date(row.original.dueDate)}
          </div>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded-md px-2 py-1 text-[11px] font-bold ${STATUS_STYLE[row.original.status] || STATUS_STYLE.VOID}`}>
            {row.original.status}
          </span>
          {row.original.overdue && (
            <span className="rounded-md bg-hue-rose-soft px-2 py-1 text-[11px] font-bold text-hue-rose">OVERDUE</span>
          )}
        </div>
      ),
    },
    {
      id: "amount",
      header: "Amount",
      accessorKey: "amount",
      meta: { numeric: true },
      cell: ({ row }) => (
        <span className="font-bold text-heading">{money(row.original.amount, row.original.currency)}</span>
      ),
    },
    {
      id: "action",
      header: "Action",
      enableSorting: false,
      meta: { numeric: true },
      cell: ({ row }) => (
        row.original.status === "UNPAID" || row.original.status === "PAID" ? (
          <button type="button" onClick={() => requestStateChange(row.original)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-body hover:bg-surface-hover">
            {row.original.status === "UNPAID" ? <CheckCircle2 size={13} /> : <RotateCcw size={13} />}
            {row.original.status === "UNPAID" ? "Mark paid" : "Mark unpaid"}
          </button>
        ) : <span className="text-xs text-muted">Final</span>
      ),
    },
  ];

  if (loading) return <ConsoleLoadingState label="Loading platform billing…" />;
  if (error && !overview) return <ConsoleErrorState message={error} onRetry={() => load()} />;

  const currency = overview?.currency || rows[0]?.currency || "INR";

  return (
    <div className="space-y-5">
      <ConsolePageHeader eyebrow="Finance operations" title="Billing & Collections"
        description="Cross-tenant invoice ledger, overdue queue and cash-settlement controls."
        meta={`${Number(pagination.totalElements || 0).toLocaleString("en-IN")} invoice(s) in this view`}
        actions={<button type="button" onClick={() => load(true)} disabled={refreshing}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 text-xs font-semibold text-heading hover:bg-surface-hover disabled:opacity-60">
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh
        </button>} />

      {error && <div className="rounded-xl border border-hue-amber/30 bg-hue-amber-soft px-4 py-3 text-sm text-body">{error}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Outstanding" value={money(overview?.outstanding, currency)} helper="All unpaid platform invoices" Icon={CreditCard} danger={Number(overview?.outstanding) > 0} />
        <Metric label="Overdue" value={money(overview?.overdueAmount, currency)} helper={`${Number(overview?.overdueInvoices || 0)} invoice(s) past due`} Icon={AlertTriangle} danger={Number(overview?.overdueInvoices) > 0} />
        <Metric label="Collected this month" value={money(overview?.collectedThisMonth, currency)} helper="Grouped by actual settlement date" Icon={CircleDollarSign} />
        <Metric label="MRR" value={money(overview?.mrr, currency)} helper="Operational subscription run-rate" Icon={Banknote} />
      </div>

      <div className="rounded-xl border border-border bg-surface p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[230px] flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Invoice, tenant name or code…" className={`${inputCls} w-full pl-9`} />
          </div>
          <div className="flex flex-wrap gap-1 rounded-lg bg-surface-hover p-1">
            {STATUSES.map((item) => <button key={item || "ALL"} type="button" onClick={() => { setStatus(item); setPage(0); }}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${status === item ? "bg-accent text-white" : "text-body hover:bg-surface"}`}>
              {item || "ALL"}
            </button>)}
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-body">
            <input type="checkbox" checked={overdue} onChange={(e) => { setOverdue(e.target.checked); setPage(0); }} className="h-4 w-4 accent-violet-600" /> Overdue only
          </label>
        </div>
      </div>

      <ConsoleTable
        columns={columns}
        rows={rows}
        state="ready"
        filtered={Boolean(query || status || overdue)}
        emptyTitle="No invoices yet"
        emptyHint="Invoices raised against a tenant appear here."
      />
      <ConsolePager page={page} size={pagination.size || 20} total={pagination.totalElements || 0} onPage={setPage} />

      {action && <SuperAdminMfaActionModal
        title={action.nextPaid ? "Confirm invoice settlement" : "Reopen paid invoice"}
        description={action.nextPaid ? `Verify before marking ${action.record.invoiceNumber} paid.` : `Verify before reverting ${action.record.invoiceNumber} to unpaid.`}
        confirmLabel={action.nextPaid ? "Mark paid" : "Mark unpaid"}
        saving={busy} error={actionError} onClose={() => { if (!busy) setAction(null); }} onConfirm={confirmStateChange} />}
    </div>
  );
}
