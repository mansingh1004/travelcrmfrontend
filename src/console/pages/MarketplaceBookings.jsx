// src/console/pages/MarketplaceBookings.jsx
//
// The SuperAdmin queue: tenant hotel booking requests, and the decision on each.
//
// This is where the platform's own economics live — `supplierTotal` and `platformEarning` appear
// here and in no tenant-facing surface. The split is enforced by two separate DTOs on the backend
// (MarketplaceBookingAdminDto vs MarketplaceBookingTenantDto), not by hiding fields in the UI.
//
// STYLING: console realm. Semantic utilities only (`bg-surface`, `text-heading`, `border-border`,
// `bg-accent`) — raw `slate-*`/`blue-*` resolve to the tenant palette and would break the violet
// console theme. The tenant-side marketplace kit is deliberately NOT imported here.
//
// This release is ON_REQUEST: there is no rate calendar and no allotment, so the operator phones the
// hotel and enters the final amounts at approval time. Approve and reject both take a step-up MFA
// code — approving commits the platform to a supplier and puts a payable on a tenant's books.

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, Building2, Check, ChevronRight, Loader2, RefreshCw, Search, X,
} from "lucide-react";
import SuperAdminMfaActionModal from "../components/SuperAdminMfaActionModal";
import { marketplaceBookingService as svc } from "../api/marketplaceBookingService";
import { getErrorMessage } from "@shared/api/apiError";

const PAGE_SIZE = 25;

/** Mirrors MarketplaceBookingStatus. Unmapped values fall through to a neutral chip. */
const STATUS = {
  REQUESTED:                { label: "Requested",     dot: "bg-amber-500" },
  UNDER_REVIEW:             { label: "Under review",  dot: "bg-blue-500" },
  TENANT_APPROVAL_REQUIRED: { label: "Awaiting tenant", dot: "bg-orange-500" },
  TENANT_ACCEPTED:          { label: "Tenant accepted", dot: "bg-indigo-500" },
  CONFIRMED:                { label: "Confirmed",     dot: "bg-emerald-500" },
  REJECTED:                 { label: "Rejected",      dot: "bg-red-500" },
  CANCEL_REQUESTED:         { label: "Cancelling",    dot: "bg-orange-500" },
  CANCELLED:                { label: "Cancelled",     dot: "bg-slate-400" },
  EXPIRED:                  { label: "Expired",       dot: "bg-slate-400" },
};

const TABS = [
  { value: "REQUESTED",       label: "New" },
  { value: "UNDER_REVIEW",    label: "Under review" },
  { value: "TENANT_ACCEPTED", label: "Tenant accepted" },
  { value: "CONFIRMED",       label: "Confirmed" },
  { value: "REJECTED",        label: "Rejected" },
  { value: "",                label: "All" },
];

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading " +
  "placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus";

const money = (v, currency = "INR") => {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return (currency === "INR" ? "₹" : `${currency} `) + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtDate = (v) => {
  if (!v) return "—";
  const [y, m, d] = String(v).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "—";
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export default function MarketplaceBookings() {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("REQUESTED");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selected, setSelected] = useState(null);   // the row open in the decision panel
  const [action, setAction] = useState(null);       // {kind:'approve'|'reject', payload}
  const [mfaOpen, setMfaOpen] = useState(false);
  const [mfaError, setMfaError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { items, pagination: meta } = await svc.list({ page, size: PAGE_SIZE, status });
      setRows(items);
      setPagination(meta);
    } catch (e) {
      setError(getErrorMessage(e, "Could not load the queue."));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => { load(); }, [load]);

  const takeUnderReview = async (row) => {
    setBusy(true);
    try {
      const updated = await svc.review(row.publicId);
      setSelected(updated ?? { ...row, status: "UNDER_REVIEW" });
      await load();
    } catch (e) {
      setError(getErrorMessage(e, "Could not mark this under review."));
    } finally {
      setBusy(false);
    }
  };

  const runDecision = async (mfaCode) => {
    if (!action || !selected) return;
    setBusy(true);
    setMfaError("");
    try {
      if (action.kind === "approve") {
        await svc.approve(selected.publicId, action.payload, mfaCode);
      } else {
        await svc.reject(selected.publicId, action.reason, mfaCode);
      }
      setMfaOpen(false);
      setAction(null);
      setSelected(null);
      await load();
    } catch (e) {
      // Stays inside the MFA modal: a wrong code must be retryable without losing the amounts the
      // operator just typed.
      setMfaError(getErrorMessage(e, "Could not complete this decision."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-heading">Hotel booking requests</h1>
          <p className="mt-0.5 text-sm text-muted">
            Confirm with the supplier, then enter the final amounts. Only an approval here confirms a
            tenant's hotel.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-body hover:bg-surface-hover disabled:opacity-60"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* Filter tabs hit the server's own `status` param, so they narrow the real dataset. */}
      <div className="mb-4 flex flex-wrap items-center gap-1 border-b border-border">
        {TABS.map((t) => {
          const active = status === t.value;
          return (
            <button
              key={t.value || "all"}
              onClick={() => { setStatus(t.value); setPage(0); }}
              className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
                active
                  ? "border-accent font-semibold text-heading"
                  : "border-transparent text-muted hover:text-heading"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="mb-4 flex items-start gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-700 ring-1 ring-red-500/20">
          <AlertTriangle size={13} className="mt-px shrink-0" /> {error}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted">
            <Loader2 size={16} className="animate-spin" /> <span className="text-sm">Loading…</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-16 text-center">
            <Building2 size={22} className="text-muted" />
            <p className="text-sm font-semibold text-heading">Nothing in this queue</p>
            <p className="text-xs text-muted">Requests appear here as tenants send them.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.publicId}>
                <button
                  onClick={() => setSelected(r)}
                  className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-surface-hover"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-heading">{r.hotelName}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {[r.tenantName || r.tenantCode, r.cityName, r.bookingCode].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="hidden w-40 shrink-0 sm:block">
                    <p className="text-xs text-body">{fmtDate(r.checkIn)} → {fmtDate(r.checkOut)}</p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {r.nights}n · {r.rooms} room{r.rooms === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="hidden w-32 shrink-0 text-right md:block">
                    <p className="text-xs tabular-nums text-body">{money(r.quotedTenantPayable ?? r.tenantPayable, r.currency)}</p>
                    <p className="mt-0.5 text-[11px] text-muted">quoted</p>
                  </div>
                  <StatusChip status={r.status} />
                  <ChevronRight size={15} className="shrink-0 text-muted" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
            <p className="text-[11px] tabular-nums text-muted">
              Page {pagination.page + 1} of {pagination.totalPages} · {pagination.totalElements} total
            </p>
            <div className="flex gap-2">
              <PagerBtn disabled={pagination.first} onClick={() => setPage((p) => p - 1)}>Previous</PagerBtn>
              <PagerBtn disabled={pagination.last} onClick={() => setPage((p) => p + 1)}>Next</PagerBtn>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <DecisionPanel
          row={selected}
          busy={busy}
          onClose={() => setSelected(null)}
          onReview={() => takeUnderReview(selected)}
          onApprove={(payload) => { setAction({ kind: "approve", payload }); setMfaError(""); setMfaOpen(true); }}
          onReject={(reason) => { setAction({ kind: "reject", reason }); setMfaError(""); setMfaOpen(true); }}
        />
      )}

      {mfaOpen && (
        <SuperAdminMfaActionModal
          title={action?.kind === "approve" ? "Confirm this booking" : "Reject this request"}
          description={
            action?.kind === "approve"
              ? "This commits the platform to the supplier and puts the payable on the tenant's books."
              : "The tenant is notified and the hotel line on their booking is cancelled."
          }
          confirmLabel={action?.kind === "approve" ? "Approve" : "Reject"}
          saving={busy}
          error={mfaError}
          onClose={busy ? undefined : () => setMfaOpen(false)}
          onConfirm={runDecision}
        />
      )}
    </div>
  );
}

function StatusChip({ status }) {
  const c = STATUS[status];
  return (
    <span className="inline-flex w-36 shrink-0 items-center justify-end gap-1.5 text-xs text-body">
      <span className={`h-1.5 w-1.5 rounded-full ${c?.dot ?? "bg-slate-400"}`} />
      {c?.label ?? status ?? "—"}
    </span>
  );
}

function PagerBtn({ disabled, onClick, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-body hover:bg-surface-hover disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/**
 * The decision surface. Approve needs both amounts because this release has no rate calendar — the
 * operator has just phoned the hotel and is recording what was actually agreed.
 */
function DecisionPanel({ row, busy, onClose, onReview, onApprove, onReject }) {
  const [supplierTotal, setSupplierTotal] = useState(row.supplierTotal ?? "");
  const [tenantPayable, setTenantPayable] = useState(row.tenantPayable ?? row.quotedTenantPayable ?? "");
  const [confirmationNumber, setConfirmationNumber] = useState(row.supplierConfirmationNumber ?? "");
  const [cancellationTerms, setCancellationTerms] = useState(row.cancellationTerms ?? "");
  const [internalNotes, setInternalNotes] = useState(row.internalNotes ?? "");
  const [rejectReason, setRejectReason] = useState("");
  const [mode, setMode] = useState(null);           // null | 'approve' | 'reject'

  const s = Number(supplierTotal);
  const t = Number(tenantPayable);
  const amountsValid = Number.isFinite(s) && Number.isFinite(t) && s >= 0 && t > 0;
  // Mirrors the server check: confirming a sale the platform loses money on must be deliberate.
  const marginOk = amountsValid && t >= s;
  const earning = marginOk ? t - s : null;

  const decided = row.status === "CONFIRMED" || row.status === "REJECTED" || row.status === "CANCELLED" || row.status === "EXPIRED";

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-slate-950/40" onClick={busy ? undefined : onClose} />
      <aside className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-border bg-page shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-surface px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-heading">{row.hotelName}</h2>
            <p className="mt-0.5 truncate text-xs text-muted">
              {[row.tenantName || row.tenantCode, row.bookingCode].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-muted hover:bg-surface-hover hover:text-heading" aria-label="Close">
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 px-5 py-4">
          <div className="mb-4 flex items-center gap-2">
            <StatusChip status={row.status} />
          </div>

          <Section title="Request">
            <KV k="Stay" v={`${fmtDate(row.checkIn)} → ${fmtDate(row.checkOut)} · ${row.nights} night${row.nights === 1 ? "" : "s"}`} />
            <KV k="Rooms" v={`${row.rooms} · ${row.adults} adult${row.adults === 1 ? "" : "s"}${row.children > 0 ? ` · ${row.children} child` : ""}`} />
            <KV k="Room / meal" v={[row.roomName, row.mealPlan].filter(Boolean).join(" · ") || "Tenant left it to us"} />
            <KV k="Lead guest" v={[row.leadGuestName, row.leadGuestPhone, row.leadGuestEmail].filter(Boolean).join(" · ")} />
            {row.specialRequests && <KV k="Requests" v={row.specialRequests} />}
            <KV k="City" v={[row.cityName, row.countryCode].filter(Boolean).join(", ")} />
          </Section>

          <Section title="Money">
            <KV k="Tenant quoted" v={money(row.quotedTenantPayable, row.currency)} />
            <KV k="Tenant sells at" v={money(row.tenantCustomerSellingAmount, row.currency)} />
            {row.supplierTotal != null && <KV k="Supplier total" v={money(row.supplierTotal, row.currency)} />}
            {row.platformEarning != null && <KV k="Platform earning" v={money(row.platformEarning, row.currency)} />}
          </Section>

          {row.crmSyncState && row.crmSyncState !== "SYNCED" && (
            <p className="mb-4 flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 ring-1 ring-amber-500/20">
              <AlertTriangle size={13} className="mt-px shrink-0" />
              CRM sync {row.crmSyncState.toLowerCase()}
              {row.crmSyncAttempts ? ` after ${row.crmSyncAttempts} attempt${row.crmSyncAttempts === 1 ? "" : "s"}` : ""}
              {row.crmSyncError ? ` — ${row.crmSyncError}` : ""}
            </p>
          )}

          {row.rejectionReason && <KV k="Rejected because" v={row.rejectionReason} />}

          {/* ── Actions ────────────────────────────────────────────────── */}
          {decided ? (
            <p className="mt-4 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted">
              This request is already decided. No further action is available here.
            </p>
          ) : (
            <div className="mt-5">
              {row.status === "REQUESTED" && (
                <button
                  onClick={onReview}
                  disabled={busy}
                  className="mb-3 inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-body hover:bg-surface-hover disabled:opacity-60"
                >
                  <Search size={15} /> Take under review
                </button>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setMode(mode === "approve" ? null : "approve")}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                    mode === "approve" ? "bg-accent text-accent-text" : "border border-border bg-surface text-body hover:bg-surface-hover"
                  }`}
                >
                  <Check size={15} /> Approve
                </button>
                <button
                  onClick={() => setMode(mode === "reject" ? null : "reject")}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                    mode === "reject" ? "bg-red-600 text-white" : "border border-border bg-surface text-body hover:bg-surface-hover"
                  }`}
                >
                  <X size={15} /> Reject
                </button>
              </div>

              {mode === "approve" && (
                <div className="mt-4 space-y-3 rounded-lg border border-border bg-surface p-4">
                  <Labelled label="Supplier total" required hint="What the platform owes the hotel. Never shown to the tenant.">
                    <input type="number" min="0" step="0.01" className={inputCls} value={supplierTotal}
                           onChange={(e) => setSupplierTotal(e.target.value)} placeholder="0.00" />
                  </Labelled>
                  <Labelled label="Tenant payable" required hint="What the tenant owes the platform. Must be at least the supplier total.">
                    <input type="number" min="0" step="0.01" className={inputCls} value={tenantPayable}
                           onChange={(e) => setTenantPayable(e.target.value)} placeholder="0.00" />
                  </Labelled>

                  {amountsValid && !marginOk && (
                    <p className="flex items-start gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-[11px] text-red-700 ring-1 ring-red-500/20">
                      <AlertTriangle size={13} className="mt-px shrink-0" />
                      Tenant payable is below the supplier total — the platform would take a loss. The
                      server rejects this too.
                    </p>
                  )}
                  {earning !== null && (
                    <p className="text-[11px] text-muted">
                      Platform earning <span className="font-semibold text-heading">{money(earning, row.currency)}</span>
                      {row.quotedTenantPayable != null && Number(row.quotedTenantPayable) !== t && (
                        <> · differs from the tenant's quote of {money(row.quotedTenantPayable, row.currency)} — they will see the new amount</>
                      )}
                    </p>
                  )}

                  <Labelled label="Hotel confirmation number">
                    <input className={inputCls} maxLength={100} value={confirmationNumber}
                           onChange={(e) => setConfirmationNumber(e.target.value)} placeholder="From the hotel" />
                  </Labelled>
                  <Labelled label="Cancellation terms" hint="Frozen onto the booking — later policy edits will not rewrite it.">
                    <textarea rows={2} className={inputCls} value={cancellationTerms}
                              onChange={(e) => setCancellationTerms(e.target.value)} />
                  </Labelled>
                  <Labelled label="Internal notes" hint="Platform-only. Never reaches the tenant.">
                    <textarea rows={2} className={inputCls} value={internalNotes}
                              onChange={(e) => setInternalNotes(e.target.value)} />
                  </Labelled>

                  <button
                    disabled={!marginOk || busy}
                    onClick={() =>
                      onApprove({
                        supplierTotal: s,
                        tenantPayable: t,
                        supplierConfirmationNumber: confirmationNumber.trim() || undefined,
                        cancellationTermsSnapshot: cancellationTerms.trim() || undefined,
                        internalNotes: internalNotes.trim() || undefined,
                      })
                    }
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-text hover:bg-accent-hover disabled:opacity-50"
                  >
                    <Check size={15} /> Approve &amp; confirm
                  </button>
                </div>
              )}

              {mode === "reject" && (
                <div className="mt-4 space-y-3 rounded-lg border border-border bg-surface p-4">
                  <Labelled label="Reason" hint="Shown to the tenant. Their booking is left in place so they can try another hotel.">
                    <textarea rows={3} className={inputCls} value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="Sold out for these dates…" />
                  </Labelled>
                  <button
                    disabled={!rejectReason.trim() || busy}
                    onClick={() => onReject(rejectReason.trim())}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    <X size={15} /> Reject request
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-5">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function KV({ k, v }) {
  return (
    <div className="flex gap-3 text-xs">
      <span className="w-32 shrink-0 text-muted">{k}</span>
      <span className="min-w-0 flex-1 text-body">{v || "—"}</span>
    </div>
  );
}

function Labelled({ label, hint, required, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-body">
        {label}{required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}
