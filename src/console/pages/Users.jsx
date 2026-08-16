import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Lock,
  Unlock,
  KeyRound,
  UserCog,
  Users as UsersIcon,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { userService } from "../api/userService";
import { isLocalSuperAdminMfaDisabled } from "../lib/consoleEnvironment";
import { clearMyPermissions, clearMyEntitlements, primeSessionCaches } from "@shared/lib/access";

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus";

function apiMessage(error, fallback) {
  return error?.response?.data?.message || fallback;
}

function UserStatusPill({ user }) {
  const cls = user.locked
    ? "bg-red-500/10 text-red-600 ring-red-500/20"
    : !user.active
      ? "bg-slate-500/10 text-slate-500 ring-slate-500/20"
      : "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20";
  const label = user.locked ? "Locked" : !user.active ? "Inactive" : "Active";
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-semibold uppercase ring-1 ${cls}`}>
      {label}
    </span>
  );
}

function MfaActionModal({ title, description, saving, error, onClose, onConfirm }) {
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
          <label htmlFor="mfa-action-code" className="mb-1 block text-xs font-semibold text-body">
            Authenticator code
          </label>
          <input
            id="mfa-action-code"
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
            Confirm
          </button>
        </div>
      </form>
    </div>
  );
}

function ResetPasswordModal({ user, onClose, onDone, showToast }) {
  const [pw, setPw] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [saving, setSaving] = useState(false);
  const mfaDisabled = isLocalSuperAdminMfaDisabled();

  const submit = async (e) => {
    e.preventDefault();
    if (pw.length < 12) {
      showToast("error", "Password must be at least 12 characters.");
      return;
    }
    if (!mfaDisabled && !/^\d{6}$/.test(mfaCode)) {
      showToast("error", "Enter the 6-digit authenticator code.");
      return;
    }
    setSaving(true);
    try {
      await userService.resetPassword(user.publicId, pw, mfaDisabled ? "" : mfaCode);
      showToast("success", `Password reset for ${user.email}`);
      onDone();
    } catch (e2) {
      showToast("error", apiMessage(e2, "Reset failed."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50" onClick={saving ? undefined : onClose} />
      <form
        onSubmit={submit}
        className="relative w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-xl"
      >
        <h3 className="text-sm font-bold text-heading">Reset password - {user.name}</h3>
        <p className="mt-1 text-xs text-muted">{user.email}</p>
        <div className="mt-4 space-y-3">
          {!mfaDisabled && <div>
            <label className="mb-1 block text-xs font-semibold text-body">New password</label>
            <input
              type="password"
              autoFocus
              className={inputCls}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="12+ chars with symbol"
              required
            />
          </div>}
          <div>
            <label className="mb-1 block text-xs font-semibold text-body">
              Authenticator code
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              className={inputCls}
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              required
            />
          </div>
        </div>
        <p className="mt-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-700 ring-1 ring-emerald-500/20">
          The user's active sessions are revoked immediately.
        </p>
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
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-text hover:bg-accent-hover disabled:opacity-60"
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            Reset password
          </button>
        </div>
      </form>
    </div>
  );
}

function IconBtn({ title, onClick, busy, children }) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={busy}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-hover hover:text-body disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export default function Users() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tenantId = searchParams.get("tenantId") || "";
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(0);
  const [busyId, setBusyId] = useState(null);
  const [resetUser, setResetUser] = useState(null);
  const [mfaAction, setMfaAction] = useState(null);
  const [mfaError, setMfaError] = useState("");
  const [toast, setToast] = useState(null);

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg, id: Date.now() });
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebounced(search);
      setPage(0);
    }, 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await userService.list({ search: debounced, tenantId, page, size: 20 });
      setRows(result.rows);
      setPagination(result.pagination);
    } catch (e) {
      setError(apiMessage(e, "Failed to load users."));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [debounced, page, tenantId]);

  useEffect(() => {
    const id = window.setTimeout(load, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const openMfaAction = (type, user) => {
    setMfaError("");
    setMfaAction({ type, user });
  };

  const actionCopy = (action) => {
    if (!action) return { title: "", description: "" };
    const email = action.user.email;
    if (action.type === "impersonate") {
      return {
        title: "Confirm impersonation",
        description: `Enter your authenticator code to open a session as ${email}.`,
      };
    }
    if (action.type === "unlock") {
      return {
        title: "Confirm unlock",
        description: `Enter your authenticator code to unlock ${email}.`,
      };
    }
    return {
      title: "Confirm lock",
      description: `Enter your authenticator code to lock ${email}.`,
    };
  };

  const confirmMfaAction = async (mfaCode) => {
    const action = mfaAction;
    if (!action) return;
    const user = action.user;
    setBusyId(user.publicId);
    setMfaError("");
    try {
      if (action.type === "impersonate") {
        const data = await userService.impersonate(user.publicId, mfaCode);
        localStorage.setItem("token", data.token);
        localStorage.setItem("userEmail", data.email);
        localStorage.setItem("userRole", data.role);
        localStorage.setItem(
          "impersonation",
          JSON.stringify({
            name: data.name,
            email: data.email,
            tenantName: data.tenantName,
            tenantCode: data.tenantCode,
            startedAt: Date.now(),
          })
        );
        clearMyPermissions();
        clearMyEntitlements();
        await primeSessionCaches(data.token);
        window.open("/", "_blank", "noopener");
        showToast("success", `Opened a session as ${user.email}`);
      } else {
        const lock = action.type === "lock";
        await (lock
          ? userService.lock(user.publicId, mfaCode)
          : userService.unlock(user.publicId, mfaCode));
        showToast("success", lock ? `Locked ${user.email}` : `Unlocked ${user.email}`);
        await load();
      }
      setMfaAction(null);
    } catch (e) {
      setMfaError(apiMessage(e, "Action failed."));
    } finally {
      setBusyId(null);
    }
  };

  const totalPages = pagination.totalPages ?? 1;
  const copy = actionCopy(mfaAction);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-heading">Users</h1>
        <p className="text-sm text-body">Cross-tenant user control - lock, unlock, impersonate, and reset passwords.</p>
        {tenantId && (
          <button type="button" onClick={() => { setSearchParams({}); setPage(0); }}
            className="mt-2 rounded-full border border-accent/30 bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent hover:opacity-80">
            Tenant filter active · clear
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email..."
            className={`${inputCls} pl-9`}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-border bg-surface-hover text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Tenant</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted">
                    <Loader2 size={18} className="mx-auto animate-spin" />
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-red-500">{error}</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted">
                    <UsersIcon size={28} className="mx-auto mb-2 opacity-50" />
                    No users found.
                  </td>
                </tr>
              ) : (
                rows.map((u) => {
                  const busy = busyId === u.publicId;
                  return (
                    <tr key={u.publicId} className="hover:bg-surface-hover/60">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-heading">{u.name}</div>
                        <div className="text-xs text-muted">{u.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-body">{u.tenantName || "-"}</div>
                        <div className="font-mono text-xs text-muted">{u.tenantCode || "-"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-surface-hover px-2 py-0.5 font-mono text-xs text-body">{u.role}</span>
                      </td>
                      <td className="px-4 py-3"><UserStatusPill user={u} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {!u.locked && u.active && (
                            <IconBtn title="Impersonate" onClick={() => openMfaAction("impersonate", u)} busy={busy}>
                              <UserCog size={16} className="text-accent" />
                            </IconBtn>
                          )}
                          {u.locked ? (
                            <IconBtn title="Unlock" onClick={() => openMfaAction("unlock", u)} busy={busy}>
                              <Unlock size={16} className="text-emerald-500" />
                            </IconBtn>
                          ) : (
                            <IconBtn title="Lock" onClick={() => openMfaAction("lock", u)} busy={busy}>
                              <Lock size={16} className="text-amber-500" />
                            </IconBtn>
                          )}
                          <IconBtn title="Reset password" onClick={() => setResetUser(u)} busy={busy}>
                            <KeyRound size={16} />
                          </IconBtn>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
            <span className="text-muted">Page {page + 1} of {totalPages}</span>
            <div className="flex gap-1">
              <button
                disabled={page <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-strong text-body hover:bg-surface-hover disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-strong text-body hover:bg-surface-hover disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {resetUser && (
        <ResetPasswordModal
          user={resetUser}
          onClose={() => setResetUser(null)}
          onDone={() => {
            setResetUser(null);
            load();
          }}
          showToast={showToast}
        />
      )}

      {mfaAction && (
        <MfaActionModal
          title={copy.title}
          description={copy.description}
          saving={busyId === mfaAction.user.publicId}
          error={mfaError}
          onClose={() => setMfaAction(null)}
          onConfirm={confirmMfaAction}
        />
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[60] flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-lg ${
          toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
        }`}>
          {toast.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
