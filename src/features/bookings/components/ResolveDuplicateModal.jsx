// src/features/bookings/components/ResolveDuplicateModal.jsx
// ─────────────────────────────────────────────────────────────
// Confirms "this booking is an accidental duplicate of that one".
//
// It is a cancellation underneath, but deliberately not the ordinary one: a duplicate is a
// data-entry correction, so the customer's cancellation charge is waived in full by the server. The
// two things the operator still has to supply are a REASON (this permanently cancels a booking and
// the reason is stored on the audit record) and, optionally, how much the supplier will give back —
// which is not waived, because the agency really may be out of pocket and the P&L should say so.
//
// Everything about the money is stated before the button, because the consequence is not reversible
// and is not obvious from the word "duplicate": whatever the customer has already paid on this
// booking becomes refund-due.
// ─────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import {
  FiX, FiAlertTriangle, FiArrowRight, FiCheckCircle,
} from "react-icons/fi";

const fmtINR = (v) =>
  `₹${Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TWO_DECIMALS = /^\d{1,10}(\.\d{1,2})?$/;

export default function ResolveDuplicateModal({
  duplicate,      // the booking being written off
  original,       // the booking being kept
  saving = false,
  onClose,
  onConfirm,
}) {
  const [reason, setReason] = useState("");
  const [vendorRecoverable, setVendorRecoverable] = useState("");
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !saving) onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const paid = Number(duplicate?.paidAmount) || 0;

  const validate = () => {
    const e = {};
    if (!reason.trim()) {
      e.reason = "Say why this booking is a duplicate — it is stored on the cancellation record";
    }
    const v = String(vendorRecoverable ?? "").trim();
    if (v && (!TWO_DECIMALS.test(v) || Number(v) < 0)) {
      e.vendorRecoverable = "Enter a valid amount (max 2 decimals)";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleConfirm = async () => {
    if (saving || !validate()) return;
    await onConfirm?.({
      originalBookingPublicId: original.publicId,
      reason: reason.trim(),
      // Absent rather than 0 when left blank: "nobody has worked out the supplier position yet" is
      // a different statement from "the supplier will refund nothing", and only one of them is true.
      vendorRecoverable: String(vendorRecoverable ?? "").trim()
        ? Number(vendorRecoverable)
        : undefined,
    });
  };

  const inputCls = (err) =>
    `w-full px-3 py-2.5 rounded-xl border text-sm font-medium outline-none transition-all ${
      err
        ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-50"
        : "border-slate-200 bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 hover:border-slate-300"
    }`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose?.(); }}
      style={{ fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}
    >
      <div className="bg-white w-full max-w-xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        <div className="bg-gradient-to-r from-rose-500 to-red-500 px-6 py-4 flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-extrabold text-white">Resolve accidental duplicate</h2>
            <p className="text-xs text-white/80 mt-0.5">This cancels one booking. It cannot be undone.</p>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="shrink-0 w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all disabled:opacity-50"
          >
            <FiX className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Which survives and which does not — spelled out, not inferred from row position. */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50/70">
              <FiCheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-emerald-700">Keeping</p>
                <p className="text-sm font-bold text-slate-800 truncate">
                  {original?.bookingCode} · {original?.customerNameSnapshot || "—"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 border-t border-slate-200 bg-rose-50/60">
              <FiArrowRight className="w-4 h-4 text-rose-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-rose-700">Cancelling as duplicate</p>
                <p className="text-sm font-bold text-slate-800 truncate">
                  {duplicate?.bookingCode} · {duplicate?.customerNameSnapshot || "—"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1.5">
            <p className="flex items-center gap-2 text-xs font-extrabold text-amber-800">
              <FiAlertTriangle className="w-4 h-4 shrink-0" /> What happens
            </p>
            <ul className="text-xs font-medium text-amber-800/90 space-y-1 pl-6 list-disc">
              <li>The cancellation charge is waived in full — the customer is not billed for your data-entry error.</li>
              <li>
                {paid > 0
                  ? <>The <span className="font-extrabold">{fmtINR(paid)}</span> already received becomes refund-due and appears in the refund ledger.</>
                  : <>Nothing has been received on this booking, so there is nothing to refund.</>}
              </li>
              <li>The lead stays converted, because the booking you are keeping still exists.</li>
            </ul>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">
              Reason <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => { setReason(e.target.value); setErrors((p) => ({ ...p, reason: "" })); }}
              disabled={saving}
              placeholder="e.g. Entered twice while the page was loading — same customer, same trip"
              className={inputCls(errors.reason) + " resize-none"}
            />
            {errors.reason && <p className="text-[11px] text-red-500 font-semibold mt-1">{errors.reason}</p>}
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">
              Recoverable from supplier <span className="font-medium normal-case text-slate-400">(optional)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-bold">₹</span>
              <input
                type="number" step="0.01" min="0" inputMode="decimal"
                value={vendorRecoverable}
                onChange={(e) => { setVendorRecoverable(e.target.value); setErrors((p) => ({ ...p, vendorRecoverable: "" })); }}
                disabled={saving}
                placeholder="0.00"
                className={inputCls(errors.vendorRecoverable) + " pl-8"}
              />
            </div>
            <p className="text-[11px] text-slate-400 font-normal mt-1 leading-relaxed">
              How much the supplier will give back on this booking. The customer's charge is waived
              regardless — this only keeps the profit figure honest. Leave blank if you don't know yet.
            </p>
            {errors.vendorRecoverable && (
              <p className="text-[11px] text-red-500 font-semibold mt-1">{errors.vendorRecoverable}</p>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-bold text-sm transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm shadow-md shadow-rose-200 flex items-center gap-2 transition-all disabled:opacity-60"
          >
            {saving ? (
              <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Resolving…</>
            ) : (
              <>Resolve {duplicate?.bookingCode} as duplicate</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
