import {
  BedDouble,
  CalendarCheck2,
  CalendarX2,
  ClipboardClock,
  DoorOpen,
  Hotel,
  TicketCheck,
  Users,
} from "lucide-react";

const CARDS = [
  { key: "totalBookings", label: "Total bookings", Icon: Hotel, tone: "blue", filter: "ALL" },
  { key: "totalGuests", label: "Total guests", Icon: Users, tone: "indigo" },
  { key: "totalRooms", label: "Total rooms", Icon: BedDouble, tone: "violet" },
  { key: "todayCheckIns", label: "Today check-ins", Icon: CalendarCheck2, tone: "green" },
  { key: "todayCheckOuts", label: "Today check-outs", Icon: CalendarX2, tone: "cyan" },
  { key: "pendingConfirmations", label: "Pending confirmations", Icon: ClipboardClock, tone: "amber" },
  { key: "voucherPending", label: "Voucher pending", Icon: TicketCheck, tone: "orange" },
  { key: "inHouseGuests", label: "In-house guests", Icon: DoorOpen, tone: "emerald" },
];

const TONES = {
  blue: "bg-blue-50 text-blue-700 ring-blue-100",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  violet: "bg-violet-50 text-violet-700 ring-violet-100",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  cyan: "bg-cyan-50 text-cyan-700 ring-cyan-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  orange: "bg-orange-50 text-orange-700 ring-orange-100",
  emerald: "bg-teal-50 text-teal-700 ring-teal-100",
};

export default function HotelOperationMetrics({ summary, loading, onFilter }) {
  return (
    <section aria-label="Hotel operations summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4 2xl:grid-cols-8">
      {CARDS.map(({ key, label, Icon, tone, filter }) => {
        const value = summary?.[key];
        const available = value !== null && value !== undefined;
        const interactive = available && Boolean(filter) && Boolean(onFilter);
        const Element = interactive ? "button" : "article";

        return (
          <Element
            key={key}
            type={interactive ? "button" : undefined}
            onClick={interactive ? () => onFilter(filter) : undefined}
            title={available ? label : "Backend aggregate API required later"}
            className={`min-w-0 rounded-2xl border border-slate-200/70 bg-white p-3.5 text-left shadow-sm transition sm:p-4 ${
              interactive ? "hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1 ${TONES[tone]}`}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              {loading ? (
                <span className="mt-1 h-7 w-10 animate-pulse rounded-lg bg-slate-100" />
              ) : (
                <strong className={`text-2xl font-extrabold tabular-nums ${available ? "text-slate-900" : "text-slate-300"}`}>
                  {available ? value.toLocaleString() : "—"}
                </strong>
              )}
            </div>
            <p className="mt-3 truncate text-xs font-bold text-slate-600 sm:text-[13px]">{label}</p>
            {!loading && !available && (
              <p className="mt-1 truncate text-[10px] font-medium text-slate-400">Aggregate API pending</p>
            )}
          </Element>
        );
      })}
    </section>
  );
}
