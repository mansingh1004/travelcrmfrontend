/**
 * Shared components for the customer 360 profile.
 *
 * Feature-local by convention — nothing here is exported through the feature's index.js and no
 * other feature may import it. It continues the visual language CustomerDetails already used
 * (white cards, border-slate-200, shadow-sm, rounded-2xl) rather than introducing a new accent:
 * this was a reachability rebuild, not a reskin.
 *
 * This file used to be three things at once. Formatting now lives in ./profileFormat and every
 * colour decision in ./profileTokens; both are re-exported here so the seven tabs that import from
 * "./profileUi" did not have to change. New code should import from the specific module — a tab
 * that needs `money` should not pull the component set in behind it.
 *
 * The one house rule every page using these MUST honour: the tenant app applies no global
 * font-family, so the page shell sets it inline (FONT). Omit it and the whole screen silently
 * renders in the browser default.
 */

import { AlertTriangle, Inbox } from "lucide-react";

import { CHIP_TONE, FOCUS_RING } from "./profileTokens";

export * from "./profileFormat";
export * from "./profileTokens";

/* ─── components ────────────────────────────────────────────────────────── */

export function Badge({ children, className = "", dotClass }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${className}`}>
      {dotClass && <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />}
      {children}
    </span>
  );
}

export function Chip({ children, tone = "slate" }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${CHIP_TONE[tone] || CHIP_TONE.slate}`}>
      {children}
    </span>
  );
}

export function SectionCard({ icon: Icon, title, description, action, children, className = "" }) {
  return (
    <section className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        {Icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Icon className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-extrabold text-slate-900">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function DetailItem({ icon: Icon, label, value, href, wide = false }) {
  const shown = value || "Not provided";
  return (
    <div className={`flex min-w-0 items-start gap-3 rounded-xl bg-slate-50/80 px-3.5 py-3 ${wide ? "sm:col-span-2" : ""}`}>
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />}
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
        {href && value ? (
          <a href={href} className={`mt-1 block break-words rounded text-sm font-semibold text-blue-700 hover:underline ${FOCUS_RING}`}>
            {shown}
          </a>
        ) : (
          <p className={`mt-1 break-words text-sm font-semibold ${value ? "text-slate-700" : "text-slate-500"}`}>
            {shown}
          </p>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, hint, action }) {
  return (
    <div className="px-5 py-16 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
        <Icon className="h-6 w-6" />
      </span>
      <h3 className="mt-4 text-base font-extrabold text-slate-900">{title}</h3>
      {hint && <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">{hint}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

/**
 * Section-level error.
 *
 * A 403 is rendered as "locked", not as a failure — the Money tab is deliberately gated harder
 * than the rest of the profile, so an ordinary agent hitting it has done nothing wrong.
 */
export function SectionError({ error, onRetry }) {
  const locked = error?.status === 403;
  return (
    <div className="px-5 py-16 text-center">
      <AlertTriangle className={`mx-auto h-8 w-8 ${locked ? "text-slate-500" : "text-amber-500"}`} />
      <p className="mt-3 text-sm font-bold text-slate-700">
        {locked ? "You don't have access to this section" : "Could not load this section"}
      </p>
      <p className="mt-1 text-sm text-slate-500">{error?.message}</p>
      {!locked && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={`mt-4 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 ${FOCUS_RING}`}
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function RowSkeleton({ rows = 3 }) {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
      ))}
    </div>
  );
}

/** The timeline's own shape — a rail of glyph + two text lines, not the generic row block. */
export function TimelineSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-6 p-5">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex animate-pulse gap-4">
          <div className="h-9 w-9 shrink-0 rounded-xl bg-slate-100" />
          <div className="min-w-0 flex-1 space-y-2 pt-1">
            <div className="h-3 w-1/3 rounded bg-slate-100" />
            <div className="h-3 w-2/3 rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
