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

import { useEffect, useRef, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { ChevronDown, LayoutGrid, Pin, X } from "lucide-react";

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
    // Reads `railCollapsed` but no longer writes it: the header chevron owns opening
    // and closing, and a collapsed group now opens a flyout rather than the rail.
    railCollapsed,
    openLauncher,
    mobileNavOpen,
    setMobileNavOpen,
  } = useNav();

  // Accordion: exactly ONE group open at a time — opening Bookings closes Leads.
  // Held as a single id (`null` = all closed) rather than a Set, so "two groups
  // open" is not a state this rail can be in at all.
  const [openGroupId, setOpenGroupId] = useState(() => activeTrail.itemId ?? null);

  // REMOVED: hover-to-open. The rail used to widen whenever the pointer crossed it
  // and shut again on the way out, with a 140ms grace period so a diagonal reach
  // toward a menu item did not snap it closed.
  //
  // It is the header chevron alone now. Hover meant the rail changed width without
  // anyone asking it to — passing over it on the way to the page opened a 260px
  // panel across the content, and the state it appeared to be in was never the
  // state it would be in a moment later. One control, one explicit click, and the
  // rail stays where it was put.

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

  const activeId = activeDestination?.id ?? null;

  // `compact` is now exactly what the chevron last set — the rail has no second,
  // transient way of being open.
  const compact = railCollapsed;

  /* ── Icon-rail tooltips ────────────────────────────────────────────────────
     The collapsed rail is 68px of unlabelled glyphs, so each one names itself on
     hover. `title` cannot do it: it waits about a second, lands wherever the
     cursor is rather than beside the icon, and its dark-on-light system styling
     is the one thing on this rail that cannot be themed.

     Rendered through a portal into <body> for the reason the note at the top of
     the <aside> already gives — the nav scrolls (`overflow-y-auto
     overflow-x-hidden`) and the chrome row above it is `overflow-hidden`, so a
     tip positioned at `left-full` would be cut off at the rail's own edge. Fixed
     coordinates measured off the row escape both. AllLeads' CityTip solves the
     same problem the same way.

     Mouse only. A tap fires a synthetic pointerenter, and on a phone that would
     leave a tooltip stranded with nothing to dismiss it — and the phone rail is
     the full-width drawer anyway, where every row is already labelled. */
  const [tip, setTip] = useState(null);

  /* ── Icon-rail flyout ──────────────────────────────────────────────────────
     A group in the collapsed rail used to widen the whole sidebar just to show
     five links — you asked for one module and got the entire navigation, over the
     page you were reading. Clicking one now opens its children beside the icon and
     leaves the rail alone.

     Same portal, and for the same clipping reason as the tooltip. It also holds
     the item rather than an index, so a nav tree that reorders under it cannot
     leave the panel showing one module's name over another's links. */
  const [flyout, setFlyout] = useState(null);

  useEffect(() => {
    if (!tip && !flyout) return undefined;
    const close = () => { setTip(null); setFlyout(null); };
    // Capture, so the nav's own scroll closes them too — the coordinates go stale
    // the moment anything moves.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [tip, flyout]);

  /* The flyout is a click-opened surface, so it needs the two dismissals every
     menu needs and a tooltip does not: anywhere else, and Escape. */
  useEffect(() => {
    if (!flyout) return undefined;
    const onDown = (event) => {
      if (!event.target.closest?.("[data-rail-flyout]")) setFlyout(null);
    };
    const onKey = (event) => { if (event.key === "Escape") setFlyout(null); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [flyout]);

  // Expanded rail already prints every label, so it gets no handlers at all.
  const tipProps = (label) =>
    !compact || !label
      ? {}
      : {
          onPointerEnter: (event) => {
            if (event.pointerType !== "mouse") return;
            const rect = event.currentTarget.getBoundingClientRect();
            setTip({ label, top: rect.top + rect.height / 2, left: rect.right + 10 });
          },
          onPointerLeave: () => setTip(null),
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

  // Used to also end the hover peek, which no longer exists — a rail opened by the
  // chevron is meant to stay open across navigations, so only the mobile drawer
  // closes here.
  const handleNavigate = () => {
    closeOnMobile();
  };

  /* ── Pinned rows, folded back under the module they belong to ─────────────────
     Pins are LEAVES: the launcher deliberately offers one tile per destination
     ("the group Leads contributes its children … because those are what people
     pin"), so pinning Browse catalog and Hotel requests produced two unrelated
     rows carrying the same inherited icon, with the module that owns them named
     nowhere. Siblings are regrouped here under the parent, which is how the user
     already reads them three inches higher in the rail.

     Only from TWO siblings up. A lone pin under its own header is a group of one:
     it costs a row and a disclosure to say nothing the row did not already say.

     Purely presentational — the pin set is untouched, each child keeps its own
     unpin, and the group is keyed on the parent's real item id so the rail's
     one-open-at-a-time accordion (seeded from activeTrail.itemId) expands it by
     itself when the route lands on one of its children. */
  const pinnedRows = useMemo(() => {
    // A pin that is already on the rail would render the same row twice.
    const visible = pinnedDestinations.filter(
      (d) => !railItems.some((r) => r.id === d.id),
    );

    // Modules pinned whole. Their children are already on screen underneath them,
    // so a separately-pinned child of one would render the same row twice.
    const pinnedGroupIds = new Set(
      visible.filter((d) => d.kind === "group").map((d) => d.id),
    );

    const siblingCount = new Map();
    for (const d of visible) {
      if (!d.parentId || pinnedGroupIds.has(d.parentId)) continue;
      siblingCount.set(d.parentId, (siblingCount.get(d.parentId) || 0) + 1);
    }

    const rows = [];
    const groupAt = new Map();
    for (const d of visible) {
      /* Pinned as a MODULE, not a page — the launcher offers the group its own pin,
         so this arrives already carrying its children and needs no regrouping.
         `pinnedAsGroup` is what the renderer keys the unpin control off: here the
         GROUP is the pin, so the control belongs on the header. On a group this
         component merely DERIVED from sibling leaves it is the opposite — the
         children are the pins, and an unpin on the header would remove something
         the user never created. Getting that backwards is not a cosmetic slip:
         togglePin on an unpinned child would ADD a pin, not remove one. */
      if (d.kind === "group") {
        rows.push({
          kind: "group",
          pinnedAsGroup: true,
          id: d.id,
          label: d.label,
          Icon: d.Icon,
          tone: d.tone,
          children: d.children || [],
        });
        continue;
      }
      if (d.parentId && pinnedGroupIds.has(d.parentId)) continue;
      if (!d.parentId || (siblingCount.get(d.parentId) || 0) < 2) {
        rows.push({ kind: "leaf", d });
        continue;
      }
      const at = groupAt.get(d.parentId);
      if (at != null) {
        rows[at].children.push(d);
        continue;
      }
      groupAt.set(d.parentId, rows.length);
      rows.push({
        kind: "group",
        // Derived, not pinned: the children are the pins — see the note above.
        pinnedAsGroup: false,
        id: d.parentId,
        label: d.parentLabel,
        // Off the child, not looked up again: flattenDestinations already inherits
        // both from the parent when the child declares none, so this IS the
        // module's own icon and colour.
        Icon: d.Icon,
        tone: d.tone,
        children: [d],
      });
    }
    return rows;
  }, [pinnedDestinations, railItems]);

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
          {/* The pin / unpin button used to sit here. It moved to the header
              (Navbar.jsx) because in the rail it was only half a switch — the resting
              icon rail has no room for it, so the control that collapsed the sidebar
              was not there to bring it back. One chevron in the header now does both
              directions off the same `railCollapsed` this used to write. */}

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
                      onClick={(event) => {
                        if (!compact) return toggleGroup(item.id);
                        // Collapsed: open the group beside its icon instead of
                        // expanding the whole rail over the page.
                        const rect = event.currentTarget.getBoundingClientRect();
                        setTip(null);
                        setFlyout((current) =>
                          current?.item.id === item.id
                            ? null
                            : { item, top: rect.top, left: rect.right + 10 }
                        );
                        return undefined;
                      }}
                      {...tipProps(item.label)}
                      // `title` only where the tooltip is not doing the job, so the two
                      // never stack up on the same row.
                      title={compact ? undefined : item.label}
                      aria-label={item.label}
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
                      {...tipProps(item.label)}
                      title={compact ? undefined : item.label}
                      aria-label={item.label}
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

                  {/* Children inline in the expanded rail only. The note that used to
                      stand here said the collapsed rail served them by opening on
                      hover — it no longer opens on hover at all, so in the icon rail a
                      group is a single button that expands the rail when clicked, and
                      its children appear once it is open. */}
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
          {pinnedRows.length > 0 && (
            <div className="mt-4 border-t border-white/[0.07] pt-3">
              <p
                className={`px-3 pb-1.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-500 ${
                  compact ? "md:hidden" : ""
                }`}
              >
                Pinned
              </p>
              <ul className="space-y-1">
                {pinnedRows.map((row) => {
                  if (row.kind === "group") {
                    const open = openGroupId === row.id;
                    const active = row.children.some((c) => activeId === c.id);
                    return (
                      <li key={`pin-group-${row.id}`}>
                        {/* Same control as a rail group, down to the collapsed-rail
                            behaviour: in the icon strip there is nowhere to show
                            children, so the header opens the rail instead of
                            toggling a list nobody can see. */}
                        <button
                          type="button"
                          onClick={() => (compact ? setRailCollapsed(false) : toggleGroup(row.id))}
                          title={row.label}
                          aria-expanded={open}
                          className={`${ROW} ${active ? ROW_ACTIVE : ROW_IDLE} ${
                            compact ? "justify-center px-2 py-2.5 md:px-0" : "gap-3 px-3 py-2.5"
                          }`}
                        >
                          {row.Icon && (
                            <row.Icon
                              size={18}
                              className={`shrink-0 ${iconTone(row.tone, active)}`}
                              strokeWidth={active ? 2.3 : 2}
                            />
                          )}
                          <span className={`flex-1 truncate text-left ${compact ? "md:hidden" : ""}`}>
                            {row.label}
                          </span>
                          {/* Unpin sits here only when the GROUP is what was pinned.
                              On a group derived from sibling leaves it belongs on
                              each child instead — the header is not a pin, and
                              togglePin on it would CREATE one. */}
                          {row.pinnedAsGroup && (
                            <span
                              role="button"
                              tabIndex={-1}
                              title="Unpin"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                togglePin(row.id);
                              }}
                              className={`shrink-0 opacity-50 transition-opacity hover:opacity-100 ${
                                compact ? "md:hidden" : ""
                              }`}
                            >
                              <Pin size={13} />
                            </span>
                          )}
                          <ChevronDown
                            size={14}
                            className={`shrink-0 opacity-60 transition-transform duration-150 ${
                              open ? "rotate-180" : ""
                            } ${compact ? "md:hidden" : ""}`}
                          />
                        </button>

                        {open && !compact && (
                          <ul className="mt-1 space-y-0.5 pb-1">
                            {row.children.map((child) => {
                              const on = activeId === child.id;
                              return (
                                <li key={`pin-${child.id}`}>
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
                                    <span
                                      className={`h-1.5 w-1.5 shrink-0 rounded-full bg-current ${
                                        on
                                          ? "text-white"
                                          : `${TONE_TEXT[row.tone] || "text-slate-500"} opacity-60`
                                      }`}
                                    />
                                    <span className="flex-1 truncate">{child.label}</span>
                                    {/* Only when the CHILD is the pin. Under a group
                                        pinned whole these rows are not pins at all,
                                        and a control here would add one rather than
                                        remove it. */}
                                    {!row.pinnedAsGroup && (
                                      <span
                                        role="button"
                                        tabIndex={-1}
                                        title="Unpin"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          togglePin(child.id);
                                        }}
                                        className="shrink-0 opacity-50 transition-opacity hover:opacity-100"
                                      >
                                        <Pin size={12} />
                                      </span>
                                    )}
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  }

                  const d = row.d;
                  const on = activeId === d.id;
                  return (
                    <li key={`pin-${d.id}`}>
                      <Link
                        to={d.path}
                        onClick={handleNavigate}
                        {...tipProps(d.label)}
                        title={compact ? undefined : d.label}
                        aria-label={d.label}
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

      {/* A group's children, beside its icon. Light surface on purpose: it sits over
          the page, not over the rail, and a dark panel there reads as part of the
          navigation that has come loose. Capped and scrollable so a long module
          cannot run off the bottom of the screen. */}
      {flyout && createPortal(
        <div
          data-rail-flyout=""
          style={{ position: "fixed", top: flyout.top, left: flyout.left, zIndex: 9998 }}
          className="max-h-[70vh] w-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-2 shadow-xl shadow-slate-900/10"
        >
          <p className="px-4 pb-2 pt-1 text-sm font-bold text-slate-800">{flyout.item.label}</p>
          <ul>
            {flyout.item.children.map((child) => (
              <li key={child.id}>
                <Link
                  to={child.path}
                  onClick={() => { setFlyout(null); handleNavigate(); }}
                  aria-current={activeId === child.id ? "page" : undefined}
                  // Dark hover, not a grey tint: the row runs the full width of the
                  // panel with no border to separate it from its neighbours, and a
                  // faint wash at that size is easy to miss. Applied to the active row
                  // too, so pointing at it never looks like less feedback than
                  // pointing at any other.
                  className={`block px-4 py-2.5 text-sm transition-colors hover:bg-slate-900 hover:text-white ${
                    activeId === child.id
                      ? "bg-slate-100 font-semibold text-slate-900"
                      : "font-medium text-slate-600"
                  }`}
                >
                  {child.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>,
        document.body
      )}

      {/* The icon rail's label, beside the icon it names. pointer-events-none so it
          can never sit between the cursor and the row it describes — moving onto the
          tip would otherwise read as leaving the row and blink it away. */}
      {tip && !flyout && createPortal(
        <div
          role="tooltip"
          style={{ position: "fixed", top: tip.top, left: tip.left, transform: "translateY(-50%)", zIndex: 9999 }}
          className="pointer-events-none whitespace-nowrap rounded-md bg-[#0f1319] px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg shadow-black/30 ring-1 ring-white/10"
        >
          {tip.label}
        </div>,
        document.body
      )}

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
