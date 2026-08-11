// src/services/emailConfigurationService.js
// ─────────────────────────────────────────────────────────────
// Email (SMTP) configuration — API service.
// Uses the shared axiosInstance (baseURL .../api, attaches Bearer <token>, handles 401).
// Backend: /api/settings/email/**  (returns ApiResponse<T> → read res.data.data)
// ─────────────────────────────────────────────────────────────

import API from "@shared/api/http";

const emailConfigurationService = {
  // GET current SMTP config → res.data.data = EmailConfigDTO
  getConfig: () => API.get("/settings/email/config"),

  // SAVE SMTP config. formData: { smtpHost, smtpPort:"587 (TLS)", encryption, username,
  //   password, passwordChanged, fromEmail, fromName }
  saveConfig: (formData) => {
    const portNumber =
      parseInt(String(formData.smtpPort ?? "").split(" ")[0], 10) || 587;
    return API.post("/settings/email/config", {
      smtpHost: (formData.smtpHost || "").trim(),
      portNumber,
      encryption: formData.encryption,
      username: (formData.username || "").trim(),
      passwordChanged: formData.passwordChanged || false,
      // only send the password when it actually changed (never the masked "••••••••")
      password: formData.passwordChanged ? formData.password : undefined,
      fromEmail: (formData.fromEmail || "").trim(),
      fromName: (formData.fromName || "").trim(),
      // Always sent, including as "" — the server treats null as "field absent, keep what is
      // stored", so omitting it would make clearing the signature impossible.
      signature: formData.signature ?? "",
    });
  },

  // SEND a test email → res.data.data = { success, message, error, testedAt }
  testEmail: (recipientEmail) =>
    API.post("/settings/email/test", {
      recipientEmail: (recipientEmail || "").trim(),
    }),

  // GET send stats → res.data.data = { sentToday, deliveryRate }
  getStats: () => API.get("/settings/email/stats"),
};

export default emailConfigurationService;