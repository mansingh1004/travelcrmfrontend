// src/features/marketplace/pages/PackageDetail.jsx
//
// One package, and the action the whole catalog exists for: turning it into a real customer
// quotation with the agency's own markup applied afterwards in the builder.
//
// The page is a sales document, so it is laid out like one: a gallery, a strip of the four facts a
// buyer checks first, the route as a timeline rather than a list of rows, and a rail that stays on
// screen carrying the price and the one button that matters.
//
// The quotation dialog asks for party size, date and sharing basis rather than reading them off a
// lead, because a package is browsed cold — an agent opens the catalog, likes something, and wants a
// quotation for a party they can describe but have not yet entered as a lead. A lead can still be
// attached, and then fills in whatever was left blank.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  MapPin, CalendarDays, Users, Tag, Check, X as XIcon, Moon, Utensils, Camera,
  Sparkles, FileText, ShieldCheck, Store, Pencil, ImageOff, Link2,
  Car, Ship, Plane, TrainFront, Footprints, Route, Bed, Layers, Star, Wand2,
} from "lucide-react";

import {
  Page, PageHeader, BackLink, Card, Divider, SectionLabel, Button, Input, Select,
  Modal, Notice, Loading, Photo, Chip, fmtMoney, useToast, errMsg, isAlreadyReported, cn, FONT,
} from "../components/marketplaceUi";
import { INCLUSIONS, PackageRibbon } from "../components/PackageCard";
import { HeroGallery } from "../components/HeroGallery";
import { MixBuilder } from "../components/MixBuilder";
import { Lightbox } from "../components/Lightbox";
import { PKG_PRIMARY, PKG_ACCENT_TEXT } from "../components/packageTheme";
import PackageQuoteModal from "../components/PackageQuoteModal";
import {
  packageMarketplaceService, PACKAGE_CATEGORY, PACKAGE_OCCUPANCY, PACKAGE_REGION,
  stayRoute, nightsLabel, packageStatus,
} from "../api/packageMarketplaceService";

export function PackageDetail() {
  const { publicId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [pkg, setPkg] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [quoting, setQuoting] = useState(false);
  /*
    The shareable customer page — a different document from `quoting` above, not a variant of it.
    That one opens a CRM quotation in the builder for an agent to keep editing; this one composes
    the package as it actually is (gallery, day photos, hotels per stop, every tier side by side)
    and hands back a link. Both are useful and neither replaces the other, so both buttons stay.
  */
  const [linking, setLinking] = useState(false);
  const [chosenTierId, setChosenTierId] = useState(null);
  // Mixing replaces the tier selection rather than sitting beside it: a page showing both a chosen
  // tier and a half-built mix would have two prices on screen and no way to say which one applies.
  const [mixing, setMixing] = useState(false);
  // null = viewer closed. An index rather than a photo, because the viewer pages forward from it.
  const [viewerIndex, setViewerIndex] = useState(null);

  const load = useCallback(async () => {
    try {
      setPkg(await packageMarketplaceService.getPackage(publicId));
      setLoadError(null);
    } catch (e) {
      // A package this agency may not see is a 404 by design — the server never confirms that
      // another agency's private package exists. Say so plainly rather than blaming the network.
      setLoadError(errMsg(e, "This package is not available."));
    }
  }, [publicId]);

  useEffect(() => { load(); }, [load]);

  const tiers = useMemo(() => pkg?.variants ?? [], [pkg]);

  /**
   * Which tier is showing.
   *
   * <p>Derived rather than seeded through an effect, so the page never renders one frame with no
   * tier selected — a picker with nothing chosen reads as broken, and the price beside it would
   * flicker.</p>
   *
   * <p>The default is the cheapest, deliberately: the card the buyer clicked said "starting from",
   * and that figure is the cheapest tier's. Landing on any other tier would show a different number
   * than the one that brought them here.</p>
   */
  const tierId = useMemo(() => {
    if (!tiers.length) return null;
    if (chosenTierId && tiers.some((t) => t.publicId === chosenTierId)) return chosenTierId;
    const priced = tiers.filter((t) => t.fromPricePerPax !== null && t.fromPricePerPax !== undefined);
    const pick = priced.length
      ? priced.reduce((a, b) => (Number(a.fromPricePerPax) <= Number(b.fromPricePerPax) ? a : b))
      : tiers[0];
    return pick.publicId;
  }, [tiers, chosenTierId]);

  const tier = useMemo(() => tiers.find((t) => t.publicId === tierId) ?? null, [tiers, tierId]);

  /**
   * Every photograph on this package, as one tour, in the shape the viewer speaks.
   *
   * <p>Same shape the hotel page uses — the package's own photos first, then each day's run under
   * the day's name, then the chosen tier's hotels and rooms under theirs. That is the direction the
   * hotel module allows: a room's photographs may enrich the property tour, never the reverse.</p>
   */
  const photoGroups = useMemo(() => {
    if (!pkg) return [];
    const shot = (i) => ({ publicId: i.publicId, url: i.imageUrl, caption: i.caption });
    const groups = [];

    const own = (pkg.images ?? []).map(shot);
    // A package with no gallery but a cover still has one picture worth showing.
    if (!own.length && pkg.coverImageUrl) own.push({ url: pkg.coverImageUrl, caption: null });
    if (own.length) groups.push({ label: pkg.title, images: own });

    for (const day of pkg.itinerary ?? []) {
      const shots = (day.images ?? []).map(shot);
      if (shots.length) groups.push({ label: `Day ${day.dayNumber} — ${day.title}`, images: shots });
    }

    for (const h of tier?.hotels ?? []) {
      const hotelShots = (h.images ?? []).map(shot);
      const roomShots = (h.roomImages ?? []).map(shot);
      const name = h.hotelName || h.cityName;
      if (hotelShots.length) groups.push({ label: `${name}, ${h.cityName}`, images: hotelShots });
      if (roomShots.length) groups.push({ label: `${name} — ${h.roomType || "room"}`, images: roomShots });
    }
    return groups;
  }, [pkg, tier]);

  /** The flat list the viewer indexes into. One flattening, shared, so an index never means two things. */
  const allPhotos = useMemo(() => photoGroups.flatMap((g) => g.images), [photoGroups]);

  const heroPhotos = useMemo(
    () => (photoGroups[0]?.images ?? []),
    [photoGroups],
  );

  /**
   * Open the viewer at a photograph identified by object, not by index.
   *
   * <p>A hotel row knows its own position within its own array and nothing about the flattened
   * tour, so it hands over the photo it was clicked on and this resolves it. Passing an index would
   * mean the caller computing an offset into a list it cannot see.</p>
   */
  const openPhoto = useCallback((photo) => {
    if (!photo) return;
    const url = photo.imageUrl ?? photo.url;
    const at = allPhotos.findIndex((p) => p.url === url);
    setViewerIndex(at >= 0 ? at : 0);
  }, [allPhotos]);

  if (loadError) {
    return (
      <Page width="max-w-none">
        <div style={FONT}>
          <BackLink onClick={() => navigate("/marketplace/packages")}>Back to packages</BackLink>
          <Card className="mt-4"><Notice tone="warn">{loadError}</Notice></Card>
        </div>
      </Page>
    );
  }
  if (!pkg) {
    return <Page width="max-w-none"><div style={FONT}><Loading label="Loading package…" /></div></Page>;
  }

  const status = pkg.mine ? packageStatus(pkg.status) : null;
  const route = stayRoute(pkg.stayLegs);

  return (
    <Page width="max-w-none">
      <div style={FONT}>
        <BackLink onClick={() => navigate("/marketplace/packages")}>Back to packages</BackLink>

        <PageHeader
          title={pkg.title}
          subtitle={pkg.subtitle || route || pkg.stateName}
          actions={
            <div className="flex items-center gap-2">
              {pkg.mine ? (
                <Button onClick={() => navigate(`/marketplace/packages/mine/${pkg.publicId}`)}>
                  <Pencil className="h-4 w-4" aria-hidden />
                  Edit
                </Button>
              ) : null}
              <Button onClick={() => setQuoting(true)}>
                <Sparkles className="h-4 w-4" aria-hidden />
                Draft in builder
              </Button>
              <Button variant="primary" className={PKG_PRIMARY} onClick={() => setLinking(true)}>
                <Link2 className="h-4 w-4" aria-hidden />
                Quotation link
              </Button>
            </div>
          }
        />

        {/*
          The same photo block the hotel page uses, and the same viewer behind it — one large frame,
          a 2x2 run, and "show all N" opening a tour of EVERY photograph on the package: the gallery,
          each day's pictures, and the chosen tier's hotels and rooms. The old grid showed five and
          quietly hid the rest behind a count.
        */}
        <div className="relative mt-4">
          <HeroGallery
            images={heroPhotos}
            title={pkg.title}
            total={allPhotos.length}
            onOpen={(index) => setViewerIndex(index)}
          />
          <PackageRibbon category={pkg.category} className="top-3" />
        </div>

        {/* Owner-only signals. A buyer has no business seeing a listing's review state. */}
        {pkg.mine && status?.label ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={cn("rounded px-2 py-0.5 text-xs font-medium", status.cls)}>{status.label}</span>
            {pkg.available === false ? <Chip>Switched off</Chip> : null}
            {pkg.visibility ? <Chip>{pkg.visibility === "MARKETPLACE" ? "On marketplace" : "Private"}</Chip> : null}
          </div>
        ) : null}
        {pkg.mine && pkg.rejectionReason ? (
          <Notice tone="warn" className="mt-3">
            <strong>Listing declined:</strong> {pkg.rejectionReason}
          </Notice>
        ) : null}

        <FactStrip pkg={pkg} />

        {tiers.length ? (
          <TierPicker
            tiers={tiers}
            selectedId={mixing ? null : tierId}
            onSelect={(id) => { setMixing(false); setChosenTierId(id); }}
            canMix={pkg.customisable && !pkg.mine}
            mixing={mixing}
            onToggleMix={() => setMixing((m) => !m)}
          />
        ) : null}

        {mixing ? (
          <MixBuilder
            pkg={pkg}
            tiers={tiers}
            onCancel={() => setMixing(false)}
            onSent={(request) => {
              setMixing(false);
              showToast(`Request ${request.requestCode} sent`, "success");
              navigate(`/marketplace/packages/requests/${request.publicId}`);
            }}
          />
        ) : null}

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-5">
            {pkg.overview ? (
              <Card>
                <SectionLabel>
                  <FileText className="mr-1.5 inline h-3.5 w-3.5 align-text-bottom text-slate-400" aria-hidden />
                  About this package
                </SectionLabel>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{pkg.overview}</p>
              </Card>
            ) : null}

            {pkg.stayLegs?.length ? <StayPlan legs={pkg.stayLegs} tier={tier} onOpenPhotos={openPhoto} /> : null}
            {pkg.itinerary?.length ? <Itinerary days={pkg.itinerary} onOpenPhoto={openPhoto} /> : null}
            <TwoLists inclusions={pkg.inclusions} exclusions={pkg.exclusions} />

            {pkg.cancellationPolicy || pkg.terms ? (
              <Card>
                {pkg.cancellationPolicy ? (
                  <>
                    <SectionLabel>
                      <ShieldCheck className="mr-1.5 inline h-3.5 w-3.5 align-text-bottom text-slate-400" aria-hidden />
                      Cancellation policy
                    </SectionLabel>
                    <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{pkg.cancellationPolicy}</p>
                  </>
                ) : null}
                {pkg.terms ? (
                  <>
                    {pkg.cancellationPolicy ? <Divider className="my-4" /> : null}
                    <SectionLabel>Terms</SectionLabel>
                    <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{pkg.terms}</p>
                  </>
                ) : null}
              </Card>
            ) : null}
          </div>

          <aside className="min-w-0 xl:sticky xl:top-6 xl:self-start">
            <div className="space-y-4">
              <PriceCard
                pkg={pkg}
                tier={tier}
                onQuote={() => setQuoting(true)}
                onLink={() => setLinking(true)}
              />

              {/*
                NO "OFFERED BY" CARD. Owner decision, 2026-09-03 — a buyer is never told which
                agency is selling. What they need to know is that it is not the platform's own
                package and the rate is fixed, and that is said without naming anyone.
              */}
              {pkg.ownerType === "TENANT" && !pkg.mine ? (
                <Card>
                  <SectionLabel>
                    <Store className="mr-1.5 inline h-3.5 w-3.5 align-text-bottom text-slate-400" aria-hidden />
                    Listed on the marketplace
                  </SectionLabel>
                  <p className="mt-1 text-xs text-slate-500">
                    Sold by a partner agency through the platform. You buy at the rate shown.
                  </p>
                </Card>
              ) : null}
            </div>
          </aside>
        </div>

        <Lightbox
          open={viewerIndex !== null}
          onClose={() => setViewerIndex(null)}
          index={viewerIndex ?? 0}
          onIndexChange={setViewerIndex}
          title={pkg.title}
          groups={photoGroups}
        />

        {quoting ? (
          <QuotationModal
            pkg={pkg}
            tier={tier}
            onClose={() => setQuoting(false)}
            onCreated={(quotation) => {
              setQuoting(false);
              showToast("Quotation created", "success");
              /*
                The agent's next act is always to price and send it, so land them in the builder
                rather than back on a catalog they have finished with.

                FIXED 2026-09-03: this used to navigate to `/quotation/{id}` with `/allquotations`
                as the fallback. NEITHER route exists in router.jsx — both fell through to the
                `path="*"` NotFound, so the quotation was created and the agent was shown a dead
                page. The builder's real address is `/createquotation`, keyed by query params, which
                is what the other eight call sites in this app already use. The lead id may be
                absent (a package is routinely quoted cold) and the builder handles that: it needs
                either a leadId or a quotationId, and it has the quotationId.
              */
              const id = quotation?.publicId ?? quotation?.id;
              if (!id) {
                showToast("Quotation created, but its id was missing — open it from the lead", "warn");
                return;
              }
              const leadId = quotation?.leadPublicId ?? "";
              navigate(`/createquotation?leadId=${encodeURIComponent(leadId)}&quotationId=${encodeURIComponent(id)}`);
            }}
          />
        ) : null}

        {linking ? (
          <PackageQuoteModal
            pkg={pkg}
            tier={tier}
            onClose={() => setLinking(false)}
          />
        ) : null}
      </div>
    </Page>
  );
}

/* ── Pieces ──────────────────────────────────────────────────────────────── */

/** The four things a buyer checks before reading anything. */
function FactStrip({ pkg }) {
  const facts = [
    pkg.nights !== null && pkg.nights !== undefined
      ? { Icon: CalendarDays, label: "Duration", value: nightsLabel(pkg.nights) } : null,
    pkg.category ? { Icon: Tag, label: "Category", value: PACKAGE_CATEGORY[pkg.category] ?? pkg.category } : null,
    pkg.minPax || pkg.maxPax
      ? { Icon: Users, label: "Group size", value: `${pkg.minPax ?? 1}${pkg.maxPax ? `–${pkg.maxPax}` : "+"} pax` } : null,
    pkg.stateName
      ? {
          Icon: MapPin,
          label: "Region",
          value: pkg.region ? `${pkg.stateName} · ${PACKAGE_REGION[pkg.region] ?? pkg.region}` : pkg.stateName,
        }
      : null,
  ].filter(Boolean);

  if (!facts.length) return null;

  return (
    <div className="mt-5 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
      {facts.map((f) => (
        <div key={f.label} className="flex items-start gap-2.5">
          <f.Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">{f.label}</div>
            <div className="truncate text-sm font-medium text-slate-900">{f.value}</div>
          </div>
        </div>
      ))}
      {pkg.packageCode ? (
        <div className="sm:col-span-2 lg:col-span-4">
          <span className="rounded bg-amber-50 px-2 py-0.5 font-mono text-[11px] text-amber-900">
            {pkg.packageCode}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The gallery.
 *
 * No chrome over the photographs and no "+N more" overlay — the count sits in words beside the grid.
 * The category ribbon is the one owner-taken exception, and it rides the hero the same way it rides
 * the card, so the two surfaces agree.
 */
// SUPERSEDED by HeroGallery + Lightbox above, and kept rather than deleted: this is the flat
// five-tile grid, which is still the right shape if a surface ever wants photographs without a
// viewer attached. Nothing calls it today.
// eslint-disable-next-line no-unused-vars
function Gallery({ images, cover, title, category }) {
  const photos = useMemo(() => {
    const list = (images ?? []).map((i) => ({ url: i.imageUrl, caption: i.caption }));
    if (!list.length && cover) return [{ url: cover, caption: null }];
    return list;
  }, [images, cover]);

  if (!photos.length) {
    return (
      <div className="mt-4 flex aspect-[21/6] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-slate-400">
        <ImageOff className="h-6 w-6" aria-hidden />
        <span className="text-xs">No photos for this package yet</span>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="grid gap-2 lg:grid-cols-4">
        <div className="relative overflow-hidden rounded-xl lg:col-span-2 lg:row-span-2">
          <Photo
            src={photos[0].url}
            alt={photos[0].caption || title}
            className="aspect-[4/3] w-full lg:aspect-auto lg:h-full"
          />
          <PackageRibbon category={category} />
        </div>
        {photos.slice(1, 5).map((p, i) => (
          <Photo
            key={i}
            src={p.url}
            alt={p.caption || `${title} photo ${i + 2}`}
            className="hidden aspect-[4/3] w-full rounded-xl lg:block"
          />
        ))}
      </div>
      {photos.length > 5 ? (
        <p className="mt-2 text-xs text-slate-500">{photos.length} photos</p>
      ) : null}
    </div>
  );
}

/**
 * The tier picker — one package, three things you could actually buy.
 *
 * <p>Laid out as cards rather than a dropdown or a row of chips, because the choice is not a
 * preference, it is a comparison: the hotels differ, the car differs and the price differs, and a
 * buyer cannot make that call without seeing all three at once. A select would hide two thirds of
 * the decision behind a click.</p>
 *
 * <p>Selection drives the price rail, the hotel names on the route, and the quotation — so what is
 * on screen is what gets sent. A picker that only changed a highlight would be decoration.</p>
 */
function TierPicker({ tiers, selectedId, onSelect, canMix, mixing, onToggleMix }) {
  return (
    <section className="mt-5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <SectionLabel className="mb-0">
          <Layers className="mr-1.5 inline h-3.5 w-3.5 align-text-bottom text-slate-400" aria-hidden />
          Choose your package
        </SectionLabel>
        <span className="text-[11px] text-slate-400">
          Same itinerary — different hotels, vehicle and price
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiers.map((t) => {
          const on = t.publicId === selectedId;
          return (
            <button
              key={t.publicId}
              type="button"
              onClick={() => onSelect(t.publicId)}
              aria-pressed={on}
              className={cn(
                "group flex flex-col rounded-lg border p-4 text-left transition",
                on
                  ? "border-blue-600 bg-blue-50/40 ring-1 ring-blue-600"
                  : "border-slate-200 bg-white hover:border-slate-300",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">{t.name}</div>
                  {t.category ? (
                    <div className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-400">
                      {PACKAGE_CATEGORY[t.category] ?? t.category}
                    </div>
                  ) : null}
                </div>
                <span
                  className={cn(
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                    on ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-white",
                  )}
                  aria-hidden
                >
                  {on ? <Check className="h-3 w-3 text-white" /> : null}
                </span>
              </div>

              {t.highlight ? (
                <p className="mt-2 line-clamp-2 text-xs text-slate-600">{t.highlight}</p>
              ) : null}

              <dl className="mt-3 space-y-1.5 text-xs">
                {t.vehicleName ? (
                  <div className="flex items-start gap-2">
                    <Car className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                    <dd className="min-w-0 text-slate-600">{t.vehicleName}</dd>
                  </div>
                ) : null}
                {t.hotels?.length ? (
                  <div className="flex items-start gap-2">
                    <Bed className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                    <dd className="min-w-0 text-slate-600">
                      {/* Two properties, then a count. A tier with five stops would otherwise push
                          the price off the fold on the one card a buyer is comparing against two
                          others. */}
                      {t.hotels.slice(0, 2).map((h) => h.hotelName || h.cityName).filter(Boolean).join(", ")}
                      {t.hotels.length > 2 ? ` +${t.hotels.length - 2} more` : ""}
                    </dd>
                  </div>
                ) : null}
              </dl>

              <div className="mt-auto pt-3">
                {t.fromPricePerPax === null || t.fromPricePerPax === undefined ? (
                  <span className="text-xs text-slate-500">On request</span>
                ) : (
                  <>
                    <div className="text-[11px] text-slate-500">Starting from</div>
                    <div className={cn("text-lg font-semibold", on ? PKG_ACCENT_TEXT : "text-slate-900")}>
                      {fmtMoney(t.fromPricePerPax)}
                      <span className="text-xs font-normal text-slate-500"> / pax</span>
                    </div>
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/*
        The one line that opens the mix, and only on packages the author opted in. It sits under the
        tiers rather than beside them because it is the alternative to picking one — and it stays a
        link rather than a button so it never competes with the tier cards for attention.
      */}
      {canMix ? (
        <button
          type="button"
          onClick={onToggleMix}
          className={cn(
            "mt-3 inline-flex items-center gap-1.5 text-xs font-medium transition",
            mixing ? "text-slate-600 hover:text-slate-900" : cn(PKG_ACCENT_TEXT, "hover:underline"),
          )}
        >
          <Wand2 className="h-3.5 w-3.5" aria-hidden />
          {mixing ? "Go back to the ready-made packages" : "Or build your own — pick a different level per stop"}
        </button>
      ) : null}
    </section>
  );
}

/** Mode → icon. `_default` keeps an unmapped value legible rather than blank. */
const TRAVEL_ICON = {
  ROAD: Car,
  FERRY: Ship,
  FLIGHT: Plane,
  TRAIN: TrainFront,
  CRUISE: Ship,
  WALK: Footprints,
  _default: Route,
};

/**
 * The route, as a timeline — and the journeys BETWEEN the stops.
 *
 * <p>The journey is the half a buyer actually asks about. "Port Blair → Havelock" tells them
 * nothing; "70 km · about 2h · by ferry" tells them what their morning looks like, and it is the
 * question that comes back to an agent more than any other. It renders between the two stops it
 * connects, because that is where it happens.</p>
 *
 * <p>A leg with nothing recorded shows no journey row at all — an empty "→ Havelock" with no
 * distance, no time and no mode is worse than the gap.</p>
 */
function StayPlan({ legs, tier, onOpenPhotos }) {
  // Hotels are matched to stops by city name, the same rule the server uses when it writes them
  // onto a quotation. Matching on an id would need the leg ids to be stable, and the itinerary
  // editor replaces legs wholesale on every save.
  const stayByCity = useMemo(() => {
    const map = new Map();
    for (const h of tier?.hotels ?? []) {
      const key = (h.cityName ?? "").trim().toLowerCase();
      if (key && !map.has(key)) map.set(key, h);
    }
    return map;
  }, [tier]);

  return (
    <Card>
      <SectionLabel>
        <MapPin className="mr-1.5 inline h-3.5 w-3.5 align-text-bottom text-slate-400" aria-hidden />
        Route{tier ? <span className="ml-1.5 font-normal normal-case text-slate-400">· {tier.name}</span> : null}
      </SectionLabel>
      <ol className="mt-3 space-y-0">
        {legs.map((leg, i) => {
          const stated = leg.distanceKm || leg.travelDurationLabel || leg.travelMode;
          const Icon = TRAVEL_ICON[leg.travelMode] ?? TRAVEL_ICON._default;
          const from = leg.travelFrom || (i > 0 ? legs[i - 1].cityName : null);

          return (
            <li key={leg.publicId}>
              {/* The journey into this stop, drawn on the connector above it. */}
              {stated && from ? (
                <div className="flex gap-3">
                  <div className="flex w-2 flex-col items-center">
                    <span className="w-px flex-1 bg-slate-200" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 py-1.5 text-xs text-slate-500">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                    <span className="text-slate-600">{from} → {leg.cityName}</span>
                    {leg.distanceKm ? <span>· {leg.distanceKm} km</span> : null}
                    {leg.travelDurationLabel ? <span>· about {leg.travelDurationLabel}</span> : null}
                    {leg.travelNote ? (
                      <span className="min-w-0 basis-full text-[11px] text-slate-400">{leg.travelNote}</span>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-slate-900" />
                  {i < legs.length - 1 ? <span className="w-px flex-1 bg-slate-200" /> : null}
                </div>
                <div className={cn("min-w-0 flex-1", i < legs.length - 1 && "pb-2")}>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-medium text-slate-900">{leg.cityName}</span>
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Moon className="h-3 w-3" aria-hidden />
                      {leg.nights} night{leg.nights === 1 ? "" : "s"}
                    </span>
                  </div>
                  {leg.note ? <p className="mt-0.5 text-xs text-slate-500">{leg.note}</p> : null}
                  <StayHotel
                    stay={stayByCity.get((leg.cityName ?? "").trim().toLowerCase())}
                    onOpenPhotos={onOpenPhotos}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <RouteTotals legs={legs} />
    </Card>
  );
}

/**
 * Where you actually sleep on this stop, for the tier being shown.
 *
 * <p>The property is the reason a tier costs what it costs, so it belongs on the stop rather than
 * only inside the picker — a buyer reading the route should not have to scroll back up to remember
 * which hotel this night is.</p>
 */
function StayHotel({ stay, onOpenPhotos }) {
  if (!stay) return null;
  const line = [stay.roomType, stay.mealPlan].filter(Boolean).join(" · ");
  const hotelShots = stay.images ?? [];
  const roomShots = stay.roomImages ?? [];

  return (
    <div className="mt-1.5 rounded-md border border-slate-100 bg-slate-50/60 px-2.5 py-2">
      <div className="flex items-start gap-2">
        <Bed className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
        <div className="min-w-0 text-xs">
          <span className="font-medium text-slate-700">{stay.hotelName || "Hotel to be confirmed"}</span>
          {stay.hotelStars ? (
            <span className="ml-1.5 inline-flex items-center gap-0.5 align-middle text-amber-600">
              <Star className="h-3 w-3 fill-current" aria-hidden />
              {stay.hotelStars}
            </span>
          ) : null}
          {line ? <span className="ml-1.5 text-slate-500">{line}</span> : null}
          {stay.note ? <p className="mt-0.5 text-[11px] text-slate-400">{stay.note}</p> : null}
        </div>
      </div>

      {/*
        The property and the room, kept apart. A lobby shot standing in for a room is the complaint
        an agency gets after the customer has already checked in — the hotel module states that rule
        at the top of its detail page and the server enforces it with a scope column.
      */}
      <PhotoRow label="Hotel" shots={hotelShots} onOpen={onOpenPhotos} title={stay.hotelName} />
      <PhotoRow label="Room" shots={roomShots} onOpen={onOpenPhotos} title={stay.roomType} />
    </div>
  );
}

/** A scope's thumbnails. Clicking one opens the same viewer the gallery uses. */
function PhotoRow({ label, shots, onOpen, title }) {
  if (!shots?.length) return null;
  return (
    <div className="mt-2">
      <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {shots.map((img, i) => (
          <button
            key={img.publicId ?? i}
            type="button"
            onClick={() => onOpen?.({ label: `${title || label} — ${label.toLowerCase()}`, shots, index: i })}
            className="h-14 w-20 shrink-0 overflow-hidden rounded border border-slate-200 transition hover:border-slate-400"
            aria-label={img.caption || `${title || label} photo ${i + 1}`}
          >
            <Photo src={img.imageUrl} alt={img.caption || `${title || label} photo ${i + 1}`} className="h-full w-full" />
          </button>
        ))}
      </div>
    </div>
  );
}

/** One line of arithmetic a buyer would otherwise do in their head. */
function RouteTotals({ legs }) {
  const km = legs.reduce((sum, l) => sum + (Number(l.distanceKm) || 0), 0);
  const mins = legs.reduce((sum, l) => sum + (Number(l.travelMinutes) || 0), 0);
  if (!km && !mins) return null;

  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  const time = mins ? (hours ? `${hours}h${rest ? ` ${rest}m` : ""}` : `${rest}m`) : null;

  return (
    <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
      {km ? <>Roughly <strong className="font-semibold text-slate-700">{km} km</strong> in total</> : null}
      {km && time ? " · " : null}
      {time ? <>about <strong className="font-semibold text-slate-700">{time}</strong> on the move</> : null}
    </p>
  );
}

function Itinerary({ days, onOpenPhoto }) {
  return (
    <Card>
      <SectionLabel>
        <CalendarDays className="mr-1.5 inline h-3.5 w-3.5 align-text-bottom text-slate-400" aria-hidden />
        Day-wise itinerary
      </SectionLabel>
      <ol className="mt-3 space-y-4">
        {days.map((day) => (
          <li key={day.publicId} className="rounded-lg border border-slate-200 p-3">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="rounded bg-slate-900 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                Day {day.dayNumber}
              </span>
              <span className="text-sm font-medium text-slate-900">{day.title}</span>
              {day.meals ? (
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Utensils className="h-3 w-3" aria-hidden />
                  {day.meals}
                </span>
              ) : null}
              {day.overnightCityName ? (
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Moon className="h-3 w-3" aria-hidden />
                  {day.overnightCityName}
                </span>
              ) : null}
            </div>
            {day.description ? (
              <p className="mt-1.5 whitespace-pre-line text-sm text-slate-600">{day.description}</p>
            ) : null}
            {day.sightseeing?.length ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Camera className="h-3 w-3 text-slate-400" aria-hidden />
                {day.sightseeing.map((s, i) => <Chip key={i}>{s}</Chip>)}
              </div>
            ) : null}
            <DayPhotos images={day.images} dayNumber={day.dayNumber} onOpen={onOpenPhoto} />
          </li>
        ))}
      </ol>
    </Card>
  );
}

/**
 * The day's photographs, beside the day they belong to.
 *
 * <p>Distinct from the gallery at the top on purpose. A strip of twelve pictures sells the trip; a
 * picture of Elephant Beach next to the sentence about Elephant Beach sells <i>that day</i>, which
 * is what a customer reading an itinerary is actually deciding on.</p>
 *
 * <p>Captions render under the photo rather than over it — this kit's standing rule is nothing over
 * an image, and the one exception (the category ribbon) was taken deliberately and stays scoped to
 * the card.</p>
 */
function DayPhotos({ images, dayNumber, onOpen }) {
  if (!images?.length) return null;
  return (
    <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {images.map((img, i) => (
        <figure key={img.publicId ?? i} className="min-w-0">
          <button
            type="button"
            onClick={() => onOpen?.(img)}
            className="block w-full overflow-hidden rounded-md transition hover:opacity-95"
            aria-label={img.caption || `Day ${dayNumber} photo ${i + 1} — open full size`}
          >
            <Photo
              src={img.imageUrl}
              alt={img.caption || `Day ${dayNumber} photo ${i + 1}`}
              className="aspect-[4/3] w-full"
            />
          </button>
          {img.caption ? (
            <figcaption className="mt-1 truncate text-[11px] text-slate-500">{img.caption}</figcaption>
          ) : null}
        </figure>
      ))}
    </div>
  );
}

function TwoLists({ inclusions, exclusions }) {
  if (!inclusions?.length && !exclusions?.length) return null;
  return (
    <Card>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <SectionLabel>What is included</SectionLabel>
          {inclusions?.length ? (
            <ul className="mt-2 space-y-1.5">
              {inclusions.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
                  <span className="min-w-0">{t}</span>
                </li>
              ))}
            </ul>
          ) : (
            // "Not stated" is the honest reading of an empty list — never "nothing included".
            <p className="mt-2 text-sm text-slate-400">Not stated</p>
          )}
        </div>
        <div>
          <SectionLabel>What is not</SectionLabel>
          {exclusions?.length ? (
            <ul className="mt-2 space-y-1.5">
              {exclusions.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <XIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" aria-hidden />
                  <span className="min-w-0">{t}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-400">Not stated</p>
          )}
        </div>
      </div>
    </Card>
  );
}

function PriceCard({ pkg, tier, onQuote, onLink }) {
  // A tier's own rates replace the package's, because that is what a chosen tier costs. Falling
  // back to the package slabs would show the cheapest tier's price under the Super Deluxe heading.
  const slabs = (tier ? tier.priceSlabs : pkg.priceSlabs) ?? [];
  const price = tier ? tier.fromPricePerPax : pkg.fromPricePerPax;
  const on = INCLUSIONS.filter((i) => pkg[i.key]);

  return (
    <Card>
      {tier ? (
        <div className="mb-2 flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-slate-400" aria-hidden />
          <span className="truncate text-sm font-medium text-slate-800">{tier.name}</span>
        </div>
      ) : null}

      {price === null || price === undefined ? (
        <>
          <div className="text-lg font-semibold text-slate-900">On request</div>
          <p className="mt-0.5 text-xs text-slate-500">
            No published rate. You can still build a quotation and price it yourself.
          </p>
        </>
      ) : (
        <>
          <div className="text-[11px] uppercase tracking-wide text-slate-400">Starting from</div>
          <div className="text-2xl font-semibold text-slate-900">
            {fmtMoney(price)}
            <span className="text-sm font-normal text-slate-500"> / pax</span>
          </div>
        </>
      )}

      <Button variant="primary" className={cn("mt-4 w-full", PKG_PRIMARY)} onClick={onLink}>
        <Link2 className="h-4 w-4" aria-hidden />
        Quotation link
      </Button>
      <p className="mt-1.5 text-center text-[11px] text-slate-400">
        A page you can send: itinerary, hotels, photos and price. Your cost never appears on it.
      </p>

      <Button className="mt-2 w-full" onClick={onQuote}>
        <Sparkles className="h-4 w-4" aria-hidden />
        Draft in builder
      </Button>
      <p className="mt-1.5 text-center text-[11px] text-slate-400">
        Opens a CRM quotation priced at this rate, to edit line by line.
      </p>

      {slabs.length > 0 ? (
        <>
          <Divider className="my-4" />
          <SectionLabel>All rates</SectionLabel>
          <ul className="mt-2 divide-y divide-slate-100">
            {slabs.map((s) => (
              <li key={s.publicId} className="flex items-baseline justify-between gap-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-xs text-slate-700">
                    {PACKAGE_OCCUPANCY[s.occupancy] ?? s.occupancy}
                  </div>
                  <div className="truncate text-[11px] text-slate-400">
                    {s.paxFrom}{s.paxTo ? `–${s.paxTo}` : "+"} pax{s.label ? ` · ${s.label}` : ""}
                  </div>
                </div>
                <div className="shrink-0 text-sm font-semibold text-slate-900">{fmtMoney(s.perPaxPrice)}</div>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {tier?.vehicleName ? (
        <>
          <Divider className="my-4" />
          <SectionLabel>Vehicle</SectionLabel>
          <div className="mt-1 flex items-start gap-2 text-xs text-slate-600">
            <Car className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
            <div className="min-w-0">
              <div className="font-medium text-slate-700">{tier.vehicleName}</div>
              {tier.vehicleNote ? <p className="mt-0.5 text-slate-500">{tier.vehicleNote}</p> : null}
            </div>
          </div>
        </>
      ) : null}

      {on.length ? (
        <>
          <Divider className="my-4" />
          <SectionLabel>Includes</SectionLabel>
          <div className="mt-2 flex flex-wrap gap-3">
            {on.map(({ key, Icon, label }) => (
              <span key={key} className="flex items-center gap-1.5 text-xs text-slate-600">
                <Icon className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                {label}
              </span>
            ))}
          </div>
        </>
      ) : null}
    </Card>
  );
}

/* ── Quotation dialog ────────────────────────────────────────────────────── */

function QuotationModal({ pkg, tier, onClose, onCreated }) {
  const { showToast } = useToast();
  const [pax, setPax] = useState(String(pkg.minPax ?? 2));
  const [travelDate, setTravelDate] = useState("");
  const [occupancy, setOccupancy] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  // The tier chosen on the page is the tier being quoted — the estimate here and the server's own
  // slab pick must read the same rates, or the number in this footer is a promise the quotation
  // then breaks.
  const slabs = useMemo(() => (tier ? tier.priceSlabs : pkg.priceSlabs) ?? [], [tier, pkg.priceSlabs]);

  const offered = useMemo(() => [...new Set(slabs.map((s) => s.occupancy))], [slabs]);

  /** What the quotation will total, before the agency's markup. */
  const estimate = useMemo(() => {
    const n = Number(pax) || 0;
    const applicable = slabs
      .filter((s) => (!occupancy || s.occupancy === occupancy))
      .filter((s) => (s.paxFrom == null || n >= s.paxFrom) && (s.paxTo == null || n <= s.paxTo))
      .map((s) => Number(s.perPaxPrice))
      .filter(Number.isFinite);
    if (!applicable.length || !n) return null;
    return Math.min(...applicable) * n;
  }, [pax, occupancy, slabs]);

  const submit = async () => {
    setSaving(true);
    try {
      const created = await packageMarketplaceService.toQuotation(pkg.publicId, {
        pax: Number(pax) || 1,
        travelDate: travelDate || undefined,
        occupancy: occupancy || undefined,
        variantPublicId: tier?.publicId || undefined,
        title: title.trim() || undefined,
      });
      onCreated(created);
    } catch (e) {
      if (!isAlreadyReported(e)) showToast(errMsg(e, "Could not create the quotation"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Create a quotation"
      description={tier ? `${pkg.title} — ${tier.name}` : pkg.title}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            {estimate === null
              ? "Priced by you in the builder"
              : <>Quotation total <strong className="font-semibold text-slate-900">{fmtMoney(estimate)}</strong> before markup</>}
          </span>
          <div className="flex gap-2">
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" className={PKG_PRIMARY} loading={saving} onClick={submit}>Create</Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="pkg-pax">Travellers</label>
          <Input id="pkg-pax" type="number" min={1} value={pax} onChange={(e) => setPax(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="pkg-date">Travel date</label>
          <Input id="pkg-date" type="date" value={travelDate} onChange={(e) => setTravelDate(e.target.value)} />
          <p className="mt-1 text-[11px] text-slate-400">Blank leaves dates to fill in later.</p>
        </div>

        {offered.length > 1 ? (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="pkg-occ">Sharing</label>
            <Select id="pkg-occ" value={occupancy} onChange={(e) => setOccupancy(e.target.value)}>
              <option value="">Cheapest applicable</option>
              {offered.map((o) => <option key={o} value={o}>{PACKAGE_OCCUPANCY[o] ?? o}</option>)}
            </Select>
          </div>
        ) : null}

        <div className={offered.length > 1 ? "" : "sm:col-span-2"}>
          <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="pkg-title">Title</label>
          <Input id="pkg-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={pkg.title} />
        </div>
      </div>

      <Notice tone="info" className="mt-4">
        The quotation opens as a draft priced at the package rate. Add your own markup in the builder
        before sending it.
      </Notice>
    </Modal>
  );
}

export default PackageDetail;
