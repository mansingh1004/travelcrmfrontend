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
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, LayoutGrid, Pin, X, ShieldCheck } from "lucide-react";

import {
  findActiveDestination,
  findActiveTrail,
  flattenDestinations,
  flattenGroups,
} from "@shared/nav/navModel";
import { usePins, useResolvedIds } from "@shared/nav/usePinnedNav";

import {
  CONSOLE_DEFAULT_PINS,
  CONSOLE_NAV_NAMESPACE,
} from "./nav/consoleNav";
import { upgradeRequestService } from "./api/upgradeRequestService";
import { subAgentLicenseService } from "./api/subAgentLicenseService";
import { marketplaceBookingService } from "./api/marketplaceBookingService";
import { hotelNominationService } from "./api/marketplaceAdminService";
import { transportAdminService } from "./api/transportAdminService";

const ROW =
  "group relative flex w-full items-center rounded-xl text-sm transition-colors duration-150";
const ROW_IDLE = "text-body hover:bg-surface-hover hover:text-heading";
const ROW_ACTIVE =
  "bg-accent-soft font-semibold text-accent-soft-text ring-1 ring-inset ring-accent/15";

// Collapsing is driven from the console header (ConsoleLayout), which is why this
// takes `collapsed` but no toggle of its own.
export default function ConsoleSidebar({ sections, collapsed, mobileOpen, onCloseMobile, onOpenLauncher }) {
  const { pathname } = useLocation();
  const [pendingUpgrades, setPendingUpgrades] = useState(0);
  const [pendingHotelRequests, setPendingHotelRequests] = useState(0);
  const [openNominations, setOpenNominations] = useState(0);
  const [pendingTransportRequests, setPendingTransportRequests] = useState(0);
  const [openPinnedGroupId, setOpenPinnedGroupId] = useState(null);
  const [flyout, setFlyout] = useState(null);

  const { destinations, pinnables, groupById } = useMemo(() => {
    const resolvedDestinations = flattenDestinations(sections);
    const groups = flattenGroups(sections);
    const destinationIds = new Set(resolvedDestinations.map((destination) => destination.id));
    return {
      destinations: resolvedDestinations,
      pinnables: [
        ...resolvedDestinations,
        ...groups.filter((group) => !destinationIds.has(group.id)),
      ],
      groupById: new Map(groups.map((group) => [group.id, group])),
    };
  }, [sections]);

  const { pins, toggle: togglePin } = usePins(CONSOLE_NAV_NAMESPACE, CONSOLE_DEFAULT_PINS);
  const pinned = useResolvedIds(pins, pinnables);

  const activeId = findActiveDestination(destinations, pathname)?.id ?? null;
  const activeTrail = findActiveTrail(sections, pathname);
  const compact = collapsed && !mobileOpen;

  useEffect(() => {
    if (!flyout) return undefined;
    const close = () => setFlyout(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [flyout]);

  useEffect(() => {
    if (!flyout) return undefined;
    const onDown = (event) => {
      if (!event.target.closest?.("[data-console-rail-flyout]")) setFlyout(null);
    };
    const onKey = (event) => {
      if (event.key === "Escape") setFlyout(null);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [flyout]);

  const handleNavigate = () => {
    setFlyout(null);
    onCloseMobile?.();
  };

  // The flat rail: the queues and registries an operator opens daily. Everything
  // else — flags, config, audit, ops, marketplace supply — is behind "More".
  // Five daily destinations are permanent. Pins are an additional grouped layer
  // and never remove or reorder these fixed operator shortcuts.
  const railItems = useMemo(
    () => destinations
      .filter((destination) => destination.primary)
      .sort((left, right) => Number(left.primary) - Number(right.primary)),
    [destinations],
  );

  const pinnedRows = useMemo(() => {
    const visible = pinned.filter((destination) => !railItems.some((item) => item.id === destination.id));
    const pinnedGroupIds = new Set(
      visible.filter((destination) => destination.kind === "group").map((destination) => destination.id),
    );
    const rows = [];
    const groupAt = new Map();
    for (const destination of visible) {
      if (destination.kind === "group") {
        rows.push({
          kind: "group",
          pinnedAsGroup: true,
          id: destination.id,
          label: destination.label,
          Icon: destination.Icon,
          children: destination.children || [],
        });
        continue;
      }
      if (destination.parentId && pinnedGroupIds.has(destination.parentId)) continue;
      if (!destination.parentId) {
        rows.push({ kind: "leaf", destination });
        continue;
      }
      const existingIndex = groupAt.get(destination.parentId);
      if (existingIndex != null) {
        rows[existingIndex].pinnedChildIds.add(destination.id);
        continue;
      }
      const parent = groupById.get(destination.parentId);
      groupAt.set(destination.parentId, rows.length);
      rows.push({
        kind: "group",
        pinnedAsGroup: false,
        id: destination.parentId,
        label: destination.parentLabel,
        Icon: parent?.Icon || destination.Icon,
        children: parent?.children || [destination],
        pinnedChildIds: new Set([destination.id]),
      });
    }
    return rows;
  }, [groupById, pinned, railItems]);

  useEffect(() => {
    if (!activeTrail.itemId) return;
    if (!pinnedRows.some((row) => row.kind === "group" && row.id === activeTrail.itemId)) return;
    const openTimer = window.setTimeout(() => setOpenPinnedGroupId(activeTrail.itemId), 0);
    return () => window.clearTimeout(openTimer);
  }, [activeTrail.itemId, pinnedRows]);

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
        // Transport has its own queue and therefore its own pill: a car nobody has answered must
        // not be hidden inside a hotel count.
        transportAdminService.pendingCount().catch(() => 0),
      ]).then(([u, s, h, n, t]) => {
        if (!alive) return;
        setPendingUpgrades(Number(u?.count ?? 0) + Number(s?.count ?? 0));
        setPendingHotelRequests(Number(h ?? 0));
        setOpenNominations(Number(n ?? 0));
        setPendingTransportRequests(Number(t?.count ?? t ?? 0));
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
    if (item.badge === "transportRequests") return pendingTransportRequests;
    return 0;
  };

  const Row = ({ item, showPin = false }) => {
    const active = activeId === item.id;
    const count = badgeFor(item);
    return (
      <Link
        to={item.path}
        onClick={handleNavigate}
        title={compact ? undefined : item.label}
        aria-label={item.label}
        aria-current={active ? "page" : undefined}
        className={`${ROW} ${active ? ROW_ACTIVE : ROW_IDLE} ${
          compact ? "justify-center px-2 py-2.5 sm:px-0" : "gap-3 px-3 py-2.5"
        }`}
      >
        <span className="relative shrink-0">
          <item.Icon size={18} />
          {compact && count > 0 && (
            <span className="absolute -right-1 -top-1 hidden h-2 w-2 rounded-full bg-hue-amber ring-2 ring-sidebar sm:block" />
          )}
        </span>
        <span className={`min-w-0 flex-1 truncate ${compact ? "sm:hidden" : ""}`}>
          {item.label}
        </span>
        {count > 0 && (
          <span
            className={`shrink-0 rounded-full bg-hue-amber-soft px-1.5 py-0.5 text-[10px] font-bold text-hue-amber ${
              compact ? "sm:hidden" : ""
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
              compact ? "sm:hidden" : ""
            }`}
          >
            <Pin size={13} />
          </span>
        )}
      </Link>
    );
  };

  const PinnedGroup = ({ row }) => {
    const open = openPinnedGroupId === row.id;
    const active = row.children.some((child) => child.id === activeId);
    const count = row.children.reduce((total, child) => total + badgeFor(child), 0);

    const toggleGroup = (event) => {
      if (compact) {
        if (!row.children?.length) return;
        const rect = event.currentTarget.getBoundingClientRect();
        setFlyout((current) =>
          current?.item.id === row.id
            ? null
            : { item: row, top: rect.top, left: rect.right + 10 },
        );
        return;
      }
      setFlyout(null);
      setOpenPinnedGroupId((current) => (current === row.id ? null : row.id));
    };

    return (
      <div>
        <button
          type="button"
          onClick={toggleGroup}
          title={compact ? undefined : row.label}
          aria-label={row.label}
          aria-expanded={open}
          className={`${ROW} ${active ? ROW_ACTIVE : ROW_IDLE} ${
            compact ? "justify-center px-2 py-2.5 sm:px-0" : "gap-3 px-3 py-2.5"
          }`}
        >
          {row.Icon && <row.Icon size={18} className="shrink-0" />}
          <span className={`min-w-0 flex-1 truncate text-left ${compact ? "sm:hidden" : ""}`}>
            {row.label}
          </span>
          {count > 0 && (
            <span
              className={`shrink-0 rounded-full bg-hue-amber-soft px-1.5 py-0.5 text-[10px] font-bold text-hue-amber ${
                compact ? "sm:hidden" : ""
              }`}
            >
              {count}
            </span>
          )}
          {row.pinnedAsGroup && (
            <span
              role="button"
              tabIndex={-1}
              title="Unpin group"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                togglePin(row.id);
              }}
              className={`shrink-0 text-muted opacity-60 transition-opacity hover:opacity-100 ${
                compact ? "sm:hidden" : ""
              }`}
            >
              <Pin size={13} />
            </span>
          )}
          <ChevronDown
            size={14}
            className={`shrink-0 text-muted transition-transform duration-150 ${
              open ? "rotate-180" : ""
            } ${compact ? "sm:hidden" : ""}`}
          />
        </button>

        {open && !compact && (
          <div className="mt-1 flex flex-col gap-0.5 pb-1">
            {row.children.map((child) => {
              const childActive = child.id === activeId;
              const childCount = badgeFor(child);
              return (
                <Link
                  key={`pin-child-${child.id}`}
                  to={child.path}
                  onClick={handleNavigate}
                  aria-current={childActive ? "page" : undefined}
                  className={`flex items-center gap-2.5 rounded-lg py-2 pl-11 pr-3 text-[13px] transition-colors ${
                    childActive
                      ? "bg-accent-soft font-semibold text-accent-soft-text"
                      : "text-body hover:bg-surface-hover hover:text-heading"
                  }`}
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent/70" />
                  <span className="min-w-0 flex-1 truncate">{child.label}</span>
                  {childCount > 0 && (
                    <span className="shrink-0 rounded-full bg-hue-amber-soft px-1.5 py-0.5 text-[10px] font-bold text-hue-amber">
                      {childCount}
                    </span>
                  )}
                  {!row.pinnedAsGroup && row.pinnedChildIds?.has(child.id) && (
                    <span
                      role="button"
                      tabIndex={-1}
                      title="Unpin"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        togglePin(child.id);
                      }}
                      className="shrink-0 text-muted opacity-60 transition-opacity hover:opacity-100"
                    >
                      <Pin size={12} />
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
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
        } ${compact ? "sm:w-16" : "sm:w-60"}`}
        aria-label="Console navigation"
      >
        {/* Brand */}
        <div
          className={`flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-4 ${
            compact ? "sm:justify-center sm:px-0" : ""
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
              compact ? "sm:hidden" : ""
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

          {pinnedRows.length > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <p
                className={`px-3 pb-1.5 font-console text-[10px] font-bold uppercase tracking-[0.16em] text-muted ${
                  compact ? "sm:hidden" : ""
                }`}
              >
                Pinned
              </p>
              <div className="flex flex-col gap-1">
                {pinnedRows.map((row) =>
                  row.kind === "group" ? (
                    <PinnedGroup key={`pin-group-${row.id}`} row={row} />
                  ) : (
                    <Row
                      key={`pin-${row.destination.id}`}
                      item={row.destination}
                      showPin
                    />
                  ),
                )}
              </div>
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-border p-2.5">
          <button
            type="button"
            onClick={(e) => {
              onOpenLauncher(e.currentTarget);
            }}
            title="All console areas"
            className={`flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-surface-hover/40 py-2.5 text-[13px] font-semibold text-body transition-colors hover:bg-surface-hover hover:text-heading ${
              compact ? "px-0" : "px-3"
            }`}
          >
            <LayoutGrid size={17} className="shrink-0" />
            <span className={compact ? "sm:hidden" : ""}>More</span>
          </button>
        </div>
      </aside>

      {flyout && createPortal(
        <div
          data-console-rail-flyout=""
          style={{
            position: "fixed",
            top: flyout.top,
            left: flyout.left,
            zIndex: 9998,
            backgroundColor: "var(--sa-surface, #ffffff)",
            color: "var(--sa-text-body, #514c70)",
            boxShadow: "var(--sa-card-shadow, 0 18px 45px -18px rgb(15 23 42 / 0.35))",
          }}
          className="max-h-[70vh] w-60 overflow-y-auto rounded-xl border border-border bg-surface py-2 opacity-100 ring-1 ring-black/5 dark:ring-white/10"
        >
          <p className="px-4 pb-2 pt-1 text-sm font-bold text-heading">{flyout.item.label}</p>
          <div>
            {flyout.item.children.map((child) => {
              const active = activeId === child.id;
              const count = badgeFor(child);
              return (
                <Link
                  key={`flyout-${child.id}`}
                  to={child.path}
                  onClick={handleNavigate}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-surface-hover ${
                    active ? "bg-accent-soft font-semibold text-accent-soft-text" : "font-medium text-body"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{child.label}</span>
                  {count > 0 && (
                    <span className="shrink-0 rounded-full bg-hue-amber-soft px-1.5 py-0.5 text-[10px] font-bold text-hue-amber">
                      {count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>,
        document.querySelector(".sa-console") || document.body,
      )}

    </>
  );
}
