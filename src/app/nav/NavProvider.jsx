// src/app/nav/NavProvider.jsx
// ─────────────────────────────────────────────────────────────────────────────
// One nav brain for the whole authenticated shell. The sidebar, navbar, app
// launcher, mobile tab bar and command palette are all VIEWS over this — they own
// pixels, this owns state.
//
// It also holds the global hotkeys:
//   ⌘K / Ctrl+K   open the command palette (works from inside a form field too)
//   ⌘B / Ctrl+B   collapse / expand the desktop rail
//   Alt+C         open the currency converter
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { loadMyEntitlements } from "@shared/lib/access";
import {
  buildBreadcrumb,
  findActiveDestination,
  findActiveTrail,
  flattenDestinations,
  flattenGroups,
  resolveSections,
} from "@shared/nav/navModel";
import {
  useCollapsedSections,
  usePins,
  useRailCollapsed,
  useRecents,
  useResolvedIds,
} from "@shared/nav/usePinnedNav";

import {
  ACCOUNT_SECTION,
  DEFAULT_PINS,
  NAV_NAMESPACE,
  NAV_SECTIONS,
  buildQuickActions,
} from "./navConfig";

const NavContext = createContext(null);

export function useNav() {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error("useNav must be used inside <NavProvider>");
  return ctx;
}

export default function NavProvider({ children }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [launcherOpen, setLauncherOpen] = useState(false);
  // Where the launcher hangs from. Stored as a plain rect rather than the element
  // so nothing keeps a DOM node alive after the trigger unmounts.
  const [launcherAnchor, setLauncherAnchor] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Currency converter. `seed` is a parsed query handed over by the palette ("100 usd
  // to inr"), so opening the full tool from a typed sum keeps the sum.
  const [converterOpen, setConverterOpen] = useState(false);
  const [converterSeed, setConverterSeed] = useState(null);
  // Default to the icon rail: it expands on hover and closes the moment the pointer
  // leaves, so the page keeps the width unless someone deliberately pins it open.
  const [railCollapsed, setRailCollapsed] = useRailCollapsed(NAV_NAMESPACE, true);

  // Re-fetch the tenant's module entitlements on mount + whenever the tab regains
  // focus, then re-resolve. Login also caches them, but a plan change made while
  // someone is already signed in only reflects here — so a disabled module leaves
  // the menu on refocus without a re-login. (The backend hard-blocks it either way.)
  const [entitlementNonce, setEntitlementNonce] = useState(0);
  useEffect(() => {
    let alive = true;
    const refresh = () =>
      loadMyEntitlements().finally(() => {
        if (alive) setEntitlementNonce((n) => n + 1);
      });
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      alive = false;
      window.removeEventListener("focus", refresh);
    };
  }, []);

  // The permitted tree. Recomputed when entitlements land — the `can()` predicates
  // read localStorage, so the nonce is what makes that a real dependency.
  const sections = useMemo(
    () => resolveSections(NAV_SECTIONS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entitlementNonce],
  );
  const accountItems = useMemo(
    () => resolveSections([ACCOUNT_SECTION])[0]?.items ?? [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entitlementNonce],
  );

  // Search index = product destinations + the account pages, so "subscription"
  // and "change password" are typeable even though they are not in the rail.
  const destinations = useMemo(() => {
    const product = flattenDestinations(sections);
    const account = flattenDestinations([{ id: "account", label: "Account", items: accountItems }]);
    return [...product, ...account];
  }, [sections, accountItems]);

  /**
   * The flat rail. Only items marked `primary` in the registry — the eight screens
   * a travel desk lives in — so the sidebar stays a short, learnable list instead
   * of the 20-row scroll it was. Everything else is in "All apps" and searchable,
   * and anything can be pinned onto the rail.
   *
   * The top-up guard matters: a fleet-only tenant, an accountant or a sub-agent can
   * fail most of the primary gates, and a rail with one row would push their whole
   * product behind a button.
   */
  const railItems = useMemo(() => {
    const all = sections.flatMap((s) => s.items);
    // `primary` is a position, so the rail's order is the registry's stated order
    // and not a side effect of which section an item sits in.
    const primary = all.filter((i) => i.primary).sort((a, b) => a.primary - b.primary);
    if (primary.length >= 4) return primary;
    return [...primary, ...all.filter((i) => !i.primary)].slice(0, 8);
  }, [sections]);

  const activeTrail = useMemo(() => findActiveTrail(sections, pathname), [sections, pathname]);
  const activeDestination = useMemo(
    () => findActiveDestination(destinations, pathname),
    [destinations, pathname],
  );
  const breadcrumb = useMemo(() => buildBreadcrumb(sections, pathname), [sections, pathname]);

  const { pins, isPinned, toggle: togglePin } = usePins(NAV_NAMESPACE, DEFAULT_PINS);
  const { recents } = useRecents(NAV_NAMESPACE, activeDestination?.id);
  const sectionState = useCollapsedSections(NAV_NAMESPACE);

  /* What a pin is allowed to point at: every page, PLUS every module as a whole.
     Kept separate from `destinations` on purpose — that list is the search index
     and the active-route matcher, both of which are about single pages.

     A group whose id is ALREADY a page is dropped rather than appended. The
     registry allows a group to carry its own `path` (flattenDestinations: "a group
     that has its own path appears once as itself"), and both entries would then
     answer to the same id — so this is a real collision, not a hypothetical one.
     Order alone would not settle it: useResolvedIds resolves through
     `new Map(destinations.map(...))`, where the LAST entry for a key wins, so
     appending groups at the end makes the group shadow the page, which is the
     opposite of what you want. Nothing in navConfig hits this today; the point is
     that adding a path to a group tomorrow must not silently repoint a pin. */
  const pinnables = useMemo(() => {
    const pageIds = new Set(destinations.map((d) => d.id));
    return [...destinations, ...flattenGroups(sections).filter((g) => !pageIds.has(g.id))];
  }, [destinations, sections]);

  const pinnedDestinations = useResolvedIds(pins, pinnables);
  // Recents stay page-only: "where I have been" is never a heading.
  const recentDestinations = useResolvedIds(recents, destinations);

  const quickActions = useMemo(() => {
    const all = buildQuickActions(navigate);
    return all.filter((a) => {
      try {
        return a.can();
      } catch {
        return false;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, entitlementNonce]);

  /** Open "All apps" hanging off `el` (the 3-line button, or the rail's More). */
  const openLauncher = useCallback((el) => {
    setLauncherAnchor(el?.getBoundingClientRect?.() ?? null);
    setLauncherOpen(true);
  }, []);

  /**
   * Open the converter, optionally seeded with `{ amount, from, to }`.
   * Closes the palette: they are both centre-screen overlays, and stacking them
   * leaves the palette's input holding focus above a dialog nobody can type into.
   */
  const openConverter = useCallback((seed = null) => {
    setConverterSeed(seed);
    setPaletteOpen(false);
    setConverterOpen(true);
  }, []);

  const closeConverter = useCallback(() => {
    setConverterOpen(false);
    setConverterSeed(null);
  }, []);

  const go = useCallback(
    (path) => {
      setLauncherOpen(false);
      setMobileNavOpen(false);
      navigate(path);
    },
    [navigate],
  );

  // Any navigation closes the transient surfaces — otherwise the mobile drawer
  // stays over the page you just asked for.
  useEffect(() => {
    setLauncherOpen(false);
    setMobileNavOpen(false);
  }, [pathname]);

  // ── Global hotkeys ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setConverterOpen(false);
        setPaletteOpen((v) => !v);
        return;
      }
      // Alt+C — currency converter. NOT Ctrl/⌘+Shift+C (Chrome's inspect-element) and
      // not a bare letter, which would fire while typing a customer's name.
      // `e.code`, because on a Mac Option+C types "ç" and `e.key` would never be "c".
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === "KeyC") {
        e.preventDefault();
        setConverterSeed(null);
        setPaletteOpen(false);
        setConverterOpen((v) => !v);
        return;
      }
      if (mod && e.key.toLowerCase() === "b") {
        // Only meaningful on desktop; on mobile the rail is a drawer.
        if (window.innerWidth >= 768) {
          e.preventDefault();
          setRailCollapsed(!railCollapsed);
        }
        return;
      }
      if (e.key === "Escape") {
        setLauncherOpen(false);
        setMobileNavOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [railCollapsed, setRailCollapsed]);

  const value = useMemo(
    () => ({
      sections,
      accountItems,
      railItems,
      destinations,
      activeTrail,
      activeDestination,
      breadcrumb,
      quickActions,
      pins,
      isPinned,
      togglePin,
      pinnedDestinations,
      recentDestinations,
      sectionState,
      railCollapsed,
      setRailCollapsed,
      paletteOpen,
      setPaletteOpen,
      launcherOpen,
      setLauncherOpen,
      launcherAnchor,
      openLauncher,
      converterOpen,
      converterSeed,
      openConverter,
      closeConverter,
      mobileNavOpen,
      setMobileNavOpen,
      go,
    }),
    [
      sections,
      accountItems,
      railItems,
      destinations,
      activeTrail,
      activeDestination,
      breadcrumb,
      quickActions,
      pins,
      isPinned,
      togglePin,
      pinnedDestinations,
      recentDestinations,
      sectionState,
      railCollapsed,
      setRailCollapsed,
      paletteOpen,
      launcherOpen,
      launcherAnchor,
      openLauncher,
      converterOpen,
      converterSeed,
      openConverter,
      closeConverter,
      mobileNavOpen,
      go,
    ],
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}
