// src/console/components/OccupancyCell.jsx
//
// One night in an occupancy grid — the counts for a single date, in a single scope.
//
// WHY THIS IS SHARED. Two screens draw the same night: the all-hotels roll-up
// (/console/hotel-occupancy, hotels × nights) and the per-property breakdown (Hotel Marketplace 360
// → Calendar, room types × nights). They had grown identical copies of the tint ramp, the
// committed/pending rule and the blank-vs-zero decision. Those are not styling — they are three
// judgements this platform has made about what a number on this screen means, and two copies is two
// places for them to drift.
//
// IT RENDERS THE CELL CONTENT, NOT THE `<td>`. Each grid owns its own column chrome — weekend
// shading, the month-start divider, whether the row is a totals row — and pushing that in here would
// mean a prop per caller's table. The callers keep their table; this owns the number.
//
// THREE RULES IT ENCODES, none of them cosmetic:
//
//   1. THE NUMBER IS THE CONTENT. This was a bar whose height encoded the count, which meant the one
//      thing an operator opens the screen for — "how many on the 14th" — had to be estimated against
//      a legend. A bar is right for a trend; an occupancy grid is a lookup table, and the figure is
//      what goes into the phone call to the hotel.
//
//   2. COMMITTED AND PENDING ARE NEVER SUMMED. Committed is what the platform has promised a
//      supplier; pending is a request nobody has decided. One number combining them tells an operator
//      they owe rooms they have not agreed to.
//
//   3. NO FUEL GAUGE. A single hue at increasing opacity, never green→amber→red. The platform holds
//      no allotment anywhere, so it cannot say how FULL anything is — only how much it has sold. The
//      mocked InventoryCalendar this lineage replaces used exactly that ramp, with "Sold out" in red,
//      on invented data.

/**
 * @param {object} props
 * @param {object} props.day    one `OccupancyDayDto` — `{ date, roomsCommitted, roomsPending, guestsCommitted }`
 * @param {number} props.peak   busiest committed night in the WHOLE grid, so rows stay comparable
 * @param {string} props.label  what this cell is a night of — "Manali Pine Resort — 2026-09-14"
 * @param {boolean} [props.strong] a totals row: same rules, heavier weight
 */
export default function OccupancyCell({ day, peak, label, strong }) {
  const c = day?.roomsCommitted ?? 0;
  const p = day?.roomsPending ?? 0;

  const title = [
    label,
    `${c} room${c === 1 ? "" : "s"} committed`,
    p > 0 ? `${p} pending` : null,
    day?.guestsCommitted > 0 ? `${day.guestsCommitted} guests` : null,
  ].filter(Boolean).join("\n");

  if (c === 0 && p === 0) {
    // Blank, not a 0. A grid of zeros reads as a failed fetch, and the eye has to discard every one
    // of them to find the nights that actually matter.
    return (
      <div className="flex h-7 w-full items-center justify-center text-[11px] text-muted/40" title={title}>
        ·
        <span className="sr-only">{title}</span>
      </div>
    );
  }

  // Floored, so one committed room in an otherwise busy window is still visible rather than a hint.
  const weight = peak > 0 ? Math.max(0.14, c / peak) : 0;

  return (
    <div className="flex h-7 w-full items-center justify-center px-[3px]" title={title}>
      <span
        className={[
          "flex h-full w-full items-center justify-center rounded-sm text-xs tabular-nums text-heading",
          strong ? "font-extrabold" : "font-semibold",
        ].join(" ")}
        style={c > 0
          ? { backgroundColor: `color-mix(in srgb, var(--sa-accent) ${Math.round(weight * 30)}%, transparent)` }
          : undefined}
      >
        {c > 0 ? c : ""}
        {p > 0 && <span className="ml-0.5 text-[10px] font-medium text-muted">+{p}</span>}
      </span>
      <span className="sr-only">{title}</span>
    </div>
  );
}
