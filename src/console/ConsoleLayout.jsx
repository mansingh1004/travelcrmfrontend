import { useCallback, useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { KeyRound, Loader2, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import ConsoleThemeProvider from "./theme/ConsoleThemeProvider";
import ThemeToggle from "./theme/ThemeToggle";
import ConsoleSidebar from "./ConsoleSidebar";
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
  const [collapsed, setCollapsed] = useState(false);
  const [me, setMe] = useState(getConsoleIdentity());
  const [profileLoaded, setProfileLoaded] = useState(!isConsoleAuthed());
  const [changingPassword, setChangingPassword] = useState(false);

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
            mfaEnabled: body.mfaEnabled,
            mustChangePassword: body.mustChangePassword,
            setupComplete: body.setupComplete,
          }));
          setConsoleSession({ name: body.name, email: body.email });
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
        <ConsoleSidebar collapsed={collapsed} />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>

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

      {changingPassword && (
        <ChangePasswordModal
          onClose={() => setChangingPassword(false)}
          onChanged={logout}
        />
      )}
    </ConsoleThemeProvider>
  );
}
