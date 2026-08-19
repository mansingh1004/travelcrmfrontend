// src/console/pages/hotelmarketplace360/TabCalendar.jsx
//
// This property's stay calendar, broken down by room type — room types down, nights across.
//
// WHY IT IS SCOPED TO ONE HOTEL. The all-hotels roll-up on /console/hotel-occupancy answers "which
// properties am I exposed at". That is a different question from "at THIS property, in what", and
// the server only computes the room-type breakdown for a single-hotel request precisely because ten
// hotels × their room types × 92 nights is a payload nobody reads.
//
// WHAT IT IS NOT: inventory. The platform holds no allotment anywhere, so it cannot say how many
// rooms are FREE — only how many it has SOLD. That is why there is no percentage, no "sold out", and
// no green-amber-red ramp: a fuel gauge implies a tank, and there is no tank. The deleted mock
// InventoryCalendar this replaces did exactly that, on made-up data, and it was wrong every day it
// shipped.
//
// COMMITTED vs PENDING are never summed. Committed is what the platform has promised a supplier;
// pending is a request nobody has decided. Adding them tells an operator they owe rooms they have
// not agreed to.

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarRange, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { marketplaceOccupancyService as svc } from "../../api/marketplaceOccupancyService";
import { Button, GlassCard } from "../../components/hotelUi";
import OccupancyCell from "../../components/OccupancyCell";
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
 * The column chrome for one night, shared by the room rows and the totals row.
 *
 * Weekend shading and the month-start divider live HERE rather than inside `OccupancyCell`, because
 * they belong to this table's axis — the all-hotels grid draws the same night with its own column
 * rules, and pushing them into the shared cell would mean a prop per caller's table.
 */
function dayCell(isoDate) {
  const dt = new Date(`${isoDate}T00:00:00Z`);
  const weekend = dt.getUTCDay() === 0 || dt.getUTCDay() === 6;
  return [
    "border-b border-border px-0 py-1 text-center",
    weekend ? "bg-surface-hover/50" : "",
    dt.getUTCDate() === 1 ? "border-l border-border-strong" : "",
  ].join(" ");
}

export default function TabCalendar({ hotel, publicId }) {
  const { showToast } = useToast();
  const [from, setFrom] = useState(todayIso);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const to = useMemo(() => addDays(from, SPAN - 1), [from]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await svc.list({ from, to, hotelPublicId: publicId });
      setData(rows?.[0] ?? null);
    } catch (e) {
      if (!isAlreadyReported(e)) showToast(getErrorMessage(e, "Could not load the calendar."), "error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [from, to, publicId, showToast]);

  useEffect(() => { load(); }, [load]);

  const days = data?.days ?? [];
  const roomTypes = data?.roomTypes ?? [];

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
      <GlassCard className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="inline-flex items-center gap-2 text-sm font-extrabold text-heading">
              <CalendarRange className="h-4 w-4" aria-hidden="true" />
              Rooms sold, by night
            </h2>
            <p className="mt-0.5 text-xs text-muted">
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

        {loading ? (
          <div className="flex items-center gap-2 py-12 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading…
          </div>
        ) : roomTypes.length === 0 ? (
          /*
            A window with nothing in it is a real answer, and a common one — most of this catalog's
            stays sit months out. Saying so beats a grid of dashes that reads as a failed fetch.
          */
          <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
            <p className="text-sm font-semibold text-heading">Nothing booked in this window</p>
            <p className="mt-1 text-xs text-muted">
              {hotel?.name ? `${hotel.name} has ` : "This property has "}
              no stays between {from} and {to}. Try moving the window forward.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 border-b border-border bg-surface px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                    Room type
                  </th>
                  {days.map((d) => {
                    const dt = new Date(`${d.date}T00:00:00Z`);
                    const weekend = dt.getUTCDay() === 0 || dt.getUTCDay() === 6;
                    return (
                      <th
                        key={d.date}
                        className={[
                          "border-b border-border px-0 py-1 text-center text-[10px] font-medium text-muted",
                          weekend ? "bg-surface-hover/50" : "",
                          dt.getUTCDate() === 1 ? "border-l border-border-strong" : "",
                        ].join(" ")}
                      >
                        <span className="block leading-none">{WEEKDAY[dt.getUTCDay()]}</span>
                        <span className="block leading-tight text-body">{dt.getUTCDate()}</span>
                      </th>
                    );
                  })}
                  <th className="border-b border-l border-border px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted">
                    Nights
                  </th>
                </tr>
              </thead>
              <tbody>
                {roomTypes.map((rt) => (
                  <tr key={rt.roomPublicId ?? "unspecified"} className="hover:bg-surface-hover">
                    <td className="sticky left-0 z-10 max-w-[14rem] border-b border-border bg-surface px-3 py-2">
                      <p className="truncate text-sm font-semibold text-heading">{rt.roomName}</p>
                    </td>
                    {rt.days.map((d) => (
                      <td key={d.date} className={dayCell(d.date)}>
                        <OccupancyCell day={d} peak={peak} label={`${rt.roomName} — ${d.date}`} />
                      </td>
                    ))}
                    <td className="border-b border-l border-border px-3 py-2 text-right text-sm font-semibold tabular-nums text-heading">
                      {rt.totalRoomNightsCommitted}
                    </td>
                  </tr>
                ))}

                {/* The property total, kept visually apart from the rows that compose it. */}
                <tr className="bg-surface-hover/40">
                  <td className="sticky left-0 z-10 border-b border-t border-border bg-surface-hover/70 px-3 py-2">
                    <p className="text-sm font-extrabold text-heading">All room types</p>
                  </td>
                  {days.map((d) => (
                    <td key={d.date} className={`${dayCell(d.date)} border-t`}>
                      <OccupancyCell day={d} peak={peak} label={`All rooms — ${d.date}`} strong />
                    </td>
                  ))}
                  <td className="border-b border-l border-t border-border px-3 py-2 text-right text-sm font-extrabold tabular-nums text-heading">
                    {data?.totalRoomNightsCommitted ?? 0}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
