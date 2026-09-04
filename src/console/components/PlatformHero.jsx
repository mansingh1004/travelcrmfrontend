// src/console/components/PlatformHero.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The one hero card on Platform overview — the same gradient shape the page has
// always used, pointed at a better number.
//
// It stood here as "Hotel earning": one supply line's commission, sitting in the
// biggest slot on the platform's own dashboard. That made the largest figure on
// the page the most misleading one, and the same number is already on the Hotel
// marketplace dashboard where it reads correctly.
//
// What replaces it is the platform's own question — IS MONEY LANDING — answered
// as a MOVEMENT rather than a level. "₹2.4L collected" is a level, and a level on
// its own cannot tell anyone whether something is going wrong.
// ─────────────────────────────────────────────────────────────────────────────

import { Link } from "react-router-dom";
import { ArrowRight, CircleDollarSign, TrendingDown, TrendingUp } from "lucide-react";

const money = (value, currency = "INR") =>
  `${currency === "INR" ? "₹" : `${currency} `}${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const number = (value) => Number(value || 0).toLocaleString("en-IN");

/**
 * Percentage movement between two periods.
 *
 * Null when the previous period was zero — "up 100%" from nothing is not a fact about the business,
 * and rendering it makes a first invoice look like growth against a real base.
 */
function delta(current, previous) {
  const now = Number(current || 0);
  const before = Number(previous || 0);
  if (!before) return null;
  return Math.round(((now - before) / before) * 100);
}

/**
 * @param {object} pulse     flow figures for the selected window
 * @param {object} previous  the same shape for the equal-length window immediately before
 * @param {string} periodLabel  what the picker currently says, so the card names its own window
 */
export default function PlatformHero({ pulse, previous, earnings, periodLabel, currency = "INR" }) {
  const change = delta(pulse?.collectedAmount, previous?.collectedAmount);
  const up = change !== null && change >= 0;
  const Trend = up ? TrendingUp : TrendingDown;

  return (
    <Link
      to="/console/billing"
      className="group rounded-2xl p-5 text-white shadow-[var(--sa-card-shadow)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      style={{ backgroundImage: "var(--sa-gradient)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide opacity-80">
          Collected · {periodLabel}
        </span>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
          <CircleDollarSign size={17} strokeWidth={2.2} />
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-baseline gap-2.5">
        <span className="font-mono text-3xl font-bold tracking-tight">
          {pulse ? money(pulse.collectedAmount, currency) : "Unavailable"}
        </span>
        {change !== null && (
          <span className="inline-flex items-center gap-1 rounded-md bg-white/20 px-2 py-0.5 text-xs font-semibold">
            <Trend size={13} /> {up ? "+" : ""}{change}%
          </span>
        )}
      </div>

      <p className="mt-2 text-xs font-medium opacity-80">
        {pulse
          ? `${number(pulse.invoicesPaid)} invoice(s) paid · ${money(pulse.invoicedAmount, currency)} issued`
          : "The pulse feed could not be loaded"}
      </p>

      {/* What the platform DID in the same window. "Is money landing" and "is anyone using it" are
          the same question one quarter apart, so both live on the hero rather than one of them
          being a tile nobody connects to the other. */}
      {pulse && (
        <p className="mt-1 text-xs font-medium opacity-70">
          {number(pulse.bookingsCreated)} booking(s) · {number(pulse.leadsCreated)} lead(s) ·
          {" "}{number(pulse.tenantsBooking)} tenant(s) booking
        </p>
      )}

      {/* The platform's OTHER income. Subscription cash and marketplace commission are two separate
          businesses, and this slot used to show only the hotel ledger's figure while calling it the
          platform's — so the largest number on the page was the most misleading one. It is now the
          sum of every METERED line, and the unmetered one is named rather than counted as zero. */}
      {earnings && (
        <p className="mt-3 border-t border-white/20 pt-3 text-xs font-medium">
          <span className="opacity-80">Marketplace commission</span>{" "}
          <span className="font-mono font-bold">{money(earnings.total, earnings.currency || currency)}</span>
          <span className="opacity-70">
            {" · "}
            {(earnings.sources ?? []).map((s) => (
              s.metered
                ? `${s.key.toLowerCase()} ${money(s.amount, earnings.currency || currency)}`
                : `${s.key.toLowerCase()} not metered`
            )).join(" · ")}
          </span>
        </p>
      )}

      <span className="mt-5 inline-flex items-center gap-1 text-xs font-semibold">
        Open billing <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
