// src/features/hotels/pages/HotelDashboard.jsx
// Owner / group dashboard — the command centre for the whole hotel portfolio.
// Every figure is loaded from hotelService (mock today, API-ready).
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Building2, BedDouble, DoorOpen, DoorClosed, LogIn, LogOut,
  CalendarClock, XCircle, IndianRupee, TrendingUp, Star, Gauge, Bell, RefreshCw,
  Radio, Trophy, MapPin, BrainCircuit, ClipboardList, GitBranch, ArrowRight,
} from "lucide-react";
import hotelService from "../api/hotelService";
import {
  PageShell, PageHeader, SectionCard, GradientStat, StatStrip, Badge,
  LoadingState, EmptyState, useToast, errMsg, cn,
  ROOM_STATE, PAYMENT_STATUS, BOOKING_STATUS, StatusBadge, StarRating,
  fmtMoney, fmtMoneyShort, Button, SkeletonCards,
} from "../components/hotelUi";
import { RevenueArea, BarSeries, TrendLine, DualTrend, SourcePie } from "../components/hotelCharts";
import { Donut, DonutLegend, Timeline, FlowChain, ERDiagram, InsightCard } from "../components/hotelWidgets";

const ROOM_STATE_COLOR = {
  AVAILABLE: "#22c55e", OCCUPIED: "#3b82f6", CLEANING: "#f59e0b", MAINTENANCE: "#ef4444", BLOCKED: "#64748b",
};
const TONE_TEXT = {
  blue: "text-blue-500", green: "text-green-500", amber: "text-amber-500", red: "text-red-500",
  purple: "text-purple-500", teal: "text-teal-500", indigo: "text-indigo-500", slate: "text-slate-500",
};
const TONE_BG = {
  blue: "bg-blue-50", green: "bg-green-50", amber: "bg-amber-50", red: "bg-red-50",
  purple: "bg-purple-50", teal: "bg-teal-50", indigo: "bg-indigo-50", slate: "bg-slate-100",
};

const GUEST_JOURNEY = [
  "Search Hotel", "Select Room", "Book", "Payment", "Voucher", "WhatsApp",
  "Check-in", "Stay", "Check-out", "Review",
];

const BOOKING_LIFECYCLE = [
  { title: "Booking Created", tone: "blue" }, { title: "Payment Received", tone: "green" },
  { title: "Voucher Generated", tone: "indigo" }, { title: "WhatsApp Sent", tone: "teal" },
  { title: "Email Sent", tone: "purple" }, { title: "SMS Sent", tone: "amber" },
  { title: "Reminder Sent", tone: "amber" }, { title: "Checked In", tone: "green" },
  { title: "Checked Out", tone: "slate", done: false }, { title: "Review Requested", tone: "slate", done: false },
];

export default function HotelDashboard() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    hotelService.dashboard()
      .then((d) => alive && setData(d))
      .catch((e) => alive && showToast(errMsg(e, "Failed to load dashboard."), "error"))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [showToast]);

  if (loading || !data) {
    return (
      <PageShell>
        <PageHeader title="Hotel Dashboard" subtitle="Portfolio overview" icon={LayoutDashboard} />
        <SkeletonCards count={6} className="mb-5" />
        <LoadingState label="Loading hotel dashboard…" />
      </PageShell>
    );
  }

  const k = data.kpis;
  const roomSegments = Object.entries(data.roomStatus).map(([key, value]) => ({
    key, label: ROOM_STATE[key]?.label || key, value, color: ROOM_STATE_COLOR[key] || "#94a3b8",
  }));

  const heroKpis = [
    { gradient: "bg-gradient-to-br from-blue-500 to-blue-700", icon: Building2, label: "Total Hotels", value: k.totalHotels },
    { gradient: "bg-gradient-to-br from-teal-500 to-cyan-700", icon: BedDouble, label: "Total Rooms", value: k.totalRooms },
    { gradient: "bg-gradient-to-br from-green-500 to-emerald-700", icon: DoorOpen, label: "Available", value: k.availableRooms },
    { gradient: "bg-gradient-to-br from-indigo-500 to-violet-700", icon: DoorClosed, label: "Occupied", value: k.occupiedRooms },
    { gradient: "bg-gradient-to-br from-amber-500 to-orange-600", icon: Gauge, label: "Occupancy", value: `${k.occupancy}%` },
    { gradient: "bg-gradient-to-br from-rose-500 to-red-700", icon: IndianRupee, label: "Revenue Today", value: fmtMoneyShort(k.revenueToday) },
  ];

  const secondaryKpis = [
    { key: "ci", label: "Today's Check-ins", value: k.checkinsToday, icon: LogIn, tone: "text-green-500", accent: "bg-green-50" },
    { key: "co", label: "Today's Check-outs", value: k.checkoutsToday, icon: LogOut, tone: "text-blue-500", accent: "bg-blue-50" },
    { key: "ua", label: "Upcoming Arrivals", value: k.upcomingArrivals, icon: CalendarClock, tone: "text-indigo-500", accent: "bg-indigo-50" },
    { key: "cx", label: "Cancelled", value: k.cancelled, icon: XCircle, tone: "text-red-500", accent: "bg-red-50" },
    { key: "rm", label: "Revenue / Month", value: fmtMoneyShort(k.revenueMonth), icon: TrendingUp, tone: "text-emerald-500", accent: "bg-emerald-50" },
    { key: "ar", label: "Avg Rating", value: k.avgRating, icon: Star, tone: "text-amber-500", accent: "bg-amber-50" },
  ];

  return (
    <PageShell>
      <PageHeader title="Hotel Dashboard" subtitle="Live portfolio performance across all properties" icon={LayoutDashboard}>
        <Button variant="outline" size="sm" onClick={() => navigate("/hotels")}><Building2 className="h-4 w-4" /> Hotels</Button>
        <Button size="sm" onClick={() => navigate("/hotels/bookings")}><CalendarClock className="h-4 w-4" /> Bookings</Button>
      </PageHeader>

      {/* Hero KPI row */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {heroKpis.map((s) => <GradientStat key={s.label} {...s} />)}
      </div>

      {/* Secondary KPI strip */}
      <StatStrip items={secondaryKpis} className="mb-6" />

      {/* Room status + Revenue analytics */}
      <div className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <SectionCard title="Room Status" subtitle="Live across the group" icon={BedDouble}>
          <div className="flex flex-col items-center gap-5 sm:flex-row">
            <Donut segments={roomSegments} center={`${k.occupancy}%`} centerLabel="Occupied" />
            <DonutLegend segments={roomSegments} />
          </div>
        </SectionCard>

        <SectionCard title="Daily Revenue" subtitle="Last 14 days" icon={IndianRupee} className="xl:col-span-2">
          <RevenueArea data={data.dailyRevenue} fmt={(v) => fmtMoneyShort(v)} />
        </SectionCard>
      </div>

      {/* Revenue analytics grid */}
      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SectionCard title="Monthly Revenue" icon={TrendingUp}>
          <BarSeries data={data.monthlyRevenue} fmt={(v) => fmtMoneyShort(v)} />
        </SectionCard>
        <SectionCard title="Occupancy Trend" icon={Gauge}>
          <TrendLine data={data.dailyRevenue} dataKey="occupancy" name="Occupancy %" fmt={(v) => `${v}%`} />
        </SectionCard>
        <SectionCard title="ADR & RevPAR" subtitle="Average Daily Rate vs Revenue per Available Room" icon={IndianRupee}>
          <DualTrend data={data.dailyRevenue} />
        </SectionCard>
        <SectionCard title="Booking Sources" subtitle="Where reservations come from" icon={Radio}>
          <SourcePie data={data.sourceCounts} />
        </SectionCard>
      </div>

      {/* Today's schedule + notifications + payment status */}
      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <SectionCard title="Today's Schedule" icon={ClipboardList}>
          <ul className="space-y-3">
            {data.schedule.map((s, i) => (
              <li key={i} className="flex gap-3">
                <div className={cn("flex h-11 w-14 shrink-0 flex-col items-center justify-center rounded-xl text-[11px] font-extrabold", TONE_BG[s.tone], TONE_TEXT[s.tone])}>
                  {s.time}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-700">{s.title}</p>
                  <p className="truncate text-xs text-slate-400">{s.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Notification Center" icon={Bell} right={<Badge variant="blue">{data.notifications.length} new</Badge>}>
          <ul className="space-y-2.5">
            {data.notifications.map((n) => (
              <li key={n.id} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-white/60 p-3">
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", TONE_TEXT[n.tone].replace("text-", "bg-"))} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-bold text-slate-700">{n.type}</p>
                    <span className="shrink-0 text-[10px] font-semibold text-slate-400">{n.when}</span>
                  </div>
                  <p className="truncate text-xs text-slate-400">{n.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>

        <div className="space-y-5">
          <SectionCard title="Payment Status" icon={IndianRupee}>
            <div className="grid grid-cols-2 gap-3">
              {Object.keys(PAYMENT_STATUS).map((key) => (
                <div key={key} className="rounded-xl border border-slate-100 bg-white/60 p-3">
                  <p className="text-lg font-extrabold text-slate-800">{data.payments[key] ?? 0}</p>
                  <StatusBadge config={PAYMENT_STATUS} value={key} />
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-green-50 p-3">
                <p className="text-[11px] font-bold uppercase text-green-600">Total Collection</p>
                <p className="text-lg font-extrabold text-green-700">{fmtMoneyShort(data.payments.totalCollection)}</p>
              </div>
              <div className="rounded-xl bg-amber-50 p-3">
                <p className="text-[11px] font-bold uppercase text-amber-600">Outstanding</p>
                <p className="text-lg font-extrabold text-amber-700">{fmtMoneyShort(data.payments.outstanding)}</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Upcoming Reminders" icon={CalendarClock}>
            <ul className="space-y-2 text-sm">
              <ReminderRow label="Tomorrow Check-ins" value={data.reminders.checkinsTomorrow} tone="blue" />
              <ReminderRow label="WhatsApp Pending" value={data.reminders.whatsappPending} tone="green" />
              <ReminderRow label="Email Pending" value={data.reminders.emailPending} tone="purple" />
              <ReminderRow label="SMS Pending" value={data.reminders.smsPending} tone="amber" />
            </ul>
          </SectionCard>
        </div>
      </div>

      {/* OTA channel manager + Hotel performance + Live map */}
      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <SectionCard title="OTA Channel Manager" subtitle="Sync status across channels" icon={Radio}
          right={<Button variant="outline" size="sm"><RefreshCw className="h-4 w-4" /> Sync All</Button>}>
          <ul className="space-y-2.5">
            {data.channels.map((c) => {
              const map = { SYNCED: "green", SYNCING: "amber", ERROR: "red" };
              return (
                <li key={c.name} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white/60 px-3 py-2.5">
                  <div>
                    <p className="text-[13px] font-bold text-slate-700">{c.name}</p>
                    <p className="text-[11px] text-slate-400">Last sync · {c.lastSync}</p>
                  </div>
                  <Badge variant={map[c.status]}>{c.status}</Badge>
                </li>
              );
            })}
          </ul>
        </SectionCard>

        <SectionCard title="Hotel Performance" subtitle="Top properties by revenue" icon={Trophy} className="lg:col-span-2">
          <ul className="space-y-2">
            {data.performance.slice(0, 6).map((h, i) => (
              <li key={h.id}>
                <button onClick={() => navigate(`/hotels/${h.id}`)}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-white/60 p-3 text-left transition-colors hover:bg-slate-50">
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-extrabold",
                    i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-slate-200 text-slate-600" : i === 2 ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500")}>
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-700">{h.name}</p>
                    <p className="text-xs text-slate-400">{h.city}</p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="text-xs font-semibold text-slate-500">{h.occupancy}% occ</p>
                    <StarRating value={h.rating} size={12} showValue />
                  </div>
                  <span className="shrink-0 text-sm font-extrabold text-slate-800">{fmtMoneyShort(h.revenue)}</span>
                </button>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      {/* Live booking map + check-in / check-out boards */}
      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <SectionCard title="Live Booking Map" subtitle="Bookings by city (India)" icon={MapPin}>
          <IndiaMap points={data.map} />
        </SectionCard>

        <SectionCard title="Check-in Board" subtitle="Today's arrivals" icon={LogIn}>
          {data.checkinBoard.length === 0 ? <EmptyState icon={LogIn} title="No check-ins today" /> : (
            <ul className="divide-y divide-slate-100">
              {data.checkinBoard.map((b, i) => (
                <li key={i} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-bold text-slate-700">{b.guest}</p>
                    <p className="text-xs text-slate-400">Room {b.room} · {b.time}</p>
                  </div>
                  <StatusBadge config={BOOKING_STATUS} value={b.status} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Check-out Board" subtitle="Today's departures" icon={LogOut}>
          {data.checkoutBoard.length === 0 ? <EmptyState icon={LogOut} title="No check-outs today" /> : (
            <ul className="divide-y divide-slate-100">
              {data.checkoutBoard.map((b, i) => (
                <li key={i} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-bold text-slate-700">{b.guest}</p>
                    <p className="text-xs text-slate-400">Room {b.room}</p>
                  </div>
                  {b.pending > 0
                    ? <Badge variant="amber">{fmtMoney(b.pending)} due</Badge>
                    : <Badge variant="green">Settled</Badge>}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* AI insights */}
      <SectionCard title="AI Insights" subtitle="Predictive analytics & recommendations" icon={BrainCircuit} className="mb-6" bodyClass="p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.insights.map((ins, i) => <InsightCard key={i} {...ins} />)}
        </div>
      </SectionCard>

      {/* Booking lifecycle timeline + guest journey */}
      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <SectionCard title="Booking Timeline" subtitle="Lifecycle of a reservation" icon={GitBranch}>
          <Timeline steps={BOOKING_LIFECYCLE} />
        </SectionCard>
        <SectionCard title="Guest Journey" subtitle="From search to review" icon={ArrowRight} className="lg:col-span-2">
          <FlowChain steps={GUEST_JOURNEY} />
          <div className="mt-6">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Database Relation Diagram</p>
            <div className="overflow-x-auto pb-2">
              <ERDiagram />
            </div>
          </div>
        </SectionCard>
      </div>
    </PageShell>
  );
}

function ReminderRow({ label, value, tone }) {
  return (
    <li className="flex items-center justify-between rounded-xl border border-slate-100 bg-white/60 px-3 py-2">
      <span className="text-slate-600">{label}</span>
      <Badge variant={tone === "blue" ? "blue" : tone === "green" ? "green" : tone === "purple" ? "purple" : "amber"}>{value}</Badge>
    </li>
  );
}

/* Lightweight India map — positions city dots on a simplified SVG outline, sized by booking count. */
function IndiaMap({ points = [] }) {
  // normalise lat/lng to a 0..100 box (rough India bounds: lat 8–35, lng 68–90)
  const project = (lat, lng) => ({
    x: ((lng - 68) / (90 - 68)) * 100,
    y: (1 - (lat - 8) / (35 - 8)) * 100,
  });
  const max = Math.max(1, ...points.map((p) => p.bookings));
  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-[240px]">
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <path
          d="M30 8 L45 6 L52 12 L60 10 L68 16 L64 26 L70 34 L60 44 L54 62 L48 78 L44 90 L40 76 L34 60 L28 48 L22 40 L26 30 L24 20 Z"
          fill="#eff6ff" stroke="#bfdbfe" strokeWidth="0.8" strokeLinejoin="round"
        />
        {points.map((p) => {
          const { x, y } = project(p.lat, p.lng);
          const r = 1.6 + (p.bookings / max) * 3.2;
          return (
            <g key={p.city}>
              <circle cx={x} cy={y} r={r + 1.5} fill="#3b82f6" opacity="0.15" />
              <circle cx={x} cy={y} r={r} fill="#2563eb">
                <title>{`${p.city}: ${p.bookings} bookings`}</title>
              </circle>
            </g>
          );
        })}
      </svg>
      <ul className="absolute inset-x-0 bottom-0 flex flex-wrap justify-center gap-x-3 gap-y-1">
        {points.map((p) => (
          <li key={p.city} className="text-[10px] font-semibold text-slate-500">
            {p.city} <span className="font-extrabold text-blue-600">{p.bookings}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
