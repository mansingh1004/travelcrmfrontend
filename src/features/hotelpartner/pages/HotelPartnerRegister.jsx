import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  BedDouble, Check, ChevronDown, CloudOff, Hotel, ListChecks, Loader2, Plus,
  RotateCw, Send, Trash2, X,
} from "lucide-react";
import { hotelPartnerService, partnerErrorMessage } from "../api/hotelPartnerService";
import {
  Btn, Card, Centered, Chip, Field, Notice, Page, PhotoUploader, ProgressBar, Row, Stars,
  Stepper, inputCls,
} from "../components/partnerUi";
import GoogleListingPicker from "../components/GoogleListingPicker";

/* ── Vocabulary. Mirrors the backend enums exactly; a mismatch here is a silent data loss. ── */
/* Wording matches MealPlanCode.defaultLabel on the backend CHARACTER FOR CHARACTER, so the partner
   form, the console editor and the review page all say the same thing about the same code. It had
   drifted to sentence case here, which is how "Breakfast + 1 meal" and "Breakfast + 1 Meal" end up
   looking like two different plans on two screens. */
const MEAL_PLANS = [
  { code: "EP", label: "Room Only" },
  { code: "CP", label: "Breakfast" },
  { code: "MAP", label: "Breakfast + 1 Meal" },
  { code: "AP", label: "All Meals" },
  { code: "CUSTOM", label: "Custom" },
];
const OCCUPANCY = [
  { value: "SINGLE", label: "Single" },
  { value: "DOUBLE", label: "Double" },
  { value: "TRIPLE", label: "Triple" },
  { value: "EXTRA_BED", label: "Extra bed" },
  { value: "CHILD_WITH_BED", label: "Child (with bed)" },
  { value: "CHILD_NO_BED", label: "Child (no bed)" },
];
const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "THB", "SGD"];

const mealLabel = (code) => MEAL_PLANS.find((m) => m.code === code)?.label ?? code;
const occLabel = (value) => OCCUPANCY.find((o) => o.value === value)?.label ?? value;

/** The order a free (meal plan, occupancy) slot is searched in — see {@link nextFreeRate}. */
const OCCUPANCY_PREFERENCE = ["DOUBLE", "SINGLE", "TRIPLE", "EXTRA_BED", "CHILD_WITH_BED", "CHILD_NO_BED"];

/**
 * What a hotel almost always ticks. Typing "Air conditioning" on a phone keyboard is the single
 * slowest thing on this form, and these fifteen cover most of what a listing needs.
 */
const COMMON_AMENITIES = [
  "Free WiFi", "Air conditioning", "Swimming pool", "Restaurant", "Parking", "Room service",
  "Gym", "Spa", "Bar", "Elevator", "Laundry", "Power backup", "Airport shuttle",
  "Pet friendly", "Wheelchair access",
];

const SECTIONS = [
  { id: "details", label: "Hotel details" },
  { id: "location", label: "Location" },
  { id: "contact", label: "Contact" },
  { id: "policies", label: "Policies" },
  { id: "amenities", label: "Amenities" },
  { id: "photos", label: "Photos" },
  { id: "meals", label: "Meal plans" },
  { id: "rooms", label: "Rooms & rates" },
];
const SECTION_IDS = SECTIONS.map((s) => s.id);

/**
 * Client-only row identity.
 *
 * The server rebuilds rooms and rates wholesale on every save, so nothing coming back is stable
 * enough to key React on — and an array index breaks the moment a room is deleted from the middle,
 * taking the open/closed state of every room below it with it. `_key` is stripped before the
 * payload leaves {@link toPayload}.
 */
let seq = 0;
const newKey = () => `k${++seq}`;

const BLANK_RATE = {
  mealPlanCode: "CP", occupancyBasis: "DOUBLE", netRate: "",
  currency: "INR", refundable: null, rateCode: "",
};

/**
 * A new room starts with one rate row per meal plan the property already ticked.
 *
 * The price of a meal plan IS a rate row — (room × meal plan × occupancy) → net rate. Putting a
 * second "supplement" price on the meal plan itself would create two sources of truth for the same
 * money, which is the one ambiguous-price mistake the pricing model exists to avoid. Seeding the
 * rows instead makes that structure obvious without duplicating it.
 */
const BLANK_ROOM = (mealPlanCodes = []) => ({
  _key: newKey(),
  name: "", maxAdults: 2, maxChildren: 1, maxOccupancy: 3, bedType: "", size: "",
  description: "", active: true, images: [],
  rates: (mealPlanCodes.length ? mealPlanCodes : ["CP"])
    .map((code) => ({ ...BLANK_RATE, mealPlanCode: code, _key: newKey() })),
});

/**
 * The first (meal plan, occupancy) pair this room has not used yet.
 *
 * `uq_hp_rate_room_meal_occupancy` allows one live rate per pair, so seeding every "Add rate" with
 * CP/DOUBLE guaranteed a duplicate the second time it was pressed. Meal plan varies inside the
 * preferred occupancy because a second rate is far more often "the same room on a different board"
 * than "the same board at a different occupancy".
 */
function nextFreeRate(room, offeredCodes) {
  const taken = new Set((room.rates ?? []).map((t) => `${t.mealPlanCode}|${t.occupancyBasis}`));
  const codes = offeredCodes.length ? offeredCodes : MEAL_PLANS.map((m) => m.code);
  for (const occupancyBasis of OCCUPANCY_PREFERENCE) {
    for (const mealPlanCode of codes) {
      if (!taken.has(`${mealPlanCode}|${occupancyBasis}`)) {
        return { ...BLANK_RATE, mealPlanCode, occupancyBasis, _key: newKey() };
      }
    }
  }
  return { ...BLANK_RATE, _key: newKey() };
}

/** Server DTO → form state. Every field is a controlled input, so null must become "". */
function toForm(dto) {
  return {
    name: dto?.name ?? "",
    countryCode: dto?.countryCode ?? "",
    stateName: dto?.stateName ?? "",
    cityName: dto?.cityName ?? "",
    cityCode: dto?.cityCode ?? "",
    address: dto?.address ?? "",
    latitude: dto?.latitude ?? "",
    longitude: dto?.longitude ?? "",
    stars: dto?.stars ?? "",
    rating: dto?.rating ?? "",
    website: dto?.website ?? "",
    mapUrl: dto?.mapUrl ?? "",
    // Round-trips like every other field. `toPayload` spreads the whole form, so a key missing here
    // is a key the next whole-document save writes back as absent — the way `rateCode` was lost.
    googlePlaceId: dto?.googlePlaceId ?? "",
    overview: dto?.overview ?? "",
    phone: dto?.phone ?? "",
    email: dto?.email ?? "",
    checkInTime: dto?.checkInTime ?? "",
    checkOutTime: dto?.checkOutTime ?? "",
    childPolicy: dto?.childPolicy ?? "",
    cancellationPolicy: dto?.cancellationPolicy ?? "",
    amenities: dto?.amenities ?? [],
    images: dto?.images ?? [],
    mealPlans: (dto?.mealPlans ?? []).map((m) => ({
      code: m.code, name: m.name ?? "", description: m.description ?? "", active: m.active !== false,
    })),
    rooms: (dto?.rooms ?? []).map((r) => ({
      _key: newKey(),
      name: r.name ?? "", maxAdults: r.maxAdults ?? "", maxChildren: r.maxChildren ?? "",
      maxOccupancy: r.maxOccupancy ?? "", bedType: r.bedType ?? "", size: r.size ?? "",
      description: r.description ?? "", active: r.active !== false, images: r.images ?? [],
      rates: (r.rates ?? []).map((t) => ({
        _key: newKey(),
        mealPlanCode: t.mealPlanCode ?? "EP", occupancyBasis: t.occupancyBasis ?? "DOUBLE",
        netRate: t.netRate ?? "", currency: t.currency ?? "INR", refundable: t.refundable ?? null,
        // Was missing, and the omission was destructive rather than cosmetic: the input fell back to
        // "", and the next whole-document save wrote that blank back over the stored rate code.
        rateCode: t.rateCode ?? "",
      })),
    })),
  };
}

/** Form state → request body. Blank numerics become null so the backend stores absence, not 0. */
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
    latitude: num(f.latitude),
    longitude: num(f.longitude),
    stars: num(f.stars),
    rating: num(f.rating),
    mealPlans: f.mealPlans,
    rooms: f.rooms.map((r) => ({
      ...stripKey(r),
      maxAdults: num(r.maxAdults),
      maxChildren: num(r.maxChildren),
      maxOccupancy: num(r.maxOccupancy),
      rates: r.rates.map((t) => ({ ...stripKey(t), netRate: num(t.netRate) })),
    })),
  };
}

/**
 * Everything the backend will refuse to submit without, evaluated live.
 *
 * Deliberately a mirror of `HotelPartnerRegistrationService.validateForSubmit` and NOT a gate: the
 * server stays the only authority, so if the two ever drift the owner is told by the server rather
 * than blocked by a stale copy of its rules. What this buys is that they find out while they are
 * still in the section, instead of after pressing Submit at the bottom of a very long page.
 */
/**
 * Every item carries `field` — the DOM id of the exact input that satisfies it.
 *
 * <p>Naming what is missing was never the gap; the checklist has always said "Name for room 2".
 * The gap was that clicking it dropped the owner at the TOP of a section holding four rooms and
 * left them to find it. A section is an address; a field is a destination.</p>
 *
 * <p>Items with no single input to point at (a photo, a whole room) keep `field: null` and fall
 * back to scrolling the section, which is the honest answer for them.</p>
 */
function buildChecklist(form) {
  const items = [
    { id: "name", label: "Hotel name", section: "details", field: "f-name", done: Boolean(form.name?.trim()) },
    { id: "city", label: "City", section: "location", field: "f-city", done: Boolean(form.cityName?.trim()) },
    { id: "country", label: "Country code", section: "location", field: "f-country", done: Boolean(form.countryCode?.trim()) },
    { id: "photo", label: "At least one hotel photo", section: "photos", field: null, done: form.images.length > 0 },
    { id: "rooms", label: "At least one room", section: "rooms", field: null, done: form.rooms.length > 0 },
  ];

  form.rooms.forEach((room, i) => {
    const label = room.name?.trim() || `Room ${i + 1}`;
    items.push({
      id: `${room._key}-name`, section: "rooms", field: `f-room-${room._key}`,
      label: `Name for room ${i + 1}`, done: Boolean(room.name?.trim()),
    });
    const priced = room.rates.length > 0
      && room.rates.every((t) => t.netRate !== "" && t.netRate !== null && Number(t.netRate) >= 0);
    items.push({
      id: `${room._key}-rates`, section: "rooms",
      label: `Rates for ${label}`, done: priced,
    });
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
 * Take the owner to the exact input a checklist item is about, and put the caret in it.
 *
 * <p>Falls back to the section when the item has no single field — "at least one photo" is not a
 * text box. Centred rather than top-aligned because the sticky submit bar and the section nav both
 * eat screen edges, and a field scrolled to the very top can land underneath the header.</p>
 *
 * <p>The focus is deferred a frame: smooth scrolling and focus() fight, and focus() alone would
 * jump the page instantly and undo the animation the owner is using to keep their bearings.</p>
 */
const goToField = (item) => {
  const el = item?.field ? document.getElementById(item.field) : null;
  if (!el) { goToSection(item?.section); return; }
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => el.focus({ preventScroll: true }), 320);
};

export default function HotelPartnerRegister() {
  const { token } = useParams();

  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState("");
  const [session, setSession] = useState(null);
  const [reviewerNote, setReviewerNote] = useState("");
  const [form, setForm] = useState(null);
  const [editable, setEditable] = useState(false);

  const [saveState, setSaveState] = useState("idle"); // idle | dirty | saving | saved | error
  const [saveError, setSaveError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  /* Fields go red only AFTER a submit has been refused — never while the form is being filled in.
     A blank form is not a wrong form, and opening an eight-section registration already painted red
     tells the owner they have failed before they have started. */
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

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await hotelPartnerService.resolve(token);
        if (!alive) return;
        const hydratedForm = toForm(data.registration);
        setSession(data);
        setForm(hydratedForm);
        formRef.current = hydratedForm;
        setReviewerNote(data.registration?.reviewerNote ?? "");
        setEditable(Boolean(data.editable));
        if (data.registration?.status === "SUBMITTED") setDone(true);
        // A property with eight room types should not open as eight expanded forms; two or three
        // should not make the owner tap anything to get started.
        if (hydratedForm.rooms.length >= 3) {
          setCollapsed(new Set(hydratedForm.rooms.map((r) => r._key)));
        }
      } catch (err) {
        if (alive) setFatal(partnerErrorMessage(err, "We could not open this registration link."));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [token]);

  /**
   * Saves run one at a time, chained.
   *
   * They used to be able to overlap — the 1.2s debounce and the flush at Submit are independent
   * timers — and two concurrent whole-document rewrites of the same registration is precisely the
   * shape that makes the server's delete-then-reinsert collide on its unique indexes. Serialising
   * costs nothing here (a queued save simply sends the newer form) and removes the race entirely.
   */
  const chain = useRef(Promise.resolve());
  const save = useCallback((next) => {
    const run = chain.current.catch(() => {}).then(async () => {
      setSaveState("saving");
      try {
        const dto = await hotelPartnerService.saveDraft(token, toPayload(next));
        setSaveState("saved");
        setSaveError("");
        return dto;
      } catch (err) {
        // Never clobber what the owner typed. A failed save keeps the local state and says so —
        // re-hydrating from the server here would delete the very edit that failed to reach it.
        setSaveState("error");
        setSaveError(partnerErrorMessage(err, "Could not save. Check your connection."));
        return null;
      }
    });
    chain.current = run;
    return run;
  }, [token]);

  // Debounced autosave. 1.2s is long enough that typing a sentence is one request, short enough that
  // closing the tab mid-form rarely loses anything.
  useEffect(() => {
    if (!form || !editable) return undefined;
    if (!hydrated.current) { hydrated.current = true; return undefined; }
    setSaveState((s) => (s === "saving" ? s : "dirty"));
    const t = setTimeout(() => { save(form); }, 1200);
    return () => clearTimeout(t);
  }, [form, editable, save]);

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

  /* ── rooms ─────────────────────────────────────────────────── */
  const toggleRoom = (key) =>
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  const setRoom = (i, changes) =>
    setForm((f) => ({ ...f, rooms: f.rooms.map((r, k) => (k === i ? { ...r, ...changes } : r)) }));
  /**
   * Enter walks to the next control; Ctrl/Cmd+Enter submits; Alt+R adds a room.
   *
   * Not inside a textarea — a policy is prose and needs its newlines — and not on a button, where
   * Enter already means "press me". Read-only registrations are skipped entirely: a submitted form
   * has nothing to walk through.
   */
  const onFormKeyDown = (e) => {
    if (ro) return;
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); onSubmit(); return; }
    if (e.altKey && e.key.toLowerCase() === "r") { e.preventDefault(); addRoom(); return; }
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

  const addRoom = () =>
    setForm((f) => ({ ...f, rooms: [...f.rooms, BLANK_ROOM(f.mealPlans.map((m) => m.code))] }));
  const removeRoom = (i) => setForm((f) => ({ ...f, rooms: f.rooms.filter((_, k) => k !== i) }));

  const setRate = (ri, ti, changes) =>
    setForm((f) => ({
      ...f,
      rooms: f.rooms.map((r, k) =>
        k !== ri ? r : { ...r, rates: r.rates.map((t, j) => (j === ti ? { ...t, ...changes } : t)) }),
    }));
  const addRate = (ri) =>
    setForm((f) => ({
      ...f,
      rooms: f.rooms.map((r, k) =>
        k === ri ? { ...r, rates: [...r.rates, nextFreeRate(r, f.mealPlans.map((m) => m.code))] } : r),
    }));
  const removeRate = (ri, ti) =>
    setForm((f) => ({
      ...f,
      rooms: f.rooms.map((r, k) => (k === ri ? { ...r, rates: r.rates.filter((_, j) => j !== ti) } : r)),
    }));

  /* ── amenities ─────────────────────────────────────────────── */
  const [amenityDraft, setAmenityDraft] = useState("");
  const hasAmenity = (v) => (form?.amenities ?? []).some((a) => a.toLowerCase() === v.toLowerCase());
  const toggleAmenity = (v) =>
    setForm((f) => ({
      ...f,
      amenities: f.amenities.some((a) => a.toLowerCase() === v.toLowerCase())
        ? f.amenities.filter((a) => a.toLowerCase() !== v.toLowerCase())
        : [...f.amenities, v],
    }));
  const addAmenity = () => {
    const v = amenityDraft.trim();
    if (!v) return;
    if (!hasAmenity(v)) toggleAmenity(v);
    setAmenityDraft("");
  };

  /** Upload one photo and hand the URL back to the uploader, which appends it to the right array. */
  const uploadPhoto = useCallback(
    async (file, onProgress) => {
      try {
        return await hotelPartnerService.uploadImage(token, file, onProgress);
      } catch (err) {
        // Rethrown as a plain Error so PhotoUploader can render the message inline, beside the
        // button that failed, rather than at the bottom of a long form.
        throw new Error(partnerErrorMessage(err, "Could not upload that photo."), { cause: err });
      }
    },
    [token],
  );

  /* ── meal plans ────────────────────────────────────────────── */
  const setMealPlan = (code, changes) =>
    setForm((f) => ({
      ...f,
      mealPlans: f.mealPlans.map((m) => (m.code === code ? { ...m, ...changes } : m)),
    }));

  /**
   * Ticking a plan also adds a rate row for it to every existing room, so the owner is never left
   * wondering where to price it. Unticking removes those rows — the plan is not on offer, so a rate
   * for it would be dead data the reviewer has to ask about.
   */
  const toggleMealPlan = (code) =>
    setForm((f) => {
      const has = f.mealPlans.some((m) => m.code === code);
      if (has) {
        return {
          ...f,
          mealPlans: f.mealPlans.filter((m) => m.code !== code),
          rooms: f.rooms.map((r) => ({ ...r, rates: r.rates.filter((t) => t.mealPlanCode !== code) })),
        };
      }
      return {
        ...f,
        mealPlans: [...f.mealPlans, { code, name: "", description: "", active: true }],
        rooms: f.rooms.map((r) => ({
          ...r,
          rates: r.rates.some((t) => t.mealPlanCode === code && t.occupancyBasis === "DOUBLE")
            ? r.rates
            : [...r.rates, { ...BLANK_RATE, mealPlanCode: code, _key: newKey() }],
        })),
      };
    });

  const onSubmit = async () => {
    setSubmitError("");
    setSubmitting(true);
    try {
      // Flush pending edits first — the debounce may not have fired, and submit validates what the
      // SERVER holds, not what is on screen. The chain guarantees this lands after any queued save.
      const saved = await save(formRef.current);
      if (!saved) { setSubmitting(false); return; }
      const dto = await hotelPartnerService.submit(token);
      setForm(toForm(dto));
      setReviewerNote(dto?.reviewerNote ?? "");
      setEditable(false);
      setDone(true);
      setSheetOpen(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setSubmitError(partnerErrorMessage(err, "Could not submit. Please try again."));
      /* Mark the fields, then go to the first one.
         The server answers a failed submit with every problem joined into one prose blob and no
         field keys, so there is nothing in the response to map back onto inputs. There does not need
         to be: the checklist already computes the same list locally, item by item, with the id of
         the input each one is about. Marking from the checklist is not a workaround for the missing
         field keys — it is the same knowledge, already here.
         It used to scroll to the Rooms section unconditionally, which is wrong whenever the missing
         thing was the hotel name. */
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
   * <p>A collapsed room does not render its inputs at all, so "Name for room 3" pointed at an id
   * that was not in the document and quietly fell back to scrolling the Rooms section — the exact
   * hunt this was meant to end. Expanding first, then deferring a frame so the input exists before
   * anything tries to focus it.</p>
   */
  const revealField = useCallback((item) => {
    const roomKey = item?.field?.startsWith("f-room-") ? item.field.slice("f-room-".length) : null;
    if (roomKey) {
      setCollapsed((s) => {
        if (!s.has(roomKey)) return s;
        const next = new Set(s);
        next.delete(roomKey);
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

  const roomCount = form?.rooms?.length ?? 0;
  const rateCount = useMemo(
    () => (form?.rooms ?? []).reduce((n, r) => n + (r.rates?.length ?? 0), 0), [form]);

  if (loading) {
    return <Centered><Loader2 className="mx-auto animate-spin text-slate-400" size={28} /></Centered>;
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

  const ro = !editable;
  const offeredCodes = form.mealPlans.map((m) => m.code);

  return (
    <Page>
      {/* ── Sticky chrome ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-screen-2xl items-center gap-3 px-4 py-3 sm:px-6">
          <Hotel className="shrink-0 text-blue-600" size={20} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-extrabold text-slate-900">Register your hotel</h1>
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

      {/* max-w-screen-2xl, matching the console. It was max-w-6xl (1152px), which on a 1440 or 1920
          laptop left a wide empty gutter on both sides while the form itself scrolled for pages. */}
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
        {/* Same keyboard contract as the console catalog editor. An owner filling this on a laptop
            from a rate sheet should never reach for the mouse to move between fields — and it costs
            almost nothing, unlike the density change, which is why it is here even though this form
            is filled once rather than twenty times a day. */}
        <main className="min-w-0 flex-1 space-y-4 pb-32 lg:pb-8" onKeyDown={onFormKeyDown}>
          {done && (
            <Notice tone="success">
              <strong>Thank you — we have your details.</strong> Our team will review them and get in
              touch. You can keep this link to check back.
            </Notice>
          )}

          {!done && reviewerNote && (
            <Notice tone="warn">
              <strong>Please update a few things:</strong>
              <div className="mt-1 whitespace-pre-wrap">{reviewerNote}</div>
            </Notice>
          )}

          {ro && !done && <Notice tone="info">This registration is being reviewed and cannot be edited.</Notice>}

          {saveState === "error" && saveError && (
            <Notice tone="error">
              <div className="flex flex-wrap items-center gap-3">
                <span className="min-w-0 flex-1">{saveError}</span>
                <Btn variant="ghost" size="sm" onClick={() => save(formRef.current)}>
                  <RotateCw size={14} /> Retry
                </Btn>
              </div>
            </Notice>
          )}

          {/* Two up from lg, matching the console catalog editor.
              These four are short forms — a handful of one-line fields each — and stacking them made
              a laptop scroll through four screens of half-empty white. Amenities, photos, meal plans
              and rooms stay full width below, because those genuinely use it. */}
          <div className="grid gap-4 lg:grid-cols-2">
          <Card id="details" title="Hotel details" hint="Only the name, city and country are needed to save.">
            <Row label="Hotel name" required error={fieldErrors["f-name"]}>
              <input id="f-name" className={inputCls} value={form.name} disabled={ro}
                autoComplete="organization" aria-invalid={Boolean(fieldErrors["f-name"])}
                onChange={(e) => patch({ name: e.target.value })} placeholder="Hotel Seaview" />
            </Row>
            <Row label="Star rating">
              <Stars value={form.stars} disabled={ro} onChange={(v) => patch({ stars: v })} />
            </Row>
            <Row label="Guest rating" hint="Out of 5, if you have one">
              <input className={inputCls} type="number" min="0" max="5" step="0.1" inputMode="decimal"
                value={form.rating} disabled={ro}
                onChange={(e) => patch({ rating: e.target.value })} placeholder="4.3" />
            </Row>
            <Row label="About the hotel">
              <textarea className={inputCls} rows={4} value={form.overview} disabled={ro}
                onChange={(e) => patch({ overview: e.target.value })}
                placeholder="A short description guests would find useful." />
            </Row>
            <Row label="Website">
              <input className={inputCls} type="url" inputMode="url" autoCapitalize="none"
                value={form.website} disabled={ro}
                onChange={(e) => patch({ website: e.target.value })} placeholder="https://…" />
            </Row>
          </Card>

          <Card id="location" title="Location" hint="The city and country decide where travel agents find you.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="City" hint="required" error={fieldErrors["f-city"]}>
                <input id="f-city" className={inputCls} value={form.cityName} disabled={ro}
                  autoComplete="address-level2" aria-invalid={Boolean(fieldErrors["f-city"])}
                  onChange={(e) => patch({ cityName: e.target.value })} placeholder="Goa" />
              </Field>
              <Field label="Country code" hint="2–3 letters, e.g. IN" error={fieldErrors["f-country"]}>
                <input id="f-country" className={inputCls} value={form.countryCode} disabled={ro} maxLength={3}
                  autoCapitalize="characters" autoComplete="country"
                  aria-invalid={Boolean(fieldErrors["f-country"])}
                  onChange={(e) => patch({ countryCode: e.target.value.toUpperCase() })} placeholder="IN" />
              </Field>
              <Field label="State / region">
                <input className={inputCls} value={form.stateName} disabled={ro} autoComplete="address-level1"
                  onChange={(e) => patch({ stateName: e.target.value })} />
              </Field>
              <Field label="City / airport code" hint="optional">
                <input className={inputCls} value={form.cityCode} disabled={ro} maxLength={20}
                  autoCapitalize="characters"
                  onChange={(e) => patch({ cityCode: e.target.value.toUpperCase() })} placeholder="GOI" />
              </Field>
            </div>
            <Row label="Full address">
              <textarea className={inputCls} rows={2} value={form.address} disabled={ro}
                autoComplete="street-address"
                onChange={(e) => patch({ address: e.target.value })} />
            </Row>
            <Row label="Google Maps link">
              <input className={inputCls} type="url" inputMode="url" autoCapitalize="none"
                value={form.mapUrl} disabled={ro}
                onChange={(e) => patch({ mapUrl: e.target.value })} placeholder="https://maps.google.com/…" />
            </Row>
            {/* Separate from the Maps link above, and they are not interchangeable: that is a URL a
                human clicks, this is the identifier Google's API answers to. Only the second one can
                bring a live rating and review strip onto the marketplace page. Placed after the name,
                address and city because the search defaults to exactly those. */}
            <Row label="Your Google listing" hint="Optional">
              <GoogleListingPicker
                token={token}
                value={form.googlePlaceId}
                onChange={(placeId) => patch({ googlePlaceId: placeId })}
                form={form}
                disabled={ro}
              />
            </Row>
            <Row label="Coordinates" hint="Optional">
              <div className="grid grid-cols-2 gap-3">
                <input className={inputCls} inputMode="decimal" value={form.latitude} disabled={ro}
                  onChange={(e) => patch({ latitude: e.target.value })} placeholder="Latitude" />
                <input className={inputCls} inputMode="decimal" value={form.longitude} disabled={ro}
                  onChange={(e) => patch({ longitude: e.target.value })} placeholder="Longitude" />
              </div>
            </Row>
          </Card>

          <Card id="contact" title="Contact" hint="Shown to guests on their booking voucher.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone">
                <input className={inputCls} type="tel" inputMode="tel" autoComplete="tel"
                  value={form.phone} disabled={ro}
                  onChange={(e) => patch({ phone: e.target.value })} placeholder="+91 98765 43210" />
              </Field>
              <Field label="Email">
                <input className={inputCls} type="email" inputMode="email" autoComplete="email"
                  autoCapitalize="none" value={form.email} disabled={ro}
                  onChange={(e) => patch({ email: e.target.value })} placeholder="stay@hotel.com" />
              </Field>
            </div>
          </Card>

          <Card id="policies" title="Policies">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Check-in">
                {/* type="time" gives the native wheel on a phone and stores "14:00" either way. */}
                <input className={inputCls} type="time" value={form.checkInTime} disabled={ro}
                  onChange={(e) => patch({ checkInTime: e.target.value })} />
              </Field>
              <Field label="Check-out">
                <input className={inputCls} type="time" value={form.checkOutTime} disabled={ro}
                  onChange={(e) => patch({ checkOutTime: e.target.value })} />
              </Field>
            </div>
            <Row label="Child policy">
              <textarea className={inputCls} rows={2} value={form.childPolicy} disabled={ro}
                onChange={(e) => patch({ childPolicy: e.target.value })}
                placeholder="Children under 6 stay free…" />
            </Row>
            <Row label="Cancellation policy">
              <textarea className={inputCls} rows={2} value={form.cancellationPolicy} disabled={ro}
                onChange={(e) => patch({ cancellationPolicy: e.target.value })}
                placeholder="Free cancellation up to 48 hours before check-in…" />
            </Row>
          </Card>
          </div>


          <Card id="amenities" title="Amenities" hint="Tap what you have. Add anything else below.">
            <div className="flex flex-wrap gap-2">
              {COMMON_AMENITIES.map((a) => (
                <Chip key={a} on={hasAmenity(a)} disabled={ro} onClick={() => toggleAmenity(a)}>
                  {hasAmenity(a) && <Check size={13} className="mr-1 inline" />}{a}
                </Chip>
              ))}
            </div>

            {/* Anything the owner added that is not one of the quick-picks. */}
            {form.amenities.filter((a) => !COMMON_AMENITIES.some((c) => c.toLowerCase() === a.toLowerCase())).length > 0 && (
              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                {form.amenities
                  .filter((a) => !COMMON_AMENITIES.some((c) => c.toLowerCase() === a.toLowerCase()))
                  .map((a) => (
                    <span key={a}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-slate-100 px-3.5 text-[13px] font-semibold text-slate-700">
                      {a}
                      {!ro && (
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

            {!ro && (
              <div className="flex gap-2 border-t border-slate-100 pt-4">
                <input className={inputCls} value={amenityDraft} placeholder="Something else…"
                  onChange={(e) => setAmenityDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAmenity(); } }} />
                <Btn variant="ghost" onClick={addAmenity} disabled={!amenityDraft.trim()}>
                  <Plus size={15} /> Add
                </Btn>
              </div>
            )}
          </Card>

          <Card id="photos" title="Photos of the hotel"
            hint="At least one is required. The main photo is what agents see first.">
            {!ro && form.images.length === 0 && (
              <Notice tone="warn">Please add at least one photo before you submit.</Notice>
            )}
            <PhotoUploader
              images={form.images}
              disabled={ro}
              showMainBadge
              onUpload={uploadPhoto}
              onAdd={(url) => setForm((f) => ({ ...f, images: [...f.images, url] }))}
              onRemove={(i) => setForm((f) => ({ ...f, images: f.images.filter((_, k) => k !== i) }))}
              onMakeMain={(i) => setForm((f) => ({
                ...f,
                images: [f.images[i], ...f.images.filter((_, k) => k !== i)],
              }))}
            />
          </Card>

          <Card id="meals" title="Meal plans" hint="Which plans you offer. Prices go on each room below.">
            <div className="flex flex-wrap gap-2">
              {MEAL_PLANS.map((m) => {
                const on = form.mealPlans.some((x) => x.code === m.code);
                return (
                  <Chip key={m.code} on={on} disabled={ro} onClick={() => toggleMealPlan(m.code)}>
                    {on && <Check size={13} className="mr-1 inline" />}{m.label}
                  </Chip>
                );
              })}
            </div>

            {/* Details only for the plans actually offered — the catalog keeps a name and description
                per plan, and a property that calls its CP "Continental breakfast" should be able to say so. */}
            {form.mealPlans.map((mp) => (
              <div key={mp.code} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-slate-500">
                  {mealLabel(mp.code)}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input className={inputCls} value={mp.name} disabled={ro} placeholder="Your name for it (optional)"
                    onChange={(e) => setMealPlan(mp.code, { name: e.target.value })} />
                  <input className={inputCls} value={mp.description} disabled={ro} placeholder="What's included (optional)"
                    onChange={(e) => setMealPlan(mp.code, { description: e.target.value })} />
                </div>
              </div>
            ))}
          </Card>

          <Card id="rooms" title="Rooms & rates"
            hint="Give us your net rate — what we pay you. Agents never see it."
            right={roomCount > 0 && (
              <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 text-[12px] font-bold text-slate-600">
                {roomCount} room{roomCount === 1 ? "" : "s"} · {rateCount} rate{rateCount === 1 ? "" : "s"}
              </span>
            )}>
            {roomCount === 0 && (
              <p className="text-[13px] text-slate-400">No rooms yet. Add at least one to submit.</p>
            )}

            {form.rooms.map((room, ri) => (
              <RoomCard
                key={room._key}
                room={room} index={ri} readOnly={ro}
                collapsed={collapsed.has(room._key)}
                onToggle={() => toggleRoom(room._key)}
                onChange={(changes) => setRoom(ri, changes)}
                onRemove={() => removeRoom(ri)}
                onAddRate={() => addRate(ri)}
                onChangeRate={(ti, changes) => setRate(ri, ti, changes)}
                onRemoveRate={(ti) => removeRate(ri, ti)}
                onUploadPhoto={uploadPhoto}
                offeredCodes={offeredCodes}
                nameError={fieldErrors[`f-room-${room._key}`]}
              />
            ))}

            {!ro && (
              <Btn variant="ghost" onClick={addRoom} className="w-full sm:w-auto">
                <Plus size={15} /> Add a room
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
            <Btn onClick={onSubmit} busy={submitting} className="shrink-0">
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
 * One room, collapsible.
 *
 * Collapsed rooms show the line a hotel owner actually scans for — name, how many rates, and the
 * cheapest of them — so a property with eight room types is navigable without expanding all eight.
 */
function RoomCard({
  room, index, readOnly, collapsed, onToggle, onChange, onRemove,
  onAddRate, onChangeRate, onRemoveRate, onUploadPhoto, offeredCodes, nameError,
}) {
  const priced = room.rates.filter((t) => t.netRate !== "" && t.netRate !== null);
  const cheapest = priced.length ? Math.min(...priced.map((t) => Number(t.netRate))) : null;

  /**
   * Pairs used more than once. The DB allows one live rate per (meal plan, occupancy) and the
   * server keeps the last, so this has to be visible while it is still fixable rather than after
   * a row silently vanishes on reload.
   */
  const duplicateKeys = useMemo(() => {
    const seen = new Set();
    const dupes = new Set();
    room.rates.forEach((t) => {
      const k = `${t.mealPlanCode}|${t.occupancyBasis}`;
      if (seen.has(k)) dupes.add(k); else seen.add(k);
    });
    return dupes;
  }, [room.rates]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/60">
      <div className="flex items-center gap-2 p-3 sm:px-4">
        <button type="button" onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
          <ChevronDown size={16}
            className={`shrink-0 text-slate-400 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
          <BedDouble size={16} className="shrink-0 text-slate-400" />
          <span className="min-w-0">
            <span className="block truncate text-[13.5px] font-bold text-slate-700">
              {room.name?.trim() || `Room ${index + 1}`}
            </span>
            {collapsed && (
              <span className="block truncate text-[12px] text-slate-500">
                {room.rates.length} rate{room.rates.length === 1 ? "" : "s"}
                {cheapest !== null && ` · from ${cheapest.toLocaleString("en-IN")}`}
              </span>
            )}
          </span>
        </button>
        {!readOnly && (
          <button type="button" onClick={onRemove} aria-label={`Remove room ${index + 1}`}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-white hover:text-rose-600">
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="space-y-3 border-t border-slate-200 p-3.5 sm:p-4">
          <Row label="Room name" required error={nameError}>
            <input id={`f-room-${room._key}`} className={inputCls} value={room.name} disabled={readOnly}
              aria-invalid={Boolean(nameError)}
              onChange={(e) => onChange({ name: e.target.value })} placeholder="Deluxe Sea View" />
          </Row>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Max adults">
              <Stepper value={room.maxAdults} min={1} disabled={readOnly}
                onChange={(v) => onChange({ maxAdults: v })} />
            </Field>
            <Field label="Max children">
              <Stepper value={room.maxChildren} min={0} disabled={readOnly}
                onChange={(v) => onChange({ maxChildren: v })} />
            </Field>
            <Field label="Max total">
              <Stepper value={room.maxOccupancy} min={1} disabled={readOnly}
                onChange={(v) => onChange({ maxOccupancy: v })} />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Bed type">
              <input className={inputCls} value={room.bedType} disabled={readOnly}
                onChange={(e) => onChange({ bedType: e.target.value })} placeholder="King" />
            </Field>
            <Field label="Room size">
              <input className={inputCls} value={room.size} disabled={readOnly}
                onChange={(e) => onChange({ size: e.target.value })} placeholder="320 sq ft" />
            </Field>
          </div>

          <Field label="Description">
            <textarea className={inputCls} rows={2} value={room.description} disabled={readOnly}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Sea-facing with a private balcony…" />
          </Field>

          <Field label="Room photos" hint="optional">
            <PhotoUploader
              images={room.images}
              disabled={readOnly}
              onUpload={onUploadPhoto}
              onAdd={(url) => onChange({ images: [...room.images, url] })}
              onRemove={(k) => onChange({ images: room.images.filter((_, j) => j !== k) })}
            />
          </Field>

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

            <div className="space-y-2.5">
              {room.rates.map((rate, ti) => {
                const duplicate = duplicateKeys.has(`${rate.mealPlanCode}|${rate.occupancyBasis}`);
                return (
                  <div key={rate._key}
                    className={`rounded-xl border p-3 ${
                      duplicate ? "border-amber-300 bg-amber-50/60" : "border-slate-200 bg-slate-50/70"}`}>
                    {/* One line from lg: up, stacked pairs on a phone. */}
                    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-12">
                      <Field label="Meal plan" className="lg:col-span-3">
                        <select className={inputCls} value={rate.mealPlanCode} disabled={readOnly}
                          onChange={(e) => onChangeRate(ti, { mealPlanCode: e.target.value })}>
                          {MEAL_PLANS.map((m) => (
                            <option key={m.code} value={m.code}>
                              {m.label}{offeredCodes.length && !offeredCodes.includes(m.code) ? " (not offered)" : ""}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Applies to" className="lg:col-span-2">
                        <select className={inputCls} value={rate.occupancyBasis} disabled={readOnly}
                          onChange={(e) => onChangeRate(ti, { occupancyBasis: e.target.value })}>
                          {OCCUPANCY.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </Field>
                      <Field label="Net / night" hint="we pay you" className="lg:col-span-2">
                        <input className={inputCls} type="number" min="0" step="0.01" inputMode="decimal"
                          value={rate.netRate} disabled={readOnly} placeholder="4000"
                          onChange={(e) => onChangeRate(ti, { netRate: e.target.value })} />
                      </Field>
                      <Field label="Currency" className="lg:col-span-2">
                        <select className={inputCls} value={rate.currency} disabled={readOnly}
                          onChange={(e) => onChangeRate(ti, { currency: e.target.value })}>
                          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </Field>
                      <Field label="Refundable?" className="lg:col-span-2">
                        <select className={inputCls} disabled={readOnly}
                          value={rate.refundable === null || rate.refundable === undefined
                            ? "" : String(rate.refundable)}
                          onChange={(e) => onChangeRate(ti, {
                            refundable: e.target.value === "" ? null : e.target.value === "true",
                          })}>
                          <option value="">Not specified</option>
                          <option value="true">Refundable</option>
                          <option value="false">Non-refundable</option>
                        </select>
                      </Field>
                      <div className="flex items-end justify-between gap-2 sm:col-span-2 lg:col-span-1 lg:justify-end">
                        <Field label="Code" hint="optional" className="min-w-0 flex-1 lg:hidden">
                          <input className={inputCls} value={rate.rateCode ?? ""} disabled={readOnly}
                            placeholder="DLX-CP-DBL"
                            onChange={(e) => onChangeRate(ti, { rateCode: e.target.value })} />
                        </Field>
                        {!readOnly && (
                          <button type="button" onClick={() => onRemoveRate(ti)}
                            aria-label={`Remove rate ${ti + 1}`}
                            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200
                                       bg-white text-slate-400 transition hover:text-rose-600">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* The rate code has no room on one line; on a laptop it gets its own. */}
                    <div className="mt-2.5 hidden lg:block">
                      <Field label="Your rate code" hint="optional">
                        <input className={`${inputCls} max-w-xs`} value={rate.rateCode ?? ""} disabled={readOnly}
                          placeholder="DLX-CP-DBL"
                          onChange={(e) => onChangeRate(ti, { rateCode: e.target.value })} />
                      </Field>
                    </div>

                    {duplicate && (
                      <p className="mt-2 text-[12px] font-semibold text-amber-700">
                        Another rate already covers {mealLabel(rate.mealPlanCode)} · {occLabel(rate.occupancyBasis)}.
                        Only the last one will be kept — change the meal plan or the occupancy.
                      </p>
                    )}
                  </div>
                );
              })}

              {room.rates.length === 0 && (
                <p className="text-[13px] text-slate-400">Add at least one rate.</p>
              )}
            </div>
          </div>
        </div>
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
     while the owner reads it as "this is done". They are different facts, and the one the owner
     cares about is the checklist. Emerald is kept for the case where both are true. */
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
