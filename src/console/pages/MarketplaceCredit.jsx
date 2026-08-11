// src/console/pages/MarketplaceCredit.jsx
//
// How far ahead of settlement the platform will carry each tenant, and what they currently owe.
//
// WHY A LIMIT AT ALL. Approving a marketplace request commits the platform to a supplier on a
// tenant's behalf. Before this existed the platform could confirm an unbounded amount of business
// for a tenant who had never paid for any of it, and nothing anywhere added up the exposure.
//
// "NO LIMIT SET" IS NOT "ZERO LIMIT", and the distinction is the whole safety property. A tenant
// with no configured row is deliberately NOT gated — the platform has made no decision about them.
// Reading that absence as "zero credit" would have refused every approval on the platform the day
// the feature shipped, because on that day nobody was configured. The list therefore renders those
// tenants plainly, with a "Not enforced" chip, and only shows headroom where a ceiling is real.
//
// THE OUTSTANDING FIGURE IS DERIVED, never a stored running total: it is summed from the unsettled
// bookings themselves. A stored balance drifts on every path that can fail between the approval
// that increments it and the payment that decrements it, and nothing would detect the drift.
//
// STYLING: console realm. Semantic utilities only.

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2, RefreshCw, ShieldOff, Wallet, X } from "lucide-react";
import { marketplaceCreditService as svc } from "../api/marketplaceAdminService";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { useToast } from "@shared/ui/toast";

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading " +
  "placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-focus";

const money = (v, c = "INR") =>
  v == null ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: c, maximumFractionDigits: 2 }).format(Number(v));

export default function MarketplaceCredit() {
  const { showToast } = useToast();

  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);   // the TenantCreditDto whose limit is being set

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await svc.list());
    } catch (e) {
      if (!isAlreadyReported(e)) showToast(getErrorMessage(e, "Could not load credit positions."), "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const totalOutstanding = (rows ?? []).reduce((n, r) => n + Number(r.outstanding ?? 0), 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-heading">Tenant credit</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            What each tenant owes the platform for marketplace bookings, and how far past it the
            platform will keep confirming. Settlement is offline — record what actually arrives.
          </p>
        </div>
        <button
          type="button" onClick={load} disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-body hover:bg-surface-hover disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </header>

      {rows?.length > 0 && (
        <div className="rounded-xl border border-border bg-surface px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Total outstanding</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-heading">{money(totalOutstanding)}</p>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {loading && rows === null ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : !rows?.length ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Wallet className="h-8 w-8 text-muted" />
            <p className="text-sm font-semibold text-heading">Nobody owes anything</p>
            <p className="max-w-sm text-sm text-muted">
              No tenant has an unsettled marketplace booking or a configured credit limit.
            </p>
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="border-b border-border bg-surface-hover text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Tenant</th>
                <th className="px-4 py-2 text-right font-semibold">Outstanding</th>
                <th className="px-4 py-2 text-right font-semibold">Limit</th>
                <th className="px-4 py-2 text-right font-semibold">Available</th>
                <th className="px-4 py-2 text-right font-semibold" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.tenantId} className="border-b border-border last:border-0 hover:bg-surface-hover">
                  <td className="px-4 py-2.5">
                    <p className="font-semibold text-heading">{r.tenantName || `Tenant #${r.tenantId}`}</p>
                    {r.unsettledBookings > 0 && (
                      <p className="text-xs text-muted">
                        {r.unsettledBookings} unsettled booking{r.unsettledBookings === 1 ? "" : "s"}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-heading">
                    {money(r.outstanding, r.currency)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {r.enforced ? (
                      <span className="tabular-nums text-body">{money(r.creditLimit, r.currency)}</span>
                    ) : (
                      // The common case, and it must not read as a limit of zero.
                      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-muted ring-1 ring-inset ring-border">
                        <ShieldOff className="h-3 w-3" /> Not enforced
                      </span>
                    )}
                    {r.usingDefault && r.enforced && (
                      <span className="ml-1 text-[10px] text-muted">(default)</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {r.enforced ? (
                      <span className={`tabular-nums ${Number(r.available) <= 0 ? "font-semibold text-hue-rose" : "text-body"}`}>
                        {money(r.available, r.currency)}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => setEditing(r)}
                      className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-body hover:bg-surface-hover"
                    >
                      Set limit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <LimitDialog
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

/**
 * Set one tenant's ceiling.
 *
 * Two controls, because there are genuinely two decisions: how much, and whether to apply it at
 * all. "Record but do not enforce" exists so an operator can note an agreed figure without gating
 * on it — strictly better than the alternative people reach for, which is a 99-crore limit that
 * reads as a typo to the next person.
 */
function LimitDialog({ row, onClose, onSaved }) {
  const { showToast } = useToast();
  const [limit, setLimit] = useState(row.creditLimit ?? "0");
  const [enforced, setEnforced] = useState(!!row.enforced);
  const [notes, setNotes] = useState(row.notes ?? "");
  const [busy, setBusy] = useState(false);

  const value = Number(limit);
  const invalid = !Number.isFinite(value) || value < 0;
  // Setting a ceiling BELOW what is already owed does not claw anything back — existing bookings
  // stand. It only stops the next one. Saying so prevents an operator thinking they have undone
  // something.
  const belowOutstanding = enforced && !invalid && value < Number(row.outstanding ?? 0);

  const save = async () => {
    setBusy(true);
    try {
      await svc.setLimit(row.tenantId, { creditLimit: value, enforced, notes: notes.trim() || undefined });
      showToast("Credit limit updated.", "success");
      onSaved();
    } catch (e) {
      if (!isAlreadyReported(e)) showToast(getErrorMessage(e, "Could not update the limit."), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-heading">
              {row.tenantName || `Tenant #${row.tenantId}`}
            </h2>
            <p className="text-xs text-muted">
              Currently owes {money(row.outstanding, row.currency)}
            </p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-muted hover:text-body">
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Credit limit</span>
          <input type="number" min="0" step="0.01" className={`${inputCls} mt-1`} value={limit}
                 onChange={(e) => setLimit(e.target.value)} />
        </label>

        <label className="mt-3 flex items-start gap-2">
          <input type="checkbox" checked={enforced} onChange={(e) => setEnforced(e.target.checked)}
                 className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-current" />
          <span className="text-xs leading-relaxed text-body">
            <span className="font-semibold">Enforce this limit</span>
            <span className="block text-muted">
              Unticked, the figure is recorded but approvals are never refused on it.
            </span>
          </span>
        </label>

        <label className="mt-3 block">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Notes</span>
          <textarea rows={2} className={`${inputCls} mt-1`} value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Why this figure — who agreed it, when to revisit" />
        </label>

        {belowOutstanding && (
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-hue-amber-soft px-3 py-2 text-[11px] text-hue-amber">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
            This is below what they already owe. Existing bookings are unaffected — it only stops the
            next approval.
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose}
                  className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-body hover:bg-surface-hover">
            Cancel
          </button>
          <button onClick={save} disabled={invalid || busy}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-text hover:bg-accent-hover disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
