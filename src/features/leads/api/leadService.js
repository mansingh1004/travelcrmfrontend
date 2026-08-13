// import API from "@shared/api/http";

// // ── Transformer: React form → Backend DTO ────────────────
// function transformFormData(formData, services = [], itinerary = []) {
//   return {
//     customerName:   formData.customerName?.trim()  || "",
//     phone:          formData.phone?.trim()          || "",
//     email:          formData.email?.trim()          || "",
//     leadSource:     formData.leadSource             || "",
//     leadType:       formData.leadType               || "",
//     leadStage:      formData.leadStage              || "",
//     assignedUserId: formData.assignedUserId         || null,
//     birthDate:      formData.birthDate              || null,
//     travelDate:     formData.travelDate             || null,
//     departCountry:  formData.departCountry          || "Not Specified",
//     departCity:     formData.departCity             || "Not Specified",
//     rooms:          Number(formData.rooms)          || 1,
//     // adults = male + female (TravelDetails derive karke form mein set karta hai).
//     // Backend mein abhi male/female/handicap columns nahi hain, isliye unhe bhejte
//     // nahi — sirf total adults jaata hai. Backend ready hone par yahan add karo:
//     //   male:      Number(formData.male)      || 0,
//     //   female:    Number(formData.female)    || 0,
//     //   handicap:  Number(formData.handicap)  || 0,
//     adults:         Number(formData.adults)         || 1,
//     children:       Number(formData.children)       || 0,
//     infants:        Number(formData.infants)        || 0,
//     extraBeds:      Number(formData.extraBeds)      || 0,
//     budget:         formData.budget != null && formData.budget !== ""
//                       ? Number(formData.budget)
//                       : null,
//     notes:          formData.notes?.trim()          || "",
//     services:       Array.isArray(services) ? services : [],
//     itinerary: (Array.isArray(itinerary) ? itinerary : []).map(
//       ({ destination, city, nights }, index) => ({
//         destination: destination?.trim() || "",
//         city:        city?.trim()        || "",
//         nights:      Number(nights)      || 0,
//         dayNumber:   index + 1,
//       })
//     ),
//   };
// }

// export const leadService = {

//   // ── CREATE ────────────────────────────────────────────────
//   createLead: (formData, services, itinerary) =>
//     API.post("/leads", transformFormData(formData, services, itinerary)),

//   // ── GET ALL ───────────────────────────────────────────────
//   getAllLeads: (page = 0, size =100) =>
//     API.get(`/leads?page=${page}&size=${size}`),

//   // ── GET BY PUBLIC ID ──────────────────────────────────────
//   // CreateQuotation.jsx mein leadId se lead data fetch karne ke liye
//   // URL: GET /api/leads/{publicId}
//   getLeadById: (publicId) =>
//     API.get(`/leads/${publicId}`),

//   // ── UPDATE ────────────────────────────────────────────────
//   updateLead: (publicId, formData, services, itinerary) =>
//     API.put(`/leads/${publicId}`, transformFormData(formData, services, itinerary)),

//   // ── DELETE ────────────────────────────────────────────────
//   deleteLead: (publicId) =>
//     API.delete(`/leads/${publicId}`),

//   // ── ADD LOG ───────────────────────────────────────────────
//   // POST /api/leads/{publicId}/logs — records an activity log for this lead,
//   // optionally creating a follow-up reminder. Comment must be >= 5 chars.
//   addLog: (publicId, { comment, createReminder = false, followUpDate = null, stage = null } = {}) =>
//     API.post(`/leads/${publicId}/logs`, {
//       stage,
//       comment: (comment || "").trim(),
//       createReminder,
//       followUpDate: createReminder && followUpDate ? followUpDate : null,
//     }),

//   // ── LOGS (read) ───────────────────────────────────────────
//   // All activity logs for one lead, newest first.
//   getLeadLogs: (publicId) =>
//     API.get(`/leads/${publicId}/logs`),

//   // Leads-with-logs grid (paginated). Filters: search, stage, userId (user publicId).
//   getLeadLogSummary: ({ search, stage, userId, page = 1, perPage = 12 } = {}) =>
//     API.get("/leads/logs/summary", {
//       params: {
//         ...(search ? { search } : {}),
//         ...(stage && stage !== "All Stages" ? { stage } : {}),
//         ...(userId && userId !== "All Users" ? { userId } : {}),
//         page,
//         perPage,
//       },
//     }),

//   // Roll-up totals for the All-Lead-Logs stat cards.
//   getLeadLogStats: () =>
//     API.get("/leads/logs/stats"),

//   // Delete a single activity log from a lead.
//   deleteLog: (leadPublicId, logPublicId) =>
//     API.delete(`/leads/${leadPublicId}/logs/${logPublicId}`),

//   // ── SEARCH ───────────────────────────────────────────────
//   searchByPhone: (phone) =>
//     API.get("/leads/search", { params: { keyword: phone } }),

//   // ── USERS (Assign To dropdown) ────────────────────────────
//   getUsers: () =>
//     API.get("/users"),

//   // ── ASSIGNMENT RECOMMENDATION (create form) ───────────────
//   // GET /api/leads/assignment/recommendation — gated on LEAD_CREATE (so agents/sub-agents
//   // reach it too, unlike /users which needs USER_READ). Returns either forcedSelf (agents/
//   // staff/sub-agents → assign to self, hide dropdown) or a load-based recommendation with the
//   // eligible pool (admins/managers → pre-fill + editable dropdown + badge).
//   getAssignmentRecommendation: () =>
//     API.get("/leads/assignment/recommendation"),

//   // ── STATISTICS ───────────────────────────────────────────
//   getUserWorkload: () =>
//     API.get("/leads/stats/workload"),

//   getLeadsByStagePerUser: () =>
//     API.get("/leads/stats/by-stage"),

//   getLeadCountForUser: (userPublicId) =>
//     API.get(`/leads/stats/users/${userPublicId}/count`),
// };










import API from "@shared/api/http";
import { normalizePhone } from "@shared/lib/phone";

/* Master ids ride along the itinerary as strings from the <select>s; the backend wants a Long or
   nothing. "" must become null, not 0 — 0 is a row that points at a destination which does not
   exist. */
const toMasterId = (value) => {
  if (value === "" || value == null) return null;
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
};

/**
 * Itinerary rows the backend will actually accept.
 *
 * `LeadItineraryRequestDto` binds `destination` and `city` `@NotBlank` and `nights` `@Min(1)`, and
 * `CreateLeadRequestDto` marks the list `@Valid`, so ONE bad row rejects the entire lead. The form
 * always renders at least one row and its delete button is disabled at length 1, so every lead where
 * the clerk did not fill the itinerary used to post `{destination:"", city:"", nights:2}` and come
 * back 400. The field path in that error is `itinerary[0].destination`, which matches no form field,
 * so `applyServerFieldErrors` could not put it anywhere — the clerk saw a toast naming nothing and
 * both Save and Save & New looked broken.
 *
 * Untouched rows are dropped here (CreateBookingClean has always filtered its legs the same way).
 * Half-filled rows are NOT silently dropped — the page validates those inline before calling this,
 * because quietly discarding a destination someone typed is worse than the 400 was.
 */
function transformItinerary(itinerary) {
  return (Array.isArray(itinerary) ? itinerary : [])
    .filter(({ destination, city }) =>
      String(destination || "").trim() && String(city || "").trim())
    .map(({ destination, city, nights, destinationId, cityId }, index) => ({
      destination: destination.trim(),
      city:        city.trim(),
      // A row that exists is at least one night. The Nights input allows 0 and the backend's
      // @Min(1) rejected it, taking the whole lead down with it.
      nights:      Math.max(1, Number(nights) || 0),
      dayNumber:   index + 1,
      /* The master ids behind the two names. LeadItineraryRequestDto has accepted these all along
         ("the create form's transformer does not send them today") and LeadResponseDto returns them
         so the edit form can re-select its cascading dropdowns. Without them both forms fall back to
         matching the saved NAME against the destination master on every open, which silently loses
         the linkage the moment a master row is renamed. */
      destinationId: toMasterId(destinationId),
      cityId:        toMasterId(cityId),
    }));
}

// ── Transformer: React form → Backend DTO ────────────────
function transformFormData(formData, services = [], itinerary = []) {
  // Total Adults is the primary value. The optional split is independent and may be null.
  const adultTotal = Number(formData.totalAdults) || Number(formData.adults) || 1;

  return {
    customerName:   formData.customerName?.trim()   || "",
    // .trim() only stripped the ENDS, so "+91 98765 43210" went to the server with its spaces
    // intact and failed @Pattern ("^\\+?[1-9]\\d{7,14}$"). Normalised here, at the one point
    // every caller passes through, rather than relying on each form to send a clean value.
    phone:          normalizePhone(formData.phone)  || "",
    // null, not "" — email is optional on the entity (the column is nullable) and an empty string
    // is a value, so a blank field used to persist "" instead of leaving the column NULL.
    email:          formData.email?.trim()          || null,
    leadSource:     formData.leadSource             || "",
    leadType:       formData.leadType               || "",
    leadStage:      formData.leadStage              || "",
    assignedUserId: formData.assignedUserId         || null,
    birthDate:      formData.birthDate              || null,
    anniversaryDate: formData.anniversaryDate       || null,
    preferredCommunication: formData.preferredCommunication || null,
    followUpDate:   formData.followUpDate            || null,
    packageType:    formData.packageType             || null,
    travelDate:     formData.travelDate             || null,
    // When they come back. The column, the request DTO and the mapper have all carried this since
    // V9 — only this transform never sent it, so every lead written from this form had a null
    // returnDate, and every booking converted from one inherited a null tripEndDate. That is what
    // the operations board renders as "End date not set": a trip it can only draw as a point.
    returnDate:     formData.returnDate             || null,
    departCountry:  formData.departCountry          || "Not Specified",
    departCity:     formData.departCity             || "Not Specified",
    departureMode:  formData.departureMode          || null,
    departureAirport: formData.departureAirport?.trim() || null,
    airportCode:    formData.airportCode?.trim().toUpperCase() || null,
    preferredFlightTime: formData.preferredFlightTime || null,
    railwayStation: formData.railwayStation?.trim()  || null,
    trainClass:     formData.trainClass?.trim()      || null,
    preferredTrainTime: formData.preferredTrainTime || null,
    pickupAddress:  formData.pickupAddress?.trim()   || null,
    pickupDateTime: formData.pickupDateTime          || null,
    vehiclePreference: formData.vehiclePreference?.trim() || null,
    
    // --- Room & Extra Bed ---
    rooms:          Number(formData.rooms)          || 1,
    extraBeds:      Number(formData.extraBeds)      || 0,

    // --- Optional Passenger Breakdown (Male / Female) ---
    // Create and Edit both drive one TravelDetails component now, so there is a single set of
    // names to read. They used to differ (adultMale/adultFemale here, male/female there) and the
    // mismatch meant every lead update silently wrote 0 over the gender split.
    male:           formData.male == null ? null : Number(formData.male) || 0,
    female:         formData.female == null ? null : Number(formData.female) || 0,
    /* The adult total goes out under both keys, and both are load-bearing:
         adults      — what the rest of the app reads back off a lead. AllLeads' Travelers column,
                       the View Lead modal, CreateQuotation's pax info and FollowupReports all do
                       `lead.adults`. Dropping this key is what made adults disappear from those.
         totalAdults — the newer name the lead form itself uses.
       Keep both until every reader has moved over. */
    adults:         adultTotal,
    totalAdults:    adultTotal,
    children:       Number(formData.children)       || 0,
    infants:        Number(formData.infants)        || 0,

    // --- Special Assistance Data ---
    specialAssistanceRequired: Boolean(formData.specialAssistanceRequired),
    assistancePassengerCount:  Number(formData.assistancePassengerCount) || 0,
    specialAssistanceTypes:    Array.isArray(formData.specialAssistanceTypes) ? formData.specialAssistanceTypes : [],
    specialAssistanceNotes:    formData.specialAssistanceNotes?.trim() || "",

    // --- Other Fields ---
    budget:         formData.budget != null && formData.budget !== ""
                      ? Number(formData.budget)
                      : null,
    notes:          formData.notes?.trim()          || "",
    roomAllocations: Array.isArray(formData.roomAllocations) ? formData.roomAllocations.map((room, index) => ({
      roomNumber: index + 1,
      roomCategoryPreference: room.roomCategoryPreference || "Any",
      bedPreference: room.bedPreference || "Any",
      adults: Number(room.adults) || 0,
      children: Number(room.children) || 0,
      infants: Number(room.infants) || 0,
      extraBeds: Number(room.extraBeds) || 0,
      childAges: Array.isArray(room.childAges) ? room.childAges.map(Number).filter(Number.isFinite) : [],
    })) : undefined,
    
    // --- Services & Itinerary Arrays ---
    services:       Array.isArray(services) ? services : [],
    itinerary:      transformItinerary(itinerary),
  };
}

// Drop null/undefined/empty params so the query string stays clean and the backend
// reads an absent filter as "no filter" (never search=&stage=&fromDate=).
const cleanParams = (obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== "")
  );

export const leadService = {

  // ── CREATE ────────────────────────────────────────────────
  createLead: (formData, services, itinerary) =>
    API.post("/leads", transformFormData(formData, services, itinerary)),

  // ── GET ALL (legacy positional; used by booking/dashboard/report dropdowns) ──
  // Left untouched on purpose — four other pages call it as getAllLeads(0, 200).
  getAllLeads: (page = 0, size = 100) =>
    API.get(`/leads?page=${page}&size=${size}`),

  // ── SERVER-SIDE PAGINATED LIST (search + stage + type + date + work queues) ──
  // The leads list's only fetch. `q` maps to the backend `search` param; null/blank args are
  // stripped, so an absent filter widens to all leads.
  //
  // activeOnly / followUpDueBy are the two WORK-QUEUE filters and are not stages:
  //   activeOnly=true          → everything that is not Converted or Lost (the "Active" tab)
  //   followUpDueBy=YYYY-MM-DD → leads with a follow-up on or before that day ("Follow-ups")
  // They exist because those two tabs used to be sent as stage=Active / stage=Follow-ups, which
  // LeadStage.fromValue rejects with a 400. Send activeOnly WITH followUpDueBy for the work queue —
  // that pair is what the Follow-ups Due card counts server-side.
  listLeads: ({ page = 0, size = 25, sortBy = "createdAt", sortDir = "desc",
                q, stage, leadType, fromDate, toDate, activeOnly, followUpDueBy } = {}) =>
    API.get("/leads", {
      params: cleanParams({
        page, size, sortBy, sortDir, search: q, stage, leadType, fromDate, toDate,
        // cleanParams drops null/undefined/"" — but NOT false, so an explicit activeOnly=false
        // would still be sent. Normalise it away: absent and false mean the same thing here.
        activeOnly: activeOnly === true ? true : undefined,
        followUpDueBy,
      }),
    }),

  // ── GET BY PUBLIC ID ──────────────────────────────────────
  getLeadById: (publicId) =>
    API.get(`/leads/${publicId}`),

  // ── UPDATE ────────────────────────────────────────────────
  updateLead: (publicId, formData, services, itinerary) =>
    API.put(`/leads/${publicId}`, transformFormData(formData, services, itinerary)),



  // ── DELETE ────────────────────────────────────────────────

  deleteLead: (publicId) =>
    API.delete(`/leads/${publicId}`),

  // ── ADD LOG ───────────────────────────────────────────────
  addLog: (publicId, { comment, createReminder = false, followUpDate = null, stage = null } = {}) =>
    API.post(`/leads/${publicId}/logs`, {
      stage,
      comment: (comment || "").trim(),
      createReminder,
      followUpDate: createReminder && followUpDate ? followUpDate : null,
    }),

  // ── LOGS (read) ───────────────────────────────────────────
  getLeadLogs: (publicId) =>
    API.get(`/leads/${publicId}/logs`),

  getLeadLogSummary: ({ search, stage, userId, page = 1, perPage = 12 } = {}) =>
    API.get("/leads/logs/summary", {
      params: {
        ...(search ? { search } : {}),
        ...(stage && stage !== "All Stages" ? { stage } : {}),
        ...(userId && userId !== "All Users" ? { userId } : {}),
        page,
        perPage,
      },
    }),

  getLeadLogStats: () =>
    API.get("/leads/logs/stats"),

  deleteLog: (leadPublicId, logPublicId) =>
    API.delete(`/leads/${leadPublicId}/logs/${logPublicId}`),

  // ── SEARCH ───────────────────────────────────────────────
  searchByPhone: (phone) =>
    API.get("/leads/search", { params: { keyword: phone } }),

  /**
   * Envelope-aware duplicate lookup — added in the create-form redesign.
   *
   * `searchByPhone` returns the raw axios response, and LeadController.searchLead answers
   * ApiResponse<LeadResponseDto>, so `response.data` is {success, message, data} — the wrapper,
   * not the lead. CreateLead used to read `res.data.customerName` straight off that wrapper, which
   * is always undefined, so a successful match wrote "" over customerName / email / leadSource /
   * leadType / leadStage and the toast read "Lead found: undefined". Unwrapping once here means no
   * caller can get that wrong again.
   *
   * Returns the lead, or null when there is no match — "not found" is the ordinary answer to a
   * duplicate check, not an error the clerk needs to see.
  */
  findLeadByContact: async (keyword) => {
    const raw = String(keyword || "").trim();
    const identifier = raw.includes("@") ? raw.toLowerCase() : normalizePhone(raw);
    if (!identifier) return null;
    try {
      const response = await API.get("/leads/search", { params: { keyword: identifier } });
      const body = response?.data;
      const lead = body?.data ?? body;
      return lead && (lead.publicId || lead.id) ? lead : null;
    } catch (error) {
      if (error?.response?.status === 404) return null;
      throw error;
    }
  },

  /* Original name, kept so nothing that already calls it has to change. LeadServiceImpl.searchLead
     branches on `keyword.contains("@")`, so this has always accepted an email too — the name was
     the only thing that said otherwise.

     Phone input is normalized through the same helper used by create/update before this fallback
     runs, so ordinary typing separators do not create a false miss. */
  findLeadByPhone: (keyword) => leadService.findLeadByContact(keyword),

  // Quick Quote needs the existing-lead warning and existing-customer prefill at the same moment.
  // This read model keeps the matching rules in their owning backend modules while saving one HTTP
  // round-trip on every valid phone/email probe.
  lookupQuickQuoteContact: ({ phone, email } = {}) =>
    API.get("/leads/quick-quote/contact", {
      params: cleanParams({ phone, email }),
    }),

  // ── USERS ────────────────────────────
  getUsers: () =>
    API.get("/users"),

  // ── ASSIGNMENT RECOMMENDATION ───────────────
  getAssignmentRecommendation: () =>
    API.get("/leads/assignment/recommendation"),

  // ── STATISTICS ───────────────────────────────────────────
  /**
   * The All-Leads dashboard roll-up — pipeline shape, money in play, today's follow-ups and the
   * period conversion cohort, aggregated server-side over the caller's whole LEAD_READ scope.
   *
   * Use this for every card and tab badge. Do NOT reduce over the array `getAllLeads` returns:
   * that call is `page=0&size=100`, so past a hundred leads a client-side total silently describes
   * the newest page while reading like a tenant figure — which is exactly the bug this replaced.
   *
   * `from`/`to` are inclusive `YYYY-MM-DD` strings; omit both for the tenant's current calendar
   * month (computed in the TENANT's timezone, not the browser's).
   */
  getStatsSummary: ({ from, to } = {}) =>
    API.get("/leads/stats/summary", {
      params: {
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      },
    }),

  getUserWorkload: () =>
    API.get("/leads/stats/workload"),

  getLeadsByStagePerUser: () =>
    API.get("/leads/stats/by-stage"),

  getLeadCountForUser: (userPublicId) =>
    API.get(`/leads/stats/users/${userPublicId}/count`),

  // ── BULK IMPORT (CSV / Excel) ────────────────────────────
  /* Two steps by design: `previewImport` writes nothing and returns the same report shape as
     `importLeads`, so the user sees exactly what will happen before any lead exists. Both send
     multipart — do NOT set Content-Type by hand, the browser has to add the multipart boundary. */

  previewImport: (file) => {
    const body = new FormData();
    body.append("file", file);
    return API.post("/leads/import/preview", body);
  },

  importLeads: (file) => {
    const body = new FormData();
    body.append("file", file);
    return API.post("/leads/import", body);
  },

  /* Blob, not a plain <a href> — the endpoint needs the Authorization header the interceptor adds. */
  downloadImportTemplate: () =>
    API.get("/leads/import/template", { responseType: "blob" }),
};





