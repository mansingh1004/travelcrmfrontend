import { useState } from "react";
import { KeyRound, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

import profileService from "../api/profileService";

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus";

export default function ChangePasswordModal({ onClose, onChanged }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 12) return setError("New password must be at least 12 characters.");
    if (newPassword !== confirm) return setError("The two new passwords do not match.");
    if (newPassword === currentPassword) return setError("The new password must be different from the current one.");
    if (!/^\d{6}$/.test(mfaCode)) return setError("Enter the 6-digit authenticator code.");

    setSaving(true);
    try {
      await profileService.changePassword({ currentPassword, newPassword, mfaCode });
      setDone(true);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not change the password.");
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-950/50" />
        <div className="relative w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-xl">
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle2 size={18} />
            <h3 className="text-sm font-bold">Password changed</h3>
          </div>
          <p className="mt-2 text-xs text-muted">
            Your console sessions were revoked. Sign in again with the new password.
          </p>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={onChanged || onClose}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-text hover:bg-accent-hover"
            >
              Sign in again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50" onClick={saving ? undefined : onClose} />
      <form
        onSubmit={submit}
        className="relative w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-xl"
      >
        <div className="flex items-center gap-2">
          <KeyRound size={16} className="text-muted" />
          <h3 className="text-sm font-bold text-heading">Change your password</h3>
        </div>
        <p className="mt-1 text-xs text-muted">
          This platform account change requires your current password and authenticator code.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="cp-current" className="mb-1 block text-xs font-semibold text-body">
              Current password
            </label>
            <input
              id="cp-current"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputCls}
              required
            />
          </div>
          <div>
            <label htmlFor="cp-new" className="mb-1 block text-xs font-semibold text-body">
              New password
            </label>
            <input
              id="cp-new"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputCls}
              required
            />
          </div>
          <div>
            <label htmlFor="cp-confirm" className="mb-1 block text-xs font-semibold text-body">
              Confirm new password
            </label>
            <input
              id="cp-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputCls}
              required
            />
          </div>
          <div>
            <label htmlFor="cp-mfa" className="mb-1 block text-xs font-semibold text-body">
              Authenticator code
            </label>
            <input
              id="cp-mfa"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className={inputCls}
              placeholder="000000"
              required
            />
          </div>
        </div>

        {error && (
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-[11px] text-red-700 ring-1 ring-red-500/20">
            <AlertTriangle size={13} className="mt-px shrink-0" />
            {error}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
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
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-text hover:bg-accent-hover disabled:opacity-60"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? "Changing..." : "Change password"}
          </button>
        </div>
      </form>
    </div>
  );
}
