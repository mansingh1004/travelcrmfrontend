import { useRef } from "react";

/**
 * The app's tab bar.
 *
 * Promoted from `features/bookings/components/BookingTabs.jsx`, which was the only accessible
 * tablist in the tree — roving tabIndex, arrow-key navigation and the full `tab`/`tabpanel` ARIA
 * pairing. Every other tabbed screen hand-rolled a row of plain `<button>`s and got none of it,
 * because the feature-boundary rule forbids importing across features. Living in `@shared/ui`
 * removes that excuse.
 *
 * Contract, unchanged from the original so `BookingDetails` renders byte-identically:
 *   tabs        [{ key, label, icon?, count? }] — `icon` is a rendered ELEMENT, not a component
 *   activeKey   the selected tab's key
 *   loadingKey  key of the tab whose section is still loading; swaps its icon for a spinner
 *   onChange    (key) => void
 *
 * Two props were added for the customer profile, both defaulting to the original appearance:
 *   tone  "slate" (default) | "blue"  — the active pill's fill
 *   size  "sm" (default)    | "md"    — md is the roomier pill the customer profile already used
 *
 * The caller owns the panels and MUST pair them up, or the ARIA here is decorative:
 *   <div id={`panel-${key}`} role="tabpanel" aria-labelledby={`tab-${key}`}>
 */

const TONE = {
  slate: "bg-slate-900 text-white shadow-sm",
  blue: "bg-blue-600 text-white shadow-sm",
};

const SIZE = {
  sm: "gap-1.5 rounded-xl px-3 py-2 text-xs",
  md: "gap-2 rounded-xl px-4 py-2.5 text-sm",
};

export default function Tabs({
  tabs = [],
  activeKey,
  loadingKey,
  onChange,
  tone = "slate",
  size = "sm",
  label = "Sections",
  className = "",
}) {
  const refs = useRef([]);

  // Arrow keys move focus AND selection, which is the "automatic activation" pattern — correct for
  // tabs whose panels are cheap to show. Home/End jump to the ends of the list.
  const onKeyDown = (event, index) => {
    const keys = { ArrowLeft: -1, ArrowRight: 1 };
    let next;

    if (event.key in keys) next = (index + keys[event.key] + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;

    event.preventDefault();
    refs.current[next]?.focus();
    onChange?.(tabs[next].key);
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={`flex gap-1 overflow-x-auto rounded-2xl border border-slate-200/70 bg-white/80 p-1.5 shadow-sm ${className}`}
    >
      {tabs.map((item, index) => {
        const active = item.key === activeKey;
        const busy = loadingKey === item.key;

        return (
          <button
            key={item.key}
            id={`tab-${item.key}`}
            role="tab"
            type="button"
            ref={(node) => { refs.current[index] = node; }}
            aria-selected={active}
            aria-controls={`panel-${item.key}`}
            aria-busy={busy || undefined}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange?.(item.key)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`flex shrink-0 items-center font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
              SIZE[size] || SIZE.sm
            } ${active ? (TONE[tone] || TONE.slate) : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"}`}
          >
            {busy
              ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-label="Loading" />
              : item.icon}
            {item.label}
            {item.count > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-white/20" : "bg-slate-100"}`}>
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
