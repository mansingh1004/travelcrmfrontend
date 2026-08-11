// src/console/ConsoleSidebar.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Platform console rail. Same shape as the tenant app's — a short flat list of
// the screens an operator actually works in, pinned extras, and "More" for the
// full grid — so moving between the two realms costs no relearning. The violet
// token layer keeps them visually unmistakable.
//
// Two things this fixes outright:
// • It was 17 undifferentiated rows in one column.
// • It was `hidden sm:block`, so the console had NO navigation at all on a phone
//   — exactly the device an operator holds when a tenant calls about a blocked
//   upgrade. There is a real drawer now.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutGrid, Pin, X, ShieldCheck } from "lucide-react";

import { findActiveDestination, flattenDestinations, resolveSections } from "@shared/nav/navModel";
import { usePins, useResolvedIds } from "@shared/nav/usePinnedNav";

import {
  CONSOLE_DEFAULT_PINS,
  CONSOLE_NAV_NAMESPACE,
  CONSOLE_NAV_SECTIONS,
} from "./nav/consoleNav";
import { upgradeRequestService } from "./api/upgradeRequestService";
import { subAgentLicenseService } from "./api/subAgentLicenseService";
import { marketplaceBookingService } from "./api/marketplaceBookingService";
import { hotelNominationService } from "./api/marketplaceAdminService";

// Static: unlike the tenant registry there are no permission gates to re-evaluate,
// so this resolves once at module load rather than on every render.
const SECTIONS = resolveSections(CONSOLE_NAV_SECTIONS);
const DESTINATIONS = flattenDestinations(SECTIONS);

const ROW =
  "group relative flex w-full items-center rounded-xl text-sm transition-colors duration-150";
const ROW_IDLE = "text-body hover:bg-surface-hover hover:text-heading";
const ROW_ACTIVE =
  "bg-accent-soft font-semibold text-accent-soft-text ring-1 ring-inset ring-accent/15";

// Collapsing is driven from the console header (ConsoleLayout), which is why this
// takes `collapsed` but no toggle of its own.
export default function ConsoleSidebar({ collapsed, mobileOpen, onCloseMobile, onOpenLauncher }) {
  const { pathname } = useLocation();
  const [pendingUpgrades, setPendingUpgrades] = useState(0);
  const [pendingHotelRequests, setPendingHotelRequests] = useState(0);
  const [openNominations, setOpenNominations] = useState(0);

  const { pins, toggle: togglePin } = usePins(CONSOLE_NAV_NAMESPACE, CONSOLE_DEFAULT_PINS);
  const pinned = useResolvedIds(pins, DESTINATIONS);

  const activeId = findActiveDestination(DESTINATIONS, pathname)?.id ?? null;

  // The flat rail: the queues and registries an operator opens daily. Everything
  // else — flags, config, audit, ops, marketplace supply — is behind "More".
  const railItems = useMemo(
    () => SECTIONS.flatMap((s) => s.items).filter((i) => i.primary),
    [],
  );

  // Live pending badges: plan upgrades + Travel Partner seat licenses share one
  // pill, hotel requests get their own. Best-effort on mount and whenever the tab
  // regains focus, so an operator coming back sees new requests without a reload.
  useEffect(() => {
    let alive = true;
    const refresh = () =>
      Promise.all([
        upgradeRequestService.pendingCount().catch(() => ({ count: 0 })),
        subAgentLicenseService.pendingCount().catch(() => ({ count: 0 })),
        // Note: this one resolves to a NUMBER, not a {count} object like its siblings.
        marketplaceBookingService.pendingCount().catch(() => 0),
        // Also a bare NUMBER, like its neighbour above.
        hotelNominationService.openCount().catch(() => 0),
      ]).then(([u, s, h, n]) => {
        if (!alive) return;
        setPendingUpgrades(Number(u?.count ?? 0) + Number(s?.count ?? 0));
        setPendingHotelRequests(Number(h ?? 0));
        setOpenNominations(Number(n ?? 0));
      });
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      alive = false;
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const badgeFor = (item) => {
    if (item.badge === "upgrades") return pendingUpgrades;
    if (item.badge === "hotelRequests") return pendingHotelRequests;
    if (item.badge === "hotelNominations") return openNominations;
    return 0;
  };

  const Row = ({ item, showPin = false }) => {
    const active = activeId === item.id;
    const count = badgeFor(item);
    return (
      <Link
        to={item.path}
        onClick={onCloseMobile}
        title={item.label}
        aria-current={active ? "page" : undefined}
        className={`${ROW} ${active ? ROW_ACTIVE : ROW_IDLE} ${
          collapsed ? "justify-center px-2 py-2.5 sm:px-0" : "gap-3 px-3 py-2.5"
        }`}
      >
        <span className="relative shrink-0">
          <item.Icon size={18} />
          {collapsed && count > 0 && (
            <span className="absolute -right-1 -top-1 hidden h-2 w-2 rounded-full bg-hue-amber ring-2 ring-sidebar sm:block" />
          )}
        </span>
        <span className={`min-w-0 flex-1 truncate ${collapsed ? "sm:hidden" : ""}`}>
          {item.label}
        </span>
        {count > 0 && (
          <span
            className={`shrink-0 rounded-full bg-hue-amber-soft px-1.5 py-0.5 text-[10px] font-bold text-hue-amber ${
              collapsed ? "sm:hidden" : ""
            }`}
          >
            {count}
          </span>
        )}
        {showPin && (
          <span
            role="button"
            tabIndex={-1}
            title="Unpin"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              togglePin(item.id);
            }}
            className={`shrink-0 text-muted opacity-60 transition-opacity hover:opacity-100 ${
              collapsed ? "sm:hidden" : ""
            }`}
          >
            <Pin size={13} />
          </span>
        )}
      </Link>
    );
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 sm:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/*
        From `sm:` up this is `sticky` + `h-screen`, NOT `relative`.

        As a `relative` flex item it inherited the height of the flex row, which is the height of the
        PAGE. On a long page the rail therefore grew to match, its inner `overflow-y-auto` never had
        anything to scroll, and the pinned bottom section (the launcher / "more" button) sat at the
        foot of a 4000px column — present in the DOM, unreachable on screen.

        Pinning it to the viewport makes the nav the thing that scrolls, so the bottom section is
        always visible however long the page gets. `sm:inset-y-auto` is required: the mobile drawer's
        `inset-y-0` sets `bottom:0`, and a sticky element with both `top` and `bottom` sticks to the
        bottom edge instead of the top.
      */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-border bg-sidebar transition-[width,transform] duration-200 sm:sticky sm:inset-y-auto sm:top-0 sm:h-screen sm:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "sm:w-16" : "sm:w-60"}`}
        aria-label="Console navigation"
      >
        {/* Brand */}
        <div
          className={`flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-4 ${
            collapsed ? "sm:justify-center sm:px-0" : ""
          }`}
        >
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white shadow-[var(--sa-card-shadow)]"
            style={{ backgroundImage: "var(--sa-gradient)" }}
          >
            <ShieldCheck size={18} />
          </div>
          <span
            className={`min-w-0 flex-1 truncate bg-clip-text text-sm font-bold text-transparent ${
              collapsed ? "sm:hidden" : ""
            }`}
            style={{ backgroundImage: "var(--sa-gradient)" }}
          >
            Platform Console
          </span>
          {/* No collapse button here: the console header already carries one, at the
              top and visible in BOTH states — unlike the tenant rail, this one does
              not open on hover, so a toggle that hides when collapsed would strand it. */}
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation"
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-hover hover:text-body sm:hidden"
          >
            <X size={18} />
          </button>
        </div>

        {/* Rail */}
        <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2.5">
          <div className="flex flex-col gap-1">
            {railItems.map((item) => (
              <Row key={item.id} item={item} />
            ))}
          </div>

          {pinned.length > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <p
                className={`px-3 pb-1.5 font-console text-[10px] font-bold uppercase tracking-[0.16em] text-muted ${
                  collapsed ? "sm:hidden" : ""
                }`}
              >
                Pinned
              </p>
              <div className="flex flex-col gap-1">
                {pinned
                  // A pin that is already on the rail would just render the row twice.
                  .filter((p) => !railItems.some((r) => r.id === p.id))
                  .map((item) => (
                    <Row key={`pin-${item.id}`} item={item} showPin />
                  ))}
              </div>
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-border p-2.5">
          <button
            type="button"
            onClick={(e) => onOpenLauncher(e.currentTarget)}
            title="All console areas"
            className={`flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-surface-hover/40 py-2.5 text-[13px] font-semibold text-body transition-colors hover:bg-surface-hover hover:text-heading ${
              collapsed ? "px-0" : "px-3"
            }`}
          >
            <LayoutGrid size={17} className="shrink-0" />
            <span className={collapsed ? "sm:hidden" : ""}>More</span>
          </button>
        </div>
      </aside>
    </>
  );
}
