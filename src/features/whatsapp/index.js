// features/whatsapp/index.js — the feature's public API. Nothing else may be imported from here.
//
// WhatsAppInbox is NO LONGER exported. It was a read-only thread list superseded by the
// Communication Center's WhatsApp preset, which shows the same comm_conversations rows and can also
// reply; /WhatsApp is now a redirect. The page file is left on disk for one release rather than
// deleted, but nothing imports it, so it no longer ships in this feature's chunk.

// Exported because features/operations renders the same thread inside its service-line modal.
// One component, so a bubble looks and behaves identically wherever a conversation is shown.
export { default as ChatThread } from "./components/ChatThread";

export { default as whatsappService } from "./api/whatsappService";

// The record-side drawer: message a lead from wherever the lead is listed, on the
// same conversation the inbox above shows. Exported because the surfaces that need
// it (leads, customers) are other features and must not reach into this one.
export { default as ConversationDrawer } from "./components/ConversationDrawer";
export { default as conversationService } from "./api/conversationService";

// The one writer. Exported because features/communication's inbox composes through it too —
// the 24-hour window rule, template arity and the device transport are decided in one file so
// two surfaces can never disagree about what may be sent.
export { default as Composer } from "./components/Composer";
