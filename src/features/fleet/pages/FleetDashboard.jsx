







import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutDashboard, Car, IdCard, Route as RouteIcon, Plus, ShieldAlert, Wrench, CheckCircle2, XCircle, Fuel, Gauge, TrendingUp, IndianRupee, CalendarClock } from "lucide-react";

import fleetService from "../api/fleetService";
import { hasPermission, P } from "@shared/lib/access";
import {
  Button, Badge, cn,
  PageShell, PageHeader, GlassCard, LoadingState, EmptyState, useToast, errMsg,
  StatusBadge, TRIP_STATUS, expiryInfo, fmtDate, fmtDateTime, fmtNumber, fmtMoney,
  usePaged, Pager,
} from "../components/fleetUi";

function StatCard({ gradient, icon: Icon, label, value }) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl p-4 sm:p-5 text-white shadow-lg w-full", gradient)}>
      <div className="absolute -right-5 -top-5 h-24 w-24 rounded-full bg-white/10" />
      <div className="relative z-10">
        <div className="mb-2 sm:mb-3 flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-white/20 shrink-0">
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <p className="text-2xl sm:text-3xl font-extrabold leading-none truncate">{value ?? 0}</p>
        <p className="mt-1 text-[10px] sm:text-xs font-bold uppercase tracking-widest opacity-80 truncate">{label}</p>
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, tone = "text-slate-500" }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-white/60 px-3 py-2.5 min-w-0">
      <Icon className={cn("h-4 w-4 shrink-0", tone)} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold text-slate-700 truncate">{value ?? 0}</p>
        <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-slate-400 truncate">{label}</p>
      </div>
    </div>
  );
}

/** Small labelled figure for the "This Month" spend/trip metrics. */
function KpiCard({ icon: Icon, label, value, tone = "text-slate-500" }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white/70 p-3 sm:p-3.5 min-w-0">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 shrink-0">
        <Icon className={cn("h-4 w-4", tone)} />
      </div>
      <p className="truncate text-base sm:text-lg font-extrabold leading-tight text-slate-800">{value}</p>
      <p className="mt-0.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-slate-400 truncate">{label}</p>
    </div>
  );
}

/**
 * Dependency-free SVG donut for the vehicle-status split. Segments carry a semantic
 * status colour and are always paired with a labelled legend (never colour-alone).
 * Butt-capped arcs with a 2px surface gap between fills.
 */
function Donut({ segments, total, size = 132, thickness = 15, center, centerLabel }) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const gap = 2;
  let acc = 0;
  const arcs = [];
  if (total > 0) {
    for (const s of segments) {
      if (!s.value || s.value <= 0) continue;
      const len = (s.value / total) * c;
      arcs.push({ key: s.key, color: s.color, dash: Math.max(len - gap, 0.001), offset: acc });
      acc += len;
    }
  }
  return (
    <div className="relative shrink-0 mx-auto sm:mx-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={thickness} />
        {arcs.map((a) => (
          <circle
            key={a.key}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={a.color}
            strokeWidth={thickness}
            strokeDasharray={`${a.dash} ${c - a.dash}`}
            strokeDashoffset={-a.offset}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[26px] font-extrabold leading-none text-slate-800">{center}</span>
        {centerLabel && (
          <span className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{centerLabel}</span>
        )}
      </div>
    </div>
  );
}

export default function FleetDashboard() {
  const navigate = useNavigate();
  const { showToast, toastNode } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const canCreate = hasPermission(P.FLEET_CREATE);

  useEffect(() => {
    let alive = true;
    fleetService
      .getDashboard()
      .then((d) => alive && setData(d))
      .catch((e) => alive && showToast(errMsg(e, "Failed to load fleet dashboard."), "error"))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [showToast]);

  // Lists + their client-side pagers (5 rows/page). Declared before the loading
  // early-return so the hooks run unconditionally (rules of hooks).
  const ongoing = data?.ongoingTrips ?? [];
  const upcoming = data?.upcomingTrips ?? [];
  const expiring = data?.expiringDocuments ?? [];
  const serviceDue = data?.serviceDue ?? [];

  const ongoingPage = usePaged(ongoing, 5);
  const upcomingPage = usePaged(upcoming, 5);
  const expiringPage = usePaged(expiring, 5);
  const serviceDuePage = usePaged(serviceDue, 5);

  if (loading) return <PageShell><LoadingState label="Loading fleet dashboard…" /></PageShell>;

  const v = data?.vehicles ?? {};
  const dr = data?.drivers ?? {};
  const spend = data?.monthlySpend ?? {};
  const trips = data?.tripsThisMonth ?? {};

  const totalVehicles = v.total ?? 0;
  const util = totalVehicles > 0 ? Math.round(((v.onTrip ?? 0) / totalVehicles) * 100) : 0;
  const overdueDocs = expiring.filter((d) => d.daysLeft < 0).length;
  const expiringSoon = expiring.length - overdueDocs;
  const statusSegments = [
    { key: "available", label: "Available", value: v.available ?? 0, color: "#22c55e" },
    { key: "onTrip", label: "On Trip", value: v.onTrip ?? 0, color: "#3b82f6" },
    { key: "maintenance", label: "Maintenance", value: v.maintenance ?? 0, color: "#f59e0b" },
    { key: "outOfService", label: "Out of Service", value: v.outOfService ?? 0, color: "#ef4444" },
  ];

  return (
    <PageShell>
      {toastNode}

      <PageHeader title="Vehicle Diary" subtitle="Fleet overview at a glance" icon={LayoutDashboard}>
        {canCreate && (
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
            <Button variant="outline" size="sm" className="flex-1 sm:flex-none justify-center" onClick={() => navigate("/fleet/vehicles/new")}>
              <Plus className="w-4 h-4 mr-1 sm:mr-1.5" /> Vehicle
            </Button>
            <Button variant="outline" size="sm" className="flex-1 sm:flex-none justify-center" onClick={() => navigate("/fleet/drivers/new")}>
              <Plus className="w-4 h-4 mr-1 sm:mr-1.5" /> Driver
            </Button>
            <Button size="sm" className="flex-1 sm:flex-none justify-center" onClick={() => navigate("/fleet/trips/new")}>
              <Plus className="w-4 h-4 mr-1 sm:mr-1.5" /> Trip
            </Button>
          </div>
        )}
      </PageHeader>

      {/* Headline counts */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard gradient="bg-gradient-to-br from-blue-500 to-blue-700" icon={Car} label="Total Vehicles" value={v.total} />
        <StatCard gradient="bg-gradient-to-br from-green-500 to-emerald-700" icon={CheckCircle2} label="Available" value={v.available} />
        <StatCard gradient="bg-gradient-to-br from-indigo-500 to-violet-700" icon={RouteIcon} label="On Trip" value={v.onTrip} />
        <StatCard gradient="bg-gradient-to-br from-amber-500 to-orange-600" icon={Wrench} label="In Maintenance" value={v.maintenance} />
      </div>

      {/* Secondary counts */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MiniStat icon={XCircle} label="Out of Service" value={v.outOfService} tone="text-red-500" />
        <MiniStat icon={IdCard} label="Total Drivers" value={dr.total} tone="text-blue-500" />
        <MiniStat icon={CheckCircle2} label="Active Drivers" value={dr.active} tone="text-green-500" />
        <MiniStat icon={RouteIcon} label="Drivers On Trip" value={dr.onTrip} tone="text-indigo-500" />
        <MiniStat icon={ShieldAlert} label="Docs Expiring" value={expiring.length} tone="text-amber-500" />
        <MiniStat icon={Wrench} label="Service Due" value={serviceDue.length} tone="text-orange-500" />
      </div>

      {/* This month + fleet utilization */}
      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Fleet utilization donut */}
        <GlassCard className="p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2 font-bold text-slate-700">
            <Gauge className="h-4 w-4 text-blue-500 shrink-0" /> Fleet Utilization
          </div>
          <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center sm:items-start xl:items-center gap-5 sm:gap-6">
            <Donut segments={statusSegments} total={totalVehicles} center={`${util}%`} centerLabel="On Trip" />
            <ul className="w-full sm:flex-1 space-y-2">
              {statusSegments.map((s) => (
                <li key={s.key} className="flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="flex-1 font-medium text-slate-600 truncate">{s.label}</span>
                  <span className="font-extrabold text-slate-800 shrink-0">{s.value ?? 0}</span>
                </li>
              ))}
            </ul>
          </div>
        </GlassCard>

        {/* This-month spend + trips */}
        <GlassCard className="p-4 sm:p-5 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2 font-bold text-slate-700">
            <TrendingUp className="h-4 w-4 text-green-500 shrink-0" /> This Month
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <KpiCard icon={Fuel} label="Fuel Spend" value={fmtMoney(spend.fuel)} tone="text-amber-500" />
            <KpiCard icon={Wrench} label="Maintenance" value={fmtMoney(spend.maintenance)} tone="text-orange-500" />
            <KpiCard icon={IndianRupee} label="Total Spend" value={fmtMoney(spend.total)} tone="text-rose-500" />
            <KpiCard icon={CheckCircle2} label="Trips Done" value={fmtNumber(trips.count)} tone="text-green-500" />
            <KpiCard icon={RouteIcon} label="Distance" value={fmtNumber(trips.distanceKm, " km")} tone="text-blue-500" />
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Ongoing trips */}
        <GlassCard>
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <div className="flex items-center gap-2 font-bold text-slate-700 truncate">
              <RouteIcon className="h-4 w-4 text-indigo-500 shrink-0" /> <span className="truncate">Ongoing Trips</span>
            </div>
            <button onClick={() => navigate("/fleet/trips?status=ONGOING")} className="text-xs font-bold text-blue-600 hover:underline shrink-0 pl-2">
              View all
            </button>
          </div>
          {ongoing.length === 0 ? (
            <EmptyState icon={RouteIcon} title="No trips in progress" />
          ) : (
            <>
              <ul className="divide-y divide-slate-100">
                {ongoingPage.pageItems.map((t) => (
                  <li key={t.publicId}>
                    <button onClick={() => navigate(`/fleet/trips/${t.publicId}`)}
                      className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-slate-50/60">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-700">
                          {[t.routeFrom, t.routeTo].filter(Boolean).join(" → ") || "Trip"}
                        </p>
                        <p className="truncate text-xs text-slate-400 mt-0.5">
                          {t.vehicleNumber} · {t.driverName} · {fmtDateTime(t.startDatetime)}
                        </p>
                      </div>
                      <div className="shrink-0 pl-1">
                        <StatusBadge config={TRIP_STATUS} value={t.status} />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
              <Pager {...ongoingPage} onPage={ongoingPage.setPage} />
            </>
          )}
        </GlassCard>

        {/* Upcoming (planned) trips */}
        <GlassCard>
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <div className="flex items-center gap-2 font-bold text-slate-700 truncate">
              <CalendarClock className="h-4 w-4 text-blue-500 shrink-0" /> <span className="truncate">Upcoming Trips</span>
            </div>
            <button onClick={() => navigate("/fleet/trips?status=PLANNED")} className="text-xs font-bold text-blue-600 hover:underline shrink-0 pl-2">
              View all
            </button>
          </div>
          {upcoming.length === 0 ? (
            <EmptyState icon={CalendarClock} title="No upcoming trips" hint="No planned trips in the next few days." />
          ) : (
            <>
              <ul className="divide-y divide-slate-100">
                {upcomingPage.pageItems.map((t) => (
                  <li key={t.publicId}>
                    <button onClick={() => navigate(`/fleet/trips/${t.publicId}`)}
                      className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-slate-50/60">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-700">
                          {[t.routeFrom, t.routeTo].filter(Boolean).join(" → ") || "Trip"}
                        </p>
                        <p className="truncate text-xs text-slate-400 mt-0.5">
                          {t.vehicleNumber} · {t.driverName} · {fmtDateTime(t.startDatetime)}
                        </p>
                      </div>
                      <div className="shrink-0 pl-1">
                        <StatusBadge config={TRIP_STATUS} value={t.status} />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
              <Pager {...upcomingPage} onPage={upcomingPage.setPage} />
            </>
          )}
        </GlassCard>

        {/* Expiring documents */}
        <GlassCard>
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <div className="flex items-center gap-2 font-bold text-slate-700 truncate">
              <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0" /> <span className="truncate">Expiring Documents</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 pl-2">
              {overdueDocs > 0 && <Badge variant="red">{overdueDocs} overdue</Badge>}
              {expiringSoon > 0 && <Badge variant="amber">{expiringSoon} expiring</Badge>}
            </div>
          </div>
          {expiring.length === 0 ? (
            <EmptyState icon={ShieldAlert} title="Nothing expiring soon" hint="All documents are within their validity window." />
          ) : (
            <>
              <ul className="divide-y divide-slate-100">
                {expiringPage.pageItems.map((d, i) => {
                  const info = expiryInfo(d.expiryDate);
                  const overdue = d.daysLeft < 0;
                  const to = d.refType === "VEHICLE"
                    ? `/fleet/vehicles/${d.refPublicId}`
                    : `/fleet/drivers/${d.refPublicId}/edit`;
                  return (
                    <li key={`${d.refPublicId}-${d.docType}-${i}`}>
                      <button onClick={() => navigate(to)}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 border-l-2 p-4 text-left transition-colors hover:bg-slate-50/60",
                          overdue ? "border-red-400 bg-red-50/40" : "border-transparent"
                        )}>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-slate-700">{d.refLabel}</p>
                          <p className="truncate text-xs text-slate-400 mt-0.5">{d.docLabel} · {fmtDate(d.expiryDate)}</p>
                        </div>
                        <div className="shrink-0 pl-1">
                          <Badge variant={info.variant}>{info.text}</Badge>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <Pager {...expiringPage} onPage={expiringPage.setPage} />
            </>
          )}
        </GlassCard>

        {/* Service due */}
        <GlassCard>
          <div className="flex items-center gap-2 border-b border-slate-100 p-4 font-bold text-slate-700">
            <Wrench className="h-4 w-4 text-orange-500 shrink-0" /> <span className="truncate">Service Due</span>
          </div>
          {serviceDue.length === 0 ? (
            <EmptyState icon={Wrench} title="No vehicles due for service" />
          ) : (
            <>
              <ul className="divide-y divide-slate-100">
                {serviceDuePage.pageItems.map((s) => {
                  const overdue = s.kmRemaining != null && s.kmRemaining < 0;
                  return (
                    <li key={s.vehiclePublicId}>
                      <button onClick={() => navigate(`/fleet/vehicles/${s.vehiclePublicId}`)}
                        className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-slate-50/60">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-slate-700">{s.vehicleNumber}</p>
                          <p className="truncate text-xs text-slate-400 mt-0.5">
                            {s.nextServiceDueDate ? `Due ${fmtDate(s.nextServiceDueDate)}` : ""}
                            {s.nextServiceDueKm ? ` · at ${fmtNumber(s.nextServiceDueKm, " km")}` : ""}
                            {s.lastOdometer != null ? ` · now ${fmtNumber(s.lastOdometer, " km")}` : ""}
                          </p>
                        </div>
                        {s.kmRemaining != null && (
                          <div className="shrink-0 pl-1">
                            <Badge variant={overdue ? "red" : "amber"}>
                              {overdue ? `${fmtNumber(Math.abs(s.kmRemaining))} km over` : `${fmtNumber(s.kmRemaining)} km left`}
                            </Badge>
                          </div>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <Pager {...serviceDuePage} onPage={serviceDuePage.setPage} />
            </>
          )}
        </GlassCard>
      </div>
    </PageShell>
  );
}