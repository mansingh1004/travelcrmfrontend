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

/* ── Packages ─────────────────────────────────────────────────────────────────────────────────
   The third catalog, and the first that is TWO-SIDED: an agency browses ready-to-book packages
   AND authors its own, keeping them private or listing them for other agencies after review. Same
   feature folder for the same reason as transport — a tenant sees one Marketplace.

   The action that justifies this catalog on its own is `to-quotation`: a package becomes a real
   customer quotation, priced at the package rate, with the agency's markup added in the builder.
   No order, no approval queue — that is Phase 3. */
export { PackageSearch } from "./pages/PackageSearch";
export { PackageDetail } from "./pages/PackageDetail";
export { MyPackages } from "./pages/MyPackages";
export { PackageEditor } from "./pages/PackageEditor";
// Mix and match — both directions on one screen, because the agency that asks on Monday answers
// on Tuesday. See the header of MixRequests.jsx.
export { MixRequests } from "./pages/MixRequests";
export { MixRequestDetail } from "./pages/MixRequestDetail";
export { packageMarketplaceService } from "./api/packageMarketplaceService";

/* Package quotation LINKS — a second, separate document from `to-quotation` above.
   That one produces a CRM quotation the agent keeps editing in the builder. This one composes the
   package as it actually is — gallery, day plan with photographs, hotels per stop, the full rate
   card, and every tier side by side — and hands back a page the customer opens with no login.
   Both exist and neither replaces the other. Backend: packagemarketplace/quote/. */
export { PackageQuotes } from "./pages/PackageQuotes";
export { packageQuoteService, packageQuoteLink } from "./api/packageQuoteService";

/* The public submission link. No realm, no login — routed outside Layout. */
export { PublicPackageSubmitStart, PublicPackageSubmit } from "./pages/PublicPackageSubmit";

/* The customer's page behind a quotation link. No realm, no login — routed outside Layout at
   /pq/:publicId, beside the CRM quotation's /q/:publicId. */
export { default as PackageQuoteWebView } from "./pages/PackageQuoteWebView";
