import { useEffect, useState } from "react";
import { vendorService } from "@features/vendors";

/**
 * "Who do we buy this from" — the supplier link on a master form.
 *
 * Used by the hotel, vehicle and airline forms. Optional everywhere: leaving it blank does not mean
 * "no supplier", it means the master is its own supplier, and the backend mints that self-vendor the
 * first time a cost on this row needs a payee. So the empty option is worded as a statement, not as
 * an absence.
 *
 * Two rules the backend enforces and this component has to respect:
 *   • sending nothing NEVER clears an existing link (absence and "cleared" are indistinguishable on
 *     the wire), so removing a supplier sends `clearVendorLink: true` instead;
 *   • the options list leaves out self-vendors, because a picker offering every hotel the agency has
 *     ever typed is a worse list than one offering the parties it actually buys from.
 *
 * `value` / `onChange` speak vendor publicId (or ""). The parent keeps both fields on its form state
 * and the service layer decides which one to send.
 */
export default function SupplierPicker({
  value,
  onChange,
  linkedLabel,
  disabled = false,
  label = "Supplier (Vendor)",
  hint = "Leave blank if you buy directly from this property — a supplier record is created when it is first needed.",
}) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    vendorService
      .options()
      .then((rows) => { if (alive) { setOptions(rows || []); setFailed(false); } })
      .catch(() => { if (alive) setFailed(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // The row this master is already linked to may be a self-vendor, which the options call leaves
  // out on purpose. Rather than a second request, keep it as an option of its own so the select
  // shows what is actually saved instead of falling back to blank — which would read as "no
  // supplier" and, on the next save, would be exactly that.
  const linkedMissing = value && !options.some((o) => o.publicId === value);

  return (
    <div>
      <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      <select
        value={value || ""}
        disabled={disabled || loading}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700
          font-medium focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none disabled:bg-slate-50"
      >
        <option value="">
          {loading ? "Loading suppliers…" : "This property is its own supplier"}
        </option>
        {linkedMissing && (
          <option value={value}>{linkedLabel || "Currently linked supplier"}</option>
        )}
        {options.map((o) => (
          <option key={o.publicId} value={o.publicId}>
            {o.vendorName}{o.vendorType ? ` — ${o.vendorType}` : ""}
          </option>
        ))}
      </select>
      {failed ? (
        <p className="mt-1 text-[11px] font-bold text-amber-600">
          Suppliers could not be loaded — saving will leave the current link untouched.
        </p>
      ) : (
        <p className="mt-1 text-[11px] font-medium text-slate-400">{hint}</p>
      )}
    </div>
  );
}
