// src/console/dashboard/widgetRegistry.js
// ─────────────────────────────────────────────────────────────────────────────
// The catalogue of optional panels an operator can put on their own dashboard.
//
// ── `action` is REQUIRED, and that is the point ─────────────────────────────
// Every entry must say what a person DOES with it. A number that cannot be
// clicked into something you would actually do is decoration, and the way a
// dashboard rots into a stats page is one widget at a time, each of which
// seemed interesting. Making the field mandatory — and throwing in DEV when it
// is missing — turns "action-oriented" from an intention into something the
// build enforces.
//
// `{ kind: "none", why }` is legal, but it must carry a reason, and the review
// rule is that an entry with no action a human can take gets rejected.
//
// ── `status: "blocked"` entries are first-class ─────────────────────────────
// Widgets that CANNOT be built because the data does not exist stay in this file
// with their reason. They render greyed in the picker with `blockedReason` as
// visible copy, so "why is there no churn chart" is answered in the product
// instead of being re-asked in a meeting every few months.
//
// ── Ids are permanent ───────────────────────────────────────────────────────
// A saved layout is a list of these ids. Renaming one silently drops that panel
// from every operator's dashboard, with no error anywhere.
// ─────────────────────────────────────────────────────────────────────────────

import { lazy } from "react";
import {
  AlertTriangle, Banknote, CalendarClock, Gauge, Layers, MoonStar, TrendingUp, Users,
} from "lucide-react";

/**
 * Column span per breakpoint, as a STATIC lookup.
 *
 * Tailwind v4 compiles utilities it can see in the source. `col-span-${n}` produces no CSS at all —
 * the class is emitted into the DOM, matches nothing, and the widget silently renders full width
 * with no build warning and no console error. Interpolating a span class is the single easiest way
 * to break this grid invisibly.
 */
export const SPAN = {
  4: "col-span-12 sm:col-span-6 xl:col-span-4",
  6: "col-span-12 xl:col-span-6",
  8: "col-span-12 xl:col-span-8",
  12: "col-span-12",
};

export const WIDGETS = [
  {
    id: "growth.quiet_tenants",
    title: "Quiet tenants",
    blurb: "ACTIVE accounts with no booking this month",
    group: "Risk",
    icon: MoonStar,
    span: 6,
    sources: ["usage"],
    status: "ready",
    Component: lazy(() => import("./widgets/QuietTenantsWidget.jsx")),
    action: { kind: "route", label: "Open tenant" },
  },
  {
    id: "portfolio.tenant_status",
    title: "Lifecycle mix",
    blurb: "Where the tenant base sits: active, trial, past due, suspended",
    group: "Portfolio",
    icon: Layers,
    span: 6,
    sources: ["analytics"],
    status: "ready",
    Component: lazy(() => import("./widgets/DistributionWidget.jsx")),
    opts: { series: "status" },
    action: { kind: "route", label: "Manage tenants" },
  },
  {
    id: "portfolio.plan_mix",
    title: "Plan mix",
    blurb: "Which plans the portfolio actually sits on",
    group: "Portfolio",
    icon: Gauge,
    span: 6,
    sources: ["analytics"],
    status: "ready",
    Component: lazy(() => import("./widgets/DistributionWidget.jsx")),
    opts: { series: "plan" },
    action: { kind: "route", label: "Open plans" },
  },
  {
    id: "growth.acquisition",
    title: "Tenant acquisition",
    blurb: "New accounts by month",
    group: "Growth",
    icon: TrendingUp,
    span: 6,
    sources: ["analytics"],
    status: "ready",
    Component: lazy(() => import("./widgets/SeriesWidget.jsx")),
    opts: { series: "acquisition" },
    action: { kind: "route", label: "Manage tenants" },
  },
  {
    id: "money.cash_collected",
    title: "Cash collected",
    blurb: "Settled invoice value by paid month",
    group: "Money",
    icon: Banknote,
    span: 6,
    sources: ["analytics"],
    status: "ready",
    Component: lazy(() => import("./widgets/SeriesWidget.jsx")),
    opts: { series: "revenue" },
    action: { kind: "route", label: "Open billing" },
  },

  // ── Blocked: the data does not exist ──────────────────────────────────────
  // Kept here, visibly, rather than left out. Each one has been asked for.
  {
    id: "health.churn_rate",
    title: "Churn rate",
    blurb: "Cancellations as a share of the base, month over month",
    group: "Risk",
    icon: AlertTriangle,
    span: 6,
    status: "blocked",
    blockedReason:
      "No CANCELLED subscription row is ever written — the Subscription table has no lifecycle "
      + "history, so there is no series to draw. Recording cancellations is the fix.",
    action: { kind: "none", why: "Nothing to click until cancellations are recorded." },
  },
  {
    id: "money.failed_payments",
    title: "Failed payments",
    blurb: "Charges that were attempted and declined",
    group: "Money",
    icon: Banknote,
    span: 4,
    status: "blocked",
    blockedReason:
      "BillingStatus has UNPAID, PAID and VOID — no FAILED. A declined charge leaves the invoice "
      + "UNPAID, indistinguishable from one nobody has attempted, so any figure here would either "
      + "read 0 forever or relabel every unpaid invoice as a failure.",
    action: { kind: "none", why: "Nothing to click until payment attempts are recorded." },
  },
  {
    id: "ops.scheduler_failures",
    title: "Failed background jobs",
    blurb: "Schedulers that did not complete",
    group: "Ops",
    icon: CalendarClock,
    span: 4,
    status: "blocked",
    blockedReason:
      "Most of the platform's schedulers record no failure row anywhere. A tile reading "
      + "\"0 failures\" sourced from a table nobody writes is read as an all-clear, which is worse "
      + "than no tile.",
    action: { kind: "none", why: "Nothing to click until scheduler outcomes are recorded." },
  },
  {
    id: "ops.webhook_failures",
    title: "Lead-source webhook failures",
    blurb: "Per tenant — a silent JustDial or IndiaMART outage is one they blame you for",
    group: "Ops",
    icon: AlertTriangle,
    span: 6,
    status: "blocked",
    blockedReason:
      "There is no per-tenant webhook outcome log. Deliveries are processed but the result is not "
      + "persisted, so a silent failure leaves no trace to count.",
    action: { kind: "none", why: "Nothing to click until webhook outcomes are recorded." },
  },
  {
    id: "growth.feature_adoption",
    title: "Feature adoption",
    blurb: "Which modules a tenant actually uses, against what they pay for",
    group: "Growth",
    icon: Users,
    span: 6,
    status: "blocked",
    blockedReason:
      "Nothing records feature USE. Module entitlement says what a tenant may open, not what they "
      + "opened — those are different facts and only the first one is stored.",
    action: { kind: "none", why: "Nothing to click until feature use is recorded." },
  },
];

export const WIDGET_BY_ID = new Map(WIDGETS.map((w) => [w.id, w]));

/** Ids on the dashboard for an operator who has never customised it. */
export const DEFAULT_WIDGET_IDS = ["growth.quiet_tenants", "portfolio.plan_mix"];

/**
 * Resolve saved ids to entries, keeping the ones we do not recognise.
 *
 * <p>Unknown ids are RETURNED, not dropped. A widget can be missing because a deploy is mid-flight
 * or a release was rolled back, and silently pruning it means the operator's layout is quietly
 * rewritten by an outage — they lose a panel and are never told why. Held aside, it comes back on
 * its own when the code does.
 *
 * <p>Do not "clean this up" into a filter.
 */
export function resolveWidgets(ids = []) {
  const render = [];
  const unknown = [];
  for (const id of ids) {
    const widget = WIDGET_BY_ID.get(id);
    if (widget && widget.status === "ready") render.push(widget);
    else if (!widget) unknown.push(id);
    // A known-but-blocked id renders nothing and is not "unknown" — it is a widget waiting on data.
  }
  return { render, unknown };
}

/**
 * Fails the build's own rules loudly, in development only.
 *
 * <p>A missing `action` is the failure this whole file exists to prevent, and it is exactly the kind
 * of thing that passes review when the diff is thirty lines of a new widget.
 */
export function assertRegistryIntegrity() {
  if (!import.meta.env?.DEV) return;
  const seen = new Set();
  for (const w of WIDGETS) {
    if (seen.has(w.id)) throw new Error(`widgetRegistry: duplicate id "${w.id}"`);
    seen.add(w.id);
    if (!w.action) throw new Error(`widgetRegistry: "${w.id}" has no action. Every widget must end in one.`);
    if (w.action.kind === "none" && !w.action.why) {
      throw new Error(`widgetRegistry: "${w.id}" has action.kind "none" with no why.`);
    }
    if (!SPAN[w.span] && w.status === "ready") {
      throw new Error(`widgetRegistry: "${w.id}" has span ${w.span}, which is not in SPAN.`);
    }
    if (w.status === "ready" && !w.Component) {
      throw new Error(`widgetRegistry: "${w.id}" is ready but has no Component.`);
    }
    if (w.status === "blocked" && !w.blockedReason) {
      throw new Error(`widgetRegistry: "${w.id}" is blocked with no blockedReason.`);
    }
  }
}
