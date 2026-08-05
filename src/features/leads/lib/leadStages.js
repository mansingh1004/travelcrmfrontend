// src/features/leads/lib/leadStages.js
//
// The lead stage vocabulary — ONE copy, because three hand-maintained copies had already drifted
// apart in three different directions:
//   • AllLeadLogs offered a "Ready to Book" stage that does not exist in the backend enum, so
//     filtering by it sent a value the server has never heard of.
//   • AllLeadLogs and AllLeads both omitted "Reopened", which LeadStage.REOPENED does define and
//     which a cancelled booking sets when it moves the lead back — those leads could not be
//     filtered for anywhere.
//   • AllLeads additionally omitted "Converted".
//
// Anything rendering a stage dropdown, filter or pill reads from here. The long-term fix is a
// backend metadata endpoint so the list cannot drift at all; until that exists, this file is the
// single place to change when the enum does.

/** Mirrors the backend LeadStage enum (8 constants) in declaration order. */
export const LEAD_STAGES = [
  "New Lead", "Contacted", "Follow Up",
  "Qualified", "Proposal Sent", "Converted", "Reopened", "Lost",
];

/** The same list with the "no filter" sentinel a filter dropdown needs. */
export const STAGE_FILTER_OPTIONS = ["All Stages", ...LEAD_STAGES];

/** True for a value the backend would recognise. Useful before sending a stage to the API. */
export const isKnownStage = (stage) => LEAD_STAGES.includes(stage);
