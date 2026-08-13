// src/features/bookings/components/RouteSegments.jsx
//
// The itinerary as a ROUTE: each row is one leg, FROM city -> TO city, with the nights spent at
// the TO city. Read down the rows and the trip reads back as a single line -
// "Gorakhpur -> Kathmandu -> Pokhara -> Gorakhpur" - which the previous
// destination/city/nights shape could not express: it listed places without saying how the party
// moved between them, so a return leg and a second visit looked identical.
//
// NIGHTS BELONG TO THE 'TO' CITY. "Gorakhpur -> Kathmandu | 2" means two nights in Kathmandu. The
// final leg home is therefore legitimately 0 nights, and the form must not treat that as missing
// data.
//
// REPEATED CITIES ARE VALID and are never validated against. A -> B -> A -> B is a real routing.
//
// CHAINING IS A DEFAULT, NOT A BINDING. Adding a leg seeds its FROM from the previous leg's TO,
// because retyping the city you just arrived in is pure friction. Once seeded it is an ordinary
// editable field: editing leg 2's TO does not rewrite leg 3, so a manual correction is never
// silently undone. The parent surfaces any resulting gap as a warning instead.

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, MapPin, Plus, Trash2 } from "lucide-react";
import { SearchableSelect } from "@features/leads";

const HEAD = "text-[11px] font-semibold uppercase tracking-wide text-slate-400";

const CELL =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none " +
  "transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

/**
 * @param rows            [{ id, fromCityId, fromCity, toCityId, toCity, nights }]
 * @param warnings        string[] from routeWarnings() — rendered, never blocking
 * @param summary         "A → B → C", precomputed by the parent
 */
export default function RouteSegments({
  rows, warnings = [], summary = "", onAdd, onRemove, onUpdate,
  /* SEPARATE option lists per side. Both are the destination's cities, but FROM also carries the
     free-text Pickup city and TO the Drop city — you depart from the pickup and arrive at the
     drop, so offering "Gorakhpur — drop" as a From is an answer that is never right.
     Built by the PAGE, which is the only place that knows the destination and those two fields. */
  fromCityOptions = [], toCityOptions = [], loadingCities = false,
}) {
  const loading = loadingCities;

  /* Focus follows a newly opened leg — whether it came from the button or from choosing a To on
     the last leg (which opens the next one automatically).
     It lands on the first EMPTY control of that leg: the From is normally pre-filled by chaining,
     so focusing it would put the caret on a field that is already answered and make the clerk tab
     past it every single time. */
  const lastFromRef = useRef(null);
  const lastToRef = useRef(null);
  const previousCount = useRef(rows.length);

  /* Which leg's bin is armed. One click arms, the next removes — so a mis-click costs nothing.
     It disarms on blur and after a few seconds, so a primed button never sits waiting for a later,
     unrelated click. */
  const [armedRemove, setArmedRemove] = useState(null);
  useEffect(() => {
    if (armedRemove == null) return undefined;
    const timer = setTimeout(() => setArmedRemove(null), 4000);
    return () => clearTimeout(timer);
  }, [armedRemove]);

  useEffect(() => {
    if (rows.length <= previousCount.current) { previousCount.current = rows.length; return; }
    previousCount.current = rows.length;
    const added = rows[rows.length - 1];
    const target = added?.fromCity ? lastToRef.current : lastFromRef.current;
    target?.focus?.();
  }, [rows]);

  /**
   * Store a chosen city.
   *
   * TWO KINDS OF OPTION arrive here:
   *   • a master city — value is the numeric id, so id AND name are stored. The name is kept
   *     beside it so a booking still reads correctly if that master row is later renamed or
   *     deleted (the old itinerary stored only names, which is why re-opening a saved booking
   *     lost every id);
   *   • a free-text Pickup/Drop city — value is `name:<city>`, which has no master row. The id is
   *     stored EMPTY and only the name is kept. The payload has always allowed a null city id, so
   *     this needs no backend change.
   */
  const setCity = useCallback(
    (rowId, side, value) => {
      const raw = String(value ?? "");
      if (raw.startsWith("name:")) {
        onUpdate(rowId, `${side}CityId`, "");
        onUpdate(rowId, `${side}City`, raw.slice(5));
        return;
      }
      const source = side === "from" ? fromCityOptions : toCityOptions;
      const picked = source.find((option) => String(option.value) === raw);
      onUpdate(rowId, `${side}CityId`, raw);
      // Strip the " — pickup" / " — drop" hint the page appends; the stored name is the city itself.
      onUpdate(rowId, `${side}City`, String(picked?.label || "").split(" — ")[0]);
    },
    [fromCityOptions, toCityOptions, onUpdate]
  );

  /** A row holding a free-text city selects by name, since it has no id. */
  const valueOf = (row, side) =>
    row[`${side}CityId`] ? String(row[`${side}CityId`]) : (row[`${side}City`] ? `name:${row[`${side}City`]}` : "");

  /**
   * A row can name a city that is not in the current list — the destination was switched out from
   * under it, or the master row was removed. Rather than let the combobox fall back to its
   * placeholder and silently blank a row that has data in it, the saved value keeps its own
   * option, marked. Same guard FastItinerary used.
   */
  const optionsFor = (row, side) => {
    const base = side === "from" ? fromCityOptions : toCityOptions;
    const name = row[`${side}City`];
    if (!name) return base;
    const value = valueOf(row, side);
    return base.some((option) => String(option.value) === value)
      ? base
      : [{ value, label: `${name} (saved)` }, ...base];
  };

  // The focus effect keys off the row COUNT, so it covers both paths — this button and the
  // auto-open that follows choosing a To on the last leg. No flag to set here.

  return (
    <div className="space-y-3">
      {summary ? (
        <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
          <p className="text-xs font-bold leading-relaxed text-blue-800">{summary}</p>
        </div>
      ) : null}

      {/* Leading 34px column numbers the legs, so "leg 3" in a warning is findable on screen.
          Same column widths as FastItinerary used. */}
      {rows.length > 0 && (
        <div className="mb-1 hidden gap-3 px-1 md:grid md:grid-cols-[34px_minmax(0,1fr)_24px_minmax(0,1fr)_84px_34px]">
          <span className={HEAD}>#</span>
          <span className={HEAD}>From</span>
          <span />
          <span className={HEAD}>To</span>
          <span className={HEAD}>Nights</span>
          <span />
        </div>
      )}

      {/* Same responsive treatment as the requirement rows: on a phone each leg is a bordered card
          with its controls stacked, so one card reads as one leg; from sm up the border drops and
          the columns align under the shared header. */}
      {rows.map((row, index) => (
        <div
          key={row.id}
          className="grid grid-cols-1 gap-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3
                     md:grid-cols-[34px_minmax(0,1fr)_24px_minmax(0,1fr)_84px_34px] md:items-center
                     md:gap-3 md:rounded-none md:border-0 md:bg-transparent md:p-0"
        >
          <span className="hidden h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-slate-500 md:flex">
            {index + 1}
          </span>

          {/* Per-row labels on mobile: with the shared header hidden there, a bare combobox gives
              no clue which end of the leg it is. */}
          <div className="min-w-0">
            <span className="mb-1 block text-xs font-semibold text-slate-500 md:hidden">From</span>
            <SearchableSelect
              options={optionsFor(row, "from")}
              value={valueOf(row, "from")}
              onChange={(next) => setCity(row.id, "from", next)}
              placeholder={loading ? "Loading cities..." : (index === 0 ? "Where does the trip start?" : "Coming from...")}
              searchPlaceholder="Search city..."
              loading={loading}
              accent="blue"
              advanceOnSelect
              triggerRef={index === rows.length - 1 ? lastFromRef : undefined}
            />
          </div>

          <div className="hidden justify-center md:flex">
            <ArrowRight className="h-4 w-4 text-slate-300" />
          </div>

          <div className="min-w-0">
            <span className="mb-1 block text-xs font-semibold text-slate-500 md:hidden">To</span>
            <SearchableSelect
              options={optionsFor(row, "to")}
              triggerRef={index === rows.length - 1 ? lastToRef : undefined}
              value={valueOf(row, "to")}
              onChange={(next) => setCity(row.id, "to", next)}
              placeholder={loading ? "Loading cities..." : "Going to..."}
              searchPlaceholder="Search city..."
              loading={loading}
              accent="blue"
              advanceOnSelect
            />
          </div>

          {/* The one rule this editor has to teach — nights belong to the TO city, so the leg home
              is 0 — is not written anywhere the agent must read. It is shown: the city's own name
              sits under the box ("in Mumbai"), so "2 nights in Mumbai" reads off the row itself and
              a 0 on the last leg needs no explanation. */}
          <div className="min-w-0">
            <span className="mb-1 block text-xs font-semibold text-slate-500 md:hidden">Nights</span>
            <input
              type="number" min="0" inputMode="numeric"
              value={row.nights}
              onChange={(event) => onUpdate(row.id, "nights", event.target.value)}
              className={CELL}
              aria-label={row.toCity ? `Nights in ${row.toCity}` : "Nights at this stop"}
              title={row.toCity ? `Nights spent in ${row.toCity}` : "Nights spent at the To city"}
            />
            {row.toCity ? (
              <span className="mt-1 block truncate text-[10px] font-semibold text-slate-400" title={`in ${row.toCity}`}>
                in {row.toCity}
              </span>
            ) : null}
          </div>

          {/* TWO deliberate protections, because this used to delete rows by accident:
              • tabIndex={-1} keeps it out of the Enter-to-advance path (see FOCUSABLE in the page).
                Enter from Nights now moves to the NEXT LEG, never onto a bin icon.
              • one click ARMS, a second confirms. A single stray click cannot destroy a leg, and
                the armed state times out on its own so it cannot sit primed indefinitely.
              Still fully usable by mouse, and reachable by screen readers via aria-label. */}
          <button
            type="button"
            tabIndex={-1}
            onClick={() => (armedRemove === row.id ? onRemove(row.id) : setArmedRemove(row.id))}
            onBlur={() => setArmedRemove((current) => (current === row.id ? null : current))}
            disabled={rows.length === 1}
            aria-label={armedRemove === row.id ? `Confirm remove leg ${index + 1}` : `Remove leg ${index + 1}`}
            title={armedRemove === row.id ? "Click again to remove this leg" : "Remove this leg"}
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition
                        disabled:cursor-not-allowed disabled:opacity-30
                        ${armedRemove === row.id
                          ? "border-red-400 bg-red-50 text-red-600"
                          : "border-slate-200 bg-white text-slate-400 hover:border-red-300 hover:text-red-500"}`}
          >
            {armedRemove === row.id ? <Check className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2
                   text-xs font-bold text-slate-500 transition hover:border-blue-400 hover:text-blue-600"
      >
        <Plus className="h-3.5 w-3.5" />
        Add stop
      </button>

      {/* Options are destination-scoped, so an empty list almost always means no destination has
          been chosen yet rather than a failed request. Say the actionable thing. */}
      {!loading && fromCityOptions.length === 0 && toCityOptions.length === 0 ? (
        <p className="text-xs text-amber-600">
          Pick a Destination above to load its cities — a Pickup or Drop city you type will appear here too.
        </p>
      ) : null}

      {/* Warnings, never errors: an itinerary mid-edit routinely does not add up, and blocking the
          save on that would make the form unusable. */}
      {warnings.length > 0 && (
        <ul className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
          {warnings.map((warning) => (
            <li key={warning} className="text-xs font-semibold leading-relaxed text-amber-800">• {warning}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
