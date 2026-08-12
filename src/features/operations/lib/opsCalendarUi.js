// features/operations/lib/opsCalendarUi.js
// ─────────────────────────────────────────────────────────────────────────────
// Date arithmetic for the operations calendar. Native Date only — this app has no
// date library installed, and the month grid in features/calendar is hand-rolled
// the same way. Copied rather than imported: kits and libs are feature-local.
//
// Everything here works in DAY units, never milliseconds-since-epoch compared
// directly. A booking spanning a daylight boundary is still the same number of
// nights, and floor(ms/86400000) is what keeps that true.
// ─────────────────────────────────────────────────────────────────────────────

const DAY_MS = 86400000;

/** Parse a yyyy-MM-dd string as a LOCAL midnight Date. `new Date("2026-08-20")` is UTC. */
export function parseISO(iso) {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** yyyy-MM-dd from local parts. Never toISOString — that is UTC and drops a day west of IST. */
export function isoDate(d) {
  if (!d) return null;
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

export const addMonths = (date, months) => {
  const d = new Date(date);
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  return d;
};

export const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

/** Sunday-first, matching the existing calendar in this app. */
export const startOfWeek = (date) => addDays(date, -date.getDay());

/** Whole days since the epoch — the unit every comparison here uses. */
export const dayIndex = (date) => Math.floor(date.getTime() / DAY_MS);

export const sameDay = (a, b) =>
  a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * Six weeks of seven days covering the cursor's month, leading and trailing days
 * included. Always 6 rows so the grid does not change height between months.
 */
export function monthMatrix(cursor) {
  const first = startOfWeek(startOfMonth(cursor));
  const weeks = [];
  for (let w = 0; w < 6; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) days.push(addDays(first, w * 7 + d));
    weeks.push(days);
  }
  return weeks;
}

/**
 * Where a booking's span sits inside one week row, or null when it does not touch it.
 *
 * Returns 0-based `startCol` and a `span` in columns, both clamped to the week — which
 * is what lets one trip draw as a bar in each week it crosses instead of one bar that
 * overflows the grid. `continuesLeft`/`continuesRight` let the caller square off the
 * ends that are not the real start and finish.
 *
 * A booking with no end date occupies exactly its departure day: the honest rendering
 * of "we do not know when this comes back".
 */
export function placeInWeek(week, startIso, endIso) {
  const start = parseISO(startIso);
  if (!start || !week?.length) return null;

  const end = parseISO(endIso) || start;

  const weekStart = dayIndex(week[0]);
  const weekEnd = dayIndex(week[6]);
  const s = dayIndex(start);
  // Inclusive last day. A 20→25 booking occupies the 20th through the 24th night and
  // shows through the 25th, which is the day the party is still travelling home.
  const e = Math.max(s, dayIndex(end));

  if (e < weekStart || s > weekEnd) return null;

  const from = Math.max(s, weekStart);
  const to = Math.min(e, weekEnd);

  return {
    startCol: from - weekStart,
    span: to - from + 1,
    continuesLeft: s < weekStart,
    continuesRight: e > weekEnd,
  };
}

export const monthLabel = (date) =>
  date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
