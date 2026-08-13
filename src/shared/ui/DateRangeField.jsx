import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { CalendarDays, X } from "lucide-react";
import "react-day-picker/style.css";

/**
<<<<<<< HEAD
 * One control, one calendar, both dates — the way a hotel stay is selected.
=======
 * One control, one calendar, both dates — the way every hotel site takes a stay.
>>>>>>> origin/main
 *
 * <p>Travel date and return date used to be two separate {@code <input type="date">} fields, which
 * meant two native pickers, two openings, and no way to see the trip length while choosing. An
 * enquiry states them as a pair ("14.07 to 20.07, 6 nights"), so they should be picked as a pair.
 *
 * <h3>Why react-day-picker and not a hand-rolled grid</h3>
 *
 * The things a hand-rolled calendar gets subtly wrong are exactly the things this library gets
 * right: roving-tabindex keyboard navigation across the day grid, ARIA grid semantics and
 * screen-reader announcements, month-boundary and leap-year arithmetic. None of that is visible
 * until it is broken, which is the worst kind of thing to write yourself.
 *
 * <h3>Dates are formatted by hand, never with toISOString()</h3>
 *
 * {@code new Date(2026, 6, 14).toISOString().slice(0, 10)} is "2026-07-13" in IST — toISOString
 * converts to UTC first, and every timezone east of Greenwich loses a day. The form talks in plain
 * yyyy-MM-dd strings and the server binds LocalDate, so the conversion has to stay local.
 */
export default function DateRangeField({
  startValue,
  endValue,
  onChange,
<<<<<<< HEAD
  startLabel = "Check-in",
  endLabel = "Check-out",
=======
  startLabel = "Travel Date",
  endLabel = "Return Date",
>>>>>>> origin/main
  minDate,
  disabled = false,
  invalid = false,
  id = "date-range",
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);

  const from = parseLocal(startValue);
  const to = parseLocal(endValue);
  const range = useMemo(() => (from ? { from, to } : undefined), [from, to]);

  const nights = from && to ? Math.round((to - from) / 86400000) : null;

  /* Close on outside click and on Escape. Both, because they answer different intents: Escape is
     "I changed my mind", an outside click is "I am done" — and a popover that only honours one of
     them is the kind that has to be dismissed twice. */
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
      // Focus goes back to the control that opened it, or the caret is lost to the page body.
      buttonRef.current?.focus();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const handleSelect = useCallback((next) => {
    const nextFrom = next?.from ? formatLocal(next.from) : "";
    const nextTo = next?.to ? formatLocal(next.to) : "";
    onChange({ start: nextFrom, end: nextTo });
    // Close only once BOTH ends exist. Closing on the first click would make picking a range two
    // separate openings, which is the behaviour this replaced.
    if (next?.from && next?.to) setOpen(false);
  }, [onChange]);

  const clear = useCallback((e) => {
    e.stopPropagation();
    onChange({ start: "", end: "" });
  }, [onChange]);

  const summary = from
    ? `${pretty(from)} → ${to ? pretty(to) : "…"}`
    : "";

  return (
    <div className="relative min-w-0" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`flex w-full items-center gap-2 rounded-lg border bg-white px-3 py-2.5 text-left text-sm transition
          focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50
          ${invalid
            ? "border-red-300 focus:border-red-400 focus:ring-red-50"
            : "border-slate-200 focus:border-blue-400 focus:ring-blue-50"}`}
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
        <span className={`min-w-0 flex-1 truncate font-medium ${from ? "text-slate-800" : "text-slate-400"}`}>
          {summary || `${startLabel} → ${endLabel}`}
        </span>
        {/* Live, because the night count is what the agent is actually checking against the
            enquiry's stated duration. Reading it off two dates in their head is the step this
            removes. */}
        {nights != null && (
          <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
            {nights}N
          </span>
        )}
        {from && !disabled && (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Clear dates"
            onClick={clear}
            className="shrink-0 rounded p-0.5 text-slate-300 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
<<<<<<< HEAD
          aria-label="Choose check-in and check-out dates"
=======
          aria-label="Choose travel and return dates"
          /* right-0 on small screens so a field near the right edge does not push the popover off
             the viewport; two months is wider than the field it hangs from. */
>>>>>>> origin/main
          className="absolute left-0 top-full z-40 mt-2 max-w-[calc(100vw-2rem)] overflow-x-auto rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
        >
          <DayPicker
            mode="range"
            selected={range}
            onSelect={handleSelect}
<<<<<<< HEAD
            numberOfMonths={1}
=======
            numberOfMonths={2}
>>>>>>> origin/main
            defaultMonth={from || undefined}
            startMonth={minDate ? parseLocal(minDate) : undefined}
            disabled={minDate ? { before: parseLocal(minDate) } : undefined}
            /* Clicking a day when a complete range already exists starts a NEW range rather than
               extending the old one — otherwise correcting a date means clearing first, and every
               agent's second click lands somewhere they did not intend. */
            resetOnSelect
            className="rdp-crm"
            captionLayout="dropdown"
            showOutsideDays
          />
          <div className="mt-1 flex items-center justify-between border-t border-slate-100 pt-2">
            <span className="text-[11px] text-slate-400">
<<<<<<< HEAD
              {!from ? "Pick the check-in date"
                : !to ? "Now pick the check-out date"
=======
              {!from ? "Pick the travel date"
                : !to ? "Now pick the return date"
>>>>>>> origin/main
                  : `${nights} night${nights === 1 ? "" : "s"}`}
            </span>
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

      {/* The library ships its own stylesheet; this re-skins it through the variables it exposes
          rather than replacing its class names. Overriding classNames wholesale means re-doing it
          on every library upgrade, and the layout is not what needed changing — only the colour. */}
      <style>{`
        .rdp-crm {
          --rdp-accent-color: #2563eb;
          --rdp-accent-background-color: #eff6ff;
          --rdp-today-color: #2563eb;
          --rdp-day-width: 2.15rem;
          --rdp-day-height: 2.15rem;
          --rdp-months-gap: 1.25rem;
          --rdp-outside-opacity: 0.35;
          --rdp-disabled-opacity: 0.3;
          font-size: 0.8125rem;
        }
        .rdp-crm .rdp-month_caption { font-weight: 700; color: #0f172a; }
        .rdp-crm .rdp-weekday { color: #94a3b8; font-weight: 600; text-transform: uppercase; font-size: 0.65rem; }
        .rdp-crm .rdp-day_button { border-radius: 0.5rem; }
        .rdp-crm .rdp-day_button:hover:not([disabled]) { background-color: #f1f5f9; }
      `}</style>
    </div>
  );
}

/**
 * "2026-07-14" → a Date at LOCAL midnight.
 *
 * <p>Built from parts rather than {@code new Date("2026-07-14")}, which the spec parses as UTC —
 * in IST that Date is 05:30 on the 14th, and any later local-midnight comparison is off.</p>
 */
function parseLocal(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
  if (!match) return undefined;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** A Date → "yyyy-MM-dd" using LOCAL parts. See the note on toISOString above. */
function formatLocal(date) {
  if (!date) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

const pretty = (date) =>
  date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
