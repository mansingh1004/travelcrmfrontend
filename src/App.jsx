// src/App.jsx — thin shell; the route tree lives in app/router.jsx (Phase 5a).
//

//
// RouteErrorBoundary wraps the whole route tree inside router.jsx. Anything mounted below that
// boundary — MaintenanceOverlay, for instance — is unmounted when a render crash swaps the tree for
// the fallback UI. Mounting the toast host there would mean a crash silently destroys the very
// mechanism meant to tell the user something went wrong. Because toast state lives in a module-level
// store (see shared/ui/toast.jsx), the host re-subscribes and any queued toast still renders.
import AppRouter from "@app/router";
import { ToastHost } from "@shared/ui/toast";

export default function App() {
  return (
    <>
      <ToastHost />
      <AppRouter />
    </>
  );
}