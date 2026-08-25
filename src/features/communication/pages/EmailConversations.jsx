// features/communication/pages/EmailConversations.jsx
// The Email preset of the same inbox. NOT the same thing as /Mailbox: that reads the agency's
// IMAP mailbox — every message in it, CRM-related or not — while this reads comm_conversations,
// the threads the CRM itself owns and attaches to a lead, customer or booking.
import CommunicationInbox from "./CommunicationInbox";

export default function EmailConversations() {
  return <CommunicationInbox channel="EMAIL" kind="CUSTOMER" />;
}
