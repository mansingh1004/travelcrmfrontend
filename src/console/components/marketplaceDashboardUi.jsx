// src/console/components/marketplaceDashboardUi.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The pieces a marketplace dashboard is made of, shared by the transport and
// package ones.
//
// HotelMarketplaceDashboard keeps its own copies deliberately. It works, it is in
// front of operators today, and refactoring a live screen to save two small
// components is a risk taken for tidiness rather than for anyone's benefit. If it
// is ever touched for another reason, fold it onto these then.
//
// Console SEMANTIC tokens only (bg-surface / text-heading / hue-*), never raw
// slate or blue — those utilities resolve only inside `.sa-console`.
// ─────────────────────────────────────────────────────────────────────────────

import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

/** Money for a console reader: no decimals, Indian grouping, symbol only for INR. */
export const money = (value, currency = "INR") =>
  `${currency === "INR" ? "₹" : `${currency} `}${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

/** A paged response's true total, falling back to what is on this page. */
export const count = (pagination, fallback = 0) =>
  Number(pagination?.totalElements ?? fallback ?? 0);

const TONES = {
  violet: "bg-hue-violet-soft text-hue-violet",
  emerald: "bg-hue-emerald-soft text-hue-emerald",
  amber: "bg-hue-amber-soft text-hue-amber",
  sky: "bg-hue-sky-soft text-hue-sky",
  rose: "bg-hue-rose-soft text-hue-rose",
  /* orange is NOT a shade of amber here. The token layer reserves amber for TRIAL/pending and
     orange for PAST_DUE/overdue/escalated — an overdue invoice tile that used amber would read as
     the same severity as a trial account. */
  orange: "bg-hue-orange-soft text-hue-orange",
  indigo: "bg-hue-indigo-soft text-hue-indigo",
  teal: "bg-hue-teal-soft text-hue-teal",
};

/** One number and what it means. `danger` colours the figure, not the whole tile. */
export function Metric({ label, value, helper, Icon, tone = "violet", danger = false }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--sa-card-shadow)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted">{label}</div>
          <div className={`mt-2 truncate font-mono text-2xl font-bold tracking-tight ${danger ? "text-hue-rose" : "text-heading"}`}>
            {value}
          </div>
        </div>
        {Icon && (
          <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${TONES[tone]}`}>
            <Icon size={17} />
          </span>
        )}
      </div>
      {helper && <div className="mt-2 text-xs text-body">{helper}</div>}
    </div>
  );
}

/**
 * A queue with somewhere to go.
 *
 * <p>The count is the point, so it is what the eye lands on — and when it is zero the row says
 * "No action waiting" rather than repeating the helper, because a helper describing work that is
 * not there reads as work that is.</p>
 */
export function ActionLink({ to, label, helper, value, Icon, urgent = false }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 border-b border-border px-5 py-3.5 last:border-b-0 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
    >
      <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${urgent && value > 0 ? "bg-hue-amber-soft text-hue-amber" : "bg-surface-hover text-muted"}`}>
        <Icon size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-heading">{label}</span>
        <span className="block truncate text-xs text-muted">{value > 0 ? helper : "No action waiting"}</span>
      </span>
      <span className={`font-mono text-lg font-bold ${value > 0 ? "text-heading" : "text-muted"}`}>{value}</span>
      <ArrowRight size={15} className="text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
    </Link>
  );
}

export function SmallLink({ to, children }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
      {children} <ArrowRight size={13} />
    </Link>
  );
}

/**
 * Shown when part of the load failed.
 *
 * <p>A dashboard composes half a dozen independent calls, and one of them failing must not blank
 * the other five — but it must not be silent either, because a zero that is really "we could not
 * ask" is the most misleading number a dashboard can show.</p>
 */
export function DegradedNote() {
  return (
    <p className="rounded-xl border border-border bg-hue-amber-soft px-4 py-2.5 text-xs font-medium text-hue-amber">
      Some figures could not be loaded and are showing as zero. Refresh to try again.
    </p>
  );
}
