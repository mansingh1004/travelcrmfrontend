import { useRef } from "react";

export default function BookingTabs({ tabs = [], activeKey, loadingKey, onChange }) {
  const refs = useRef([]);

  const onKeyDown = (event, index) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const offset = event.key === "ArrowRight" ? 1 : -1;
    const next = (index + offset + tabs.length) % tabs.length;
    refs.current[next]?.focus();
    onChange?.(tabs[next].key);
  };

  return (
    <div role="tablist" aria-label="Booking sections"
      className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200/70 bg-white/80 p-1.5 shadow-sm">
      {tabs.map((item, index) => {
        const active = item.key === activeKey;
        return (
          <button key={item.key} id={`tab-${item.key}`} role="tab" type="button"
            ref={(node) => { refs.current[index] = node; }}
            aria-selected={active} aria-controls={`panel-${item.key}`} tabIndex={active ? 0 : -1}
            onClick={() => onChange?.(item.key)} onKeyDown={(event) => onKeyDown(event, index)}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition ${active ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"}`}>
            {loadingKey === item.key
              ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-label="Loading" />
              : item.icon}
            {item.label}
            {item.count > 0 && <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-white/20" : "bg-slate-100"}`}>{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
