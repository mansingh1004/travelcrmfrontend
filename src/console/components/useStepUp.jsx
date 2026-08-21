import { useState } from "react";
import SuperAdminMfaActionModal from "./SuperAdminMfaActionModal";
import { getErrorMessage } from "@shared/api/apiError";

/**
 * Runs one step-up-protected action behind a single confirmation dialog.
 *
 * Most platform writes are `@RequireSuperAdminStepUp` server-side and reject a request with no
 * `X-SuperAdmin-Mfa-Code`. Wiring that per button produced near-identical dialogs on every screen that
 * needed one — the duplication the audit flags — so this owns the code, the busy state and the error,
 * and the caller supplies only what the action is and how to run it.
 *
 * Errors stay INSIDE the dialog rather than becoming a toast. The operator is still standing at the
 * code field, and the common failure is a code that expired while they typed: that has to be
 * retryable without losing the form behind it. A toast would also be dismissed before it was read.
 *
 * Usage:
 *   const stepUp = useStepUp();
 *   stepUp.request({ title, description, confirmLabel, run: async (mfaCode) => { ... } });
 *   ...
 *   {stepUp.dialog}
 *
 * `run` should throw on failure — the hook keeps the dialog open and shows the message. Returning
 * normally closes it.
 */
export function useStepUp() {
  const [pending, setPending] = useState(null);   // { title, description, confirmLabel, run }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const request = (spec) => { setError(""); setPending(spec); };

  const confirm = async (code) => {
    setBusy(true);
    setError("");
    try {
      await pending.run(code);
      setPending(null);
    } catch (e) {
      setError(getErrorMessage(e, "That did not go through. Enter a fresh code and try again."));
    } finally {
      setBusy(false);
    }
  };

  const dialog = pending ? (
    <SuperAdminMfaActionModal
      title={pending.title}
      description={pending.description}
      confirmLabel={pending.confirmLabel}
      saving={busy}
      error={error}
      onClose={busy ? undefined : () => setPending(null)}
      onConfirm={confirm}
    />
  ) : null;

  return { request, dialog, busy };
}

export default useStepUp;
