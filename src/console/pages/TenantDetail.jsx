import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  CalendarDays,
  CreditCard,
  Gauge,
  Play,
  Mail,
  MapPin,
  Phone,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import { useToast } from "@shared/ui/toast";
import { useStepUp } from "../components/useStepUp";
import { auditService } from "../api/auditService";
import { planService } from "../api/planService";
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
import { OverrideModal } from "./Usage";

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

/**
 * One reading in the header strip.
 *
 * `tone` colours the VALUE only — the tile keeps its neutral surface and the icon keeps the accent.
 * Tinting the whole card made five tiles compete for attention and turned the strip into a warning
 * banner; colouring just the number puts the signal exactly on the thing that is wrong.
 *
 * Colour is never the only signal: a toned tile also states the condition in its `hint`, so it reads
 * correctly in greyscale and to a colour-blind operator.
 */
function DetailItem({ Icon, label, value, hint, tone = "neutral" }) {
  const valueTone = {
    neutral: "text-heading",
    warn: "text-hue-amber",
    risk: "text-hue-rose",
  }[tone];
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-hover/35 p-3">
      <Icon size={16} className="mt-0.5 shrink-0 text-accent" />
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
        <div className={`mt-0.5 break-words text-sm font-bold tabular-nums ${valueTone}`}>{value || "—"}</div>
        {hint && <div className="mt-0.5 text-[11px] text-muted">{hint}</div>}
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
  const [planOpen, setPlanOpen] = useState(false);
  const [quotaOpen, setQuotaOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  /* One step-up gate for every action on this page, rather than a dialog per button. Same shape as
     the hotel detail page: the caller describes the action and supplies the call, the hook owns the
     code, the busy state and the error — which stays inside the dialog so a wrong code is retryable. */
  const stepUp = useStepUp();
  const askSuspend = () => stepUp.request({
    title: "Suspend tenant",
    description: `${tenant.organizationName} loses access immediately. Their data is untouched and reactivating restores it — this is reversible.`,
    confirmLabel: "Suspend tenant",
    run: async (mfaCode) => { await tenantService.suspend(publicId, mfaCode); await load(); },
  });
  const askReactivate = () => stepUp.request({
    title: "Reactivate tenant",
    description: `${tenant.organizationName} regains access. Dunning re-evaluates their subscription on its next pass.`,
    confirmLabel: "Reactivate tenant",
    run: async (mfaCode) => { await tenantService.reactivate(publicId, mfaCode); await load(); },
  });
  /* The endpoint takes the full enabled set, not a delta, so a toggle is "current set ± this one".
     Sending a delta would silently drop every other module. */
  const askToggleModule = (module, isOn, fromPlan) => stepUp.request({
    title: isOn ? `Remove ${module}` : `Grant ${module}`,
    description: isOn
      ? (fromPlan
          ? `${module} is included in the ${tenant.plan} plan. Turning it off records a per-tenant override that survives until it is granted again.`
          : `This removes the per-tenant override for ${module}. The tenant falls back to what their plan includes.`)
      : `This grants ${module} to ${tenant.organizationName} on top of their plan, as a per-tenant override.`,
    confirmLabel: isOn ? "Remove module" : "Grant module",
    run: async (mfaCode) => {
      const next = isOn
        ? enabledModules.filter((m) => m !== module)
        : [...enabledModules, module];
      await featureFlagService.updateModules(publicId, next, mfaCode);
      await load();
    },
  });
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
        // By tenant id, not by organisation-code text search: `q` LIKEs description and tenant code
        // too, so this panel was rendering other tenants' audit rows on this tenant's page.
        auditService.list({ tenantPublicId: publicId, page: 0, size: 6 }),
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
  /* Overdue is the sharper reading than outstanding: an invoice issued yesterday and one that went
     past its due date six weeks ago both sit in "outstanding", and only the second is a problem. */
  const todayIso = new Date().toISOString().slice(0, 10);
  const overdueInvoices = unpaid.filter((r) => r.dueDate && r.dueDate < todayIso);
  const overdueAmount = overdueInvoices.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  /* Days to renewal, not a date range. "2026-09-04" makes the operator do the subtraction; "in 18
     days" is the thing they were going to work out anyway. Negative means already lapsed. */
  const daysToRenewal = tenant.subscriptionEndDate
    ? Math.ceil((new Date(tenant.subscriptionEndDate).getTime() - Date.now()) / 86400000)
    : null;
  /* One roll-up instead of five more tiles: the quota panel below already breaks this down, and the
     strip only needs to say whether it is worth looking. */
  const quotaFlags = usage ? [
    { over: usage.usersOverLimit, near: usage.usersNearLimit },
    { over: usage.leadsOverLimit, near: usage.leadsNearLimit },
    { over: usage.bookingsOverLimit, near: usage.bookingsNearLimit },
    { over: usage.storageOverLimit, near: usage.storageNearLimit },
    { over: usage.subAgentsOverLimit, near: usage.subAgentsNearLimit },
  ] : [];
  const quotaOver = quotaFlags.filter((f) => f.over).length;
  const quotaNear = quotaFlags.filter((f) => !f.over && f.near).length;
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
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={tenant.status} />
            {/* The two decisions an operator actually reaches for on a support call. They lived only as
                row actions on the tenant LIST, so the page that finally showed a tenant's whole state
                was the one page that could not act on it. */}
            {!tenant.deletedAt && (tenant.status === "SUSPENDED" ? (
              <button type="button" onClick={() => askReactivate()}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3 text-xs font-semibold text-accent-text hover:bg-accent-hover">
                <Play size={14} /> Reactivate
              </button>
            ) : (
              <button type="button" onClick={() => askSuspend()}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus inline-flex h-9 items-center gap-2 rounded-lg border border-hue-rose/40 bg-hue-rose-soft px-3 text-xs font-semibold text-hue-rose hover:bg-hue-rose-soft/70">
                <Ban size={14} /> Suspend
              </button>
            ))}
            {!tenant.deletedAt && (
              <button type="button" onClick={() => setPlanOpen(true)}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus inline-flex h-9 items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 text-xs font-semibold text-heading hover:bg-surface-hover">
                <CreditCard size={14} /> Change plan
              </button>
            )}
          </div>
        )} />
      {degraded && (
        <div className="rounded-xl border border-hue-amber/30 bg-hue-amber-soft px-4 py-3 text-sm text-body" role="status">
          Some tenant feeds could not be loaded. Available account data is shown below; retry before making a decision.
        </div>
      )}
      {/* Risk-forward, and deliberately not a copy of the quota panel below. Each tile answers a
          question an operator asks before acting: what are they paying for, are they about to lapse,
          do they owe us, are they LATE, and is anything already breaching. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <DetailItem Icon={CreditCard} label="Plan" value={tenant.plan}
          hint={`${Number(tenant.userCount || 0).toLocaleString("en-IN")} of ${tenant.maxUsers ?? "unlimited"} users`} />
        <DetailItem
          Icon={CalendarDays}
          label="Renewal"
          value={daysToRenewal == null ? "—"
            : daysToRenewal < 0 ? `Lapsed ${Math.abs(daysToRenewal)}d ago`
            : daysToRenewal === 0 ? "Today"
            : `in ${daysToRenewal} days`}
          hint={date(tenant.subscriptionEndDate)}
          tone={daysToRenewal == null ? "neutral" : daysToRenewal < 0 ? "risk" : daysToRenewal <= 14 ? "warn" : "neutral"} />
        <DetailItem Icon={Gauge} label="Outstanding" value={money(outstanding, currency)}
          hint={`${unpaid.length} unpaid invoice${unpaid.length === 1 ? "" : "s"}`}
          tone={outstanding > 0 ? "risk" : "neutral"} />
        <DetailItem Icon={Ban} label="Overdue" value={money(overdueAmount, currency)}
          hint={overdueInvoices.length === 0 ? "Nothing past due"
            : `${overdueInvoices.length} past due date`}
          tone={overdueAmount > 0 ? "risk" : "neutral"} />
        <DetailItem
          Icon={ShieldCheck}
          label="Quota"
          value={!usage ? "—" : quotaOver > 0 ? `${quotaOver} over limit` : quotaNear > 0 ? `${quotaNear} near limit` : "Within limits"}
          hint={usage?.quotaOverride ? "Custom limits pinned" : `${tenant.plan} defaults`}
          tone={quotaOver > 0 ? "risk" : quotaNear > 0 ? "warn" : "neutral"} />
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
          action={(
            <button type="button" onClick={() => setQuotaOpen(true)}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus text-xs font-semibold text-accent hover:underline">
              {usage?.quotaOverride ? "Edit limits" : "Override limits"}
            </button>
          )} className="xl:col-span-3">
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
          action={(
            <div className="flex items-center gap-3">
              {/* Invoice creation lived only inside a drawer opened from a row action on the tenant
                  LIST — so the page showing what a tenant owes could not raise what they owe next. */}
              <button type="button" onClick={() => setInvoiceOpen(true)}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus text-xs font-semibold text-accent hover:underline">
                Issue invoice
              </button>
              <PanelLink to={`/console/billing?q=${encodeURIComponent(tenant.organizationCode)}`}>All invoices</PanelLink>
            </div>
          )}>
          {billing.length === 0 ? <div className="px-5 py-10 text-center text-sm text-muted">No billing records yet.</div> : (
            <div className="divide-y divide-border">
              {billing.slice(0, 6).map((record) => (
                <div key={record.publicId} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1"><div className="font-mono text-xs font-bold text-heading">{record.invoiceNumber}</div><div className="text-xs text-muted">Issued {date(record.issueDate)} · due {date(record.dueDate)}</div></div>
                  <div className="text-right"><div className="font-mono text-sm font-semibold text-heading">{money(record.amount, record.currency)}</div><div className={`text-[10px] font-semibold ${record.status === "PAID" ? "text-hue-emerald" : record.status === "UNPAID" ? "text-hue-amber" : "text-muted"}`}>{record.status}</div></div>
                </div>
              ))}
            </div>
          )}
        </ConsolePanel>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ConsolePanel title="Entitlements" description={`${enabledModules.length} of ${(modules?.available ?? []).length || enabledModules.length} module${enabledModules.length === 1 ? "" : "s"} enabled`}
          action={<PanelLink to={`/console/feature-flags?tenantId=${publicId}`}>All tenants</PanelLink>}>
          {/* Every module the catalogue knows about, not only the enabled ones: a panel that lists
              what is on cannot answer "why can't they see Fleet", which is the question that sends an
              operator to another screen. Clicking a chip toggles it, step-up gated. */}
          {(modules?.available ?? []).length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted">Module catalogue unavailable.</div>
          ) : (
            <div className="flex flex-wrap gap-2 p-5">
              {(modules.available ?? []).map((module) => {
                const on = enabledModules.includes(module);
                const fromPlan = modules?.planModules?.includes(module);
                return (
                  <button
                    key={module}
                    type="button"
                    disabled={stepUp.busy}
                    onClick={() => askToggleModule(module, on, fromPlan)}
                    title={on
                      ? (fromPlan ? "Included in the plan — turning it off is a per-tenant override" : "Per-tenant override — click to remove")
                      : "Click to grant this module to this tenant"}
                    className={`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${
                      !on
                        ? "border-dashed border-border text-muted hover:border-accent hover:text-accent"
                        : fromPlan
                          ? "border-border bg-surface-hover text-body hover:border-hue-rose/40"
                          : "border-hue-amber/30 bg-hue-amber-soft text-hue-amber hover:border-hue-rose/40"
                    }`}
                  >
                    {module}{on && !fromPlan ? " · override" : ""}
                  </button>
                );
              })}
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
      {planOpen && (
        <ChangePlanDialog
          tenant={tenant}
          onClose={() => setPlanOpen(false)}
          onChanged={() => { setPlanOpen(false); load(); }}
        />
      )}
      {quotaOpen && (
        /* The same dialog Usage & Quotas opens from its Adjust button, not a second one. It expects a
           usage row, so the tenant identity is merged in. */
        <OverrideModal
          tenant={{ ...(usage || {}), tenantPublicId: publicId, organizationName: tenant.organizationName }}
          onClose={() => setQuotaOpen(false)}
          onSaved={() => { setQuotaOpen(false); load(); }}
        />
      )}
      {invoiceOpen && (
        <IssueInvoiceDialog
          tenant={tenant}
          onClose={() => setInvoiceOpen(false)}
          onIssued={() => { setInvoiceOpen(false); load(); }}
        />
      )}
      {stepUp.dialog}
    </div>
  );
}

/**
 * Move a tenant between plans.
 *
 * The plan list comes from the plan API rather than a hardcoded array — SA-005 in the backlog is
 * exactly the bug where three plans were baked into the tenant-create form and FLEET could not be
 * chosen at all. A plan added to the catalogue should appear here without a frontend release.
 *
 * A downgrade is not blocked, but it is called out: entitlements and seat caps drop immediately, and
 * a tenant already over the smaller plan's limits keeps what they have while new work is gated. That
 * is the server's behaviour, so the dialog says it rather than letting the operator discover it.
 */

function ChangePlanDialog({ tenant, onClose, onChanged }) {
  const { showToast } = useToast();
  const [plans, setPlans] = useState(null);
  const [selected, setSelected] = useState(tenant.plan ?? "");
  const stepUp = useStepUp();
  useEffect(() => {
    let alive = true;
    planService.list()
      .then((rows) => { if (alive) setPlans(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (alive) setPlans([]); });
    return () => { alive = false; };
  }, []);
  const changed = selected && selected !== tenant.plan;
  const save = () => stepUp.request({
    title: "Confirm plan change",
    description: `${tenant.organizationName} moves from ${tenant.plan} to ${selected}. Entitlements and seat caps apply immediately.`,
    confirmLabel: "Change plan",
    run: async (mfaCode) => {
      await tenantService.changePlan(tenant.publicId, selected, mfaCode);
      showToast?.("Plan changed.", "success");
      onChanged();
    },
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-xl"
           onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-bold text-heading">Change plan</h2>
        <p className="mt-1 text-xs text-muted">{tenant.organizationName} is on {tenant.plan}.</p>
        <label className="mt-4 block">
          <span className="text-xs font-semibold text-body">New plan</span>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-focus"
          >
            {plans === null && <option value={tenant.plan}>Loading plans…</option>}
            {plans?.map((p) => (
              <option key={p.code ?? p} value={p.code ?? p}>{p.name ?? p.code ?? p}</option>
            ))}
          </select>
        </label>
        {plans?.length === 0 && (
          <p className="mt-2 text-xs text-hue-amber">
            The plan catalogue could not be loaded, so only the current plan is listed.
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-lg border border-border px-3 py-2 text-sm font-semibold text-body hover:bg-surface-hover">
            Cancel
          </button>
          <button onClick={save} disabled={!changed || stepUp.busy}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-text hover:bg-accent-hover disabled:opacity-50">
            Change plan
          </button>
        </div>
      </div>
      {stepUp.dialog}
    </div>
  );
}


function IssueInvoiceDialog({ tenant, onClose, onIssued }) {
  const { showToast } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    amount: "",
    currency: tenant.currency || "INR",
    periodStart: today,
    periodEnd: "",
    dueDate: "",
    notes: "",
  });
  const stepUp = useStepUp();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const amount = Number(form.amount);
  const invalid = !Number.isFinite(amount) || amount <= 0 || !form.periodStart || !form.periodEnd || !form.dueDate;
  const datesInvalid = form.periodStart && form.periodEnd && form.periodEnd < form.periodStart;
  const save = () => stepUp.request({
    title: "Issue invoice",
    description: `This raises an invoice against ${tenant.organizationName}. Marking it paid later extends their access to the end of the billed period.`,
    confirmLabel: "Issue invoice",
    run: async (mfaCode) => {
      await billingService.create(tenant.publicId, {
        amount,
        currency: form.currency,
        plan: tenant.plan,
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
        dueDate: form.dueDate,
        notes: form.notes.trim() || undefined,
      }, mfaCode);
      showToast?.("Invoice issued.", "success");
      onIssued();
    },
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-xl"
           onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-bold text-heading">Issue invoice — {tenant.organizationName}</h2>
        <p className="mt-1 text-xs text-muted">Billed on the {tenant.plan} plan.</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-semibold text-body">Amount</span>
            <input inputMode="decimal" value={form.amount} onChange={set("amount")}
                   className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-focus" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-body">Currency</span>
            <input value={form.currency} onChange={set("currency")}
                   className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-focus" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-body">Period start</span>
            <input type="date" value={form.periodStart} onChange={set("periodStart")}
                   className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-focus" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-body">Period end</span>
            <input type="date" value={form.periodEnd} onChange={set("periodEnd")}
                   className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-focus" />
          </label>
          <label className="col-span-2 block">
            <span className="text-xs font-semibold text-body">Due date</span>
            <input type="date" value={form.dueDate} onChange={set("dueDate")}
                   className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-focus" />
          </label>
          <label className="col-span-2 block">
            <span className="text-xs font-semibold text-body">Notes</span>
            <input value={form.notes} onChange={set("notes")}
                   className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-focus" />
          </label>
        </div>
        {datesInvalid && (
          <p className="mt-2 text-xs text-hue-rose">The period ends before it starts.</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-lg border border-border px-3 py-2 text-sm font-semibold text-body hover:bg-surface-hover">
            Cancel
          </button>
          <button onClick={save} disabled={invalid || datesInvalid || stepUp.busy}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-text hover:bg-accent-hover disabled:opacity-50">
            Issue invoice
          </button>
        </div>
      </div>
      {stepUp.dialog}
    </div>
  );
}
