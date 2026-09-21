// src/services/whatsAppConfigService.js
// ─────────────────────────────────────────────────────────────
// WhatsApp integration configuration — API service.
// Uses the shared axiosInstance (baseURL .../api, attaches Bearer <token>, handles 401).
// Backend: /api/settings/whatsapp/**  (returns ApiResponse<T> → read res.data.data)
// ─────────────────────────────────────────────────────────────

import API from "@shared/api/http";

const whatsAppConfigService = {
  // GET current config → res.data.data = WhatsAppConfigDTO
  getConfig: () => API.get("/settings/whatsapp/config"),

  // SAVE config. formData:
  //   { apiKey, apiKeyChanged, templateName, templateLanguage, headerImageUrl,
  //     provider, phoneNumberId, businessAccountId }
  //
  // `apiKey` is the secret slot for BOTH providers — the Interakt API key, or the Meta permanent
  // access token. The backend stores one encrypted credential and reads it per provider, so the
  // field is deliberately not duplicated here.
  saveConfig: (formData) =>
    API.post("/settings/whatsapp/config", {
      apiKeyChanged: formData.apiKeyChanged || false,
      // only send the key when it actually changed (never the masked "••••••••")
      apiKey: formData.apiKeyChanged ? formData.apiKey : undefined,
      templateName: (formData.templateName || "").trim(),
      templateLanguage: (formData.templateLanguage || "").trim(),
      headerImageUrl: formData.headerImageUrl?.trim() || null,
      // INTERAKT | META_CLOUD. Anything else is normalised away server-side and the tenant falls
      // back to the deployment default, so sending a stale value can never break sending.
      provider: formData.provider || null,
      // Meta Cloud API only; ignored by the backend on the Interakt path. Always sent so that
      // switching provider back and forth does not silently drop what was already typed.
      phoneNumberId: formData.phoneNumberId?.trim() || null,
      businessAccountId: formData.businessAccountId?.trim() || null,
    }),

  // SEND a test message → res.data.data = { success, message, error, testedAt }
  sendTestMessage: (phoneNumber) =>
    API.post("/settings/whatsapp/test", {
      phoneNumber: String(phoneNumber || "").replace(/\D/g, "").slice(0, 10),
    }),

  // GET integration stats → res.data.data = { messagesSent, deliveryRate, lastTestedAt, apiStatus, apiStatusSub }
  getStats: () => API.get("/settings/whatsapp/stats"),
};

export default whatsAppConfigService;