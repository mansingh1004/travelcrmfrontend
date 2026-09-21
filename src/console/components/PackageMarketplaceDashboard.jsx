// src/console/components/PackageMarketplaceDashboard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The package supply line at a glance.
//
// ── Demand, and why there is still no revenue tile ──────────────────────────
// This screen used to show supply only — catalog size, submissions, pricing rules
// — and nothing about whether any of it sold. It could report a healthy catalog
// while not one package moved.
//
// `PackageQuote` is the demand record: it carries a status (DRAFT/SENT/ACCEPTED/
// DECLINED) and `markupPerPax`, so quotes raised and quotes taken are both real,
// countable facts. They come from /super-admin/pulse, which counts them for the
// selected period.
//
// A REVENUE figure is still absent, and still deliberately. Hotels and transport
// each have an append-only commission ledger; packages have none, so realised
// margin would have to be summed off quote rows that a later edit can change.
// "Quotes accepted" is a fact. A margin total assembled that way would look like
// one. When a package commission ledger lands, this is where its tile goes.
//
// Everything else is composed from the list calls that already exist — one row
// asked for purely to read `totalElements`, and every call independent so one
// failure degrades a tile rather than the page.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import {
  ClipboardCheck, FileText, Handshake, Loader2, Package, Percent, RefreshCw, Wand2,
} from "lucide-react";

import { toast } from "@shared/ui/toast";
import { getErrorMessage } from "@shared/api/apiError";

import { platformPackageService } from "../api/platformPackageService";
import { platformPackageMixService } from "../api/platformPackageMixService";
import { packagePricingService } from "../api/packagePricingService";
import { platformHealthService } from "../api/platformHealthService";
import { ConsolePanel } from "./ConsoleUi";
import { ActionLink, DegradedNote, Metric, SmallLink, count } from "./marketplaceDashboardUi";
import { NowTag } from "./RangePicker";

export default function PackageMarketplaceDashboard({ range, periodLabel = "this month" }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [degraded, setDegraded] = useState(false);

  const load = useCallback(async (background = false) => {
    if (background) setRefreshing(true); else setLoading(true);

    const results = await Promise.allSettled([
      platformPackageService.list({ page: 0, size: 6 }),
      platformPackageService.list({ page: 0, size: 1, status: "ACTIVE" }),
      platformPackageService.reviewQueue({ page: 0, size: 1 }),
      platformPackageMixService.pendingCount(),
      packagePricingService.list(),
      // The only range-scoped call on this screen. Everything else here is a stock: how big the
      // catalog is now, what is queued now.
      range?.from && range?.to
        ? platformHealthService.pulse(range)
        : Promise.resolve(null),
    ]);

    const at = (i, fallback) => (results[i].status === "fulfilled" ? results[i].value : fallback);

    const catalog = at(0, { items: [], pagination: null });
    const active = at(1, { items: [], pagination: null });
    const queue = at(2, { items: [], pagination: null });
    const mix = at(3, {});
    const rules = at(4, []) ?? [];
    const pulse = at(5, null);

    const total = count(catalog.pagination, catalog.items?.length);
    const live = count(active.pagination, active.items?.length);

    setData({
      catalogTotal: total,
      activePackages: live,
      unpublished: Math.max(total - live, 0),
      reviewQueue: count(queue.pagination, (queue.items ?? []).length),
      // The backend answers { count: N }; a bare number is accepted too so a shape change
      // downgrades the tile rather than rendering "[object Object]".
      mixPending: Number(mix?.count ?? mix ?? 0),
      recent: catalog.items ?? [],
      rules,
      // The one figure that matters commercially without a ledger: is anything unpriced by
      // default? A catalog rule is what stops a cost-only slab falling through to the fallback.
      hasCatalogRule: rules.some((r) => r.scope === "GLOBAL" && r.active),
      tierRules: rules.filter((r) => r.scope === "TIER").length,
      packageRules: rules.filter((r) => r.scope === "PACKAGE").length,
      pulse,
    });

    setDegraded(results.some((r) => r.status === "rejected"));
    setLoading(false);
    setRefreshing(false);
  }, [range?.from, range?.to]);

  useEffect(() => { load(); }, [load]);

  const refresh = () =>
    load(true).catch((err) => toast.error(getErrorMessage(err, "Could not refresh.")));

  if (loading && !data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-muted" />
      </div>
    );
  }

  const d = data ?? {};

  return (
    <div className="space-y-5">
      {degraded && <DegradedNote />}

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          The package supply line — the catalog, what agencies have submitted, and what is waiting
          on a price.
        </p>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-body hover:bg-surface-hover disabled:opacity-60"
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label={<>Packages live<NowTag /></>}
          value={d.activePackages ?? 0}
          helper={`${d.catalogTotal ?? 0} in the catalog · ${d.unpublished ?? 0} not published`}
          Icon={Package}
          tone="violet"
        />
        <Metric
          label={<>Agency submissions<NowTag /></>}
          value={d.reviewQueue ?? 0}
          helper={d.reviewQueue > 0 ? "Waiting on a decision" : "Queue is clear"}
          Icon={ClipboardCheck}
          tone="amber"
          danger={(d.reviewQueue ?? 0) > 0}
        />
        <Metric
          label={<>Custom requests<NowTag /></>}
          value={d.mixPending ?? 0}
          helper={d.mixPending > 0 ? "An agency is waiting on a price" : "Nothing waiting"}
          Icon={Wand2}
          tone="sky"
          danger={(d.mixPending ?? 0) > 0}
        />
        <Metric
          label="Pricing rules"
          value={(d.rules ?? []).length}
          helper={d.hasCatalogRule ? "A catalog default is set" : "No catalog default — cost-only slabs fall back"}
          Icon={Percent}
          tone={d.hasCatalogRule ? "emerald" : "rose"}
          danger={!d.hasCatalogRule}
        />
      </div>

      {/* Demand. Everything above this line is stock — how big the catalog is right now — and
          everything on this row is flow, counted over the selected period. */}
      <ConsolePanel
        title={`Demand · ${periodLabel}`}
        description="Quotes agencies built from the catalog, and how many were taken."
      >
        {!d.pulse ? (
          <p className="px-5 py-8 text-center text-sm text-muted">
            Pick both dates to see demand for a custom period.
          </p>
        ) : (
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <Metric label="Quotes raised" value={d.pulse.packageQuotes ?? 0}
              helper="Built from a catalog package" Icon={FileText} tone="sky" />
            {/* A COHORT reading: of the quotes raised in this period, this many have since been
                accepted. PackageQuote records when a quote was created, not when it was accepted,
                so "accepted during this period" is not a question the data can answer — and
                labelling this as if it were would be the easy, wrong version. */}
            <Metric label="…of those, accepted" value={d.pulse.packageQuotesAccepted ?? 0}
              helper={d.pulse.packageQuotes > 0
                ? `${Math.round((d.pulse.packageQuotesAccepted / d.pulse.packageQuotes) * 100)}% taken so far`
                : "Nothing raised in this period"}
              Icon={Handshake} tone="emerald" />
            <Metric label="Packages added" value={d.pulse.packagesAdded ?? 0}
              helper="New rows in the catalog" Icon={Package} tone="violet" />
          </div>
        )}
      </ConsolePanel>

      <div className="grid gap-5 xl:grid-cols-2">
        <ConsolePanel
          title="What needs a decision"
          description="Every package queue, and how much is in it."
        >
          <ActionLink
            to="/console/package-catalog?tab=queue"
            label="Agency submissions"
            helper="A package another agency wants to sell here"
            value={d.reviewQueue ?? 0}
            Icon={ClipboardCheck}
            urgent
          />
          <ActionLink
            to="/console/package-catalog/mix"
            label="Custom requests"
            helper="An agency is waiting on a bespoke price"
            value={d.mixPending ?? 0}
            Icon={Wand2}
            urgent
          />
          <ActionLink
            to="/console/package-catalog"
            label="Unpublished packages"
            helper="In the catalog but not sellable"
            value={d.unpublished ?? 0}
            Icon={Package}
          />
        </ConsolePanel>

        <ConsolePanel
          title="Newest packages"
          description="Most recently added to the catalog."
          action={<SmallLink to="/console/package-catalog">Full catalog</SmallLink>}
        >
          {(d.recent ?? []).length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">No packages yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {d.recent.map((p) => (
                <li key={p.publicId} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-heading">{p.title}</div>
                    <div className="truncate text-xs text-muted">
                      {[p.packageCode, p.stateName, p.nights ? `${p.nights}N` : null]
                        .filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-md bg-surface-hover px-2 py-0.5 text-[11px] font-semibold text-muted">
                    {p.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ConsolePanel>
      </div>

      {/* The commercial half. Rules rather than revenue — see the note at the top of this file for
          why there is no earnings figure here yet. */}
      <ConsolePanel
        title="Commercials"
        description="What the platform adds on a cost-only package slab."
        action={<SmallLink to="/console/pricing?section=package">Pricing rules</SmallLink>}
      >
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <Metric label="Tier rules" value={d.tierRules ?? 0} helper="Pinned to one tier" Icon={Percent} tone="violet" />
          <Metric label="Package rules" value={d.packageRules ?? 0} helper="Cover every tier of a package" Icon={Percent} tone="sky" />
          <Metric
            label="Catalog default"
            value={d.hasCatalogRule ? "Set" : "None"}
            helper={d.hasCatalogRule ? "Prices packages with no rule of their own" : "Cost-only slabs fall through to the configured fallback"}
            Icon={Percent}
            tone={d.hasCatalogRule ? "emerald" : "rose"}
            danger={!d.hasCatalogRule}
          />
        </div>
      </ConsolePanel>
    </div>
  );
}
