// src/services/intlDomesticService.js
// ─────────────────────────────────────────────────────────────
// International vs Domestic Analysis Page — API Service
// Page: InternationalDomestic.jsx
// Backend: Java Spring Boot REST API
// Database: PostgreSQL
// Covers:
//   - Get International bookings data (panel stats + destinations)
//   - Get Domestic bookings data (panel stats + destinations)
//   - Get distribution data (donut charts: revenue % + bookings %)
//   - Get comparison summary (quick comparison panel)
//   - Export CSV
// ─────────────────────────────────────────────────────────────

// Shared axios instance (baseURL ".../api", JWT from localStorage "token", 401 handling).
import api from "@shared/api/http";

// ── FILTER PARAMS BUILDER ─────────────────────────────────────
// Strips default/empty values before sending to backend
const buildParams = (filters = {}) => {
  const params = {};
  if (filters.startDate && filters.startDate !== "")                  params.startDate = filters.startDate;
  if (filters.endDate   && filters.endDate   !== "")                  params.endDate   = filters.endDate;
  if (filters.dateType  && filters.dateType  !== "Booking Date")      params.dateType  = filters.dateType;
  if (filters.viewType  && filters.viewType  !== "Overview")          params.viewType  = filters.viewType;
  if (filters.status    && filters.status    !== "All Statuses")      params.status    = filters.status;
  return params;
};


// ═════════════════════════════════════════════════════════════
// INTERNATIONAL vs DOMESTIC SERVICE
// Spring Boot Controller: /api/reports/international-domestic
// PostgreSQL Tables: bookings, customers, leads
// ═════════════════════════════════════════════════════════════
const intlDomesticService = {

  // ── GET INTERNATIONAL PANEL DATA ───────────────────────────
  // GET /api/reports/international-domestic/international
  // @GetMapping("/api/reports/international-domestic/international")
  // public ResponseEntity<TripTypeDataDTO> getInternational(
  //     @RequestParam(required = false)              String startDate,
  //     @RequestParam(required = false)              String endDate,
  //     @RequestParam(defaultValue = "Booking Date") String dateType,
  //     @RequestParam(required = false)              String status)
  //
  // Response:
  // {
  //   totalRevenue:   0.00,
  //   totalBookings:  0,
  //   avgValue:       0.00,     // SUM(customer_amount) / COUNT(*)
  //   avgNights:      0.0,      // AVG(trip_duration)
  //   tcs:            0.00,     // SUM(tcs_amount)
  //   growthPct:      0.0,      // % change vs previous period
  //   destinations: []          // top 5 international destinations
  // }
  getInternational: (filters = {}) => {
    return api.get("/reports/international-domestic/international", {
      params: buildParams(filters),
    });
  },

 
  
  getDomestic: (filters = {}) => {
    return api.get("/reports/international-domestic/domestic", {
      params: buildParams(filters),
    });
  },

  // ── GET BOTH PANELS IN ONE CALL ────────────────────────────
  // GET /api/reports/international-domestic/all
  // @GetMapping("/api/reports/international-domestic/all")
  // public ResponseEntity<IntlDomesticResponseDTO> getAll(
  //     @RequestParam(required = false)              String startDate,
  //     @RequestParam(required = false)              String endDate,
  //     @RequestParam(defaultValue = "Booking Date") String dateType,
  //     @RequestParam(required = false)              String status)
  //
  // Preferred single call that returns both panels + distribution
  //
  // Response:
  // {
  //   international: { totalRevenue, totalBookings, avgValue, avgNights, tcs, growthPct, destinations: [] },
  //   domestic:      { totalRevenue, totalBookings, avgValue, avgNights, tcs, growthPct, destinations: [...] },
  //   distribution: {
  //     intlRevenuePct:  0,    // % of total revenue from International
  //     domRevenuePct:   100,  // % of total revenue from Domestic
  //     intlBookingsPct: 0,    // % of total bookings from International
  //     domBookingsPct:  100   // % of total bookings from Domestic
  //   }
  // }
  getAll: (filters = {}) => {
    return api.get("/reports/international-domestic/all", {
      params: buildParams(filters),
    });
  },

  // ── GET DISTRIBUTION (donut chart data) ────────────────────
  // GET /api/reports/international-domestic/distribution
  // @GetMapping("/api/reports/international-domestic/distribution")
  // public ResponseEntity<DistributionDTO> getDistribution(
  //     @RequestParam(required = false)              String startDate,
  //     @RequestParam(required = false)              String endDate,
  //     @RequestParam(defaultValue = "Booking Date") String dateType,
  //     @RequestParam(required = false)              String status)
  //
  // Response:
  // {
  //   intlRevenuePct:  0,
  //   domRevenuePct:   100,
  //   intlBookingsPct: 0,
  //   domBookingsPct:  100,
  //   totalRevenue:    197001.00,
  //   totalBookings:   2,
  //   intlRevenue:     0.00,
  //   domRevenue:      197001.00,
  //   intlBookings:    0,
  //   domBookings:     2
  // }
  getDistribution: (filters = {}) => {
    return api.get("/reports/international-domestic/distribution", {
      params: buildParams(filters),
    });
  },

  // ── GET TOP DESTINATIONS (for either type) ─────────────────
  // GET /api/reports/international-domestic/destinations
  // @GetMapping("/api/reports/international-domestic/destinations")
  // public ResponseEntity<List<DestinationDTO>> getDestinations(
  //     @RequestParam                                String tripType,
  //     @RequestParam(required = false)              String startDate,
  //     @RequestParam(required = false)              String endDate,
  //     @RequestParam(defaultValue = "Booking Date") String dateType,
  //     @RequestParam(required = false)              String status,
  //     @RequestParam(defaultValue = "5")            int    topN)
  //
  // tripType: "International" | "Domestic"
  //
  // Response:
  // [
  //   { name:"Nepal", country:"Nepal", bookings:1, revenue:610000 },
  //   { name:"Thailand", country:"Thailand", bookings:0, revenue:0 },
  // ]
  getDestinations: (tripType, filters = {}, topN = 5) => {
    return api.get("/reports/international-domestic/destinations", {
      params: { tripType, topN, ...buildParams(filters) },
    });
  },

  // ── EXPORT CSV ─────────────────────────────────────────────
  // GET /api/reports/international-domestic/export/csv
  // @GetMapping("/api/reports/international-domestic/export/csv")
  // public ResponseEntity<byte[]> exportCsv(
  //     @RequestParam(required = false)              String startDate,
  //     @RequestParam(required = false)              String endDate,
  //     @RequestParam(defaultValue = "Booking Date") String dateType,
  //     @RequestParam(required = false)              String status)
  //
  // Exports summary comparison + top destinations for both types
  // Content-Disposition: attachment; filename="intl-domestic-report-..."
  exportCsv: (filters = {}) => {
    return api.get("/reports/international-domestic/export/csv", {
      params: buildParams(filters),
      responseType: "blob",
    });
  },
};

export default intlDomesticService;
// ─────────────────────────────────────────────────────────────
