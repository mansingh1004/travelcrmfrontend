import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpCircle, ArrowRight, Loader2, Check, X, RefreshCw, CreditCard, Landmark,
  FileText, Clock, ShieldCheck, Ban, Network, Users,
} from "lucide-react";
import { toast } from "@shared/ui/toast";
import { getErrorMessage } from "@shared/api/apiError";
import { upgradeRequestService } from "../api/upgradeRequestService";
import { subAgentLicenseService } from "../api/subAgentLicenseService";
import SuperAdminMfaActionModal from "../components/SuperAdminMfaActionModal";

// The queue merges two request kinds. `serviceFor` routes approve/reject to the right backend.
const serviceFor = (req) => (req._kind === "SEAT" ? subAgentLicenseService : upgradeRequestService);
const isSeat = (req) => req._kind === "SEAT";

/* ── helpers ─────────────────────────────────────────────────── */

const money = (a, c = "INR") => {
  const n = Number(a ?? 0);
  const f = n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return c === "INR" ? `₹${f}` : `${c} ${f}`;
};
const fmtDate = (s) => (s ? new Date(s).toLocaleString() : "—");

const OFFLINE_LABELS = { BANK_TRANSFER: "Bank transfer", CHEQUE: "Cheque", CASH: "Cash" };
const humanizeOffline = (k) => OFFLINE_LABELS[k] || String(k || "").replace(/_/g, " ");

const REQ_STATUS_CLS = {
  PENDING: "bg-hue-amber-soft text-hue-amber",
  APPROVED: "bg-hue-emerald-soft text-hue-emerald",
  REJECTED: "bg-hue-rose-soft text-hue-rose",
  CANCELLED: "bg-surface-hover text-muted",
};
const PLAN_CLS = {
  STARTER: "bg-hue-sky-soft text-hue-sky",
  PRO: "bg-hue-violet-soft text-hue-violet",
  ENTERPRISE: "bg-hue-indigo-soft text-hue-indigo",
};

const TABS = [
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "", label: "All" },
];

function Chip({ text, cls }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {text}
    </span>
  );
}

/* ── payment summary (online capture vs offline reference) ───────── */

function PaymentSummary({ req }) {
  if (req.paymentMode === "ONLINE") {
    const failed = req.onlinePaymentStatus === "FAILED";
    const cls = req.paymentConfirmed
      ? "bg-hue-emerald-soft text-hue-emerald"
      : failed ? "bg-hue-rose-soft text-hue-rose" : "bg-hue-amber-soft text-hue-amber";
    const label = req.paymentConfirmed ? "Paid" : failed ? "Payment failed" : "Awaiting payment";
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-medium text-body">
          <CreditCard size={13} /> Online
        </div>
        <Chip text={label} cls={cls} />
        {req.invoiceNumber && <div className="font-mono text-[11px] text-muted">{req.invoiceNumber}</div>}
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs font-medium text-body">
        <Landmark size={13} /> Offline · {humanizeOffline(req.offlineMode)}
      </div>
      {req.offlineReference && (
        <div className="font-mono text-[11px] text-heading">Ref: {req.offlineReference}</div>
      )}
      {req.offlineNotes && <div className="text-[11px] text-muted">{req.offlineNotes}</div>}
      {req.offlineProofUrl && (
        <a href={req.offlineProofUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline">
          <FileText size={12} /> View proof
        </a>
      )}
    </div>
  );
}

/* ── decision modal (approve confirm / reject with reason) ───────── */

function DecisionModal({ req, type, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [mfaOpen, setMfaOpen] = useState(false);
  const [mfaError, setMfaError] = useState("");
  const isReject = type === "reject";

  const seat = isSeat(req);
  const submit = async () => {
    if (isReject && !reason.trim()) { setErr("A rejection reason is required."); return; }
    setErr("");
    setMfaError("");
    setMfaOpen(true);
  };

  const confirmDecision = async (mfaCode) => {
    setBusy(true);
    setErr("");
    setMfaError("");
    try {
      const svc = serviceFor(req);
      if (isReject) await svc.reject(req.publicId, reason.trim(), mfaCode);
      else await svc.approve(req.publicId, mfaCode);
      toast.success(
        isReject ? "Request rejected."
          : seat ? `Seat licensed — ${req.subAgentName || "partner"} activated.`
          : `Plan upgraded to ${req.requestedPlanName || req.requestedPlan}.`);
      onDone();
    } catch (e) {
      const msg = getErrorMessage(e, isReject ? "Could not reject the request." : "Could not approve the request.");
      setErr(msg);
      setMfaError(msg);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={busy ? undefined : onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-[var(--sa-card-shadow)]"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-heading">
              {isReject
                ? (seat ? "Reject seat-license request" : "Reject upgrade request")
                : (seat ? "Approve & license seat" : "Approve & activate plan")}
            </h3>
            <p className="mt-0.5 text-xs text-body">
              {seat
                ? `${req.tenantName} · ${req.quantity || 1} Travel Partner seat${(req.quantity || 1) === 1 ? "" : "s"} · ${req.subAgentName || ""}`
                : `${req.tenantName} · ${req.currentPlanName || req.currentPlan} → ${req.requestedPlanName || req.requestedPlan}`}
            </p>
          </div>
          <button onClick={onClose} disabled={busy}
            className="rounded-lg p-1 text-muted hover:bg-surface-hover hover:text-heading">
            <X size={18} />
          </button>
        </div>

        {isReject ? (
          <div className="mt-4">
            <label className="text-xs font-medium text-body">Reason (shown to the tenant)</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} autoFocus
              placeholder="e.g. Payment could not be verified against the reference provided."
              className="mt-1 w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading outline-none focus:ring-2 focus:ring-focus" />
          </div>
        ) : (
          <div className="mt-4 space-y-2 rounded-xl border border-border bg-surface-hover/40 p-3 text-xs text-body">
            <div className="flex items-center justify-between">
              <span>Amount</span><span className="font-mono font-semibold text-heading">{money(req.amount, req.currency)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Payment</span>
              <span className="font-semibold text-heading">
                {req.paymentMode === "ONLINE" ? (req.paymentConfirmed ? "Online · paid" : "Online · not paid") : `Offline · ${humanizeOffline(req.offlineMode)}`}
              </span>
            </div>
            <p className="pt-1 text-[11px] text-muted">
              {seat
                ? "Approving raises the tenant's Travel Partner seat cap and activates the pending partner immediately."
                : "Approving activates the new plan's limits and features for this tenant immediately."}
            </p>
          </div>
        )}

        {err && <p className="mt-3 text-xs text-hue-rose">{err}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} disabled={busy}
            className="rounded-lg px-3 py-2 text-xs font-medium text-body hover:bg-surface-hover">
            Cancel
          </button>
          <button onClick={submit} disabled={busy}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white shadow-[var(--sa-card-shadow)] disabled:opacity-60 ${isReject ? "bg-red-600 hover:bg-red-700" : ""}`}
            style={isReject ? undefined : { backgroundImage: "var(--sa-gradient)" }}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : isReject ? <Ban size={14} /> : <Check size={14} />}
            {isReject ? "Reject request" : "Approve"}
          </button>
        </div>
      </div>
      {mfaOpen && (
        <SuperAdminMfaActionModal
          title={isReject ? "Confirm request rejection" : "Confirm request approval"}
          description={
            isReject
              ? "Verify before rejecting this tenant request."
              : seat
                ? "Verify before approving the seat license and activating access."
                : "Verify before approving the plan upgrade and changing tenant limits."
          }
          confirmLabel={isReject ? "Reject request" : "Approve request"}
          saving={busy}
          error={mfaError}
          onClose={busy ? undefined : () => setMfaOpen(false)}
          onConfirm={confirmDecision}
        />
      )}
    </div>
  );
}

/* ── request card ────────────────────────────────────────────────── */

function RequestCard({ req, onApprove, onReject }) {
  const isPending = req.status === "PENDING";
  const onlineUnpaid = req.paymentMode === "ONLINE" && !req.paymentConfirmed;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--sa-card-shadow)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-heading">{req.tenantName}</div>
          <div className="font-mono text-[11px] text-muted">{req.tenantCode}</div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
            isSeat(req) ? "bg-hue-indigo-soft text-hue-indigo" : "bg-hue-sky-soft text-hue-sky"}`}>
            {isSeat(req) ? <><Network size={11} /> Partner seat</> : <><ArrowUpCircle size={11} /> Plan upgrade</>}
          </span>
          <Chip text={req.status} cls={REQ_STATUS_CLS[req.status] || "bg-surface-hover text-muted"} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="sm:col-span-2">
          {isSeat(req) ? (
            <>
              <div className="text-[11px] font-medium text-muted">Travel Partner seat</div>
              <div className="mt-1.5 flex items-center gap-2 text-sm font-semibold text-heading">
                <Users size={14} className="text-hue-indigo" />
                {req.subAgentName || "—"}
                <span className="text-[11px] font-medium text-muted">
                  · {req.quantity || 1} seat{(req.quantity || 1) === 1 ? "" : "s"}
                </span>
              </div>
              {req.subAgentEmail && <div className="mt-0.5 font-mono text-[11px] text-muted">{req.subAgentEmail}</div>}
              <div className="mt-2 font-mono text-lg font-bold text-heading">{money(req.amount, req.currency)}</div>
            </>
          ) : (
            <>
              <div className="text-[11px] font-medium text-muted">Plan change</div>
              <div className="mt-1.5 flex items-center gap-2">
                <Chip text={req.currentPlanName || req.currentPlan} cls={PLAN_CLS[req.currentPlan] || "bg-surface-hover text-muted"} />
                <ArrowRight size={14} className="text-muted" />
                <Chip text={req.requestedPlanName || req.requestedPlan} cls={PLAN_CLS[req.requestedPlan] || "bg-surface-hover text-muted"} />
              </div>
              <div className="mt-2 font-mono text-lg font-bold text-heading">{money(req.amount, req.currency)}</div>
            </>
          )}
        </div>

        <div className="sm:col-span-2">
          <div className="text-[11px] font-medium text-muted">Payment</div>
          <div className="mt-1.5"><PaymentSummary req={req} /></div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border/60 pt-3 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1"><Clock size={12} /> Requested {fmtDate(req.createdAt)}</span>
        {req.requestedByEmail && <span>by {req.requestedByEmail}</span>}
        {req.reviewedByEmail && (
          <span className="inline-flex items-center gap-1">
            <ShieldCheck size={12} /> Reviewed by {req.reviewedByEmail} · {fmtDate(req.reviewedAt)}
          </span>
        )}
      </div>

      {req.status === "REJECTED" && req.decisionNote && (
        <div className="mt-2 rounded-lg bg-hue-rose-soft px-3 py-2 text-[11px] text-hue-rose">
          Reason: {req.decisionNote}
        </div>
      )}

      {isPending && (
        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={() => onReject(req)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-body hover:bg-surface-hover">
            <Ban size={14} /> Reject
          </button>
          <button onClick={() => onApprove(req)} disabled={onlineUnpaid}
            title={onlineUnpaid ? "Waiting for the tenant's online payment to be confirmed." : undefined}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white shadow-[var(--sa-card-shadow)] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundImage: "var(--sa-gradient)" }}>
            <Check size={14} /> Approve
          </button>
        </div>
      )}
      {isPending && onlineUnpaid && (
        <p className="mt-1.5 text-right text-[11px] text-muted">
          Awaiting the tenant's online payment before you can approve.
        </p>
      )}
    </div>
  );
}

/* ── page ────────────────────────────────────────────────────────── */

export default function UpgradeRequests() {
  const [tab, setTab] = useState("PENDING");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [decision, setDecision] = useState(null); // { req, type }

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Merge both request kinds into one queue (no separate seat-license screen), newest first.
      const [ups, seats] = await Promise.all([
        upgradeRequestService.list(tab).catch(() => []),
        subAgentLicenseService.list(tab).catch(() => []),
      ]);
      const merged = [
        ...(ups || []).map((r) => ({ ...r, _kind: "UPGRADE" })),
        ...(seats || []).map((r) => ({ ...r, _kind: "SEAT" })),
      ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setRows(merged);
    } catch (e) {
      setError(getErrorMessage(e, "Failed to load requests."));
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const pendingCount = useMemo(
    () => (tab === "PENDING" ? rows.length : rows.filter((r) => r.status === "PENDING").length),
    [rows, tab]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-heading">
            <ArrowUpCircle size={22} className="text-accent" /> Subscription &amp; Add-on Requests
          </h1>
          <p className="mt-1 text-sm text-body">
            Review tenant plan upgrades and Travel Partner seat-license purchases. Approving activates the plan or
            grants the seat; rejecting keeps the tenant where they are.
          </p>
        </div>
        <button onClick={load}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-body hover:bg-surface-hover">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button key={t.label} onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                active ? "bg-accent-soft text-accent-soft-text ring-1 ring-inset ring-accent/15" : "text-body hover:bg-surface-hover"
              }`}>
              {t.label}
              {t.key === "PENDING" && pendingCount > 0 && (
                <span className="rounded-full bg-hue-amber-soft px-1.5 text-[10px] font-bold text-hue-amber">{pendingCount}</span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="py-24 text-center text-muted"><Loader2 size={22} className="mx-auto animate-spin" /></div>
      ) : error ? (
        <div className="py-24 text-center text-red-500">{error}</div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface py-16 text-center text-sm text-muted">
          No {tab ? tab.toLowerCase() : ""} requests.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {rows.map((r) => (
            <RequestCard key={r.publicId} req={r}
              onApprove={(req) => setDecision({ req, type: "approve" })}
              onReject={(req) => setDecision({ req, type: "reject" })} />
          ))}
        </div>
      )}

      {decision && (
        <DecisionModal req={decision.req} type={decision.type}
          onClose={() => setDecision(null)}
          onDone={() => { setDecision(null); load(); }} />
      )}
    </div>
  );
}
