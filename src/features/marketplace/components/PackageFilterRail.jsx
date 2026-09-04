// src/features/marketplace/components/PackageFilterRail.jsx
//
// The package catalog's left rail. A sibling of FilterRail rather than an extension of it, because
// it differs on the one thing FilterRail is opinionated about:
//
//   FilterRail deliberately renders NO per-option counts. That was right for hotels, where the
//   facets are short and stable. It is wrong here — a package catalog's state list runs to twenty
//   entries, and "Kerala 10" tells an agent whether a click is worth making in a way "Kerala" does
//   not. The reversal is deliberate and is recorded in the design doc; forking rather than adding a
//   `showCounts` prop keeps FilterRail's own rule intact for the screens that still hold it.
//
// Everything else follows FilterRail exactly: hairline sections, native checkboxes, an active-count
// badge with Clear, and a mobile disclosure under lg.
//
// A section with no options does not render. An option that cannot return a result is worse than a
// missing one.

import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";

import { Button, Input, cn } from "./marketplaceUi";
import { PACKAGE_CATEGORY } from "../api/packageMarketplaceService";

function Check({ checked, onChange, label, count }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-1 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count === undefined || count === null ? null : (
        <span className="shrink-0 tabular-nums text-xs text-slate-400">{count}</span>
      )}
    </label>
  );
}

function Section({ title, children }) {
  return (
    <div className="border-t border-slate-200 py-3 first:border-t-0 first:pt-0">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      {children}
    </div>
  );
}

/** Toggle one value inside a multi-select array. */
const toggle = (list, value) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

export function PackageFilterRail({ facets, value, onChange, onClear, activeCount = 0, className }) {
  const [open, setOpen] = useState(false);

  const states = facets?.states ?? [];
  const categories = facets?.categories ?? [];
  const nights = facets?.nights ?? [];
  const inclusions = facets?.inclusions ?? [];

  const body = (
    <div className="space-y-0">
      {states.length > 0 && (
        <Section title="Package state">
          <div className="max-h-64 overflow-y-auto pr-1">
            {states.map((o) => (
              <Check
                key={o.value}
                label={o.label}
                count={o.count}
                checked={value.states.includes(o.value)}
                onChange={() => onChange({ states: toggle(value.states, o.value) })}
              />
            ))}
          </div>
        </Section>
      )}

      {nights.length > 0 && (
        <Section title="Night count">
          <div className="max-h-64 overflow-y-auto pr-1">
            {nights.map((o) => (
              <Check
                key={o.value}
                label={o.label}
                count={o.count}
                checked={value.nights.includes(o.value)}
                onChange={() => onChange({ nights: toggle(value.nights, o.value) })}
              />
            ))}
          </div>
        </Section>
      )}

      {categories.length > 0 && (
        <Section title="Category">
          {categories.map((o) => (
            <Check
              key={o.value}
              label={PACKAGE_CATEGORY[o.value] ?? o.label}
              count={o.count}
              checked={value.categories.includes(o.value)}
              onChange={() => onChange({ categories: toggle(value.categories, o.value) })}
            />
          ))}
        </Section>
      )}

      {inclusions.length > 0 && (
        <Section title="Includes">
          {inclusions.map((o) => (
            <Check
              key={o.value}
              label={o.label}
              count={o.count}
              // Tri-state on the wire, but the rail only ever offers "must include": a checkbox
              // cannot express "must not include" without a third visual state nobody reads
              // correctly. The API keeps the option open for a later, clearer control.
              checked={value[o.value] === true}
              onChange={(checked) => onChange({ [o.value]: checked ? true : undefined })}
            />
          ))}
        </Section>
      )}

      <Section title="Group size">
        <Input
          type="number"
          min={1}
          placeholder="Travellers"
          value={value.pax}
          onChange={(e) => onChange({ pax: e.target.value })}
          aria-label="Number of travellers"
        />
        <p className="mt-1 text-[11px] text-slate-400">
          Shows packages whose stated group size fits this party.
        </p>
      </Section>

      <Section title="Price per pax">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            placeholder="Min"
            value={value.priceMin}
            onChange={(e) => onChange({ priceMin: e.target.value })}
            aria-label="Minimum price per pax"
          />
          <span className="text-xs text-slate-400">to</span>
          <Input
            type="number"
            min={0}
            placeholder="Max"
            value={value.priceMax}
            onChange={(e) => onChange({ priceMax: e.target.value })}
            aria-label="Maximum price per pax"
          />
        </div>
      </Section>

      <Section title="Source">
        <Check
          label="Only my agency's packages"
          checked={value.mine}
          onChange={(checked) => onChange({ mine: checked })}
        />
      </Section>
    </div>
  );

  return (
    <div className={cn("min-w-0", className)}>
      {/* Mobile disclosure — the rail is a column beside the grid only from lg up. */}
      <Button
        variant="secondary"
        className="w-full lg:hidden"
        onClick={() => setOpen((v) => !v)}
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden />
        Filters{activeCount ? ` (${activeCount})` : ""}
      </Button>

      <div className={cn("mt-3 lg:mt-0 lg:block", open ? "block" : "hidden")}>
        <div className="flex items-center justify-between pb-2">
          <span className="text-sm font-semibold text-slate-900">Filters</span>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
            >
              <X className="h-3 w-3" aria-hidden />
              Clear {activeCount}
            </button>
          )}
        </div>
        {body}
      </div>
    </div>
  );
}

export default PackageFilterRail;
