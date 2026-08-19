// features/communication/index.js — the feature's public API. Nothing else may be imported from here.
//
// Two channels today, WhatsApp and Email, both rendered by ONE page: comm_conversations is a single
// table with a channel column, and a per-channel page would be the same screen copied twice, drifting
// from the moment the second one was written. A third channel is a row in CHANNELS, not a new file.
export { default as CommunicationInbox } from "./pages/CommunicationInbox";
export { default as WhatsAppConversations } from "./pages/WhatsAppConversations";
export { default as EmailConversations } from "./pages/EmailConversations";

export { default as MessageTemplates } from "./pages/MessageTemplates";

export { default as communicationService } from "./api/communicationService";
