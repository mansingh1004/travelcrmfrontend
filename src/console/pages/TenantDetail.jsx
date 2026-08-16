import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CreditCard,
  Gauge,
  Mail,
  MapPin,
  Phone,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react";
import { auditService } from "../api/auditService";
import { billingService } from "../api/billingService";
import { featureFlagService } from "../api/featureFlagService";
import { tenantService } from "../api/tenantService";
import { usageService } from "../api/usageService";
import { userService } from "../api/userService";
import {
  ConsoleErrorState,
  ConsoleLoadingState,
  ConsolePageHeader,
  ConsolePanel,
} from "../components/ConsoleUi";
import StatusPill from "../components/StatusPill";

const date = (value) => value
  ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
  : "—";
const money = (value, currency = "INR") => `${currency === "INR" ? "₹" : `${currency} `}${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const bytes = (value) => {
  const amount = Number(value || 0);
  if (amount < 1024) return `${amount} B`;
  if (amount < 1024 ** 2) return `${(amount / 1024).toFixed(1)} KB`;
  if (amount < 1024 ** 3) return `${(amount / 1024 ** 2).toFixed(1)} MB`;
  return `${(amount / 1024 ** 3).toFixed(1)} GB`;
};

function DetailItem({ Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-hover/35 p-3">
      <Icon size={16} className="mt-0.5 shrink-0 text-accent" />
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
        <div className="mt-0.5 break-words text-sm font-medium text-heading">{value || "—"}</div>
      </div>
    </div>
  );
}

function QuotaBar({ label, used, limit, percent, over, near, format = (value) => Number(value || 0).toLocaleString("en-IN") }) {
  const unlimited = limit == null;
  const width = unlimited ? 0 : Math.min(Math.max(Number(percent || 0), 0), 100);
  const color = over ? "bg-hue-rose" : near ? "bg-hue-amber" : "bg-hue-emerald";
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-body">{label}</span>
        <span className={`font-mono ${over ? "text-hue-rose" : near ? "text-hue-amber" : "text-muted"}`}>
          {format(used)} / {unlimited ? "Unlimited" : format(limit)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-hover" aria-label={`${label} quota usage`}>
        {!unlimited && <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(width, used > 0 ? 2 : 0)}%` }} />}
      </div>
    </div>
  );
}

function PanelLink({ to, children }) {
  return <Link to={to} className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">{children} <ArrowRight size={13} /></Link>;
}

export default function TenantDetail() {
  const { publicId } = useParams();
  const location = useLocation();
  const [tenant, setTenant] = useState(null);
  const [usage, setUsage] = useState(null);
  const [users, setUsers] = useState([]);
  const [userTotal, setUserTotal] = useState(0);
  const [billing, setBilling] = useState([]);
  const [modules, setModules] = useState(null);
  const [activity, setActivity] = useState([]);
  const [degraded, setDegraded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const tenantData = await tenantService.get(publicId);
      setTenant(tenantData);
      const results = await Promise.allSettled([
        usageService.get(publicId),
        userService.list({ tenantId: publicId, page: 0, size: 8 }),
        billingService.listForTenant(publicId),
        featureFlagService.getModules(publicId),
        auditService.list({ q: tenantData.organizationCode, page: 0, size: 6 }),
      ]);
      const [usageResult, usersResult, billingResult, modulesResult, auditResult] = results;
      setUsage(usageResult.status === "fulfilled" ? usageResult.value : null);
      setUsers(usersResult.status === "fulfilled" ? usersResult.value?.rows ?? [] : []);
      setUserTotal(usersResult.status === "fulfilled" ? usersResult.value?.pagination?.totalElements ?? 0 : 0);
      setBilling(billingResult.status === "fulfilled" ? billingResult.value ?? [] : []);
      setModules(modulesResult.status === "fulfilled" ? modulesResult.value : null);
      setActivity(auditResult.status === "fulfilled" ? auditResult.value?.rows ?? [] : []);
      setDegraded(results.some((result) => result.status === "rejected"));
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load the tenant workspace.");
    } finally {
      setLoading(false);
    }
  }, [publicId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <ConsoleLoadingState label="Building tenant workspace…" />;
  if (error || !tenant) return <ConsoleErrorState message={error || "Tenant not found."} onRetry={load} />;

  const unpaid = billing.filter((record) => record.status === "UNPAID");
  const outstanding = unpaid.reduce((sum, record) => sum + Number(record.amount || 0), 0);
  const currency = unpaid[0]?.currency || billing[0]?.currency || "INR";
  const enabledModules = modules?.enabled || [];
  const tenantListQuery = location.state?.tenantList;
  const tenantListPath = `/console/tenants${tenantListQuery ? `?${tenantListQuery}` : ""}`;

  return (
    <div className="space-y-5">
      <Link to={tenantListPath} className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-accent">
        <ArrowLeft size={14} /> All tenants
      </Link>

      <ConsolePageHeader eyebrow={tenant.organizationCode} title={tenant.organizationName}
        description="One workspace for account health, entitlements, people, billing and audited platform activity."
        meta={`Customer since ${date(tenant.createdAt)} · last updated ${date(tenant.updatedAt)}`}
        actions={<StatusPill status={tenant.status} />} />

      {degraded && (
        <div className="rounded-xl border border-hue-amber/30 bg-hue-amber-soft px-4 py-3 text-sm text-body" role="status">
          Some tenant feeds could not be loaded. Available account data is shown below; retry before making a decision.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DetailItem Icon={CreditCard} label="Plan" value={tenant.plan} />
        <DetailItem Icon={Users} label="Active users" value={`${Number(tenant.userCount || 0).toLocaleString("en-IN")} / ${tenant.maxUsers ?? "Unlimited"}`} />
        <DetailItem Icon={CalendarDays} label="Subscription" value={`${date(tenant.subscriptionStartDate)} — ${date(tenant.subscriptionEndDate)}`} />
        <DetailItem Icon={Gauge} label="Outstanding" value={money(outstanding, currency)} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <ConsolePanel title="Account profile" description="Primary organization and billing contact" className="xl:col-span-2">
          <div className="space-y-4 p-5">
            <div className="flex items-start gap-3"><Mail size={16} className="mt-0.5 text-muted" /><div><div className="text-xs text-muted">Email</div><div className="text-sm font-medium text-heading">{tenant.email || "—"}</div></div></div>
            <div className="flex items-start gap-3"><Phone size={16} className="mt-0.5 text-muted" /><div><div className="text-xs text-muted">Phone</div><div className="text-sm font-medium text-heading">{tenant.phone || "—"}</div></div></div>
            <div className="flex items-start gap-3"><MapPin size={16} className="mt-0.5 text-muted" /><div><div className="text-xs text-muted">Address</div><div className="text-sm font-medium leading-5 text-heading">{tenant.address || "—"}</div></div></div>
            {tenant.deletedAt && <div className="rounded-lg bg-hue-rose-soft p-3 text-xs text-hue-rose">Deleted on {date(tenant.deletedAt)}</div>}
          </div>
        </ConsolePanel>

        <ConsolePanel title="Quota health" description={usage?.quotaOverride ? "Custom limits are pinned for this tenant" : "Limits inherited from the current plan"}
          action={<PanelLink to={`/console/usage?tenantId=${publicId}`}>Manage quotas</PanelLink>} className="xl:col-span-3">
          {usage ? (
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 p-5 sm:grid-cols-2">
              <QuotaBar label="Users" used={usage.activeUsers} limit={usage.maxUsers} percent={usage.usersPercent} over={usage.usersOverLimit} near={usage.usersNearLimit} />
              <QuotaBar label="Live leads" used={usage.activeLeads} limit={usage.maxLeads} percent={usage.leadsPercent} over={usage.leadsOverLimit} near={usage.leadsNearLimit} />
              <QuotaBar label="Bookings this month" used={usage.bookingsThisMonth} limit={usage.maxBookingsPerMonth} percent={usage.bookingsPercent} over={usage.bookingsOverLimit} near={usage.bookingsNearLimit} />
              <QuotaBar label="Storage" used={usage.storageUsedBytes} limit={usage.maxStorageMb == null ? null : usage.maxStorageMb * 1024 * 1024}
                percent={usage.storagePercent} over={usage.storageOverLimit} near={usage.storageNearLimit} format={bytes} />
              <QuotaBar label="Travel partners" used={usage.subAgents} limit={usage.maxSubAgents} percent={usage.subAgentsPercent} over={usage.subAgentsOverLimit} near={usage.subAgentsNearLimit} />
            </div>
          ) : <div className="px-5 py-10 text-center text-sm text-muted">Quota feed unavailable.</div>}
        </ConsolePanel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ConsolePanel title="People" description={`${userTotal} tenant user${userTotal === 1 ? "" : "s"}`}
          action={<PanelLink to={`/console/users?tenantId=${publicId}`}>All users</PanelLink>}>
          {users.length === 0 ? <div className="px-5 py-10 text-center text-sm text-muted">No users available.</div> : (
            <div className="divide-y divide-border">
              {users.map((user) => (
                <div key={user.publicId} className="flex items-center gap-3 px-5 py-3">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">
                    {(user.name || user.email || "?").slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-heading">{user.name || "Unnamed user"}</div><div className="truncate text-xs text-muted">{user.email}</div></div>
                  <div className="text-right"><div className="font-mono text-[10px] font-semibold text-body">{user.role}</div><div className={`text-[10px] ${user.locked || !user.active ? "text-hue-rose" : "text-hue-emerald"}`}>{user.locked ? "Locked" : user.active ? "Active" : "Inactive"}</div></div>
                </div>
              ))}
            </div>
          )}
        </ConsolePanel>

        <ConsolePanel title="Billing position" description={`${unpaid.length} unpaid invoice${unpaid.length === 1 ? "" : "s"}`}
          action={<PanelLink to={`/console/billing?q=${encodeURIComponent(tenant.organizationCode)}`}>Manage billing</PanelLink>}>
          {billing.length === 0 ? <div className="px-5 py-10 text-center text-sm text-muted">No billing records yet.</div> : (
            <div className="divide-y divide-border">
              {billing.slice(0, 6).map((record) => (
                <div key={record.publicId} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1"><div className="font-mono text-xs font-bold text-heading">{record.invoiceNumber}</div><div className="text-xs text-muted">Issued {date(record.issueDate)} · due {date(record.dueDate)}</div></div>
                  <div className="text-right"><div className="font-mono text-sm font-semibold text-heading">{money(record.amount, record.currency)}</div><div className={`text-[10px] font-semibold ${record.status === "PAID" ? "text-hue-emerald" : record.status === "UNPAID" ? "text-hue-rose" : "text-muted"}`}>{record.status}</div></div>
                </div>
              ))}
            </div>
          )}
        </ConsolePanel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ConsolePanel title="Entitlements" description={`${enabledModules.length} enabled module${enabledModules.length === 1 ? "" : "s"}`}
          action={<PanelLink to={`/console/feature-flags?tenantId=${publicId}`}>Manage modules</PanelLink>}>
          {enabledModules.length === 0 ? <div className="px-5 py-10 text-center text-sm text-muted">No modules enabled.</div> : (
            <div className="flex flex-wrap gap-2 p-5">
              {enabledModules.map((module) => (
                <span key={module} className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${modules?.planModules?.includes(module) ? "border-border bg-surface-hover text-body" : "border-hue-amber/30 bg-hue-amber-soft text-hue-amber"}`}>
                  {module}{!modules?.planModules?.includes(module) ? " · override" : ""}
                </span>
              ))}
            </div>
          )}
        </ConsolePanel>

        <ConsolePanel title="Recent account activity" description="Tenant-scoped SuperAdmin audit entries"
          action={<PanelLink to="/console/audit">Audit log</PanelLink>}>
          {activity.length === 0 ? <div className="px-5 py-10 text-center text-sm text-muted"><ScrollText size={22} className="mx-auto mb-2 opacity-50" />No recent entries.</div> : (
            <div className="divide-y divide-border">
              {activity.map((row) => (
                <div key={row.publicId} className="flex items-start gap-3 px-5 py-3">
                  <ShieldCheck size={16} className={`mt-0.5 shrink-0 ${row.success ? "text-hue-emerald" : "text-hue-rose"}`} />
                  <div className="min-w-0 flex-1"><div className="font-mono text-[10px] font-bold text-heading">{row.action}</div><p className="mt-0.5 truncate text-xs text-body">{row.description || "No description recorded"}</p></div>
                  <time className="shrink-0 text-[10px] text-muted">{date(row.createdAt)}</time>
                </div>
              ))}
            </div>
          )}
        </ConsolePanel>
      </div>
    </div>
  );
}
