// src/console/components/AttentionStrip.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Exception chips, not stat cards.
//
// The difference is the whole point. "8 tenants" is decoration — there is nothing
// to do with it. "2 tenants haven't logged in for 7 days" ends in picking up the
// phone, and that is what makes it a dashboard.
//
// Zero-count chips are never rendered. A strip of grey zeroes is something a
// reader learns to skip, and once they skip it they skip the day it is not zero.
// When nothing is wrong the whole strip collapses to one green line and the
// operator closes the laptop — a good platform dashboard is usually boring.
// ─────────────────────────────────────────────────────────────────────────────

import { CheckCircle2 } from "lucide-react";

const TONES = {
  rose: "border-hue-rose/30 bg-hue-rose-soft text-hue-rose",
  orange: "border-hue-orange/30 bg-hue-orange-soft text-hue-orange",
  amber: "border-hue-amber/30 bg-hue-amber-soft text-hue-amber",
  sky: "border-hue-sky/30 bg-hue-sky-soft text-hue-sky",
};

/**
 * @param {Array<{code,label,count,tone}>} chips  already filtered to non-zero by the server
 * @param {string|null} active   the code currently filtering the list below
 * @param {(code: string|null) => void} onSelect  toggles the filter; same chip again clears it
 * @param {boolean} unavailable  the feed failed — distinct from "nothing is wrong"
 */
export default function AttentionStrip({ chips = [], active, onSelect, unavailable = false }) {
  if (unavailable) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-muted">
        Tenant health could not be loaded, so nothing here is claiming to be fine. Refresh to retry.
      </div>
    );
  }

  if (chips.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-hue-emerald/30 bg-hue-emerald-soft px-4 py-2.5">
        <CheckCircle2 size={16} className="text-hue-emerald" />
        <span className="text-sm font-semibold text-hue-emerald">
          No tenant needs attention right now.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => {
        const on = active === chip.code;
        return (
          <button
            key={chip.code}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(on ? null : chip.code)}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              TONES[chip.tone] || TONES.amber
            } ${on ? "ring-2 ring-accent ring-offset-1" : "hover:shadow-sm"}`}
          >
            <span className="font-mono text-sm font-bold">{chip.count}</span>
            {chip.label}
          </button>
        );
      })}
      {active && (
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="text-xs font-semibold text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Clear filter
        </button>
      )}
    </div>
  );
}
