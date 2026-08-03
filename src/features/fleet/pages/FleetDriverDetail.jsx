// src/features/fleet/pages/FleetDriverDetail.jsx
//
// NEW PAGE. Fleet had a vehicle detail page but never a driver one — clicking a driver in the list
// only ever offered Edit, so there was no single screen answering "who is this man, is his paperwork
// valid, what has he been driving, and is he holding any of my money".
//
// That last question is the reason this page earns its place now: the cash ledger makes a driver a
// financial counterparty, not just a name on a trip. An owner's first question at 10pm is whose cash
// is still out on the road, and it has to be answerable per driver.
//
// Styled to match Bookings: gradient KPI cards, coloured card top-strips, Panel sections.
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  IdCard, ArrowLeft, Pencil, Phone, CreditCard, CalendarClock, Route as RouteIcon,
  IndianRupee, Wallet, AlertTriangle, CheckCircle2, ShieldAlert, ShieldCheck,
} from "lucide-react";

import fleetService from "../api/fleetService";
import RegisterDocuments from "../components/RegisterDocuments";
import { hasPermission, P } from "@shared/lib/access";
import {
  Button, Badge, Panel, StatCard, StatCardRow, EntityCard, CodeChip, MiniStat,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  LoadingState, EmptyState, StatusBadge, DRIVER_STATUS, TRIP_STATUS,
  useToast, errMsg, fmtDate, fmtDateTime, fmtMoney, expiryInfo,
} from "../components/fleetUi";

/** First-letters avatar, same treatment as the drivers list. */
function initials(name = "") {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "?";
}

export default function FleetDriverDetail() {
  const { publicId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [driver, setDriver] = useState(null);
  const [trips, setTrips] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);

  const canUpdate = hasPermission(P.FLEET_UPDATE);
  const canSeeMoney = hasPermission(P.FLEET_MONEY_READ);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    (async () => {
      try {
        const d = await fleetService.getDriver(publicId);
        if (!alive) return;
        setDriver(d);

        // Trips are core to the page; money is permission-gated and must degrade quietly rather
        // than blocking the whole screen for a dispatcher who cannot see costs.
        const t = await fleetService.listTrips({ driverId: publicId, size: 10 }).catch(() => ({ items: [] }));
        if (alive) setTrips(t.items || []);

        if (canSeeMoney) {
          const open = await fleetService.listOpenSettlements().catch(() => []);
          if (alive) setSettlements((open || []).filter((s) => s.driverPublicId === publicId));
        }
      } catch (e) {
        if (alive) showToast(errMsg(e, "Failed to load driver."), "error");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [publicId, canSeeMoney]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── derived ────────────────────────────────────────────────────────── */
  const licence = useMemo(() => expiryInfo(driver?.licenseExpiry), [driver]);

  // Positive net = the driver is holding the company's money. This is the number the owner wants.
  const cashOut = useMemo(
    () => settlements.reduce((s, x) => s + Math.max(0, Number(x.netDueFromDriver || 0)), 0),
    [settlements],
  );
  const owedToDriver = useMemo(
    () => settlements.reduce((s, x) => s + Math.max(0, -Number(x.netDueFromDriver || 0)), 0),
    [settlements],
  );
  const completedTrips = useMemo(
    () => trips.filter((t) => t.status === "COMPLETED").length, [trips]);
  const totalKm = useMemo(
    () => trips.reduce((s, t) => s + Number(t.distanceKm || 0), 0), [trips]);

  const shell = (children) => (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-slate-100"
         style={{ fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}>
      <div className="mx-auto max-w-screen-xl px-4 py-6 sm:px-6">{children}</div>
    </div>
  );

  if (loading) return shell(<LoadingState label="Loading driver…" />);

  if (!driver) {
    return shell(
      <EmptyState
        icon={IdCard}
        title="Driver not found"
        hint="It may have been moved to Trash."
        action={<Button onClick={() => navigate("/fleet/drivers")}>Back to Drivers</Button>}
      />,
    );
  }

  return shell(
    <>
      {/* ── header ── */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <button onClick={() => navigate("/fleet/drivers")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-500 text-lg font-extrabold text-white shadow-lg shadow-blue-600/20">
            {initials(driver.name)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-extrabold text-slate-800 sm:text-2xl">{driver.name}</h1>
              <StatusBadge config={DRIVER_STATUS} value={driver.status} />
            </div>
            <p className="text-sm text-slate-500">
              {driver.phone || "No phone on file"}
            </p>
          </div>
        </div>

        {canUpdate && (
          <Button onClick={() => navigate(`/fleet/drivers/${publicId}/edit`)}>
            <Pencil className="h-4 w-4" /> Edit driver
          </Button>
        )}
      </div>

      {/* ── KPIs ── */}
      <StatCardRow className="lg:grid-cols-4 xl:grid-cols-4">
        <StatCard label="Trips (recent)" value={trips.length} icon={<RouteIcon />} tone="blue" />
        <StatCard label="Completed" value={completedTrips} icon={<CheckCircle2 />} tone="green" />
        {canSeeMoney ? (
          <>
            <StatCard label="Cash with driver" value={cashOut} icon={<Wallet />} tone="amber" money />
            <StatCard label="Owed to driver" value={owedToDriver} icon={<IndianRupee />} tone="rose" money />
          </>
        ) : (
          <>
            <StatCard label="Distance (km)" value={totalKm} icon={<RouteIcon />} tone="indigo" />
            <StatCard label="Open trips" value={trips.filter((t) => t.status === "ONGOING").length}
                      icon={<CalendarClock />} tone="slate" />
          </>
        )}
      </StatCardRow>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* ── profile ── */}
        <div className="space-y-5">
          <Panel icon={IdCard} title="Profile" description="Contact and licence.">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <MiniStat label="Phone" value={driver.phone} />
                <MiniStat label="Status" value={driver.status} />
              </div>
              <MiniStat label="Licence number" value={driver.licenseNumber} />

              {/* Licence expiry is the one field that stops a vehicle at a check-post, so it gets a
                  full-width treatment with its own tone rather than a MiniStat. */}
              <div className={`rounded-xl border px-3 py-2.5 ${
                !driver.licenseExpiry ? "border-slate-200 bg-slate-50"
                  : licence.variant === "red" ? "border-red-200 bg-red-50"
                  : licence.variant === "amber" ? "border-amber-200 bg-amber-50"
                  : "border-green-200 bg-green-50"}`}>
                <div className="flex items-center gap-2">
                  {driver.licenseExpiry
                    ? <ShieldAlert className={`h-4 w-4 shrink-0 ${
                        licence.variant === "red" ? "text-red-500"
                          : licence.variant === "amber" ? "text-amber-500" : "text-green-600"}`} />
                    : <AlertTriangle className="h-4 w-4 shrink-0 text-slate-400" />}
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Licence expiry</p>
                    <p className="text-sm font-bold text-slate-700">
                      {driver.licenseExpiry
                        ? `${fmtDate(driver.licenseExpiry)} · ${licence.text}`
                        : "Not recorded — no expiry alert will fire"}
                    </p>
                  </div>
                </div>
              </div>

              {driver.notes && (
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Notes</p>
                  <p className="whitespace-pre-wrap text-sm text-slate-600">{driver.notes}</p>
                </div>
              )}
            </div>
          </Panel>

          {/* ── papers from the register — badge, medical, verification, and the licence's own
                 renewal chain. The tile above reads the driver row's legacy expiry field; this
                 reads the documents register, which is what the expiry alerts sweep. ── */}
          <Panel icon={ShieldCheck} title="Papers"
                 description="From the documents register.">
            <RegisterDocuments
              fetch={() => fleetService.documentsForDriver(publicId)}
              refreshKey={publicId}
              navigate={navigate}
              gridClass="grid-cols-1"
              emptyHint="Record this driver's licence, PSV badge, medical certificate and police verification in the documents register — expiry alerts read from there."
            />
          </Panel>

          {/* ── cash position ── */}
          {canSeeMoney && (
            <Panel icon={Wallet} title="Cash position"
                   description="Unsettled trips — money still in this driver's hands.">
              {settlements.length === 0 ? (
                <EmptyState icon={CheckCircle2} title="All squared"
                            hint="No open settlement for this driver." />
              ) : (
                <div className="space-y-2.5">
                  {settlements.map((s) => {
                    const net = Number(s.netDueFromDriver || 0);
                    return (
                      <EntityCard key={s.publicId} tone={net > 0 ? "amber" : net < 0 ? "rose" : "green"}
                                  onClick={() => navigate(`/fleet/trips/${s.tripPublicId}`)}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Badge className="bg-slate-100 text-slate-600">{s.statusLabel}</Badge>
                            {s.hasPostSettlementMovement && (
                              <Badge className="ml-1 bg-rose-100 text-rose-700">moved after signing</Badge>
                            )}
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-extrabold ${
                              net > 0 ? "text-amber-600" : net < 0 ? "text-rose-600" : "text-green-600"}`}>
                              {fmtMoney(Math.abs(net))}
                            </p>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                              {net > 0 ? "holds" : net < 0 ? "owed" : "squared"}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <MiniStat label="Advance" value={fmtMoney(s.advanceTotal)} />
                          <MiniStat label="Spent" value={fmtMoney(s.driverCashSpend)} />
                        </div>
                      </EntityCard>
                    );
                  })}
                </div>
              )}
            </Panel>
          )}
        </div>

        {/* ── trips ── */}
        <div className="lg:col-span-2">
          <Panel icon={RouteIcon} title="Recent trips" description="Latest duties for this driver.">
            {trips.length === 0 ? (
              <EmptyState icon={RouteIcon} title="No trips yet"
                          hint="This driver has not been assigned a duty." />
            ) : (
              <>
                <div className="hidden lg:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Start</TableHead>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>Route</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Distance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trips.map((t) => (
                        <TableRow key={t.publicId} className="cursor-pointer"
                                  onClick={() => navigate(`/fleet/trips/${t.publicId}`)}>
                          <TableCell className="font-semibold text-slate-700">
                            {fmtDateTime(t.startDatetime)}
                          </TableCell>
                          <TableCell><CodeChip>{t.vehicleNumber}</CodeChip></TableCell>
                          <TableCell className="max-w-[220px] truncate text-slate-600">
                            {[t.routeFrom, t.routeTo].filter(Boolean).join(" → ") || "—"}
                          </TableCell>
                          <TableCell><StatusBadge config={TRIP_STATUS} value={t.status} /></TableCell>
                          <TableCell className="text-right font-bold text-slate-700">
                            {t.distanceKm != null ? `${t.distanceKm} km` : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
                  {trips.map((t) => (
                    <EntityCard key={t.publicId} tone="blue"
                                onClick={() => navigate(`/fleet/trips/${t.publicId}`)}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <CodeChip>{t.vehicleNumber}</CodeChip>
                          <p className="mt-1 truncate text-sm font-semibold text-slate-700">
                            {[t.routeFrom, t.routeTo].filter(Boolean).join(" → ") || "—"}
                          </p>
                          <p className="text-xs text-slate-400">{fmtDateTime(t.startDatetime)}</p>
                        </div>
                        <StatusBadge config={TRIP_STATUS} value={t.status} />
                      </div>
                      <MiniStat label="Distance"
                                value={t.distanceKm != null ? `${t.distanceKm} km` : "—"} />
                    </EntityCard>
                  ))}
                </div>
              </>
            )}
          </Panel>
        </div>
      </div>
    </>,
  );
}
