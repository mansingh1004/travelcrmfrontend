// features/operations/index.js
// The feature's public API. Nothing outside this feature may import past this file —
// not pages/, not components/, not api/. The router picks the page off here by name.
export { default as Operations } from "./pages/Operations";
/* The delivery view for ONE booking (/operations/:bookingPublicId). Exported by name because
   router.jsx resolves pages off this barrel — a file added without a line here yields
   `default: undefined` and a blank route with no build error. */
export { default as OperationsDetail } from "./pages/OperationsDetail";
export { default as operationsService, addDays, isoDate } from "./api/operationsService";
