import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Copy,
  KeyRound,
  Loader2,
  LockKeyhole,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserCog,
} from "lucide-react";

import superAdminInviteService from "../api/superAdminInviteService";

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading " +
  "placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus";

function apiMessage(error, fallback) {
  return error?.response?.data?.message || fallback;
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function isPendingInvite(invite) {
  return !invite.consumedAt && invite.expiresAt && new Date(invite.expiresAt).getTime() > Date.now();
}

function Pill({ tone = "slate", children }) {
  const tones = {
    green: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-700 ring-amber-500/20",
    red: "bg-red-500/10 text-red-700 ring-red-500/20",
    violet: "bg-accent-soft text-accent-soft-text ring-accent/20",
    slate: "bg-surface-hover text-body ring-border",
  };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ${tones[tone]}`}>
      {children}
    </span>
  );
}

function accountSecurityTone(account) {
  if (!account.enabled || account.locked) return "red";
  if (!account.setupComplete) return "amber";
  return "green";
}

function accountSecurityLabel(account) {
  if (!account.enabled) return "Disabled";
  if (account.locked) return "Locked";
  if (!account.mfaEnabled) return "MFA pending";
  if (account.mustChangePassword) return "Password change pending";
  return "Ready";
}

function MfaActionModal({ title, description, confirmLabel, saving, error, onClose, onConfirm }) {
  const [code, setCode] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return;
    onConfirm(code);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50" onClick={saving ? undefined : onClose} />
      <form
        onSubmit={submit}
        className="relative w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-xl"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-accent" />
          <h3 className="text-sm font-bold text-heading">{title}</h3>
        </div>
        <p className="mt-1 text-xs text-muted">{description}</p>
        <div className="mt-4">
          <label htmlFor="superadmin-mfa-action-code" className="mb-1 block text-xs font-semibold text-body">
            Authenticator code
          </label>
          <input
            id="superadmin-mfa-action-code"
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
        {error && (
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-[11px] text-red-700 ring-1 ring-red-500/20">
            <AlertTriangle size={13} className="mt-px shrink-0" />
            {error}
          </p>
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
            disabled={saving || code.length !== 6}
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

export default function SuperAdmins() {
  const [accounts, setAccounts] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [created, setCreated] = useState(null);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mfaAction, setMfaAction] = useState(null);
  const [mfaError, setMfaError] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async (withSpinner = false) => {
    if (withSpinner) setLoading(true);
    try {
      const [accountRows, inviteRows] = await Promise.all([
        superAdminInviteService.listAccounts(),
        superAdminInviteService.list(),
      ]);
      setAccounts(accountRows || []);
      setInvites(inviteRows || []);
    } catch (err) {
      setError(apiMessage(err, "Unable to load SuperAdmins."));
      setAccounts([]);
      setInvites([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => load(false), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const stats = useMemo(() => {
    const pendingInvites = invites.filter(isPendingInvite).length;
    return [
      { label: "Accounts", value: accounts.length, Icon: UserCog },
      { label: "Setup complete", value: accounts.filter((a) => a.setupComplete).length, Icon: ShieldCheck },
      { label: "Pending setup", value: accounts.filter((a) => !a.setupComplete).length, Icon: Clock3 },
      { label: "Locked", value: accounts.filter((a) => a.locked).length, Icon: LockKeyhole },
      { label: "Pending invites", value: pendingInvites, Icon: Plus },
    ];
  }, [accounts, invites]);

  const create = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setCreated(null);
    setMfaError("");
    setMfaAction({
      type: "invite",
      payload: { name: name.trim(), email: email.trim() },
    });
  };

  const openResetMfa = (account) => {
    setError("");
    setNotice("");
    setMfaError("");
    setMfaAction({ type: "resetMfa", account });
  };

  const actionCopy = (action) => {
    if (!action) return { title: "", description: "", confirmLabel: "Confirm" };
    if (action.type === "invite") {
      return {
        title: "Confirm invite",
        description: `Enter your authenticator code to invite ${action.payload.email}.`,
        confirmLabel: "Create invite",
      };
    }
    return {
      title: "Reset MFA",
      description: `Enter your authenticator code to reset MFA for ${action.account.email}.`,
      confirmLabel: "Reset MFA",
    };
  };

  const confirmMfaAction = async (mfaCode) => {
    const action = mfaAction;
    if (!action) return;
    setMfaError("");

    if (action.type === "invite") {
      setBusy(true);
      try {
        const invite = await superAdminInviteService.create(action.payload, mfaCode);
        setCreated(invite);
        setName("");
        setEmail("");
        setNotice(`Invite created for ${action.payload.email}.`);
        setMfaAction(null);
        await load(false);
      } catch (err) {
        setMfaError(apiMessage(err, "Unable to create invite."));
      } finally {
        setBusy(false);
      }
      return;
    }

    const account = action.account;
    setBusyId(account.publicId);
    try {
      await superAdminInviteService.resetMfa(account.publicId, mfaCode);
      setNotice(`MFA reset for ${account.email}. They must re-enroll authenticator on next login.`);
      setMfaAction(null);
      await load(false);
    } catch (err) {
      setMfaError(apiMessage(err, "Unable to reset MFA."));
    } finally {
      setBusyId(null);
    }
  };

  const copyInvite = async () => {
    const value = created?.acceptUrl || created?.token;
    if (!value || !navigator.clipboard) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const copy = actionCopy(mfaAction);
  const actionSaving = mfaAction?.type === "invite" ? busy : busyId === mfaAction?.account?.publicId;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-heading">SuperAdmins</h1>
          <p className="text-sm text-body">Platform operators, setup state, and invite-only access.</p>
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-body hover:bg-surface-hover disabled:opacity-60"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          Refresh
        </button>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map(({ label, value, Icon }) => (
          <div key={label} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{label}</span>
              <Icon size={16} className="text-accent" />
            </div>
            <p className="mt-3 font-console text-2xl font-bold text-heading">{value}</p>
          </div>
        ))}
      </section>

      {error && (
        <p className="flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 ring-1 ring-red-500/20">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      {notice && (
        <p className="flex items-start gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-500/20">
          <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
          {notice}
        </p>
      )}

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <UserCog size={17} className="text-accent" />
          <h2 className="text-sm font-bold text-heading">Accounts</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="border-b border-border bg-surface-hover text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Operator</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Security</th>
                <th className="px-4 py-3 font-semibold">Failures</th>
                <th className="px-4 py-3 font-semibold">Last login</th>
                <th className="px-4 py-3 font-semibold">Last IP</th>
                <th className="px-4 py-3 font-semibold">Created</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted">
                    <Loader2 size={18} className="mx-auto animate-spin" />
                  </td>
                </tr>
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted">
                    No SuperAdmin accounts.
                  </td>
                </tr>
              ) : (
                accounts.map((account) => (
                  <tr key={account.publicId} className="hover:bg-surface-hover/60">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-heading">{account.name}</p>
                      <p className="font-mono text-xs text-muted">{account.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Pill tone={account.createdViaInvite ? "violet" : "slate"}>
                        {account.createdViaInvite ? "Invite" : "Fixed"}
                      </Pill>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <Pill tone={accountSecurityTone(account)}>{accountSecurityLabel(account)}</Pill>
                        {account.mfaEnabled && <Pill tone="green">MFA</Pill>}
                      </div>
                      {account.lockedUntil && (
                        <p className="mt-1 text-xs text-muted">Until {formatDate(account.lockedUntil)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-body">{account.failedLoginAttempts ?? 0}</td>
                    <td className="px-4 py-3 font-mono text-xs text-body">{formatDate(account.lastLoginAt)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-body">{account.lastLoginIp || "-"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-body">{formatDate(account.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        {account.mfaEnabled ? (
                          <button
                            type="button"
                            title="Reset MFA"
                            onClick={() => openResetMfa(account)}
                            disabled={busyId === account.publicId}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-hover hover:text-body disabled:opacity-50"
                          >
                            {busyId === account.publicId ? (
                              <Loader2 size={15} className="animate-spin" />
                            ) : (
                              <KeyRound size={16} className="text-accent" />
                            )}
                          </button>
                        ) : (
                          <span className="text-xs text-muted">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck size={17} className="text-accent" />
          <h2 className="text-sm font-bold text-heading">Create invite</h2>
        </div>
        <form onSubmit={create} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            required
          />
          <input
            className={inputCls}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            required
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-text hover:bg-accent-hover disabled:opacity-60"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Invite
          </button>
        </form>

        {created && (
          <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-heading">Invite token created</p>
                <p className="mt-1 break-all font-mono text-xs text-body">{created.acceptUrl || created.token}</p>
              </div>
              <button
                type="button"
                onClick={copyInvite}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-body hover:bg-surface-hover"
              >
                {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-bold text-heading">Recent invites</h2>
        </div>
        {invites.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted">No invites.</div>
        ) : (
          <ul className="divide-y divide-border">
            {invites.map((invite) => {
              const pending = isPendingInvite(invite);
              const expired = !invite.consumedAt && invite.expiresAt && !pending;
              return (
                <li key={invite.publicId} className="grid gap-2 px-4 py-3 md:grid-cols-[1fr_auto]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-heading">{invite.name}</p>
                    <p className="truncate font-mono text-xs text-muted">{invite.email}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <Pill tone={invite.consumedAt ? "green" : expired ? "red" : "amber"}>
                      {invite.consumedAt ? "Accepted" : expired ? "Expired" : "Pending"}
                    </Pill>
                    <span>Expires {formatDate(invite.expiresAt)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {mfaAction && (
        <MfaActionModal
          title={copy.title}
          description={copy.description}
          confirmLabel={copy.confirmLabel}
          saving={actionSaving}
          error={mfaError}
          onClose={() => (actionSaving ? undefined : setMfaAction(null))}
          onConfirm={confirmMfaAction}
        />
      )}
    </div>
  );
}
