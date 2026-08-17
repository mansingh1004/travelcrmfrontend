// src/console/nav/consoleNav.js
// ─────────────────────────────────────────────────────────────────────────────
// Platform console nav registry. Same shape as the tenant app's (see
// app/nav/navConfig.js) so both realms share one model, one palette and one set
// of pin/recent mechanics — but the two lists never mix, because they are read
// from different files under different storage namespaces.
//
// The console has no permission model to express: reaching /console at all means
// holding a SuperAdmin session, so there are no `can()` gates here. The grouping
// is the whole point — 17 flat rows in one undifferentiated column is a list you
// re-read every time instead of a structure you learn.
// ─────────────────────────────────────────────────────────────────────────────

import {
  ArrowUpCircle,
  BedDouble,
  Building2,
  CalendarRange,
  ClipboardCheck,
  Coins,
  CreditCard,
  Gauge,
  Handshake,
  LayoutDashboard,
  Megaphone,
  Percent,
  Palette as PaletteIcon,
  ScrollText,
  Settings2,
  Mail,
  ServerCog,
  ToggleLeft,
  UserCog,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { getConsoleIdentity } from "../lib/consoleAuth";

export const CONSOLE_NAV_NAMESPACE = "console";

/** Pins are operator choices; the five daily destinations below make a fresh rail useful already. */
export const CONSOLE_DEFAULT_PINS = [];

export const CONSOLE_NAV_SECTIONS = [
  {
    id: "overview",
    label: "Overview",
    items: [
      {
        id: "console.home",
        primary: 1,
        label: "Dashboard",
        path: "/console",
        Icon: LayoutDashboard,
        // Exact-match only: without this every /console/* route would keep the
        // dashboard lit, since the nav model treats a path as covering its subtree.
        exact: true,
        keywords: "home platform stats",
      },
    ],
  },
  {
    id: "customers",
    label: "Business",
    items: [
      {
        id: "console.customersBilling",
        label: "Customers & Billing",
        Icon: Building2,
        keywords: "tenants subscriptions upgrades usage billing quotas",
        children: [
      {
        id: "console.tenants",
        primary: 2,
        label: "Tenants",
        path: "/console/tenants",
        Icon: Building2,
        keywords: "organizations agencies accounts",
      },
      {
        id: "console.billing",
        label: "Billing & Collections",
        path: "/console/billing",
        Icon: Wallet,
        keywords: "invoices revenue collections outstanding overdue payments finance",
      },
      {
        id: "console.plans",
        label: "Subscriptions",
        path: "/console/plans",
        Icon: CreditCard,
        keywords: "plans pricing modules",
      },
      {
        id: "console.upgrades",
        primary: 3,
        label: "Subscription & Add-ons",
        path: "/console/upgrade-requests",
        Icon: ArrowUpCircle,
        badge: "upgrades",
        keywords: "upgrade requests approvals seats licenses",
      },
      {
        id: "console.usage",
        primary: 5,
        label: "Usage & Quotas",
        path: "/console/usage",
        Icon: Gauge,
        keywords: "limits storage metering overage",
      },
        ],
      },
    ],
  },
  {
    id: "marketplace",
    label: "Marketplace",
    items: [
      {
        id: "console.hotelMarketplace",
        label: "Hotel Marketplace",
        Icon: BedDouble,
        keywords: "hotels marketplace supply bookings partners pricing credit commissions",
        children: [
      {
        id: "console.hotelCatalog",
        label: "Hotel Catalog",
        path: "/console/hotel-catalog",
        Icon: BedDouble,
        keywords: "supply inventory rooms rates",
      },
      {
        id: "console.hotelNominations",
        label: "Hotel Nominations",
        path: "/console/hotel-nominations",
        Icon: Handshake,
        // Its own badge, and it earns one: a nomination is a tenant waiting on the
        // platform, and until this screen existed it was invisible entirely — the
        // table, the API and the console client were all written, with no page.
        // Listed BEFORE partners because that is the order of the flow: a nomination
        // becomes an invite becomes a registration.
        badge: "hotelNominations",
        keywords: "proposed suggested property tenant request catalog",
      },
      {
        id: "console.hotelPartners",
        label: "Hotel Partners",
        path: "/console/hotel-partners",
        Icon: Handshake,
        keywords: "invite onboarding registration supplier property owner",
      },
      {
        id: "console.hotelRequests",
        primary: 4,
        label: "Hotel Requests",
        path: "/console/hotel-requests",
        Icon: ClipboardCheck,
        // Its own badge, separate from "upgrades": a booking request is time-critical
        // in a way a plan upgrade is not — a tenant is holding a customer while this
        // sits unanswered.
        badge: "hotelRequests",
        keywords: "approval queue bookings",
      },
      {
        id: "console.hotelOccupancy",
        label: "Stay Calendar",
        path: "/console/hotel-occupancy",
        Icon: CalendarRange,
        // No badge: it is a picture of what is already committed, not work waiting to be done.
        // Sits directly under Hotel Requests because it is what an operator opens WHILE deciding
        // one — "how many of this property's rooms do I already hold that week".
        keywords: "occupancy rooms nights stays calendar allotment availability",
      },
      {
        id: "console.hotelPricing",
        label: "Pricing Rules",
        path: "/console/hotel-pricing",
        Icon: Percent,
        // ⚠ The platform's own margin structure. No tenant counterpart exists or may exist.
        keywords: "markup commission margin commercial rule rate",
      },
      {
        id: "console.hotelCredit",
        label: "Tenant Credit",
        path: "/console/hotel-credit",
        Icon: Wallet,
        keywords: "outstanding limit owed settlement payment balance",
      },
      {
        id: "console.commissions",
        label: "Platform Earnings",
        path: "/console/hotel-commissions",
        Icon: Coins,
        // No badge: the earning ledger is a report, not a queue.
        keywords: "commission ledger revenue",
      },
        ],
      },
    ],
  },
  {
    id: "access",
    label: "Security",
    items: [
      {
        id: "console.access",
        label: "Access",
        Icon: Users,
        keywords: "users superadmins operators security access",
        children: [
      {
        id: "console.users",
        label: "Users",
        path: "/console/users",
        Icon: Users,
        keywords: "tenant staff impersonate",
      },
      {
        id: "console.superadmins",
        label: "SuperAdmins",
        path: "/console/superadmins",
        Icon: UserCog,
        keywords: "operators mfa invite",
        can: () => getConsoleIdentity().role === "SUPER_ADMIN",
      },
        ],
      },
    ],
  },
  {
    id: "platform",
    label: "Administration",
    items: [
      {
        id: "console.platform",
        label: "Platform",
        Icon: Settings2,
        keywords: "configuration flags email audit announcements operations",
        children: [
      {
        id: "console.flags",
        label: "Feature Flags",
        path: "/console/feature-flags",
        Icon: ToggleLeft,
        keywords: "modules entitlements toggles",
      },
      {
        id: "console.config",
        label: "Global Config",
        path: "/console/config",
        Icon: Settings2,
        keywords: "settings maintenance",
      },
      {
        id: "console.platform-email",
        label: "Platform Email",
        path: "/console/platform-email",
        Icon: Mail,
        keywords: "smtp mailbox inbox sent invites sender",
      },
      {
        id: "console.platform-health",
        label: "Platform Health",
        path: "/console/platform-health",
        Icon: ServerCog,
        keywords: "health jobs scheduler failures database mail notifications backlog operations",
      },
      {
        id: "console.audit",
        label: "Audit Log",
        path: "/console/audit",
        Icon: ScrollText,
        keywords: "security history trail",
      },
      {
        id: "console.announcements",
        label: "Announcements",
        path: "/console/announcements",
        Icon: Megaphone,
        keywords: "broadcast notice banner",
      },
      ...(import.meta.env.DEV ? [{
        id: "console.palette",
        label: "Design Tokens",
        path: "/console/palette",
        Icon: PaletteIcon,
        keywords: "theme colours palette",
      }] : []),
      {
        id: "console.ops",
        label: "Ops / Danger",
        path: "/console/ops",
        Icon: Wrench,
        keywords: "export purge hard delete danger zone",
      },
        ],
      },
    ],
  },
];
