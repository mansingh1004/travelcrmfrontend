// src/features/hotels/index.js
// Public API of the Hotel Management feature — the ONLY entry point other code
// may import. Routing imports pages from here; nothing outside the feature
// reaches into pages/, components/ or api/ directly.

export { default as HotelDashboard } from "./pages/HotelDashboard";
export { default as HotelList } from "./pages/HotelList";
export { default as HotelDetails } from "./pages/HotelDetails";
export { default as RoomTypes } from "./pages/RoomTypes";
export { default as InventoryCalendar } from "./pages/InventoryCalendar";
export { default as HotelBookings } from "./pages/HotelBookings";
export { default as HotelPricing } from "./pages/HotelPricing";
export { default as HotelAmenities } from "./pages/HotelAmenities";
export { default as Housekeeping } from "./pages/Housekeeping";
export { default as HotelReports } from "./pages/HotelReports";
