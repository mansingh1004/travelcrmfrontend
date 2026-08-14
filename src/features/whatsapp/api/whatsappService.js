// features/whatsapp/api/whatsappService.js
// ─────────────────────────────────────────────────────────────────────────────
// Reading WhatsApp conversations.
//
// There is no /api/whatsapp on the server, and deliberately so. WhatsApp threads
// are rows in the same comm_conversations table as every other channel, so this
// reads the Communication Center's endpoints with channel=WHATSAPP rather than
// asking for a parallel API that would have to be kept in step with it.
//
// SENDING IS NOT HERE. A WhatsApp message to a supplier is mounted under the
// booking service line (features/operations), because sending is what moves a
// line to REQUESTED and records a hold expiry — that is the whole operational
// point of it. A second, statusless send path on this screen would drift from
// that one within a release. The conversation DTO carries bookingPublicId and
// bookingServiceItemPublicId precisely so this screen can call it.
// ─────────────────────────────────────────────────────────────────────────────
import API from "@shared/api/http";

const BASE = "/communication/conversations";

const whatsappService = {
  /**
   * WhatsApp threads, newest activity first.
   *
   * `q` matches contact name, address, subject and the last-message preview —
   * NOT message bodies, which are a different index and a different cost.
   *
   * Returns { items, pagination } — PagedApiResponse puts the list in `data`,
   * not `content`.
   */
  conversations: async ({ page = 0, size = 30, q, unreadOnly } = {}) => {
    const res = await API.get(BASE, {
      params: {
        channel: "WHATSAPP",
        page,
        size,
        q: q || undefined,
        unreadOnly: unreadOnly || undefined,
      },
    });
    return {
      items: res?.data?.data ?? [],
      pagination: res?.data?.pagination ?? null,
    };
  },

  /** One thread's header — contact, links, unread, and the free-text window state. */
  conversation: async (publicId) => {
    const res = await API.get(`${BASE}/${publicId}`);
    return res?.data?.data ?? null;
  },

  /**
   * One page of a thread, NEWEST FIRST from the server.
   *
   * Reversed here rather than at the call site: a chat reads oldest-at-top, and
   * every consumer would otherwise repeat the same reversal and one of them
   * would forget.
   */
  messages: async (publicId, { page = 0, size = 50 } = {}) => {
    const res = await API.get(`${BASE}/${publicId}/messages`, { params: { page, size } });
    const rows = res?.data?.data ?? [];
    return {
      items: [...rows].reverse(),
      pagination: res?.data?.pagination ?? null,
    };
  },
};

export default whatsappService;
