// src/app/chrome/Sidebar.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The tenant rail — rebuilt from ~20 top-level rows (≈55 destinations, all
// competing for one scrolling column) into a short, learnable list:
//
//   • a flat PRIMARY list — the screens a travel desk lives in, no group headers
//   • PINNED — anything else this person wants permanently within reach
//   • More   — the full grouped grid, one click away
//   • ⌘K     — type instead of hunting
//
// Structural fixes carried over from the old rail:
// • Active state is the route, not component state. The old rail re-highlighted
//   "Dashboard" after every refresh, whatever page you were actually on.
// • It rests as a 68px icon strip, opens on hover and closes when the pointer
//   leaves — or stays open if pinned from the footer button (⌘B).
// • Hover is POINTER-driven, so a tap on a phone can no longer leave the rail
//   stuck open the way the old mouseenter version did.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, LayoutGrid, PanelLeftClose, PanelLeftOpen, Pin, X } from "lucide-react";

import { companyService } from "@features/settings";

import { useNav } from "../nav/NavProvider";
import { TONE_TEXT } from "../nav/navConfig";

/**
 * Idle icons keep their per-module colour — the thing that makes this rail
 * scannable at a glance rather than a column of identical grey glyphs. On the
 * active row the tint is dropped for white, because the row is already a solid
 * blue fill and a coloured icon on it just loses contrast.
 */
const iconTone = (tone, active) =>
  active ? "text-white" : TONE_TEXT[tone] || "text-slate-400";

// (name || "") — NOT a `= ""` default: a default only fires on `undefined`, so a
// null company name (any tenant that has not filled its profile) would hit
// null.trim() and crash the whole shell.
const initialsOf = (name) =>
  (name || "")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "CO";

const ROW =
  "group relative flex w-full items-center rounded-lg text-[13.5px] font-medium transition-colors duration-150";
const ROW_IDLE = "text-slate-400 hover:bg-white/[0.06] hover:text-white";
const ROW_ACTIVE = "bg-blue-600 text-white font-semibold";

export default function Sidebar() {
  const {
    railItems,
    activeTrail,
    activeDestination,
    pinnedDestinations,
    togglePin,
    railCollapsed,
    setRailCollapsed,
    openLauncher,
    mobileNavOpen,
    setMobileNavOpen,
  } = useNav();

  // Accordion: exactly ONE group open at a time — opening Bookings closes Leads.
  // Held as a single id (`null` = all closed) rather than a Set, so "two groups
  // open" is not a state this rail can be in at all.
  const [openGroupId, setOpenGroupId] = useState(() => activeTrail.itemId ?? null);

  // Hover-to-open. The rail rests as a 68px icon strip and widens while the
  // pointer is over it, closing again as soon as it leaves — unless it has been
  // pinned open from the footer button (or ⌘B), in which case hover does nothing.
  const [hovered, setHovered] = useState(false);
  const hoverTimer = useRef(null);

  // Tenant branding. Reloads on the "company-updated" event the profile page
  // fires after a save, so a new logo lands here without a page reload.
  const [company, setCompany] = useState(null);
  const brandName = company?.name || "TravelCRM";

  useEffect(() => {
    const loadCompany = () => {
      if (!localStorage.getItem("token")) return;
      companyService
        .get()
        .then((res) => setCompany(res.data?.data ?? res.data ?? null))
        .catch(() => setCompany(null)); // header falls back to initials
    };
    loadCompany();
    window.addEventListener("company-updated", loadCompany);
    return () => window.removeEventListener("company-updated", loadCompany);
  }, []);

  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  const activeId = activeDestination?.id ?? null;

  // Hovering counts as expanded: `compact` drives both the width and the labels.
  const compact = railCollapsed && !hovered;

  // Pointer-driven, so touch never triggers it: a tap on a phone fires a synthetic
  // mouseenter that would otherwise leave the rail stuck open with no way to close.
  const onPointerEnter = (e) => {
    if (e.pointerType !== "mouse" || !railCollapsed) return;
    window.clearTimeout(hoverTimer.current);
    setHovered(true);
  };
  const onPointerLeave = (e) => {
    if (e.pointerType && e.pointerType !== "mouse") return;
    // A small grace period: crossing the 68px strip diagonally toward a menu item
    // briefly leaves the element, and snapping shut mid-reach is maddening.
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setHovered(false), 140);
  };

  // The group owning the current route opens itself — but as a SEED, not an
  // override. The old rail OR-ed `activeTrail.itemId` into the open test, which
  // pinned the active group open forever: sitting on a booking page and opening
  // Leads left both expanded, because nothing could ever close Bookings.
  //
  // Adjusted during render rather than in an effect (React's documented
  // "changing state when a prop changes" pattern): an effect would paint one
  // frame with the previous route's group still expanded before correcting it.
  // Normalised to null first — comparing a raw `undefined` against a stored
  // `null` would never settle, and this runs on every render.
  const trailItemId = activeTrail.itemId ?? null;
  const [seededTrail, setSeededTrail] = useState(trailItemId);
  if (trailItemId !== seededTrail) {
    setSeededTrail(trailItemId);
    setOpenGroupId(trailItemId);
  }

  // Clicking the open group collapses it; clicking any other one replaces it.
  const toggleGroup = (id) => setOpenGroupId((prev) => (prev === id ? null : id));

  const isGroupOpen = (item) => openGroupId === item.id;

  const closeOnMobile = () => {
    if (window.innerWidth < 768) setMobileNavOpen(false);
  };

  // Following a link ends the peek — otherwise the rail hangs open over the page
  // you just navigated to until the pointer happens to move away.
  const handleNavigate = () => {
    setHovered(false);
    closeOnMobile();
  };

  return (
    <>
      {/* Scrim — mobile only; the drawer sits above it. */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-[1px] md:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* The rail is an ordinary flex child, so hovering widens it in place and the
          page moves over — the behaviour this app has always had.
          (An overlaid peek was tried and is NOT possible here: Layout wraps the rail
          and the content in a `flex flex-1 overflow-hidden` row, which clips any
          absolutely-positioned child at the rail's own width, so the expanded panel
          simply never appeared.) */}
      <aside
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        className={`fixed inset-y-0 left-0 z-50 flex h-screen shrink-0 flex-col border-r border-white/[0.07] bg-[#1a1f26] font-sans text-slate-300 transition-[width,transform] duration-200 ease-out md:relative md:h-auto md:translate-x-0 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        } ${compact ? "w-[260px] md:w-[68px]" : "w-[260px]"}`}
        aria-label="Main navigation"
      >
        {/* ── Brand ─────────────────────────────────────────────────────────── */}
        <div
          className={`flex h-16 shrink-0 items-center gap-2.5 border-b border-white/[0.07] ${
            compact ? "px-4 md:justify-center md:px-0" : "px-4"
          }`}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-blue-600 ring-1 ring-white/10">
            {company?.logoUrl ? (
              <img
                src={company.logoUrl}
                alt={brandName}
                className="h-full w-full bg-white object-contain p-0.5"
              />
            ) : (
              <span className="text-sm font-bold text-white">{initialsOf(company?.name)}</span>
            )}
          </div>
          <p
            title={brandName}
            className={`min-w-0 flex-1 truncate text-[15px] font-bold tracking-tight text-white ${
              compact ? "md:hidden" : ""
            }`}
          >
            {brandName}
          </p>
          {/* Pin / unpin, in the header where the rail's own controls belong.
              Reads `railCollapsed`, NOT `compact` — while you are hovering a
              collapsed rail it LOOKS open, but what this toggles is whether it
              stays open once the pointer leaves. Hidden in the resting icon rail,
              which has no room for it; it appears as soon as the rail opens. */}
          <button
            type="button"
            onClick={() => {
              setRailCollapsed(!railCollapsed);
              setHovered(false);
            }}
            title={railCollapsed ? "Keep sidebar open" : "Collapse to icons"}
            aria-label={railCollapsed ? "Keep sidebar open" : "Collapse to icons"}
            aria-pressed={!railCollapsed}
            className={`hidden shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-white md:block ${
              compact ? "md:hidden" : ""
            }`}
          >
            {railCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>

          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-white md:hidden"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Primary rail ──────────────────────────────────────────────────── */}
        <nav className="nav-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-3">
          <ul className="space-y-1">
            {railItems.map((item) => {
              const open = isGroupOpen(item);
              const hasChildren = item.children?.length > 0;
              const active = activeId === item.id || activeTrail.itemId === item.id;

              return (
                <li
                  key={item.id}
                >
                  {hasChildren ? (
                    <button
                      type="button"
                      onClick={() => (compact ? setRailCollapsed(false) : toggleGroup(item.id))}
                      title={item.label}
                      aria-expanded={open}
                      className={`${ROW} ${active ? ROW_ACTIVE : ROW_IDLE} ${
                        compact ? "justify-center px-2 py-2.5 md:px-0" : "gap-3 px-3 py-2.5"
                      }`}
                    >
                      <item.Icon
                        size={18}
                        className={`shrink-0 ${iconTone(item.tone, active)}`}
                        strokeWidth={active ? 2.3 : 2}
                      />
                      <span className={`flex-1 truncate text-left ${compact ? "md:hidden" : ""}`}>
                        {item.label}
                      </span>
                      <ChevronDown
                        size={14}
                        className={`shrink-0 opacity-60 transition-transform duration-150 ${
                          open ? "rotate-180" : ""
                        } ${compact ? "md:hidden" : ""}`}
                      />
                    </button>
                  ) : (
                    <Link
                      to={item.path}
                      onClick={handleNavigate}
                      title={item.label}
                      aria-current={active ? "page" : undefined}
                      className={`${ROW} ${active ? ROW_ACTIVE : ROW_IDLE} ${
                        compact ? "justify-center px-2 py-2.5 md:px-0" : "gap-3 px-3 py-2.5"
                      }`}
                    >
                      <item.Icon
                        size={18}
                        className={`shrink-0 ${iconTone(item.tone, active)}`}
                        strokeWidth={active ? 2.3 : 2}
                      />
                      <span className={`flex-1 truncate ${compact ? "md:hidden" : ""}`}>
                        {item.label}
                      </span>
                    </Link>
                  )}

                  {/* Children inline in the expanded rail; the collapsed rail
                      rail opens on hover, so there is nothing to serve separately. */}
                  {hasChildren && open && !compact && (
                    <ul className="mt-1 space-y-0.5 pb-1">
                      {item.children.map((child) => {
                        const on = activeId === child.id;
                        return (
                          <li key={child.id}>
                            <Link
                              to={child.path}
                              onClick={handleNavigate}
                              aria-current={on ? "page" : undefined}
                              className={`flex items-center gap-2.5 rounded-lg py-2 pl-11 pr-3 text-[13px] transition-colors ${
                                on
                                  ? "font-semibold text-white"
                                  : "font-medium text-slate-400 hover:bg-white/[0.05] hover:text-white"
                              }`}
                            >
                              {/* The dot inherits the parent module's colour:
                                  `bg-current` paints it with the tone class's
                                  text colour, so one map drives icons and dots. */}
                              <span
                                className={`h-1.5 w-1.5 shrink-0 rounded-full bg-current ${
                                  on ? "text-white" : `${TONE_TEXT[item.tone] || "text-slate-500"} opacity-60`
                                }`}
                              />
                              <span className="truncate">{child.label}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>

          {/* ── Pinned ──────────────────────────────────────────────────────── */}
          {pinnedDestinations.length > 0 && (
            <div className="mt-4 border-t border-white/[0.07] pt-3">
              <p
                className={`px-3 pb-1.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-500 ${
                  compact ? "md:hidden" : ""
                }`}
              >
                Pinned
              </p>
              <ul className="space-y-1">
                {pinnedDestinations
                  // A pin that is already on the rail would render the same row twice.
                  .filter((d) => !railItems.some((r) => r.id === d.id))
                  .map((d) => {
                  const on = activeId === d.id;
                  return (
                    <li key={`pin-${d.id}`}>
                      <Link
                        to={d.path}
                        onClick={handleNavigate}
                        title={d.label}
                        aria-current={on ? "page" : undefined}
                        className={`${ROW} ${on ? ROW_ACTIVE : ROW_IDLE} ${
                          compact ? "justify-center px-2 py-2.5 md:px-0" : "gap-3 px-3 py-2.5"
                        }`}
                      >
                        {d.Icon && (
                          <d.Icon
                            size={18}
                            className={`shrink-0 ${iconTone(d.tone, on)}`}
                            strokeWidth={on ? 2.3 : 2}
                          />
                        )}
                        <span className={`flex-1 truncate ${compact ? "md:hidden" : ""}`}>
                          {d.label}
                        </span>
                        <span
                          role="button"
                          tabIndex={-1}
                          title="Unpin"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            togglePin(d.id);
                          }}
                          className={`shrink-0 opacity-50 transition-opacity hover:opacity-100 ${
                            compact ? "md:hidden" : ""
                          }`}
                        >
                          <Pin size={13} />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </nav>

        {/* ── Footer: All apps ──────────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-white/[0.07] p-2.5">
          <button
            type="button"
            onClick={(e) => openLauncher(e.currentTarget)}
            title="All apps"
            className={`flex w-full items-center justify-center gap-2.5 rounded-lg border border-white/[0.07] bg-white/[0.04] py-2.5 text-[13px] font-semibold text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white ${
              compact ? "px-0" : "px-3"
            }`}
          >
            <LayoutGrid size={17} className="shrink-0" />
            <span className={compact ? "md:hidden" : ""}>More</span>
          </button>
        </div>
      </aside>

      {/* Rail-local scrollbar. Deliberately not the app-wide `custom-scrollbar`
          class, which is only ever injected by individual feature pages. */}
      <style>{`
        .nav-scroll::-webkit-scrollbar { width: 6px; }
        .nav-scroll::-webkit-scrollbar-track { background: transparent; }
        .nav-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,.10); border-radius: 999px; }
        .nav-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,.18); }
        .nav-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.12) transparent; }
      `}</style>
    </>
  );
}
