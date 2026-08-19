// src/app/nav/navConfig.js
// ─────────────────────────────────────────────────────────────────────────────
// THE NAV REGISTRY — one declarative source of truth for the tenant app's
// navigation. The sidebar, the ⌘K palette, the app launcher, the mobile tab bar
// and the breadcrumb all read this array. Adding a screen is one entry here, not
// four files of hand-written JSX.
//
// ── Rules ────────────────────────────────────────────────────────────────────
// • `can()` is the ONLY gate, and every predicate below is a verbatim port of the
//   one the previous hand-written sidebar used. The backend @PreAuthorize is the
//   real security boundary; this decides what is worth SHOWING.
// • `path` values are the EXISTING routes from app/router.jsx, character for
//   character. Nothing here changes routing.
// • `id` is stable and is what pins / recents are stored under, so a path can be
//   renamed later without emptying everyone's pinned rail.
// • `alt` lists extra path prefixes that still belong to a row — a booking detail
//   page must keep "Bookings" lit, not fall back to nothing.
// • Children are deliberately ONE level deep. A CRM that needs three is a CRM
//   that needs a launcher, and there is one.
// • `primary: <n>` puts an item on the flat sidebar rail, at position n. It is a
//   NUMBER, not a flag, so the rail's order is set here and does not depend on
//   which section an item happens to sit in — sections exist for the launcher's
//   headings. Everything without it is launcher- and search-only, and pinnable.
// ─────────────────────────────────────────────────────────────────────────────

import {
  BarChart3,
  Building2,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  Car,
  CreditCard,
  Database,
  FileText,
  HandCoins,
  Landmark,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  Network,
  Plug,
  Settings,
  Store,
  Trash2,
  Truck,
  UserCheck,
  UserCog,
  Users,
  Zap,
  BellRing,
  Inbox,
  CircleUser,
  Radar,
  MessageCircle,
} from "lucide-react";

import {
  hasAnyPermission,
  hasModule,
  hasPermission,
  isSubAgent,
  isSuperAdmin,
  isTenantAdmin,
  P,
} from "@shared/lib/access";

/** Storage namespace for this realm's pins / recents / section state. */
export const NAV_NAMESPACE = "app";

/**
 * What a brand-new user finds pinned: the three list screens a travel desk opens
 * every hour. They are CHILDREN of rail groups, so they add rows rather than
 * duplicating them — "All bookings" one click away without expanding "Bookings".
 */
export const DEFAULT_PINS = ["leads.all", "bookings.all", "customers.all"];

export const NAV_SECTIONS = [
  // ── Every day ──────────────────────────────────────────────────────────────
  {
    id: "workspace",
    label: "Workspace",
    items: [
      {
        id: "dashboard",
        primary: 1,
        label: "Dashboard",
        path: "/Dashboard",
        Icon: LayoutDashboard,
        tone: "blue",
        keywords: "home overview kpi stats",
        // ModuleAccessFilter maps /api/dashboard → DASHBOARD. Ungated this showed
        // for a fleet-only tenant and every call on the page 403'd.
        can: () => !isSubAgent() && hasModule("DASHBOARD"),
      },
      {
        id: "calendar",
        primary: 2,
        label: "Calendar",
        path: "/calendar",
        Icon: CalendarCheck,
        tone: "fuchsia",
        keywords: "team schedule agenda tasks board",
        // TASKS, not a key of its own — the calendar is an aggregation over tasks,
        // and that is exactly how ModuleAccessFilter maps /api/calendar.
        can: () => hasPermission(P.TASK_READ) && hasModule("TASKS"),
      },
      {
        id: "tasks",
        primary: 3,
        label: "All Tasks",
        path: "/tasks",
        Icon: ListChecks,
        tone: "fuchsia",
        keywords: "todo assignments follow up",
        can: () => hasPermission(P.TASK_READ) && hasModule("TASKS"),
      },
      {
        id: "mailbox",
        label: "Mailbox",
        Icon: Inbox,
        tone: "sky",
        keywords: "email inbox sent mail gmail imap",
        // COMM_MAILBOX_READ — its OWN authority, not the one that reads conversations. This is the
        // whole agency's mailbox with no row scope applied, so it is granted to managers and owners
        // rather than to everyone who can answer their own threads. The plan module still applies,
        // matching the ModuleAccessFilter rule for /api/mailbox.
        can: () => hasPermission(P.COMM_MAILBOX_READ) && hasModule("COMMUNICATION"),
        path: "/Mailbox",
      },
      {
        id: "communication",
        label: "Communication Center",
        Icon: MessageCircle,
        tone: "emerald",
        keywords: "chat whatsapp email conversations inbox messages interakt",
        // Same authority and the same plan module as Mailbox — these are the same
        // comm_conversations rows behind the same COMM_READ endpoints.
        can: () => hasPermission(P.COMM_READ) && hasModule("COMMUNICATION"),
        // Two channels, one screen each, over one table. A third channel is another child
        // here — it is deliberately NOT a sibling top-level row, because the point of the
        // Center is that a customer's history is one thing seen through several channels.
        children: [
          // Everything in one queue — lead work and operations work, both channels. The two below
          // are the same screen with a channel pinned, kept because an operator who lives in one
          // channel should not have to re-filter every morning.
          { id: "communication.inbox", label: "Inbox", path: "/communication" },
          { id: "communication.whatsapp", label: "WhatsApp", path: "/communication/whatsapp", alt: ["/WhatsApp"] },
          { id: "communication.email", label: "Email", path: "/communication/email" },
          {
            id: "communication.templates",
            label: "Message templates",
            path: "/communication/templates",
            // Its own gate, narrower than the group's: the backend grants COMM_TEMPLATE_MANAGE per
            // user rather than by role, so most people who can read the inbox cannot edit what it
            // is allowed to send.
            can: () => hasPermission(P.COMM_TEMPLATE_MANAGE) && hasModule("COMMUNICATION"),
          },
        ],
      },
      {
        id: "reminders",
        label: "Reminders",
        Icon: BellRing,
        tone: "rose",
        keywords: "alerts notifications follow up due",
        can: () => hasPermission(P.REMINDER_READ),
        children: [
          { id: "reminders.mine", label: "My Reminders", path: "/Reminders", alt: ["/CreateReminder"] },
          { id: "reminders.booking", label: "Booking Reminders", path: "/BookingReminders" },
          { id: "reminders.notifications", label: "Notifications", path: "/Notifications" },
          {
            id: "reminders.settings",
            label: "Notification Settings",
            path: "/NotificationSettings",
            keywords: "channels email whatsapp preferences",
          },
        ],
      },
    ],
  },

  // ── Winning the business ───────────────────────────────────────────────────
  {
    id: "sales",
    label: "Sales",
    items: [
      {
        id: "leads",
        primary: 4,
        label: "Leads",
        Icon: Users,
        tone: "cyan",
        keywords: "enquiry enquiries pipeline prospects",
        can: () => hasPermission(P.LEAD_READ) && hasModule("LEADS"),
        children: [
          {
            id: "leads.incoming",
            label: "Incoming leads",
            path: "/leads/incoming",
            keywords: "claim sla unassigned new",
          },
          {
            id: "leads.all",
            label: "All leads",
            path: "/allleads",
            // Editing a lead, the WhatsApp panel, or the activity-log grid — all
            // launched from this page, all still "Leads" as far as the rail is
            // concerned. `/AllLeadLogs` has no menu row of its own by request; the
            // alt is what keeps the rail lit when you are on it.
            alt: ["/EditLead", "/WhatsAppPanel", "/AllLeadLogs"],
          },
          {
            id: "leads.new",
            label: "Add new lead",
            path: "/createlead",
            keywords: "create enquiry intake",
            can: () => hasPermission(P.LEAD_CREATE),
          },
        ],
      },
      {
        id: "quotations",
        primary: 5,
        label: "Quotations",
        Icon: FileText,
        tone: "emerald",
        keywords: "quote proposal itinerary package pdf",
        can: () => hasPermission(P.QUOTATION_READ) && hasModule("QUOTATIONS"),
        children: [
          // No "Build a quotation" row: the builder is always entered against a
          // lead, so it belongs in Quick Create (and ⌘K), not as a rail
          // destination that would open an empty builder with nothing selected.
          //
          // The standalone "Quick quote" row is gone too, and for a related
          // reason: pricing now happens INSIDE the rapid lead form, which
          // captures the enquiry and prices it in one pass. A second entry point
          // that opened the same accordion with no lead attached was a slower
          // route to the same place. CreateLead's rapid mode still hosts the
          // builder — see quotation/index.js.
          {
            id: "quotations.templates",
            label: "Package templates",
            path: "/quotations/templates",
            keywords: "saved packages reuse",
          },
        ],
      },
      {
        id: "customers",
        primary: 7,
        label: "Customers",
        Icon: UserCheck,
        tone: "teal",
        keywords: "clients travellers guests contacts",
        can: () => hasPermission(P.CUSTOMER_READ) && hasModule("CUSTOMERS"),
        children: [
          {
            id: "customers.all",
            label: "All customers",
            path: "/AllCustomers",
            alt: ["/EditCustomer", "/CustomerDetails"],
          },
          {
            id: "customers.new",
            label: "Add new customer",
            path: "/Createcustomer",
            can: () => hasPermission(P.CUSTOMER_CREATE),
          },
        ],
      },
    ],
  },

  // ── Delivering the trip ────────────────────────────────────────────────────
  {
    id: "operations",
    label: "Operations",
    items: [
      {
        // First in the section because it is where the day starts: not "show me a
        // booking" but "of the parties travelling soon, which are not ready".
        id: "ops.board",
        // Appended rather than slotted in: 1-9 are taken and renumbering the rail is a
        // product decision, not a side effect of adding a screen. Move it up if operations
        // should outrank quotations on the rail.
        primary: 10,
        label: "Operations",
        path: "/operations",
        Icon: Radar,
        tone: "blue",
        keywords: "ops board departures readiness suppliers unconfirmed pending checklist",
        can: () => hasPermission(P.BOOKING_READ) && hasModule("BOOKINGS"),
      },
      {
        id: "bookings",
        primary: 6,
        label: "Bookings",
        Icon: CalendarDays,
        tone: "orange",
        keywords: "trips confirmed vouchers payments invoice",
        can: () => hasPermission(P.BOOKING_READ) && hasModule("BOOKINGS"),
        children: [
          {
            id: "bookings.all",
            label: "All bookings",
            path: "/Allbookings",
            alt: ["/EditBooking", "/BookingDetails", "/BookingPayments", "/BookingServices"],
          },
          {
            id: "bookings.new",
            label: "Add new booking",
            path: "/CreateBooking",
            keywords: "create trip confirm",
            can: () => hasPermission(P.BOOKING_CREATE),
          },
          {
            // Clean-up, not a daily destination: new duplicates are blocked at creation, so this
            // normally shows an empty state. Gated on BOOKING_CANCEL because that is what resolving
            // one takes — showing it to someone who can only look is a dead end.
            id: "bookings.duplicates",
            label: "Duplicate bookings",
            path: "/DuplicateBookings",
            keywords: "duplicate double entered twice merge cleanup",
            can: () => hasPermission(P.BOOKING_CANCEL),
          },
        ],
      },
      {
        id: "vendors",
        label: "Vendors",
        Icon: Store,
        tone: "amber",
        keywords: "suppliers dmc transporters payables",
        can: () => hasPermission(P.VENDOR_READ) && hasModule("VENDORS"),
        children: [
          {
            id: "vendors.all",
            label: "All vendors",
            path: "/AllVendors",
            alt: ["/EditVendor", "/VendorDetails"],
          },
          {
            id: "vendors.new",
            label: "Add new vendor",
            path: "/CreateVendor",
            can: () => hasPermission(P.VENDOR_CREATE),
          },
        ],
      },
      {
        id: "fleet",
        label: "Vehicle Diary",
        Icon: Truck,
        tone: "sky",
        keywords: "fleet drivers trips fuel maintenance compliance",
        can: () => hasPermission(P.FLEET_READ) && hasModule("FLEET"),
        children: [
          { id: "fleet.dashboard", label: "Fleet dashboard", path: "/fleet" },
          { id: "fleet.vehicles", label: "Vehicles", path: "/fleet/vehicles" },
          { id: "fleet.drivers", label: "Drivers", path: "/fleet/drivers" },
          { id: "fleet.trips", label: "Trips", path: "/fleet/trips", keywords: "duty slips" },
          // Money, not operations: a dispatcher runs the diary all day without ever
          // seeing cost structure or who is holding the company's cash.
          {
            id: "fleet.expenses",
            label: "Expenses",
            path: "/fleet/expenses",
            can: () => hasPermission(P.FLEET_MONEY_READ),
          },
          {
            id: "fleet.settlements",
            label: "Driver Cash",
            path: "/fleet/settlements",
            can: () => hasPermission(P.FLEET_MONEY_READ),
          },
          {
            id: "fleet.periods",
            label: "Month Close",
            path: "/fleet/periods",
            can: () => hasPermission(P.FLEET_MONEY_READ),
          },
          {
            id: "fleet.compliance",
            label: "Compliance",
            path: "/fleet/compliance",
            keywords: "insurance permit fitness puc expiry",
          },
          /* The supply side of the Transport Marketplace. Their own `can` rather than the group's:
             an operator with FLEET has these only if they also hold TRANSPORT_SUPPLIER, and a plain
             Vehicle Diary customer who never joined the marketplace must not see two dead links. */
          {
            id: "fleet.platformJobs",
            label: "Platform Jobs",
            path: "/fleet/platform-jobs",
            can: () => hasPermission(P.TRANSPORT_SUPPLIER_ORDER_MANAGE) && hasModule("TRANSPORT_SUPPLIER"),
            keywords: "marketplace orders assign driver duty slip platform",
          },
          {
            id: "fleet.platformListings",
            label: "My Platform Listings",
            path: "/fleet/platform-listings",
            can: () => hasPermission(P.TRANSPORT_SUPPLIER_LISTING_MANAGE) && hasModule("TRANSPORT_SUPPLIER"),
            keywords: "marketplace listing publish supply catalog",
          },
        ],
      },
      {
        id: "marketplace",
        label: "Platform Hotels",
        Icon: Building2,
        tone: "blue",
        keywords: "marketplace b2b catalog inventory rooms",
        // Gated on the HOTEL_MARKETPLACE add-on, NOT on MASTERS: the tenant's own
        // private hotel master must keep working on every plan even when the
        // marketplace is off.
        can: () => hasPermission(P.HOTEL_MARKETPLACE_VIEW) && hasModule("HOTEL_MARKETPLACE"),
        children: [
          {
            id: "marketplace.browse",
            label: "Browse catalog",
            path: "/marketplace",
            keywords: "search hotels import",
          },
          {
            id: "marketplace.requests",
            label: "Hotel requests",
            path: "/marketplace/bookings",
            keywords: "approval queue status",
          },
        ],
      },
      {
        id: "transport",
        label: "Platform Transport",
        Icon: Car,
        tone: "blue",
        keywords: "marketplace transport vehicle cab car b2b catalog fleet supply",
        // Its OWN add-on, not part of the hotel one: an agency may buy stays without cars or cars
        // without stays. The tenant's own private Vehicle Master keeps working on every plan regardless.
        can: () => hasPermission(P.TRANSPORT_MARKETPLACE_VIEW) && hasModule("TRANSPORT_MARKETPLACE"),
        children: [
          {
            id: "transport.browse",
            label: "Browse vehicles",
            path: "/marketplace/transport",
            keywords: "search vehicles import cab suv tempo",
          },
          {
            id: "transport.requests",
            label: "Transport requests",
            path: "/marketplace/transport/orders",
            keywords: "approval queue status duty slip voucher",
          },
        ],
      },
    ],
  },

  // ── Growing it ─────────────────────────────────────────────────────────────
  {
    id: "growth",
    label: "Growth",
    items: [
      {
        id: "marketing",
        label: "Marketing",
        Icon: Megaphone,
        tone: "yellow",
        keywords: "campaigns broadcast whatsapp email segments drip",
        can: () => hasPermission(P.MARKETING_READ) && hasModule("MARKETING"),
        children: [
          { id: "marketing.overview", label: "Overview", path: "/marketing" },
          { id: "marketing.segments", label: "Segments", path: "/marketing/segments" },
          { id: "marketing.campaigns", label: "Campaigns", path: "/marketing/campaigns" },
          { id: "marketing.drips", label: "Drip sequences", path: "/marketing/drips" },
          {
            id: "marketing.automations",
            label: "Automations",
            path: "/marketing/automations",
            keywords: "birthday anniversary triggers",
          },
        ],
      },
      {
        id: "reports",
        primary: 8,
        label: "Reports",
        path: "/ReportsDashboard",
        Icon: BarChart3,
        tone: "indigo",
        // One row, no sub-menu — as it has always been. The seven report screens are
        // navigated FROM the reports dashboard, so listing them again in the rail
        // would duplicate that page's own navigation.
        //
        // `alt` keeps the row lit while you are on any of them (the old rail went
        // dark the moment you opened a report), and the names live in `keywords` so
        // ⌘K still gets you there by typing "geographic" or "follow-up".
        alt: [
          "/ActivityReports",
          "/GeographicDistribution",
          "/FollowupReports",
          "/BookingRevenueAnalysis",
          "/TravelDateAnalysis",
          "/InternationalDomestic",
        ],
        keywords:
          "analytics insights performance activity geographic distribution follow-up booking revenue travel dates international domestic",
        can: () => hasPermission(P.REPORT_VIEW) && hasModule("REPORTS"),
      },
    ],
  },

  // ── The money ──────────────────────────────────────────────────────────────
  {
    id: "finance",
    label: "Finance",
    items: [
      {
        id: "accounting",
        label: "Accounting",
        Icon: Landmark,
        tone: "lime",
        keywords: "gst tds invoice tax ledger p&l",
        can: () =>
          hasAnyPermission(P.ACCOUNTING_INVOICE_READ, P.ACCOUNTING_TDS_READ) &&
          hasModule("ACCOUNTING"),
        children: [
          {
            id: "accounting.dashboard",
            label: "Accounting dashboard",
            path: "/accounting",
            can: () => hasPermission(P.ACCOUNTING_INVOICE_READ),
          },
          {
            id: "accounting.invoices",
            label: "Invoices",
            path: "/accounting/invoices",
            can: () => hasPermission(P.ACCOUNTING_INVOICE_READ),
          },
          {
            id: "accounting.vendorbills",
            label: "Vendor bills & TDS",
            path: "/accounting/vendor-bills",
            can: () => hasPermission(P.ACCOUNTING_TDS_READ),
          },
          {
            id: "accounting.reports",
            label: "Accounting reports",
            path: "/accounting/reports",
            keywords: "gst summary profit loss",
            can: () => hasPermission(P.ACCOUNTING_INVOICE_READ),
          },
          {
            id: "accounting.settings",
            label: "GST settings",
            path: "/accounting/settings",
            can: () => hasPermission(P.ACCOUNTING_SETTINGS_MANAGE),
          },
        ],
      },
      {
        id: "mycommission",
        label: "My Commission",
        path: "/my-commission",
        Icon: HandCoins,
        tone: "emerald",
        keywords: "earnings payout",
        can: () => isSubAgent(),
      },
    ],
  },

  // ── Reference data ─────────────────────────────────────────────────────────
  {
    id: "data",
    label: "Master Data",
    items: [
      {
        id: "masters",
        primary: 9,
        label: "Masters",
        Icon: Database,
        tone: "purple",
        keywords: "catalog reference setup",
        can: () => hasPermission(P.MASTER_READ) && hasModule("MASTERS"),
        children: [
          { id: "masters.cities", label: "Cities", path: "/masters/city" },
          { id: "masters.destinations", label: "Destinations", path: "/masters/destinations" },
          { id: "masters.hotels", label: "Hotels", path: "/masters/hotels", keywords: "rooms meal plans" },
          { id: "masters.airlines", label: "Airlines", path: "/masters/airlines", keywords: "flights" },
          { id: "masters.cruises", label: "Cruises", path: "/masters/cruises", keywords: "ships cabins" },
          { id: "masters.vehicles", label: "Vehicles", path: "/masters/vehicles", keywords: "cars coaches" },
          { id: "masters.sightseeing", label: "Sightseeing", path: "/masters/sightseeing", keywords: "attractions activities" },
          { id: "masters.addons", label: "Add-on services", path: "/masters/add-on-services" },
          { id: "masters.testimonials", label: "Testimonials", path: "/masters/testimonials", keywords: "reviews" },
        ],
      },
    ],
  },

  // ── Running the agency ─────────────────────────────────────────────────────
  {
    id: "admin",
    label: "Administration",
    items: [
      {
        id: "users",
        label: "Users",
        Icon: UserCog,
        tone: "pink",
        keywords: "staff team roles permissions access",
        can: () => hasPermission(P.USER_READ),
        children: [
          {
            id: "users.all",
            label: "All users",
            path: "/Users",
            alt: ["/EditUser", "/UserPermissions"],
          },
          {
            id: "users.new",
            label: "Add new user",
            path: "/CreateUser",
            can: () => hasPermission(P.USER_CREATE),
          },
          {
            id: "users.templates",
            label: "Permission templates",
            path: "/PermissionTemplates",
            alt: ["/CreatePermissionTemplate"],
          },
        ],
      },
      {
        id: "subagents",
        label: "Travel Partners",
        Icon: Network,
        tone: "indigo",
        keywords: "sub agents franchise b2b commission",
        can: () => isTenantAdmin(),
        children: [
          { id: "subagents.manage", label: "Manage partners", path: "/subagents" },
          {
            id: "subagents.rollup",
            label: "Roll-up & commissions",
            path: "/subagents/rollup",
          },
        ],
      },
      {
        id: "settings",
        label: "Settings",
        Icon: Settings,
        tone: "slate",
        keywords: "company preferences configuration branding",
        can: () => hasPermission(P.SETTINGS_MANAGE),
        children: [
          { id: "settings.company", label: "Company settings", path: "/CompanySettings" },
          {
            id: "settings.email",
            label: "Email configuration",
            path: "/EmailConfiguration",
            keywords: "smtp sender",
          },
          {
            id: "settings.whatsapp",
            label: "WhatsApp configuration",
            path: "/WhatsAppConfiguration",
            keywords: "interakt templates",
          },
        ],
      },
      {
        id: "integrations",
        label: "Integrations",
        path: "/LeadSources",
        Icon: Plug,
        tone: "emerald",
        keywords: "lead sources webhook facebook google ads justdial api",
        can: () => hasPermission(P.SETTINGS_MANAGE),
      },
      {
        id: "trash",
        label: "Trash",
        path: "/trash",
        Icon: Trash2,
        tone: "red",
        keywords: "recycle bin deleted restore",
        can: () => hasPermission(P.TRASH_VIEW),
      },
      {
        id: "console",
        label: "Platform Console",
        path: "/console",
        Icon: UserCog,
        tone: "violet",
        keywords: "superadmin platform tenants",
        can: () => isSuperAdmin(),
      },
    ],
  },
];

/**
 * ACCOUNT destinations. Kept OUT of `NAV_SECTIONS` on purpose: these belong to the
 * person, not the product, so they live in the sidebar footer menu and the avatar
 * menu — but they are still searchable, which is why they are exported separately
 * and appended to the palette index.
 */
export const ACCOUNT_SECTION = {
  id: "account",
  label: "Account",
  items: [
    {
      id: "account.profile",
      label: "My Profile",
      path: "/my-profile",
      Icon: CircleUser,
      can: () => true,
    },
    {
      id: "account.company",
      label: "Company Profile",
      path: "/CompanyProfile",
      Icon: Building2,
      can: () => !isSubAgent(),
    },
    {
      id: "account.subscription",
      label: "Subscription",
      path: "/SubscriptionInfo",
      Icon: CreditCard,
      keywords: "plan billing invoice upgrade",
      can: () => !isSubAgent(),
    },
    {
      id: "account.password",
      label: "Change password",
      path: "/ChangePassword",
      Icon: Settings,
      can: () => true,
    },
  ],
};

/**
 * QUICK CREATE — every "start a new record" route in the app, in one gated list.
 *
 * One source of truth feeding two surfaces: the navbar's Quick Create menu and the
 * ⌘K palette's Actions group. Adding a create form is one entry here and it shows
 * up in both, correctly gated — the navbar menu used to hard-code two of them and
 * silently miss the other eleven.
 *
 * `group` buckets the menu so thirteen entries still scan; `sublabel` is the line
 * the palette shows beside the label. Each `can()` mirrors the Guard on the route
 * it navigates to, so the menu can never offer a page that bounces you home.
 */
export function buildQuickActions(navigate) {
  return [
    // ── Sales ────────────────────────────────────────────────────────────────
    /* One row, not two. These used to be "New enquiry · Rapid" (?mode=rapid) and "New lead — the
       full enquiry form", because /createlead had two modes. The full-details mode is retired and
       every field it owned now lives in the rapid form, so a second entry point would open the
       identical screen — and a palette that lists the same destination twice teaches the operator
       that one of the two must be doing something else. `keywords` carries the retired wording so
       searching "full" or "rapid" still lands here. */
    {
      id: "action.lead",
      group: "Sales",
      label: "New enquiry",
      sublabel: "Fast intake and quick quotation",
      Icon: Zap,
      tone: "violet",
      keywords: "create lead enquiry add fast rapid full prospect quote",
      can: () => hasPermission(P.LEAD_CREATE) && hasModule("LEADS"),
      run: () => navigate("/leads/incoming"),
    },
    // "New quotation" and "Quick quote" were both here, and both are gone.
    //
    // Neither could do anything useful from Quick Create: a quotation is ALWAYS
    // built against a lead, so opening /createquotation cold gave you an empty
    // builder with nothing selected and the first thing to do was go and find a
    // lead — the step the shortcut was supposed to save.
    //
    // The route still exists and is still the builder. It is reached the way it
    // is actually used: from a lead, or from the rapid lead form, which now
    // captures the enquiry and prices it in one pass. Start at New lead.
    {
      id: "action.customer",
      group: "Sales",
      label: "New customer",
      sublabel: "Add a traveller or client",
      Icon: UserCheck,
      tone: "teal",
      keywords: "create client add guest",
      can: () => hasPermission(P.CUSTOMER_CREATE) && hasModule("CUSTOMERS"),
      run: () => navigate("/Createcustomer"),
    },

    // ── Operations ───────────────────────────────────────────────────────────
    {
      id: "action.booking",
      group: "Operations",
      label: "New booking",
      sublabel: "Start a confirmed trip",
      Icon: CalendarPlus,
      tone: "orange",
      keywords: "create trip add confirm",
      can: () => hasPermission(P.BOOKING_CREATE) && hasModule("BOOKINGS"),
      run: () => navigate("/CreateBooking"),
    },
    {
      id: "action.vendor",
      group: "Operations",
      label: "New vendor",
      sublabel: "Add a supplier or DMC",
      Icon: Store,
      tone: "amber",
      keywords: "create supplier add dmc",
      can: () => hasPermission(P.VENDOR_CREATE) && hasModule("VENDORS"),
      run: () => navigate("/CreateVendor"),
    },
    {
      id: "action.reminder",
      group: "Operations",
      label: "New reminder",
      sublabel: "Schedule a follow-up",
      Icon: BellRing,
      tone: "rose",
      keywords: "create follow up task due",
      can: () => hasPermission(P.REMINDER_CREATE),
      run: () => navigate("/CreateReminder"),
    },
    {
      id: "action.fleet.trip",
      group: "Operations",
      label: "New trip",
      sublabel: "Vehicle Diary duty slip",
      Icon: Truck,
      tone: "sky",
      keywords: "create fleet duty slip vehicle",
      can: () => hasPermission(P.FLEET_CREATE) && hasModule("FLEET"),
      run: () => navigate("/fleet/trips/new"),
    },
    {
      id: "action.fleet.vehicle",
      group: "Operations",
      label: "New vehicle",
      sublabel: "Add a vehicle to the diary",
      Icon: Truck,
      tone: "sky",
      keywords: "create fleet car coach",
      can: () => hasPermission(P.FLEET_CREATE) && hasModule("FLEET"),
      run: () => navigate("/fleet/vehicles/new"),
    },
    {
      id: "action.fleet.driver",
      group: "Operations",
      label: "New driver",
      sublabel: "Add a driver to the diary",
      Icon: Truck,
      tone: "sky",
      keywords: "create fleet chauffeur",
      can: () => hasPermission(P.FLEET_CREATE) && hasModule("FLEET"),
      run: () => navigate("/fleet/drivers/new"),
    },

    // ── Setup ────────────────────────────────────────────────────────────────
    {
      id: "action.template",
      group: "Setup",
      label: "New package template",
      sublabel: "A reusable quotation package",
      Icon: FileText,
      tone: "emerald",
      keywords: "create package reusable saved",
      can: () => hasPermission(P.QUOTATION_CREATE) && hasModule("QUOTATIONS"),
      run: () => navigate("/quotations/templates/new"),
    },
    {
      id: "action.user",
      group: "Setup",
      label: "New user",
      sublabel: "Add a staff member",
      Icon: UserCog,
      tone: "pink",
      keywords: "create staff invite team",
      can: () => hasPermission(P.USER_CREATE),
      run: () => navigate("/CreateUser"),
    },
  ];
}

/**
 * Tile colours for the app launcher, which sits on WHITE — the rail's `-400`
 * ramp is tuned for a dark surface and reads washed out here, so light surfaces
 * get their own soft-bg / strong-fg pair rather than reusing it.
 */
export const TONE_TILE = {
  blue: "bg-blue-50 text-blue-600",
  cyan: "bg-cyan-50 text-cyan-600",
  teal: "bg-teal-50 text-teal-600",
  emerald: "bg-emerald-50 text-emerald-600",
  lime: "bg-lime-50 text-lime-600",
  yellow: "bg-amber-50 text-amber-600",
  amber: "bg-amber-50 text-amber-600",
  orange: "bg-orange-50 text-orange-600",
  rose: "bg-rose-50 text-rose-600",
  red: "bg-red-50 text-red-600",
  pink: "bg-pink-50 text-pink-600",
  fuchsia: "bg-fuchsia-50 text-fuchsia-600",
  violet: "bg-violet-50 text-violet-600",
  purple: "bg-purple-50 text-purple-600",
  indigo: "bg-indigo-50 text-indigo-600",
  sky: "bg-sky-50 text-sky-600",
  slate: "bg-slate-100 text-slate-600",
};

/** Icon accent per tone — the rail's only colour, and only when a row is idle. */
export const TONE_TEXT = {
  blue: "text-blue-400",
  cyan: "text-cyan-400",
  teal: "text-teal-400",
  emerald: "text-emerald-400",
  lime: "text-lime-400",
  yellow: "text-yellow-400",
  amber: "text-amber-400",
  orange: "text-orange-400",
  rose: "text-rose-400",
  red: "text-red-400",
  pink: "text-pink-400",
  fuchsia: "text-fuchsia-400",
  violet: "text-violet-400",
  purple: "text-purple-400",
  indigo: "text-indigo-400",
  sky: "text-sky-400",
  slate: "text-slate-400",
};
