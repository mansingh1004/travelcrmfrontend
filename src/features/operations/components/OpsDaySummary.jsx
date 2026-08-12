// features/operations/components/OpsDaySummary.jsx
// ─────────────────────────────────────────────────────────────────────────────
// One card per departure day, above the board.
//
// The board answers "which booking needs attention". This answers what comes first
// in the morning: what does the 20th actually take? Five parties out, two hotels
// confirmed and three not, ten vehicles to put on the road. Those are sums a
// per-booking list makes you carry in your head across five rows.
//
// Only days that HAVE departures get a card, so a quiet fortnight shows two cards
// rather than fourteen empty ones.
//
// Room and vehicle totals come from the requirement rows the booking form has been
// writing since V11 and nothing has read until now — a booking created before those
// rows existed reports 0, which is the honest answer rather than a guess.
// ─────────────────────────────────────────────────────────────────────────────
import { Bed, Car, Users, AlertTriangle } from "lucide-react";

import { Panel, DIMENSIONS, READINESS_STYLE } from "./opsUi";

const fmtDay = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  return {
    weekday: d.toLocaleDateString("en-IN", { weekday: "short" }),
    date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
  };
};

const whenLabel = (days) => {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 0) return "in progress";
  return `in ${days} days`;
};

export default function OpsDaySummary({ days = [], onSelectBooking, loading }) {
  if (loading) {
    return (
      <Panel className="p-4">
        <p className="text-xs font-bold text-slate-400">Adding up the days…</p>
      </Panel>
    );
  }

  if (!days.length) return null;

  return (
    <div className="-mx-1 px-1 overflow-x-auto">
      <div className="flex gap-3 min-w-min">
        {days.map((day) => {
          const { weekday, date } = fmtDay(day.date);
          const urgent = day.daysAway >= 0 && day.daysAway <= 2;

          // Only dimensions this day actually has something to say about. A day where
          // nothing needs a visa should not carry an empty Documents line.
          const lines = DIMENSIONS.filter(({ key }) => {
            const t = day.readiness?.[key];
            return t && (t.ready > 0 || t.needsAttention > 0);
          });

          return (
            <Panel
              key={day.date}
              className={`p-4 w-[268px] shrink-0 ${urgent ? "ring-1 ring-rose-200" : ""}`}
            >
              {/* Day + how far away */}
              <div className="flex items-baseline justify-between gap-2 mb-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-slate-800 truncate">
                    {weekday} {date}
                  </p>
                  <p className={`text-[11px] font-bold ${urgent ? "text-rose-600" : "text-slate-400"}`}>
                    {whenLabel(day.daysAway)}
                  </p>
                </div>
                <span className="text-[11px] font-extrabold text-slate-500 tabular-nums shrink-0">
                  {day.bookingCount} {day.bookingCount === 1 ? "booking" : "bookings"}
                </span>
              </div>

              {/* What the day physically takes */}
              <div className="flex items-center gap-3 mb-3 text-[11px] font-bold text-slate-600">
                <span className="inline-flex items-center gap-1" title="Travellers (infants excluded)">
                  <Users size={13} className="text-slate-400" /> {day.travellers}
                </span>
                <span className="inline-flex items-center gap-1" title="Rooms needed">
                  <Bed size={13} className="text-slate-400" /> {day.roomsNeeded}
                </span>
                <span className="inline-flex items-center gap-1" title="Vehicles needed">
                  <Car size={13} className="text-slate-400" /> {day.vehiclesNeeded}
                </span>
              </div>

              {/* Ready vs not, counted in BOOKINGS — "two parties have somewhere to sleep" */}
              <div className="space-y-1 mb-3">
                {lines.length === 0 && (
                  <p className="text-[11px] text-slate-400">Nothing broken into service lines yet.</p>
                )}
                {lines.map(({ key, label, Icon }) => {
                  const t = day.readiness[key];
                  const allDone = t.needsAttention === 0;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <Icon size={12} className="text-slate-400 shrink-0" />
                      <span className="text-[11px] font-bold text-slate-500 flex-1 truncate">{label}</span>
                      <span className="text-[11px] font-extrabold tabular-nums shrink-0">
                        <span className={allDone ? "text-emerald-600" : "text-slate-500"}>{t.ready}</span>
                        <span className="text-slate-300"> / </span>
                        <span className={t.needsAttention > 0 ? "text-rose-600" : "text-slate-300"}>
                          {t.needsAttention}
                        </span>
                      </span>
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          allDone ? READINESS_STYLE.READY.dot : READINESS_STYLE.NOT_STARTED.dot
                        }`}
                      />
                    </div>
                  );
                })}
              </div>

              {/* The day's bookings — click one to open it without hunting the board */}
              <div className="flex flex-wrap gap-1 pt-2.5 border-t border-slate-100">
                {day.bookings?.map((b) => (
                  <button
                    key={b.bookingPublicId}
                    onClick={() => onSelectBooking?.(b.bookingPublicId)}
                    title={b.customerName || b.bookingCode}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold transition-colors ${
                      b.needsAttention
                        ? "bg-rose-50 text-rose-700 hover:bg-rose-100"
                        : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    }`}
                  >
                    {b.needsAttention && <AlertTriangle size={9} />}
                    {b.bookingCode}
                  </button>
                ))}
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
