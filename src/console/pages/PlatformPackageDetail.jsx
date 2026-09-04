// src/console/pages/PlatformPackageDetail.jsx
//
// One package, everything about it, in one place — the SuperAdmin's 360.
//
// ── Why this page has to exist ──────────────────────────────────────────────────────────────
//
// The catalog list answers "what is in the catalog"; the editor answers "change this field". Neither
// answers the question an operator actually opens the console with: *should this be live?* That is
// a judgement made across the whole package at once — the route, what each tier really sells, what
// the platform earns on it, who submitted it and why the last person declined it. Spread across a
// card and eight editor tabs, the decision gets taken on whatever fragment happened to be on screen.
//
// The hotel catalog reached the same conclusion and grew HotelMarketplace360; this is the package
// equivalent, and it is deliberately read-only apart from the four lifecycle actions. Editing lives
// in the editor, one route away, and duplicating a field here is how the two drift.
//
// ── The money ───────────────────────────────────────────────────────────────────────────────
//
// This page reads the ADMIN DTO, so it shows `supplierPerPaxCost` and `platformEarningPerPax` —
// figures the tenant DTO physically cannot carry. That is the entire reason the two DTOs are
// separate hand-written types rather than one class with a flag, and it is why nothing on this page
// may ever be lifted into a shared component with the tenant detail page.
//
// Palette: `.sa-console` semantic + hue tokens only. A raw slate-*/blue-* resolves to the TENANT
// palette here and has no dark-mode partner.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Package, MapPin, CalendarDays, Users, Tag, Check, X, Eye, EyeOff, Pencil, Moon,
  Utensils, Camera, Layers, Car, Ship, Plane, TrainFront, Footprints, Route as RouteIcon,
  Bed, Store, ShieldCheck, Clock, Coins, ImageOff,
} from "lucide-react";

import {
  PageShell, PageHeader, HotelStyles, SectionCard, Button, Badge,
  EmptyState, LoadingState, StarRating, errMsg,
} from "../components/hotelUi";
import { useStepUp } from "../components/useStepUp";
import {
  platformPackageService, packageStatus, PACKAGE_CATEGORY, PACKAGE_REGION, PACKAGE_OCCUPANCY,
} from "../api/platformPackageService";

/** Mode → icon, mirroring the tenant detail page so one route reads the same on both sides. */
const TRAVEL_ICON = {
  ROAD: Car, FERRY: Ship, FLIGHT: Plane, TRAIN: TrainFront, CRUISE: Ship, WALK: Footprints,
  _default: RouteIcon,
};

const money = (v) =>
  v === null || v === undefined || v === ""
    ? "—"
    : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
        .format(Number(v));

const when = (v) => (v ? new Date(v).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");

export default function PlatformPackageDetail() {
  const { publicId } = useParams();
  const navigate = useNavigate();
  const stepUp = useStepUp();

  const [pkg, setPkg] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const load = useCallback(async () => {
    try {
      setPkg(await platformPackageService.get(publicId));
      setLoadError(null);
    } catch (e) {
      setLoadError(errMsg(e, "Could not load this package."));
    }
  }, [publicId]);

  useEffect(() => { load(); }, [load]);

  const act = (spec) => stepUp.request({ ...spec, run: async (code) => { await spec.run(code); await load(); } });

  const approve = () => act({
    title: `Approve “${pkg.title}”?`,
    description: `${pkg.ownerName ?? "This agency"} will be able to sell this package to every other agency on the platform.`,
    confirmLabel: "Approve listing",
    run: (code) => platformPackageService.approveListing(pkg.publicId, code),
  });

  const reject = () => {
    const reason = window.prompt(
      "Why is this listing being declined? The agency sees this, so make it something they can act on.",
    );
    // A cancelled prompt is not a rejection with an empty reason — the server requires one, and
    // sending "" would 400 after the operator had already decided not to reject.
    if (reason === null || !reason.trim()) return;
    act({
      title: `Decline “${pkg.title}”?`,
      description: "The agency keeps the package and can fix it and resubmit.",
      confirmLabel: "Decline listing",
      run: (code) => platformPackageService.rejectListing(pkg.publicId, reason.trim(), code),
    });
  };

  const publish = () => act({
    title: `Publish “${pkg.title}”?`,
    description: "Every tenant with the package marketplace will be able to see and quote it.",
    confirmLabel: "Publish",
    run: (code) => platformPackageService.publish(pkg.publicId, code),
  });

  const withdraw = () => act({
    title: `Withdraw “${pkg.title}”?`,
    description: "It disappears from every tenant's browse immediately. Existing quotations are untouched.",
    confirmLabel: "Withdraw",
    run: (code) => platformPackageService.unpublish(pkg.publicId, { target: "INACTIVE" }, code),
  });

  if (loadError) {
    return (
      <PageShell>
        <HotelStyles />
        <EmptyState icon={Package} title="Package not available" hint={loadError}
          action={<Button onClick={() => navigate("/console/package-catalog")}>Back to the catalog</Button>} />
      </PageShell>
    );
  }
  if (!pkg) {
    return <PageShell><HotelStyles /><LoadingState label="Loading package…" /></PageShell>;
  }

  const status = packageStatus(pkg.status);
  const isAgency = pkg.ownerType === "TENANT";
  const pending = pkg.status === "PENDING_REVIEW";

  return (
    <PageShell>
      <HotelStyles />

      <PageHeader
        title={pkg.title}
        subtitle={[pkg.packageCode, pkg.stateName, pkg.subtitle].filter(Boolean).join("  ·  ")}
        icon={Package}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/console/package-catalog")}>
            Back
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(`/console/package-catalog/${pkg.publicId}/edit`)}>
            <Pencil className="h-4 w-4" aria-hidden />
            Edit
          </Button>

          {/* The queue decision leads when there is one to take — it is why this page was opened. */}
          {pending ? (
            <>
              <Button size="sm" onClick={approve}>
                <Check className="h-4 w-4" aria-hidden />
                Approve listing
              </Button>
              <Button variant="outline" size="sm" onClick={reject}>
                <X className="h-4 w-4" aria-hidden />
                Decline
              </Button>
            </>
          ) : pkg.status === "ACTIVE" ? (
            <Button variant="outline" size="sm" onClick={withdraw}>
              <EyeOff className="h-4 w-4" aria-hidden />
              Withdraw
            </Button>
          ) : (
            <Button size="sm" onClick={publish}>
              <Eye className="h-4 w-4" aria-hidden />
              Publish
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <Badge className={status.cls}>{status.label}</Badge>
        <Badge variant="outline">{isAgency ? `Agency — ${pkg.ownerName ?? "unnamed"}` : "Platform owned"}</Badge>
        <Badge variant="outline">{pkg.visibility === "MARKETPLACE" ? "On marketplace" : "Private"}</Badge>
        {pkg.available === false ? <Badge variant="outline">Switched off</Badge> : null}
        {pkg.customisable ? <Badge variant="outline">Mix and match allowed</Badge> : null}
        {pkg.category ? <Badge variant="outline">{PACKAGE_CATEGORY[pkg.category] ?? pkg.category}</Badge> : null}
      </div>

      {pkg.rejectionReason ? (
        <SectionCard title="Last decline" icon={ShieldCheck} className="mt-4">
          <p className="text-sm text-body">{pkg.rejectionReason}</p>
        </SectionCard>
      ) : null}

      <Gallery images={pkg.images} cover={pkg.coverImageUrl} title={pkg.title} />

      <Facts pkg={pkg} />

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="min-w-0 space-y-4">
          {pkg.overview ? (
            <SectionCard title="Overview" icon={Package}>
              <p className="whitespace-pre-line text-sm leading-relaxed text-body">{pkg.overview}</p>
            </SectionCard>
          ) : null}

          {pkg.stayLegs?.length ? <RouteCard legs={pkg.stayLegs} /> : null}
          {pkg.variants?.length ? <TiersCard variants={pkg.variants} /> : null}
          {pkg.itinerary?.length ? <ItineraryCard days={pkg.itinerary} /> : null}
          <ListsCard inclusions={pkg.inclusions} exclusions={pkg.exclusions} />

          {pkg.cancellationPolicy || pkg.terms ? (
            <SectionCard title="Policy and terms" icon={ShieldCheck}>
              {pkg.cancellationPolicy ? (
                <>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">Cancellation</p>
                  <p className="mt-1 whitespace-pre-line text-sm text-body">{pkg.cancellationPolicy}</p>
                </>
              ) : null}
              {pkg.terms ? (
                <>
                  <p className={`text-xs font-bold uppercase tracking-wide text-muted ${pkg.cancellationPolicy ? "mt-4" : ""}`}>Terms</p>
                  <p className="mt-1 whitespace-pre-line text-sm text-body">{pkg.terms}</p>
                </>
              ) : null}
            </SectionCard>
          ) : null}
        </div>

        <aside className="min-w-0 space-y-4 xl:sticky xl:top-4 xl:self-start">
          <MoneyCard slabs={pkg.priceSlabs} from={pkg.fromPricePerPax} />
          <ProvenanceCard pkg={pkg} />
        </aside>
      </div>

      {stepUp.dialog}
    </PageShell>
  );
}

/* ── Pieces ──────────────────────────────────────────────────────────────── */

function Facts({ pkg }) {
  const facts = [
    { Icon: CalendarDays, label: "Duration", value: pkg.nights == null ? "—" : `${pkg.nights}N / ${pkg.dayCount ?? pkg.nights + 1}D` },
    { Icon: Users, label: "Group size", value: pkg.minPax || pkg.maxPax ? `${pkg.minPax ?? 1}${pkg.maxPax ? `–${pkg.maxPax}` : "+"} pax` : "—" },
    { Icon: MapPin, label: "Region", value: pkg.region ? (PACKAGE_REGION[pkg.region] ?? pkg.region) : "—" },
    { Icon: Tag, label: "Code", value: pkg.packageCode ?? "—" },
  ];
  return (
    <div className="mt-4 grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
      {facts.map((f) => (
        <div key={f.label} className="flex items-start gap-2.5">
          <f.Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-muted">{f.label}</div>
            <div className="truncate text-sm font-bold text-heading">{f.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Gallery({ images, cover, title }) {
  const photos = useMemo(() => {
    const list = (images ?? []).map((i) => ({ url: i.imageUrl, caption: i.caption }));
    if (!list.length && cover) return [{ url: cover, caption: null }];
    return list;
  }, [images, cover]);

  if (!photos.length) {
    return (
      <div className="mt-4 flex aspect-[21/6] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/30 text-muted">
        <ImageOff className="h-6 w-6" aria-hidden />
        <span className="text-xs">No photos on this package</span>
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-2 lg:grid-cols-4">
      <img
        src={photos[0].url}
        alt={photos[0].caption || title}
        loading="lazy"
        className="aspect-[4/3] w-full rounded-2xl object-cover lg:col-span-2 lg:row-span-2 lg:aspect-auto lg:h-full"
      />
      {photos.slice(1, 5).map((p, i) => (
        <img
          key={i}
          src={p.url}
          alt={p.caption || `${title} photo ${i + 2}`}
          loading="lazy"
          className="hidden aspect-[4/3] w-full rounded-2xl object-cover lg:block"
        />
      ))}
    </div>
  );
}

/**
 * The route with the journeys between the stops.
 *
 * <p>An operator reviewing a submission is checking whether the itinerary is honest — a package
 * claiming an eleven-hour drive as a "short transfer", or a ferry crossing recorded as a road leg,
 * is exactly what a review is for. Those are only visible if the journey is shown, so it is.</p>
 */
function RouteCard({ legs }) {
  const km = legs.reduce((s, l) => s + (Number(l.distanceKm) || 0), 0);
  const mins = legs.reduce((s, l) => s + (Number(l.travelMinutes) || 0), 0);
  const stated = legs.filter((l) => l.distanceKm || l.travelMinutes || l.travelMode).length;

  return (
    <SectionCard
      title="Route"
      icon={MapPin}
      right={
        <span className="text-xs text-muted">
          {stated}/{legs.length} legs have journey detail
          {km ? ` · ${km} km` : ""}
          {mins ? ` · ${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ""}` : ""}
        </span>
      }
    >
      <ol className="space-y-0">
        {legs.map((leg, i) => {
          const Icon = TRAVEL_ICON[leg.travelMode] ?? TRAVEL_ICON._default;
          const from = leg.travelFrom || (i > 0 ? legs[i - 1].cityName : null);
          const hasJourney = leg.distanceKm || leg.travelDurationLabel || leg.travelMode;

          return (
            <li key={leg.publicId ?? i}>
              {hasJourney && from ? (
                <div className="flex gap-3">
                  <div className="flex w-2 justify-center"><span className="w-px flex-1 bg-border" /></div>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 py-1.5 text-xs text-muted">
                    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="text-body">{from} → {leg.cityName}</span>
                    {leg.distanceKm ? <span>· {leg.distanceKm} km</span> : null}
                    {leg.travelDurationLabel ? <span>· about {leg.travelDurationLabel}</span> : null}
                    {leg.travelNote ? <span className="basis-full text-[11px]">{leg.travelNote}</span> : null}
                  </div>
                </div>
              ) : null}

              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                  {i < legs.length - 1 ? <span className="w-px flex-1 bg-border" /> : null}
                </div>
                <div className={`min-w-0 flex-1 ${i < legs.length - 1 ? "pb-2" : ""}`}>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-bold text-heading">{leg.cityName}</span>
                    <span className="flex items-center gap-1 text-xs text-muted">
                      <Moon className="h-3 w-3" aria-hidden />
                      {leg.nights} night{leg.nights === 1 ? "" : "s"}
                    </span>
                  </div>
                  {leg.note ? <p className="mt-0.5 text-xs text-muted">{leg.note}</p> : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </SectionCard>
  );
}

/**
 * The tiers, side by side, with each tier's own rates.
 *
 * <p>This is where an approval is actually decided on a tiered package: three tiers are three
 * products, and "Super Deluxe" priced below "Deluxe", or a tier whose hotels are the same as the
 * one under it, is a listing that will generate complaints rather than sales.</p>
 */
function TiersCard({ variants }) {
  return (
    <SectionCard title="Tiers" icon={Layers} right={<span className="text-xs text-muted">{variants.length} on sale</span>}>
      <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {variants.map((v) => (
          <div key={v.publicId} className="rounded-xl border border-border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-heading">{v.name}</div>
                {v.category ? (
                  <div className="text-[11px] uppercase tracking-wide text-muted">
                    {PACKAGE_CATEGORY[v.category] ?? v.category}
                  </div>
                ) : null}
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[11px] text-muted">from</div>
                <div className="text-sm font-extrabold text-heading">{money(v.fromPricePerPax)}</div>
              </div>
            </div>

            {v.highlight ? <p className="mt-2 text-xs text-body">{v.highlight}</p> : null}

            {v.vehicleName ? (
              <div className="mt-2 flex items-start gap-2 text-xs text-body">
                <Car className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                <span className="min-w-0">
                  {v.vehicleName}
                  {v.vehicleNote ? <span className="text-muted"> — {v.vehicleNote}</span> : null}
                </span>
              </div>
            ) : null}

            {v.hotels?.length ? (
              <ul className="mt-2 space-y-1.5">
                {v.hotels.map((h) => (
                  <li key={h.publicId} className="flex items-start gap-2 text-xs">
                    <Bed className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                    <div className="min-w-0">
                      <span className="font-bold text-heading">{h.cityName}</span>
                      <span className="text-body"> — {h.hotelName || "hotel not named"}</span>
                      {h.hotelStars ? <StarRating value={h.hotelStars} size={11} className="ml-1 inline-flex align-middle" /> : null}
                      <div className="text-muted">{[h.roomType, h.mealPlan].filter(Boolean).join(" · ") || "room not stated"}</div>
                      {/* Property and room kept apart, the same rule the server enforces with a
                          scope column — an operator checking a listing needs to see that the room
                          photographs are actually of a room. */}
                      <HotelThumbs label="Hotel" shots={h.images} />
                      <HotelThumbs label="Room" shots={h.roomImages} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              // Silence here is a real finding, not an empty state: a tier with no hotels sells
              // nothing different from the tier below it.
              <p className="mt-2 text-xs text-muted">No hotels on this tier.</p>
            )}

            {v.priceSlabs?.length ? (
              <div className="mt-2 border-t border-border pt-2">
                {v.priceSlabs.map((s) => (
                  <div key={s.publicId} className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate text-muted">
                      {PACKAGE_OCCUPANCY[s.occupancy] ?? s.occupancy} · {s.paxFrom}{s.paxTo ? `–${s.paxTo}` : "+"} pax
                    </span>
                    <span className="shrink-0 font-bold text-heading">{money(s.perPaxPrice)}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

/** A tier hotel's photographs for one scope. Silent when there are none — that is a finding too. */
function HotelThumbs({ label, shots }) {
  if (!shots?.length) return null;
  return (
    <div className="mt-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted">{label} · {shots.length}</div>
      <div className="mt-1 flex flex-wrap gap-1">
        {shots.map((img, i) => (
          <img
            key={img.publicId ?? i}
            src={img.imageUrl}
            alt={img.caption || `${label} photo ${i + 1}`}
            loading="lazy"
            title={img.caption || undefined}
            className="h-12 w-16 rounded border border-border object-cover"
          />
        ))}
      </div>
    </div>
  );
}

function ItineraryCard({ days }) {
  return (
    <SectionCard title="Day-wise itinerary" icon={CalendarDays}>
      <ol className="space-y-3">
        {days.map((day) => (
          <li key={day.publicId} className="rounded-xl border border-border p-3">
            <div className="flex flex-wrap items-baseline gap-2">
              <Badge variant="outline">Day {day.dayNumber}</Badge>
              <span className="text-sm font-bold text-heading">{day.title}</span>
              {day.meals ? (
                <span className="flex items-center gap-1 text-xs text-muted">
                  <Utensils className="h-3 w-3" aria-hidden />{day.meals}
                </span>
              ) : null}
              {day.overnightCityName ? (
                <span className="flex items-center gap-1 text-xs text-muted">
                  <Moon className="h-3 w-3" aria-hidden />{day.overnightCityName}
                </span>
              ) : null}
            </div>
            {day.description ? <p className="mt-1.5 whitespace-pre-line text-sm text-body">{day.description}</p> : null}
            {day.sightseeing?.length ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Camera className="h-3 w-3 text-muted" aria-hidden />
                {day.sightseeing.map((s, i) => <Badge key={i} variant="outline">{s}</Badge>)}
              </div>
            ) : null}
            {day.images?.length ? (
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {day.images.map((img, i) => (
                  <img
                    key={img.publicId ?? i}
                    src={img.imageUrl}
                    alt={img.caption || `Day ${day.dayNumber} photo`}
                    loading="lazy"
                    className="aspect-[4/3] w-full rounded-lg object-cover"
                  />
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}

function ListsCard({ inclusions, exclusions }) {
  if (!inclusions?.length && !exclusions?.length) return null;
  return (
    <SectionCard title="Inclusions and exclusions" icon={Check}>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Included</p>
          {inclusions?.length ? (
            <ul className="mt-2 space-y-1.5">
              {inclusions.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-body">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-hue-emerald" aria-hidden />
                  <span className="min-w-0">{t}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-muted">Not stated</p>}
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Not included</p>
          {exclusions?.length ? (
            <ul className="mt-2 space-y-1.5">
              {exclusions.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-body">
                  <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-hue-rose" aria-hidden />
                  <span className="min-w-0">{t}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-muted">Not stated</p>}
        </div>
      </div>
    </SectionCard>
  );
}

/**
 * Sell, cost and margin per slab — the numbers only this realm may see.
 *
 * <p>Margin is shown as the server computed it (`platformEarningPerPax`) rather than recomputed from
 * the two columns beside it. A second subtraction here would be a second source of truth for the
 * platform's own earnings, and the one that disagreed would be the one on screen.</p>
 */
function MoneyCard({ slabs, from }) {
  const rows = slabs ?? [];
  return (
    <SectionCard title="Rates and margin" icon={Coins}>
      <div className="text-[11px] uppercase tracking-wide text-muted">Starting from</div>
      <div className="text-2xl font-extrabold text-heading">{money(from)}<span className="text-sm font-medium text-muted"> / pax</span></div>

      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          No price slabs. This package is on request — a tenant can still quote it and price it themselves.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {rows.map((s) => (
            <li key={s.publicId} className="py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-xs text-body">
                  {PACKAGE_OCCUPANCY[s.occupancy] ?? s.occupancy} · {s.paxFrom}{s.paxTo ? `–${s.paxTo}` : "+"} pax
                </span>
                <span className="shrink-0 text-sm font-extrabold text-heading">{money(s.perPaxPrice)}</span>
              </div>
              <div className="mt-0.5 flex items-baseline justify-between gap-2 text-[11px] text-muted">
                <span>cost {money(s.supplierPerPaxCost)}</span>
                <span className={s.platformEarningPerPax > 0 ? "font-bold text-hue-emerald" : ""}>
                  margin {money(s.platformEarningPerPax)}
                </span>
              </div>
              {!s.active ? <Badge variant="outline" className="mt-1">Inactive</Badge> : null}
              {s.label ? <div className="mt-0.5 text-[11px] text-muted">{s.label}</div> : null}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

/** Who it came from and what has happened to it — the audit half of the decision. */
function ProvenanceCard({ pkg }) {
  const rows = [
    { Icon: Store, label: "Owner", value: pkg.ownerType === "TENANT" ? (pkg.ownerName ?? `Tenant ${pkg.ownerTenantId}`) : "Platform" },
    { Icon: Clock, label: "Submitted", value: when(pkg.submittedAt) },
    { Icon: Check, label: "Approved", value: pkg.approvedAt ? `${when(pkg.approvedAt)}${pkg.approvedBy ? ` by ${pkg.approvedBy}` : ""}` : "—" },
    { Icon: Clock, label: "Created", value: when(pkg.createdAt) },
    { Icon: Clock, label: "Last updated", value: when(pkg.updatedAt) },
    { Icon: Tag, label: "Catalog version", value: pkg.catalogVersion ?? "—" },
  ];
  return (
    <SectionCard title="Provenance" icon={ShieldCheck}>
      <dl className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start gap-2">
            <r.Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
            <div className="min-w-0">
              <dt className="text-[11px] uppercase tracking-wide text-muted">{r.label}</dt>
              <dd className="text-sm text-body">{r.value}</dd>
            </div>
          </div>
        ))}
      </dl>
    </SectionCard>
  );
}
