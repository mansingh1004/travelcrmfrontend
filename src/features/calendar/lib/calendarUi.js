// features/calendar/lib/calendarUi.js
// Shared constants + date/formatting helpers for the Task & Team Calendar.

// ── Event sources (mirror backend CalendarSource) + their calendar colours ──────────────
export const SOURCE_ORDER = [
  "TRIP", "REMINDER", "PAYMENT_DUE", "VISA", "FLIGHT", "HOTEL_CHECKIN", "TASK", "MEETING",
];

export const SOURCE_META = {
  TRIP:          { label: "Confirmed Trips",   dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  REMINDER:      { label: "Follow-ups",        dot: "bg-blue-500",    chip: "bg-blue-50 text-blue-700 ring-blue-200" },
  PAYMENT_DUE:   { label: "Payments Due",      dot: "bg-amber-500",   chip: "bg-amber-50 text-amber-700 ring-amber-200" },
  VISA:          { label: "Visa Appointments", dot: "bg-rose-500",    chip: "bg-rose-50 text-rose-700 ring-rose-200" },
  FLIGHT:        { label: "Flights",           dot: "bg-indigo-500",  chip: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  HOTEL_CHECKIN: { label: "Hotel Check-ins",   dot: "bg-yellow-500",  chip: "bg-yellow-50 text-yellow-800 ring-yellow-200" },
  TASK:          { label: "Tasks",             dot: "bg-violet-500",  chip: "bg-violet-50 text-violet-700 ring-violet-200" },
  MEETING:       { label: "Team Meetings",     dot: "bg-slate-500",   chip: "bg-slate-100 text-slate-700 ring-slate-300" },
};

// A TASK whose category is "Team Meeting" is coloured as a meeting; everything else by source.
export function metaKeyFor(ev) {
  if (ev?.source === "TASK" && ev?.category === "Team Meeting") return "MEETING";
  return ev?.source || "TASK";
}
export function metaFor(ev) {
  return SOURCE_META[metaKeyFor(ev)] || SOURCE_META.TASK;
}

// ── Task enums (mirror backend) ─────────────────────────────────────────────────────────
export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE", "CANCELLED"];
export const TASK_STATUS_LABEL = { TODO: "To Do", IN_PROGRESS: "In Progress", DONE: "Done", CANCELLED: "Cancelled" };
export const BOARD_COLUMNS = ["TODO", "IN_PROGRESS", "DONE"];

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
export const PRIORITY_META = {
  LOW:    { label: "Low",    chip: "bg-slate-100 text-slate-600" },
  MEDIUM: { label: "Medium", chip: "bg-blue-100 text-blue-700" },
  HIGH:   { label: "High",   chip: "bg-amber-100 text-amber-700" },
  URGENT: { label: "Urgent", chip: "bg-rose-100 text-rose-700" },
};

export const TASK_CATEGORIES = [
  "GENERAL", "FOLLOW_UP", "CALL", "MEETING", "PAYMENT", "DOCUMENT", "VISA", "TRAVEL", "OTHER",
];
export const CATEGORY_LABEL = {
  GENERAL: "General", FOLLOW_UP: "Follow-up", CALL: "Call", MEETING: "Team Meeting",
  PAYMENT: "Payment", DOCUMENT: "Document", VISA: "Visa", TRAVEL: "Travel", OTHER: "Other",
};

// ── Date helpers ────────────────────────────────────────────────────────────────────────
export const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad = (n) => String(n).padStart(2, "0");

/** Local YYYY-MM-DD for a Date built from local Y/M/D. */
export const isoDate = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
export const dateKey = (date) => isoDate(date.getFullYear(), date.getMonth(), date.getDate());

/**
 * Bucket key for an event on the grid. All-day events are stamped at UTC midnight by the backend,
 * so bucket them by their UTC calendar date (matches the backend's UTC-day model); timed events
 * (tasks/reminders with a real time) bucket by the viewer's local date.
 */
export function eventDayKey(ev) {
  const d = new Date(ev.start);
  if (Number.isNaN(d.getTime())) return null;
  return ev.allDay
    ? `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
    : dateKey(d);
}

/**
 * A multi-night stay, as one entry per night it occupies.
 *
 * <h3>Why this exists</h3>
 * Every other calendar source is a POINT — a flight departs, a task is due, a payment falls due —
 * and bucketing an event to one day is right for all of them. A hotel stay is a SPAN, and treating
 * it as a point made the calendar unable to answer the question a day view is usually asked: a
 * 10→14 August stay was a single mark on the 10th, so opening the 12th showed nothing even though
 * the guest was in the hotel that night.
 *
 * The backend already returns the row on every day it spans (its query is an overlap, not a
 * BETWEEN) and each event carries both `start` and `end`. This turns that one event into the
 * per-night entries the day-bucketed grid needs.
 *
 * <h3>Check-out is exclusive</h3>
 * A stay from the 10th to the 12th occupies the nights of the 10th and 11th and is GONE on the
 * 12th — the same rule the whole booking stack uses. The loop therefore stops strictly before
 * `end`. Getting this wrong shows a guest in a room they checked out of, which is exactly the sort
 * of error nobody notices until a property is over-promised.
 *
 * @returns {Array<Object>} the event, marked up with `_night: {index, total, first, last}` so a
 *          renderer can say "night 2 of 4" rather than repeating "Check-in" four times. A single
 *          night, or an event with no usable `end`, returns the event untouched — callers must be
 *          able to treat the result uniformly.
 */
export function expandStayNights(ev) {
  if (!ev?.start || !ev?.end) return [ev];

  const start = new Date(ev.start);
  const end = new Date(ev.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [ev];

  // Compare at day granularity: these arrive as all-day instants, and an hours-level comparison
  // would make a stay one night longer or shorter depending on the viewer's timezone.
  const dayMs = 86400000;
  const startDay = Math.floor(start.getTime() / dayMs);
  const endDay = Math.floor(end.getTime() / dayMs);
  const nights = endDay - startDay;
  if (nights <= 1) return [ev];

  const out = [];
  for (let i = 0; i < nights; i += 1) {
    const night = new Date((startDay + i) * dayMs);
    out.push({
      ...ev,
      // A distinct id per night, or React reconciles four nights of the same stay as one row.
      id: `${ev.id}:n${i}`,
      start: night.toISOString(),
      _night: { index: i + 1, total: nights, first: i === 0, last: i === nights - 1 },
    });
  }
  return out;
}

export const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
export const addMonths = (date, n) => new Date(date.getFullYear(), date.getMonth() + n, 1);
export const addDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + n); return d; };
export const startOfWeek = (date) => addDays(date, -date.getDay()); // Sunday-first

/** 6×7 grid of Date cells covering the month of `cursor` (leading/trailing days included). */
export function monthMatrix(cursor) {
  const first = startOfMonth(cursor);
  const gridStart = startOfWeek(first);
  const weeks = [];
  for (let w = 0; w < 6; w++) {
    const row = [];
    for (let d = 0; d < 7; d++) row.push(addDays(gridStart, w * 7 + d));
    weeks.push(row);
  }
  return weeks;
}

/** UTC instant bounds [from, to) covering the whole month grid of `cursor` (for the feed window). */
export function gridWindow(cursor) {
  const weeks = monthMatrix(cursor);
  const first = weeks[0][0];
  const last = addDays(weeks[5][6], 1);
  const toUtcMidnight = (d) =>
    new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString();
  return { from: toUtcMidnight(first), to: toUtcMidnight(last) };
}

// ── Formatting ──────────────────────────────────────────────────────────────────────────
const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
export const fmtMoney = (n) => `₹${inr.format(Math.round(Number(n) || 0))}`;

export const fmtTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};

export const fmtDayLabel = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
};

/** ISO instant → <input type="datetime-local"> value in local time. */
export const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
};

/** <input type="datetime-local"> value → ISO instant (UTC). */ 
export const fromLocalInput = (val) => (val ? new Date(val).toISOString() : null);
