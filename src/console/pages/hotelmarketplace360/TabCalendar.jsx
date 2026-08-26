// src/console/pages/hotelmarketplace360/TabCalendar.jsx
//
// This property's stay calendar, broken down by room type — room types down, nights across.
//
// WHY IT IS SCOPED TO ONE HOTEL. The all-hotels roll-up on /console/hotel-occupancy answers "which
// properties am I exposed at". That is a different question from "at THIS property, in what", and
// the server only computes the room-type breakdown for a single-hotel request precisely because ten
// hotels × their room types × 92 nights is a payload nobody reads.
//
// WHAT IT IS NOT: inventory. The platform holds no allotment, so it cannot say how many rooms are
// FREE — only how many it has SOLD. That is why there is no percentage, no "sold out", and
// no green-amber-red ramp: a fuel gauge implies a tank, and there is no tank. The deleted mock
// InventoryCalendar this replaces did exactly that, on made-up data, and it was wrong every day it
// shipped.
//
// COMMITTED vs PENDING are never summed. Committed is what the platform has promised a supplier;
// pending is a request nobody has decided. Adding them tells an operator they owe rooms they have
// not agreed to.
//
// SURFACE: deliberately FLAT. The console's GlassCard (`bg-surface/80 backdrop-blur-md`) is right for
// a card with six figures on it and wrong behind four hundred cells — a translucent, blurred ground
// lowers the contrast between a filled cell and an empty one, which is the only comparison this
// screen exists to support. The breathing room goes around the grid, not inside it.
//
// NOTHING HERE IS CLICKABLE, and that is a decision rather than an omission. The occupancy payload
// carries per-night COUNTS, not booking rows — there is no guest, no booking code, no stay range in
// it — so a cell has nothing to open. A cell that invites a click and does nothing is worse than one
// that plainly does not, so no cell is a button, none takes focus, and none shows a pointer.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarRange, ChevronLeft, ChevronRight, X } from "lucide-react";
import { marketplaceOccupancyService as svc } from "../../api/marketplaceOccupancyService";
import { marketplaceBookingService } from "../../api/marketplaceBookingService";
import { Button } from "../../components/hotelUi";
import CalendarCell, { CELL_LEVELS, swatchFor } from "./CalendarCell";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { useToast } from "@shared/ui/toast";

/** Four weeks is the horizon an operator works to; the server allows 92. */
const SPAN = 28;
const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** UTC throughout: a stay date is a calendar date, and a local-midnight Date shifts it by a day. */
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (isoDate, n) => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
const todayIso = () => iso(new Date());

/**
 * The statuses the OCCUPANCY figures count as committed.
 *
 * Mirrored from the occupancy service's own contract — CONFIRMED plus the two cancellation-in-
 * progress states, because the hotel is still holding those rooms. The click-through must filter on
 * exactly this set or the grid and the dialog disagree: a cell reading 1 that opens a list of two,
 * one of them cancelled, teaches an operator the grid is wrong when it is the list that is.
 */
const COMMITTED = new Set(["CONFIRMED", "CANCEL_REQUESTED", "CANCELLATION_QUOTED"]);

/**
 * Pages of bookings to pull before giving up.
 *
 * The bookings endpoint has no date filter, so the whole hotel has to come down and be narrowed
 * here. Four pages of 200 covers any property this catalog realistically holds; past that the grid
 * still renders and still counts correctly — only the click-through goes quiet, and the header says
 * so rather than letting a cell fail silently.
 */
const BOOKING_PAGES = 4;
const BOOKING_PAGE_SIZE = 200;

/**
 * Every night a stay occupies, as `YYYY-MM-DD`.
 *
 * HALF-OPEN, and this is the single most common bug on a screen like this: a 26 → 30 August booking
 * occupies the nights of the 26th, 27th, 28th and 29th. It does NOT occupy the 30th — the guest has
 * left that morning. A closed interval double-counts every changeover day and makes a departing and
 * an arriving guest look like an overlap.
 */
function nightsOf(checkIn, checkOut) {
  const out = [];
  if (!checkIn || !checkOut) return out;
  let cursor = String(checkIn).slice(0, 10);
  const end = String(checkOut).slice(0, 10);
  // Bounded independently of the data: a corrupt checkOut must not spin here.
  for (let i = 0; i < 400 && cursor < end; i += 1) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

/**
 * The column chrome for one night, shared by the room rows and the totals row.
 *
 * Weekend shading and the month-start divider live HERE rather than inside `CalendarCell`, because
 * they belong to this table's axis — the all-hotels grid draws the same night with its own column
 * rules, and pushing them into the shared cell would mean a prop per caller's table.
 */
function dayCell(isoDate) {
  const dt = new Date(`${isoDate}T00:00:00Z`);
  const weekend = dt.getUTCDay() === 0 || dt.getUTCDay() === 6;
  return [
    "border-b border-border px-0 py-0 text-center",
    weekend ? "bg-surface-hover/40" : "",
    dt.getUTCDate() === 1 ? "border-l border-border-strong" : "",
  ].join(" ");
}

export default function TabCalendar({ hotel, publicId }) {
  const { showToast } = useToast();
  const [from, setFrom] = useState(todayIso);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  // Rendered inline and NOT folded into `data === null`. Before this, a failed request fell through
  // to the empty state and told the operator this property had no stays in the window — a fetch
  // failure reading as a business fact is the one wrong answer this screen must never give.
  const [error, setError] = useState("");
  /*
    How many room rows the skeleton should draw.

    Seeded at three and then kept at whatever the last successful window returned, so paging forward
    and back — which is most of this screen's use — rebuilds a skeleton the real table lands exactly
    on top of. Only the very first load can guess wrong.
  */
  const [rowGuess, setRowGuess] = useState(3);

  /*
    The bookings behind the counts, for the click-through only.

    A SEPARATE call, and deliberately so: the occupancy endpoint answers "how many", and nothing in
    its payload can answer "who". The bookings endpoint has always accepted `hotelPublicId` — the
    sibling Bookings tab already asks it exactly this question — so this needs no server change. The
    counts on screen still come from occupancy; these rows only decide what a click can open.
  */
  const [bookings, setBookings] = useState([]);
  const [bookingsTruncated, setBookingsTruncated] = useState(false);
  const [openCell, setOpenCell] = useState(null); // { date, roomName, bookings } | null
  // Focus has to come back to the exact cell that opened the dialog, not to the top of the grid.
  const openerRef = useRef(null);

  const to = useMemo(() => addDays(from, SPAN - 1), [from]);
  const today = todayIso();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await svc.list({ from, to, hotelPublicId: publicId });
      const row = rows?.[0] ?? null;
      setData(row);
      if (row?.roomTypes?.length) setRowGuess(row.roomTypes.length);
    } catch (e) {
      if (!isAlreadyReported(e)) showToast(getErrorMessage(e, "Could not load the calendar."), "error");
      setError(getErrorMessage(e, "Could not load the calendar."));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [from, to, publicId, showToast]);

  useEffect(() => { load(); }, [load]);

  /*
    Pulled once per property, not once per window: the endpoint cannot filter by date, so paging the
    calendar would otherwise re-download the same rows. A failure here is deliberately QUIET — the
    grid and its counts are unaffected, and the only thing lost is the click-through, so a toast
    about a feature the operator has not reached for yet would be noise.
  */
  useEffect(() => {
    let alive = true;
    setBookings([]);
    setBookingsTruncated(false);

    (async () => {
      const all = [];
      let truncated = false;
      try {
        for (let page = 0; page < BOOKING_PAGES; page += 1) {
          const res = await marketplaceBookingService.list({
            page, size: BOOKING_PAGE_SIZE, hotelPublicId: publicId,
          });
          all.push(...(res.items ?? []));
          const total = res.pagination?.totalElements ?? all.length;
          if (all.length >= total) break;
          if (page === BOOKING_PAGES - 1) truncated = true;
        }
      } catch {
        // Swallowed on purpose — see the note above. Cells simply stay inert.
        return;
      }
      if (!alive) return;
      setBookings(all.filter((b) => COMMITTED.has(b.status)));
      setBookingsTruncated(truncated);
    })();

    return () => { alive = false; };
  }, [publicId]);

  const days = data?.days ?? [];
  const roomTypes = data?.roomTypes ?? [];

  /*
    night -> room name -> bookings, built once per fetch.

    Keyed by room NAME rather than an id because that is the only handle the two payloads share: the
    occupancy breakdown carries `roomName` off the catalog room, the booking carries the name it was
    made against. A booking whose room name no longer matches any row still reaches the ALL bucket,
    so it is never silently unreachable.
  */
  const index = useMemo(() => {
    const byNight = new Map();
    for (const b of bookings) {
      for (const night of nightsOf(b.checkIn, b.checkOut)) {
        let rooms = byNight.get(night);
        if (!rooms) { rooms = new Map(); byNight.set(night, rooms); }
        for (const key of ["__all__", b.roomName || "__unnamed__"]) {
          const list = rooms.get(key);
          if (list) list.push(b);
          else rooms.set(key, [b]);
        }
      }
    }
    return byNight;
  }, [bookings]);

  const bookingsAt = useCallback(
    (date, roomName) => index.get(date)?.get(roomName ?? "__all__") ?? [],
    [index],
  );

  const openAt = useCallback((event, date, roomName) => {
    const list = bookingsAt(date, roomName);
    if (!list.length) return;
    openerRef.current = event.currentTarget;
    setOpenCell({ date, roomName, bookings: list });
  }, [bookingsAt]);

  const closePopup = useCallback(() => {
    setOpenCell(null);
    // Restore focus to the cell, not the document — the operator's place in the grid is the point.
    openerRef.current?.focus?.();
    openerRef.current = null;
  }, []);

  /*
    One scale for the whole grid, taken from the busiest night at this property.

    Renormalising per room type would make a room with a single booking look as loaded as the
    property's worst night — the rows would stop being comparable, which is the only reason to put
    them in a grid together.
  */
  const peak = useMemo(
    () => days.reduce((m, d) => Math.max(m, d.roomsCommitted ?? 0), 0),
    [days],
  );

  const shift = (dir) => setFrom((f) => addDays(f, dir * SPAN));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="inline-flex items-center gap-2 text-sm font-extrabold text-heading">
              <CalendarRange className="h-4 w-4" aria-hidden="true" />
              Rooms sold, by night
            </h2>
            <p className="mt-0.5 text-xs tabular-nums text-muted">
              {from} → {to} · what the platform has SOLD here. Not availability — no allotment is held.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => shift(-1)} aria-label="Previous four weeks">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => setFrom(todayIso())}>Today</Button>
            <Button size="sm" variant="outline" onClick={() => shift(1)} aria-label="Next four weeks">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* The error keeps the grid frame rather than replacing it, so the window controls above stay
            reachable and a retry is one click rather than a reload.

            Deliberately COLOURLESS. The obvious rose banner is the one thing this screen may not
            paint: red beside a green grid reads as unavailable-versus-available to anyone who has
            worked a front desk, and the misreading is the whole hazard this calendar is careful
            about. Weight and the retry button carry the urgency instead of hue. */}
        {error && !loading && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-strong bg-surface-hover px-4 py-3">
            <p className="text-sm font-semibold text-heading">{error}</p>
            <Button size="sm" variant="outline" onClick={load}>Try again</Button>
          </div>
        )}

        {loading ? (
          <SkeletonGrid rows={rowGuess} />
        ) : error ? (
          <GridFrame />
        ) : roomTypes.length === 0 ? (
          /*
            A window with nothing in it is a real answer, and a common one — most of this catalog's
            stays sit months out. Saying so beats a grid of dashes that reads as a failed fetch.
          */
          <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
            <p className="text-sm font-semibold text-heading">Nothing booked in this window</p>
            <p className="mt-1 text-xs tabular-nums text-muted">
              {hotel?.name ? `${hotel.name} has ` : "This property has "}
              no stays between {from} and {to}. Try moving the window forward.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 border-b border-border bg-surface px-3 py-2 text-left align-bottom text-xs font-semibold text-muted">
                      Room type
                    </th>
                    {days.map((d) => (
                      <DayHead key={d.date} date={d.date} isToday={d.date === today} />
                    ))}
                    <th className="border-b border-l border-border px-3 py-2 text-right align-bottom text-xs font-semibold text-muted">
                      Nights
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {roomTypes.map((rt) => (
                    <tr key={rt.roomPublicId ?? "unspecified"}>
                      <td className="sticky left-0 z-10 max-w-[14rem] border-b border-border bg-surface px-3 py-0">
                        <p className="truncate text-sm font-semibold text-heading">{rt.roomName}</p>
                      </td>
                      {rt.days.map((d) => (
                        <td key={d.date} className={dayCell(d.date)}>
                          <CalendarCell
                            day={d}
                            peak={peak}
                            label={`${rt.roomName} — ${d.date}`}
                            onOpen={bookingsAt(d.date, rt.roomName).length
                              ? (e) => openAt(e, d.date, rt.roomName)
                              : undefined}
                          />
                        </td>
                      ))}
                      <td className="border-b border-l border-border px-3 py-0 text-right text-sm font-semibold tabular-nums text-heading">
                        {rt.totalRoomNightsCommitted}
                      </td>
                    </tr>
                  ))}

                  {/* The property total, kept visually apart from the rows that compose it. */}
                  <tr>
                    <td className="sticky left-0 z-10 border-b border-t border-border bg-surface px-3 py-0">
                      <p className="text-sm font-extrabold text-heading">All room types</p>
                    </td>
                    {days.map((d) => (
                      <td key={d.date} className={`${dayCell(d.date)} border-t`}>
                        <CalendarCell
                          day={d}
                          peak={peak}
                          label={`All rooms — ${d.date}`}
                          strong
                          onOpen={bookingsAt(d.date).length ? (e) => openAt(e, d.date, null) : undefined}
                        />
                      </td>
                    ))}
                    <td className="border-b border-l border-t border-border px-3 py-0 text-right text-sm font-extrabold tabular-nums text-heading">
                      {data?.totalRoomNightsCommitted ?? 0}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <Legend peak={peak} />

            {/* Said out loud rather than left to be discovered. The counts above are complete; it is
                only the click-through that stops short, and an operator who finds one cell inert
                would otherwise conclude the whole feature is broken. */}
            {bookingsTruncated && (
              <p className="mt-2 text-[11px] text-muted">
                This property has more bookings than the click-through loads, so some nights will not
                open. The counts above are unaffected.
              </p>
            )}
          </>
        )}
      </section>

      {openCell && <BookingPopup cell={openCell} onClose={closePopup} />}
    </div>
  );
}

/* ── pieces ───────────────────────────────────────────────────────────── */

/**
 * One column head: the date, with its weekday beneath.
 *
 * The number leads because the number is what an operator is looking for — a weekday is context for
 * a date, not the other way round. Today is marked on the DATE, in the console accent, rather than as
 * a filled block: a filled column would compete with the fills that carry the actual data.
 */
function DayHead({ date, isToday }) {
  const dt = new Date(`${date}T00:00:00Z`);
  const weekend = dt.getUTCDay() === 0 || dt.getUTCDay() === 6;

  return (
    <th
      scope="col"
      aria-current={isToday ? "date" : undefined}
      className={[
        // `align-bottom` matches the row-label and Nights headers, so all three sit on ONE baseline.
        // Without it the two-line date block centres itself and the label column drifts a pixel or
        // two off it — across twenty-eight columns that drift is the most visible flaw on the screen.
        "border-b border-border px-0 py-1.5 text-center align-bottom font-normal",
        weekend ? "bg-surface-hover/40" : "",
        dt.getUTCDate() === 1 ? "border-l border-border-strong" : "",
      ].join(" ")}
    >
      <span
        className={[
          "block text-[13px] leading-none tabular-nums",
          isToday ? "font-extrabold text-accent" : "font-semibold text-body",
        ].join(" ")}
      >
        {dt.getUTCDate()}
      </span>
      <span className={`mt-0.5 block text-[10px] leading-none ${isToday ? "text-accent" : "text-muted"}`}>
        {WEEKDAY[dt.getUTCDay()]}
      </span>
    </th>
  );
}

/**
 * What the fills mean.
 *
 * Without this the tint is decoration: the number in a cell is readable on its own, but the shade
 * carries the row-to-row comparison and nothing on screen said what a darker cell was worth.
 *
 * It names PENDING as well as sold, which the strict reading of "sold / no data" would leave out.
 * Dropping it is not an option — pending is a separate holding this module is explicit about never
 * folding into the sold figure, and a mark on the grid with no entry in the legend is a mark the
 * reader has to guess at.
 */
function Legend({ peak }) {
  if (!peak) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border pt-3">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold text-muted">Rooms sold</span>
        <span className="flex items-center gap-0.5" aria-hidden="true">
          {CELL_LEVELS.map((_, i) => (
            <span key={i} className="h-3.5 w-6 rounded-[2px]" style={swatchFor(i)} />
          ))}
        </span>
        <span className="text-[11px] tabular-nums text-muted">
          1 <span className="px-1 text-border-strong">→</span> {peak}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="relative inline-block h-3.5 w-6 rounded-[2px] border border-border" aria-hidden="true">
          <span
            className="absolute right-0 top-0 h-0 w-0 border-l-[7px] border-t-[7px] border-l-transparent"
            style={{ borderTopColor: "var(--sa-hue-amber)" }}
          />
        </span>
        <span className="text-[11px] font-semibold text-muted">Pending, not yet decided</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="grid h-3.5 w-6 place-items-center rounded-[2px] border border-border text-[10px] text-muted/40" aria-hidden="true">·</span>
        <span className="text-[11px] font-semibold text-muted">No booking data</span>
      </div>
    </div>
  );
}

/**
 * The loading state, at the real geometry.
 *
 * A spinner collapses the layout and then the table shoves the page down when it lands. This draws
 * the same column count, the same 40px rows and the same sticky label column, so the real grid
 * replaces it in place.
 */
function SkeletonGrid({ rows }) {
  const cols = Array.from({ length: SPAN }, (_, i) => i);
  const bars = Array.from({ length: Math.max(1, rows) }, (_, i) => i);

  return (
    <div className="overflow-x-auto" aria-busy="true" aria-label="Loading the calendar">
      <table className="w-full border-collapse">
        <tbody>
          <tr>
            <td className="sticky left-0 z-10 w-56 border-b border-border bg-surface px-3 py-2">
              <span className="block h-3 w-24 animate-pulse motion-reduce:animate-none rounded bg-surface-hover" />
            </td>
            {cols.map((i) => (
              <td key={i} className="border-b border-border px-0 py-2 text-center">
                <span className="mx-auto block h-3 w-5 animate-pulse motion-reduce:animate-none rounded bg-surface-hover" />
              </td>
            ))}
            <td className="border-b border-l border-border px-3 py-2">
              <span className="ml-auto block h-3 w-8 animate-pulse motion-reduce:animate-none rounded bg-surface-hover" />
            </td>
          </tr>

          {bars.map((r) => (
            <tr key={r}>
              <td className="sticky left-0 z-10 border-b border-border bg-surface px-3 py-0">
                <span className="my-[13px] block h-3.5 w-32 animate-pulse motion-reduce:animate-none rounded bg-surface-hover" />
              </td>
              {cols.map((i) => (
                <td key={i} className="border-b border-border px-0 py-0">
                  <span className="mx-[3px] my-[3px] block h-[34px] animate-pulse motion-reduce:animate-none rounded-[3px] bg-surface-hover" />
                </td>
              ))}
              <td className="border-b border-l border-border px-3 py-0">
                <span className="my-[13px] ml-auto block h-3.5 w-6 animate-pulse motion-reduce:animate-none rounded bg-surface-hover" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The bookings behind one night.
 *
 * ABOUT THE BOOKING, NOT THE DATE. The clicked night is the way in, not the subject: a four-night
 * stay shown as a one-day booking is how an operator confirms the wrong dates to a hotel. Each row
 * therefore leads with its full check-in → check-out range, and the clicked night is marked inside
 * it rather than standing in for it.
 *
 * PORTALLED, because the grid scrolls horizontally and establishes its own stacking context — a
 * dialog rendered inside it is clipped by the very thing it was opened from.
 *
 * PORTALLED INTO `.sa-console`, NOT `document.body`, and the difference is not cosmetic. Every
 * console token — `--sa-surface`, `--sa-scrim`, `--sa-border` — is declared ON that element, and
 * dark mode is the `.dark` class sitting on it too. A dialog mounted on `body` lands outside that
 * scope, so `bg-surface` and `bg-scrim` resolve to nothing and the whole panel renders TRANSPARENT
 * with the grid legible straight through it. Mounting on the console root keeps both the tokens and
 * the active theme, and is still far enough above the grid to escape its clipping.
 * `hotelUi`'s own dialog and `ConsoleSidebar` resolve their portal target exactly this way.
 *
 * NO MONEY. A per-booking amount beside a room count back-calculates into a nightly rate, which is
 * exactly what the pricing separation exists to prevent. The fields here are identity and dates.
 */
function BookingPopup({ cell, onClose }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus the panel itself rather than the first control: the close button is not what the
    // operator came for, and a dialog that opens with "Close" announced reads as a dead end.
    panelRef.current?.focus();

    const onKey = (event) => {
      if (event.key === "Escape") { onClose(); return; }
      if (event.key !== "Tab") return;

      // Focus trap. Without it Tab walks straight out into the grid behind the backdrop, where
      // every control is visually covered and none of it can be seen to have focus.
      const focusables = panelRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const scope = cell.roomName ?? "All room types";
  const heading = `${scope} · night of ${fmtNight(cell.date)}`;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center" role="presentation">
      <button
        type="button"
        aria-label="Close booking details"
        onClick={onClose}
        className="absolute inset-0 bg-scrim"
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        className="relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-surface shadow-2xl focus:outline-none sm:max-w-lg sm:rounded-2xl"
        style={{ animation: "calPopIn .14s ease-out both" }}
      >
        {/* 140ms, and disabled outright for anyone who has asked for less motion. */}
        <style>{`
          @keyframes calPopIn { from { opacity: .6; transform: translateY(6px) } to { opacity: 1; transform: none } }
          @media (prefers-reduced-motion: reduce) { [role="dialog"] { animation: none !important } }
        `}</style>

        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Night of {fmtNight(cell.date)}
            </p>
            <h2 className="mt-0.5 truncate text-base font-extrabold text-heading">{scope}</h2>
            <p className="mt-0.5 text-xs tabular-nums text-muted">
              {cell.bookings.length} booking{cell.bookings.length === 1 ? "" : "s"} staying this night
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close booking details"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border text-muted transition hover:bg-surface-hover hover:text-heading focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <ul className="flex flex-col gap-3">
            {cell.bookings.map((b) => (
              <li key={b.publicId} className="rounded-xl border border-border p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    {/* Only what the response carries. A field that is not in the payload is left
                        out entirely rather than drawn as a dash — an empty row teaches the operator
                        the data is missing when it may simply never have been wired. */}
                    {b.bookingCode && (
                      <p className="font-mono text-sm font-bold text-heading">{b.bookingCode}</p>
                    )}
                    {b.roomName && <p className="mt-0.5 text-xs text-muted">{b.roomName}</p>}
                  </div>
                  {b.status && <BookingStatusChip status={b.status} />}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-surface-hover px-3 py-2 text-xs tabular-nums text-body">
                  <span className="font-semibold">{fmtNight(b.checkIn)}</span>
                  <span className="text-muted">→</span>
                  <span className="font-semibold">{fmtNight(b.checkOut)}</span>
                  {b.nights != null && (
                    <span className="text-muted">· {b.nights} night{b.nights === 1 ? "" : "s"}</span>
                  )}
                  {b.rooms != null && (
                    <span className="text-muted">· {b.rooms} room{b.rooms === 1 ? "" : "s"}</span>
                  )}
                </div>

                {/* Cross-tenant, and acceptable here: this is the SuperAdmin console, where knowing
                    which agency holds a stay is the job. It must NOT survive into any hotel-partner
                    reuse of this component — a hotel that learns which agency booked it can go
                    direct next time. */}
                {b.tenantName && (
                  <p className="mt-2 text-[11px] text-muted">
                    Booked by {b.tenantName}{b.tenantCode ? ` · ${b.tenantCode}` : ""}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>,
    document.querySelector(".sa-console") || document.body,
  );
}

/**
 * A BOOKING status, which the shared `StatusPill` cannot render.
 *
 * That component's map is TENANT lifecycle — ACTIVE, TRIAL, PAST_DUE, SUSPENDED — so every booking
 * status falls through to its INACTIVE grey. CONFIRMED and CANCEL_REQUESTED came out identical, and
 * it printed the raw enum. Local rather than a fix to the shared one: its map is correct for what it
 * was written for, and widening it to two unrelated vocabularies is how a shared component becomes
 * nobody's.
 *
 * Only the committed set can reach here, so it is two treatments, not six. CONFIRMED wears the same
 * emerald the grid sells in — one family, one meaning. The cancellation states go NEUTRAL rather
 * than rose: no red on this screen, and the words say it plainly enough.
 */
function BookingStatusChip({ status }) {
  const confirmed = status === "CONFIRMED";
  return (
    <span
      className={[
        "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        confirmed
          ? "border-hue-emerald/25 bg-hue-emerald-soft text-hue-emerald"
          : "border-border bg-surface-hover text-muted",
      ].join(" ")}
    >
      {humanStatus(status)}
    </span>
  );
}

/** `CANCEL_REQUESTED` → `Cancel requested`. Sentence case, because an enum is not a label. */
function humanStatus(status) {
  const words = String(status ?? "").replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A stay date, read as a date. UTC for the same reason the axis is. */
function fmtNight(value) {
  if (!value) return "—";
  const dt = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleDateString(undefined, {
    timeZone: "UTC", day: "numeric", month: "short", year: "numeric",
  });
}

/** The empty frame an inline error leaves behind, so the page keeps its shape while it says so. */
function GridFrame() {
  return (
    <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <p className="text-sm text-muted">The calendar could not be loaded for this window.</p>
    </div>
  );
}
