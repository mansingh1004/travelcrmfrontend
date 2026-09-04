// src/console/pages/PlatformPackageEditor.jsx
//
// Author a PLATFORM package — the half the hotel design left out entirely and then had to bolt on
// as a partner module. The platform can fill its own catalog here without waiting for a supplier.
//
// Five sections, matching the endpoints behind them: details, itinerary, tiers, rates, photos. They
// are separate saves on the server and the form keeps them separate, because a screen that renders
// one section and posts them all is a screen that will one day post an empty version of one.
//
// Every save is step-up guarded. `useStepUp` owns the code, the busy state and the error, and the
// error stays inside its dialog — the operator is still standing at the code field and the usual
// failure is a code that expired while they typed.
//
// Palette: `.sa-console` semantic + hue tokens only.

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Package, Plus, Trash2, Upload, Star, ArrowUp, ArrowDown } from "lucide-react";

import {
  PageShell, PageHeader, HotelStyles, SectionCard, Button, Input, Textarea, Select, Label,
  LoadingState, errMsg,
} from "../components/hotelUi";
import { useStepUp } from "../components/useStepUp";

/** What kind of day, mirroring the server's PackageDayType. "" is an ordinary, untyped day. */
const DAY_TYPES = [
  { value: "", label: "Day type" },
  { value: "ARRIVAL", label: "Arrival" },
  { value: "DAY_TOUR", label: "Day tour" },
  { value: "ACTIVITY", label: "Activity" },
  { value: "CITY_STOP", label: "City stop" },
  { value: "TRANSFER", label: "Transfer day" },
  { value: "LEISURE", label: "Day at leisure" },
  { value: "DEPARTURE", label: "Departure" },
];
import {
  platformPackageService, PACKAGE_CATEGORY, PACKAGE_REGION, packageStatus,
} from "../api/platformPackageService";

const OCCUPANCY = ["SINGLE", "DOUBLE", "TRIPLE", "QUAD", "CHILD_WITH_BED", "CHILD_NO_BED", "INFANT"];

const TABS = [
  { value: "details", label: "Details" },
  { value: "itinerary", label: "Itinerary" },
  // Between the itinerary and the rates, because that is the order the decisions happen in: the
  // route first, then what each level puts you in along it, then what it all costs.
  { value: "tiers", label: "Tiers" },
  { value: "rates", label: "Rates" },
  { value: "photos", label: "Photos" },
];

/** Travel modes, mirroring the server's PackageTravelMode. */
const TRAVEL_MODES = [
  { value: "ROAD", label: "By road" },
  { value: "FERRY", label: "By ferry" },
  { value: "FLIGHT", label: "By flight" },
  { value: "TRAIN", label: "By train" },
  { value: "CRUISE", label: "By cruise" },
  { value: "WALK", label: "On foot" },
];

/** "" and a non-number both become null — an empty box must not post 0 km. */
const numOrNull = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Hours + minutes as one minute count, or null when neither was typed. */
const minutesOf = (hours, mins) => {
  const total = (Number(hours) || 0) * 60 + (Number(mins) || 0);
  return total > 0 ? total : null;
};

const BLANK = {
  title: "", subtitle: "", region: "", countryCode: "IN", stateName: "", stateCode: "",
  category: "", nights: "", minPax: "", maxPax: "",
  includesHotel: true, includesMeal: false, includesVehicle: false,
  includesSightseeing: false, includesFlight: false,
  overview: "", terms: "", cancellationPolicy: "", validFrom: "", validTo: "",
};

export default function PlatformPackageEditor() {
  const { publicId } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const stepUp = useStepUp();

  const isNew = !publicId;
  const tab = isNew ? "details" : (params.get("tab") ?? "details");

  const [pkg, setPkg] = useState(isNew ? {} : null);
  const [form, setForm] = useState(BLANK);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (isNew) return;
    try {
      const full = await platformPackageService.get(publicId);
      setPkg(full);
      setForm({
        title: full.title ?? "", subtitle: full.subtitle ?? "",
        region: full.region ?? "", countryCode: full.countryCode ?? "IN",
        stateName: full.stateName ?? "", stateCode: full.stateCode ?? "",
        category: full.category ?? "", nights: full.nights ?? "",
        minPax: full.minPax ?? "", maxPax: full.maxPax ?? "",
        includesHotel: !!full.includesHotel, includesMeal: !!full.includesMeal,
        includesVehicle: !!full.includesVehicle, includesSightseeing: !!full.includesSightseeing,
        includesFlight: !!full.includesFlight,
        overview: full.overview ?? "", terms: full.terms ?? "",
        cancellationPolicy: full.cancellationPolicy ?? "",
        validFrom: full.validFrom ?? "", validTo: full.validTo ?? "",
      });
      setError("");
    } catch (e) {
      setError(errMsg(e, "Could not load this package."));
    }
  }, [isNew, publicId]);

  useEffect(() => { load(); }, [load]);

  const patch = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const payload = () => ({
    ...form,
    nights: form.nights === "" ? null : Number(form.nights),
    minPax: form.minPax === "" ? null : Number(form.minPax),
    maxPax: form.maxPax === "" ? null : Number(form.maxPax),
    region: form.region || null,
    category: form.category || null,
    validFrom: form.validFrom || null,
    validTo: form.validTo || null,
  });

  const saveDetails = () => {
    // Validate BEFORE opening the MFA dialog — an operator should not spend a code to learn the
    // title is blank.
    if (!form.title.trim()) { setError("A title is required."); return; }
    setError("");
    stepUp.request({
      title: isNew ? "Create this package?" : "Save changes?",
      description: isNew
        ? "It starts as a draft. Nobody sees it until you publish it."
        : "Saved immediately. Publishing is a separate step.",
      confirmLabel: isNew ? "Create package" : "Save",
      run: async (code) => {
        const saved = isNew
          ? await platformPackageService.create(payload(), code)
          : await platformPackageService.update(publicId, payload(), code);
        if (isNew) {
          navigate(`/console/package-catalog/${saved.publicId}/edit?tab=itinerary`, { replace: true });
        } else {
          setPkg(saved);
        }
      },
    });
  };

  if (error && !pkg) {
    return (
      <PageShell>
        <HotelStyles />
        <PageHeader title="Package" icon={Package} />
        <SectionCard title="Not available"><p className="text-sm text-hue-rose">{error}</p></SectionCard>
      </PageShell>
    );
  }
  if (!pkg) {
    return <PageShell><HotelStyles /><LoadingState label="Loading package…" /></PageShell>;
  }

  const status = pkg.status ? packageStatus(pkg.status) : null;

  return (
    <PageShell>
      <HotelStyles />
      <PageHeader
        title={isNew ? "New platform package" : form.title || "Package"}
        subtitle={pkg.packageCode ? `Code ${pkg.packageCode}` : "A draft. Publish it when it is ready to sell."}
        icon={Package}
      >
        <div className="flex items-center gap-2">
          {status?.label ? (
            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${status.cls}`}>{status.label}</span>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => navigate("/console/package-catalog")}>
            Back to catalog
          </Button>
        </div>
      </PageHeader>

      {error ? <p className="mb-3 text-sm text-hue-rose">{error}</p> : null}

      {!isNew && (
        <div className="mb-4 flex items-center gap-1 border-b border-border">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setParams({ tab: t.value }, { replace: true })}
              className={
                "-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition "
                + (tab === t.value
                  ? "border-accent text-heading"
                  : "border-transparent text-muted hover:text-body")
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {isNew || tab === "details" ? (
        <DetailsSection form={form} patch={patch} onSave={saveDetails} isNew={isNew} />
      ) : tab === "itinerary" ? (
        <ItinerarySection pkg={pkg} stepUp={stepUp} onSaved={load} />
      ) : tab === "tiers" ? (
        <TiersSection pkg={pkg} stepUp={stepUp} onSaved={load} />
      ) : tab === "rates" ? (
        <RatesSection pkg={pkg} stepUp={stepUp} onSaved={load} />
      ) : (
        <PhotosSection pkg={pkg} stepUp={stepUp} onChanged={load} />
      )}

      {stepUp.dialog}
    </PageShell>
  );
}

/* ── Details ─────────────────────────────────────────────────────────────── */

function DetailsSection({ form, patch, onSave, isNew }) {
  const field = (key, label, props = {}) => (
    <div>
      <Label htmlFor={`pk-${key}`}>{label}</Label>
      <Input id={`pk-${key}`} value={form[key]} onChange={(e) => patch(key, e.target.value)} {...props} />
    </div>
  );

  return (
    <SectionCard
      title="Details"
      subtitle={isNew ? "Save these first — the itinerary and rates attach to a package that exists." : null}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="pk-title" required>Title</Label>
          <Input id="pk-title" value={form.title} onChange={(e) => patch("title", e.target.value)} />
        </div>
        <div className="sm:col-span-2">{field("subtitle", "Subtitle")}</div>

        <div>
          <Label htmlFor="pk-region">Region</Label>
          <Select id="pk-region" value={form.region} onChange={(e) => patch("region", e.target.value)}>
            <option value="">Not set</option>
            {Object.entries(PACKAGE_REGION).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="pk-category">Category</Label>
          <Select id="pk-category" value={form.category} onChange={(e) => patch("category", e.target.value)}>
            <option value="">Not set</option>
            {Object.entries(PACKAGE_CATEGORY).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </div>

        {field("stateName", "State")}
        {field("stateCode", "State code", { maxLength: 4, placeholder: "AN" })}
        {field("countryCode", "Country code", { maxLength: 3, placeholder: "IN" })}
        {field("nights", "Nights", { type: "number", min: 0 })}
        {field("minPax", "Minimum pax", { type: "number", min: 1 })}
        {field("maxPax", "Maximum pax", { type: "number", min: 1 })}
        {field("validFrom", "Valid from", { type: "date" })}
        {field("validTo", "Valid to", { type: "date" })}

        <div className="sm:col-span-2">
          <Label>Includes</Label>
          <div className="mt-1 flex flex-wrap gap-x-5 gap-y-2">
            {[
              ["includesHotel", "Hotel"], ["includesMeal", "Meals"], ["includesVehicle", "Vehicle"],
              ["includesSightseeing", "Sightseeing"], ["includesFlight", "Flight"],
            ].map(([key, label]) => (
              <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-body">
                <input
                  type="checkbox"
                  checked={!!form[key]}
                  onChange={(e) => patch(key, e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="pk-overview">Overview</Label>
          <Textarea id="pk-overview" rows={4} value={form.overview} onChange={(e) => patch("overview", e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="pk-cancel">Cancellation policy</Label>
          <Textarea id="pk-cancel" rows={3} value={form.cancellationPolicy} onChange={(e) => patch("cancellationPolicy", e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="pk-terms">Terms</Label>
          <Textarea id="pk-terms" rows={3} value={form.terms} onChange={(e) => patch("terms", e.target.value)} />
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <Button onClick={onSave}>{isNew ? "Create package" : "Save details"}</Button>
      </div>
    </SectionCard>
  );
}

/* ── Itinerary ───────────────────────────────────────────────────────────── */

function ItinerarySection({ pkg, stepUp, onSaved }) {
  const [legs, setLegs] = useState(() =>
    (pkg.stayLegs ?? []).map((l) => ({
      cityName: l.cityName ?? "",
      nights: l.nights ?? 1,
      note: l.note ?? "",
      travelFrom: l.travelFrom ?? "",
      distanceKm: l.distanceKm ?? "",
      // Split for entry, recombined on save. Nobody thinks in "135 minutes", and a single-minute
      // field is where the typos come from.
      travelHours: l.travelMinutes ? Math.floor(l.travelMinutes / 60) : "",
      travelMins: l.travelMinutes ? l.travelMinutes % 60 : "",
      travelMode: l.travelMode ?? "",
      travelNote: l.travelNote ?? "",
    })));
  const [days, setDays] = useState(() =>
    (pkg.itinerary ?? []).map((d) => ({
      title: d.title ?? "", description: d.description ?? "",
      overnightCityName: d.overnightCityName ?? "", meals: d.meals ?? "",
      dayType: d.dayType ?? "",
      sightseeing: (d.sightseeing ?? []).join(", "),
      images: (d.images ?? []).map((i) => ({ imageUrl: i.imageUrl, caption: i.caption ?? "" })),
    })));
  const [inclusions, setInclusions] = useState(() => (pkg.inclusions ?? []).join("\n"));
  const [exclusions, setExclusions] = useState(() => (pkg.exclusions ?? []).join("\n"));

  const legNights = legs.reduce((sum, l) => sum + (Number(l.nights) || 0), 0);
  const mismatch = pkg.nights !== null && pkg.nights !== undefined && legs.length > 0 && legNights !== pkg.nights;

  const save = () => stepUp.request({
    title: "Save the itinerary?",
    description: "Replaces the stay plan, the day plan and both lists. It bumps the catalog version.",
    confirmLabel: "Save itinerary",
    run: async (code) => {
      await platformPackageService.saveItinerary(pkg.publicId, {
        stayLegs: legs.filter((l) => l.cityName.trim())
          .map((l) => ({
            cityName: l.cityName.trim(),
            nights: Number(l.nights) || 1,
            note: l.note?.trim() || null,
            // Blank means "from the previous stop", which the server understands — freezing the
            // previous city here would leave a journey pointing at the wrong place after a reorder.
            travelFrom: l.travelFrom?.trim() || null,
            distanceKm: numOrNull(l.distanceKm),
            travelMinutes: minutesOf(l.travelHours, l.travelMins),
            travelMode: l.travelMode || null,
            travelNote: l.travelNote?.trim() || null,
          })),
        days: days.filter((d) => d.title.trim()).map((d) => ({
          title: d.title.trim(),
          description: d.description?.trim() || null,
          overnightCityName: d.overnightCityName?.trim() || null,
          meals: d.meals?.trim() || null,
          dayType: d.dayType || null,
          sightseeing: d.sightseeing ? d.sightseeing.split(",").map((s) => s.trim()).filter(Boolean) : [],
          images: (d.images ?? [])
            .filter((i) => i.imageUrl)
            .map((i) => ({ imageUrl: i.imageUrl, caption: i.caption?.trim() || null })),
        })),
        inclusions: inclusions.split("\n").map((s) => s.trim()).filter(Boolean),
        exclusions: exclusions.split("\n").map((s) => s.trim()).filter(Boolean),
      }, code);
      onSaved();
    },
  });

  return (
    <div className="space-y-4">
      <SectionCard
        title="Stay plan"
        subtitle={`${legNights} night${legNights === 1 ? "" : "s"} across ${legs.length} stop${legs.length === 1 ? "" : "s"} — this is the route line buyers see.`}
      >
        {mismatch ? (
          <p className="mb-3 text-sm text-hue-amber">
            These stops add up to {legNights} nights but the package says {pkg.nights}. Publishing is
            blocked until they agree.
          </p>
        ) : null}

        <div className="space-y-2">
          {legs.map((leg, i) => {
            const patchLeg = (changes) => setLegs((p) => p.map((l, x) => (x === i ? { ...l, ...changes } : l)));

            return (
              <div key={i} className="rounded-xl border border-border p-2.5">
                <div className="flex items-center gap-2">
                  <Input
                    className="flex-1"
                    value={leg.cityName}
                    placeholder="City"
                    onChange={(e) => patchLeg({ cityName: e.target.value })}
                  />
                  <Input
                    className="w-24"
                    type="number"
                    min={1}
                    value={leg.nights}
                    onChange={(e) => patchLeg({ nights: e.target.value })}
                    aria-label="Nights"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLegs((p) => p.filter((_, x) => x !== i))}
                    aria-label="Remove this stop"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                </div>

                {/*
                  How the traveller gets HERE. Always shown, never behind a disclosure: it is the
                  question a customer asks back more than any other, and it flows straight onto the
                  quotation as a transfer line. A field nobody opens is a field nobody fills.
                */}
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <Input
                    value={leg.travelFrom}
                    placeholder={i === 0 ? "Travelling from (start point)" : `From — blank means ${legs[i - 1]?.cityName || "previous stop"}`}
                    onChange={(e) => patchLeg({ travelFrom: e.target.value })}
                    aria-label="Travelling from"
                  />
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number" min={0} value={leg.distanceKm} placeholder="Distance"
                      onChange={(e) => patchLeg({ distanceKm: e.target.value })}
                      aria-label="Distance in km"
                    />
                    <span className="shrink-0 text-xs text-muted">km</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number" min={0} value={leg.travelHours} placeholder="0"
                      onChange={(e) => patchLeg({ travelHours: e.target.value })}
                      aria-label="Travel hours"
                    />
                    <span className="shrink-0 text-xs text-muted">h</span>
                    <Input
                      type="number" min={0} max={59} value={leg.travelMins} placeholder="00"
                      onChange={(e) => patchLeg({ travelMins: e.target.value })}
                      aria-label="Travel minutes"
                    />
                    <span className="shrink-0 text-xs text-muted">m</span>
                  </div>
                  <Select
                    value={leg.travelMode}
                    onChange={(e) => patchLeg({ travelMode: e.target.value })}
                    aria-label="Travel mode"
                  >
                    <option value="">How — mode</option>
                    {TRAVEL_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </Select>
                  <Input
                    className="sm:col-span-2"
                    value={leg.travelNote}
                    placeholder="Journey note — e.g. Government ferry, seats not guaranteed"
                    onChange={(e) => patchLeg({ travelNote: e.target.value })}
                    aria-label="Journey note"
                  />
                  <Input
                    className="sm:col-span-2"
                    value={leg.note}
                    placeholder="Note about the stay here"
                    onChange={(e) => patchLeg({ note: e.target.value })}
                    aria-label="Stop note"
                  />
                </div>
              </div>
            );
          })}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => setLegs((p) => [...p, {
            cityName: "", nights: 1, note: "",
            travelFrom: "", distanceKm: "", travelHours: "", travelMins: "", travelMode: "", travelNote: "",
          }])}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add a stop
        </Button>
      </SectionCard>

      <SectionCard title="Day-wise plan" subtitle="Days are numbered from this order.">
        <div className="space-y-3">
          {days.map((day, i) => (
            <div key={i} className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-muted">Day {i + 1}</span>
                <Input
                  value={day.title}
                  placeholder="Title"
                  onChange={(e) => setDays((p) => p.map((d, x) => (x === i ? { ...d, title: e.target.value } : d)))}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDays((p) => p.filter((_, x) => x !== i))}
                  aria-label={`Remove day ${i + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
              <Textarea
                className="mt-2"
                rows={2}
                value={day.description}
                placeholder="What happens on this day"
                onChange={(e) => setDays((p) => p.map((d, x) => (x === i ? { ...d, description: e.target.value } : d)))}
              />
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <Select
                  value={day.dayType}
                  onChange={(e) => setDays((p) => p.map((d, x) => (x === i ? { ...d, dayType: e.target.value } : d)))}
                  aria-label={`Day ${i + 1} type`}
                >
                  {DAY_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
                <Input
                  value={day.overnightCityName}
                  placeholder="Overnight city"
                  onChange={(e) => setDays((p) => p.map((d, x) => (x === i ? { ...d, overnightCityName: e.target.value } : d)))}
                />
                <Input
                  value={day.meals}
                  placeholder="Meals (B, B+D…)"
                  onChange={(e) => setDays((p) => p.map((d, x) => (x === i ? { ...d, meals: e.target.value } : d)))}
                />
              </div>
              <Input
                className="mt-2"
                value={day.sightseeing}
                placeholder="Sightseeing, comma separated"
                onChange={(e) => setDays((p) => p.map((d, x) => (x === i ? { ...d, sightseeing: e.target.value } : d)))}
              />
              <DayPhotoStrip
                dayNumber={i + 1}
                images={day.images}
                onChange={(images) => setDays((p) => p.map((d, x) => (x === i ? { ...d, images } : d)))}
              />
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => setDays((p) => [...p, { title: "", description: "", overnightCityName: "", meals: "", dayType: "", sightseeing: "" }])}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add a day
        </Button>
      </SectionCard>

      <SectionCard title="Inclusions and exclusions" subtitle="One per line. Empty means “not stated”, not “nothing”.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="pk-inc">Inclusions</Label>
            <Textarea id="pk-inc" rows={5} value={inclusions} onChange={(e) => setInclusions(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="pk-exc">Exclusions</Label>
            <Textarea id="pk-exc" rows={5} value={exclusions} onChange={(e) => setExclusions(e.target.value)} />
          </div>
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <Button onClick={save}>Save itinerary</Button>
      </div>
    </div>
  );
}

/* ── Rates ───────────────────────────────────────────────────────────────── */

const BLANK_SLAB = { publicId: undefined, paxFrom: 1, paxTo: "", occupancy: "DOUBLE", perPaxPrice: "", supplierPerPaxCost: "", label: "" };

/**
 * The whole rate table, saved in one call.
 *
 * This is the only screen in the product that shows `supplierPerPaxCost` — what the platform pays.
 * It exists nowhere in any tenant DTO, and the margin beside it is derived server-side and never
 * stored.
 */
/**
 * A day's photographs.
 *
 * <p>Uploaded through the console's own proxy and held in the itinerary form's state until the
 * itinerary is saved — a photo that attached itself on pick would belong to a day the operator may
 * still abandon, and the abandoned ones would be orphans nothing cleans up.</p>
 */
function DayPhotoStrip({ dayNumber, images, onChange }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    setProblem("");
    try {
      // Returns the URL STRING. Do not destructure — TabPhotos.jsx destructures the twin of this
      // and posts `imageUrl: undefined` as a result.
      const url = await platformPackageService.uploadImage(file);
      if (!url) throw new Error("Upload did not return an image path");
      onChange([...(images ?? []), { imageUrl: url, caption: "" }]);
    } catch (e) {
      setProblem(errMsg(e, "Could not upload that photo."));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const list = images ?? [];

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted">
          Day {dayNumber} photos {list.length ? `· ${list.length}` : ""}
        </span>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
        <Button variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
          <Upload className="h-3.5 w-3.5" aria-hidden />
          {busy ? "Uploading…" : "Add photo"}
        </Button>
      </div>

      {problem ? <p className="mt-1 text-xs text-hue-rose">{problem}</p> : null}

      {list.length ? (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((img, x) => (
            <div key={x} className="overflow-hidden rounded-lg border border-border">
              <img src={img.imageUrl} alt={img.caption || `Day ${dayNumber}`} loading="lazy"
                className="aspect-[4/3] w-full object-cover" />
              <div className="flex items-center gap-1 p-1.5">
                <Input
                  value={img.caption}
                  placeholder="Caption"
                  onChange={(e) => onChange(list.map((m, y) => (y === x ? { ...m, caption: e.target.value } : m)))}
                  aria-label={`Day ${dayNumber} photo ${x + 1} caption`}
                />
                <Button variant="outline" size="sm" onClick={() => onChange(list.filter((_, y) => y !== x))}
                  aria-label={`Remove day ${dayNumber} photo ${x + 1}`}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ── Tiers ───────────────────────────────────────────────────────────────── */

/**
 * The package's sellable levels — Basic / Deluxe / Super Deluxe.
 *
 * <p>The console could <b>display</b> tiers and never author them: the endpoint shipped with the
 * feature and nothing here called it, so every tiered package in the catalog had been written by
 * the seeder. This closes that.</p>
 *
 * <p>Hotel rows are generated from the stay plan and the city is fixed text, not an input — the
 * server matches tier hotels to stops BY NAME, so letting an operator retype four city names per
 * tier is three chances to break the match silently.</p>
 */
function TiersSection({ pkg, stepUp, onSaved }) {
  const legs = pkg.stayLegs ?? [];
  const [tiers, setTiers] = useState(() => toTiers(pkg.variants, legs));

  const patchTier = (ti, changes) =>
    setTiers((p) => p.map((t, x) => (x === ti ? { ...t, ...changes } : t)));

  const patchHotel = (ti, hi, changes) =>
    setTiers((p) => p.map((t, x) => (x === ti ? {
      ...t,
      hotels: t.hotels.map((h, y) => (y === hi ? { ...h, ...changes } : h)),
    } : t)));

  const save = () => stepUp.request({
    title: "Save the tiers?",
    description: "Replaces every tier and its rates. A tier that is absent is deactivated, not deleted.",
    confirmLabel: "Save tiers",
    run: async (code) => {
      await platformPackageService.saveVariants(pkg.publicId, tiers.map((t) => ({
        publicId: t.publicId,
        name: t.name.trim(),
        category: t.category || null,
        vehicleName: t.vehicleName?.trim() || null,
        vehicleNote: t.vehicleNote?.trim() || null,
        vehiclePerPaxPrice: numOrNull(t.vehiclePerPaxPrice),
        highlight: t.highlight?.trim() || null,
        active: true,
        hotels: t.hotels.map((h) => ({
          cityName: h.cityName,
          hotelName: h.hotelName?.trim() || null,
          roomType: h.roomType?.trim() || null,
          mealPlan: h.mealPlan?.trim() || null,
          hotelStars: numOrNull(h.hotelStars),
          perPaxPerNight: numOrNull(h.perPaxPerNight),
          // Sliced rather than trusted: the UI stops at the cap, but a package saved before the
          // cap existed would otherwise fail the whole save on validation.
          images: (h.images ?? []).filter((i) => i.imageUrl).slice(0, MAX_HOTEL_PHOTOS)
            .map((i) => ({ imageUrl: i.imageUrl, caption: i.caption?.trim() || null })),
          roomImages: (h.roomImages ?? []).filter((i) => i.imageUrl).slice(0, MAX_HOTEL_PHOTOS)
            .map((i) => ({ imageUrl: i.imageUrl, caption: i.caption?.trim() || null })),
        })),
        priceSlabs: t.slabs
          .filter((s) => s.perPaxPrice !== "")
          .map((s) => ({
            paxFrom: Number(s.paxFrom) || 1,
            paxTo: s.paxTo === "" ? null : Number(s.paxTo),
            occupancy: s.occupancy,
            perPaxPrice: Number(s.perPaxPrice),
            label: s.label?.trim() || null,
            active: true,
          })),
      })), code);
      onSaved();
    },
  });

  if (legs.length === 0) {
    return (
      <SectionCard title="Tiers" subtitle="Add the stay plan first — a tier's hotels hang off its stops.">
        <p className="text-sm text-muted">
          A tier says where you sleep at each stop. Until the itinerary has stops there is nothing
          for one to describe.
        </p>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      {tiers.map((tier, ti) => (
        <SectionCard
          key={ti}
          title={tier.name || `Tier ${ti + 1}`}
          subtitle="Same itinerary, different hotels and vehicle."
          right={
            <Button variant="outline" size="sm" onClick={() => setTiers((p) => p.filter((_, x) => x !== ti))}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Remove
            </Button>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label required>Name</Label>
              <Input value={tier.name} placeholder="Deluxe"
                onChange={(e) => patchTier(ti, { name: e.target.value })} />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={tier.category} onChange={(e) => patchTier(ti, { category: e.target.value })}>
                <option value="">—</option>
                {Object.entries(PACKAGE_CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </div>
            <div>
              <Label>Vehicle</Label>
              <Input value={tier.vehicleName} placeholder="Toyota Innova Crysta"
                onChange={(e) => patchTier(ti, { vehicleName: e.target.value })} />
            </div>
            <div>
              <Label>Vehicle rate / pax</Label>
              <Input type="number" min={0} value={tier.vehiclePerPaxPrice}
                onChange={(e) => patchTier(ti, { vehiclePerPaxPrice: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Vehicle note</Label>
              <Input value={tier.vehicleNote} placeholder="AC MPV, up to 6 passengers"
                onChange={(e) => patchTier(ti, { vehicleNote: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Highlight</Label>
              <Input value={tier.highlight} placeholder="4-star beachside stays and premium ferry seats"
                onChange={(e) => patchTier(ti, { highlight: e.target.value })} />
            </div>
          </div>

          <p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted">Hotels</p>
          <div className="mt-2 space-y-2">
            {tier.hotels.map((h, hi) => (
              <div key={hi} className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-12 sm:items-center">
                <div className="min-w-0 sm:col-span-2">
                  <div className="truncate text-sm font-bold text-heading">{h.cityName}</div>
                  <div className="text-[11px] text-muted">{h.nights}N</div>
                </div>
                <Input className="sm:col-span-3" value={h.hotelName} placeholder="Hotel"
                  onChange={(e) => patchHotel(ti, hi, { hotelName: e.target.value })} aria-label={`${h.cityName} hotel`} />
                <Input className="sm:col-span-3" value={h.roomType} placeholder="Room type"
                  onChange={(e) => patchHotel(ti, hi, { roomType: e.target.value })} aria-label={`${h.cityName} room type`} />
                <Input className="sm:col-span-2" value={h.mealPlan} placeholder="Meals"
                  onChange={(e) => patchHotel(ti, hi, { mealPlan: e.target.value })} aria-label={`${h.cityName} meal plan`} />
                <Input className="sm:col-span-1" type="number" min={1} max={5} value={h.hotelStars} placeholder="★"
                  onChange={(e) => patchHotel(ti, hi, { hotelStars: e.target.value })} aria-label={`${h.cityName} stars`} />
                <Input className="sm:col-span-1" type="number" min={0} value={h.perPaxPerNight} placeholder="₹/nt"
                  onChange={(e) => patchHotel(ti, hi, { perPaxPerNight: e.target.value })} aria-label={`${h.cityName} per pax per night`} />

                {/*
                  The two galleries, side by side. Separate because the server keeps them separate
                  with a scope column, and it keeps them separate for a reason the hotel module
                  states plainly: a lobby photograph may never stand in for a room.
                */}
                <div className="grid gap-2 sm:col-span-12 sm:grid-cols-2">
                  <TierPhotos
                    label="Hotel photos"
                    photos={h.images}
                    onChange={(next) => patchHotel(ti, hi, { images: next })}
                    scopeLabel={`${h.cityName} hotel`}
                  />
                  <TierPhotos
                    label="Room photos"
                    photos={h.roomImages}
                    onChange={(next) => patchHotel(ti, hi, { roomImages: next })}
                    scopeLabel={`${h.cityName} room`}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted">This tier&rsquo;s rates</p>
          <div className="mt-2 space-y-2">
            {tier.slabs.map((s, si) => (
              <div key={si} className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-12 sm:items-center">
                <Input className="sm:col-span-2" type="number" min={1} value={s.paxFrom} placeholder="From pax"
                  onChange={(e) => patchTier(ti, { slabs: tier.slabs.map((x, y) => (y === si ? { ...x, paxFrom: e.target.value } : x)) })} />
                <Input className="sm:col-span-2" type="number" min={1} value={s.paxTo} placeholder="To pax"
                  onChange={(e) => patchTier(ti, { slabs: tier.slabs.map((x, y) => (y === si ? { ...x, paxTo: e.target.value } : x)) })} />
                <Select className="sm:col-span-3" value={s.occupancy}
                  onChange={(e) => patchTier(ti, { slabs: tier.slabs.map((x, y) => (y === si ? { ...x, occupancy: e.target.value } : x)) })}>
                  {OCCUPANCY.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
                </Select>
                <Input className="sm:col-span-2" type="number" min={0} value={s.perPaxPrice} placeholder="₹ / pax"
                  onChange={(e) => patchTier(ti, { slabs: tier.slabs.map((x, y) => (y === si ? { ...x, perPaxPrice: e.target.value } : x)) })} />
                <Input className="sm:col-span-2" value={s.label} placeholder="Label"
                  onChange={(e) => patchTier(ti, { slabs: tier.slabs.map((x, y) => (y === si ? { ...x, label: e.target.value } : x)) })} />
                <Button variant="outline" size="sm" className="sm:col-span-1"
                  onClick={() => patchTier(ti, { slabs: tier.slabs.filter((_, y) => y !== si) })}
                  aria-label="Remove this rate">
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" className="mt-2"
            onClick={() => patchTier(ti, { slabs: [...tier.slabs, blankTierSlab()] })}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add a rate
          </Button>
        </SectionCard>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" onClick={() => setTiers((p) => [...p, blankTier(legs)])}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add a tier
        </Button>
        <Button onClick={save}>Save tiers</Button>
      </div>
    </div>
  );
}

/**
 * How many photographs one hotel — or one room — may carry on a tier.
 *
 * <p>Mirrors {@code PackageVariantsRequest.MAX_HOTEL_PHOTOS} on the server, and the tenant editor's
 * copy of the same number. The server is still the gate; this is here so an operator never uploads
 * a sixth photo and only then learns it was refused.</p>
 */
const MAX_HOTEL_PHOTOS = 5;

/** Server photo → editable row. Caption is always a string so the input stays controlled. */
const toPhotoRow = (i) => ({ imageUrl: i.imageUrl, caption: i.caption ?? "" });

/**
 * One scope's photographs for one hotel on one tier.
 *
 * <p>Held in the form's state and saved with the tiers, not posted on pick: a photo that attached
 * itself would belong to a tier the operator may still abandon.</p>
 *
 * <p>At the cap the Add control disables rather than disappearing, and says why — a control that
 * vanishes reads as a bug.</p>
 */
function TierPhotos({ label, photos, onChange, scopeLabel }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  const list = photos ?? [];
  const full = list.length >= MAX_HOTEL_PHOTOS;

  const upload = async (file) => {
    if (!file || full) return;
    setBusy(true);
    setProblem("");
    try {
      // Returns the URL STRING — do not destructure. See platformPackageService.uploadImage.
      const url = await platformPackageService.uploadImage(file);
      if (!url) throw new Error("Upload did not return an image path");
      onChange([...list, { imageUrl: url, caption: "" }]);
    } catch (e) {
      setProblem(errMsg(e, "Could not upload that photo."));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted">
          {label} <span className="font-medium normal-case">{list.length}/{MAX_HOTEL_PHOTOS}</span>
        </span>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
        <Button
          variant="outline"
          size="sm"
          disabled={busy || full}
          title={full ? `At most ${MAX_HOTEL_PHOTOS} photos here` : undefined}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" aria-hidden />
          {busy ? "Uploading…" : "Add"}
        </Button>
      </div>

      {problem ? <p className="mt-1 text-xs text-hue-rose">{problem}</p> : null}

      {list.length ? (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {list.map((img, x) => (
            <div key={x} className="overflow-hidden rounded-md border border-border bg-surface">
              <img src={img.imageUrl} alt={img.caption || scopeLabel} loading="lazy"
                className="aspect-[4/3] w-full object-cover" />
              <div className="flex items-center gap-1 p-1">
                <Input
                  value={img.caption}
                  placeholder="Caption"
                  onChange={(e) => onChange(list.map((m, y) => (y === x ? { ...m, caption: e.target.value } : m)))}
                  aria-label={`${scopeLabel} photo ${x + 1} caption`}
                />
                <Button variant="outline" size="sm" onClick={() => onChange(list.filter((_, y) => y !== x))}
                  aria-label={`Remove ${scopeLabel} photo ${x + 1}`}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const blankTierSlab = () => ({ paxFrom: 2, paxTo: "", occupancy: "DOUBLE", perPaxPrice: "", label: "" });

/** A new tier, pre-filled with one hotel row per stop so the city names can never be mistyped. */
const blankTier = (legs) => ({
  publicId: undefined, name: "", category: "", vehicleName: "", vehicleNote: "",
  vehiclePerPaxPrice: "", highlight: "",
  hotels: legs.map((l) => ({
    cityName: l.cityName, nights: l.nights ?? 1,
    hotelName: "", roomType: "", mealPlan: "", hotelStars: "", perPaxPerNight: "",
    images: [], roomImages: [],
  })),
  slabs: [blankTierSlab()],
});

/**
 * Saved tiers → editable rows, with hotel rows aligned to the CURRENT stay plan.
 *
 * <p>A saved hotel whose city is no longer a stop is dropped rather than shown: on this side the
 * operator did not write it, and a row they cannot act on is noise. The tenant editor keeps orphans
 * because there the author renamed their own stop and wants their hotel back.</p>
 */
function toTiers(variants, legs) {
  return (variants ?? []).map((v) => {
    const byCity = new Map((v.hotels ?? []).map((h) => [(h.cityName ?? "").trim().toLowerCase(), h]));
    return {
      publicId: v.publicId,
      name: v.name ?? "",
      category: v.category ?? "",
      vehicleName: v.vehicleName ?? "",
      vehicleNote: v.vehicleNote ?? "",
      vehiclePerPaxPrice: v.vehiclePerPaxPrice ?? "",
      highlight: v.highlight ?? "",
      hotels: legs.map((l) => {
        const h = byCity.get((l.cityName ?? "").trim().toLowerCase());
        return {
          cityName: l.cityName,
          nights: l.nights ?? 1,
          hotelName: h?.hotelName ?? "",
          roomType: h?.roomType ?? "",
          mealPlan: h?.mealPlan ?? "",
          hotelStars: h?.hotelStars ?? "",
          perPaxPerNight: h?.perPaxPerNight ?? "",
          images: (h?.images ?? []).map(toPhotoRow),
          roomImages: (h?.roomImages ?? []).map(toPhotoRow),
        };
      }),
      slabs: (v.priceSlabs ?? []).map((s) => ({
        paxFrom: s.paxFrom ?? 1,
        paxTo: s.paxTo ?? "",
        occupancy: s.occupancy ?? "DOUBLE",
        perPaxPrice: s.perPaxPrice ?? "",
        label: s.label ?? "",
      })),
    };
  });
}

function RatesSection({ pkg, stepUp, onSaved }) {
  const [slabs, setSlabs] = useState(() => {
    const existing = (pkg.priceSlabs ?? []).map((s) => ({
      publicId: s.publicId,
      paxFrom: s.paxFrom ?? 1,
      paxTo: s.paxTo ?? "",
      occupancy: s.occupancy ?? "DOUBLE",
      perPaxPrice: s.perPaxPrice ?? "",
      supplierPerPaxCost: s.supplierPerPaxCost ?? "",
      label: s.label ?? "",
    }));
    return existing.length ? existing : [{ ...BLANK_SLAB }];
  });

  const patch = (i, key, value) => setSlabs((p) => p.map((s, x) => (x === i ? { ...s, [key]: value } : s)));

  const save = () => stepUp.request({
    title: "Save these rates?",
    description:
      "Replaces the whole price table. It does NOT bump the catalog version and does not re-open "
      + "review — every change is appended to the package's price history.",
    confirmLabel: "Save rates",
    run: async (code) => {
      await platformPackageService.savePriceSlabs(pkg.publicId, slabs.map((s) => ({
        publicId: s.publicId,
        paxFrom: Number(s.paxFrom) || 1,
        // "" means "and above" — null, not 0, which would match no party at all.
        paxTo: s.paxTo === "" ? null : Number(s.paxTo),
        occupancy: s.occupancy,
        perPaxPrice: Number(s.perPaxPrice),
        supplierPerPaxCost: s.supplierPerPaxCost === "" ? null : Number(s.supplierPerPaxCost),
        label: s.label?.trim() || null,
        active: true,
      })), code);
      onSaved();
    },
  });

  return (
    <SectionCard
      title="Rates"
      subtitle="Per pax, by group size and sharing basis. Supplier cost is console-only and never reaches a tenant."
    >
      <div className="space-y-2">
        {slabs.map((s, i) => (
          <div key={s.publicId ?? `new-${i}`} className="grid grid-cols-12 items-end gap-2">
            <div className="col-span-2">
              {i === 0 ? <Label>Pax from</Label> : null}
              <Input type="number" min={1} value={s.paxFrom} onChange={(e) => patch(i, "paxFrom", e.target.value)} />
            </div>
            <div className="col-span-2">
              {i === 0 ? <Label>Pax to</Label> : null}
              <Input type="number" min={1} placeholder="and above" value={s.paxTo} onChange={(e) => patch(i, "paxTo", e.target.value)} />
            </div>
            <div className="col-span-2">
              {i === 0 ? <Label>Sharing</Label> : null}
              <Select value={s.occupancy} onChange={(e) => patch(i, "occupancy", e.target.value)}>
                {OCCUPANCY.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
              </Select>
            </div>
            <div className="col-span-2">
              {i === 0 ? <Label required>Sell / pax</Label> : null}
              <Input type="number" min={0} value={s.perPaxPrice} onChange={(e) => patch(i, "perPaxPrice", e.target.value)} />
            </div>
            <div className="col-span-2">
              {i === 0 ? <Label>Cost / pax</Label> : null}
              <Input type="number" min={0} value={s.supplierPerPaxCost} onChange={(e) => patch(i, "supplierPerPaxCost", e.target.value)} />
            </div>
            <div className="col-span-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setSlabs((p) => p.filter((_, x) => x !== i))}
                aria-label="Remove this rate"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setSlabs((p) => [...p, { ...BLANK_SLAB }])}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add a rate
        </Button>
        <Button onClick={save}>Save rates</Button>
      </div>
    </SectionCard>
  );
}

/* ── Photos ──────────────────────────────────────────────────────────────── */

function PhotosSection({ pkg, stepUp, onChanged }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const images = pkg.images ?? [];

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      // uploadImage returns the URL STRING. Do not destructure `{imagePath}` off it — that is the
      // live bug in TabPhotos.jsx, which posts `imageUrl: undefined` as a result.
      const url = await platformPackageService.uploadImage(file);
      if (!url) throw new Error("Upload did not return an image path");

      // The upload is un-gated; the ATTACH is what changes the catalog, so that is what carries
      // the step-up.
      stepUp.request({
        title: "Add this photo?",
        description: "It becomes part of what every tenant sees on this package.",
        confirmLabel: "Add photo",
        run: async (code) => {
          await platformPackageService.addImage(pkg.publicId, { imageUrl: url }, code);
          onChanged();
        },
      });
    } catch (e) {
      setUploadError(errMsg(e, "Could not upload that photo."));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const makeCover = (img) => stepUp.request({
    title: "Make this the cover?",
    description: "It becomes the picture on every buyer's card for this package.",
    confirmLabel: "Set cover",
    run: async (code) => {
      await platformPackageService.setCoverImage(pkg.publicId, img.publicId, code);
      onChanged();
    },
  });

  /**
   * Move one photo one place.
   *
   * <p>Sends the WHOLE order, not a swap: the endpoint assigns positions from the list it is given,
   * and a partial list would leave every photo after the moved one unordered.</p>
   */
  const move = (index, delta) => {
    const next = [...images];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];

    stepUp.request({
      title: "Save the new photo order?",
      description: "The first photo is what buyers see first in the gallery.",
      confirmLabel: "Save order",
      run: async (code) => {
        await platformPackageService.reorderImages(pkg.publicId, next.map((i) => i.publicId), code);
        onChanged();
      },
    });
  };

  const remove = (img) => stepUp.request({
    title: "Remove this photo?",
    description: img.primary
      ? "It is the cover — the next photo becomes the cover automatically."
      : "It disappears from the package immediately.",
    confirmLabel: "Remove photo",
    run: async (code) => {
      await platformPackageService.deleteImage(pkg.publicId, img.publicId, code);
      onChanged();
    },
  });

  return (
    <SectionCard
      title="Photos"
      subtitle="The first photo becomes the cover. Nothing is stamped over an image except the category ribbon on the buyer's card."
      right={
        <div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
          <Button size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" aria-hidden />
            {uploading ? "Uploading…" : "Upload"}
          </Button>
        </div>
      }
    >
      {uploadError ? <p className="mb-3 text-sm text-hue-rose">{uploadError}</p> : null}

      {images.length === 0 ? (
        <p className="text-sm text-muted">No photos yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((img, i) => (
            <div key={img.publicId} className="overflow-hidden rounded-lg border border-border">
              <img
                src={img.imageUrl}
                alt={img.caption || "Package photo"}
                loading="lazy"
                className="aspect-[4/3] w-full object-cover"
              />
              <div className="flex items-center justify-between gap-1 p-2">
                {/*
                  The cover is the card. It used to be whatever went up first, with no way to
                  change it — on a catalog that is sold on its photographs.
                */}
                <button
                  type="button"
                  disabled={img.primary}
                  onClick={() => makeCover(img)}
                  className={`flex items-center gap-1 text-xs transition ${
                    img.primary ? "text-hue-amber" : "text-muted hover:text-heading"
                  }`}
                  title={img.primary ? "This is the cover" : "Make this the cover"}
                >
                  <Star className={`h-3.5 w-3.5 ${img.primary ? "fill-hue-amber text-hue-amber" : ""}`} aria-hidden />
                  {img.primary ? "Cover" : "Set cover"}
                </button>

                <div className="flex shrink-0 items-center gap-1">
                  {/*
                    Arrows, not drag-and-drop. The order is saved as a full list of ids, and a drag
                    library here would be a dependency and a touch-target problem for a control an
                    operator uses twice per package.
                  */}
                  <Button variant="outline" size="sm" disabled={i === 0} onClick={() => move(i, -1)}
                    aria-label="Move this photo earlier">
                    <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                  <Button variant="outline" size="sm" disabled={i === images.length - 1} onClick={() => move(i, 1)}
                    aria-label="Move this photo later">
                    <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => remove(img)} aria-label="Remove this photo">
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
