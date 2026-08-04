// src/features/leads/components/leadAlertUi.jsx
//
// The claim window's visual pieces, shared by the incoming-leads page and the global alert host so a
// lead looks identical whether it arrives as a card or is sitting in the list.
//
// THE SKIN IS A DELIBERATE BLEND, and both halves are load-bearing:
//
//   CHROME comes from the house kit, copied from AllLeads.jsx so this page reads as its sibling —
//   the gradient page shell, the glass panel (bg-white/80 + backdrop-blur + rounded-2xl), gradient
//   stat cards, the blue-600 table header, rounded-full pills, rounded-xl controls, font-bold /
//   font-extrabold labels and Plus Jakarta Sans set inline.
//
//   THE DATA SURFACE inside that panel keeps the operator discipline: one column table with fixed
//   widths, tabular numerics on every number, and colour reserved for the exceptional — "open" is
//   the default state and carries no badge at all, so a coloured row genuinely means something.
//   Nothing pulses: this list is stared at for hours.
//
// Feature-local by design. Importing fleetUi (flat blue) or marketingUi (gradient buttons) would
// each pull a second idiom onto the screen.

import { Phone, Inbox, Lock, RotateCcw, Clock } from "lucide-react";
import { WhatsAppIcon } from "@shared/ui/WhatsAppIcon";
import {
  avatarColor,
  formatCountdown,
  formatDuration,
  formatMoney,
  initials,
  paxSummary,
  slaTone,
  sourceStyle,
} from "../lib/leadAlertConstants";

/* ── Table geometry ────────────────────────────────────────────────────────── */

/**
 * ONE column table, read by the colgroup, the header and every row — the same single-source-of-truth
 * shape AllLeads.jsx uses (LEAD_COLUMNS), so a width change here cannot desync the header from the
 * body.
 */
export const COLUMNS = [
  { key: "customer", label: "Lead", width: 236 },
  { key: "source", label: "Source", width: 134 },
  { key: "enquiry", label: "Enquiry", width: 196 },
  { key: "value", label: "Value", width: 126, align: "right" },
  { key: "owner", label: "Owner", width: 148 },
  { key: "sla", label: "SLA", width: 96, align: "right" },
  { key: "actions", label: "Actions", width: 268, align: "right" },
];

export const TABLE_MIN_W = COLUMNS.reduce((sum, c) => sum + c.width, 0);

/** Shared cell chrome — identical to AllLeads.jsx:163 so the two tables rule alike. */
export const TD = "px-2.5 py-2.5 align-middle border-r border-slate-100 last:border-r-0";

export const alignClass = (a) =>
  a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

export const PANEL =
  "bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden";

/* ── Primitives ────────────────────────────────────────────────────────────── */

/**
 * Identity tile.
 *
 * Round and gradient-free here, unlike AllLeads' `bg-gradient-to-br ${avatar}` — the colour is
 * derived from the name so the same person keeps the same tile across the card, the row and the
 * drawer. A gradient would make the three surfaces disagree.
 */
export function Avatar({ name, size = 34 }) {
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center rounded-full font-extrabold text-white shadow-sm"
      style={{
        width: size,
        height: size,
        background: avatarColor(name),
        fontSize: Math.round(size * 0.34),
      }}
    >
      {initials(name)}
    </div>
  );
}

/**
 * Source, as a dot plus its label.
 *
 * A dot rather than the house's filled pill: every row carries a source, and a column of saturated
 * pills turns the one genuinely urgent signal (a red SLA) into noise. Colour comes from the enum
 * key, never the display text — display names are prose that can be reworded.
 */
export function SourceCell({ sourceKey, source }) {
  const { color, label } = sourceStyle(sourceKey, source);
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <i className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: color }} />
      <span className="truncate text-xs font-semibold text-slate-600">{label}</span>
    </span>
  );
}

/** Kept so the alert card and the row can never colour one source two different ways. */
export const SourceBadge = SourceCell;

/* ── Badges — the house rounded-full pill vocabulary ────────────────────────── */

const CHIP_TONE = {
  slate: "bg-slate-100 text-slate-600 border-slate-200",
  blue: "bg-blue-100 text-blue-700 border-blue-200",
  red: "bg-red-100 text-red-700 border-red-200",
  amber: "bg-amber-100 text-amber-700 border-amber-200",
  violet: "bg-violet-100 text-violet-700 border-violet-200",
  green: "bg-green-100 text-green-700 border-green-200",
};

export function Chip({ tone = "slate", icon: Icon, children, className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${CHIP_TONE[tone]} ${className}`}
    >
      {Icon ? <Icon size={10} /> : null}
      {children}
    </span>
  );
}

export const ReopenedChip = () => (
  <Chip tone="violet" icon={RotateCcw}>
    Reopened
  </Chip>
);

export const LockedChip = ({ label = "Contacted" }) => (
  <Chip tone="slate" icon={Lock}>
    {label}
  </Chip>
);

/* ── SLA ───────────────────────────────────────────────────────────────────── */

const SLA_TONE_CLASS = {
  ok: "text-slate-500",
  warn: "text-amber-600",
  crit: "text-red-600",
  late: "text-red-600",
  off: "text-slate-300",
};

/**
 * The live countdown.
 *
 * `secondsLeft == null` means the clock has STOPPED (contacted, or terminal) — rendered as the
 * measured response time when we have one, never as a frozen countdown that still looks like it is
 * running. Plain text rather than a bordered chip: it repaints every second on every row, and a
 * box redrawing at 1 Hz across a full table is a flicker generator.
 */
export function Sla({ secondsLeft, targetSeconds, firstResponseSeconds }) {
  const tone = slaTone(secondsLeft, targetSeconds || 300);
  const stopped = secondsLeft == null;
  const text = stopped
    ? firstResponseSeconds != null
      ? formatDuration(firstResponseSeconds)
      : "—"
    : formatCountdown(secondsLeft);

  return (
    <span
      className={`inline-flex items-center justify-end gap-1 text-sm font-extrabold tabular-nums ${SLA_TONE_CLASS[tone]}`}
      title={
        stopped
          ? firstResponseSeconds != null
            ? "First response time"
            : "Clock stopped"
          : "Time left to first response"
      }
    >
      {!stopped ? <Clock size={11} className="flex-shrink-0" /> : null}
      {text}
    </span>
  );
}

/* ── Owner ─────────────────────────────────────────────────────────────────── */

/**
 * Who has it — the same purple initial tile AllLeads uses in its Assigned To column.
 *
 * Every open lead already has an owner (the column is NOT NULL server-side), so "Unassigned" is not
 * a representable state here and must never be rendered, unlike on the AllLeads row.
 */
export function OwnerCell({ ownerName, isYou }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-purple-600 text-[10px] font-extrabold text-white">
        {ownerName ? ownerName.charAt(0).toUpperCase() : "U"}
      </span>
      <span
        className={`truncate text-xs font-bold ${isYou ? "text-blue-600" : "text-slate-700"}`}
        title={ownerName || ""}
      >
        {isYou ? "You" : ownerName || "—"}
      </span>
    </span>
  );
}

/* ── Stat cards — house gradient tiles, verbatim idiom from AllLeads ────────── */

/**
 * `caption` is REQUIRED, not decoration: the four tiles run on three different time windows
 * (created today / all time / contacted today / created today). Without it they read as four views
 * of one window, and the operator draws a false conclusion from the pair.
 */
export function StatTile({ icon: Icon, label, value, unit, caption, gradient, delay = 0 }) {
  return (
    <div
      className={`fade-up group relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-4 text-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="pointer-events-none absolute -bottom-12 -right-6 h-40 w-40 rounded-full bg-white/10 transition-colors group-hover:bg-white/20" />
      <span className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/5" />
      <div className="relative z-10">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm transition-all group-hover:bg-white/30">
          <Icon size={20} strokeWidth={2.2} />
        </div>
        <div className="mb-0.5 text-3xl font-extrabold leading-none tracking-tight tabular-nums">
          {value}
          {unit ? <span className="text-lg font-bold">{unit}</span> : null}
        </div>
        <div className="text-[11px] font-bold uppercase tracking-widest text-white/80">{label}</div>
        <div className="mt-0.5 text-[11px] font-medium text-white/70">{caption}</div>
      </div>
    </div>
  );
}

/* ── Buttons — house shapes ────────────────────────────────────────────────── */

const BTN_BASE =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-60";

const BTN_VARIANT = {
  primary: "px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 hover:shadow-lg",
  secondary:
    "px-3.5 py-2 border border-slate-200 hover:border-blue-300 bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-600 shadow-sm",
  success:
    "px-3.5 py-2 border border-green-200 hover:border-green-300 bg-green-50 hover:bg-green-100 text-green-700 shadow-sm",
  ghost: "px-2 py-1.5 text-slate-500 hover:text-blue-600",
};

export function Btn({ variant = "secondary", className = "", type = "button", ...rest }) {
  return <button type={type} className={`${BTN_BASE} ${BTN_VARIANT[variant]} ${className}`} {...rest} />;
}

/** Square icon button — AllLeads' `iconBtn` constant, tinted per action. */
const ICON_BTN = "w-7 h-7 rounded-lg flex items-center justify-center transition-all flex-shrink-0";

export function IconBtn({ tone = "slate", className = "", type = "button", ...rest }) {
  const tones = {
    slate: "bg-slate-100 hover:bg-slate-200 text-slate-600",
    blue: "bg-blue-50 hover:bg-blue-100 text-blue-600",
    green: "bg-green-50 hover:bg-green-100 text-green-600",
  };
  return <button type={type} className={`${ICON_BTN} ${tones[tone]} ${className}`} {...rest} />;
}

/** Key hint. Monospace is the one place this screen borrows a developer idiom, deliberately. */
export function Key({ children }) {
  return (
    <kbd className="rounded border border-slate-200 bg-white px-1 py-px font-mono text-[10px] font-bold text-slate-500">
      {children}
    </kbd>
  );
}

/* ── Quick actions ─────────────────────────────────────────────────────────── */

/** Call / WhatsApp. Anchors, not buttons — a phone number IS a link. */
export function QuickActions({ phone, customerName }) {
  if (!phone) return null;
  // Strip everything a dialler cannot use. WhatsApp additionally rejects a leading +.
  const dial = phone.replace(/[^\d+]/g, "");
  const wa = dial.replace(/^\+/, "");
  const text = encodeURIComponent(`Hello ${customerName || ""}`.trim());

  return (
    <>
      <a
        href={`tel:${dial}`}
        title={`Call ${phone}`}
        aria-label={`Call ${customerName || phone}`}
        className={`${ICON_BTN} bg-blue-50 text-blue-600 hover:bg-blue-100`}
      >
        <Phone size={13} />
      </a>
      <a
        href={`https://wa.me/${wa}?text=${text}`}
        target="_blank"
        rel="noreferrer"
        title="WhatsApp"
        aria-label={`WhatsApp ${customerName || phone}`}
        className={`${ICON_BTN} bg-green-50 text-green-600 hover:bg-green-100`}
      >
        <WhatsAppIcon size={13} />
      </a>
    </>
  );
}

/* ── Shell ─────────────────────────────────────────────────────────────────── */

/**
 * Connection state.
 *
 * Two visual states, three meanings: connected, and "the list you are looking at is a snapshot".
 * The second one matters — every broadcast in a disconnected window is permanently lost, so the
 * user must be able to tell quiet from broken.
 */
export function LivePill({ connected }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
        connected
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-100 text-slate-500"
      }`}
      title={connected ? "Live updates connected" : "Live updates paused — this list is a snapshot"}
    >
      <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-slate-400"}`} />
      {connected ? "Live" : "Offline"}
    </span>
  );
}

export function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
        <Inbox size={22} />
      </div>
      <p className="text-[15px] font-bold text-slate-700">No leads waiting</p>
      <p className="max-w-sm text-[13px] text-slate-500">
        Every enquiry has been picked up. New ones appear here the moment they arrive — no refresh
        needed.
      </p>
    </div>
  );
}

/** Strip for the states where the list itself is not the whole truth. */
export function Banner({ tone = "amber", children, action }) {
  const tones = {
    amber: "bg-amber-50 border-amber-100 text-amber-800",
    slate: "bg-slate-50 border-slate-100 text-slate-600",
  };
  return (
    <div
      className={`flex flex-wrap items-center gap-2 border-b px-5 py-2.5 text-xs font-semibold ${tones[tone]}`}
      style={{ animation: "fadeIn .2s ease both" }}
    >
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  );
}

export function SkeletonRow() {
  return (
    <tr className="animate-pulse border-t border-slate-100">
      <td className={TD} style={{ borderLeft: "3px solid #e2e8f0" }}>
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 flex-shrink-0 rounded-full bg-slate-200" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-28 rounded bg-slate-200" />
            <div className="h-2.5 w-16 rounded bg-slate-100" />
          </div>
        </div>
      </td>
      <td className={TD}>
        <div className="h-3 w-20 rounded bg-slate-100" />
      </td>
      <td className={TD}>
        <div className="h-3 w-28 rounded bg-slate-100" />
      </td>
      <td className={`${TD} text-right`}>
        <div className="ml-auto h-3 w-16 rounded bg-slate-100" />
      </td>
      <td className={TD}>
        <div className="h-3 w-20 rounded bg-slate-100" />
      </td>
      <td className={`${TD} text-right`}>
        <div className="ml-auto h-3 w-10 rounded bg-slate-100" />
      </td>
      <td className={`${TD} text-right`}>
        <div className="ml-auto h-7 w-44 rounded-xl bg-slate-100" />
      </td>
    </tr>
  );
}

export { formatMoney, paxSummary };
