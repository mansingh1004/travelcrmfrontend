import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { KeyRound, Loader2, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";

import CommandPalette from "@shared/nav/CommandPalette";
import LauncherSheet from "@shared/nav/AppLauncher";
import { findActiveDestination, flattenDestinations, resolveSections } from "@shared/nav/navModel";
import {
  usePins,
  useRailCollapsed,
  useRecents,
  useResolvedIds,
} from "@shared/nav/usePinnedNav";

import ConsoleThemeProvider from "./theme/ConsoleThemeProvider";
import ThemeToggle from "./theme/ThemeToggle";
import ConsoleSidebar from "./ConsoleSidebar";
import {
  CONSOLE_DEFAULT_PINS,
  CONSOLE_NAV_NAMESPACE,
  CONSOLE_NAV_SECTIONS,
} from "./nav/consoleNav";
import ConsoleNotificationBell from "./components/ConsoleNotificationBell";
import ChangePasswordModal from "./components/ChangePasswordModal";
import ConsoleAPI, { unwrap } from "./api/consoleHttp";
import {
  isConsoleAuthed,
  clearConsoleSession,
  getConsoleIdentity,
  setConsoleSession,
} from "./lib/consoleAuth";

const CONSOLE_IDLE_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * Guarded console shell. Self-guards on the console token (→ /superadmin/login), confirms the
 * session against GET /api/super-admin/me, and renders the collapsible sidebar + header.
 * A distinct violet/slate, light+dark surface — deliberately unlike the tenant app.
 */
export default function ConsoleLayout() {
  const nav = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useRailCollapsed(CONSOLE_NAV_NAMESPACE, false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [launcherOpen, setLauncherOpen] = useState(false);
  // Rect of whatever opened the launcher, so it hangs off that button rather than
  // floating in the middle of the screen.
  const [launcherAnchor, setLauncherAnchor] = useState(null);
  const [me, setMe] = useState(getConsoleIdentity());
  const [profileLoaded, setProfileLoaded] = useState(!isConsoleAuthed());
  const [changingPassword, setChangingPassword] = useState(false);

  // The console's own search index — never the tenant app's. Static: unlike the
  // tenant registry there are no permission gates to re-evaluate.
  const consoleSections = useMemo(
    () => (me.role ? resolveSections(CONSOLE_NAV_SECTIONS) : []),
    [me.role],
  );
  const consoleDestinations = useMemo(
    () => flattenDestinations(consoleSections),
    [consoleSections],
  );
  const activeConsoleId = findActiveDestination(consoleDestinations, location.pathname)?.id;

  // Same store the rail reads; the hook's event bus keeps the two mounts in sync,
  // so starring a tile here lights the pin in the rail immediately.
  const { isPinned, toggle: togglePin } = usePins(CONSOLE_NAV_NAMESPACE, CONSOLE_DEFAULT_PINS);
  const { recents } = useRecents(CONSOLE_NAV_NAMESPACE, activeConsoleId);
  const recentDestinations = useResolvedIds(recents, consoleDestinations);

  const logout = useCallback(() => {
    clearConsoleSession();
    nav("/superadmin/login", { replace: true });
  }, [nav]);

  useEffect(() => {
    if (!isConsoleAuthed()) return;
    ConsoleAPI.get("/super-admin/me")
      .then((res) => {
        const body = unwrap(res);
        if (body) {
          setMe((prev) => ({
            ...prev,
            name: body.name,
            email: body.email,
            role: body.role || "SUPER_ADMIN",
            mfaEnabled: body.mfaEnabled,
            mustChangePassword: body.mustChangePassword,
            setupComplete: body.setupComplete,
          }));
          setConsoleSession({ name: body.name, email: body.email, role: body.role || "SUPER_ADMIN" });
        }
      })
      .catch(() => {
        /* 401 is handled by the interceptor (redirect); other errors keep cached identity */
      })
      .finally(() => setProfileLoaded(true));
  }, []);

  useEffect(() => {
    if (!profileLoaded || !isConsoleAuthed()) return;
    const onSetupRoute = location.pathname === "/console/setup";
    if (me?.setupComplete === false && !onSetupRoute) {
      nav("/console/setup", { replace: true });
    } else if (me?.setupComplete === true && onSetupRoute) {
      nav("/console", { replace: true });
    }
  }, [location.pathname, me?.setupComplete, nav, profileLoaded]);

  // ⌘K / Ctrl+K opens the console palette; Escape closes the mobile drawer.
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setLauncherOpen(false);
        setPaletteOpen((v) => !v);
        return;
      }
      if (mod && e.key.toLowerCase() === "b" && window.innerWidth >= 640) {
        e.preventDefault();
        setCollapsed(!collapsed);
        return;
      }
      if (e.key === "Escape") {
        setLauncherOpen(false);
        setMobileNavOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [collapsed, setCollapsed]);

  // Any navigation closes the drawer — otherwise it covers the page just requested.
  useEffect(() => {
    const closeTimer = window.setTimeout(() => {
      setLauncherOpen(false);
      setMobileNavOpen(false);
    }, 0);
    return () => window.clearTimeout(closeTimer);
  }, [location.pathname]);

  useEffect(() => {
    if (!isConsoleAuthed()) return undefined;

    let timer;
    const resetTimer = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(logout, CONSOLE_IDLE_TIMEOUT_MS);
    };
    const events = ["click", "keydown", "mousemove", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      window.clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [logout]);

  if (!isConsoleAuthed()) return <Navigate to="/superadmin/login" replace />;

  if (!profileLoaded) {
    return (
      <ConsoleThemeProvider>
        <div className="flex min-h-screen items-center justify-center bg-page text-muted">
          <Loader2 size={22} className="animate-spin" />
        </div>
      </ConsoleThemeProvider>
    );
  }

  if (me.role !== "SUPER_ADMIN" && location.pathname.startsWith("/console/superadmins")) {
    return <Navigate to="/console" replace />;
  }

  if (me?.setupComplete === false) {
    const onSetupRoute = location.pathname === "/console/setup";
    return (
      <ConsoleThemeProvider>
        <div className="min-h-screen bg-page">
          <main className="mx-auto w-full max-w-screen-md p-4 sm:p-6">
            {onSetupRoute ? <Outlet /> : (
              <div className="flex min-h-[50vh] items-center justify-center text-muted">
                <Loader2 size={22} className="animate-spin" />
              </div>
            )}
          </main>
        </div>
      </ConsoleThemeProvider>
    );
  }

  return (
    <ConsoleThemeProvider>
      <div className="flex min-h-screen">
        <ConsoleSidebar
          sections={consoleSections}
          collapsed={collapsed}
          mobileOpen={mobileNavOpen}
          onCloseMobile={() => setMobileNavOpen(false)}
          onOpenLauncher={(el) => {
            setPaletteOpen(false);
            setLauncherAnchor(el?.getBoundingClientRect?.() ?? null);
            setLauncherOpen(true);
          }}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur">
            <div className="flex min-w-0 items-center gap-2">
              {/* Phones: open the drawer. The rail has no collapsed form there. */}
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                title="Open navigation"
                aria-label="Open navigation"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:hidden"
              >
                <Menu size={18} />
              </button>

              <button
                type="button"
                onClick={() => setCollapsed((c) => !c)}
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="hidden h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:inline-flex"
              >
                {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
              </button>

              {/* Global console search. Duplicated in the rail on purpose — the rail
                  is not on screen at all below `sm`, and this is the surface an
                  operator reaches for first. */}
              <button
                type="button"
                onClick={() => {
                  setLauncherOpen(false);
                  setPaletteOpen(true);
                }}
                className="ml-1 flex min-w-0 items-center gap-2 rounded-lg border border-border bg-surface-hover/40 px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-border-strong hover:text-body sm:px-3"
                aria-label="Search the console"
              >
                <Search size={14} className="shrink-0" />
                <span className="hidden truncate md:block">Go to a console page…</span>
                <kbd className="hidden rounded border border-border px-1.5 py-0.5 font-sans text-[10px] font-semibold lg:block">
                  Ctrl K
                </kbd>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <ConsoleNotificationBell />
              <ThemeToggle />
              <div className="hidden flex-col items-end leading-tight sm:flex">
                <span className="text-sm font-semibold text-heading">{me.name}</span>
                <span className="font-mono text-xs text-muted">{me.email}</span>
              </div>
              <button
                type="button"
                onClick={() => setChangingPassword(true)}
                title="Change password"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <KeyRound size={18} />
              </button>
              <button
                type="button"
                onClick={logout}
                title="Sign out"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <LogOut size={18} />
              </button>
            </div>
          </header>

          <main className="mx-auto w-full max-w-screen-2xl flex-1 p-4 sm:p-6">
            <Outlet />
          </main>
        </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        destinations={consoleDestinations}
        recents={recentDestinations}
        onNavigate={(path) => nav(path)}
        theme="console"
        placeholder="Go to a console page…"
      />

      <LauncherSheet
        open={launcherOpen}
        onClose={() => setLauncherOpen(false)}
        sections={consoleSections}
        isPinned={isPinned}
        togglePin={togglePin}
        activeId={activeConsoleId}
        anchor={launcherAnchor}
        theme="console"
        title="All console areas"
        allowGroupPins
      />

      {changingPassword && (
        <ChangePasswordModal
          onClose={() => setChangingPassword(false)}
          onChanged={logout}
        />
      )}
    </ConsoleThemeProvider>
  );
}
