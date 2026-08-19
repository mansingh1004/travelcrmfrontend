// src/features/leads/pages/CreateLeadEntry.jsx
//
// Which Create Lead screen this tenant gets.
//
// Two complete forms exist, and both are current:
//   CreateLead.jsx      the standard form — what every plan has always had, and still the default
//   CreateLeadFast.jsx  the high-volume rebuild, for an agency typing 50-100 enquiries a day
//                       (Full / Rapid layouts, the booking form's own cards in Rapid)
//
// The fast one is a paid capability, carried by the GROWTH plan through the FAST_ENTRY_FORMS
// module. The gate is the MODULE and not `plan === "GROWTH"`, so selling it to another tier later
// is an edit to that plan's module set in the SuperAdmin console — no deploy, and no pricing
// hard-wired into this file.
//
// hasModuleStrict, NOT hasModule: the ordinary helper is fail-open so a failed entitlements fetch
// never blocks a customer out of something they bought, which is right for hiding a sidebar item
// and wrong here. Fail-open would hand the plan-exclusive screen to every tenant for the whole
// window before entitlements land. Failing closed costs nothing, because the other branch is a
// complete working form rather than an error.
//
// Both pages are imported eagerly rather than lazily. The router already code-splits this feature
// as one chunk (see `lazyPage` in app/router.jsx), so a React.lazy here would add a second
// suspense boundary and a second network round-trip to reach a screen the agent opened
// deliberately — while the chunk carries both files either way.
//
// EDIT USES THE SAME CHOOSER. Each page is its own create/edit screen (the leads barrel maps both
// routes onto one component so their UI and validation cannot drift), and a tenant must not create
// a lead on one form and edit it on the other.

import { hasModuleStrict, FAST_ENTRY_FORMS } from "@shared/lib/access";
import CreateLeadStandard from "./CreateLead";
import CreateLeadFast from "./CreateLeadFast";

export default function CreateLeadEntry() {
  return hasModuleStrict(FAST_ENTRY_FORMS) ? <CreateLeadFast /> : <CreateLeadStandard />;
}
