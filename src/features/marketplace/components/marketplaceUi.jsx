// src/features/marketplace/components/marketplaceUi.jsx
//
// The Hotel Marketplace UI kit.
//
// DESIGN NORTH STAR — "Notion row entry / Linear issue creation", set by the owner 2026-08-03:
// fast, keyboard-first, minimal chrome, generous whitespace, **subtle borders instead of heavy
// shadows**. Explicitly NOT a boxed enterprise form.
//
// This deliberately DEPARTS from the house kit documented in CLAUDE.md (glass cards
// `bg-white/80 backdrop-blur-md rounded-2xl`, gradient primary buttons with `shadow-md
// shadow-blue-200`). The rule CLAUDE.md states for fleetUi-vs-marketing applies here too: don't mix
// two idioms on one screen. So every marketplace page — including the two catalog pages that predate
// this kit — renders through it.
//
// What that means concretely:
//   • hairline `border-slate-200` + `rounded-lg`; shadows only where something floats (overlay/menu)
//   • flat `bg-slate-900` primary — no gradient, no coloured shadow
//   • quiet labels (`text-xs text-slate-500`), not uppercase-extrabold-tracking
//   • plain `bg-white` page, no gradient wash
//   • every interactive surface is reachable and dismissable from the keyboard
//
// Feature-local by rule: nothing outside `features/marketplace` imports from here, and this file is
// not re-exported from the feature barrel.

import * as React from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, ImageOff, Inbox, Loader2, X } from "lucide-react";
import { cn } from "@shared/lib/cn";

export { cn };
export { useToast } from "@shared/ui/toast";
export { getErrorMessage as errMsg, isAlreadyReported } from "@shared/api/apiError";

/** The app sets no global font-family — every page supplies its own or renders in the browser default. */
export const FONT = { fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" };

/* ═══════════════════════════════════════════════════════════════
   KEYBOARD — the north star's first requirement
═══════════════════════════════════════════════════════════════ */

/**
 * Arrow keys answer to a short name as well as to the raw `event.key`.
 *
 * Carrying two spellings for one key is a tiny cost next to the failure it prevents: a photo viewer
 * whose arrow keys silently do nothing because the map was written `{ left: prev }` while the
 * dispatcher only ever looked up `arrowleft`. Most specific first — an explicit `arrowleft` handler
 * still wins if a caller registers both.
 */
const KEY_ALIASES = {
  arrowleft: ["left", "arrowleft"],
  arrowright: ["right", "arrowright"],
  arrowup: ["up", "arrowup"],
  arrowdown: ["down", "arrowdown"],
};

/**
 * Window-level hotkeys. Pass a map of `combo -> handler`, e.g.
 * `useHotkeys({ "mod+enter": submit, esc: close })`.
 *
 * Recognised names: any single character (`/`, `k`), `esc`, and the arrows as `left`/`right`/
 * `up`/`down` (the raw `arrowleft` spelling works too). Prefix with `mod+` for ⌘/Ctrl.
 *
 * Deliberately ignores keystrokes aimed at a text field UNLESS the combo carries a modifier — so `/`
 * can focus search from anywhere without hijacking the letter while someone is typing a guest name,
 * while ⌘↵ still submits from inside a textarea. Arrows inherit that guard on purpose: inside an
 * input an arrow moves the caret, and stealing it to page a gallery would be worse than useless.
 */
export function useHotkeys(map, { enabled = true } = {}) {
  const ref = useRef(map);

  // Written in an effect, not during render: mutating a ref while rendering is a React Compiler
  // violation. No deps array on purpose — this runs after every render, so the listener below (which
  // is bound once) always dispatches through the latest handlers rather than a stale closure.
  useEffect(() => {
    ref.current = map;
  });

  useEffect(() => {
    if (!enabled) return undefined;
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key?.toLowerCase();
      if (!key) return;
      // Escape keeps its pre-alias behaviour exactly: it maps to "esc" whatever modifiers are held,
      // so ⌘Esc still closes. Everything else takes the mod+ prefix and may have alias spellings.
      const candidates =
        key === "escape"
          ? ["esc"]
          : (KEY_ALIASES[key] ?? [key]).map((name) => `${mod ? "mod+" : ""}${name}`);
      const combo = candidates.find((c) => ref.current?.[c]);
      const handler = combo ? ref.current[combo] : undefined;
      if (!handler) return;

      const el = e.target;
      const typing =
        el instanceof HTMLElement &&
        (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      // A bare letter must not fire while the user is typing; esc and modifier combos always fire.
      if (typing && !mod && combo !== "esc") return;

      e.preventDefault();
      handler(e);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}

/** Renders ⌘ on Apple platforms and Ctrl elsewhere, so the hint matches the key that actually works. */
const IS_APPLE =
  typeof navigator !== "undefined" && /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent || "");

export function Kbd({ children, className }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-slate-200",
        "bg-slate-50 px-1.5 font-sans text-[12px] font-medium text-slate-500",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

/** `<Hint keys={["mod","enter"]}/>` → ⌘ ↵ */
export function Hint({ keys = [], label, className }) {
  const render = (k) =>
    k === "mod" ? (IS_APPLE ? "⌘" : "Ctrl") : k === "enter" ? "↵" : k === "esc" ? "Esc" : k;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[12px] text-slate-500", className)}>
      {label && <span>{label}</span>}
      {keys.map((k) => (
        <Kbd key={k}>{render(k)}</Kbd>
      ))}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE CHROME — flat, quiet, wide gutters
═══════════════════════════════════════════════════════════════ */

export function Page({ children, width = "max-w-5xl", className }) {
  return (
    <div className="min-h-screen bg-white" style={FONT}>
      <div className={cn("mx-auto px-5 py-8 sm:px-8", width, className)}>{children}</div>
    </div>
  );
}

/** Title block. No icon tile, no gradient — the page name carries itself. */
export function PageHeader({ title, subtitle, back, actions, className }) {
  return (
    <div className={cn("mb-8", className)}>
      {back}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function BackLink({ onClick, children = "Back" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-4 -ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-sm text-slate-500 transition-colors hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/10"
    >
      ← {children}
    </button>
  );
}

/** A bordered container. `flush` drops the padding for tables/lists that manage their own. */
export function Card({ children, className, flush = false }) {
  return (
    <div className={cn("rounded-lg border border-slate-200 bg-white", flush ? "" : "p-5", className)}>{children}</div>
  );
}

export function Divider({ className }) {
  return <div className={cn("h-px bg-slate-100", className)} />;
}

/** Quiet section label — replaces the house kit's uppercase-extrabold header bars. */
export function SectionLabel({ children, className }) {
  return <p className={cn("mb-3 text-xs font-semibold uppercase tracking-wide text-slate-600", className)}>{children}</p>;
}

/* ═══════════════════════════════════════════════════════════════
   THE ROW — this is the Notion "row entry" primitive
═══════════════════════════════════════════════════════════════ */

/**
 * One labelled row: quiet label in a fixed left column, control on the right, hairline underneath.
 * Rows stack into a `<RowGroup>` with no outer box, which is what keeps a long form from reading as
 * a boxed enterprise form.
 */
export function Row({ label, hint, required, error, children, htmlFor, align = "center" }) {
  return (
    <div className="border-b border-slate-100 py-2.5 last:border-b-0">
      <div className={cn("flex flex-col gap-1 sm:flex-row sm:gap-4", align === "top" ? "sm:items-start" : "sm:items-center")}>
        <label
          htmlFor={htmlFor}
          className={cn(
            "shrink-0 text-sm text-slate-500 sm:w-44 sm:pt-0",
            align === "top" && "sm:pt-2",
          )}
        >
          {label}
          {required && <span className="ml-0.5 text-slate-400">*</span>}
        </label>
        <div className="min-w-0 flex-1">
          {children}
          {error ? (
            <p className="mt-1 text-xs text-red-600">{error}</p>
          ) : hint ? (
            <p className="mt-1 text-xs text-slate-500">{hint}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function RowGroup({ children, className }) {
  return <div className={cn("border-t border-slate-100", className)}>{children}</div>;
}

/* ═══════════════════════════════════════════════════════════════
   CONTROLS — borderless at rest, outlined on focus
═══════════════════════════════════════════════════════════════ */

const FIELD_BASE =
  "w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm text-slate-900 " +
  "placeholder:text-slate-400 transition-colors " +
  "hover:border-slate-200 hover:bg-slate-50/60 " +
  "focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/5 " +
  "disabled:cursor-not-allowed disabled:text-slate-500 disabled:hover:border-transparent disabled:hover:bg-transparent";

export const Input = React.forwardRef(function Input({ className, invalid, ...props }, ref) {
  return <input ref={ref} className={cn(FIELD_BASE, invalid && "border-red-200 bg-red-50/40", className)} {...props} />;
});

export const Textarea = React.forwardRef(function Textarea({ className, rows = 3, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={cn(FIELD_BASE, "resize-y leading-relaxed", className)} {...props} />;
});

export const Select = React.forwardRef(function Select({ className, children, invalid, ...props }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(FIELD_BASE, "cursor-pointer appearance-none pr-8", invalid && "border-red-200 bg-red-50/40", className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
    </div>
  );
});

/** Number field that reports a real `number | ""`, so a cleared box never posts the string "". */
export const NumberInput = React.forwardRef(function NumberInput({ onValueChange, className, ...props }, ref) {
  return (
    <Input
      ref={ref}
      type="number"
      inputMode="numeric"
      className={cn("[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none", className)}
      onChange={(e) => {
        const raw = e.target.value;
        onValueChange?.(raw === "" ? "" : Number(raw));
      }}
      {...props}
    />
  );
});

/** Stepper for small counts (rooms/adults/children) — faster than typing, and keyboard-reachable. */
export function Stepper({ value, onChange, min = 0, max = 99, label }) {
  const v = Number(value) || 0;
  const set = (next) => onChange(Math.min(max, Math.max(min, next)));
  const btn =
    "flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/10 disabled:opacity-40 disabled:hover:border-slate-200";
  return (
    <div className="inline-flex items-center gap-2" role="group" aria-label={label}>
      <button type="button" className={btn} onClick={() => set(v - 1)} disabled={v <= min} aria-label={`Decrease ${label}`}>
        −
      </button>
      <span className="w-6 text-center text-sm tabular-nums text-slate-900">{v}</span>
      <button type="button" className={btn} onClick={() => set(v + 1)} disabled={v >= max} aria-label={`Increase ${label}`}>
        +
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BUTTONS — flat. No gradients, no coloured shadows.
═══════════════════════════════════════════════════════════════ */

const BTN_BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-slate-900/20 " +
  "disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0";

const BTN_VARIANTS = {
  primary: "bg-slate-900 text-white hover:bg-slate-800",
  secondary: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
  ghost: "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
  danger: "bg-red-600 text-white hover:bg-red-700",
  dangerQuiet: "border border-red-200 bg-white text-red-600 hover:bg-red-50",
};

const BTN_SIZES = { sm: "h-7 px-2.5", md: "h-8 px-3", lg: "h-9 px-4" };

export const Button = React.forwardRef(function Button(
  { variant = "secondary", size = "md", type = "button", loading, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(BTN_BASE, BTN_VARIANTS[variant] ?? BTN_VARIANTS.secondary, BTN_SIZES[size] ?? BTN_SIZES.md, className)}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" />}
      {children}
    </button>
  );
});

/* ═══════════════════════════════════════════════════════════════
   STATUS — a dot and a word, not a saturated pill
═══════════════════════════════════════════════════════════════ */

/**
 * Every {@code MarketplaceBookingStatus}. Keep in step with the backend enum — an unmapped value
 * falls through to a neutral dot and the raw string rather than rendering blank.
 */
export const BOOKING_STATUS = {
  REQUESTED:                { label: "Requested",       dot: "bg-amber-500",   tone: "text-amber-700" },
  UNDER_REVIEW:             { label: "Under review",    dot: "bg-blue-500",    tone: "text-blue-700" },
  TENANT_APPROVAL_REQUIRED: { label: "Needs your OK",   dot: "bg-orange-500",  tone: "text-orange-700" },
  TENANT_ACCEPTED:          { label: "You accepted",    dot: "bg-indigo-500",  tone: "text-indigo-700" },
  CONFIRMED:                { label: "Confirmed",       dot: "bg-emerald-500", tone: "text-emerald-700" },
  REJECTED:                 { label: "Rejected",        dot: "bg-red-500",     tone: "text-red-700" },
  CANCEL_REQUESTED:         { label: "Cancelling",      dot: "bg-orange-500",  tone: "text-orange-700" },
  CANCELLED:                { label: "Cancelled",       dot: "bg-slate-400",   tone: "text-slate-600" },
  EXPIRED:                  { label: "Expired",         dot: "bg-slate-400",   tone: "text-slate-600" },
};

export function StatusDot({ status, withLabel = true, className }) {
  const c = BOOKING_STATUS[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-sm", c?.tone ?? "text-slate-600", className)}>
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", c?.dot ?? "bg-slate-300")} />
      {withLabel && (c?.label ?? status ?? "—")}
    </span>
  );
}

/** Neutral chip for non-status metadata (city, room, meal plan). */
export function Chip({ children, className }) {
  return (
    <span className={cn("inline-flex items-center rounded border border-slate-200 px-1.5 py-0.5 text-[12px] text-slate-600", className)}>
      {children}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FILTER TABS — underline, not filled pills
═══════════════════════════════════════════════════════════════ */

export function Tabs({ options, value, onChange, className }) {
  return (
    <div className={cn("flex items-center gap-1 overflow-x-auto border-b border-slate-200", className)} role="tablist">
      {options.map((o) => {
        const active = (value ?? "") === o.value;
        return (
          <button
            key={o.value || "all"}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/10",
              active
                ? "border-slate-900 font-medium text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-900",
            )}
          >
            {o.label}
            {o.count != null && <span className="ml-1.5 text-[12px] tabular-nums text-slate-500">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   OVERLAY — the one place a shadow is legitimate
═══════════════════════════════════════════════════════════════ */

/**
 * Centred modal. Esc closes, focus moves in on open and returns to the opener on close, and Tab is
 * trapped inside — a dialog you cannot escape from the keyboard fails the north star.
 *
 * `surface="dark"` swaps the chrome, NOT the machinery: an opaque dark backdrop and a full-bleed,
 * unpadded, unbounded panel that the child owns end to end (no header bar, no footer, no card).
 * That exists for one reason — a photograph. The default surface is a translucent scrim over a
 * bounded white card, which is right behind a form and actively wrong behind an image: the scrim
 * lets the page bleed through the letterboxing and the card's padding shrinks the picture. Every
 * existing caller omits the prop and renders byte-identically to before.
 *
 * A dark caller still gets the portal, the scroll lock, the capture-phase Escape, the full Tab trap
 * and the focus-return, because those are the parts that are hard to get right and must not be
 * reimplemented per overlay.
 */
export function Modal({
  open, onClose, title, description, children, footer, width = "max-w-lg", surface = "light",
}) {
  const panelRef = useRef(null);
  const openerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    openerRef.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const t = setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const first = panel.querySelector(
        "input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex='-1'])",
      );
      (first ?? panel).focus();
    }, 0);

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(
        panel.querySelectorAll(
          "input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])",
        ),
      ).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey, true);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
      if (openerRef.current instanceof HTMLElement) openerRef.current.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const bare = surface === "dark";

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 flex",
        bare ? "overflow-hidden" : "items-start justify-center overflow-y-auto p-4 sm:items-center",
      )}
      style={FONT}
    >
      {/* Opaque, not a scrim, when dark: page text showing through the letterbox bars around a photo
          reads as a rendering fault, and it drags the eye off the only thing on screen that matters. */}
      <div
        className={cn("fixed inset-0", bare ? "bg-slate-950" : "bg-slate-900/20")}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        tabIndex={-1}
        className={cn(
          "relative z-10 focus:outline-none",
          bare
            ? "flex h-full w-full flex-col"
            : cn("w-full rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5", width),
        )}
      >
        {!bare && (title || description) && (
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                {title && <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>}
                {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mr-1 -mt-1 rounded p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
        {/* `min-h-0` is load-bearing on the dark panel: without it a flex child refuses to shrink
            below its content and an over-tall photo pushes the viewer past the viewport. */}
        <div className={bare ? "flex min-h-0 flex-1 flex-col" : "px-5 py-4"}>{children}</div>
        {!bare && footer && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* ═══════════════════════════════════════════════════════════════
   MEDIA — a catalog photograph is content, not decoration
═══════════════════════════════════════════════════════════════ */

/**
 * An image that reserves its box up front and fails in words rather than as a broken-image glyph.
 *
 * Catalog photos are platform-owned Cloudinary URLs, and a withdrawn or mistyped one is a real,
 * recurring state — the console's partner-review screen learned that the hard way. Three rules
 * follow, and each one is here to stop a specific misreading:
 *
 *   • the wrapper reserves the box with an aspect ratio BEFORE any bytes land. The API carries no
 *     width/height, so without it a grid reflows as photos arrive and the tile under the cursor is
 *     no longer the tile that gets clicked.
 *   • a failure is ANNOUNCED, not silently hidden. A hole where a photo should be reads as "this
 *     hotel has fewer photos", which is a different and wrong conclusion from "this photo is dead".
 *   • the failure is recorded as a `data-broken` attribute rather than React state. When a whole
 *     gallery points at a dead account every tile errors inside one frame, and forty setStates in a
 *     single tick is a stall the user can see. Same idiom as the console's Thumb.
 *
 * Pass a `className` carrying the aspect box (`aspect-[4/3]`, `h-full`, …); `cn` is twMerge, so a
 * caller on a dark surface can override the light placeholder background from the same prop.
 */
export function Photo({ src, alt, className, imgClassName, fit = "cover", fallback, ...imgProps }) {
  // A `span`, not a `div`, because nearly every caller wraps this in a `<button>` to open a viewer,
  // and a button's content model is phrasing content only. `block` restores the layout behaviour.
  return (
    <span className={cn("relative block overflow-hidden bg-slate-100", className)}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={cn("h-full w-full", fit === "contain" ? "object-contain" : "object-cover", imgClassName)}
        onError={(e) => {
          e.currentTarget.style.display = "none";
          const parent = e.currentTarget.parentElement;
          if (parent) parent.dataset.broken = "1";
        }}
        {...imgProps}
      />
      <span className="absolute inset-0 hidden flex-col items-center justify-center gap-1 px-2 text-center [span[data-broken]_&]:flex">
        {fallback ?? (
          <>
            <ImageOff className="h-4 w-4 text-slate-500" />
            <span className="text-[12px] text-slate-500">Image failed to load</span>
          </>
        )}
      </span>
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   COMBOBOX — type to search, arrows to move, ↵ to pick
═══════════════════════════════════════════════════════════════ */

/**
 * Async single-select. The keyboard path is the primary one, not an accessibility afterthought:
 * ↑/↓ move, ↵ picks the active row, Esc closes without picking, Tab closes and moves on.
 *
 * `search(term, signal)` must resolve to an array of `{ value, label, hint? }`. It is called
 * debounced, and every in-flight call is aborted when the term changes — otherwise a slow early
 * response lands after a fast later one and silently replaces the right results with stale ones.
 */
export function Combobox({
  value,            // { value, label, hint } | null
  onChange,
  search,
  placeholder = "Type to search…",
  emptyText = "No matches",
  minChars = 2,
  id,
  invalid,
}) {
  const [term, setTerm] = useState("");
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef(null);
  const listId = `${id ?? "cb"}-listbox`;

  // Debounced search. Every setState lives inside the timeout callback, never in the effect body —
  // a synchronous setState during an effect cascades a second render on every keystroke.
  //
  // The stale-result guard is the `aborted` check AFTER the await, not the abort itself: the two
  // services this feeds (customerService.list, bookingService.search) take no config argument, so
  // the signal never reaches axios and the HTTP request is not actually cancelled. What the guard
  // does guarantee is ordering — a slow early response can never overwrite a fast later one.
  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      if (term.trim().length < minChars) {
        setItems([]);
        setBusy(false);
        return;
      }
      setBusy(true);
      try {
        const rows = await search(term.trim(), ctrl.signal);
        if (ctrl.signal.aborted) return;
        setItems(Array.isArray(rows) ? rows : []);
        setActive(0);
      } catch {
        if (!ctrl.signal.aborted) setItems([]);
      } finally {
        if (!ctrl.signal.aborted) setBusy(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [term, minChars, search]);

  // Close when focus or a click leaves the widget entirely.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (item) => {
    onChange(item);
    setOpen(false);
    setTerm("");
  };

  if (value) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex min-w-0 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
          <span className="truncate text-sm text-slate-900">{value.label}</span>
          {value.hint && <span className="shrink-0 text-[12px] text-slate-500">{value.hint}</span>}
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/10"
          aria-label="Clear selection"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        className={cn(FIELD_BASE, invalid && "border-red-200 bg-red-50/40")}
        placeholder={placeholder}
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, items.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            // Only swallow Enter when there is something to pick, so ⌘↵-to-submit still works.
            if (open && items[active]) {
              e.preventDefault();
              e.stopPropagation();
              pick(items[active]);
            }
          } else if (e.key === "Escape") {
            if (open) {
              e.stopPropagation();
              setOpen(false);
            }
          } else if (e.key === "Tab") {
            setOpen(false);
          }
        }}
      />

      {open && term.trim().length >= minChars && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg shadow-slate-900/5"
        >
          {busy ? (
            <li className="px-3 py-2 text-sm text-slate-500">Searching…</li>
          ) : items.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500">{emptyText}</li>
          ) : (
            items.map((it, i) => (
              <li
                key={it.value}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault(); // keep focus in the input so blur does not close before the click
                  pick(it);
                }}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-sm",
                  i === active ? "bg-slate-100 text-slate-900" : "text-slate-700",
                )}
              >
                <span className="truncate">{it.label}</span>
                {it.hint && <span className="shrink-0 text-[12px] text-slate-500">{it.hint}</span>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STATES
═══════════════════════════════════════════════════════════════ */

export function Loading({ label = "Loading…", className }) {
  return (
    <div className={cn("flex items-center justify-center gap-2 py-16 text-slate-500", className)}>
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function Empty({ icon: Icon = Inbox, title = "Nothing here yet", hint, action, className }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-1.5 py-16 text-center", className)}>
      <Icon className="mb-1 h-6 w-6 text-slate-300" />
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {hint && <p className="max-w-sm text-sm text-slate-500">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function SkeletonRows({ count = 5, className }) {
  return (
    <div className={cn("divide-y divide-slate-100", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-3.5">
          <div className="h-3 w-1/4 animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-1/6 animate-pulse rounded bg-slate-100" />
          <div className="ml-auto h-3 w-16 animate-pulse rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

/**
 * Inline, non-dismissable message. Used where a toast is the wrong channel — the shared interceptor
 * is silent on 400/404/409 by design, and the marketplace's most useful error (a 409 naming the exact
 * city to create in your masters) must stay on screen while the user acts on it.
 */
export function Notice({ tone = "info", children, className }) {
  const tones = {
    info: "border-slate-200 bg-slate-50 text-slate-700",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    error: "border-red-200 bg-red-50 text-red-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };
  return (
    <div className={cn("rounded-lg border px-3.5 py-2.5 text-sm", tones[tone] ?? tones.info, className)} role="status">
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGER — server-paged lists
═══════════════════════════════════════════════════════════════ */

export function Pager({ page, totalPages, total, onPage, className }) {
  if (!total || totalPages <= 1) return null;
  return (
    <div className={cn("flex items-center justify-between gap-3 border-t border-slate-100 px-1 pt-3", className)}>
      <p className="text-[12px] tabular-nums text-slate-500">
        Page {page + 1} of {totalPages} · {total} total
      </p>
      <div className="flex items-center gap-1.5">
        <Button size="sm" onClick={() => onPage(page - 1)} disabled={page <= 0}>
          Previous
        </Button>
        <Button size="sm" onClick={() => onPage(page + 1)} disabled={page >= totalPages - 1}>
          Next
        </Button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FORMATTERS — timezone-safe; a LocalDate must not shift a day
═══════════════════════════════════════════════════════════════ */

/** Parses `YYYY-MM-DD` as local, NOT UTC — `new Date("2026-08-10")` is UTC midnight and renders as the 9th east of Greenwich. */
export function fmtDate(value) {
  if (!value) return "—";
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "—";
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(value) {
  if (!value) return "—";
  const dt = new Date(value);
  return Number.isNaN(dt.getTime())
    ? "—"
    : dt.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function fmtMoney(value, currency = "INR") {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  const symbol = currency === "INR" ? "₹" : `${currency} `;
  return symbol + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Checkout is exclusive: 10 Aug → 12 Aug is two nights. Returns 0 when the range is invalid. */
export function nightsBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(`${String(checkIn).slice(0, 10)}T00:00:00`);
  const b = new Date(`${String(checkOut).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.max(0, Math.round((b - a) / 86400000));
}

/** Today as `YYYY-MM-DD` in LOCAL time — the `min` for a check-in the server validates as @FutureOrPresent. */
export function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/* ═══════════════════════════════════════════════════════════════
   IDEMPOTENCY — required by the submit endpoint
═══════════════════════════════════════════════════════════════ */

/**
 * A stable per-form idempotency key.
 *
 * Stable across re-renders AND across failed submits, which is the entire point: retrying after a
 * 500 must reuse the key so the server returns the original request instead of minting a second CRM
 * booking. Call `reset()` only after a submit the user considers finished.
 */
export function useIdempotencyKey() {
  const make = () =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `mp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const [key, setKey] = useState(make);
  return { key, reset: useCallback(() => setKey(make()), []) };
}

/** Stable DOM id for label/control pairing inside a Row. */
export function useFieldId(prefix = "f") {
  const id = useId();
  return `${prefix}-${id}`;
}

export { Check };
