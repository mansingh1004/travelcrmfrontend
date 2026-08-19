// src/features/marketplace/components/StaySearchBar.jsx
//
// Where, when, who — the three things anyone booking a hotel starts from, then Search.
//
// WHY IT EXISTS. The catalog opened with a free-text box, a city box and a star dropdown: a filter
// strip for someone browsing an inventory. But an agent arriving with a customer on the phone does
// not browse — they have a destination, two dates and a party size, and until now they typed the
// destination here and then typed the dates and the party AGAIN on the request form, one screen
// later. Everything entered here now travels with them.
//
// THE SHAPE IS A BOOKING SITE'S, THE DRAWING IS THE NORTH STAR'S. Segments in one bar, a popover
// per segment, a round Search at the end — that is the arrangement anyone who has booked a hotel
// already knows. What it does NOT borrow is the chrome: no gradient bar, no drop shadow under the
// popovers, no coloured pills. Hairlines and slate, with colour only on the three segment icons so
// the eye can tell them apart at a glance.
//
// ⚠ THE DATES DO NOT FILTER, AND THE COPY SAYS SO.
//
// This release models no availability at all — no allotment, no rate calendar, no stop-sell. What
// dates DO is pick the commercial rule the "from" price is quoted under (a rule has a validity
// window matched against the stay, so a December trip priced at November's markup is quietly wrong)
// and carry through to the request form.
//
// A date field that silently narrowed nothing would still be read as "these hotels are free then",
// and an agent would quote a room on that basis. So the control is labelled as pricing, and the note
// under the bar says it outright. Saying less would be cheaper and would be a lie by layout.

import { useEffect, useMemo, useRef, useState } from "react";
import { Baby, CalendarDays, DoorOpen, MapPin, Search, Users } from "lucide-react";
import DateRangeField from "@shared/ui/DateRangeField";
import { Stepper, nightsBetween, todayISO } from "./marketplaceUi";

/**
 * @param {object}   props
 * @param {object}   props.value    `{ where, checkIn, checkOut, adults, children, rooms }`
 * @param {Function} props.onChange `(patch) => void`
 * @param {Array}    [props.destinations] `{city, state, countryCode, hotelCount}[]` — where the
 *        platform actually sells, newest facet off `GET /hotel-marketplace/filters`
 * @param {Function} [props.onSearch] run the search now rather than waiting for the debounce
 */
export function StaySearchBar({ value, onChange, destinations = [], onSearch }) {
  const v = value ?? {};
  const nights = nightsBetween(v.checkIn, v.checkOut);

  return (
    <section
      aria-label="Find a hotel"
      className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4"
    >
      <form
        onSubmit={(e) => { e.preventDefault(); onSearch?.(); }}
        className="grid items-end gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1.05fr)_auto]"
      >
        {/* ── WHERE ─────────────────────────────────────────────────────── */}
        <WherePicker
          value={v.where ?? ""}
          destinations={destinations}
          onChange={(where) => onChange({ where })}
        />

        {/* ── WHEN ──────────────────────────────────────────────────────────
            ONE calendar for both ends of the stay, not two native pickers.
            A stay is stated as a pair — "12th to the 15th, three nights" — and picking it as a pair
            is the only way the night count is visible while choosing. Two <input type="date">
            fields made that two openings and left the agent to subtract dates in their head.

            The shared control is used AS IS. It already carries the local-midnight parsing that
            keeps toISOString from eating a day east of Greenwich, and its own outside-click and
            Escape handling; re-deriving any of that here to make it look marginally more at home
            would be trading correctness for a border radius. */}
        <div className="min-w-0">
          <SegmentLabel Icon={CalendarDays} tone="text-emerald-600">
            When{nights > 0 ? ` · ${nights} night${nights === 1 ? "" : "s"}` : ""}
          </SegmentLabel>
          <DateRangeField
            id="stay-dates"
            startValue={v.checkIn ?? ""}
            endValue={v.checkOut ?? ""}
            minDate={todayISO()}
            onChange={({ start, end }) => onChange({ checkIn: start, checkOut: end })}
          />
        </div>

        {/* ── WHO ───────────────────────────────────────────────────────── */}
        <WhoPicker
          rooms={v.rooms ?? 1}
          adults={v.adults ?? 2}
          childCount={v.children ?? 0}
          onChange={onChange}
        />

        {/* ── SEARCH ─────────────────────────────────────────────────────────
            It runs the search NOW. Typing into Where is debounced by a third of a second so that
            nine keystrokes of "Bangalore" are not nine round trips, and this button skips that wait
            — which is what someone who has finished typing and reached for it actually wants. It is
            also the form's submit, so ↵ from any segment does the same thing. */}
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-slate-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/25 focus-visible:ring-offset-2 lg:w-11 lg:px-0 xl:w-auto xl:px-5"
        >
          <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="lg:hidden xl:inline">Search</span>
        </button>
      </form>

      {/*
        Said once, plainly, under the control that would otherwise imply it. This platform holds no
        allotment from any hotel, so it cannot know what is free on a date — only what a stay would
        cost under the rule that applies to it.
      */}
      <p className="mt-2.5 text-[12px] text-slate-500">
        Dates price the stay and carry through to your request — they do not filter the results.
        The platform holds no live availability, so every hotel below is shown whatever your dates.
      </p>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   WHERE — type freely, or pick a place the platform actually sells in
═══════════════════════════════════════════════════════════════════════════ */

/**
 * The destination list is the server's, and it is a list of PLACES WITH HOTELS IN THEM.
 *
 * <p>It is not the tenant's geography master, which holds every city anyone has ever typed and
 * would put destinations in front of an agent that are guaranteed to return an empty grid. Each row
 * carries its count for the same reason the list exists at all: "Jaipur · 12 hotels" and "Kasol · 1
 * hotel" are different decisions.</p>
 *
 * <p><b>The input stays free text.</b> The list suggests, it does not restrict — the catalog's city
 * is a free-text column, so a spelling the facet list has not caught up with must still be typeable,
 * and `where` also matches hotel NAMES on the server. A select here would refuse both.</p>
 */
function WherePicker({ value, destinations, onChange }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef(null);
  const listId = "stay-where-listbox";

  useDismiss(wrapRef, open, setOpen);

  // Substring, case- and accent-blind enough for the job: the agent is checking whether their
  // destination is stocked, not running a search engine.
  const matches = useMemo(() => {
    const term = value.trim().toLowerCase();
    const rows = Array.isArray(destinations) ? destinations : [];
    if (!term) return rows.slice(0, 60);
    return rows
      .filter((d) => `${d.city ?? ""} ${d.state ?? ""}`.toLowerCase().includes(term))
      .slice(0, 60);
  }, [destinations, value]);

  const pick = (d) => {
    onChange(d ? d.city : "");
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!matches.length) return;
      e.preventDefault();
      setOpen(true);
      setActive((i) => {
        // From "nothing highlighted", ↓ goes to the first row and ↑ to the last — the two ends of
        // the list, not one-off from them, which is what plain modular arithmetic on -1 gives.
        if (i < 0) return e.key === "ArrowDown" ? 0 : matches.length - 1;
        return (i + (e.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length;
      });
      return;
    }
    if (e.key === "Enter" && open && active >= 0 && matches[active]) {
      // Only swallow the submit when a row is genuinely highlighted — otherwise ↵ in this box
      // should search, which is what the form does with it.
      e.preventDefault();
      pick(matches[active]);
      return;
    }
    if (e.key === "Escape" && open) {
      e.stopPropagation();
      setOpen(false);
      setActive(-1);
    }
  };

  return (
    <div className="relative min-w-0" ref={wrapRef}>
      <SegmentLabel Icon={MapPin} tone="text-rose-500" htmlFor="stay-where">Where</SegmentLabel>
      <div className="rounded-lg border border-slate-200 px-3 py-2.5 focus-within:border-slate-400">
        <input
          id="stay-where"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="City or hotel name"
          className="w-full bg-transparent text-sm font-medium text-slate-900 placeholder-slate-400 outline-none"
        />
      </div>

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label="Destinations"
          className="absolute left-0 top-full z-40 mt-2 max-h-72 w-full min-w-[17rem] overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {destinations.length === 0 ? (
            /* The facet call failed or the catalog is empty. Saying so beats an empty box that
               reads as "your typing matched nothing", which is a different and wrong message. */
            <p className="px-3 py-3 text-[12px] text-slate-500">
              Destination list unavailable — you can still type a city or hotel name.
            </p>
          ) : (
            <>
              <Option
                active={active === -1 && !value}
                onPick={() => pick(null)}
                title="Anywhere"
                subtitle={`${destinations.length} destination${destinations.length === 1 ? "" : "s"} on the platform`}
              />
              {matches.map((d, i) => (
                <Option
                  key={`${d.city}-${d.state ?? ""}`}
                  active={i === active}
                  onPick={() => pick(d)}
                  title={d.city}
                  subtitle={[d.state, d.countryCode].filter(Boolean).join(", ") || undefined}
                  count={d.hotelCount}
                />
              ))}
              {matches.length === 0 && (
                <p className="px-3 py-3 text-[12px] text-slate-500">
                  No platform hotels in a place matching “{value.trim()}”. Searching anyway will
                  also match hotel names.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Option({ active, onPick, title, subtitle, count }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      // mousedown, not click: the input's blur would otherwise close the list out from under the
      // pointer and the click would land on nothing.
      onMouseDown={(e) => { e.preventDefault(); onPick(); }}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
        active ? "bg-slate-100" : "hover:bg-slate-50"
      }`}
    >
      <MapPin className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-900">{title}</span>
        {subtitle && <span className="block truncate text-[11px] text-slate-500">{subtitle}</span>}
      </span>
      {count != null && (
        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-slate-500">
          {count} hotel{count === 1 ? "" : "s"}
        </span>
      )}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   WHO — the party, spelled out
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Three steppers behind one summary line.
 *
 * <p>They used to sit open in the bar, which meant the party — the least-changed of the three
 * inputs — took as much width as the destination and pushed the dates into a column too narrow to
 * read. Collapsed, the bar reads "2 adults · 1 room" at a glance and opens to the full breakdown,
 * which is also how anyone who has booked a hotel expects it to behave.</p>
 *
 * <p><b>The children hint does not invent an age band.</b> There is no platform-wide child age
 * anywhere in this system — each hotel carries its own free-text child policy, and printing "Ages
 * 0–12" here would be a rule this product does not have, on a screen an agent quotes from.</p>
 */
function WhoPicker({ rooms, adults, childCount, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  useDismiss(wrapRef, open, setOpen);

  const summary = [
    `${adults} adult${adults === 1 ? "" : "s"}`,
    childCount > 0 ? `${childCount} child${childCount === 1 ? "" : "ren"}` : null,
    `${rooms} room${rooms === 1 ? "" : "s"}`,
  ].filter(Boolean).join(" · ");

  return (
    <div className="relative min-w-0" ref={wrapRef}>
      <SegmentLabel Icon={Users} tone="text-sky-600" htmlFor="stay-who">Who</SegmentLabel>
      <button
        id="stay-who"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-medium text-slate-900 transition-colors hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"
      >
        <span className="min-w-0 flex-1 truncate">{summary}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Who is travelling"
          className="absolute right-0 top-full z-40 mt-2 w-[19rem] max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
        >
          <GuestRow
            Icon={DoorOpen} tone="text-violet-600"
            title="Rooms" hint="Rooms to request at this hotel"
            value={rooms} min={1} max={20}
            onChange={(n) => onChange({ rooms: n })}
          />
          <GuestRow
            Icon={Users} tone="text-sky-600"
            title="Adults" hint="Counted against each room's occupancy"
            value={adults} min={1} max={40}
            onChange={(n) => onChange({ adults: n })}
          />
          <GuestRow
            Icon={Baby} tone="text-pink-600"
            title="Children" hint="Age bands and charges differ — see the hotel's child policy"
            value={childCount} min={0} max={20}
            onChange={(n) => onChange({ children: n })}
            last
          />
          <div className="mt-1 flex justify-end border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-2.5 py-1 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function GuestRow({ Icon, tone, title, hint, value, min, max, onChange, last = false }) {
  return (
    <div className={`flex items-center gap-3 py-2.5 ${last ? "" : "border-b border-slate-100"}`}>
      <Icon className={`h-4 w-4 shrink-0 ${tone}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <p className="text-[11px] leading-tight text-slate-500">{hint}</p>
      </div>
      <Stepper value={value} min={min} max={max} onChange={onChange} label={title} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Shared bits
═══════════════════════════════════════════════════════════════════════════ */

function SegmentLabel({ Icon, tone, htmlFor, children }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 flex items-center gap-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500"
    >
      <Icon className={`h-3.5 w-3.5 ${tone}`} aria-hidden="true" />
      {children}
    </label>
  );
}

/**
 * Close on outside click and on Escape. Both, because they answer different intents: Escape is "I
 * changed my mind", an outside click is "I am done" — and a popover that honours only one of them
 * is the kind that has to be dismissed twice.
 */
function useDismiss(ref, open, setOpen) {
  useEffect(() => {
    if (!open) return undefined;
    // setOpen from useState is stable, so the listeners are bound once per opening rather than
    // re-bound on every render — which an inline () => setOpen(false) would have done.
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, open, setOpen]);
}

export default StaySearchBar;
