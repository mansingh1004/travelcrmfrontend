// src/features/subscription/pages/SubscriptionInfo.jsx
// ─────────────────────────────────────────────────────────────
// Subscription & Billing — Travel CRM (tenant self-serve)
// Route: /Subscription
//
// Live data from the real endpoints (see ../api/subscriptionService):
//   • Current plan snapshot + entitlements + dunning state (PAST_DUE / EXPIRED grace banners)
//   • Invoice history with in-line Razorpay Checkout ("Pay") on any UNPAID invoice
//   • Change plan (upgrade / downgrade) with the prorated top-up surfaced for immediate payment
//
// Design system: glass cards (bg-white/80 backdrop-blur rounded-3xl), blue-600→indigo primary + amber
// accent, Plus Jakarta Sans. Errors route through the shared toast + apiError helpers.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Crown, Rocket, Users, Clock, Zap, ShieldCheck, Building2, RefreshCw, Check, ChevronRight,
  CreditCard, AlertTriangle, Loader2, FileText, Sparkles, X, Layers, CalendarClock, HardDrive,
  Hourglass, Ban, Landmark, Upload,
} from "lucide-react";
import { toast } from "@shared/ui/toast";
import { getErrorMessage } from "@shared/api/apiError";
import subscriptionService from "../api/subscriptionService";
import { openRazorpayCheckout } from "../api/razorpayCheckout";

/* ─── helpers ─────────────────────────────────────────────────── */

const money = (amount, currency = "INR") => {
  const n = Number(amount ?? 0);
  const formatted = n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency === "INR" ? `₹${formatted}` : `${currency} ${formatted}`;
};

const moneyShort = (amount, currency = "INR") => {
  const n = Number(amount ?? 0);
  const formatted = n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  return currency === "INR" ? `₹${formatted}` : `${currency} ${formatted}`;
};

const fmtLimit = (v) => (v == null ? "Unlimited" : Number(v).toLocaleString("en-IN"));
const fmtStorage = (v) => (v == null ? "Unlimited" : `${Number(v).toLocaleString("en-IN")} MB`);

const MODULE_LABELS = {
  LEADS: "Lead Management",
  BOOKINGS: "Booking Management",
  QUOTATIONS: "Quotation Management",
  CUSTOMERS: "Customer Management",
  MASTERS: "Master Data Management",
  VENDORS: "Vendor Management",
  REPORTS: "Reports & Analytics",
  FLEET: "Fleet / Vehicle Diary",
  HOTEL_MARKETPLACE: "Platform Hotel",
  WHATSAPP: "WhatsApp Integration",
  DISHA_AI: "Disha AI Assistant",
  PORTAL: "Traveler Portal",
};
const humanizeModule = (k) =>
  MODULE_LABELS[k] || String(k).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const OFFLINE_LABELS = { BANK_TRANSFER: "Bank transfer", CHEQUE: "Cheque", CASH: "Cash" };
const humanizeOffline = (k) => OFFLINE_LABELS[k] || String(k || "").replace(/_/g, " ");

const parseDate = (s) => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** % of the billing period elapsed, from the formatted start/end strings (null if unparseable). */
const periodElapsedPct = (startStr, endStr) => {
  const start = parseDate(startStr);
  const end = parseDate(endStr);
  if (!start || !end || end <= start) return null;
  const now = Date.now();
  const pct = ((now - start.getTime()) / (end.getTime() - start.getTime())) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
};

const STATUS_PILL = {
  ACTIVE: "bg-green-100 text-green-700 border-green-200",
  TRIAL: "bg-amber-100 text-amber-700 border-amber-200",
  PAST_DUE: "bg-orange-100 text-orange-700 border-orange-200",
  SUSPENDED: "bg-red-100 text-red-700 border-red-200",
  EXPIRED: "bg-slate-200 text-slate-600 border-slate-300",
};

const INVOICE_PILL = {
  PAID: "bg-emerald-100 text-emerald-700 border-emerald-200",
  UNPAID: "bg-amber-100 text-amber-700 border-amber-200",
  VOID: "bg-slate-100 text-slate-500 border-slate-200",
  CREDIT: "bg-sky-100 text-sky-700 border-sky-200",
};

/* ─── small presentational pieces ─────────────────────────────── */

function StatMini({ icon, label, value, sub, bg, color, delay = 0 }) {
  return (
    <div className={`${bg} rounded-2xl p-4 border flex items-center gap-3`}
      style={{ animation: "fadeUp .4s ease both", animationDelay: `${delay}ms` }}>
      <div className={`w-10 h-10 rounded-xl bg-white/70 flex items-center justify-center ${color} flex-shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className={`text-lg font-extrabold ${color} truncate`}>{value}</p>
        <p className="text-xs font-bold text-slate-600">{label}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function PlanRow({ label, children }) {
  return (
    <div className="flex items-start py-3 border-b border-slate-100 last:border-0">
      <span className="w-36 text-sm font-extrabold text-slate-600 flex-shrink-0">{label}:</span>
      <span className="text-sm flex-1">{children}</span>
    </div>
  );
}

function LimitChip({ icon, label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">{icon} {label}</div>
      <div className="font-extrabold text-slate-800 text-sm mt-0.5">{value}</div>
    </div>
  );
}

/* ─── Change Plan modal ───────────────────────────────────────── */

function ChangePlanModal({ plans, currentCode, onClose, onConfirm, busy }) {
  const [selected, setSelected] = useState(null);
  const [payMode, setPayMode] = useState("ONLINE");
  const [offlineMode, setOfflineMode] = useState("BANK_TRANSFER");
  const [offlineReference, setOfflineReference] = useState("");
  const [offlineNotes, setOfflineNotes] = useState("");
  const [proofFile, setProofFile] = useState(null);

  const currentPrice = Number(plans.find((p) => p.code === currentCode)?.monthlyPrice ?? 0);
  const selectedPlan = plans.find((p) => p.code === selected);
  const isUpgrade = !!selectedPlan && Number(selectedPlan.monthlyPrice ?? 0) > currentPrice;

  const offlineReady = !isUpgrade || payMode === "ONLINE" || (offlineMode && offlineReference.trim());
  const canSubmit = !!selected && offlineReady && !busy;

  const submit = () => {
    if (!selected) return;
    onConfirm({
      plan: selected,
      isUpgrade,
      paymentMode: payMode,
      offlineMode: payMode === "OFFLINE" ? offlineMode : undefined,
      offlineReference: payMode === "OFFLINE" ? offlineReference.trim() : undefined,
      offlineNotes: payMode === "OFFLINE" ? offlineNotes.trim() : undefined,
      proofFile: isUpgrade && payMode === "OFFLINE" ? proofFile : null,
    });
  };

  const ctaLabel = !isUpgrade ? "Confirm change" : payMode === "ONLINE" ? "Pay & submit request" : "Submit request";

  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
      <div className="relative w-full max-w-3xl max-h-[88vh] overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100
          bg-gradient-to-r from-blue-600 to-indigo-600">
          <div className="flex items-center gap-2 text-white">
            <Sparkles className="w-5 h-5" />
            <h3 className="text-base font-extrabold">Change your plan</h3>
          </div>
          <button onClick={onClose} disabled={busy} className="text-white/80 hover:text-white"><X size={20} /></button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {plans.map((p) => {
              const isCurrent = p.code === currentCode;
              const isSelected = selected === p.code;
              return (
                <button key={p.publicId || p.code} type="button" disabled={isCurrent}
                  onClick={() => setSelected(p.code)}
                  className={`text-left rounded-2xl border-2 p-4 transition-all
                    ${isCurrent ? "border-slate-200 bg-slate-50 opacity-70 cursor-default"
                      : isSelected ? "border-blue-500 bg-blue-50 shadow-md"
                      : "border-slate-200 hover:border-blue-300 hover:bg-blue-50/40"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-extrabold text-slate-800">{p.displayName}</span>
                    {isCurrent
                      ? <span className="text-[10px] font-extrabold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">CURRENT</span>
                      : isSelected && <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center"><Check size={12} /></span>}
                  </div>
                  <div className="mt-2 font-extrabold text-2xl text-slate-900">
                    {moneyShort(p.monthlyPrice, p.currency)}
                    <span className="text-xs font-semibold text-slate-400"> /mo</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-1.5 text-[11px]">
                    <span className="text-slate-500"><Users className="inline w-3 h-3 mb-0.5" /> {fmtLimit(p.maxUsers)} users</span>
                    <span className="text-slate-500"><Layers className="inline w-3 h-3 mb-0.5" /> {fmtLimit(p.maxLeads)} leads</span>
                    <span className="text-slate-500"><CalendarClock className="inline w-3 h-3 mb-0.5" /> {fmtLimit(p.maxBookingsPerMonth)} bk/mo</span>
                    <span className="text-slate-500"><HardDrive className="inline w-3 h-3 mb-0.5" /> {fmtStorage(p.maxStorageMb)}</span>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-400">{(p.modules || []).length} modules</div>
                </button>
              );
            })}
          </div>

          {/* Upgrade → approval + payment selection */}
          {isUpgrade && (
            <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/60 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <Hourglass className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800 font-semibold">
                  Upgrades are reviewed by our team before your new plan activates. Choose how you'll pay —
                  once your payment is confirmed and approved, the plan switches on automatically.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: "ONLINE", label: "Pay online", icon: <CreditCard className="w-4 h-4" />, sub: "Card / UPI / netbanking" },
                  { v: "OFFLINE", label: "Paid offline", icon: <Landmark className="w-4 h-4" />, sub: "Bank / cheque / cash" },
                ].map((opt) => (
                  <button key={opt.v} type="button" onClick={() => setPayMode(opt.v)}
                    className={`rounded-xl border-2 p-3 text-left transition-all
                      ${payMode === opt.v ? "border-blue-500 bg-white shadow-sm" : "border-slate-200 bg-white/70 hover:border-blue-300"}`}>
                    <div className="flex items-center gap-2 font-extrabold text-sm text-slate-800">{opt.icon} {opt.label}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{opt.sub}</div>
                  </button>
                ))}
              </div>
              {payMode === "OFFLINE" && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500">Payment method</label>
                      <select value={offlineMode} onChange={(e) => setOfflineMode(e.target.value)}
                        className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm focus:border-blue-400 outline-none">
                        <option value="BANK_TRANSFER">Bank transfer</option>
                        <option value="CHEQUE">Cheque</option>
                        <option value="CASH">Cash</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500">Reference / txn no. <span className="text-red-400">*</span></label>
                      <input value={offlineReference} onChange={(e) => setOfflineReference(e.target.value)}
                        placeholder="UTR / cheque no. / receipt"
                        className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm focus:border-blue-400 outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500">Notes (optional)</label>
                    <input value={offlineNotes} onChange={(e) => setOfflineNotes(e.target.value)}
                      placeholder="Anything our team should know"
                      className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm focus:border-blue-400 outline-none" />
                  </div>
                  <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-dashed border-slate-300
                    text-slate-500 text-xs font-bold cursor-pointer hover:border-blue-300 hover:text-blue-600 max-w-full">
                    <Upload className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{proofFile ? proofFile.name : "Attach payment proof (optional)"}</span>
                    <input type="file" accept="image/*,.pdf" className="hidden"
                      onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-400 max-w-xs">
            {isUpgrade
              ? "Your plan does not change until a SuperAdmin approves your request."
              : "Mid-cycle changes are prorated for the remainder of the month."}
          </p>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={onClose} disabled={busy}
              className="px-4 py-2 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50">
              Cancel
            </button>
            <button onClick={submit} disabled={!canSubmit}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600
                text-white font-extrabold text-sm shadow-md disabled:opacity-50">
              {busy ? <Loader2 size={15} className="animate-spin" />
                : isUpgrade ? <CreditCard size={15} /> : <Rocket size={15} />}
              {ctaLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Pending / rejected upgrade-request banners ──────────────────── */

function PendingUpgradeCard({ req, onPay, onCancel, paying, cancelling }) {
  const online = req.paymentMode === "ONLINE";
  const paid = req.paymentConfirmed;
  return (
    <div className="fade-up rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
        <Hourglass className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-extrabold text-indigo-900">
          Upgrade to {req.requestedPlanName || req.requestedPlan} — pending approval
        </p>
        <p className="text-sm text-indigo-700/90">
          {req.currentPlanName || req.currentPlan} → {req.requestedPlanName || req.requestedPlan}
          {" · "}{money(req.amount, req.currency)}{" · "}
          {online
            ? (paid ? "Payment received" : "Payment pending")
            : `Offline (${humanizeOffline(req.offlineMode)}${req.offlineReference ? ` · ${req.offlineReference}` : ""})`}
        </p>
        <p className="text-[12px] text-indigo-500 mt-0.5">
          {online && !paid
            ? "Complete payment, then our team will review and activate your plan."
            : "Our team will review your payment and activate your plan shortly."}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {online && !paid && (
          <button onClick={() => onPay(req)} disabled={paying}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600
              text-white font-bold text-sm shadow-sm disabled:opacity-60">
            {paying ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />} Pay now
          </button>
        )}
        {!(online && paid) && (
          <button onClick={() => onCancel(req)} disabled={cancelling}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-indigo-200 text-indigo-600
              font-bold text-sm hover:bg-white disabled:opacity-60">
            {cancelling ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />} Cancel
          </button>
        )}
      </div>
    </div>
  );
}

function RejectedUpgradeNote({ req }) {
  return (
    <div className="fade-up rounded-2xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
        <Ban className="w-4 h-4" />
      </div>
      <div>
        <p className="font-extrabold text-red-800">
          Your upgrade to {req.requestedPlanName || req.requestedPlan} was declined
        </p>
        {req.decisionNote && <p className="text-sm text-red-700/90">Reason: {req.decisionNote}</p>}
        <p className="text-[12px] text-red-500 mt-0.5">
          You remain on your current plan. You can submit a new request anytime.
        </p>
      </div>
    </div>
  );
}

/* ─── main page ───────────────────────────────────────────────── */

export default function SubscriptionInfo() {
  const [sub, setSub] = useState(null);
  const [plans, setPlans] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [upgradeReqs, setUpgradeReqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState(null);
  const [payingUpg, setPayingUpg] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [changing, setChanging] = useState(false);

  const invoicesRef = useRef(null);

  const loadSubAndInvoices = useCallback(async () => {
    const [s, inv, reqs] = await Promise.all([
      subscriptionService.getSubscription().catch(() => null),
      subscriptionService.getInvoices().catch(() => []),
      subscriptionService.getUpgradeRequests().catch(() => []),
    ]);
    if (s) setSub(s);
    setInvoices(inv || []);
    setUpgradeReqs(reqs || []);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p, inv, reqs] = await Promise.all([
        subscriptionService.getSubscription().catch(() => null),
        subscriptionService.getPlans().catch(() => []),
        subscriptionService.getInvoices().catch(() => []),
        subscriptionService.getUpgradeRequests().catch(() => []),
      ]);
      setSub(s);
      setPlans(p || []);
      setInvoices(inv || []);
      setUpgradeReqs(reqs || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  /* ── pay an unpaid invoice via Razorpay Checkout ── */
  const payInvoice = useCallback(async (invoice) => {
    setPayingId(invoice.publicId);
    try {
      const order = await subscriptionService.createPayIntent(invoice.publicId);
      await openRazorpayCheckout(order, {
        onSuccess: () => {
          toast.success("Payment received — confirming your invoice…");
          // Settlement is webhook-driven; poll a couple of times so the row flips to PAID.
          setTimeout(() => loadSubAndInvoices(), 2500);
          setTimeout(() => loadSubAndInvoices(), 6000);
          setPayingId(null);
        },
        onDismiss: () => setPayingId(null),
      });
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not start the payment. Please try again."));
      setPayingId(null);
    }
  }, [loadSubAndInvoices]);

  /* ── submit an UPGRADE request (SuperAdmin-approved) ── */
  const submitUpgradeRequest = useCallback(async (payload) => {
    setChanging(true);
    try {
      const res = await subscriptionService.createUpgradeRequest({
        requestedPlan: payload.plan,
        paymentMode: payload.paymentMode,
        offlineMode: payload.offlineMode,
        offlineReference: payload.offlineReference,
        offlineNotes: payload.offlineNotes,
      });
      setShowPlanModal(false);

      // Offline: attach optional proof, then inform — nothing to pay online.
      if (payload.paymentMode === "OFFLINE") {
        if (payload.proofFile && res?.publicId) {
          try { await subscriptionService.uploadUpgradeProof(res.publicId, payload.proofFile); }
          catch (e) { toast.error(getErrorMessage(e, "Request created, but the proof upload failed — you can retry later.")); }
        }
        toast.success("Upgrade request submitted. Our team will verify your payment and activate your plan.");
        await loadSubAndInvoices();
        return;
      }

      // Online: pay-first — open Checkout for the request's invoice right away. Approval still gates activation.
      toast.info("Request created — complete payment so our team can approve your upgrade.");
      if (res?.invoicePublicId) {
        try {
          const order = await subscriptionService.createPayIntent(res.invoicePublicId);
          await openRazorpayCheckout(order, {
            onSuccess: () => {
              toast.success("Payment received — your upgrade is now pending approval.");
              setTimeout(() => loadSubAndInvoices(), 2500);
              setTimeout(() => loadSubAndInvoices(), 6000);
            },
            onDismiss: () => {
              toast.info("Pay from the pending request card above to complete your upgrade.");
              loadSubAndInvoices();
            },
          });
        } catch (err) {
          toast.error(getErrorMessage(err, "Could not start the payment. Pay from the pending request card above."));
          loadSubAndInvoices();
        }
      } else {
        await loadSubAndInvoices();
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not submit your upgrade request."));
    } finally {
      setChanging(false);
    }
  }, [loadSubAndInvoices]);

  /* ── change plan (upgrade → request; downgrade/lateral → instant) ── */
  const confirmChangePlan = useCallback(async (payload) => {
    if (payload.isUpgrade) return submitUpgradeRequest(payload);

    setChanging(true);
    try {
      const res = await subscriptionService.changePlan(payload.plan);
      setShowPlanModal(false);
      toast.success(res?.message || "Plan changed.");
      await Promise.all([loadSubAndInvoices(), subscriptionService.getPlans().then(setPlans).catch(() => {})]);
      if (res?.prorationInvoicePublicId && Number(res?.amountDue) > 0) {
        toast.info(`A prorated invoice of ${money(res.amountDue, res.currency)} is due — pay it below.`);
        setTimeout(() => invoicesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 400);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not change your plan."));
    } finally {
      setChanging(false);
    }
  }, [submitUpgradeRequest, loadSubAndInvoices]);

  /* ── pay a pending online upgrade request's invoice ── */
  const payUpgradeInvoice = useCallback(async (req) => {
    setPayingUpg(true);
    try {
      const order = await subscriptionService.createPayIntent(req.invoicePublicId);
      await openRazorpayCheckout(order, {
        onSuccess: () => {
          toast.success("Payment received — your upgrade is now pending approval.");
          setTimeout(() => loadSubAndInvoices(), 2500);
          setTimeout(() => loadSubAndInvoices(), 6000);
          setPayingUpg(false);
        },
        onDismiss: () => setPayingUpg(false),
      });
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not start the payment. Please try again."));
      setPayingUpg(false);
    }
  }, [loadSubAndInvoices]);

  /* ── cancel a pending upgrade request ── */
  const cancelUpgrade = useCallback(async (req) => {
    setCancelling(true);
    try {
      await subscriptionService.cancelUpgradeRequest(req.publicId);
      toast.success("Upgrade request cancelled.");
      await loadSubAndInvoices();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not cancel the request."));
    } finally {
      setCancelling(false);
    }
  }, [loadSubAndInvoices]);

  const scrollToInvoices = () => invoicesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const status = sub?.status;
  const isPastDue = status === "PAST_DUE";
  const isExpired = status === "EXPIRED" || status === "SUSPENDED";
  const daysLeft = sub?.daysLeft;
  const elapsedPct = periodElapsedPct(sub?.startDate, sub?.endDate);
  const modules = sub?.features || [];

  // Upgrade-request state (list is newest-first from the API).
  const pendingUpgrade = upgradeReqs.find((r) => r.status === "PENDING") || null;
  const rejectedUpgrade = (!pendingUpgrade && upgradeReqs[0]?.status === "REJECTED") ? upgradeReqs[0] : null;
  const changeDisabled = !plans.length || !!pendingUpgrade;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100"
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .fade-up { animation: fadeUp .45s ease both; }
      `}</style>

      {/* ── HEADER ── */}
      <div className="bg-white/70 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600
                flex items-center justify-center text-white shadow-lg shadow-blue-200 flex-shrink-0">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Subscription &amp; Billing</h1>
                <p className="text-sm text-slate-400 mt-0.5">Manage your plan, invoices and payments</p>
              </div>
            </div>
            {sub && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl
                bg-gradient-to-r from-amber-400 to-orange-400 text-white font-extrabold text-sm shadow-md shadow-amber-200">
                <Crown className="w-4 h-4" /> {sub.plan || sub.planCode || "Plan"}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* ── DUNNING BANNERS ── */}
        {!loading && isPastDue && (
          <div className="fade-up rounded-2xl border border-orange-200 bg-orange-50 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="font-extrabold text-orange-800">Your account is past due</p>
              <p className="text-sm text-orange-700/90">
                One or more invoices are overdue{sub?.pastDueSince ? ` since ${sub.pastDueSince}` : ""}. Settle them
                to avoid your account being suspended. Your account is still active during the grace period.
              </p>
            </div>
            <button onClick={scrollToInvoices}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700
                text-white font-bold text-sm flex-shrink-0">
              <CreditCard className="w-4 h-4" /> Settle now
            </button>
          </div>
        )}
        {!loading && isExpired && (
          <div className="fade-up rounded-2xl border border-red-200 bg-red-50 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="font-extrabold text-red-800">
                {status === "SUSPENDED" ? "Your account is suspended" : "Your subscription has expired"}
              </p>
              <p className="text-sm text-red-700/90">
                Settle the outstanding invoice to restore full access for your team.
              </p>
            </div>
            <button onClick={scrollToInvoices}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700
                text-white font-bold text-sm flex-shrink-0">
              <CreditCard className="w-4 h-4" /> Pay to restore
            </button>
          </div>
        )}

        {/* ── UPGRADE REQUEST STATE ── */}
        {!loading && pendingUpgrade && (
          <PendingUpgradeCard req={pendingUpgrade} onPay={payUpgradeInvoice} onCancel={cancelUpgrade}
            paying={payingUpg} cancelling={cancelling} />
        )}
        {!loading && rejectedUpgrade && <RejectedUpgradeNote req={rejectedUpgrade} />}

        {/* ── MINI STATS ── */}
        {!loading && sub && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 fade-up">
            <StatMini icon={<Clock className="w-5 h-5" />} label="Days Remaining"
              value={daysLeft == null ? "—" : `${daysLeft} days`}
              sub={sub.endDate ? `Renews ${sub.endDate}` : "No end date"}
              bg="bg-blue-50 border-blue-200" color="text-blue-700" delay={0} />
            <StatMini icon={<Crown className="w-5 h-5" />} label="Current Plan"
              value={sub.plan || sub.planCode || "—"} sub={sub.planCode || "Monthly subscription"}
              bg="bg-amber-50 border-amber-200" color="text-amber-700" delay={60} />
            <StatMini icon={<Zap className="w-5 h-5" />} label="Monthly Price"
              value={moneyShort(sub.monthlyPrice, sub.currency)} sub="Billed monthly"
              bg="bg-green-50 border-green-200" color="text-green-700" delay={120} />
          </div>
        )}

        {/* ── TWO COLUMN ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">

          {/* LEFT — plan details */}
          <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden fade-up">
            <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500 px-6 py-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-white">Current Plan Details</h2>
                <p className="text-white/70 text-xs mt-0.5">Your active subscription overview</p>
              </div>
              {status && (
                <span className={`ml-auto px-3 py-1 rounded-full text-xs font-extrabold border ${STATUS_PILL[status] || STATUS_PILL.EXPIRED} bg-white/90`}>
                  ● {status}
                </span>
              )}
            </div>

            {loading ? (
              <div className="p-6 space-y-4 animate-pulse">
                <div className="h-6 bg-slate-200 rounded-lg w-1/3" />
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex gap-4 py-2">
                    <div className="h-4 bg-slate-200 rounded w-28" />
                    <div className="h-4 bg-slate-100 rounded flex-1" />
                  </div>
                ))}
              </div>
            ) : !sub ? (
              <div className="p-10 text-center text-slate-400 text-sm">Could not load your subscription.</div>
            ) : (
              <div className="px-6 pb-6 pt-4">
                <PlanRow label="Plan Name"><span className="font-extrabold text-slate-800">{sub.plan || sub.planCode}</span></PlanRow>
                <PlanRow label="Plan Code"><span className="text-slate-600 font-mono">{sub.planCode || "—"}</span></PlanRow>
                <PlanRow label="Price">
                  <span className="font-extrabold text-slate-800">{money(sub.monthlyPrice, sub.currency)}</span>
                  <span className="text-slate-400"> / month</span>
                </PlanRow>
                <PlanRow label="Start Date"><span className="text-slate-600">{sub.startDate || "—"}</span></PlanRow>
                <PlanRow label="End Date"><span className="text-slate-600">{sub.endDate || "—"}</span></PlanRow>

                {/* Period progress */}
                <div className="mt-5 p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-extrabold text-slate-600">Subscription Period</p>
                    {daysLeft != null && (
                      <p className={`text-xs font-extrabold ${daysLeft <= 5 ? "text-red-600" : "text-green-600"}`}>
                        {daysLeft} days left
                      </p>
                    )}
                  </div>
                  {elapsedPct != null && (
                    <div>
                      <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className={`h-2.5 rounded-full transition-all duration-1000
                          ${elapsedPct >= 90 ? "bg-gradient-to-r from-red-500 to-rose-500"
                          : elapsedPct >= 70 ? "bg-gradient-to-r from-amber-500 to-orange-400"
                          : "bg-gradient-to-r from-blue-500 to-indigo-500"}`}
                          style={{ width: `${elapsedPct}%` }} />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-[10px] text-slate-400">{sub.startDate}</span>
                        <span className="text-[10px] text-slate-400">{sub.endDate}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Plan entitlements */}
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <LimitChip icon={<Users className="w-3.5 h-3.5" />} label="Users" value={fmtLimit(sub.maxUsers)} />
                  <LimitChip icon={<Layers className="w-3.5 h-3.5" />} label="Leads" value={fmtLimit(sub.maxLeads)} />
                  <LimitChip icon={<CalendarClock className="w-3.5 h-3.5" />} label="Bookings/mo" value={fmtLimit(sub.maxBookingsPerMonth)} />
                  <LimitChip icon={<HardDrive className="w-3.5 h-3.5" />} label="Storage" value={fmtStorage(sub.maxStorageMb)} />
                </div>

                {/* CTAs */}
                <div className="mt-5 flex flex-col sm:flex-row gap-3">
                  <button onClick={() => setShowPlanModal(true)} disabled={changeDisabled}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl
                      bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-700 hover:to-indigo-600
                      text-white font-bold text-sm shadow-md shadow-blue-200 transition-all hover:scale-[1.01] disabled:opacity-50">
                    <Rocket className="w-4 h-4" /> Change plan
                  </button>
                  <button onClick={scrollToInvoices}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl
                      border-2 border-slate-200 hover:border-blue-300 bg-white hover:bg-blue-50
                      text-slate-600 hover:text-blue-700 font-bold text-sm transition-all">
                    <FileText className="w-4 h-4" /> View invoices <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT — modules */}
          <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden fade-up"
            style={{ animationDelay: "80ms" }}>
            <div className="bg-gradient-to-r from-teal-500 to-cyan-500 px-5 py-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white flex-shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white">Included Modules</h3>
                <p className="text-white/70 text-[11px] mt-0.5">{modules.length} modules in your plan</p>
              </div>
            </div>
            <div className="p-5">
              {loading ? (
                <div className="space-y-2.5 animate-pulse">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="h-5 bg-slate-200 rounded-lg" style={{ width: `${55 + (i % 4) * 10}%` }} />
                  ))}
                </div>
              ) : modules.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">No modules enabled.</p>
              ) : (
                <ul className="space-y-2">
                  {modules.map((mod, idx) => (
                    <li key={mod} className="flex items-center gap-3 py-1.5 group"
                      style={{ animation: "fadeUp .35s ease both", animationDelay: `${idx * 30 + 80}ms` }}>
                      <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0
                        group-hover:bg-green-200 transition-colors">
                        <Check className="w-3 h-3 text-green-600" />
                      </div>
                      <span className="text-sm text-slate-700 font-medium group-hover:text-slate-900 transition-colors">
                        {humanizeModule(mod)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* ── INVOICES ── */}
        <div ref={invoicesRef} className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden fade-up scroll-mt-6">
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center text-white flex-shrink-0">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">Invoices &amp; Payments</h3>
              <p className="text-white/60 text-[11px] mt-0.5">Pay any outstanding invoice online</p>
            </div>
            <button onClick={loadSubAndInvoices} title="Refresh"
              className="ml-auto inline-flex items-center gap-1.5 text-white/70 hover:text-white text-xs font-bold">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-6 space-y-3 animate-pulse">
              {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded-xl" />)}
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-sm">No invoices yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                    <th className="px-6 py-3 font-extrabold">Invoice</th>
                    <th className="px-4 py-3 font-extrabold">Period</th>
                    <th className="px-4 py-3 font-extrabold">Due</th>
                    <th className="px-4 py-3 font-extrabold text-right">Amount</th>
                    <th className="px-4 py-3 font-extrabold">Status</th>
                    <th className="px-6 py-3 font-extrabold text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.publicId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                      <td className="px-6 py-3">
                        <div className="font-mono font-bold text-slate-800">{inv.invoiceNumber}</div>
                        {inv.notes && <div className="text-[11px] text-slate-400 max-w-xs truncate">{inv.notes}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{inv.periodStart} → {inv.periodEnd}</td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {inv.paidDate ? <span className="text-emerald-600">paid {inv.paidDate}</span> : (inv.dueDate || "—")}
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold text-slate-800 whitespace-nowrap">
                        {money(inv.amount, inv.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${INVOICE_PILL[inv.status] || INVOICE_PILL.VOID}`}>
                            {inv.status}
                          </span>
                          {inv.overdue && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold border bg-red-100 text-red-600 border-red-200">
                              overdue
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        {inv.status === "UNPAID" ? (
                          <button onClick={() => payInvoice(inv)} disabled={payingId === inv.publicId}
                            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600
                              text-white font-bold text-xs shadow-sm hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60">
                            {payingId === inv.publicId ? <Loader2 size={13} className="animate-spin" /> : <CreditCard size={13} />} Pay
                          </button>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── UPGRADE BANNER ── */}
        {!loading && sub && (
          <div className="relative bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 rounded-3xl overflow-hidden shadow-xl p-6 fade-up">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/5" />
              <div className="absolute -left-8 -bottom-12 w-48 h-48 rounded-full bg-white/5" />
            </div>
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-5">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <Crown className="w-4 h-4 text-amber-400" />
                  <span className="text-amber-400 text-xs font-extrabold uppercase tracking-widest">Need more room?</span>
                </div>
                <h3 className="text-xl font-extrabold text-white mb-1">Upgrade for more seats &amp; features</h3>
                <p className="text-slate-400 text-sm">Switch plans anytime — you only pay the prorated difference for this month.</p>
              </div>
              <button onClick={() => setShowPlanModal(true)} disabled={changeDisabled}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400
                  hover:from-amber-500 hover:to-orange-500 text-slate-900 font-extrabold text-sm shadow-lg shadow-amber-900/30
                  transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex-shrink-0">
                <Building2 className="w-4 h-4" /> Compare plans
              </button>
            </div>
          </div>
        )}
      </div>

      {showPlanModal && (
        <ChangePlanModal plans={plans} currentCode={sub?.planCode} busy={changing}
          onClose={() => !changing && setShowPlanModal(false)} onConfirm={confirmChangePlan} />
      )}
    </div>
  );
}
