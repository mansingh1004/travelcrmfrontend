// src/console/components/SecurityPanel.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Small panel, and the one that saves you in an incident.
//
// Everything on it was already in the audit log. What was missing was the
// grouping: in one time-ordered list, three failed sign-ins from an unfamiliar
// address sit between two routine approvals, so "has anything odd happened" is
// not a question anyone answers by scrolling — until it matters, and by then it
// is too late.
//
// Four groups, four different questions: who got in, who failed to, who acted as
// somebody else, and what was destroyed.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, KeyRound, Loader2, ShieldAlert, UserCog, Trash2 } from "lucide-react";

import { platformHealthService } from "../api/platformHealthService";
import { ConsolePanel } from "./ConsoleUi";

function when(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

/** One group. Empty groups still render their heading — "no impersonations" is itself the answer. */
function Group({ title, Icon, tone, rows, emptyLabel }) {
  return (
    <div className="px-5 py-3.5">
      <div className="mb-2 flex items-center gap-2">
        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-lg ${tone}`}>
          <Icon size={13} />
        </span>
        <span className="text-xs font-semibold text-heading">{title}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((e, i) => (
            <li key={`${e.action}-${e.at}-${i}`} className="flex items-baseline gap-2 text-xs">
              <span className="truncate font-medium text-body">{e.actorEmail || "system"}</span>
              {/* The IP is the point of this panel, not decoration: an unfamiliar address is the
                  only thing that distinguishes a forgotten password from somebody else trying. */}
              {e.ipAddress && <span className="shrink-0 font-mono text-muted">{e.ipAddress}</span>}
              {e.targetTenantCode && (
                <span className="shrink-0 rounded bg-surface-hover px-1.5 font-mono text-[10px] text-body">
                  {e.targetTenantCode}
                </span>
              )}
              <span className="ml-auto shrink-0 text-muted">{when(e.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function SecurityPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await platformHealthService.securityEvents());
      setFailed(false);
    } catch {
      setData(null);
      setFailed(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const failures = data?.failedSignInsInWindow ?? 0;
  const sources = data?.failedSignInSources ?? 0;

  return (
    <ConsolePanel
      title="Security"
      description={
        failed ? "Could not be loaded."
          : loading ? "Loading…"
            : failures === 0
              ? `No failed sign-in in the last ${data?.windowHours ?? 24}h`
              /* The SHAPE of a failure run, not just the count. One address retrying five times is
                 somebody who forgot their password; five addresses failing once each is not, and a
                 bare "5 failed" cannot tell the two apart. */
              : `${failures} failed sign-in(s) from ${sources} address(es) in the last ${data?.windowHours ?? 24}h`
      }
      action={(
        <Link to="/console/audit"
          className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
          Full audit log <ArrowRight size={13} />
        </Link>
      )}
    >
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted" /></div>
      ) : failed ? (
        <p className="px-5 py-8 text-center text-sm text-muted">
          Security events could not be loaded, so nothing here is claiming to be clear.
        </p>
      ) : (
        <div className="divide-y divide-border">
          <Group title="Failed sign-ins" Icon={ShieldAlert} tone="bg-hue-rose-soft text-hue-rose"
            rows={data.failedSignIns ?? []} emptyLabel="None in the window." />
          <Group title="Impersonations" Icon={UserCog} tone="bg-hue-orange-soft text-hue-orange"
            rows={data.impersonations ?? []} emptyLabel="Nobody has opened a tenant session." />
          <Group title="Destructive actions" Icon={Trash2} tone="bg-hue-amber-soft text-hue-amber"
            rows={data.destructive ?? []}
            emptyLabel="No suspend, delete, forced reset or MFA reset recorded." />
          <Group title="Recent sign-ins" Icon={KeyRound} tone="bg-hue-emerald-soft text-hue-emerald"
            rows={data.signIns ?? []} emptyLabel="No sign-in recorded." />
        </div>
      )}
    </ConsolePanel>
  );
}
