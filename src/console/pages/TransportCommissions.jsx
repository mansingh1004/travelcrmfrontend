// src/console/pages/TransportCommissions.jsx
//
// The platform's earnings on transport: what has accrued, what was reversed by a cancellation, what
// has been adjusted by hand, and what has been paid out.
//
// The ledger is APPEND-ONLY. An adjustment adds a row; it never edits the accrual it corrects, and a
// reversal never mutates the original either. That is why every figure here is a balance derived
// from rows rather than a number somebody set — and why both write verbs carry step-up MFA: they
// move the platform's own reported revenue.
//
// Console-only, permanently. These are the platform's margins; no tenant surface may ever read them.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Coins, RefreshCw, Wallet } from "lucide-react";
import { transportAdminService as svc } from "../api/transportAdminService";
import { ConsolePageHeader, ConsolePanel } from "../components/ConsoleUi";
import { ConsoleTable, ConsolePager } from "../components/ConsoleTable";
import SuperAdminMfaActionModal from "../components/SuperAdminMfaActionModal";

const PAGE_SIZE = 25;

const STATUS_FILTERS = [
  ["", "All"],
  ["PENDING", "Pending"],
  ["EARNED", "Earned"],
  ["REVERSED", "Reversed"],
  ["SETTLED", "Settled"],
];

/**
 * A tone per row type, so a ledger scans as a shape rather than as a column of words. Reversals and
 * settlements are the two that must never be mistaken for an accrual, so they are the two that do
 * not share the neutral grey.
 */
const TYPE_TONE = {
  ACCRUAL: "bg-blue-50 text-blue-700",
  REVERSAL: "bg-red-50 text-red-700",
  ADJUSTMENT: "bg-amber-50 text-amber-800",
  SETTLEMENT: "bg-emerald-50 text-emerald-700",
};

const STATUS_TONE = {
  PENDING: "bg-amber-50 text-amber-800",
  EARNED: "bg-blue-50 text-blue-700",
  REVERSED: "bg-red-50 text-red-700",
  SETTLED: "bg-emerald-50 text-emerald-700",
};

const money = (v, ccy = "INR") =>
  v === null || v === undefined || v === ""
    ? "—"
    : `${ccy === "INR" ? "₹" : `${ccy} `}${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const when = (v) => (v ? new Date(v).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "—");

export default function TransportCommissions() {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({});
  const [summary, setSummary] = useState(null);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [action, setAction] = useState(null); // { kind, row, label, description, confirmLabel }
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");

  // The adjustment form. Kept beside the ledger rather than in a modal, because an adjustment is a
  // deliberate act that wants the surrounding numbers visible while it is typed.
  const [adjust, setAdjust] = useState({ orderPublicId: "", amount: "", suffix: "", reason: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [ledger, totals] = await Promise.all([
        svc.listCommissions({ page, size: PAGE_SIZE, status: status || undefined }),
        // A failed summary must not blank the ledger — the rows are the record, the tiles are a view
        // of them.
        svc.commissionSummary().catch(() => null),
      ]);
      setRows(ledger.rows);
      setPagination(ledger.pagination);
      setSummary(totals);
    } catch (e) {
      setError(e?.normalized?.message ?? "Could not load the earnings ledger.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (mfaCode) => {
    if (!action) return;
    setSaving(true);
    setActionError("");
    try {
      if (action.kind === "adjust") {
        await svc.adjustCommission(
          adjust.orderPublicId.trim(),
          {
            amount: Number(adjust.amount),
            suffix: adjust.suffix?.trim() || null,
            reason: adjust.reason?.trim() || null,
          },
          mfaCode,
        );
        setAdjust({ orderPublicId: "", amount: "", suffix: "", reason: "" });
      } else if (action.kind === "settle") {
        await svc.settleCommission(action.row.publicId, action.reference || undefined, mfaCode);
      }
      setAction(null);
      await load();
    } catch (e) {
      setActionError(e?.normalized?.message ?? "That did not go through.");
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        id: "when",
        header: "Date",
        accessorKey: "createdAt",
        cell: ({ row }) => (
          <div className="whitespace-nowrap text-xs text-muted">
            {when(row.original.effectiveDate ?? row.original.createdAt)}
          </div>
        ),
      },
      {
        id: "order",
        header: "Order",
        accessorKey: "orderCode",
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="font-semibold text-heading">{row.original.orderCode ?? "—"}</div>
            <div className="text-[11px] text-muted">{row.original.tenantCode ?? ""}</div>
          </div>
        ),
      },
      {
        id: "type",
        header: "Entry",
        accessorKey: "entryType",
        cell: ({ row }) => (
          <div className="min-w-0">
            <span
              className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                TYPE_TONE[row.original.entryType] ?? "bg-slate-100 text-slate-700"
              }`}
            >
              {row.original.entryType}
            </span>
            {row.original.reason && (
              <div className="mt-0.5 line-clamp-1 max-w-[280px] text-[11px] text-muted">{row.original.reason}</div>
            )}
          </div>
        ),
      },
      {
        id: "amount",
        header: "Amount",
        accessorKey: "amount",
        cell: ({ row }) => (
          <div className="whitespace-nowrap text-right tabular-nums font-semibold text-heading">
            {money(row.original.amount, row.original.currency)}
          </div>
        ),
      },
      {
        id: "context",
        header: "Supplier / agency",
        accessorKey: "supplierAmount",
        cell: ({ row }) => (
          <div className="whitespace-nowrap text-right tabular-nums text-xs text-muted">
            {money(row.original.supplierAmount, row.original.currency)}
            {" / "}
            {money(row.original.tenantPayable, row.original.currency)}
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorKey: "status",
        cell: ({ row }) => (
          <span
            className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              STATUS_TONE[row.original.status] ?? "bg-slate-100 text-slate-700"
            }`}
          >
            {row.original.status}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) =>
          // Only an EARNED row can be paid out. A PENDING one has not been earned yet (the journey
          // has not run), and a REVERSED or already SETTLED one has nothing left to pay.
          row.original.status === "EARNED" ? (
            <div className="flex justify-end">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActionError("");
                  setAction({
                    kind: "settle",
                    row: row.original,
                    label: "Mark as settled",
                    description: `${money(row.original.amount, row.original.currency)} on ${row.original.orderCode}. This appends a settlement row; it does not edit the accrual.`,
                    confirmLabel: "Settle",
                  });
                }}
                className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-body hover:bg-page"
              >
                Settle
              </button>
            </div>
          ) : null,
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <ConsolePageHeader
        eyebrow="Transport marketplace"
        title="Transport earnings"
        description="The platform's own margin on transport orders. Append-only: nothing here edits an earlier row."
        actions={
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-body hover:bg-page"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        }
      />

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      )}

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile icon={Coins} label="Net earning" value={money(summary.netEarning, summary.currency)} hint={`${summary.entryCount ?? 0} ledger entries`} />
          <Tile label="Pending" value={money(summary.pendingBalance, summary.currency)} hint="Accrued, journey not yet run" />
          <Tile label="Earned, unpaid" value={money(summary.earnedBalance, summary.currency)} hint="Ready to settle" />
          <Tile icon={Wallet} label="Settled" value={money(summary.settledBalance, summary.currency)} hint={`Reversed ${money(summary.reversedBalance, summary.currency)}`} />
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map(([value, label]) => (
          <button
            key={value || "all"}
            onClick={() => {
              setStatus(value);
              setPage(0);
            }}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              status === value ? "bg-accent text-white" : "border border-border text-body hover:bg-page"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <ConsolePanel>
        <ConsoleTable
          columns={columns}
          rows={rows}
          state={loading ? "loading" : "ready"}
          filtered={!!status}
          emptyTitle="No ledger entries"
          emptyHint="An approved transport order accrues the platform's earning here."
        />
        <ConsolePager page={page} size={PAGE_SIZE} total={pagination.totalElements || 0} onPage={setPage} />
      </ConsolePanel>

      <ConsolePanel>
        <div className="p-4">
          <h3 className="text-sm font-bold text-heading">Adjust an order&rsquo;s earning</h3>
          <p className="mb-4 mt-1 max-w-2xl text-xs leading-5 text-muted">
            Adds a correction row against one order — a goodwill discount, a renegotiated share, a
            keying error. It never edits the accrual, so the original figure stays readable and the
            correction stays explainable. A negative amount reduces the platform&rsquo;s earning.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Order publicId" value={adjust.orderPublicId} onChange={(v) => setAdjust((f) => ({ ...f, orderPublicId: v }))} hint="From the order's URL or the queue" />
            <Field label="Amount" type="number" value={adjust.amount} onChange={(v) => setAdjust((f) => ({ ...f, amount: v }))} hint="Negative reduces the earning" />
            <Field label="Reference suffix" value={adjust.suffix} onChange={(v) => setAdjust((f) => ({ ...f, suffix: v }))} hint="Makes the row's reference key unique" />
            <Field label="Reason" value={adjust.reason} onChange={(v) => setAdjust((f) => ({ ...f, reason: v }))} />
          </div>

          <div className="mt-3 flex justify-end">
            <button
              disabled={!adjust.orderPublicId.trim() || adjust.amount === ""}
              onClick={() => {
                setActionError("");
                setAction({
                  kind: "adjust",
                  label: "Adjust this earning",
                  description: `${money(adjust.amount)} against order ${adjust.orderPublicId.trim()}. This appends a row; the original accrual is untouched.`,
                  confirmLabel: "Adjust",
                });
              }}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              Add adjustment
            </button>
          </div>
        </div>
      </ConsolePanel>

      {action && (
        <SuperAdminMfaActionModal
          title={action.label}
          description={action.description}
          confirmLabel={action.confirmLabel}
          saving={saving}
          error={actionError}
          onClose={() => {
            setAction(null);
            setActionError("");
          }}
          onConfirm={runAction}
        />
      )}
    </div>
  );
}

function Tile({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
        {Icon && <Icon size={13} />}
        {label}
      </div>
      <div className="mt-1 text-xl font-bold tabular-nums text-heading">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted">{hint}</div>}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", hint }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-muted">{label}</span>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-body outline-none focus:ring-2 focus:ring-focus"
      />
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </label>
  );
}
