import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BedDouble,
  CalendarRange,
  ClipboardCheck,
  Coins,
  Handshake,
  Hotel,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { hotelPartnerService } from "../api/hotelPartnerService";
import { marketplaceCreditService } from "../api/marketplaceAdminService";
import { marketplaceBookingService } from "../api/marketplaceBookingService";
import { marketplaceCommissionService } from "../api/marketplaceCommissionService";
import { marketplaceOccupancyService } from "../api/marketplaceOccupancyService";
import { platformHotelService } from "../api/platformHotelService";
import { ConsolePageHeader, ConsolePanel } from "./ConsoleUi";

const money = (value, currency = "INR") => `${currency === "INR" ? "₹" : `${currency} `}${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const count = (pagination, fallback = 0) => Number(pagination?.totalElements ?? fallback ?? 0);

function HotelMetric({ label, value, helper, Icon, tone = "violet", danger = false }) {
  const tones = {
    violet: "bg-hue-violet-soft text-hue-violet",
    emerald: "bg-hue-emerald-soft text-hue-emerald",
    amber: "bg-hue-amber-soft text-hue-amber",
    sky: "bg-hue-sky-soft text-hue-sky",
    rose: "bg-hue-rose-soft text-hue-rose",
  };
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--sa-card-shadow)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted">{label}</div>
          <div className={`mt-2 truncate font-mono text-2xl font-bold tracking-tight ${danger ? "text-hue-rose" : "text-heading"}`}>{value}</div>
        </div>
        <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}><Icon size={17} /></span>
      </div>
      <div className="mt-2 text-xs text-body">{helper}</div>
    </div>
  );
}

function ActionLink({ to, label, helper, value, Icon, urgent = false }) {
  return (
    <Link to={to} className="group flex items-center gap-3 border-b border-border px-5 py-3.5 last:border-b-0 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent">
      <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${urgent && value > 0 ? "bg-hue-amber-soft text-hue-amber" : "bg-surface-hover text-muted"}`}><Icon size={17} /></span>
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-heading">{label}</span><span className="block truncate text-xs text-muted">{value > 0 ? helper : "No action waiting"}</span></span>
      <span className={`font-mono text-lg font-bold ${value > 0 ? "text-heading" : "text-muted"}`}>{value}</span>
      <ArrowRight size={15} className="text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
    </Link>
  );
}

function SmallLink({ to, children }) {
  return <Link to={to} className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">{children} <ArrowRight size={13} /></Link>;
}

export default function HotelMarketplaceDashboard({ pendingBookings = 0, openNominations = 0 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [degraded, setDegraded] = useState(false);

  const load = useCallback(async (background = false) => {
    background ? setRefreshing(true) : setLoading(true);
    const results = await Promise.allSettled([
      platformHotelService.list({ page: 0, size: 1 }),
      platformHotelService.list({ page: 0, size: 1, status: "ACTIVE" }),
      hotelPartnerService.listRegistrations({ page: 0, size: 1, status: "SUBMITTED" }),
      marketplaceCreditService.list(),
      marketplaceCommissionService.summary({}),
      marketplaceOccupancyService.list({}),
      marketplaceBookingService.list({ page: 0, size: 6 }),
    ]);
    const value = (index, fallback) => results[index].status === "fulfilled" ? results[index].value : fallback;
    const catalog = value(0, { items: [], pagination: null });
    const activeCatalog = value(1, { items: [], pagination: null });
    const registrations = value(2, { rows: [], pagination: null });
    const credits = value(3, []);
    const earnings = value(4, {});
    const occupancy = value(5, []);
    const bookings = value(6, { items: [], pagination: null });

    const occupancyTotals = occupancy.reduce((totals, property) => ({
      committed: totals.committed + Number(property.totalRoomNightsCommitted || 0),
      pending: totals.pending + Number(property.totalRoomNightsPending || 0),
      bookings: totals.bookings + Number(property.distinctBookings || 0),
    }), { committed: 0, pending: 0, bookings: 0 });
    const busiest = [...occupancy].sort((a, b) =>
      (Number(b.totalRoomNightsCommitted || 0) + Number(b.totalRoomNightsPending || 0))
      - (Number(a.totalRoomNightsCommitted || 0) + Number(a.totalRoomNightsPending || 0))).slice(0, 5);
    const outstanding = credits.reduce((sum, row) => sum + Number(row.outstanding || 0), 0);

    setData({
      catalogTotal: count(catalog.pagination, catalog.items.length),
      activeHotels: count(activeCatalog.pagination, activeCatalog.items.length),
      partnerReviews: count(registrations.pagination, registrations.rows.length),
      credits,
      outstanding,
      creditCurrency: credits[0]?.currency || "INR",
      earnings,
      occupancyTotals,
      busiest,
      recentBookings: bookings.items,
    });
    setDegraded(results.some((result) => result.status === "rejected"));
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const active = data?.activeHotels ?? 0;
  const total = data?.catalogTotal ?? 0;
  const drafts = Math.max(total - active, 0);
  const creditRisks = data?.credits?.filter((row) => Number(row.outstanding || 0) > 0).length ?? 0;
  const earningCurrency = data?.earnings?.currency || "INR";

  return (
    <div className="space-y-5">
      <ConsolePageHeader eyebrow="Hotel marketplace command center" title="Hotel marketplace"
        description="Operate hotel supply, booking decisions, room-night commitments, tenant exposure and platform earnings."
        meta={`${total.toLocaleString("en-IN")} catalog properties · ${active.toLocaleString("en-IN")} currently published`}
        actions={<button type="button" onClick={() => load(true)} disabled={refreshing}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 text-xs font-semibold text-heading hover:bg-surface-hover disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh hotel data
        </button>} />

      {degraded && (
        <div className="flex items-start gap-3 rounded-xl border border-hue-amber/30 bg-hue-amber-soft px-4 py-3 text-sm text-body" role="status">
          <AlertTriangle size={17} className="mt-0.5 shrink-0 text-hue-amber" />
          Some hotel feeds are unavailable. Available live figures are shown; refresh before taking a financial decision.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <HotelMetric label="Published hotel supply" value={loading ? "—" : `${active}/${total}`} helper={`${drafts} draft, inactive or suspended properties`} Icon={Hotel} tone="emerald" />
        <HotelMetric label="Booking decisions" value={pendingBookings} helper="Requests currently waiting on the platform" Icon={ClipboardCheck} tone="amber" danger={pendingBookings > 0} />
        <HotelMetric label="Committed room-nights" value={loading ? "—" : data.occupancyTotals.committed.toLocaleString("en-IN")} helper="Current occupancy window; not hotel availability" Icon={CalendarRange} tone="sky" />
        <HotelMetric label="Net platform earning" value={loading ? "—" : money(data.earnings?.netEarning, earningCurrency)} helper={`${money(data?.earnings?.pendingBalance, earningCurrency)} pending settlement`} Icon={Coins} tone="violet" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <ConsolePanel title="Hotel action inbox" description="Queues owned by marketplace operations" className="xl:col-span-3">
          <ActionLink to="/console/hotel-requests" label="Booking requests" helper="Review availability, pricing and tenant commitment" value={pendingBookings} Icon={ClipboardCheck} urgent />
          <ActionLink to="/console/hotel-nominations" label="Tenant hotel nominations" helper="Accept into partner onboarding or reject with reason" value={openNominations} Icon={Handshake} urgent />
          <ActionLink to="/console/hotel-partners" label="Partner applications" helper="Submitted hotel registrations need review" value={data?.partnerReviews ?? 0} Icon={BedDouble} urgent />
          <ActionLink to="/console/hotel-credit" label="Tenant balances" helper="Tenants currently carrying unsettled marketplace debt" value={creditRisks} Icon={Wallet} urgent />
          <ActionLink to="/console/hotel-catalog" label="Unpublished catalogue" helper="Complete or review properties not currently for sale" value={drafts} Icon={Hotel} />
        </ConsolePanel>

        <div className="space-y-4 xl:col-span-2">
          <ConsolePanel title="Financial position" description="Marketplace-only economics; never tenant-visible"
            action={<SmallLink to="/console/hotel-commissions">Earning ledger</SmallLink>}>
            <div className="grid grid-cols-2 gap-px bg-border">
              <div className="bg-surface p-4"><div className="text-[11px] text-muted">Net earning</div><div className="mt-1 font-mono text-lg font-bold text-heading">{loading ? "—" : money(data.earnings?.netEarning, earningCurrency)}</div></div>
              <div className="bg-surface p-4"><div className="text-[11px] text-muted">Settled earning</div><div className="mt-1 font-mono text-lg font-bold text-hue-emerald">{loading ? "—" : money(data.earnings?.settledBalance, earningCurrency)}</div></div>
              <div className="bg-surface p-4"><div className="text-[11px] text-muted">Pending earning</div><div className="mt-1 font-mono text-lg font-bold text-hue-amber">{loading ? "—" : money(data.earnings?.pendingBalance, earningCurrency)}</div></div>
              <div className="bg-surface p-4"><div className="text-[11px] text-muted">Tenant outstanding</div><div className="mt-1 font-mono text-lg font-bold text-hue-rose">{loading ? "—" : money(data.outstanding, data.creditCurrency)}</div></div>
            </div>
            <div className="border-t border-border px-5 py-3"><SmallLink to="/console/hotel-credit">Manage tenant credit</SmallLink></div>
          </ConsolePanel>

          <ConsolePanel title="Room-night commitments" description="Current default occupancy window"
            action={<SmallLink to="/console/hotel-occupancy">Stay calendar</SmallLink>}>
            <div className="grid grid-cols-3 divide-x divide-border px-2 py-4 text-center">
              <div><div className="font-mono text-lg font-bold text-heading">{loading ? "—" : data.occupancyTotals.committed}</div><div className="text-[10px] text-muted">Committed</div></div>
              <div><div className="font-mono text-lg font-bold text-hue-amber">{loading ? "—" : data.occupancyTotals.pending}</div><div className="text-[10px] text-muted">Pending</div></div>
              <div><div className="font-mono text-lg font-bold text-heading">{loading ? "—" : data.occupancyTotals.bookings}</div><div className="text-[10px] text-muted">Bookings</div></div>
            </div>
            {!!data?.busiest?.length && <div className="border-t border-border px-5 py-3"><div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted">Busiest properties</div>{data.busiest.map((property) => <div key={property.hotelPublicId || property.hotelName} className="flex justify-between gap-3 py-1 text-xs"><span className="truncate text-body">{property.hotelName}</span><span className="shrink-0 font-mono text-muted">{Number(property.totalRoomNightsCommitted || 0) + Number(property.totalRoomNightsPending || 0)} nights</span></div>)}</div>}
          </ConsolePanel>
        </div>
      </div>

      <ConsolePanel title="Recent hotel booking activity" description="Latest cross-tenant marketplace requests"
        action={<SmallLink to="/console/hotel-requests">Open booking queue</SmallLink>}>
        {!data?.recentBookings?.length ? <div className="px-5 py-10 text-center text-sm text-muted">No hotel booking activity yet.</div> : (
          <div className="divide-y divide-border">
            {data.recentBookings.map((booking) => (
              <Link key={booking.publicId} to="/console/hotel-requests" className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-hover">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-hue-sky-soft text-hue-sky"><BedDouble size={15} /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-heading">{booking.hotelName}</span><span className="block truncate text-xs text-muted">{[booking.tenantName || booking.tenantCode, booking.bookingCode, booking.cityName].filter(Boolean).join(" · ")}</span></span>
                <span className="hidden text-right sm:block"><span className="block font-mono text-xs font-semibold text-heading">{money(booking.quotedTenantPayable ?? booking.tenantPayable, booking.currency)}</span><span className="block text-[10px] text-muted">{booking.status}</span></span>
                <ArrowRight size={14} className="shrink-0 text-muted" />
              </Link>
            ))}
          </div>
        )}
      </ConsolePanel>
    </div>
  );
}
