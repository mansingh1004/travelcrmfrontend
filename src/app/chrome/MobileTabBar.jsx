// src/app/chrome/MobileTabBar.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Thumb-reach navigation for phones. A drawer you have to reach the top-left
// corner to open is not navigation on a 6.5" screen — it is a menu you avoid.
//
// The four tabs are the user's own PINS (same list the sidebar shows first), so
// the bar personalises itself instead of guessing. Everything else is one tap
// away behind "More", which opens the full drawer.
// ─────────────────────────────────────────────────────────────────────────────

import { Link } from "react-router-dom";
import { Menu } from "lucide-react";

import { useNav } from "../nav/NavProvider";

export default function MobileTabBar() {
  const { pinnedDestinations, destinations, activeDestination, setMobileNavOpen, mobileNavOpen } =
    useNav();

  // Pins first; if this user has unpinned everything, fall back to the first few
  // destinations they can reach so the bar is never a lone "More" button.
  const tabs = (pinnedDestinations.length ? pinnedDestinations : destinations).slice(0, 4);
  if (!tabs.length) return null;

  return (
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {tabs.map((tab) => {
        const active = activeDestination?.id === tab.id;
        return (
          <Link
            key={tab.id}
            to={tab.path}
            aria-current={active ? "page" : undefined}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors ${
              active ? "text-blue-600" : "text-slate-500"
            }`}
          >
            {tab.Icon && <tab.Icon size={19} strokeWidth={active ? 2.4 : 2} />}
            <span className="w-full truncate px-1 text-center text-[10px] font-semibold leading-none">
              {tab.label}
            </span>
          </Link>
        );
      })}

      <button
        type="button"
        onClick={() => setMobileNavOpen(!mobileNavOpen)}
        aria-expanded={mobileNavOpen}
        aria-label="More navigation"
        className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors ${
          mobileNavOpen ? "text-blue-600" : "text-slate-500"
        }`}
      >
        <Menu size={19} />
        <span className="text-[10px] font-semibold leading-none">More</span>
      </button>
    </nav>
  );
}
