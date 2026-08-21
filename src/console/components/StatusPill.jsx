// Tenant status pill — console hue tokens, so light/dark flips automatically. No `dark:` partners:
// the tokens already carry both values, and a dark: class here would override them. Class strings
// are literal so the Tailwind v4 scanner emits them.
const STYLES = {
  ACTIVE: "bg-hue-emerald-soft text-hue-emerald border border-hue-emerald/25",
  TRIAL: "bg-hue-amber-soft text-hue-amber border border-hue-amber/25",
  // Dunning grace window — still operational, but overdue. The orange hue token exists precisely so
  // this reads distinct from TRIAL amber.
  PAST_DUE: "bg-hue-orange-soft text-hue-orange border border-hue-orange/25",
  SUSPENDED: "bg-hue-rose-soft text-hue-rose border border-hue-rose/25",
  EXPIRED: "bg-surface-hover text-muted border border-border",
  INACTIVE: "bg-surface-hover text-muted border border-border",
};

export default function StatusPill({ status }) {
  const cls = STYLES[status] || STYLES.INACTIVE;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {status}
    </span>
  );
}
