// src/features/marketplace/pages/PackageQuoteWebView.jsx
//
// The customer's page. Public — no login, no token, no app chrome.
//
// Mounted OUTSIDE Layout at /pq/:publicId, beside /q/:publicId. It shares nothing with
// QuotationWebView: that renders a CRM quotation's six priced sections, this renders a package as
// it actually is — gallery, day plan with photographs, hotels per stop, the rate card, and every
// tier side by side.
//
// ── Self-contained on purpose ────────────────────────────────────────────────────────────────
//
// No feature UI kit, no toast host, no shared axios. This is the one screen in the app whose reader
// is not a user of the app, so the fewer moving parts between the link and the page, the fewer ways
// it can fail in a WhatsApp in-app browser on a five-year-old phone.
//
// The ONE dependency added since: `lucide-react`, for icons — not a new bundle cost, because the
// build already reports `@features/marketplace` as STATICALLY imported by masters and quotation,
// so the barrel, and every marketplace screen's lucide import with it, lands in the app entry
// chunk this page loads anyway. Be honest about what that means: "self-contained" here is about
// how few moving parts sit between the link and the render, NOT about bundle isolation. The
// customer downloads the whole app. Giving this page its own chunk is worth doing and is not done.
//
// The lightbox below is hand-written rather than reusing `components/Lightbox.jsx` for exactly the
// reason in the paragraph above: that one pulls in `marketplaceUi`'s Modal, its toast hook and the
// shared error helpers, none of which belong on a page whose reader is not a user of the app.
//
// ── Everything is optional ───────────────────────────────────────────────────────────────────
//
// The composer lets an agent send a quote with almost nothing filled in, so every block here checks
// before it renders. A missing section is absent, never an empty heading. That rule now extends to
// the icons: an icon row is rendered per PRESENT field, never as a fixed set of slots with blanks
// in it. In practice most packages carry no journey detail at all — the author is not obliged to
// fill it — so `Transfers` hiding cleanly is the ordinary case, not the edge case.
//
// ── Desktop structure ────────────────────────────────────────────────────────────────────────
//
// Modelled, by measurement, on the customer quotation the owner shared as the target: a white top
// bar (agency left, chat CTA right); a 540px hero with the section tabs along its bottom edge; a
// 60px price bar stuck to the top of the viewport (dates · nights · travellers | tier pills | total
// tour cost); then a 1320px body with 32px gutters laid out as a two-column grid — `1fr 286px`, a
// 40px gap — whose right column is a summary card stuck at 76px (the bar plus a gap). Days are a
// 36px timeline with the DATE in the circle. Below 860px the grid collapses to one column, the
// rail goes static, and the floating contact bar takes over the CTA. Those numbers are the
// reference's own, not round guesses, so the two pages sit the same way on the same screen.
//
// ── It is a brochure, not a CRM screen ───────────────────────────────────────────────────────
//
// The rest of this app is deliberately flat — hairline borders, no depth, Notion/Linear. That is
// right for a screen an agent stares at all day and wrong here: this one page is a sales document
// a customer opens once, from WhatsApp, and it has to look like something worth reading. The
// polish comes from depth, scale and structure — soft shadows, a cinematic hero, a real itinerary
// timeline — and NOT from more colour. Adding colours would undo the scannability the palette
// rules below buy, so the accent list stays exactly as short as it is.
//
// ── Colour carries meaning, nothing else ─────────────────────────────────────────────────────
//
// One accent (blue — the package feature's, see components/packageTheme.js) plus three semantic
// colours and nothing more. Anything that is not saying "this is included", "this is not", or
// "careful" is neutral slate. The old page reused emerald for both the inclusions panel and the
// WhatsApp button, and amber for both star ratings and the expired-rates warning; both collisions
// are gone. Sections are separated by an alternating white/slate band (see `Section`) rather than
// by a hairline, because on a phone a 1px border between two identical white cards is not a
// boundary anybody sees.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  BedDouble, Camera, Car, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock,
  Coffee, FileText, Footprints, Globe, Images, Info, Mail, MapPin, MessageCircle, Moon,
  Navigation, Phone, Plane, PlaneLanding, PlaneTakeoff, Receipt, ScrollText, Ship, Sparkles,
  Star, TrainFront, TriangleAlert, Users, Utensils, UtensilsCrossed, Wallet, X,
  Building2, Quote, ShieldCheck, Sun, Ticket,
} from "lucide-react";

import { getPublicPackageQuote } from "../api/packageQuoteService";

/**
 * Type, and where it comes from.
 *
 * The rest of the app runs on Plus Jakarta Sans, loaded once in `src/index.css`. This page does not
 * — a quotation a customer opens from WhatsApp is a brochure, and a serif masthead over a clean
 * humanist sans is what makes printed travel material read as considered rather than as software
 * output. Playfair Display carries the headings and the price; DM Sans carries everything else.
 *
 * The faces are pulled in by the page itself rather than added to `index.css`, because index.css is
 * shared by six other surfaces and none of them wants these two. A `<link>` rather than an
 * `@import` inside a `<style>`: React 19 hoists a stylesheet link with a `precedence` into <head>
 * and dedupes it, and even where it is not hoisted a body-level link still loads — whereas an
 * `@import` in an injected style element is the flakiest of the three in exactly the environment
 * this page has to survive, an old in-app WhatsApp browser.
 *
 * Every family ends in a real system fallback, so blocked Google Fonts (corporate wifi, a
 * locked-down webview) degrades to a readable page rather than a broken one.
 */
const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700" +
  "&family=DM+Sans:wght@400;500;600;700&display=swap";

const FONT = { fontFamily: "'DM Sans',system-ui,-apple-system,'Segoe UI',sans-serif" };

/** The masthead face. Applied inline, so it survives even if a utility class is ever stripped. */
const SERIF = { fontFamily: "'Playfair Display',Georgia,'Times New Roman',serif" };

function PageFonts() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={FONT_HREF} precedence="default" />
    </>
  );
}

/* The reading measure. Prose wider than this is measurably harder to read, and `max-w-none` on a
   1024px column — which is what this page used to do — puts ~130 characters on a line. */
const PROSE = "max-w-[70ch]";

/**
 * The page width, in one place, used by every band — hero, trip bar, nav, sections, footer.
 *
 * Deliberately much wider than the 1024px this started at. On a 1440px laptop that cap left the
 * whole quotation sitting as a 71%-wide ribbon with 200px of empty grey down each side, and on a
 * 1920px screen it was a strip in the middle of nothing; a document a customer opens full-screen
 * should use the screen. The gutter grows with the viewport so the text never runs into the edge.
 *
 * Widening the LAYOUT is not the same as widening the reading measure: prose blocks are still
 * capped at PROSE (70ch) inside this, so paragraphs stay short-lined while grids, the rate table
 * and the photo strips get the room they actually benefit from.
 */
const SHELL = "mx-auto w-full max-w-[1600px] px-5 sm:px-8 lg:px-12 xl:px-16";

const money = (v, currency = "INR") => {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency", currency, maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `₹${n.toLocaleString("en-IN")}`;
  }
};

/**
 * A LocalDate reaches the page as "2026-04-01". `new Date("2026-04-01")` parses that as UTC
 * midnight, so a reader west of Greenwich is shown the day BEFORE — a departure date off by one on
 * a document the customer books against. Split the parts and build a local date instead.
 */
const day = (d) => {
  if (!d) return null;
  try {
    const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d));
    const dt = parts ? new Date(+parts[1], +parts[2] - 1, +parts[3]) : new Date(d);
    if (Number.isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return d;
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   VOCABULARY — the maps that turn a stored value into an icon
   Every one of these degrades: an unknown key falls back rather than throwing
   or rendering nothing, because these are author-typed values, not enums the
   frontend controls.
═══════════════════════════════════════════════════════════════════════════ */

/* `PackageTravelMode` reaches the page title-cased ("Road", "Ferry") — the snapshot builder runs
   the enum name through a `friendly()` helper — so the lookup upper-cases before matching rather
   than comparing against the enum name directly. Same map as PackageDetail.jsx uses agent-side. */
const TRAVEL_ICON = {
  ROAD: Car, FERRY: Ship, FLIGHT: Plane, TRAIN: TrainFront, CRUISE: Ship, WALK: Footprints,
};
const travelIcon = (mode) => TRAVEL_ICON[String(mode ?? "").trim().toUpperCase()] ?? Navigation;

/* `PackageDayType` arrives friendly-cased ("Day tour", "City stop"); the lookup folds it back to the
   enum key. An unknown or absent type gets no icon and no chip — an ordinary day. */
const DAY_ICON = {
  ARRIVAL: PlaneLanding, DEPARTURE: PlaneTakeoff, DAY_TOUR: Camera, LEISURE: Sun,
  ACTIVITY: Ticket, CITY_STOP: Building2, TRANSFER: Car,
};
const dayIcon = (type) =>
  DAY_ICON[String(type ?? "").trim().toUpperCase().replace(/\s+/g, "_")] ?? null;

const MEAL_LABEL = { B: "Breakfast", L: "Lunch", D: "Dinner" };
const MEAL_ICON = { B: Coffee, L: Utensils, D: UtensilsCrossed };

/* Board-basis codes an author may type into the day's meals box instead of day letters. The field
   is deliberately free text on the backend (a day line says which meals fall on that day; the
   hotel's board basis is a different vocabulary), so this accepts both and prints anything it does
   not recognise verbatim. Losing what the author typed would be worse than not drawing an icon. */
const BOARD_BASIS = { EP: [], CP: ["B"], BB: ["B"], MAP: ["B", "D"], AP: ["B", "L", "D"] };

function parseMeals(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return null;

  const upper = text.toUpperCase().replace(/\s+/g, "");
  // `known` separates "read it, and it means no meals" (EP is room-only) from "could not read this
  // at all". Without the flag EP fell through to the verbatim branch and printed the literal string
  // "EP" at a customer who has never seen a board-basis code.
  if (Object.prototype.hasOwnProperty.call(BOARD_BASIS, upper)) {
    return { keys: BOARD_BASIS[upper], raw: text, known: true };
  }
  // "B", "B+D", "B/L/D", "B,D", "B-L-D"
  if (/^[BLD](?:[+,/&-][BLD])*$/.test(upper)) {
    const keys = [...new Set(upper.split(/[+,/&-]/))].filter((k) => MEAL_LABEL[k]);
    return { keys, raw: text, known: true };
  }
  const keys = [];
  if (/breakfast/i.test(text)) keys.push("B");
  if (/lunch/i.test(text)) keys.push("L");
  if (/dinner|supper/i.test(text)) keys.push("D");
  return { keys, raw: text, known: keys.length > 0 };
}

/**
 * One phrase for a tier's board across every stop.
 *
 * Authors type the board basis per hotel as free prose — "CP — breakfast only", "MAP — breakfast
 * and dinner", "AP — all meals aboard" — so this reads the text rather than an enum. A reader
 * comparing three tiers wants "All meals" against "Breakfast only", not four repeated cells.
 *
 * Returns null unless it is confident: an unreadable set says nothing rather than guessing, and
 * the per-hotel line underneath still prints exactly what the author wrote.
 */
function boardSummary(hotels) {
  const plans = (hotels ?? []).map((h) => (h?.mealPlan ?? "").trim()).filter(Boolean);
  if (!plans.length || plans.length !== (hotels ?? []).length) return null;

  const rank = (s) => {
    const v = s.toLowerCase();
    if (/\ball\b|\bap\b|full board/.test(v)) return 3;
    if (/lunch/.test(v)) return 3;
    if (/dinner|\bmap\b|half board/.test(v)) return 2;
    if (/breakfast|\bcp\b|\bbb\b/.test(v)) return 1;
    if (/room only|\bep\b|no meal/.test(v)) return 0;
    return -1;
  };
  const ranks = plans.map(rank);
  if (ranks.some((r) => r < 0)) return null;

  const distinct = [...new Set(ranks)];
  if (distinct.length > 1) return "Mixed meal plans";
  return ["Room only", "Breakfast only", "Breakfast and dinner", "All meals"][distinct[0]];
}

/* The five facet booleans the snapshot has always carried and the page never rendered. Free
   at-a-glance detail with no backend change. */
const AT_A_GLANCE = [
  ["includesHotel", "Hotels", BedDouble],
  ["includesMeal", "Meals", Utensils],
  ["includesVehicle", "Transport", Car],
  ["includesSightseeing", "Sightseeing", Camera],
  ["includesFlight", "Flights", Plane],
];

/* ═══════════════════════════════════════════════════════════════════════════
   SHELL
═══════════════════════════════════════════════════════════════════════════ */

function Centered({ children }) {
  return (
    <div style={FONT} className="flex min-h-screen items-center justify-center bg-[#faf9f6] p-6">
      <PageFonts />
      {children}
    </div>
  );
}

/**
 * One band of the document.
 *
 * The alternating fill is `odd:` / `even:`, i.e. `:nth-child()`, NOT a tone passed down from the
 * page. That is deliberate and load bearing: sections hide themselves when their data is missing,
 * so any tone computed at author time would put two white bands next to each other the moment a
 * quote arrives without, say, a route. `:nth-child` counts the elements that actually rendered, so
 * the stripe stays correct for every combination of present and absent sections. It only works
 * while `<main>` contains nothing but Sections — keep it that way.
 */
function Section({ id, title, kicker, icon: Icon, children }) {
  return (
    /* Sections now live inside a 766px grid column beside a sticky rail, so they are plain stacked
       blocks: no full-bleed band (there is nothing to bleed into) and no page-width wrapper. The
       scroll margin is the sticky price bar's height plus a breath, so an anchor jump does not land
       the heading underneath it. */
    <section id={id} className="scroll-mt-[76px] py-7 first:pt-0 min-[861px]:py-9">
      <div>
        {kicker ? (
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b3141f]">
            {Icon ? <Icon aria-hidden className="h-3.5 w-3.5" /> : null}
            {kicker}
          </p>
        ) : null}
        {title ? (
          <div className="mb-5">
            <h2 style={SERIF} className="text-xl font-semibold tracking-tight text-stone-900 sm:text-2xl">
              {title}
            </h2>
            {/* A short accent rule under the heading. Cheap, and it gives every band a visible
                start — on a long document that is most of what "designed" means. */}
            <span aria-hidden className="mt-2.5 block h-0.5 w-10 rounded-full bg-[#d81f2c]" />
          </div>
        ) : null}
        {children}
      </div>
    </section>
  );
}

/**
 * The package's prose — the overview, and each day's description.
 *
 * Rendered as TEXT, not markup, and that is the whole point.
 *
 * Both fields are authored in a plain `<Textarea>` (PackageEditor.jsx:578 and :839, and the same
 * two controls in PublicPackageSubmit.jsx — there is no rich-text editor anywhere in this
 * feature), so what is stored is exactly what the author typed: line breaks, and any `<` or `&`
 * they happened to write. Putting that through `dangerouslySetInnerHTML` broke it twice over — it
 * ate every paragraph break, because a textarea emits newlines and never a `<p>`, and it swallowed
 * "rooms <3 min from the beach" as an unclosed tag. `whitespace-pre-line` is what actually restores
 * the author's paragraphs; it is what the sibling cancellation/terms blocks below already do, and
 * what the agent-side PackageDetail and the console do for these very same two fields.
 *
 * It also closes a hole. `/api/package-submission/**` is permitAll, so this copy is writable by an
 * anonymous submitter and nothing on the backend sanitises it. Rendered as text there is no
 * injection left to sanitise. If a WYSIWYG is ever added on the authoring side this must move to
 * `safeHtml()` from `@shared/lib/safeHtml` — never back to a hand-built `{ __html }` object, which
 * is exactly what that module exists to stop.
 *
 * `break-words` because one pasted URL is longer than a phone. Never `max-w-none` — see PROSE.
 */
function RichText({ html, className = "" }) {
  if (!html) return null;
  return (
    <div
      className={`${PROSE} whitespace-pre-line break-words text-sm leading-relaxed text-stone-600 ${className}`}
    >
      {html}
    </div>
  );
}

function Stars({ count }) {
  const n = Math.min(5, Number(count) || 0);
  if (!n) return null;
  return (
    /* `role="img"` is required — an aria-label on a bare <span> is not exposed, so the rating was
       silently invisible to a screen reader. */
    <span
      role="img"
      aria-label={`${n} star${n > 1 ? "s" : ""}`}
      className="inline-flex items-center gap-px align-middle"
    >
      {Array.from({ length: n }, (_, i) => (
        <Star key={i} aria-hidden className="h-3 w-3 fill-amber-500 text-amber-500" />
      ))}
    </span>
  );
}

/**
 * The one meta primitive: a small icon and its value. Renders nothing without a value.
 *
 * `label` is the screen-reader name. The icon is the only thing naming the value on screen, and an
 * aria-hidden icon names nothing — on the phone rate card that left a bare "4–6" and a bare date
 * range with no indication of what either one meant. Pass it wherever the value does not describe
 * itself. The icon is stone-500 rather than stone-400 so it clears the 3:1 non-text minimum.
 */
function Fact({ icon: Icon, label, children, className = "" }) {
  if (children == null || children === "" || children === false) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs text-stone-600 ${className}`}>
      <Icon aria-hidden className="h-3.5 w-3.5 shrink-0 text-stone-500" />
      {label ? <span className="sr-only">{label}: </span> : null}
      <span>{children}</span>
    </span>
  );
}

/**
 * A short row of neutral chips with a screen-reader label — hotel facilities, room amenities.
 * Capped at six on screen with a "+N" tail; a hotel listing twenty facilities inside a comparison
 * card would push the next hotel off the screen. Renders nothing for an empty list.
 */
function ChipList({ label, items, className = "", max = 6 }) {
  const list = (items ?? []).map((s) => String(s ?? "").trim()).filter(Boolean);
  if (!list.length) return null;
  const shown = list.slice(0, max);
  const more = list.length - shown.length;
  return (
    <ul className={`flex flex-wrap gap-1 ${className}`} aria-label={label}>
      {shown.map((s, i) => (
        <li key={`${s}-${i}`} className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-700">
          {s}
        </li>
      ))}
      {more > 0 ? (
        <li className="rounded-full px-1.5 py-0.5 text-[11px] font-medium text-stone-500" title={list.slice(max).join(", ")}>
          +{more}
        </li>
      ) : null}
    </ul>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PHOTOS
   A grid that degrades: one photo fills the row, many tile. Every <img> is
   lazy and carries an onError that hides it — a dead CDN URL must not leave a
   broken-image icon on a document going to a customer.

   Fixed pixel heights are gone. `h-40` on a 2-column grid at 360px produced a
   136×160 box, i.e. a portrait crop of a landscape photograph on the device
   this link is most often opened on. An aspect ratio scales instead.
═══════════════════════════════════════════════════════════════════════════ */

function Img({ src, alt, className, onDead }) {
  const [dead, setDead] = useState(false);
  if (!src || dead) return null;
  return (
    <img
      src={src}
      alt={alt || ""}
      loading="lazy"
      onError={() => {
        setDead(true);
        onDead?.(src);
      }}
      className={className}
    />
  );
}

/**
 * A minimal lightbox, scoped to one grid.
 *
 * Each PhotoGrid owns its own, so paging left/right stays inside the set the reader tapped — a
 * day's photographs, or one hotel's — rather than wandering into another day's.
 */
function Lightbox({ photos, index, onIndex, onClose, onImgError }) {
  const open = index != null;
  const total = photos.length;
  const dialogRef = useRef(null);

  // The handler is rebuilt on every index change, so it always closes over the current one.
  const onKey = useCallback(
    (e) => {
      if (!open) return;
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowLeft" && total > 1) { onIndex((index - 1 + total) % total); return; }
      if (e.key === "ArrowRight" && total > 1) { onIndex((index + 1) % total); return; }
      if (e.key !== "Tab") return;

      // Trap Tab. `aria-modal` is an assertion, not a behaviour: the page behind is still fully
      // focusable, so without this a keyboard reader tabs straight out of the viewer into a
      // document they cannot see.
      const focusables = dialogRef.current?.querySelectorAll("button, a[href]");
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [open, index, total, onIndex, onClose]
  );

  useEffect(() => {
    if (!open) return undefined;
    window.addEventListener("keydown", onKey);
    // A background that scrolls under an open overlay is the classic in-app-browser annoyance.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onKey]);

  // Move focus in on open and hand it back to whatever opened it on close. Depends on `open` only,
  // so paging between photos does not yank focus back to the dialog on every arrow press.
  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    dialogRef.current?.focus();
    return () => {
      if (opener && typeof opener.focus === "function") opener.focus();
    };
  }, [open]);

  if (!open) return null;
  const photo = photos[index];
  if (!photo) return null;

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={photo.caption || "Photograph"}
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-stone-950/92 p-4 outline-none"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-3 top-3 rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20"
      >
        <X aria-hidden className="h-5 w-5" />
      </button>

      <img
        src={photo.url}
        alt={photo.caption || ""}
        onClick={(e) => e.stopPropagation()}
        onError={() => onImgError?.(photo.url)}
        className="max-h-[78vh] w-auto max-w-full rounded-xl object-contain"
      />

      {photo.caption ? (
        <p className="mt-3 max-w-xl text-center text-xs text-white/80">{photo.caption}</p>
      ) : null}

      {total > 1 ? (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-4 flex items-center gap-4 text-sm font-medium text-white/90"
        >
          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => onIndex((index - 1 + total) % total)}
            className="rounded-full bg-white/10 p-2.5 transition hover:bg-white/20"
          >
            <ChevronLeft aria-hidden className="h-5 w-5" />
          </button>
          <span className="tabular-nums">{index + 1} / {total}</span>
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => onIndex((index + 1) % total)}
            className="rounded-full bg-white/10 p-2.5 transition hover:bg-white/20"
          >
            <ChevronRight aria-hidden className="h-5 w-5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * @param {number} cols     3 (a day's strip / the gallery) or 2 (a nested grid).
 * @param {boolean} compact A fixed three-across thumbnail strip, for photos that are supporting
 *                          detail rather than the point of the block.
 * @param {number} limit    Show at most this many tiles; the last one carries a "+N" and the
 *                          lightbox still opens on the FULL set.
 *
 * `compact` + `limit` exist because of what the real data looks like: a tier carries four hotels
 * and each hotel carries five photographs, so one comparison card was rendering twenty images —
 * on a phone, stacked single-column, that is roughly four thousand pixels of photos inside one
 * card of a swipe carousel. Three thumbnails and a "+2" say the same thing in one row.
 */
function PhotoGrid({ photos, className = "", cols = 3, compact = false, limit = 0 }) {
  const [open, setOpen] = useState(null);

  // Dead URLs are tracked HERE rather than only inside each <Img>, so a photo that 404s also
  // leaves the array handed to the lightbox. Otherwise the grid hid it and the viewer still paged
  // onto it and showed the broken-image glyph this component exists to prevent.
  const [dead, setDead] = useState(() => new Set());
  const markDead = useCallback((url) => {
    setDead((prev) => (prev.has(url) ? prev : new Set(prev).add(url)));
  }, []);

  const list = useMemo(
    () => (photos ?? []).filter((p) => p?.url && !dead.has(p.url)),
    [photos, dead]
  );

  // If the open photo is the one that just died, step back rather than render an empty viewer.
  useEffect(() => {
    if (open != null && open >= list.length) setOpen(list.length ? list.length - 1 : null);
  }, [open, list.length]);

  if (!list.length) return null;

  // Nested grids (a hotel's photos inside a tier card) get fewer columns than a day's strip. The
  // tier card swings from ~199px on a phone to ~455px on a laptop, so two columns there produced
  // 95px thumbnails; one column below `sm` keeps them legible at both ends.
  // A tile is the SAME size whatever the count. There is deliberately no one-photo special case:
  // a day with a single photograph gets one tile of exactly the width a day with four gets, so
  // scrolling the itinerary the pictures form one steady column of thumbnails instead of jumping
  // between a billboard and a contact sheet. (The old rule promoted a lone photo to full width at
  // 16/9 — inside a day card that is ~1470px on a laptop, that was a 1470×827 image for one day.)
  // The strip is capped so it stays a photo strip beside the text rather than sprawling the full
  // width of the page; on a phone the cap is wider than the screen, so nothing changes there.
  const grid = compact
    ? "grid-cols-3"
    : cols === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : "max-w-5xl grid-cols-2 sm:grid-cols-3 lg:grid-cols-4";

  // The lightbox always receives `list`; only the GRID is truncated.
  const shown = limit > 0 ? list.slice(0, limit) : list;
  const hiddenCount = list.length - shown.length;

  return (
    <>
      <div className={`grid gap-2 ${grid} ${className}`}>
        {shown.map((p, i) => {
          const isOverflowTile = hiddenCount > 0 && i === shown.length - 1;
          return (
            <figure key={`${p.url}-${i}`} className="relative overflow-hidden rounded-xl bg-stone-100">
              <button
                type="button"
                onClick={() => setOpen(i)}
                aria-label={
                  isOverflowTile
                    ? `Open all ${list.length} photos`
                    : p.caption
                      ? `Open photo: ${p.caption}`
                      : "Open photo"
                }
                /* An inset ring, because the figure's overflow-hidden clips an outset one away. */
                className="block w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#d81f2c]"
              >
                <Img
                  src={p.url}
                  alt={p.caption}
                  onDead={markDead}
                  className={`w-full object-cover transition-transform duration-300 hover:scale-[1.03] ${
                    "aspect-[4/3]"
                  }`}
                />
                {isOverflowTile ? (
                  <span
                    aria-hidden
                    className="absolute inset-0 flex items-center justify-center bg-stone-950/55 text-sm font-semibold text-white"
                  >
                    +{hiddenCount}
                  </span>
                ) : null}
              </button>
              {/* stone-600 on the stone-100 figure: stone-500 there is 4.35:1 and fails AA.
                  Captions are dropped in compact mode — under a 73px thumbnail they are noise. */}
              {p.caption && !compact ? (
                <figcaption className="px-2.5 py-1.5 text-xs text-stone-600">{p.caption}</figcaption>
              ) : null}
            </figure>
          );
        })}
      </div>

      <Lightbox
        photos={list}
        index={open}
        onIndex={setOpen}
        onClose={() => setOpen(null)}
        onImgError={markDead}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   HERO
═══════════════════════════════════════════════════════════════════════════ */

function Hero({ snap, sentinelRef, tab = "trip", onTab = () => {}, hasAbout = false }) {
  const cover = (snap.gallery ?? []).find((p) => p?.url)?.url;
  const p = snap.pkg ?? {};
  const t = snap.trip ?? {};

  const facts = [
    p.nights != null ? `${p.nights}N / ${p.days ?? p.nights + 1}D` : null,
    p.stateName,
    p.category,
    t.pax ? `${t.pax} traveller${t.pax > 1 ? "s" : ""}` : null,
  ].filter(Boolean);

  const glance = AT_A_GLANCE.filter(([key]) => p[key]);

  return (
    /* With a cover photograph the hero fills most of the first screen and the content sits at the
       bottom of it, the way a brochure cover works. Without one it collapses back to a compact
       dark band — a 70vh slab of flat navy is not a design, it is an empty box. */
    <header
      className={`relative isolate flex flex-col justify-end overflow-hidden bg-stone-900 text-white ${
        cover ? "min-h-[380px] min-[861px]:min-h-[540px]" : ""
      }`}
    >
      {cover ? (
        <>
          {/* Decorative: the <h1> below already announces the title, and repeating it here made a
              screen reader say the package name twice before reaching the heading. */}
          <Img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55" />
          {/* One bottom-up wash so the text always has ground beneath it whatever the photo does. */}
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/40 to-transparent" />
        </>
      ) : null}

      <div className="relative mx-auto w-full max-w-[1320px] px-5 pb-8 pt-10 min-[861px]:px-8 min-[861px]:pb-10 min-[861px]:pt-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#fecdd3]">
          {p.region ? `${p.region} · ` : ""}Holiday quotation
        </p>

        {/* Steps up rather than jumping 30px → 48px: a long package title at 30px on a 360px screen
            ran to five lines and pushed the price below the fold. */}
        <h1
          style={SERIF}
          className="mt-2 max-w-4xl text-3xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl"
        >
          {p.title}
        </h1>
        {p.subtitle ? (
          <p className="mt-2 max-w-2xl text-sm text-stone-200 sm:text-base">{p.subtitle}</p>
        ) : null}

        {facts.length ? (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {facts.map((f) => (
              <span
                key={f}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur-sm"
              >
                {f}
              </span>
            ))}
          </div>
        ) : null}

        {/* The five facet booleans, finally rendered. Only the true ones appear — a package with
            no flights does not get a struck-through "Flights" slot. */}
        {glance.length ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            {glance.map(([key, label, Icon]) => (
              <span key={key} className="inline-flex items-center gap-1.5 text-xs font-medium text-white/85">
                <Icon aria-hidden className="h-4 w-4 text-[#fecdd3]" />
                {label}
              </span>
            ))}
          </div>
        ) : null}

      </div>

      {/* The section tabs sit on the hero's bottom edge, exactly where the reference puts them. The
          About tab appears only when the company profile has something to show on it. */}
      {hasAbout ? (
        <nav aria-label="Pages" className="relative border-t border-white/10 bg-stone-950/60 backdrop-blur-sm">
          <div className="mx-auto flex w-full max-w-[1320px] px-5 min-[861px]:px-8">
            {[["trip", "Your itinerary"], ["about", snap.agency?.name ? `About ${snap.agency.name}` : "About us"]].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => onTab(key)}
                aria-current={tab === key ? "page" : undefined}
                className={`-mb-px border-b-2 px-4 py-3 text-[13px] font-semibold transition ${
                  tab === key ? "border-[#ff4450] text-white" : "border-transparent text-white/55 hover:text-white/85"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </nav>
      ) : null}

      {/* Watched by the page to decide when the floating contact bar appears — the bar must not
          cover the hero's own price while the reader is still looking at it. */}
      <div ref={sentinelRef} aria-hidden className="absolute bottom-0 h-px w-full" />
    </header>
  );
}

function AgencyMark({ agency, onDark = false }) {
  const a = agency ?? {};
  if (!a.name && !a.logoUrl) return null;
  return (
    <div className="flex items-center gap-3">
      {a.logoUrl ? (
        <Img
          src={a.logoUrl}
          alt={a.name ? "" : "Agency logo"}
          className="h-9 w-auto max-w-[150px] rounded-md bg-white/90 object-contain p-1"
        />
      ) : null}
      {a.name ? (
        <span className={`text-sm font-semibold ${onDark ? "text-white" : "text-stone-900"}`}>{a.name}</span>
      ) : null}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TOP BAR — agency left, one CTA right
═══════════════════════════════════════════════════════════════════════════ */

function TopBar({ agency }) {
  const a = agency ?? {};
  const wa = waNumber(a);
  if (!a.name && !a.logoUrl && !wa && !a.phone) return null;
  return (
    <div className="border-b border-stone-200 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
      <div className="mx-auto flex w-full max-w-[1320px] items-center justify-between gap-4 px-5 py-2.5 min-[861px]:px-8">
        <AgencyMark agency={a} />
        {wa ? (
          <a
            href={`https://wa.me/${wa}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#d81f2c] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(255,68,80,0.35)] transition hover:bg-[#b3141f]"
          >
            <MessageCircle aria-hidden className="h-4 w-4" />
            Chat with us →
          </a>
        ) : a.phone ? (
          <a href={`tel:${a.phone}`} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#d81f2c] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#b3141f]">
            <Phone aria-hidden className="h-4 w-4" />
            Call us
          </a>
        ) : null}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRICE BAR — stuck to the top of the viewport
   Three zones: the party (dates · nights · travellers) | the tier pills |
   the total. On a phone the pills go and it is two zones, like the reference.
═══════════════════════════════════════════════════════════════════════════ */

function PriceBar({ snap, tiers, pick, onPick, expired }) {
  const t = snap.trip ?? {};
  const p = snap.pkg ?? {};
  const currency = t.currency ?? "INR";
  const tier = tiers[pick] ?? tiers[0];
  const dates = t.travelDate
    ? `${day(t.travelDate)}${t.returnDate ? ` – ${day(t.returnDate)}` : ""}`
    : "Dates TBD";
  const party = [
    dates,
    p.nights != null ? `${p.nights}N` : null,
    t.pax ? `${t.pax} traveller${t.pax > 1 ? "s" : ""}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="sticky top-0 z-[100] border-b border-stone-200 bg-white shadow-[0_2px_14px_rgba(0,0,0,0.06)]">
      <div className="mx-auto flex w-full max-w-[1320px] items-center px-4 min-[861px]:px-8" style={{ minHeight: 60 }}>
        <div className="min-w-0 flex-1 pr-3 text-xs leading-snug text-stone-600 min-[861px]:flex-none min-[861px]:border-r min-[861px]:border-stone-200 min-[861px]:pr-5">
          <span className="block truncate">{party || "Your quotation"}</span>
        </div>

        {tiers.length > 1 ? (
          <div className="hidden min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-4 min-[861px]:flex" role="tablist" aria-label="Options">
            {tiers.map((x, i) => (
              <button
                key={x.publicId ?? i}
                type="button"
                role="tab"
                aria-selected={i === pick}
                onClick={() => onPick(i)}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  i === pick
                    ? "border-[#d81f2c] bg-[#fff1f2] text-[#b3141f]"
                    : "border-stone-200 bg-white text-stone-600 hover:border-[#fda4af]"
                }`}
              >
                {x.name || x.category || `Option ${i + 1}`}
                {x.recommended ? <span className="ml-1 text-[10px] font-medium text-[#d81f2c]">★</span> : null}
              </button>
            ))}
          </div>
        ) : (
          <div className="hidden flex-1 min-[861px]:block" />
        )}

        <div className="flex shrink-0 flex-col items-end pl-3 min-[861px]:border-l min-[861px]:border-stone-200 min-[861px]:pl-5">
          <span className="text-[9px] font-semibold uppercase tracking-[0.13em] text-stone-500">
            {expired ? "Rates lapsed" : "Total tour cost"}
          </span>
          <span className={`text-base font-bold leading-tight ${expired ? "text-stone-400 line-through" : "text-stone-900"}`}>
            {money(tier?.sellTotal ?? tier?.sellPerPax, currency) ?? "On request"}
          </span>
          {tier?.sellTotal != null && tier?.sellPerPax != null ? (
            <span className="text-[10px] text-stone-500">{money(tier.sellPerPax, currency)} / person</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SIDE RAIL — the sticky summary card (286px, top 76)
   Dark header with the total, a few facts, the two ways to reach the agency.
   Desktop only; the phone has the floating contact bar instead.
═══════════════════════════════════════════════════════════════════════════ */

function KV({ label, children, last = false }) {
  if (children == null || children === "" || children === false) return null;
  return (
    <div className={`flex items-start justify-between gap-3 py-2 text-xs ${last ? "" : "border-b border-stone-100"}`}>
      <dt className="shrink-0 text-stone-500">{label}</dt>
      <dd className="text-right font-medium text-stone-900">{children}</dd>
    </div>
  );
}

function SideRail({ snap, tiers, pick, expired }) {
  const a = snap.agency ?? {};
  const t = snap.trip ?? {};
  const p = snap.pkg ?? {};
  const currency = t.currency ?? "INR";
  const tier = tiers[pick] ?? tiers[0];
  const wa = waNumber(a);
  const cities = (snap.route ?? []).filter((s) => s?.city).length;

  return (
    <aside className="hidden min-[861px]:block min-[861px]:sticky min-[861px]:top-[76px]">
      <div className="overflow-hidden rounded-[10px] border border-stone-200 bg-white shadow-sm">
        <div className="bg-stone-950 px-[18px] py-4 text-white">
          <p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-white/60">
            {expired ? "Rates lapsed" : "Total tour cost"}
          </p>
          <p className={`mt-0.5 text-[36px] font-bold leading-[1.1] tracking-[-0.02em] ${expired ? "text-white/50 line-through" : ""}`}>
            {money(tier?.sellTotal ?? tier?.sellPerPax, currency) ?? "On request"}
          </p>
          {tier?.sellTotal != null && tier?.sellPerPax != null ? (
            <p className="mt-1 text-xs text-white/70">
              {money(tier.sellPerPax, currency)} per person{t.pax ? ` · ${t.pax} traveller${t.pax > 1 ? "s" : ""}` : ""}
            </p>
          ) : null}
          {tier?.name && tiers.length > 1 ? (
            <p className="mt-2 inline-block rounded-md bg-white/10 px-2.5 py-1 text-[11px] font-semibold">
              {tier.name}{tier.recommended ? " · Recommended" : ""}
            </p>
          ) : null}
          {expired ? (
            <p className="mt-2 text-[11px] font-semibold text-[#fda4af]">Valid until {day(t.validUntil)} — ask us to re-quote</p>
          ) : t.validUntil ? (
            <p className="mt-2 text-[11px] font-semibold text-[#fda4af]">Offer valid till {day(t.validUntil)}</p>
          ) : null}
        </div>

        <dl className="px-[18px] pt-1">
          <KV label="Duration">{p.nights != null ? `${p.days ?? p.nights + 1} Days / ${p.nights} Nights` : null}</KV>
          <KV label="Travellers">{t.pax ? `${t.pax} ${t.pax > 1 ? "adults" : "adult"}` : null}</KV>
          <KV label="Dates">{t.travelDate ? `${day(t.travelDate)}${t.returnDate ? ` – ${day(t.returnDate)}` : ""}` : "To be decided"}</KV>
          <KV label="Cities">{cities ? `${cities} ${cities === 1 ? "city" : "cities"}` : null}</KV>
          <KV label="Reference" last>{t.quoteRef}</KV>
        </dl>

        <div className="px-[18px] pb-4 pt-3">
          {wa ? (
            <a
              href={`https://wa.me/${wa}`}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#16a34a] px-3 py-[11px] text-[13px] font-semibold text-white transition hover:bg-[#15803d]"
            >
              <MessageCircle aria-hidden className="h-4 w-4" />
              Chat on WhatsApp
            </a>
          ) : null}
          {a.phone ? (
            <a
              href={`tel:${a.phone}`}
              className={`flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#d81f2c] px-3 py-[11px] text-[13px] font-medium text-white transition hover:bg-[#b3141f] ${wa ? "mt-2.5" : ""}`}
            >
              <Phone aria-hidden className="h-4 w-4" />
              Call {a.phone}
            </a>
          ) : null}
          {(a.address || a.website) ? (
            <p className="mt-3 text-center text-[11px] leading-relaxed text-stone-500">
              {[a.address, a.website ? a.website.replace(/^https?:\/\//, "") : null].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TRIP BAR
   In practice this is sparser than it looks: the composer never sends
   occupancy, and only sends a customer name when the agent typed one. Every
   row is conditional, so the grid closes up rather than leaving holes.
═══════════════════════════════════════════════════════════════════════════ */

// Retained, not rendered: the price bar and the side rail now carry these facts. Kept per the
// project's unused ≠ deletable rule; the bundler tree-shakes an unreferenced module-level function.
// eslint-disable-next-line no-unused-vars
function TripBar({ trip, pkg, route, expired }) {
  const t = trip ?? {};
  const p = pkg ?? {};
  const cities = (route ?? []).filter((s) => s?.city).length;
  const items = [
    t.customerName ? ["Prepared for", t.customerName, Users] : null,
    t.travelDate ? ["Departure", day(t.travelDate), CalendarDays] : null,
    t.returnDate ? ["Return", day(t.returnDate), CalendarDays] : null,
    t.pax ? ["Travellers", String(t.pax), Users] : null,
    // Derived, not stored: the route already says how many stops there are, and "4 cities" is the
    // fact a reader scans for when deciding whether a trip is relaxed or a route march.
    cities ? ["Cities", `${cities} ${cities === 1 ? "city" : "cities"}`, MapPin] : null,
    p.nights != null ? ["Nights", String(p.nights), Moon] : null,
    t.occupancy ? ["Basis", t.occupancy, BedDouble] : null,
    t.quoteRef ? ["Reference", t.quoteRef, FileText] : null,
    // Carried by the snapshot since day one and never shown until now.
    !t.quoteRef && p.code ? ["Package", p.code, FileText] : null,
    t.quotedOn ? ["Quoted on", day(t.quotedOn), Clock] : null,
    t.validUntil ? ["Valid until", day(t.validUntil), Clock] : null,
  ].filter(Boolean);

  if (!items.length && !expired) return null;

  return (
    <div className={SHELL}>
      {/* Rose, not amber. Amber now means star rating and nothing else; a lapsed price is a
          warning and should not share a colour with a hotel's quality. */}
      {expired ? (
        <div className="mt-6 flex gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <p>
            <strong className="font-semibold">These rates have lapsed.</strong>{" "}
            The prices below were valid until {day(t.validUntil)}. Please contact us for an updated
            quotation — the itinerary is still exactly as planned.
          </p>
        </div>
      ) : null}

      {items.length ? (
        <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4 xl:grid-cols-5">
          {items.map(([k, v, Icon]) => (
            <div key={k} className="min-w-0">
              {/* stone-500, not stone-400: stone-400 on white is ~2.9:1 and fails WCAG AA, and
                  every one of these labels is content the reader has to read. */}
              <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-stone-600">
                <Icon aria-hidden className="h-3 w-3 shrink-0" />
                {k}
              </dt>
              <dd className="mt-0.5 break-words text-sm font-semibold text-stone-900">{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION NAV
   A document that runs to twelve thousand pixels on a phone needs a way back.
   Only sections that actually rendered appear here, so the chip row never
   points at an anchor that is not on the page.
═══════════════════════════════════════════════════════════════════════════ */

function SectionNav({ items }) {
  if (items.length < 3) return null;

  const jump = (e, id) => {
    const el = typeof document === "undefined" ? null : document.getElementById(id);
    if (!el) return; // Let the browser handle the anchor itself.
    e.preventDefault();
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    // preventDefault also cancels the anchor's focus move, which left these chips working for a
    // mouse and useless for a keyboard. Put focus where the scroll went.
    el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
  };

  return (
    <nav aria-label="Sections" className="mt-6">
      <ul className={`${SHELL} flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
        {items.map((s) => (
          <li key={s.id} className="shrink-0">
            <a
              href={`#${s.id}`}
              onClick={(e) => jump(e, s.id)}
              className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-[#fda4af] hover:text-[#b3141f]"
            >
              <s.icon aria-hidden className="h-3.5 w-3.5 text-stone-500" />
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TIERS — the comparison
   One column per tier: its price, its vehicle, its hotel on every stop. This
   is the block the whole feature exists for, so it comes before the itinerary
   rather than after it.

   Below `md` it is a snap carousel, not a stack. Stacking three full cards
   means the reader scrolls a screen and a half between Basic and Deluxe and
   cannot hold both in mind — which is the entire job of this block, on the
   device the link is actually opened on. The carousel runs to `md` rather than
   `sm` on purpose: at 640–767px a three-tier grid put two cards on one row and
   orphaned the third.
═══════════════════════════════════════════════════════════════════════════ */

/**
 * A tier carrying nothing at all still counted toward `tiers.length`, so a thin quote rendered the
 * "What is included" heading over one empty white card. Both this section and the nav entry that
 * links to it test the same predicate.
 */
const tierHasContent = (t) =>
  Boolean(t) &&
  (t.sellPerPax != null || t.name || t.highlight || t.category || t.vehicleName ||
    (t.hotels ?? []).length || (t.rateTable ?? []).length);

// Retained, not rendered: TierCompare (the matrix) replaced this carousel after the owner found
// three photo-heavy cards impossible to compare. Kept per the unused ≠ deletable rule; tree-shaken.
// eslint-disable-next-line no-unused-vars
function TierColumns({ tiers, trip }) {
  const list = (tiers ?? []).filter(tierHasContent);
  if (!list.length) return null;
  const currency = trip?.currency ?? "INR";
  const many = list.length > 1;

  const cards = list.map((t, i) => {
    const board = boardSummary(t.hotels);
    return (
    <article
      key={t.publicId ?? i}
      className={`relative flex snap-center flex-col overflow-hidden rounded-2xl border bg-white transition-shadow duration-200 ${
        many ? "w-[86%] shrink-0 md:w-auto md:shrink" : ""
      } ${
        t.recommended && many
          ? "border-[#fda4af] shadow-lg shadow-[#ffe4e6] ring-1 ring-[#ffe4e6]"
          : "border-stone-200 shadow-sm hover:shadow-md"
      }`}
    >
      {/* A gradient cap on the chosen tier. It reads before any of the words do, which is the
          point — the agent picked this one and the layout should say so at a glance. */}
      {t.recommended && many ? (
        <span aria-hidden className="h-1.5 w-full bg-gradient-to-r from-[#d81f2c] to-amber-500" />
      ) : null}

      {t.recommended && many ? (
        <span className="absolute right-3 top-4 inline-flex items-center gap-1 rounded-full bg-[#d81f2c] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
          <Sparkles aria-hidden className="h-3 w-3" />
          Recommended
        </span>
      ) : null}

      <div className="border-b border-stone-100 p-5">
        {/* The reserve is only needed under the Recommended badge; unconditional it cost 96px of
            title width on every card at phone widths. */}
        <h3 className={`${t.recommended && many ? "pr-28 " : ""}text-base font-semibold text-stone-900`}>
          {t.name || t.category || "Package"}
        </h3>
        {t.highlight ? <p className="mt-1 text-xs text-stone-600">{t.highlight}</p> : null}

        <p className="mt-4">
          {t.sellPerPax != null ? (
            <>
              <span style={SERIF} className="text-3xl font-semibold tracking-tight text-stone-900">
                {money(t.sellPerPax, currency)}
              </span>
              <span className="ml-1 text-xs text-stone-600">per person</span>
            </>
          ) : (
            <span className="text-sm font-medium text-stone-600">Price on request</span>
          )}
        </p>
        {/* The total, said plainly. "₹39,800 total for 2" was already here but buried in the same
            weight as everything else; the figure a family actually has to find is the whole cost,
            not the per-person one the industry likes to quote. */}
        {t.sellTotal != null ? (
          <p className="mt-2 flex items-baseline gap-1.5 border-t border-stone-100 pt-2">
            <span className="text-xs font-medium text-stone-600">Total tour cost</span>
            <span className="text-sm font-semibold text-stone-900">
              {money(t.sellTotal, currency)}
            </span>
            {trip?.pax ? (
              <span className="text-xs text-stone-600">for {trip.pax}</span>
            ) : null}
          </p>
        ) : null}

        {board ? (
          <p className="mt-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
              <Utensils aria-hidden className="h-3 w-3" />
              {board}
            </span>
          </p>
        ) : null}
      </div>

      {t.vehicleName ? (
        <div className="flex items-start gap-2 border-b border-stone-100 px-5 py-3 text-xs">
          <Car aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-500" />
          <span className="text-stone-700">
            <span className="font-medium text-stone-900">{t.vehicleName}</span>
            {t.vehicleNote ? <span className="text-stone-600"> · {t.vehicleNote}</span> : null}
          </span>
        </div>
      ) : null}

      {(t.hotels ?? []).length ? (
        <ul className="flex-1 divide-y divide-stone-100">
          {t.hotels.map((h, hi) => (
            <li key={`${h.city}-${hi}`} className="px-5 py-3.5">
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-stone-600">
                <MapPin aria-hidden className="h-3 w-3 shrink-0" />
                {h.city}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm font-semibold text-stone-900">
                {h.hotelName || "Hotel to be confirmed"}
                <Stars count={h.stars} />
              </p>
              {(h.roomType || h.mealPlan || h.checkIn || h.checkOut) ? (
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Fact icon={BedDouble} label="Room">{h.roomType}</Fact>
                  <Fact icon={Utensils} label="Meal plan">{h.mealPlan}</Fact>
                  <Fact icon={Clock} label="Check-in">{h.checkIn ? `In ${h.checkIn}` : null}</Fact>
                  <Fact icon={Clock} label="Check-out">{h.checkOut ? `Out ${h.checkOut}` : null}</Fact>
                </p>
              ) : null}
              {h.note ? (
                <span className="mt-1 flex gap-1.5 text-xs text-stone-600">
                  <Info aria-hidden className="mt-0.5 h-3 w-3 shrink-0 text-stone-500" />
                  {h.note}
                </span>
              ) : null}
              <PhotoGrid photos={h.photos} compact limit={3} className="mt-2.5" />
              <ChipList label="Hotel facilities" items={h.facilities} className="mt-2.5" />
              <ChipList label="Room amenities" items={h.amenities} className="mt-1.5" />
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex-1" />
      )}
    </article>
    );
  });

  return (
    <Section
      id="options"
      icon={Wallet}
      kicker={many ? "Choose your option" : "Your package"}
      title={many ? `${list.length} ways to do this trip` : "What is included"}
    >
      {many ? (
        <>
          {/* The negative gutter lets the strip bleed to the screen edge so the next card peeks —
              which is what tells a reader on a phone that there is anything to swipe to. */}
          <div className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-3">
            {cards}
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-stone-600 md:hidden">
            <ChevronRight aria-hidden className="h-3.5 w-3.5" />
            Swipe to compare all {list.length} options
          </p>
        </>
      ) : (
        <div className="grid gap-4">{cards}</div>
      )}
    </Section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TIER COMPARISON — one matrix
   The owner's read of the carousel was right: three cards, each carrying four
   hotels with five photographs, is sixty thumbnails between the reader and the
   one question a comparison exists to answer — "what do I get for the extra
   money?". So: rows are the things that CHANGE between tiers (price, vehicle,
   meals, the hotel on each stop), columns are the tiers, and there is not a
   photograph in it. The lead tier's hotel photographs live where the reader
   is thinking about that night — on the itinerary day.
═══════════════════════════════════════════════════════════════════════════ */

function TierCompare({ tiers, trip, route, pick, onPick }) {
  const list = (tiers ?? []).filter(tierHasContent);
  if (!list.length) return null;
  const currency = trip?.currency ?? "INR";
  const many = list.length > 1;

  // Stops in route order; if the quote carries no route, the union of the hotels' cities.
  const stops = (route ?? []).map((s) => s?.city).filter(Boolean);
  const cities = stops.length
    ? stops
    : [...new Set(list.flatMap((t) => (t.hotels ?? []).map((h) => h?.city)).filter(Boolean))];
  const nightsFor = (city) => (route ?? []).find((s) => s?.city === city)?.nights;
  const hotelIn = (t, city) =>
    (t.hotels ?? []).find((h) => String(h?.city ?? "").trim().toLowerCase() === String(city).trim().toLowerCase());
  const anyVehicle = list.some((t) => t.vehicleName);
  const anyHighlight = list.some((t) => t.highlight);

  const priceCell = (t) => (
    <>
      <span style={SERIF} className="block text-lg font-semibold leading-tight text-stone-900 sm:text-xl">
        {money(t.sellPerPax, currency) ?? "On request"}
      </span>
      <span className="block text-[11px] text-stone-500">
        per person{t.sellTotal != null && trip?.pax ? ` · ${money(t.sellTotal, currency)} for ${trip.pax}` : ""}
      </span>
    </>
  );
  const vehicleCell = (t) =>
    t.vehicleName ? (
      <>
        <span className="block font-medium text-stone-900">{t.vehicleName}</span>
        {t.vehicleNote ? <span className="block text-[11px] text-stone-500">{t.vehicleNote}</span> : null}
      </>
    ) : <span className="text-stone-400">—</span>;
  const mealsCell = (t) => {
    const b = boardSummary(t.hotels);
    return b ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
        <Utensils aria-hidden className="h-3 w-3" />
        {b}
      </span>
    ) : <span className="text-stone-400">—</span>;
  };
  const hotelCell = (t, city) => {
    const h = hotelIn(t, city);
    if (!h?.hotelName) return <span className="text-stone-400">To be confirmed</span>;
    return (
      <>
        <span className="flex flex-wrap items-center gap-x-1.5 font-medium text-stone-900">
          {h.hotelName}
          <Stars count={h.stars} />
        </span>
        {(h.roomType || h.mealPlan) ? (
          <span className="block text-[11px] text-stone-500">
            {[h.roomType, h.mealPlan].filter(Boolean).join(" · ")}
          </span>
        ) : null}
      </>
    );
  };

  // The rows, once, so the table and the phone cards cannot drift apart.
  const rows = [
    { key: "price", label: "Price", icon: Wallet, cell: priceCell },
    anyVehicle ? { key: "vehicle", label: "Vehicle", icon: Car, cell: vehicleCell } : null,
    { key: "meals", label: "Meals", icon: Utensils, cell: mealsCell },
    ...cities.map((city) => ({
      key: `city-${city}`,
      label: city,
      sub: nightsFor(city) ? `${nightsFor(city)} night${nightsFor(city) > 1 ? "s" : ""}` : null,
      icon: BedDouble,
      cell: (t) => hotelCell(t, city),
    })),
    anyHighlight
      ? { key: "highlight", label: "In short", icon: Sparkles, cell: (t) => (t.highlight ? <span className="text-stone-700">{t.highlight}</span> : <span className="text-stone-400">—</span>) }
      : null,
  ].filter(Boolean);

  const headCell = (t, i) => (
    <button
      type="button"
      onClick={() => onPick?.(i)}
      aria-pressed={i === pick}
      className="w-full text-left"
    >
      <span className="block text-sm font-semibold text-stone-900">{t.name || t.category || `Option ${i + 1}`}</span>
      <span className="mt-0.5 flex flex-wrap items-center gap-1">
        {t.recommended && many ? (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-[#d81f2c] px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-white">
            <Sparkles aria-hidden className="h-2.5 w-2.5" />
            Recommended
          </span>
        ) : null}
        {i === pick && many ? (
          <span className="rounded-full border border-[#fda4af] px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-[#b3141f]">Selected</span>
        ) : null}
      </span>
    </button>
  );

  return (
    <Section
      id="options"
      icon={Wallet}
      kicker={many ? "Choose your option" : "Your package"}
      title={many ? `${list.length} ways to do this trip` : "What is included"}
    >
      {many ? (
        <p className="-mt-3 mb-4 text-xs text-stone-500">
          Same itinerary, same days — only the hotels and the vehicle change. Tap a column to see its price in the summary.
        </p>
      ) : null}

      {/* Phone: one card per row, the tiers listed inside it. */}
      <div className="space-y-2.5 sm:hidden">
        {rows.map((r) => (
          <div key={r.key} className="overflow-hidden rounded-[10px] border border-stone-200 bg-white">
            <p className="flex items-center gap-1.5 border-b border-stone-100 bg-stone-50 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-stone-600">
              <r.icon aria-hidden className="h-3.5 w-3.5 text-stone-500" />
              {r.label}{r.sub ? <span className="font-normal normal-case tracking-normal text-stone-500"> · {r.sub}</span> : null}
            </p>
            <dl className="divide-y divide-stone-100">
              {list.map((t, i) => (
                <div key={t.publicId ?? i} className={`grid grid-cols-[92px_1fr] gap-3 px-3.5 py-2.5 text-sm ${i === pick && many ? "bg-[#fff1f2]/60" : ""}`}>
                  <dt className="text-xs font-semibold text-stone-600">{t.name || t.category || `Option ${i + 1}`}</dt>
                  <dd className="min-w-0">{r.cell(t)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      {/* Tablet and up: the matrix. Fixed layout so three columns share the width evenly. */}
      <div className="hidden overflow-hidden rounded-[10px] border border-stone-200 bg-white sm:block">
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 align-top">
              <th scope="col" className="w-[132px] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                Compare
              </th>
              {list.map((t, i) => (
                <th
                  key={t.publicId ?? i}
                  scope="col"
                  className={`px-4 py-3 text-left ${i === pick && many ? "bg-[#fff1f2]" : ""}`}
                >
                  {headCell(t, i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map((r) => (
              <tr key={r.key} className="align-top">
                <th scope="row" className="px-4 py-3 text-left">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-stone-700">
                    <r.icon aria-hidden className="h-3.5 w-3.5 shrink-0 text-stone-500" />
                    {r.label}
                  </span>
                  {r.sub ? <span className="mt-0.5 block text-[11px] font-normal text-stone-500">{r.sub}</span> : null}
                </th>
                {list.map((t, i) => (
                  <td key={t.publicId ?? i} className={`px-4 py-3 ${i === pick && many ? "bg-[#fff1f2]/60" : ""}`}>
                    {r.cell(t)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ROUTE — where you sleep
   Split from the travel legs below it. They answer two different questions and
   used to share one heading, which meant neither had a title that matched what
   the reader was looking for.
═══════════════════════════════════════════════════════════════════════════ */

function StayRoute({ route }) {
  const stops = route ?? [];
  if (!stops.length) return null;

  return (
    <Section id="route" icon={MapPin} kicker="The route" title="Where you stay">
      <ol className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch">
        {stops.map((s, i) => (
          <li key={`${s.city}-${i}`} className="flex items-center gap-2">
            {/* `sm:flex-none` is `flex: 0 0 auto`, so from 640px up the card is sized to its
                max-content and can never shrink — and a 300-character stop note is one unwrapped
                line of max-content, which pushed the whole PAGE into horizontal scroll. The
                max-width clamps the flex base size so the note wraps inside the card instead. */}
            <div className="flex-1 rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 shadow-sm sm:flex-none sm:max-w-[20rem]">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-stone-900">
                <MapPin aria-hidden className="h-3.5 w-3.5 shrink-0 text-[#d81f2c]" />
                {s.city}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <Fact icon={Moon} label="Nights">
                  {s.nights ? `${s.nights} night${s.nights > 1 ? "s" : ""}` : null}
                </Fact>
                <Fact icon={CalendarDays} label="Dates">
                  {s.checkIn ? `${day(s.checkIn)}${s.checkOut ? ` → ${day(s.checkOut)}` : ""}` : null}
                </Fact>
              </p>
              {/* Added to the snapshot alongside this pass — the author's "arrival transfer
                  included" note used to be dropped between the catalog and the weblink. */}
              {s.note ? (
                <span className="mt-1 flex gap-1.5 text-xs text-stone-600">
                  <Info aria-hidden className="mt-0.5 h-3 w-3 shrink-0 text-stone-500" />
                  {s.note}
                </span>
              ) : null}
            </div>
            {/* The connector is inside the <li>, so it can never wrap onto a line of its own and
                leave an arrow dangling — which is what the old flex-wrapped "→" did at 360px. */}
            {i < stops.length - 1 ? (
              <ChevronRight aria-hidden className="hidden h-4 w-4 shrink-0 text-stone-300 sm:block" />
            ) : null}
          </li>
        ))}
      </ol>
    </Section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TRANSFERS — how you get between the stops
   Built entirely from what the snapshot already carries: the stay legs' travel
   fields, plus each tier's vehicle. There is no pickup TIME, no drop time and
   no driver contact anywhere in the package marketplace — those columns do not
   exist — so this renders what is real and says nothing it cannot support.

   Hides completely when a package records no journeys and names no vehicle,
   which is the ordinary case: every journey field is optional and authors
   commonly leave the whole block blank.
═══════════════════════════════════════════════════════════════════════════ */

function Transfers({ journeys, tiers }) {
  const legs = (journeys ?? []).filter((j) => j?.from || j?.to);

  // One badge per distinct vehicle. Most quotes name the same vehicle on every tier, and printing
  // it three times reads as three vehicles.
  //
  // Keyed on name AND note: two tiers naming the same vehicle with different caveats are two
  // different offers, and collapsing them printed one tier's caveat over both. Tier names
  // accumulate rather than keeping the first, so a vehicle shared by Deluxe and Super Deluxe is
  // attributed to both instead of looking like it belongs to Deluxe alone.
  const vehicles = useMemo(() => {
    const seen = new Map();
    for (const t of tiers ?? []) {
      const name = (t?.vehicleName ?? "").trim();
      if (!name) continue;
      const note = (t?.vehicleNote ?? "").trim() || null;
      const key = `${name}${note ?? ""}`;
      const entry = seen.get(key) ?? { name, note, tiers: [] };
      if (t?.name) entry.tiers.push(t.name);
      seen.set(key, entry);
    }
    return [...seen.values()];
  }, [tiers]);

  if (!legs.length && !vehicles.length) return null;

  const manyVehicles = vehicles.length > 1;

  return (
    <Section id="transfers" icon={Car} kicker="Transfers" title="How you get around">
      {vehicles.length ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {vehicles.map((v) => (
            <span
              key={v.name}
              className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-sm shadow-sm"
            >
              <Car aria-hidden className="h-4 w-4 shrink-0 text-[#d81f2c]" />
              <span className="font-semibold text-stone-900">{v.name}</span>
              {manyVehicles && v.tiers.length ? (
                <span className="text-xs text-stone-600">· {v.tiers.join(", ")}</span>
              ) : null}
              {v.note ? <span className="text-xs text-stone-600">· {v.note}</span> : null}
            </span>
          ))}
        </div>
      ) : null}

      {legs.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {legs.map((j, i) => {
            const Icon = travelIcon(j.mode);
            return (
              <li key={i} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-md">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#b3141f]">
                    <Icon aria-hidden className="h-4 w-4" />
                    {j.mode || "Transfer"}
                  </span>
                  <Fact icon={Clock} label="Duration">
                    {j.duration ? `about ${j.duration}` : null}
                  </Fact>
                </div>

                {/* Vertical on a phone, horizontal from `lg` — NOT from `sm`. These cards are two
                    to a row from 640px, so flipping at `sm` gave each place name about 80px of a
                    ~270px card. The stack that already works on a phone is the right layout right
                    up until the row is wide enough to hold both names side by side. */}
                <div className="mt-3 flex flex-col gap-1.5 lg:flex-row lg:items-center lg:gap-3">
                  <p className="flex min-w-0 items-start gap-2 text-sm">
                    <MapPin aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-500" />
                    <span className="font-medium text-stone-900">{j.from || "Start point"}</span>
                  </p>
                  <span
                    aria-hidden
                    className="ml-[7px] h-3 w-px shrink-0 bg-stone-200 lg:ml-0 lg:h-px lg:w-5"
                  />
                  <p className="flex min-w-0 items-start gap-2 text-sm">
                    <MapPin aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#d81f2c]" />
                    <span className="font-medium text-stone-900">{j.to || "Destination"}</span>
                  </p>
                </div>

                {(j.distanceKm || j.note) ? (
                  <div className="mt-3 flex flex-wrap items-start gap-x-4 gap-y-1.5 border-t border-stone-100 pt-3">
                    <Fact icon={Navigation} label="Distance">
                      {j.distanceKm ? `${j.distanceKm} km` : null}
                    </Fact>
                    {j.note ? (
                      <span className="flex flex-1 gap-1.5 text-xs text-stone-600">
                        <Info aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-500" />
                        {j.note}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </Section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ITINERARY
═══════════════════════════════════════════════════════════════════════════ */

function MealChips({ meals }) {
  const parsed = parseMeals(meals);
  if (!parsed) return null;

  // Anything the parser could not read is printed exactly as the author typed it. The field is
  // free text by design, so dropping an unrecognised value would lose real information.
  if (!parsed.keys.length) {
    return parsed.known ? null : <Fact icon={Utensils} label="Meals">{parsed.raw}</Fact>;
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {parsed.keys.map((k) => {
        const Icon = MEAL_ICON[k];
        return (
          <span
            key={k}
            className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800"
          >
            <Icon aria-hidden className="h-3 w-3" />
            {MEAL_LABEL[k]}
          </span>
        );
      })}
    </span>
  );
}

function Itinerary({ days, stays }) {
  const list = days ?? [];

  // The night's hotel, from the tier the reader is looking at, matched to the day by city — the
  // same name-match the whole module uses. Null when the day names no city or the tier has no
  // hotel there, and then nothing is printed.
  const stayFor = (city) => {
    if (!city) return null;
    const key = String(city).trim().toLowerCase();
    return (stays ?? []).find((h) => String(h?.city ?? "").trim().toLowerCase() === key && h?.hotelName) ?? null;
  };

  // Collapsed days, by index. Default is everything open — a customer reading a quote for the
  // first time should not have to click six times to see the trip. The toggle exists for the
  // second read, when they want to jump between days without scrolling past photographs.
  const [collapsed, setCollapsed] = useState(() => new Set());
  const allCollapsed = list.length > 0 && collapsed.size === list.length;
  const toggle = (i) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  const toggleAll = () =>
    setCollapsed(allCollapsed ? new Set() : new Set(list.map((_, i) => i)));

  if (!list.length) return null;

  return (
    <Section id="itinerary" icon={CalendarDays} kicker="Day by day" title="Your itinerary">
      {list.length > 2 ? (
        <div className="-mt-3 mb-5 flex justify-end">
          <button
            type="button"
            onClick={toggleAll}
            className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 shadow-sm transition hover:border-[#fda4af] hover:text-[#b3141f]"
          >
            <ChevronDown
              aria-hidden
              className={`h-3.5 w-3.5 transition-transform ${allCollapsed ? "" : "rotate-180"}`}
            />
            {allCollapsed ? "Expand all" : "Collapse all"}
          </button>
        </div>
      ) : null}
      {/* A timeline, not a stack of boxes. The rail and the numbered nodes are what make a list of
          days read as a journey — it is the single change that makes this look like a travel
          document rather than a table of records. Both are `sm:` and up: on a phone the rail would
          cost 48px of a 320px column, so there the day badge stays inline exactly as it was. */}
      {/* The reference's shape, to the pixel: a 36px timeline column (28 on a phone) with the DATE
          in the circle when there is one and the day number when there is not, a hairline running
          behind the circles, and a card whose header reads "DAY N · date · city" over a serif title
          with the day's type and meals on the right. */}
      <ol className="relative space-y-1">
        <span aria-hidden className="absolute bottom-6 left-[13px] top-6 w-px bg-stone-200 sm:left-[17px]" />
        {list.map((d, i) => (
          <li key={d.dayNumber ?? i} className="relative pl-10 pb-1 sm:pl-[52px]">
            {(() => {
              const dt = d.date ? /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d.date)) : null;
              const dom = dt ? String(+dt[3]) : null;
              const mon = dt ? new Date(+dt[1], +dt[2] - 1, +dt[3]).toLocaleDateString("en-GB", { month: "short" }) : null;
              return (
                <span
                  aria-hidden
                  className="absolute left-0 top-[13px] flex h-7 w-7 flex-col items-center justify-center rounded-full bg-[#d81f2c] leading-none text-white shadow-sm sm:h-9 sm:w-9"
                >
                  {dom ? (
                    <>
                      <span className="text-[12px] font-bold sm:text-[13px]">{dom}</span>
                      <span className="text-[7px] font-semibold uppercase tracking-wide opacity-90 sm:text-[8px]">{mon}</span>
                    </>
                  ) : (
                    <span className="text-[12px] font-bold sm:text-[13px]">{d.dayNumber ?? i + 1}</span>
                  )}
                </span>
              );
            })()}
            <div className="overflow-hidden rounded-[10px] border border-stone-200 bg-white">
            <div className="flex items-center gap-2.5 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-semibold uppercase leading-relaxed tracking-[0.13em] text-stone-500">
                  Day {d.dayNumber ?? i + 1}
                  {d.date ? ` · ${day(d.date)}` : ""}
                  {d.overnightCity ? ` · ${d.overnightCity}` : ""}
                </p>
                {d.title ? (
                  <h3 style={SERIF} className="mt-0.5 text-[17px] font-semibold leading-tight text-stone-900 sm:text-lg">
                    {d.title}
                  </h3>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {/* First and last day of a package are arrival and departure by construction — a
                    packaged tour starts when the party lands and ends when it leaves. A one-day
                    plan is both, and gets neither chip rather than two contradictory ones. */}
                {/* An author-set type (V34) is stated; the first/last heuristic only fills in when
                    the author said nothing, so the two can never print contradictory chips. */}
                {d.dayType ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#fff1f2] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#b3141f]">
                    {(() => { const I = dayIcon(d.dayType); return I ? <I aria-hidden className="h-3 w-3" /> : null; })()}
                    {d.dayType}
                  </span>
                ) : (
                  <>
                    {list.length > 1 && i === 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#fff1f2] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#b3141f]">
                        <PlaneLanding aria-hidden className="h-3 w-3" />
                        Arrival
                      </span>
                    ) : null}
                    {list.length > 1 && i === list.length - 1 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#fff1f2] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#b3141f]">
                        <PlaneTakeoff aria-hidden className="h-3 w-3" />
                        Departure
                      </span>
                    ) : null}
                  </>
                )}
                <MealChips meals={d.meals} />
              </div>
              <button
                type="button"
                onClick={() => toggle(i)}
                aria-expanded={!collapsed.has(i)}
                aria-label={collapsed.has(i) ? `Expand day ${d.dayNumber ?? i + 1}` : `Collapse day ${d.dayNumber ?? i + 1}`}
                className="shrink-0 rounded-full p-1.5 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
              >
                <ChevronDown
                  aria-hidden
                  className={`h-[18px] w-[18px] transition-transform ${collapsed.has(i) ? "-rotate-90" : ""}`}
                />
              </button>
            </div>

            {collapsed.has(i) ? null : (
            <>
            <div className="border-t border-stone-100 px-4 pb-4 pt-3">
            {stayFor(d.overnightCity) ? (
              <p className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-600">
                <BedDouble aria-hidden className="h-3.5 w-3.5 text-stone-500" />
                <span className="font-medium text-stone-900">{stayFor(d.overnightCity).hotelName}</span>
                <Stars count={stayFor(d.overnightCity).stars} />
                {stayFor(d.overnightCity).roomType ? <span>· {stayFor(d.overnightCity).roomType}</span> : null}
              </p>
            ) : null}
            {stayFor(d.overnightCity) ? (
              <PhotoGrid photos={stayFor(d.overnightCity).photos} compact limit={3} className="mb-3 max-w-[360px]" />
            ) : null}
            <RichText html={d.description} />

            {(d.sightseeing ?? []).length ? (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {d.sightseeing.map((s, si) => (
                  <li
                    key={`${s}-${si}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs text-stone-700"
                  >
                    <Camera aria-hidden className="h-3 w-3 shrink-0 text-stone-500" />
                    {s}
                  </li>
                ))}
              </ul>
            ) : null}

            <PhotoGrid photos={d.photos} className="mt-3" />
            </div>
            </>
            )}
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   RATE CARD
   The published bands, so "and if we are six?" is answered on the page
   instead of by a phone call.

   ── One matrix, not one table per tier ──────────────────────────────────────

   This used to render a separate four-column table under a heading for every
   tier. On a real quote that is the same two occupancy bands printed three
   times, with a "Season" column reading "All year" in all six rows — a whole
   column carrying no information, and no way to compare Basic against Deluxe
   at the same occupancy without jumping between tables. Comparing them is the
   one thing this page exists to do.

   So: bands down the side, tiers across the top, price in the cell. Columns
   that say nothing are not drawn — Season appears only when some band actually
   carries dates, and the band's own label only when it adds to the occupancy
   name rather than restating it.

   Below `sm` the matrix becomes one card per band, tier prices listed inside
   it. A four-column table does not fit 360px, and the old fix — a horizontal
   scroller — had no affordance, so on a phone it silently hid the prices.
═══════════════════════════════════════════════════════════════════════════ */

const groupSize = (r) => `${r.paxFrom || 1}${r.paxTo ? `–${r.paxTo}` : "+"}`;
const season = (r) =>
  r.seasonFrom || r.seasonTo ? `${day(r.seasonFrom) ?? "—"} → ${day(r.seasonTo) ?? "—"}` : "All year";

/** Two rows describe the same band when occupancy, party size and season all agree. */
const bandKey = (r) =>
  [r.occupancy ?? "", r.paxFrom ?? "", r.paxTo ?? "", r.seasonFrom ?? "", r.seasonTo ?? ""].join("|");

/** "Twin sharing" beside "Double" is worth printing; "Triple sharing" beside "Triple" is not. */
const bandNote = (r) => {
  const label = (r.label ?? "").trim();
  if (!label) return null;
  const occ = (r.occupancy ?? "").trim().toLowerCase();
  return occ && label.toLowerCase().startsWith(occ) ? null : label;
};

function RateCard({ tiers, trip }) {
  const withRates = (tiers ?? []).filter((t) => (t.rateTable ?? []).length);
  const currency = trip?.currency ?? "INR";

  // The union of every tier's bands, in first-seen order, with each tier's price against it.
  // A tier that does not publish a rate for a band leaves that cell empty rather than dropping
  // the row — "Super Deluxe has no triple rate" is itself the answer to a question.
  const bands = useMemo(() => {
    const out = [];
    const at = new Map();
    withRates.forEach((t, ti) => {
      for (const r of t.rateTable ?? []) {
        const key = bandKey(r);
        if (!at.has(key)) {
          at.set(key, out.length);
          out.push({ key, row: r, prices: new Array(withRates.length).fill(null) });
        }
        out[at.get(key)].prices[ti] = r.perPax;
      }
    });
    return out;
  }, [withRates]);

  if (!withRates.length || !bands.length) return null;

  const many = withRates.length > 1;
  const showSeason = bands.some((b) => b.row.seasonFrom || b.row.seasonTo);
  const tierName = (t, i) => t.name || t.category || (many ? `Option ${i + 1}` : "Per person");

  return (
    <Section id="rates" icon={Receipt} kicker="Rates" title="Price per person">
      {/* Phone: one card per band, every tier's price inside it. */}
      <ul className="space-y-2.5 sm:hidden">
        {bands.map((b) => (
          <li key={b.key} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-stone-900">{b.row.occupancy || "Per person"}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <Fact icon={Users} label="Group size">
                {groupSize(b.row)}
                {bandNote(b.row) ? ` · ${bandNote(b.row)}` : ""}
              </Fact>
              {showSeason ? (
                <Fact icon={CalendarDays} label="Season">{season(b.row)}</Fact>
              ) : null}
            </p>

            <dl className="mt-3 space-y-1.5 border-t border-stone-100 pt-3">
              {withRates.map((t, ti) => (
                <div key={t.publicId ?? ti} className="flex items-baseline justify-between gap-3">
                  <dt className={`text-sm ${t.recommended && many ? "font-semibold text-[#b3141f]" : "text-stone-600"}`}>
                    {tierName(t, ti)}
                  </dt>
                  <dd className="text-base font-semibold text-stone-900">
                    {money(b.prices[ti], currency) ?? "On request"}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>

      {/* Tablet and up: bands down the side, tiers across the top. */}
      <div className="hidden overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-600">
              <th scope="col" className="px-4 py-3 font-medium">Occupancy</th>
              {showSeason ? <th scope="col" className="px-4 py-3 font-medium">Season</th> : null}
              {withRates.map((t, ti) => (
                <th
                  key={t.publicId ?? ti}
                  scope="col"
                  className={`px-4 py-3 text-right font-semibold ${
                    t.recommended && many ? "text-[#b3141f]" : "text-stone-700"
                  }`}
                >
                  {tierName(t, ti)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {bands.map((b) => (
              <tr key={b.key}>
                <th scope="row" className="px-4 py-3 text-left font-normal">
                  <span className="font-medium text-stone-900">{b.row.occupancy || "Per person"}</span>
                  <span className="mt-0.5 block text-xs text-stone-600">
                    {groupSize(b.row)} travellers
                    {bandNote(b.row) ? ` · ${bandNote(b.row)}` : ""}
                  </span>
                </th>
                {showSeason ? (
                  <td className="whitespace-nowrap px-4 py-3 text-stone-600">{season(b.row)}</td>
                ) : null}
                {withRates.map((t, ti) => (
                  <td
                    key={t.publicId ?? ti}
                    className={`px-4 py-3 text-right font-semibold tabular-nums ${
                      b.prices[ti] == null ? "text-stone-400" : "text-stone-900"
                    }`}
                  >
                    {money(b.prices[ti], currency) ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PAYMENT SCHEDULE (V34)
   "Pay ₹19,900 by 12 Mar, the rest by 20 Apr." Per tier, because the shares
   are common but the totals are not; the recommended tier leads and the rest
   sit behind a pill switcher. Hides entirely when no tier publishes terms.
═══════════════════════════════════════════════════════════════════════════ */

function PaymentSchedule({ tiers, trip }) {
  const withTerms = (tiers ?? []).filter((t) => (t?.paymentSchedule ?? []).length);
  const lead = withTerms.findIndex((t) => t.recommended);
  const [pick, setPick] = useState(lead >= 0 ? lead : 0);
  if (!withTerms.length) return null;

  const currency = trip?.currency ?? "INR";
  const tier = withTerms[Math.min(pick, withTerms.length - 1)];
  const many = withTerms.length > 1;

  return (
    <Section id="payments" icon={Wallet} kicker="Paying for it" title="Payment schedule">
      {many ? (
        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Payment schedule by option">
          {withTerms.map((t, i) => (
            <button
              key={t.publicId ?? i}
              type="button"
              role="tab"
              aria-selected={i === pick}
              onClick={() => setPick(i)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                i === pick
                  ? "border-[#d81f2c] bg-[#d81f2c] text-white"
                  : "border-stone-200 bg-white text-stone-700 hover:border-[#fda4af]"
              }`}
            >
              {t.name || t.category || `Option ${i + 1}`}
            </button>
          ))}
        </div>
      ) : null}

      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tier.paymentSchedule.map((s, i) => (
          <li key={i} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <p className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#b3141f]">{s.label || `Instalment ${i + 1}`}</span>
              {s.percent != null ? (
                <span className="text-xs font-medium text-stone-500">{Number(s.percent)}%</span>
              ) : null}
            </p>
            <p style={SERIF} className="mt-2 text-2xl font-semibold text-stone-900">
              {money(s.amount, currency) ?? "On request"}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-stone-600">
              <Clock aria-hidden className="h-3.5 w-3.5 text-stone-500" />
              {s.dueOn ? `Due ${day(s.dueOn)}` : s.dueLabel}
            </p>
          </li>
        ))}
      </ol>
      {tier.sellTotal != null ? (
        <p className="mt-3 text-xs text-stone-600">
          Adds up to <span className="font-semibold text-stone-900">{money(tier.sellTotal, currency)}</span>
          {trip?.pax ? ` for ${trip.pax} traveller${trip.pax > 1 ? "s" : ""}` : ""} on {tier.name || "this option"}.
        </p>
      ) : null}
    </Section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ABOUT THE AGENCY (V34)
   The letterhead block: who is selling this, what they are accredited for,
   and what other travellers said. Everything optional; the section hides when
   the company profile has none of it.
═══════════════════════════════════════════════════════════════════════════ */

function AboutAgency({ agency }) {
  const a = agency ?? {};
  const certs = (a.certifications ?? []).filter(Boolean);
  const quotes = (a.testimonials ?? []).filter((t) => t?.text);
  if (!a.about && !certs.length && !quotes.length) return null;

  return (
    <Section id="about" icon={ShieldCheck} kicker="Who you are booking with" title={a.name ? `About ${a.name}` : "About us"}>
      {(a.about || certs.length) ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          {a.about ? (
            <div className={`${PROSE} whitespace-pre-line break-words text-sm leading-relaxed text-stone-600 sm:text-base`}>
              {a.about}
            </div>
          ) : null}
          {certs.length ? (
            <ul className={`flex flex-wrap gap-2 ${a.about ? "mt-4" : ""}`} aria-label="Certifications and memberships">
              {certs.map((c, i) => (
                <li key={`${c}-${i}`} className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-700">
                  <ShieldCheck aria-hidden className="h-3.5 w-3.5 text-[#d81f2c]" />
                  {c}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {quotes.length ? (
        <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${(a.about || certs.length) ? "mt-4" : ""}`}>
          {quotes.map((t, i) => (
            <figure key={i} className="flex flex-col rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <Quote aria-hidden className="h-5 w-5 text-[#fda4af]" />
              <blockquote className="mt-2 flex-1 text-sm leading-relaxed text-stone-700">{t.text}</blockquote>
              <figcaption className="mt-3 flex items-center gap-3">
                {t.photoUrl ? (
                  <Img src={t.photoUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : null}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-stone-900">{t.name || "A traveller"}</span>
                  {t.destination ? (
                    <span className="block truncate text-xs text-stone-500">{t.destination}</span>
                  ) : null}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}
    </Section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   INCLUSIONS / POLICY
   Both panels are now white cards; the tick and the cross carry the meaning.
   The old full emerald panel fought the emerald WhatsApp button in the footer
   for the same colour, and "included" is a per-line fact, not a mood for a
   whole block.
═══════════════════════════════════════════════════════════════════════════ */

function Lists({ inclusions, exclusions }) {
  const inc = inclusions ?? [];
  const exc = exclusions ?? [];
  if (!inc.length && !exc.length) return null;

  return (
    <Section id="inclusions" icon={Check} kicker="The fine print" title="What is and is not included">
      <div className="grid items-start gap-4 sm:grid-cols-2">
        {inc.length ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-900">
              <Check aria-hidden className="h-4 w-4 text-emerald-600" />
              Included
            </h3>
            <ul className="space-y-2 text-sm text-stone-700">
              {inc.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {exc.length ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-900">
              <X aria-hidden className="h-4 w-4 text-rose-500" />
              Not included
            </h3>
            <ul className="space-y-2 text-sm text-stone-600">
              {exc.map((s, i) => (
                <li key={i} className="flex gap-2">
                  {/* rose-500, not rose-400: 400 is 2.86:1 and misses the 3:1 graphical minimum. */}
                  <X aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Section>
  );
}

function Policies({ cancellationPolicy, terms, rules }) {
  const ladder = (rules ?? []).filter((r) => r?.label);
  if (!cancellationPolicy && !terms && !ladder.length) return null;
  return (
    <Section id="terms" icon={ScrollText} kicker="Terms" title="Cancellation and booking terms">
      <div className="space-y-4 text-sm leading-relaxed text-stone-600">
        {/* The ladder as dates (V34) — the sentence a customer actually wants — above the prose. */}
        {ladder.length ? (
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ladder.map((r, i) => {
              const pct = Number(r.refundPercent ?? 0);
              const tone = pct >= 100
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : pct > 0
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-rose-200 bg-rose-50 text-rose-900";
              const Icon = pct >= 100 ? Check : pct > 0 ? Info : X;
              return (
                <li key={i} className={`flex items-start gap-2.5 rounded-xl border p-3.5 ${tone}`}>
                  <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <span className="block text-sm font-semibold">{r.label}</span>
                    {r.until ? <span className="block text-xs opacity-80">{day(r.until)}</span> : null}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : null}
        {cancellationPolicy ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-stone-900">
              <Receipt aria-hidden className="h-4 w-4 text-stone-500" />
              Cancellation
            </h3>
            <div className={`${PROSE} whitespace-pre-line break-words`}>{cancellationPolicy}</div>
          </div>
        ) : null}
        {terms ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-stone-900">
              <FileText aria-hidden className="h-4 w-4 text-stone-500" />
              Booking terms
            </h3>
            <div className={`${PROSE} whitespace-pre-line break-words`}>{terms}</div>
          </div>
        ) : null}
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONTACT — the call to action
   A quotation whose reader cannot find the phone number has failed at the one
   thing it was sent to do. The footer is where it lived; the floating bar is
   so that it is never twelve screens away.
═══════════════════════════════════════════════════════════════════════════ */

const waNumber = (agency) => (agency?.whatsapp || "").replace(/[^\d]/g, "");

function ContactBar({ agency, headline, visible }) {
  const a = agency ?? {};
  const wa = waNumber(a);
  if (!a.phone && !wa) return null;

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 transition-all duration-200 ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
      }`}
    >
      <div className="mx-auto flex max-w-3xl items-center gap-3 border-t border-stone-200 bg-white/95 px-4 py-3 shadow-[0_-4px_20px_rgba(15,23,42,0.10)] backdrop-blur sm:mb-4 sm:rounded-2xl sm:border">
        {headline ? (
          <p className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[11px] font-medium text-stone-600">Per person from</span>
            <span className="block truncate text-base font-semibold text-stone-900">{headline}</span>
          </p>
        ) : (
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-stone-700">
            Questions about this trip?
          </p>
        )}

        {a.phone ? (
          <a
            href={`tel:${a.phone}`}
            aria-label={`Call ${a.phone}`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-2.5 text-sm font-semibold text-stone-900 transition hover:bg-stone-50"
          >
            <Phone aria-hidden className="h-4 w-4" />
            <span className="hidden sm:inline">Call</span>
          </a>
        ) : null}
        {wa ? (
          <a
            href={`https://wa.me/${wa}`}
            target="_blank"
            rel="noreferrer"
            /* emerald-700, not 500: white on emerald-500 is 2.46:1, so the one control this whole
               document exists to drive was the least legible text on the page. 700 is 5.37:1 and
               still unmistakably WhatsApp-green. */
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800"
          >
            <MessageCircle aria-hidden className="h-4 w-4" />
            WhatsApp
          </a>
        ) : null}
      </div>
    </div>
  );
}

function Footer({ agency }) {
  const a = agency ?? {};
  const wa = waNumber(a);

  return (
    <footer className="bg-stone-950 py-6 text-white">
      <div className="mx-auto w-full max-w-[1320px] px-5 min-[861px]:px-8">
        <AgencyMark agency={a} onDark />
        <p className="mt-4 max-w-lg text-sm text-stone-200">
          Questions, changes or a different date? Tell us what you would like and we will re-quote it.
        </p>

        <div className="mt-6 flex flex-wrap gap-2.5">
          {a.phone ? (
            <a
              href={`tel:${a.phone}`}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-stone-900 transition hover:bg-stone-100"
            >
              <Phone aria-hidden className="h-4 w-4" />
              Call {a.phone}
            </a>
          ) : null}
          {wa ? (
            <a
              href={`https://wa.me/${wa}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800"
            >
              <MessageCircle aria-hidden className="h-4 w-4" />
              WhatsApp us
            </a>
          ) : null}
          {/* The label used to be the address itself, which on a long domain overflowed a 360px
              row. The address is still one tap away, and still printed in full below. */}
          {a.email ? (
            <a
              href={`mailto:${a.email}`}
              title={a.email}
              className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              <Mail aria-hidden className="h-4 w-4" />
              Email us
            </a>
          ) : null}
        </div>

        {(a.address || a.email || a.website) ? (
          <div className="mt-8 space-y-1.5 border-t border-white/10 pt-5 text-xs text-stone-300">
            {a.address ? (
              <p className="flex items-start gap-2">
                <MapPin aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {a.address}
              </p>
            ) : null}
            {a.email ? (
              <p className="flex items-start gap-2">
                <Mail aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <a href={`mailto:${a.email}`} className="break-all underline underline-offset-2">
                  {a.email}
                </a>
              </p>
            ) : null}
            {a.website ? (
              <p className="flex items-start gap-2">
                <Globe aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <a href={a.website} target="_blank" rel="noreferrer" className="break-all underline underline-offset-2">
                  {a.website.replace(/^https?:\/\//, "")}
                </a>
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════════════════════════════ */

export default function PackageQuoteWebView() {
  const { publicId } = useParams();
  const [state, setState] = useState({ status: "loading", data: null, error: "" });
  const [pastHero, setPastHero] = useState(false);
  const heroEnd = useRef(null);
  // Which page (the itinerary, or the agency's about page) and which tier the bar and rail show.
  const [tab, setTab] = useState("trip");
  const [tierPick, setTierPick] = useState(null);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading", data: null, error: "" });
    getPublicPackageQuote(publicId)
      .then((data) => alive && setState({ status: "ok", data, error: "" }))
      .catch((e) => {
        if (!alive) return;
        // `e.message` is only safe to show when the service raised it deliberately. A dropped
        // connection rejects with the browser's own "Failed to fetch", and printing that on a
        // customer-facing quotation is worse than saying nothing useful at all.
        console.warn("[packageQuote] open failed", e);
        setState({
          status: "error",
          data: null,
          error: e?.friendly
            ? e.message
            : "Could not open this quotation. Please check your connection and try again.",
        });
      });
    return () => {
      alive = false;
    };
  }, [publicId]);

  const snap = state.data?.snapshot;

  // The contact bar appears only once the hero — and the price printed on it — has scrolled away.
  // Guarded because IntersectionObserver is missing on genuinely old in-app browsers, and there
  // the bar simply stays hidden rather than the page failing to mount.
  useEffect(() => {
    const node = heroEnd.current;
    if (!node || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(
      ([entry]) => setPastHero(!entry.isIntersecting),
      { rootMargin: "0px" }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [state.status]);

  // The headline is the recommended tier's price — the figure the agent chose to lead with, not
  // whichever happens to be cheapest.
  const headline = useMemo(() => {
    if (!snap) return null;
    const currency = snap.trip?.currency ?? state.data?.currency ?? "INR";
    const lead = (snap.tiers ?? []).find((t) => t.recommended) ?? (snap.tiers ?? [])[0];
    return money(state.data?.sellPerPax ?? lead?.sellPerPax, currency);
  }, [snap, state.data]);

  // Which sections will actually render. Kept in one place so the nav can never link to an
  // anchor that is not on the page — every entry repeats the exact guard its section uses.
  const navItems = useMemo(() => {
    if (!snap) return [];
    const hasTransfers =
      (snap.journeys ?? []).some((j) => j?.from || j?.to) ||
      (snap.tiers ?? []).some((t) => (t?.vehicleName ?? "").trim());
    return [
      snap.pkg?.overview ? { id: "overview", label: "Overview", icon: Sparkles } : null,
      (snap.tiers ?? []).some(tierHasContent) ? { id: "options", label: "Compare", icon: Wallet } : null,
      (snap.route ?? []).length ? { id: "route", label: "Route", icon: MapPin } : null,
      hasTransfers ? { id: "transfers", label: "Transfers", icon: Car } : null,
      (snap.days ?? []).length ? { id: "itinerary", label: "Itinerary", icon: CalendarDays } : null,
      (snap.gallery ?? []).length > 1 ? { id: "gallery", label: "Photos", icon: Images } : null,
      (snap.tiers ?? []).some((t) => (t.rateTable ?? []).length)
        ? { id: "rates", label: "Rates", icon: Receipt }
        : null,
      (snap.tiers ?? []).some((t) => (t?.paymentSchedule ?? []).length)
        ? { id: "payments", label: "Payments", icon: Wallet }
        : null,
      (snap.inclusions ?? []).length || (snap.exclusions ?? []).length
        ? { id: "inclusions", label: "Inclusions", icon: Check }
        : null,
      snap.cancellationPolicy || snap.terms || (snap.cancellationRules ?? []).some((r) => r?.label)
        ? { id: "terms", label: "Terms", icon: ScrollText }
        : null,
      snap.agency?.about || (snap.agency?.certifications ?? []).length || (snap.agency?.testimonials ?? []).some((t) => t?.text)
        ? { id: "about", label: "About", icon: ShieldCheck }
        : null,
    ].filter(Boolean);
  }, [snap]);

  useEffect(() => {
    const title = snap?.pkg?.title;
    if (title) document.title = `${title}${snap?.agency?.name ? ` · ${snap.agency.name}` : ""}`;
  }, [snap]);

  if (state.status === "loading") {
    return (
      <Centered>
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-[3px] border-stone-200 border-t-[#d81f2c]" />
          <p className="text-sm font-medium text-stone-600">Opening your quotation…</p>
        </div>
      </Centered>
    );
  }

  if (state.status === "error" || !snap) {
    return (
      <Centered>
        <div className="max-w-sm rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <TriangleAlert aria-hidden className="mx-auto mb-3 h-8 w-8 text-stone-500" />
          <h1 className="text-base font-semibold text-stone-900">This link did not open</h1>
          <p className="mt-2 text-sm text-stone-600">{state.error}</p>
        </div>
      </Centered>
    );
  }

  const hasContact = Boolean(snap.agency?.phone || waNumber(snap.agency));

  // The tiers the bar's pills and the rail switch between; the recommended one leads until the
  // reader picks another. `leadTier` also feeds the itinerary's "your hotel tonight" line.
  const shownTiers = (snap.tiers ?? []).filter(tierHasContent);
  const recommendedAt = Math.max(0, shownTiers.findIndex((t) => t.recommended));
  const pick = tierPick == null ? recommendedAt : Math.min(tierPick, Math.max(0, shownTiers.length - 1));
  const leadTier = shownTiers[pick] ?? null;
  const hasAbout = Boolean(
    snap.agency?.about ||
    (snap.agency?.certifications ?? []).length ||
    (snap.agency?.testimonials ?? []).some((t) => t?.text)
  );

  return (
    <div style={FONT} className="min-h-screen bg-white text-stone-900">
      <PageFonts />
      <TopBar agency={snap.agency} />
      <Hero snap={snap} sentinelRef={heroEnd} tab={tab} onTab={setTab} hasAbout={hasAbout} />

      {tab === "about" && hasAbout ? (
        /* The about page: one 700px column, like the reference's about-wrap. */
        <main className="mx-auto w-full max-w-[760px] px-5 pb-20 pt-8 min-[861px]:px-8 min-[861px]:pt-11">
          <AboutAgency agency={snap.agency} />
        </main>
      ) : (
        <>
          <PriceBar snap={snap} tiers={shownTiers} pick={pick} onPick={setTierPick} expired={state.data?.expired} />

          {/* On a phone there is no side rail, so the section chips are the way back up a
              nine-thousand-pixel page. From 861px the rail and the sticky bar do that job. */}
          <div className="min-[861px]:hidden">
            <SectionNav items={navItems} />
          </div>

          {/* page-body-wrap → page-body: 1320 wide, 32px gutters (the reference used 1140/48; the owner asked for less margin on a laptop), `1fr 286px` with a 40px gap from
              861px; one column below it. The rail is sticky at 76 (the 60px bar plus a gap). */}
          <div className="mx-auto w-full max-w-[1320px] px-4 pb-20 pt-4 min-[861px]:px-8 min-[861px]:pt-9">
            <div className="items-start min-[861px]:grid min-[861px]:grid-cols-[1fr_286px] min-[861px]:gap-10">
              <main className="min-w-0">
                {state.data?.expired ? (
                  <div className="mb-6 flex gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                    <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                    <p>
                      <strong className="font-semibold">These rates have lapsed.</strong>{" "}
                      The prices were valid until {day(snap.trip?.validUntil)}. Please contact us for an updated
                      quotation — the itinerary is still exactly as planned.
                    </p>
                  </div>
                ) : null}

                {snap.pkg?.overview ? (
                  <Section id="overview" icon={Sparkles} kicker="Overview" title="About this trip">
                    <RichText html={snap.pkg.overview} className="sm:text-[15px]" />
                  </Section>
                ) : null}

                <Itinerary days={snap.days} stays={leadTier?.hotels} />
                <TierCompare tiers={snap.tiers} trip={snap.trip} route={snap.route} pick={pick} onPick={setTierPick} />
                <StayRoute route={snap.route} />
                <Transfers journeys={snap.journeys} tiers={snap.tiers} />

                {(snap.gallery ?? []).length > 1 ? (
                  <Section id="gallery" icon={Images} kicker="Gallery" title="A look at the trip">
                    <PhotoGrid photos={snap.gallery.slice(1)} />
                  </Section>
                ) : null}

                <RateCard tiers={snap.tiers} trip={snap.trip} />
                <PaymentSchedule tiers={snap.tiers} trip={snap.trip} />
                <Lists inclusions={snap.inclusions} exclusions={snap.exclusions} />
                <Policies cancellationPolicy={snap.cancellationPolicy} terms={snap.terms} rules={snap.cancellationRules} />
              </main>

              <SideRail snap={snap} tiers={shownTiers} pick={pick} expired={state.data?.expired} />
            </div>
          </div>
        </>
      )}

      <Footer agency={snap.agency} />

      {/* The floating contact bar is the phone's rail; from 861px the sticky card has the CTAs. */}
      <div className="min-[861px]:hidden">
        {hasContact ? <div aria-hidden className="h-20" /> : null}
        <ContactBar agency={snap.agency} headline={headline} visible={pastHero} />
      </div>
    </div>
  );
}
