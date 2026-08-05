// src/features/vendors/index.js
// Public API of the vendors feature.

export { default as AllVendors } from "./pages/AllVendors";
export { default as CreateVendor } from "./pages/CreateVendor";
export { default as EditVendor } from "./pages/EditVendor";
export { default as VendorDetails } from "./pages/VendorDetails";

// The booking expense ledger picks its payee from the vendor master, so the service is part of this
// feature's public surface — same reason leads/index.js exports leadService. Reaching into
// ../vendors/api/vendorService directly would break the boundary rule.
export { default as vendorService } from "./api/vendorService";
