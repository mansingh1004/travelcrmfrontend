import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Copy,
  KeyRound,
  Loader2,
  LockKeyhole,
  LogOut,
  Plus,
  Power,
  RefreshCw,
  Send,
  ShieldCheck,
  Unlock,
  UserCog,
} from "lucide-react";

import superAdminInviteService from "../api/superAdminInviteService";
import { isLocalSuperAdminMfaDisabled } from "../lib/consoleEnvironment";
import { ConsoleTable } from "../components/ConsoleTable";

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
  const mfaDisabled = isLocalSuperAdminMfaDisabled();

  const submit = (e) => {
    e.preventDefault();
    if (!mfaDisabled && !/^\d{6}$/.test(code)) return;
    onConfirm(mfaDisabled ? "" : code);
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
        <p className="mt-1 text-xs text-muted">
          {mfaDisabled ? "MFA is disabled for local development. Confirm to continue." : description}
        </p>
        {!mfaDisabled && <div className="mt-4">
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
        </div>}
        {mfaDisabled && (
          <p className="mt-4 rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700 ring-1 ring-amber-500/20">
            Local development bypass active
          </p>
        )}
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

export default function SuperAdmins() {
  const [accounts, setAccounts] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("PLATFORM_ADMIN");
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
  const permanentSuperAdminCount = accounts.filter((account) => account.role === "SUPER_ADMIN").length;
  const superAdminSeatsFull = permanentSuperAdminCount >= 2;

  const accountColumns = [
    {
      id: "operator",
      header: "Operator",
      accessorKey: "name",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-heading">{row.original.name}</p>
          <p className="truncate font-mono text-[11px] text-muted">{row.original.email}</p>
        </div>
      ),
    },
    {
      id: "type",
      header: "Type",
      accessorKey: "createdViaInvite",
      cell: ({ row }) => (
        <Pill tone={row.original.createdViaInvite ? "violet" : "slate"}>
          {row.original.createdViaInvite ? "Invite" : "Fixed"}
        </Pill>
      ),
    },
    {
      id: "role",
      header: "Role",
      accessorKey: "role",
      cell: ({ row }) => row.original.role === "SUPER_ADMIN" ? (
        <div>
          <Pill tone="violet">Permanent SuperAdmin</Pill>
          <p className="mt-1 text-[11px] text-muted">Role locked</p>
        </div>
      ) : (
        <select value={row.original.role || "PLATFORM_ADMIN"}
          onChange={(event) => openAccountAction("role", row.original, { role: event.target.value })}
          disabled={busyId === row.original.publicId}
          className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs font-semibold text-body focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus">
          <option value="PLATFORM_ADMIN">Platform Admin</option>
          <option value="SUPER_ADMIN" disabled={superAdminSeatsFull}>
            {superAdminSeatsFull ? "SuperAdmin (2/2 assigned)" : "SuperAdmin"}
          </option>
        </select>
      ),
    },
    {
      id: "security",
      header: "Security",
      accessorKey: "enabled",
      cell: ({ row }) => (
        <div>
          <div className="flex flex-wrap gap-1.5">
            <Pill tone={accountSecurityTone(row.original)}>{accountSecurityLabel(row.original)}</Pill>
            {row.original.mfaEnabled && <Pill tone="green">MFA</Pill>}
          </div>
          {row.original.lockedUntil && (
            <p className="mt-1 text-xs text-muted">Until {formatDate(row.original.lockedUntil)}</p>
          )}
        </div>
      ),
    },
    { id: "failures", header: "Failures", accessorKey: "failedLoginAttempts", meta: { numeric: true },
      cell: ({ row }) => <span className="text-xs text-body">{row.original.failedLoginAttempts ?? 0}</span> },
    { id: "lastLogin", header: "Last login", accessorKey: "lastLoginAt",
      cell: ({ row }) => <span className="font-mono text-xs text-body">{formatDate(row.original.lastLoginAt)}</span> },
    { id: "lastIp", header: "Last IP", accessorKey: "lastLoginIp",
      cell: ({ row }) => <span className="font-mono text-xs text-body">{row.original.lastLoginIp || "—"}</span> },
    { id: "created", header: "Created", accessorKey: "createdAt",
      cell: ({ row }) => <span className="font-mono text-xs text-body">{formatDate(row.original.createdAt)}</span> },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      meta: { numeric: true },
      cell: ({ row }) => {
        const account = row.original;
        const busy = busyId === account.publicId;
        return (
          <div className="flex items-center justify-end gap-1">
            {account.mfaEnabled && (
              <button type="button" title="Reset MFA" onClick={() => openResetMfa(account)} disabled={busy}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-hover hover:text-body disabled:opacity-50">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={16} className="text-accent" />}
              </button>
            )}
            {account.locked && (
              <button type="button" title="Unlock account" aria-label="Unlock account"
                onClick={() => openAccountAction("unlock", account)} disabled={busy}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-hue-emerald hover:bg-surface-hover disabled:opacity-50">
                <Unlock size={15} />
              </button>
            )}
            <button type="button" title="Revoke all sessions" aria-label="Revoke all sessions"
              onClick={() => openAccountAction("revokeSessions", account)} disabled={busy}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-hover hover:text-body disabled:opacity-50">
              <LogOut size={15} />
            </button>
            <button type="button" title={account.enabled ? "Disable account" : "Enable account"}
              aria-label={account.enabled ? "Disable account" : "Enable account"}
              onClick={() => openAccountAction(account.enabled ? "disable" : "enable", account)} disabled={busy}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-hover disabled:opacity-50 ${account.enabled ? "text-hue-rose" : "text-hue-emerald"}`}>
              <Power size={15} />
            </button>
          </div>
        );
      },
    },
  ];

  const create = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setCreated(null);
    setMfaError("");
    setMfaAction({
      type: "invite",
      payload: { name: name.trim(), email: email.trim(), role },
    });
  };

  const openResetMfa = (account) => {
    setError("");
    setNotice("");
    setMfaError("");
    setMfaAction({ type: "resetMfa", account });
  };

  const openAccountAction = (type, account, extra = {}) => {
    setError("");
    setNotice("");
    setMfaError("");
    setMfaAction({ type, account, ...extra });
  };

  const openInviteAction = (type, invite) => {
    setError("");
    setNotice("");
    setMfaError("");
    setMfaAction({ type, invite });
  };

  const actionCopy = (action) => {
    if (!action) return { title: "", description: "", confirmLabel: "Confirm" };
    const copyByType = {
      invite: {
        title: "Confirm invite",
        description: `Invite ${action.payload?.email} as ${action.payload?.role === "SUPER_ADMIN" ? "SuperAdmin" : "Platform Admin"}.`,
        confirmLabel: "Create invite",
      },
      resetMfa: { title: "Reset MFA", description: `Reset MFA for ${action.account?.email}.`, confirmLabel: "Reset MFA" },
      role: { title: "Change operator role", description: `Change ${action.account?.email} to ${action.role === "SUPER_ADMIN" ? "SuperAdmin" : "Platform Admin"}. Existing sessions will be revoked.`, confirmLabel: "Change role" },
      enable: { title: "Enable operator", description: `Restore console access for ${action.account?.email}.`, confirmLabel: "Enable" },
      disable: { title: "Disable operator", description: `Block console access and revoke sessions for ${action.account?.email}.`, confirmLabel: "Disable" },
      unlock: { title: "Unlock operator", description: `Clear failed login attempts and the lock for ${action.account?.email}.`, confirmLabel: "Unlock" },
      revokeSessions: { title: "Revoke sessions", description: `Sign ${action.account?.email} out from every active session.`, confirmLabel: "Revoke sessions" },
      resendInvite: { title: "Resend invite", description: `Rotate the invite token for ${action.invite?.email}.`, confirmLabel: "Resend" },
      revokeInvite: { title: "Revoke invite", description: `Permanently invalidate the pending invite for ${action.invite?.email}.`, confirmLabel: "Revoke invite" },
    };
    return copyByType[action.type] || { title: "Confirm action", description: "Confirm this account action.", confirmLabel: "Confirm" };
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
    const invite = action.invite;
    const targetId = account?.publicId || invite?.publicId;
    setBusyId(targetId);
    try {
      let message = "Action completed.";
      if (action.type === "resetMfa") {
        await superAdminInviteService.resetMfa(account.publicId, mfaCode);
        message = `MFA reset for ${account.email}. Re-enrollment is required.`;
      } else if (action.type === "role") {
        await superAdminInviteService.changeRole(account.publicId, action.role, mfaCode);
        message = `${account.email} is now ${action.role === "SUPER_ADMIN" ? "SuperAdmin" : "Platform Admin"}.`;
      } else if (action.type === "enable" || action.type === "disable") {
        await superAdminInviteService.setEnabled(account.publicId, action.type === "enable", mfaCode);
        message = `${account.email} ${action.type === "enable" ? "enabled" : "disabled"}.`;
      } else if (action.type === "unlock") {
        await superAdminInviteService.unlock(account.publicId, mfaCode);
        message = `${account.email} unlocked.`;
      } else if (action.type === "revokeSessions") {
        await superAdminInviteService.revokeSessions(account.publicId, mfaCode);
        message = `All sessions revoked for ${account.email}.`;
      } else if (action.type === "resendInvite") {
        const nextInvite = await superAdminInviteService.resendInvite(invite.publicId, mfaCode);
        setCreated(nextInvite);
        message = `A new invite link was created for ${invite.email}.`;
      } else if (action.type === "revokeInvite") {
        await superAdminInviteService.revokeInvite(invite.publicId, mfaCode);
        message = `Invite revoked for ${invite.email}.`;
      }
      setNotice(message);
      setMfaAction(null);
      await load(false);
    } catch (err) {
      setMfaError(apiMessage(err, "Unable to complete the account action."));
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
  const actionTargetId = mfaAction?.account?.publicId || mfaAction?.invite?.publicId;
  const actionSaving = mfaAction?.type === "invite" ? busy : busyId === actionTargetId;

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

      <div>
        <ConsoleTable
          columns={accountColumns}
          rows={accounts}
          state={loading ? "loading" : "ready"}
          emptyTitle="No SuperAdmin accounts"
          emptyHint="Invite a platform operator to get started."
        />
      </div>

      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck size={17} className="text-accent" />
          <h2 className="text-sm font-bold text-heading">Create invite</h2>
        </div>
        <form onSubmit={create} className="grid gap-3 md:grid-cols-[1fr_1fr_180px_auto]">
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
          <select
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className={inputCls}
            aria-label="Platform role"
          >
            <option value="PLATFORM_ADMIN">Platform Admin</option>
            <option value="SUPER_ADMIN" disabled={superAdminSeatsFull}>
              {superAdminSeatsFull ? "SuperAdmin (2/2 assigned)" : "SuperAdmin"}
            </option>
          </select>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-text hover:bg-accent-hover disabled:opacity-60"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Invite
          </button>
        </form>
        <p className="mt-2 text-[11px] text-muted">
          {permanentSuperAdminCount}/2 permanent SuperAdmin seats assigned. Additional operators are invited as Platform Admins.
        </p>

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
                    <Pill tone={invite.role === "SUPER_ADMIN" ? "violet" : "slate"}>
                      {invite.role === "SUPER_ADMIN" ? "SuperAdmin" : "Platform Admin"}
                    </Pill>
                    <Pill tone={invite.consumedAt ? "green" : expired ? "red" : "amber"}>
                      {invite.consumedAt ? "Accepted" : expired ? "Expired" : "Pending"}
                    </Pill>
                    <span>Expires {formatDate(invite.expiresAt)}</span>
                    {!invite.consumedAt && (
                      <>
                        <button
                          type="button"
                          onClick={() => openInviteAction("resendInvite", invite)}
                          disabled={busyId === invite.publicId}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 font-semibold text-body hover:bg-surface-hover disabled:opacity-50"
                        >
                          <Send size={12} /> Resend
                        </button>
                        <button
                          type="button"
                          onClick={() => openInviteAction("revokeInvite", invite)}
                          disabled={busyId === invite.publicId}
                          className="inline-flex items-center gap-1 rounded-lg border border-hue-rose/30 px-2 py-1 font-semibold text-hue-rose hover:bg-hue-rose-soft disabled:opacity-50"
                        >
                          <Power size={12} /> Revoke
                        </button>
                      </>
                    )}
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
