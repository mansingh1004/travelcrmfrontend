// src/features/marketplace/components/packageTheme.js
//
// The package catalog's blue accent, in one place.
//
// ── Why this is a constants file and not a change to marketplaceUi ──────────────────────────
//
// The kit's primary is a flat `bg-slate-900`, and that is deliberate — it is the Notion/Linear
// north star this feature was built to. The owner asked for the package screens to look like the
// reference product, which is blue. Changing the kit itself would repaint the hotel and transport
// marketplaces too, and nobody asked for that.
//
// So the blue lives here, the package screens opt into it, and its siblings are untouched. One file
// to change if the accent moves again.
//
// ── Why passing these as `className` actually works ─────────────────────────────────────────
//
// marketplaceUi's Button composes with `cn()` = twMerge, which RESOLVES conflicting Tailwind
// utilities rather than concatenating them — so `bg-blue-600` passed in genuinely beats the
// variant's `bg-slate-900`. That is not true of the template-literal kits elsewhere in this repo,
// where a later class silently loses to an earlier one and a "fix" appears to do nothing. If you
// reuse this pattern, check the component merges before assuming an override lands.

/** Solid primary action — the blue on the reference product's buttons. */
export const PKG_PRIMARY =
  "bg-blue-600 hover:bg-blue-700 text-white border-blue-600 hover:border-blue-700";

/** A secondary action that still reads as ours: blue text, hairline blue edge. */
export const PKG_SECONDARY =
  "border-blue-200 text-blue-700 hover:border-blue-300 hover:bg-blue-50";

/** Selected chip / active filter. */
export const PKG_CHIP_ON = "border-blue-600 bg-blue-600 text-white";

/** The active tab underline. */
export const PKG_TAB_ON = "border-blue-600 text-blue-700";

/** Accent text — links, the price figure, anything that should read as the brand. */
export const PKG_ACCENT_TEXT = "text-blue-700";

/** A soft blue surface for callouts that are informational rather than a warning. */
export const PKG_SOFT = "border-blue-200 bg-blue-50 text-blue-900";

/** Inline link style, for the places a real <Link> replaces a Button. */
export const PKG_LINK_BTN =
  "rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700";
