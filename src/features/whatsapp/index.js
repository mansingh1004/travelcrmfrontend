// features/whatsapp/index.js — the feature's public API. Nothing else may be imported from here.
export { default as WhatsAppInbox } from "./pages/WhatsAppInbox";

// Exported because features/operations renders the same thread inside its service-line modal.
// One component, so a bubble looks and behaves identically wherever a conversation is shown.
export { default as ChatThread } from "./components/ChatThread";

export { default as whatsappService } from "./api/whatsappService";
