// features/operations/index.js
// The feature's public API. Nothing outside this feature may import past this file —
// not pages/, not components/, not api/. The router picks the page off here by name.
export { default as Operations } from "./pages/Operations";
/* The delivery view for ONE booking (/operations/:bookingPublicId). Exported by name because
   router.jsx resolves pages off this barrel — a file added without a line here yields
   `default: undefined` and a blank route with no build error. */
export { default as OperationsDetail } from "./pages/OperationsDetail";
export { default as operationsService, addDays, isoDate } from "./api/operationsService";

/* The supplier conversation drawer, exported because a booking's own Services screen needs the
   SAME one the operations board uses.

   It is not the customer drawer from features/whatsapp and must not be replaced by it: sending to a
   supplier moves the service line PENDING → REQUESTED, can write a release date, and on WhatsApp
   has to respect the 24-hour window with a device-link fallback. A generic composer does none of
   that, which is why the Communication Center is read-only on VENDOR threads. Two send paths would
   drift within a release and leave the board reporting lines as never-contacted that had been
   chased twice. Takes { bookingPublicId, line, initialChannel?, onSent?, onClose }. */
export { default as VendorConversationDrawer } from "./components/VendorConversationDrawer";
