

export { default as AllLeads } from "./pages/AllLeads";
/* PROTECTED FLOW — kept on this branch's own Create Lead, deliberately.
   develop repointed both of these at CreateLeadEntry, the FAST_ENTRY_FORMS switcher that chooses
   between this page and CreateLeadFast. The router resolves the route through this barrel
   (`lazyPage(leads, "CreateLead")`), so the barrel IS the switch — protecting the page file alone
   would have changed nothing. CreateLeadEntry and CreateLeadFast are merged in and left unreferenced
   rather than deleted, so the develop work is recoverable by flipping these two lines back. */
export { default as CreateLead } from "./pages/CreateLead";
// Create and Edit routes intentionally use one mode-aware page so their UI and validation cannot drift.
export { default as EditLead } from "./pages/CreateLead";
export { default as AllLeadLogs } from "./pages/AllLeadLogs";
export { default as WhatsAppPanel } from "./pages/WhatsAppPanel";
export { default as ItinerarySection } from "./components/ItinerarySection";
export { default as TravelDetails } from "./components/TravelDetails";
// Not lead domain logic — a generic keyboard combobox (arrows / Enter-to-pick / Esc / Home / End)
// that happens to live here because Leads needed it first. Exported through the barrel so other
// features reuse it instead of forking a second one; it takes an `accent` prop for that reason.
// Its natural long-term home is shared/ui, but moving it would touch every lead import, so it
// stays put until something else forces that change.
export { default as SearchableSelect } from "./components/SearchableSelect";
export { leadService } from "./api/leadService";
// The stage vocabulary, shared so the copies that had drifted (a phantom "Ready to Book", a
// missing "Reopened") cannot come back.
export { LEAD_STAGES, STAGE_FILTER_OPTIONS, isKnownStage } from "./lib/leadStages";

// Incoming Leads — the claim window. The provider and the alert service are exported too because
// app chrome (LeadAlertHost, mounted in Layout) needs them; that is the ONLY route past this
// barrel, and it goes through the barrel exactly like Navbar's reminder/settings imports do.
export { default as LeadAlerts } from "./pages/LeadAlerts";
export { LeadAlertProvider, useLeadAlerts } from "./hooks/useLeadAlerts";
export { leadAlertService, claimLostInfo, claimFailure } from "./api/leadAlertService";
export { formatCountdown } from "./lib/leadAlertConstants";
