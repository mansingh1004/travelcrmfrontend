// src/features/accounting/api/accountingService.js
// ─────────────────────────────────────────────────────────────
// API client for the Accounting / GST module. One object literal, every method
// returns the raw axios promise; callers unwrap the ApiResponse envelope
// (res.data.data) and PagedApiResponse (res.data.data list + res.data.pagination).
// Backend base is VITE_API_URL (…/api); all paths are under /accounting/**.
// ─────────────────────────────────────────────────────────────
import API from "@shared/api/http";

const accountingService = {
  // ── Dashboard + reports ──────────────────────────────────────────────────
  getDashboard: (params) => API.get("/accounting/reports/dashboard", { params }),
  getPnl:       (params) => API.get("/accounting/reports/pnl", { params }),
  getGstSummary:(params) => API.get("/accounting/reports/gst-summary", { params }),
  exportLedger: (params) => API.get("/accounting/export", { params, responseType: "blob" }),

  // ── Settings + HSN/SAC rate master ───────────────────────────────────────
  getSettings:    () => API.get("/accounting/settings"),
  updateSettings: (data) => API.put("/accounting/settings", data),
  getHsnRates:    () => API.get("/accounting/hsn-rates"),
  createHsnRate:  (data) => API.post("/accounting/hsn-rates", data),
  updateHsnRate:  (publicId, data) => API.put(`/accounting/hsn-rates/${publicId}`, data),
  deleteHsnRate:  (publicId) => API.delete(`/accounting/hsn-rates/${publicId}`),

  // ── Invoices ─────────────────────────────────────────────────────────────
  getInvoices:      (page = 0, size = 20) => API.get("/accounting/invoices", { params: { page, size } }),
  getInvoice:       (publicId) => API.get(`/accounting/invoices/${publicId}`),
  getBookingInvoices:(bookingPublicId) => API.get(`/accounting/invoices/booking/${bookingPublicId}`),
  issueInvoice:     (data) => API.post("/accounting/invoices", data),
  cancelInvoice:    (publicId, reason) => API.post(`/accounting/invoices/${publicId}/cancel`, { reason }),
  generateEInvoice: (publicId) => API.post(`/accounting/invoices/${publicId}/einvoice`),
  invoicePdf:       (publicId) => API.get(`/accounting/invoices/${publicId}/pdf`, { responseType: "blob" }),

  // ── Vendor bills + TDS ───────────────────────────────────────────────────
  getVendorBills: (page = 0, size = 20) => API.get("/accounting/vendor-bills", { params: { page, size } }),
  getVendorBill:  (publicId) => API.get(`/accounting/vendor-bills/${publicId}`),
  raiseVendorBill:(data) => API.post("/accounting/vendor-bills", data),
  payVendorBill:  (publicId, data) => API.post(`/accounting/vendor-bills/${publicId}/payments`, data),
  cancelVendorBill:(publicId, reason) => API.post(`/accounting/vendor-bills/${publicId}/cancel`, { reason }),
  getTdsSummary:  (params) => API.get("/accounting/vendor-bills/tds-summary", { params }),

  /* Service lines that name a supplier and have no bill against them.
     Assigning a vendor deliberately raises no payable — this is the list that keeps that choice
     from becoming spend nobody notices until a statement arrives. */
  getUnbilledLines: (params = {}) =>
    API.get("/accounting/vendor-bills/exceptions/unbilled-lines", { params })
      .then((res) => res?.data?.data ?? []),

  /* Bills still owing on bookings that were cancelled. Nothing is auto-cancelled — whether the
     supplier keeps a retention is a conversation, and this is the list of conversations owed. */
  getCancelledBookingPayables: (params = {}) =>
    API.get("/accounting/vendor-bills/exceptions/cancelled-bookings", { params })
      .then((res) => res?.data?.data ?? []),
};

export default accountingService;