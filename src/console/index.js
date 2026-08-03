// Public barrel for the platform console feature. The router lazy-loads named exports off this
// module (same boundary rule as the tenant features), so console internals stay private.

export { default as ConsoleLogin } from "./pages/ConsoleLogin";
export { default as ConsoleInviteAccept } from "./pages/ConsoleInviteAccept";
export { default as ConsoleLayout } from "./ConsoleLayout";
export { default as ConsoleSetup } from "./pages/ConsoleSetup";
export { default as ConsoleHome } from "./pages/ConsoleHome";
export { default as ConsolePalette } from "./pages/Palette";
export { default as ConsoleTenants } from "./pages/Tenants";
export { default as ConsolePlans } from "./pages/Plans";
export { default as ConsoleUpgradeRequests } from "./pages/UpgradeRequests";
export { default as ConsoleUsage } from "./pages/Usage";
export { default as ConsoleUsers } from "./pages/Users";
export { default as ConsoleSuperAdmins } from "./pages/SuperAdmins";
export { default as ConsoleFeatureFlags } from "./pages/FeatureFlags";
export { default as ConsoleGlobalConfig } from "./pages/GlobalConfig";
export { default as ConsoleAuditLog } from "./pages/AuditLog";
export { default as ConsoleAnnouncements } from "./pages/Announcements";
export { default as ConsoleOps } from "./pages/Ops";
export { default as ConsolePlatformHotels } from "./pages/PlatformHotels";
export { default as ConsolePlatformHotelDetail } from "./pages/PlatformHotelDetail";
export { default as ConsoleMarketplaceBookings } from "./pages/MarketplaceBookings";
