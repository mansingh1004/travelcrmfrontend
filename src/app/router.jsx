import { useState, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ScrollToTop from './ScrollToTop';
import Layout from "./Layout";
import PageLoader from "./PageLoader";
import NotFound from "./NotFound";
import RouteErrorBoundary from "./RouteErrorBoundary";
import { hasPermission, hasModule, isTenantAdmin, isSubAgent, isFleetOnly, P } from "@shared/lib/access";

/* ── Lazy route chunks (Phase 5b) ─────────────────────────────
   Each feature's pages load on first navigation, one chunk per feature.
   Pages stay behind their feature's public index — lazyPage() picks the
   named export off it, so the boundary rule still holds. */
const lazyPage = (load, name) => lazy(() => load().then((m) => ({ default: m[name] })));

const leads = () => import("@features/leads");
const AllLeads = lazyPage(leads, "AllLeads");
const CreateLead = lazyPage(leads, "CreateLead");
const EditLead = lazyPage(leads, "EditLead");
const AllLeadLogs = lazyPage(leads, "AllLeadLogs");
const LeadAlerts = lazyPage(leads, "LeadAlerts");

const AdminLogin = lazyPage(() => import("@features/auth"), "AdminLogin");

const masters = () => import("@features/masters");
const City = lazyPage(masters, "City");
const Destinations = lazyPage(masters, "Destinations");
const Hotel = lazyPage(masters, "Hotel");
const Airline = lazyPage(masters, "Airline");
const Cruise = lazyPage(masters, "Cruise");
const Vehiclas = lazyPage(masters, "Vehiclas");
const Sightseeing = lazyPage(masters, "Sightseeing");
const AddonService = lazyPage(masters, "AddonService");
const Testimonials = lazyPage(masters, "Testimonials");

const bookings = () => import("@features/bookings");
const Allbookings = lazyPage(bookings, "Allbookings");
const CreateBooking = lazyPage(bookings, "CreateBooking");
const EditBooking = lazyPage(bookings, "EditBooking");
const BookingDetails = lazyPage(bookings, "BookingDetails");
const BookingPayments = lazyPage(bookings, "BookingPayments");
const BookingServices = lazyPage(bookings, "BookingServices");
const DuplicateBookings = lazyPage(bookings, "DuplicateBookings");

const customers = () => import("@features/customers");
const AllCustomers = lazyPage(customers, "AllCustomers");
const Createcustomer = lazyPage(customers, "Createcustomer");
const EditCustomer = lazyPage(customers, "EditCustomer");
const CustomerDetails = lazyPage(customers, "CustomerDetails");

const vendors = () => import("@features/vendors");
const AllVendors = lazyPage(vendors, "AllVendors");
const CreateVendor = lazyPage(vendors, "CreateVendor");
const EditVendor = lazyPage(vendors, "EditVendor");
const VendorDetails = lazyPage(vendors, "VendorDetails");

const reminders = () => import("@features/reminders");
const mailbox = () => import("@features/mailbox");
const Reminders = lazyPage(reminders, "Reminders");
const Mailbox = lazyPage(mailbox, "Mailbox");
const CreateReminder = lazyPage(reminders, "CreateReminder");
const BookingReminders = lazyPage(reminders, "BookingReminders");
const Notifications = lazyPage(reminders, "Notifications");
const NotificationSettings = lazyPage(reminders, "NotificationSettings");

const quotation = () => import("@features/quotation");
const CreateQuotation = lazyPage(quotation, "CreateQuotation");
const PublicQuotationPage = lazyPage(quotation, "PublicQuotationPage");
const PackageTemplates = lazyPage(quotation, "PackageTemplates");
const TemplateBuilder = lazyPage(quotation, "TemplateBuilder");

const profile = () => import("@features/profile");
const Users = lazyPage(profile, "Users");
const CreateUser = lazyPage(profile, "CreateUser");
const EditUser = lazyPage(profile, "EditUser");
const UserPermissions = lazyPage(profile, "UserPermissions");
const PermissionTemplates = lazyPage(profile, "PermissionTemplates");
const CreatePermissionTemplate = lazyPage(profile, "CreatePermissionTemplate");
const CompanyProfile = lazyPage(profile, "CompanyProfile");
const ChangePassword = lazyPage(profile, "ChangePassword");

const reports = () => import("@features/reports");
const ReportsDashboard = lazyPage(reports, "ReportsDashboard");
const ActivityReports = lazyPage(reports, "ActivityReports");
const GeographicDistribution = lazyPage(reports, "GeographicDistribution");
const FollowupReports = lazyPage(reports, "FollowupReports");
const BookingRevenueAnalysis = lazyPage(reports, "BookingRevenueAnalysis");
const TravelDateAnalysis = lazyPage(reports, "TravelDateAnalysis");
const InternationalDomestic = lazyPage(reports, "InternationalDomestic");

const settings = () => import("@features/settings");
const CompanySettings = lazyPage(settings, "CompanySettings");
const EmailConfiguration = lazyPage(settings, "EmailConfiguration");
const WhatsAppConfiguration = lazyPage(settings, "WhatsAppConfiguration");
const LeadSources = lazyPage(settings, "LeadSources");

const SubscriptionInfo = lazyPage(() => import("@features/subscription"), "SubscriptionInfo");
const Dashboard = lazyPage(() => import("@features/dashboard"), "Dashboard");
const TrashPage = lazyPage(() => import("@features/trash"), "TrashPage");
const Calendar = lazyPage(() => import("@features/calendar"), "Calendar");
const AllTasks = lazyPage(() => import("@features/calendar"), "AllTasks");

// ── Platform SuperAdmin Console — SEPARATE realm (own token "sa_token", violet/dark theme) ──
const consoleFeature = () => import("@/console");
const ConsoleLogin = lazyPage(consoleFeature, "ConsoleLogin");
const ConsoleInviteAccept = lazyPage(consoleFeature, "ConsoleInviteAccept");
const ConsoleLayout = lazyPage(consoleFeature, "ConsoleLayout");
const ConsoleHome = lazyPage(consoleFeature, "ConsoleHome");
const ConsoleSetup = lazyPage(consoleFeature, "ConsoleSetup");
const ConsolePalette = lazyPage(consoleFeature, "ConsolePalette");
const ConsoleTenants = lazyPage(consoleFeature, "ConsoleTenants");
const ConsolePlans = lazyPage(consoleFeature, "ConsolePlans");
const ConsoleUpgradeRequests = lazyPage(consoleFeature, "ConsoleUpgradeRequests");
const ConsoleUsage = lazyPage(consoleFeature, "ConsoleUsage");
const ConsoleUsers = lazyPage(consoleFeature, "ConsoleUsers");
const ConsoleFeatureFlags = lazyPage(consoleFeature, "ConsoleFeatureFlags");
const ConsoleGlobalConfig = lazyPage(consoleFeature, "ConsoleGlobalConfig");
const ConsolePlatformEmail = lazyPage(consoleFeature, "ConsolePlatformEmail");
const ConsoleAuditLog = lazyPage(consoleFeature, "ConsoleAuditLog");
const ConsoleAnnouncements = lazyPage(consoleFeature, "ConsoleAnnouncements");
const ConsoleOps = lazyPage(consoleFeature, "ConsoleOps");
const ConsoleSuperAdmins = lazyPage(consoleFeature, "ConsoleSuperAdmins");
const ConsolePlatformHotels = lazyPage(consoleFeature, "ConsolePlatformHotels");
const ConsoleHotelPartners = lazyPage(consoleFeature, "ConsoleHotelPartners");
const ConsoleHotelPartnerReview = lazyPage(consoleFeature, "ConsoleHotelPartnerReview");
const ConsoleHotelNominations = lazyPage(consoleFeature, "ConsoleHotelNominations");
const ConsolePlatformHotelDetail = lazyPage(consoleFeature, "ConsolePlatformHotelDetail");
const ConsolePlatformHotelEditor = lazyPage(consoleFeature, "ConsolePlatformHotelEditor");
const ConsoleMarketplaceBookings = lazyPage(consoleFeature, "ConsoleMarketplaceBookings");
const ConsoleMarketplaceCommissions = lazyPage(consoleFeature, "ConsoleMarketplaceCommissions");
const ConsoleMarketplaceOccupancy = lazyPage(consoleFeature, "ConsoleMarketplaceOccupancy");
const ConsoleCommercialRules = lazyPage(consoleFeature, "ConsoleCommercialRules");
const ConsoleMarketplaceCredit = lazyPage(consoleFeature, "ConsoleMarketplaceCredit");

const hotelPartner = () => import("@features/hotelpartner");
const HotelPartnerRegister = lazyPage(hotelPartner, "HotelPartnerRegister");

const portal = () => import("@features/portal");
const PortalLogin = lazyPage(portal, "PortalLogin");
const PortalLayout = lazyPage(portal, "PortalLayout");
const PortalTrips = lazyPage(portal, "PortalTrips");
const PortalBookingDetail = lazyPage(portal, "PortalBookingDetail");
const PortalPayments = lazyPage(portal, "PortalPayments");
const PortalDocuments = lazyPage(portal, "PortalDocuments");
const PortalHelp = lazyPage(portal, "PortalHelp");

const subagents = () => import("@features/subagents");
const SubAgents = lazyPage(subagents, "SubAgents");
const SubAgentRollup = lazyPage(subagents, "SubAgentRollup");
const MyProfile = lazyPage(subagents, "MyProfile");
const MyCommission = lazyPage(subagents, "MyCommission");

const fleet = () => import("@features/fleet");
const FleetDashboard = lazyPage(fleet, "FleetDashboard");
const FleetVehicles = lazyPage(fleet, "FleetVehicles");
const FleetVehicleForm = lazyPage(fleet, "FleetVehicleForm");
const FleetVehicleDetail = lazyPage(fleet, "FleetVehicleDetail");
const FleetDrivers = lazyPage(fleet, "FleetDrivers");
const FleetDriverForm = lazyPage(fleet, "FleetDriverForm");
const FleetDriverDetail = lazyPage(fleet, "FleetDriverDetail");
const FleetTrips = lazyPage(fleet, "FleetTrips");
const FleetTripForm = lazyPage(fleet, "FleetTripForm");
const FleetTripDetail = lazyPage(fleet, "FleetTripDetail");
const FleetExpenses = lazyPage(fleet, "FleetExpenses");
const FleetSettlements = lazyPage(fleet, "FleetSettlements");
const FleetCompliance = lazyPage(fleet, "FleetCompliance");
const FleetPeriods = lazyPage(fleet, "FleetPeriods");

const accounting = () => import("@features/accounting");
const AccountingDashboard = lazyPage(accounting, "AccountingDashboard");
const Invoices = lazyPage(accounting, "Invoices");
const VendorBills = lazyPage(accounting, "VendorBills");
const AccountingReports = lazyPage(accounting, "AccountingReports");
const AccountingSettings = lazyPage(accounting, "AccountingSettings");

const marketing = () => import("@features/marketing");
const MarketingDashboard = lazyPage(marketing, "MarketingDashboard");
const Segments = lazyPage(marketing, "Segments");
const Campaigns = lazyPage(marketing, "Campaigns");
const DripSequences = lazyPage(marketing, "DripSequences");
const Automations = lazyPage(marketing, "Automations");

// ── Hotel Marketplace — the tenant's view of the platform hotel catalog ──
// Replaces the former "Hotel Management" feature, which was a fully-mocked PMS (occupancy, ADR,
// housekeeping, channel manager) with no backend at all. Its supply-side screens now live in the
// SuperAdmin console, where the catalog is actually owned; what a TENANT needs is only this:
// browse the catalog, import a hotel into its own Hotel Master, and request a booking through the
// platform. Requesting is as far as a tenant goes — only a SuperAdmin approval confirms a hotel.
const marketplace = () => import("@features/marketplace");
const MarketplaceSearch = lazyPage(marketplace, "MarketplaceSearch");
const MarketplaceHotel = lazyPage(marketplace, "MarketplaceHotel");
const MarketplaceBookingRequest = lazyPage(marketplace, "MarketplaceBookingRequest");
const MarketplaceBookings = lazyPage(marketplace, "MarketplaceBookings");
const MarketplaceBookingDetail = lazyPage(marketplace, "MarketplaceBookingDetail");


// Route-level guard (defense-in-depth; backend is the real gate, menus already hide these).
function Guard({ allow, children }) {
  return allow ? children : <Navigate to="/" replace />;
}


const AppRouter = () => {
  // ✅ FIX: Check localStorage right away so the app remembers the user on refresh.
  // The '!!' converts a found token string to true, and a null result to false.
  const [isAuthenticated, setIsAuthenticated] = useState(() =>
    !!localStorage.getItem("token")
  );

  return (
    <BrowserRouter>
      <ScrollToTop />
      <RouteErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>

            {/* Login */}
            <Route
              path="/login"
              element={
                isAuthenticated ? (
                  <Navigate to={isFleetOnly() ? "/fleet" : "/Dashboard"} replace />
                ) : (
                  <AdminLogin setIsAuthenticated={setIsAuthenticated} />
                )
              }
            />

            {/* Public quotation web view (no auth) — shareable /q/{publicId} link */}
            <Route path="/q/:publicId" element={<PublicQuotationPage />} />

            {/* ── Hotel Partner self-registration — SEPARATE realm, no login ────
            A hotel owner opens an emailed link; the token in the path IS the
            credential and is re-verified server-side on every call. Must stay a
            TOP-LEVEL route: anything nested under "/" renders <Layout/>, which
            redirects an unauthenticated visitor to /login. */}
            <Route path="/hotel-partner/register/:token" element={<HotelPartnerRegister />} />

            {/* ── Customer-facing Traveler Portal — SEPARATE realm ──────────────
            Own token ("travelerToken"), own OTP login, no staff chrome. The
            PortalLayout self-guards (no token → /portal/login). */}
            <Route path="/portal/login" element={<PortalLogin />} />
            <Route path="/portal" element={<PortalLayout />}>
              <Route index element={<PortalTrips />} />
              <Route path="bookings/:publicId" element={<PortalBookingDetail />} />
              <Route path="payments" element={<PortalPayments />} />
              <Route path="documents" element={<PortalDocuments />} />
              <Route path="help" element={<PortalHelp />} />
            </Route>

            {/* ── Platform SuperAdmin Console — SEPARATE realm ───────────────────
            Own token ("sa_token"), own login, violet/slate theme (light+dark).
            ConsoleLayout self-guards (no sa_token → /superadmin/login).
            /console/login is the retired route, kept as a redirect for bookmarks. */}
            <Route path="/superadmin/login" element={<ConsoleLogin />} />
            <Route path="/superadmin/invite" element={<ConsoleInviteAccept />} />
            <Route path="/console/login" element={<Navigate to="/superadmin/login" replace />} />
            <Route path="/console" element={<ConsoleLayout />}>
              <Route index element={<ConsoleHome />} />
              <Route path="setup" element={<ConsoleSetup />} />
              <Route path="tenants" element={<ConsoleTenants />} />
              <Route path="plans" element={<ConsolePlans />} />
              <Route path="upgrade-requests" element={<ConsoleUpgradeRequests />} />
              <Route path="usage" element={<ConsoleUsage />} />
              <Route path="users" element={<ConsoleUsers />} />
              <Route path="feature-flags" element={<ConsoleFeatureFlags />} />
              <Route path="config" element={<ConsoleGlobalConfig />} />
              <Route path="platform-email" element={<ConsolePlatformEmail />} />
              <Route path="audit" element={<ConsoleAuditLog />} />
              <Route path="announcements" element={<ConsoleAnnouncements />} />
              <Route path="ops" element={<ConsoleOps />} />
              <Route path="superadmins" element={<ConsoleSuperAdmins />} />
              {/* Platform hotel catalog — the supply side. Owned here, not by any tenant. */}
              <Route path="hotel-partners" element={<ConsoleHotelPartners />} />
              {/* Reviewing a submission is a PAGE, not the slide-over it used to be. A hotel carries
                  identity, location, policies, photos, rooms, meal plans and rates; at max-w-xl the
                  old drawer showed 28 of 55 fields and the decision to publish was taken on half the
                  payload. A route also makes the review shareable and openable in a second tab,
                  which is what comparing against a duplicate actually needs. */}
              <Route path="hotel-partners/:publicId" element={<ConsoleHotelPartnerReview />} />
              <Route path="hotel-nominations" element={<ConsoleHotelNominations />} />
              <Route path="hotel-catalog" element={<ConsolePlatformHotels />} />
              {/* new BEFORE :publicId, or "new" is read as an id and the editor never renders. */}
              <Route path="hotel-catalog/new" element={<ConsolePlatformHotelEditor />} />
              <Route path="hotel-catalog/:publicId/edit" element={<ConsolePlatformHotelEditor />} />
              <Route path="hotel-catalog/:publicId" element={<ConsolePlatformHotelDetail />} />
              {/* The approval queue. Only a decision taken here can confirm a tenant's hotel. */}
              <Route path="hotel-requests" element={<ConsoleMarketplaceBookings />} />
              {/*
                What the platform has SOLD, night by night — not what is available. There is no
                allotment to report on; this is the exposure the operator already carries.
              */}
              <Route path="hotel-occupancy" element={<ConsoleMarketplaceOccupancy />} />
              {/*
                ⚠ The platform's margin structure, and its tenant credit ledger. SuperAdmin realm
                only — a tenant who could read a commercial rule could compute the platform's cut on
                every booking against that hotel.
              */}
              <Route path="hotel-pricing" element={<ConsoleCommercialRules />} />
              <Route path="hotel-credit" element={<ConsoleMarketplaceCredit />} />
              {/* The platform earning ledger — append-only, and SuperAdmin-only by construction. */}
              <Route path="hotel-commissions" element={<ConsoleMarketplaceCommissions />} />
              <Route path="palette" element={<ConsolePalette />} />
            </Route>

            {/* Protected Routes */}
            <Route
              path="/"
              element={
                isAuthenticated ? (
                  <Layout />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            >

              {/* Landing. A fleet-only session goes straight to the Vehicle Diary: the CRM dashboard
              aggregates leads, bookings and quotations, so for that tenant it is a screen whose
              every call 403s. isFleetOnly() fails CLOSED, so a CRM user with a cold cache still
              lands here. */}
              {/* Landing. Login navigates to "/", so this route — not "/Dashboard" — is what a
              session actually lands on, and it must apply the SAME rules as the menu.

              A sub-agent gets /allleads, not the Dashboard: the "/Dashboard" route below is
              `Guard allow={!isSubAgent()}` and navConfig hides the row on the same key, but the
              index route bypassed both, so a B2B partner landed on the tenant-wide dashboard every
              login. It is a redirect and not a <Guard> because Guard's own fallback is "/" — which
              from the index route would loop forever. Sub-agents hold LEAD_READ by default.  */}
              <Route
                index
                element={
                  isFleetOnly() ? <Navigate to="/fleet" replace />
                    : isSubAgent() ? <Navigate to="/allleads" replace />
                    : <Dashboard />
                }
              />


              <Route path="allleads" element={<AllLeads />} />

              {/* Incoming Leads — the claim window. Guarded on LEAD_READ; the page itself also renders
              <AccessDenied/> on the same key, so a direct URL never shows a bare screen. */}
              <Route
                path="leads/incoming"
                element={
                  <Guard allow={hasPermission(P.LEAD_READ)}>
                    <LeadAlerts />
                  </Guard>
                }
              />

              {/* Create Lead Route */}
              <Route path="createlead" element={<Guard allow={hasPermission(P.LEAD_CREATE)}><CreateLead /></Guard>} />
              <Route path="masters/city" element={<City />} />
              <Route path="masters/destinations" element={<Destinations />} />
              <Route path="Allbookings" element={<Allbookings />} />
              <Route path="CreateBooking" element={<Guard allow={hasPermission(P.BOOKING_CREATE)}><CreateBooking /></Guard>} />
              <Route path="CreateBooking/:leadId" element={<Guard allow={hasPermission(P.BOOKING_CREATE)}><CreateBooking /></Guard>} />
              {/* Guarded on BOOKING_CANCEL, which is what the resolve endpoint needs — the page is
                  useless to anyone who can only look at it. The service additionally demands
                  BOOKING_REFUND, and the page says so rather than failing at the button. */}
              <Route path="DuplicateBookings" element={<Guard allow={hasPermission(P.BOOKING_CANCEL)}><DuplicateBookings /></Guard>} />
              <Route path="masters/hotels" element={<Hotel />} />
              <Route path="masters/airlines" element={<Airline />} />
              <Route path="masters/cruises" element={<Cruise />} />
              <Route path="Createcustomer" element={<Createcustomer />} />
              <Route path="masters/vehicles" element={<Vehiclas />} />
              <Route path="masters/sightseeing" element={<Sightseeing />} />
              <Route path="masters/add-on-services" element={<AddonService />} />
              <Route path="masters/testimonials" element={<Testimonials />} />
              <Route path="AllVendors" element={<AllVendors />} />
              <Route path="CreateVendor" element={<CreateVendor />} />
              <Route path="Reminders" element={<Reminders />} />
              <Route path="Mailbox" element={<Guard allow={hasPermission(P.COMM_READ) && hasModule("COMMUNICATION")}><Mailbox /></Guard>} />
              {/* Task & Team Calendar (gated by TASK_READ; sub-agents get a row-scoped personal calendar) */}
              <Route path="calendar" element={<Guard allow={hasPermission(P.TASK_READ)}><Calendar /></Guard>} />
              {/* All Tasks list — same TASK_READ gate and the same TASKS module as the calendar.
              Rows are scoped per caller by the backend, so a sub-agent sees their own slice. */}
              <Route path="tasks" element={<Guard allow={hasPermission(P.TASK_READ)}><AllTasks /></Guard>} />

              <Route path="createquotation" element={<Guard allow={(hasPermission(P.QUOTATION_CREATE) || hasPermission(P.QUOTATION_UPDATE)) && hasPermission(P.LEAD_READ)}><CreateQuotation /></Guard>} />
              {/*
                The standalone /quick-quote page is retired. Pricing now happens inside the rapid
                lead form, which captures the enquiry and prices it in one pass; a separate route
                onto the same accordion with no lead attached was a slower way to the same screen.

                The MODULE is very much alive — CreateLead hosts the builder inline and imports
                quickQuotePayload/Totals/Steps/Completion from it through the quotation barrel. Do
                not delete QuickQuotation.jsx while trimming this route.
              */}
              {/* Package templates — gated by QUOTATION_* (page also self-checks). */}
              <Route path="quotations/templates" element={<Guard allow={hasPermission(P.QUOTATION_READ)}><PackageTemplates /></Guard>} />
              <Route path="quotations/templates/new" element={<Guard allow={hasPermission(P.QUOTATION_CREATE)}><TemplateBuilder /></Guard>} />
              <Route path="quotations/templates/:publicId/edit" element={<Guard allow={hasPermission(P.QUOTATION_UPDATE)}><TemplateBuilder /></Guard>} />
              <Route path="CreateReminder" element={<CreateReminder />} />
              <Route path="BookingReminders" element={<BookingReminders />} />
              <Route path="Notifications" element={<Notifications />} />
              <Route path="NotificationSettings" element={<NotificationSettings />} />
              <Route path="CompanyProfile" element={<Guard allow={!isSubAgent()}><CompanyProfile /></Guard>} />
              <Route path="ChangePassword" element={<ChangePassword />} />
              <Route path="Users" element={<Guard allow={hasPermission(P.USER_READ)}><Users /></Guard>} />
              <Route path="CreateUser" element={<Guard allow={hasPermission(P.USER_CREATE)}><CreateUser /></Guard>} />
              <Route path="EditUser/:id" element={<Guard allow={hasPermission(P.USER_UPDATE)}><EditUser /></Guard>} />
              <Route path="UserPermissions/:id" element={<Guard allow={hasPermission(P.USER_UPDATE)}><UserPermissions /></Guard>} />
              {/* Template "Edit Permissions" reuses the same grid editor in template mode. */}
              <Route path="UserPermissions/template/:id" element={<Guard allow={hasPermission(P.USER_UPDATE)}><UserPermissions /></Guard>} />
              <Route path="AllCustomers" element={<AllCustomers />} />
              <Route path="PermissionTemplates" element={<Guard allow={hasPermission(P.USER_READ)}><PermissionTemplates /></Guard>} />
              <Route path="CreatePermissionTemplate" element={<Guard allow={hasPermission(P.USER_UPDATE)}><CreatePermissionTemplate /></Guard>} />
              <Route path="ReportsDashboard" element={<ReportsDashboard />} />
              <Route path="ActivityReports" element={<ActivityReports />} />
              <Route path="GeographicDistribution" element={<GeographicDistribution />} />
              <Route path="FollowupReports" element={<FollowupReports />} />
              <Route path="BookingRevenueAnalysis" element={<BookingRevenueAnalysis />} />
              <Route path="TravelDateAnalysis" element={<TravelDateAnalysis />} />
              <Route path="InternationalDomestic" element={<InternationalDomestic />} />
              {/* /LeadLogs and /AddLeadLog are gone: they duplicated the AddLogModal / LogsModal
              popups and had drifted out of sync (the add page never persisted a log). Both the
              leads grid and the lead-logs summary now open those modals in place. */}
              <Route path="AllLeadLogs" element={<AllLeadLogs />} />
              <Route path="CompanySettings" element={<Guard allow={hasPermission(P.SETTINGS_MANAGE)}><CompanySettings /></Guard>} />
              <Route path="EmailConfiguration" element={<Guard allow={hasPermission(P.SETTINGS_MANAGE)}><EmailConfiguration /></Guard>} />
              <Route path="WhatsAppConfiguration" element={<Guard allow={hasPermission(P.SETTINGS_MANAGE)}><WhatsAppConfiguration /></Guard>} />
              <Route path="LeadSources" element={<Guard allow={hasPermission(P.SETTINGS_MANAGE)}><LeadSources /></Guard>} />
              <Route path="SubscriptionInfo" element={<Guard allow={!isSubAgent()}><SubscriptionInfo /></Guard>} />
              <Route path="Dashboard" element={<Guard allow={!isSubAgent()}><Dashboard /></Guard>} />
              <Route path="trash" element={<Guard allow={hasPermission(P.TRASH_VIEW)}><TrashPage /></Guard>} />
              <Route path="/EditVendor/:id" element={<EditVendor />} />
              <Route path="/EditCustomer/:id" element={<EditCustomer />} />
              <Route path="/EditLead/:id" element={<EditLead />} />
              <Route path="/EditBooking/:id" element={<EditBooking />} />
              {/* /WhatsAppPanel removed: WhatsAppPanel is a MODAL driven by a `lead` prop
              (rendered from AllLeads). As a route it got lead === undefined and rendered
              "Chat with Lead ()" with an empty wa.me link and an onClose that was not a
              function. Nothing navigated to it. */}

              {/* ── Fleet / Vehicle Diary (guarded by FLEET_* permissions) ── */}
              <Route path="fleet" element={<Guard allow={hasPermission(P.FLEET_READ)}><FleetDashboard /></Guard>} />
              <Route path="fleet/vehicles" element={<Guard allow={hasPermission(P.FLEET_READ)}><FleetVehicles /></Guard>} />
              <Route path="fleet/vehicles/new" element={<Guard allow={hasPermission(P.FLEET_CREATE)}><FleetVehicleForm /></Guard>} />
              <Route path="fleet/vehicles/:publicId" element={<Guard allow={hasPermission(P.FLEET_READ)}><FleetVehicleDetail /></Guard>} />
              <Route path="fleet/vehicles/:publicId/edit" element={<Guard allow={hasPermission(P.FLEET_UPDATE)}><FleetVehicleForm /></Guard>} />
              <Route path="fleet/drivers" element={<Guard allow={hasPermission(P.FLEET_READ)}><FleetDrivers /></Guard>} />
              <Route path="fleet/drivers/new" element={<Guard allow={hasPermission(P.FLEET_CREATE)}><FleetDriverForm /></Guard>} />
              <Route path="fleet/drivers/:publicId/edit" element={<Guard allow={hasPermission(P.FLEET_UPDATE)}><FleetDriverForm /></Guard>} />
              {/* Declared AFTER /edit so the literal segment is matched first — a bare :publicId route
              placed above would swallow "…/edit" as an id. */}
              <Route path="fleet/drivers/:publicId" element={<Guard allow={hasPermission(P.FLEET_READ)}><FleetDriverDetail /></Guard>} />
              <Route path="fleet/trips" element={<Guard allow={hasPermission(P.FLEET_READ)}><FleetTrips /></Guard>} />
              {/* Money, so gated on FLEET_MONEY_READ rather than FLEET_READ — a dispatcher may run the
              diary all day without seeing cost structure or driver cash positions. */}
              <Route path="fleet/expenses" element={<Guard allow={hasPermission(P.FLEET_MONEY_READ)}><FleetExpenses /></Guard>} />
              <Route path="fleet/settlements" element={<Guard allow={hasPermission(P.FLEET_MONEY_READ)}><FleetSettlements /></Guard>} />
              {/* Viewing month locks is money structure; the close/reopen BUTTONS additionally need
              FLEET_PERIOD_CLOSE, which the page checks itself. */}
              <Route path="fleet/periods" element={<Guard allow={hasPermission(P.FLEET_MONEY_READ)}><FleetPeriods /></Guard>} />
              {/* Operational, not money — a dispatcher records a renewed insurance policy. */}
              <Route path="fleet/compliance" element={<Guard allow={hasPermission(P.FLEET_READ)}><FleetCompliance /></Guard>} />
              <Route path="fleet/trips/new" element={<Guard allow={hasPermission(P.FLEET_CREATE)}><FleetTripForm /></Guard>} />
              <Route path="fleet/trips/:publicId" element={<Guard allow={hasPermission(P.FLEET_READ)}><FleetTripDetail /></Guard>} />
              <Route path="fleet/trips/:publicId/edit" element={<Guard allow={hasPermission(P.FLEET_UPDATE)}><FleetTripForm /></Guard>} />

              {/* ── Accounting / GST (guarded by ACCOUNTING_* permissions; TENANT_ADMIN sees all) ── */}
              <Route path="accounting" element={<Guard allow={hasPermission(P.ACCOUNTING_INVOICE_READ)}><AccountingDashboard /></Guard>} />
              <Route path="accounting/invoices" element={<Guard allow={hasPermission(P.ACCOUNTING_INVOICE_READ)}><Invoices /></Guard>} />
              <Route path="accounting/vendor-bills" element={<Guard allow={hasPermission(P.ACCOUNTING_TDS_READ)}><VendorBills /></Guard>} />
              <Route path="accounting/reports" element={<Guard allow={hasPermission(P.ACCOUNTING_INVOICE_READ)}><AccountingReports /></Guard>} />
              <Route path="accounting/settings" element={<Guard allow={hasPermission(P.ACCOUNTING_SETTINGS_MANAGE)}><AccountingSettings /></Guard>} />

              {/* ── Marketing & Campaigns (guarded by MARKETING_* permissions; TENANT_ADMIN sees all) ── */}
              <Route path="marketing" element={<Guard allow={hasPermission(P.MARKETING_READ)}><MarketingDashboard /></Guard>} />
              <Route path="marketing/segments" element={<Guard allow={hasPermission(P.MARKETING_READ)}><Segments /></Guard>} />
              <Route path="marketing/campaigns" element={<Guard allow={hasPermission(P.MARKETING_READ)}><Campaigns /></Guard>} />
              <Route path="marketing/drips" element={<Guard allow={hasPermission(P.MARKETING_READ)}><DripSequences /></Guard>} />
              <Route path="marketing/automations" element={<Guard allow={hasPermission(P.MARKETING_READ)}><Automations /></Guard>} />

              {/* ── Hotel Marketplace (tenant side of the platform catalog) ──
              Guarded on HOTEL_MARKETPLACE_VIEW. The module entitlement is the real gate and it is
              enforced server-side by ModuleAccessFilter — a tenant without the add-on gets
              MODULE_NOT_ENABLED whatever the router lets them reach. */}
              <Route path="marketplace" element={<Guard allow={hasPermission(P.HOTEL_MARKETPLACE_VIEW)}><MarketplaceSearch /></Guard>} />
              {/* Declared before ":publicId" for readability; route ranking would prefer the static
              "bookings" segment over the dynamic one regardless of order. */}
              <Route path="marketplace/bookings" element={<Guard allow={hasPermission(P.HOTEL_MARKETPLACE_VIEW)}><MarketplaceBookings /></Guard>} />
              <Route path="marketplace/bookings/:publicId" element={<Guard allow={hasPermission(P.HOTEL_MARKETPLACE_VIEW)}><MarketplaceBookingDetail /></Guard>} />
              <Route path="marketplace/:publicId" element={<Guard allow={hasPermission(P.HOTEL_MARKETPLACE_VIEW)}><MarketplaceHotel /></Guard>} />
              {/* Requesting is a stronger act than browsing — it puts a payable on the tenant's books —
              so it gates on BOOK, not VIEW. More specific path, so route ranking picks it over
              ":publicId" regardless of declaration order. */}
              <Route path="marketplace/:publicId/request" element={<Guard allow={hasPermission(P.HOTEL_MARKETPLACE_BOOK)}><MarketplaceBookingRequest /></Guard>} />

              {/* ── Sub-Agents (B2B franchise) — TENANT_ADMIN only ── */}
              <Route path="subagents" element={<Guard allow={isTenantAdmin()}><SubAgents /></Guard>} />
              <Route path="subagents/rollup" element={<Guard allow={isTenantAdmin()}><SubAgentRollup /></Guard>} />

              {/* ── Self-service: personal profile (any user) + a sub-agent's own commission ── */}
              <Route path="my-profile" element={<MyProfile />} />
              <Route path="my-commission" element={<Guard allow={isSubAgent()}><MyCommission /></Guard>} />

              <Route path="BookingDetails/:id" element={<BookingDetails />} />
              <Route path="/BookingPayments/:id" element={<BookingPayments />} />
              <Route path="/BookingServices/:id" element={<BookingServices />} />
              <Route path="/CustomerDetails/:id" element={<CustomerDetails />} />
              <Route path="/VendorDetails/:id" element={<VendorDetails />} />

              {/* Catch-all — MUST stay last. Without it an unmatched URL matched no branch and
              React Router rendered null: a bare white document with no chrome (RouteErrorBoundary
              only catches throws, not non-matches). Inside <Layout/> so the rail and ⌘K survive. */}
              <Route path="*" element={<NotFound />} />

            </Route>

          </Routes>
        </Suspense>
      </RouteErrorBoundary>
    </BrowserRouter>
  );
};

export default AppRouter;
