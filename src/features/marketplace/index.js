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
