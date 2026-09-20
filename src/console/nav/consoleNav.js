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
  Activity,
  ArrowUpCircle,
  BedDouble,
  Building2,
  Car,
  ClipboardCheck,
  Coins,
  CreditCard,
  Gauge,
  Handshake,
  LayoutDashboard,
  Megaphone,
  Package,
  Wand2,
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

/**
 * What a brand-new operator finds pinned.
 *
 * The comment here used to promise "the five daily destinations below" over an EMPTY array, so a
 * fresh console opened with a five-row rail and everything else behind More. These three are
 * deliberately NOT rail items: the sidebar drops a pin that already has a rail row
 * (ConsoleSidebar pinnedRows), so seeding Tenants or Hotel Requests would render nothing.
 *
 * They are the three the action inbox sends an operator to most often that the rail does not
 * carry — a partner waiting on review, money waiting on collection, and the catalog those two
 * feed. Pins are operator choices, so anyone can unpin them.
 */
export const CONSOLE_DEFAULT_PINS = [
  "console.hotelPartners",
  "console.billing",
  "console.hotelCatalog",
];

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
        keywords: "home platform stats action inbox queues",
      },
    ],
  },
  // ───────────────────────────────────────────────────────────────────────────
  // WHO is on the platform, and WHAT they are allowed to use.
  //
  // Split out of the old "Business" section, which held five screens under one
  // heading called "Customers & Billing" — a name that admits it is two subjects.
  // Feature Flags moved in from Administration: it answers "what can this tenant
  // use", which is a question about a customer, not about running the service. It
  // sat two rows from "Ops / Danger" and one row from Tenants, and the wrong one
  // of those was its neighbour.
  // ───────────────────────────────────────────────────────────────────────────
  {
    id: "customers",
    label: "Customers",
    items: [
      {
        id: "console.customerAccounts",
        label: "Accounts & access",
        Icon: Building2,
        keywords: "tenants organizations agencies users staff impersonate modules entitlements flags",
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
            // Moved out of the retired "Security" section. This is tenant STAFF — the row an
            // operator opens to impersonate somebody who cannot log in. Filing it beside
            // SuperAdmins put a customer-support screen next to a platform-operator one on the
            // strength of the word "access"; they are answered by different people about
            // different populations.
            id: "console.users",
            label: "Users",
            path: "/console/users",
            Icon: Users,
            keywords: "tenant staff impersonate access security",
          },
          {
            // Moved out of Administration. Its neighbours now are the tenant it applies to and
            // the plan that pays for it, which is the order the question is actually asked in.
            id: "console.flags",
            label: "Feature Flags",
            path: "/console/feature-flags",
            Icon: ToggleLeft,
            keywords: "modules entitlements toggles plan add-on",
          },
        ],
      },
    ],
  },
  // ───────────────────────────────────────────────────────────────────────────
  // WHAT they pay, and what they owe.
  //
  // Credit limits joined this group from the hotel marketplace. It is the
  // platform's exposure to a tenant — the same subject as an overdue invoice —
  // and filing it under Hotels meant the operator asking "how far into us is this
  // agency" had to already know the answer lived beside a room rate. The entity is
  // hotel-only today (`tenant_marketplace_credit` has no transport or package
  // counterpart); the label says "Credit limits" rather than "Hotel credit" so it
  // does not have to be renamed when a second marketplace grows one.
  // ───────────────────────────────────────────────────────────────────────────
  {
    id: "revenue",
    label: "Revenue",
    items: [
      {
        id: "console.revenue",
        label: "Plans & billing",
        Icon: Wallet,
        keywords: "subscriptions plans pricing invoices collections outstanding overdue upgrades usage quotas credit",
        children: [
          {
            id: "console.plans",
            label: "Subscriptions",
            path: "/console/plans",
            Icon: CreditCard,
            keywords: "plans pricing modules",
          },
          {
            id: "console.billing",
            label: "Billing & Collections",
            path: "/console/billing",
            Icon: Wallet,
            keywords: "invoices revenue collections outstanding overdue payments finance",
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
          {
            id: "console.hotelCredit",
            label: "Credit limits",
            path: "/console/hotel-credit",
            Icon: Wallet,
            keywords: "tenant credit outstanding limit owed settlement payment balance exposure hotel",
          },
        ],
      },
    ],
  },
  // ───────────────────────────────────────────────────────────────────────────
  // WHAT WE SELL THEM. Renamed from "Marketplace", which named the mechanism
  // rather than the job — every group under it is a supply line.
  //
  // Three siblings, deliberately not one group: different suppliers, different
  // rate vocabulary, different tables, different commercial rules. The only thing
  // they share is this heading, which is exactly the amount of shared-ness the
  // truth supports.
  // ───────────────────────────────────────────────────────────────────────────
  {
    id: "supply",
    label: "Supply",
    items: [
      {
        id: "console.hotelMarketplace",
        label: "Hotel Marketplace",
        Icon: BedDouble,
        keywords: "hotels marketplace supply bookings partners pricing commissions",
        children: [
          {
            id: "console.hotelCatalog",
            label: "Hotel Catalog",
            path: "/console/hotel-catalog",
            Icon: BedDouble,
            keywords: "supply inventory rooms rates",
          },
          {
            id: "console.hotelPartners",
            label: "Hotel Partners",
            path: "/console/hotel-partners",
            Icon: Handshake,
            // Carries the badge the separate Nominations row used to. A nomination is a tenant
            // waiting on the platform, and it is now the first view of this screen — the count
            // has to stay visible on the row that owns it or the queue goes quiet again, which
            // is exactly the state that left it invisible for months before it had a page.
            badge: "hotelNominations",
            keywords: "invite onboarding registration supplier property owner nominations nominated proposed suggested tenant request",
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
            keywords: "approval queue bookings stay calendar occupancy rooms nights allotment availability",
          },
          {
            id: "console.commissions",
            label: "Hotel earnings",
            path: "/console/hotel-commissions",
            Icon: Coins,
            // No badge: the earning ledger is a report, not a queue. Directly after the pricing
            // rule because the rule is what PRODUCES the row in it.
            keywords: "platform earnings commission ledger revenue",
          },
        ],
      },
      {
        // The second supply line. It used to sit inside the group labelled "Hotel Marketplace",
        // which made a coach operator's catalog read as a kind of hotel — an operator hunting for
        // a vehicle had to already know it was filed under hotels to find it.
        id: "console.transportMarketplace",
        label: "Transport Marketplace",
        Icon: Car,
        keywords: "transport vehicles cabs fleet marketplace supply orders partners pricing commissions",
        children: [
          {
            id: "console.transportCatalog",
            label: "Transport Catalog",
            path: "/console/transport-catalog",
            Icon: Car,
            // The supply side. Listed above the request queue because it is the thing that has to
            // exist first — an empty catalog produces an empty queue and no obvious reason why.
            keywords: "vehicles cabs fleet catalog publish supply rates",
          },
          {
            id: "console.transportPartners",
            label: "Transport Partners",
            path: "/console/transport-partners",
            Icon: Handshake,
            // Directly under the catalog because it is where the catalog comes FROM: an invite
            // becomes a registration becomes published supply.
            keywords: "invite onboarding registration operator supplier vehicle owner fleet",
          },
          {
            id: "console.transportRequests",
            // 6, not 4: the hotel queue already holds slot 4. `primary` is a POSITION, so two rows
            // claiming the same number leaves the rail's order decided by array order rather than
            // by intent — exactly what the numbering exists to prevent.
            primary: 6,
            label: "Transport Requests",
            path: "/console/transport-requests",
            Icon: ClipboardCheck,
            // Deliberately NOT folded into the hotel queue. The two are answered with different
            // knowledge — a room rate versus a duty roster — often by different people, and merging
            // them would hide a car nobody has assigned behind a pile of hotel enquiries.
            badge: "transportRequests",
            keywords: "approval queue transport vehicle cab duty slip assignment driver",
          },
          {
            id: "console.transportEarnings",
            label: "Transport Earnings",
            path: "/console/transport-earnings",
            Icon: Coins,
            // The ledger, not a report: it is where a settlement is actually recorded, so it sits
            // with the other transport screens rather than under billing.
            keywords: "commission earnings margin ledger settle adjust payout",
          },
        ],
      },
      {
        // Packages is a GROUP now, like its two siblings. Its two screens used to be loose items
        // in this section — the only supply line whose rows sat at a different level from the
        // rest, so the reader had to work out whether that meant something. It did not.
        //
        // Two rows rather than five because partner onboarding, pricing rules and an earnings
        // ledger do not exist for packages yet. When they land they belong here, in this order.
        id: "console.packageMarketplace",
        label: "Package Marketplace",
        Icon: Package,
        keywords: "packages tours itineraries fixed departure catalog custom mix requests",
        children: [
          {
            id: "console.packageCatalog",
            label: "Package Catalog",
            path: "/console/package-catalog",
            Icon: Package,
            // The only catalog here that agencies WRITE into, so its review queue counts other
            // people's submissions rather than the platform's own backlog.
            keywords: "packages tours itineraries fixed departure catalog listings review approve agency",
          },
          {
            // Its own row rather than a third tab on the catalog. The catalog answers "what is on
            // sale"; this answers "who is waiting on me" — a different question, on a different
            // clock, and the one that goes stale if it is a tab nobody opens.
            id: "console.packageMix",
            label: "Custom requests",
            path: "/console/package-catalog/mix",
            Icon: Wand2,
            keywords: "mix match custom package request price estimate build your own quote",
          },
        ],
      },
      // A SIBLING of the three catalogs, not a child of one. It covers all three supply lines,
      // so filing it under Hotel Marketplace would have said the opposite — and that is exactly
      // where the hotel half of it used to live, which is why there were two rows.
      {
        // ONE row for the platform's margin, with a section per supply line. There were two
        // — hotel and transport — and packages would have made a third, all answering the
        // same question. The id stays `console.hotelPricing` because pins are stored by id;
        // `alt` keeps the row lit on the two redirected paths.
        id: "console.hotelPricing",
        label: "Pricing rules",
        path: "/console/pricing",
        alt: ["/console/hotel-pricing", "/console/transport-pricing"],
        Icon: Percent,
        // ⚠ The platform's own margin structure. No tenant counterpart exists or may exist.
        keywords: "pricing rules markup commission margin commercial rate hotel transport vehicle package tier",
      },
    ],
  },
  // ───────────────────────────────────────────────────────────────────────────
  // RUNNING THE SERVICE. SuperAdmins joined from the retired "Security" section:
  // who operates the platform is an operations question, and its neighbours here
  // are the audit log that records what they did and the config they can change.
  //
  // "Security" is gone as a heading. It was a section containing one group
  // containing two links — three levels of chrome for two rows — and it grouped a
  // tenant-facing screen with a platform-facing one because both could be called
  // access.
  // ───────────────────────────────────────────────────────────────────────────
  {
    id: "platform",
    label: "Platform",
    items: [
      {
        id: "console.platform",
        label: "Operations",
        Icon: Settings2,
        keywords: "configuration email audit announcements operations superadmins health danger",
        children: [
          {
            id: "console.superadmins",
            label: "SuperAdmins",
            path: "/console/superadmins",
            Icon: UserCog,
            keywords: "operators mfa invite security access",
            can: () => getConsoleIdentity().role === "SUPER_ADMIN",
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
            // Beside the audit log, and distinct from it: that one records what the PLATFORM did
            // (logins, impersonation, tenant lifecycle), this one every HTTP request every tenant
            // made. Someone looking for "why did this 500" wants this row, not that one.
            id: "console.requestLogs",
            label: "Request Logs",
            path: "/console/request-logs",
            Icon: Activity,
            keywords: "http api requests errors latency slow trace 500 debugging monitoring",
          },
          {
            // The third of the three log screens, and the only one showing what TENANTS did.
            // Audit Log is what the platform did to them; Request Logs is the HTTP traffic
            // underneath; this is their staff's own actions, across every tenant.
            id: "console.tenantActivity",
            label: "Tenant Activity",
            path: "/console/tenant-activity",
            Icon: Activity,
            keywords: "tenant staff actions login create update delete export history activity",
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
