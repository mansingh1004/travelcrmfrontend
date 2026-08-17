import { useState } from "react";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import { isLocalSuperAdminMfaDisabled } from "../lib/consoleEnvironment";

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading " +
  "placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus";

export default function SuperAdminMfaActionModal({
  title,
  description,
  confirmLabel = "Confirm",
  saving = false,
  progress = null,
  error = "",
  onClose,
  onConfirm,
}) {
  const [code, setCode] = useState("");
  const mfaDisabled = isLocalSuperAdminMfaDisabled();

  const submit = (e) => {
    e.preventDefault();
    if (!mfaDisabled && !/^\d{6}$/.test(code)) return;
    onConfirm(mfaDisabled ? "" : code);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
      <div className="absolute inset-0 bg-slate-950/50" onClick={saving ? undefined : onClose} />
      <form
        onSubmit={submit}
        className="relative w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-xl"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-accent" />
          <h3 className="text-sm font-bold text-heading">{title}</h3>
        </div>
        <p className="mt-1 text-xs text-muted">
          {mfaDisabled ? "MFA is disabled for local development. Confirm to continue." : description}
        </p>
        {mfaDisabled ? (
          <p className="mt-4 rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700 ring-1 ring-amber-500/20">
            Local development bypass active
          </p>
        ) : (
          <div className="mt-4">
            <label htmlFor="superadmin-stepup-code" className="mb-1 block text-xs font-semibold text-body">
              Authenticator code
            </label>
            <input
              id="superadmin-stepup-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className={inputCls}
              placeholder="000000"
              required
            />
          </div>
        )}
        {error && (
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-[11px] text-red-700 ring-1 ring-red-500/20">
            <AlertTriangle size={13} className="mt-px shrink-0" />
            {error}
          </p>
        )}
        {saving && Number.isFinite(progress) && (
          <div className="mt-3" aria-live="polite">
            <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-muted">
              <span>Uploading voucher</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-hover" role="progressbar"
              aria-label="Voucher upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
              <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-body hover:bg-surface-hover disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || (!mfaDisabled && code.length !== 6)}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-text hover:bg-accent-hover disabled:opacity-60"
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
