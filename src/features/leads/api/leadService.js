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

// ── Transformer: React form → Backend DTO ────────────────
function transformFormData(formData, services = [], itinerary = []) {
  // male + female, already derived in the form. Sent under BOTH names on purpose — see below.
  const adultTotal = Number(formData.totalAdults) || Number(formData.adults) || 1;

  return {
    customerName:   formData.customerName?.trim()   || "",
    phone:          formData.phone?.trim()          || "",
    email:          formData.email?.trim()          || "",
    leadSource:     formData.leadSource             || "",
    leadType:       formData.leadType               || "",
    leadStage:      formData.leadStage              || "",
    assignedUserId: formData.assignedUserId         || null,
    birthDate:      formData.birthDate              || null,
    anniversaryDate: formData.anniversaryDate       || null,
    travelDate:     formData.travelDate             || null,
    departCountry:  formData.departCountry          || "Not Specified",
    departCity:     formData.departCity             || "Not Specified",
    
    // --- Room & Extra Bed ---
    rooms:          Number(formData.rooms)          || 1,
    extraBeds:      Number(formData.extraBeds)      || 0,

    // --- Exact Passenger Breakdown (Male, Female, etc.) ---
    // Create and Edit both drive one TravelDetails component now, so there is a single set of
    // names to read. They used to differ (adultMale/adultFemale here, male/female there) and the
    // mismatch meant every lead update silently wrote 0 over the gender split.
    male:           Number(formData.male)           || 0,
    female:         Number(formData.female)         || 0,
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
    
    // --- Services & Itinerary Arrays ---
    services:       Array.isArray(services) ? services : [],
    itinerary: (Array.isArray(itinerary) ? itinerary : []).map(
      ({ destination, city, nights }, index) => ({
        destination: destination?.trim() || "",
        city:        city?.trim()        || "",
        nights:      Number(nights)      || 0,
        dayNumber:   index + 1,
      })
    ),
  };
}

export const leadService = {

  // ── CREATE ────────────────────────────────────────────────
  createLead: (formData, services, itinerary) =>
    API.post("/leads", transformFormData(formData, services, itinerary)),

  // ── GET ALL ───────────────────────────────────────────────
  getAllLeads: (page = 0, size = 100) =>
    API.get(`/leads?page=${page}&size=${size}`),

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

  // ── USERS ────────────────────────────
  getUsers: () =>
    API.get("/users"),

  // ── ASSIGNMENT RECOMMENDATION ───────────────
  getAssignmentRecommendation: () =>
    API.get("/leads/assignment/recommendation"),

  // ── STATISTICS ───────────────────────────────────────────
  getUserWorkload: () =>
    API.get("/leads/stats/workload"),

  getLeadsByStagePerUser: () =>
    API.get("/leads/stats/by-stage"),

  getLeadCountForUser: (userPublicId) =>
    API.get(`/leads/stats/users/${userPublicId}/count`),
};