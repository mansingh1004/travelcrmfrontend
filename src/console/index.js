// Public barrel for the platform console feature. The router lazy-loads named exports off this
// module (same boundary rule as the tenant features), so console internals stay private.

export { default as ConsoleLogin } from "./pages/ConsoleLogin";
export { default as ConsoleInviteAccept } from "./pages/ConsoleInviteAccept";
export { default as ConsoleLayout } from "./ConsoleLayout";
export { default as ConsoleSetup } from "./pages/ConsoleSetup";
export { default as ConsoleHome } from "./pages/ConsoleHome";
export { default as ConsolePalette } from "./pages/Palette";
export { default as ConsoleTenants } from "./pages/Tenants";
export { default as ConsoleTenantDetail } from "./pages/TenantDetail";
export { default as ConsoleBilling } from "./pages/Billing";
export { default as ConsolePlans } from "./pages/Plans";
export { default as ConsoleUpgradeRequests } from "./pages/UpgradeRequests";
export { default as ConsoleUsage } from "./pages/Usage";
export { default as ConsoleUsers } from "./pages/Users";
export { default as ConsoleSuperAdmins } from "./pages/SuperAdmins";
export { default as ConsoleFeatureFlags } from "./pages/FeatureFlags";
export { default as ConsoleGlobalConfig } from "./pages/GlobalConfig";
export { default as ConsolePlatformEmail } from "./pages/PlatformEmail";
export { default as ConsolePlatformHealth } from "./pages/PlatformHealth";
export { default as ConsoleAuditLog } from "./pages/AuditLog";
export { default as ConsoleAnnouncements } from "./pages/Announcements";
export { default as ConsoleOps } from "./pages/Ops";
export { default as ConsolePlatformHotels } from "./pages/PlatformHotels";
export { default as ConsoleHotelPartners } from "./pages/HotelPartners";
export { default as ConsoleHotelPartnerReview } from "./pages/HotelPartnerReview";
export { default as ConsoleHotelNominations } from "./pages/HotelNominations";
// The 360 shell IS the detail route now: it renders PlatformHotelDetail unchanged as its Overview
// tab and adds Photos, Calendar and Bookings beside it. The old export stays because nothing is
// gained by breaking a name other code may still reach for.
export { default as ConsoleHotelMarketplace360 } from "./pages/HotelMarketplace360";
export { default as ConsolePlatformHotelDetail } from "./pages/PlatformHotelDetail";
export { default as ConsolePlatformHotelEditor } from "./pages/PlatformHotelEditor";
export { default as ConsoleMarketplaceBookings } from "./pages/MarketplaceBookings";
export { default as ConsoleTransportRequests } from "./pages/TransportRequests";
export { default as ConsolePlatformVehicles } from "./pages/PlatformVehicles";
export { default as ConsoleTransportCommissions } from "./pages/TransportCommissions";
export { default as ConsoleMarketplaceCommissions } from "./pages/MarketplaceCommissions";
export { default as ConsoleMarketplaceOccupancy } from "./pages/MarketplaceOccupancy";
export { default as ConsoleCommercialRules } from "./pages/CommercialRules";
export { default as ConsoleMarketplaceCredit } from "./pages/MarketplaceCredit";
