// src/features/trash/index.js
// Public API of the trash feature.

export { default as TrashPage } from "./pages/TrashPage";

// Added in the Create Customer redesign. Creating a customer whose phone belongs to a TRASHED
// record answers 409 RESTORE_AVAILABLE with the publicId in `details`, so the create form can offer
// Restore instead of a dead "already exists" wall — but only if it can reach this service. Exported
// through the barrel rather than deep-imported, per the feature-boundary rule.
export { default as trashService } from "./api/trashService";
