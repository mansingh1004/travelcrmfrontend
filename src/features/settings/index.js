// src/features/settings/index.js
// Public API of the settings feature.
// companyService is exported because dashboard and profile/CompanyProfile
// legitimately read company data.

export { default as CompanySettings } from "./pages/CompanySettings";
export { default as EmailConfiguration } from "./pages/EmailConfiguration";
export { default as WhatsAppConfiguration } from "./pages/WhatsAppConfiguration";
export { default as LeadSources } from "./pages/LeadSources";
// The Hot/Warm/Cold rule builder. Routed through this barrel like every other settings page —
// router.jsx must never deep-import past the index.
export { default as LeadScoringRules } from "./pages/LeadScoringRules";
export { companyService, taxRateService } from "./api/companyService";
export { leadSourceService } from "./api/leadSourceService";
export { leadScoringService } from "./api/leadScoringService";
