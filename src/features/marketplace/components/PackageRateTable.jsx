// src/features/marketplace/components/PackageRateTable.jsx
//
// The rate editor, in one place — used both by the quick modal on the "my packages" list and by the
// Rates tab in the editor. Rates are the most frequently changed thing on a package, so they are
// reachable from wherever the author already is; that is two entry points to ONE editor, not two
// editors that will drift.
//
// The whole set is saved in one call. A slab carrying a publicId updates; one without creates; a
// slab that existed and is absent is DEACTIVATED server-side, not deleted, so the price history that
// references it keeps meaning something. The UI still says "Remove", because that is what it means
// to the person clicking it.
//
// Saving rates does NOT re-open marketplace review and does not bump the catalog version — an
// approved listing whose price moved is still the same listing.

import { useMemo, useState } from "react";
import { Plus, Trash2, IndianRupee } from "lucide-react";

import { Button, Input, Select, Notice, Empty, cn } from "./marketplaceUi";
import { PACKAGE_OCCUPANCY } from "../api/packageMarketplaceService";

const BLANK = { publicId: undefined, paxFrom: 1, paxTo: "", occupancy: "DOUBLE", perPaxPrice: "", label: "" };

/** Turn server slabs into editable rows. Nulls become "" so the inputs stay controlled. */
export function toRateRows(slabs) {
  const rows = (slabs ?? []).map((s) => ({
    publicId: s.publicId,
    paxFrom: s.paxFrom ?? 1,
    paxTo: s.paxTo ?? "",
    occupancy: s.occupancy ?? "DOUBLE",
    perPaxPrice: s.perPaxPrice ?? "",
    label: s.label ?? "",
  }));
  return rows.length ? rows : [{ ...BLANK }];
}

/** The wire shape. Exported so both call sites send exactly the same thing. */
export function toRatePayload(rows) {
  return rows.map((s) => ({
    publicId: s.publicId,
    paxFrom: Number(s.paxFrom) || 1,
    // "" means "and above" — send null, not 0, which would match no party at all.
    paxTo: s.paxTo === "" ? null : Number(s.paxTo),
    occupancy: s.occupancy,
    perPaxPrice: Number(s.perPaxPrice),
    label: s.label?.trim() || null,
    active: true,
  }));
}

export function PackageRateTable({ rows, onChange, className }) {
  const [touched, setTouched] = useState(false);

  const patch = (index, key, value) => {
    setTouched(true);
    onChange(rows.map((s, i) => (i === index ? { ...s, [key]: value } : s)));
  };

  const add = () => { setTouched(true); onChange([...rows, { ...BLANK }]); };
  const remove = (index) => { setTouched(true); onChange(rows.filter((_, i) => i !== index)); };

  /**
   * The cheapest live rate — the number that will appear on the card as "starting from".
   *
   * Shown here because it is the one figure an author is actually setting, and it is not obvious
   * which of five rows wins it.
   */
  const cheapest = useMemo(() => {
    const values = rows.map((r) => Number(r.perPaxPrice)).filter((n) => Number.isFinite(n) && n > 0);
    return values.length ? Math.min(...values) : null;
  }, [rows]);

  const problems = useMemo(() => {
    const out = [];
    rows.forEach((r, i) => {
      if (r.perPaxPrice === "" || !(Number(r.perPaxPrice) >= 0)) out.push(`Rate ${i + 1} needs a price`);
      if (r.paxTo !== "" && Number(r.paxFrom) > Number(r.paxTo)) out.push(`Rate ${i + 1}: "from" is above "to"`);
    });
    return out;
  }, [rows]);

  return (
    <div className={cn("min-w-0", className)}>
      {rows.length === 0 ? (
        <Empty
          icon={IndianRupee}
          title="No rates yet"
          hint="A package with no rate shows as “On request” and cannot be published."
          action={<Button onClick={add}><Plus className="h-4 w-4" aria-hidden />Add a rate</Button>}
        />
      ) : (
        <>
          {/* A header row rather than a label per field: five columns repeated down the page is a
              table, and labelling every cell of a table is noise. */}
          <div className="hidden grid-cols-12 gap-2 px-1 pb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400 sm:grid">
            <span className="col-span-2">Pax from</span>
            <span className="col-span-2">Pax to</span>
            <span className="col-span-3">Sharing</span>
            <span className="col-span-3">Price / pax</span>
            <span className="col-span-2" />
          </div>

          <div className="space-y-2">
            {rows.map((s, i) => (
              <div key={s.publicId ?? `new-${i}`} className="grid grid-cols-12 items-center gap-2">
                <Input
                  className="col-span-6 sm:col-span-2"
                  type="number"
                  min={1}
                  value={s.paxFrom}
                  onChange={(e) => patch(i, "paxFrom", e.target.value)}
                  aria-label={`Rate ${i + 1} pax from`}
                />
                <Input
                  className="col-span-6 sm:col-span-2"
                  type="number"
                  min={1}
                  placeholder="and above"
                  value={s.paxTo}
                  onChange={(e) => patch(i, "paxTo", e.target.value)}
                  aria-label={`Rate ${i + 1} pax to`}
                />
                <Select
                  className="col-span-7 sm:col-span-3"
                  value={s.occupancy}
                  onChange={(e) => patch(i, "occupancy", e.target.value)}
                  aria-label={`Rate ${i + 1} sharing basis`}
                >
                  {Object.entries(PACKAGE_OCCUPANCY).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
                <Input
                  className="col-span-3 sm:col-span-3"
                  type="number"
                  min={0}
                  placeholder="0"
                  value={s.perPaxPrice}
                  onChange={(e) => patch(i, "perPaxPrice", e.target.value)}
                  aria-label={`Rate ${i + 1} price per pax`}
                />
                <button
                  type="button"
                  className="col-span-2 flex items-center justify-center rounded-md border border-slate-200 py-2 text-slate-400 transition hover:border-rose-200 hover:text-rose-600"
                  onClick={() => remove(i)}
                  aria-label={`Remove rate ${i + 1}`}
                  title="Remove this rate"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <Button onClick={add}>
              <Plus className="h-4 w-4" aria-hidden />
              Add a rate
            </Button>
            {cheapest !== null ? (
              <span className="text-xs text-slate-500">
                Card will show{" "}
                <strong className="font-semibold text-slate-900">
                  ₹{cheapest.toLocaleString("en-IN")}
                </strong>{" "}
                / pax
              </span>
            ) : null}
          </div>
        </>
      )}

      {touched && problems.length ? (
        <Notice tone="warn" className="mt-3">
          {problems.slice(0, 3).join(" · ")}
        </Notice>
      ) : null}
    </div>
  );
}

/** True when every row is savable. Exported so a caller can disable its own Save button. */
export function ratesAreValid(rows) {
  return (rows ?? []).every(
    (r) => r.perPaxPrice !== "" && Number(r.perPaxPrice) >= 0
      && (r.paxTo === "" || Number(r.paxFrom) <= Number(r.paxTo)),
  );
}

export default PackageRateTable;
