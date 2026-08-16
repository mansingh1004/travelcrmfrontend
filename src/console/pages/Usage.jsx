import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Building2, Users, CalendarClock, HardDrive, AlertTriangle,
  Loader2, SlidersHorizontal, RotateCcw, X, Lock, Layers3,
} from "lucide-react";
import { usageService } from "../api/usageService";
import SuperAdminMfaActionModal from "../components/SuperAdminMfaActionModal";

// Full literal hue classes so Tailwind's scanner emits them (dynamic `bg-hue-${x}` would NOT be).
const HUE = {
  indigo:  "bg-hue-indigo-soft text-hue-indigo",
  emerald: "bg-hue-emerald-soft text-hue-emerald",
  amber:   "bg-hue-amber-soft text-hue-amber",
  sky:     "bg-hue-sky-soft text-hue-sky",
  violet:  "bg-hue-violet-soft text-hue-violet",
  rose:    "bg-hue-rose-soft text-hue-rose",
};
const STATUS_CLS = {
  ACTIVE:    "bg-hue-emerald-soft text-hue-emerald",
  TRIAL:     "bg-hue-amber-soft text-hue-amber",
  PAST_DUE:  "bg-hue-amber-soft text-hue-amber",
  SUSPENDED: "bg-hue-rose-soft text-hue-rose",
  EXPIRED:   "bg-surface-hover text-muted",
};
const PLAN_CLS = {
  STARTER:    "bg-hue-sky-soft text-hue-sky",
  PRO:        "bg-hue-violet-soft text-hue-violet",
  ENTERPRISE: "bg-hue-indigo-soft text-hue-indigo",
  FLEET:      "bg-hue-emerald-soft text-hue-emerald",
};

function formatBytes(bytes) {
  const b = Number(bytes || 0);
  if (b < 1024) return `${b} B`;
  const kb = b / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function Tile({ label, value, Icon, hue = "violet", valueTone }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--sa-card-shadow)] transition-transform duration-200 hover:-translate-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted">{label}</span>
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${HUE[hue]}`}>
          <Icon size={16} strokeWidth={2.2} />
        </span>
      </div>
      <div className={`mt-3 font-mono text-2xl font-bold ${valueTone || "text-heading"}`}>{value}</div>
    </div>
  );
}

function Chip({ text, cls }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {text}
    </span>
  );
}

/** A used-vs-limit meter. `percent === null` means unlimited. */
function UsageBar({ usedText, limitText, percent, over, near }) {
  const unlimited = percent == null;
  const barColor = over ? "bg-hue-rose" : near ? "bg-hue-amber" : "bg-hue-emerald";
  const textTone = over ? "text-hue-rose" : near ? "text-hue-amber" : "text-body";
  const width = unlimited ? 0 : Math.min(percent, 100);
  return (
    <div className="min-w-[9.5rem]">
      <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
        <span className={`font-mono font-semibold ${textTone}`}>{usedText}</span>
        <span className="font-mono text-muted">/ {unlimited ? "∞" : limitText}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
        {unlimited ? (
          <div className="h-full w-full bg-hue-emerald-soft" />
        ) : (
          <div className={`h-full rounded-full ${barColor} transition-[width] duration-300`}
            style={{ width: `${width}%` }} />
        )}
      </div>
    </div>
  );
}

function Field({ label, hint, value, onChange, placeholder, min = "1" }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-body">{label}</span>
      <input
        type="number" min={min} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading outline-none focus:ring-2 focus:ring-focus"
      />
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </label>
  );
}

function OverrideModal({ tenant, onClose, onSaved }) {
  const [users, setUsers] = useState(tenant.maxUsers ?? "");
  const [leads, setLeads] = useState(tenant.maxLeads ?? "");
  const [bookings, setBookings] = useState(tenant.maxBookingsPerMonth ?? "");
  const [storage, setStorage] = useState(tenant.maxStorageMb ?? "");
  const [subAgents, setSubAgents] = useState(tenant.maxSubAgents ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [pendingPayload, setPendingPayload] = useState(null);
  const [mfaError, setMfaError] = useState("");

  const submit = async () => {
    const payload = {};
    if (String(users) !== "") payload.maxUsers = Number(users);
    if (String(leads) !== "") payload.maxLeads = Number(leads);
    if (String(bookings) !== "") payload.maxBookingsPerMonth = Number(bookings);
    if (String(storage) !== "") payload.maxStorageMb = Number(storage);
    if (String(subAgents) !== "") payload.maxSubAgents = Number(subAgents);
    if (Object.keys(payload).length === 0) {
      setErr("Enter at least one limit, or use “Revert to plan”.");
      return;
    }
    requestRun(payload);
  };

  const revert = () => requestRun({ clearOverride: true });

  const requestRun = (payload) => {
    setErr("");
    setMfaError("");
    setPendingPayload(payload);
  };

  const run = async (mfaCode) => {
    if (!pendingPayload) return;
    setBusy(true);
    setErr("");
    setMfaError("");
    try {
      await usageService.overrideQuota(tenant.tenantPublicId, pendingPayload, mfaCode);
      onSaved();
    } catch (e) {
      setMfaError(e?.response?.data?.message || "Failed to update quota.");
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={busy || pendingPayload ? undefined : onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-[var(--sa-card-shadow)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-heading">Adjust quota</h3>
            <p className="mt-0.5 text-xs text-body">{tenant.organizationName}</p>
          </div>
          <button onClick={onClose} disabled={busy} className="rounded-lg p-1 text-muted hover:bg-surface-hover hover:text-heading disabled:opacity-40">
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <Field label="Max users" value={users} onChange={setUsers} placeholder="e.g. 20" />
          <Field label="Max leads" value={leads} onChange={setLeads} placeholder="e.g. 5000"
            hint="Lifetime live-lead allowance for this tenant" />
          <Field label="Max bookings / month" value={bookings} onChange={setBookings} placeholder="e.g. 500" />
          <Field label="Max storage (MB)" value={storage} onChange={setStorage} placeholder="e.g. 5120" />
          <Field label="Max sub-agents" value={subAgents} onChange={setSubAgents} placeholder="e.g. 5"
            min="0" hint="Gated capability · 0 disables sub-agents for this tenant" />
          <p className="text-[11px] text-muted">
            Overriding pins these limits so a later plan change won’t reset them. Blank fields are left
            unchanged.
          </p>
        </div>

        {err && <p className="mt-3 text-xs text-hue-rose">{err}</p>}

        <div className="mt-5 flex items-center justify-between gap-2">
          <button
            onClick={revert} disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-body hover:bg-surface-hover disabled:opacity-50"
            title="Reset every limit to the tenant's plan defaults"
          >
            <RotateCcw size={14} /> Revert to plan
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} disabled={busy}
              className="rounded-lg px-3 py-2 text-xs font-medium text-body hover:bg-surface-hover">
              Cancel
            </button>
            <button
              onClick={submit} disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white shadow-[var(--sa-card-shadow)] disabled:opacity-60"
              style={{ backgroundImage: "var(--sa-gradient)" }}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <SlidersHorizontal size={14} />}
              Save override
            </button>
          </div>
        </div>
      </div>
      {pendingPayload && (
        <SuperAdminMfaActionModal
          title="Confirm quota change"
          description={`Enter your authenticator code to update quota limits for ${tenant.organizationName}.`}
          confirmLabel="Save"
          saving={busy}
          error={mfaError}
          onClose={() => (busy ? undefined : setPendingPayload(null))}
          onConfirm={run}
        />
      )}
    </div>
  );
}

export default function Usage() {
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get("tenantId") || "";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await usageService.dashboard());
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load usage.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="py-24 text-center text-muted"><Loader2 size={22} className="mx-auto animate-spin" /></div>;
  }
  if (error || !data) {
    return <div className="py-24 text-center text-red-500">{error || "No data."}</div>;
  }

  const o = data.overview || {};
  const allRows = data.tenants || [];
  const rows = tenantId ? allRows.filter((row) => row.tenantPublicId === tenantId) : allRows;
  const tiles = [
    { label: "Total Tenants", value: o.totalTenants ?? 0, Icon: Building2, hue: "indigo" },
    { label: "Over Limit", value: o.tenantsOverLimit ?? 0, Icon: AlertTriangle, hue: "rose",
      valueTone: (o.tenantsOverLimit ?? 0) > 0 ? "text-hue-rose" : "text-muted" },
    { label: "Near Limit", value: o.tenantsNearLimit ?? 0, Icon: AlertTriangle, hue: "amber",
      valueTone: (o.tenantsNearLimit ?? 0) > 0 ? "text-hue-amber" : "text-muted" },
    { label: "Active Users", value: o.totalActiveUsers ?? 0, Icon: Users, hue: "sky" },
    { label: "Live Leads", value: o.totalActiveLeads ?? 0, Icon: Layers3, hue: "indigo" },
    { label: "Bookings (mo)", value: o.totalBookingsThisMonth ?? 0, Icon: CalendarClock, hue: "violet" },
    { label: "Storage Used", value: formatBytes(o.totalStorageBytes), Icon: HardDrive, hue: "emerald" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-heading">Usage &amp; Quotas</h1>
        <p className="mt-1 text-sm text-body">
          Per-tenant usage vs plan limits · near-limit warns at {o.warnThresholdPercent ?? 80}% of quota.
        </p>
      </div>

      {tenantId && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/25 bg-accent-soft px-4 py-3 text-sm text-body">
          <span>Showing quota health for <strong className="text-heading">{rows[0]?.organizationName || "selected tenant"}</strong>.</span>
          <Link to="/console/usage" className="text-xs font-semibold text-accent hover:underline">Show all tenants</Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 2xl:grid-cols-7">
        {tiles.map((t) => <Tile key={t.label} {...t} />)}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--sa-card-shadow)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-4 py-3 font-medium">Tenant</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Users</th>
                <th className="px-4 py-3 font-medium">Leads</th>
                <th className="px-4 py-3 font-medium">Bookings (mo)</th>
                <th className="px-4 py-3 font-medium">Storage</th>
                <th className="px-4 py-3 font-medium">Sub-agents</th>
                <th className="px-4 py-3 font-medium text-right">Quota</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-muted">No tenants yet.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.tenantPublicId} className="border-b border-border/60 last:border-0 hover:bg-surface-hover/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 font-medium text-heading">
                      {r.organizationName}
                      {r.quotaOverride && (
                        <span title="Quota manually overridden">
                          <Lock size={12} className="text-accent" />
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-[11px] text-muted">{r.organizationCode}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Chip text={r.plan} cls={PLAN_CLS[r.plan] || "bg-surface-hover text-muted"} />
                  </td>
                  <td className="px-4 py-3">
                    <Chip text={r.status} cls={STATUS_CLS[r.status] || "bg-surface-hover text-muted"} />
                  </td>
                  <td className="px-4 py-3">
                    <UsageBar usedText={r.activeUsers} limitText={r.maxUsers}
                      percent={r.usersPercent} over={r.usersOverLimit} near={r.usersNearLimit} />
                  </td>
                  <td className="px-4 py-3">
                    <UsageBar usedText={r.activeLeads} limitText={r.maxLeads}
                      percent={r.leadsPercent} over={r.leadsOverLimit} near={r.leadsNearLimit} />
                  </td>
                  <td className="px-4 py-3">
                    <UsageBar usedText={r.bookingsThisMonth} limitText={r.maxBookingsPerMonth}
                      percent={r.bookingsPercent} over={r.bookingsOverLimit} near={r.bookingsNearLimit} />
                  </td>
                  <td className="px-4 py-3">
                    <UsageBar usedText={formatBytes(r.storageUsedBytes)}
                      limitText={r.maxStorageMb != null ? `${r.maxStorageMb} MB` : ""}
                      percent={r.storagePercent} over={r.storageOverLimit} near={r.storageNearLimit} />
                  </td>
                  <td className="px-4 py-3">
                    {r.maxSubAgents ? (
                      <UsageBar usedText={r.subAgents} limitText={r.maxSubAgents}
                        percent={r.subAgentsPercent} over={r.subAgentsOverLimit} near={r.subAgentsNearLimit} />
                    ) : (
                      <span className="text-[11px] font-medium text-muted">
                        {r.subAgents > 0 ? `${r.subAgents} · disabled` : "Disabled"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setEditing(r)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-body hover:bg-surface-hover hover:text-heading"
                    >
                      <SlidersHorizontal size={13} /> Adjust
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <OverrideModal
          tenant={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}
