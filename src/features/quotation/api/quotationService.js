

import API from "@shared/api/http";

// ═════════════════════════════════════════════════════════════
// PAYLOAD BUILDER
// ═════════════════════════════════════════════════════════════
export function buildQuotationPayload({
  // Basic Info
  leadId       = null,
  destinationId = null,
  title        = "Quotation",
  version      = "v1.0",
  stage        = "Draft",
  templateStyle = "CLASSIC",   // public weblink template: "CLASSIC" | "MODERN"

  // Section `*Included` defaults ab sab FALSE hain (pehle flight/hotel/sightseeing/vehicle
  // `true` the). Ye builder ke gate ke baad DOOSRI fail-open layer thi: caller agar flag
  // chhod deta to section chupke se ON ho jaata, chahe lead ne wo service chuni hi na ho.
  // Ab default = off; on karne ke liye explicit `true` bhejna padega — jo collectAllData()
  // hamesha bhejta hai. Ye clamp NAHI hai: bheja hua `true` jaisa ka waisa jaata hai.

  // Tab 1 — Flight
  flightIncluded = false,
  flightTitle    = "Flight Details",
  flightAmount   = 0,
  journey        = "Round Trip",
  segments       = [],

  // Tab 2 — Hotel
  hotelIncluded = false,
  hotelTitle    = "Hotel Details",
  hotelAmount   = 0,
  hotelNotes    = "",
  hotels        = [],

  // Tab 3 — Sightseeing
  sightseeingIncluded = false,
  sightseeingTitle    = "Sightseeing",
  sightseeingAmount   = 0,
  sightseeingNotes    = "",
  days                = [],

  // Tab 4 — Cruise
  cruiseIncluded = false,
  cruiseTitle    = "Cruise Details",
  cruiseAmount   = 0,
  cruises        = [],

  // Tab 5 — Vehicle
  vehicleIncluded = false,
  vehicleTitle    = "Vehicle Details",
  vehicleAmount   = 0,
  vehicles        = [],

  // Tab 6 — Add-on Services
  addonIncluded = false,
  addonTitle    = "Add-on Services",
  addonAmount   = 0,
  addons        = [],

  // Tab 7 — Inclusions & Exclusions
  inclusions           = [],
  exclusions           = [],
  paymentPolicies      = [],
  cancellationPolicies = [],
  bookingTerms         = [],

  // Tab 8 — Summary & Pricing
  discount = 0,
  discType = "Fixed",
  tax      = 0,
  markup   = 0,

} = {}) {  // ← default empty object — prevents crash if called with no args
  return {
    leadId,
    destinationId,
    title,
    version,
    stage,
    templateStyle,

    // ── Flight ───────────────────────────────────────────────
    flight: {
      included : flightIncluded,
      title    : flightTitle,
      amount   : Number(flightAmount) || 0,
      journey,
      segments : segments.map(seg => ({
        airline    : seg.airline   || "",
        flightNo   : seg.flightNo  || "",
        class      : seg.class     || "",
        from       : seg.from      || "",
        to         : seg.to        || "",
        depDate    : seg.depDate   || "",
        depTime    : seg.depTime   || "",
        arrDate    : seg.arrDate   || "",
        arrTime    : seg.arrTime   || "",
        duration   : seg.duration  || "",
        cabin      : Number(seg.cabin)   || 0,
        checkin    : Number(seg.checkin) || 0,
        pricePerPax: Number(seg.pricePerPax) || 0,
        pax        : Number(seg.pax)         || 1,
        connections: (seg.connections || []).map(conn => ({
          airline  : conn.airline  || "",
          flightNo : conn.flightNo || "",
          from     : conn.from     || "",
          to       : conn.to       || "",
          depDate  : conn.depDate  || "",
          depTime  : conn.depTime  || "",
          arrDate  : conn.arrDate  || "",
          arrTime  : conn.arrTime  || "",
        })),
      })),
    },

    // ── Hotel ────────────────────────────────────────────────
    hotel: {
      included : hotelIncluded,
      title    : hotelTitle,
      amount   : Number(hotelAmount) || 0,
      notes    : hotelNotes,
      hotels   : hotels.map(h => ({
        name       : h.name      || "",
        city       : h.city      || "",
        checkIn    : h.checkIn   || "",
        checkOut   : h.checkOut  || "",
        roomType   : h.roomType  || "",
        mealPlan   : h.mealPlan  || "",
        refundable : h.refundable ?? true,
        stars       : Number(h.stars)        || 0,
        pricePerRoom: Number(h.pricePerRoom) || 0,
        rooms       : Number(h.rooms)        || 1,
        imagePath   : h.imagePath || "",
      })),
    },

    // ── Sightseeing ──────────────────────────────────────────
    sightseeing: {
      included : sightseeingIncluded,
      title    : sightseeingTitle,
      amount   : Number(sightseeingAmount) || 0,
      notes    : sightseeingNotes,
      days     : days.map(d => ({
        day        : d.day  || 1,
        date       : d.date || "",
        pricePerPax: Number(d.pricePerPax) || 0,
        pax        : Number(d.pax)         || 1,
        activities : (d.activities || []).map(act => ({
          attraction  : act.attraction  || "",
          startTime   : act.startTime   || "",
          description : act.description || "",
          meals       : act.meals       || [],
          transfer    : act.transfer    || "Private",
          imagePath   : act.imagePath   || "",
        })),
      })),
    },

    // ── Cruise ───────────────────────────────────────────────
    cruise: {
      included : cruiseIncluded,
      title    : cruiseTitle,
      amount   : Number(cruiseAmount) || 0,
      cruises  : cruises.map(c => ({
        name    : c.name    || "",
        type    : c.type    || "",
        depPort : c.depPort || "",
        arrPort : c.arrPort || "",
        depDate : c.depDate || "",
        nights  : Number(c.nights) || 0,
        cabin   : c.cabin   || "",
        pricePerPax: Number(c.pricePerPax) || 0,
        pax        : Number(c.pax)         || 1,
        price      : (Number(c.pricePerPax) || 0) * (Number(c.pax) || 1),
      })),
    },

    // ── Vehicle ──────────────────────────────────────────────
    vehicle: {
      included : vehicleIncluded,
      title    : vehicleTitle,
      amount   : Number(vehicleAmount) || 0,
      vehicles : vehicles.map(v => ({
        type      : v.type      || "",
        model     : v.model     || "",
        pickup    : v.pickup    || "",
        drop      : v.drop      || "",
        startDate : v.startDate || "",
        endDate   : v.endDate   || "",
        pricePerVehicle: Number(v.pricePerVehicle) || 0,
        qty            : Number(v.qty)             || 1,
        price          : (Number(v.pricePerVehicle) || 0) * (Number(v.qty) || 1),
        capacity  : v.capacity ? Number(v.capacity) : null,
        notes     : v.notes     || "",
        imagePath : v.imagePath || v.imageUrl || "",
      })),
    },

    // ── Add-on Services ──────────────────────────────────────
    addons: {
      included : addonIncluded,
      title    : addonTitle,
      amount   : Number(addonAmount) || 0,
      items    : addons.map(a => ({
        serviceType  : a.serviceType  || "",
        description  : a.description  || "",
        quantity     : Number(a.quantity)     || 1,
        pricePerUnit : Number(a.pricePerUnit) || 0,
        included     : a.included ?? true,
      })),
    },

    // ── Inclusions & Exclusions ──────────────────────────────
    inclusions,
    exclusions,
    paymentPolicies,
    cancellationPolicies,
    bookingTerms,

    // ── Summary & Pricing ────────────────────────────────────
    pricing: {
      discount : Number(discount) || 0,
      discType : discType || "Fixed",
      tax      : Number(tax)    || 0,
      markup   : Number(markup) || 0,
    },
  };
}

// ═════════════════════════════════════════════════════════════
// QUOTATION SERVICE — API CALLS
// Note: baseURL = "http://localhost:8080/api"
//       So endpoints start with /quotations NOT /api/quotations
// ═════════════════════════════════════════════════════════════
export const quotationService = {

  // 1. CREATE — POST /quotations
  createQuotation: (tabsData) => {
    const payload = buildQuotationPayload(tabsData);
    return API.post("/quotations", payload);
  },

  // 2. UPDATE — PUT /quotations/{id}
  updateQuotation: (id, tabsData) => {
    const payload = buildQuotationPayload(tabsData);
    return API.put(`/quotations/${id}`, payload);
  },

  // 3. GET BY ID — GET /quotations/{id}
  getQuotationById: (id) => {
    return API.get(`/quotations/${id}`);
  },

  // 4. GET BY LEAD — GET /quotations/lead/{leadId}
  getQuotationsByLead: (leadId) => {
    return API.get(`/quotations/lead/${leadId}`);
  },

  // 5. GET ALL — GET /quotations?page=0&size=20
  getAllQuotations: (page = 0, size = 20) => {
    return API.get("/quotations", { params: { page, size } });
  },

  // 6. DELETE — DELETE /quotations/{id}
  deleteQuotation: (id) => {
    return API.delete(`/quotations/${id}`);
  },

  // 7. UPDATE STAGE — PATCH /quotations/{id}/stage
  // stage: "Draft" | "Sent" | "Approved" | "Rejected"
  updateStage: (id, stage) => {
    return API.patch(`/quotations/${id}/stage`, null, {
      params: { stage },
    });
  },

  // 8. DUPLICATE — POST /quotations/{id}/duplicate
  duplicateQuotation: (id) => {
    return API.post(`/quotations/${id}/duplicate`);
  },

  // 9. GENERATE PDF — GET /quotations/{id}/pdf[?style=CLASSIC|MODERN|PREMIUM]
  //
  // `style` is a ONE-OFF design override chosen in the download dialog. It is not saved: the
  // quotation keeps whatever design its share link shows. Omit it to get the saved one.
  generatePdf: (id, style) => {
    return API.get(`/quotations/${id}/pdf`, {
      responseType: "blob",
      params: style ? { style } : undefined,
    });
  },

  // 9b. SET TEMPLATE STYLE — PATCH /quotations/{id}/template-style?style=
  //
  // PERSISTS the design. Used by the share dialog, because the weblink is rendered from the stored
  // style whenever the customer opens it — unlike generatePdf's ?style=, which saves nothing.
  setTemplateStyle: (id, style) => {
    return API.patch(`/quotations/${id}/template-style`, null, { params: { style } });
  },

  // 10. SEND EMAIL — POST /quotations/{id}/send-email
  // Body: { toEmail, subject, message }
  sendEmail: (id, emailData) => {
    return API.post(`/quotations/${id}/send-email`, emailData);
  },

  // 11. GET SHARE LINK — GET /quotations/{id}/share-link
  getShareLink: (id) => {
    return API.get(`/quotations/${id}/share-link`);
  },

  // 12. WEBLINK VIEW ANALYTICS — GET /quotations/{id}/weblink-analytics
  getWeblinkAnalytics: (id) => {
    return API.get(`/quotations/${id}/weblink-analytics`);
  },
};

export default quotationService;