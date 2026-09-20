// src/features/reports/index.js
// Public API of the reports feature.
// activityReportsService is exported for the dashboard aggregation page.

export { default as ReportsDashboard } from "./pages/ReportsDashboard";
export { default as ActivityReports } from "./pages/ActivityReports";
export { default as GeographicDistribution } from "./pages/GeographicDistribution";
export { default as FollowupReports } from "./pages/FollowupReports";
export { default as BookingRevenueAnalysis } from "./pages/BookingRevenueAnalysis";
export { default as TravelDateAnalysis } from "./pages/TravelDateAnalysis";
export { default as InternationalDomestic } from "./pages/InternationalDomestic";
export { default as activityReportsService } from "./api/activityReportsService";
