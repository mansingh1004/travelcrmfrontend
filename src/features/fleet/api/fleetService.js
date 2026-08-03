// src/services/fleetService.js
// ─────────────────────────────────────────────────────────────
// Fleet / Vehicle Diary service — Travel CRM
//
// Every call goes through the shared authenticated axios instance (`API`), so the
// JWT (and therefore the server-side TenantContext) rides along automatically.
// NO tenantId is ever sent from the client — tenant isolation is enforced server-side.
//
// All IDs in URLs / params / payloads are publicId (UUID). The internal Long id is
// never exposed by the backend and never used here.
//
// Backend base: /api/fleet/**  (envelope: ApiResponse<T> / PagedApiResponse<T>)
// ─────────────────────────────────────────────────────────────

import API from "@shared/api/http";

/* ── Envelope unwrap helpers (app idiom: res.data?.data ?? res.data) ───────── */
const pick = (res) => res?.data?.data ?? res?.data ?? null;
const pickPage = (res) => ({
  items: res?.data?.data ?? [],
  pagination: res?.data?.pagination ?? null,
});

/** Strip null / undefined / "" so we never send empty filters as query params. */
function cleanParams(params = {}) {
  const out = {};
  Object.entries(params).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== "") out[k] = v;
  });
  return out;
}

const fleetService = {
  /* ══ VEHICLES ══════════════════════════════════════════════════════════ */
  // GET /fleet/vehicles?status=&ownerType=&search=&page=&size=  → { items, pagination }
  listVehicles: ({ status, ownerType, search, page = 0, size = 10 } = {}) =>
    API.get("/fleet/vehicles", { params: cleanParams({ status, ownerType, search, page, size }) }).then(pickPage),

  // GET /fleet/vehicles/{publicId} → FleetVehicleResponseDto
  getVehicle: (publicId) => API.get(`/fleet/vehicles/${publicId}`).then(pick),

  // POST /fleet/vehicles → FleetVehicleResponseDto
  createVehicle: (body) => API.post("/fleet/vehicles", body).then(pick),

  // PUT /fleet/vehicles/{publicId} (full replace) → FleetVehicleResponseDto
  updateVehicle: (publicId, body) => API.put(`/fleet/vehicles/${publicId}`, body).then(pick),

  // PATCH /fleet/vehicles/{publicId}/status  (ON_TRIP rejected server-side)
  changeVehicleStatus: (publicId, status) =>
    API.patch(`/fleet/vehicles/${publicId}/status`, { status }).then(pick),

  // DELETE /fleet/vehicles/{publicId}  → soft-delete to Trash
  deleteVehicle: (publicId) => API.delete(`/fleet/vehicles/${publicId}`).then((r) => r?.data),

  // GET /fleet/vehicles/options?status=  → [{ publicId, label, status }]
  vehicleOptions: (status) =>
    API.get("/fleet/vehicles/options", { params: cleanParams({ status }) }).then(pick),

  // GET /fleet/vehicles/vendor-options  → active vendors for the owner link
  vendorOptions: () => API.get("/fleet/vehicles/vendor-options").then(pick),

  /* ══ DRIVERS ═══════════════════════════════════════════════════════════ */
  listDrivers: ({ status, search, page = 0, size = 10 } = {}) =>
    API.get("/fleet/drivers", { params: cleanParams({ status, search, page, size }) }).then(pickPage),

  getDriver: (publicId) => API.get(`/fleet/drivers/${publicId}`).then(pick),

  createDriver: (body) => API.post("/fleet/drivers", body).then(pick),

  updateDriver: (publicId, body) => API.put(`/fleet/drivers/${publicId}`, body).then(pick),

  changeDriverStatus: (publicId, status) =>
    API.patch(`/fleet/drivers/${publicId}/status`, { status }).then(pick),

  deleteDriver: (publicId) => API.delete(`/fleet/drivers/${publicId}`).then((r) => r?.data),

  // GET /fleet/drivers/options?status=  → [{ publicId, label, status }]
  driverOptions: (status) =>
    API.get("/fleet/drivers/options", { params: cleanParams({ status }) }).then(pick),

  /* ══ TRIPS ═════════════════════════════════════════════════════════════ */
  // GET /fleet/trips?vehicleId=&driverId=&status=&bookingId=&fromDate=&toDate=&search=&page=&size=
  listTrips: ({ vehicleId, driverId, status, bookingId, fromDate, toDate, search, page = 0, size = 10 } = {}) =>
    API.get("/fleet/trips", {
      params: cleanParams({ vehicleId, driverId, status, bookingId, fromDate, toDate, search, page, size }),
    }).then(pickPage),

  getTrip: (publicId) => API.get(`/fleet/trips/${publicId}`).then(pick),

  // POST /fleet/trips  (PLANNED, or COMPLETED when endDatetime is supplied)
  createTrip: (body) => API.post("/fleet/trips", body).then(pick),

  // PUT /fleet/trips/{publicId}  (partial — only non-null fields applied)
  updateTrip: (publicId, body) => API.put(`/fleet/trips/${publicId}`, body).then(pick),

  // PATCH /fleet/trips/{publicId}/start   body: { startOdometer, startDatetime? }
  startTrip: (publicId, body) => API.patch(`/fleet/trips/${publicId}/start`, body).then(pick),

  // PATCH /fleet/trips/{publicId}/close   body: { endOdometer, endDatetime?, fuelCost?, tollCost?, driverAllowance?, remarks? }
  closeTrip: (publicId, body) => API.patch(`/fleet/trips/${publicId}/close`, body).then(pick),

  // PATCH /fleet/trips/{publicId}/cancel  (no body)
  cancelTrip: (publicId) => API.patch(`/fleet/trips/${publicId}/cancel`).then(pick),

  deleteTrip: (publicId) => API.delete(`/fleet/trips/${publicId}`).then((r) => r?.data),

  // GET /fleet/trips/{publicId}/duty-slip — the printable paper that rides with the vehicle.
  // Printable from PLANNED onward: it goes out with blanks the driver fills in by hand.
  // Returns the Blob; pair with openBlob from @shared/lib/download.
  fetchDutySlip: (publicId) =>
    API.get(`/fleet/trips/${publicId}/duty-slip`, { responseType: "blob" }).then((r) => r.data),

  // GET /fleet/trips/{publicId}/legs — one row per vehicle+driver span. A single leg IS the
  // trip; more than one means the duty changed hands mid-journey, and these rows are the only
  // place the earlier vehicle, its odometer span and its driver survive.
  getTripLegs: (publicId) => API.get(`/fleet/trips/${publicId}/legs`).then(pick),

  // PATCH /fleet/trips/{publicId}/swap — hand a running trip to another vehicle and/or driver
  // body: { vehiclePublicId?, driverPublicId?, changeReason, atOdometer?, newStartOdometer?, at?, notes? }
  swapTrip: (publicId, body) => API.patch(`/fleet/trips/${publicId}/swap`, body).then(pick),

  // Handover reason catalogue — served, never hardcoded (same rule as expense types).
  listLegChangeReasons: () => API.get("/fleet/trips/leg-change-reasons").then(pick),

  /* ══ FUEL LOGS (nested under a vehicle) ════════════════════════════════ */
  listFuelLogs: (vehiclePublicId, { page = 0, size = 10 } = {}) =>
    API.get(`/fleet/vehicles/${vehiclePublicId}/fuel-logs`, { params: { page, size } }).then(pickPage),

  addFuelLog: (vehiclePublicId, body) =>
    API.post(`/fleet/vehicles/${vehiclePublicId}/fuel-logs`, body).then(pick),

  updateFuelLog: (publicId, body) => API.put(`/fleet/fuel-logs/${publicId}`, body).then(pick),

  deleteFuelLog: (publicId) => API.delete(`/fleet/fuel-logs/${publicId}`).then((r) => r?.data),

  /* ══ MAINTENANCE LOGS (nested under a vehicle) ═════════════════════════ */
  listMaintenanceLogs: (vehiclePublicId, { page = 0, size = 10 } = {}) =>
    API.get(`/fleet/vehicles/${vehiclePublicId}/maintenance-logs`, { params: { page, size } }).then(pickPage),

  addMaintenanceLog: (vehiclePublicId, body) =>
    API.post(`/fleet/vehicles/${vehiclePublicId}/maintenance-logs`, body).then(pick),

  updateMaintenanceLog: (publicId, body) =>
    API.put(`/fleet/maintenance-logs/${publicId}`, body).then(pick),

  deleteMaintenanceLog: (publicId) =>
    API.delete(`/fleet/maintenance-logs/${publicId}`).then((r) => r?.data),

  /* ══ EXPENSES (cost ledger) ════════════════════════════════════════════ */
  // The category catalogue + per-type form metadata. Fetched once and cached by the
  // page. The frontend deliberately keeps NO copy of the expense-type vocabulary —
  // the leads feature is the cautionary tale in this codebase, where the stage list
  // is duplicated across four files with three different memberships (one containing
  // a value that never existed in the backend enum) and the source dropdown silently
  // rewrites a lead on save because its hardcoded list is missing an option.
  listExpenseTypes: () => API.get("/fleet/expense-types").then(pick),

  // GET /fleet/expenses?vehicleId=&tripId=&driverId=&type=&paidBy=&fromDate=&toDate=
  //                    &missingReceipt=&search=&page=&size=   → { items, pagination }
  listExpenses: ({
    vehicleId, tripId, driverId, type, paidBy,
    fromDate, toDate, missingReceipt, search, page = 0, size = 20,
  } = {}) =>
    API.get("/fleet/expenses", {
      params: cleanParams({
        vehicleId, tripId, driverId, type, paidBy,
        fromDate, toDate, missingReceipt, search, page, size,
      }),
    }).then(pickPage),

  getExpense: (publicId) => API.get(`/fleet/expenses/${publicId}`).then(pick),

  // The server owns every money field: it computes baseAmount, takes fxRate from the
  // trip, derives postingDate and resolves the leg. Never send those — a rate posted
  // from a device is the same defect as posting the total, with one more multiplication.
  createExpense: (body) => API.post("/fleet/expenses", body).then(pick),

  updateExpense: (publicId, body) =>
    API.put(`/fleet/expenses/${publicId}`, body).then(pick),

  // Correction for a row that can no longer be edited (settled trip / closed period).
  // Writes an opposing row rather than mutating history.
  reverseExpense: (publicId, reason) =>
    API.post(`/fleet/expenses/${publicId}/reverse`, { reason }).then(pick),

  deleteExpense: (publicId) =>
    API.delete(`/fleet/expenses/${publicId}`).then((r) => r?.data),

  /* ══ COMPLIANCE DOCUMENTS ══════════════════════════════════════════════ */
  // Category catalogue + per-category form metadata (which owner it belongs to, whether it needs a
  // state or an exit deadline, whether it blocks by default). Fetched, never hardcoded — nineteen
  // categories with per-category rules is exactly the list that drifts if the frontend keeps a copy.
  listDocumentCategories: () => API.get("/fleet/document-categories").then(pick),

  // GET /fleet/documents?ownerType=&vehicleId=&driverId=&category=&status=&needsReview=&search=
  // status ACTIVE/EXPIRING/EXPIRED are DERIVED from the dates server-side; SUPERSEDED/REVOKED are
  // stored decisions. Sorted soonest-to-lapse.
  listDocuments: ({
    ownerType, vehicleId, driverId, category, status, needsReview, search, page = 0, size = 20,
  } = {}) =>
    API.get("/fleet/documents", {
      params: cleanParams({ ownerType, vehicleId, driverId, category, status, needsReview, search, page, size }),
    }).then(pickPage),

  listExpiringDocuments: (withinDays) =>
    API.get("/fleet/documents/expiring", { params: cleanParams({ withinDays }) }).then(pick),

  documentsForVehicle: (publicId) => API.get(`/fleet/vehicles/${publicId}/documents`).then(pick),
  documentsForDriver: (publicId) => API.get(`/fleet/drivers/${publicId}/documents`).then(pick),

  createDocument: (body) => API.post("/fleet/documents", body).then(pick),
  updateDocument: (publicId, body) => API.put(`/fleet/documents/${publicId}`, body).then(pick),

  // Renewal INSERTS a replacement and marks the original superseded — it never overwrites, because
  // the old number, authority and validity are what answer "what was valid on this past date".
  renewDocument: (publicId, body) => API.post(`/fleet/documents/${publicId}/renew`, body).then(pick),

  revokeDocument: (publicId, reason) =>
    API.post(`/fleet/documents/${publicId}/revoke`, { reason }).then(pick),

  deleteDocument: (publicId) => API.delete(`/fleet/documents/${publicId}`).then((r) => r?.data),

  // Pre-dispatch check. Pass the trip's RETURN date, not today: a permit valid tomorrow but expired
  // on day six of a Char Dham run passes every "valid now" test and still ends at a barrier.
  complianceCheck: ({ vehicleId, driverId, throughDate } = {}) =>
    API.get("/fleet/compliance-check", {
      params: cleanParams({ vehicleId, driverId, throughDate }),
    }).then(pick),

  /* ══ ATTACHMENTS (receipts, scans, signed sheets) ══════════════════════ */
  // Bytes live in Postgres and only ever travel through the authenticated /file endpoint —
  // never Cloudinary, whose URLs are public. ownerType: EXPENSE | DOCUMENT | SETTLEMENT.
  // Money-owned files (expense/settlement) additionally require FLEET_MONEY_READ server-side.
  listAttachments: (ownerType, ownerId) =>
    API.get("/fleet/attachments", { params: { ownerType, ownerId } }).then(pick),

  uploadAttachment: (ownerType, ownerId, file) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("ownerType", ownerType);
    fd.append("ownerId", ownerId);
    // 120s like the image-upload helper — a 10 MB scan on hotel wifi outlives the default 30s.
    return API.post("/fleet/attachments", fd, { timeout: 120000 }).then(pick);
  },

  // Returns the Blob; pair with openBlob/downloadBlob from @shared/lib/download.
  fetchAttachmentBlob: (publicId) =>
    API.get(`/fleet/attachments/${publicId}/file`, { responseType: "blob" }).then((r) => r.data),

  // Refused by the server once the owning money is signed — evidence is append-only from then.
  deleteAttachment: (publicId) =>
    API.delete(`/fleet/attachments/${publicId}`).then((r) => r?.data),

  /* ══ ACCOUNTING PERIODS ════════════════════════════════════════════════ */
  listPeriods: (financialYear) =>
    API.get("/fleet/periods", { params: cleanParams({ financialYear }) }).then(pick),

  closePeriod: (financialYear, month) =>
    API.post("/fleet/periods/close", { financialYear, month }).then(pick),

  reopenPeriod: (publicId, reason) =>
    API.post(`/fleet/periods/${publicId}/reopen`, { reason }).then(pick),

  /* ══ DRIVER CASH & TRIP SETTLEMENT ═════════════════════════════════════ */
  // Movement catalogue + per-direction form metadata. Fetched, never hardcoded: `signum` is what
  // decides whether a movement increases or decreases what a driver owes, so a stale frontend copy
  // would not just mislabel a dropdown — it would show the wrong sign on someone's cash.
  listCashDirections: () => API.get("/fleet/cash-directions").then(pick),

  // One movement on a driver's imprest account: advance out, cash back, customer collection,
  // deposit, recovery or adjustment. Amount is ALWAYS positive — the direction carries the sign.
  recordCash: (body) => API.post("/fleet/cash", body).then(pick),

  // Every driver's sheet for one trip — one per man on a multi-driver trip.
  listTripSettlements: (tripPublicId) =>
    API.get(`/fleet/trips/${tripPublicId}/settlements`).then(pick),

  // The unsquared worklist: whose cash is still out on the road.
  listOpenSettlements: () => API.get("/fleet/settlements/open").then(pick),

  reconcileSettlement: (tripPublicId, driverPublicId) =>
    API.post(`/fleet/trips/${tripPublicId}/settlements/${driverPublicId}/reconcile`).then(pick),

  // Refused by the server unless the cash squares to exactly zero AND the driver has acknowledged.
  settleSettlement: (tripPublicId, driverPublicId, driverAcknowledged) =>
    API.post(`/fleet/trips/${tripPublicId}/settlements/${driverPublicId}/settle`,
             { driverAcknowledged }).then(pick),

  // The printable hisaab. An unsigned sheet comes back stamped DRAFT — print it to check against
  // the cash box, sign the settled one, then photograph it back on as a SETTLEMENT attachment.
  fetchSettlementSheet: (tripPublicId, driverPublicId) =>
    API.get(`/fleet/trips/${tripPublicId}/settlements/${driverPublicId}/sheet`,
            { responseType: "blob" }).then((r) => r.data),

  /* ══ DASHBOARD ═════════════════════════════════════════════════════════ */
  getDashboard: () => API.get("/fleet/dashboard").then(pick),

  listAlerts: ({ page = 0, size = 10 } = {}) =>
    API.get("/fleet/alerts", { params: { page, size } }).then(pickPage),
};

export default fleetService;