import ConsoleAPI, { unwrap } from "./consoleHttp";
import { SUPERADMIN_MFA_HEADER } from "./userService";

const stepUpHeaders = (mfaCode) => ({
  headers: { [SUPERADMIN_MFA_HEADER]: mfaCode },
});

const BASE = "/super-admin/platform-mail";

/**
 * The platform mailbox: the single address SuperAdmin alerts and hotel-partner invites are sent
 * from, plus a read-only view of its Inbox and Sent folders so nobody has to open webmail.
 *
 * The From address is intentionally not a field anywhere in here — the server derives it from the
 * SMTP username. Letting the two be set separately is what made invites silently undeliverable.
 */
export const platformMailService = {
  getSettings: () => ConsoleAPI.get(BASE).then(unwrap),

  saveSettings: (payload, mfaCode) =>
    ConsoleAPI.put(BASE, payload, stepUpHeaders(mfaCode)).then(unwrap),

  sendTest: (recipient) =>
    ConsoleAPI.post(`${BASE}/test`, { recipient }).then(unwrap),

  /**
   * folder is "INBOX" or "SENT". `q` narrows on the IMAP SERVER (From, To, Subject or Body), so it
   * reaches mail well past the fetched page — omitted when blank so an empty box lists normally.
   */
  listMessages: ({ folder = "INBOX", page = 0, size = 25, q = "" } = {}) =>
    ConsoleAPI.get(`${BASE}/messages`, {
      params: { folder, page, size, ...(q?.trim() ? { q: q.trim() } : {}) },
    }).then((res) => ({
      messages: res?.data?.data ?? [],
      meta: res?.data?.pagination ?? res?.data?.meta ?? null,
    })),

  getMessage: (uid, folder = "INBOX") =>
    ConsoleAPI.get(`${BASE}/messages/${uid}`, { params: { folder } }).then(unwrap),

  /**
   * Compose and send from the platform mailbox. `to` may be a comma-separated list.
   *
   * No `from` — same rule as the settings form: the server sends as the SMTP username, because
   * Gmail rejects mail whose From is not the account it authenticated as. A field here would be a
   * choice the server then silently overrides.
   *
   * `cc` and `bcc` ride on the SAME message as `to`. The server used to send a separate copy per
   * recipient, which quietly turned a multi-address To into Bcc.
   */
  sendMessage: ({ to, cc, bcc, subject, body }) =>
    ConsoleAPI.post(`${BASE}/messages`, { to, cc, bcc, subject, body }).then(unwrap),

  /**
   * One attachment's bytes, as a Blob. `index` is its position in attachmentNames — the server
   * resolves the MIME part positionally, since two parts in one message can share a filename.
   *
   * The hotel-partner case: an invite goes out from this mailbox, the property replies with its
   * rate card attached, and until now the console could name the file but not open it.
   */
  attachment: (uid, index, folder = "INBOX") =>
    ConsoleAPI.get(`${BASE}/messages/${uid}/attachments/${index}`, {
      params: { folder },
      responseType: "blob",
    }).then((res) => res.data),
};
