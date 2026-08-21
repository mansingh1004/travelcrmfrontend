// src/features/bookings/index.js
// Public API of the bookings feature.
// bookingService is consumed by leads, fleet, dashboard and reports.

export { default as Allbookings } from "./pages/Allbookings";
// Create and Edit routes intentionally share the fast, mode-aware booking form page.
export { default as EditBooking } from "./pages/CreateBookingClean";
export { default as BookingDetails } from "./pages/BookingDetails";
export { default as bookingService } from "./api/bookingService";
export { default as BookingPayments } from "./pages/BookingPayments";
export { default as BookingServices } from "./pages/BookingServices"
export { default as DuplicateBookings } from "./pages/DuplicateBookings";
// Previous Create Booking UI is intentionally kept for reference:
// export { default as CreateBooking } from "./pages/CreateBooking";
export { default as CreateBooking } from "./pages/CreateBookingClean";

// Requirement row editors, shared with the LEAD form so both screens ask for a vehicle the same
// way. Exported here rather than deep-imported: eslint no-restricted-imports blocks @features/*/*,
// and a second copy of this editor would drift from the booking one the first time either changed.
export { VehicleRequirementRows, RoomRequirementRows } from "./components/RequirementRows";
export { emptyVehicleRow, emptyRoomRow } from "./lib/bookingTripModel";


