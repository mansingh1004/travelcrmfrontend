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

  /**
   * folder is "INBOX" or "SENT". `q` narrows on the IMAP SERVER — From, To, Subject or Body — so it
   * reaches mail far past the fetched page. Omitted when blank so an empty box is a plain list, not
   * a search for the empty string.
   */
  listMessages: ({ folder = "INBOX", page = 0, size = 25, q = "" } = {}) =>
    API.get(`${BASE}/messages`, {
      params: { folder, page, size, ...(q?.trim() ? { q: q.trim() } : {}) },
    }).then((r) => ({
      messages: r.data?.data ?? [],
      meta: r.data?.pagination ?? null,
    })),

  /**
   * Fetch one message's body. Also marks it \Seen server-side — opening it here means the same thing
   * as opening it in Gmail, so the returned `seen` is true and the list row should be patched with
   * it rather than refetched.
   */
  getMessage: (uid, folder = "INBOX") =>
    API.get(`${BASE}/messages/${uid}`, { params: { folder } }).then((r) => r.data?.data ?? r.data),

  /**
   * Send from the agency's own address. `to`, `cc` and `bcc` may each be comma-separated lists.
   *
   * No `from` — the server uses the address saved under Settings > Email. Requires COMM_SEND, which
   * is a separate permission from the COMM_READ that opens this screen: reading the agency inbox and
   * writing to a customer from the agency's address are different acts.
   *
   * All three fields ride on ONE message. The server used to loop and send a copy per recipient,
   * which made a multi-address To behave like Bcc — nobody saw who else got it.
   */
  sendMessage: ({ to, cc, bcc, subject, body }) =>
    API.post(`${BASE}/messages`, { to, cc, bcc, subject, body })
      .then((r) => r.data?.data ?? r.data),

  /**
   * One attachment's bytes, as a Blob. `index` is its position in the message's attachmentNames —
   * the server resolves the MIME part positionally, because two parts in one message can share a
   * filename and matching on the name would hand back the wrong one while looking correct.
   *
   * The server always answers Content-Disposition: attachment, so the browser saves it rather than
   * rendering an arbitrary sender's HTML inside the app's own origin.
   */
  attachment: (uid, index, folder = "INBOX") =>
    API.get(`${BASE}/messages/${uid}/attachments/${index}`, {
      params: { folder },
      responseType: "blob",
    }).then((r) => r.data),
};

export default mailboxService;
