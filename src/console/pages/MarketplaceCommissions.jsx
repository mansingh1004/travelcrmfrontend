// src/console/pages/MarketplaceCommissions.jsx
//
// The platform earning ledger for hotel marketplace bookings.
//
// The ledger is APPEND-ONLY and this page is shaped around that: there is no edit affordance on any
// row, anywhere. A figure that turns out to be wrong is answered with another row — an adjustment —
// because revenue that can be restated in place cannot be reconciled against anything already
// reported from it, and a commercial rule edited in March would otherwise rewrite what was earned in
// January. `status` is the one column that moves: PENDING → EARNED happens on its own once the stay
// is over, → SETTLED is the manual action below.
//
// `amount` is SIGNED — accruals positive, reversals negative, adjustments either way — so summing the
// column gives the net position with no case analysis. Nothing here flips a sign for display: a
// reversal rendered as a red positive is how someone eventually adds the column up wrong.
//
// STYLING: console realm. Semantic utilities only (bg-surface / text-heading / border-border /
// bg-accent / the hue chips) — raw slate-*/blue-* resolve to the tenant palette and would break the
// violet console theme. The tenant-side marketplace kit is deliberately NOT imported here.

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, Banknote, ChevronLeft, ChevronRight, CircleDollarSign, Coins, Landmark, Loader2,
  PlusCircle, RefreshCw, RotateCcw, Scale, Undo2, Wallet, X,
} from "lucide-react";
import { marketplaceCommissionService as svc } from "../api/marketplaceCommissionService";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { useToast } from "@shared/ui/toast";

const PAGE_SIZE = 25;

/** Mirrors CommissionEntryStatus. Full literal classes so Tailwind's scanner emits them. */
const STATUS = {
  PENDING:  { label: "Pending",  cls: "bg-hue-sky-soft text-hue-sky" },
  EARNED:   { label: "Earned",   cls: "bg-hue-emerald-soft text-hue-emerald" },
  REVERSED: { label: "Reversed", cls: "bg-hue-rose-soft text-hue-rose" },
  SETTLED:  { label: "Settled",  cls: "bg-hue-indigo-soft text-hue-indigo" },
};

/** Mirrors CommissionEntryType. SETTLEMENT is unwritten in this release but filterable already. */
const ENTRY_TYPE = {
  ACCRUAL:    { label: "Accrual",    cls: "bg-hue-violet-soft text-hue-violet" },
  REVERSAL:   { label: "Reversal",   cls: "bg-hue-rose-soft text-hue-rose" },
  ADJUSTMENT: { label: "Adjustment", cls: "bg-hue-amber-soft text-hue-amber" },
  SETTLEMENT: { label: "Settlement", cls: "bg-hue-indigo-soft text-hue-indigo" },
};

/** Only PENDING and EARNED rows can still be moved — the other two are terminal. */
const OPEN_STATUSES = new Set(["PENDING", "EARNED"]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REFERENCE_RE = /^[A-Za-z0-9._:-]+$/;

const inputCls =
  "rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading placeholder:text-muted " +
  "focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus";

/**
 * The minus sign belongs in the string, not in the colour. A red positive reads as "big number, bad
 * news" to one operator and as a debit to the next.
 */
function money(value, currency = "INR") {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const symbol = !currency || currency === "INR" ? "₹" : `${currency} `;
  const digits = Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? "-" : ""}${symbol}${digits}`;
}

/** Date-only value parsed by parts — `new Date("2026-08-03")` is UTC midnight and can slip a day. */
function fmtDate(value) {
  if (!value) return "—";
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "—";
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(value) {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function MarketplaceCommissions() {
  const { showToast } = useToast();

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState({ tenantId: "", status: "", entryType: "", from: "", to: "" });
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [settling, setSettling] = useState(null);   // the ledger row awaiting confirmation
  const [adjusting, setAdjusting] = useState(null); // {publicId, code} of the booking, or null

  /**
   * The ledger is its own tenant directory. `tenantId` here is the internal Long the backend filters
   * by, and no console API exposes it — the tenant endpoints are all keyed by publicId — so the
   * options are harvested from rows as they arrive. Names seen on any loaded page stick.
   */
  const rememberTenants = useCallback((items) => {
    setTenants((prev) => {
      const byId = new Map(prev.map((t) => [t.id, t]));
      let added = false;
      for (const row of items) {
        if (row.tenantId == null || byId.has(row.tenantId)) continue;
        byId.set(row.tenantId, { id: row.tenantId, code: row.tenantCode || `#${row.tenantId}` });
        added = true;
      }
      return added ? [...byId.values()].sort((a, b) => a.code.localeCompare(b.code)) : prev;
    });
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { items, pagination: meta } = await svc.list({ page, size: PAGE_SIZE, ...filters });
      setRows(items);
      setPagination(meta);
      rememberTenants(items);
    } catch (e) {
      setError(getErrorMessage(e, "Could not load the earning ledger."));
      setRows([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [page, filters, rememberTenants]);

  // Deliberately keyed on tenant + dates only: the summary takes no status/entryType, so re-running it
  // when those change would fetch the identical figures. See the note under the tiles.
  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      setSummary(await svc.summary({ tenantId: filters.tenantId, from: filters.from, to: filters.to }));
    } catch {
      // The tiles simply disappear rather than reporting separately: whatever broke the report broke
      // the list too, and the list already says so. What must never happen is a stale total left on
      // screen above rows it no longer describes.
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, [filters.tenantId, filters.from, filters.to]);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  // One unfiltered probe on mount so the tenant filter is usable before anyone has paged through the
  // whole ledger. 200 is the server's page cap; beyond that the harvest above fills in the rest.
  useEffect(() => {
    svc.list({ page: 0, size: 200 })
      .then(({ items }) => rememberTenants(items))
      .catch(() => { /* the filter degrades to whatever the visible page carries */ });
  }, [rememberTenants]);

  const refresh = () => { loadList(); loadSummary(); };

  const setFilter = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(0);
  };
  const clearFilters = () => {
    setFilters({ tenantId: "", status: "", entryType: "", from: "", to: "" });
    setPage(0);
  };
  const hasFilters = Object.values(filters).some(Boolean);

  const currency = summary?.currency || rows[0]?.currency || "INR";
  const totalPages = pagination?.totalPages ?? 1;
  const narrowedBeyondSummary = Boolean(filters.status || filters.entryType);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-heading">Platform earnings</h1>
          <p className="mt-0.5 text-sm text-body">
            Every rupee the platform books on a marketplace hotel. Append-only — a wrong figure is
            corrected with a new row, never by editing an old one.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setAdjusting({ publicId: "", code: "" })}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-body hover:bg-surface-hover"
          >
            <PlusCircle size={15} /> Adjustment
          </button>
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-body hover:bg-surface-hover disabled:opacity-60"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      <SummaryPanel
        summary={summary}
        loading={summaryLoading}
        currency={currency}
        narrowed={narrowedBeyondSummary}
      />

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filters.tenantId}
          onChange={(e) => setFilter("tenantId", e.target.value)}
          className={inputCls}
          title="Tenant"
        >
          <option value="">All tenants</option>
          {tenants.map((t) => <option key={t.id} value={t.id}>{t.code}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => setFilter("status", e.target.value)} className={inputCls} title="Status">
          <option value="">Any status</option>
          {Object.entries(STATUS).map(([key, s]) => <option key={key} value={key}>{s.label}</option>)}
        </select>
        <select value={filters.entryType} onChange={(e) => setFilter("entryType", e.target.value)} className={inputCls} title="Entry type">
          <option value="">Any type</option>
          {Object.entries(ENTRY_TYPE).map(([key, t]) => <option key={key} value={key}>{t.label}</option>)}
        </select>
        {/* Both bounds filter on the effective date — when the event happened, not when the row landed. */}
        <input type="date" value={filters.from} onChange={(e) => setFilter("from", e.target.value)} className={inputCls} title="Effective from" />
        <input type="date" value={filters.to} onChange={(e) => setFilter("to", e.target.value)} className={inputCls} title="Effective to" />
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm font-semibold text-muted hover:bg-surface-hover hover:text-body"
          >
            <RotateCcw size={14} /> Clear
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-border bg-surface-hover text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Booking</th>
                <th className="px-4 py-3 font-semibold">Tenant</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 text-right font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Reason</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-muted"><Loader2 size={18} className="mx-auto animate-spin" /></td></tr>
              ) : error ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center">
                  <span className="inline-flex items-start gap-1.5 text-sm text-hue-rose">
                    <AlertTriangle size={15} className="mt-px shrink-0" /> {error}
                  </span>
                </td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-muted">
                  <Coins size={26} className="mx-auto mb-2 opacity-50" />
                  {hasFilters ? "No ledger entries match these filters." : "Nothing has been earned yet."}
                </td></tr>
              ) : (
                rows.map((r) => (
                  <LedgerRow
                    key={r.publicId}
                    row={r}
                    onSettle={() => setSettling(r)}
                    onAdjust={() => setAdjusting({ publicId: r.hotelBookingPublicId, code: r.bookingCode })}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
          <span className="text-muted">
            {pagination?.totalElements ?? 0} entries · page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              disabled={page <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-strong text-body hover:bg-surface-hover disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-strong text-body hover:bg-surface-hover disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {settling && (
        <SettleModal
          entry={settling}
          onClose={() => setSettling(null)}
          onDone={(message) => { setSettling(null); showToast(message, "success"); refresh(); }}
        />
      )}

      {adjusting && (
        <AdjustModal
          booking={adjusting}
          onClose={() => setAdjusting(null)}
          onDone={(message) => { setAdjusting(null); showToast(message, "success"); refresh(); }}
        />
      )}
    </div>
  );
}

/* ── Summary ────────────────────────────────────────────────────────────────── */

function SummaryPanel({ summary, loading, currency, narrowed }) {
  if (!summary) {
    if (!loading) return null;
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface p-5 text-sm text-muted shadow-[var(--sa-card-shadow)]">
        <Loader2 size={15} className="animate-spin" /> Working out the earning report…
      </div>
    );
  }

  // Two cuts of the same rows: what happened (by type) and how real it is yet (by status). Each sums
  // to netEarning, which is why they are shown side by side rather than as one flat strip.
  const byType = [
    { key: "gross",    label: "Gross accrued", value: summary.grossAccrued,   Icon: Coins,        hue: "violet" },
    { key: "reversed", label: "Reversed",      value: summary.totalReversed,  Icon: Undo2,        hue: "rose" },
    { key: "adjusted", label: "Adjusted",      value: summary.totalAdjusted,  Icon: Scale,        hue: "amber" },
  ];
  const byStatus = [
    { key: "pending", label: "Pending",  value: summary.pendingBalance, Icon: Banknote, hue: "sky" },
    { key: "earned",  label: "Earned",   value: summary.earnedBalance,  Icon: Wallet,   hue: "emerald" },
    { key: "settled", label: "Settled",  value: summary.settledBalance, Icon: Landmark, hue: "indigo" },
  ];

  const range = summary.fromDate || summary.toDate
    ? `${summary.fromDate ? fmtDate(summary.fromDate) : "the beginning"} → ${summary.toDate ? fmtDate(summary.toDate) : "today"}`
    : "All time";

  return (
    <div className="space-y-2">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div
          className="rounded-2xl p-5 text-white shadow-[var(--sa-card-shadow)]"
          style={{ backgroundImage: "var(--sa-gradient)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide opacity-80">Net earning</span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/20">
              <CircleDollarSign size={16} strokeWidth={2.2} />
            </span>
          </div>
          <div className="mt-3 font-mono text-3xl font-bold">{money(summary.netEarning, currency)}</div>
          <p className="mt-2 text-[11px] font-medium opacity-80">
            {summary.entryCount ?? 0} {summary.entryCount === 1 ? "entry" : "entries"} · {range}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {[...byType, ...byStatus].map((t) => (
            <Tile key={t.key} label={t.label} value={money(t.value, currency)} Icon={t.Icon} hue={t.hue} />
          ))}
        </div>
      </div>

      {narrowed && (
        // Said out loud rather than left to be discovered: the endpoint takes no status/entryType, and
        // tiles that quietly describe a wider set than the rows under them are how people stop
        // trusting the number.
        <p className="text-[11px] text-muted">
          These totals cover the selected tenant and date range. The status and type filters narrow the
          rows below only — the breakdown above already splits the same rows both ways.
        </p>
      )}
    </div>
  );
}

const HUE = {
  violet:  "bg-hue-violet-soft text-hue-violet",
  indigo:  "bg-hue-indigo-soft text-hue-indigo",
  sky:     "bg-hue-sky-soft text-hue-sky",
  emerald: "bg-hue-emerald-soft text-hue-emerald",
  amber:   "bg-hue-amber-soft text-hue-amber",
  rose:    "bg-hue-rose-soft text-hue-rose",
};

function Tile({ label, value, Icon, hue = "violet" }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--sa-card-shadow)]">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-muted">{label}</span>
        <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${HUE[hue]}`}>
          <Icon size={15} strokeWidth={2.2} />
        </span>
      </div>
      <div className="mt-2.5 font-mono text-lg font-bold text-heading">{value}</div>
    </div>
  );
}

function Chip({ config, value }) {
  const c = config[value];
  return (
    <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold ${c?.cls || "bg-surface-hover text-muted"}`}>
      {c?.label || value || "—"}
    </span>
  );
}

/* ── Rows ───────────────────────────────────────────────────────────────────── */

function LedgerRow({ row, onSettle, onAdjust }) {
  const negative = Number(row.amount) < 0;
  const open = OPEN_STATUSES.has(row.status);

  return (
    <tr className="align-top hover:bg-surface-hover/60">
      <td className="whitespace-nowrap px-4 py-3">
        <div className="text-xs font-medium text-heading">{fmtDate(row.effectiveDate)}</div>
        <div className="text-[11px] text-muted">written {fmtDateTime(row.createdAt)}</div>
      </td>
      <td className="px-4 py-3">
        <div className="font-mono text-xs font-semibold text-heading">{row.bookingCode || "—"}</div>
        {/* The economics as snapshotted onto the row, not re-read from a booking that may since have
            been restated. Legitimate here and nowhere in the tenant app. */}
        <div className="text-[11px] text-muted">
          supplier {money(row.supplierTotal, row.currency)} · payable {money(row.tenantPayable, row.currency)}
        </div>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-body">{row.tenantCode || `#${row.tenantId}`}</td>
      <td className="px-4 py-3"><Chip config={ENTRY_TYPE} value={row.entryType} /></td>
      <td className={`whitespace-nowrap px-4 py-3 text-right font-mono text-sm font-bold tabular-nums ${negative ? "text-hue-rose" : "text-heading"}`}>
        {money(row.amount, row.currency)}
      </td>
      <td className="px-4 py-3"><Chip config={STATUS} value={row.status} /></td>
      <td className="max-w-[280px] px-4 py-3 text-xs text-body" title={row.reason || ""}>
        <span className="line-clamp-2">{row.reason || "—"}</span>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right">
        <div className="inline-flex gap-1.5">
          {open && (
            <button
              onClick={onSettle}
              className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-body hover:bg-surface-hover hover:text-heading"
            >
              Settle
            </button>
          )}
          <button
            onClick={onAdjust}
            title="Append a signed correction against this booking"
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-body hover:bg-surface-hover hover:text-heading"
          >
            Adjust
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ── Modals ─────────────────────────────────────────────────────────────────── */

function ModalShell({ title, subtitle, busy, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={busy ? undefined : onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-[var(--sa-card-shadow)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-heading">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-body">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-lg p-1 text-muted hover:bg-surface-hover hover:text-heading disabled:opacity-40"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Labelled({ label, hint, required, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-body">
        {label}{required && <span className="ml-0.5 text-hue-rose">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

function FormError({ message }) {
  if (!message) return null;
  return (
    <p className="mt-3 flex items-start gap-1.5 text-xs text-hue-rose">
      <AlertTriangle size={13} className="mt-px shrink-0" /> {message}
    </p>
  );
}

/**
 * Settlement is terminal, so it is confirmed rather than fired from the row. A settled row can never
 * be moved again — the only way back is another adjustment row, which is a different conversation.
 */
function SettleModal({ entry, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      await svc.settle(entry.publicId, reason.trim() || undefined);
      onDone(`Settled ${money(entry.amount, entry.currency)} on ${entry.bookingCode}.`);
    } catch (e) {
      // 409 lands here when the row moved out of PENDING/EARNED under us — a real, expected outcome
      // that the interceptor deliberately stays silent about.
      if (!isAlreadyReported(e)) setErr(getErrorMessage(e, "Could not settle this entry."));
      setBusy(false);
    }
  };

  return (
    <ModalShell title="Settle this entry" subtitle={entry.bookingCode} busy={busy} onClose={onClose}>
      <div className="mt-4 space-y-3">
        <div className="rounded-lg border border-border bg-page p-3 text-xs text-body">
          <div className="flex justify-between gap-3">
            <span className="text-muted">Amount</span>
            <span className="font-mono font-semibold text-heading">{money(entry.amount, entry.currency)}</span>
          </div>
          <div className="mt-1 flex justify-between gap-3">
            <span className="text-muted">Currently</span>
            <Chip config={STATUS} value={entry.status} />
          </div>
        </div>

        <Labelled label="Reason" hint="Goes to the audit trail only — the row's own reason is never rewritten.">
          <textarea
            rows={2}
            className={`${inputCls} w-full`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Paid in the July payout run…"
          />
        </Labelled>

        <p className="rounded-lg bg-hue-amber-soft px-3 py-2 text-[11px] text-hue-amber">
          Settled is terminal. If this turns out to be wrong the fix is a new adjustment row, not a
          change to this one.
        </p>
      </div>

      <FormError message={err} />

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} disabled={busy} className="rounded-lg px-3 py-2 text-xs font-medium text-body hover:bg-surface-hover disabled:opacity-40">
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white shadow-[var(--sa-card-shadow)] disabled:opacity-60"
          style={{ backgroundImage: "var(--sa-gradient)" }}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Landmark size={14} />} Mark settled
        </button>
      </div>
    </ModalShell>
  );
}

/**
 * A manual signed correction. Keyed by the BOOKING, so it also covers the case with no row to point
 * at — an accrual that was never written is exactly what an adjustment fixes, which is why the
 * booking can be typed in when the modal is opened from the header rather than from a row.
 */
function AdjustModal({ booking, onClose, onDone }) {
  const fromRow = Boolean(booking.publicId);
  const [bookingId, setBookingId] = useState(booking.publicId || "");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const trimmedRef = reference.trim();
  const parsedAmount = Number(amount);
  const amountOk = amount.trim() !== "" && Number.isFinite(parsedAmount) && parsedAmount !== 0;
  const referenceOk = REFERENCE_RE.test(trimmedRef) && trimmedRef.length <= 60;
  const bookingOk = UUID_RE.test(bookingId.trim());
  const valid = amountOk && Boolean(reason.trim()) && referenceOk && bookingOk;

  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      await svc.adjust(bookingId.trim(), {
        amount: parsedAmount,
        reason: reason.trim(),
        referenceSuffix: trimmedRef,
      });
      onDone(`Adjustment of ${money(parsedAmount)} recorded.`);
    } catch (e) {
      if (!isAlreadyReported(e)) setErr(getErrorMessage(e, "Could not record this adjustment."));
      setBusy(false);
    }
  };

  return (
    <ModalShell
      title="Record an adjustment"
      subtitle={fromRow ? booking.code : "A new row on a booking's ledger — nothing existing is changed."}
      busy={busy}
      onClose={onClose}
    >
      <div className="mt-4 space-y-3">
        {!fromRow && (
          <Labelled label="Booking public ID" required hint="From the hotel request queue. An adjustment can be the first row a booking has, so it is keyed by the booking rather than by a ledger entry.">
            <input
              className={`${inputCls} w-full font-mono`}
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
            />
          </Labelled>
        )}

        {!fromRow && bookingId.trim() && !bookingOk && (
          <p className="text-[11px] text-hue-rose">That is not a booking public ID.</p>
        )}

        <Labelled label="Amount" required hint="Signed. A negative writes the platform's earning down; a positive writes it up. Zero is refused — a no-op row would claim money moved when none did.">
          <input
            type="number"
            step="0.01"
            className={`${inputCls} w-full`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="-1500.00"
          />
        </Labelled>

        <Labelled label="Reason" required hint="Mandatory. An unexplained signed amount on a revenue ledger is indistinguishable from a mistake six months later.">
          <textarea
            rows={2}
            className={`${inputCls} w-full`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Goodwill write-down agreed with the tenant…"
          />
        </Labelled>

        <Labelled label="Reference" required hint="Makes a retried request land once. Two legitimate corrections on the same booking need two different references — reuse one and the second is silently swallowed as a replay of the first. Letters, digits and . _ : - only.">
          <input
            className={`${inputCls} w-full font-mono`}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            maxLength={60}
            placeholder="GOODWILL-2026-08"
          />
        </Labelled>

        {trimmedRef && !referenceOk && (
          <p className="text-[11px] text-hue-rose">
            Reference may contain only letters, digits and . _ : -
          </p>
        )}
      </div>

      <FormError message={err} />

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} disabled={busy} className="rounded-lg px-3 py-2 text-xs font-medium text-body hover:bg-surface-hover disabled:opacity-40">
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={!valid || busy}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white shadow-[var(--sa-card-shadow)] disabled:opacity-50"
          style={{ backgroundImage: "var(--sa-gradient)" }}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Scale size={14} />} Record adjustment
        </button>
      </div>
    </ModalShell>
  );
}
