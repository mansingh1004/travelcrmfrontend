// src/console/components/RangePicker.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Today · This week · This month · Custom — the one range control, shared by
// every console dashboard.
//
// ── What a range can and cannot scope ───────────────────────────────────────
// It scopes FLOW: cash collected, bookings raised, orders placed, signups. It
// does NOT scope STOCK: how many requests are queued right now, how much is
// outstanding, how many hotels are published. A pending queue is a present-tense
// fact — "3 requests waiting, today" is either the same 3 or a different and much
// less useful question ("requests raised today"), and nobody reading a dashboard
// distinguishes the two on sight.
//
// So the picker drives the flow figures and the stock tiles carry <NowTag/>. The
// alternative — one picker silently applying to half a screen — is the failure
// this component exists to avoid.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from "react";
import { CalendarRange, ChevronDown } from "lucide-react";

/** Local-date ISO. `toISOString()` is UTC and rolls a late-evening IST date back a day. */
const iso = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * The presets, resolved against a given "today".
 *
 * The week starts MONDAY. `getDay()` is 0 for Sunday, so the shift is `(day + 6) % 7` — with a plain
 * `getDay()` the whole of Sunday would report as its own week and Monday's numbers would vanish.
 */
export function resolveRange(key, custom, today = new Date()) {
  const end = iso(today);
  switch (key) {
    case "today":
      return { from: end, to: end };
    case "week": {
      const start = new Date(today);
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      return { from: iso(start), to: end };
    }
    case "month": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: iso(start), to: end };
    }
    case "custom":
      return { from: custom?.from || "", to: custom?.to || "" };
    default:
      return { from: "", to: "" };
  }
}

export const RANGE_PRESETS = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "custom", label: "Custom" },
];

/**
 * The control itself.
 *
 * @param {string} value      one of the preset keys
 * @param {{from?: string, to?: string}} custom  the two dates, only read when value is "custom"
 * @param {(key: string, custom?: object) => void} onChange
 */
export default function RangePicker({ value = "month", custom, onChange }) {
  const resolved = useMemo(() => resolveRange(value, custom), [value, custom]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* A native select, not a segmented strip: four options is already wider than the header has
          room for beside the page actions, and a fifth would not fit at all. Native also gets
          keyboard and touch behaviour right for free, which a hand-rolled menu has to re-earn. */}
      <label className="relative inline-flex items-center">
        <CalendarRange size={14} className="pointer-events-none absolute left-2.5 text-muted" />
        <span className="sr-only">Period</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value, custom)}
          className="h-9 appearance-none rounded-lg border border-border bg-surface py-0 pl-8 pr-8 text-xs font-semibold text-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {RANGE_PRESETS.map((preset) => (
            <option key={preset.key} value={preset.key}>{preset.label}</option>
          ))}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-2.5 text-muted" />
      </label>

      {value === "custom" && (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={resolved.from}
            max={resolved.to || undefined}
            onChange={(e) => onChange("custom", { ...custom, from: e.target.value })}
            className="h-9 rounded-lg border border-border bg-surface px-2 text-xs text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="From date"
          />
          <span className="text-xs text-muted">to</span>
          <input
            type="date"
            value={resolved.to}
            min={resolved.from || undefined}
            onChange={(e) => onChange("custom", { ...custom, to: e.target.value })}
            className="h-9 rounded-lg border border-border bg-surface px-2 text-xs text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="To date"
          />
        </div>
      )}
    </div>
  );
}

/**
 * Marks a figure the range does NOT apply to.
 *
 * Small on purpose — it is a footnote, not a warning. But it has to be there: without it the only
 * honest options are to hide every present-tense number whenever a range is selected, or to let the
 * reader assume a filter applied that did not.
 */
export function NowTag() {
  return (
    <span className="ml-1.5 rounded bg-surface-hover px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
      now
    </span>
  );
}
