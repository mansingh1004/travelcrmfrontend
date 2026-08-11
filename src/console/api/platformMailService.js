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

  /** folder is "INBOX" or "SENT". Returns the PagedApiResponse envelope's data array. */
  listMessages: ({ folder = "INBOX", page = 0, size = 25 } = {}) =>
    ConsoleAPI.get(`${BASE}/messages`, { params: { folder, page, size } }).then(
      (res) => ({
        messages: res?.data?.data ?? [],
        meta: res?.data?.pagination ?? res?.data?.meta ?? null,
      })
    ),

  getMessage: (uid, folder = "INBOX") =>
    ConsoleAPI.get(`${BASE}/messages/${uid}`, { params: { folder } }).then(unwrap),

  /**
   * Compose and send from the platform mailbox. `to` may be a comma-separated list.
   *
   * No `from` — same rule as the settings form: the server sends as the SMTP username, because
   * Gmail rejects mail whose From is not the account it authenticated as. A field here would be a
   * choice the server then silently overrides.
   */
  sendMessage: ({ to, subject, body }) =>
    ConsoleAPI.post(`${BASE}/messages`, { to, subject, body }).then(unwrap),

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
