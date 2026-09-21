// src/console/components/TenantHealthList.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The heart of the platform dashboard: one row per tenant, worst first.
//
// Sorted by risk, never alphabetically — the server has the data to do the triage,
// so making the reader scan for it is work the screen should have done.
//
// The column that earns its place is the TREND. A tenant creating 40 leads a week
// that drops to 4 is the most urgent row on the page and still has the highest
// lead total on the platform; only the pair of numbers says so. Every total-only
// widget in the console would show that tenant as the healthiest one there.
//
// Last login is the other one. It is not a proxy or a score: a tenant that has not
// signed in for two weeks has stopped using the product, whatever else is true.
// ─────────────────────────────────────────────────────────────────────────────

import { Link } from "react-router-dom";
import { ArrowRight, MinusCircle, TrendingDown, TrendingUp } from "lucide-react";

import { ConsolePanel } from "./ConsoleUi";

const REASONS = {
  PAST_DUE: { label: "Payment overdue", tone: "rose" },
  NEVER_LOGGED_IN: { label: "Never logged in", tone: "rose" },
  TRIAL_ENDING: { label: "Trial ending", tone: "orange" },
  EXPIRING: { label: "Access expiring", tone: "orange" },
  ONBOARDING_STUCK: { label: "Never activated", tone: "orange" },
  ACTIVITY_DROP: { label: "Activity dropped", tone: "amber" },
  NO_ACTIVITY: { label: "No activity", tone: "amber" },
  QUIET: { label: "Not logged in", tone: "amber" },
};

const TONES = {
  rose: "bg-hue-rose-soft text-hue-rose",
  orange: "bg-hue-orange-soft text-hue-orange",
  amber: "bg-hue-amber-soft text-hue-amber",
};

/** "3d" / "2h" / "never" — how long since anyone signed in. */
function lastSeen(days) {
  if (days === null || days === undefined) return { text: "Never", stale: true };
  if (days === 0) return { text: "Today", stale: false };
  if (days === 1) return { text: "Yesterday", stale: false };
  return { text: `${days}d ago`, stale: days >= 7 };
}

/**
 * The trend cell.
 *
 * Renders the pair, not the change alone: a −80% that went 40→8 and a −80% that went 5→1 are very
 * different afternoons, and the percentage on its own cannot tell them apart.
 */
function Trend({ now, before, delta }) {
  const flat = delta === null || delta === undefined;
  const Icon = flat ? MinusCircle : delta >= 0 ? TrendingUp : TrendingDown;
  const tone = flat
    ? "text-muted"
    : delta >= 0
      ? "text-hue-emerald"
      : delta <= -50
        ? "text-hue-rose"
        : "text-hue-amber";

  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="font-mono text-sm font-semibold text-heading">{now}</span>
      <span className="text-xs text-muted">from {before}</span>
      <Icon size={13} className={tone} />
      {!flat && <span className={`text-xs font-semibold ${tone}`}>{delta >= 0 ? "+" : ""}{delta}%</span>}
    </span>
  );
}

/**
 * @param {object} health   the tenant-health response, or null when the feed failed
 * @param {string|null} filter  an attention code from the strip; null shows everything
 * @param {number} windowDays   echoed by the server, so the header names its own window
 */
export default function TenantHealthList({ health, filter, loading = false }) {
  const rows = health?.tenants ?? [];
  const windowDays = health?.windowDays ?? 7;
  const shown = filter ? rows.filter((r) => (r.attention ?? []).includes(filter)) : rows;

  const needsAttention = rows.filter((r) => (r.attention ?? []).length > 0).length;

  return (
    <ConsolePanel
      title="Tenant health"
      description={
        loading
          ? "Loading…"
          : filter
            ? `${shown.length} tenant(s) matching ${REASONS[filter]?.label?.toLowerCase() ?? filter}`
            : `${needsAttention} of ${rows.length} tenant(s) need attention · working users and leads over ${windowDays} days`
      }
    >
      {shown.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted">
          {loading
            ? "Loading tenant health…"
            : rows.length === 0
              ? "No tenants yet."
              : "No tenant matches this filter."}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {shown.map((t) => {
            const seen = lastSeen(t.daysSinceLastLogin);
            return (
              <li key={t.publicId}>
                <Link
                  to={`/console/tenants/${t.publicId}`}
                  className="group flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                >
                  <div className="min-w-[9rem] flex-1">
                    <div className="truncate text-sm font-semibold text-heading">
                      {t.organizationName || "Unnamed tenant"}
                    </div>
                    <div className="truncate text-xs text-muted">
                      {[t.plan, t.status].filter(Boolean).join(" · ")}
                    </div>
                  </div>

                  {/* Seats in use, not seats sold. 2 of 9 is a tenant paying for people who are not
                      in the product — a churn signal and a right-sizing call in one number, and one
                      no licensed-user total can show. */}
                  <div className="w-24 shrink-0">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted">Working</div>
                    <div className="text-sm font-semibold text-heading">
                      <span className={t.activeUsers > 0 && t.workingUsers * 2 <= t.activeUsers ? "text-hue-amber" : ""}>
                        {t.workingUsers ?? 0}
                      </span>
                      <span className="text-xs font-normal text-muted"> of {t.activeUsers}</span>
                    </div>
                  </div>

                  <div className="w-28 shrink-0">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted">Last login</div>
                    <div className={`text-sm font-semibold ${seen.stale ? "text-hue-orange" : "text-heading"}`}>
                      {seen.text}
                    </div>
                  </div>

                  <div className="w-52 shrink-0">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted">
                      Leads · {windowDays}d
                    </div>
                    <Trend now={t.leads7d} before={t.leadsPrev7d} delta={t.leadsDeltaPercent} />
                  </div>

                  <div className="w-24 shrink-0">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted">Bookings</div>
                    <div className="font-mono text-sm font-semibold text-heading">{t.bookings7d}</div>
                  </div>

                  <div className="flex min-w-[10rem] flex-1 flex-wrap items-center justify-end gap-1.5">
                    {(t.attention ?? []).map((code) => {
                      const meta = REASONS[code];
                      return (
                        <span
                          key={code}
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONES[meta?.tone] || TONES.amber}`}
                        >
                          {meta?.label ?? code}
                        </span>
                      );
                    })}
                    <ArrowRight
                      size={15}
                      className="text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </ConsolePanel>
  );
}
