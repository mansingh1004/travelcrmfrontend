

export { default as AllLeads } from "./pages/AllLeads";
export { default as CreateLead } from "./pages/CreateLead";
// Create and Edit routes intentionally use one mode-aware page so their UI and validation cannot drift.
export { default as EditLead } from "./pages/CreateLead";
export { default as LeadLogs } from "./pages/LeadLogs";
export { default as AddLeadLog } from "./pages/AddLeadLog";
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
