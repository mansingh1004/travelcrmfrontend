// src/features/masters/index.js
// Public API of the masters feature.
// hotel/sightseeing/vehicle services are exported for the quotation tabs.

export { default as City } from "./pages/City";
export { default as Destinations } from "./pages/Destinations";
export { default as Hotel } from "./pages/Hotel";
export { default as Airline } from "./pages/Airline";
export { default as Cruise } from "./pages/Cruise";
export { default as Vehiclas } from "./pages/Vehiclas";
export { default as Sightseeing } from "./pages/Sightseeing";
export { default as AddonService } from "./pages/AddonService";
export { default as Testimonials } from "./pages/Testimonials";
export { hotelService, uploadHotelImageToCloudinary } from "./api/HotelService";
export { sightseeingService } from "./api/SightseeingService";
export { vehicleService } from "./api/VehicleService";
// The quotation builder picks cruises and airlines from the master the same way it already picks
// hotels and vehicles — and it must reach them through this index, never by deep-importing api/.
// Both carry vendorName, which is how "who are we buying this from" reaches the builder and,
// through the sold line, the operations board.
export { cruiseService, normalizeCruiseList, transformCruiseResponse } from "./api/CruiseService";
export { airlineService, normalizeAirlineList, transformAirlineResponse } from "./api/airlineService";
