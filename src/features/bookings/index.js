// src/features/bookings/index.js
// Public API of the bookings feature.
// bookingService is consumed by leads, fleet, dashboard and reports.

export { default as Allbookings } from "./pages/Allbookings";
/* PROTECTED FLOW — kept on this branch's own Create Booking. See the note beside CreateBooking
   below; the two exports must stay on the same page or Create and Edit drift apart. */
export { default as EditBooking } from "./pages/CreateBookingClean";
export { default as BookingDetails } from "./pages/BookingDetails";
export { default as bookingService } from "./api/bookingService";

/* The requirement editors, shared with the LEAD form.
   "What the trip needs, not what is finally assigned" is a question the enquiry asks first and the
   booking merely inherits — a lead that already knows "1 Innova, 3 Deluxe AC" should not have to
   say it again at conversion. Exported through the index (never deep-imported) so the boundary
   rule in CLAUDE.md holds: leads reaches bookings only through its public API. */
export { VehicleRequirementRows, RoomRequirementRows } from "./components/RequirementRows";
/* Same reason, one card up: the lead form's Rapid mode renders the BOOKING's Travel Details card
   rather than a lookalike of it, so dates, pickup mode and drop are asked in one shape across both
   screens and cannot drift apart. It is fully props-driven (`form` + `setField`), so the lead
   passes a small alias proxy — the two forms name four of these fields differently (returnDate /
   departureMode / departCountry / departCity) while the option strings and every sub-field are
   already identical. */
export { default as FastTravelDetails } from "./components/FastTravelDetails";
/* And the route editor, for the same card stack. A lead's STOP is a leg's TO — nights belong to the
   arrival city on both sides — so the lead maps city/cityId onto toCity/toCityId and chains the FROM
   from the previous leg. Its saved payload is unchanged; only the editor is shared. */
export { default as RouteSegments } from "./components/RouteSegments";
export { default as BookingPayments } from "./pages/BookingPayments";
export { default as BookingServices } from "./pages/BookingServices"
export { default as DuplicateBookings } from "./pages/DuplicateBookings";
// Previous Create Booking UI is intentionally kept for reference:
// export { default as CreateBooking } from "./pages/CreateBooking";
/* PROTECTED FLOW — kept on this branch's own CreateBookingClean, deliberately.
   develop repointed this at CreateBookingEntry, the FAST_ENTRY_FORMS switcher between this page and
   CreateBookingFast. The router resolves the route through this barrel
   (`lazyPage(bookings, "CreateBooking")`), so the barrel IS the switch — keeping the page file alone
   would have protected nothing. CreateBookingEntry and CreateBookingFast are merged in and left
   unreferenced rather than deleted, so flipping this one line turns the develop behaviour back on. */
export { default as CreateBooking } from "./pages/CreateBookingClean";

// Requirement row editors, shared with the LEAD form so both screens ask for a vehicle the same
// way. Exported here rather than deep-imported: eslint no-restricted-imports blocks @features/*/*,
// and a second copy of this editor would drift from the booking one the first time either changed.
// Already exported at line 17; a second active export here causes an ESM duplicate-export error.
// export { VehicleRequirementRows, RoomRequirementRows } from "./components/RequirementRows";
export { emptyVehicleRow, emptyRoomRow } from "./lib/bookingTripModel";


