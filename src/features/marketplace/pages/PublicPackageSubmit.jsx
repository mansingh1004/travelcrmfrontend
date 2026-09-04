// src/features/marketplace/pages/PublicPackageSubmit.jsx
//
// The public package-submission link — anybody with the URL can build a package and hand it to the
// platform. No account, no invite, no login.
//
// Written for a stranger, which changes several things from the internal editor:
//
//  - IT SAVES ON EVERY STEP, not on a button somebody has to notice. A visitor with no account has
//    nothing invested and will close the tab; losing their work to a missed Save is how a public
//    form gets a reputation.
//  - THE LINK IS THE ACCOUNT. The token goes into the address bar the moment it is minted, and the
//    page says so plainly, because bookmarking it is the only way back in.
//  - IT NEVER MENTIONS A TENANT, an agency, a permission or a status enum. Those are our words.
//  - Rendered OUTSIDE the app Layout: no sidebar, no navbar, nothing that implies an account.

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Package as PackageIcon, Check, ChevronRight, ChevronLeft, Upload, Trash2, Plus,
  Send, PartyPopper, Clock, Loader2, AlertCircle, Star,
} from "lucide-react";

import {
  Button, Input, Textarea, Select, Notice, Loading, Photo, cn, FONT,
} from "../components/marketplaceUi";
import { PackageCard } from "../components/PackageCard";
import { PackageRateTable, toRateRows, toRatePayload, ratesAreValid } from "../components/PackageRateTable";
import { packageSubmissionClient } from "../api/packageSubmissionClient";
import { PACKAGE_CATEGORY, PACKAGE_REGION } from "../api/packageMarketplaceService";
import { packageReadiness } from "../lib/packageReadiness";

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

const STEPS = [
  { key: "about", label: "About you" },
  { key: "package", label: "The package" },
  { key: "itinerary", label: "Itinerary" },
  // Between the itinerary and the rates, because that is the order the decisions happen in: the
  // route first, then what each level puts you in along it, then what it all costs. Optional — a
  // package sold at one level skips it entirely.
  { key: "tiers", label: "Levels" },
  { key: "rates", label: "Rates" },
  { key: "photos", label: "Photos" },
  { key: "review", label: "Review" },
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

const OCCUPANCY = ["SINGLE", "DOUBLE", "TRIPLE", "QUAD", "CHILD_WITH_BED", "CHILD_NO_BED", "INFANT"];

/** Mirrors PackageVariantsRequest.MAX_HOTEL_PHOTOS. The server is the gate; this avoids a refusal. */
const MAX_HOTEL_PHOTOS = 5;

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

/* ══════════════════════════════════════════════════════════════════════════
   Entry — mints a link and puts the token in the address bar
   ══════════════════════════════════════════════════════════════════════════ */

export function PublicPackageSubmitStart() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const begin = async () => {
    setBusy(true);
    setError("");
    try {
      const token = await packageSubmissionClient.start();
      if (!token) throw new Error("The server did not return a link.");
      // replace, not push: Back from here should leave the site, not mint a second draft.
      navigate(`/submit-package/${token}`, { replace: true });
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Shell>
      <div className="mx-auto max-w-lg py-16 text-center">
        <span className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900">
          <PackageIcon className="h-6 w-6 text-white" aria-hidden />
        </span>
        <h1 className="text-2xl font-semibold text-slate-900">Submit a tour package</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Fill in your itinerary, your rates and a few photos. Our team reviews every submission
          before it goes live, and we will email you either way. It takes about ten minutes and you
          do not need an account.
        </p>

        {error ? <Notice tone="error" className="mt-5 text-left">{error}</Notice> : null}

        <Button variant="primary" className="mt-6" loading={busy} onClick={begin}>
          Start
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>

        <p className="mt-4 text-xs text-slate-400">
          You will get a private link — keep it to come back and finish later.
        </p>
      </div>
    </Shell>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   The form
   ══════════════════════════════════════════════════════════════════════════ */

export function PublicPackageSubmit() {
  const { token } = useParams();

  const [session, setSession] = useState(null);
  const [fatal, setFatal] = useState("");
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setSession(await packageSubmissionClient.resolve(token));
    } catch (e) {
      setFatal(e.message);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  /** Every write returns the whole session, so the form never guesses what its save did. */
  const run = async (fn) => {
    setSaving(true);
    setError("");
    try {
      setSession(await fn());
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  if (fatal) {
    return (
      <Shell>
        <div className="mx-auto max-w-lg py-16 text-center">
          <AlertCircle className="mx-auto mb-4 h-8 w-8 text-amber-500" aria-hidden />
          <h1 className="text-lg font-semibold text-slate-900">This link is not usable</h1>
          <p className="mt-2 text-sm text-slate-600">{fatal}</p>
          <a href="/submit-package" className="mt-5 inline-block text-sm font-medium text-slate-900 underline">
            Start a new submission
          </a>
        </div>
      </Shell>
    );
  }
  if (!session) return <Shell><div className="py-16"><Loading label="Opening your submission…" /></div></Shell>;
  if (session.submitted) return <Shell><SubmittedPanel session={session} /></Shell>;

  const pkg = session.pkg ?? {};
  const current = STEPS[step];

  return (
    <Shell>
      <div className="py-8">
        <Header session={session} />

        <Stepper steps={STEPS} current={step} onGo={setStep} />

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0">
            {error ? <Notice tone="error" className="mb-4">{error}</Notice> : null}

            {current.key === "about" ? (
              <AboutStep session={session} token={token} run={run} saving={saving} />
            ) : current.key === "package" ? (
              <PackageStep pkg={pkg} token={token} run={run} saving={saving} />
            ) : current.key === "itinerary" ? (
              <ItineraryStep pkg={pkg} token={token} run={run} saving={saving} />
            ) : current.key === "tiers" ? (
              <TiersStep pkg={pkg} token={token} run={run} saving={saving} />
            ) : current.key === "rates" ? (
              <RatesStep pkg={pkg} token={token} run={run} saving={saving} />
            ) : current.key === "photos" ? (
              <PhotosStep session={session} token={token} run={run} saving={saving} />
            ) : (
              <ReviewStep pkg={pkg} token={token} run={run} saving={saving} onGo={setStep} />
            )}

            <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
              <Button disabled={step === 0 || saving} onClick={() => setStep((s) => s - 1)}>
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Back
              </Button>
              <span className="text-xs text-slate-400">
                {saving ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />Saving…
                  </span>
                ) : "Saved automatically"}
              </span>
              {step < STEPS.length - 1 ? (
                <Button variant="primary" disabled={saving} onClick={() => setStep((s) => s + 1)}>
                  Next
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Button>
              ) : <span className="w-20" />}
            </div>
          </div>

          <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
              How it will look
            </p>
            <PackageCard pkg={pkg} footer={<PreviewFooter pkg={pkg} />} />
          </aside>
        </div>
      </div>
    </Shell>
  );
}

/* ── Chrome ──────────────────────────────────────────────────────────────── */

/** No sidebar, no navbar. Nothing here should imply the visitor has an account. */
function Shell({ children }) {
  return (
    <div className="min-h-screen bg-white" style={FONT}>
      <div className="mx-auto max-w-5xl px-5 sm:px-8">{children}</div>
    </div>
  );
}

function Header({ session }) {
  const expires = session.expiresAt ? new Date(session.expiresAt) : null;
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2">
        <PackageIcon className="h-5 w-5 text-slate-900" aria-hidden />
        <h1 className="text-lg font-semibold text-slate-900">Submit a tour package</h1>
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
        <span>Your progress saves as you go — bookmark this page to come back.</span>
        {expires ? (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden />
            Link works until {expires.toLocaleDateString()}
          </span>
        ) : null}
      </p>
    </div>
  );
}

function Stepper({ steps, current, onGo }) {
  return (
    <ol className="flex flex-wrap items-center gap-1 border-b border-slate-200 pb-3">
      {steps.map((s, i) => (
        <li key={s.key}>
          <button
            type="button"
            onClick={() => onGo(i)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
              i === current ? "bg-slate-900 text-white"
                : i < current ? "text-slate-700 hover:bg-slate-100"
                : "text-slate-400 hover:bg-slate-50",
            )}
            aria-current={i === current ? "step" : undefined}
          >
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-full text-[10px]",
                i < current ? "bg-emerald-100 text-emerald-700"
                  : i === current ? "bg-white/20 text-white" : "bg-slate-100 text-slate-400",
              )}
            >
              {i < current ? <Check className="h-2.5 w-2.5" aria-hidden /> : i + 1}
            </span>
            {s.label}
          </button>
        </li>
      ))}
    </ol>
  );
}

function PreviewFooter({ pkg }) {
  return (
    <div className="text-xs text-slate-500">
      {pkg.fromPricePerPax === null || pkg.fromPricePerPax === undefined
        ? "Add a rate to show a price here"
        : `From ₹${Number(pkg.fromPricePerPax).toLocaleString("en-IN")} / pax`}
    </div>
  );
}

function StepBox({ title, hint, children }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {hint ? <p className="mt-1 text-sm text-slate-500">{hint}</p> : null}
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, hint, children, className }) {
  return (
    <div className={cn("min-w-0", className)}>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      {children}
      {hint ? <p className="mt-1 text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  );
}

/* ── Steps ───────────────────────────────────────────────────────────────── */

function AboutStep({ session, token, run, saving }) {
  const [form, setForm] = useState({
    name: session.submitterName ?? "",
    email: session.submitterEmail ?? "",
    phone: session.submitterPhone ?? "",
    company: session.submitterCompany ?? "",
  });
  const patch = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <StepBox
      title="About you"
      hint="So we can come back to you about this package. We will not publish your contact details."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name">
          <Input value={form.name} onChange={(e) => patch("name", e.target.value)} />
        </Field>
        <Field label="Email" hint="Where we send the decision.">
          <Input type="email" value={form.email} onChange={(e) => patch("email", e.target.value)} />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={(e) => patch("phone", e.target.value)} />
        </Field>
        <Field label="Company" hint="Optional.">
          <Input value={form.company} onChange={(e) => patch("company", e.target.value)} />
        </Field>
      </div>
      <Button loading={saving} onClick={() => run(() => packageSubmissionClient.saveSubmitter(token, form))}>
        Save
      </Button>
    </StepBox>
  );
}

function PackageStep({ pkg, token, run, saving }) {
  const [form, setForm] = useState({
    title: pkg.title === "Untitled package" ? "" : (pkg.title ?? ""),
    subtitle: pkg.subtitle ?? "",
    region: pkg.region ?? "",
    stateName: pkg.stateName ?? "",
    stateCode: pkg.stateCode ?? "",
    category: pkg.category ?? "",
    nights: pkg.nights ?? "",
    minPax: pkg.minPax ?? "",
    maxPax: pkg.maxPax ?? "",
    includesHotel: !!pkg.includesHotel,
    includesMeal: !!pkg.includesMeal,
    includesVehicle: !!pkg.includesVehicle,
    includesSightseeing: !!pkg.includesSightseeing,
    includesFlight: !!pkg.includesFlight,
    overview: pkg.overview ?? "",
  });
  const patch = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = () => run(() => packageSubmissionClient.saveDetails(token, {
    ...form,
    countryCode: "IN",
    nights: form.nights === "" ? null : Number(form.nights),
    minPax: form.minPax === "" ? null : Number(form.minPax),
    maxPax: form.maxPax === "" ? null : Number(form.maxPax),
    region: form.region || null,
    category: form.category || null,
  }));

  return (
    <StepBox title="The package" hint="What you are offering, and who it suits.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Package name" className="sm:col-span-2">
          <Input value={form.title} onChange={(e) => patch("title", e.target.value)} placeholder="Andaman and Nicobar Islands" />
        </Field>
        <Field label="One-line description" className="sm:col-span-2">
          <Input value={form.subtitle} onChange={(e) => patch("subtitle", e.target.value)} placeholder="Beaches, coral and the Cellular Jail" />
        </Field>
        <Field label="State">
          <Input value={form.stateName} onChange={(e) => patch("stateName", e.target.value)} placeholder="Kerala" />
        </Field>
        <Field label="Region">
          <Select value={form.region} onChange={(e) => patch("region", e.target.value)}>
            <option value="">Choose…</option>
            {Object.entries(PACKAGE_REGION).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Nights" hint="Days are shown as nights + 1.">
          <Input type="number" min={1} value={form.nights} onChange={(e) => patch("nights", e.target.value)} />
        </Field>
        <Field label="Comfort level">
          <Select value={form.category} onChange={(e) => patch("category", e.target.value)}>
            <option value="">Choose…</option>
            {Object.entries(PACKAGE_CATEGORY).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Group size" className="sm:col-span-2" hint="Leave blank if there is no limit.">
          <div className="flex items-center gap-2">
            <Input type="number" min={1} value={form.minPax} onChange={(e) => patch("minPax", e.target.value)} placeholder="Min" aria-label="Minimum travellers" />
            <span className="text-xs text-slate-400">to</span>
            <Input type="number" min={1} value={form.maxPax} onChange={(e) => patch("maxPax", e.target.value)} placeholder="Max" aria-label="Maximum travellers" />
          </div>
        </Field>
        <Field label="What the price includes" className="sm:col-span-2">
          <div className="flex flex-wrap gap-2">
            {[["includesHotel", "Hotel"], ["includesMeal", "Meals"], ["includesVehicle", "Vehicle"],
              ["includesSightseeing", "Sightseeing"], ["includesFlight", "Flight"]].map(([k, l]) => (
              <button
                key={k}
                type="button"
                onClick={() => patch(k, !form[k])}
                aria-pressed={!!form[k]}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition",
                  form[k] ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600 hover:border-slate-300",
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </Field>
        <Field label="About this package" className="sm:col-span-2">
          <Textarea rows={4} value={form.overview} onChange={(e) => patch("overview", e.target.value)} />
        </Field>
      </div>
      <Button loading={saving} onClick={save}>Save</Button>
    </StepBox>
  );
}

function ItineraryStep({ pkg, token, run, saving }) {
  const [legs, setLegs] = useState(() =>
    (pkg.stayLegs ?? []).map((l) => ({
      cityName: l.cityName ?? "",
      nights: l.nights ?? 1,
      note: l.note ?? "",
      travelFrom: l.travelFrom ?? "",
      distanceKm: l.distanceKm ?? "",
      // Split for entry, recombined on save — nobody thinks in "135 minutes".
      travelHours: l.travelMinutes ? Math.floor(l.travelMinutes / 60) : "",
      travelMins: l.travelMinutes ? l.travelMinutes % 60 : "",
      travelMode: l.travelMode ?? "",
      travelNote: l.travelNote ?? "",
    })));
  const [days, setDays] = useState(() =>
    (pkg.itinerary ?? []).map((d) => ({
      title: d.title ?? "",
      description: d.description ?? "",
      overnightCityName: d.overnightCityName ?? "",
      meals: d.meals ?? "",
      dayType: d.dayType ?? "",
      sightseeing: (d.sightseeing ?? []).join(", "),
      images: (d.images ?? []).map((i) => ({ imageUrl: i.imageUrl, caption: i.caption ?? "" })),
    })));
  const [inclusions, setInclusions] = useState(() => (pkg.inclusions ?? []).join("\n"));
  const [exclusions, setExclusions] = useState(() => (pkg.exclusions ?? []).join("\n"));

  const legNights = legs.reduce((s, l) => s + (Number(l.nights) || 0), 0);
  const mismatch = pkg.nights != null && legs.length > 0 && legNights !== pkg.nights;

  const save = () => run(() => packageSubmissionClient.saveItinerary(token, {
    stayLegs: legs.filter((l) => l.cityName.trim())
      .map((l) => ({
        cityName: l.cityName.trim(),
        nights: Number(l.nights) || 1,
        note: l.note?.trim() || null,
        // Blank means "from the previous stop" — freezing the previous city here would leave a
        // journey pointing at the wrong place after a reorder.
        travelFrom: l.travelFrom?.trim() || null,
        distanceKm: numOrNull(l.distanceKm),
        travelMinutes: minutesOf(l.travelHours, l.travelMins),
        travelMode: l.travelMode || null,
        travelNote: l.travelNote?.trim() || null,
      })),
    days: days.filter((d) => d.title.trim())
      .map((d) => ({
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
  }));

  return (
    <StepBox title="Itinerary" hint="Where the trip goes, and what happens each day.">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-600">Stops</span>
          <span className={cn("text-xs", mismatch ? "text-amber-700" : "text-slate-400")}>
            {legNights} of {pkg.nights ?? "?"} nights
          </span>
        </div>
        {mismatch ? (
          <Notice tone="warn" className="mt-2">
            Your stops add up to {legNights} nights but the package says {pkg.nights}. They need to match.
          </Notice>
        ) : null}
        <div className="mt-2 space-y-2">
          {legs.map((leg, i) => {
            const patchLeg = (changes) => setLegs((p) => p.map((l, x) => (x === i ? { ...l, ...changes } : l)));

            return (
              <div key={i} className="rounded-lg border border-slate-200 p-2.5">
                <div className="flex items-center gap-2">
                  <Input
                    className="min-w-0 flex-1"
                    value={leg.cityName}
                    placeholder="City"
                    onChange={(e) => patchLeg({ cityName: e.target.value })}
                    aria-label={`Stop ${i + 1} city`}
                  />
                  <Input
                    className="w-24"
                    type="number"
                    min={1}
                    value={leg.nights}
                    onChange={(e) => patchLeg({ nights: e.target.value })}
                    aria-label={`Stop ${i + 1} nights`}
                  />
                  <IconButton onClick={() => setLegs((p) => p.filter((_, x) => x !== i))} label={`Remove stop ${i + 1}`} />
                </div>

                {/*
                  How the traveller gets HERE. Optional everywhere, but always visible: it is the
                  question a customer asks back more than any other, and a field behind a disclosure
                  is a field nobody fills.
                */}
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <Input
                    value={leg.travelFrom}
                    placeholder={i === 0 ? "Travelling from (start point)" : `From — blank means ${legs[i - 1]?.cityName || "previous stop"}`}
                    onChange={(e) => patchLeg({ travelFrom: e.target.value })}
                    aria-label={`Stop ${i + 1} travelling from`}
                  />
                  <div className="flex items-center gap-1.5">
                    <Input className="min-w-0 flex-1" type="number" min={0} value={leg.distanceKm} placeholder="Distance"
                      onChange={(e) => patchLeg({ distanceKm: e.target.value })} aria-label={`Stop ${i + 1} distance`} />
                    <span className="shrink-0 text-xs text-slate-400">km</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Input className="min-w-0 flex-1" type="number" min={0} value={leg.travelHours} placeholder="0"
                      onChange={(e) => patchLeg({ travelHours: e.target.value })} aria-label={`Stop ${i + 1} travel hours`} />
                    <span className="shrink-0 text-xs text-slate-400">h</span>
                    <Input className="min-w-0 flex-1" type="number" min={0} max={59} value={leg.travelMins} placeholder="00"
                      onChange={(e) => patchLeg({ travelMins: e.target.value })} aria-label={`Stop ${i + 1} travel minutes`} />
                    <span className="shrink-0 text-xs text-slate-400">m</span>
                  </div>
                  <Select value={leg.travelMode} onChange={(e) => patchLeg({ travelMode: e.target.value })}
                    aria-label={`Stop ${i + 1} travel mode`}>
                    <option value="">How — mode</option>
                    {TRAVEL_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </Select>
                  <Input className="sm:col-span-2" value={leg.travelNote}
                    placeholder="Journey note — e.g. Government ferry, seats not guaranteed"
                    onChange={(e) => patchLeg({ travelNote: e.target.value })} aria-label={`Stop ${i + 1} journey note`} />
                  <Input className="sm:col-span-2" value={leg.note} placeholder="Note about the stay here"
                    onChange={(e) => patchLeg({ note: e.target.value })} aria-label={`Stop ${i + 1} note`} />
                </div>
              </div>
            );
          })}
        </div>
        <Button className="mt-2" onClick={() => setLegs((p) => [...p, {
          cityName: "", nights: 1, note: "",
          travelFrom: "", distanceKm: "", travelHours: "", travelMins: "", travelMode: "", travelNote: "",
        }])}>
          <Plus className="h-4 w-4" aria-hidden />Add a stop
        </Button>
      </div>

      <div>
        <span className="text-xs font-medium text-slate-600">Day by day</span>
        <div className="mt-2 space-y-2">
          {days.map((day, i) => (
            <div key={i} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-[11px] font-semibold uppercase text-slate-500">Day {i + 1}</span>
                <Input
                  className="min-w-0 flex-1"
                  value={day.title}
                  placeholder="Title"
                  onChange={(e) => setDays((p) => p.map((d, x) => (x === i ? { ...d, title: e.target.value } : d)))}
                  aria-label={`Day ${i + 1} title`}
                />
                <IconButton onClick={() => setDays((p) => p.filter((_, x) => x !== i))} label={`Remove day ${i + 1}`} />
              </div>
              <Textarea
                className="mt-2"
                rows={2}
                value={day.description}
                placeholder="What happens"
                onChange={(e) => setDays((p) => p.map((d, x) => (x === i ? { ...d, description: e.target.value } : d)))}
                aria-label={`Day ${i + 1} description`}
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
              <PublicPhotoStrip
                token={token}
                label={`Day ${i + 1} photos`}
                photos={day.images}
                onChange={(images) => setDays((p) => p.map((d, x) => (x === i ? { ...d, images } : d)))}
              />
            </div>
          ))}
        </div>
        <Button className="mt-2" onClick={() => setDays((p) => [...p, {
          title: "", description: "", overnightCityName: "", meals: "", dayType: "", sightseeing: "", images: [],
        }])}>
          <Plus className="h-4 w-4" aria-hidden />Add a day
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="What is included" hint="One per line.">
          <Textarea rows={5} value={inclusions} onChange={(e) => setInclusions(e.target.value)} />
        </Field>
        <Field label="What is not" hint="One per line.">
          <Textarea rows={5} value={exclusions} onChange={(e) => setExclusions(e.target.value)} />
        </Field>
      </div>

      <Button loading={saving} onClick={save}>Save</Button>
    </StepBox>
  );
}

/**
 * Photos that belong INSIDE a payload still being edited — a day's pictures, a tier hotel's rooms.
 *
 * <p>Uses the URL-returning upload rather than the gallery one: the gallery attaches on the spot,
 * which is right for a gallery and wrong here, where the picture has to travel with the itinerary
 * or the tiers when those save.</p>
 *
 * <p>Both share the link's upload counter, so a submitter cannot double the per-link cap by
 * alternating between them.</p>
 */
function PublicPhotoStrip({ token, label, photos, onChange, max }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  const list = photos ?? [];
  const full = max ? list.length >= max : false;

  const upload = async (file) => {
    if (!file || full) return;
    setBusy(true);
    setProblem("");
    try {
      const url = await packageSubmissionClient.uploadPhoto(token, file);
      if (!url) throw new Error("Upload did not return an image path");
      onChange([...list, { imageUrl: url, caption: "" }]);
    } catch (e) {
      // Rendered here, not toasted: the usual failure is the link's photo cap, which is about the
      // thing they just tried to do.
      setProblem(e?.message || "Could not upload that photo.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="mt-2 rounded-md border border-slate-100 bg-slate-50/50 p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          {label}
          {max ? <span className="ml-1 font-normal normal-case text-slate-400">{list.length}/{max}</span> : null}
        </span>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
        <Button
          loading={busy}
          disabled={full}
          title={full ? `At most ${max} photos here` : undefined}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" aria-hidden />
          Add
        </Button>
      </div>

      {problem ? <p className="mt-1 text-[11px] text-rose-600">{problem}</p> : null}

      {list.length ? (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((img, x) => (
            <div key={x} className="overflow-hidden rounded-md border border-slate-200 bg-white">
              <Photo src={img.imageUrl} alt={img.caption || label} className="aspect-[4/3] w-full" />
              <div className="flex items-center gap-1 p-1">
                <Input
                  className="min-w-0 flex-1"
                  value={img.caption}
                  placeholder="Caption"
                  onChange={(e) => onChange(list.map((m, y) => (y === x ? { ...m, caption: e.target.value } : m)))}
                  aria-label={`${label} ${x + 1} caption`}
                />
                <IconButton onClick={() => onChange(list.filter((_, y) => y !== x))} label={`Remove ${label} ${x + 1}`} />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ── Levels (tiers) ──────────────────────────────────────────────────────── */

/**
 * The package's levels — Basic / Deluxe / Super Deluxe.
 *
 * <p>Optional, and the empty state says so plainly: most packages submitted through a public link
 * are sold at one level, and a step that looked mandatory would make people invent tiers they do
 * not have.</p>
 *
 * <p>Hotel rows are generated from the stops and the city is fixed text — the server matches tier
 * hotels to stops BY NAME, so retyping four city names per tier is three chances to break the match
 * silently.</p>
 */
function TiersStep({ pkg, token, run, saving }) {
  const legs = pkg.stayLegs ?? [];
  const [tiers, setTiers] = useState(() => toPublicTiers(pkg.variants, legs));

  const patchTier = (ti, changes) => setTiers((p) => p.map((t, x) => (x === ti ? { ...t, ...changes } : t)));
  const patchHotel = (ti, hi, changes) => setTiers((p) => p.map((t, x) => (x === ti ? {
    ...t, hotels: t.hotels.map((h, y) => (y === hi ? { ...h, ...changes } : h)),
  } : t)));

  const save = () => run(() => packageSubmissionClient.saveVariants(token, tiers.map((t) => ({
    publicId: t.publicId,
    name: t.name.trim(),
    category: t.category || null,
    vehicleName: t.vehicleName?.trim() || null,
    vehicleNote: t.vehicleNote?.trim() || null,
    highlight: t.highlight?.trim() || null,
    active: true,
    hotels: t.hotels.map((h) => ({
      cityName: h.cityName,
      hotelName: h.hotelName?.trim() || null,
      roomType: h.roomType?.trim() || null,
      mealPlan: h.mealPlan?.trim() || null,
      hotelStars: numOrNull(h.hotelStars),
      // Sliced rather than trusted — the UI stops at the cap, but a stale row would otherwise fail
      // the whole save on validation.
      images: (h.images ?? []).filter((i) => i.imageUrl).slice(0, MAX_HOTEL_PHOTOS)
        .map((i) => ({ imageUrl: i.imageUrl, caption: i.caption?.trim() || null })),
      roomImages: (h.roomImages ?? []).filter((i) => i.imageUrl).slice(0, MAX_HOTEL_PHOTOS)
        .map((i) => ({ imageUrl: i.imageUrl, caption: i.caption?.trim() || null })),
    })),
    priceSlabs: t.slabs.filter((s) => s.perPaxPrice !== "").map((s) => ({
      paxFrom: Number(s.paxFrom) || 1,
      paxTo: s.paxTo === "" ? null : Number(s.paxTo),
      occupancy: s.occupancy,
      perPaxPrice: Number(s.perPaxPrice),
      label: s.label?.trim() || null,
      active: true,
    })),
  }))));

  if (legs.length === 0) {
    return (
      <StepBox title="Levels" hint="Add your stops first — a level says where you sleep at each one.">
        <Notice tone="info">
          Go back to the itinerary and add the stops. A level describes the hotel at each stop, so
          there is nothing for one to say yet.
        </Notice>
      </StepBox>
    );
  }

  return (
    <StepBox
      title="Levels"
      hint="Optional. Same trip at two or three comfort levels — different hotels and vehicle, different price."
    >
      {tiers.length === 0 ? (
        <Notice tone="info">
          Most packages are sold at one level. Skip this unless you offer the same trip as Basic,
          Deluxe and so on — then buyers can compare them side by side.
        </Notice>
      ) : null}

      {tiers.map((tier, ti) => (
        <div key={ti} className="rounded-lg border border-slate-200 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-slate-900">{tier.name || `Level ${ti + 1}`}</span>
            <IconButton onClick={() => setTiers((p) => p.filter((_, x) => x !== ti))} label={`Remove level ${ti + 1}`} />
          </div>

          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Input value={tier.name} placeholder="Name — Deluxe"
              onChange={(e) => patchTier(ti, { name: e.target.value })} aria-label={`Level ${ti + 1} name`} />
            <Select value={tier.category} onChange={(e) => patchTier(ti, { category: e.target.value })}
              aria-label={`Level ${ti + 1} category`}>
              <option value="">Category — optional</option>
              {Object.entries(PACKAGE_CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <Input value={tier.vehicleName} placeholder="Vehicle — Innova Crysta"
              onChange={(e) => patchTier(ti, { vehicleName: e.target.value })} aria-label={`Level ${ti + 1} vehicle`} />
            <Input value={tier.vehicleNote} placeholder="Vehicle note"
              onChange={(e) => patchTier(ti, { vehicleNote: e.target.value })} aria-label={`Level ${ti + 1} vehicle note`} />
            <Input className="sm:col-span-2 lg:col-span-4" value={tier.highlight}
              placeholder="What makes this level worth it"
              onChange={(e) => patchTier(ti, { highlight: e.target.value })} aria-label={`Level ${ti + 1} highlight`} />
          </div>

          <p className="mt-3 text-xs font-medium text-slate-600">Hotels</p>
          <div className="mt-1.5 space-y-2">
            {tier.hotels.map((h, hi) => (
              <div key={hi} className="rounded-md border border-slate-200 p-2">
                <div className="grid gap-2 sm:grid-cols-12 sm:items-center">
                  <div className="min-w-0 sm:col-span-3">
                    <div className="truncate text-sm font-medium text-slate-800">{h.cityName}</div>
                    <div className="text-[11px] text-slate-400">{h.nights}N</div>
                  </div>
                  <Input className="sm:col-span-3" value={h.hotelName} placeholder="Hotel"
                    onChange={(e) => patchHotel(ti, hi, { hotelName: e.target.value })} aria-label={`${h.cityName} hotel`} />
                  <Input className="sm:col-span-3" value={h.roomType} placeholder="Room type"
                    onChange={(e) => patchHotel(ti, hi, { roomType: e.target.value })} aria-label={`${h.cityName} room type`} />
                  <Input className="sm:col-span-2" value={h.mealPlan} placeholder="Meals"
                    onChange={(e) => patchHotel(ti, hi, { mealPlan: e.target.value })} aria-label={`${h.cityName} meals`} />
                  <Input className="sm:col-span-1" type="number" min={1} max={5} value={h.hotelStars} placeholder="★"
                    onChange={(e) => patchHotel(ti, hi, { hotelStars: e.target.value })} aria-label={`${h.cityName} stars`} />
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <PublicPhotoStrip token={token} label="Hotel photos" max={MAX_HOTEL_PHOTOS}
                    photos={h.images} onChange={(next) => patchHotel(ti, hi, { images: next })} />
                  <PublicPhotoStrip token={token} label="Room photos" max={MAX_HOTEL_PHOTOS}
                    photos={h.roomImages} onChange={(next) => patchHotel(ti, hi, { roomImages: next })} />
                </div>
              </div>
            ))}
          </div>

          <p className="mt-3 text-xs font-medium text-slate-600">This level&rsquo;s rates</p>
          <div className="mt-1.5 space-y-2">
            {tier.slabs.map((s, si) => (
              <div key={si} className="grid gap-2 sm:grid-cols-12 sm:items-center">
                <Input className="sm:col-span-2" type="number" min={1} value={s.paxFrom} placeholder="From pax"
                  onChange={(e) => patchTier(ti, { slabs: tier.slabs.map((x, y) => (y === si ? { ...x, paxFrom: e.target.value } : x)) })}
                  aria-label="From pax" />
                <Input className="sm:col-span-2" type="number" min={1} value={s.paxTo} placeholder="To pax"
                  onChange={(e) => patchTier(ti, { slabs: tier.slabs.map((x, y) => (y === si ? { ...x, paxTo: e.target.value } : x)) })}
                  aria-label="To pax" />
                <Select className="sm:col-span-3" value={s.occupancy}
                  onChange={(e) => patchTier(ti, { slabs: tier.slabs.map((x, y) => (y === si ? { ...x, occupancy: e.target.value } : x)) })}
                  aria-label="Sharing">
                  {OCCUPANCY.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
                </Select>
                <Input className="sm:col-span-2" type="number" min={0} value={s.perPaxPrice} placeholder="₹ / pax"
                  onChange={(e) => patchTier(ti, { slabs: tier.slabs.map((x, y) => (y === si ? { ...x, perPaxPrice: e.target.value } : x)) })}
                  aria-label="Price per pax" />
                <Input className="sm:col-span-2" value={s.label} placeholder="Label"
                  onChange={(e) => patchTier(ti, { slabs: tier.slabs.map((x, y) => (y === si ? { ...x, label: e.target.value } : x)) })}
                  aria-label="Rate label" />
                <div className="sm:col-span-1">
                  <IconButton onClick={() => patchTier(ti, { slabs: tier.slabs.filter((_, y) => y !== si) })} label="Remove this rate" />
                </div>
              </div>
            ))}
          </div>
          <Button className="mt-2" onClick={() => patchTier(ti, { slabs: [...tier.slabs, blankPublicSlab()] })}>
            <Plus className="h-4 w-4" aria-hidden />Add a rate
          </Button>
        </div>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button onClick={() => setTiers((p) => [...p, blankPublicTier(legs)])}>
          <Plus className="h-4 w-4" aria-hidden />Add a level
        </Button>
        <Button loading={saving} onClick={save}>Save</Button>
      </div>
    </StepBox>
  );
}

const blankPublicSlab = () => ({ paxFrom: 2, paxTo: "", occupancy: "DOUBLE", perPaxPrice: "", label: "" });

/** A new level, pre-filled with one hotel row per stop so the city names can never be mistyped. */
const blankPublicTier = (legs) => ({
  publicId: undefined, name: "", category: "", vehicleName: "", vehicleNote: "", highlight: "",
  hotels: legs.map((l) => ({
    cityName: l.cityName, nights: l.nights ?? 1,
    hotelName: "", roomType: "", mealPlan: "", hotelStars: "", images: [], roomImages: [],
  })),
  slabs: [blankPublicSlab()],
});

/** Saved levels → editable rows, hotel rows aligned to the CURRENT stops. */
function toPublicTiers(variants, legs) {
  const photoRow = (i) => ({ imageUrl: i.imageUrl, caption: i.caption ?? "" });
  return (variants ?? []).map((v) => {
    const byCity = new Map((v.hotels ?? []).map((h) => [(h.cityName ?? "").trim().toLowerCase(), h]));
    return {
      publicId: v.publicId,
      name: v.name ?? "",
      category: v.category ?? "",
      vehicleName: v.vehicleName ?? "",
      vehicleNote: v.vehicleNote ?? "",
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
          images: (h?.images ?? []).map(photoRow),
          roomImages: (h?.roomImages ?? []).map(photoRow),
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

function RatesStep({ pkg, token, run, saving }) {
  const [rows, setRows] = useState(() => toRateRows(pkg.priceSlabs));
  return (
    <StepBox
      title="Rates"
      hint="Per person, by group size and room sharing. The cheapest one shows on your card."
    >
      <PackageRateTable rows={rows} onChange={setRows} />
      <Button
        loading={saving}
        disabled={!ratesAreValid(rows)}
        onClick={() => run(() => packageSubmissionClient.saveRates(token, toRatePayload(rows)))}
      >
        Save
      </Button>
    </StepBox>
  );
}

function PhotosStep({ session, token, run, saving }) {
  const fileRef = useRef(null);
  const images = session.pkg?.images ?? [];
  const atCap = (session.uploadCount ?? 0) >= (session.maxUploads ?? 20);

  return (
    <StepBox
      title="Photos"
      hint="The first one becomes the cover. Landscape photos look best."
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) run(() => packageSubmissionClient.addPhoto(token, file));
          if (fileRef.current) fileRef.current.value = "";
        }}
      />

      {images.length === 0 ? (
        <button
          type="button"
          disabled={saving || atCap}
          onClick={() => fileRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 py-12 text-slate-400 transition hover:border-slate-400 hover:text-slate-600 disabled:opacity-50"
        >
          <Upload className="h-6 w-6" aria-hidden />
          <span className="text-sm">Add your first photo</span>
        </button>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((img) => (
              <div key={img.publicId} className="overflow-hidden rounded-lg border border-slate-200">
                <Photo src={img.imageUrl} alt="" className="aspect-[4/3] w-full" />
                <div className="flex items-center justify-between p-2">
                  <span className="flex items-center gap-1 text-[11px] text-slate-500">
                    {img.primary ? (
                      <>
                        <Star className="h-3 w-3 fill-amber-500 text-amber-500" aria-hidden />
                        Cover
                      </>
                    ) : null}
                  </span>
                  <IconButton
                    onClick={() => run(() => packageSubmissionClient.removePhoto(token, img.publicId))}
                    label="Remove this photo"
                    disabled={saving}
                  />
                </div>
              </div>
            ))}
          </div>
          <Button disabled={saving || atCap} onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" aria-hidden />
            Add another
          </Button>
        </>
      )}

      {atCap ? (
        <Notice tone="warn">
          You have reached the {session.maxUploads} photo limit for this submission.
        </Notice>
      ) : null}
    </StepBox>
  );
}

function ReviewStep({ pkg, token, run, saving, onGo }) {
  const checks = packageReadiness(pkg).filter((c) => c.blocking);
  const outstanding = checks.filter((c) => !c.ok);

  return (
    <StepBox
      title="Ready to send"
      hint="We review every submission and email you either way. You cannot edit it after this."
    >
      {outstanding.length ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium text-amber-900">
            <AlertCircle className="h-4 w-4" aria-hidden />
            {outstanding.length} thing{outstanding.length === 1 ? "" : "s"} still needed
          </p>
          <ul className="mt-2 space-y-1">
            {outstanding.map((c) => (
              <li key={c.key} className="text-sm text-amber-900">· {c.hint}</li>
            ))}
          </ul>
          <Button className="mt-3" onClick={() => onGo(1)}>Go back and finish</Button>
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-900">
            <Check className="h-4 w-4" aria-hidden />
            Everything we need is here
          </p>
        </div>
      )}

      <Button
        variant="primary"
        loading={saving}
        disabled={outstanding.length > 0}
        onClick={() => run(() => packageSubmissionClient.submit(token))}
      >
        <Send className="h-4 w-4" aria-hidden />
        Submit for review
      </Button>
    </StepBox>
  );
}

function SubmittedPanel({ session }) {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <PartyPopper className="mx-auto mb-4 h-8 w-8 text-emerald-600" aria-hidden />
      <h1 className="text-xl font-semibold text-slate-900">Thank you — it is with our team</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        We will review <strong>{session.pkg?.title}</strong> and email
        {session.submitterEmail ? <> <strong>{session.submitterEmail}</strong></> : " you"} either way.
        This link is now read-only.
      </p>
      <div className="mx-auto mt-6 max-w-xs text-left">
        <PackageCard pkg={session.pkg ?? {}} footer={<span className="text-xs text-slate-500">Awaiting review</span>} />
      </div>
    </div>
  );
}

function IconButton({ onClick, label, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="shrink-0 rounded-md border border-slate-200 p-2 text-slate-400 transition hover:border-rose-200 hover:text-rose-600 disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" aria-hidden />
    </button>
  );
}

export default PublicPackageSubmit;
