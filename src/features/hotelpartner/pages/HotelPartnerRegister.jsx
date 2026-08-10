import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  BedDouble, Check, CloudOff, Hotel, Loader2, Plus, Send, Trash2, X,
} from "lucide-react";
import { hotelPartnerService, partnerErrorMessage } from "../api/hotelPartnerService";
import {
  Btn, Card, Centered, Field, Notice, Page, PhotoUploader, Row, inputCls,
} from "../components/partnerUi";

/* ── Vocabulary. Mirrors the backend enums exactly; a mismatch here is a silent data loss. ── */
const MEAL_PLANS = [
  { code: "EP", label: "Room only" },
  { code: "CP", label: "Breakfast" },
  { code: "MAP", label: "Breakfast + 1 meal" },
  { code: "AP", label: "All meals" },
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
  name: "", maxAdults: 2, maxChildren: 1, maxOccupancy: 3, bedType: "", size: "",
  description: "", active: true, images: [],
  rates: (mealPlanCodes.length ? mealPlanCodes : ["CP"])
    .map((code) => ({ ...BLANK_RATE, mealPlanCode: code })),
});

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
      name: r.name ?? "", maxAdults: r.maxAdults ?? "", maxChildren: r.maxChildren ?? "",
      maxOccupancy: r.maxOccupancy ?? "", bedType: r.bedType ?? "", size: r.size ?? "",
      description: r.description ?? "", active: r.active !== false, images: r.images ?? [],
      rates: (r.rates ?? []).map((t) => ({
        mealPlanCode: t.mealPlanCode ?? "EP", occupancyBasis: t.occupancyBasis ?? "DOUBLE",
        netRate: t.netRate ?? "", currency: t.currency ?? "INR", refundable: t.refundable ?? null,
      })),
    })),
  };
}

/** Form state → request body. Blank numerics become null so the backend stores absence, not 0. */
const num = (v) => (v === "" || v === null || v === undefined ? null : Number(v));

function toPayload(f) {
  return {
    ...f,
    latitude: num(f.latitude),
    longitude: num(f.longitude),
    stars: num(f.stars),
    rating: num(f.rating),
    mealPlans: f.mealPlans,
    rooms: f.rooms.map((r) => ({
      ...r,
      maxAdults: num(r.maxAdults),
      maxChildren: num(r.maxChildren),
      maxOccupancy: num(r.maxOccupancy),
      rates: r.rates.map((t) => ({ ...t, netRate: num(t.netRate) })),
    })),
  };
}

export default function HotelPartnerRegister() {
  const { token } = useParams();

  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState("");
  const [session, setSession] = useState(null);
  const [form, setForm] = useState(null);
  const [editable, setEditable] = useState(false);

  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState(false);

  // Guards the autosave effect from firing on the initial hydration, which would POST the server's
  // own data straight back and mark a pristine form dirty.
  const hydrated = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await hotelPartnerService.resolve(token);
        if (!alive) return;
        setSession(data);
        setForm(toForm(data.registration));
        setEditable(Boolean(data.editable));
        if (data.registration?.status === "SUBMITTED") setDone(true);
      } catch (err) {
        if (alive) setFatal(partnerErrorMessage(err, "We could not open this registration link."));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [token]);

  const save = useCallback(async (next) => {
    setSaveState("saving");
    try {
      const dto = await hotelPartnerService.saveDraft(token, toPayload(next));
      setSaveState("saved");
      return dto;
    } catch (err) {
      // Never clobber what the owner typed. A failed save keeps the local state and says so —
      // re-hydrating from the server here would delete the very edit that failed to reach it.
      setSaveState("error");
      setSubmitError(partnerErrorMessage(err, "Could not save. Check your connection."));
      return null;
    }
  }, [token]);

  // Debounced autosave. 1.2s is long enough that typing a sentence is one request, short enough that
  // closing the tab mid-form rarely loses anything.
  useEffect(() => {
    if (!form || !editable) return;
    if (!hydrated.current) { hydrated.current = true; return; }
    setSaveState("dirty");
    const t = setTimeout(() => { save(form); }, 1200);
    return () => clearTimeout(t);
  }, [form, editable, save]);

  const patch = (changes) => setForm((f) => ({ ...f, ...changes }));

  /* ── rooms ─────────────────────────────────────────────────── */
  const setRoom = (i, changes) =>
    setForm((f) => ({ ...f, rooms: f.rooms.map((r, k) => (k === i ? { ...r, ...changes } : r)) }));
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
      rooms: f.rooms.map((r, k) => (k === ri ? { ...r, rates: [...r.rates, { ...BLANK_RATE }] } : r)),
    }));
  const removeRate = (ri, ti) =>
    setForm((f) => ({
      ...f,
      rooms: f.rooms.map((r, k) => (k === ri ? { ...r, rates: r.rates.filter((_, j) => j !== ti) } : r)),
    }));

  /* ── amenities ─────────────────────────────────────────────── */
  const [amenityDraft, setAmenityDraft] = useState("");
  const addAmenity = () => {
    const v = amenityDraft.trim();
    if (!v) return;
    setForm((f) =>
      f.amenities.some((a) => a.toLowerCase() === v.toLowerCase()) ? f : { ...f, amenities: [...f.amenities, v] });
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
        throw new Error(partnerErrorMessage(err, "Could not upload that photo."));
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
        rooms: f.rooms.map((r) => ({ ...r, rates: [...r.rates, { ...BLANK_RATE, mealPlanCode: code }] })),
      };
    });

  const onSubmit = async () => {
    setSubmitError("");
    setSubmitting(true);
    try {
      // Flush pending edits first — the debounce may not have fired, and submit validates what the
      // SERVER holds, not what is on screen.
      const saved = await save(form);
      if (!saved) { setSubmitting(false); return; }
      const dto = await hotelPartnerService.submit(token);
      setForm(toForm(dto));
      setEditable(false);
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setSubmitError(partnerErrorMessage(err, "Could not submit. Please try again."));
    } finally {
      setSubmitting(false);
    }
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

  return (
    <Page>
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Hotel className="text-blue-600" size={20} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-extrabold text-slate-900">Register your hotel</h1>
            {session?.contactName && (
              <p className="truncate text-[12px] text-slate-500">Welcome, {session.contactName}</p>
            )}
          </div>
          <SaveBadge state={saveState} editable={editable} />
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-5 pb-28">
        {done && (
          <Notice tone="success">
            <strong>Thank you — we have your details.</strong> Our team will review them and get in
            touch. You can keep this link to check back.
          </Notice>
        )}

        {!done && form?.reviewerNote && (
          <Notice tone="warn">
            <strong>Please update a few things:</strong>
            <div className="mt-1 whitespace-pre-wrap">{form.reviewerNote}</div>
          </Notice>
        )}

        {ro && !done && <Notice tone="info">This registration is being reviewed and cannot be edited.</Notice>}

        <Card title="Hotel details" hint="Only the name, city and country are needed to save.">
          <Row label="Hotel name" required>
            <input className={inputCls} value={form.name} disabled={ro}
              onChange={(e) => patch({ name: e.target.value })} placeholder="Hotel Seaview" />
          </Row>
          <Row label="Star rating">
            <select className={inputCls} value={form.stars} disabled={ro}
              onChange={(e) => patch({ stars: e.target.value })}>
              <option value="">Not rated</option>
              {[1, 2, 3, 4, 5, 6, 7].map((s) => <option key={s} value={s}>{s} star</option>)}
            </select>
          </Row>
          <Row label="Guest rating" hint="Out of 5, if you have one">
            <input className={inputCls} type="number" min="0" max="5" step="0.1" value={form.rating}
              disabled={ro} onChange={(e) => patch({ rating: e.target.value })} placeholder="4.3" />
          </Row>
          <Row label="About the hotel">
            <textarea className={inputCls} rows={4} value={form.overview} disabled={ro}
              onChange={(e) => patch({ overview: e.target.value })}
              placeholder="A short description guests would find useful." />
          </Row>
          <Row label="Website">
            <input className={inputCls} value={form.website} disabled={ro}
              onChange={(e) => patch({ website: e.target.value })} placeholder="https://…" />
          </Row>
        </Card>

        <Card title="Location" hint="The city and country decide where travel agents find you.">
          <Row label="City" required>
            <input className={inputCls} value={form.cityName} disabled={ro}
              onChange={(e) => patch({ cityName: e.target.value })} placeholder="Goa" />
          </Row>
          <Row label="Country code" required hint="2–3 letters, e.g. IN">
            <input className={inputCls} value={form.countryCode} disabled={ro} maxLength={3}
              onChange={(e) => patch({ countryCode: e.target.value.toUpperCase() })} placeholder="IN" />
          </Row>
          <Row label="State / region">
            <input className={inputCls} value={form.stateName} disabled={ro}
              onChange={(e) => patch({ stateName: e.target.value })} />
          </Row>
          <Row label="City / airport code" hint="Optional">
            <input className={inputCls} value={form.cityCode} disabled={ro} maxLength={20}
              onChange={(e) => patch({ cityCode: e.target.value.toUpperCase() })} placeholder="GOI" />
          </Row>
          <Row label="Full address">
            <textarea className={inputCls} rows={2} value={form.address} disabled={ro}
              onChange={(e) => patch({ address: e.target.value })} />
          </Row>
          <Row label="Google Maps link">
            <input className={inputCls} value={form.mapUrl} disabled={ro}
              onChange={(e) => patch({ mapUrl: e.target.value })} placeholder="https://maps.google.com/…" />
          </Row>
          <div className="grid gap-4 sm:grid-cols-2">
            <Row label="Latitude">
              <input className={inputCls} value={form.latitude} disabled={ro}
                onChange={(e) => patch({ latitude: e.target.value })} />
            </Row>
            <Row label="Longitude">
              <input className={inputCls} value={form.longitude} disabled={ro}
                onChange={(e) => patch({ longitude: e.target.value })} />
            </Row>
          </div>
        </Card>

        <Card title="Contact" hint="Shown to guests on their booking voucher.">
          <Row label="Phone">
            <input className={inputCls} value={form.phone} disabled={ro}
              onChange={(e) => patch({ phone: e.target.value })} />
          </Row>
          <Row label="Email">
            <input className={inputCls} type="email" value={form.email} disabled={ro}
              onChange={(e) => patch({ email: e.target.value })} />
          </Row>
        </Card>

        <Card title="Policies">
          <div className="grid gap-4 sm:grid-cols-2">
            <Row label="Check-in">
              <input className={inputCls} value={form.checkInTime} disabled={ro}
                onChange={(e) => patch({ checkInTime: e.target.value })} placeholder="14:00" />
            </Row>
            <Row label="Check-out">
              <input className={inputCls} value={form.checkOutTime} disabled={ro}
                onChange={(e) => patch({ checkOutTime: e.target.value })} placeholder="11:00" />
            </Row>
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

        <Card title="Amenities">
          {!ro && (
            <div className="flex gap-2">
              <input className={inputCls} value={amenityDraft} placeholder="Free WiFi"
                onChange={(e) => setAmenityDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAmenity(); } }} />
              <Btn variant="ghost" type="button" onClick={addAmenity}><Plus size={15} /></Btn>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {form.amenities.length === 0 && <p className="text-[13px] text-slate-400">None added yet.</p>}
            {form.amenities.map((a) => (
              <span key={a} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[13px] font-medium text-slate-700">
                {a}
                {!ro && (
                  <button type="button" className="text-slate-400 hover:text-rose-500"
                    onClick={() => setForm((f) => ({ ...f, amenities: f.amenities.filter((x) => x !== a) }))}>
                    <X size={13} />
                  </button>
                )}
              </span>
            ))}
          </div>
        </Card>

        <Card title="Photos of the hotel"
          hint="At least one is required. The first photo is what agents see first.">
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
          />
        </Card>

        <Card title="Meal plans" hint="Which plans you offer. Prices go on each room below.">
          <div className="flex flex-wrap gap-2">
            {MEAL_PLANS.map((m) => {
              const on = form.mealPlans.some((x) => x.code === m.code);
              return (
                <button key={m.code} type="button" disabled={ro} onClick={() => toggleMealPlan(m.code)}
                  className={`rounded-xl border px-3.5 py-2 text-[13px] font-semibold transition disabled:opacity-60 ${
                    on ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"}`}>
                  {on && <Check size={13} className="mr-1 inline" />}{m.label}
                </button>
              );
            })}
          </div>

          {/* Details only for the plans actually offered — the catalog keeps a name and description
              per plan, and a property that calls its CP "Continental breakfast" should be able to say so. */}
          {form.mealPlans.map((mp) => (
            <div key={mp.code} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-slate-500">
                {MEAL_PLANS.find((m) => m.code === mp.code)?.label ?? mp.code}
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

        <Card title="Rooms & rates"
          hint="Give us your net rate — what we pay you. Agents never see it.">
          {roomCount === 0 && (
            <p className="text-[13px] text-slate-400">No rooms yet. Add at least one to submit.</p>
          )}

          {form.rooms.map((room, ri) => (
            <div key={ri} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 sm:p-4">
              <div className="mb-3 flex items-center gap-2">
                <BedDouble size={16} className="text-slate-400" />
                <span className="text-[13px] font-bold text-slate-700">Room {ri + 1}</span>
                {!ro && (
                  <button type="button" onClick={() => removeRoom(ri)}
                    className="ml-auto text-slate-400 hover:text-rose-600"><Trash2 size={15} /></button>
                )}
              </div>

              <div className="space-y-3">
                <Row label="Room name" required>
                  <input className={inputCls} value={room.name} disabled={ro}
                    onChange={(e) => setRoom(ri, { name: e.target.value })} placeholder="Deluxe Sea View" />
                </Row>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Row label="Max adults">
                    <input className={inputCls} type="number" min="1" value={room.maxAdults} disabled={ro}
                      onChange={(e) => setRoom(ri, { maxAdults: e.target.value })} />
                  </Row>
                  <Row label="Max children">
                    <input className={inputCls} type="number" min="0" value={room.maxChildren} disabled={ro}
                      onChange={(e) => setRoom(ri, { maxChildren: e.target.value })} />
                  </Row>
                  <Row label="Max total">
                    <input className={inputCls} type="number" min="1" value={room.maxOccupancy} disabled={ro}
                      onChange={(e) => setRoom(ri, { maxOccupancy: e.target.value })} />
                  </Row>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Row label="Bed type">
                    <input className={inputCls} value={room.bedType} disabled={ro}
                      onChange={(e) => setRoom(ri, { bedType: e.target.value })} placeholder="King" />
                  </Row>
                  <Row label="Room size">
                    <input className={inputCls} value={room.size} disabled={ro}
                      onChange={(e) => setRoom(ri, { size: e.target.value })} placeholder="320 sq ft" />
                  </Row>
                </div>
                <Row label="Description">
                  <textarea className={inputCls} rows={2} value={room.description} disabled={ro}
                    onChange={(e) => setRoom(ri, { description: e.target.value })}
                    placeholder="Sea-facing with a private balcony…" />
                </Row>

                <Row label="Room photos" hint="Optional">
                  <PhotoUploader
                    images={room.images}
                    disabled={ro}
                    onUpload={uploadPhoto}
                    onAdd={(url) => setRoom(ri, { images: [...room.images, url] })}
                    onRemove={(k) => setRoom(ri, { images: room.images.filter((_, j) => j !== k) })}
                  />
                </Row>

                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[12px] font-bold uppercase tracking-wide text-slate-500">
                      Net rates — one per meal plan &amp; occupancy
                    </span>
                    {!ro && (
                      <button type="button" onClick={() => addRate(ri)}
                        className="inline-flex items-center gap-1 text-[12px] font-bold text-blue-600 hover:underline">
                        <Plus size={13} /> Add rate
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {room.rates.map((rate, ti) => (
                      <div key={ti} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-[12px] font-bold text-slate-600">Rate {ti + 1}</span>
                          {!ro && (
                            <button type="button" onClick={() => removeRate(ri, ti)}
                              className="text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button>
                          )}
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                          <Field label="Meal plan">
                            <select className={inputCls} value={rate.mealPlanCode} disabled={ro}
                              onChange={(e) => setRate(ri, ti, { mealPlanCode: e.target.value })}>
                              {MEAL_PLANS.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
                            </select>
                          </Field>
                          <Field label="Rate applies to">
                            <select className={inputCls} value={rate.occupancyBasis} disabled={ro}
                              onChange={(e) => setRate(ri, ti, { occupancyBasis: e.target.value })}>
                              {OCCUPANCY.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </Field>
                          <Field label="Net rate per night" hint="What we pay you">
                            <input className={inputCls} type="number" min="0" step="0.01" inputMode="decimal"
                              value={rate.netRate} disabled={ro} placeholder="4000"
                              onChange={(e) => setRate(ri, ti, { netRate: e.target.value })} />
                          </Field>
                          <Field label="Currency">
                            <select className={inputCls} value={rate.currency} disabled={ro}
                              onChange={(e) => setRate(ri, ti, { currency: e.target.value })}>
                              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </Field>
                          <Field label="Refundable?">
                            <select className={inputCls} disabled={ro}
                              value={rate.refundable === null || rate.refundable === undefined
                                ? "" : String(rate.refundable)}
                              onChange={(e) => setRate(ri, ti, {
                                refundable: e.target.value === "" ? null : e.target.value === "true",
                              })}>
                              <option value="">Not specified</option>
                              <option value="true">Refundable</option>
                              <option value="false">Non-refundable</option>
                            </select>
                          </Field>
                          <Field label="Your rate code" hint="Optional">
                            <input className={inputCls} value={rate.rateCode ?? ""} disabled={ro}
                              placeholder="DLX-CP-DBL"
                              onChange={(e) => setRate(ri, ti, { rateCode: e.target.value })} />
                          </Field>
                        </div>
                      </div>
                    ))}
                    {room.rates.length === 0 && (
                      <p className="text-[13px] text-slate-400">Add at least one rate.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {!ro && (
            <Btn variant="ghost" type="button" onClick={addRoom}>
              <Plus size={15} /> Add a room
            </Btn>
          )}
        </Card>

        {submitError && <Notice tone="error">{submitError}</Notice>}
      </main>

      {!ro && (
        <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
            <p className="flex-1 text-[12px] text-slate-500">
              {roomCount} room{roomCount === 1 ? "" : "s"} · {rateCount} rate{rateCount === 1 ? "" : "s"}
            </p>
            <Btn onClick={onSubmit} busy={submitting}>
              <Send size={15} /> Submit for review
            </Btn>
          </div>
        </div>
      )}
    </Page>
  );
}

/** Autosave status. Silent when idle — a permanent "Saved" badge is noise, an error is not. */
function SaveBadge({ state, editable }) {
  if (!editable) return null;
  if (state === "saving") {
    return <span className="inline-flex items-center gap-1 text-[12px] text-slate-500">
      <Loader2 size={12} className="animate-spin" /> Saving
    </span>;
  }
  if (state === "saved") {
    return <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-600">
      <Check size={12} /> Saved
    </span>;
  }
  if (state === "error") {
    return <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-rose-600">
      <CloudOff size={12} /> Not saved
    </span>;
  }
  return null;
}
