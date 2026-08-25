// src/features/marketplace/components/FilterRail.jsx
//
// The catalog's filter column.
//
// A booking site's FILTER SET in the north star's VOCABULARY — the two are not in conflict, because
// they describe different things. "Booking site" is what the screen can DO: narrow by price, stars,
// board basis, amenities. "North star" is what it LOOKS like: hairline rules, no gradients, no
// coloured chrome, colour reserved for the exceptional. So this is a real filter rail, drawn quietly.
//
// WHAT IT DELIBERATELY IS NOT: no coloured pills, no counts-per-option badges, no accordion
// animation, no "popular filters" section. Every one of those puts furniture between the agent and
// the photographs, which are the actual content of this screen.
//
// OPTIONS COME FROM THE SERVER, NOT FROM A HARDCODED LIST. `GET /api/hotel-marketplace/filters`
// returns what the live catalog actually contains. Rendering every PropertyType constant would offer
// "Houseboat" over a catalog holding none — the agent ticks it, gets an empty grid, and concludes
// the search is broken. A filter option that cannot return a result is worse than a missing one, so
// a section with no options does not render at all.

import { useMemo, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Button, Divider, Input, SectionLabel, cn } from "./marketplaceUi";

/** Board basis, spelled the way an agent says it rather than the way the enum spells it. */
const MEAL_PLAN_LABELS = {
  EP: "Room only",
  CP: "Breakfast",
  MAP: "Breakfast + 1 meal",
  AP: "All meals",
  CUSTOM: "Custom",
};

/** GUEST_HOUSE -> "Guest house". Sentence case, because a filter list is not a set of headings. */
function titleCase(value) {
  const s = String(value ?? "").replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Amenities arrive lower-cased from the server (the column is free text typed by two audiences). */
const amenityLabel = (a) => titleCase(a);

/** How many amenities to show before the list needs a "show all" — long enough to be useful, short enough to scan. */
const AMENITY_PREVIEW = 8;

function toggle(list, item) {
  const set = new Set(list ?? []);
  if (set.has(item)) set.delete(item);
  else set.add(item);
  return [...set];
}

/**
 * One checkbox. Native input, styled only through `accent-` — a hand-built checkbox would have to
 * re-earn keyboard behaviour, indeterminate state and the platform's own focus ring, and would look
 * exactly like this one when it was finished.
 */
function Check({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-1 text-sm text-slate-600 hover:text-slate-900">
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={onChange}
        className="h-3.5 w-3.5 rounded border-slate-300 accent-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"
      />
      <span>{label}</span>
    </label>
  );
}

function Section({ title, children }) {
  return (
    <div className="py-3">
      <SectionLabel className="mb-1.5 block">{title}</SectionLabel>
      {children}
    </div>
  );
}

/**
 * A two-thumb price band, with the numbers still typeable.
 *
 * <h3>Where the top of the bar comes from, and why it says "+"</h3>
 *
 * A slider needs a ceiling, and this catalog's true maximum cannot be known without pricing every
 * hotel in it — the price is not a column, it is a supplier net through a per-hotel commercial rule.
 * So the ceiling is taken from the priciest hotel CURRENTLY ON SCREEN, and the top thumb means
 * "no upper limit" rather than that number. That is why it renders as `₹8,000+`.
 *
 * <p>Inventing a fixed ceiling would be the alternative, and it would be a slider whose ends are
 * fiction: park the thumb at the top and you would silently exclude everything above a number nobody
 * chose. A band that cannot express "and above" is a band that quietly drops the expensive half of
 * the catalog.</p>
 *
 * <p>The numeric inputs stay, and are not a fallback: a slider cannot express ₹4,250, and an agent
 * working to a customer's stated budget has an exact figure in mind.</p>
 */
function PriceRange({ min, max, ceiling, onChange }) {
  const hasCeiling = Number.isFinite(ceiling) && ceiling > 0;
  const top = hasCeiling ? ceiling : 0;

  const lo = min === "" || min == null ? 0 : Number(min);
  // An unset maximum sits at the top of the bar, which reads as "no limit" — not as "exactly top".
  const hi = max === "" || max == null ? top : Number(max);

  const pct = (n) => (top > 0 ? Math.min(100, Math.max(0, (n / top) * 100)) : 0);

  return (
    <div>
      {hasCeiling && (
        <div className="relative mb-3 mt-1 h-5">
          {/* The rail, and the selected span drawn over it. */}
          <div className="absolute inset-x-0 top-2 h-1 rounded-full bg-slate-200" />
          <div
            className="absolute top-2 h-1 rounded-full bg-slate-900"
            style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }}
          />
          {/* Two native range inputs stacked. Native, so keyboard, touch and screen readers all work
              without being re-implemented; `pointer-events-none` on the track lets both thumbs stay
              grabbable where they overlap. */}
          <input
            type="range" min={0} max={top} step={100} value={lo}
            aria-label="Minimum price per night"
            onChange={(e) => {
              const next = Math.min(Number(e.target.value), hi);
              onChange({ minPrice: next === 0 ? "" : String(next) });
            }}
            className="pointer-events-none absolute inset-x-0 top-0 h-5 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-slate-300 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm"
          />
          <input
            type="range" min={0} max={top} step={100} value={hi}
            aria-label="Maximum price per night"
            onChange={(e) => {
              const next = Math.max(Number(e.target.value), lo);
              // Back at the ceiling means "no maximum", so the filter is cleared rather than pinned.
              onChange({ maxPrice: next >= top ? "" : String(next) });
            }}
            className="pointer-events-none absolute inset-x-0 top-0 h-5 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-slate-300 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm"
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <Input
          type="number" min="0" inputMode="numeric" placeholder="Min"
          aria-label="Minimum price per night"
          value={min ?? ""}
          onChange={(e) => onChange({ minPrice: e.target.value })}
        />
        <span className="text-sm text-slate-400">–</span>
        <Input
          type="number" min="0" inputMode="numeric" placeholder="Max"
          aria-label="Maximum price per night"
          value={max ?? ""}
          onChange={(e) => onChange({ maxPrice: e.target.value })}
        />
      </div>

      {hasCeiling && (
        <p className="mt-1.5 flex justify-between text-[11px] tabular-nums text-slate-400">
          <span>₹0</span>
          <span>₹{Number(top).toLocaleString("en-IN")}+</span>
        </p>
      )}

      <p className="mt-1.5 text-[12px] text-slate-500">
        Your buy rate. Hotels with no rate card are hidden while a price range is set.
      </p>
    </div>
  );
}

/**
 * @param {object}   props
 * @param {object}   props.facets    `{stars, propertyTypes, mealPlans, amenities}` from the server
 * @param {object}   props.value     the current filter state
 * @param {Function} props.onChange  `(patch) => void`, merged into the state by the page
 * @param {Function} props.onClear   resets everything this rail owns
 * @param {number}   [props.priceCeiling] priciest hotel currently on screen — the top of the price bar,
 *        and deliberately not a fixed constant: this catalog has no knowable maximum, so the bar is
 *        scaled to what the agent can actually see and its top thumb means "no upper limit"
 */
export function FilterRail({ facets, value, onChange, onClear, priceCeiling, className }) {
  const [showAllAmenities, setShowAllAmenities] = useState(false);
  const [openOnMobile, setOpenOnMobile] = useState(false);

  const f = facets ?? {};
  const v = value ?? {};

  const amenities = f.amenities ?? [];
  const visibleAmenities = showAllAmenities ? amenities : amenities.slice(0, AMENITY_PREVIEW);

  /*
    The active count is the one number on this rail, and it earns its place: a filtered grid that
    looks empty is indistinguishable from a broken one unless the agent can see, at a glance, that
    they asked for something narrow. It is also what makes "Clear" a considered action rather than a
    button that might do nothing.
  */
  const activeCount = useMemo(() => {
    let n = 0;
    n += (v.stars ?? []).length;
    n += (v.propertyTypes ?? []).length;
    n += (v.mealPlans ?? []).length;
    n += (v.amenities ?? []).length;
    if (v.refundableOnly) n += 1;
    if (v.minPrice) n += 1;
    if (v.maxPrice) n += 1;
    return n;
  }, [v]);

  const body = (
    <div className="divide-y divide-slate-100">
      {/*
        Price is a band on the TENANT PAYABLE — the number the agent is shown — never on the
        supplier's net. The server applies it after pricing rather than in SQL for exactly that
        reason: filtering on net_rate would let anyone sweep the boundary and binary-search the
        confidential rate out of the result set.

        Open numeric fields rather than a slider: the catalog's true price range cannot be known
        without pricing every hotel, and a slider whose ends are invented is a slider that lies.
      */}
      <Section title="Price per night">
        <PriceRange min={v.minPrice} max={v.maxPrice} ceiling={priceCeiling} onChange={onChange} />
      </Section>

      {(f.stars ?? []).length > 0 && (
        <Section title="Star rating">
          {[...f.stars].sort((a, b) => b - a).map((s) => (
            <Check
              key={s}
              checked={(v.stars ?? []).includes(s)}
              onChange={() => onChange({ stars: toggle(v.stars, s) })}
              label={`${s} star${s === 1 ? "" : "s"}`}
            />
          ))}
        </Section>
      )}

      {(f.propertyTypes ?? []).length > 0 && (
        <Section title="Property type">
          {[...f.propertyTypes].sort().map((t) => (
            <Check
              key={t}
              checked={(v.propertyTypes ?? []).includes(t)}
              onChange={() => onChange({ propertyTypes: toggle(v.propertyTypes, t) })}
              label={titleCase(t)}
            />
          ))}
        </Section>
      )}

      {(f.mealPlans ?? []).length > 0 && (
        <Section title="Board basis">
          {f.mealPlans.map((m) => (
            <Check
              key={m}
              checked={(v.mealPlans ?? []).includes(m)}
              onChange={() => onChange({ mealPlans: toggle(v.mealPlans, m) })}
              label={MEAL_PLAN_LABELS[m] ?? titleCase(m)}
            />
          ))}
        </Section>
      )}

      <Section title="Cancellation">
        <Check
          checked={v.refundableOnly}
          onChange={() => onChange({ refundableOnly: !v.refundableOnly })}
          label="Refundable rates only"
        />
      </Section>

      {amenities.length > 0 && (
        <Section title="Amenities">
          {visibleAmenities.map((a) => (
            <Check
              key={a}
              checked={(v.amenities ?? []).includes(a)}
              onChange={() => onChange({ amenities: toggle(v.amenities, a) })}
              label={amenityLabel(a)}
            />
          ))}
          {amenities.length > AMENITY_PREVIEW && (
            <button
              type="button"
              onClick={() => setShowAllAmenities((s) => !s)}
              className="mt-1 text-[12px] font-medium text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"
            >
              {showAllAmenities ? "Show fewer" : `Show all ${amenities.length}`}
            </button>
          )}
          {/*
            Amenities are ANDed, and saying so matters: someone ticking "pool" and "parking" wants
            both, and a rail that silently ORed them would hand back hotels with neither of the two
            things they asked about.
          */}
          <p className="mt-1.5 text-[12px] text-slate-500">Hotels matching all selected amenities.</p>
        </Section>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile: the rail is a disclosure, because 280px of filters above the results would push
          every photograph below the fold on the screen size where that costs the most. */}
      <div className="lg:hidden">
        <Button
          variant="secondary"
          onClick={() => setOpenOnMobile((o) => !o)}
          className="w-full justify-center"
        >
          <SlidersHorizontal />
          Filters{activeCount > 0 ? ` (${activeCount})` : ""}
        </Button>
        {openOnMobile && <div className="mt-2 rounded-lg border border-slate-200 px-4">{body}</div>}
      </div>

      <aside className={cn("hidden lg:block", className)} aria-label="Filters">
        <div className="flex items-baseline justify-between">
          {/* The count is the one thing on this rail that must not be missed — a narrowed grid that
              looks empty is indistinguishable from a broken one unless the agent can see at a glance
              that they asked for something narrow. So it gets colour, and only it does. */}
          <SectionLabel className="mb-0 flex items-center gap-1.5">
            Filters
            {activeCount > 0 && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold tabular-nums text-white">
                {activeCount}
              </span>
            )}
          </SectionLabel>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="flex items-center gap-1 text-[12px] font-medium text-slate-500 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>
        <Divider className="mt-1.5" />
        {body}
      </aside>
    </>
  );
}

export default FilterRail;
