// src/console/pages/hotelmarketplace360/CalendarCell.jsx
//
// One night in THIS property's calendar. A feature-local variant of
// `console/components/OccupancyCell`, deliberately forked rather than parameterised: the all-hotels
// roll-up on /console/hotel-occupancy keeps the shared cell exactly as it is, and a prop-per-caller
// on a component two screens draw differently is how a shared component becomes nobody's.
//
// THREE RULES CARRIED OVER FROM THE SHARED CELL, none of them cosmetic:
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
//   3. NO FUEL GAUGE. A single hue at increasing strength, never green→amber→red. The platform holds
//      no allotment anywhere, so it cannot say how FULL anything is — only how much it has sold. The
//      mocked InventoryCalendar this lineage replaces used exactly that ramp, with "Sold out" in red,
//      on invented data.
//
// WHAT THIS VARIANT CHANGES, and why each one is a correctness fix rather than a repaint:
//
//   • EMERALD, NOT THE ACCENT. Violet is this console's interaction colour — selection, focus, today.
//     A fill that never means "you can act here" must not wear it, or the one colour that signals
//     "click" stops signalling anything.
//
//   • MIXED INTO THE SURFACE, NOT INTO TRANSPARENCY. The shared cell mixes with `transparent`, so the
//     tint composites over whatever the <td> paints behind it — and this grid shades weekends. The
//     same four rooms therefore rendered DARKER on a Saturday than on a Tuesday, which silently makes
//     the encoding lie. Mixing into an opaque surface makes a level mean one thing everywhere.
//
//   • FIVE DISCRETE STEPS, NOT CONTINUOUS OPACITY. The old ramp topped out at 30% of the accent, so
//     the busiest night in the window was barely tinted and the whole scale lived inside a range the
//     eye cannot resolve. Discrete steps are decodable, and they are what the legend can name.

/** Emerald mixed into the surface, weakest to strongest. Five steps, because a reader can hold five
    levels against a legend and cannot hold a continuum. */
const LEVELS = [12, 24, 38, 54, 70];

/** Step index for a night, given the busiest night on screen. Never below the first step — one
    committed room in an otherwise busy window has to stay visible rather than fade to a hint. */
export function levelFor(count, peak) {
  if (!count || count <= 0) return -1;
  if (!peak || peak <= 0) return 0;
  const ratio = count / peak;
  return Math.min(LEVELS.length - 1, Math.max(0, Math.ceil(ratio * LEVELS.length) - 1));
}

/** The fill for a step. Exported so the legend paints from the same source as the grid. */
export function fillFor(level) {
  if (level < 0) return undefined;
  return `color-mix(in srgb, var(--sa-hue-emerald) ${LEVELS[level]}%, var(--sa-surface))`;
}

/** The fill AND its edge, for callers that draw a swatch rather than a cell. */
export function swatchFor(level) {
  return { backgroundColor: fillFor(level), border: `1px solid ${edgeFor(level)}` };
}

/**
 * The edge for a step — the same hue, two steps stronger than its own fill.
 *
 * A muted fill alone leaves the palest steps floating: at 12% emerald on white the cell has no
 * boundary, so a one-room night and an empty night differ only by the digit. The edge comes from the
 * SAME family so one colour keeps carrying one meaning — a grey border here would read as table
 * chrome and stop separating a sold night from an unsold one.
 */
function edgeFor(level) {
  if (level < 0) return undefined;
  const step = LEVELS[Math.min(LEVELS.length - 1, level + 2)];
  return `color-mix(in srgb, var(--sa-hue-emerald) ${step}%, var(--sa-surface))`;
}

/**
 * Text that stays legible on its own fill in BOTH themes.
 *
 * On the strong steps the answer is `--sa-surface`, not white: the hue token flips to a LIGHT tint in
 * dark mode, so white-on-hue would go unreadable there while surface-on-hue holds in both.
 */
function inkFor(level) {
  return level >= 3 ? "var(--sa-surface)" : "var(--sa-hue-emerald)";
}

export const CELL_LEVELS = LEVELS;

/**
 * @param {object} props
 * @param {object} props.day    one night — `{ date, roomsCommitted, roomsPending, guestsCommitted }`
 * @param {number} props.peak   busiest committed night in the WHOLE grid, so rows stay comparable
 * @param {string} props.label  what this cell is a night of — "Deluxe — 2026-09-14"
 * @param {boolean} [props.strong] a totals row: same rules, heavier weight
 * @param {Function} [props.onOpen] given ONLY when this night has bookings the caller can actually
 *        show. Its presence is what turns the cell into a button — a cell with a count but no
 *        matching booking row stays inert, because a control that opens an empty dialog is worse
 *        than one that plainly does nothing.
 */
export default function CalendarCell({ day, peak, label, strong, onOpen }) {
  const c = day?.roomsCommitted ?? 0;
  const p = day?.roomsPending ?? 0;

  const title = [
    label,
    `${c} room${c === 1 ? "" : "s"} sold`,
    p > 0 ? `${p} pending` : null,
    day?.guestsCommitted > 0 ? `${day.guestsCommitted} guests` : null,
  ].filter(Boolean).join("\n");

  if (c === 0 && p === 0) {
    // Blank, not a 0. A grid of zeros reads as a failed fetch, and the eye has to discard every one
    // of them to find the nights that actually matter.
    //
    // A plain div: nothing here opens anything, so nothing here may look as though it would.
    return (
      <div className="flex h-10 w-full items-center justify-center text-[11px] text-muted/40" title={title}>
        ·
        <span className="sr-only">{title}</span>
      </div>
    );
  }

  const level = levelFor(c, peak);

  const face = (
    <span
      className={[
        "relative flex h-full w-full items-center justify-center rounded-[3px] text-xs tabular-nums",
        strong ? "font-extrabold" : "font-semibold",
      ].join(" ")}
      style={c > 0
        ? { backgroundColor: fillFor(level), border: `1px solid ${edgeFor(level)}`, color: inkFor(level) }
        : undefined}
    >
      {c > 0 ? c : ""}

      {/* Pending gets its own CHANNEL, not a second number beside the first. A "4 +2" reads as six
          to a tired operator, and six is a figure nobody has agreed to. A corner notch cannot be
          added up with anything. */}
      {p > 0 && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-0 h-0 w-0 rounded-tr-[3px] border-l-[7px] border-t-[7px] border-l-transparent"
          style={{ borderTopColor: "var(--sa-hue-amber)" }}
        />
      )}
    </span>
  );

  // Inert unless the caller has something to open. No pointer, no focus stop, no hover — the empty
  // and the unopenable read the same as the grid's own background, which is what they are.
  if (!onOpen) {
    return (
      <div className="flex h-10 w-full items-center justify-center px-[3px]" title={title}>
        {face}
        <span className="sr-only">{title}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      title={title}
      // The accessible name carries the date, so the cell is identifiable out of the grid's visual
      // context — a screen reader user never sees the column it sits under.
      aria-label={title.replace(/\n/g, ". ")}
      aria-haspopup="dialog"
      className="flex h-10 w-full items-center justify-center px-[3px] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
    >
      {face}
    </button>
  );
}
