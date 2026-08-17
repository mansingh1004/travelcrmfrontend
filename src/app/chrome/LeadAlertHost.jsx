// src/app/chrome/LeadAlertHost.jsx
//
// The new-lead broadcast popup. Mounted once in Layout, beside ReminderPopupCenter, so it fires on
// EVERY authenticated page — a lead that arrives while someone is deep in a booking form is exactly
// the one the broadcast exists for, and a popup that only worked on the leads screen would miss it.
//
// BOTTOM-RIGHT, GROWING UPWARD. Two reasons, both hard-won:
//   1. @shared/ui/toast owns the top-right at z-[999]. A card at top-right is painted over by its
//      own success toast the moment the user claims from it.
//   2. New cards insert ABOVE the oldest, which stays pinned to the corner. Existing cards never
//      move, so a newer lead cannot slide under a cursor already travelling toward Claim.
//
// This is NOT the shared toast host. That one renders a line of text — it drops non-string children
// outright and has no action slot. This needs an avatar, a source code, an SLA clock and two working
// buttons. ReminderPopupCenter set the precedent for a feature-shaped popup beside the generic one.
//
// App chrome may import feature barrels (Navbar already does) — but never past them.

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { useLeadAlerts, leadAlertService, claimFailure, formatCountdown } from "@features/leads";
import { toast } from "@shared/ui/toast";

/** How long a broadcast stays on screen. Longer than a toast: this one has to be READ and decided. */
const CARD_MS = 10_000;

/** A lead someone else has already taken is a worse opportunity — it gets less of the screen's time. */
const SHORTENED_MS = 3_000;

/** At most three. Beyond that the stack is a wall, and the queue is one keystroke away. */
const MAX_CARDS = 3;

/** One chime per burst. Five leads arriving together must not fire five times. */
const CHIME_THROTTLE_MS = 3_000;

const SOUND_KEY = "leadAlertSound";
const FONT = "'Plus Jakarta Sans',system-ui,-apple-system,'Segoe UI',sans-serif";

/**
 * The context keys this host cannot function without.
 *
 * Nothing links app chrome to a feature's context at compile time. An earlier cut of this file read
 * `ctx?.toasts` / `ctx?.dismissToast` — names the provider has never published — and optional
 * chaining turned that into an unconditional `return null` on every page: no popup, no chime, no
 * console error, no crash. The feature looked shipped. A dev-only assertion is the cheapest thing
 * that fails loudly instead; `import.meta.env.DEV` is a compile-time constant, so this whole check
 * folds out of the production bundle.
 */
const REQUIRED_CTX = [
  "cards",
  "dismissCard",
  "applyResult",
  "patchLead",
  "markClaimIneligible",
  "canClaim",
];

const SOURCE_COLOR = {
  WEBSITE_FORM: "#2563eb", WEBSITE: "#2563eb", WEBLINK_ENQUIRY: "#2563eb",
  WHATSAPP: "#16a34a", JUSTDIAL: "#ea580c",
  INDIAMART: "#dc2626", TRADEINDIA: "#dc2626", SULEKHA: "#dc2626",
  META_ADS: "#7c3aed", FACEBOOK: "#7c3aed", INSTAGRAM: "#7c3aed",
  INSTAGRAM_DM: "#7c3aed", FB_MESSENGER: "#7c3aed", SOCIAL_MEDIA: "#7c3aed",
  GOOGLE_ADS: "#0ea5e9", WALK_IN: "#0d9488", REFERRAL: "#d946ef",
};
const sourceColor = (key) => SOURCE_COLOR[key] || "#64748b";

const initials = (name) =>
  (name || "?")
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const money = (v) => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

/**
 * Two-note chime via WebAudio.
 *
 * No audio file: a bundled asset is a network request that can 404 on a misconfigured deploy, and
 * browsers block autoplay of <audio> far more aggressively than a WebAudio node. Wrapped in
 * try/catch because a locked AudioContext must never take the popup down with it — the alert
 * matters, the sound does not.
 */
function chime() {
  try {
    if (localStorage.getItem(SOUND_KEY) === "off") return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ac = new Ctx();
    [880, 1320].forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ac.destination);
      const t = ac.currentTime + i * 0.13;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.16, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  } catch {
    /* audio is decoration */
  }
}

export default function LeadAlertHost() {
  const ctx = useLeadAlerts();
  const navigate = useNavigate();
  const [paused, setPaused] = useState(false);

  // arrivedAt of each card we have already chimed for + scheduled. Without this, the provider's
  // once-a-second tick would re-chime and re-schedule the whole stack every render.
  const handled = useRef(new Map());
  const lastChime = useRef(0);
  const timers = useRef(new Map());

  const cards = ctx?.cards;
  const dismissCard = ctx?.dismissCard;

  // Contract check — see REQUIRED_CTX. Once per mount: the provider builds a fresh value object on
  // every render and the SLA tick re-renders it once a second, so the ref is what keeps a broken
  // contract to a single line instead of a console full of them.
  const contractWarned = useRef(false);
  useEffect(() => {
    if (!import.meta.env.DEV || !ctx || contractWarned.current) return;
    const missing = REQUIRED_CTX.filter((k) => !(k in ctx));
    if (missing.length) {
      contractWarned.current = true;
      console.error(
        `[LeadAlertHost] LeadAlertProvider does not publish: ${missing.join(", ")}. ` +
          "The new-lead popup renders nothing until the provider and this host agree."
      );
    }
  }, [ctx]);

  /** Newest first for the eye; the DOM is reversed so the oldest sits in the corner. */
  const shown = (cards ?? []).slice(-MAX_CARDS);
  const hidden = Math.max(0, (cards?.length ?? 0) - shown.length);
  const newest = shown[shown.length - 1];

  const clearTimer = useCallback((id) => {
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const schedule = useCallback(
    (card) => {
      clearTimer(card.leadPublicId);
      const ms = card.shorten ? SHORTENED_MS : CARD_MS;
      timers.current.set(
        card.leadPublicId,
        setTimeout(() => {
          timers.current.delete(card.leadPublicId);
          handled.current.delete(card.leadPublicId);
          dismissCard?.(card.leadPublicId);
        }, ms)
      );
    },
    [clearTimer, dismissCard]
  );

  // Arrive → chime once, start the clock. `arrivedAt` changes on a reopen of a card already on
  // screen, which is the signal to restart the timer without re-inserting anything.
  useEffect(() => {
    if (!cards?.length || !dismissCard) return;
    for (const card of cards) {
      if (handled.current.get(card.leadPublicId) === card.arrivedAt) continue;
      handled.current.set(card.leadPublicId, card.arrivedAt);
      // A reopen is a manager fixing a mis-click, not a new opportunity — silent by design.
      if (!card.silent && Date.now() - lastChime.current > CHIME_THROTTLE_MS) {
        lastChime.current = Date.now();
        chime();
      }
      if (!paused) schedule(card);
    }
  }, [cards, dismissCard, paused, schedule]);

  // Hover or keyboard focus anywhere in the stack freezes every timer. An operator reading a card
  // must not have it evaporate mid-sentence.
  const cardsRef = useRef(cards);
  cardsRef.current = cards;

  useEffect(() => {
    const live = cardsRef.current;
    if (!live?.length) return;
    // Pause/resume ONLY — deliberately NOT keyed on `cards`. Re-running this when a new lead
    // arrives would restart every card already on screen, so a busy minute would pin the first
    // card up indefinitely. New cards get their clock from the arrival effect above.
    if (paused) live.forEach((c) => clearTimer(c.leadPublicId));
    else live.forEach((c) => schedule(c));
  }, [paused, clearTimer, schedule]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current.clear();
    },
    []
  );

  const claimFromCard = useCallback(
    async (card) => {
      try {
        const result = await leadAlertService.claim(card.leadPublicId, card.claimVersion);
        ctx.applyResult(result);
        toast.success(`Claimed — ${card.customerName || card.leadCode || "lead"}`);
      } catch (err) {
        const failure = claimFailure(err);
        if (failure?.retryable && failure.claimVersion != null) {
          // Still winnable. Unlike the queue there is no row to annotate, so the card stays with a
          // fresh version and the operator can hit it again — the retry is the product here.
          ctx.patchLead(card.leadPublicId, { claimVersion: failure.claimVersion });
          toast.error(failure.message);
          return;
        }
        if (failure?.reason === "INELIGIBLE") ctx.markClaimIneligible();
        // From a card there is nowhere to explain it, so this one DOES speak: the user clicked and
        // is owed an answer, and the lead may be gone from view by the time they look.
        toast.error(failure?.message || "Could not claim this lead.");
        ctx.dismissCard(card.leadPublicId);
      }
    },
    [ctx]
  );

  /**
   * Global shortcuts, live on every page.
   *
   * All modifier-gated so they cannot fire mid-typing, and every one bails when focus is in a field
   * anyway — an agent filling a booking form must never lose a keystroke to the alert stack.
   */
  useEffect(() => {
    const onKey = (e) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const key = e.key.toLowerCase();

      if (key === "i") {
        e.preventDefault();
        navigate("/leads/incoming");
        return;
      }
      if (!newest) return;
      if (key === "c" && ctx?.canClaim) {
        e.preventDefault();
        claimFromCard(newest);
      } else if (key === "x") {
        e.preventDefault();
        dismissCard?.(newest.leadPublicId);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [newest, ctx?.canClaim, claimFromCard, dismissCard, navigate]);

  if (!ctx || !shown.length) return null;

  return (
    <div
      // column-reverse over an arrival-ordered array: append renders ABOVE, so the oldest card holds
      // the corner and nothing already on screen ever moves.
      className="pointer-events-none fixed bottom-5 right-5 z-[120] flex w-[356px] max-w-[calc(100vw-2.5rem)] flex-col-reverse gap-2"
      style={{ fontFamily: FONT }}
      aria-live="polite"
      aria-atomic="false"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false);
      }}
    >
      {hidden > 0 ? (
        <div className="pointer-events-auto pr-1 text-right text-[10.5px] font-medium text-slate-400">
          +{hidden} more incoming · Alt+I
        </div>
      ) : null}

      {shown.map((card) => {
        const color = sourceColor(card.sourceKey);
        const value = money(card.value);
        const left =
          card.slaSecondsRemaining == null
            ? null
            : Math.round(
                card.slaSecondsRemaining - (Date.now() - (card.receivedAt ?? Date.now())) / 1000
              );
        const isNewest = card.leadPublicId === newest?.leadPublicId;
        const taken = !!card.shorten;

        return (
          <div
            key={card.leadPublicId}
            className="pointer-events-auto relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/95 shadow-2xl shadow-slate-900/20 backdrop-blur-md"
            style={{ animation: "leadAlertIn .22s ease-out" }}
          >
            <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: color }} />

            {/* Head */}
            <div className="flex items-center gap-2 pl-4 pr-3 pt-3">
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                style={{ background: color }}
              >
                {card.source || "Lead"}
              </span>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                {card.kind === "reopened" ? "reopened" : "new lead"}
              </span>
              <span className="ml-auto flex items-center gap-1.5">
                {isNewest && ctx.canClaim ? (
                  <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-px font-mono text-[9.5px] font-normal text-slate-400">
                    ⌥C
                  </kbd>
                ) : null}
                <button
                  type="button"
                  onClick={() => dismissCard(card.leadPublicId)}
                  className="grid h-5 w-5 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label={`Dismiss ${card.customerName || "lead"}`}
                >
                  <X size={12} />
                </button>
              </span>
            </div>

            {/* Body */}
            <div className="flex gap-2.5 pl-4 pr-3 pt-2.5">
              <div
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-extrabold text-white shadow-sm"
                style={{ background: color }}
              >
                {initials(card.customerName)}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold capitalize text-slate-800">
                  {card.customerName || "New enquiry"}
                  {card.leadCode ? (
                    <span className="ml-1.5 font-mono text-[10px] font-bold text-slate-400">
                      {card.leadCode}
                    </span>
                  ) : null}
                </div>
                <div className="truncate text-xs font-semibold text-slate-600">
                  {[card.destination, value].filter(Boolean).join(" · ") || "Details pending"}
                </div>
                {card.phone ? (
                  <div className="text-[11px] font-medium text-slate-400 tabular-nums">{card.phone}</div>
                ) : null}
              </div>
            </div>

            <div className="pl-4 pr-3 pt-2 text-[11px] font-semibold text-slate-500">
              {taken ? (
                <>
                  Now with <b className="font-extrabold text-slate-700">{card.ownerName}</b> · still
                  open to claim
                </>
              ) : (
                <>
                  Auto-assigned to <b className="font-extrabold text-slate-700">{card.ownerName}</b> ·
                  open until contacted
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pb-3.5 pl-4 pr-3 pt-3">
              {ctx.canClaim ? (
                <button
                  type="button"
                  onClick={() => claimFromCard(card)}
                  className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-200 transition-all hover:bg-blue-700 hover:shadow-lg"
                >
                  Claim
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  dismissCard(card.leadPublicId);
                  navigate("/leads/incoming");
                }}
                className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm transition-all hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
              >
                View
              </button>
              {left != null ? (
                <span
                  className={`ml-auto text-sm font-extrabold tabular-nums ${
                    left <= 0 ? "text-red-600" : "text-slate-500"
                  }`}
                >
                  {formatCountdown(left)}
                </span>
              ) : null}
            </div>

            {/* 2px life bar. Paused with the timers, so it never runs on while the card is frozen. */}
            <span
              className="absolute bottom-0 left-0 h-[2px] bg-blue-600"
              style={{
                animation: `leadAlertProgress ${taken ? SHORTENED_MS : CARD_MS}ms linear forwards`,
                animationPlayState: paused ? "paused" : "running",
              }}
            />
          </div>
        );
      })}

      {/* Scoped keyframes. index.css is 29 lines and deliberately holds only the font + gold scale;
          two animations used by one component do not belong in a global stylesheet. */}
      <style>{`
        @keyframes leadAlertIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes leadAlertProgress { from { width: 100%; } to { width: 0%; } }
        @media (prefers-reduced-motion: reduce) {
          @keyframes leadAlertIn { from { opacity: 1; } to { opacity: 1; } }
        }
      `}</style>
    </div>
  );
}
