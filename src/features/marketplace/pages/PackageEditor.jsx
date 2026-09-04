// src/features/marketplace/pages/PackageEditor.jsx
//
// Build or edit one of the agency's own packages.
//
// Three things the first version got wrong and this one fixes:
//
//  1. AN AUTHOR COULD NOT SEE WHAT THEY WERE MAKING. A package is sold on a card, and the card was
//     only visible after saving and navigating away. The right rail now renders the real card
//     component — the same one the browse grid uses — live from the form.
//  2. PUBLISHING FAILED WITH A SURPRISE. The server refuses a package with no nights, no stay legs,
//     no rate, or legs that do not sum to the nights, and the only way to learn that was to press
//     the button. The rail now mirrors those four rules, ticked live, next to the two soft ones a
//     buyer cares about.
//  3. IT WAS ONE LONG COLUMN OF FIELDS. Four tabs, matching the four endpoints behind them, because
//     they are four separate saves on the server — pretending otherwise in the UI is how a screen
//     that renders one section ends up posting an empty version of another.
//
// Tab state lives in the URL so the view is shareable and Back works.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Plus, Trash2, Upload, Star, ArrowUp, ArrowDown, Check, AlertCircle, Info,
  FileText, Map as MapIcon, IndianRupee, Images, Send, Power, Undo2, Loader2, Layers,
} from "lucide-react";

import {
  Page, PageHeader, BackLink, Card, Button, Input, Textarea, Select, SectionLabel,
  Notice, Loading, Photo, useToast, errMsg, isAlreadyReported, useHotkeys, cn, FONT,
} from "../components/marketplaceUi";
import { PackageCard } from "../components/PackageCard";
import { PKG_PRIMARY, PKG_TAB_ON } from "../components/packageTheme";
import { PackageRateTable, toRateRows, toRatePayload, ratesAreValid } from "../components/PackageRateTable";
import { PackageTierEditor, toTierRows, toTierPayload, tiersAreValid } from "../components/PackageTierEditor";
import API from "@shared/api/http";
import {
  packageMarketplaceService, PACKAGE_CATEGORY, PACKAGE_REGION, packageStatus,
} from "../api/packageMarketplaceService";
import { packageReadiness, canPublish } from "../lib/packageReadiness";

const TABS = [
  { value: "details", label: "Details", Icon: FileText },
  { value: "itinerary", label: "Itinerary", Icon: MapIcon },
  { value: "tiers", label: "Tiers", Icon: Layers },
  { value: "rates", label: "Rates", Icon: IndianRupee },
  { value: "photos", label: "Photos", Icon: Images },
];

const INCLUSION_FIELDS = [
  ["includesHotel", "Hotel"],
  ["includesMeal", "Meals"],
  ["includesVehicle", "Vehicle"],
  ["includesSightseeing", "Sightseeing"],
  ["includesFlight", "Flight"],
];

const BLANK = {
  title: "", subtitle: "", region: "", countryCode: "IN", stateName: "", stateCode: "",
  category: "", nights: "", minPax: "", maxPax: "",
  includesHotel: true, includesMeal: false, includesVehicle: false,
  includesSightseeing: false, includesFlight: false,
  overview: "", terms: "", cancellationPolicy: "", validFrom: "", validTo: "",
  customisable: false, basePerPax: "",
};

export function PackageEditor() {
  const { publicId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [params, setParams] = useSearchParams();

  const isNew = !publicId;
  const tab = isNew ? "details" : (params.get("tab") ?? "details");

  const [pkg, setPkg] = useState(isNew ? {} : null);
  const [form, setForm] = useState(BLANK);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const load = useCallback(async () => {
    if (isNew) { setPkg({}); return; }
    try {
      const full = await packageMarketplaceService.getPackage(publicId);
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
        customisable: !!full.customisable, basePerPax: full.basePerPax ?? "",
      });
      setDirty(false);
      setLoadError(null);
    } catch (e) {
      setLoadError(errMsg(e, "This package is not available."));
    }
  }, [isNew, publicId]);

  useEffect(() => { load(); }, [load]);

  const patch = (key, value) => { setDirty(true); setForm((f) => ({ ...f, [key]: value })); };

  /**
   * What the card will look like, from the form as it stands.
   *
   * Merged over the saved package so the preview reflects unsaved typing while still showing the
   * photos and stay legs that only exist server-side. A preview that only updated on save would be
   * a screenshot, not a preview.
   */
  const preview = useMemo(() => ({
    ...(pkg ?? {}),
    title: form.title,
    category: form.category || null,
    nights: form.nights === "" ? null : Number(form.nights),
    includesHotel: form.includesHotel,
    includesMeal: form.includesMeal,
    includesVehicle: form.includesVehicle,
    includesSightseeing: form.includesSightseeing,
    includesFlight: form.includesFlight,
  }), [pkg, form]);

  const saveDetails = useCallback(async () => {
    if (!form.title.trim()) { showToast("A title is required", "error"); return; }
    setSaving(true);
    try {
      // Empty strings are sent as-is: the server normalises blank to null for the text columns, and
      // omitting a key would mean "leave alone" — which is not what an emptied field means.
      const payload = {
        ...form,
        nights: form.nights === "" ? null : Number(form.nights),
        minPax: form.minPax === "" ? null : Number(form.minPax),
        maxPax: form.maxPax === "" ? null : Number(form.maxPax),
        region: form.region || null,
        category: form.category || null,
        validFrom: form.validFrom || null,
        validTo: form.validTo || null,
        customisable: form.customisable,
        basePerPax: form.basePerPax === "" ? null : Number(form.basePerPax),
      };
      const saved = isNew
        ? await packageMarketplaceService.create(payload)
        : await packageMarketplaceService.update(publicId, payload);
      showToast("Saved", "success");
      setDirty(false);
      if (isNew) {
        // Land on the itinerary of the row that now exists, rather than back on an empty form.
        navigate(`/marketplace/packages/mine/${saved.publicId}?tab=itinerary`, { replace: true });
      } else {
        setPkg(saved);
      }
    } catch (e) {
      if (!isAlreadyReported(e)) showToast(errMsg(e, "Could not save"), "error");
    } finally {
      setSaving(false);
    }
  }, [form, isNew, navigate, publicId, showToast]);

  useHotkeys({
    "mod+Enter": () => { if (tab === "details") saveDetails(); },
  });

  if (loadError) {
    return (
      <Page width="max-w-none">
        <div style={FONT}>
          <BackLink onClick={() => navigate("/marketplace/packages/mine")}>Back</BackLink>
          <Card className="mt-4"><Notice tone="warn">{loadError}</Notice></Card>
        </div>
      </Page>
    );
  }
  if (!pkg) return <Page width="max-w-none"><div style={FONT}><Loading label="Loading…" /></div></Page>;

  return (
    <Page width="max-w-none">
      <div style={FONT}>
        <BackLink onClick={() => navigate("/marketplace/packages/mine")}>Back to my packages</BackLink>

        <PageHeader
          title={isNew ? "New package" : form.title || "Package"}
          subtitle={
            pkg.packageCode
              ? `Code ${pkg.packageCode}`
              : "A draft, private to your agency until you list it."
          }
        />

        {isNew ? (
          <Notice tone="info" className="mb-4">
            <Info className="mr-1 inline h-4 w-4 align-text-bottom" aria-hidden />
            Save the details first — the itinerary, rates and photos attach to a package that exists.
          </Notice>
        ) : (
          <div className="mb-5 flex items-center gap-1 overflow-x-auto border-b border-slate-200">
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setParams({ tab: t.value }, { replace: true })}
                className={cn(
                  "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition",
                  tab === t.value
                    ? PKG_TAB_ON
                    : "border-transparent text-slate-500 hover:text-slate-900",
                )}
              >
                <t.Icon className="h-4 w-4" aria-hidden />
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Form left, live rail right. The rail is where an author checks their work, so it stays
            on screen while they scroll the form. */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0">
            {isNew || tab === "details" ? (
              <DetailsForm form={form} patch={patch} onSave={saveDetails} saving={saving} dirty={dirty} isNew={isNew} />
            ) : tab === "itinerary" ? (
              <ItineraryForm pkg={pkg} onSaved={load} />
            ) : tab === "tiers" ? (
              <TiersForm pkg={pkg} onSaved={load} />
            ) : tab === "rates" ? (
              <RatesForm pkg={pkg} onSaved={load} />
            ) : (
              <PhotosForm pkg={pkg} onChanged={load} />
            )}
          </div>

          <aside className="min-w-0 xl:sticky xl:top-6 xl:self-start">
            <div className="space-y-4">
              <div>
                <SectionLabel>Preview</SectionLabel>
                <p className="mb-2 mt-0.5 text-xs text-slate-500">Exactly what a buyer sees.</p>
                <PackageCard pkg={preview} footer={<PreviewFooter pkg={preview} />} />
              </div>

              {!isNew ? <ReadinessPanel pkg={pkg} /> : null}
              {!isNew ? <LifecyclePanel pkg={pkg} onChanged={load} /> : null}
            </div>
          </aside>
        </div>
      </div>
    </Page>
  );
}

/* ── Rail ────────────────────────────────────────────────────────────────── */

function PreviewFooter({ pkg }) {
  const price = pkg.fromPricePerPax;
  return (
    <div className="text-xs text-slate-500">
      {price === null || price === undefined
        ? "On request — add a rate to show a price here"
        : `Starting from ₹${Number(price).toLocaleString("en-IN")} / pax`}
    </div>
  );
}

/**
 * The publish gate, ticked live.
 *
 * Blocking items are the four the server enforces; the two below the line are things a buyer
 * notices and the server does not. They are visually separated so nobody hunts for why Publish is
 * refused over a missing photo.
 */
function ReadinessPanel({ pkg }) {
  const checks = packageReadiness(pkg);
  const blocking = checks.filter((c) => c.blocking);
  const soft = checks.filter((c) => !c.blocking);
  const outstanding = blocking.filter((c) => !c.ok).length;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <SectionLabel>Ready to publish</SectionLabel>
        {outstanding === 0 ? (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-700">
            <Check className="h-3.5 w-3.5" aria-hidden />
            All set
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs font-medium text-amber-700">
            <AlertCircle className="h-3.5 w-3.5" aria-hidden />
            {outstanding} to go
          </span>
        )}
      </div>

      <ul className="mt-2 space-y-1.5">
        {blocking.map((c) => <CheckRow key={c.key} check={c} />)}
      </ul>

      <div className="mt-3 border-t border-slate-100 pt-3">
        <p className="mb-1.5 text-[11px] uppercase tracking-wide text-slate-400">Recommended</p>
        <ul className="space-y-1.5">
          {soft.map((c) => <CheckRow key={c.key} check={c} muted />)}
        </ul>
      </div>
    </Card>
  );
}

function CheckRow({ check, muted }) {
  return (
    <li className="flex items-start gap-2">
      <span
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
          check.ok ? "bg-emerald-100 text-emerald-700" : muted ? "bg-slate-100 text-slate-400" : "bg-amber-100 text-amber-700",
        )}
      >
        {check.ok ? <Check className="h-2.5 w-2.5" aria-hidden /> : <span className="h-1 w-1 rounded-full bg-current" />}
      </span>
      <span className="min-w-0">
        <span className={cn("text-xs font-medium", check.ok ? "text-slate-700" : "text-slate-900")}>
          {check.label}
        </span>
        {!check.ok ? <span className="block text-[11px] text-slate-500">{check.hint}</span> : null}
      </span>
    </li>
  );
}

/** Status and the one lifecycle action that makes sense from here. */
function LifecyclePanel({ pkg, onChanged }) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const status = packageStatus(pkg.status);
  const ready = canPublish(pkg);
  const listed = pkg.visibility === "MARKETPLACE";
  const inReview = pkg.status === "PENDING_REVIEW";
  const suspended = pkg.status === "SUSPENDED";

  const run = async (fn, message) => {
    setBusy(true);
    try {
      await fn();
      showToast(message, "success");
    } catch (e) {
      if (!isAlreadyReported(e)) showToast(errMsg(e, "That did not work"), "error");
    } finally {
      setBusy(false);
      onChanged();
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between">
        <SectionLabel>Status</SectionLabel>
        <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", status.cls)}>{status.label}</span>
      </div>

      {pkg.rejectionReason ? (
        <Notice tone="warn" className="mt-2">
          <strong>Declined:</strong> {pkg.rejectionReason}
        </Notice>
      ) : null}

      <div className="mt-3 space-y-2">
        {suspended ? (
          <p className="text-xs text-slate-500">
            Suspended by the platform. Rates can still be edited; contact support to lift it.
          </p>
        ) : (
          <>
            {pkg.status !== "ACTIVE" && !inReview ? (
              <Button
                className="w-full"
                loading={busy}
                disabled={!ready}
                onClick={() => run(() => packageMarketplaceService.activate(pkg.publicId), "Package activated")}
              >
                <Power className="h-4 w-4" aria-hidden />
                Activate for my agency
              </Button>
            ) : null}

            {pkg.status === "ACTIVE" && !listed ? (
              <Button
                className="w-full"
                onClick={() => run(() => packageMarketplaceService.deactivate(pkg.publicId), "Package paused")}
                loading={busy}
              >
                <Power className="h-4 w-4" aria-hidden />
                Pause
              </Button>
            ) : null}

            {listed ? (
              <Button
                className="w-full"
                loading={busy}
                onClick={() => run(() => packageMarketplaceService.unlist(pkg.publicId), "Removed from the marketplace")}
              >
                <Undo2 className="h-4 w-4" aria-hidden />
                {inReview ? "Withdraw from review" : "Unlist from marketplace"}
              </Button>
            ) : (
              <Button
                variant="primary"
                className="w-full"
                loading={busy}
                disabled={!ready}
                onClick={() => run(
                  () => packageMarketplaceService.listOnMarketplace(pkg.publicId),
                  "Sent for marketplace review",
                )}
              >
                <Send className="h-4 w-4" aria-hidden />
                List for sale
              </Button>
            )}

            {!ready ? (
              <p className="text-[11px] text-slate-500">
                Finish the checklist above first — the platform refuses an incomplete package.
              </p>
            ) : null}
          </>
        )}
      </div>
    </Card>
  );
}

/* ── Details ─────────────────────────────────────────────────────────────── */

function Field({ label, hint, children, className }) {
  return (
    <div className={cn("min-w-0", className)}>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      {children}
      {hint ? <p className="mt-1 text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  );
}

function DetailsForm({ form, patch, onSave, saving, dirty, isNew }) {
  return (
    <div className="space-y-4">
      <Card>
        <SectionLabel>What it is</SectionLabel>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Title" className="sm:col-span-2">
            <Input value={form.title} onChange={(e) => patch("title", e.target.value)} placeholder="Andaman and Nicobar Islands" />
          </Field>
          <Field label="Subtitle" className="sm:col-span-2" hint="One line under the title on the card.">
            <Input value={form.subtitle} onChange={(e) => patch("subtitle", e.target.value)} placeholder="Beaches, coral and the Cellular Jail" />
          </Field>
          <Field label="Category">
            <Select value={form.category} onChange={(e) => patch("category", e.target.value)}>
              <option value="">Not set</option>
              {Object.entries(PACKAGE_CATEGORY).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Nights" hint="Days show as nights + 1. Leave blank if undecided — never 0.">
            <Input type="number" min={0} value={form.nights} onChange={(e) => patch("nights", e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionLabel>Where it goes</SectionLabel>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Region">
            <Select value={form.region} onChange={(e) => patch("region", e.target.value)}>
              <option value="">Not set</option>
              {Object.entries(PACKAGE_REGION).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="State">
            <Input value={form.stateName} onChange={(e) => patch("stateName", e.target.value)} placeholder="Kerala" />
          </Field>
          <Field label="State code" hint="Two letters. Used in the package code.">
            <Input value={form.stateCode} maxLength={4} onChange={(e) => patch("stateCode", e.target.value.toUpperCase())} placeholder="KL" />
          </Field>
          <Field label="Country code">
            <Input value={form.countryCode} maxLength={3} onChange={(e) => patch("countryCode", e.target.value.toUpperCase())} placeholder="IN" />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionLabel>Who it suits</SectionLabel>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Group size" hint="Blank means no stated limit.">
            <div className="flex items-center gap-2">
              <Input type="number" min={1} value={form.minPax} onChange={(e) => patch("minPax", e.target.value)} placeholder="Min" aria-label="Minimum pax" />
              <span className="text-xs text-slate-400">to</span>
              <Input type="number" min={1} value={form.maxPax} onChange={(e) => patch("maxPax", e.target.value)} placeholder="Max" aria-label="Maximum pax" />
            </div>
          </Field>
          <Field label="Selling window" hint="Optional.">
            <div className="flex items-center gap-2">
              <Input type="date" value={form.validFrom} onChange={(e) => patch("validFrom", e.target.value)} aria-label="Valid from" />
              <span className="text-xs text-slate-400">to</span>
              <Input type="date" value={form.validTo} onChange={(e) => patch("validTo", e.target.value)} aria-label="Valid to" />
            </div>
          </Field>
          <Field label="Includes" className="sm:col-span-2" hint="These are the icons on the card, and what buyers filter on.">
            <div className="flex flex-wrap gap-2">
              {INCLUSION_FIELDS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => patch(key, !form[key])}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition",
                    form[key]
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 text-slate-600 hover:border-slate-300",
                  )}
                  aria-pressed={!!form[key]}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </Card>

      <Card>
        <SectionLabel>Let buyers mix</SectionLabel>
        <p className="mt-0.5 text-xs text-slate-500">
          With this on, a buyer can take the hotel from one tier and the vehicle from another and ask
          you for a price. Leave it off for a fixed departure where the coach is the coach.
        </p>
        <div className="mt-3 space-y-3">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={!!form.customisable}
              onChange={(e) => patch("customisable", e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
            />
            <span className="text-sm text-slate-700">
              Allow buyers to mix components across tiers
              <span className="block text-[11px] text-slate-400">
                Only useful once you have two or more tiers.
              </span>
            </span>
          </label>

          {form.customisable ? (
            <Field
              label="Fixed cost per person"
              hint="Guide, permits, sightseeing — the part that does not change with the tier. Used to estimate a mixed selection."
            >
              <Input
                type="number"
                min={0}
                value={form.basePerPax}
                onChange={(e) => patch("basePerPax", e.target.value)}
                placeholder="0"
              />
            </Field>
          ) : null}
        </div>
      </Card>

      <Card>
        <SectionLabel>The words</SectionLabel>
        <div className="mt-3 space-y-4">
          <Field label="Overview">
            <Textarea rows={4} value={form.overview} onChange={(e) => patch("overview", e.target.value)} />
          </Field>
          <Field label="Cancellation policy">
            <Textarea rows={3} value={form.cancellationPolicy} onChange={(e) => patch("cancellationPolicy", e.target.value)} />
          </Field>
          <Field label="Terms">
            <Textarea rows={3} value={form.terms} onChange={(e) => patch("terms", e.target.value)} />
          </Field>
        </div>
      </Card>

      {/* Sticky save bar. It says whether there is anything to save, so "did that go through?" is
          not a question the author has to hold in their head. */}
      <div className="sticky bottom-0 -mx-1 flex items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-1 py-3 backdrop-blur">
        <span className="text-xs text-slate-500">
          {saving ? (
            <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />Saving…</span>
          ) : dirty ? "Unsaved changes" : "All changes saved"}
        </span>
        <Button variant="primary" className={PKG_PRIMARY} loading={saving} onClick={onSave}>
          {isNew ? "Create package" : "Save details"}
        </Button>
      </div>
    </div>
  );
}

/* ── Itinerary ───────────────────────────────────────────────────────────── */

function ItineraryForm({ pkg, onSaved }) {
  const { showToast } = useToast();
  const [legs, setLegs] = useState(() =>
    (pkg.stayLegs ?? []).map((l) => ({
      cityName: l.cityName ?? "",
      nights: l.nights ?? 1,
      note: l.note ?? "",
      travelFrom: l.travelFrom ?? "",
      distanceKm: l.distanceKm ?? "",
      // Split for entry, recombined on save. Nobody types a journey as "135 minutes" — they think
      // in hours and minutes, and a single-minute field is where the typos come from.
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

  // Payment schedule and cancellation ladder (V34). Rules, not amounts: the rupee figure is worked
  // out per quote from the tier total, so one schedule stays true for every quote this package
  // produces. Strings in state so the inputs stay controlled; numbers on the way out.
  const [terms, setTerms] = useState(() =>
    (pkg.paymentTerms ?? []).map((t) => ({
      label: t.label ?? "", percent: t.percent ?? "",
      dueDaysBeforeTravel: t.dueDaysBeforeTravel ?? "", note: t.note ?? "",
    })));
  const [rules, setRules] = useState(() =>
    (pkg.cancellationRules ?? []).map((r) => ({
      daysBeforeTravel: r.daysBeforeTravel ?? "", refundPercent: r.refundPercent ?? "", note: r.note ?? "",
    })));
  const termsTotal = useMemo(() => terms.reduce((s, t) => s + (Number(t.percent) || 0), 0), [terms]);
  const [saving, setSaving] = useState(false);

  const legNights = useMemo(() => legs.reduce((s, l) => s + (Number(l.nights) || 0), 0), [legs]);
  const mismatch = pkg.nights !== null && pkg.nights !== undefined && legs.length > 0 && legNights !== pkg.nights;

  const move = (list, setList, i, delta) => {
    const j = i + delta;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    setList(next);
  };

  const save = async () => {
    setSaving(true);
    try {
      await packageMarketplaceService.saveItinerary(pkg.publicId, {
        stayLegs: legs.filter((l) => l.cityName.trim())
          .map((l) => ({
            cityName: l.cityName.trim(),
            nights: Number(l.nights) || 1,
            note: l.note?.trim() || null,
            // Blank means "from the previous stop", which the server already understands — sending
            // the previous city here instead would freeze it, and reordering the stops would then
            // leave a journey pointing at the wrong place.
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
        // A row without its number is an abandoned row, not a rule — dropped rather than posted
        // and rejected by validation for the whole save.
        paymentTerms: terms
          .filter((t) => t.percent !== "" && Number.isFinite(Number(t.percent)))
          .map((t) => ({
            label: t.label?.trim() || null,
            percent: Number(t.percent),
            dueDaysBeforeTravel: numOrNull(t.dueDaysBeforeTravel),
            note: t.note?.trim() || null,
          })),
        cancellationRules: rules
          .filter((r) => r.daysBeforeTravel !== "" && r.refundPercent !== "")
          .map((r) => ({
            daysBeforeTravel: Number(r.daysBeforeTravel),
            refundPercent: Number(r.refundPercent),
            note: r.note?.trim() || null,
          })),
      });
      showToast("Itinerary saved", "success");
      onSaved();
    } catch (e) {
      if (!isAlreadyReported(e)) showToast(errMsg(e, "Could not save the itinerary"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionLabel>Stay plan</SectionLabel>
          <span className={cn("text-xs", mismatch ? "text-amber-700" : "text-slate-500")}>
            {legNights} night{legNights === 1 ? "" : "s"} across {legs.length} stop{legs.length === 1 ? "" : "s"}
            {pkg.nights !== null && pkg.nights !== undefined ? ` · package says ${pkg.nights}` : ""}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          This is the route line on the card: {legs.filter((l) => l.cityName).map((l) => `${String(l.nights).padStart(2, "0")}N ${l.cityName}`).join("  |  ") || "—"}
        </p>

        {mismatch ? (
          <Notice tone="warn" className="mt-3">
            These stops add up to {legNights} nights but the package says {pkg.nights}. Publishing is
            blocked until they agree.
          </Notice>
        ) : null}

        <div className="mt-3 space-y-2">
          {legs.map((leg, i) => {
            const patchLeg = (changes) =>
              setLegs((p) => p.map((l, x) => (x === i ? { ...l, ...changes } : l)));

            return (
              <div key={i} className="rounded-lg border border-slate-200 p-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-center text-xs text-slate-400">{i + 1}</span>
                  <Input
                    className="min-w-0 flex-1"
                    value={leg.cityName}
                    placeholder="City"
                    onChange={(e) => patchLeg({ cityName: e.target.value })}
                    aria-label={`Stop ${i + 1} city`}
                  />
                  <Input
                    className="w-20 shrink-0"
                    type="number"
                    min={1}
                    value={leg.nights}
                    onChange={(e) => patchLeg({ nights: e.target.value })}
                    aria-label={`Stop ${i + 1} nights`}
                  />
                  <MoveButtons i={i} count={legs.length} onMove={(d) => move(legs, setLegs, i, d)} what={`stop ${i + 1}`} />
                  <IconBtn onClick={() => setLegs((p) => p.filter((_, x) => x !== i))} label={`Remove stop ${i + 1}`} danger>
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </IconBtn>
                </div>

                {/*
                  How the traveller gets HERE. Always shown, never behind a disclosure: this is the
                  question a customer asks back more than any other, and a field nobody opens is a
                  field nobody fills. It flows straight onto the quotation as a transfer line.
                */}
                <div className="mt-2 grid gap-2 pl-7 sm:grid-cols-2 lg:grid-cols-4">
                  <Input
                    value={leg.travelFrom}
                    placeholder={i === 0 ? "Travelling from (start point)" : `From — blank means ${legs[i - 1]?.cityName || "previous stop"}`}
                    onChange={(e) => patchLeg({ travelFrom: e.target.value })}
                    aria-label={`Stop ${i + 1} travelling from`}
                  />
                  <div className="flex items-center gap-1.5">
                    <Input
                      className="min-w-0 flex-1"
                      type="number"
                      min={0}
                      value={leg.distanceKm}
                      placeholder="Distance"
                      onChange={(e) => patchLeg({ distanceKm: e.target.value })}
                      aria-label={`Stop ${i + 1} distance in km`}
                    />
                    <span className="shrink-0 text-xs text-slate-400">km</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Input
                      className="min-w-0 flex-1"
                      type="number"
                      min={0}
                      value={leg.travelHours}
                      placeholder="0"
                      onChange={(e) => patchLeg({ travelHours: e.target.value })}
                      aria-label={`Stop ${i + 1} travel hours`}
                    />
                    <span className="shrink-0 text-xs text-slate-400">h</span>
                    <Input
                      className="min-w-0 flex-1"
                      type="number"
                      min={0}
                      max={59}
                      value={leg.travelMins}
                      placeholder="00"
                      onChange={(e) => patchLeg({ travelMins: e.target.value })}
                      aria-label={`Stop ${i + 1} travel minutes`}
                    />
                    <span className="shrink-0 text-xs text-slate-400">m</span>
                  </div>
                  <Select
                    value={leg.travelMode}
                    onChange={(e) => patchLeg({ travelMode: e.target.value })}
                    aria-label={`Stop ${i + 1} travel mode`}
                  >
                    <option value="">How — mode</option>
                    {TRAVEL_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </Select>
                  <Input
                    className="sm:col-span-2"
                    value={leg.travelNote}
                    placeholder="Journey note — e.g. Government ferry, seats not guaranteed"
                    onChange={(e) => patchLeg({ travelNote: e.target.value })}
                    aria-label={`Stop ${i + 1} journey note`}
                  />
                  <Input
                    className="sm:col-span-2"
                    value={leg.note}
                    placeholder="Note about the stay here"
                    onChange={(e) => patchLeg({ note: e.target.value })}
                    aria-label={`Stop ${i + 1} note`}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <Button className="mt-3" onClick={() => setLegs((p) => [...p, emptyLeg()])}>
          <Plus className="h-4 w-4" aria-hidden />
          Add a stop
        </Button>
      </Card>

      <Card>
        <SectionLabel>Day-wise plan</SectionLabel>
        <p className="mt-0.5 text-xs text-slate-500">Days are numbered from this order.</p>

        <div className="mt-3 space-y-3">
          {days.map((day, i) => (
            <div key={i} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center gap-2">
                <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  Day {i + 1}
                </span>
                <Input
                  className="min-w-0 flex-1"
                  value={day.title}
                  placeholder="What this day is called"
                  onChange={(e) => setDays((p) => p.map((d, x) => (x === i ? { ...d, title: e.target.value } : d)))}
                  aria-label={`Day ${i + 1} title`}
                />
                <MoveButtons i={i} count={days.length} onMove={(d) => move(days, setDays, i, d)} what={`day ${i + 1}`} />
                <IconBtn onClick={() => setDays((p) => p.filter((_, x) => x !== i))} label={`Remove day ${i + 1}`} danger>
                  <Trash2 className="h-4 w-4" aria-hidden />
                </IconBtn>
              </div>
              <Textarea
                className="mt-2"
                rows={2}
                value={day.description}
                placeholder="What happens on this day"
                onChange={(e) => setDays((p) => p.map((d, x) => (x === i ? { ...d, description: e.target.value } : d)))}
                aria-label={`Day ${i + 1} description`}
              />
              <div className="mt-2 grid gap-2 sm:grid-cols-4">
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
                  aria-label={`Day ${i + 1} overnight city`}
                />
                <Input
                  value={day.meals}
                  placeholder="Meals — B, B+D…"
                  onChange={(e) => setDays((p) => p.map((d, x) => (x === i ? { ...d, meals: e.target.value } : d)))}
                  aria-label={`Day ${i + 1} meals`}
                />
                <Input
                  value={day.sightseeing}
                  placeholder="Sightseeing, comma separated"
                  onChange={(e) => setDays((p) => p.map((d, x) => (x === i ? { ...d, sightseeing: e.target.value } : d)))}
                  aria-label={`Day ${i + 1} sightseeing`}
                />
              </div>

              <DayPhotoStrip
                dayNumber={i + 1}
                images={day.images}
                onChange={(images) => setDays((p) => p.map((d, x) => (x === i ? { ...d, images } : d)))}
              />
            </div>
          ))}
        </div>
        <Button
          className="mt-3"
          onClick={() => setDays((p) => [...p, emptyDay()])}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add a day
        </Button>
      </Card>

      <Card>
        <SectionLabel>Inclusions and exclusions</SectionLabel>
        <p className="mt-0.5 text-xs text-slate-500">
          One per line. Leaving a list empty means “not stated”, not “nothing”.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Inclusions">
            <Textarea rows={6} value={inclusions} onChange={(e) => setInclusions(e.target.value)} />
          </Field>
          <Field label="Exclusions">
            <Textarea rows={6} value={exclusions} onChange={(e) => setExclusions(e.target.value)} />
          </Field>
        </div>
      </Card>

      {/* Structured payment and cancellation terms. These are what let the customer's page print
          "Pay ₹19,900 by 12 Mar" and "Free cancellation till 10 Feb" instead of a paragraph of prose;
          the prose fields on the Details tab still carry the fine print a percentage cannot. */}
      <Card>
        <SectionLabel>Payment schedule</SectionLabel>
        <p className="mt-0.5 text-xs text-slate-500">
          Shares of the quote total and when each falls due. Leave “days before” blank for “at booking”.
          {terms.length ? (
            <span className={termsTotal === 100 ? " text-emerald-700" : " text-amber-700"}>
              {" "}Adds up to {termsTotal}%{termsTotal === 100 ? "." : " — should be 100%."}
            </span>
          ) : null}
        </p>
        <div className="mt-3 space-y-2">
          {terms.map((t, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-12">
              <Input className="sm:col-span-4" value={t.label} placeholder={`Instalment ${i + 1} — e.g. Booking deposit`}
                onChange={(e) => setTerms((p) => p.map((r, x) => (x === i ? { ...r, label: e.target.value } : r)))}
                aria-label={`Payment term ${i + 1} label`} />
              <Input type="number" className="sm:col-span-2" min={0.01} max={100} step="0.01" value={t.percent} placeholder="%"
                onChange={(e) => setTerms((p) => p.map((r, x) => (x === i ? { ...r, percent: e.target.value } : r)))}
                aria-label={`Payment term ${i + 1} percent`} />
              <Input type="number" className="sm:col-span-2" min={0} value={t.dueDaysBeforeTravel} placeholder="Days before"
                onChange={(e) => setTerms((p) => p.map((r, x) => (x === i ? { ...r, dueDaysBeforeTravel: e.target.value } : r)))}
                aria-label={`Payment term ${i + 1} days before travel`} />
              <Input className="sm:col-span-3" value={t.note} placeholder="Note"
                onChange={(e) => setTerms((p) => p.map((r, x) => (x === i ? { ...r, note: e.target.value } : r)))}
                aria-label={`Payment term ${i + 1} note`} />
              <div className="flex items-center justify-end sm:col-span-1">
                <IconBtn label="Remove payment term" onClick={() => setTerms((p) => p.filter((_, x) => x !== i))}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                </IconBtn>
              </div>
            </div>
          ))}
        </div>
        <Button variant="secondary" className="mt-3" onClick={() => setTerms((p) => [...p, { label: "", percent: "", dueDaysBeforeTravel: "", note: "" }])}>
          <Plus className="h-4 w-4" aria-hidden />
          Add a payment term
        </Button>

        <div className="my-5 border-t border-slate-200" />

        <SectionLabel>Cancellation ladder</SectionLabel>
        <p className="mt-0.5 text-xs text-slate-500">
          Refund due when the customer cancels at least this many days before departure. 100 = free
          cancellation, 0 = non-refundable from that point.
        </p>
        <div className="mt-3 space-y-2">
          {rules.map((r, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-12">
              <Input type="number" className="sm:col-span-3" min={0} value={r.daysBeforeTravel} placeholder="Days before travel"
                onChange={(e) => setRules((p) => p.map((q, x) => (x === i ? { ...q, daysBeforeTravel: e.target.value } : q)))}
                aria-label={`Cancellation rule ${i + 1} days before travel`} />
              <Input type="number" className="sm:col-span-3" min={0} max={100} value={r.refundPercent} placeholder="Refund %"
                onChange={(e) => setRules((p) => p.map((q, x) => (x === i ? { ...q, refundPercent: e.target.value } : q)))}
                aria-label={`Cancellation rule ${i + 1} refund percent`} />
              <Input className="sm:col-span-5" value={r.note} placeholder="Note"
                onChange={(e) => setRules((p) => p.map((q, x) => (x === i ? { ...q, note: e.target.value } : q)))}
                aria-label={`Cancellation rule ${i + 1} note`} />
              <div className="flex items-center justify-end sm:col-span-1">
                <IconBtn label="Remove cancellation rule" onClick={() => setRules((p) => p.filter((_, x) => x !== i))}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                </IconBtn>
              </div>
            </div>
          ))}
        </div>
        <Button variant="secondary" className="mt-3" onClick={() => setRules((p) => [...p, { daysBeforeTravel: "", refundPercent: "", note: "" }])}>
          <Plus className="h-4 w-4" aria-hidden />
          Add a cancellation rule
        </Button>
      </Card>

      <div className="sticky bottom-0 -mx-1 flex justify-end border-t border-slate-200 bg-white/95 px-1 py-3 backdrop-blur">
        <Button variant="primary" className={PKG_PRIMARY} loading={saving} onClick={save}>Save itinerary</Button>
      </div>
    </div>
  );
}

/** The route's travel modes, mirroring the server's PackageTravelMode. */
const TRAVEL_MODES = [
  { value: "ROAD", label: "By road" },
  { value: "FERRY", label: "By ferry" },
  { value: "FLIGHT", label: "By flight" },
  { value: "TRAIN", label: "By train" },
  { value: "CRUISE", label: "By cruise" },
  { value: "WALK", label: "On foot" },
];

const emptyLeg = () => ({
  cityName: "", nights: 1, note: "",
  travelFrom: "", distanceKm: "", travelHours: "", travelMins: "", travelMode: "", travelNote: "",
});

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

const emptyDay = () => ({
  title: "", description: "", overnightCityName: "", meals: "", dayType: "", sightseeing: "", images: [],
});

/** "" and a non-number both become null — an empty box must not post 0 km. */
function numOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Hours + minutes as one minute count, or null when neither was typed. */
function minutesOf(hours, mins) {
  const h = Number(hours) || 0;
  const m = Number(mins) || 0;
  const total = h * 60 + m;
  return total > 0 ? total : null;
}

/**
 * The day's photographs.
 *
 * <p>Uploaded through the same backend proxy as every other package photo, so the tenant's storage
 * quota is enforced and metered in one place — a browser-direct upload would bypass both.</p>
 *
 * <p>They live in the itinerary form's state and save with the itinerary rather than posting on
 * pick, which is deliberate: a day is a draft until the author saves it, and photos that attach
 * themselves to a half-written day survive an abandoned edit as orphans.</p>
 */
function DayPhotoStrip({ dayNumber, images, onChange }) {
  const { showToast } = useToast();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await API.post("/package-marketplace/my-packages/upload-image", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const imagePath = res?.data?.data?.imagePath;
      if (!imagePath) throw new Error("Upload did not return an image path");
      onChange([...(images ?? []), { imageUrl: imagePath, caption: "" }]);
    } catch (e) {
      if (!isAlreadyReported(e)) showToast(errMsg(e, "Could not upload the photo"), "error");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wide text-slate-400">
          Day {dayNumber} photos
        </span>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
        <Button loading={busy} onClick={() => fileRef.current?.click()}>
          <Upload className="h-3.5 w-3.5" aria-hidden />
          Add photo
        </Button>
      </div>

      {images?.length ? (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img, x) => (
            <div key={x} className="overflow-hidden rounded-md border border-slate-200">
              <Photo src={img.imageUrl} alt={img.caption || `Day ${dayNumber} photo`} className="aspect-[4/3] w-full" />
              <div className="flex items-center gap-1 p-1.5">
                <Input
                  className="min-w-0 flex-1"
                  value={img.caption}
                  placeholder="Caption"
                  onChange={(e) => onChange(images.map((m, y) => (y === x ? { ...m, caption: e.target.value } : m)))}
                  aria-label={`Day ${dayNumber} photo ${x + 1} caption`}
                />
                <IconBtn onClick={() => onChange(images.filter((_, y) => y !== x))} label={`Remove day ${dayNumber} photo ${x + 1}`} danger>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </IconBtn>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MoveButtons({ i, count, onMove, what }) {
  return (
    <div className="flex shrink-0 flex-col">
      <button
        type="button"
        onClick={() => onMove(-1)}
        disabled={i === 0}
        aria-label={`Move ${what} up`}
        title="Move up"
        className="rounded px-1 text-slate-400 transition hover:text-slate-900 disabled:opacity-30"
      >
        <ArrowUp className="h-3 w-3" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => onMove(1)}
        disabled={i === count - 1}
        aria-label={`Move ${what} down`}
        title="Move down"
        className="rounded px-1 text-slate-400 transition hover:text-slate-900 disabled:opacity-30"
      >
        <ArrowDown className="h-3 w-3" aria-hidden />
      </button>
    </div>
  );
}

function IconBtn({ onClick, label, danger, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "shrink-0 rounded-md border border-slate-200 p-2 text-slate-400 transition",
        danger ? "hover:border-rose-200 hover:text-rose-600" : "hover:border-slate-300 hover:text-slate-900",
      )}
    >
      {children}
    </button>
  );
}

/* ── Tiers ───────────────────────────────────────────────────────────────── */

/**
 * Basic / Deluxe / Super Deluxe — the same trip at several comfort levels.
 *
 * <p>Its own tab and its own save, because tiers carry their prices with them: a tier and its rates
 * are one decision, and the endpoint takes them together. The Rates tab stays for packages with no
 * tiers at all, and the two are mutually exclusive in practice — once a package has tiers, the
 * prices live on them.</p>
 */
function TiersForm({ pkg, onSaved }) {
  const { showToast } = useToast();
  const [tiers, setTiers] = useState(() => toTierRows(pkg.variants, pkg.stayLegs));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await packageMarketplaceService.saveVariants(pkg.publicId, toTierPayload(tiers));
      showToast("Tiers saved", "success");
      onSaved();
    } catch (e) {
      if (!isAlreadyReported(e)) showToast(errMsg(e, "Could not save the tiers"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <SectionLabel>Tiers</SectionLabel>
        <p className="mt-0.5 text-xs text-slate-500">
          One trip, several comfort levels. The itinerary, photos and inclusions are shared — only
          the hotels, rooms, vehicle and price change.
        </p>
        {pkg.customisable ? (
          <Notice tone="info" className="mt-3">
            Mixing is on for this package, so each hotel and vehicle also needs a rate. Buyers can
            combine across tiers and ask for a price, and those rates are what the estimate is built
            from.
          </Notice>
        ) : (
          <p className="mt-2 text-xs text-slate-400">
            Turn on “let buyers mix” in Details to also collect per-hotel and per-vehicle rates.
          </p>
        )}
      </Card>

      <PackageTierEditor
        tiers={tiers}
        onChange={setTiers}
        stayLegs={pkg.stayLegs}
        customisable={pkg.customisable}
        basePerPax={pkg.basePerPax}
      />

      {tiers.length > 0 ? (
        <div className="sticky bottom-0 -mx-1 flex justify-end border-t border-slate-200 bg-white/95 px-1 py-3 backdrop-blur">
          <Button variant="primary" loading={saving} disabled={!tiersAreValid(tiers)} onClick={save}>
            Save tiers
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/* ── Rates ───────────────────────────────────────────────────────────────── */

function RatesForm({ pkg, onSaved }) {
  const { showToast } = useToast();
  const [rows, setRows] = useState(() => toRateRows(pkg.priceSlabs));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await packageMarketplaceService.savePriceSlabs(pkg.publicId, toRatePayload(rows));
      showToast("Rates updated", "success");
      onSaved();
    } catch (e) {
      if (!isAlreadyReported(e)) showToast(errMsg(e, "Could not save the rates"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <SectionLabel>Rates</SectionLabel>
        <p className="mt-0.5 text-xs text-slate-500">
          Per person, by group size and sharing basis. The cheapest live rate is what the card shows.
        </p>
        <Notice tone="info" className="mt-3">
          Saving rates does not send this package back for review — an approved listing whose price
          moved is still the same listing.
        </Notice>
        <PackageRateTable className="mt-3" rows={rows} onChange={setRows} />
      </Card>

      <div className="sticky bottom-0 -mx-1 flex justify-end border-t border-slate-200 bg-white/95 px-1 py-3 backdrop-blur">
        <Button variant="primary" loading={saving} disabled={!ratesAreValid(rows)} onClick={save}>
          Save rates
        </Button>
      </div>
    </div>
  );
}

/* ── Photos ──────────────────────────────────────────────────────────────── */

function PhotosForm({ pkg, onChanged }) {
  const { showToast } = useToast();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const images = pkg.images ?? [];

  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await API.post("/package-marketplace/my-packages/upload-image", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      // The endpoint answers ApiResponse<{imagePath}> — read the field off the object, do not
      // destructure a string. (TabPhotos.jsx in the console gets this wrong and posts
      // `imageUrl: undefined`.)
      const imagePath = res?.data?.data?.imagePath;
      if (!imagePath) throw new Error("Upload did not return an image path");

      await packageMarketplaceService.addImage(pkg.publicId, { imageUrl: imagePath });
      showToast("Photo added", "success");
      onChanged();
    } catch (e) {
      if (!isAlreadyReported(e)) showToast(errMsg(e, "Could not upload the photo"), "error");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const act = async (fn, message) => {
    setBusy(true);
    try {
      await fn();
      if (message) showToast(message, "success");
    } catch (e) {
      if (!isAlreadyReported(e)) showToast(errMsg(e, "That did not work"), "error");
    } finally {
      setBusy(false);
      onChanged();
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <SectionLabel>Photos</SectionLabel>
          <p className="mt-0.5 text-xs text-slate-500">The first one becomes the cover.</p>
        </div>
        <div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
          <Button variant="primary" loading={busy} onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" aria-hidden />
            Upload
          </Button>
        </div>
      </div>

      {images.length === 0 ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="mt-4 flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 py-10 text-slate-400 transition hover:border-slate-400 hover:text-slate-600"
        >
          <Images className="h-6 w-6" aria-hidden />
          <span className="text-sm">No photos yet — a package without one is the one nobody clicks</span>
        </button>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {images.map((img) => (
            <div key={img.publicId} className="overflow-hidden rounded-lg border border-slate-200">
              <Photo src={img.imageUrl} alt={img.caption || "Package photo"} className="aspect-[4/3] w-full" />
              <div className="flex items-center justify-between gap-1 p-2">
                <button
                  type="button"
                  disabled={busy || img.primary}
                  onClick={() => act(
                    () => packageMarketplaceService.setCoverImage(pkg.publicId, img.publicId),
                    "Cover photo set",
                  )}
                  className={cn(
                    "flex items-center gap-1 text-xs transition",
                    img.primary ? "text-amber-600" : "text-slate-500 hover:text-slate-900",
                  )}
                  title={img.primary ? "This is the cover" : "Make this the cover"}
                  aria-label={img.primary ? "This is the cover photo" : "Make this the cover photo"}
                >
                  <Star className={cn("h-3.5 w-3.5", img.primary && "fill-amber-500 text-amber-500")} aria-hidden />
                  {img.primary ? "Cover" : "Set cover"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act(
                    () => packageMarketplaceService.deleteImage(pkg.publicId, img.publicId),
                    "Photo removed",
                  )}
                  className="text-slate-400 transition hover:text-rose-600"
                  title="Remove this photo"
                  aria-label="Remove this photo"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default PackageEditor;
