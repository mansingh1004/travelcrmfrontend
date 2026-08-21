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
// Step-up MFA guards irreversible financial decisions and voucher publication. Requesting a price
// revision or cancellation quote remains a low-friction proposal because it commits neither party.

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, Ban, Building2, Check, ChevronRight, Download, FileText, Loader2, PencilLine,
  RefreshCw, Search, Undo2, Upload, X,
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
  CANCELLATION_QUOTED:      { label: "Awaiting cancellation decision", dot: "bg-amber-500" },
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
  { value: "CANCELLATION_QUOTED", label: "Awaiting cancellation decision" },
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
  "voucher-issue": {
    title: "Issue this voucher",
    description: "The tenant will be able to download and send this document to the traveller.",
    confirmLabel: "Issue voucher",
  },
  "voucher-upload": {
    title: "Upload and issue this voucher",
    description: "The supplier document will become the tenant's active voucher.",
    confirmLabel: "Upload voucher",
  },
  "voucher-revoke": {
    title: "Revoke this voucher",
    description: "The tenant will no longer be able to download the currently issued voucher.",
    confirmLabel: "Revoke voucher",
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
  const [uploadProgress, setUploadProgress] = useState(null);
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

  const quoteCancellation = (payload) =>
    runPanelAction(
      () => svc.quoteCancellation(selected.publicId, payload),
      "Could not send the cancellation quote."
    );

  const openSensitiveAction = (next) => {
    setAction(next);
    setMfaError("");
    setUploadProgress(null);
    setMfaOpen(true);
  };

  const issueVoucher = () => openSensitiveAction({ kind: "voucher-issue" });
  const uploadVoucher = (file) => openSensitiveAction({ kind: "voucher-upload", file });
  const revokeVoucher = (reason) => openSensitiveAction({ kind: "voucher-revoke", reason });

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
      let updated;
      if (action.kind === "approve") {
        updated = await svc.approve(selected.publicId, action.payload, mfaCode);
      } else if (action.kind === "cancel") {
        updated = await svc.cancel(selected.publicId, action.payload, mfaCode);
      } else if (action.kind === "voucher-issue") {
        updated = await svc.issueVoucher(selected.publicId, mfaCode);
      } else if (action.kind === "voucher-upload") {
        setUploadProgress(0);
        updated = await svc.uploadVoucher(selected.publicId, action.file, mfaCode, (event) => {
          if (!event.total) return;
          setUploadProgress(Math.min(100, Math.round((event.loaded * 100) / event.total)));
        });
      } else if (action.kind === "voucher-revoke") {
        updated = await svc.revokeVoucher(selected.publicId, action.reason, mfaCode);
      } else {
        updated = await svc.reject(selected.publicId, action.reason, mfaCode);
      }
      const keepPanelOpen = action.kind.startsWith("voucher-");
      setMfaOpen(false);
      setAction(null);
      setSelected(keepPanelOpen ? (updated ?? selected) : null);
      await load();
    } catch (e) {
      // Stays inside the MFA modal: a wrong code must be retryable without losing the amounts the
      // operator just typed.
      setMfaError(getErrorMessage(e, "Could not complete this decision."));
    } finally {
      setBusy(false);
      setUploadProgress(null);
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
          onApprove={(payload) => openSensitiveAction({ kind: "approve", payload })}
          onReject={(reason) => openSensitiveAction({ kind: "reject", reason })}
          onRevise={requestRevision}
          onQuoteCancellation={quoteCancellation}
          onCancel={(payload) => openSensitiveAction({ kind: "cancel", payload })}
          onIssueVoucher={issueVoucher}
          onUploadVoucher={uploadVoucher}
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
          progress={action?.kind === "voucher-upload" ? uploadProgress : null}
          error={mfaError}
          onClose={busy ? undefined : () => { setMfaOpen(false); setAction(null); setUploadProgress(null); }}
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
  onQuoteCancellation, onIssueVoucher, onUploadVoucher, onRevokeVoucher, onDownloadVoucher,
}) {
  const [supplierTotal, setSupplierTotal] = useState(row.supplierTotal ?? "");
  const [tenantPayable, setTenantPayable] = useState(row.tenantPayable ?? row.quotedTenantPayable ?? "");
  // Never sticky across rows: an override is a decision about ONE booking's exposure, and a
  // checkbox that stayed ticked would silently apply it to the next tenant in the queue.
  const [overrideCredit, setOverrideCredit] = useState(false);
  const [confirmationNumber, setConfirmationNumber] = useState(row.supplierConfirmationNumber ?? "");
  const [cancellationTerms, setCancellationTerms] = useState(row.cancellationTerms ?? "");
  const [internalNotes, setInternalNotes] = useState(row.internalNotes ?? "");
  const [rejectReason, setRejectReason] = useState("");
  const [revokeReason, setRevokeReason] = useState("");
  const [mode, setMode] = useState(null);           // null | approve | reject | revise | quote-cancel | cancel | upload | revoke

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
  const committed  = st === "CONFIRMED" || st === "CANCEL_REQUESTED" || st === "CANCELLATION_QUOTED";
  const canQuoteCancellation = st === "CANCEL_REQUESTED" || st === "CANCELLATION_QUOTED";
  const canCancel  = committed;

  const voucher = row.voucherStatus ?? "NOT_ISSUED";
  const canIssueVoucher  = committed && voucher !== "ISSUED";
  const canRevokeVoucher = voucher === "ISSUED";
  // The platform copy renders before issue, stamped as a preview — an operator has to be able to
  // read the document before committing to it. The tenant route requires ISSUED; this one doesn't.
  const canDownloadVoucher = committed || !!row.voucherNumber;

  const nothingToDo =
    !canApprove && !canReject && !canRevise && !canQuoteCancellation && !canCancel &&
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

          {st === "CANCELLATION_QUOTED" && (
            <div className="mb-4 rounded-lg bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700 ring-1 ring-amber-500/20">
              <p className="flex items-start gap-1.5 font-semibold">
                <AlertTriangle size={13} className="mt-px shrink-0" />
                Waiting for the tenant to accept or decline the cancellation charge
              </p>
              <p className="mt-1 pl-[18px] text-[11px]">
                Quoted {money(row.quotedCancellationCharge, row.currency)} · valid until {fmtDateTime(row.cancellationQuoteExpiresAt)}
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

          {row.cancelRequestedAt && <CancellationTimeline row={row} />}

          {(row.cancelRequestedAt || row.cancelledAt || row.cancellationCharge != null) && (
            <Section title="Cancellation">
              {row.cancelRequestedAt && <KV k="Tenant asked" v={fmtDateTime(row.cancelRequestedAt)} />}
              {row.cancelRequestReason && <KV k="Their reason" v={row.cancelRequestReason} />}
              {row.cancelledAt && <KV k="Settled" v={fmtDateTime(row.cancelledAt)} />}
              {row.cancellationReason && <KV k="Settled because" v={row.cancellationReason} />}
              <KV k="Supplier retained" v={money(row.cancellationCharge, row.currency)} />
              <KV k="Tenant refund" v={money(row.tenantRefundAmount, row.currency)} />
            </Section>
          )}


          {row.cancellationQuotedAt && (
            <Section title="Cancellation quote">
              <KV k="Supplier retains" v={money(row.quotedCancellationCharge, row.currency)} />
              <KV k="Platform retains" v={money(row.quotedRetainedEarning, row.currency)} />
              <KV k="Tenant refund" v={money(Number(row.tenantPayable || 0) - Number(row.quotedCancellationCharge || 0), row.currency)} />
              <KV k="Reason shown" v={row.cancellationQuoteNote} />
              <KV k="Sent" v={fmtDateTime(row.cancellationQuotedAt)} />
              {row.cancellationQuoteExpiresAt && <KV k="Valid until" v={fmtDateTime(row.cancellationQuoteExpiresAt)} />}
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
                  <>
                  {canQuoteCancellation && (
                    <button
                      onClick={() => toggle("quote-cancel")}
                      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                        mode === "quote-cancel" ? "bg-accent text-accent-text" : "border border-border bg-surface text-body hover:bg-surface-hover"
                      }`}
                    >
                      <FileText size={15} /> {st === "CANCELLATION_QUOTED" ? "Revise cancellation quote" : "Send cancellation quote"}
                    </button>
                  )}
                  <button
                    onClick={() => toggle("cancel")}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                      mode === "cancel" ? "bg-red-600 text-white" : "border border-border bg-surface text-body hover:bg-surface-hover"
                    }`}
                  >
                    <Ban size={15} /> Emergency cancel
                  </button>
                  </>
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
                  {canIssueVoucher && (
                    <button
                      onClick={() => toggle("upload")}
                      disabled={busy}
                      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-60 ${
                        mode === "upload" ? "bg-accent text-accent-text" : "border border-border bg-surface text-body hover:bg-surface-hover"
                      }`}
                    >
                      <Upload size={15} /> Upload hotel voucher
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

                  {/*
                    The credit ceiling.

                    The server refuses an approval that would take a tenant past their marketplace
                    credit limit, with a 409 naming the figures. Without this checkbox that refusal
                    is a dead end: the operator would have to leave, get the limit raised or the
                    payments recorded, and come back — mid-call, with a hotel holding a room.

                    Deliberately UNCHECKED by default and worded as a decision, not a retry. The
                    point of the gate is not to prevent the platform carrying risk — sometimes
                    carrying it is right — but to make sure somebody chose to. Ticking it is audited
                    as MARKETPLACE_CREDIT_OVERRIDE; leaving it alone is the normal path.
                  */}
                  <label className="flex items-start gap-2 rounded-lg border border-border bg-surface-hover px-3 py-2">
                    <input
                      type="checkbox"
                      checked={overrideCredit}
                      onChange={(e) => setOverrideCredit(e.target.checked)}
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-current"
                    />
                    <span className="text-[11px] leading-relaxed text-body">
                      <span className="font-semibold">Confirm past the tenant's credit limit</span>
                      <span className="block text-muted">
                        Only needed if the approval is refused for credit. The platform carries the
                        exposure, and the override is recorded against your account.
                      </span>
                    </span>
                  </label>

                  <button
                    disabled={!marginOk || busy}
                    onClick={() =>
                      onApprove({
                        supplierTotal: s,
                        tenantPayable: t,
                        supplierConfirmationNumber: confirmationNumber.trim() || undefined,
                        cancellationTermsSnapshot: cancellationTerms.trim() || undefined,
                        internalNotes: internalNotes.trim() || undefined,
                        overrideCreditLimit: overrideCredit || undefined,
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

              {mode === "quote-cancel" && (
                <CancellationQuoteForm row={row} busy={busy}
                  onSubmit={(payload) => run(() => onQuoteCancellation(payload))} />
              )}

              {mode === "cancel" && <CancelForm row={row} busy={busy} onSubmit={onCancel} />}

              {mode === "upload" && (
                <VoucherUploadForm busy={busy} onSubmit={(file) => run(() => onUploadVoucher(file))} />
              )}

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

/** Normal cancellation path: quote the supplier charge and let the tenant make the binding choice. */
function CancellationQuoteForm({ row, busy, onSubmit }) {
  const [charge, setCharge] = useState(row.quotedCancellationCharge ?? "");
  const [retained, setRetained] = useState(row.quotedRetainedEarning ?? "0");
  const [note, setNote] = useState(row.cancellationQuoteNote ?? "");
  const [validForHours, setValidForHours] = useState(DEFAULT_REVISION_HOURS);
  const [internalNotes, setInternalNotes] = useState(row.internalNotes ?? "");

  const payable = Number(row.tenantPayable ?? 0);
  const c = charge === "" ? Number.NaN : Number(charge);
  const r = retained === "" ? 0 : Number(retained);
  const hours = Number(validForHours);
  const chargeOk = Number.isFinite(c) && c >= 0 && c <= payable;
  const retainedOk = Number.isFinite(r) && r >= 0 && r <= c;
  const ready = chargeOk && retainedOk && note.trim() && Number.isFinite(hours) && hours >= 1 && !busy;

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-accent/30 bg-accent-soft/30 p-4">
      <p className="text-[11px] text-body">
        Recommended path: send the confirmed supplier charge to the tenant. Their acceptance completes
        the cancellation using these exact stored amounts.
      </p>
      <Labelled label="Cancellation charge" required hint="What the supplier will retain if the tenant accepts.">
        <input type="number" min="0" step="0.01" className={inputCls} value={charge}
          onChange={(e) => setCharge(e.target.value)} placeholder="0.00" />
      </Labelled>
      <Labelled label="Retained platform earning" hint="Cannot exceed the cancellation charge.">
        <input type="number" min="0" step="0.01" className={inputCls} value={retained}
          onChange={(e) => setRetained(e.target.value)} placeholder="0.00" />
      </Labelled>
      {chargeOk && retainedOk && (
        <p className="text-[11px] text-muted">
          Tenant refund if accepted <span className="font-semibold text-heading">{money(payable - c, row.currency)}</span>
        </p>
      )}
      {(!chargeOk || !retainedOk) && (
        <p className="flex items-start gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-[11px] text-red-700 ring-1 ring-red-500/20">
          <AlertTriangle size={13} className="mt-px shrink-0" />
          Charge must be between zero and {money(payable, row.currency)}, and retained earning cannot exceed it.
        </p>
      )}
      <Labelled label="Reason shown to tenant" required hint="Explain the hotel policy or exception behind this amount.">
        <textarea rows={3} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Inside the hotel's 48-hour window; the hotel will retain one night…" />
      </Labelled>
      <Labelled label="Valid for hours" required>
        <input type="number" min="1" className={inputCls} value={validForHours}
          onChange={(e) => setValidForHours(e.target.value)} />
      </Labelled>
      <Labelled label="Internal notes" hint="Platform-only; never shown to the tenant.">
        <textarea rows={2} className={inputCls} value={internalNotes}
          onChange={(e) => setInternalNotes(e.target.value)} />
      </Labelled>
      <button disabled={!ready} onClick={() => onSubmit({
        cancellationCharge: c,
        retainedPlatformEarning: r,
        note: note.trim(),
        validForHours: hours,
        internalNotes: internalNotes.trim() || undefined,
      })}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-text hover:bg-accent-hover disabled:opacity-50">
        <FileText size={15} /> Send cancellation quote
      </button>
    </div>
  );
}

/** Hotel-supplied voucher upload. The backend validates type and enforces the same 10 MB cap. */
function VoucherUploadForm({ busy, onSubmit }) {
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");

  const choose = (event) => {
    const next = event.target.files?.[0] || null;
    if (next && next.size > 10 * 1024 * 1024) {
      setFile(null);
      setError("Voucher must be 10 MB or smaller.");
      return;
    }
    setFile(next);
    setError("");
  };

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-border bg-surface p-4">
      <Labelled label="Hotel voucher" required hint="PDF, JPG, PNG or WEBP · maximum 10 MB. Uploading also issues it to the tenant.">
        <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={choose}
          className="block w-full text-xs text-body file:mr-3 file:rounded-lg file:border-0 file:bg-accent-soft file:px-3 file:py-2 file:font-semibold file:text-accent-soft-text" />
      </Labelled>
      {file && <p className="text-[11px] text-muted">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button disabled={!file || busy} onClick={() => onSubmit(file)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-text hover:bg-accent-hover disabled:opacity-50">
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
        Upload and issue voucher
      </button>
    </div>
  );
}

function CancellationTimeline({ row }) {
  const steps = [
    {
      label: "Cancellation requested",
      detail: row.cancelRequestReason || "Tenant requested cancellation",
      at: row.cancelRequestedAt,
      done: true,
    },
  ];

  if (row.cancellationQuotedAt) {
    steps.push({
      label: "Quote sent to tenant",
      detail: `${money(row.quotedCancellationCharge, row.currency)} supplier charge`,
      at: row.cancellationQuotedAt,
      done: true,
    });
  } else if (row.status === "CANCEL_REQUESTED") {
    steps.push({ label: "Cancellation quote pending", detail: "Waiting for platform action", done: false });
  }

  if (row.cancelledAt) {
    steps.push({
      label: "Cancellation settled",
      detail: `${money(row.tenantRefundAmount, row.currency)} refunded to tenant`,
      at: row.cancelledAt,
      done: true,
    });
  } else if (row.status === "CANCELLATION_QUOTED") {
    steps.push({
      label: "Tenant decision pending",
      detail: row.cancellationQuoteExpiresAt
        ? `Quote valid until ${fmtDateTime(row.cancellationQuoteExpiresAt)}`
        : "Waiting for tenant response",
      done: false,
    });
  } else if (row.cancellationQuotedAt && row.status === "CONFIRMED") {
    steps.push({ label: "Booking retained", detail: "Cancellation was not completed", done: true });
  }

  return (
    <Section title="Cancellation timeline">
      <ol className="space-y-3">
        {steps.map((step, index) => (
          <li key={`${step.label}-${index}`} className="flex gap-3">
            <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${step.done ? "bg-accent" : "border-2 border-accent bg-surface"}`} />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-heading">{step.label}</p>
              <p className="text-[11px] text-muted">
                {step.detail}{step.at ? ` · ${fmtDateTime(step.at)}` : ""}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/**
 * Emergency cancellation override. The normal tenant-request path uses CancellationQuoteForm above;
 * this is retained for supplier closure, fraud, or another unwind where tenant consent is impossible.
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
      <p className="flex items-start gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-[11px] text-red-700 ring-1 ring-red-500/20">
        <AlertTriangle size={13} className="mt-px shrink-0" />
        Emergency override: this settles without tenant acceptance. Use only when the supplier or
        platform must unwind the booking and the normal quote flow cannot apply.
      </p>
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
        <Ban size={15} /> Emergency settle cancellation
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
