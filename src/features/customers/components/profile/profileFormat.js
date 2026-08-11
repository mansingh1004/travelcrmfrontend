/**
 * Formatting for the customer 360 profile.
 *
 * Split out of profileUi.jsx, which had grown into three unrelated concerns in one file
 * (formatters / colour maps / components). Pure functions, no JSX, no imports — so a tab can pull
 * `money` without dragging lucide and the whole component set in behind it.
 *
 * These are deliberately feature-local. `@shared/lib/currency.js` is NOT a money formatter — it is
 * the FX vocabulary and the ⌘K query parser — and there is no shared money formatter in this
 * codebase (37 local definitions across 28 files). Adding the 38th here is the honest move; the
 * consolidation is a separate job.
 */

export const FONT = "'Plus Jakarta Sans',system-ui,sans-serif";

/* ─── money ─────────────────────────────────────────────────────────────── */

export const money = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** Compact money — ₹4.2L / ₹1.3Cr. Only for genuinely tight columns; never for a figure someone
 *  has to read out loud. The command band shows exact amounts for exactly that reason. */
export const moneyShort = (value) => {
  const n = Number(value || 0);
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  return money(n);
};

/**
 * Money with an explicit direction sign.
 *
 * The house rule is that direction is never carried by colour alone — a red figure and a green one
 * are the same figure to roughly one man in twelve. `+`/`−` is the signal; the colour is
 * reinforcement. `direction` is "in" (received) or "out" (refunded, paid away); anything else
 * renders unsigned, which is right for a factual amount like a booking total or a tax line.
 */
export const signedMoney = (value, direction) => {
  const amount = money(Math.abs(Number(value || 0)));
  if (Number(value || 0) === 0) return amount;
  if (direction === "in") return `+${amount}`;
  if (direction === "out") return `−${amount}`;   // U+2212 minus, not a hyphen
  return amount;
};

/* ─── dates ─────────────────────────────────────────────────────────────── */

const toDate = (value) => {
  const text = String(value);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T00:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const fmtDate = (value, fallback = "—") => {
  if (!value) return fallback;
  const date = toDate(value);
  if (!date) return fallback;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export const fmtDateTime = (value, fallback = "—") => {
  if (!value) return fallback;
  const date = toDate(value);
  if (!date) return fallback;
  return date.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
};

/** Days from today until `value`; negative means already past. Null when undated. */
export const daysUntil = (value) => {
  if (!value) return null;
  const date = toDate(value);
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((date - today) / 86_400_000);
};

/* ─── text ──────────────────────────────────────────────────────────────── */

/**
 * Title-case a token WITHOUT destroying acronyms.
 *
 * The previous helper lowercased first, so `VIP` — the one enum value in the app that is an
 * acronym — rendered as "Vip". Any all-caps run of 2-4 letters is left alone.
 */
export const titleCase = (value) => {
  if (!value) return "Not set";
  return String(value)
    .replace(/_/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (/^[A-Z]{2,4}$/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    .join(" ");
};

export const initials = (name) =>
  String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "CU";

/** Show only the tail of an identity number. Used for passport / PAN / Aadhaar on screen. */
export const maskIdentifier = (value, visible = 4) => {
  const clean = String(value || "").trim();
  if (!clean) return "";
  if (clean.length <= visible) return "••••";
  return `${"•".repeat(Math.min(8, clean.length - visible))}${clean.slice(-visible)}`;
};

/** Normalise a display string ("Follow Up") to an enum-ish key ("FOLLOW_UP") for map lookups. */
export const keyOf = (value) => String(value || "").trim().toUpperCase().replace(/\s+/g, "_");
