// src/console/components/ActivationFunnel.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Signed up → logo → team → first hotel → messaging → first lead → first
// quotation → first booking. Where new tenants stop.
//
// The sibling of the tenant-health list, not a duplicate of it: that one answers
// "who is leaving", this one answers "who never arrived". At a small tenant count
// the second is the bigger risk — a tenant who never created a lead is not
// churning, they never started, and no churn signal will ever fire for them.
//
// ── Why this does NOT follow the page's period picker ───────────────────────
// The picker selects a REPORTING window; this needs a SIGNUP COHORT, and they are
// different things. Pointed at "Today" the funnel would describe tenants who
// signed up in the last few hours — almost always none — and read as "activation
// is fine" because the chart was empty. So the cohort is its own control, and it
// says on its face what it covers.
//
// ── Dismissed steps are not completed steps ─────────────────────────────────
// The tenant's own checklist counts a dismissal as done, because it is their
// to-do list and they may say "not now". This funnel does not. A tenant who
// dismissed "invite your team" has not invited anyone, and the platform is the
// one party that must not be told otherwise. (Enforced server-side.)
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Loader2, Rocket } from "lucide-react";

import { platformHealthService } from "../api/platformHealthService";
import { ConsolePanel } from "./ConsoleUi";

const COHORTS = [
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
  { days: 365, label: "Last year" },
];

export default function ActivationFunnel() {
  const [cohortDays, setCohortDays] = useState(90);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await platformHealthService.activation({ days: cohortDays }));
      setFailed(false);
    } catch {
      // Silent by design — the panel says it could not load. A toast for a
      // background panel refresh is noise the operator did not ask for.
      setData(null);
      setFailed(true);
    }
    setLoading(false);
  }, [cohortDays]);

  useEffect(() => { load(); }, [load]);

  const steps = data?.steps ?? [];
  const cohort = data?.cohortSize ?? 0;
  const stalled = data?.stalled ?? [];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <ConsolePanel
        title="Activation funnel"
        description={
          failed ? "Could not be loaded."
            : loading ? "Loading…"
              : `${cohort} tenant(s) signed up in the selected cohort`
        }
        action={(
          <label className="inline-flex items-center gap-1.5">
            <span className="sr-only">Signup cohort</span>
            <select
              value={cohortDays}
              onChange={(e) => setCohortDays(Number(e.target.value))}
              className="rounded-lg border border-border bg-surface px-2 py-1 text-xs font-semibold text-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {COHORTS.map((c) => (
                <option key={c.days} value={c.days}>{c.label}</option>
              ))}
            </select>
          </label>
        )}
      >
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted" /></div>
        ) : cohort === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">
            No tenant signed up in this cohort.
          </p>
        ) : (
          <div className="space-y-3 px-5 py-4">
            {steps.map((step) => (
              <div key={step.key}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
                  <span className="truncate font-medium text-body">{step.label}</span>
                  <span className="shrink-0 font-mono text-muted">
                    {step.completed}/{cohort} · {step.percent}%
                    {/* Drop-off against the PREVIOUS step, not against a running minimum: the
                        checklist is an ordered suggestion, not a gate, so a tenant can book without
                        ever uploading a logo. Counting them as leaked would invent a leak. */}
                    {step.droppedFromPrevious > 0 && (
                      <span className="ml-2 text-hue-orange">−{step.droppedFromPrevious}</span>
                    )}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-hover">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${Math.max(step.percent, 2)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </ConsolePanel>

      <ConsolePanel
        title="Never finished setting up"
        description={
          loading ? "Loading…"
            : stalled.length === 0
              ? "Every tenant in this cohort got to their first booking."
              : `${stalled.length} tenant(s) past ${data?.stalledAfterDays ?? 7} days without a first booking`
        }
      >
        {stalled.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
            <Rocket size={22} className="text-hue-emerald" />
            <p className="text-sm font-semibold text-heading">Nobody is stuck.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {stalled.map((t) => (
              <li key={t.publicId}>
                <Link
                  to={`/console/tenants/${t.publicId}`}
                  className="group flex items-center gap-3 px-5 py-3 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-heading">
                      {t.organizationName || "Unnamed tenant"}
                    </div>
                    {/* The step they are ON, not a percentage. "Stuck at: add your first hotel" is
                        the sentence you open the call with; "43% complete" is not. */}
                    <div className="truncate text-xs text-muted">
                      {t.daysSinceSignup}d in · {t.completedSteps}/{t.totalSteps} done
                      {t.nextStepLabel ? ` · stuck at: ${t.nextStepLabel}` : ""}
                    </div>
                  </div>
                  <ArrowRight
                    size={15}
                    className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </ConsolePanel>
    </div>
  );
}
