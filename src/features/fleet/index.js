// src/features/fleet/index.js
// Public API of the fleet feature — the ONLY entry point other code may import.
// (Routing imports pages from here; nothing outside the feature reaches into
// pages/, components/ or api/ directly.)

export { default as FleetDashboard } from "./pages/FleetDashboard";
export { default as FleetVehicles } from "./pages/FleetVehicles";
export { default as FleetVehicleForm } from "./pages/FleetVehicleForm";
export { default as FleetVehicleDetail } from "./pages/FleetVehicleDetail";
export { default as FleetDrivers } from "./pages/FleetDrivers";
export { default as FleetDriverForm } from "./pages/FleetDriverForm";
export { default as FleetDriverDetail } from "./pages/FleetDriverDetail";
export { default as FleetTrips } from "./pages/FleetTrips";
export { default as FleetTripForm } from "./pages/FleetTripForm";
export { default as FleetTripDetail } from "./pages/FleetTripDetail";
export { default as FleetExpenses } from "./pages/FleetExpenses";
export { default as FleetSettlements } from "./pages/FleetSettlements";
export { default as FleetCompliance } from "./pages/FleetCompliance";
export { default as FleetPeriods } from "./pages/FleetPeriods";

/* ── The supply side of the Transport Marketplace ─────────────────────────────────────────────
   In `fleet/`, not a feature of its own: the operator IS a Vehicle Diary tenant, and assigning a
   platform job means naming one of their own vehicles and drivers. Gated on TRANSPORT_SUPPLIER,
   which is a different module from the buying side's TRANSPORT_MARKETPLACE — an agency and an
   operator are two different customers of two different products. */
export { default as SupplierOrders } from "./pages/SupplierOrders";
export { default as SupplierListings } from "./pages/SupplierListings";
