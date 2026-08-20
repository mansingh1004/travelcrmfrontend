// src/console/pages/MarketplaceOccupancy.jsx
//
// The platform's stay calendar: which nights it has rooms on, at which properties.
//
// WHY THIS EXISTS. The operator who phones a hotel to confirm a request had no way to answer "how
// many of your rooms do I already hold that week". The booking queue is reverse-chronological and
// filtered by status, and nothing anywhere folded a stay across the nights it spans — so the answer
// was a manual scroll, or a database query. Every field needed was already stored.
//
// WHAT IT IS NOT: inventory. The platform holds no allotment, so it cannot say how many rooms are
// FREE at a property — only how many it has SOLD. That distinction is what let this ship ahead of
// the rate-calendar work rather than waiting for it.
//
// COMMITTED vs PENDING are never added together. Committed is what the platform has actually
// promised a supplier; pending is a request nobody has decided yet. Summing them would tell an
// operator they owe a hotel rooms they have not agreed to.
//
// STYLING: console realm. Semantic utilities only (bg-surface / text-heading / border-border /
// bg-accent) — raw slate-*/blue-* resolve to the tenant palette and would break the violet theme.

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Building2, CalendarRange, ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { marketplaceOccupancyService as svc, MAX_WINDOW_DAYS } from "../api/marketplaceOccupancyService";
import OccupancyCell from "../components/OccupancyCell";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { useToast } from "@shared/ui/toast";

/** Default span. Four weeks is the horizon an operator actually works to; the server allows 92. */
const DEFAULT_DAYS = 28;

const iso = (d) => d.toISOString().slice(0, 10);

function addDays(isoDate, n) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}

/** Inclusive day count, which is what the server's window cap is expressed in. */
function daysBetween(from, to) {
  const a = new Date(`${from}T00:00:00Z`);
  const b = new Date(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86400000) + 1;
}

const WEEKDAY = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function dayMeta(isoDate) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return {
    weekday: WEEKDAY[d.getUTCDay()],
    dayNum: d.getUTCDate(),
    // Weekends read differently in a hotel calendar; worth a tint, not a colour.
    weekend: d.getUTCDay() === 0 || d.getUTCDay() === 6,
    monthStart: d.getUTCDate() === 1,
  };
}

export default function MarketplaceOccupancy() {
  const { showToast } = useToast();

  const today = useMemo(() => iso(new Date()), []);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(() => addDays(today, DEFAULT_DAYS - 1));
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);

  /*
    The room-type drill-down. One hotel open at a time — two open at once would push the property
    being compared off the bottom of a table whose whole value is horizontal comparison.

    Fetched on demand rather than with the roll-up: the server only computes the breakdown for a
    single-hotel request, because ten hotels × their room types × 92 nights is a payload nobody reads.
  */
  const [expanded, setExpanded] = useState(null);
  const [roomRows, setRoomRows] = useState(null);
  const [roomsLoading, setRoomsLoading] = useState(false);

  const span = daysBetween(from, to);
  const spanInvalid = span < 1 || span > MAX_WINDOW_DAYS;

  const load = useCallback(async () => {
    // Never send a window the server is certain to reject — the picker says why instead.
    if (daysBetween(from, to) < 1 || daysBetween(from, to) > MAX_WINDOW_DAYS) return;
    setLoading(true);
    try {
      setRows(await svc.list({ from, to }));
    } catch (e) {
      if (!isAlreadyReported(e)) {
        showToast(getErrorMessage(e, "Could not load occupancy."), "error");
      }
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [from, to, showToast]);

  useEffect(() => { load(); }, [load]);

  /**
   * Open or close one property's room-type breakdown.
   *
   * <p>Collapsing clears the rows rather than keeping them: the window can change while a property is
   * open, and stale sub-rows under a re-fetched parent would line up against the wrong nights — the
   * most convincing kind of wrong, because the grid still looks right.</p>
   */
  const toggleHotel = useCallback(async (hotelPublicId) => {
    if (!hotelPublicId || expanded === hotelPublicId) {
      setExpanded(null);
      setRoomRows(null);
      return;
    }
    setExpanded(hotelPublicId);
    setRoomRows(null);
    setRoomsLoading(true);
    try {
      const one = await svc.list({ from, to, hotelPublicId });
      setRoomRows(one?.[0]?.roomTypes ?? []);
    } catch (e) {
      if (!isAlreadyReported(e)) {
        showToast(getErrorMessage(e, "Could not load room types."), "error");
      }
      setRoomRows([]);
    } finally {
      setRoomsLoading(false);
    }
  }, [expanded, from, to, showToast]);

  // The window moved, so anything open is now measured against a different axis. Close it rather
  // than silently re-rendering old nights under new column headers.
  useEffect(() => { setExpanded(null); setRoomRows(null); }, [from, to]);

  /** Shift the window by whole spans, keeping its length — the natural "next month" gesture. */
  const shift = (direction) => {
    const len = daysBetween(from, to);
    setFrom(addDays(from, direction * len));
    setTo(addDays(to, direction * len));
  };

  // The busiest single night across every hotel on screen. Used to scale the bars, so a quiet week
  // does not render as though it were full — the height is relative to what this window actually
  // holds, and the numbers are always on the row for anyone who needs the absolute figure.
  const peak = useMemo(() => {
    if (!rows?.length) return 0;
    return Math.max(1, ...rows.flatMap((h) => h.days.map((d) => d.roomsCommitted + d.roomsPending)));
  }, [rows]);

  const totals = useMemo(() => {
    if (!rows?.length) return null;
    return {
      hotels: rows.length,
      committed: rows.reduce((n, h) => n + h.totalRoomNightsCommitted, 0),
      pending: rows.reduce((n, h) => n + h.totalRoomNightsPending, 0),
      bookings: rows.reduce((n, h) => n + h.distinctBookings, 0),
    };
  }, [rows]);

  const dates = rows?.[0]?.days?.map((d) => d.date) ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-heading">Stay calendar</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Rooms the platform has committed to each property, night by night. This is what has been
            sold — not what is available: no hotel has given the platform an allotment.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-body hover:bg-surface-hover disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </header>

      {/* ── Window picker ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border-strong text-body hover:bg-surface-hover"
          aria-label="Previous period"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">From</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">To</span>
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading"
          />
        </label>

        <button
          type="button"
          onClick={() => shift(1)}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border-strong text-body hover:bg-surface-hover"
          aria-label="Next period"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => { setFrom(today); setTo(addDays(today, DEFAULT_DAYS - 1)); }}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ml-1 rounded-lg px-2 py-2 text-sm font-semibold text-accent hover:underline"
        >
          Next 4 weeks
        </button>

        {/*
          The cap is the server's, mirrored here so the operator is told BEFORE a request that would
          400. An unpaged roll-up has to be bounded on the window, since a roll-up needs every row in
          it.
        */}
        {spanInvalid && (
          <p className="w-full text-sm font-medium text-hue-rose">
            {span < 1
              ? "The end of the window is before its start."
              : `Ask for at most ${MAX_WINDOW_DAYS} days at a time — ${span} selected.`}
          </p>
        )}
      </div>

      {totals && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Properties" value={totals.hotels} />
          <Stat label="Room-nights committed" value={totals.committed} />
          <Stat label="Room-nights pending" value={totals.pending} muted />
          <Stat label="Bookings in window" value={totals.bookings} />
        </div>
      )}

      {/* ── The grid ──────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {loading && rows === null ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading occupancy…
          </div>
        ) : !rows?.length ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <CalendarRange className="h-8 w-8 text-muted" />
            <p className="text-sm font-semibold text-heading">Nothing booked in this window</p>
            <p className="max-w-sm text-sm text-muted">
              No confirmed or pending stay touches these dates. Try a wider window.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 border-b border-border bg-surface-hover px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                    Property
                  </th>
                  {dates.map((d) => {
                    const m = dayMeta(d);
                    return (
                      <th
                        key={d}
                        className={[
                          "border-b border-border px-0 py-1.5 text-center text-[10px] font-medium",
                          m.weekend ? "bg-surface-hover text-body" : "bg-surface text-muted",
                          m.monthStart ? "border-l border-border-strong" : "",
                        ].join(" ")}
                        style={{ minWidth: 30 }}
                      >
                        <span className="block leading-none">{m.weekday}</span>
                        <span className="block leading-tight">{m.dayNum}</span>
                      </th>
                    );
                  })}
                  <th className="border-b border-l border-border bg-surface-hover px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted">
                    Peak
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((h) => {
                  const open = expanded === h.hotelPublicId;
                  return (
                  <Fragment key={h.hotelPublicId ?? h.hotelName}>
                  <tr className="hover:bg-surface-hover">
                    <td className="sticky left-0 z-10 max-w-[15rem] border-b border-border bg-surface p-0">
                      {/*
                        The property name opens its room-type breakdown IN PLACE. A separate screen
                        would have to rebuild this axis, this peak scale and this sticky column, and
                        the operator would lose the comparison they came here for — the point of
                        drilling in is to see one property against the others still on screen.
                      */}
                      <button
                        type="button"
                        onClick={() => toggleHotel(h.hotelPublicId)}
                        disabled={!h.hotelPublicId}
                        aria-expanded={open}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left disabled:cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        {h.hotelPublicId && (
                          <ChevronRight
                            className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform motion-reduce:transition-none ${open ? "rotate-90" : ""}`}
                            aria-hidden="true"
                          />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-heading">{h.hotelName}</span>
                          <span className="block truncate text-xs text-muted">
                            {[h.cityName, `${h.distinctBookings} booking${h.distinctBookings === 1 ? "" : "s"}`]
                              .filter(Boolean).join(" · ")}
                          </span>
                        </span>
                      </button>
                    </td>
                    {h.days.map((d) => (
                      <td
                        key={d.date}
                        className={[
                          "border-b border-border px-0 py-1 align-bottom",
                          dayMeta(d.date).weekend ? "bg-surface-hover/50" : "",
                          dayMeta(d.date).monthStart ? "border-l border-border-strong" : "",
                        ].join(" ")}
                      >
                        <OccupancyCell day={d} peak={peak} label={`${h.hotelName} — ${d.date}`} />
                      </td>
                    ))}
                    <td className="border-b border-l border-border px-3 py-2 text-right text-sm font-semibold tabular-nums text-heading">
                      {h.peakRoomsCommitted}
                    </td>
                  </tr>

                  {open && roomsLoading && (
                    <tr>
                      <td colSpan={h.days.length + 2} className="border-b border-border px-4 py-3 text-xs text-muted">
                        Loading room types…
                      </td>
                    </tr>
                  )}

                  {/*
                    Rows are what has been SOLD, so a room type nobody has booked has no row. That is
                    not a gap to fill: the platform holds no allotment anywhere, so "0 booked" is a
                    fact and "5 free" is a number nobody has.
                  */}
                  {open && !roomsLoading && (roomRows ?? []).length === 0 && (
                    <tr>
                      <td colSpan={h.days.length + 2} className="border-b border-border px-4 py-3 text-xs text-muted">
                        No room type is named on any booking in this window.
                      </td>
                    </tr>
                  )}

                  {open && !roomsLoading && (roomRows ?? []).map((rt) => (
                    <tr key={rt.roomPublicId ?? "unspecified"} className="bg-surface-hover/30">
                      <td className="sticky left-0 z-10 max-w-[15rem] border-b border-border bg-surface-hover/60 py-1.5 pl-10 pr-4">
                        <p className="truncate text-xs font-medium text-body">{rt.roomName}</p>
                        <p className="truncate text-[11px] text-muted">
                          {rt.totalRoomNightsCommitted} room-night{rt.totalRoomNightsCommitted === 1 ? "" : "s"}
                        </p>
                      </td>
                      {rt.days.map((d) => (
                        <td
                          key={d.date}
                          className={[
                            "border-b border-border px-0 py-1 align-bottom",
                            dayMeta(d.date).weekend ? "bg-surface-hover/50" : "",
                            dayMeta(d.date).monthStart ? "border-l border-border-strong" : "",
                          ].join(" ")}
                        >
                          {/* Same peak scale as the parent row, deliberately: bars that renormalised
                              per room type would make a room with one booking look as busy as the
                              property's worst night. */}
                          <OccupancyCell day={d} peak={peak} label={`${h.hotelName} — ${rt.roomName} — ${d.date}`} />
                        </td>
                      ))}
                      <td className="border-b border-l border-border px-3 py-2 text-right text-xs tabular-nums text-body">
                        {rt.totalRoomNightsCommitted}
                      </td>
                    </tr>
                  ))}
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Legend />
    </div>
  );
}

function Stat({ label, value, muted }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${muted ? "text-body" : "text-heading"}`}>
        {value}
      </p>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted">
      <span className="inline-flex items-center gap-2">
        <span className="h-3 w-3 rounded-sm bg-accent" />
        Committed — the platform has promised these rooms to the property
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="h-3 w-3 rounded-sm bg-accent/25" />
        Pending — requests not yet decided
      </span>
      <span className="inline-flex items-center gap-2">
        <Building2 className="h-3.5 w-3.5" />
        Check-out is not charged: a 10→12 stay occupies the 10th and 11th only
      </span>
    </div>
  );
}
