// src/app/chrome/CurrencyConverter.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The currency converter, mounted once at the shell so it opens over any page.
//
// Opened three ways, all the same surface:
//   • Alt + C            anywhere in the app (NavProvider owns the hotkey)
//   • ⌘K → "currency"    the palette's Tools row
//   • ⌘K → "100 usd inr" the palette answers inline; Enter here for the full tool
//
// Two decisions worth keeping:
//   • It NEVER invents a rate. When the server has none, the result area asks for
//     one instead of showing a plausible number — a wrong rate on a quotation is
//     worse than no rate.
//   • "Use my own rate" is not a fallback, it is a feature. A desk buys foreign
//     currency at its dealer's card rate, not at the mid-market rate, and that
//     spread is the margin on the trip.
//
// The dialog is a SEPARATE component that only exists while open, so the seed
// handed over by the palette ("100 usd to inr") is plain initial state — no effect
// syncing props into state, and every open starts clean.
//
// Styling follows the ⌘K palette (white panel, slate hairlines, no gradient) —
// they are the same class of surface and should read as one.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, Check, Copy, RefreshCw, X } from "lucide-react";

import { cachedRates, getRates } from "@shared/api/fxService";
import {
  HOME_CURRENCY,
  POPULAR_CURRENCIES,
  convert,
  currencyName,
  formatMoney,
  formatRate,
  plainAmount,
  relativeTime,
  unitRate,
} from "@shared/lib/currency";
import { toast } from "@shared/ui/toast";
// The combobox Create Booking uses, through the leads barrel — app chrome already reaches
// features that way (Layout, Navbar), and forking a second searchable select would be worse.
import { SearchableSelect } from "@features/leads";

import { useNav } from "../nav/NavProvider";

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-50";

/* One click from any amount. Same priority thinking as POPULAR_CURRENCIES: the dollar, the home
   rupee, then the trips an Indian desk actually sells — Dubai, Thailand, Bali — and the
   subcontinent. Anything not here is two keystrokes away in the picker. */
const QUICK_TARGETS = ["USD", "INR", "AED", "THB", "IDR", "NPR", "LKR", "MVR", "BTN"];

export default function CurrencyConverter() {
  const { converterOpen, converterSeed, closeConverter } = useNav();
  if (!converterOpen) return null;
  return <ConverterDialog seed={converterSeed} onClose={closeConverter} />;
}

function ConverterDialog({ seed, onClose }) {
  const [amount, setAmount] = useState(() => (seed?.amount != null ? String(seed.amount) : "1"));
  const [from, setFrom] = useState(() => seed?.from || "USD");
  const [to, setTo] = useState(() => seed?.to || HOME_CURRENCY);
  // Whatever the palette or a previous open already fetched — the dialog opens with
  // numbers on screen, then quietly confirms them against the server.
  const [payload, setPayload] = useState(() => cachedRates());
  const [loading, setLoading] = useState(true);
  const [customRate, setCustomRate] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const amountRef = useRef(null);
  const restoreFocusRef = useRef(null);

  const rates = payload?.rates || null;
  const hasRates = Boolean(rates && Object.keys(rates).length);

  // ── Focus + scroll lock (the genuine external-system work) ─────────────────
  useEffect(() => {
    restoreFocusRef.current = document.activeElement;
    const t = window.setTimeout(() => {
      amountRef.current?.focus();
      amountRef.current?.select();
    }, 0);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      // Opening a converter should not cost you your place in the form behind it.
      const el = restoreFocusRef.current;
      if (el && typeof el.focus === "function") el.focus();
    };
  }, []);

  // Rates: one call per open, served from cache unless it has aged out (see fxService).
  useEffect(() => {
    let alive = true;
    getRates()
      .then((data) => {
        if (alive) setPayload(data);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    getRates({ force: true })
      .then(setPayload)
      .finally(() => setLoading(false));
  }, []);

  const swap = useCallback(() => {
    setFrom(to);
    setTo(from);
    setCustomRate("");   // a rate is directional; keeping it after a swap would invert the answer
  }, [from, to]);

  // ── The number ─────────────────────────────────────────────────────────────
  // No live rates ⇒ manual entry is the only way to an answer, so the row is open
  // by derivation rather than by an effect that writes state.
  const ratesMissing = Boolean(payload) && !loading && !hasRates;
  const showManual = manualOpen || ratesMissing;

  const numericAmount = Number(String(amount).replace(/,/g, ""));
  const manualRate = Number(customRate);
  const usingManual = showManual && Number.isFinite(manualRate) && manualRate > 0;

  const result = useMemo(() => {
    if (!Number.isFinite(numericAmount)) return null;
    if (usingManual) return numericAmount * manualRate;
    return convert(numericAmount, from, to, rates);
  }, [numericAmount, usingManual, manualRate, from, to, rates]);

  const effectiveRate = usingManual ? manualRate : unitRate(from, to, rates);
  const liveRate = unitRate(from, to, rates);

  // Every code the provider knows, priority ones first — the parser's shortlist is deliberately
  // narrower, but the picker should not hide a currency we HAVE. The label carries the name so the
  // ranked search matches "npr", "nepal" and "rupee" alike.
  const options = useMemo(() => {
    const all = rates ? Object.keys(rates) : [];
    const lead = [...new Set([...POPULAR_CURRENCIES, HOME_CURRENCY])].filter((c) => all.includes(c));
    const rest = all.filter((c) => !lead.includes(c)).sort();
    return [...lead, ...rest].map((code) => ({ value: code, label: `${code} — ${currencyName(code)}` }));
  }, [rates]);

  const copyResult = useCallback(() => {
    if (result === null) return;
    // The bare number, not the formatted string — this gets pasted into a price field.
    const text = plainAmount(result);
    const done = () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
      toast.success(`Copied ${text}`);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => toast.error("Could not copy"));
    } else {
      toast.info(text);   // no clipboard API outside a secure context
    }
  }, [result]);

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      copyResult();
      return;
    }
    // Alt+S mirrors the swap button. `code` not `key`: on a Mac, Option+S types "ß".
    if (e.altKey && e.code === "KeyS") {
      e.preventDefault();
      swap();
    }
  };

  const freshness = ratesMissing
    ? { tone: "text-amber-600", text: "Live rates unavailable — enter a rate below" }
    : payload?.stale
      ? { tone: "text-amber-600", text: `Offline — rates from ${relativeTime(payload.fetchedAt) || "earlier"}` }
      : { tone: "text-slate-400", text: `Live rates · updated ${relativeTime(payload?.fetchedAt) || "recently"}` };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-slate-900/50 p-3 pt-[12vh] backdrop-blur-[2px] sm:p-6 sm:pt-[14vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Currency converter"
        onKeyDown={onKeyDown}
        /* NOT overflow-hidden any more: the currency picker opens a panel that has to escape this
           box, and clipping it left the list unusable. The footer carries its own rounded-b. */
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-bold text-slate-800">Currency converter</p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={refresh}
              aria-label="Refresh rates"
              title="Refresh rates"
              className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="px-4 py-4">
          {/* From */}
          <div className="flex gap-2">
            <input
              ref={amountRef}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              aria-label="Amount"
              placeholder="0"
              className={`${inputCls} min-w-0 flex-1 text-sm`}
            />
            <CurrencySelect value={from} onChange={setFrom} options={options} label="From currency" />
          </div>

          {/* Swap */}
          <div className="my-2 flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-100" />
            <button
              type="button"
              onClick={swap}
              title="Swap (Alt + S)"
              aria-label="Swap currencies"
              className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
            >
              <ArrowLeftRight size={14} />
            </button>
            <span className="h-px flex-1 bg-slate-100" />
          </div>

          {/* To */}
          <div className="flex gap-2">
            <div className="flex min-w-0 flex-1 items-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
              <span
                className={`min-w-0 flex-1 truncate text-base font-extrabold ${
                  result === null ? "text-slate-300" : "text-slate-900"
                }`}
                title={result === null ? "" : formatMoney(result, to)}
              >
                {result === null ? "—" : formatMoney(result, to)}
              </span>
            </div>
            <CurrencySelect value={to} onChange={setTo} options={options} label="To currency" />
          </div>

          {/* Rate line */}
          <p className="mt-2 text-xs font-medium text-slate-500">
            {effectiveRate
              ? `1 ${from} = ${formatRate(effectiveRate)} ${to}${usingManual ? " · your rate" : ""}`
              : "Enter a rate to convert"}
          </p>

          {/* Quick targets — the everyday pairs, one click from any amount. */}
          {hasRates && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {QUICK_TARGETS
                .filter((c) => c !== to && rates[c])
                .slice(0, 7)
                .map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setTo(code)}
                    title={currencyName(code)}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                  >
                    {code}
                  </button>
                ))}
            </div>
          )}

          {/* Own rate */}
          <div className="mt-3 border-t border-slate-100 pt-3">
            {showManual ? (
              <div className="flex items-center gap-2">
                <label htmlFor="fx-custom-rate" className="shrink-0 text-xs font-semibold text-slate-500">
                  1 {from} =
                </label>
                <input
                  id="fx-custom-rate"
                  value={customRate}
                  onChange={(e) => setCustomRate(e.target.value)}
                  inputMode="decimal"
                  placeholder={liveRate ? formatRate(liveRate) : "rate"}
                  className={`${inputCls} w-32 py-1.5 text-xs`}
                />
                <span className="shrink-0 text-xs font-semibold text-slate-500">{to}</span>
                <button
                  type="button"
                  onClick={() => {
                    setManualOpen(false);
                    setCustomRate("");
                  }}
                  disabled={ratesMissing}
                  className="ml-auto shrink-0 text-[11px] font-bold text-slate-400 transition hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Use live rate
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setManualOpen(true)}
                className="text-[11px] font-bold text-slate-400 transition hover:text-blue-600"
              >
                Use my own rate (dealer / card rate)
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 rounded-b-2xl border-t border-slate-100 bg-slate-50/70 px-4 py-2.5">
          <span className={`min-w-0 truncate text-[11px] font-medium ${freshness.tone}`}>
            {freshness.text}
          </span>
          <button
            type="button"
            onClick={copyResult}
            disabled={result === null}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy"}
            <kbd className="ml-1 rounded border border-white/30 px-1 font-sans text-[10px] opacity-80">⏎</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * OLD — a native <select> with Common / All currencies optgroups, chosen for its free keyboard
 * support. But a native select answers a keystroke by jumping to the next option starting with that
 * letter and forgetting it a second later, so across ~160 codes finding NPR meant scrolling. This is
 * the same combobox Create Booking uses: type "npr", "nepal" or "rupee" and the match is ranked,
 * with ArrowUp/Down, Enter, Esc and Home/End all included.
 */
function CurrencySelect({ value, onChange, options, label }) {
  // Rates may not have loaded yet — never drop the current selection off the list.
  const items = useMemo(
    () =>
      options.some((o) => o.value === value)
        ? options
        : [{ value, label: `${value} — ${currencyName(value)}` }, ...options],
    [options, value],
  );

  return (
    /* The width lives here so the row keeps the same two-column shape the <select> gave it, and
       sm:w-60 is 240px on purpose — exactly the panel's own min-width, so the open list lines up
       with the field instead of hanging past it (the dialog went to max-w-lg to buy that room).
       Below sm there is no room for 240px, so right-0 pins the panel inside the dialog. Both are
       done from the outside — nothing about the shared combobox changes. */
    <div className="w-40 shrink-0 sm:w-60 [&>div>div]:left-auto [&>div>div]:right-0">
      <SearchableSelect
        options={items}
        value={value}
        onChange={onChange}
        accent="blue"
        name={label}
        className="font-bold"
        searchPlaceholder="Code or currency name…"
      />
    </div>
  );
}
