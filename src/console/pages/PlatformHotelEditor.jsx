import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, Save, Trash2, Upload } from "lucide-react";
import {
  PageShell, HotelStyles, Input, Textarea, Label, Button, Select,
  GlassCard, useToast, errMsg,
} from "../components/hotelUi";
import { platformHotelService } from "../api/platformHotelService";
import SuperAdminMfaActionModal from "../components/SuperAdminMfaActionModal";

/**
 * Enter a catalog hotel by hand, from the console, without touching a mouse.
 *
 * <p>Until now a SuperAdmin could create a hotel and then not fill it in: the create dialog wrote
 * three fields, the detail page offered only Publish/Unpublish, and every write method on
 * `platformHotelService` past `create` was dead code. Worse, catalog RATES had no console write path
 * at all — they could only be born by promoting a partner submission — so a hand-made hotel could
 * hold rooms and never a price, and a hotel with no active room cannot be published. It was a dead
 * end by construction.
 *
 * <h3>Keyboard first, and that is a real constraint here</h3>
 *
 * A catalog operator enters hotels in batches from a rate sheet. Enter moves to the next field,
 * Ctrl/Cmd+Enter saves from anywhere, Alt+R adds a room and Alt+T adds a rate to the room being
 * worked on. Nothing needs a pointer.
 *
 * <h3>Explicit save, not autosave</h3>
 *
 * The partner form autosaves because an owner fills it over days. This is the opposite: an operator
 * types a whole hotel in one sitting from a document in front of them, and the console's endpoints
 * are granular — hotel PUT, room POST/PUT/DELETE, rate POST/PUT/DELETE, meal plan the same. Saving
 * per keystroke would fan one edit into several calls and put half-typed data straight into a live
 * catalog. So the page batches: one Save works out what actually changed and issues only those
 * calls.
 */
export default function PlatformHotelEditor() {
  const { publicId } = useParams();
  const navigate = useNavigate();
  const { showToast, toastNode } = useToast();
  const isNew = !publicId;

  const [form, setForm] = useState(() => blankHotel());
  const [rooms, setRooms] = useState([]);
  const [mealPlans, setMealPlans] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [mfaOpen, setMfaOpen] = useState(false);
  const [mfaError, setMfaError] = useState("");
  const rootRef = useRef(null);
  /* The room a rate shortcut applies to — whichever room last held focus. Without this, Alt+T on a
     page with six rooms has to guess, and guessing wrong writes a price onto the wrong room. */
  const activeRoomRef = useRef(null);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  /* Puts the returned URL straight into the field the operator can see and edit, rather than
     holding it in hidden state — an upload that silently populated something invisible is an upload
     nobody can undo by hand. */
  const uploadPhoto = async (file) => {
    setUploading(true);
    setUploadPct(0);
    try {
      const url = await platformHotelService.uploadImage(file, setUploadPct);
      set({ primaryImageUrl: url });
    } catch (e) {
      showToast(errMsg(e, "Could not upload that photo."), "error");
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (isNew) return;
    let alive = true;
    platformHotelService.get(publicId)
      .then((dto) => {
        if (!alive) return;
        setForm(toForm(dto));
        setRooms((dto.rooms || []).map(toRoomState));
        setMealPlans((dto.mealPlans || []).map(toMealState));
      })
      .catch((e) => alive && setLoadError(errMsg(e, "Could not load this hotel.")))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [publicId, isNew]);

  // ── save ────────────────────────────────────────────────────────────────

  /* Validate first, THEN ask for the code. A hotel missing its city should fail on the form, not
     after the operator has fetched their phone and typed six digits. */
  const requestSave = useCallback(() => {
    if (saving) return;
    if (!form.name.trim() || !form.cityName.trim()) {
      showToast("A hotel needs at least a name and a city.", "error");
      document.getElementById(form.name.trim() ? "h-city" : "h-name")?.focus();
      return;
    }
    setMfaError("");
    setMfaOpen(true);
  }, [saving, form, showToast]);

  /* Every write below is @RequireSuperAdminStepUp server-side (PLATFORM_HOTEL_CREATE / _UPDATE /
     _ROOM_CHANGE / _RATE_CHANGE / _MEAL_PLAN_CHANGE), so ONE code is collected up front and threaded
     through the whole sequence. Prompting per call would mean up to twelve dialogs for one Save, and
     a TOTP window is 30 seconds — the operator would be re-typing codes mid-sequence and would still
     lose the batch when one expired. */
  const save = useCallback(async (mfaCode) => {
    setSaving(true);
    setMfaError("");
    try {
      /* The hotel row first, and always: rooms and rates are addressed through its publicId, so on a
         new hotel there is nothing to attach them to until this returns. */
      const hotel = isNew
        ? await platformHotelService.create(toPayload(form), mfaCode)
        : await platformHotelService.update(publicId, toPayload(form), mfaCode);
      const id = hotel.publicId;

      // Meal plans before rooms: a rate names a meal plan code, and a code the hotel does not offer
      // is a rate nobody can interpret.
      for (const plan of mealPlans) {
        if (plan._deleted && plan.publicId) {
          await platformHotelService.deleteMealPlan(id, plan.publicId, mfaCode);
        } else if (!plan._deleted && !plan.publicId) {
          await platformHotelService.addMealPlan(id, mealPayload(plan), mfaCode);
        } else if (!plan._deleted && plan._dirty) {
          await platformHotelService.updateMealPlan(id, plan.publicId, mealPayload(plan), mfaCode);
        }
      }

      for (const room of rooms) {
        if (room._deleted) {
          if (room.publicId) await platformHotelService.deleteRoom(id, room.publicId, mfaCode);
          continue;
        }
        let roomId = room.publicId;
        if (!roomId) {
          roomId = (await platformHotelService.addRoom(id, roomPayload(room), mfaCode)).publicId;
        } else if (room._dirty) {
          await platformHotelService.updateRoom(id, roomId, roomPayload(room), mfaCode);
        }
        for (const rate of room.rates) {
          if (rate._deleted && rate.publicId) {
            await platformHotelService.deleteRate(id, roomId, rate.publicId, mfaCode);
          } else if (!rate._deleted && !rate.publicId) {
            await platformHotelService.addRate(id, roomId, ratePayload(rate), mfaCode);
          } else if (!rate._deleted && rate._dirty) {
            await platformHotelService.updateRate(id, roomId, rate.publicId, ratePayload(rate), mfaCode);
          }
        }
      }

      setMfaOpen(false);
      showToast(isNew ? `${hotel.name} created as a draft.` : "Saved.", "success");
      navigate(`/console/hotel-catalog/${id}`);
    } catch (e) {
      /* Deliberately NOT reloading from the server here. A failure part-way through leaves the
         hotel saved and, say, room three unsaved — re-hydrating would throw away everything the
         operator typed after the point it broke. The page keeps their work; pressing Save again
         re-runs only what is still outstanding, because saved rows now carry publicIds.

         The message stays in the dialog so the operator can enter a fresh code and retry, which is
         the common case: a code that expired part-way through a long sequence. */
      setMfaError(errMsg(e, "Could not save. Your changes are still here — enter a fresh code and try again."));
    } finally {
      setSaving(false);
    }
  }, [form, rooms, mealPlans, isNew, publicId, navigate, showToast]);

  // ── keyboard ────────────────────────────────────────────────────────────

  const onKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); requestSave(); return; }
    if (e.altKey && e.key.toLowerCase() === "r") { e.preventDefault(); addRoom(); return; }
    if (e.altKey && e.key.toLowerCase() === "t") {
      e.preventDefault();
      if (activeRoomRef.current != null) addRate(activeRoomRef.current);
      return;
    }
    /* Enter walks to the next control instead of doing nothing.
       Not inside a textarea — a policy is prose and needs its newlines — and not on a button, where
       Enter already means "press me". This is the difference between typing a rate sheet straight
       through and reaching for the mouse on every field. */
    if (e.key !== "Enter" || e.shiftKey) return;
    const tag = e.target.tagName;
    if (tag === "TEXTAREA" || tag === "BUTTON") return;
    e.preventDefault();
    const focusable = [...rootRef.current.querySelectorAll("input,select,textarea")]
      .filter((el) => !el.disabled && el.offsetParent !== null);
    const next = focusable[focusable.indexOf(e.target) + 1];
    next?.focus();
    if (next?.select) next.select();
  };

  // ── rooms / rates / meal plans ──────────────────────────────────────────

  const addRoom = () => {
    setRooms((rs) => [...rs, blankRoom()]);
    // Defer: the input does not exist until React has painted the new card.
    requestAnimationFrame(() =>
      rootRef.current?.querySelector("[data-room-last] input")?.focus());
  };
  const patchRoom = (key, patch) =>
    setRooms((rs) => rs.map((r) => (r._key === key ? { ...r, ...patch, _dirty: true } : r)));
  const dropRoom = (key) =>
    setRooms((rs) => rs.flatMap((r) => (r._key !== key ? [r]
      // A saved room must be REMEMBERED as deleted so Save can call the API; an unsaved one can
      // simply vanish, because the server never heard of it.
      : r.publicId ? [{ ...r, _deleted: true }] : [])));

  const addRate = (key) =>
    setRooms((rs) => rs.map((r) => (r._key === key ? { ...r, rates: [...r.rates, blankRate()] } : r)));
  const patchRate = (key, rateKey, patch) =>
    setRooms((rs) => rs.map((r) => (r._key !== key ? r : {
      ...r,
      rates: r.rates.map((t) => (t._key === rateKey ? { ...t, ...patch, _dirty: true } : t)),
    })));
  const dropRate = (key, rateKey) =>
    setRooms((rs) => rs.map((r) => (r._key !== key ? r : {
      ...r,
      rates: r.rates.flatMap((t) => (t._key !== rateKey ? [t]
        : t.publicId ? [{ ...t, _deleted: true }] : [])),
    })));

  const liveRooms = useMemo(() => rooms.filter((r) => !r._deleted), [rooms]);
  const livePlans = useMemo(() => mealPlans.filter((m) => !m._deleted), [mealPlans]);

  if (loading) {
    return <PageShell><HotelStyles /><div className="flex justify-center py-24"><Loader2 className="animate-spin text-muted" /></div></PageShell>;
  }
  if (loadError) {
    return (
      <PageShell><HotelStyles />
        <p className="py-24 text-center text-sm text-heading">{loadError}</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <HotelStyles />
      {toastNode}
      <div ref={rootRef} onKeyDown={onKeyDown} className="pb-28">
        <button
          onClick={() => navigate(isNew ? "/console/hotel-catalog" : `/console/hotel-catalog/${publicId}`)}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-heading"
        >
          <ArrowLeft size={15} /> {isNew ? "Catalog" : "Back to hotel"}
        </button>

        <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-heading">
              {isNew ? "New catalog hotel" : form.name || "Edit hotel"}
            </h1>
            {/* The shortcuts are stated, not hidden — a keyboard-first screen nobody is told about
                is a keyboard-first screen nobody uses. */}
            <p className="mt-0.5 text-xs text-muted">
              <Kbd>Enter</Kbd> next field · <Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd> save ·
              {" "}<Kbd>Alt</Kbd>+<Kbd>R</Kbd> add room · <Kbd>Alt</Kbd>+<Kbd>T</Kbd> add rate
            </p>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Hotel details">
            <F id="h-name" label="Name" required autoFocus value={form.name} onChange={(v) => set({ name: v })} />
            <div className="grid grid-cols-2 gap-3">
              <F id="h-stars" label="Stars" type="number" min="1" max="5" value={form.stars} onChange={(v) => set({ stars: v })} />
              <F id="h-rating" label="Guest rating" type="number" step="0.1" min="0" max="5" value={form.rating} onChange={(v) => set({ rating: v })} />
            </div>
            <F id="h-website" label="Website" value={form.website} onChange={(v) => set({ website: v })} />
            {/* Both, because both happen. An operator working from a supplier's email has a URL to
                paste; one working from a folder of photos has a file. Offering only the URL is what
                the console did before, and it made the second case impossible. */}
            <div>
              <Label htmlFor="h-image">Primary image</Label>
              <Input
                id="h-image"
                value={form.primaryImageUrl}
                placeholder="Paste an image URL…"
                onChange={(e) => set({ primaryImageUrl: e.target.value })}
              />
              <div className="mt-1.5 flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-body transition hover:bg-surface-hover">
                  <Upload size={12} />
                  {uploading ? `Uploading ${uploadPct}%` : "or upload a photo"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      // Reset so choosing the SAME file twice after a failure still fires onChange.
                      e.target.value = "";
                      if (file) uploadPhoto(file);
                    }}
                  />
                </label>
                {form.primaryImageUrl && (
                  <img
                    src={form.primaryImageUrl}
                    alt=""
                    className="h-8 w-12 rounded border border-border object-cover"
                    onError={(ev) => { ev.currentTarget.style.visibility = "hidden"; }}
                  />
                )}
              </div>
            </div>
            <T id="h-overview" label="Overview" value={form.overview} onChange={(v) => set({ overview: v })} />
          </Section>

          <Section title="Location">
            <F id="h-address" label="Address" value={form.address} onChange={(v) => set({ address: v })} />
            <div className="grid grid-cols-2 gap-3">
              <F id="h-city" label="City" required value={form.cityName} onChange={(v) => set({ cityName: v })} />
              <F id="h-citycode" label="City code" value={form.cityCode} onChange={(v) => set({ cityCode: v.toUpperCase() })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F id="h-state" label="State" value={form.stateName} onChange={(v) => set({ stateName: v })} />
              {/* The catalog↔tenant country sync matches on the CODE, so a display name here breaks
                  the join silently. Hence the hint, and the upper-casing. */}
              <F id="h-country" label="Country code" hint="ISO, e.g. NP" value={form.countryCode} onChange={(v) => set({ countryCode: v.toUpperCase() })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F id="h-lat" label="Latitude" type="number" step="any" value={form.latitude} onChange={(v) => set({ latitude: v })} />
              <F id="h-lng" label="Longitude" type="number" step="any" value={form.longitude} onChange={(v) => set({ longitude: v })} />
            </div>
            <F id="h-map" label="Map URL" value={form.mapUrl} onChange={(v) => set({ mapUrl: v })} />
          </Section>

          <Section title="Contact & timings">
            <div className="grid grid-cols-2 gap-3">
              <F id="h-phone" label="Phone" value={form.phone} onChange={(v) => set({ phone: v })} />
              <F id="h-email" label="Email" type="email" value={form.email} onChange={(v) => set({ email: v })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F id="h-in" label="Check-in" hint="e.g. 14:00" value={form.checkInTime} onChange={(v) => set({ checkInTime: v })} />
              <F id="h-out" label="Check-out" hint="e.g. 11:00" value={form.checkOutTime} onChange={(v) => set({ checkOutTime: v })} />
            </div>
          </Section>

          <Section title="Policies">
            <T id="h-cancel" label="Cancellation policy" rows={4} value={form.cancellationPolicy} onChange={(v) => set({ cancellationPolicy: v })} />
            <T id="h-child" label="Child policy" rows={3} value={form.childPolicy} onChange={(v) => set({ childPolicy: v })} />
          </Section>

          <Section title="Amenities" className="lg:col-span-2">
            {/* Comma-separated rather than a chip picker: an operator copying from a rate sheet
                pastes a list, and a picker turns one paste into fifteen clicks. */}
            <T
              id="h-amenities"
              label="One per line, or comma separated"
              rows={2}
              value={form.amenitiesText}
              onChange={(v) => set({ amenitiesText: v })}
            />
          </Section>
        </div>

        {/* ── Meal plans ─────────────────────────────────────────────── */}
        <SectionHead
          title="Meal plans"
          count={livePlans.length}
          action={<Button size="sm" variant="outline" onClick={() => setMealPlans((m) => [...m, blankMeal()])}>
            <Plus size={13} /> Add plan
          </Button>}
        />
        {livePlans.length === 0 ? (
          <Empty>No meal plans. Rates name a plan code, so add the boards this hotel sells.</Empty>
        ) : (
          /* Two per row, never three: each card carries a code select, a name and a delete button,
             and at three across the name field loses the width that makes it readable. */
          <div className="grid gap-2 sm:grid-cols-2">
            {livePlans.map((plan) => (
              <GlassCard key={plan._key} className="flex items-end gap-2 p-3">
                <div className="w-24 shrink-0">
                  <Label>Code</Label>
                  <Select
                    value={plan.code}
                    onChange={(e) => setMealPlans((m) => m.map((x) => (x._key === plan._key ? { ...x, code: e.target.value, _dirty: true } : x)))}
                  >
                    {MEAL_PLANS.map((m) => <option key={m.code} value={m.code}>{m.code} · {m.label}</option>)}
                  </Select>
                </div>
                <div className="min-w-0 flex-1">
                  <Label>Name</Label>
                  <Input
                    value={plan.name}
                    onChange={(e) => setMealPlans((m) => m.map((x) => (x._key === plan._key ? { ...x, name: e.target.value, _dirty: true } : x)))}
                  />
                </div>
                <Button size="sm" variant="outline" onClick={() =>
                  setMealPlans((m) => m.flatMap((x) => (x._key !== plan._key ? [x] : x.publicId ? [{ ...x, _deleted: true }] : [])))}>
                  <Trash2 size={13} />
                </Button>
              </GlassCard>
            ))}
          </div>
        )}

        {/* ── Rooms & rates ──────────────────────────────────────────── */}
        <SectionHead
          title="Rooms & net rates"
          count={liveRooms.length}
          action={<Button size="sm" onClick={addRoom}><Plus size={13} /> Add room</Button>}
        />
        {liveRooms.length === 0 ? (
          <Empty>
            No rooms yet. A hotel with no active room cannot be published — press{" "}
            <Kbd>Alt</Kbd>+<Kbd>R</Kbd> to add one.
          </Empty>
        ) : (
          <div className="space-y-3">
            {liveRooms.map((room, i) => (
              <GlassCard
                key={room._key}
                className="p-4"
                data-room-last={i === liveRooms.length - 1 ? "1" : undefined}
                onFocusCapture={() => { activeRoomRef.current = room._key; }}
              >
                <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
                  <div>
                    <Label>Room name <span className="text-rose-500">*</span></Label>
                    <Input value={room.name} onChange={(e) => patchRoom(room._key, { name: e.target.value })} placeholder="Deluxe Sea View" />
                  </div>
                  <div>
                    <Label>Bed type</Label>
                    <Input value={room.bedType} onChange={(e) => patchRoom(room._key, { bedType: e.target.value })} />
                  </div>
                  <div>
                    <Label>Max occupancy</Label>
                    <Input type="number" min="1" value={room.maxOccupancy} onChange={(e) => patchRoom(room._key, { maxOccupancy: e.target.value })} />
                  </div>
                  <div className="flex items-end">
                    <Button size="sm" variant="outline" onClick={() => dropRoom(room._key)}><Trash2 size={13} /></Button>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-muted">
                    Rates ({room.rates.filter((t) => !t._deleted).length})
                  </span>
                  <Button size="sm" variant="outline" onClick={() => addRate(room._key)}>
                    <Plus size={12} /> Add rate
                  </Button>
                </div>

                {room.rates.filter((t) => !t._deleted).length === 0 ? (
                  <p className="mt-2 text-xs font-semibold text-amber-600">
                    No rate on this room — it cannot be sold.
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {room.rates.filter((t) => !t._deleted).map((rate) => (
                      <div key={rate._key} className="grid gap-2 sm:grid-cols-[1fr_1.2fr_1fr_1fr_auto]">
                        <Select value={rate.mealPlanCode} onChange={(e) => patchRate(room._key, rate._key, { mealPlanCode: e.target.value })}>
                          {MEAL_PLANS.map((m) => <option key={m.code} value={m.code}>{m.code} · {m.label}</option>)}
                        </Select>
                        <Select value={rate.occupancyBasis} onChange={(e) => patchRate(room._key, rate._key, { occupancyBasis: e.target.value })}>
                          {OCCUPANCY.map((o) => <option key={o} value={o}>{human(o)}</option>)}
                        </Select>
                        <Input
                          type="number" min="0" step="0.01" placeholder="Net rate"
                          value={rate.netRate}
                          onChange={(e) => patchRate(room._key, rate._key, { netRate: e.target.value })}
                          onWheel={(e) => e.currentTarget.blur()}
                        />
                        <Input placeholder="Rate code" value={rate.rateCode}
                          onChange={(e) => patchRate(room._key, rate._key, { rateCode: e.target.value })} />
                        <Button size="sm" variant="outline" onClick={() => dropRate(room._key, rate._key)}>
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      {/* Sticky, because a hotel is a long page and the operator must never scroll to save. */}
      <div className="sticky bottom-0 z-20 -mx-4 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={requestSave} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Saving…" : isNew ? "Create draft" : "Save changes"}
          </Button>
          <span className="text-xs text-muted">
            {isNew
              ? "Created as a draft — no tenant sees it until you publish."
              : "Publishing is done from the hotel page."}
          </span>
        </div>
      </div>

      {mfaOpen && (
        <SuperAdminMfaActionModal
          title={isNew ? "Confirm new hotel" : "Confirm hotel changes"}
          description={
            isNew
              ? "This adds the property to the platform catalogue as a draft. No tenant sees it until it is published."
              : "This saves the hotel and every room, rate and meal-plan change on this page in one sequence."
          }
          confirmLabel={isNew ? "Create draft" : "Save changes"}
          saving={saving}
          error={mfaError}
          onClose={saving ? undefined : () => setMfaOpen(false)}
          onConfirm={save}
        />
      )}
    </PageShell>
  );
}

/* ── pieces ───────────────────────────────────────────────────────────── */

const Kbd = ({ children }) => (
  <kbd className="rounded border border-border bg-page px-1 py-0.5 font-mono text-[10px] text-body">{children}</kbd>
);

const Section = ({ title, className = "", children }) => (
  <GlassCard className={`space-y-3 p-4 ${className}`}>
    <h2 className="text-xs font-bold uppercase tracking-wide text-muted">{title}</h2>
    {children}
  </GlassCard>
);

const SectionHead = ({ title, count, action }) => (
  <div className="mb-2 mt-6 flex items-center justify-between">
    <h2 className="text-xs font-bold uppercase tracking-wide text-muted">
      {title} <span className="text-muted/70">({count})</span>
    </h2>
    {action}
  </div>
);

const Empty = ({ children }) => (
  <GlassCard className="p-4 text-sm text-muted">{children}</GlassCard>
);

/** One labelled input. `id` matters — the save path focuses fields by it when validation refuses. */
function F({ id, label, hint, required, ...rest }) {
  return (
    <div>
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
        {hint && <span className="ml-1 font-normal text-muted">· {hint}</span>}
      </Label>
      <Input id={id} {...rest} onChange={(e) => rest.onChange(e.target.value)} />
    </div>
  );
}

function T({ id, label, rows = 3, value, onChange }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/* ── vocabulary & state shapes ────────────────────────────────────────── */

/**
 * Mirrors `MealPlanCode` on the backend exactly — a mismatch here is silent data loss.
 *
 * <p>The code alone is not readable. EP/CP/MAP/AP are hotel-trade shorthand (European, Continental,
 * Modified American and American Plan) and a console operator pricing a rate sheet should not have
 * to remember which of them includes dinner. The wording is the enum's own `defaultLabel`, so the
 * console, the partner form and the review page all say the same thing about the same code.</p>
 */
const MEAL_PLANS = [
  { code: "EP", label: "Room Only" },
  { code: "CP", label: "Breakfast" },
  { code: "MAP", label: "Breakfast + 1 Meal" },
  { code: "AP", label: "All Meals" },
  { code: "CUSTOM", label: "Custom" },
];
const OCCUPANCY = ["SINGLE", "DOUBLE", "TRIPLE", "EXTRA_BED", "CHILD_WITH_BED", "CHILD_NO_BED"];
const human = (v) => v.toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

let seq = 0;
const key = () => `k${++seq}`;

const blankHotel = () => ({
  name: "", countryCode: "", stateName: "", cityName: "", cityCode: "", address: "",
  latitude: "", longitude: "", stars: "", rating: "", website: "", mapUrl: "", overview: "",
  primaryImageUrl: "", phone: "", email: "", checkInTime: "", checkOutTime: "",
  childPolicy: "", cancellationPolicy: "", amenitiesText: "",
});

const blankRoom = () => ({
  _key: key(), publicId: null, _dirty: true,
  name: "", bedType: "", maxOccupancy: "", rates: [blankRate()],
});
const blankRate = () => ({
  _key: key(), publicId: null, _dirty: true,
  mealPlanCode: "CP", occupancyBasis: "DOUBLE", netRate: "", rateCode: "",
});
const blankMeal = () => ({ _key: key(), publicId: null, _dirty: true, code: "CP", name: "" });

const toForm = (d) => ({
  ...blankHotel(),
  ...Object.fromEntries(Object.entries(blankHotel()).map(([k]) => [k, d?.[k] ?? ""])),
  amenitiesText: (d?.amenities || []).join(", "),
});

const toRoomState = (r) => ({
  _key: key(), publicId: r.publicId, _dirty: false,
  name: r.name ?? "", bedType: r.bedType ?? "", maxOccupancy: r.maxOccupancy ?? "",
  rates: (r.rates || []).map((t) => ({
    _key: key(), publicId: t.publicId, _dirty: false,
    mealPlanCode: t.mealPlanCode ?? "EP", occupancyBasis: t.occupancyBasis ?? "DOUBLE",
    netRate: t.netRate ?? "", rateCode: t.rateCode ?? "",
  })),
});

const toMealState = (m) => ({
  _key: key(), publicId: m.publicId, _dirty: false, code: m.code, name: m.name ?? "",
});

/** Blank numerics become null so the server stores absence rather than 0. */
const num = (v) => (v === "" || v === null || v === undefined ? null : Number(v));

const toPayload = (f) => ({
  name: f.name.trim(),
  countryCode: f.countryCode.trim() || null,
  stateName: f.stateName.trim() || null,
  cityName: f.cityName.trim(),
  cityCode: f.cityCode.trim() || null,
  address: f.address.trim() || null,
  latitude: num(f.latitude), longitude: num(f.longitude),
  stars: num(f.stars), rating: num(f.rating),
  website: f.website.trim() || null,
  mapUrl: f.mapUrl.trim() || null,
  overview: f.overview || null,
  primaryImageUrl: f.primaryImageUrl.trim() || null,
  phone: f.phone.trim() || null,
  email: f.email.trim() || null,
  checkInTime: f.checkInTime.trim() || null,
  checkOutTime: f.checkOutTime.trim() || null,
  childPolicy: f.childPolicy || null,
  cancellationPolicy: f.cancellationPolicy || null,
  // Split on either separator: an operator pasting from a document has no idea which we wanted.
  amenities: f.amenitiesText.split(/[,\n]/).map((s) => s.trim()).filter(Boolean),
});

const roomPayload = (r) => ({
  name: r.name.trim(), bedType: r.bedType.trim() || null,
  maxOccupancy: num(r.maxOccupancy), active: true,
});

const ratePayload = (t) => ({
  mealPlanCode: t.mealPlanCode, occupancyBasis: t.occupancyBasis,
  netRate: num(t.netRate), rateCode: t.rateCode.trim() || null, active: true,
});

const mealPayload = (m) => ({ code: m.code, name: m.name.trim() || null, active: true });
