import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Bus, Car, Check, ChevronDown, Clock, CloudOff, ListChecks, Loader2, Plus,
  RotateCw, Send, Trash2, X,
} from "lucide-react";
import {
  PHOTO_LIMITS, isLinkExpired, partnerErrorMessage, transportPartnerService,
} from "../api/transportPartnerService";
import {
  Btn, Card, Centered, Chip, Field, FieldBlock, Notice, Page, PhotoUploader, ProgressBar, Row,
  Stepper, TriState, inputCls,
} from "../components/partnerUi";

/* ── Vocabulary. Mirrors the backend enums exactly; a mismatch here is a silent data loss. ── */

/**
 * `TransportServiceType`, in the order an operator thinks about their own business — the transfers
 * they run every day first, the unusual ones last. The wire format is the constant NAME; the label
 * is ours to choose, and it matches the tenant-facing marketplace form word for word so an operator
 * and the agent booking them are reading the same list.
 */
const SERVICE_TYPES = [
  ["AIRPORT_TRANSFER", "Airport transfer"],
  ["RAILWAY_TRANSFER", "Railway transfer"],
  ["POINT_TO_POINT", "Point to point"],
  ["LOCAL_PACKAGE", "Local package"],
  ["OUTSTATION_ONE_WAY", "Outstation — one way"],
  ["OUTSTATION_ROUND_TRIP", "Outstation — round trip"],
  ["MULTI_DAY_TOUR", "Multi-day tour"],
  ["HOURLY_RENTAL", "Hourly rental"],
  ["CUSTOM", "Something else"],
];

/**
 * `TransportRateModel`, plus the UNIT each one prices in.
 *
 * The unit is not decoration. "Net rate: 4000" means four different amounts of money depending on
 * the model beside it, and the operator is the only person who knows which they meant — so the
 * field's own label says it ("Net per km", "Net per day"). Getting this wrong is not a display bug;
 * it is the platform paying a per-day figure for a single transfer.
 */
const RATE_MODELS = [
  ["FLAT_PER_TRANSFER", "Flat per transfer", "per transfer"],
  ["FLAT_PER_VEHICLE", "Flat per vehicle", "per vehicle"],
  ["PER_KILOMETRE", "Per kilometre", "per km"],
  ["PER_DAY", "Per day", "per day"],
  ["PER_HOUR", "Per hour", "per hour"],
  ["PACKAGE", "Package rate", "per package"],
  ["ROUTE_FIXED", "Fixed for one route", "per route"],
  ["CUSTOM_QUOTE", "Quoted each time", "starting price"],
];

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "THB", "SGD"];

const serviceLabel = (v) => SERVICE_TYPES.find(([k]) => k === v)?.[1] ?? v;
const modelLabel = (v) => RATE_MODELS.find(([k]) => k === v)?.[1] ?? v;
const modelUnit = (v) => RATE_MODELS.find(([k]) => k === v)?.[2] ?? "";

/**
 * The rate model an operator almost always means for a given journey.
 *
 * Used only to seed a NEW rate row — nothing here ever rewrites a model the operator chose. An
 * airport run is quoted flat, an outstation run per kilometre, a multi-day tour per day; seeding the
 * obvious one saves a tap and, more usefully, teaches the pairing to an operator who has never had
 * to state it in these terms before.
 */
const DEFAULT_MODEL_FOR = {
  AIRPORT_TRANSFER: "FLAT_PER_TRANSFER",
  RAILWAY_TRANSFER: "FLAT_PER_TRANSFER",
  POINT_TO_POINT: "FLAT_PER_TRANSFER",
  LOCAL_PACKAGE: "PACKAGE",
  OUTSTATION_ONE_WAY: "PER_KILOMETRE",
  OUTSTATION_ROUND_TRIP: "PER_KILOMETRE",
  MULTI_DAY_TOUR: "PER_DAY",
  HOURLY_RENTAL: "PER_HOUR",
  CUSTOM: "CUSTOM_QUOTE",
};

/**
 * Suggestions, NOT a closed list.
 *
 * `vehicleType` is a free string on the backend on purpose — operators name their own segments and a
 * fixed list would force an unfamiliar label onto a vehicle the platform has never seen. So this is
 * a datalist behind a text input, never a `<select>`: a select whose options do not contain the
 * stored value falls back silently and the next whole-document save writes the fallback over what
 * was there, which is exactly the lead-source data-loss shape documented in CLAUDE.md.
 */
const COMMON_VEHICLE_TYPES = [
  "Hatchback", "Sedan", "SUV", "MUV", "Tempo Traveller", "Mini Bus", "Bus", "Coach",
  "Luxury Sedan", "Luxury SUV", "Van", "Bike",
];

/**
 * What a vehicle listing almost always claims. Typing "Charging point" on a phone keyboard is the
 * slowest thing on this form, and these cover most of what an agent looks for.
 *
 * Air conditioning is NOT here — it is its own three-valued field, because it is the one attribute
 * an agent filters the catalog on and "not mentioned" must not read as "no AC".
 */
const COMMON_AMENITIES = [
  "WiFi", "Charging point", "Bottled water", "Music system", "Push-back seats", "Reading lights",
  "Luggage carrier", "Curtains", "First-aid kit", "Child seat", "GPS tracking",
  "Wheelchair accessible",
];

/**
 * TWO sections, and only two.
 *
 * <p>This started as five — company, location, contact, coverage, fleet — which is how the form
 * decomposes on paper but not how an operator fills it in. The first four are the same short act:
 * "who you are and how to reach you", perhaps thirty seconds of typing between them, and splitting
 * that across four headed cards made a two-part form look like a five-part one. What actually takes
 * the time is the fleet, and burying it as the fifth item made it read like a footnote.</p>
 *
 * <p>So: everything about the business goes above, the vehicles and their rates go below. The four
 * old headings survive as group labels INSIDE the top section, because they are still useful for
 * finding a field — they just are not milestones.</p>
 */
const SECTIONS = [
  { id: "details", label: "Your details" },
  { id: "fleet", label: "Vehicles & rates" },
];
const SECTION_IDS = SECTIONS.map((s) => s.id);

/**
 * Client-only row identity.
 *
 * The server rebuilds vehicles and rates wholesale on every save, so nothing coming back is stable
 * enough to key React on — and an array index breaks the moment a vehicle is deleted from the
 * middle, taking the open/closed state of every vehicle below it with it. `_key` is stripped before
 * the payload leaves {@link toPayload}.
 */
let seq = 0;
const newKey = () => `k${++seq}`;

/**
 * A blank rate lands on POINT_TO_POINT / FLAT_PER_TRANSFER — the same two defaults the backend
 * applies to a rate row that arrives with neither. Matching them keeps the dedup key stable: the
 * server keys one live rate per (vehicle, service type, rate model), and a client default that
 * disagreed with the server's would make the row change identity on its first round trip.
 */
const BLANK_RATE = {
  serviceType: "POINT_TO_POINT", rateModel: "FLAT_PER_TRANSFER", netRate: "", currency: "INR",
  rateCode: "", includedKm: "", includedHours: "", extraKmRate: "", extraHourRate: "",
  driverAllowance: "", nightHalt: "", inclusionsText: "", active: true,
};

/**
 * A new vehicle starts with one rate row, because a vehicle with no price is not a listing.
 *
 * `airConditioned` starts null rather than false — see {@link TriState}. `passengerCapacity` starts
 * blank rather than at a guess: a seat count is the number an agent filters and quotes on, and a
 * pre-filled 4 that nobody looked at is worse than an empty box the checklist keeps asking about.
 */
const BLANK_VEHICLE = () => ({
  _key: newKey(),
  name: "", vehicleType: "", passengerCapacity: "", luggageCapacity: "",
  ownerCompanyName: "", ownerName: "",
  airConditioned: null, description: "", primaryImageUrl: "", active: true,
  amenities: [], images: [],
  rates: [{ ...BLANK_RATE, _key: newKey() }],
});

/**
 * The first (service type, rate model) pair this vehicle has not used yet.
 *
 * `uq_tp_rate_vehicle_service_model` allows one live rate per pair and the server silently keeps the
 * LAST of a duplicated key, so seeding every "Add rate" with the same pair would make the second one
 * quietly eat the first on the next autosave. The service type varies fastest because a second rate
 * on the same vehicle is far more often "the same car on a different kind of journey" than "the same
 * journey priced a different way" — and each candidate journey is offered with the model operators
 * actually quote it in.
 */
/**
 * The one photo that stands for a vehicle: the chosen cover, else whatever was uploaded first.
 *
 * <p>Same rule the PhotoUploader's "Cover" badge uses and the same one the server applies at
 * promotion — `primaryImageUrl` is a URL rather than an index, and it is only elected from the
 * gallery when the operator picked none. Deriving it in one place keeps the card header, the badge
 * and the eventual catalog listing showing the same picture.</p>
 */
function coverOf(vehicle) {
  const chosen = vehicle.primaryImageUrl?.trim();
  if (chosen) return chosen;
  return vehicle.images?.find((u) => u?.trim()) ?? null;
}

function nextFreeRate(vehicle) {
  const taken = new Set((vehicle.rates ?? []).map((r) => `${r.serviceType}|${r.rateModel}`));
  const models = RATE_MODELS.map(([k]) => k);
  for (const [serviceType] of SERVICE_TYPES) {
    // The natural model for this journey first, then anything else still free for it.
    const ordered = [DEFAULT_MODEL_FOR[serviceType], ...models].filter(Boolean);
    for (const rateModel of ordered) {
      if (!taken.has(`${serviceType}|${rateModel}`)) {
        return { ...BLANK_RATE, serviceType, rateModel, _key: newKey() };
      }
    }
  }
  return { ...BLANK_RATE, _key: newKey() };
}

/** Server DTO → form state. Every field is a controlled input, so null must become "". */
function toForm(dto) {
  return {
    companyName: dto?.companyName ?? "",
    contactPerson: dto?.contactPerson ?? "",
    phone: dto?.phone ?? "",
    email: dto?.email ?? "",
    website: dto?.website ?? "",
    countryCode: dto?.countryCode ?? "",
    stateName: dto?.stateName ?? "",
    cityName: dto?.cityName ?? "",
    cityCode: dto?.cityCode ?? "",
    address: dto?.address ?? "",
    coverageNote: dto?.coverageNote ?? "",
    about: dto?.about ?? "",
    cancellationPolicy: dto?.cancellationPolicy ?? "",
    noticeHours: dto?.noticeHours ?? "",
    vehicles: (dto?.vehicles ?? []).map((v) => ({
      _key: newKey(),
      name: v.name ?? "",
      vehicleType: v.vehicleType ?? "",
      passengerCapacity: v.passengerCapacity ?? "",
      luggageCapacity: v.luggageCapacity ?? "",
      // Boxed all the way down: `?? null` and NOT `?? false`, or the first save after opening the
      // form would tell the platform every unanswered vehicle has no air conditioning.
      airConditioned: v.airConditioned ?? null,
      description: v.description ?? "",
      primaryImageUrl: v.primaryImageUrl ?? "",
      // Absent from the JSON when the server holds null (the DTO is NON_NULL), and "" is the
      // right landing spot: a controlled input needs a string, and toPayload sends "" straight
      // back where the service trims it to null again. Round-trips without inventing an owner.
      ownerCompanyName: v.ownerCompanyName ?? "",
      ownerName: v.ownerName ?? "",
      active: v.active !== false,
      amenities: v.amenities ?? [],
      images: v.images ?? [],
      rates: (v.rates ?? []).map((r) => ({
        _key: newKey(),
        serviceType: r.serviceType ?? "POINT_TO_POINT",
        rateModel: r.rateModel ?? "FLAT_PER_TRANSFER",
        netRate: r.netRate ?? "",
        currency: r.currency ?? "INR",
        rateCode: r.rateCode ?? "",
        includedKm: r.includedKm ?? "",
        includedHours: r.includedHours ?? "",
        extraKmRate: r.extraKmRate ?? "",
        extraHourRate: r.extraHourRate ?? "",
        driverAllowance: r.driverAllowance ?? "",
        nightHalt: r.nightHalt ?? "",
        inclusionsText: r.inclusionsText ?? "",
        active: r.active !== false,
      })),
    })),
  };
}

/**
 * Form state → request body. Blank numerics become null so the backend stores absence, not 0.
 *
 * That distinction is real money on this form: a null net rate is "not priced yet" and submit
 * refuses it, while 0 is a complimentary run an operator genuinely throws in. Coercing one to the
 * other in either direction would either publish a free vehicle or block a legitimate one.
 */
const num = (v) => (v === "" || v === null || v === undefined ? null : Number(v));

/** Drops the client-only `_key` — the DTO has no such field and Jackson is not asked to ignore it. */
const stripKey = (o) => {
  const copy = { ...o };
  delete copy._key;
  return copy;
};

function toPayload(f) {
  return {
    ...f,
    noticeHours: num(f.noticeHours),
    vehicles: f.vehicles.map((v) => ({
      ...stripKey(v),
      passengerCapacity: num(v.passengerCapacity),
      luggageCapacity: num(v.luggageCapacity),
      primaryImageUrl: v.primaryImageUrl || null,
      rates: v.rates.map((r) => ({
        ...stripKey(r),
        netRate: num(r.netRate),
        includedKm: num(r.includedKm),
        includedHours: num(r.includedHours),
        extraKmRate: num(r.extraKmRate),
        extraHourRate: num(r.extraHourRate),
        driverAllowance: num(r.driverAllowance),
        nightHalt: num(r.nightHalt),
      })),
    })),
  };
}

/**
 * Everything the backend will refuse to submit without, evaluated live.
 *
 * Deliberately a mirror of `TransportPartnerRegistrationService.validateForSubmit` and NOT a gate:
 * the server stays the only authority, so if the two ever drift the operator is told by the server
 * rather than blocked by a stale copy of its rules. What this buys is that they find out while they
 * are still in the section, instead of after pressing Submit at the bottom of a long page.
 *
 * Every item carries `field` — the DOM id of the exact input that satisfies it. Naming what is
 * missing was never the gap; the gap was dropping the operator at the TOP of a section holding six
 * vehicles and leaving them to find it. A section is an address; a field is a destination. Items
 * with no single input to point at (a photo, a whole vehicle) keep `field: null` and fall back to
 * scrolling the section, which is the honest answer for them.
 */
function buildChecklist(form) {
  const items = [
    { id: "company", label: "Company name / Owner name", section: "details", field: "f-company", done: Boolean(form.companyName?.trim()) },
    { id: "city", label: "City you operate from", section: "details", field: "f-city", done: Boolean(form.cityName?.trim()) },
    { id: "country", label: "Country code", section: "details", field: "f-country", done: Boolean(form.countryCode?.trim()) },
    { id: "fleet", label: "At least one vehicle", section: "fleet", field: null, done: form.vehicles.length > 0 },
  ];

  form.vehicles.forEach((v, i) => {
    const label = v.name?.trim() || `Vehicle ${i + 1}`;
    /* `vehicleKey` is carried explicitly rather than parsed back out of `id` or `field`: an item may
       point at one of three different inputs or at none at all, and `revealField` has to expand the
       right collapsed card in every one of those cases. */
    const of = (rest) => ({ section: "fleet", vehicleKey: v._key, ...rest });
    items.push(of({
      id: `${v._key}-name`, field: `f-vehicle-${v._key}`,
      label: `Name for vehicle ${i + 1}`, done: Boolean(v.name?.trim()),
    }));
    items.push(of({
      id: `${v._key}-type`, field: `f-vtype-${v._key}`,
      label: `Vehicle type for ${label}`, done: Boolean(v.vehicleType?.trim()),
    }));
    items.push(of({
      id: `${v._key}-seats`, field: `f-seats-${v._key}`,
      label: `Seats in ${label}`, done: Number(v.passengerCapacity) >= 1,
    }));
    items.push(of({
      id: `${v._key}-photo`, field: null,
      label: `A photo of ${label}`, done: (v.images?.length ?? 0) > 0,
    }));
    const priced = v.rates.length > 0
      && v.rates.every((r) => r.netRate !== "" && r.netRate !== null && Number(r.netRate) >= 0);
    items.push(of({
      id: `${v._key}-rates`, field: null,
      label: `Rates for ${label}`, done: priced,
    }));
  });

  return items;
}

/** Which section is on screen, so the nav can follow the scroll instead of the other way round. */
function useSectionSpy(ready) {
  const [active, setActive] = useState(SECTION_IDS[0]);
  useEffect(() => {
    if (!ready) return undefined;
    const nodes = SECTION_IDS.map((id) => document.getElementById(id)).filter(Boolean);
    if (!nodes.length) return undefined;

    const visible = new Set();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => (e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id)));
        // Topmost visible section in document order — a long section stays selected while it fills
        // the viewport, which is what makes the highlight feel stable rather than flickery.
        const first = SECTION_IDS.find((id) => visible.has(id));
        if (first) setActive(first);
      },
      { rootMargin: "-140px 0px -55% 0px" },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [ready]);
  return active;
}

const goToSection = (id) =>
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

/**
 * Take the operator to the exact input a checklist item is about, and put the caret in it.
 *
 * <p>Falls back to the section when the item has no single field — "a photo of Vehicle 2" is not a
 * text box. Centred rather than top-aligned because the sticky submit bar and the section nav both
 * eat screen edges, and a field scrolled to the very top can land underneath the header.</p>
 *
 * <p>The focus is deferred a frame: smooth scrolling and focus() fight, and focus() alone would jump
 * the page instantly and undo the animation the operator is using to keep their bearings.</p>
 */
const goToField = (item) => {
  const el = item?.field ? document.getElementById(item.field) : null;
  if (!el) { goToSection(item?.section); return; }
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => el.focus({ preventScroll: true }), 320);
};

/**
 * The three token failures that can never recover.
 *
 * A 500 or a dropped connection is worth retrying; these are not. Once the link is unknown, expired
 * or withdrawn, every subsequent autosave is a request that cannot succeed — and this realm is rate
 * limited, so a retry loop spends the operator's own budget on nothing.
 */
const TERMINAL_STATUSES = new Set([404, 409, 410]);

export default function TransportPartnerRegister() {
  const { token } = useParams();

  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState("");
  /** Set only when the link itself has expired — it gets its own screen, not a red box. */
  const [expired, setExpired] = useState(false);
  const [session, setSession] = useState(null);
  const [reviewerNote, setReviewerNote] = useState("");
  const [status, setStatus] = useState("");
  const [form, setForm] = useState(null);
  const [editable, setEditable] = useState(false);
  /** A terminal failure discovered mid-session. Stops the autosave; see {@link TERMINAL_STATUSES}. */
  const [linkDead, setLinkDead] = useState("");

  const [saveState, setSaveState] = useState("idle"); // idle | dirty | saving | saved | error
  const [saveError, setSaveError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  /* Fields go red only AFTER a submit has been refused — never while the form is being filled in.
     A blank form is not a wrong form, and opening a five-section registration already painted red
     tells the operator they have failed before they have started. */
  const [showErrors, setShowErrors] = useState(false);
  const [done, setDone] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => new Set());

  // Guards the autosave effect from firing on the initial hydration, which would POST the server's
  // own data straight back and mark a pristine form dirty.
  const hydrated = useRef(false);
  // Always the latest form, for callbacks that must not close over a stale render.
  const formRef = useRef(null);
  useEffect(() => { formRef.current = form; }, [form]);

  const ro = !editable;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await transportPartnerService.resolve(token);
        if (!alive) return;
        const hydratedForm = toForm(data.registration);
        setSession(data);
        setForm(hydratedForm);
        formRef.current = hydratedForm;
        setReviewerNote(data.registration?.reviewerNote ?? "");
        setStatus(data.registration?.status ?? "");
        setEditable(Boolean(data.editable));
        // APPROVED as well as SUBMITTED: both mean the operator is waiting on us rather than on
        // themselves, and neither should open a page that still says "submit".
        if (["SUBMITTED", "APPROVED"].includes(data.registration?.status)) setDone(true);
        // An operator with six vehicles should not open six expanded forms; two or three should not
        // make them tap anything to get started.
        if (hydratedForm.vehicles.length >= 3) {
          setCollapsed(new Set(hydratedForm.vehicles.map((v) => v._key)));
        }
      } catch (err) {
        if (!alive) return;
        // Expiry is the one failure with an action attached — it earns a screen of its own that
        // tells the operator what to do about it.
        if (isLinkExpired(err)) setExpired(true);
        else setFatal(partnerErrorMessage(err, "We could not open this registration link."));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [token]);

  /**
   * Saves run one at a time, chained.
   *
   * They used to be able to overlap on the hotel form — the debounce and the flush at Submit are
   * independent timers — and two concurrent whole-document rewrites of the same registration is
   * precisely the shape that makes the server's delete-then-reinsert collide on its unique indexes.
   * Serialising costs nothing here (a queued save simply sends the newer form) and removes the race.
   */
  const chain = useRef(Promise.resolve());
  const save = useCallback((next) => {
    const run = chain.current.catch(() => {}).then(async () => {
      setSaveState("saving");
      try {
        const dto = await transportPartnerService.saveDraft(token, toPayload(next));
        setSaveState("saved");
        setSaveError("");
        return dto;
      } catch (err) {
        // Never clobber what the operator typed. A failed save keeps the local state and says so —
        // re-hydrating from the server here would delete the very edit that failed to reach it.
        setSaveState("error");
        const message = partnerErrorMessage(err, "Could not save. Check your connection.");
        setSaveError(message);
        if (TERMINAL_STATUSES.has(err?.response?.status)) setLinkDead(message);
        return null;
      }
    });
    chain.current = run;
    return run;
  }, [token]);

  // Debounced autosave. 1.2s is long enough that typing a sentence is one request, short enough that
  // closing the tab mid-form rarely loses anything — and comfortably under the realm's rate limit.
  useEffect(() => {
    if (!form || !editable || linkDead) return undefined;
    if (!hydrated.current) { hydrated.current = true; return undefined; }
    setSaveState((s) => (s === "saving" ? s : "dirty"));
    const t = setTimeout(() => { save(form); }, 1200);
    return () => clearTimeout(t);
  }, [form, editable, linkDead, save]);

  // A half-filled form left on a phone is the common case, so warn before the tab closes on an
  // unsaved edit. Browsers show their own copy; the string only has to be non-empty.
  useEffect(() => {
    if (!editable) return undefined;
    const unsaved = saveState === "dirty" || saveState === "saving" || saveState === "error";
    if (!unsaved) return undefined;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [editable, saveState]);

  const patch = (changes) => setForm((f) => ({ ...f, ...changes }));

  /* ── vehicles ──────────────────────────────────────────────── */
  const toggleVehicle = (key) =>
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  const setVehicle = (i, changes) =>
    setForm((f) => ({ ...f, vehicles: f.vehicles.map((v, k) => (k === i ? { ...v, ...changes } : v)) }));

  const addVehicle = () =>
    setForm((f) => ({ ...f, vehicles: [...f.vehicles, BLANK_VEHICLE()] }));
  const removeVehicle = (i) =>
    setForm((f) => ({ ...f, vehicles: f.vehicles.filter((_, k) => k !== i) }));

  const setRate = (vi, ri, changes) =>
    setForm((f) => ({
      ...f,
      vehicles: f.vehicles.map((v, k) =>
        k !== vi ? v : { ...v, rates: v.rates.map((r, j) => (j === ri ? { ...r, ...changes } : r)) }),
    }));
  const addRate = (vi) =>
    setForm((f) => ({
      ...f,
      vehicles: f.vehicles.map((v, k) => (k === vi ? { ...v, rates: [...v.rates, nextFreeRate(v)] } : v)),
    }));
  const removeRate = (vi, ri) =>
    setForm((f) => ({
      ...f,
      vehicles: f.vehicles.map((v, k) => (k === vi ? { ...v, rates: v.rates.filter((_, j) => j !== ri) } : v)),
    }));

  /**
   * Enter walks to the next control; Ctrl/Cmd+Enter submits; Alt+V adds a vehicle.
   *
   * Not inside a textarea — a coverage note is prose and needs its newlines — and not on a button,
   * where Enter already means "press me". Read-only registrations are skipped entirely: a submitted
   * form has nothing to walk through.
   */
  const onFormKeyDown = (e) => {
    if (ro) return;
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); onSubmit(); return; }
    if (e.altKey && e.key.toLowerCase() === "v") { e.preventDefault(); addVehicle(); return; }
    if (e.key !== "Enter" || e.shiftKey) return;
    const tag = e.target.tagName;
    if (tag === "TEXTAREA" || tag === "BUTTON") return;
    e.preventDefault();
    const fields = [...e.currentTarget.querySelectorAll("input,select,textarea")]
      .filter((el) => !el.disabled && el.type !== "file" && el.offsetParent !== null);
    const next = fields[fields.indexOf(e.target) + 1];
    next?.focus();
    if (next?.select) next.select();
  };

  /** Upload one photo and hand the URL back to the uploader, which appends it to the right vehicle. */
  const uploadPhoto = useCallback(
    async (file, onProgress) => {
      try {
        return await transportPartnerService.uploadImage(token, file, onProgress);
      } catch (err) {
        // Rethrown as a plain Error so PhotoUploader can render the message inline, beside the
        // button that failed, rather than at the bottom of a long form.
        throw new Error(partnerErrorMessage(err, "Could not upload that photo."), { cause: err });
      }
    },
    [token],
  );

  /* ── photos ────────────────────────────────────────────────── */

  /**
   * Remove a photo from a vehicle, keeping the cover honest.
   *
   * <p>`primaryImageUrl` is a URL, not an index, and the server only elects one from the gallery when
   * the operator has picked NONE. Delete the photo the cover points at and the pointer survives as a
   * URL that is no longer in the vehicle's own images — a catalog tile showing a photo the gallery
   * does not contain. So dropping the cover re-elects the next photo, or clears it when none is
   * left, which puts the server back in charge of the choice.</p>
   */
  const removeVehiclePhoto = (vi, k) =>
    setForm((f) => ({
      ...f,
      vehicles: f.vehicles.map((v, idx) => {
        if (idx !== vi) return v;
        const images = v.images.filter((_, j) => j !== k);
        const droppedCover = v.primaryImageUrl && v.primaryImageUrl === v.images[k];
        return {
          ...v,
          images,
          primaryImageUrl: droppedCover ? (images[0] ?? "") : v.primaryImageUrl,
        };
      }),
    }));

  const onSubmit = async () => {
    setSubmitError("");
    setSubmitting(true);
    try {
      // Flush pending edits first — the debounce may not have fired, and submit validates what the
      // SERVER holds, not what is on screen. The chain guarantees this lands after any queued save.
      const saved = await save(formRef.current);
      if (!saved) { setSubmitting(false); return; }
      const dto = await transportPartnerService.submit(token);
      setForm(toForm(dto));
      setReviewerNote(dto?.reviewerNote ?? "");
      setStatus(dto?.status ?? "SUBMITTED");
      setEditable(false);
      setDone(true);
      setSheetOpen(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      /* Rendered VERBATIM. A refused submit comes back as one sentence listing every outstanding
         problem at once — "Name Vehicle 2. Enter how many passengers "Innova Crysta" seats. Add at
         least one photo of …" — because an operator listing eight vehicles must not have to submit
         eight times to learn about eight missing seat counts. Splitting or re-wording it here would
         throw away the only complete answer they get. */
      setSubmitError(partnerErrorMessage(err, "Could not submit. Please try again."));
      if (TERMINAL_STATUSES.has(err?.response?.status)) {
        setLinkDead(partnerErrorMessage(err, "This registration link is no longer active."));
      }
      /* Then mark the fields and go to the first one. The server's prose carries no field keys, and
         it does not need to: the checklist already computes the same list locally, item by item,
         with the id of the input each one is about. */
      setShowErrors(true);
      /* `checklist` is declared below this handler but read at call time, when it is assigned —
         and onSubmit is rebuilt every render, so this is always the current one. */
      const first = checklist.find((c) => !c.done);
      if (first) revealField(first);
    } finally {
      setSubmitting(false);
    }
  };

  const checklist = useMemo(() => (form ? buildChecklist(form) : []), [form]);
  const outstanding = checklist.filter((c) => !c.done);

  /**
   * Open whatever is hiding the field, then go to it.
   *
   * <p>A collapsed vehicle does not render its inputs at all, so "Seats in Vehicle 3" would point at
   * an id that is not in the document and quietly fall back to scrolling the fleet section — the
   * exact hunt this exists to end. Expand first, then defer a frame so the input exists before
   * anything tries to focus it.</p>
   */
  const revealField = useCallback((item) => {
    const key = item?.vehicleKey;
    if (key) {
      setCollapsed((s) => {
        if (!s.has(key)) return s;
        const next = new Set(s);
        next.delete(key);
        return next;
      });
    }
    requestAnimationFrame(() => goToField(item));
  }, []);

  /** Which checklist items are unmet, by field id — the map the inputs read to go red. */
  const fieldErrors = useMemo(() => {
    if (!showErrors) return {};
    return Object.fromEntries(
      outstanding.filter((c) => c.field).map((c) => [c.field, "Still needed"]));
  }, [showErrors, outstanding]);
  const doneCount = checklist.length - outstanding.length;
  const activeSection = useSectionSpy(Boolean(form) && !loading);

  /** Sections carrying unmet requirements, for the dot in the nav. */
  const pendingBySection = useMemo(() => {
    const map = {};
    outstanding.forEach((c) => { map[c.section] = (map[c.section] ?? 0) + 1; });
    return map;
  }, [outstanding]);

  /**
   * The sheet is phone-only because from `lg:` up the sidebar already shows the same list — there,
   * the useful action is to jump to the first thing still missing rather than open a duplicate of
   * something already on screen.
   */
  const openOutstanding = () => {
    if (!outstanding.length) return;
    if (window.matchMedia("(min-width: 1024px)").matches) revealField(outstanding[0]);
    else setSheetOpen(true);
  };

  const vehicleCount = form?.vehicles?.length ?? 0;
  const rateCount = useMemo(
    () => (form?.vehicles ?? []).reduce((n, v) => n + (v.rates?.length ?? 0), 0), [form]);
  /** Counted across the WHOLE registration — that is how the server counts it. */
  const photoCount = useMemo(
    () => (form?.vehicles ?? []).reduce((n, v) => n + (v.images?.length ?? 0), 0), [form]);
  const photosLeft = PHOTO_LIMITS.maxPhotos - photoCount;

  /**
   * Warn about an imminent expiry BEFORE an hour of typing, not after.
   *
   * The session carries `expiresAt` for exactly this: an expired link answers the next save with a
   * 410, and the worst moment to learn that is on top of a finished form.
   */
  const expiringSoon = useMemo(() => {
    if (!session?.expiresAt || !editable) return null;
    const at = new Date(session.expiresAt);
    if (Number.isNaN(at.getTime())) return null;
    const hours = (at.getTime() - Date.now()) / 3600000;
    return hours > 0 && hours <= 48
      ? at.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
      : null;
  }, [session, editable]);

  if (loading) {
    return <Centered><Loader2 className="mx-auto animate-spin text-slate-400" size={28} /></Centered>;
  }
  if (expired) {
    return (
      <Centered>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Clock className="mx-auto mb-3 rounded-full bg-amber-50 p-1.5 text-amber-500" size={34} />
          <h1 className="text-lg font-bold text-slate-900">This link has expired</h1>
          <p className="mt-1.5 text-[14px] leading-relaxed text-slate-600">
            Registration links are only valid for a few days. Please ask the person who invited you
            to send a new one — replying to their invitation email is the quickest way.
          </p>
          <p className="mt-3 text-[13px] text-slate-400">
            Anything you had already saved is kept, and the new link will open it.
          </p>
        </div>
      </Centered>
    );
  }
  if (fatal) {
    return (
      <Centered>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <X className="mx-auto mb-3 rounded-full bg-rose-50 p-1.5 text-rose-500" size={34} />
          <h1 className="text-lg font-bold text-slate-900">Link unavailable</h1>
          <p className="mt-1.5 text-[14px] text-slate-600">{fatal}</p>
        </div>
      </Centered>
    );
  }

  return (
    <Page>
      {/* ── Sticky chrome ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-screen-2xl items-center gap-3 px-4 py-3 sm:px-6">
          <Bus className="shrink-0 text-blue-600" size={20} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-extrabold text-slate-900">Register your fleet</h1>
            {session?.contactName && (
              <p className="truncate text-[12px] text-slate-500">Welcome, {session.contactName}</p>
            )}
          </div>
          <SaveBadge
            state={saveState}
            editable={editable}
            complete={outstanding.length === 0}
            onRetry={() => save(formRef.current)}
          />
        </div>

        {/* Section nav — chips on a phone, sidebar from lg: up (rendered once, hidden per breakpoint). */}
        {!done && (
          <nav className="-mb-px overflow-x-auto border-t border-slate-100 lg:hidden
                          [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-max gap-1 px-3 py-2">
              {SECTIONS.map((s) => (
                <button key={s.id} type="button" onClick={() => goToSection(s.id)}
                  className={`flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition ${
                    activeSection === s.id
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600"}`}>
                  {s.label}
                  {pendingBySection[s.id] && (
                    <span className={`grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold ${
                      activeSection === s.id ? "bg-white/25 text-white" : "bg-amber-400 text-amber-950"}`}>
                      {pendingBySection[s.id]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </nav>
        )}
      </header>

      <div className="mx-auto flex max-w-screen-2xl gap-8 px-4 py-5 sm:px-6">
        {/* ── Sidebar (laptop only) ───────────────────────────────────────── */}
        {!done && (
          <aside className="hidden w-60 shrink-0 lg:block">
            <div className="sticky top-24 space-y-5">
              <nav className="space-y-0.5">
                {SECTIONS.map((s) => (
                  <button key={s.id} type="button" onClick={() => goToSection(s.id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-semibold transition ${
                      activeSection === s.id
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-600 hover:bg-slate-100"}`}>
                    <span className="min-w-0 flex-1 truncate">{s.label}</span>
                    {pendingBySection[s.id] ? (
                      <span className="grid h-4 min-w-4 place-items-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-amber-950">
                        {pendingBySection[s.id]}
                      </span>
                    ) : (
                      <Check size={14} className="text-emerald-500" />
                    )}
                  </button>
                ))}
              </nav>

              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                <div className="mb-2 flex items-center justify-between text-[12px] font-bold text-slate-600">
                  <span>Ready to submit</span>
                  <span className="tabular-nums text-slate-400">{doneCount}/{checklist.length}</span>
                </div>
                <ProgressBar done={doneCount} total={checklist.length} />
                <ul className="mt-3 space-y-1.5">
                  {checklist.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => revealField(c)}
                        className="flex w-full items-start gap-2 text-left text-[12.5px] leading-snug">
                        <span className={`mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full ${
                          c.done ? "bg-emerald-500 text-white" : "border border-slate-300"}`}>
                          {c.done && <Check size={9} strokeWidth={3.5} />}
                        </span>
                        <span className={c.done ? "text-slate-400 line-through" : "font-medium text-slate-700"}>
                          {c.label}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>
        )}

        {/* ── Form ─────────────────────────────────────────────────────────── */}
        <main className="min-w-0 flex-1 space-y-4 pb-32 lg:pb-8" onKeyDown={onFormKeyDown}>
          {done && (
            <Notice tone="success">
              <strong>Thank you — we have your fleet details.</strong> Our team will review them and
              get in touch. You can keep this link to check back on what you sent.
            </Notice>
          )}

          {!done && status === "REJECTED" && (
            <Notice tone="error">
              <strong>This registration was not accepted.</strong>
              {reviewerNote && <div className="mt-1 whitespace-pre-wrap">{reviewerNote}</div>}
            </Notice>
          )}

          {!done && status !== "REJECTED" && reviewerNote && (
            <Notice tone="warn">
              <strong>Please update a few things:</strong>
              <div className="mt-1 whitespace-pre-wrap">{reviewerNote}</div>
            </Notice>
          )}

          {ro && !done && status !== "REJECTED" && (
            <Notice tone="info">This registration is being reviewed and cannot be edited.</Notice>
          )}

          {expiringSoon && (
            <Notice tone="warn">
              This link stops working on <strong>{expiringSoon}</strong>. Finish and submit before
              then, or ask for a new one — your saved answers are kept either way.
            </Notice>
          )}

          {/* Terminal: the autosave has stopped, so say so plainly rather than leaving a Retry button
              that can only fail. The fields stay enabled deliberately — nothing more can be saved,
              but the operator can still read and copy what they typed. */}
          {linkDead && (
            <Notice tone="error">
              <strong>{linkDead}</strong>
              <div className="mt-1">
                Saving has stopped. Please ask for a new registration link — anything you had already
                saved is kept, and the new link will open it.
              </div>
            </Notice>
          )}

          {!linkDead && saveState === "error" && saveError && (
            <Notice tone="error">
              <div className="flex flex-wrap items-center gap-3">
                <span className="min-w-0 flex-1">{saveError}</span>
                <Btn variant="ghost" size="sm" onClick={() => save(formRef.current)}>
                  <RotateCw size={14} /> Retry
                </Btn>
              </div>
            </Notice>
          )}

          {/* SECTION 1 of 2 — everything about the business, in one card.
              The four old headings are still here as group labels, because "which box is the phone
              number in" is a real question; they are just not four separate cards any more. Two
              columns from lg: each group is a handful of one-line fields, so a single column left a
              laptop scrolling past a lot of half-empty white before reaching the part that matters.
              Fields use the stacked label, not the wide Row label, because a 44-unit label gutter
              inside a half-width column leaves the input too narrow to read what you typed. */}
          <Card id="details" title="Your details"
            hint="A company or owner name, city and country are the only three we need before you can save. Everything else can wait.">
            <div className="grid gap-x-8 gap-y-7 lg:grid-cols-2">
              <Group title="Company">
                {/* "/ Owner name" is not a second field — it is the same column, labelled for who actually
                    fills it. Most of this trade is sole proprietors with no registered company, and a
                    box that only says "Company name" reads to them as "you cannot use this form".
                    They type their own name and everything downstream — the invite thread, the
                    review queue, the catalog supplier — is correct, because it was always "who we
                    contract with" and never "a registered entity". */}
                <Field label="Company name / Owner name" hint="required" error={fieldErrors["f-company"]}>
                  <input id="f-company" className={inputCls} value={form.companyName} disabled={ro}
                    maxLength={200} autoComplete="organization"
                    aria-invalid={Boolean(fieldErrors["f-company"])}
                    onChange={(e) => patch({ companyName: e.target.value })}
                    placeholder="Sai Travels, or Ramesh Sharma" />
                </Field>
                <Field label="About your fleet" hint="optional">
                  <textarea className={inputCls} rows={4} value={form.about} disabled={ro}
                    onChange={(e) => patch({ about: e.target.value })}
                    placeholder="How long you have operated, the kind of work you do, anything a travel agent should know." />
                </Field>
                <Field label="Website" hint="optional">
                  <input className={inputCls} type="url" inputMode="url" autoCapitalize="none"
                    maxLength={500} value={form.website} disabled={ro}
                    onChange={(e) => patch({ website: e.target.value })} placeholder="https://…" />
                </Field>
              </Group>

              <Group title="Where you are"
                hint="The city you are based in is how travel agents find your vehicles.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="City" hint="required" error={fieldErrors["f-city"]}>
                    <input id="f-city" className={inputCls} value={form.cityName} disabled={ro}
                      maxLength={120} autoComplete="address-level2"
                      aria-invalid={Boolean(fieldErrors["f-city"])}
                      onChange={(e) => patch({ cityName: e.target.value })} placeholder="Pune" />
                  </Field>
                  <Field label="Country code" hint="2–3 letters, e.g. IN" error={fieldErrors["f-country"]}>
                    <input id="f-country" className={inputCls} value={form.countryCode} disabled={ro} maxLength={3}
                      autoCapitalize="characters" autoComplete="country"
                      aria-invalid={Boolean(fieldErrors["f-country"])}
                      onChange={(e) => patch({ countryCode: e.target.value.toUpperCase() })} placeholder="IN" />
                  </Field>
                  <Field label="State / region">
                    <input className={inputCls} value={form.stateName} disabled={ro} maxLength={120}
                      autoComplete="address-level1"
                      onChange={(e) => patch({ stateName: e.target.value })} placeholder="Maharashtra" />
                  </Field>
                  <Field label="City / airport code" hint="optional">
                    <input className={inputCls} value={form.cityCode} disabled={ro} maxLength={20}
                      autoCapitalize="characters"
                      onChange={(e) => patch({ cityCode: e.target.value.toUpperCase() })} placeholder="PNQ" />
                  </Field>
                </div>
                <Field label="Office address" hint="optional">
                  <textarea className={inputCls} rows={2} value={form.address} disabled={ro}
                    maxLength={500} autoComplete="street-address"
                    onChange={(e) => patch({ address: e.target.value })} />
                </Field>
              </Group>

              <Group title="Contact" hint="Who we call when a booking needs confirming.">
                <Field label="Contact person">
                  <input className={inputCls} value={form.contactPerson} disabled={ro} maxLength={150}
                    autoComplete="name"
                    onChange={(e) => patch({ contactPerson: e.target.value })} placeholder="Ramesh Patil" />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Phone">
                    <input className={inputCls} type="tel" inputMode="tel" autoComplete="tel" maxLength={50}
                      value={form.phone} disabled={ro}
                      onChange={(e) => patch({ phone: e.target.value })} placeholder="+91 98765 43210" />
                  </Field>
                  <Field label="Email">
                    <input className={inputCls} type="email" inputMode="email" autoComplete="email"
                      autoCapitalize="none" maxLength={100} value={form.email} disabled={ro}
                      onChange={(e) => patch({ email: e.target.value })} placeholder="bookings@saitravels.com" />
                  </Field>
                </div>
              </Group>

              <Group title="Coverage & terms">
                <Field label="Where you run" hint="routes and corridors, in your own words">
                  <textarea className={inputCls} rows={3} value={form.coverageNote} disabled={ro}
                    onChange={(e) => patch({ coverageNote: e.target.value })}
                    placeholder="Anywhere in Maharashtra, Goa on request. Up to 300 km one way." />
                </Field>
                {/* The one number that decides whether a same-day airport transfer can be sent to
                    this fleet at all. Blank stays blank — defaulting it to 0 would manufacture a
                    promise the operator never made. */}
                <Field label="Notice you need" hint="leave blank to make no promise">
                  <div className="flex items-center gap-2">
                    <input className={`${inputCls} max-w-32`} type="number" min="0" step="1"
                      inputMode="numeric" value={form.noticeHours} disabled={ro}
                      onChange={(e) => patch({ noticeHours: e.target.value })} placeholder="12" />
                    <span className="text-[13px] font-medium text-slate-500">hours</span>
                  </div>
                </Field>
                <Field label="Cancellation terms" hint="optional">
                  <textarea className={inputCls} rows={3} value={form.cancellationPolicy} disabled={ro}
                    onChange={(e) => patch({ cancellationPolicy: e.target.value })}
                    placeholder="Free cancellation up to 24 hours before pickup. 50% within 12 hours…" />
                </Field>
              </Group>
            </div>
          </Card>

          <Card id="fleet" title="Vehicles & rates"
            hint="Each vehicle here becomes its own listing. Give us your net rate — what we pay you. Agents never see it."
            right={vehicleCount > 0 && (
              <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 text-[12px] font-bold text-slate-600">
                {vehicleCount} vehicle{vehicleCount === 1 ? "" : "s"} · {rateCount} rate{rateCount === 1 ? "" : "s"}
                {" · "}{photoCount}/{PHOTO_LIMITS.maxPhotos} photos
              </span>
            )}>
            {vehicleCount === 0 && (
              <p className="text-[13px] text-slate-400">No vehicles yet. Add at least one to submit.</p>
            )}

            {form.vehicles.map((vehicle, vi) => (
              <VehicleCard
                key={vehicle._key}
                vehicle={vehicle} index={vi} readOnly={ro}
                collapsed={collapsed.has(vehicle._key)}
                onToggle={() => toggleVehicle(vehicle._key)}
                onChange={(changes) => setVehicle(vi, changes)}
                onRemove={() => removeVehicle(vi)}
                onAddRate={() => addRate(vi)}
                onChangeRate={(ri, changes) => setRate(vi, ri, changes)}
                onRemoveRate={(ri) => removeRate(vi, ri)}
                onUploadPhoto={uploadPhoto}
                onRemovePhoto={(k) => removeVehiclePhoto(vi, k)}
                photosLeft={photosLeft}
                nameError={fieldErrors[`f-vehicle-${vehicle._key}`]}
                typeError={fieldErrors[`f-vtype-${vehicle._key}`]}
                seatsError={fieldErrors[`f-seats-${vehicle._key}`]}
              />
            ))}

            {!ro && (
              <Btn variant="ghost" onClick={addVehicle} className="w-full sm:w-auto">
                <Plus size={15} /> Add a vehicle
              </Btn>
            )}
          </Card>

          {submitError && <Notice tone="error">{submitError}</Notice>}
        </main>
      </div>

      {/* ── Submit bar ────────────────────────────────────────────────────── */}
      {!ro && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <ProgressBar done={doneCount} total={checklist.length} />
          <div className="mx-auto flex max-w-screen-2xl items-center gap-3 px-4 py-3 sm:px-6">
            <div className="min-w-0 flex-1">
              {outstanding.length === 0 ? (
                <p className="flex items-center gap-1.5 text-[13px] font-bold text-emerald-600">
                  <Check size={15} /> Everything we need is filled in
                </p>
              ) : (
                <button type="button" onClick={openOutstanding}
                  className="flex items-center gap-1.5 text-left text-[13px] font-bold text-slate-600">
                  <ListChecks size={15} className="shrink-0 text-amber-500" />
                  <span className="truncate">
                    {outstanding.length} thing{outstanding.length === 1 ? "" : "s"} left
                    <span className="ml-1 font-medium text-slate-400">· see what</span>
                  </span>
                </button>
              )}
            </div>
            <Btn onClick={onSubmit} busy={submitting} disabled={Boolean(linkDead)} className="shrink-0">
              <Send size={15} /> Submit for review
            </Btn>
          </div>
        </div>
      )}

      {/* What's-left sheet. The sidebar carries the same list from lg: up, so it stays phone-only. */}
      {sheetOpen && (
        <div className="fixed inset-0 z-40 flex items-end bg-slate-900/40 lg:hidden"
          onClick={() => setSheetOpen(false)}>
          <div className="max-h-[70vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4"
            style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-slate-900">Still to fill in</h2>
              <button type="button" onClick={() => setSheetOpen(false)} aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <ul className="space-y-1">
              {outstanding.map((c) => (
                <li key={c.id}>
                  <button type="button"
                    onClick={() => { setSheetOpen(false); revealField(c); }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-3 text-left text-[14px]
                               font-medium text-slate-700 hover:bg-slate-50">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                    <span className="min-w-0 flex-1">{c.label}</span>
                    <span className="shrink-0 text-[12px] font-semibold text-blue-600">Go</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Page>
  );
}

/**
 * One vehicle, collapsible.
 *
 * Collapsed vehicles show the line an operator actually scans for — name, type, seats, how many
 * rates — so a fleet of eight is navigable without expanding all eight.
 */
function VehicleCard({
  vehicle, index, readOnly, collapsed, onToggle, onChange, onRemove,
  onAddRate, onChangeRate, onRemoveRate, onUploadPhoto, onRemovePhoto, photosLeft,
  nameError, typeError, seatsError,
}) {
  const [amenityDraft, setAmenityDraft] = useState("");

  const hasAmenity = (v) => (vehicle.amenities ?? []).some((a) => a.toLowerCase() === v.toLowerCase());
  const toggleAmenity = (v) =>
    onChange({
      amenities: hasAmenity(v)
        ? vehicle.amenities.filter((a) => a.toLowerCase() !== v.toLowerCase())
        : [...vehicle.amenities, v],
    });
  const addAmenity = () => {
    const v = amenityDraft.trim();
    if (!v) return;
    if (!hasAmenity(v)) toggleAmenity(v);
    setAmenityDraft("");
  };

  /**
   * (Service type, rate model) pairs used more than once. The DB allows one live rate per pair and
   * the server silently keeps the LAST one, so this has to be visible while it is still fixable
   * rather than after a row quietly vanishes on the next reload.
   */
  const duplicateKeys = useMemo(() => {
    const seen = new Set();
    const dupes = new Set();
    vehicle.rates.forEach((r) => {
      const k = `${r.serviceType}|${r.rateModel}`;
      if (seen.has(k)) dupes.add(k); else seen.add(k);
    });
    return dupes;
  }, [vehicle.rates]);

  const priced = vehicle.rates.filter((r) => r.netRate !== "" && r.netRate !== null);
  const cheapest = priced.length ? Math.min(...priced.map((r) => Number(r.netRate))) : null;
  const customAmenities = (vehicle.amenities ?? [])
    .filter((a) => !COMMON_AMENITIES.some((c) => c.toLowerCase() === a.toLowerCase()));
  const cover = coverOf(vehicle);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/60">
      <div className="flex items-center gap-2 p-3 sm:px-4">
        <button type="button" onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
          <ChevronDown size={16}
            className={`shrink-0 text-slate-400 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
          {/* The vehicle's own cover photo, not a generic icon. A fleet is a list of things that all
              read as "SUV, 6 seats" in text and are told apart instantly by their picture — and the
              operator has already uploaded one, because submit requires it. The empty box is kept
              the same size as the thumbnail so a fleet with mixed photo states does not stagger. */}
          {cover ? (
            <img src={cover} alt=""
              className="h-9 w-12 shrink-0 rounded-md object-cover ring-1 ring-slate-200" />
          ) : (
            <span className="grid h-9 w-12 shrink-0 place-items-center rounded-md bg-slate-200/70 text-slate-400">
              <Car size={16} />
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-[13.5px] font-bold text-slate-700">
              {vehicle.name?.trim() || `Vehicle ${index + 1}`}
            </span>
            {collapsed && (
              <span className="block truncate text-[12px] text-slate-500">
                {[
                  vehicle.vehicleType?.trim(),
                  Number(vehicle.passengerCapacity) >= 1 ? `${vehicle.passengerCapacity} seats` : null,
                  `${vehicle.rates.length} rate${vehicle.rates.length === 1 ? "" : "s"}`,
                  cheapest !== null ? `from ${cheapest.toLocaleString("en-IN")}` : null,
                ].filter(Boolean).join(" · ")}
              </span>
            )}
          </span>
        </button>
        {!readOnly && (
          <button type="button" onClick={onRemove} aria-label={`Remove vehicle ${index + 1}`}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-white hover:text-rose-600">
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="space-y-3 border-t border-slate-200 p-3.5 sm:p-4">
          <Row label="What you sell it as" required error={nameError}
            hint="The name an agent sees — not a number plate">
            <input id={`f-vehicle-${vehicle._key}`} className={inputCls} value={vehicle.name}
              disabled={readOnly} maxLength={200} aria-invalid={Boolean(nameError)}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="6-Seater SUV (AC)" />
          </Row>

          <div className="grid gap-3 sm:grid-cols-2">
            {/* A text input with suggestions, NOT a select — `vehicleType` is a free string on the
                backend so an operator can name their own segment, and a select whose options lack
                the stored value rewrites it on the next save. See COMMON_VEHICLE_TYPES. */}
            <Field label="Vehicle type" hint="required" error={typeError}>
              <input id={`f-vtype-${vehicle._key}`} className={inputCls} value={vehicle.vehicleType}
                disabled={readOnly} maxLength={100} list={`vtypes-${vehicle._key}`}
                aria-invalid={Boolean(typeError)}
                onChange={(e) => onChange({ vehicleType: e.target.value })}
                placeholder="SUV" />
              <datalist id={`vtypes-${vehicle._key}`}>
                {COMMON_VEHICLE_TYPES.map((t) => <option key={t} value={t} />)}
              </datalist>
            </Field>
            <Field label="Air conditioning">
              <TriState value={vehicle.airConditioned} disabled={readOnly}
                unset="Not specified" yes="Air-conditioned" no="Non-AC"
                onChange={(v) => onChange({ airConditioned: v })} />
            </Field>
          </div>

          {/* Who owns THIS one. Optional, and the hints carry why: a fleet is normally part owned
              and part attached, and for the attached half the ops desk needs a name of its own.
              Blank is a real answer meaning "mine" — it is never back-filled from the company name
              in the section above, because that would put an ownership claim in the record that
              nobody made. So no nag paragraph here either, unlike the seat count below: that one is
              required, this one is not. */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Owner company" hint="blank if it's your own">
              <input className={inputCls} value={vehicle.ownerCompanyName} disabled={readOnly}
                maxLength={200}
                onChange={(e) => onChange({ ownerCompanyName: e.target.value })}
                placeholder="Sharma Travels" />
            </Field>
            <Field label="Owner name" hint="who we call about this vehicle">
              <input className={inputCls} value={vehicle.ownerName} disabled={readOnly}
                maxLength={150}
                onChange={(e) => onChange({ ownerName: e.target.value })}
                placeholder="Ramesh Sharma" />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Passenger seats" hint="not counting the driver" error={seatsError}>
              <Stepper id={`f-seats-${vehicle._key}`} value={vehicle.passengerCapacity}
                min={1} max={80} disabled={readOnly} invalid={Boolean(seatsError)}
                onChange={(v) => onChange({ passengerCapacity: v })} />
            </Field>
            <Field label="Suitcases" hint="with the seats full">
              <Stepper value={vehicle.luggageCapacity} min={0} max={80} disabled={readOnly}
                onChange={(v) => onChange({ luggageCapacity: v })} />
            </Field>
          </div>

          {/* Said once, here, next to the field — because it is the requirement most likely to look
              arbitrary and it is the one that blocks publication two steps later. */}
          {!readOnly && !(Number(vehicle.passengerCapacity) >= 1) && (
            <p className="text-[12.5px] leading-relaxed text-slate-500">
              We cannot list a vehicle without a seat count: agents search and quote on that number,
              so a vehicle nobody can size never gets chosen for a family of six.
            </p>
          )}

          <Field label="Description">
            <textarea className={inputCls} rows={2} value={vehicle.description} disabled={readOnly}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="2022 Innova Crysta, push-back seats, ample boot space…" />
          </Field>

          {/* ── Amenities ───────────────────────────────────────── */}
          <FieldBlock label="What's on board" hint="optional">
            <div className="flex flex-wrap gap-2">
              {COMMON_AMENITIES.map((a) => (
                <Chip key={a} on={hasAmenity(a)} disabled={readOnly} onClick={() => toggleAmenity(a)}>
                  {hasAmenity(a) && <Check size={13} className="mr-1 inline" />}{a}
                </Chip>
              ))}
            </div>

            {customAmenities.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {customAmenities.map((a) => (
                  <span key={a}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-slate-100 px-3.5 text-[13px] font-semibold text-slate-700">
                    {a}
                    {!readOnly && (
                      <button type="button" aria-label={`Remove ${a}`}
                        className="text-slate-400 transition hover:text-rose-500"
                        onClick={() => toggleAmenity(a)}>
                        <X size={14} />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}

            {!readOnly && (
              <div className="mt-2 flex gap-2">
                <input className={inputCls} value={amenityDraft} placeholder="Something else…"
                  onChange={(e) => setAmenityDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAmenity(); } }} />
                <Btn variant="ghost" onClick={addAmenity} disabled={!amenityDraft.trim()}>
                  <Plus size={15} /> Add
                </Btn>
              </div>
            )}
          </FieldBlock>

          {/* ── Photos ──────────────────────────────────────────── */}
          <FieldBlock label="Photos" hint="at least one">
            {!readOnly && vehicle.images.length === 0 && (
              <Notice tone="warn">
                Every vehicle needs a photo. The catalog shows one cover image per vehicle, so the
                first photo — or whichever you make the cover — is what a travel agent actually sees.
              </Notice>
            )}
            <div className="mt-2">
              <PhotoUploader
                images={vehicle.images}
                disabled={readOnly}
                showMainBadge
                mainUrl={vehicle.primaryImageUrl}
                remaining={photosLeft}
                accept={PHOTO_LIMITS.accept}
                hint={`${PHOTO_LIMITS.hint} · ${Math.max(0, photosLeft)} left for this registration`}
                onUpload={onUploadPhoto}
                onAdd={(url) => onChange({ images: [...vehicle.images, url] })}
                onRemove={onRemovePhoto}
                onMakeMain={(k) => onChange({ primaryImageUrl: vehicle.images[k] })}
              />
            </div>
          </FieldBlock>

          {/* ── Rates ───────────────────────────────────────────── */}
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <span className="text-[12px] font-bold uppercase tracking-wide text-slate-500">
                Net rates
              </span>
              {!readOnly && (
                <Btn variant="ghost" size="sm" onClick={onAddRate}>
                  <Plus size={13} /> Add rate
                </Btn>
              )}
            </div>

            {/* Stated once per vehicle: the pair below is the KEY, not two independent dropdowns.
                One line per journey type and pricing method is the whole model, and an operator who
                does not know that will try to add two per-km outstation rows and lose one. */}
            <p className="mb-2.5 text-[12px] leading-relaxed text-slate-500">
              One line per kind of journey and how you price it — an airport run at a flat fee and an
              outstation run per kilometre are two lines, not one.
            </p>

            <div className="space-y-2.5">
              {vehicle.rates.map((rate, ri) => (
                <RateRow
                  key={rate._key}
                  rate={rate} index={ri} readOnly={readOnly}
                  duplicate={duplicateKeys.has(`${rate.serviceType}|${rate.rateModel}`)}
                  onChange={(changes) => onChangeRate(ri, changes)}
                  onRemove={() => onRemoveRate(ri)}
                />
              ))}

              {vehicle.rates.length === 0 && (
                <p className="text-[13px] text-slate-400">Add at least one rate.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * One priced line: a journey type, how it is priced, and what that price already covers.
 *
 * The extras (included km/hours and what runs beyond them) are separate fields rather than prose
 * because that is where a transport bill actually diverges from the quote — the trip runs sixty
 * kilometres over, the driver stays out overnight. Structured, whoever approves the amendment can
 * see the agreed unit instead of re-reading an inclusions paragraph and guessing.
 */
function RateRow({ rate, index, readOnly, duplicate, onChange, onRemove }) {
  const unit = modelUnit(rate.rateModel);
  return (
    <div className={`rounded-xl border p-3 ${
      duplicate ? "border-amber-300 bg-amber-50/60" : "border-slate-200 bg-slate-50/70"}`}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[12px] font-bold text-slate-500">
          {serviceLabel(rate.serviceType)} · {modelLabel(rate.rateModel)}
        </span>
        {!readOnly && (
          <button type="button" onClick={onRemove} aria-label={`Remove rate ${index + 1}`}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-white hover:text-rose-600">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-12">
        <Field label="Kind of journey" className="lg:col-span-4">
          <select className={inputCls} value={rate.serviceType} disabled={readOnly}
            onChange={(e) => onChange({ serviceType: e.target.value })}>
            {SERVICE_TYPES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </Field>
        <Field label="How you price it" className="lg:col-span-3">
          <select className={inputCls} value={rate.rateModel} disabled={readOnly}
            onChange={(e) => onChange({ rateModel: e.target.value })}>
            {RATE_MODELS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </Field>
        {/* The label carries the unit. "Net rate: 4000" is four different amounts of money depending
            on the model beside it, and only the operator knows which they meant. */}
        <Field label={`Net ${unit}`} hint="we pay you" className="lg:col-span-3">
          <input className={inputCls} type="number" min="0" step="0.01" inputMode="decimal"
            value={rate.netRate} disabled={readOnly} placeholder="4000"
            onChange={(e) => onChange({ netRate: e.target.value })} />
        </Field>
        <Field label="Currency" className="lg:col-span-2">
          <select className={inputCls} value={rate.currency} disabled={readOnly}
            onChange={(e) => onChange({ currency: e.target.value })}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>

      {rate.rateModel === "CUSTOM_QUOTE" && (
        <p className="mt-2 text-[12px] leading-relaxed text-slate-500">
          Even a quoted-each-time line needs a figure before you can submit — put your usual starting
          price here and say what changes it in the inclusions box below.
        </p>
      )}

      <div className="mt-2.5 grid gap-2.5 sm:grid-cols-3">
        <Field label="Included km" hint="optional">
          <input className={inputCls} type="number" min="0" step="1" inputMode="numeric"
            value={rate.includedKm} disabled={readOnly} placeholder="80"
            onChange={(e) => onChange({ includedKm: e.target.value })} />
        </Field>
        <Field label="Beyond that, per km">
          <input className={inputCls} type="number" min="0" step="0.01" inputMode="decimal"
            value={rate.extraKmRate} disabled={readOnly} placeholder="14"
            onChange={(e) => onChange({ extraKmRate: e.target.value })} />
        </Field>
        <Field label="Driver allowance" hint="per day">
          <input className={inputCls} type="number" min="0" step="0.01" inputMode="decimal"
            value={rate.driverAllowance} disabled={readOnly} placeholder="300"
            onChange={(e) => onChange({ driverAllowance: e.target.value })} />
        </Field>
        <Field label="Included hours" hint="optional">
          <input className={inputCls} type="number" min="0" step="1" inputMode="numeric"
            value={rate.includedHours} disabled={readOnly} placeholder="8"
            onChange={(e) => onChange({ includedHours: e.target.value })} />
        </Field>
        <Field label="Beyond that, per hour">
          <input className={inputCls} type="number" min="0" step="0.01" inputMode="decimal"
            value={rate.extraHourRate} disabled={readOnly} placeholder="150"
            onChange={(e) => onChange({ extraHourRate: e.target.value })} />
        </Field>
        <Field label="Night halt" hint="driver stays out">
          <input className={inputCls} type="number" min="0" step="0.01" inputMode="decimal"
            value={rate.nightHalt} disabled={readOnly} placeholder="400"
            onChange={(e) => onChange({ nightHalt: e.target.value })} />
        </Field>
      </div>

      <div className="mt-2.5 grid gap-2.5 lg:grid-cols-3">
        <Field label="What this rate covers" hint="optional" className="lg:col-span-2">
          <textarea className={inputCls} rows={2} value={rate.inclusionsText} disabled={readOnly}
            onChange={(e) => onChange({ inclusionsText: e.target.value })}
            placeholder="Fuel, tolls and parking included. State permits extra at actuals." />
        </Field>
        <Field label="Your rate code" hint="optional">
          <input className={inputCls} value={rate.rateCode ?? ""} disabled={readOnly} maxLength={50}
            placeholder="SUV-AIR-FLAT"
            onChange={(e) => onChange({ rateCode: e.target.value })} />
        </Field>
      </div>

      {duplicate && (
        <p className="mt-2 text-[12px] font-semibold text-amber-700">
          Another line already covers {serviceLabel(rate.serviceType)} · {modelLabel(rate.rateModel)}.
          Only the last one will be kept — change the journey or the pricing method.
        </p>
      )}
    </div>
  );
}

/** Autosave status. Silent when idle — a permanent "Saved" badge is noise, an error is not. */
function SaveBadge({ state, editable, complete, onRetry }) {
  if (!editable) return null;
  if (state === "saving") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-[12px] text-slate-500">
        <Loader2 size={12} className="animate-spin" /> Saving
      </span>
    );
  }
  /* "Draft saved", not "Saved", and slate rather than emerald when the form is still incomplete.
     Green next to an empty form is a lie by tone: it answers "did the autosave reach the server"
     while the operator reads it as "this is done". They are different facts, and the one they care
     about is the checklist. Emerald is kept for the case where both are true. */
  if (state === "saved") {
    return (
      <span
        className={`inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold ${
          complete ? "text-emerald-600" : "text-slate-500"
        }`}
        title={complete
          ? "Saved, and everything we need is filled in"
          : "Your progress is saved — but the form is not finished yet"}
      >
        <Check size={12} /> Draft saved
      </span>
    );
  }
  if (state === "error") {
    return (
      <button type="button" onClick={onRetry}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold
                   text-rose-600 transition hover:bg-rose-50">
        <CloudOff size={12} /> Not saved · Retry
      </button>
    );
  }
  return null;
}

/**
 * A labelled group of fields inside the single "Your details" card.
 *
 * <p>These four used to be four {@code Card}s. They are still worth naming — an operator looking for
 * the phone number wants a heading to aim at — but a heading is not the same thing as a milestone,
 * and rendering them as separate cards told the operator this form had four parts before the fleet
 * when it really has one. So the labels survived and the boxes did not.</p>
 */
function Group({ title, hint, children }) {
  return (
    <div className="min-w-0">
      <h3 className="text-[12px] font-bold uppercase tracking-wide text-slate-400">{title}</h3>
      {hint && <p className="mt-0.5 text-[12px] leading-snug text-slate-500">{hint}</p>}
      <div className="mt-3 space-y-4">{children}</div>
    </div>
  );
}
