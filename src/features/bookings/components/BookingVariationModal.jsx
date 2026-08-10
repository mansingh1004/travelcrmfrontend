// src/features/bookings/components/BookingVariationModal.jsx
// ─────────────────────────────────────────────────────────────
// Record what changed after the booking was confirmed — an itinerary change, an extra activity, a
// permit nobody costed, a route or hotel swap, a penalty.
//
// ONE ROW, BOTH SIDES. Each entry asks two money questions: what did we charge the customer for it,
// and what did it cost us. That pairing is the whole feature — "paragliding: billed 3,500, cost
// 3,000" answers "was the change worth making?" in one line, which two separate ledgers could not
// do without the reader joining them in their head. The net is shown live as you type.
//
// Both amounts are SIGNED. A waiver is a negative customer amount, a supplier credit is a negative
// cost. There is no separate "type" to pick, because a negative number already says it — and a row
// that both charges the customer and costs the agency stays expressible.
// ─────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import {
  FiX, FiPlus, FiTrash2, FiSave, FiAlertCircle, FiTrendingUp, FiTrendingDown,
} from "react-icons/fi";

const MAX_ROWS = 50;

// Mirrors backend @Digits(integer = 10, fraction = 2); the leading minus is what makes a waiver or
// a supplier credit expressible without a second control.
const SIGNED_TWO_DECIMALS = /^-?\d{1,10}(\.\d{1,2})?$/;

const today = () => new Date().toISOString().split("T")[0];

const fmtINR = (v) =>
  `₹${Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const signed = (v) => {
  const n = Number(v) || 0;
  if (n === 0) return "₹0";
  return (n > 0 ? "+" : "−") + fmtINR(Math.abs(n));
};

const emptyRow = (categories) => ({
  category: categories?.[0]?.value || "OTHER",
  description: "",
  customerAmountDelta: "",
  agencyCostDelta: "",
  variationDate: today(),
  vendorName: "",
  referenceNumber: "",
  notes: "",
});

export default function BookingVariationModal({
  booking,
  categories = [],
  // Present when editing a single existing row; absent when adding.
  variation = null,
  saving = false,
  onClose,
  onSave,
}) {
  const editing = Boolean(variation);

  const [rows, setRows] = useState(() =>
    editing
      ? [{
          category: variation.category || "OTHER",
          description: variation.description || "",
          customerAmountDelta: variation.customerAmountDelta != null ? String(variation.customerAmountDelta) : "",
          agencyCostDelta: variation.agencyCostDelta != null ? String(variation.agencyCostDelta) : "",
          variationDate: variation.variationDate || today(),
          vendorName: variation.vendorName || "",
          referenceNumber: variation.referenceNumber || "",
          notes: variation.notes || "",
        }]
      : [emptyRow(categories)]
  );
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !saving) onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const update = (index, field, value) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
    setErrors((prev) => {
      const key = `${index}.${field}`;
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const addRow = () => {
    if (rows.length >= MAX_ROWS) return;
    const last = rows[rows.length - 1];
    // Carry the date forward: a batch is usually one day's worth of changes on one trip.
    setRows((prev) => [...prev, { ...emptyRow(categories), variationDate: last?.variationDate || today() }]);
  };

  const removeRow = (index) => {
    setRows((prev) => (prev.length === 1 ? [emptyRow(categories)] : prev.filter((_, i) => i !== index)));
    setErrors({});
  };

  const totals = useMemo(() => {
    let customer = 0;
    let cost = 0;
    rows.forEach((r) => {
      customer += Number(r.customerAmountDelta) || 0;
      cost += Number(r.agencyCostDelta) || 0;
    });
    return { customer, cost, net: customer - cost };
  }, [rows]);

  const validate = () => {
    const e = {};
    rows.forEach((r, i) => {
      if (!r.description.trim()) e[`${i}.description`] = "Describe what changed";
      if (!r.variationDate) e[`${i}.variationDate`] = "Date is required";

      const c = String(r.customerAmountDelta ?? "").trim();
      const a = String(r.agencyCostDelta ?? "").trim();
      if (c && !SIGNED_TWO_DECIMALS.test(c)) e[`${i}.customerAmountDelta`] = "Invalid amount";
      if (a && !SIGNED_TWO_DECIMALS.test(a)) e[`${i}.agencyCostDelta`] = "Invalid amount";

      // The server refuses this too. Caught here so the user is told which row, rather than being
      // handed a whole-batch rejection with a row number to count out by hand.
      if ((Number(c) || 0) === 0 && (Number(a) || 0) === 0) {
        e[`${i}.customerAmountDelta`] = "Enter a charge, a cost, or both";
      }
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (saving || !validate()) return;
    const payload = rows.map((r) => ({
      category: r.category,
      description: r.description.trim(),
      customerAmountDelta: String(r.customerAmountDelta ?? "").trim() ? Number(r.customerAmountDelta) : 0,
      agencyCostDelta: String(r.agencyCostDelta ?? "").trim() ? Number(r.agencyCostDelta) : 0,
      variationDate: r.variationDate,
      vendorName: r.vendorName?.trim() || null,
      referenceNumber: r.referenceNumber?.trim() || null,
      notes: r.notes?.trim() || null,
    }));
    await onSave?.(editing ? payload[0] : payload);
  };

  const inputCls = (err) =>
    `w-full px-3 py-2 rounded-xl border text-sm font-medium outline-none transition-all ${
      err
        ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-50"
        : "border-slate-200 bg-white focus:border-violet-400 focus:ring-2 focus:ring-violet-100 hover:border-slate-300"
    }`;

  const labelCls = "text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 block";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose?.(); }}
      style={{ fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}
    >
      <div className="bg-white w-full max-w-5xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-4 flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-extrabold text-white">
              {editing ? "Edit change" : "Record changes"}
            </h2>
            <p className="text-xs text-white/75 mt-0.5">
              {booking?.code ? `${booking.code} · ` : ""}
              What happened after the booking, and what it did to the money
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="shrink-0 w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center transition-all disabled:opacity-50"
          >
            <FiX className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-slate-50/60">
          {rows.map((row, index) => {
            const rowNet = (Number(row.customerAmountDelta) || 0) - (Number(row.agencyCostDelta) || 0);
            const hasMoney = (Number(row.customerAmountDelta) || 0) !== 0
              || (Number(row.agencyCostDelta) || 0) !== 0;
            return (
              <div key={index} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                  <span className="text-xs font-extrabold text-slate-600 flex items-center gap-2">
                    {editing ? "Change" : `Change ${index + 1}`}
                    {hasMoney && (
                      <span className={`flex items-center gap-1 text-[11px] font-bold ${rowNet >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {rowNet >= 0 ? <FiTrendingUp className="w-3 h-3" /> : <FiTrendingDown className="w-3 h-3" />}
                        {signed(rowNet)}
                      </span>
                    )}
                  </span>
                  {!editing && (
                    <button
                      onClick={() => removeRow(index)}
                      disabled={saving}
                      className="w-7 h-7 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-all disabled:opacity-40"
                    >
                      <FiTrash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className={labelCls}>What kind</label>
                    <select
                      value={row.category}
                      onChange={(e) => update(index, "category", e.target.value)}
                      disabled={saving}
                      className={inputCls(false)}
                    >
                      {categories.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2 md:col-span-3">
                    <label className={labelCls}>What changed <span className="text-red-400">*</span></label>
                    <input
                      value={row.description}
                      onChange={(e) => update(index, "description", e.target.value)}
                      disabled={saving}
                      placeholder="Paragliding for 2 pax at Sarangkot"
                      className={inputCls(errors[`${index}.description`])}
                    />
                    {errors[`${index}.description`] && (
                      <p className="text-[11px] text-red-500 font-semibold mt-1">{errors[`${index}.description`]}</p>
                    )}
                  </div>

                  {/* The pair. Kept side by side because they are one thought, not two. */}
                  <div>
                    <label className={labelCls}>Charged to customer</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-bold">₹</span>
                      <input
                        type="number" step="0.01" inputMode="decimal"
                        value={row.customerAmountDelta}
                        onChange={(e) => update(index, "customerAmountDelta", e.target.value)}
                        disabled={saving}
                        placeholder="0.00"
                        className={inputCls(errors[`${index}.customerAmountDelta`]) + " pl-7"}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Negative to waive</p>
                    {errors[`${index}.customerAmountDelta`] && (
                      <p className="text-[11px] text-red-500 font-semibold mt-1">{errors[`${index}.customerAmountDelta`]}</p>
                    )}
                  </div>

                  <div>
                    <label className={labelCls}>Cost to us</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-bold">₹</span>
                      <input
                        type="number" step="0.01" inputMode="decimal"
                        value={row.agencyCostDelta}
                        onChange={(e) => update(index, "agencyCostDelta", e.target.value)}
                        disabled={saving}
                        placeholder="0.00"
                        className={inputCls(errors[`${index}.agencyCostDelta`]) + " pl-7"}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Negative if credited back</p>
                    {errors[`${index}.agencyCostDelta`] && (
                      <p className="text-[11px] text-red-500 font-semibold mt-1">{errors[`${index}.agencyCostDelta`]}</p>
                    )}
                  </div>

                  <div>
                    <label className={labelCls}>When <span className="text-red-400">*</span></label>
                    <input
                      type="date"
                      value={row.variationDate}
                      onChange={(e) => update(index, "variationDate", e.target.value)}
                      disabled={saving}
                      className={inputCls(errors[`${index}.variationDate`])}
                    />
                    {errors[`${index}.variationDate`] && (
                      <p className="text-[11px] text-red-500 font-semibold mt-1">{errors[`${index}.variationDate`]}</p>
                    )}
                  </div>

                  <div>
                    <label className={labelCls}>Paid to</label>
                    <input
                      value={row.vendorName}
                      onChange={(e) => update(index, "vendorName", e.target.value)}
                      disabled={saving}
                      placeholder="Operator / guide"
                      className={inputCls(false)}
                    />
                  </div>

                  <div className="col-span-2">
                    <label className={labelCls}>Reference</label>
                    <input
                      value={row.referenceNumber}
                      onChange={(e) => update(index, "referenceNumber", e.target.value)}
                      disabled={saving}
                      placeholder="Permit / voucher / receipt no."
                      className={inputCls(false)}
                    />
                  </div>

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
            );
          })}

          {!editing && (
            <button
              onClick={addRow}
              disabled={saving || rows.length >= MAX_ROWS}
              className="w-full py-3 rounded-2xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50/40 font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <FiPlus className="w-4 h-4" />
              {rows.length >= MAX_ROWS ? `Maximum ${MAX_ROWS} changes` : "Add another change"}
            </button>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-white">
          <div className="mb-3 flex items-start gap-2 text-xs font-medium text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
            <FiAlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
            <span>
              The customer amount is added to what they owe <span className="font-bold">as entered</span> —
              no GST is applied on top. A settled booking will go back to part-paid.
            </span>
          </div>

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="text-xs font-bold text-slate-500 flex items-center gap-3 flex-wrap">
              <span>Customer <span className="text-slate-700">{signed(totals.customer)}</span></span>
              <span className="text-slate-300">|</span>
              <span>Cost <span className="text-slate-700">{signed(totals.cost)}</span></span>
              <span className="text-slate-300">|</span>
              <span>
                Net{" "}
                <span className={totals.net >= 0 ? "text-emerald-600" : "text-rose-600"}>
                  {signed(totals.net)}
                </span>
              </span>
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
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-extrabold text-sm shadow-md shadow-violet-200 flex items-center gap-2 transition-all disabled:opacity-60"
              >
                {saving ? (
                  <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving…</>
                ) : (
                  <><FiSave className="w-4 h-4" /> {editing ? "Save change" : `Save ${rows.length} change${rows.length === 1 ? "" : "s"}`}</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
