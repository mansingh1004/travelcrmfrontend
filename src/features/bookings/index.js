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
// Previous Create Booking UI is intentionally kept for reference:
// export { default as CreateBooking } from "./pages/CreateBooking";
export { default as CreateBooking } from "./pages/CreateBookingClean";

