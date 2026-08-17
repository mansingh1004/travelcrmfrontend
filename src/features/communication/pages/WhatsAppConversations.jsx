// features/communication/pages/WhatsAppConversations.jsx
// A preset of the one inbox, not a second screen: channel pinned to WhatsApp, kind left at
// lead work. `lazyPage` picks a NAMED export off the barrel and cannot pass props, so the
// preset has to be a component — and the barrel is a .js file, which cannot hold JSX at all.
import CommunicationInbox from "./CommunicationInbox";

export default function WhatsAppConversations() {
  return <CommunicationInbox channel="WHATSAPP" kind="CUSTOMER" />;
}
