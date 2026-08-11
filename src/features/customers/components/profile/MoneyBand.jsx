import { ArrowDownLeft, ArrowUpRight, CalendarClock, Plane } from "lucide-react";

import {
  MONEY_TONE, daysUntil, fmtDate, money, outstandingTone,
} from "./profileUi";

/**
 * The money the operator needs at the counter, in one row.
 *
 * Replaces four large gradient tiles which, below 1280px, wrapped to a 2×2 block 240px tall — the
 * exact width most people run. Six facts now occupy roughly a third of that, and none of them is
 * abbreviated.
 *
 * ── Two decisions worth defending ────────────────────────────────────────────────────────────
 *
 * EXACT FIGURES, NOT ₹4.2L. The tiles rendered a compact form and hid the real number in a `title`
 * attribute — unreachable by keyboard, unreadable by a screen reader, and useless to the person
 * reading a balance down a phone. Compact form is kept only for the widest values on the narrowest
 * screens, where it is the difference between wrapping and not.
 *
 * DIRECTION IS A SIGN, NOT A COLOUR. Collected carries `+` and an inbound arrow; refunds carry `−`
 * and an outbound one. Colour only reinforces. Tone follows STATUS — settled / awaiting / overdue /
 * plain fact — so Billed is slate however large it is, and Outstanding turns rose only once the
 * travel date has actually passed.
 *
 * ── What the labels mean ─────────────────────────────────────────────────────────────────────
 *   Billed       SUM(totalPayable) over live bookings — tax-inclusive contract value.
 *   Collected    SUM(paidAmount) over live bookings — gross of refunds.
 *   Outstanding  billed − collected, live bookings only.
 *   Refunded     every booking regardless of status, shown BESIDE collected, never netted into it,
 *                because the refund ledger never touches paidAmount.
 * Cancelled bookings are counted out loud rather than silently dropped — the Bookings tab lists
 * them, and two screens disagreeing is what made the old figures look wrong.
 */
export function MoneyBand({ summary }) {
  const outstanding = Number(summary.outstanding || 0);
  const refunded = Number(summary.totalRefunded || 0);
  const dueIn = daysUntil(summary.nextDueTravelDate);
  const overdue = outstanding > 0 && dueIn !== null && dueIn < 0;

  const live = Number(summary.activeBookingCount || 0);
  const cancelled = Number(summary.cancelledBookingCount || 0);

  return (
    <section
      aria-label="Financial summary"
      className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm sm:grid-cols-3 lg:grid-cols-6"
    >
      <Cell
        label="Billed"
        value={money(summary.totalBilled)}
        tone={MONEY_TONE.fact}
        helper={live === 1 ? "1 live booking" : `${live} live bookings`}
      />

      <Cell
        label="Collected"
        value={`+${money(summary.totalCollected)}`}
        tone={MONEY_TONE.settled}
        icon={ArrowDownLeft}
        helper="Received"
      />

      <Cell
        label="Outstanding"
        value={money(outstanding)}
        tone={MONEY_TONE[outstandingTone(outstanding, dueIn)]}
        icon={overdue ? CalendarClock : undefined}
        helper={
          outstanding <= 0
            ? "Nothing due"
            : summary.nextDueTravelDate
              // Named honestly: no instalment due-date column exists anywhere in the schema, so
              // this is "the balance is due by the time they travel", not "a payment is due".
              ? `${overdue ? "Overdue — travel was" : "Due by travel"} ${fmtDate(summary.nextDueTravelDate)}`
              : "No travel date set"
        }
      />

      <Cell
        label="Refunded"
        value={refunded > 0 ? `−${money(refunded)}` : money(0)}
        tone={refunded > 0 ? MONEY_TONE.outflow : MONEY_TONE.muted}
        icon={refunded > 0 ? ArrowUpRight : undefined}
        helper={refunded > 0 ? "Not netted off collected" : "None issued"}
      />

      <Cell
        label="Bookings"
        value={String(live)}
        tone={MONEY_TONE.fact}
        helper={cancelled > 0 ? `${cancelled} cancelled` : "None cancelled"}
      />

      <Cell
        label="Last booking"
        value={fmtDate(summary.lastBookingDate, "Never")}
        tone={summary.lastBookingDate ? MONEY_TONE.fact : MONEY_TONE.muted}
        icon={summary.lastBookingDate ? Plane : undefined}
        helper="Most recent"
      />
    </section>
  );
}

function Cell({ label, value, helper, tone, icon: Icon }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-0.5 flex items-center gap-1 text-base font-extrabold tabular-nums xl:text-lg ${tone}`}>
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />}
        <span className="truncate" title={value}>{value}</span>
      </p>
      <p className="truncate text-[11px] text-slate-500" title={helper}>{helper}</p>
    </div>
  );
}

export default MoneyBand;
