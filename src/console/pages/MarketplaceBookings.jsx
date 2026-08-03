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
// hotel and enters the final amounts at approval time — at approval, at revision, and at
// cancellation, because none of those numbers is derivable from data the platform holds.
//
// Step-up MFA guards exactly the three calls that move money: approve, reject and cancel. Requesting
// a revision and the voucher actions carry no code, and that asymmetry is deliberate — putting
// friction on the safe alternative to approving a moved price is how you push an operator towards
// approving it instead.

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, Ban, Building2, Check, ChevronRight, Download, FileText, Loader2, PencilLine,
  RefreshCw, Search, Undo2, X,
} from "lucide-react";
import SuperAdminMfaActionModal from "../components/SuperAdminMfaActionModal";
import { marketplaceBookingService as svc } from "../api/marketplaceBookingService";
import { getErrorMessage } from "@shared/api/apiError";

const PAGE_SIZE = 25;

// Pre-filled, not enforced — the server has its own default and its own floor of one hour. Two
// working days is long enough for a tenant to reach their customer and short enough that the
// supplier's price is still the one being offered.
const DEFAULT_REVISION_HOURS = 48;

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

/** The voucher lifecycle is a second axis, not a booking state — see VoucherStatus on the backend. */
const VOUCHER = {
  NOT_ISSUED: { label: "Not issued", dot: "bg-slate-400" },
  ISSUED:     { label: "Issued",     dot: "bg-emerald-500" },
  REVOKED:    { label: "Revoked",    dot: "bg-red-500" },
};

// CANCEL_REQUESTED sits next to the other queues the platform owes an answer to, not with the
// terminal states: the room is still held with the supplier until an operator settles the charge.
const TABS = [
  { value: "REQUESTED",        label: "New" },
  { value: "UNDER_REVIEW",     label: "Under review" },
  { value: "TENANT_ACCEPTED",  label: "Tenant accepted" },
  { value: "CANCEL_REQUESTED", label: "Cancel requested" },
  { value: "CONFIRMED",        label: "Confirmed" },
  { value: "REJECTED",         label: "Rejected" },
  { value: "",                 label: "All" },
];

/** The three step-up actions, and what each one actually does to somebody's money. */
const MFA_COPY = {
  approve: {
    title: "Confirm this booking",
    description: "This commits the platform to the supplier and puts the payable on the tenant's books.",
    confirmLabel: "Approve",
  },
  reject: {
    title: "Reject this request",
    description: "The tenant is notified and the hotel line on their booking is cancelled.",
    confirmLabel: "Reject",
  },
  cancel: {
    title: "Settle this cancellation",
    description: "This fixes what the supplier retained and what the tenant is refunded. It cannot be undone.",
    confirmLabel: "Cancel booking",
  },
};

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

/** Revision and voucher timestamps carry a time that matters — an expiry to the day is no expiry. */
const fmtDateTime = (v) => {
  if (!v) return "—";
  const dt = new Date(v);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
};

/** A revision the tenant can no longer accept — the server refuses it, so say so before they chase. */
const revisionExpired = (row) =>
  !!row.revisionExpiresAt && new Date(row.revisionExpiresAt).getTime() < Date.now();

export default function MarketplaceBookings() {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("REQUESTED");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selected, setSelected] = useState(null);   // the row open in the decision panel
  const [action, setAction] = useState(null);       // {kind:'approve'|'reject'|'cancel', payload}
  const [mfaOpen, setMfaOpen] = useState(false);
  const [mfaError, setMfaError] = useState("");
  const [busy, setBusy] = useState(false);
  // Errors from the actions that run without leaving the panel. The page-level banner sits behind
  // it, so on a narrow viewport a 409 there would be invisible — and every one of these can 409.
  const [panelError, setPanelError] = useState("");

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

  /**
   * Every panel action that needs no MFA. They all answer with the updated admin DTO, so the panel
   * is refreshed from the response rather than closed — an operator who has just issued a voucher
   * usually wants to download it next.
   */
  const runPanelAction = async (call, fallbackMessage) => {
    setBusy(true);
    setPanelError("");
    try {
      const updated = await call();
      if (updated) setSelected(updated);
      await load();
      return true;
    } catch (e) {
      setPanelError(getErrorMessage(e, fallbackMessage));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const takeUnderReview = (row) =>
    runPanelAction(() => svc.review(row.publicId), "Could not mark this under review.");

  const requestRevision = (payload) =>
    runPanelAction(
      () => svc.requestRevision(selected.publicId, payload),
      "Could not send the revised price."
    );

  const issueVoucher = () =>
    runPanelAction(() => svc.issueVoucher(selected.publicId), "Could not issue the voucher.");

  const revokeVoucher = (reason) =>
    runPanelAction(() => svc.revokeVoucher(selected.publicId, reason), "Could not revoke the voucher.");

  const downloadVoucher = async () => {
    setBusy(true);
    setPanelError("");
    try {
      const blob = await svc.voucherPdf(selected.publicId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hotel-voucher-${selected.voucherNumber || selected.bookingCode || selected.publicId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setPanelError(getErrorMessage(e, "Could not download the voucher."));
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
      } else if (action.kind === "cancel") {
        await svc.cancel(selected.publicId, action.payload, mfaCode);
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
                    {/* A tenant is waiting on us with a room still held at the hotel — it must read
                        as work owed, not as one more row in a list. */}
                    {r.status === "CANCEL_REQUESTED" && r.cancelRequestedAt && (
                      <p className="mt-1 truncate text-[11px] font-semibold text-amber-700">
                        Cancel requested {fmtDateTime(r.cancelRequestedAt)}
                        {r.cancelRequestReason ? ` — ${r.cancelRequestReason}` : ""}
                      </p>
                    )}
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
          error={panelError}
          onClose={() => { setSelected(null); setPanelError(""); }}
          onReview={() => takeUnderReview(selected)}
          onApprove={(payload) => { setAction({ kind: "approve", payload }); setMfaError(""); setMfaOpen(true); }}
          onReject={(reason) => { setAction({ kind: "reject", reason }); setMfaError(""); setMfaOpen(true); }}
          onRevise={requestRevision}
          onCancel={(payload) => { setAction({ kind: "cancel", payload }); setMfaError(""); setMfaOpen(true); }}
          onIssueVoucher={issueVoucher}
          onRevokeVoucher={revokeVoucher}
          onDownloadVoucher={downloadVoucher}
        />
      )}

      {mfaOpen && (
        <SuperAdminMfaActionModal
          title={MFA_COPY[action?.kind]?.title ?? "Confirm"}
          description={MFA_COPY[action?.kind]?.description}
          confirmLabel={MFA_COPY[action?.kind]?.confirmLabel ?? "Confirm"}
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

/** Sits beside the status chip rather than replacing it — the two axes are independent. */
function VoucherChip({ status }) {
  const c = VOUCHER[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold text-body">
      <span className={`h-1.5 w-1.5 rounded-full ${c?.dot ?? "bg-slate-400"}`} />
      Voucher {(c?.label ?? status).toLowerCase()}
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
 * The decision surface. Every amount here is typed, not computed: this release has no rate calendar
 * and no machine-readable cancellation policy, so what the hotel charges — on approval, on a
 * repricing, on a cancellation — is something an operator has just learned by phoning them.
 */
function DecisionPanel({
  row, busy, error, onClose, onReview, onApprove, onReject, onRevise, onCancel,
  onIssueVoucher, onRevokeVoucher, onDownloadVoucher,
}) {
  const [supplierTotal, setSupplierTotal] = useState(row.supplierTotal ?? "");
  const [tenantPayable, setTenantPayable] = useState(row.tenantPayable ?? row.quotedTenantPayable ?? "");
  const [confirmationNumber, setConfirmationNumber] = useState(row.supplierConfirmationNumber ?? "");
  const [cancellationTerms, setCancellationTerms] = useState(row.cancellationTerms ?? "");
  const [internalNotes, setInternalNotes] = useState(row.internalNotes ?? "");
  const [rejectReason, setRejectReason] = useState("");
  const [revokeReason, setRevokeReason] = useState("");
  const [mode, setMode] = useState(null);           // null | 'approve' | 'reject' | 'revise' | 'cancel' | 'revoke'

  const s = Number(supplierTotal);
  const t = Number(tenantPayable);
  const amountsValid = Number.isFinite(s) && Number.isFinite(t) && s >= 0 && t > 0;
  // Mirrors the server check: confirming a sale the platform loses money on must be deliberate.
  const marginOk = amountsValid && t >= s;
  const earning = marginOk ? t - s : null;

  // Each of these mirrors a predicate on MarketplaceBookingStatus, so a button the server would
  // refuse never renders. TENANT_APPROVAL_REQUIRED is missing from `canApprove` on purpose — that
  // is the whole point of the revision flow: an offer the tenant has not answered must not be
  // confirmable, or the price could be raised and approved in the same breath.
  const st = row.status;
  const canApprove = st === "REQUESTED" || st === "UNDER_REVIEW" || st === "TENANT_ACCEPTED";
  const canRevise  = canApprove || st === "TENANT_APPROVAL_REQUIRED";
  // The server would also allow rejecting a CANCEL_REQUESTED booking. We don't offer it: that room
  // is already held with a supplier, and the honest answer there is a settled cancellation.
  const canReject  = canRevise;
  const committed  = st === "CONFIRMED" || st === "CANCEL_REQUESTED";
  const canCancel  = committed;

  const voucher = row.voucherStatus ?? "NOT_ISSUED";
  const canIssueVoucher  = committed && voucher !== "ISSUED";
  const canRevokeVoucher = voucher === "ISSUED";
  // The platform copy renders before issue, stamped as a preview — an operator has to be able to
  // read the document before committing to it. The tenant route requires ISSUED; this one doesn't.
  const canDownloadVoucher = committed || !!row.voucherNumber;

  const nothingToDo =
    !canApprove && !canReject && !canRevise && !canCancel &&
    !canIssueVoucher && !canRevokeVoucher && !canDownloadVoucher;

  const toggle = (next) => setMode((m) => (m === next ? null : next));

  // The no-MFA actions resolve truthy only when the server accepted. Collapsing the form on failure
  // would throw away everything the operator typed on the way to a 409 they can still act on.
  const run = async (fn) => {
    if (await fn()) setMode(null);
  };

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
            {voucher !== "NOT_ISSUED" && <VoucherChip status={voucher} />}
          </div>

          {/* A tenant waiting on the platform, with the supplier still holding the room. Above the
              fold, not filed under a heading further down. */}
          {st === "CANCEL_REQUESTED" && (
            <div className="mb-4 rounded-lg bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700 ring-1 ring-amber-500/20">
              <p className="flex items-start gap-1.5 font-semibold">
                <AlertTriangle size={13} className="mt-px shrink-0" />
                The tenant asked to cancel {row.cancelRequestedAt ? `on ${fmtDateTime(row.cancelRequestedAt)}` : ""}
              </p>
              {row.cancelRequestReason && <p className="mt-1 pl-[18px]">“{row.cancelRequestReason}”</p>}
              <p className="mt-1 pl-[18px] text-[11px]">
                The room is still held with the supplier until the charge is settled below.
              </p>
            </div>
          )}

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

          {row.revisionRequestedAt && (
            <Section title={`Price revision${row.revisionCount > 1 ? ` · ${row.revisionCount} sent` : ""}`}>
              <KV k="Was" v={money(row.revisionPreviousPayable, row.currency)} />
              <KV k="Revised payable" v={money(row.revisedTenantPayable, row.currency)} />
              <KV k="Revised supplier" v={money(row.revisedSupplierTotal, row.currency)} />
              <KV k="Told the tenant" v={row.priceRevisionReason} />
              {row.revisedCancellationTerms && <KV k="Revised terms" v={row.revisedCancellationTerms} />}
              <KV k="Sent" v={fmtDateTime(row.revisionRequestedAt)} />
              <KV k="Valid until" v={fmtDateTime(row.revisionExpiresAt)} />
              {row.revisionRespondedAt && <KV k="Answered" v={fmtDateTime(row.revisionRespondedAt)} />}
              {st === "TENANT_APPROVAL_REQUIRED" && revisionExpired(row) && (
                <p className="flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 ring-1 ring-amber-500/20">
                  <AlertTriangle size={13} className="mt-px shrink-0" />
                  This offer has expired — the tenant can no longer accept it. Re-check availability
                  and send a fresh revision.
                </p>
              )}
            </Section>
          )}

          {(row.cancelledAt || row.cancellationCharge != null) && (
            <Section title="Cancellation">
              {row.cancelRequestedAt && <KV k="Tenant asked" v={fmtDateTime(row.cancelRequestedAt)} />}
              {row.cancelRequestReason && <KV k="Their reason" v={row.cancelRequestReason} />}
              {row.cancelledAt && <KV k="Settled" v={fmtDateTime(row.cancelledAt)} />}
              {row.cancellationReason && <KV k="Settled because" v={row.cancellationReason} />}
              <KV k="Supplier retained" v={money(row.cancellationCharge, row.currency)} />
              <KV k="Tenant refund" v={money(row.tenantRefundAmount, row.currency)} />
            </Section>
          )}

          {(voucher !== "NOT_ISSUED" || committed) && (
            <Section title="Voucher">
              <KV k="Status" v={VOUCHER[voucher]?.label ?? voucher} />
              {row.voucherNumber && <KV k="Number" v={row.voucherNumber} />}
              {row.voucherIssuedAt && <KV k="Issued" v={fmtDateTime(row.voucherIssuedAt)} />}
              {row.voucherRevokedAt && <KV k="Revoked" v={fmtDateTime(row.voucherRevokedAt)} />}
            </Section>
          )}

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
          {/* Rendered inside the panel, not on the page behind it: the panel covers the viewport on
              anything narrow, and a 409 the operator cannot see is a button that does nothing. */}
          {error && (
            <p className="mt-4 flex items-start gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-700 ring-1 ring-red-500/20">
              <AlertTriangle size={13} className="mt-px shrink-0" /> {error}
            </p>
          )}

          {nothingToDo ? (
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

              <div className="flex flex-wrap gap-2">
                {canApprove && (
                  <button
                    onClick={() => toggle("approve")}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                      mode === "approve" ? "bg-accent text-accent-text" : "border border-border bg-surface text-body hover:bg-surface-hover"
                    }`}
                  >
                    <Check size={15} /> Approve
                  </button>
                )}
                {canRevise && (
                  <button
                    onClick={() => toggle("revise")}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                      mode === "revise" ? "bg-accent text-accent-text" : "border border-border bg-surface text-body hover:bg-surface-hover"
                    }`}
                  >
                    <PencilLine size={15} /> Revise price
                  </button>
                )}
                {canReject && (
                  <button
                    onClick={() => toggle("reject")}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                      mode === "reject" ? "bg-red-600 text-white" : "border border-border bg-surface text-body hover:bg-surface-hover"
                    }`}
                  >
                    <X size={15} /> Reject
                  </button>
                )}
                {canCancel && (
                  <button
                    onClick={() => toggle("cancel")}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                      mode === "cancel" ? "bg-red-600 text-white" : "border border-border bg-surface text-body hover:bg-surface-hover"
                    }`}
                  >
                    <Ban size={15} /> Cancel booking
                  </button>
                )}
              </div>

              {(canIssueVoucher || canRevokeVoucher || canDownloadVoucher) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {canIssueVoucher && (
                    <button
                      onClick={onIssueVoucher}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-body hover:bg-surface-hover disabled:opacity-60"
                    >
                      <FileText size={15} /> {voucher === "REVOKED" ? "Re-issue voucher" : "Issue voucher"}
                    </button>
                  )}
                  {canRevokeVoucher && (
                    <button
                      onClick={() => toggle("revoke")}
                      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                        mode === "revoke" ? "bg-red-600 text-white" : "border border-border bg-surface text-body hover:bg-surface-hover"
                      }`}
                    >
                      <Undo2 size={15} /> Revoke
                    </button>
                  )}
                  {canDownloadVoucher && (
                    <button
                      onClick={onDownloadVoucher}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-body hover:bg-surface-hover disabled:opacity-60"
                    >
                      <Download size={15} /> {voucher === "ISSUED" ? "Download" : "Preview PDF"}
                    </button>
                  )}
                </div>
              )}

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

              {mode === "revise" && (
                <ReviseForm row={row} busy={busy} onSubmit={(payload) => run(() => onRevise(payload))} />
              )}

              {mode === "cancel" && <CancelForm row={row} busy={busy} onSubmit={onCancel} />}

              {mode === "revoke" && (
                <div className="mt-4 space-y-3 rounded-lg border border-border bg-surface p-4">
                  <Labelled
                    label="Why is this voucher being withdrawn?"
                    hint="The number is kept — a guest may still be holding the printed copy, and the front desk quoting it has to land on this booking."
                  >
                    <textarea rows={2} className={inputCls} value={revokeReason}
                              onChange={(e) => setRevokeReason(e.target.value)}
                              placeholder="Reissuing with a corrected guest name…" />
                  </Labelled>
                  <button
                    disabled={busy}
                    onClick={() => run(() => onRevokeVoucher(revokeReason.trim() || undefined))}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    <Undo2 size={15} /> Revoke voucher
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

/**
 * Put a revised price to the tenant. The reason is required because it is the only field that turns
 * two numbers into a decision the tenant can make — they have to explain the change to their own
 * customer, and "the platform raised it" is not an explanation.
 */
function ReviseForm({ row, busy, onSubmit }) {
  // Seeded from whatever is live, including an earlier revision: a repricing is usually a nudge to
  // a number that already exists, and retyping both invites a transcription error.
  const [supplier, setSupplier] = useState(row.revisedSupplierTotal ?? row.supplierTotal ?? "");
  const [payable, setPayable] = useState(
    row.revisedTenantPayable ?? row.tenantPayable ?? row.quotedTenantPayable ?? ""
  );
  const [reason, setReason] = useState("");
  const [terms, setTerms] = useState(row.revisedCancellationTerms ?? "");
  const [validForHours, setValidForHours] = useState(DEFAULT_REVISION_HOURS);
  const [notes, setNotes] = useState("");

  const s = Number(supplier);
  const t = Number(payable);
  const amountsValid =
    supplier !== "" && payable !== "" && Number.isFinite(s) && Number.isFinite(t) && s >= 0 && t > 0;
  const marginOk = amountsValid && t >= s;
  const hours = Number(validForHours);
  const hoursOk = validForHours === "" || (Number.isFinite(hours) && hours >= 1);
  const ready = marginOk && hoursOk && reason.trim().length > 0 && !busy;

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-border bg-surface p-4">
      <p className="text-[11px] text-muted">
        The request moves to <span className="font-semibold text-heading">Awaiting tenant</span> and
        cannot be approved until they answer. Nothing is committed to the supplier by sending this.
      </p>

      <Labelled label="Revised supplier total" required hint="SuperAdmin-only — never echoed to the tenant.">
        <input type="number" min="0" step="0.01" className={inputCls} value={supplier}
               onChange={(e) => setSupplier(e.target.value)} placeholder="0.00" />
      </Labelled>
      <Labelled label="Revised tenant payable" required hint="The number the tenant is being asked to accept.">
        <input type="number" min="0" step="0.01" className={inputCls} value={payable}
               onChange={(e) => setPayable(e.target.value)} placeholder="0.00" />
      </Labelled>

      {amountsValid && !marginOk && (
        <p className="flex items-start gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-[11px] text-red-700 ring-1 ring-red-500/20">
          <AlertTriangle size={13} className="mt-px shrink-0" />
          The revised payable is below the revised supplier total — the platform would take a loss.
          The server rejects this too.
        </p>
      )}
      {amountsValid && (
        <p className="text-[11px] text-muted">
          Platform earning{" "}
          <span className={`font-semibold ${marginOk ? "text-heading" : "text-red-700"}`}>
            {money(t - s, row.currency)}
          </span>
          {marginOk && row.tenantPayable != null && Number(row.tenantPayable) !== t && (
            <> · the tenant's payable today is {money(row.tenantPayable, row.currency)}</>
          )}
        </p>
      )}

      <Labelled label="Why the price changed" required hint="Shown to the tenant. They have to repeat it to their customer.">
        <textarea rows={3} className={inputCls} value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="The hotel has moved to peak-season rates for these dates…" />
      </Labelled>
      <Labelled label="Revised cancellation terms" hint="Replaces the frozen terms only if the tenant accepts. Leave blank to keep the current ones.">
        <textarea rows={2} className={inputCls} value={terms} onChange={(e) => setTerms(e.target.value)} />
      </Labelled>
      <Labelled
        label="Valid for (hours)"
        hint="An offer accepted three weeks later is one the supplier has long since withdrawn. Blank uses the platform default."
      >
        <input type="number" min="1" step="1" className={inputCls} value={validForHours}
               onChange={(e) => setValidForHours(e.target.value)} />
      </Labelled>
      <Labelled label="Internal notes" hint="Platform-only. Never reaches the tenant.">
        <textarea rows={2} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Labelled>

      <button
        disabled={!ready}
        onClick={() =>
          onSubmit({
            revisedSupplierTotal: s,
            revisedTenantPayable: t,
            reason: reason.trim(),
            revisedCancellationTerms: terms.trim() || undefined,
            validForHours: validForHours === "" ? undefined : hours,
            internalNotes: notes.trim() || undefined,
          })
        }
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-text hover:bg-accent-hover disabled:opacity-50"
      >
        <PencilLine size={15} /> Send revised price
      </button>
    </div>
  );
}

/**
 * Settle a cancellation. The charge is entered, not computed: there is no machine-readable policy in
 * this release, so what the hotel actually retained on the day is something an operator learns by
 * asking. The refund is derived server-side and never posted from here.
 */
function CancelForm({ row, busy, onSubmit }) {
  const [charge, setCharge] = useState("");
  const [retained, setRetained] = useState("0");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const payable = Number(row.tenantPayable ?? 0);
  const c = charge === "" ? 0 : Number(charge);
  const r = retained === "" ? 0 : Number(retained);

  // Both guards mirror MarketplacePlatformWriter.settleCancellation, so the operator learns the rule
  // while typing rather than from a 400 after committing to it.
  const chargeOk = Number.isFinite(c) && c >= 0 && c <= payable;
  const retainedOk = Number.isFinite(r) && r >= 0 && r <= c;
  const ready = chargeOk && retainedOk && reason.trim().length > 0 && !busy;

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-border bg-surface p-4">
      <p className="text-[11px] text-muted">
        Tenant payable <span className="font-semibold text-heading">{money(payable, row.currency)}</span>
        {row.platformEarning != null && <> · platform earning {money(row.platformEarning, row.currency)}</>}
      </p>

      <Labelled label="Cancellation charge" hint="What the supplier retained. Zero for a free cancellation.">
        <input type="number" min="0" step="0.01" className={inputCls} value={charge}
               onChange={(e) => setCharge(e.target.value)} placeholder="0.00" />
      </Labelled>
      {!chargeOk && (
        <p className="flex items-start gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-[11px] text-red-700 ring-1 ring-red-500/20">
          <AlertTriangle size={13} className="mt-px shrink-0" />
          The charge cannot exceed what the tenant owes ({money(payable, row.currency)}).
        </p>
      )}

      <Labelled
        label="Retained platform earning"
        hint="The platform earns on a stay, not on an order. Anything above zero has to come out of the charge actually collected."
      >
        <input type="number" min="0" step="0.01" className={inputCls} value={retained}
               onChange={(e) => setRetained(e.target.value)} placeholder="0.00" />
      </Labelled>
      {chargeOk && !retainedOk && (
        <p className="flex items-start gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-[11px] text-red-700 ring-1 ring-red-500/20">
          <AlertTriangle size={13} className="mt-px shrink-0" />
          Retained earning exceeds the cancellation charge — the platform would be keeping commission
          out of the tenant's refund. The server rejects this too.
        </p>
      )}

      {chargeOk && (
        <p className="text-[11px] text-muted">
          Tenant refund <span className="font-semibold text-heading">{money(payable - c, row.currency)}</span>
        </p>
      )}

      <Labelled label="Reason" required hint="Recorded against the booking as why the platform settled it this way.">
        <textarea rows={3} className={inputCls} value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Tenant cancelled inside the 48-hour window; hotel retained one night…" />
      </Labelled>
      <Labelled label="Internal notes" hint="Platform-only. Never reaches the tenant.">
        <textarea rows={2} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Labelled>

      <button
        disabled={!ready}
        onClick={() =>
          onSubmit({
            cancellationCharge: c,
            retainedPlatformEarning: r,
            reason: reason.trim(),
            internalNotes: notes.trim() || undefined,
          })
        }
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
      >
        <Ban size={15} /> Settle cancellation
      </button>
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
