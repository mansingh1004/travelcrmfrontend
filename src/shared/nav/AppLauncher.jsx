// src/shared/nav/AppLauncher.jsx
// ─────────────────────────────────────────────────────────────────────────────
// "All apps" — the DISCOVERY surface, and the reason the rails can stay short.
//
// The rail carries only the handful of screens someone uses hourly. Everything
// else lives here: grouped, searchable, one tap deep, and star-able onto the rail
// for whoever needs it there. That is the whole answer to "too many menu items" —
// not fewer features, just fewer of them competing for the same column.
//
// Shared by both realms with two skins, like CommandPalette.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Star, X } from "lucide-react";

import { fuzzyScore } from "./navModel";

// Anchored-popover geometry. Below `ANCHOR_MIN_WIDTH` the popover is abandoned for
// a full-screen sheet — a 620px card pinned under a button does not exist on a phone.
const PANEL_WIDTH = 620;
const PANEL_MAX_HEIGHT = 560;
const ANCHOR_MIN_WIDTH = 640;
const GAP = 8;
const EDGE = 16;

/**
 * Place the panel under (or above) its trigger, clamped to the viewport.
 * Returns `null` to mean "render the mobile sheet instead".
 */
function placeAt(anchor) {
  if (!anchor || window.innerWidth < ANCHOR_MIN_WIDTH) return null;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const width = Math.min(PANEL_WIDTH, vw - EDGE * 2);
  const left = Math.max(EDGE, Math.min(anchor.left, vw - width - EDGE));

  const below = vh - anchor.bottom - GAP - EDGE;
  const above = anchor.top - GAP - EDGE;
  // Flip up only when below is genuinely cramped AND above is roomier — this is
  // what makes the sidebar's own "More" button (which sits at the very bottom of
  // the rail) open upward instead of off the bottom of the screen.
  const flipUp = below < 320 && above > below;

  const maxHeight = Math.max(240, Math.min(PANEL_MAX_HEIGHT, flipUp ? above : below));
  const top = flipUp ? Math.max(EDGE, anchor.top - maxHeight - GAP) : anchor.bottom + GAP;

  return { left, top, width, maxHeight };
}

const SKIN = {
  app: {
    overlay: "bg-slate-900/50 backdrop-blur-[2px]",
    panel: "bg-white border-slate-200 shadow-2xl shadow-slate-900/20",
    headBorder: "border-slate-100",
    input: "text-slate-800 placeholder-slate-400",
    icon: "text-slate-400",
    close: "text-slate-400 hover:bg-slate-100 hover:text-slate-700",
    group: "text-slate-400",
    tile: "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
    tileActive: "border-blue-300 bg-blue-50/60",
    tileLabel: "text-slate-700",
    tileMeta: "text-slate-400",
    star: "text-slate-300 hover:text-amber-500",
    starOn: "text-amber-500",
    footer: "border-slate-100 bg-slate-50/70 text-slate-400",
  },
  console: {
    overlay: "bg-black/55 backdrop-blur-[2px]",
    panel: "bg-surface border-border shadow-[var(--sa-card-shadow)]",
    headBorder: "border-border",
    input: "text-heading placeholder-muted",
    icon: "text-muted",
    close: "text-muted hover:bg-surface-hover hover:text-body",
    group: "text-muted",
    tile: "border-border bg-surface hover:border-border-strong hover:bg-surface-hover",
    tileActive: "border-accent/40 bg-accent-soft",
    tileLabel: "text-heading",
    tileMeta: "text-muted",
    star: "text-muted hover:text-hue-amber",
    starOn: "text-hue-amber",
    footer: "border-border bg-surface-hover/40 text-muted",
  },
};

export default function AppLauncher({
  open,
  onClose,
  sections = [],
  isPinned,
  togglePin,
  activeId,
  anchor = null,
  tone = {},
  theme = "app",
  title = "All apps",
  /* Whether a whole MODULE may be pinned, not just its pages. Opt-in, and off by
     default, because it is only half a feature here: the realm's sidebar has to
     be able to resolve a group id back into a row. The tenant rail can (its pins
     resolve against destinations + flattenGroups); the console's resolves against
     flattenDestinations alone, which is leaves only — offering the star there
     would store a pin that renders as nothing at all. */
  allowGroupPins = false,
}) {
  const skin = SKIN[theme] || SKIN.app;
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setQuery("");
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Placement is measured before paint, so the panel never renders at 0,0 and jump
  // to its anchor. Re-measured on resize; `null` means "no anchor / too narrow",
  // which falls back to the full-screen sheet.
  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = () => setPos(placeAt(anchor));
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, anchor]);

  /* Tiles are still one per DESTINATION, but they are no longer a single flat run
     per section. A module's pages now sit under the module's own heading, and that
     heading carries a star of its own.

     The flat version listed "Browse catalog" and "Hotel requests" as two unrelated
     tiles that happened to share an icon, with "Platform Hotels" — the thing the
     user actually thinks of as the app — named nowhere and impossible to pin. You
     can now pin the module whole (one sidebar row that expands to its pages) or
     still pin a single page, which is what the shipped DEFAULT_PINS are.

     `loose` holds items that ARE a destination themselves, so they keep the plain
     grid they always had. */
  const groups = useMemo(() => {
    const q = query.trim();
    const keep = (label, keywords) =>
      !q || fuzzyScore(q, label) !== null || (keywords && fuzzyScore(q, keywords) !== null);

    return sections
      .map((section) => {
        const loose = [];
        const blocks = [];
        for (const item of section.items) {
          const itemMatches = keep(item.label, item.keywords);
          if (item.path && itemMatches) {
            loose.push({ ...item, parent: null });
          }
          const tiles = [];
          for (const child of item.children || []) {
            // A matching PARENT brings all its children — you searched for the
            // group, you want to see what is in it.
            if (!itemMatches && !keep(child.label, child.keywords)) continue;
            tiles.push({
              ...child,
              Icon: child.Icon || item.Icon,
              tone: child.tone || item.tone,
              parent: item.label,
            });
          }
          if (!tiles.length) continue;
          /* A realm that cannot pin a module has no use for the heading either —
             it would be a label over tiles that were already labelled, and the
             console did not ask to have its launcher rearranged. There, children
             stay in the one flat grid they have always been in. */
          if (!allowGroupPins) {
            loose.push(...tiles);
            continue;
          }
          blocks.push({
            id: item.id,
            label: item.label,
            tone: item.tone,
            // Only a module with two or more real pages can be pinned whole, and the
            // test has to match flattenGroups() — that is what resolves the id back
            // into a sidebar row, so a star offered here that it will not resolve
            // would pin something that then renders as nothing.
            pinnable: (item.children || []).filter((c) => c.path).length >= 2,
            tiles,
          });
        }
        return { ...section, loose, blocks };
      })
      .filter((s) => s.loose.length || s.blocks.length);
  }, [sections, query, allowGroupPins]);

  if (!open) return null;

  const total = groups.reduce(
    (n, g) => n + g.loose.length + g.blocks.reduce((m, b) => m + b.tiles.length, 0),
    0,
  );

  /* A plain function, not a component: declaring a component inside the render
     gives it a new identity every keystroke, so every tile would unmount and
     remount on each character typed into the search box. */
  const renderTile = (tile) => {
    const pinned = isPinned?.(tile.id);
    const here = activeId === tile.id;
    return (
      <div key={tile.id} className="relative">
        <Link
          to={tile.path}
          onClick={onClose}
          title={tile.parent ? `${tile.parent} · ${tile.label}` : tile.label}
          className={`flex h-full flex-col items-center gap-2 rounded-xl border px-2 py-4 text-center transition-all ${
            here ? skin.tileActive : skin.tile
          }`}
        >
          {tile.Icon && (
            <tile.Icon size={22} className={tone[tile.tone] || skin.icon} strokeWidth={1.9} />
          )}
          <span
            className={`line-clamp-2 text-[12px] font-semibold leading-tight ${skin.tileLabel}`}
          >
            {tile.label}
          </span>
        </Link>

        {togglePin && (
          <button
            type="button"
            onClick={() => togglePin(tile.id)}
            title={pinned ? "Unpin from sidebar" : "Pin to sidebar"}
            aria-label={pinned ? `Unpin ${tile.label}` : `Pin ${tile.label}`}
            aria-pressed={!!pinned}
            className={`absolute right-1.5 top-1.5 rounded-md p-1 transition-colors ${
              pinned ? skin.starOn : skin.star
            }`}
          >
            <Star size={13} fill={pinned ? "currentColor" : "none"} />
          </button>
        )}
      </div>
    );
  };

  // Anchored under its trigger on desktop; a full-screen sheet on phones, where a
  // 620px card hanging off a button is not a shape that exists.
  const anchored = !!pos;

  /* Declared AFTER `anchored`, and that is load-bearing rather than stylistic.
     Both are plain consts in this same function body, so reading `anchored` from
     a const declared above it is a temporal-dead-zone ReferenceError the instant
     the sheet renders — which is a blank, un-openable launcher, and a clean build,
     because nothing about it is a type error. */
  const gridClass = `grid gap-2.5 ${
    anchored ? "grid-cols-4" : "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5"
  }`;

  return (
    <div
      // No dim behind an anchored popover — a dropdown that darkens the page reads
      // as a modal and makes a one-click menu feel like a commitment. The mobile
      // sheet DOES dim, because there it genuinely covers the page.
      className={`fixed inset-0 z-[65] ${
        anchored ? "" : `flex items-start justify-center ${skin.overlay}`
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal={anchored ? undefined : "true"}
        aria-label={title}
        style={
          anchored
            ? { position: "fixed", top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }
            : undefined
        }
        className={`flex flex-col overflow-hidden ${skin.panel} ${
          anchored
            ? "rounded-2xl border shadow-2xl"
            : "h-full w-full max-w-4xl border-0"
        }`}
        onKeyDown={(e) => e.key === "Escape" && onClose?.()}
      >
        {/* Search */}
        <div className={`flex shrink-0 items-center gap-3 border-b px-4 py-3 sm:px-5 ${skin.headBorder}`}>
          <Search size={17} className={`shrink-0 ${skin.icon}`} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search apps…"
            aria-label="Search apps"
            autoComplete="off"
            className={`min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none ${skin.input}`}
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`rounded-lg p-1.5 transition-colors ${skin.close}`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tiles */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {total === 0 ? (
            <p className={`py-16 text-center text-sm ${skin.tileMeta}`}>
              Nothing matches “{query.trim()}”
            </p>
          ) : (
            groups.map((section) => (
              <section key={section.id} className="mb-6 last:mb-1">
                <h3
                  className={`mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.15em] ${skin.group}`}
                >
                  {section.label}
                </h3>

                {/* Anchored, the panel is a fixed 620px, so the column count is
                    fixed too — `lg:` tracks the VIEWPORT, not this box, and would
                    otherwise squeeze five tiles into it on a wide monitor. */}
                {section.loose.length > 0 && (
                  <div className={gridClass}>{section.loose.map(renderTile)}</div>
                )}

                {section.blocks.map((block) => (
                  <div key={block.id} className={section.loose.length ? "mt-4" : ""}>
                    {/* The module itself: named, and pinnable as one row. Its star
                        pins the WHOLE module — the sidebar then shows a single
                        collapsible row carrying the pages below. */}
                    <div className="mb-2 flex items-center gap-2">
                      <span className={`text-[11.5px] font-bold ${skin.tileLabel}`}>
                        {block.label}
                      </span>
                      {togglePin && block.pinnable && (
                        <button
                          type="button"
                          onClick={() => togglePin(block.id)}
                          title={
                            isPinned?.(block.id)
                              ? "Unpin module from sidebar"
                              : "Pin whole module to sidebar"
                          }
                          aria-label={
                            isPinned?.(block.id)
                              ? `Unpin ${block.label}`
                              : `Pin ${block.label}`
                          }
                          aria-pressed={!!isPinned?.(block.id)}
                          className={`rounded-md p-0.5 transition-colors ${
                            isPinned?.(block.id) ? skin.starOn : skin.star
                          }`}
                        >
                          <Star
                            size={12}
                            fill={isPinned?.(block.id) ? "currentColor" : "none"}
                          />
                        </button>
                      )}
                    </div>
                    <div className={gridClass}>{block.tiles.map(renderTile)}</div>
                  </div>
                ))}
              </section>
            ))
          )}
        </div>

        <div className={`shrink-0 border-t px-5 py-2 text-[11px] font-medium ${skin.footer}`}>
          Tap the star to pin an app to your sidebar.
        </div>
      </div>
    </div>
  );
}
