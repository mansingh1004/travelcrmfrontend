import { FiAlertCircle, FiArrowRight } from "react-icons/fi";

const TONES = {
  rose: "border-rose-200 bg-rose-50 text-rose-800",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  blue: "border-blue-200 bg-blue-50 text-blue-800",
  slate: "border-slate-200 bg-slate-50 text-slate-700",
};

export default function BookingAttentionBar({ alerts = [], onOpen }) {
  if (!alerts.length) return null;

  return (
    <section aria-label="Booking attention items" className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500">
        <FiAlertCircle aria-hidden="true" /> Needs attention
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {alerts.map((alert, index) => (
          <button key={`${alert.title}-${index}`} type="button" onClick={() => onOpen?.(alert)}
            className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${TONES[alert.tone] || TONES.slate}`}>
            <span className="text-xs font-bold leading-relaxed">{alert.title}</span>
            <span className="flex shrink-0 items-center gap-1 text-[11px] font-extrabold">
              {alert.action}<FiArrowRight aria-hidden="true" />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
