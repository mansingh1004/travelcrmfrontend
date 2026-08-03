import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  BedDouble,
  ClipboardCheck,
  Building2,
  CreditCard,
  ArrowUpCircle,
  Users,
  ToggleLeft,
  Settings2,
  ScrollText,
  Megaphone,
  Wrench,
  Gauge,
  UserCog,
  Palette as PaletteIcon,
  ShieldCheck,
} from "lucide-react";
import { upgradeRequestService } from "./api/upgradeRequestService";
import { subAgentLicenseService } from "./api/subAgentLicenseService";
import { marketplaceBookingService } from "./api/marketplaceBookingService";

// Live items link; future items render disabled with a "soon" tag until their phase ships.
// `badge: "upgrades"` shows a live pending-count pill (the SuperAdmin's new-request alert).
const NAV = [
  { to: "/console", label: "Dashboard", Icon: LayoutDashboard, end: true },
  { to: "/console/tenants", label: "Tenants", Icon: Building2 },
  { to: "/console/palette", label: "Design Tokens", Icon: PaletteIcon },
  { to: "/console/plans", label: "Subscriptions", Icon: CreditCard },
  { to: "/console/upgrade-requests", label: "Subscription & Add-ons", Icon: ArrowUpCircle, badge: "upgrades" },
  { to: "/console/usage", label: "Usage & Quotas", Icon: Gauge },
  { to: "/console/hotel-catalog", label: "Hotel Catalog", Icon: BedDouble },
  // Its own badge, separate from "upgrades": a booking request is time-critical in a way a plan
  // upgrade is not — a tenant is holding a customer while this sits unanswered.
  { to: "/console/hotel-requests", label: "Hotel Requests", Icon: ClipboardCheck, badge: "hotelRequests" },
  { to: "/console/users", label: "Users", Icon: Users },
  { to: "/console/superadmins", label: "SuperAdmins", Icon: UserCog },
  { to: "/console/feature-flags", label: "Feature Flags", Icon: ToggleLeft },
  { to: "/console/config", label: "Global Config", Icon: Settings2 },
  { to: "/console/audit", label: "Audit Log", Icon: ScrollText },
  { to: "/console/announcements", label: "Announcements", Icon: Megaphone },
  { to: "/console/ops", label: "Ops / Danger", Icon: Wrench },
];

export default function ConsoleSidebar({ collapsed }) {
  const [pendingUpgrades, setPendingUpgrades] = useState(0);
  const [pendingHotelRequests, setPendingHotelRequests] = useState(0);

  // Live pending badge: plan upgrades + Travel Partner seat licenses, so the one queue's pill reflects
  // both. Best-effort on mount and whenever the tab regains focus (an operator returning to the console
  // sees new requests without a full reload).
  useEffect(() => {
    let alive = true;
    const refresh = () =>
      Promise.all([
        upgradeRequestService.pendingCount().catch(() => ({ count: 0 })),
        subAgentLicenseService.pendingCount().catch(() => ({ count: 0 })),
        // Note: this one resolves to a NUMBER, not a {count} object like its two siblings.
        marketplaceBookingService.pendingCount().catch(() => 0),
      ]).then(([u, s, h]) => {
        if (!alive) return;
        setPendingUpgrades(Number(u?.count ?? 0) + Number(s?.count ?? 0));
        setPendingHotelRequests(Number(h ?? 0));
      });
    refresh();
    window.addEventListener("focus", refresh);
    return () => { alive = false; window.removeEventListener("focus", refresh); };
  }, []);

  const badgeFor = (item) => {
    if (item.badge === "upgrades") return pendingUpgrades;
    if (item.badge === "hotelRequests") return pendingHotelRequests;
    return 0;
  };

  return (
    <aside
      className={`${collapsed ? "w-16" : "w-60"} hidden shrink-0 border-r border-border bg-sidebar transition-[width] duration-200 sm:block`}
    >
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white shadow-[var(--sa-card-shadow)]"
          style={{ backgroundImage: "var(--sa-gradient)" }}
        >
          <ShieldCheck size={18} />
        </div>
        {!collapsed && (
          <span
            className="truncate bg-clip-text text-sm font-bold text-transparent"
            style={{ backgroundImage: "var(--sa-gradient)" }}
          >
            Platform Console
          </span>
        )}
      </div>

      <nav className="flex flex-col gap-0.5 p-2">
        {NAV.map((item) =>
          item.soon ? (
            <div
              key={item.label}
              title={`${item.label} — coming soon`}
              className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted"
            >
              <item.Icon size={18} className="shrink-0 opacity-70" />
              {!collapsed && <span className="flex-1 truncate opacity-70">{item.label}</span>}
              {!collapsed && (
                <span className="rounded bg-surface-hover px-1.5 py-0.5 text-[10px] font-medium text-muted">
                  soon
                </span>
              )}
            </div>
          ) : (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.end}
              title={item.label}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-accent-soft font-semibold text-accent-soft-text ring-1 ring-inset ring-accent/15"
                    : "text-body hover:bg-surface-hover hover:text-heading"
                }`
              }
            >
              <span className="relative shrink-0">
                <item.Icon size={18} />
                {collapsed && badgeFor(item) > 0 && (
                  <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-hue-amber ring-2 ring-sidebar" />
                )}
              </span>
              {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
              {!collapsed && badgeFor(item) > 0 && (
                <span className="rounded-full bg-hue-amber-soft px-1.5 py-0.5 text-[10px] font-bold text-hue-amber">
                  {badgeFor(item)}
                </span>
              )}
            </NavLink>
          )
        )}
      </nav>
    </aside>
  );
}
