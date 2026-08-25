// src/features/marketplace/index.js
//
// Public API of the Hotel Marketplace feature — the tenant's view of the SuperAdmin-owned platform
// hotel catalog. The ONLY entry point other code may import; the router lazy-loads these named
// exports and nothing outside the feature reaches into pages/ or api/.
//
// Replaces the former `features/hotels` module, which was a fully-mocked hotel PMS with no backend.
// Its supply-side screens (catalog, rooms, inventory, pricing) now live in the SuperAdmin console,
// where the catalog is actually owned.

export { MarketplaceSearch } from "./pages/MarketplaceSearch";
export { MarketplaceHotel } from "./pages/MarketplaceHotel";
export { MarketplaceBookingRequest } from "./pages/MarketplaceBookingRequest";
export { MarketplaceBookings } from "./pages/MarketplaceBookings";
export { MarketplaceBookingDetail } from "./pages/MarketplaceBookingDetail";

// Exported because a later phase (booking a marketplace hotel from a quotation) will need it from
// outside this feature; keeping it on the barrel is what stops that code deep-importing api/.
export { marketplaceService } from "./api/marketplaceService";

/* ── Transport ────────────────────────────────────────────────────────────────────────────────
   The same feature, a second platform catalog. Deliberately NOT its own feature folder: a tenant
   sees ONE Marketplace with stays and cars in it, and splitting them would fork `marketplaceUi`
   into two kits that drift. The backend keeps them apart (`hotelmarketplace` / `transportmarketplace`)
   because they are separately subscribable add-ons; that boundary is an entitlement one, not a
   visual one, and it is enforced by permissions and ModuleAccessFilter rather than by folders. */
export { TransportSearch } from "./pages/TransportSearch";
export { TransportRequest } from "./pages/TransportRequest";
export { TransportOrders } from "./pages/TransportOrders";
export { transportMarketplaceService } from "./api/transportMarketplaceService";
