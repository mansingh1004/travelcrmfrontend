// src/features/quotation/index.js
// Public API of the quotation feature.
// QuotationWebView / PublicQuotationPage / WeblinkAnalyticsModal /
// quotationService are consumed by leads and the public /q/ route.

export { default as CreateQuotation } from "./pages/Createquotation";
export { default as QuickQuotation } from "./pages/QuickQuotation";
export { default as QuotationWebView, PublicQuotationPage } from "./pages/QuotationWebView";
export { default as WeblinkAnalyticsModal } from "./components/WeblinkAnalyticsModal";
export { quotationService } from "./api/quotationService";

// Package templates — library, builder, the lead-facing "Suggest packages" modal, and its client.
export { default as PackageTemplates } from "./pages/PackageTemplates";
export { default as TemplateBuilder } from "./pages/TemplateBuilder";
export { default as SuggestPackagesModal } from "./components/SuggestPackagesModal";
// "Download as Classic / Modern / Premium" dialog — consumed by the leads feature's quotation list.
export { default as QuotationStyleModal } from "./components/QuotationStyleModal";
export { templateService } from "./api/templateService";
