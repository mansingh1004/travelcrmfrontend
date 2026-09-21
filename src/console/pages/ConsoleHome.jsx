import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  BedDouble,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  Car,
  Package,
  Gauge,
  Handshake,
  RefreshCw,
  ScrollText,
  Users,
} from "lucide-react";
import { actionInboxService } from "../api/actionInboxService";
import { analyticsService } from "../api/analyticsService";
import { auditService } from "../api/auditService";
import { marketplaceBookingService } from "../api/marketplaceBookingService";
import { platformPackageMixService } from "../api/platformPackageMixService";
import { platformPackageService } from "../api/platformPackageService";
import { transportAdminService } from "../api/transportAdminService";
import { hotelNominationService } from "../api/marketplaceAdminService";
import { hotelPartnerService } from "../api/hotelPartnerService";
import { subAgentLicenseService } from "../api/subAgentLicenseService";
import { upgradeRequestService } from "../api/upgradeRequestService";
import { usageService } from "../api/usageService";
import {
  ConsoleErrorState,
  ConsoleLoadingState,
  ConsolePageHeader,
  ConsolePanel,
} from "../components/ConsoleUi";
import TenantsDashboard from "../components/TenantsDashboard";
import AttentionStrip from "../components/AttentionStrip";
import PlatformHero from "../components/PlatformHero";
import RangePicker, { resolveRange } from "../components/RangePicker";
import TenantHealthList from "../components/TenantHealthList";
import ActivationFunnel from "../components/ActivationFunnel";
import SecurityPanel from "../components/SecurityPanel";
import DashboardBand from "../dashboard/DashboardBand";
import { platformHealthService } from "../api/platformHealthService";
import HotelMarketplaceDashboard from "../components/HotelMarketplaceDashboard";
import TransportMarketplaceDashboard from "../components/TransportMarketplaceDashboard";
import PackageMarketplaceDashboard from "../components/PackageMarketplaceDashboard";

const HUE = {
  indigo: "bg-hue-indigo-soft text-hue-indigo",
  emerald: "bg-hue-emerald-soft text-hue-emerald",
  amber: "bg-hue-amber-soft text-hue-amber",
  orange: "bg-hue-orange-soft text-hue-orange",
  sky: "bg-hue-sky-soft text-hue-sky",
  violet: "bg-hue-violet-soft text-hue-violet",
  rose: "bg-hue-rose-soft text-hue-rose",
};


const symbol = (currency) => (currency === "INR" ? "₹" : currency ? `${currency} ` : "");
const money = (value, currency) => symbol(currency) + Number(value || 0).toLocaleString("en-IN", {
  maximumFractionDigits: 0,
});

// eslint-disable-next-line no-unused-vars -- kept beside money(); the chart that used it moved to TenantsDashboard
const compactMoney = (currency) => (value) => {
  const amount = Number(value || 0);
  return amount >= 1000
    ? `${symbol(currency)}${(amount / 1000).toFixed(amount >= 10000 ? 0 : 1)}k`
    : `${symbol(currency)}${amount}`;
};
const number = (value) => Number(value || 0).toLocaleString("en-IN");
const countFrom = (value) => Number(value?.count ?? value ?? 0);


/* One cell of a hairline-divided strip, not a card.
   Six identical bordered-and-shadowed tiles in a 3x2 grid is the shape every admin template ships,
   and it flattens hierarchy: "Outstanding invoices" and "Platform users" were rendered with exactly
   the same weight. A strip divided by hairlines reads as one instrument with several readings, which
   is what these numbers actually are.
   Numerals are tabular-nums on the UI face rather than font-mono: mono is for identifiers (audit
   actions, tenant codes), and using it for money costs legibility and reads as a developer tool. */
function MetricCard({ label, value, helper, Icon, hue = "violet", danger = false, to }) {
  const Card = to ? Link : "div";
  return (
    <Card {...(to ? { to } : {})}
      className="group rounded-2xl border border-border bg-surface p-4 shadow-[var(--sa-card-shadow)] transition-colors hover:border-accent/40 hover:bg-surface-hover/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted">{label}</div>
          <div className={`mt-2 truncate font-mono text-2xl font-bold tracking-tight ${danger ? "text-hue-rose" : "text-heading"}`}>
            {value}
          </div>
        </div>
        <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${HUE[hue]}`}>
          <Icon size={17} strokeWidth={2.2} />
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-body">
        <span>{helper}</span>{to && <ArrowRight size={13} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />}
      </div>
    </Card>
  );
}

/**
 * One supply line, summarised: how much is waiting, how long the worst of it has waited, and which
 * queue that is.
 *
 * <p>A button rather than a Link because the four dashboards are views of THIS page, not separate
 * routes — the tab strip and this card must move the same state or they would disagree about which
 * view is open.</p>
 *
 * <p>Deliberately shows work, not volume. A card reading "₹4.2L earned" tells an operator nothing
 * they can act on this morning; "3 waiting, oldest 12d" tells them where to go first, which is what
 * the tabs below it are for.</p>
 */
function AreaCard({ label, Icon, tone, waiting, unknown, worst, oldestMs, onOpen }) {
  const waited = oldestMs > 0 ? shortDuration(oldestMs) : null;
  const helper = worst
    ? `${worst.label}${waited ? ` · oldest ${waited}` : ""}`
    : unknown > 0 ? `${unknown} feed(s) unavailable` : "Nothing waiting";
  return (
    <button type="button" onClick={onOpen}
      className="group rounded-2xl border border-border bg-surface p-4 text-left shadow-[var(--sa-card-shadow)] transition-colors hover:border-accent/40 hover:bg-surface-hover/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted">{label}</div>
          <div className={`mt-2 truncate font-mono text-2xl font-bold tracking-tight ${waiting > 0 ? "text-heading" : "text-muted"}`}>
            {number(waiting)}
          </div>
        </div>
        <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${HUE[tone] || HUE.violet}`}>
          <Icon size={17} strokeWidth={2.2} />
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-body">
        <span className="truncate">{helper}</span>
        <ArrowRight size={13} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
      </div>
    </button>
  );
}

/** The same terse shape as waitedFor, for a duration already measured in ms. */
function shortDuration(ms) {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${Math.max(minutes, 1)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function QueueItem({ path, label, hint, count, Icon, tone = "violet" }) {
  return (
    <Link to={path}
      className="group flex items-center gap-3 border-b border-border px-5 py-3.5 transition-colors last:border-b-0 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent">
      <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${HUE[tone]}`}>
        <Icon size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-heading">{label}</span>
        <span className="block truncate text-xs text-muted">{hint}</span>
      </span>
        {/* An em dash, not a zero. A feed we could not reach and a queue with nothing in it are
            different facts, and printing 0 for the first reports the more dangerous one as the safer. */}
        <span className={`font-mono text-lg font-bold ${count === null ? "text-muted" : "text-heading"}`}>
          {count === null ? "—" : count}
        </span>
      <ArrowRight size={15} className="text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
    </Link>
  );
}

/* Everything with nothing waiting, folded into one quiet line. The operator needs to know these
   queues were checked and are clear — but they should cost one row, not seven. */
function ClearQueues({ labels }) {
  if (!labels.length) return null;
  return (
    <div className="flex items-start gap-2.5 px-5 py-3 text-xs text-muted">
      <CheckCircle2 size={15} className="mt-px shrink-0 text-hue-emerald" />
      <span>
        <span className="font-semibold text-body">{labels.length} clear</span>
        {" — "}{labels.join(" · ")}
      </span>
    </div>
  );
}

/* Queues whose feed did not answer. Kept visually distinct from the clear line and from a working
   queue, because the one thing this row must never do is let an unreachable queue read as an empty
   one — that is the failure this whole three-way split exists to prevent. */
function UnknownQueues({ labels }) {
  if (!labels.length) return null;
  return (
    <div className="flex items-start gap-2.5 border-t border-border px-5 py-3 text-xs text-muted">
      <AlertTriangle size={15} className="mt-px shrink-0 text-hue-amber" />
      <span>
        <span className="font-semibold text-body">{labels.length} not loaded</span>
        {" — "}{labels.join(" · ")}
      </span>
    </div>
  );
}



/**
 * How long the oldest item in a queue has been waiting, as a compact "6d" / "4h" / "12m".
 *
 * Deliberately terse and deliberately not `relativeTime` — that one produces "3 days ago", which reads
 * as when something happened. This reads as how long it has been ignored, which is the operator's
 * actual question. Returns null when there is nothing to report, so callers can omit it entirely
 * rather than render "0m".
 */
function waitedFor(iso) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${Math.max(minutes, 1)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/**
 * The equal-length window immediately before [from, to].
 *
 * Inclusive on both ends, so a 7-day week is compared against the 7 days before it and not against
 * 6 or 8 — an off-by-one here shows up as a permanent few-percent drift in every movement figure on
 * the page, which is worse than no comparison because it looks credible.
 */
function previousWindow(from, to) {
  if (!from || !to) return null;
  const start = new Date(from);
  const end = new Date(to);
  const days = Math.round((end - start) / 86400000) + 1;
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (days - 1));
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: iso(prevStart), to: iso(prevEnd) };
}

function relativeTime(value) {
  if (!value) return "Unknown time";
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const ranges = [[60, "second"], [60, "minute"], [24, "hour"], [7, "day"]];
  let amount = seconds;
  for (const [limit, unit] of ranges) {
    if (Math.abs(amount) < limit) return formatter.format(Math.round(amount), unit);
    amount /= limit;
  }
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export default function ConsoleHome() {
  const [searchParams, setSearchParams] = useSearchParams();
  /* Four dashboards, one per supply line plus the platform overview. In the URL so a view can
     be linked — an operator sending "look at the transport numbers" should be able to send the
     screen, not the instruction. Anything unrecognised falls back to the overview rather than
     rendering blank. */
  const DASHBOARD_VIEWS = ["tenants", "hotel", "transport", "package"];
  const requestedView = searchParams.get("view");
  const dashboardView = DASHBOARD_VIEWS.includes(requestedView) ? requestedView : "platform";

  /* In the URL, like the view, so a period can be linked — "look at last week's numbers" should be
     a link, not an instruction. Custom bounds ride along so a shared custom range survives. */
  const rangeKey = ["today", "week", "month", "custom"].includes(searchParams.get("range"))
    ? searchParams.get("range") : "month";
  const customRange = { from: searchParams.get("from") || "", to: searchParams.get("to") || "" };
  const range = resolveRange(rangeKey, customRange);
  const rangeLabel = { today: "today", week: "this week", month: "this month", custom: "selected period" }[rangeKey];

  const setRange = (key, custom) => {
    const next = new URLSearchParams(searchParams);
    if (key === "month") next.delete("range"); else next.set("range", key);
    const resolved = resolveRange(key, custom);
    if (key === "custom" && resolved.from) next.set("from", resolved.from); else next.delete("from");
    if (key === "custom" && resolved.to) next.set("to", resolved.to); else next.delete("to");
    setSearchParams(next, { replace: true });
  };
  const [data, setData] = useState(null);
  const [ops, setOps] = useState({
    /* null = not loaded yet, or the feed failed. Distinct from 0, which is a real answer. */
    upgrades: null, licenses: null, hotelRequests: null, nominations: null,
    partnerRegistrations: null, transportRequests: null, packageMix: null,
    overLimit: null, nearLimit: null,
  });
  const [activity, setActivity] = useState([]);
  const [queueAges, setQueueAges] = useState({});
  const [usage, setUsage] = useState(null);
  const [pulse, setPulse] = useState(null);
  /* Commission across all three supply lines. Its own call rather than a field on pulse: pulse
     counts rows, this reads three append-only ledgers, and merging them would tie one endpoint to
     two very different costs. */
  const [earnings, setEarnings] = useState(null);
  /* The immediately preceding window of equal length. Movement is the point of the hero card —
     "collected ₹2.4L" is a level, and a level tells nobody whether anything is going wrong. */
  const [prevPulse, setPrevPulse] = useState(null);
  const [health, setHealth] = useState(null);
  const [healthFailed, setHealthFailed] = useState(false);
  /* Which attention chip is filtering the tenant list. Not in the URL: it is a momentary lens on
     one screen, and persisting it would mean an operator returns to a filtered page and reads it
     as the whole platform. */
  const [chipFilter, setChipFilter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [degraded, setDegraded] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (background = false) => {
    /* A custom range with only one bound picked is not a range. Sending it would drop the empty
       param and silently get back the server's default month, which the picker would then label
       as the custom period the operator chose. */
    const window = { from: range.from, to: range.to };
    const windowReady = Boolean(window.from && window.to);
    const prev = windowReady ? previousWindow(window.from, window.to) : null;

    background ? setRefreshing(true) : setLoading(true);
    setError("");
    const results = await Promise.allSettled([
      analyticsService.overview(),
      usageService.dashboard(),
      upgradeRequestService.pendingCount(),
      subAgentLicenseService.pendingCount(),
      marketplaceBookingService.pendingCount(),
      hotelNominationService.openCount(),
      hotelPartnerService.listRegistrations({ status: "SUBMITTED", page: 0, size: 1 }),
      auditService.list({ page: 0, size: 6 }),
      /* Inserted BEFORE ages() on purpose: the degraded-banner test below is
         results.slice(1, -1), which assumes analytics is first and ages is last. Appending
         this at the end would have quietly excluded ages from that slice and included this. */
      transportAdminService.pendingCount(),
      /* Before ages(), like transport: the degraded test below is results.slice(1, -1) and assumes
         ages is last. */
      platformPackageMixService.pendingCount(),
      /* Before ages() for the same reason as the two above: results.slice(1, -1) drives the
         degraded banner and assumes ages is last. size:1 because only the total is wanted. */
      platformPackageService.reviewQueue({ page: 0, size: 1 }),
      actionInboxService.ages(),
      /* AFTER ages(), unlike everything above it, because these three are not part of the
         degraded-banner test: results.slice(1, -1) covers the queue-count feeds, and pulse/health
         failing is reported where it shows (the hero says "Unavailable", the strip says it could
         not be loaded) rather than as a generic banner about queue counts. */
      windowReady ? platformHealthService.pulse(window) : Promise.resolve(null),
      windowReady ? platformHealthService.earnings(window) : Promise.resolve(null),
      windowReady && prev ? platformHealthService.pulse(prev) : Promise.resolve(null),
      platformHealthService.tenantHealth(),
    ]);

    const [analytics, usage, upgrades, licenses, hotelRequests, nominations, registrations, audit,
      transportRequests, packageMix, packageReview, ages,
      pulseNow, earningsNow, pulseBefore, tenantHealth] = results;
    if (analytics.status === "rejected") {
      setError(analytics.reason?.response?.data?.message || "Failed to load platform analytics.");
    } else {
      setData(analytics.value);
      const usageOverview = usage.status === "fulfilled" ? usage.value?.overview : null;
      /* A FAILED feed is null, not 0.

         It used to be `fulfilled ? count : 0`, which put the queue in the "clear" list — and the
         line below then positively told the operator that queue was empty. A feed we could not
         reach and a queue with nothing in it are not the same fact, and the more dangerous one
         was being reported as the safer one. */
      const at = (settled, read) => (settled.status === "fulfilled" ? read(settled.value) : null);

      setUsage(usage.status === "fulfilled" ? usage.value : null);
      setOps({
        // Split. These are two different queues on two different endpoints with two different
        // review flows; summing them showed one number over one queue's age.
        upgrades: at(upgrades, countFrom),
        licenses: at(licenses, countFrom),
        hotelRequests: at(hotelRequests, countFrom),
        nominations: at(nominations, countFrom),
        partnerRegistrations: at(registrations, (v) =>
          Number(v?.pagination?.totalElements ?? v?.rows?.length ?? 0)),
        transportRequests: at(transportRequests, countFrom),
        packageMix: at(packageMix, countFrom),
        packageReview: at(packageReview, (v) =>
          Number(v?.pagination?.totalElements ?? v?.rows?.length ?? 0)),
        overLimit: usageOverview ? Number(usageOverview.tenantsOverLimit ?? 0) : null,
        nearLimit: usageOverview ? Number(usageOverview.tenantsNearLimit ?? 0) : null,
      });
      setActivity(audit.status === "fulfilled" ? audit.value?.rows ?? [] : []);
      // Age is decoration on top of the counts, so a failure here must not raise the degraded banner:
      // the inbox simply shows what it always showed.
      setQueueAges(ages.status === "fulfilled" ? ages.value : {});
      setPulse(pulseNow.status === "fulfilled" ? pulseNow.value : null);
      setEarnings(earningsNow.status === "fulfilled" ? earningsNow.value : null);
      setPrevPulse(pulseBefore.status === "fulfilled" ? pulseBefore.value : null);
      setHealth(tenantHealth.status === "fulfilled" ? tenantHealth.value : null);
      // Distinct from "no chips": a failed feed must not render as an all-clear green line.
      setHealthFailed(tenantHealth.status === "rejected");
      setDegraded([usage, upgrades, licenses, hotelRequests, nominations, registrations,
        transportRequests, packageMix, packageReview]
        .some((result) => result.status === "rejected"));
    }
    setLoading(false);
    setRefreshing(false);
    // Refetches when the period changes — the flow figures are the whole reason the picker exists.
  }, [range.from, range.to]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <ConsoleLoadingState label="Loading platform command center…" />;
  if (error || !data) return <ConsoleErrorState message={error || "No platform data is available."} onRetry={() => load()} />;

  const currency = data.currency;
  /* Summed from the SAME list the rows below are built from, rather than a hand-written addition
     that has to be remembered every time a queue is added. It was not: transport was missing, so
     with only transport orders pending the header read "0 decisions need attention" directly above
     a transport row showing work. Nulls are skipped — an unreachable feed contributes nothing to a
     total rather than silently counting as zero. */

  /* One declared list, partitioned into "has work", "clear" and "unknown", then ordered by AGE —
     twelve requests raised this morning matter less than one that has waited three weeks.

     Every row that represents queued rows now carries an inboxKey and therefore an age. The last two
     do not and never will: they are recomputed from current state on every request, so nothing was
     ever queued and there is no arrival instant to age from. */
  const queues = [
    { path: "/console/upgrade-requests", label: "Plan and add-on requests", short: "Plan requests",
      inboxKey: "UPGRADE_REQUESTS", area: "tenants",
      hint: "Review tenant plan changes", count: ops.upgrades, Icon: FileCheck2, tone: "violet" },
    /* Its own row. It used to be summed into the one above, so a single number covered two queues
       on two endpoints with two review flows — and the age shown beside it belonged to only one of
       them. */
    { path: "/console/upgrade-requests", label: "Sub-agent seat licenses", short: "Seat licenses",
      inboxKey: "SUBAGENT_LICENSES", area: "tenants",
      hint: "Partner seat purchases awaiting approval", count: ops.licenses, Icon: FileCheck2, tone: "violet" },
    { path: "/console/hotel-requests", label: "Hotel booking requests", short: "Booking requests",
      inboxKey: "HOTEL_BOOKING_REQUESTS", area: "hotel",
      hint: "Tenant is waiting for a platform decision", count: ops.hotelRequests, Icon: Clock3, tone: "amber" },
    { path: "/console/hotel-partners?view=nominations", label: "Hotel nominations", short: "Nominations",
      inboxKey: "HOTEL_NOMINATIONS", area: "hotel",
      hint: "Review tenant-suggested properties", count: ops.nominations, Icon: Handshake, tone: "sky" },
    { path: "/console/hotel-partners", label: "Hotel partner registrations", short: "Partner registrations",
      inboxKey: "HOTEL_PARTNER_REGISTRATIONS", area: "hotel",
      hint: "Review submitted supplier profiles", count: ops.partnerRegistrations, Icon: Building2, tone: "amber" },
    /* Transport had a rail badge and no inbox row, so the dashboard an operator is told to work
       from reported all clear while a vehicle sat unassigned. */
    { path: "/console/transport-requests", label: "Transport booking requests", short: "Transport requests",
      inboxKey: "TRANSPORT_ORDERS", area: "transport",
      hint: "A tenant is waiting on a vehicle and a driver", count: ops.transportRequests, Icon: Car, tone: "sky" },
    /* The hotel equivalent has been in this list since it shipped; the transport one had a console
       page and no row, so the inbox reported all clear while an operator sat unreviewed. Count and
       age both come from the inbox response — there is no separate pending-count endpoint for it. */
    { path: "/console/transport-partners", label: "Operator registrations", short: "Operator registrations",
      inboxKey: "TRANSPORT_PARTNER_REGISTRATIONS", area: "transport",
      hint: "Submitted vehicle-operator profiles waiting on review",
      count: queueAges.TRANSPORT_PARTNER_REGISTRATIONS?.count ?? null, Icon: Handshake, tone: "violet" },
    /* An agency asking to list a package is a SuperAdmin decision with its own page and its own
       endpoint, and it had no row here — so the inbox could read "all clear" while a listing sat
       unreviewed. ?tab=queue is what that page reads; it does not take a status param. */
    { path: "/console/package-catalog?tab=queue", label: "Packages awaiting review",
      short: "Package review", inboxKey: "PACKAGE_REVIEW", area: "package",
      hint: "An agency asked to list a package on the marketplace",
      count: ops.packageReview, Icon: Package, tone: "violet" },
    /* Package mix requests: a real SuperAdmin decision queue — respond or decline, both step-up
       gated — that had a live count endpoint and no row here at all. The inbox could report
       "every queue is clear" while agencies waited on a price. */
    { path: "/console/package-catalog/mix", label: "Custom package requests", short: "Custom requests",
      inboxKey: "PACKAGE_MIX", area: "package",
      hint: "An agency is waiting on a bespoke price", count: ops.packageMix, Icon: FileCheck2, tone: "violet" },
    { path: "/console/billing?overdue=true", label: "Overdue invoices", short: "Overdue invoices",
      inboxKey: "OVERDUE_INVOICES", area: "tenants",
      hint: `${money(data.overdueAmount, currency)} needs collection follow-up`,
      count: Number(data.overdueInvoices || 0), Icon: Banknote, tone: "orange" },
    // The last two are computed from current state, so nothing was ever "queued" and there is no age
    // to report — the backend deliberately omits them rather than sending a misleading null.
    { path: "/console/tenants", label: "Subscriptions expiring in 14 days", short: "Expiring access", area: "tenants",
      hint: "Contact or renew access before expiry", count: Number(data.expiringSubscriptions || 0), Icon: Clock3, tone: "amber" },
    { path: "/console/usage", label: "Tenants over quota", short: "Quota breaches", area: "tenants",
      hint: `${ops.nearLimit} more tenant(s) approaching their limit`, count: ops.overLimit, Icon: Gauge, tone: "rose" },
  ].map((q) => {
    const waited = waitedFor(queueAges[q.inboxKey]?.oldestPendingAt);
    return {
      ...q,
      waitedMs: waited ? Date.now() - new Date(queueAges[q.inboxKey].oldestPendingAt).getTime() : -1,
      hint: waited ? `${q.hint} · oldest ${waited}` : q.hint,
    };
  });

  /* Ordered by NEGLECT, not by volume: the queue whose oldest item has waited longest comes first.
     One partner who submitted three weeks ago outranks twelve booking requests raised this morning.
     Queues with no age (live-computed, or a feed that failed) fall back to depth so they still rank
     sensibly instead of sinking to the bottom. */
  const queueTotal = queues.reduce((sum, q) => sum + (q.count ?? 0), 0);

  const activeQueues = queues.filter((q) => q.count > 0)
    .sort((a, b) => (b.waitedMs - a.waitedMs) || (b.count - a.count));
  /* Three states, not two. A queue whose feed failed is neither working nor clear, and folding it
     into either one asserts something we do not know. */
  const unknownQueues = queues.filter((q) => q.count === null);
  const clearQueues = queues.filter((q) => q.count === 0);

  /* Platform overview as a dashboard OF dashboards.
     Built by grouping the queue list above, not by re-fetching or re-adding anything: a summary
     assembled from its own numbers is a summary that can disagree with the detail it summarises,
     and the operator has no way to tell which one lied. Every figure on a card is the same value
     the corresponding row shows, aggregated. */
  const DASHBOARD_AREAS = [
    { view: "tenants", label: "Subscriptions", Icon: Users, tone: "violet" },
    { view: "hotel", label: "Hotel marketplace", Icon: BedDouble, tone: "amber" },
    { view: "transport", label: "Vehicles", Icon: Car, tone: "sky" },
    { view: "package", label: "Packages", Icon: Package, tone: "emerald" },
  ];

  const rollup = DASHBOARD_AREAS.map((area) => {
    const rows = queues.filter((q) => q.area === area.view);
    const known = rows.filter((q) => q.count !== null);
    // Nulls are skipped rather than counted as zero, exactly as the header total does — an
    // unreachable feed must not be summarised as "nothing waiting here".
    const waiting = known.reduce((sum, q) => sum + q.count, 0);
    const unknown = rows.length - known.length;
    const worst = rows.filter((q) => q.count > 0)
      .sort((a, b) => (b.waitedMs - a.waitedMs) || (b.count - a.count))[0] || null;
    const oldestMs = Math.max(-1, ...rows.map((q) => q.waitedMs));
    return { ...area, waiting, unknown, worst, oldestMs };
  });

  const setDashboardView = (nextView) => {
    const next = new URLSearchParams(searchParams);
    if (nextView === "platform") next.delete("view");
    else next.set("view", nextView);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="inline-flex rounded-xl border border-border bg-surface p-1 shadow-sm" role="tablist" aria-label="Dashboard view">
        <button type="button" role="tab" aria-selected={dashboardView === "platform"} onClick={() => setDashboardView("platform")}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${dashboardView === "platform" ? "bg-accent text-white shadow-sm" : "text-body hover:bg-surface-hover"}`}>
          <Building2 size={14} /> Platform overview
        </button>
        <button type="button" role="tab" aria-selected={dashboardView === "tenants"} onClick={() => setDashboardView("tenants")}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${dashboardView === "tenants" ? "bg-accent text-white shadow-sm" : "text-body hover:bg-surface-hover"}`}>
          <Users size={14} /> Subscriptions
        </button>
        <button type="button" role="tab" aria-selected={dashboardView === "hotel"} onClick={() => setDashboardView("hotel")}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${dashboardView === "hotel" ? "bg-accent text-white shadow-sm" : "text-body hover:bg-surface-hover"}`}>
          <BedDouble size={14} /> Hotel marketplace
        </button>
        <button type="button" role="tab" aria-selected={dashboardView === "transport"} onClick={() => setDashboardView("transport")}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${dashboardView === "transport" ? "bg-accent text-white shadow-sm" : "text-body hover:bg-surface-hover"}`}>
          <Car size={14} /> Transport marketplace
        </button>
        <button type="button" role="tab" aria-selected={dashboardView === "package"} onClick={() => setDashboardView("package")}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${dashboardView === "package" ? "bg-accent text-white shadow-sm" : "text-body hover:bg-surface-hover"}`}>
          <Package size={14} /> Package marketplace
        </button>
      </div>

        <RangePicker value={rangeKey} custom={customRange} onChange={setRange} />
      </div>

      {dashboardView === "tenants" ? (
        <TenantsDashboard range={range} periodLabel={rangeLabel} />
      ) : dashboardView === "hotel" ? (
        <HotelMarketplaceDashboard pendingBookings={ops.hotelRequests} openNominations={ops.nominations}
          range={range} periodLabel={rangeLabel} />
      ) : dashboardView === "transport" ? (
        <TransportMarketplaceDashboard pendingOrders={ops.transportRequests} range={range} periodLabel={rangeLabel} />
      ) : dashboardView === "package" ? (
        <PackageMarketplaceDashboard range={range} periodLabel={rangeLabel} />
      ) : (
        <>
      <ConsolePageHeader eyebrow="SuperAdmin command center" title="Platform overview"
        description="Who is at risk, whether money is landing, and what is waiting on a decision."
        actions={(
          <>
            <Link to="/console/tenants"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3 text-xs font-semibold text-white shadow-sm hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
              <Building2 size={14} /> Manage tenants
            </Link>
            <button type="button" onClick={() => load(true)} disabled={refreshing}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 text-xs font-semibold text-heading hover:bg-surface-hover disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh
            </button>
          </>
        )} />

      {/* Layer 1 — exceptions before anything else, because "is anyone broken" outranks every
          other question on this page. Collapses to one green line when nothing matches. */}
      <AttentionStrip chips={health?.chips ?? []} active={chipFilter} onSelect={setChipFilter}
        unavailable={healthFailed} />

      {/* Seven cards: the hero, then four supply lines and two cross-cutting counts.
          The four are the dashboard-of-dashboards roll-up — each is built from the SAME queue rows
          the action inbox below renders, so a card can never disagree with the detail it
          summarises, and each opens its own dashboard rather than a separate route. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <PlatformHero pulse={pulse} previous={prevPulse} earnings={earnings}
          periodLabel={rangeLabel} currency={currency} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rollup.map((area) => (
            <AreaCard key={area.view} {...area} onOpen={() => setDashboardView(area.view)} />
          ))}
          {/* Both present-tense, like the four beside them — a queue and a risk list are what is
              true now, not what happened in the selected period. */}
          <MetricCard label="Tenants needing attention"
            value={health ? number(health.tenants.filter((t) => (t.attention ?? []).length > 0).length) : "—"}
            helper={health ? `of ${number(health.tenants.length)} tenant account(s)` : "Health feed unavailable"}
            Icon={AlertTriangle} hue="rose"
            danger={Boolean(health?.tenants.some((t) => (t.attention ?? []).length > 0))}
            to="/console/tenants" />
          <MetricCard label="Decisions waiting" value={number(queueTotal)}
            helper={activeQueues.length > 0 ? `across ${activeQueues.length} queue(s)` : "Every queue is clear"}
            Icon={ClipboardCheck} hue="amber" danger={queueTotal > 0}
            to="/console/upgrade-requests" />
        </div>
      </div>

      {degraded && (
        <div className="flex items-start gap-3 rounded-xl border border-hue-amber/30 bg-hue-amber-soft px-4 py-3 text-sm text-body" role="status">
          <AlertTriangle size={17} className="mt-0.5 shrink-0 text-hue-amber" />
          <div><span className="font-semibold text-heading">Some live feeds are unavailable.</span> Core analytics are current; unavailable queue counts are shown as zero. Refresh to retry.</div>
        </div>
      )}

      {/* Layer 3 — the heart of the screen: one row per tenant, worst first, filtered by
          whichever attention chip is on.

          What stood here was a hotel-earning card and six metric tiles. The earning figure now
          shows only on the Hotel marketplace dashboard, where it reads as one supply line's
          number instead of looking like the platform's total; the money levels moved into the
          hero above, where they sit next to a movement instead of standing alone. */}
      <TenantHealthList health={health} filter={chipFilter} loading={loading} />

      {/* The other half of the same question. The health list finds tenants who are leaving; this
          finds the ones who never arrived — a distinction that matters most while the platform is
          small, because a tenant who never created a lead trips no churn signal at all. */}
      <ActivationFunnel />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Queues with work first, ordered by neglect; the ones with nothing waiting collapse into
            a single line instead of a dozen near-identical empty rows.

            Present-tense by design: a queue is what is waiting NOW, so the period picker above does
            not apply to it and must not appear to. */}
        <ConsolePanel title="Action inbox" description={`${queueTotal} platform decisions or risks need attention · as of now`}>
          {activeQueues.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
              <CheckCircle2 size={22} className="text-hue-emerald" />
              <p className="text-sm font-semibold text-heading">{unknownQueues.length ? "Nothing waiting in the queues we could reach" : "Every queue is clear"}</p>
              <p className="text-xs text-muted">{unknownQueues.length ? `${unknownQueues.length} queue(s) could not be loaded — refresh to try again.` : "No approvals, overdue invoices, expiring access or quota breaches."}</p>
            </div>
          ) : (
            <>
              {activeQueues.map((q) => <QueueItem key={q.path + q.label} {...q} />)}
              <ClearQueues labels={clearQueues.map((q) => q.short)} />
              <UnknownQueues labels={unknownQueues.map((q) => q.short)} />
            </>
          )}
        </ConsolePanel>

        <SecurityPanel />
      </div>

      <DashboardBand data={{ analytics: data, usage }} />

      <ConsolePanel title="Recent platform activity" description="Latest audited SuperAdmin actions"
        action={<Link to="/console/audit" className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">View audit log <ArrowRight size={13} /></Link>}>
        {activity.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted"><ScrollText size={24} className="mx-auto mb-2 opacity-50" />No recent audit activity.</div>
        ) : (
          <div className="divide-y divide-border">
            {activity.map((row) => (
              <div key={row.publicId} className="flex items-start gap-3 px-5 py-3.5">
                <span className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${row.success ? HUE.emerald : HUE.rose}`}>
                  {row.success ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-mono text-[11px] font-bold text-heading">{row.action}</span>
                    <span className="text-xs text-muted">by {row.actorEmail || "system"}</span>
                    {row.targetTenantCode && <span className="rounded bg-surface-hover px-1.5 py-0.5 font-mono text-[10px] text-body">{row.targetTenantCode}</span>}
                  </div>
                  <p className="mt-1 truncate text-xs text-body">{row.description || "No description recorded"}</p>
                </div>
                <time dateTime={row.createdAt} className="shrink-0 text-[11px] text-muted">{relativeTime(row.createdAt)}</time>
              </div>
            ))}
          </div>
        )}
      </ConsolePanel>
        </>
      )}
    </div>
  );
}
