import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import QRCode from "qrcode";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Loader2,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

import ConsoleThemeProvider from "../theme/ConsoleThemeProvider";
import superAdminInviteService from "../api/superAdminInviteService";
import { setConsoleSession } from "../lib/consoleAuth";

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading " +
  "placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus";

function apiMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function InviteAcceptView() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const token = useMemo(() => params.get("token") || "", [params]);
  const [setup, setSetup] = useState(null);
  const [qrSrc, setQrSrc] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(() => Boolean(token));
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) return undefined;
    let alive = true;
    superAdminInviteService
      .setup(token)
      .then((body) => {
        if (alive) {
          setSetup(body);
          setError("");
        }
      })
      .catch((err) => {
        if (alive) setError(apiMessage(err, "Invite is invalid or expired."));
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [token]);

  useEffect(() => {
    if (!setup?.mfaOtpAuthUri) return undefined;
    let cancelled = false;
    QRCode.toDataURL(setup.mfaOtpAuthUri, {
      errorCorrectionLevel: "M",
      margin: 2,
      scale: 7,
      color: { dark: "#1f1235", light: "#ffffff" },
    }).then((url) => {
      if (!cancelled) setQrSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [setup?.mfaOtpAuthUri]);

  const copyManualKey = async () => {
    if (!setup?.mfaManualEntryKey || !navigator.clipboard) return;
    await navigator.clipboard.writeText(setup.mfaManualEntryKey);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit authenticator code.");
      return;
    }
    setBusy(true);
    try {
      const body = await superAdminInviteService.accept(token, { password, code });
      setConsoleSession({
        token: body.token,
        name: body.name,
        email: body.email,
        role: body.role || "SUPER_ADMIN",
      });
      nav("/console", { replace: true });
    } catch (err) {
      setError(apiMessage(err, "Unable to accept invite."));
      setBusy(false);
    }
  };

  const displayError = error || (!token ? "Invite token is missing." : "");

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <form
        onSubmit={submit}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--sa-card-shadow)]"
      >
        <div className="h-[3px] w-full" style={{ backgroundImage: "var(--sa-gradient)" }} />
        <div className="p-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-text">
            <ShieldCheck size={22} />
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-heading">Accept SuperAdmin invite</h1>
          <p className="mt-1 text-sm text-body">{setup?.email || "Platform operator setup"}</p>

          {displayError && (
            <p className="mt-5 flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 ring-1 ring-red-500/20">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              {displayError}
            </p>
          )}

          {busy && !setup ? (
            <div className="mt-8 flex justify-center text-muted">
              <Loader2 size={22} className="animate-spin" />
            </div>
          ) : setup ? (
            <div className="mt-6 space-y-4">
              <div className="flex flex-col items-center rounded-lg border border-border bg-white p-4">
                {qrSrc ? (
                  <img src={qrSrc} alt="Authenticator setup QR code" className="h-48 w-48 rounded-md" />
                ) : (
                  <div className="flex h-48 w-48 items-center justify-center rounded-md bg-page text-sm text-body">
                    Preparing QR code
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-border bg-page px-3.5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Manual key</p>
                  <button
                    type="button"
                    onClick={copyManualKey}
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-accent-soft-text hover:bg-surface"
                  >
                    {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="mt-2 break-all font-mono text-xs leading-relaxed text-heading">
                  {setup.mfaManualEntryKey}
                </p>
                <a
                  href={setup.mfaOtpAuthUri}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-accent-soft-text underline-offset-2 hover:underline"
                >
                  <Smartphone size={14} />
                  Open authenticator app
                </a>
              </div>

              <label className="block text-xs font-semibold text-body">
                Password
                <input
                  type="password"
                  autoComplete="new-password"
                  className={`${inputCls} mt-1`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  required
                />
              </label>

              <button
                type="submit"
                disabled={busy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-text hover:bg-accent-hover disabled:opacity-60"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                {busy ? "Creating account..." : "Create account"}
              </button>
            </div>
          ) : null}

          <Link
            to="/superadmin/login"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-accent-soft-text hover:underline"
          >
            <ArrowLeft size={15} />
            Back to login
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function ConsoleInviteAccept() {
  return (
    <ConsoleThemeProvider>
      <InviteAcceptView />
    </ConsoleThemeProvider>
  );
}
