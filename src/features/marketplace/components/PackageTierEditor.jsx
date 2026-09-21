// src/features/marketplace/components/PackageTierEditor.jsx
//
// The tiers of a package — Basic / Deluxe / Super Deluxe — each with its own hotels, vehicle and
// prices.
//
// Two things drive the whole design:
//
//  1. HOTEL ROWS COME FROM THE STAY PLAN. The author already said the trip is Port Blair → Havelock
//     → Neil; making them retype those city names per tier would be three chances to typo the same
//     four words, and the server matches variant hotels to stops BY NAME. So the rows are generated
//     from the stay plan and the city is fixed text, not an input.
//  2. PRICES LIVE ON THE TIER. A tier and its rates are one decision, and the save endpoint takes
//     them together. The separate rate table is for packages with no tiers at all.
//
// When the package is customisable, each component also carries a rate so a mixed selection can be
// estimated — and the footer reconciles those against the tier's own headline price, because a
// mixed estimate that drifts away from the unmixed tier is the failure this feature invites.

import { useMemo, useRef, useState } from "react";
import { Plus, Trash2, Car, BedDouble, IndianRupee, AlertCircle, Check, Upload, ImagePlus } from "lucide-react";

import API from "@shared/api/http";
import {
  Button, Input, Select, Card, SectionLabel, Notice, Empty, Photo,
  useToast, errMsg, isAlreadyReported, cn,
} from "./marketplaceUi";
import { PackageRateTable, toRateRows, toRatePayload } from "./PackageRateTable";
import { PACKAGE_CATEGORY } from "../api/packageMarketplaceService";

const BLANK_TIER = {
  publicId: undefined,
  name: "",
  category: "",
  vehicleName: "",
  vehicleNote: "",
  vehiclePerPaxPrice: "",
  highlight: "",
  hotels: [],
  rateRows: [],
};

/** Server tiers → editable rows. Hotels are re-keyed onto the stay plan so a renamed stop shows up. */
export function toTierRows(variants, stayLegs) {
  return (variants ?? []).map((v) => ({
    publicId: v.publicId,
    name: v.name ?? "",
    category: v.category ?? "",
    vehicleName: v.vehicleName ?? "",
    vehicleNote: v.vehicleNote ?? "",
    vehiclePerPaxPrice: v.vehiclePerPaxPrice ?? "",
    highlight: v.highlight ?? "",
    hotels: alignHotels(v.hotels, stayLegs),
    rateRows: toRateRows(v.priceSlabs),
  }));
}

/**
 * Line the tier's saved hotels up against the current stay plan.
 *
 * <p>One row per stop, in stay-plan order, carrying whatever was saved for that city. A saved row
 * whose city is no longer on the route is appended as an ORPHAN rather than dropped — the operator
 * who renamed "Cochin" to "Kochi" wants their hotel back, not a blank row and no explanation.</p>
 */
function alignHotels(saved, stayLegs) {
  const bySaved = new Map();
  (saved ?? []).forEach((h) => bySaved.set((h.cityName ?? "").toLowerCase(), h));

  const rows = (stayLegs ?? []).map((leg) => {
    const match = bySaved.get((leg.cityName ?? "").toLowerCase());
    bySaved.delete((leg.cityName ?? "").toLowerCase());
    return {
      cityName: leg.cityName,
      nights: leg.nights ?? 1,
      hotelName: match?.hotelName ?? "",
      roomType: match?.roomType ?? "",
      mealPlan: match?.mealPlan ?? "",
      hotelStars: match?.hotelStars ?? "",
      perPaxPerNight: match?.perPaxPerNight ?? "",
      // V34 detail. Lists are edited as one comma-separated line, like the day's sightseeing.
      checkInTime: match?.checkInTime ?? "",
      checkOutTime: match?.checkOutTime ?? "",
      facilities: (match?.facilities ?? []).join(", "),
      roomAmenities: (match?.roomAmenities ?? []).join(", "),
      images: (match?.images ?? []).map(toPhotoRow),
      roomImages: (match?.roomImages ?? []).map(toPhotoRow),
      orphan: false,
    };
  });

  // Anything left over no longer matches a stop.
  bySaved.forEach((h) => rows.push({
    cityName: h.cityName,
    nights: 0,
    hotelName: h.hotelName ?? "",
    roomType: h.roomType ?? "",
    mealPlan: h.mealPlan ?? "",
    hotelStars: h.hotelStars ?? "",
    perPaxPerNight: h.perPaxPerNight ?? "",
    checkInTime: h.checkInTime ?? "",
    checkOutTime: h.checkOutTime ?? "",
    facilities: (h.facilities ?? []).join(", "),
    roomAmenities: (h.roomAmenities ?? []).join(", "),
    images: (h.images ?? []).map(toPhotoRow),
    roomImages: (h.roomImages ?? []).map(toPhotoRow),
    orphan: true,
  }));

  return rows;
}

/**
 * How many photographs one hotel — or one room — may carry.
 *
 * <p>Mirrors {@code PackageVariantsRequest.MAX_HOTEL_PHOTOS} on the server. The server is still the
 * gate; this is here so an author never uploads a sixth photo and only then learns it was refused.
 * If one number moves, both move.</p>
 */
export const MAX_HOTEL_PHOTOS = 5;

/** Server photo → editable row. Caption is always a string so the input stays controlled. */
const toPhotoRow = (i) => ({ imageUrl: i.imageUrl, caption: i.caption ?? "" });

/** "Pool, Spa,, Wi-Fi " → ["Pool", "Spa", "Wi-Fi"]. Always an array — the server column is NOT NULL. */
const splitList = (s) => (s ? String(s).split(",").map((x) => x.trim()).filter(Boolean) : []);

/** Editable rows → the wire shape the save endpoint takes. */
export function toTierPayload(tiers) {
  return tiers.map((t) => ({
    publicId: t.publicId,
    name: t.name.trim(),
    category: t.category || null,
    vehicleName: t.vehicleName?.trim() || null,
    vehicleNote: t.vehicleNote?.trim() || null,
    vehiclePerPaxPrice: t.vehiclePerPaxPrice === "" ? null : Number(t.vehiclePerPaxPrice),
    highlight: t.highlight?.trim() || null,
    active: true,
    hotels: (t.hotels ?? [])
      // An orphan row is kept only if the operator actually filled it in; an empty one is noise.
      .filter((h) => !h.orphan || h.hotelName?.trim())
      .map((h) => ({
        cityName: h.cityName,
        hotelName: h.hotelName?.trim() || null,
        roomType: h.roomType?.trim() || null,
        mealPlan: h.mealPlan?.trim() || null,
        hotelStars: h.hotelStars === "" ? null : Number(h.hotelStars),
        perPaxPerNight: h.perPaxPerNight === "" ? null : Number(h.perPaxPerNight),
        checkInTime: h.checkInTime?.trim() || null,
        checkOutTime: h.checkOutTime?.trim() || null,
        facilities: splitList(h.facilities),
        roomAmenities: splitList(h.roomAmenities),
        // Sliced rather than trusted: the UI stops at the cap, but a stale row loaded from a
        // package saved before the cap existed would otherwise fail the whole save on validation.
        images: (h.images ?? []).filter((i) => i.imageUrl).slice(0, MAX_HOTEL_PHOTOS)
          .map((i) => ({ imageUrl: i.imageUrl, caption: i.caption?.trim() || null })),
        roomImages: (h.roomImages ?? []).filter((i) => i.imageUrl).slice(0, MAX_HOTEL_PHOTOS)
          .map((i) => ({ imageUrl: i.imageUrl, caption: i.caption?.trim() || null })),
      })),
    priceSlabs: toRatePayload(t.rateRows ?? []),
  }));
}

export function tiersAreValid(tiers) {
  return (tiers ?? []).every(
    (t) => t.name?.trim()
      && (t.rateRows ?? []).every((r) => r.perPaxPrice !== "" && Number(r.perPaxPrice) >= 0),
  );
}

/* ── Editor ──────────────────────────────────────────────────────────────── */

export function PackageTierEditor({ tiers, onChange, stayLegs, customisable, basePerPax, className }) {
  const patch = (i, key, value) => onChange(tiers.map((t, x) => (x === i ? { ...t, [key]: value } : t)));

  const patchHotel = (ti, hi, key, value) =>
    onChange(tiers.map((t, x) => (x === ti
      ? { ...t, hotels: t.hotels.map((h, y) => (y === hi ? { ...h, [key]: value } : h)) }
      : t)));

  const add = () => onChange([
    ...tiers,
    { ...BLANK_TIER, hotels: alignHotels([], stayLegs), rateRows: toRateRows([]) },
  ]);

  if (!stayLegs?.length) {
    return (
      <Card className={className}>
        <Empty
          icon={BedDouble}
          title="Add the stay plan first"
          hint="A tier says which hotel at each stop, so there have to be stops. Fill in the Itinerary tab, then come back."
        />
      </Card>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {tiers.length === 0 ? (
        <Card>
          <Empty
            icon={IndianRupee}
            title="No tiers yet"
            hint="Sell the same trip at two or three comfort levels — same itinerary, different hotels, rooms and vehicle."
            action={<Button variant="primary" onClick={add}><Plus className="h-4 w-4" aria-hidden />Add a tier</Button>}
          />
        </Card>
      ) : (
        tiers.map((tier, i) => (
          <TierCard
            key={tier.publicId ?? `new-${i}`}
            tier={tier}
            index={i}
            customisable={customisable}
            basePerPax={basePerPax}
            onPatch={(k, v) => patch(i, k, v)}
            onPatchHotel={(hi, k, v) => patchHotel(i, hi, k, v)}
            onRates={(rows) => patch(i, "rateRows", rows)}
            onRemove={() => onChange(tiers.filter((_, x) => x !== i))}
          />
        ))
      )}

      {tiers.length > 0 ? (
        <Button onClick={add}>
          <Plus className="h-4 w-4" aria-hidden />
          Add another tier
        </Button>
      ) : null}
    </div>
  );
}

function TierCard({
  tier, index, customisable, basePerPax, onPatch, onPatchHotel, onRates, onRemove,
}) {
  /**
   * What the components add up to, per person, against what the tier actually sells for.
   *
   * Only shown when the package is customisable, because that is the only time the components are
   * used as prices. It is the reconciliation that stops a mixed estimate quietly drifting away from
   * the unmixed tier — the specific way this feature goes wrong.
   */
  const reconciliation = useMemo(() => {
    if (!customisable) return null;

    const hotelSum = (tier.hotels ?? []).reduce((sum, h) => {
      const rate = Number(h.perPaxPerNight);
      const nights = Number(h.nights) || 0;
      return sum + (Number.isFinite(rate) ? rate * nights : 0);
    }, 0);
    const vehicle = Number(tier.vehiclePerPaxPrice) || 0;
    const base = Number(basePerPax) || 0;
    const components = hotelSum + vehicle + base;

    const prices = (tier.rateRows ?? [])
      .map((r) => Number(r.perPaxPrice))
      .filter((n) => Number.isFinite(n) && n > 0);
    const headline = prices.length ? Math.min(...prices) : null;

    if (!components || headline === null) return { components, headline, gap: null };
    const gap = components - headline;
    // 2% — tight enough to catch a wrong figure, loose enough to tolerate rounding on a five-digit
    // number split across four hotels.
    return { components, headline, gap, off: Math.abs(gap) / headline > 0.02 };
  }, [customisable, tier, basePerPax]);

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
          Tier {index + 1}
        </span>
        <Input
          className="min-w-0 flex-1"
          value={tier.name}
          placeholder="Deluxe"
          onChange={(e) => onPatch("name", e.target.value)}
          aria-label={`Tier ${index + 1} name`}
        />
        <Select
          className="w-40 shrink-0"
          value={tier.category}
          onChange={(e) => onPatch("category", e.target.value)}
          aria-label={`Tier ${index + 1} category`}
        >
          <option value="">No category</option>
          {Object.entries(PACKAGE_CATEGORY).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove tier ${index + 1}`}
          title="Remove this tier"
          className="shrink-0 rounded-md border border-slate-200 p-2 text-slate-400 transition hover:border-rose-200 hover:text-rose-600"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {/* ── Vehicle ── */}
      <div className="mt-4">
        <SectionLabel>
          <Car className="mr-1.5 inline h-3.5 w-3.5 align-text-bottom text-slate-400" aria-hidden />
          Vehicle
        </SectionLabel>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <Input
            value={tier.vehicleName}
            placeholder="Innova Crysta"
            onChange={(e) => onPatch("vehicleName", e.target.value)}
            aria-label={`Tier ${index + 1} vehicle`}
          />
          <Input
            value={tier.vehicleNote}
            placeholder="Note — AC, driver included…"
            onChange={(e) => onPatch("vehicleNote", e.target.value)}
            aria-label={`Tier ${index + 1} vehicle note`}
          />
          {customisable ? (
            <Input
              type="number"
              min={0}
              value={tier.vehiclePerPaxPrice}
              placeholder="₹ per pax"
              onChange={(e) => onPatch("vehiclePerPaxPrice", e.target.value)}
              aria-label={`Tier ${index + 1} vehicle price per pax`}
            />
          ) : null}
        </div>
      </div>

      {/* ── Hotels, one row per stop ── */}
      <div className="mt-4">
        <SectionLabel>
          <BedDouble className="mr-1.5 inline h-3.5 w-3.5 align-text-bottom text-slate-400" aria-hidden />
          Where this tier stays
        </SectionLabel>
        <div className="mt-2 space-y-2">
          {(tier.hotels ?? []).map((h, hi) => (
            <div
              key={`${h.cityName}-${hi}`}
              className={cn(
                "grid gap-2 rounded-lg border p-2 sm:grid-cols-12",
                h.orphan ? "border-amber-200 bg-amber-50/50" : "border-slate-200",
              )}
            >
              <div className="flex items-center gap-1.5 sm:col-span-3">
                <span className="truncate text-sm font-medium text-slate-800">{h.cityName}</span>
                <span className="shrink-0 text-[11px] text-slate-400">
                  {h.orphan ? "not on the route" : `${h.nights}N`}
                </span>
              </div>
              <Input
                className="sm:col-span-3"
                value={h.hotelName}
                placeholder="Hotel"
                onChange={(e) => onPatchHotel(hi, "hotelName", e.target.value)}
                aria-label={`${h.cityName} hotel`}
              />
              <Input
                className="sm:col-span-3"
                value={h.roomType}
                placeholder="Room type"
                onChange={(e) => onPatchHotel(hi, "roomType", e.target.value)}
                aria-label={`${h.cityName} room type`}
              />
              <Input
                className={customisable ? "sm:col-span-2" : "sm:col-span-3"}
                value={h.mealPlan}
                placeholder="Meals"
                onChange={(e) => onPatchHotel(hi, "mealPlan", e.target.value)}
                aria-label={`${h.cityName} meal plan`}
              />
              {customisable ? (
                <Input
                  className="sm:col-span-1"
                  type="number"
                  min={0}
                  value={h.perPaxPerNight}
                  placeholder="₹/night"
                  onChange={(e) => onPatchHotel(hi, "perPaxPerNight", e.target.value)}
                  aria-label={`${h.cityName} per pax per night`}
                />
              ) : null}

              {/* Check-in / check-out and the two amenity lists. What the customer's page prints
                  under the hotel — a houseboat that boards at noon, a room with a bathtub — and what
                  the competitor's quotation had that ours did not. */}
              <Input
                className="sm:col-span-2"
                value={h.checkInTime}
                placeholder="Check-in 14:00"
                onChange={(e) => onPatchHotel(hi, "checkInTime", e.target.value)}
                aria-label={`${h.cityName} check-in time`}
              />
              <Input
                className="sm:col-span-2"
                value={h.checkOutTime}
                placeholder="Check-out 11:00"
                onChange={(e) => onPatchHotel(hi, "checkOutTime", e.target.value)}
                aria-label={`${h.cityName} check-out time`}
              />
              <Input
                className="sm:col-span-4"
                value={h.facilities}
                placeholder="Hotel facilities — Pool, Spa, Wi-Fi"
                onChange={(e) => onPatchHotel(hi, "facilities", e.target.value)}
                aria-label={`${h.cityName} hotel facilities`}
              />
              <Input
                className="sm:col-span-4"
                value={h.roomAmenities}
                placeholder="Room amenities — Sea view, Bathtub"
                onChange={(e) => onPatchHotel(hi, "roomAmenities", e.target.value)}
                aria-label={`${h.cityName} room amenities`}
              />

              {/*
                The two galleries. Side by side and always visible, because the photographs are the
                reason a buyer picks one tier over another, and a gallery behind a disclosure is a
                gallery that stays empty.
              */}
              <div className="grid gap-2 sm:col-span-12 sm:grid-cols-2">
                <HotelPhotos
                  label="Hotel photos"
                  photos={h.images}
                  onChange={(next) => onPatchHotel(hi, "images", next)}
                  scopeLabel={`${h.cityName} hotel`}
                />
                <HotelPhotos
                  label="Room photos"
                  photos={h.roomImages}
                  onChange={(next) => onPatchHotel(hi, "roomImages", next)}
                  scopeLabel={`${h.cityName} room`}
                />
              </div>
            </div>
          ))}
        </div>
        {(tier.hotels ?? []).some((h) => h.orphan) ? (
          <Notice tone="warn" className="mt-2">
            A hotel is saved against a city that is no longer a stop — probably a renamed stop. Fix
            the name in the Itinerary tab, or clear the hotel to drop it.
          </Notice>
        ) : null}
      </div>

      {/* ── This tier's prices ── */}
      <div className="mt-4">
        <SectionLabel>
          <IndianRupee className="mr-1.5 inline h-3.5 w-3.5 align-text-bottom text-slate-400" aria-hidden />
          What this tier costs
        </SectionLabel>
        <PackageRateTable className="mt-2" rows={tier.rateRows ?? []} onChange={onRates} />
      </div>

      {reconciliation && reconciliation.headline !== null && reconciliation.components > 0 ? (
        <div
          className={cn(
            "mt-3 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs",
            reconciliation.off
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-900",
          )}
        >
          {reconciliation.off
            ? <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            : <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />}
          <span>
            Components add up to <strong>₹{Math.round(reconciliation.components).toLocaleString("en-IN")}</strong>
            {" "}· this tier sells at <strong>₹{Math.round(reconciliation.headline).toLocaleString("en-IN")}</strong>
            {reconciliation.off
              ? " — a mixed selection would be estimated well away from what this tier actually costs."
              : " — a mixed estimate will land near the real price."}
          </span>
        </div>
      ) : null}
    </Card>
  );
}

/**
 * One scope's photographs for one hotel on one tier.
 *
 * <p>Uploaded through the package upload proxy — the same endpoint the package gallery and the day
 * photos use — so the tenant's storage quota is enforced and metered in one place. A browser-direct
 * upload would bypass both.</p>
 *
 * <p>They stay in the editor's state and save with the tier. A photo that posted itself on pick
 * would attach to a tier the author might still abandon, and the abandoned ones would be orphans
 * nothing ever cleans up.</p>
 *
 * <p>At the cap the Add control disables rather than disappearing, and says why — a control that
 * vanishes reads as a bug, and the author is left wondering where it went.</p>
 */
function HotelPhotos({ label, photos, onChange, scopeLabel }) {
  const { showToast } = useToast();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const list = photos ?? [];
  const full = list.length >= MAX_HOTEL_PHOTOS;

  const upload = async (file) => {
    if (!file || full) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await API.post("/package-marketplace/my-packages/upload-image", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      // ApiResponse<{imagePath}> — read the field off the object rather than destructuring a
      // string. (TabPhotos.jsx in the console gets this wrong and posts `imageUrl: undefined`.)
      const imagePath = res?.data?.data?.imagePath;
      if (!imagePath) throw new Error("Upload did not return an image path");
      onChange([...list, { imageUrl: imagePath, caption: "" }]);
    } catch (e) {
      if (!isAlreadyReported(e)) showToast(errMsg(e, "Could not upload the photo"), "error");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="rounded-md border border-slate-100 bg-slate-50/50 p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          {label}
          <span className="ml-1 font-normal normal-case text-slate-400">{list.length}/{MAX_HOTEL_PHOTOS}</span>
        </span>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
        <Button
          loading={busy}
          disabled={full}
          title={full ? `At most ${MAX_HOTEL_PHOTOS} photos here` : undefined}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" aria-hidden />
          Add
        </Button>
      </div>

      {list.length === 0 ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="mt-2 flex w-full flex-col items-center gap-1 rounded-md border border-dashed border-slate-300 py-4 text-slate-400 transition hover:border-slate-400 hover:text-slate-600"
        >
          <ImagePlus className="h-4 w-4" aria-hidden />
          <span className="text-[11px]">No {label.toLowerCase()} yet</span>
        </button>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {list.map((img, x) => (
            <div key={x} className="overflow-hidden rounded-md border border-slate-200 bg-white">
              <Photo src={img.imageUrl} alt={img.caption || scopeLabel} className="aspect-[4/3] w-full" />
              <div className="flex items-center gap-1 p-1">
                <Input
                  className="min-w-0 flex-1"
                  value={img.caption}
                  placeholder="Caption"
                  onChange={(e) => onChange(list.map((m, y) => (y === x ? { ...m, caption: e.target.value } : m)))}
                  aria-label={`${scopeLabel} photo ${x + 1} caption`}
                />
                <button
                  type="button"
                  onClick={() => onChange(list.filter((_, y) => y !== x))}
                  className="shrink-0 rounded p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                  aria-label={`Remove ${scopeLabel} photo ${x + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PackageTierEditor;
