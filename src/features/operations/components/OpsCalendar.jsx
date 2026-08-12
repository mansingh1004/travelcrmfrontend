// features/operations/components/OpsCalendar.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The same departures the board lists, drawn on a month.
//
// A view mode, not a second screen: it renders the SAME filtered rows the board
// already fetched, and clicking a bar opens the SAME detail panel. Nothing here
// calls the API.
//
// WHY BARS AND NOT DOTS. A task happens at a moment; a booking runs from one date
// to another. Plotting a trip as a dot on its departure day throws away the thing
// operations most needs to see — that four parties are in the field on the 24th, and
// two of them are not ready. Every bar is clipped to the week row it crosses, so a
// ten-night trip draws as two or three joined segments rather than one bar
// overflowing the grid.
//
// This is deliberately SEPARATE from the team/task calendar in features/calendar:
// different consumer, and point-in-time semantics there versus spans here.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

import { Panel, GridEmpty, READINESS_STYLE } from "./opsUi";
import {
  monthMatrix, placeInWeek, monthLabel, addMonths, sameDay, parseISO, WEEKDAYS,
} from "../lib/opsCalendarUi";

/** How many bars fit in a cell before the rest collapse into a "+N" line. */
const MAX_BARS_PER_WEEK = 4;

/**
 * A row's worst unfinished dimension decides its colour.
 *
 * Not an average: operations cares about the weakest link. A trip with five things
 * confirmed and one not started is a trip that is not ready.
 */
function toneFor(entry) {
  const values = Object.values(entry?.readiness ?? {});
  if (values.includes("NOT_STARTED")) return READINESS_STYLE.NOT_STARTED;
  if (values.includes("IN_PROGRESS")) return READINESS_STYLE.IN_PROGRESS;
  if (values.includes("READY")) return READINESS_STYLE.READY;
  return READINESS_STYLE.NOT_APPLICABLE;
}

export default function OpsCalendar({ rows = [], windowStart, selected, onSelect }) {
  const [cursor, setCursor] = useState(() => parseISO(windowStart) ?? new Date());

  const weeks = useMemo(() => monthMatrix(cursor), [cursor]);
  const today = new Date();

  // Placed per week, so a trip crossing a week boundary draws once in each row it
  // touches rather than once overall.
  const placedByWeek = useMemo(
    () =>
      weeks.map((week) =>
        rows
          .map((entry) => {
            const place = placeInWeek(week, entry.travelDate, entry.tripEndDate);
            return place ? { entry, place } : null;
          })
          .filter(Boolean)
          // Longest first: a ten-night trip reads as the backdrop for the short ones
          // sitting on top of it, rather than being pushed off the bottom by them.
          .sort((a, b) => b.place.span - a.place.span || a.entry.travelDate.localeCompare(b.entry.travelDate))
      ),
    [weeks, rows]
  );

  const monthHasAnything = placedByWeek.some((w) => w.length > 0);

  return (
    <Panel className="flex-1 overflow-hidden min-w-0">
      {/* Month navigation */}
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCursor(addMonths(cursor, -1))}
            aria-label="Previous month"
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCursor(addMonths(cursor, 1))}
            aria-label="Next month"
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <p className="ml-2 text-sm font-extrabold text-slate-700">{monthLabel(cursor)}</p>
        </div>
        <p className="text-[11px] font-bold text-slate-300 hidden sm:block">
          Bars span the whole trip · colour is the least-ready part
        </p>
      </div>

      {!monthHasAnything && (
        <GridEmpty
          icon={CalendarDays}
          title="Nothing in this month"
          hint="Step to another month, or widen the window the board is looking at."
        />
      )}

      {monthHasAnything && (
        <div className="overflow-x-auto">
          <div className="min-w-[760px] p-3">
            {/* Weekday header */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAYS.map((d) => (
                <div key={d} className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider text-center py-1">
                  {d}
                </div>
              ))}
            </div>

            {weeks.map((week, wi) => {
              const placed = placedByWeek[wi];
              const shown = placed.slice(0, MAX_BARS_PER_WEEK);
              const hidden = placed.length - shown.length;

              return (
                <div key={wi} className="mb-1">
                  {/* Day numbers */}
                  <div className="grid grid-cols-7 gap-1">
                    {week.map((day, di) => {
                      const inMonth = day.getMonth() === cursor.getMonth();
                      const isToday = sameDay(day, today);
                      return (
                        <div
                          key={di}
                          className={`rounded-t-lg px-2 pt-1.5 text-[11px] font-bold ${
                            inMonth ? "text-slate-500 bg-slate-50/70" : "text-slate-300 bg-slate-50/30"
                          }`}
                        >
                          <span
                            className={
                              isToday
                                ? "inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white"
                                : ""
                            }
                          >
                            {day.getDate()}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Bars — one absolute-free grid row per trip, columns give the span */}
                  <div className="bg-slate-50/40 rounded-b-lg px-1 pb-1.5 pt-1 space-y-1 min-h-[46px]">
                    {shown.map(({ entry, place }) => {
                      const tone = toneFor(entry);
                      const isSelected = selected?.bookingPublicId === entry.bookingPublicId;
                      return (
                        <div key={`${entry.bookingPublicId}-${wi}`} className="grid grid-cols-7 gap-1">
                          <button
                            onClick={() => onSelect?.(isSelected ? null : entry)}
                            title={`${entry.bookingCode} · ${entry.customerName ?? ""} · ${entry.destination ?? ""}`}
                            style={{ gridColumn: `${place.startCol + 1} / span ${place.span}` }}
                            className={`flex items-center gap-1.5 h-6 px-2 text-[11px] font-bold text-white truncate transition-all
                              bg-gradient-to-r from-blue-500 to-indigo-500 hover:brightness-110
                              ${place.continuesLeft ? "rounded-l-none" : "rounded-l-full"}
                              ${place.continuesRight ? "rounded-r-none" : "rounded-r-full"}
                              ${isSelected ? "ring-2 ring-offset-1 ring-blue-400" : ""}`}
                          >
                            {/* The readiness dot rides on the bar so the grid answers
                                "who is not ready" without opening anything. */}
                            <span className={`w-2 h-2 rounded-full shrink-0 ring-1 ring-white/70 ${tone.dot}`} />
                            <span className="truncate">
                              {entry.bookingCode}
                              {place.span > 2 && entry.destination ? ` · ${entry.destination}` : ""}
                            </span>
                          </button>
                        </div>
                      );
                    })}

                    {hidden > 0 && (
                      <p className="text-[10px] font-bold text-slate-400 pl-2">+{hidden} more this week</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Panel>
  );
}
