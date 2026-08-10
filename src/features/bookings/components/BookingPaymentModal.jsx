// src/features/bookings/components/BookingPaymentModal.jsx
// ─────────────────────────────────────────────────────────────
// Record SEVERAL receipts in one go — the payment-side mirror of BookingExpenseModal.
//
// Why a modal and not more fields on the page's quick-add panel: real collection is rarely one
// clean receipt. A customer pays ₹20,000 cash at the counter, ₹30,000 by UPI that evening and the
// balance by transfer next week, and whoever reconciles enters all three together. Three page
// round-trips is three chances to be interrupted halfway.
//
// Two behaviours are load-bearing and match the expense modal deliberately:
//
//   1. AUTO-SAVED DRAFT. Every keystroke is persisted to localStorage, scoped to booking + signed-in
//      user, and cleared ONLY after the server accepts the batch. Closing the modal by any route —
//      the X, the backdrop, navigating away, an accidental refresh — loses nothing.
//   2. ALL-OR-NOTHING SAVE. The backend writes the batch in one transaction, so a rejected row means
//      none were written. The draft therefore still holds everything and the user fixes one field
//      rather than working out which rows landed.
// ─────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiX, FiPlus, FiTrash2, FiSave, FiAlertCircle, FiCopy,
} from "react-icons/fi";

/* ─── CONSTANTS ──────────────────────────────────────────────── */

const PAYMENT_TYPES = ["Advance", "Instalment", "Final Payment", "Adjustment", "Other"];

const PAYMENT_METHODS = [
  "Cash", "Bank Transfer", "UPI", "Credit Card", "Debit Card", "Cheque", "Online", "Wallet", "Other",
];

// Backend caps a batch at @Size(max = 50) — one row over rejects the whole submission.
const MAX_ROWS = 50;

const DRAFT_VERSION = 1;
const DRAFT_PREFIX = "travelcrm:booking-payment-draft";

// Mirrors backend @Digits(integer = 10, fraction = 2) on amount.
const TWO_DECIMALS = /^\d{1,10}(\.\d{1,2})?$/;

const today = () => new Date().toISOString().split("T")[0];

const fmtINR = (v) =>
  `₹${Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/* ─── DRAFT PERSISTENCE ──────────────────────────────────────── */

const createEmptyRow = () => ({
  amount: "",
  paymentType: "",
  paymentMethod: "",
  paymentAccount: "",
  paidByName: "",
  receivedByUserPublicId: "",
  paymentDate: today(),
  paymentTime: "",
  reference: "",
  notes: "",
});

const getDraftKey = (booking) => {
  const bookingId = booking?.id ?? booking?.publicId ?? booking?.bookingId;
  if (!bookingId) return null;
  try {
    // Scoped to booking AND signed-in user: booking UUIDs isolate tenants, and the user component
    // stops a colleague on a shared browser from picking up someone else's unfinished money entry.
    const userEmail = window.localStorage.getItem("userEmail")?.trim().toLowerCase();
    if (!userEmail) return null;
    return `${DRAFT_PREFIX}:v${DRAFT_VERSION}:${encodeURIComponent(userEmail)}:${bookingId}`;
  } catch {
    return null;
  }
};

const normalizeDraftRow = (stored) => {
  const row = createEmptyRow();
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return row;
  Object.keys(row).forEach((field) => {
    if (typeof stored[field] === "string") row[field] = stored[field];
  });
  return row;
};

const loadDraft = (draftKey) => {
  const fallback = [createEmptyRow()];
  if (!draftKey) return fallback;
  try {
    const raw = window.localStorage.getItem(draftKey);
    if (!raw) return fallback;

    const draft = JSON.parse(raw);
    if (draft?.version !== DRAFT_VERSION || !Array.isArray(draft.payments) || draft.payments.length === 0) {
      window.localStorage.removeItem(draftKey);
      return fallback;
    }
    return draft.payments.slice(0, MAX_ROWS).map(normalizeDraftRow);
  } catch {
    // Corrupt JSON or unavailable storage must never stop the ledger from opening.
    try { window.localStorage.removeItem(draftKey); } catch { /* storage may be disabled */ }
    return fallback;
  }
};

// A single untouched row is not worth persisting — it would resurrect an "unsaved draft" banner
// for someone who merely opened and closed the modal.
const hasMeaningfulDraft = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return false;
  if (rows.length > 1) return true;
  const empty = createEmptyRow();
  return Object.keys(empty).some((f) => rows[0]?.[f] !== empty[f]);
};

const persistDraft = (draftKey, rows) => {
  if (!draftKey) return;
  try {
    if (!hasMeaningfulDraft(rows)) {
      window.localStorage.removeItem(draftKey);
      return;
    }
    window.localStorage.setItem(draftKey, JSON.stringify({
      version: DRAFT_VERSION, savedAt: new Date().toISOString(), payments: rows,
    }));
  } catch {
    // localStorage is a recovery aid, not a reason to interrupt data entry (quota / private mode).
  }
};

const clearDraft = (draftKey) => {
  if (!draftKey) return;
  try { window.localStorage.removeItem(draftKey); } catch { /* a saved batch stays saved */ }
};

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════════ */

export default function BookingPaymentModal({
  booking,
  users = [],
  dueAmount = 0,
  saving = false,
  onClose,
  onSave,
}) {
  const draftKey = getDraftKey(booking);
  const [rows, setRows] = useState(() => loadDraft(draftKey));
  const [errors, setErrors] = useState({});
  const draftCommittedRef = useRef(false);

  // Persist every state transition synchronously. The cleanup covers every close path (header X,
  // backdrop, Escape, parent navigation); the committed ref stops that cleanup from resurrecting a
  // draft that was just cleared by a successful save.
  useEffect(() => {
    if (!draftCommittedRef.current) persistDraft(draftKey, rows);
    return () => {
      if (!draftCommittedRef.current) persistDraft(draftKey, rows);
    };
  }, [draftKey, rows]);

  // Escape closes. Registered here rather than on a wrapper so it works regardless of focus.
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !saving) onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const update = (index, field, value) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
    setErrors((prev) => {
      if (!prev[`${index}.${field}`]) return prev;
      const next = { ...prev };
      delete next[`${index}.${field}`];
      return next;
    });
  };

  const addRow = () => {
    if (rows.length >= MAX_ROWS) return;
    // Carry the previous row's date, account and receiver forward: entering three receipts from one
    // reconciliation session means retyping those three fields three times otherwise.
    const last = rows[rows.length - 1];
    setRows((prev) => [...prev, {
      ...createEmptyRow(),
      paymentDate: last?.paymentDate || today(),
      paymentAccount: last?.paymentAccount || "",
      receivedByUserPublicId: last?.receivedByUserPublicId || "",
    }]);
  };

  const duplicateRow = (index) => {
    if (rows.length >= MAX_ROWS) return;
    setRows((prev) => {
      const copy = { ...prev[index] };
      return [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)];
    });
  };

  const removeRow = (index) => {
    setRows((prev) => (prev.length === 1 ? [createEmptyRow()] : prev.filter((_, i) => i !== index)));
    setErrors({});
  };

  const batchTotal = useMemo(
    () => rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
    [rows]
  );

  // Shown live so the user sees the ceiling coming before they submit. The SERVER is still the
  // authority — it re-checks the running total across the batch and rejects the whole set — so this
  // is a courtesy, never the guarantee.
  const exceedsDue = batchTotal > Number(dueAmount || 0) + 0.005;

  const validate = () => {
    const e = {};
    rows.forEach((r, i) => {
      const amount = String(r.amount ?? "").trim();
      if (!amount) {
        e[`${i}.amount`] = "Amount is required";
      } else if (!TWO_DECIMALS.test(amount) || Number(amount) <= 0) {
        e[`${i}.amount`] = "Enter a valid amount (max 2 decimals)";
      }
      if (!r.paymentDate) e[`${i}.paymentDate`] = "Date is required";
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (saving) return;
    if (!validate()) return;

    // Blank strings must not travel: the backend treats "" on an optional String differently from
    // absent on some columns, and a null receiver means "default to the current user" — an empty
    // string would be a malformed UUID and 400 the whole batch.
    const payload = rows.map((r) => ({
      amount: Number(r.amount),
      paymentType: r.paymentType || null,
      paymentMethod: r.paymentMethod || null,
      paymentAccount: r.paymentAccount?.trim() || null,
      paidByName: r.paidByName?.trim() || null,
      receivedByUserPublicId: r.receivedByUserPublicId || null,
      paymentDate: r.paymentDate,
      paymentTime: r.paymentTime || null,
      reference: r.reference?.trim() || null,
      notes: r.notes?.trim() || null,
    }));

    const ok = await onSave?.(payload);
    if (ok) {
      // Order matters: mark committed BEFORE clearing, so the unmount cleanup above cannot write
      // the rows back after the save succeeded.
      draftCommittedRef.current = true;
      clearDraft(draftKey);
    }
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
      <div className="bg-white w-full max-w-5xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* ── HEADER ── */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-500 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-white">Record Payments</h2>
            <p className="text-xs text-white/75 mt-0.5">
              {booking?.code ? `${booking.code} · ` : ""}
              {rows.length} {rows.length === 1 ? "entry" : "entries"} · saved as you type
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center transition-all disabled:opacity-50"
          >
            <FiX className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* ── ROWS ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-slate-50/60">
          {rows.map((row, index) => (
            <div key={index} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <span className="text-xs font-extrabold text-slate-600">
                  Entry {index + 1}
                  {Number(row.amount) > 0 && (
                    <span className="ml-2 text-green-600">{fmtINR(row.amount)}</span>
                  )}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => duplicateRow(index)}
                    disabled={saving || rows.length >= MAX_ROWS}
                    title="Duplicate this entry"
                    className="w-7 h-7 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center transition-all disabled:opacity-40"
                  >
                    <FiCopy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => removeRow(index)}
                    disabled={saving}
                    title="Remove this entry"
                    className="w-7 h-7 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-all disabled:opacity-40"
                  >
                    <FiTrash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Amount */}
                <div>
                  <label className={labelCls}>Amount <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-bold">₹</span>
                    <input
                      type="number" step="0.01" min="0" inputMode="decimal"
                      value={row.amount}
                      onChange={(e) => update(index, "amount", e.target.value)}
                      disabled={saving}
                      placeholder="0.00"
                      className={inputCls(errors[`${index}.amount`]) + " pl-7"}
                    />
                  </div>
                  {errors[`${index}.amount`] && (
                    <p className="text-[11px] text-red-500 font-semibold mt-1">{errors[`${index}.amount`]}</p>
                  )}
                </div>

                {/* Type */}
                <div>
                  <label className={labelCls}>Type</label>
                  <select
                    value={row.paymentType}
                    onChange={(e) => update(index, "paymentType", e.target.value)}
                    disabled={saving}
                    className={inputCls(false)}
                  >
                    <option value="">Select</option>
                    {PAYMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>

                {/* Method — HOW it was tendered */}
                <div>
                  <label className={labelCls}>Mode</label>
                  <select
                    value={row.paymentMethod}
                    onChange={(e) => update(index, "paymentMethod", e.target.value)}
                    disabled={saving}
                    className={inputCls(false)}
                  >
                    <option value="">Select</option>
                    {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>

                {/* Account — WHERE it landed. Free text: an agency's account list changes far more
                    often than the code does, and recording a receipt must never wait on a settings
                    screen. */}
                <div>
                  <label className={labelCls}>Account</label>
                  <input
                    value={row.paymentAccount}
                    onChange={(e) => update(index, "paymentAccount", e.target.value)}
                    disabled={saving}
                    placeholder="HDFC ••4521 / Cash Counter"
                    className={inputCls(false)}
                  />
                </div>

                {/* Paid by — often NOT the booking's customer (a relative, a corporate desk). */}
                <div>
                  <label className={labelCls}>Paid By</label>
                  <input
                    value={row.paidByName}
                    onChange={(e) => update(index, "paidByName", e.target.value)}
                    disabled={saving}
                    placeholder={booking?.customer || "Payer name"}
                    className={inputCls(false)}
                  />
                </div>

                {/* Received by — who on OUR side is holding it. Left blank the server stamps the
                    signed-in user, which is the common case. */}
                <div>
                  <label className={labelCls}>Received By</label>
                  <select
                    value={row.receivedByUserPublicId}
                    onChange={(e) => update(index, "receivedByUserPublicId", e.target.value)}
                    disabled={saving || users.length === 0}
                    className={inputCls(false)}
                  >
                    <option value="">{users.length ? "Me (default)" : "Me"}</option>
                    {users.map((u) => (
                      <option key={u.publicId} value={u.publicId}>{u.name || u.username || u.email}</option>
                    ))}
                  </select>
                </div>

                {/* Date */}
                <div>
                  <label className={labelCls}>Date <span className="text-red-400">*</span></label>
                  <input
                    type="date"
                    value={row.paymentDate}
                    onChange={(e) => update(index, "paymentDate", e.target.value)}
                    disabled={saving}
                    className={inputCls(errors[`${index}.paymentDate`])}
                  />
                  {errors[`${index}.paymentDate`] && (
                    <p className="text-[11px] text-red-500 font-semibold mt-1">{errors[`${index}.paymentDate`]}</p>
                  )}
                </div>

                {/* Time — optional on purpose. A date with no remembered time is honest; a
                    fabricated 00:00 is not. */}
                <div>
                  <label className={labelCls}>Time</label>
                  <input
                    type="time"
                    value={row.paymentTime}
                    onChange={(e) => update(index, "paymentTime", e.target.value)}
                    disabled={saving}
                    className={inputCls(false)}
                  />
                </div>

                {/* Reference */}
                <div className="col-span-2">
                  <label className={labelCls}>Reference</label>
                  <input
                    value={row.reference}
                    onChange={(e) => update(index, "reference", e.target.value)}
                    disabled={saving}
                    placeholder="UTR / cheque no. / txn id"
                    className={inputCls(false)}
                  />
                </div>

                {/* Notes */}
                <div className="col-span-2">
                  <label className={labelCls}>Notes</label>
                  <input
                    value={row.notes}
                    onChange={(e) => update(index, "notes", e.target.value)}
                    disabled={saving}
                    placeholder="Optional"
                    className={inputCls(false)}
                  />
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={addRow}
            disabled={saving || rows.length >= MAX_ROWS}
            className="w-full py-3 rounded-2xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/40 font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            <FiPlus className="w-4 h-4" />
            {rows.length >= MAX_ROWS ? `Maximum ${MAX_ROWS} entries` : "Add another entry"}
          </button>
        </div>

        {/* ── FOOTER ── */}
        <div className="px-6 py-4 border-t border-slate-100 bg-white">
          {exceedsDue && (
            <div className="mb-3 flex items-start gap-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <FiAlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                This batch totals {fmtINR(batchTotal)} against {fmtINR(dueAmount)} due. The server
                checks the combined total and will reject the whole set.
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="text-xs font-bold text-slate-500">
              Batch total:{" "}
              <span className={exceedsDue ? "text-amber-600" : "text-green-600"}>{fmtINR(batchTotal)}</span>
              <span className="text-slate-300 mx-2">|</span>
              Due: <span className="text-slate-700">{fmtINR(dueAmount)}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-bold text-sm transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || exceedsDue}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm shadow-md shadow-blue-200 flex items-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving…</>
                ) : (
                  <><FiSave className="w-4 h-4" /> Save {rows.length} {rows.length === 1 ? "Entry" : "Entries"}</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
