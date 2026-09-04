// src/console/components/TransportMarketplaceDashboard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The transport supply line at a glance — the second marketplace to get one.
//
// Built the way the hotel dashboard is: by COMPOSING the list and summary calls
// that already exist, rather than adding a dedicated dashboard endpoint. Each
// list is asked for one row purely to read its `totalElements`, which is the
// cheapest way to count without a new API, and every call is independent so one
// failure degrades a tile rather than the page.
//
// ── What is deliberately NOT here ───────────────────────────────────────────
// Occupancy. Hotels have a stay calendar because a room-night is a finite thing
// the platform commits; a vehicle order is a duty on a date, and there is no
// allotment model behind it to report on. Inventing a chart for it would be a
// picture of nothing.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import {
  Car, ClipboardCheck, Coins, Handshake, Loader2, Percent, RefreshCw,
} from "lucide-react";

import { toast } from "@shared/ui/toast";
import { getErrorMessage } from "@shared/api/apiError";

import { transportAdminService } from "../api/transportAdminService";
import { transportPartnerService } from "../api/transportPartnerService";
import { platformHealthService } from "../api/platformHealthService";
import { ConsolePanel } from "./ConsoleUi";
import { ActionLink, DegradedNote, Metric, SmallLink, count, money } from "./marketplaceDashboardUi";
import { NowTag } from "./RangePicker";

export default function TransportMarketplaceDashboard({ pendingOrders = 0, range, periodLabel = "this month" }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [degraded, setDegraded] = useState(false);

  const load = useCallback(async (background = false) => {
    if (background) setRefreshing(true); else setLoading(true);
    const rangeReady = Boolean(range?.from && range?.to);

    const results = await Promise.allSettled([
      transportAdminService.listVehicles({ page: 0, size: 1 }),
      transportAdminService.listVehicles({ page: 0, size: 1, status: "ACTIVE" }),
      transportPartnerService.listRegistrations({ page: 0, size: 1, status: "SUBMITTED" }),
      transportAdminService.listOrders({ page: 0, size: 6 }),
      // The ledger summary takes from/to as of this change — it previously accepted tenantId only,
      // so "what did transport earn this week" was a question the console could not ask.
      transportAdminService.commissionSummary(rangeReady ? range : {}),
      rangeReady ? platformHealthService.pulse(range) : Promise.resolve(null),
    ]);

    const at = (i, fallback) => (results[i].status === "fulfilled" ? results[i].value : fallback);

    const catalog = at(0, { items: [], pagination: null });
    const active = at(1, { items: [], pagination: null });
    const registrations = at(2, { rows: [], items: [], pagination: null });
    const orders = at(3, { items: [], pagination: null });
    const earnings = at(4, {}) ?? {};
    const pulse = at(5, null);

    const total = count(catalog.pagination, catalog.items?.length);
    const live = count(active.pagination, active.items?.length);

    setData({
      catalogTotal: total,
      activeVehicles: live,
      // Everything in the catalog that is not live: drafts, and anything unpublished.
      unpublished: Math.max(total - live, 0),
      partnerReviews: count(registrations.pagination,
        (registrations.rows ?? registrations.items ?? []).length),
      recentOrders: orders.items ?? [],
      ordersTotal: count(orders.pagination, (orders.items ?? []).length),
      earnings,
      pulse,
      rangeReady,
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
  const currency = d.earnings?.currency || "INR";

  return (
    <div className="space-y-5">
      {degraded && <DegradedNote />}

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          The vehicle supply line — catalog, operators, and the orders waiting on a decision.
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
          label={<>Vehicles live<NowTag /></>}
          value={d.activeVehicles ?? 0}
          helper={`${d.catalogTotal ?? 0} in the catalog · ${d.unpublished ?? 0} not published`}
          Icon={Car}
          tone="sky"
        />
        <Metric
          label={<>Orders awaiting a decision<NowTag /></>}
          value={pendingOrders}
          helper={pendingOrders > 0 ? "A tenant is holding a customer" : "Queue is clear"}
          Icon={ClipboardCheck}
          tone="amber"
          danger={pendingOrders > 0}
        />
        <Metric
          label={<>Operators to review<NowTag /></>}
          value={d.partnerReviews ?? 0}
          helper="Submitted registrations"
          Icon={Handshake}
          tone="violet"
        />
        {/* This read `totalEarning ?? total`. TransportCommissionSummaryDto has NEITHER — the
            field is `netEarning` (Σ every live ledger row, signed, so reversals net out). Both
            guesses missed, so the fallback ran and the tile reported ₹0 on every load however much
            transport had actually earned. The defensive `??` chain is what hid it: with a single
            field name a typo is a blank tile somebody reports, and a plausible zero is not. */}
        <Metric
          label={`Earnings · ${periodLabel}`}
          value={money(d.earnings?.netEarning, currency)}
          helper={`${money(d.earnings?.pendingBalance, currency)} pending settlement`}
          Icon={Coins}
          tone="emerald"
        />
      </div>

      {d.pulse && (
        <ConsolePanel
          title={`Demand · ${periodLabel}`}
          description="Orders raised by tenants over the selected period."
        >
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Metric label="Orders raised" value={d.pulse.transportOrders ?? 0}
              helper="Requested in this period" Icon={ClipboardCheck} tone="sky" />
            {/* A cohort reading: of the orders raised then, this many are confirmed today. There is
                no confirmedAt to range on, so "confirmed during the period" is not answerable. */}
            <Metric label="…of those, confirmed" value={d.pulse.transportOrdersConfirmed ?? 0}
              helper={d.pulse.transportOrders > 0
                ? `${Math.round((d.pulse.transportOrdersConfirmed / d.pulse.transportOrders) * 100)}% confirmed so far`
                : "Nothing raised in this period"}
              Icon={Handshake} tone="emerald" />
          </div>
        </ConsolePanel>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <ConsolePanel
          title="What needs a decision"
          description="Every transport queue, and how much is in it."
        >
          <ActionLink
            to="/console/transport-requests"
            label="Transport booking requests"
            helper="A tenant is waiting on a vehicle and a driver"
            value={pendingOrders}
            Icon={ClipboardCheck}
            urgent
          />
          <ActionLink
            to="/console/transport-partners"
            label="Operator registrations"
            helper="Submitted profiles waiting on review"
            value={d.partnerReviews ?? 0}
            Icon={Handshake}
            urgent
          />
          <ActionLink
            to="/console/transport-catalog"
            label="Unpublished vehicles"
            helper="In the catalog but not sellable"
            value={d.unpublished ?? 0}
            Icon={Car}
          />
        </ConsolePanel>

        <ConsolePanel
          title="Recent orders"
          description="Newest first."
          action={<SmallLink to="/console/transport-requests">All orders</SmallLink>}
        >
          {(d.recentOrders ?? []).length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">No transport orders yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {d.recentOrders.map((o) => (
                <li key={o.publicId} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-heading">
                      {o.vehicleName || o.serviceType || "Transport order"}
                    </div>
                    <div className="truncate text-xs text-muted">
                      {[o.tenantName, o.orderCode].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-md bg-surface-hover px-2 py-0.5 text-[11px] font-semibold text-muted">
                    {o.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ConsolePanel>
      </div>

      <ConsolePanel
        title={`Commercials · ${periodLabel}`}
        description="What the platform takes on a transport order, over the selected period."
        action={<SmallLink to="/console/pricing?section=transport">Pricing rules</SmallLink>}
      >
        {/* Was two tiles: the same netEarning figure again, and "Orders in the ledger" showing the
            ORDER list total — a number from a different table than the label named. Neither told an
            operator anything the tile above had not. These three are the breakdown the ledger
            actually holds. */}
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <Metric
            label="Not yet earned"
            value={money(d.earnings?.pendingBalance, currency)}
            helper="Accrued, but the journey has not run"
            Icon={Coins}
            tone="amber"
          />
          <Metric
            label="Settled"
            value={money(d.earnings?.settledBalance, currency)}
            helper="Paid out to operators"
            Icon={Coins}
            tone="emerald"
          />
          <Metric
            label="Ledger entries"
            value={d.earnings?.entryCount ?? 0}
            helper="Accruals, reversals and adjustments"
            Icon={Percent}
            tone="violet"
          />
        </div>
      </ConsolePanel>
    </div>
  );
}
