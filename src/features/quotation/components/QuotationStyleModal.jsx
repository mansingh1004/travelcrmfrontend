// // "Which design?" picker, shown when a quotation PDF is downloaded.
// //
// // Presentation only: it never fetches, never navigates and never saves. It hands the chosen style
// // back via onSelect(style) and the caller decides what to do with it — which is what lets the same
// // dialog serve a download today and an email/share action later without growing new behaviour.
// //
// // The choice is a ONE-OFF render override (?style= on the PDF endpoint); the quotation's own saved
// // design is untouched, so the customer's share link keeps showing what the agent actually chose.
// //
// // Styling follows AllLeads.jsx's inline-style modal idiom (fixed inset-0 z-50 overlay, click-outside
// // to close, Plus Jakarta Sans set explicitly — the tenant app applies no global font).

// import { useEffect, useRef } from "react";

// import { X, FileText, Sparkles, Crown, Gem, Check } from "lucide-react";

// const FONT = "'Plus Jakarta Sans', system-ui, sans-serif";

// const STYLES = [
//   {
//     value: "CLASSIC",
//     title: "Classic",
//     accent: "#2563eb",
//     icon: FileText,
//     points: ["The original layout your customers know", "Compact, information-dense pages"],
//   },
//   {
//     value: "MODERN",
//     title: "Modern",
//     accent: "#b08d57",
//     icon: Sparkles,
//     points: ["Editorial design with hero photo", "Day-by-day itinerary timeline"],
//   },
//   {
//     value: "PREMIUM",
//     title: "Premium",
//     accent: "#2e4460",
//     icon: Crown,
//     points: ["Quiet-luxury letterhead on ivory paper", "Settlement table, serif typography"],
//   },
//   // The only design NOT rendered by the backend's OpenPDF engine — it goes through headless
//   // Chromium, so it is also the only one that can answer 503 ("not available on this server") when
//   // the browser is missing or pdf.luxury.enabled=false. Nothing here needs to special-case that:
//   // the shared http interceptor already toasts a 5xx, and the caller's usePdfDownload hook clears
//   // its loading state on rejection like it does for any other failure.
//   {
//     value: "LUXURY",
//     title: "Luxury",
//     accent: "#c9a227",
//     icon: Gem,
//     points: ["Full-bleed navy & gold coffee-table book", "Photo cover, day cards, hotel spreads"],
//   },
// ];

// function StyleCard({ def, isSaved, actionLabel, onPick, cardRef }) {
//   const Icon = def.icon;
//   return (
//     <button
//       ref={cardRef}
//       onClick={() => onPick(def.value)}
//       style={{
//         border: "2px solid #e2e8f0", borderRadius: 16, background: "rgba(255,255,255,0.85)",
//         padding: 16, cursor: "pointer", width: "100%", textAlign: "left", fontFamily: FONT,
//         transition: "all .18s",
//       }}
//       onMouseEnter={(e) => { e.currentTarget.style.borderColor = def.accent; e.currentTarget.style.boxShadow = `0 8px 24px ${def.accent}33`; }}
//       onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "none"; }}
//     >
//       <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
//         <div style={{
//           width: 38, height: 38, borderRadius: 11, display: "flex", alignItems: "center",
//           justifyContent: "center", background: `${def.accent}1a`, color: def.accent,
//         }}>
//           <Icon size={19} />
//         </div>
//         {/* Which design this quotation is actually saved as — the one its share link shows. */}
//         {isSaved && (
//           <span style={{
//             fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
//             color: def.accent, background: `${def.accent}14`, border: `1px solid ${def.accent}44`,
//             borderRadius: 999, padding: "3px 9px",
//           }}>Saved</span>
//         )}
//       </div>

//       <div style={{ marginTop: 11, fontSize: 15, fontWeight: 800, color: "#0f172a" }}>{def.title}</div>

//       <ul style={{ margin: "7px 0 0 0", padding: 0, listStyle: "none" }}>
//         {def.points.map((p) => (
//           <li key={p} style={{
//             display: "flex", alignItems: "flex-start", gap: 6, fontSize: 11.5,
//             color: "#475569", fontWeight: 600, padding: "2.5px 0",
//           }}>
//             <Check size={12} style={{ color: def.accent, flexShrink: 0, marginTop: 2 }} /> {p}
//           </li>
//         ))}
//       </ul>

//       <div style={{ marginTop: 11, fontSize: 12, fontWeight: 800, color: def.accent }}>
//         {actionLabel} <span aria-hidden="true">→</span>
//       </div>
//     </button>
//   );
// }

// /**
//  * @param mode "download" (one-off, nothing saved), "share" (the pick is SAVED on the quotation,
//  *             because the customer opens the weblink later and the server renders the stored design),
//  *             or "preview" (one-off, nothing saved — just view the weblink in that design).
//  *             The copy differs so the agent knows which of the three just happened — that difference
//  *             is the whole point, not decoration.
//  */
// export default function QuotationStyleModal({ savedStyle, mode = "download", onSelect, onClose }) {
//   const isShare = mode === "share";
//   const isPreview = mode === "preview";
//   const heading = isShare ? "Share as" : isPreview ? "Preview as" : "Download as";
//   const subtitle = isShare
//     ? "This becomes the design your customer sees when they open the link."
//     : isPreview
//       ? "See the weblink in this design. Nothing is saved — the customer's link stays as it is."
//       : "Pick a design for this download. The quotation itself stays as it is.";
//   const actionLabel = isShare ? "Share" : isPreview ? "Preview" : "Download";

//   /* Esc closes, and the saved design takes focus on open. Neither existed: the dialog could only be
//      dismissed with the mouse, which stalled a keyboard-driven agent at the very last step of the
//      flow — the one they reach after Ctrl+Enter has already created the quotation.

//      Focus lands on the SAVED design because it is the answer nine times out of ten, so Enter alone
//      finishes the job. Bound on the document, not the overlay, because focus is inside this dialog
//      and nothing above it should see the key; the listener is removed on unmount, so the two open
//      styles this dialog is used in (download and share) can never leave a stale handler behind. */
//   const firstCardRef = useRef(null);
//   useEffect(() => {
//     const onKey = (event) => {
//       if (event.key !== "Escape") return;
//       event.preventDefault();
//       onClose();
//     };
//     document.addEventListener("keydown", onKey);
//     firstCardRef.current?.focus();
//     return () => document.removeEventListener("keydown", onKey);
//   }, [onClose]);

//   const savedValue = savedStyle || "CLASSIC";

//   return (
//     <div
//       className="fixed inset-0 z-50 flex items-center justify-center p-4"
//       style={{ background: "rgba(15,23,42,0.45)", backdropFilter: "blur(3px)" }}
//       onClick={(e) => e.target === e.currentTarget && onClose()}
//     >
//       <div
//         className="w-full rounded-2xl border border-slate-200/60 shadow-2xl"
//         style={{ maxWidth: 760, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)", fontFamily: FONT }}
//       >
//         <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "18px 20px 0 20px" }}>
//           <div>
//             <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>{heading}</div>
//             <div style={{ fontSize: 11.5, color: "#64748b", fontWeight: 600, marginTop: 3 }}>
//               {subtitle}
//             </div>
//           </div>
//           <button onClick={onClose} aria-label="Close"
//             style={{ border: "none", background: "transparent", cursor: "pointer", color: "#94a3b8", padding: 4 }}>
//             <X size={18} />
//           </button>
//         </div>

//         <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, padding: 20 }}>
//           {STYLES.map((def) => (
//             <StyleCard
//               key={def.value}
//               def={def}
//               cardRef={def.value === savedValue ? firstCardRef : undefined}
//               isSaved={savedValue === def.value}
//               actionLabel={actionLabel}
//               onPick={onSelect}
//             />
//           ))}
//         </div>
//       </div>
//     </div>
//   );
// }








// "Which design?" picker, shown when a quotation PDF is downloaded.
//
// Presentation only: it never fetches, never navigates and never saves. It hands the chosen style
// back via onSelect(style) and the caller decides what to do with it — which is what lets the same
// dialog serve a download today and an email/share action later without growing new behaviour.
//
// The choice is a ONE-OFF render override (?style= on the PDF endpoint); the quotation's own saved
// design is untouched, so the customer's share link keeps showing what the agent actually chose.
//
// RESPONSIVE CONTRACT
// ───────────────────
// The dialog is a scroll CONTAINER, not a block that happens to fit. It used to be neither: a
// centred box with no height cap and no overflow rule, so four stacked cards on a 320×642 phone
// ran off the bottom of the viewport and the last design could not be reached, let alone tapped.
// That is a functional failure, not a cosmetic one — the picker silently offered three of its four
// options. The header is now pinned and only the card grid scrolls, so the heading that says what
// picking a card DOES ("this becomes the design your customer sees") stays on screen while the
// agent scrolls the choices.
//
//   < sm   bottom sheet: full width, rounded top, capped at 88dvh, thumb-reachable
//   ≥ sm   centred dialog, capped at the viewport minus a 2rem gutter
//
// dvh, not vh: on mobile Safari/Chrome `100vh` is the viewport WITHOUT the browser chrome, so a
// vh-based cap puts the last card under the address bar — the exact bug this is fixing.
//
// Styling follows AllLeads.jsx's inline-style modal idiom (fixed inset-0 z-50 overlay, click-outside
// to close, Plus Jakarta Sans set explicitly — the tenant app applies no global font). Layout and
// interaction state moved to Tailwind classes, because inline styles cannot express a media query
// and the hover treatment has to be one: Tailwind's `hover:` compiles under @media (hover: hover),
// so a tap on a touch screen no longer leaves a card stuck in its hover colour.

import { useEffect, useRef } from "react";

import { X, FileText, Sparkles, Crown, Gem, Check } from "lucide-react";

const FONT = "'Plus Jakarta Sans', system-ui, sans-serif";

const STYLES = [
  {
    value: "CLASSIC",
    title: "Classic",
    accent: "#2563eb",
    icon: FileText,
    points: ["The original layout your customers know", "Compact, information-dense pages"],
  },
  {
    value: "MODERN",
    title: "Modern",
    accent: "#b08d57",
    icon: Sparkles,
    points: ["Editorial design with hero photo", "Day-by-day itinerary timeline"],
  },
  {
    value: "PREMIUM",
    title: "Premium",
    accent: "#2e4460",
    icon: Crown,
    points: ["Quiet-luxury letterhead on ivory paper", "Settlement table, serif typography"],
  },
  // The only design NOT rendered by the backend's OpenPDF engine — it goes through headless
  // Chromium, so it is also the only one that can answer 503 ("not available on this server") when
  // the browser is missing or pdf.luxury.enabled=false. Nothing here needs to special-case that:
  // the shared http interceptor already toasts a 5xx, and the caller's usePdfDownload hook clears
  // its loading state on rejection like it does for any other failure.
  {
    value: "LUXURY",
    title: "Luxury",
    accent: "#c9a227",
    icon: Gem,
    points: ["Full-bleed navy & gold coffee-table book", "Photo cover, day cards, hotel spreads"],
  },
];

/* Column count follows the number of designs so the last row is never a lone orphan:
   4 designs → 2×2, 3 designs → one row of 3. Both class strings appear as literals here on purpose;
   Tailwind scans source text, so a template-built class name would not be generated. */
const GRID_COLS = STYLES.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";

function StyleCard({ def, isSaved, actionLabel, onPick, cardRef }) {
  const Icon = def.icon;
  return (
    <button
      ref={cardRef}
      onClick={() => onPick(def.value)}
      /* The accent is per-design and therefore dynamic, so it rides in as CSS custom properties and
         the hover/focus rules below read them. That keeps the visual behaviour in CSS — where the
         hover media query and :focus-visible live — instead of in onMouseEnter handlers that fire
         on touch and never fire for the keyboard. */
      style={{ "--accent": def.accent, "--accent-soft": `${def.accent}33`, fontFamily: FONT }}
      className="w-full cursor-pointer rounded-2xl border-2 border-slate-200 bg-white/85 p-3.5 text-left
        outline-none transition-all duration-150
        hover:border-[var(--accent)] hover:shadow-[0_8px_24px_var(--accent-soft)]
        focus-visible:border-[var(--accent)] focus-visible:shadow-[0_8px_24px_var(--accent-soft)]
        focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40
        sm:p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl sm:h-[38px] sm:w-[38px]"
          style={{ background: `${def.accent}1a`, color: def.accent }}
        >
          <Icon size={19} />
        </span>
        {/* Which design this quotation is actually saved as — the one its share link shows. */}
        {isSaved && (
          <span
            className="rounded-full border px-2.5 py-[3px] text-[9px] font-extrabold uppercase tracking-[0.08em]"
            style={{ color: def.accent, background: `${def.accent}14`, borderColor: `${def.accent}44` }}
          >
            Saved
          </span>
        )}
      </div>

      <div className="mt-2.5 text-[15px] font-extrabold text-slate-900">{def.title}</div>

      <ul className="m-0 mt-1.5 list-none p-0">
        {def.points.map((p) => (
          <li key={p} className="flex items-start gap-1.5 py-[2.5px] text-[11.5px] font-semibold text-slate-600">
            <Check size={12} className="mt-0.5 flex-shrink-0" style={{ color: def.accent }} /> {p}
          </li>
        ))}
      </ul>

      <div className="mt-2.5 text-xs font-extrabold" style={{ color: def.accent }}>
        {actionLabel} <span aria-hidden="true">→</span>
      </div>
    </button>
  );
}

/**
 * @param mode "download" (one-off, nothing saved), "share" (the pick is SAVED on the quotation,
 *             because the customer opens the weblink later and the server renders the stored design),
 *             or "preview" (one-off, nothing saved — just view the weblink in that design).
 *             The copy differs so the agent knows which of the three just happened — that difference
 *             is the whole point, not decoration.
 */
export default function QuotationStyleModal({ savedStyle, mode = "download", onSelect, onClose }) {
  const isShare = mode === "share";
  const isPreview = mode === "preview";
  const heading = isShare ? "Share as" : isPreview ? "Preview as" : "Download as";
  const subtitle = isShare
    ? "This becomes the design your customer sees when they open the link."
    : isPreview
      ? "See the weblink in this design. Nothing is saved — the customer's link stays as it is."
      : "Pick a design for this download. The quotation itself stays as it is.";
  const actionLabel = isShare ? "Share" : isPreview ? "Preview" : "Download";

  /* Esc closes, and the saved design takes focus on open. Neither existed: the dialog could only be
     dismissed with the mouse, which stalled a keyboard-driven agent at the very last step of the
     flow — the one they reach after Ctrl+Enter has already created the quotation.

     Focus lands on the SAVED design because it is the answer nine times out of ten, so Enter alone
     finishes the job. Bound on the document, not the overlay, because focus is inside this dialog
     and nothing above it should see the key; the listener is removed on unmount, so the two open
     styles this dialog is used in (download and share) can never leave a stale handler behind.

     The body scroll lock is part of the same fix as the height cap: now that the dialog scrolls,
     a flick that runs past the last card would otherwise scroll the LEADS LIST behind it, and the
     agent returns from the modal to a page that has moved. Padding compensates for the scrollbar
     the lock removes, so the page underneath does not jump sideways on desktop. */
  const firstCardRef = useRef(null);
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", onKey);
    firstCardRef.current?.focus();

    const { overflow, paddingRight } = document.body.style;
    const gutter = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (gutter > 0) document.body.style.paddingRight = `${gutter}px`;

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
    };
  }, [onClose]);

  const savedValue = savedStyle || "CLASSIC";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      style={{ background: "rgba(15,23,42,0.45)", backdropFilter: "blur(3px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        /* flex column + min-h-0 on the scroller is the whole mechanism: the header keeps its
           natural height, the grid takes the rest and scrolls inside it. Without min-h-0 a flex
           child refuses to shrink below its content and the overflow never engages. */
        className="flex w-full max-h-[88dvh] flex-col rounded-t-2xl border border-slate-200/60 shadow-2xl
          sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl"
        style={{
          maxWidth: 760,
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(12px)",
          fontFamily: FONT,
        }}
      >
        {/* Grab handle — the affordance that says "this sheet scrolls", and only on the sheet. */}
        <div className="mx-auto mt-2.5 h-1 w-9 flex-shrink-0 rounded-full bg-slate-300 sm:hidden" />

        <div className="flex flex-shrink-0 items-start justify-between gap-3 px-4 pt-3.5 sm:px-5 sm:pt-[18px]">
          <div className="min-w-0">
            <div className="text-[15px] font-extrabold text-slate-900 sm:text-base">{heading}</div>
            <div className="mt-[3px] text-[11.5px] font-semibold leading-snug text-slate-500">
              {subtitle}
            </div>
          </div>
          {/* 36px hit area on touch — the old 26px square was below every touch-target guideline,
              and it is the control someone reaches for when they opened this dialog by mistake. */}
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1.5 -mt-1.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg
              border-none bg-transparent text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* The scroll region. Everything above it stays put. */}
        <div className={`grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto overscroll-contain p-4 sm:p-5 ${GRID_COLS}`}>
          {STYLES.map((def) => (
            <StyleCard
              key={def.value}
              def={def}
              cardRef={def.value === savedValue ? firstCardRef : undefined}
              isSaved={savedValue === def.value}
              actionLabel={actionLabel}
              onPick={onSelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
