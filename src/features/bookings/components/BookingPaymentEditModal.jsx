// src/features/bookings/components/BookingPaymentEditModal.jsx
// ─────────────────────────────────────────────────────────────
// Correct an already-recorded payment entry. Behind PAYMENT_MANAGE — a different, higher authority
// than the one that recorded it, because this rewrites what the ledger already says about money
// that has changed hands.
//
// Two things this deliberately does that the add form does not:
//
//   1. REQUIRES A REASON. An amended money record with no stated reason is what an audit cannot
//      accept, so the field is mandatory here and stored server-side with the amending user and
//      timestamp. The ledger then marks the row as edited.
//   2. DOES NOT DEFAULT "Received By" TO ME. On the add path the person recording is normally the
//      person who took the cash, so defaulting is right. An amendment is typically made by someone
//      else — an admin fixing a clerk's typo — and defaulting there would silently rewrite the
//      receiver to the admin and destroy the attribution the field exists for.
//
// The request is a FULL representation, not a patch: every field is written, so a cleared box
// clears the stored value. That is what makes blanking a wrong reference possible at all.
// ─────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { FiX, FiSave, FiAlertTriangle } from "react-icons/fi";

const PAYMENT_TYPES = ["Advance", "Instalment", "Final Payment", "Adjustment", "Other"];

const PAYMENT_METHODS = [
  "Cash", "Bank Transfer", "UPI", "Credit Card", "Debit Card", "Cheque", "Online", "Wallet", "Other",
];

const TWO_DECIMALS = /^\d{1,10}(\.\d{1,2})?$/;

const fmtINR = (v) =>
  `₹${Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// The stored time comes back as "HH:mm:ss"; <input type="time"> wants "HH:mm".
const toTimeInput = (v) => (v ? String(v).slice(0, 5) : "");

export default function BookingPaymentEditModal({
  payment,
  users = [],
  // What paidAmount would become if this entry were removed entirely — the headroom the new amount
  // has to fit inside. Computed by the page, which knows the booking totals.
  maxAmount,
  saving = false,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState({
    amount: payment?.amount != null ? String(payment.amount) : "",
    paymentType: payment?.paymentType || "",
    paymentMethod: payment?.paymentMethod || "",
    paymentAccount: payment?.paymentAccount || "",
    paidByName: payment?.paidByName || "",
    receivedByUserPublicId: payment?.receivedByUserPublicId || "",
    paymentDate: payment?.paymentDate || "",
    paymentTime: toTimeInput(payment?.paymentTime),
    reference: payment?.reference || "",
    notes: payment?.notes || "",
    amendmentReason: "",
  });
  const [errors, setErrors] = useState({});

  const set = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((p) => (p[k] ? { ...p, [k]: "" } : p));
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !saving) onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const original = Number(payment?.amount || 0);
  const next = Number(form.amount || 0);
  const delta = next - original;

  const validate = () => {
    const e = {};
    const amount = String(form.amount ?? "").trim();
    if (!amount) {
      e.amount = "Amount is required";
    } else if (!TWO_DECIMALS.test(amount) || Number(amount) <= 0) {
      e.amount = "Enter a valid amount (max 2 decimals)";
    }
    if (!form.paymentDate) e.paymentDate = "Date is required";
    if (!form.amendmentReason.trim()) e.amendmentReason = "Say why this entry is being changed";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (saving || !validate()) return;
    await onSave?.({
      amount: Number(form.amount),
      paymentType: form.paymentType || null,
      paymentMethod: form.paymentMethod || null,
      paymentAccount: form.paymentAccount?.trim() || null,
      paidByName: form.paidByName?.trim() || null,
      receivedByUserPublicId: form.receivedByUserPublicId || null,
      paymentDate: form.paymentDate,
      paymentTime: form.paymentTime || null,
      reference: form.reference?.trim() || null,
      notes: form.notes?.trim() || null,
      amendmentReason: form.amendmentReason.trim(),
    });
  };

  const inputCls = (err) =>
    `w-full px-3 py-2 rounded-xl border text-sm font-medium outline-none transition-all ${
      err
        ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-50"
        : "border-slate-200 bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 hover:border-slate-300"
    }`;

  const labelCls = "text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 block";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose?.(); }}
      style={{ fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}
    >
      <div className="bg-white w-full max-w-2xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-white">Edit Payment Entry</h2>
            <p className="text-xs text-white/80 mt-0.5">
              Originally {fmtINR(original)} on {payment?.paymentDate || "—"}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all disabled:opacity-50"
          >
            <FiX className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          <div className="flex items-start gap-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
            <FiAlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              This changes a recorded receipt. The booking's paid amount moves with it, and the
              change is stamped with your name, the time and the reason below.
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Amount <span className="text-red-400">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-bold">₹</span>
                <input
                  type="number" step="0.01" min="0" inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => set("amount", e.target.value)}
                  disabled={saving}
                  className={inputCls(errors.amount) + " pl-7"}
                />
              </div>
              {errors.amount
                ? <p className="text-[11px] text-red-500 font-semibold mt-1">{errors.amount}</p>
                : delta !== 0 && (
                    <p className={`text-[11px] font-semibold mt-1 ${delta > 0 ? "text-blue-600" : "text-amber-600"}`}>
                      {delta > 0 ? "+" : ""}{fmtINR(delta)} to the booking's paid amount
                    </p>
                  )}
              {maxAmount != null && next > maxAmount && (
                <p className="text-[11px] text-red-500 font-semibold mt-1">
                  Above the {fmtINR(maxAmount)} this booking can still take
                </p>
              )}
            </div>

            <div>
              <label className={labelCls}>Type</label>
              <select
                value={form.paymentType}
                onChange={(e) => set("paymentType", e.target.value)}
                disabled={saving}
                className={inputCls(false)}
              >
                <option value="">Select</option>
                {PAYMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Mode</label>
              <select
                value={form.paymentMethod}
                onChange={(e) => set("paymentMethod", e.target.value)}
                disabled={saving}
                className={inputCls(false)}
              >
                <option value="">Select</option>
                {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Account</label>
              <input
                value={form.paymentAccount}
                onChange={(e) => set("paymentAccount", e.target.value)}
                disabled={saving}
                placeholder="HDFC ••4521 / Cash Counter"
                className={inputCls(false)}
              />
            </div>

            <div>
              <label className={labelCls}>Paid By</label>
              <input
                value={form.paidByName}
                onChange={(e) => set("paidByName", e.target.value)}
                disabled={saving}
                className={inputCls(false)}
              />
            </div>

            <div>
              <label className={labelCls}>Received By</label>
              <select
                value={form.receivedByUserPublicId}
                onChange={(e) => set("receivedByUserPublicId", e.target.value)}
                disabled={saving || users.length === 0}
                className={inputCls(false)}
              >
                <option value="">Not recorded</option>
                {users.map((u) => (
                  <option key={u.publicId} value={u.publicId}>{u.name || u.username || u.email}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Date <span className="text-red-400">*</span></label>
              <input
                type="date"
                value={form.paymentDate}
                onChange={(e) => set("paymentDate", e.target.value)}
                disabled={saving}
                className={inputCls(errors.paymentDate)}
              />
              {errors.paymentDate && (
                <p className="text-[11px] text-red-500 font-semibold mt-1">{errors.paymentDate}</p>
              )}
            </div>

            <div>
              <label className={labelCls}>Time</label>
              <input
                type="time"
                value={form.paymentTime}
                onChange={(e) => set("paymentTime", e.target.value)}
                disabled={saving}
                className={inputCls(false)}
              />
            </div>

            <div>
              <label className={labelCls}>Reference</label>
              <input
                value={form.reference}
                onChange={(e) => set("reference", e.target.value)}
                disabled={saving}
                className={inputCls(false)}
              />
            </div>

            <div className="col-span-2 md:col-span-3">
              <label className={labelCls}>Notes</label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                disabled={saving}
                className={inputCls(false) + " resize-none"}
              />
            </div>

            <div className="col-span-2 md:col-span-3">
              <label className={labelCls}>
                Reason for the change <span className="text-red-400">*</span>
              </label>
              <input
                value={form.amendmentReason}
                onChange={(e) => set("amendmentReason", e.target.value)}
                disabled={saving}
                placeholder="e.g. Amount keyed as 5000, actual receipt was 500"
                className={inputCls(errors.amendmentReason)}
              />
              {errors.amendmentReason && (
                <p className="text-[11px] text-red-500 font-semibold mt-1">{errors.amendmentReason}</p>
              )}
            </div>
          </div>

          {payment?.amended && (
            <p className="text-[11px] text-slate-400 font-medium">
              Last edited by {payment.amendedBy || "—"} on {payment.amendedAt || "—"}
              {payment.amendmentReason ? ` — "${payment.amendmentReason}"` : ""}
            </p>
          )}
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
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-sm shadow-md shadow-amber-200 flex items-center gap-2 transition-all disabled:opacity-60"
          >
            {saving ? (
              <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving…</>
            ) : (
              <><FiSave className="w-4 h-4" /> Save Changes</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
