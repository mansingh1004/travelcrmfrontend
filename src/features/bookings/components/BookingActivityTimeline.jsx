import { FiClock } from "react-icons/fi";

export default function BookingActivityTimeline({ events = [], loading, formatMoney, formatDateTime }) {
  if (loading) {
    return <div className="py-10 text-center text-sm font-semibold text-slate-400">Loading activity…</div>;
  }
  if (!events.length) {
    return <div className="py-10 text-center text-sm text-slate-400">No booking activity recorded yet.</div>;
  }

  return (
    <ol className="relative ml-2 border-l border-slate-200">
      {events.map((event, index) => (
        <li key={`${event.type}-${event.occurredAt}-${index}`} className="relative pb-6 pl-6 last:pb-0">
          <span className="absolute -left-3 top-0 flex h-6 w-6 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-600">
            <FiClock className="h-3 w-3" aria-hidden="true" />
          </span>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-extrabold text-slate-800">{event.title || event.type}</p>
              {event.detail && <p className="mt-0.5 text-xs text-slate-500">{event.detail}</p>}
              {event.actor && <p className="mt-1 text-[11px] text-slate-400">By {event.actor}</p>}
            </div>
            <div className="text-right">
              {event.amount != null && <p className="text-xs font-bold text-slate-700">{formatMoney?.(event.amount) ?? event.amount}</p>}
              <time className="text-[11px] text-slate-400">{formatDateTime?.(event.occurredAt) ?? event.occurredAt}</time>
              {event.reference && <p className="text-[10px] text-slate-400">{event.reference}</p>}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
