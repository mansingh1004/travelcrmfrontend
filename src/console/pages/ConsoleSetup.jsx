import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, KeyRound, Loader2, LogOut, ShieldCheck } from "lucide-react";

import profileService from "../api/profileService";
import { clearConsoleSession } from "../lib/consoleAuth";

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading " +
  "placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus";

function apiMessage(error, fallback) {
  return error?.response?.data?.message || error?.response?.data?.fieldErrors?.newPassword || fallback;
}

export default function ConsoleSetup() {
  const nav = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const logout = () => {
    clearConsoleSession();
    nav("/superadmin/login", { replace: true });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!/^\d{6}$/.test(mfaCode)) {
      setError("Enter the 6-digit authenticator code.");
      return;
    }

    setBusy(true);
    try {
      await profileService.changePassword({
        currentPassword,
        newPassword,
        mfaCode,
      });
      logout();
    } catch (err) {
      setError(apiMessage(err, "Unable to complete setup."));
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-7rem)] max-w-lg items-center">
      <form
        onSubmit={submit}
        className="w-full rounded-xl border border-border bg-surface p-6 shadow-[var(--sa-card-shadow)]"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-text">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-heading">Complete SuperAdmin setup</h1>
              <p className="text-xs text-muted">Password change is required before dashboard access.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            title="Sign out"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-hover hover:text-body"
          >
            <LogOut size={17} />
          </button>
        </div>

        {error && (
          <p className="mt-5 flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 ring-1 ring-red-500/20">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        <div className="mt-6 space-y-4">
          <label className="block text-xs font-semibold text-body">
            Current password
            <input
              type="password"
              autoComplete="current-password"
              className={`${inputCls} mt-1`}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </label>
          <label className="block text-xs font-semibold text-body">
            New password
            <input
              type="password"
              autoComplete="new-password"
              className={`${inputCls} mt-1`}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </label>
          <label className="block text-xs font-semibold text-body">
            Confirm password
            <input
              type="password"
              autoComplete="new-password"
              className={`${inputCls} mt-1`}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </label>
          <label className="block text-xs font-semibold text-body">
            Authenticator code
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              className={`${inputCls} mt-1 font-mono tracking-[0.24em]`}
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              required
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-text hover:bg-accent-hover disabled:opacity-60"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
          {busy ? "Saving..." : "Change password"}
        </button>
      </form>
    </div>
  );
}
