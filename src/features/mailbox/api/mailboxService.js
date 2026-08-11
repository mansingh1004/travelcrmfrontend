import API from "@shared/api/http";

const BASE = "/mailbox";

/**
 * The tenant's own mailbox, read through the CRM.
 *
 * Credentials are whatever the agency already saved under Settings > Email — the server derives
 * the IMAP host from the SMTP host, so there is nothing extra to configure here.
 *
 * Read-only against the REAL mailbox: nothing here marks, moves or deletes anything, and the folder
 * is opened READ_ONLY server-side. Sending is the one write, and it does not go through IMAP at all
 * — the server sends over the agency's SMTP and the provider files its own copy in Sent.
 */
export const mailboxService = {
  /** Cheap probe so the page can show a "connect your email" prompt instead of an error. */
  status: () => API.get(`${BASE}/status`).then((r) => r.data?.data ?? r.data),

  /** folder is "INBOX" or "SENT". */
  listMessages: ({ folder = "INBOX", page = 0, size = 25 } = {}) =>
    API.get(`${BASE}/messages`, { params: { folder, page, size } }).then((r) => ({
      messages: r.data?.data ?? [],
      meta: r.data?.pagination ?? null,
    })),

  getMessage: (uid, folder = "INBOX") =>
    API.get(`${BASE}/messages/${uid}`, { params: { folder } }).then((r) => r.data?.data ?? r.data),

  /**
   * Send from the agency's own address. `to` may be a comma-separated list.
   *
   * No `from` — the server uses the address saved under Settings > Email. Requires COMM_SEND, which
   * is a separate permission from the COMM_READ that opens this screen: reading the agency inbox and
   * writing to a customer from the agency's address are different acts.
   */
  sendMessage: ({ to, subject, body }) =>
    API.post(`${BASE}/messages`, { to, subject, body }).then((r) => r.data?.data ?? r.data),
};

export default mailboxService;
