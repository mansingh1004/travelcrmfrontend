import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

import ConsoleThemeProvider from "../theme/ConsoleThemeProvider";
import ThemeToggle from "../theme/ThemeToggle";
import ConsoleAPI, { unwrap } from "../api/consoleHttp";
import { setConsoleSession, isConsoleAuthed } from "../lib/consoleAuth";

/**
 * Platform SuperAdmin login. The password step issues a short-lived MFA challenge;
 * only a successful authenticator verification receives and stores the console token.
 */

function apiMessage(error, fallback) {
  return (
    error?.response?.data?.fieldErrors?.code ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}

function formatRemaining(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function ConsoleLoginView() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [mfa, setMfa] = useState(null);
  const [code, setCode] = useState("");
  const [qrSrc, setQrSrc] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isConsoleAuthed()) nav("/console", { replace: true });
  }, [nav]);

  useEffect(() => {
    if (!mfa?.expiresAt) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [mfa?.expiresAt]);

  useEffect(() => {
    if (!mfa?.mfaSetupRequired || !mfa?.mfaOtpAuthUri) return undefined;

    let cancelled = false;
    QRCode.toDataURL(mfa.mfaOtpAuthUri, {
      errorCorrectionLevel: "M",
      margin: 2,
      scale: 7,
      color: { dark: "#1f1235", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setQrSrc(url);
      })
      .catch(() => {
        if (!cancelled) setQrSrc("");
      });

    return () => {
      cancelled = true;
    };
  }, [mfa?.mfaOtpAuthUri, mfa?.mfaSetupRequired]);

  const completeLogin = (body) => {
    if (!body?.token) throw new Error("No token in response");
    setConsoleSession({
      token: body.token,
      name: body.name,
      email: body.email,
      role: body.role || "SUPER_ADMIN",
    });
    nav(body.setupRequired || body.mustChangePassword ? "/console/setup" : "/console", { replace: true });
  };

  const beginMfa = (body) => {
    const issuedAt = Date.now();
    setMfa({
      ...body,
      expiresAt: issuedAt + Number(body.mfaExpiresInSeconds || 0) * 1000,
    });
    setNow(issuedAt);
    setQrSrc("");
    setPassword("");
    setCode("");
    setErr("");
    setBusy(false);
  };

  const submitCredentials = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const res = await ConsoleAPI.post("/auth/superadmin/login", { email, password });
      const body = unwrap(res) || {};
      if (body.mfaRequired) {
        beginMfa(body);
        return;
      }
      completeLogin(body);
    } catch (e2) {
      const status = e2?.response?.status;
      setErr(
        status === 401
          ? "Invalid email or password."
          : apiMessage(e2, "Unable to sign in. Please try again.")
      );
      setBusy(false);
    }
  };

  const submitMfa = async (e) => {
    e.preventDefault();
    const cleanCode = code.replace(/\D/g, "").slice(0, 6);
    if (cleanCode.length !== 6) {
      setErr("Enter the 6-digit authenticator code.");
      return;
    }
    if (!mfa?.mfaChallengeId || remaining <= 0) {
      setErr("MFA challenge has expired. Please sign in again.");
      return;
    }

    setErr("");
    setBusy(true);
    try {
      const res = await ConsoleAPI.post("/auth/superadmin/mfa/verify", {
        challengeId: mfa.mfaChallengeId,
        code: cleanCode,
      });
      completeLogin(unwrap(res) || {});
    } catch (e2) {
      const message = apiMessage(e2, "Unable to verify the authenticator code.");
      setErr(message);
      if (/expired|too many|sign in again/i.test(message)) {
        setMfa((current) => (current ? { ...current, expiresAt: Date.now() } : current));
      }
      setBusy(false);
    }
  };

  const resetToCredentials = () => {
    setMfa(null);
    setCode("");
    setQrSrc("");
    setErr("");
    setBusy(false);
  };

  const copyManualKey = async () => {
    if (!mfa?.mfaManualEntryKey || !navigator.clipboard) return;
    await navigator.clipboard.writeText(mfa.mfaManualEntryKey);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const updateCode = (value) => {
    setCode(value.replace(/\D/g, "").slice(0, 6));
  };

  const field =
    "w-full rounded-lg border border-border bg-surface py-2.5 pl-10 pr-3 text-sm text-heading " +
    "placeholder:text-muted transition-colors focus:border-accent focus:outline-none " +
    "focus-visible:ring-2 focus-visible:ring-focus";
  const isMfaStep = !!mfa?.mfaRequired;
  const remaining = mfa?.expiresAt ? Math.max(0, Math.ceil((mfa.expiresAt - now) / 1000)) : 0;
  const heading = isMfaStep
    ? mfa.mfaSetupRequired
      ? "Set up authenticator"
      : "Enter authenticator code"
    : "Sign in";
  const subcopy = isMfaStep
    ? mfa.mfaSetupRequired
      ? "Scan the code once, then enter the 6-digit code from your app."
      : "Enter the current 6-digit code from your authenticator app."
    : "Platform operators only. Every action here is audited.";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="sa-fade-in w-full max-w-md">
        <div className="mb-3 flex justify-end">
          <ThemeToggle />
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--sa-card-shadow)]">
          <div
            aria-hidden="true"
            className="h-[3px] w-full"
            style={{ backgroundImage: "var(--sa-gradient)" }}
          />

          <div className="p-8 sm:p-10">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-text">
              <ShieldCheck size={22} strokeWidth={2.2} />
            </div>

            <p className="mt-6 font-console text-[10px] uppercase tracking-[0.3em] text-accent-soft-text">
              Platform Console
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-heading">{heading}</h1>
            <p className="mt-1.5 text-sm text-body">{subcopy}</p>

            {err && (
              <div
                role="alert"
                aria-live="assertive"
                className="mt-6 rounded-lg border border-hue-rose/30 bg-hue-rose-soft px-3 py-2.5 text-sm font-medium text-hue-rose"
              >
                {err}
              </div>
            )}

            {!isMfaStep ? (
              <form onSubmit={submitCredentials} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="sa-email" className="mb-1.5 block text-xs font-semibold text-body">
                    Email
                  </label>
                  <div className="relative">
                    <Mail
                      size={15}
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                    />
                    <input
                      id="sa-email"
                      type="email"
                      autoComplete="username"
                      autoFocus
                      spellCheck="false"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="rajpoottours2789@gmail.com"
                      aria-invalid={!!err}
                      className={field}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="sa-password"
                    className="mb-1.5 block text-xs font-semibold text-body"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock
                      size={15}
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                    />
                    <input
                      id="sa-password"
                      type={show ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="********"
                      aria-invalid={!!err}
                      className={`${field} pr-10`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShow((s) => !s)}
                      aria-label={show ? "Hide password" : "Show password"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted transition-colors hover:text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    >
                      {show ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-sm font-semibold text-accent-text transition-colors hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60"
                >
                  {busy ? (
                    <Loader2 size={16} className="animate-spin motion-reduce:animate-none" />
                  ) : (
                    <ShieldCheck size={16} />
                  )}
                  {busy ? "Signing in..." : "Sign in"}
                </button>
              </form>
            ) : (
              <form onSubmit={submitMfa} className="mt-6 space-y-5">
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-page px-3.5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-heading">{mfa.email}</p>
                    <p className="mt-0.5 text-xs text-body">
                      Challenge expires in {formatRemaining(remaining)}
                    </p>
                  </div>
                  <KeyRound size={18} className="shrink-0 text-accent-soft-text" aria-hidden="true" />
                </div>

                {mfa.mfaSetupRequired && (
                  <div className="space-y-4">
                    <div className="flex flex-col items-center rounded-lg border border-border bg-white p-4">
                      {qrSrc ? (
                        <img
                          src={qrSrc}
                          alt="Authenticator setup QR code"
                          className="h-48 w-48 rounded-md"
                        />
                      ) : (
                        <div className="flex h-48 w-48 items-center justify-center rounded-md bg-page text-sm text-body">
                          Preparing QR code
                        </div>
                      )}
                    </div>

                    <div className="rounded-lg border border-border bg-page px-3.5 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                          Manual key
                        </p>
                        <button
                          type="button"
                          onClick={copyManualKey}
                          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-accent-soft-text transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                        >
                          {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                          {copied ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <p className="mt-2 break-all font-console text-xs leading-relaxed text-heading">
                        {mfa.mfaManualEntryKey}
                      </p>
                      {mfa.mfaOtpAuthUri && (
                        <a
                          href={mfa.mfaOtpAuthUri}
                          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-accent-soft-text underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                        >
                          <Smartphone size={14} aria-hidden="true" />
                          Open authenticator app
                        </a>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="sa-mfa-code" className="mb-1.5 block text-xs font-semibold text-body">
                    Authenticator code
                  </label>
                  <div className="relative">
                    <ShieldCheck
                      size={15}
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                    />
                    <input
                      id="sa-mfa-code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      autoFocus
                      value={code}
                      onChange={(e) => updateCode(e.target.value)}
                      placeholder="000000"
                      aria-invalid={!!err}
                      className={`${field} pr-3 font-console text-base tracking-[0.28em]`}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr]">
                  <button
                    type="button"
                    onClick={resetToCredentials}
                    disabled={busy}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm font-semibold text-body transition-colors hover:text-heading focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-60"
                  >
                    <ArrowLeft size={16} />
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={busy || remaining <= 0}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-sm font-semibold text-accent-text transition-colors hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60"
                  >
                    {busy ? (
                      <Loader2 size={16} className="animate-spin motion-reduce:animate-none" />
                    ) : (
                      <ShieldCheck size={16} />
                    )}
                    {busy ? "Verifying..." : "Verify and enter console"}
                  </button>
                </div>
              </form>
            )}

            {!isMfaStep && (
              <div className="mt-7 flex items-start gap-2.5 rounded-lg border border-border bg-page px-3.5 py-3">
                <Building2 size={15} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
                <p className="text-xs leading-relaxed text-body">
                  Agency staff sign in from their own workspace URL, not here.{" "}
                  <Link
                    to="/login"
                    className="font-semibold text-accent-soft-text underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    Go to the workspace login
                  </Link>
                </p>
              </div>
            )}
          </div>
        </div>

        <p className="mt-6 text-center font-console text-[9px] uppercase tracking-[0.28em] text-muted">
          Restricted access - All actions audited
        </p>
      </div>
    </div>
  );
}

export default function ConsoleLogin() {
  return (
    <ConsoleThemeProvider>
      <ConsoleLoginView />
    </ConsoleThemeProvider>
  );
}
