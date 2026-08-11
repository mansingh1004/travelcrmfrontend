/**
 * Every colour decision on the customer 360 profile, in one file.
 *
 * Before this, ten separate colour maps were scattered across seven components — six in
 * profileUi.jsx and four more inline in the tabs — so "what colour is a refund" had four possible
 * answers depending on which file you opened. Nothing below is imported for its own sake; each map
 * exists because a backend enum has to be turned into a class string somewhere.
 *
 * ── The two rules these maps encode ──────────────────────────────────────────────────────────
 *
 * 1. TONE IS STATUS, NOT DIRECTION. Green is not "income" and red is not "expense" — green is
 *    *settled*, amber is *awaiting*, rose is *overdue or failed*, slate is *a plain fact*. A
 *    booking total, a taxable value and a tax line are all facts and are all slate, however large
 *    they are. Direction is carried by a sign or an icon (see signedMoney) so it survives both
 *    colour-blindness and a monochrome print.
 *
 * 2. NO VIOLET. violet-* is the SuperAdmin console's accent, scoped to `.sa-console`, and its
 *    appearing in the tenant app makes two products look like one. It was previously used at eight
 *    sites here — VIP, REFUNDED, the lead-log timeline glyph, two lead stages and a money tile.
 *    Those now resolve to teal (a distinct identity marker) and indigo (processed / in flight).
 *
 * ── Where this is heading ────────────────────────────────────────────────────────────────────
 * `docs/FINANCIAL_COLOR_SYSTEM.md` (backend repo) specs a real token layer. It is not built — the
 * tenant app's only @theme block is the gold scale in src/index.css. When that layer lands, this
 * file is the single place the raw Tailwind classes have to be swapped for tokens.
 */

/* ─── money semantics ───────────────────────────────────────────────────── */

/**
 * The class for a monetary figure, chosen by what the figure MEANS.
 *   fact     a stated amount — billed, taxable, tax, total, cost. The default.
 *   settled  money that has landed — collected, paid, verified.
 *   awaiting money expected but not late — outstanding with time still on the clock.
 *   overdue  money expected and late.
 *   outflow  money going back out — refunds, refunds due.
 *   muted    zero, or not applicable.
 */
export const MONEY_TONE = {
  fact: "text-slate-900",
  settled: "text-emerald-700",
  awaiting: "text-amber-700",
  overdue: "text-rose-700",
  outflow: "text-rose-700",
  muted: "text-slate-500",
};

/** Outstanding is the one figure whose tone depends on the clock, not just the amount. */
export const outstandingTone = (amount, daysToTravel) => {
  if (Number(amount || 0) <= 0) return "muted";
  if (daysToTravel !== null && daysToTravel !== undefined && daysToTravel < 0) return "overdue";
  return "awaiting";
};

/* ─── identity ──────────────────────────────────────────────────────────── */

export const STATUS_STYLE = {
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  INACTIVE: "border-slate-200 bg-slate-100 text-slate-600",
  BLOCKED: "border-rose-200 bg-rose-50 text-rose-700",
};

export const STATUS_DOT = {
  ACTIVE: "bg-emerald-500",
  INACTIVE: "bg-slate-400",
  BLOCKED: "bg-rose-500",
};

/** All six CustomerType values — the list screen's map only had three, so half fell back wrongly. */
export const TYPE_STYLE = {
  INDIVIDUAL: "border-blue-200 bg-blue-50 text-blue-700",
  REGULAR: "border-slate-200 bg-slate-100 text-slate-700",
  CORPORATE: "border-indigo-200 bg-indigo-50 text-indigo-700",
  VIP: "border-teal-200 bg-teal-50 text-teal-700",           // was violet
  GROUP: "border-cyan-200 bg-cyan-50 text-cyan-700",
  AGENT: "border-amber-200 bg-amber-50 text-amber-700",
};

/** Loyalty tiers ride the existing gold @theme scale where they can — it is the brand accent. */
export const TIER_STYLE = {
  BRONZE: "border-orange-200 bg-orange-50 text-orange-700",
  SILVER: "border-slate-300 bg-slate-100 text-slate-700",
  GOLD: "border-gold-300 bg-gold-100 text-gold-700",
  PLATINUM: "border-slate-700 bg-slate-800 text-white",
};

/* ─── record states ─────────────────────────────────────────────────────── */

export const BOOKING_STATUS_STYLE = {
  CONFIRMED: "bg-blue-50 text-blue-700 ring-blue-600/20",
  PENDING: "bg-amber-50 text-amber-700 ring-amber-600/20",
  CANCELLED: "bg-rose-50 text-rose-700 ring-rose-600/20",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  REFUNDED: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",   // was violet
};

/** LeadStage → Chip tone. Keys are keyOf() output, so "Follow Up" arrives as FOLLOW_UP. */
export const LEAD_STAGE_TONE = {
  NEW_LEAD: "blue",
  CONTACTED: "indigo",
  FOLLOW_UP: "amber",
  QUALIFIED: "teal",          // was violet
  PROPOSAL_SENT: "indigo",    // was violet
  CONVERTED: "emerald",
  REOPENED: "amber",
  LOST: "rose",
};

export const CAMPAIGN_STATUS_TONE = { SENT: "emerald", PENDING: "amber", FAILED: "rose", SKIPPED: "slate" };

export const DRIP_STATUS_TONE = { ACTIVE: "blue", COMPLETED: "emerald", CANCELLED: "slate" };

/* ─── surfaces ──────────────────────────────────────────────────────────── */

/** The Chip / Badge palette. Every tone here must exist in both maps or a lookup falls to slate. */
export const CHIP_TONE = {
  slate: "bg-slate-100 text-slate-600 ring-slate-500/20",
  blue: "bg-blue-50 text-blue-700 ring-blue-600/20",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  rose: "bg-rose-50 text-rose-700 ring-rose-600/20",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  teal: "bg-teal-50 text-teal-700 ring-teal-600/20",
};

/**
 * Icon glyph tones — fill and mark only, deliberately NO ring.
 *
 * The timeline glyphs carry their own `ring-4 ring-white` to punch a hole in the rail behind them.
 * A tone that also set a ring colour would collide with it, and which one wins depends on CSS
 * source order rather than class order — i.e. it would look right until Tailwind reshuffled.
 */
export const GLYPH_TONE = {
  slate: "bg-slate-100 text-slate-500",
  blue: "bg-blue-50 text-blue-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  rose: "bg-rose-50 text-rose-600",
  indigo: "bg-indigo-50 text-indigo-600",
  teal: "bg-teal-50 text-teal-600",
};

/** Icon-plate tones — glyph plus a ring. Used by the money band's tiles. */
export const PLATE_TONE = {
  slate: "bg-slate-100 text-slate-500 ring-slate-200",
  blue: "bg-blue-50 text-blue-600 ring-blue-100",
  emerald: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  amber: "bg-amber-50 text-amber-600 ring-amber-100",
  rose: "bg-rose-50 text-rose-600 ring-rose-100",
  indigo: "bg-indigo-50 text-indigo-600 ring-indigo-100",
  teal: "bg-teal-50 text-teal-600 ring-teal-100",
};

/** The alert rail. Only two tones — an alert that is neither urgent nor time-bound is not an alert. */
export const ALERT_TONE = {
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  rose: "border-rose-200 bg-rose-50 text-rose-900",
};

/* ─── timeline ──────────────────────────────────────────────────────────── */

/** Kind → glyph plate. Icons themselves stay in TimelineTab; only colour lives here. */
export const TIMELINE_TONE = {
  LEAD_LOG: "teal",           // was violet
  BOOKING_CREATED: "blue",
  PAYMENT_RECEIVED: "emerald",
  REFUND_ISSUED: "rose",
  INVOICE_ISSUED: "indigo",
};

/* ─── shared class strings ──────────────────────────────────────────────── */

/** One definition of the focus ring, so a new control cannot quietly ship without one. */
export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1";

/** Column-header text. Was text-[10px]/[11px] slate-400 — below AA at that size. */
export const TH_CLASS = "text-[11px] font-bold uppercase tracking-wider text-slate-500";
