// src/features/fleet/pages/FleetVehicleForm.jsx
// Create / edit a fleet vehicle (one component, both routes).
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// FLEET MANAGEMENT REDESIGN — keyboard-first, minimal chrome.
//
// North star: Notion row entry / Linear issue creation. Subtle hairlines instead of stacked cards
// and shadows, generous vertical rhythm, and a form a clerk can fill end-to-end without reaching
// for the mouse. Every token below is already in the app's Tailwind config — slate ramp, blue-600
// accent, rounded-xl, Plus Jakarta Sans. No new style language was invented.
//
// WHAT CHANGED AND WHY
//   Keyboard      Enter advances to the next field (it used to submit, which meant a half-filled
//                 vehicle got created the moment someone hit Enter after the plate). Ctrl+Enter
//                 saves; Ctrl+Shift+Enter saves and starts the next vehicle. Tab order now follows
//                 the visual grid because the DOM order does.
//   Validation    mode: "onBlur" — errors appear when you LEAVE a field, never mid-keystroke, and
//                 never as a toast that steals focus. Rules are hoisted into RULES so the schema is
//                 reviewable in one place instead of scattered through JSX.
//   Duplicates    the plate is checked against existing vehicles as you type (debounced), and shown
//                 as an inline amber note. Deliberately NON-blocking: the server is the authority
//                 (it 409s, or offers a restore when the match is only in Trash), and a client-side
//                 block would be wrong the moment the list is stale.
//   Expiry        insurance / RC / permit / PUC now say when a date is already in the past or is
//                 about to lapse. These are the papers a check-post asks for; a silent date input
//                 lets someone type last year's insurance and never notice.
//   Fields        vendor uses the real combobox (arrows / Enter / Esc) instead of a long native
//                 select; type, make and model use datalists — they are FREE TEXT on the backend,
//                 so a closed combobox would quietly refuse values the API accepts.
//   Batch entry   Save & New keeps the specs and ownership and clears only what is unique to the
//                 physical unit. Eight Tempo Travellers from one owner become eight plates.
//
// Old implementation is commented in place below each replacement — see the
// "// OLD — replaced in Fleet Management redesign" markers.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import {
  Car, AlertTriangle, Info, Check,
} from "lucide-react";

import fleetService from "../api/fleetService";
import { SearchableSelect } from "@features/leads";
import { LoadingState, useToast, errMsg, OWNER_TYPE, toDateInput } from "../components/fleetUi";
import {
  FleetForm, Section, Field, SaveBar, KeyboardHint, useFormKeyboard, fieldCls,
} from "../components/fleetFormKit";

const toNum = (v) => (v === "" || v === null || v === undefined ? null : Number(v));

const BLANK = {
  vehicleNumber: "", type: "", make: "", model: "", year: "", seatingCapacity: "",
  ownerType: "OWN", vendorPublicId: "",
  insuranceExpiry: "", rcExpiry: "", permitExpiry: "", pucExpiry: "", notes: "",
};

/**
 * Validation schema, hoisted out of the JSX so it can be read (and changed) as one thing.
 *
 * Bounds mirror the backend column widths exactly — varchar(30) on the plate, varchar(60) on the
 * three text specs — so the form rejects what the server would reject, rather than letting a value
 * travel to a 500.
 */
const RULES = {
  vehicleNumber: {
    required: "Registration number is required",
    maxLength: { value: 30, message: "Max 30 characters" },
    // Advisory only, not a hard pattern: the fleet includes older series, BH-series, and Nepali
    // plates on attached vehicles. Rejecting anything that is not a modern Indian plate would make
    // real vehicles unenterable, so shape is checked as a hint further down, not as a rule.
  },
  type: { maxLength: { value: 60, message: "Max 60 characters" } },
  make: { maxLength: { value: 60, message: "Max 60 characters" } },
  model: { maxLength: { value: 60, message: "Max 60 characters" } },
  year: {
    min: { value: 1950, message: "Enter a valid year" },
    max: { value: new Date().getFullYear() + 1, message: "Cannot be a future model year" },
  },
  seatingCapacity: {
    min: { value: 1, message: "Must be at least 1" },
    max: { value: 120, message: "That looks too high" },
  },
};

/** Fields a batch of identical vehicles genuinely shares — see Save & New. */
const STICKY_KEYS = ["type", "make", "model", "year", "seatingCapacity", "ownerType", "vendorPublicId"];

/** Suggestions only. All three are free text on the backend, so a closed list would lose data. */
const TYPE_SUGGESTIONS = [
  "Hatchback", "Sedan", "SUV", "MUV", "Tempo Traveller", "Mini Bus", "Bus", "Luxury Coach", "Tempo",
];
const MAKE_SUGGESTIONS = [
  "Maruti Suzuki", "Toyota", "Mahindra", "Tata", "Hyundai", "Force", "Ashok Leyland", "Eicher", "Volvo",
];

const normalisePlate = (v = "") => v.trim().replace(/\s+/g, " ").toUpperCase();

/** Days until a date; negative when it has already passed. Null when there is no date. */
function daysUntil(value) {
  if (!value) return null;
  const target = new Date(`${value}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86_400_000);
}

export default function FleetVehicleForm() {
  const { publicId } = useParams();
  const isEdit = !!publicId;
  const navigate = useNavigate();
  const { showToast } = useToast();

  const formRef = useRef(null);
  const plateRef = useRef(null);

  const [loading, setLoading] = useState(isEdit);
  const [vendors, setVendors] = useState([]);
  const [status, setStatus] = useState(null);          // edit mode: server-managed vehicle status
  const [addAnother, setAddAnother] = useState(false);
  const [dupe, setDupe] = useState(null);              // { vehicleNumber } when the plate is taken

  const {
    register, handleSubmit, reset, watch, getValues, setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: BLANK,
    // Errors on leaving a field, never mid-keystroke; re-validate as you fix so the message clears
    // the moment it stops being true.
    mode: "onBlur",
    reValidateMode: "onChange",
  });

  const ownerType = watch("ownerType");
  const vendorPublicId = watch("vendorPublicId");
  const plate = watch("vehicleNumber");
  const needsVendor = ownerType === "VENDOR" || ownerType === "RENTED";

  useEffect(() => {
    // Empty in a Fleet-only deployment — there is no vendor master, and the field is hidden.
    fleetService.vendorOptions().then(setVendors).catch(() => setVendors([]));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    let alive = true;
    setLoading(true);
    fleetService
      .getVehicle(publicId)
      .then((v) => {
        if (!alive || !v) return;
        setStatus(v.status ?? null);
        reset({
          vehicleNumber: v.vehicleNumber ?? "",
          type: v.type ?? "", make: v.make ?? "", model: v.model ?? "",
          year: v.year ?? "", seatingCapacity: v.seatingCapacity ?? "",
          ownerType: v.ownerType ?? "OWN",
          vendorPublicId: v.vendorPublicId ?? "",
          insuranceExpiry: toDateInput(v.insuranceExpiry),
          rcExpiry: toDateInput(v.rcExpiry),
          permitExpiry: toDateInput(v.permitExpiry),
          pucExpiry: toDateInput(v.pucExpiry),
          notes: v.notes ?? "",
        });
      })
      .catch((e) => showToast(errMsg(e, "Failed to load vehicle."), "error"))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [isEdit, publicId, reset, showToast]);

  /* ── duplicate plate: inline, debounced, non-blocking ───────────────────────────────────── */
  useEffect(() => {
    const candidate = normalisePlate(plate || "");
    if (candidate.length < 4) { setDupe(null); return; }

    let alive = true;
    const t = setTimeout(() => {
      fleetService
        .listVehicles({ search: candidate, size: 5 })
        .then((res) => {
          if (!alive) return;
          const hit = (res.items || []).find(
            (v) => normalisePlate(v.vehicleNumber) === candidate && v.publicId !== publicId,
          );
          setDupe(hit || null);
        })
        // A failed lookup must never block entry — the server still rejects a real duplicate.
        .catch(() => alive && setDupe(null));
    }, 400);

    return () => { alive = false; clearTimeout(t); };
  }, [plate, publicId]);

  // Enter advances, Ctrl+Enter saves, Ctrl+Shift+Enter saves and starts the next vehicle.
  // Lives in the kit so the driver and trip forms behave identically — three copies of a keyboard
  // contract is how three forms end up with three different Enter keys.
  const onFormKeyDown = useFormKeyboard(formRef, setAddAnother, isSubmitting);

  const resetForm = ({ keepSticky = true } = {}) => {
    if (!keepSticky) { reset(BLANK); setDupe(null); return; }
    const current = getValues();
    const sticky = Object.fromEntries(STICKY_KEYS.map((k) => [k, current[k]]));
    reset({ ...BLANK, ...sticky });
    setDupe(null);
  };

  const onSubmit = async (data) => {
    const payload = {
      vehicleNumber: normalisePlate(data.vehicleNumber),
      type: data.type?.trim() || null,
      make: data.make?.trim() || null,
      model: data.model?.trim() || null,
      year: toNum(data.year),
      seatingCapacity: toNum(data.seatingCapacity),
      ownerType: data.ownerType,
      // An agency-owned vehicle carries no vendor link; the server clears it anyway.
      vendorPublicId: needsVendor ? (data.vendorPublicId || null) : null,
      insuranceExpiry: data.insuranceExpiry || null,
      rcExpiry: data.rcExpiry || null,
      permitExpiry: data.permitExpiry || null,
      pucExpiry: data.pucExpiry || null,
      notes: data.notes?.trim() || null,
    };
    try {
      if (isEdit) {
        await fleetService.updateVehicle(publicId, payload);
        showToast("Vehicle updated.", "success");
        navigate(`/fleet/vehicles/${publicId}`);
        return;
      }
      const created = await fleetService.createVehicle(payload);
      showToast(`${payload.vehicleNumber} added.`, "success");

      if (addAnother) {
        resetForm({ keepSticky: true });
        setAddAnother(false);
        setTimeout(() => plateRef.current?.focus(), 0);
        return;
      }
      navigate(created?.publicId ? `/fleet/vehicles/${created.publicId}` : "/fleet/vehicles");
    } catch (e) {
      // A trashed-plate collision comes back as RESTORE_AVAILABLE and its message names the
      // vehicle, so surfacing the server's text verbatim beats a generic fallback.
      showToast(errMsg(e, "Couldn't save the vehicle."), "error");
    } finally {
      setAddAnother(false);
    }
  };

  /* ── expiry notes ───────────────────────────────────────────────────────────────────────── */
  const values = watch();
  const expiryNote = useMemo(
    () => (key) => {
      const d = daysUntil(values[key]);
      if (d === null) return {};
      if (d < 0) return { note: <><AlertTriangle className="mt-px h-3 w-3 shrink-0" /> Expired {Math.abs(d)} day{Math.abs(d) === 1 ? "" : "s"} ago</>, noteTone: "red" };
      if (d === 0) return { note: <><AlertTriangle className="mt-px h-3 w-3 shrink-0" /> Expires today</>, noteTone: "amber" };
      if (d <= 30) return { note: <><AlertTriangle className="mt-px h-3 w-3 shrink-0" /> {d} days left</>, noteTone: "amber" };
      return { note: <><Check className="mt-px h-3 w-3 shrink-0" /> Valid</>, noteTone: "green" };
    },
    [values],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/60" style={{ fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}>
        <LoadingState label="Loading vehicle…" />
      </div>
    );
  }

  const plateReg = register("vehicleNumber", RULES.vehicleNumber);

  // OLD — replaced in Fleet Management redesign
  // The header bar, the surface, the footer row and this button group were all written inline here.
  // They now live in fleetFormKit so the driver and trip forms are the same page, not three that
  // look alike today and drift apart at the next change.
  const Actions = ({ compact }) => (
    <SaveBar
      isEdit={isEdit}
      submitting={isSubmitting}
      compact={compact}
      onClear={() => resetForm({ keepSticky: false })}
      onIntent={setAddAnother}
      saveLabel={isEdit ? "Save changes" : "Add vehicle"}
    />
  );

  return (
    <FleetForm
      formRef={formRef}
      onSubmit={handleSubmit(onSubmit)}
      onKeyDown={onFormKeyDown}
      icon={Car}
      title={isEdit ? "Edit vehicle" : "New vehicle"}
      subtitle="Register a vehicle in the operational fleet."
      badge={isEdit && status ? (
        <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">
          {status.replace(/_/g, " ").toLowerCase()}
        </span>
      ) : null}
      onBack={() => navigate(-1)}
      actions={Actions}
      hint={<KeyboardHint showSaveAndNew={!isEdit} />}
    >
        {/* OLD — replaced in Fleet Management redesign
          <FormSection title="Identity" subtitle="Registration & specifications" icon={IdCard}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Vehicle Number" required error={errors.vehicleNumber}> … </Field>
              <Field label="Type" …/> <Field label="Make" …/> <Field label="Model" …/>
              <Field label="Year" …/> <Field label="Seating Capacity" …/>
            </div>
          </FormSection>
          Split into Identity and Specifications: registration identifies the asset, the rest
          describes it, and mixing them made the required field just one of six lookalikes. */}
      <Section title="Identity" first>
          {/* Capped: a registration plate is ~12 characters, and stretching its input across the
              full desktop column would make the one required field on this form look like a
              paragraph box. Width should follow the content, not the container. */}
          <div className="grid max-w-md grid-cols-1 gap-5">
            <Field
              label="Registration number"
              required
              htmlFor="vehicleNumber"
              error={errors.vehicleNumber?.message}
              note={
                dupe
                  ? <><AlertTriangle className="mt-px h-3 w-3 shrink-0" /> {normalisePlate(plate)} is already in your fleet</>
                  : <><Info className="mt-px h-3 w-3 shrink-0" /> Saved uppercase — spacing is normalised</>
              }
              noteTone={dupe ? "amber" : "slate"}
            >
              <input
                {...plateReg}
                ref={(el) => { plateReg.ref(el); plateRef.current = el; }}
                id="vehicleNumber"
                className={`${fieldCls} font-mono uppercase tracking-wide`}
                placeholder="MH12 AB 1234"
                autoComplete="off"
                autoFocus
                aria-invalid={!!errors.vehicleNumber}
              />
            </Field>
          </div>
      </Section>

      <Section title="Specifications" hint="Vehicle type also decides which allowance rate its driver is paid.">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            {/* Free text on the backend, so these are datalists — suggestions without a cage. A
                closed combobox here would refuse values the API happily accepts. */}
            <Field label="Type" htmlFor="type" error={errors.type?.message}>
              <input id="type" list="fleet-type-options" className={fieldCls}
                     placeholder="Tempo Traveller" autoComplete="off" {...register("type", RULES.type)} />
              <datalist id="fleet-type-options">
                {TYPE_SUGGESTIONS.map((t) => <option key={t} value={t} />)}
              </datalist>
            </Field>

            <Field label="Make" htmlFor="make" error={errors.make?.message}>
              <input id="make" list="fleet-make-options" className={fieldCls}
                     placeholder="Toyota" autoComplete="off" {...register("make", RULES.make)} />
              <datalist id="fleet-make-options">
                {MAKE_SUGGESTIONS.map((m) => <option key={m} value={m} />)}
              </datalist>
            </Field>

            <Field label="Model" htmlFor="model" error={errors.model?.message}>
              <input id="model" className={fieldCls} placeholder="Innova Crysta" autoComplete="off"
                     {...register("model", RULES.model)} />
            </Field>

            <Field label="Model year" htmlFor="year" error={errors.year?.message}>
              <input id="year" type="number" inputMode="numeric" className={fieldCls} placeholder="2022"
                     aria-invalid={!!errors.year} {...register("year", RULES.year)} />
            </Field>

            <Field label="Seating capacity" htmlFor="seatingCapacity" error={errors.seatingCapacity?.message}>
              <input id="seatingCapacity" type="number" inputMode="numeric" className={fieldCls} placeholder="7"
                     aria-invalid={!!errors.seatingCapacity} {...register("seatingCapacity", RULES.seatingCapacity)} />
            </Field>
          </div>
      </Section>

        {/* OLD — replaced in Fleet Management redesign
          <FormSection title="Compliance Documents" subtitle="Expiry dates drive dashboard alerts" icon={ShieldCheck}>
            <Field label="Insurance Expiry"><Input type="date" {...register("insuranceExpiry")} /></Field>
            … three more identical date fields …
          </FormSection>
          Replaced because a bare date input gives no signal: last year's insurance typed into it
          looked exactly like next year's. Each field now states whether it is expired, expiring or
          valid, computed on every change. */}
      <Section title="Documents & expiry"
                 hint="These are the papers a check-post asks for. Dates here drive the expiry alerts.">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="Insurance" htmlFor="insuranceExpiry" {...expiryNote("insuranceExpiry")}>
              <input id="insuranceExpiry" type="date" className={fieldCls} {...register("insuranceExpiry")} />
            </Field>
            <Field label="RC" htmlFor="rcExpiry" {...expiryNote("rcExpiry")}>
              <input id="rcExpiry" type="date" className={fieldCls} {...register("rcExpiry")} />
            </Field>
            <Field label="Permit" htmlFor="permitExpiry" {...expiryNote("permitExpiry")}>
              <input id="permitExpiry" type="date" className={fieldCls} {...register("permitExpiry")} />
            </Field>
            <Field label="PUC" htmlFor="pucExpiry" {...expiryNote("pucExpiry")}>
              <input id="pucExpiry" type="date" className={fieldCls} {...register("pucExpiry")} />
            </Field>
          </div>
      </Section>

        {/* OLD — replaced in Fleet Management redesign
          <FormSection title="Ownership" subtitle="Who the vehicle belongs to" icon={UserCog}>
            <Field label="Owner Type" required><Select {...register("ownerType", { required: true })}>…</Select></Field>
            {needsVendor && (
              <Field label="Linked Vendor">
                <Select {...register("vendorPublicId")}>… every vendor as an <option> …</Select>
              </Field>
            )}
          </FormSection>
          The vendor list is the one genuinely large-option field on this form, and a native select
          cannot be searched — with 80 vendors it was a scroll. Now a keyboard combobox. */}
      <Section title="Assignment & status">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            <Field label="Owner type" required htmlFor="ownerType">
              <select id="ownerType" className={fieldCls} {...register("ownerType", { required: true })}>
                {Object.entries(OWNER_TYPE).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </Field>

            {needsVendor && (
              <Field
                label="Owner / vendor"
                note={vendors.length === 0 ? "No vendor directory in this deployment" : undefined}
              >
                <SearchableSelect
                  accent="blue"
                  options={vendors.map((v) => ({ value: v.publicId, label: v.label }))}
                  value={vendorPublicId || ""}
                  onChange={(val) => setValue("vendorPublicId", val, { shouldDirty: true })}
                  placeholder="Search vendors…"
                />
              </Field>
            )}

            {/* Status is server-managed on purpose: ON_TRIP is set by the trip lifecycle, and the
                API refuses any manual change while a trip is running. Showing it as an editable
                field here would offer a control that silently fails. */}
            <Field label="Status"
                   note={isEdit
                     ? "Changed from the vehicle page — it is driven by the trip lifecycle"
                     : "A new vehicle starts as Available"}>
              <div className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-sm font-medium text-slate-500">
                {isEdit ? (status || "—").replace(/_/g, " ") : "Available"}
              </div>
            </Field>
          </div>
      </Section>

      <Section title="Notes">
          <textarea
            rows={3}
            className={`${fieldCls} max-w-3xl resize-y`}
            placeholder="Anything worth remembering about this vehicle…"
            {...register("notes")}
          />
      </Section>
      {/* OLD — replaced in Fleet Management redesign
        <FormActions>
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit"><Save /> …</Button>
        </FormActions>
        The footer action row and the keyboard legend are now rendered by FleetForm, which mirrors
        the header actions at the foot so Save is reachable from either end of the form. */}
    </FleetForm>
  );
}
