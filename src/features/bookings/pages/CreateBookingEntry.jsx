// src/features/bookings/pages/CreateBookingEntry.jsx
//
// Which Create Booking screen this tenant gets. The lead side has the same chooser and the same
// reasoning — see leads/pages/CreateLeadEntry.jsx.
//
//   CreateBookingClean.jsx  the standard form — every plan, and the default
//   CreateBookingFast.jsx   the high-volume rebuild: the lead-linked fold ("only the fields this
//                           enquiry has not already answered"), the sticky money rail's server
//                           preview, and the contact probe that finds the enquiry as you type
//
// Gated on the FAST_ENTRY_FORMS module, which the GROWTH plan carries. hasModuleStrict fails
// CLOSED: until entitlements load, a tenant gets the standard form rather than a paid one.
//
// The two forms are interchangeable at the DATA layer — same payloads, same endpoints, same
// validation — so a booking created on one opens correctly on the other. That is what makes
// switching a tenant's plan safe: nothing has to be migrated, and a downgrade loses the screen
// without stranding a single record.

import { hasModuleStrict, FAST_ENTRY_FORMS } from "@shared/lib/access";
import CreateBookingStandard from "./CreateBookingClean";
import CreateBookingFast from "./CreateBookingFast";

export default function CreateBookingEntry() {
  return hasModuleStrict(FAST_ENTRY_FORMS) ? <CreateBookingFast /> : <CreateBookingStandard />;
}
