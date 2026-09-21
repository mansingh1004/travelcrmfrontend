// src/features/fleet/components/FleetMoneyTabs.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The three fleet-money screens, as one tab strip.
//
// Expenses, Driver cash and Month close were three separate rows in the Vehicle
// Diary menu. They are one job — fleet finance — held by one key
// (FLEET_MONEY_READ, see app/nav/navConfig.js), and a dispatcher who never holds
// it sees none of them. The menu carries a single "Money" row now, and this is
// how you get between the three once you are in.
//
// LINKS, not an embedded tab panel. Each of the three is a heavy page with its own
// fetch, its own filters and its own header actions — a financial-year picker on
// Month close, Refresh on the other two. Mounting two of them inside the third
// would have meant either nesting PageShell (a full-height gradient inside a
// full-height gradient) or dropping those actions on the floor. Three routes with
// a shared strip reads as one screen and costs nothing.
// ─────────────────────────────────────────────────────────────────────────────

import { NavLink } from "react-router-dom";

import { cn } from "@shared/lib/cn";

const TABS = [
  { to: "/fleet/expenses", label: "Expenses" },
  { to: "/fleet/settlements", label: "Driver cash" },
  { to: "/fleet/periods", label: "Month close" },
];

export default function FleetMoneyTabs({ className }) {
  return (
    <div
      role="tablist"
      aria-label="Fleet money"
      className={cn(
        "mb-6 flex flex-wrap items-center gap-1 rounded-2xl border border-slate-200 bg-white/80 p-1 backdrop-blur-md",
        className,
      )}
    >
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end
          role="tab"
          className={({ isActive }) =>
            cn(
              "rounded-xl px-4 py-2 text-sm font-bold transition-all",
              isActive
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800",
            )
          }
        >
          {t.label}
        </NavLink>
      ))}
    </div>
  );
}
