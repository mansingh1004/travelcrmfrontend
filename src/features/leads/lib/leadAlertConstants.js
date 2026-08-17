// src/features/leads/lib/leadAlertConstants.js
//
// Presentation constants for the claim window. Kept out of the components so the page, the global
// toast host and the bell all colour a source identically — three surfaces showing the same lead in
// three different colours is the exact confusion a colour code exists to prevent.

/**
 * Source colour + label, keyed by the backend `sourceKey` (the LeadSource ENUM NAME).
 *
 * Never keyed by the display name: display names are prose ("Phone (Manual)") that can be reworded
 * without anyone thinking about CSS, whereas the enum name is a contract the backend promises not
 * to break (LeadSource javadoc: "Never remove a constant").
 *
 * Not exhaustive by design — LeadSource has ~25 constants and most never reach a live alert. Unknown
 * keys fall through to DEFAULT_SOURCE rather than rendering blank, so a source added on the backend
 * shows up in slate with its own label instead of an invisible badge.
 */
export const SOURCE_STYLE = {
  WEBSITE_FORM:      { color: "#2563eb", label: "Website Form" },
  WEBSITE:           { color: "#2563eb", label: "Website" },
  WEBLINK_ENQUIRY:   { color: "#2563eb", label: "Weblink" },
  WHATSAPP:          { color: "#16a34a", label: "WhatsApp" },
  JUSTDIAL:          { color: "#ea580c", label: "JustDial" },
  INDIAMART:         { color: "#dc2626", label: "IndiaMART" },
  TRADEINDIA:        { color: "#dc2626", label: "TradeIndia" },
  SULEKHA:           { color: "#dc2626", label: "Sulekha" },
  META_ADS:          { color: "#7c3aed", label: "Meta Ads" },
  FACEBOOK:          { color: "#7c3aed", label: "Facebook" },
  INSTAGRAM:         { color: "#7c3aed", label: "Instagram" },
  INSTAGRAM_DM:      { color: "#7c3aed", label: "Instagram DM" },
  FB_MESSENGER:      { color: "#7c3aed", label: "Messenger" },
  SOCIAL_MEDIA:      { color: "#7c3aed", label: "Social Media" },
  GOOGLE_ADS:        { color: "#0ea5e9", label: "Google Ads" },
  PHONE_MANUAL:      { color: "#64748b", label: "Phone" },
  DIRECT_CALL:       { color: "#64748b", label: "Phone" },
  IVR_CALL:          { color: "#64748b", label: "IVR Call" },
  WALK_IN:           { color: "#0d9488", label: "Walk-in" },
  REFERRAL:          { color: "#d946ef", label: "Referral" },
  MANUAL:            { color: "#64748b", label: "Manual" },
  SUB_AGENT:         { color: "#a16207", label: "Sub-Agent" },
  REPEAT_CUSTOMER:   { color: "#0d9488", label: "Repeat Enquiry" },
};

export const DEFAULT_SOURCE = { color: "#64748b", label: "Other" };

/**
 * Resolve a source badge. Prefers the map's label so wording stays consistent across surfaces, but
 * falls back to the server's own display name for a source we have no entry for — better a correct
 * unstyled label than "Other" on a lead that plainly came from somewhere specific.
 */
export function sourceStyle(sourceKey, fallbackLabel) {
  const known = SOURCE_STYLE[sourceKey];
  if (known) return known;
  return { color: DEFAULT_SOURCE.color, label: fallbackLabel || DEFAULT_SOURCE.label };
}

/** Deterministic avatar colour from the name, so the same person keeps the same tile every render. */
const AVATAR_COLORS = ["#2563eb", "#7c3aed", "#0ea5e9", "#f97316", "#16a34a", "#e11d48", "#0d9488"];

export function avatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function initials(name) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Compact SLA time: minutes through 60 minutes, then hours (plus remaining whole minutes).
 * A leading + still means the target has passed, so overdue leads remain easy to distinguish.
 */
export function formatCountdown(seconds) {
  if (seconds == null) return null;
  const abs = Math.abs(Math.round(seconds));
  if (abs === 0) return "0 min";

  const prefix = seconds < 0 ? "+" : "";
  if (abs < 60) return `${prefix}<1 min`;

  const minutes = Math.floor(abs / 60);
  if (abs <= 60 * 60) return `${prefix}${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${prefix}${hours} hr${remainingMinutes ? ` ${remainingMinutes} min` : ""}`;
}

/** Human first-response time for the stat tile and the locked rows. */
export function formatDuration(seconds) {
  if (seconds == null) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/**
 * SLA chip tone. Thresholds come from the brief: amber under 2 minutes remaining, red under 1.
 * Expressed against the LEAD'S OWN target rather than hardcoded seconds, so a tenant on a 15-minute
 * target still gets a warning band proportional to it instead of a chip that is green until the
 * last 120 seconds of a quarter-hour.
 */
export function slaTone(secondsRemaining, targetSeconds = 300) {
  if (secondsRemaining == null) return "off";
  // "late" is kept separate from "crit" so the row can tint only once the target has actually
  // passed. Merging them would tint every lead in its last minute, which is most of them.
  if (secondsRemaining <= 0) return "late";
  const warnAt = Math.max(120, targetSeconds * 0.4);
  const critAt = Math.max(60, targetSeconds * 0.2);
  if (secondsRemaining < critAt) return "crit";
  if (secondsRemaining < warnAt) return "warn";
  return "ok";
}

/**
 * Absolute wall-clock time for the "Received" line and the history timeline.
 *
 * The backend sends zoneless LocalDateTimes, so this is the browser's reading of them. Only ever used
 * for coarse, minutes-tolerant display — never for the countdown, which is derived from the server's
 * own slaSecondsRemaining precisely so a skewed client clock cannot disagree with the breach tile.
 */
export function formatClock(value, withDate = false) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return withDate ? `${d.toLocaleDateString([], { day: "2-digit", month: "short" })} ${time}` : time;
}

/** Pax summary — "2 Adults, 1 Child". Built here so the row and the toast never word it differently. */
export function paxSummary({ adults, children, infants } = {}) {
  const parts = [];
  if (adults) parts.push(`${adults} Adult${adults > 1 ? "s" : ""}`);
  if (children) parts.push(`${children} Child${children > 1 ? "ren" : ""}`);
  if (infants) parts.push(`${infants} Infant${infants > 1 ? "s" : ""}`);
  return parts.join(", ");
}

/** ₹ formatting, Indian grouping. Null budget renders as nothing, never "₹0". */
export function formatMoney(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

/** The app-wide font. Nothing sets font-family globally — every page must state it itself. */
export const FONT_STACK = "'Plus Jakarta Sans',system-ui,-apple-system,'Segoe UI',sans-serif";
