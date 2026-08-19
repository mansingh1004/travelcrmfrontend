// features/whatsapp/api/conversationService.js
// ─────────────────────────────────────────────────────────────────────────────
// Sending, from a record.
//
// whatsappService.js next door reads the inbox and says, correctly for when it
// was written, that sending is not there: the only send path in the app was the
// booking service line, because sending was what moved a line to REQUESTED. That
// is still true for suppliers. This is the other half — messaging the CUSTOMER
// from a lead — and it is a different endpoint for a real reason, not a second
// copy of the same one: a customer send has no service line, no hold expiry, and
// is bound by WhatsApp's 24-hour window, which a supplier chase never was.
//
// Everything here talks to /api/communication. There is no /api/whatsapp on the
// server and there should not be — a WhatsApp thread is a comm_conversations row
// like every other channel's.
// ─────────────────────────────────────────────────────────────────────────────
import API from "@shared/api/http";

const BASE = "/communication";

/** ApiResponse envelope: the payload is in `data.data`. */
const unwrap = (res) => res?.data?.data ?? null;

const conversationService = {
  /**
   * Everything the drawer needs to open on a lead, in one call.
   *
   * Returns { leadPublicId, contactName, phone, email, whatsappThread, emailThread,
   * whatsappConfigured, freeTextSupported, freeTextAllowed, windowExpiresAt, emailConfigured }.
   *
   * A null thread is normal, not an error — a lead that has never been contacted
   * has no conversation yet, and the first send creates one.
   */
  forLead: async (leadPublicId) =>
    unwrap(await API.get(`${BASE}/leads/${leadPublicId}/conversations`)),

  /** The same shape, for a customer record. */
  forCustomer: async (customerPublicId) =>
    unwrap(await API.get(`${BASE}/customers/${customerPublicId}/conversations`)),

  /**
   * Approved templates for a channel, most-used first.
   *
   * `arity` is the number of {{n}} placeholders the approved template declares, and
   * the composer must collect exactly that many — a mismatch is the single most
   * common reason a provider refuses a send.
   */
  templates: async (channel = "WHATSAPP") => {
    const res = await API.get(`${BASE}/templates`, { params: { channel } });
    return res?.data?.data ?? [];
  },

  /**
   * Send WhatsApp. `mode` is explicit — never inferred from which fields are set.
   *
   * TEMPLATE: { templatePublicId, bodyValues[] } — legal at any time.
   * TEXT:     { text }                          — legal only inside the 24-hour window.
   *
   * Address the thread with conversationPublicId (reply) or leadPublicId (first message).
   */
  sendWhatsApp: async (payload) =>
    unwrap(await API.post(`${BASE}/messages/whatsapp`, payload)),

  /** Send email from the agency's own address, logged on the same contact's thread. */
  sendEmail: async (payload) =>
    unwrap(await API.post(`${BASE}/messages/email`, payload)),
};

export default conversationService;
