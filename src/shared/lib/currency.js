// src/shared/lib/currency.js
// ─────────────────────────────────────────────────────────────────────────────
// Currency vocabulary + the ⌘K query parser behind the converter.
//
// Pure functions, zero imports, no network — the palette, the converter modal and
// anything later that wants "what is 500 AED in rupees" all read from here, so the
// answer can never differ between two surfaces.
//
// The parser is deliberately CONSERVATIVE. It runs on every keystroke in a search
// box that is also how people reach leads and bookings, so a false positive is
// worse than a miss: "all leads" must not become a conversion just because ALL is
// a real ISO code (Albanian lek). Hence three rules and a filler list — see
// parseFxQuery.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The currencies we RECOGNISE IN TEXT. Deliberately not the provider's full ~160:
 * this set is what the parser is allowed to match, and every extra entry is another
 * chance for a three-letter word to be read as money. The converter's dropdown is
 * separate and does list everything the API returns.
 *
 * Skewed to where Indian travel desks actually sell — the Gulf, South-East Asia,
 * the Indian Ocean and the classic long-haul pairs.
 */
export const CURRENCY_NAMES = {
  INR: "Indian Rupee",
  USD: "US Dollar",
  EUR: "Euro",
  GBP: "British Pound",
  AED: "UAE Dirham",
  SAR: "Saudi Riyal",
  QAR: "Qatari Riyal",
  OMR: "Omani Rial",
  KWD: "Kuwaiti Dinar",
  BHD: "Bahraini Dinar",
  THB: "Thai Baht",
  SGD: "Singapore Dollar",
  MYR: "Malaysian Ringgit",
  IDR: "Indonesian Rupiah",
  VND: "Vietnamese Dong",
  PHP: "Philippine Peso",
  HKD: "Hong Kong Dollar",
  MOP: "Macanese Pataca",
  CNY: "Chinese Yuan",
  TWD: "Taiwan Dollar",
  JPY: "Japanese Yen",
  KRW: "South Korean Won",
  MMK: "Myanmar Kyat",
  KHR: "Cambodian Riel",
  LAK: "Lao Kip",
  AUD: "Australian Dollar",
  NZD: "New Zealand Dollar",
  FJD: "Fijian Dollar",
  CAD: "Canadian Dollar",
  CHF: "Swiss Franc",
  TRY: "Turkish Lira",
  RUB: "Russian Ruble",
  AZN: "Azerbaijani Manat",
  GEL: "Georgian Lari",
  KZT: "Kazakhstani Tenge",
  UZS: "Uzbekistani Som",
  ILS: "Israeli Shekel",
  JOD: "Jordanian Dinar",
  EGP: "Egyptian Pound",
  MAD: "Moroccan Dirham",
  ZAR: "South African Rand",
  KES: "Kenyan Shilling",
  TZS: "Tanzanian Shilling",
  MUR: "Mauritian Rupee",
  SCR: "Seychellois Rupee",
  MVR: "Maldivian Rufiyaa",
  LKR: "Sri Lankan Rupee",
  NPR: "Nepalese Rupee",
  BTN: "Bhutanese Ngultrum",
  BDT: "Bangladeshi Taka",
  SEK: "Swedish Krona",
  NOK: "Norwegian Krone",
  DKK: "Danish Krone",
  CZK: "Czech Koruna",
  PLN: "Polish Zloty",
  HUF: "Hungarian Forint",
  MXN: "Mexican Peso",
  BRL: "Brazilian Real",
};

/**
 * The chips in the converter and the first block of the dropdown, in PRIORITY order — not
 * alphabetical, and not "biggest world currency" order either.
 *
 * USD leads because it is the currency every other rate gets sanity-checked against and the one
 * hotels and DMCs quote in. Then the home rupee, then the neighbours a desk sells all year
 * (Nepal, Bhutan, Sri Lanka, Maldives) and the volume destinations — Dubai, Thailand, Bali,
 * Singapore, Malaysia, Vietnam — before the long-haul classics. Everything the provider returns
 * is still reachable in the dropdown's second block; this list only decides what is one tap away.
 */
export const POPULAR_CURRENCIES = [
  "USD", "INR",
  // Subcontinent — same trip planned twice a week.
  "NPR", "BTN", "LKR", "MVR",
  // The volume outbound: Gulf, South-East Asia, the Indian Ocean.
  "AED", "THB", "IDR", "SGD", "MYR", "VND", "MUR", "SCR", "SAR", "QAR",
  // Long haul.
  "EUR", "GBP", "AUD", "JPY", "CHF", "CAD", "TRY", "AZN", "GEL", "UZS",
];

/** The rupee is the desk's home currency, so it is what a single-sided query converts into. */
export const HOME_CURRENCY = "INR";

/** Symbols and the words people actually type instead of an ISO code. */
const ALIASES = {
  "₹": "INR", rs: "INR", "rs.": "INR", inr: "INR", rupee: "INR", rupees: "INR",
  $: "USD", "us$": "USD", usd: "USD", dollar: "USD", dollars: "USD", buck: "USD", bucks: "USD",
  "€": "EUR", euro: "EUR", euros: "EUR",
  "£": "GBP", pound: "GBP", pounds: "GBP", quid: "GBP",
  "¥": "JPY", yen: "JPY",
  dirham: "AED", dirhams: "AED", dhs: "AED",
  baht: "THB", riyal: "SAR", riyals: "SAR", ringgit: "MYR", rupiah: "IDR",
  yuan: "CNY", rmb: "CNY", won: "KRW", franc: "CHF", francs: "CHF",
  lira: "TRY", rand: "ZAR", dong: "VND", taka: "BDT", rufiyaa: "MVR", peso: "PHP",
  // The neighbours. A bare "rupee" stays INR — that is the desk's own money and the safer default;
  // these are the words someone types when they specifically mean the other one.
  nrs: "NPR", nepali: "NPR", ngultrum: "BTN", lankan: "LKR",
};

/** Words that carry intent but no value — they must not count as "noise" in the gate below. */
const FILLERS = new Set([
  "to", "in", "into", "as", "is", "=", "->", "=>", ">", "at",
  "convert", "converter", "conversion", "exchange", "rate", "rates", "currency",
  "forex", "fx", "how", "much", "many", "equals", "equal", "worth", "of",
]);

/** Typing any of these should offer the converter even with no currency in the query. */
const TOOL_KEYWORDS = [
  "currency", "convert", "converter", "conversion", "exchange", "forex", "fx", "rate", "rates",
];

/** True when the query is asking for the converter itself rather than a specific sum. */
export function matchesConverterKeyword(text) {
  const q = (text || "").trim().toLowerCase();
  if (q.length < 2) return false;
  return TOOL_KEYWORDS.some((k) => k.startsWith(q) || k === q);
}

/** Resolve one token to an ISO code, or null. `extra` lets live provider codes widen the set. */
function codeOf(token, extra) {
  if (!token) return null;
  const t = token.toLowerCase();
  if (ALIASES[t]) return ALIASES[t];
  const upper = token.toUpperCase();
  if (CURRENCY_NAMES[upper]) return upper;
  if (extra && extra.has(upper) && /^[A-Z]{3}$/.test(upper)) return upper;
  return null;
}

/**
 * Read a search query as a conversion. Returns `{ amount, from, to }` or null.
 *
 * Understands `100 usd to inr`, `500aed`, `usd inr`, `$250 in rupees`, `convert thb`,
 * `1,00,000 inr to aed` and a bare `aed`.
 *
 * The gate (why "all leads" is not money):
 *   • two currencies       → always a conversion, amount defaults to 1
 *   • one currency + a number → a conversion into the home currency
 *   • one currency and nothing else meaningful → a rate lookup
 *   • anything else        → null
 *
 * @param {string} text
 * @param {Set<string>} [knownCodes] live codes from the rates payload, widening the match set
 */
export function parseFxQuery(text, knownCodes) {
  const raw = (text || "").trim();
  if (!raw) return null;

  // Pull the first number out (Indian or western grouping), then parse what's left as words.
  const amountMatch = raw.match(/(\d[\d,]*\.?\d*)/);
  const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : null;
  const rest = amountMatch ? raw.replace(amountMatch[0], " ") : raw;

  // Currency symbols are punctuation, so space them out before tokenising.
  const tokens = rest
    .replace(/[₹$€£¥]/g, (m) => ` ${m} `)
    .split(/[\s,]+/)
    .filter(Boolean);

  const codes = [];
  const noise = [];
  for (const token of tokens) {
    const code = codeOf(token, knownCodes);
    if (code) {
      if (codes[codes.length - 1] !== code) codes.push(code);
    } else if (!FILLERS.has(token.toLowerCase())) {
      noise.push(token);
    }
  }

  if (codes.length === 0) return null;
  if (amount !== null && !Number.isFinite(amount)) return null;

  const from = codes[0];
  const to = codes[1] || (from === HOME_CURRENCY ? "USD" : HOME_CURRENCY);

  if (codes.length >= 2) return { amount: amount ?? 1, from, to };
  if (amount !== null) return { amount, from, to };
  if (noise.length === 0) return { amount: 1, from, to };
  return null;
}

/** `amount` of `from` expressed in `to`, using a base-relative rate map. Null when unknown. */
export function convert(amount, from, to, rates) {
  if (!rates || !Number.isFinite(amount)) return null;
  const rFrom = Number(rates[from]);
  const rTo = Number(rates[to]);
  if (!rFrom || !rTo) return null;
  return (amount * rTo) / rFrom;
}

/** The unit rate: 1 `from` = X `to`. */
export function unitRate(from, to, rates) {
  return convert(1, from, to, rates);
}

/** Money for display. Small numbers keep more decimals — 0.01 USD is not "$0.01" enough. */
export function formatMoney(value, code) {
  if (!Number.isFinite(value)) return "—";
  const digits = Math.abs(value) > 0 && Math.abs(value) < 1 ? 4 : 2;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      maximumFractionDigits: digits,
    }).format(value);
  } catch {
    // A provider code Intl does not know (rare, but it must not blank the screen).
    return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(value)} ${code}`;
  }
}

/** The bare number, for "copy" — a pasted value should be arithmetic, not a currency string. */
export function plainAmount(value) {
  if (!Number.isFinite(value)) return "";
  return String(Math.round(value * 100) / 100);
}

/** A rate, which needs more precision than money: 1 INR = 0.043512 AED. */
export function formatRate(value) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: Math.abs(value) < 1 ? 6 : 4,
  }).format(value);
}

/** "1 USD = 88.1234 INR", or null when either side is unknown. */
export function rateLine(from, to, rates) {
  const r = unitRate(from, to, rates);
  return r === null ? null : `1 ${from} = ${formatRate(r)} ${to}`;
}

/** Currency name for the dropdown, falling back to the code itself. */
export function currencyName(code) {
  return CURRENCY_NAMES[code] || code;
}

/** "2 hours ago" for the freshness line. Kept here so the modal stays presentational. */
export function relativeTime(iso) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
