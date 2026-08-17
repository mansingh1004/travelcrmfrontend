// features/communication/api/communicationService.js
// ─────────────────────────────────────────────────────────────────────────────
// The Communication Center's own reads.
//
// One endpoint family serves every channel — comm_conversations is a single
// table and the channel is a column, which is the whole reason the product can
// show one timeline per contact instead of one per app. So this takes `channel`
// as an argument rather than existing once per channel.
//
// Sending lives in features/whatsapp's conversationService and is reached
// through that feature's barrel. It stays there because the record-side drawer
// and this inbox must send through exactly one implementation: the rules a send
// has to obey (24-hour window, template arity, transport) are not the kind of
// thing that survives being written twice.
// ─────────────────────────────────────────────────────────────────────────────
import API from "@shared/api/http";

const BASE = "/communication";

const communicationService = {
  /**
   * Conversations for one channel, newest activity first.
   *
   * `q` matches contact name, address, subject and the last-message preview — NOT
   * message bodies, which are a different index and a different cost.
   */
  /**
   * @param kind CUSTOMER = lead work, VENDOR = operations/supplier work, omitted = both in one
   *             queue. Every row carries its own kind either way, so the two are always
   *             distinguishable on screen and never silently merged.
   */
  conversations: async ({ channel, kind, page = 0, size = 30, q, unreadOnly } = {}) => {
    const res = await API.get(`${BASE}/conversations`, {
      params: {
        channel,
        kind,
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

  /** One thread's header — contact, links, unread, and whether free text is legal right now. */
  conversation: async (publicId) => {
    const res = await API.get(`${BASE}/conversations/${publicId}`);
    return res?.data?.data ?? null;
  },

  /**
   * One page of a thread, NEWEST FIRST from the server.
   *
   * Reversed here rather than at the call site: a chat reads oldest-at-top, and every
   * consumer would otherwise repeat the same reversal and one of them would forget.
   */
  messages: async (publicId, { page = 0, size = 50 } = {}) => {
    const res = await API.get(`${BASE}/conversations/${publicId}/messages`, {
      params: { page, size },
    });
    const rows = res?.data?.data ?? [];
    return {
      items: [...rows].reverse(),
      pagination: res?.data?.pagination ?? null,
    };
  },

  /** Tile counts for the hub header. */
  summary: async () => {
    const res = await API.get(`${BASE}/conversations/summary`);
    return res?.data?.data ?? null;
  },

  /**
   * What this agency can send on — loaded once per inbox session, not per conversation.
   * The per-contact half (is the 24-hour window open) rides on each conversation instead.
   */
  readiness: async () => {
    const res = await API.get(`${BASE}/readiness`);
    return res?.data?.data ?? null;
  },

  /* ── triage ──────────────────────────────────────────────────────────────
     Marking read is part of reading, so it rides on COMM_READ; assigning and
     closing decide whose work a thread is and need COMM_ASSIGN. All three
     return the updated conversation, so the caller replaces its row rather
     than guessing what the server did. */

  markRead: async (publicId) => {
    const res = await API.put(`${BASE}/conversations/${publicId}/read`);
    return res?.data?.data ?? null;
  },

  /** userPublicId null unassigns — that is a real operation, not a no-op. */
  assign: async (publicId, userPublicId = null) => {
    const res = await API.put(`${BASE}/conversations/${publicId}/assign`, { userPublicId });
    return res?.data?.data ?? null;
  },

  /**
   * Take it yourself. Its own endpoint because the browser does not know the current user's
   * publicId — it stores an email and a role — and the server does.
   */
  claim: async (publicId) => {
    const res = await API.put(`${BASE}/conversations/${publicId}/claim`);
    return res?.data?.data ?? null;
  },

  /**
   * An internal note on the thread — colleagues only, never delivered.
   *
   * Lands on the SAME timeline as the messages on purpose: "customer asked for a discount /
   * we agreed 5% / quote sent" is one story, and a separate notes tab loses the sequence.
   */
  addNote: async (publicId, text, internal = false) => {
    const res = await API.post(`${BASE}/conversations/${publicId}/notes`, { text, internal });
    return res?.data?.data ?? null;
  },

  /** status: OPEN | PENDING | SNOOZED | CLOSED. SNOOZED needs snoozedUntil. */
  setStatus: async (publicId, status, snoozedUntil = null) => {
    const res = await API.put(`${BASE}/conversations/${publicId}/status`, { status, snoozedUntil });
    return res?.data?.data ?? null;
  },

  /* ── templates ───────────────────────────────────────────────────────────
     The manage screen passes activeOnly=false: a draft is where a template sits
     for the days between being written and being approved by the provider, and
     hiding drafts would hide the exact thing the agency is waiting on. The
     composer asks for active only — see whatsapp/conversationService. */

  templates: async (channel = "WHATSAPP", { activeOnly = false } = {}) => {
    const res = await API.get(`${BASE}/templates`, { params: { channel, activeOnly } });
    return res?.data?.data ?? [];
  },

  createTemplate: async (payload) => {
    const res = await API.post(`${BASE}/templates`, payload);
    return res?.data?.data ?? null;
  },

  updateTemplate: async (publicId, payload) => {
    const res = await API.put(`${BASE}/templates/${publicId}`, payload);
    return res?.data?.data ?? null;
  },

  /** Soft delete — comm_messages.template_id still points here, so the row is kept. */
  deleteTemplate: async (publicId) => {
    await API.delete(`${BASE}/templates/${publicId}`);
  },
};

export default communicationService;
