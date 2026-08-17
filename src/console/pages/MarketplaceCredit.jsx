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
import { AlertTriangle, Check, Loader2, RefreshCw, ShieldOff, X } from "lucide-react";
import { marketplaceCreditService as svc } from "../api/marketplaceAdminService";
import { marketplaceBookingService } from "../api/marketplaceBookingService";
import SuperAdminMfaActionModal from "../components/SuperAdminMfaActionModal";
import { ConsoleTable } from "../components/ConsoleTable";
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
  const [settling, setSettling] = useState(null); // the TenantCreditDto being settled against

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

  const creditColumns = [
    {
      id: "tenant",
      header: "Tenant",
      accessorKey: "tenantName",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-heading">{row.original.tenantName || `Tenant #${row.original.tenantId}`}</p>
          {row.original.unsettledBookings > 0 && (
            <p className="text-xs text-muted">
              {row.original.unsettledBookings} unsettled booking{row.original.unsettledBookings === 1 ? "" : "s"}
            </p>
          )}
        </div>
      ),
    },
    {
      id: "outstanding",
      header: "Outstanding",
      accessorKey: "outstanding",
      meta: { numeric: true },
      cell: ({ row }) => (
        <span className={Number(row.original.outstanding) > 0 ? "font-semibold text-hue-rose" : "text-heading"}>
          {money(row.original.outstanding, row.original.currency)}
        </span>
      ),
    },
    {
      id: "limit",
      header: "Limit",
      accessorKey: "creditLimit",
      meta: { numeric: true },
      cell: ({ row }) => (
        <>
          {row.original.enforced ? (
            <span className="text-body">{money(row.original.creditLimit, row.original.currency)}</span>
          ) : (
            // The common case, and it must not read as a limit of zero.
            <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-muted ring-1 ring-inset ring-border">
              <ShieldOff className="h-3 w-3" /> Not enforced
            </span>
          )}
          {row.original.usingDefault && row.original.enforced && (
            <span className="ml-1 text-[10px] text-muted">(default)</span>
          )}
        </>
      ),
    },
    {
      id: "available",
      header: "Available",
      accessorKey: "available",
      meta: { numeric: true },
      cell: ({ row }) => row.original.enforced ? (
        <span className={Number(row.original.available) <= 0 ? "font-semibold text-hue-rose" : "text-body"}>
          {money(row.original.available, row.original.currency)}
        </span>
      ) : <span className="text-muted">—</span>,
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      meta: { numeric: true },
      cell: ({ row }) => (
        <div className="flex justify-end gap-1.5">
          {/* Settle first and primary: a credit screen whose only action raises the ceiling can watch
              a balance grow but never shrink. */}
          <button type="button" onClick={() => setSettling(row.original)}
            disabled={Number(row.original.outstanding ?? 0) <= 0}
            title={Number(row.original.outstanding ?? 0) <= 0 ? "Nothing outstanding" : undefined}
            className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-accent-text hover:bg-accent-hover disabled:opacity-40">
            Settle
          </button>
          <button type="button" onClick={() => setEditing(row.original)}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-body hover:bg-surface-hover">
            Set limit
          </button>
        </div>
      ),
    },
  ];

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

      <ConsoleTable
        columns={creditColumns}
        rows={rows ?? []}
        state={loading && rows === null ? "loading" : "ready"}
        density="compact"
        emptyTitle="Nobody owes anything"
        emptyHint="No tenant has an unsettled marketplace booking or a configured credit limit."
      />

      {editing && (
        <LimitDialog
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      {settling && (
        <SettleDialog
          row={settling}
          onClose={() => setSettling(null)}
          onSettled={load}
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
  // PUT /super-admin/marketplace/credit/{tenantId} is @RequireSuperAdminStepUp
  // (MARKETPLACE_CREDIT_LIMIT_CHANGE), so the save must carry a 6-digit code or the server rejects it
  // with 400 on every deployment where the local dev bypass is off.
  const [mfaOpen, setMfaOpen] = useState(false);
  const [mfaError, setMfaError] = useState("");

  const value = Number(limit);
  const invalid = !Number.isFinite(value) || value < 0;
  // Setting a ceiling BELOW what is already owed does not claw anything back — existing bookings
  // stand. It only stops the next one. Saying so prevents an operator thinking they have undone
  // something.
  const belowOutstanding = enforced && !invalid && value < Number(row.outstanding ?? 0);

  const save = async (mfaCode) => {
    setBusy(true);
    setMfaError("");
    try {
      await svc.setLimit(row.tenantId, { creditLimit: value, enforced, notes: notes.trim() || undefined }, mfaCode);
      setMfaOpen(false);
      showToast("Credit limit updated.", "success");
      onSaved();
    } catch (e) {
      // Shown inside the step-up dialog rather than as a toast: the operator is still at the code
      // field, and a wrong or expired code has to be retryable without losing the form.
      setMfaError(getErrorMessage(e, "Could not update the limit."));
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
          <button onClick={() => { setMfaError(""); setMfaOpen(true); }} disabled={invalid || busy}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-text hover:bg-accent-hover disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save
          </button>
        </div>
      </div>

      {mfaOpen && (
        <SuperAdminMfaActionModal
          title="Confirm credit limit"
          description={
            enforced
              ? `This caps what ${row.organizationName || "this tenant"} can owe on marketplace bookings. Existing bookings stand — it only gates the next approval.`
              : "This records a limit without applying it. Nothing will be blocked until it is enforced."
          }
          confirmLabel="Save limit"
          saving={busy}
          error={mfaError}
          onClose={busy ? undefined : () => setMfaOpen(false)}
          onConfirm={save}
        />
      )}
    </div>
  );
}

/**
 * Record money that actually arrived against one of a tenant's unsettled bookings.
 *
 * WHY THIS EXISTS. `recordPayment` and `reversePayment` were fully built server-side and step-up
 * guarded, the client wrappers existed, and nothing in the console called either. The only action on
 * this page raised the ceiling — so an operator could watch a tenant's outstanding grow and had no way
 * to bring it down when the bank transfer landed. Settlement is offline in this release (transfer,
 * cheque, an existing arrangement), so recording it is an operator act, not a gateway callback.
 *
 * TWO REQUESTS, NOT ONE. "Still owes" is PENDING or PART_PAID and the admin list filter takes a single
 * payment status, so both are fetched in parallel and merged. The alternative — pull every booking the
 * tenant ever made and filter in the browser — is the truncation trap this console already has
 * elsewhere: it stops telling the truth the moment a tenant passes one page of history.
 */
function SettleDialog({ row, onClose, onSettled }) {
  const { showToast } = useToast();
  const [bookings, setBookings] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState("");
  const [receivedOn, setReceivedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [writeOffRemainder, setWriteOffRemainder] = useState(false);
  const [mfaOpen, setMfaOpen] = useState(false);
  const [mfaError, setMfaError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadBookings = useCallback(async () => {
    setLoadError("");
    try {
      const [pending, partPaid] = await Promise.all([
        marketplaceBookingService.list({ tenantId: row.tenantId, paymentStatus: "PENDING", size: 50 }),
        marketplaceBookingService.list({ tenantId: row.tenantId, paymentStatus: "PART_PAID", size: 50 }),
      ]);
      // Oldest stay first: the point of a settlement queue is to clear what has been owed longest.
      const merged = [...(pending.items ?? []), ...(partPaid.items ?? [])]
        .sort((a, b) => String(a.checkIn ?? "").localeCompare(String(b.checkIn ?? "")));
      setBookings(merged);
    } catch (e) {
      setLoadError(getErrorMessage(e, "Could not load the unsettled bookings for this tenant."));
      setBookings([]);
    }
  }, [row.tenantId]);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  const value = Number(amount);
  const invalid = !Number.isFinite(value) || value <= 0;

  const record = async (mfaCode) => {
    setBusy(true);
    setMfaError("");
    try {
      await svc.recordPayment(selected.publicId, {
        amount: value,
        receivedOn,
        reference: reference.trim() || undefined,
        note: note.trim() || undefined,
        writeOffRemainder,
      }, mfaCode);
      setMfaOpen(false);
      setSelected(null);
      setAmount("");
      setReference("");
      setNote("");
      setWriteOffRemainder(false);
      showToast("Payment recorded.", "success");
      await loadBookings();
      onSettled();
    } catch (e) {
      setMfaError(getErrorMessage(e, "Could not record the payment."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-2xl rounded-xl border border-border bg-surface p-5 shadow-xl"
           onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-start justify-between">
          <h2 className="text-base font-bold text-heading">Settle — {row.tenantName}</h2>
          <button onClick={onClose} className="rounded p-1 text-muted hover:text-body" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-4 text-xs text-muted">
          {money(row.outstanding, row.currency)} outstanding across {row.unsettledBookings} booking(s).
          Recording a receipt here reduces what this tenant owes.
        </p>

        {loadError && (
          <p className="mb-3 rounded-lg bg-hue-rose-soft px-3 py-2 text-sm text-hue-rose">{loadError}</p>
        )}

        {bookings === null ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading unsettled bookings…
          </div>
        ) : bookings.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">Nothing unsettled for this tenant.</p>
        ) : (
          <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 border-b border-border bg-surface-hover text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Booking</th>
                  <th className="px-3 py-2 text-left font-semibold">Stay</th>
                  <th className="px-3 py-2 text-right font-semibold">Payable</th>
                  <th className="px-3 py-2 text-left font-semibold">Payment</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.publicId}
                      className={`border-b border-border last:border-0 ${selected?.publicId === b.publicId ? "bg-accent-soft" : ""}`}>
                    <td className="px-3 py-2">
                      <p className="font-semibold text-heading">{b.hotelName || "—"}</p>
                      <p className="font-mono text-[11px] text-muted">{b.bookingCode || String(b.publicId || "").slice(0, 8)}</p>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">{b.checkIn} → {b.checkOut}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-heading">
                      {money(b.tenantPayable, b.currency || row.currency)}
                    </td>
                    <td className="px-3 py-2 text-xs text-body">{b.paymentStatus}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(b);
                          // Prefill the full payable: settling in full is the common case, and a part
                          // payment is then a deliberate edit rather than something to retype.
                          setAmount(String(b.tenantPayable ?? ""));
                        }}
                        className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-body hover:bg-surface-hover"
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selected && (
          <div className="mt-4 space-y-3 rounded-lg border border-border bg-page p-3">
            <p className="text-xs font-semibold text-heading">
              Recording against {selected.hotelName} · {money(selected.tenantPayable, selected.currency || row.currency)} payable
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold text-body">Amount received</span>
                <input className={`${inputCls} mt-1`} value={amount} inputMode="decimal"
                       onChange={(e) => setAmount(e.target.value)} />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-body">Received on</span>
                <input type="date" className={`${inputCls} mt-1`} value={receivedOn}
                       onChange={(e) => setReceivedOn(e.target.value)} />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-body">Reference</span>
                <input className={`${inputCls} mt-1`} value={reference} placeholder="UTR / cheque no."
                       onChange={(e) => setReference(e.target.value)} />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-body">Note</span>
                <input className={`${inputCls} mt-1`} value={note}
                       onChange={(e) => setNote(e.target.value)} />
              </label>
            </div>
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={writeOffRemainder} className="mt-0.5 h-3.5 w-3.5 accent-current"
                     onChange={(e) => setWriteOffRemainder(e.target.checked)} />
              <span className="text-xs text-body">
                Write off the remainder
                <span className="block text-[11px] text-muted">
                  Settles the booking even though less than the payable arrived — for an agreed short
                  settlement. Leave this off and the balance stays outstanding.
                </span>
              </span>
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setSelected(null)}
                      className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-body hover:bg-surface-hover">
                Cancel
              </button>
              <button onClick={() => { setMfaError(""); setMfaOpen(true); }} disabled={invalid || busy}
                      className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-text hover:bg-accent-hover disabled:opacity-50">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Record payment
              </button>
            </div>
          </div>
        )}
      </div>

      {mfaOpen && (
        <SuperAdminMfaActionModal
          title="Confirm payment"
          description={`This records ${money(value, selected?.currency || row.currency)} received against ${selected?.hotelName}, reducing what ${row.tenantName} owes the platform.`}
          confirmLabel="Record payment"
          saving={busy}
          error={mfaError}
          onClose={busy ? undefined : () => setMfaOpen(false)}
          onConfirm={record}
        />
      )}
    </div>
  );
}
