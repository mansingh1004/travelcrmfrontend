// src/features/hotels/components/hotelWidgets.jsx
// Composite, presentational widgets specific to the Hotel module.
// All are data-driven (props only) — no hardcoded content.

import { useState } from "react";
import {
  ChevronLeft, ChevronRight, ArrowRight, TrendingUp, TrendingDown,
  Building2, BedDouble, CalendarRange, UserRound, CreditCard, Bell,
} from "lucide-react";
import { cn, GlassCard } from "./hotelUi";

/* ═════════════════════════════════════════════════════════════
   IMAGE GALLERY — large hero + thumbnail strip (Hotel Details)
═════════════════════════════════════════════════════════════ */
export function Gallery({ images = [], alt = "Hotel", className }) {
  const [active, setActive] = useState(0);
  if (!images.length) {
    return <div className={cn("aspect-[16/9] w-full rounded-2xl bg-slate-100", className)} />;
  }
  const go = (d) => setActive((p) => (p + d + images.length) % images.length);
  return (
    <div className={cn("space-y-3", className)}>
      <div className="group relative overflow-hidden rounded-2xl bg-slate-100 shadow-sm">
        <img src={images[active]} alt={`${alt} ${active + 1}`} loading="lazy"
          className="aspect-[16/9] w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        {images.length > 1 && (
          <>
            <button onClick={() => go(-1)} aria-label="Previous"
              className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-slate-700 shadow-md transition-all hover:bg-white">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button onClick={() => go(1)} aria-label="Next"
              className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-slate-700 shadow-md transition-all hover:bg-white">
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-3 right-3 rounded-full bg-slate-900/60 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">
              {active + 1} / {images.length}
            </div>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <button key={i} onClick={() => setActive(i)}
              className={cn("h-16 w-24 shrink-0 overflow-hidden rounded-xl border-2 transition-all",
                i === active ? "border-blue-600 shadow-sm" : "border-transparent opacity-70 hover:opacity-100")}>
              <img src={src} alt={`thumb ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   DONUT — dependency-free SVG (room-status / occupancy splits)
═════════════════════════════════════════════════════════════ */
export function Donut({ segments, size = 150, thickness = 16, center, centerLabel }) {
  const total = segments.reduce((s, x) => s + (x.value || 0), 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const gap = 2;
  let acc = 0;
  const arcs = [];
  if (total > 0) {
    for (const s of segments) {
      if (!s.value || s.value <= 0) continue;
      const len = (s.value / total) * c;
      arcs.push({ key: s.key ?? s.label, color: s.color, dash: Math.max(len - gap, 0.001), offset: acc });
      acc += len;
    }
  }
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={thickness} />
        {arcs.map((a) => (
          <circle key={a.key} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={a.color} strokeWidth={thickness}
            strokeDasharray={`${a.dash} ${c - a.dash}`} strokeDashoffset={-a.offset} strokeLinecap="butt" />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[26px] font-extrabold leading-none text-slate-800">{center}</span>
        {centerLabel && <span className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{centerLabel}</span>}
      </div>
    </div>
  );
}

export function DonutLegend({ segments, className }) {
  const total = segments.reduce((s, x) => s + (x.value || 0), 0);
  return (
    <ul className={cn("flex-1 space-y-2", className)}>
      {segments.map((s) => (
        <li key={s.key ?? s.label} className="flex items-center gap-2 text-sm">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
          <span className="flex-1 font-medium text-slate-600">{s.label}</span>
          <span className="font-extrabold text-slate-800">{s.value ?? 0}</span>
          {total > 0 && <span className="w-10 text-right text-xs font-semibold text-slate-400">{Math.round(((s.value || 0) / total) * 100)}%</span>}
        </li>
      ))}
    </ul>
  );
}

/* ═════════════════════════════════════════════════════════════
   VERTICAL TIMELINE — booking lifecycle / guest journey
═════════════════════════════════════════════════════════════ */
const TONE_DOT = {
  blue: "bg-blue-500", green: "bg-green-500", amber: "bg-amber-500", red: "bg-red-500",
  purple: "bg-purple-500", teal: "bg-teal-500", indigo: "bg-indigo-500", slate: "bg-slate-400",
};
export function Timeline({ steps = [], className }) {
  return (
    <ol className={cn("relative ml-1", className)}>
      {steps.map((s, i) => {
        const done = s.done !== false;
        return (
          <li key={i} className="relative flex gap-4 pb-5 last:pb-0">
            {i < steps.length - 1 && <span className="absolute left-[7px] top-4 h-full w-px bg-slate-200" />}
            <span className={cn("relative z-10 mt-1 h-3.5 w-3.5 shrink-0 rounded-full ring-4 ring-white",
              done ? (TONE_DOT[s.tone] || "bg-blue-500") : "bg-slate-300")} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className={cn("text-sm font-bold", done ? "text-slate-700" : "text-slate-400")}>{s.title}</p>
                {s.time && <span className="shrink-0 text-[11px] font-semibold text-slate-400">{s.time}</span>}
              </div>
              {s.detail && <p className="mt-0.5 text-xs text-slate-400">{s.detail}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ═════════════════════════════════════════════════════════════
   HORIZONTAL FLOW — guest journey / DB relation diagram
═════════════════════════════════════════════════════════════ */
export function FlowChain({ steps = [], icons = false, className }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-bold text-slate-700 shadow-sm">
            {icons && s.icon && <s.icon className="h-4 w-4 text-blue-600" />}
            {s.label ?? s}
          </div>
          {i < steps.length - 1 && <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" />}
        </div>
      ))}
    </div>
  );
}

/* Simple ER-style relation diagram (Hotel → Room → Inventory → Booking → …). */
export function ERDiagram({ className }) {
  const entities = [
    { name: "Hotel", icon: Building2, fields: ["id", "name", "code", "rating"] },
    { name: "Room", icon: BedDouble, fields: ["id", "hotel_id", "type", "price"] },
    { name: "Inventory", icon: CalendarRange, fields: ["room_id", "date", "available"] },
    { name: "Booking", icon: CalendarRange, fields: ["id", "room_id", "guest_id", "status"] },
    { name: "Guest", icon: UserRound, fields: ["id", "name", "phone"] },
    { name: "Payment", icon: CreditCard, fields: ["id", "booking_id", "amount"] },
    { name: "Notification", icon: Bell, fields: ["id", "booking_id", "channel"] },
  ];
  return (
    <div className={cn("flex flex-wrap items-stretch gap-3", className)}>
      {entities.map((e, i) => (
        <div key={e.name} className="flex items-center gap-3">
          <div className="w-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-blue-50/60 px-3 py-2">
              <e.icon className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-extrabold text-slate-700">{e.name}</span>
            </div>
            <ul className="px-3 py-2">
              {e.fields.map((f) => (
                <li key={f} className="py-0.5 text-[11px] font-medium text-slate-500">{f}</li>
              ))}
            </ul>
          </div>
          {i < entities.length - 1 && <ArrowRight className="h-5 w-5 shrink-0 text-slate-300" />}
        </div>
      ))}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   AI INSIGHT CARD
═════════════════════════════════════════════════════════════ */
const TONE_BG = {
  blue: "from-blue-500 to-blue-700", green: "from-green-500 to-emerald-700",
  amber: "from-amber-500 to-orange-600", purple: "from-purple-500 to-violet-700",
  teal: "from-teal-500 to-cyan-700", red: "from-rose-500 to-red-700",
};
export function InsightCard({ title, value, note, tone = "blue", trend }) {
  const Trend = trend === "down" ? TrendingDown : TrendingUp;
  return (
    <GlassCard className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{title}</p>
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br text-white", TONE_BG[tone] || TONE_BG.blue)}>
          <Trend className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-extrabold text-slate-800">{value}</p>
      {note && <p className="mt-0.5 text-xs text-slate-400">{note}</p>}
    </GlassCard>
  );
}

/* Small labelled key/value row for detail cards. */
export function InfoRow({ label, value, className }) {
  return (
    <div className={cn("flex items-start justify-between gap-3 py-2", className)}>
      <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-slate-400">{label}</span>
      <span className="text-right text-sm font-semibold text-slate-700">{value ?? "—"}</span>
    </div>
  );
}
