// src/features/fleet/pages/FleetTripForm.jsx
// Create / edit a trip. Create with an end time → a post-facto COMPLETED diary entry; otherwise the
// trip is PLANNED and run through the start / close lifecycle.
//
// Same treatment as the vehicle and driver forms, on the shared fleetFormKit — see that file for the
// shell and the keyboard contract.
//
// TWO THINGS THAT ARE NOT JUST STYLING:
//   1. The per-trip exchange rate is now settable. The office sets ONE rate for a Nepal trip and
//      every foreign-currency cost row inherits it at write time — which is why a driver at the
//      Sunauli border types a Bhansar receipt in NPR and never sees a rate. Without this field the
//      whole NPR path is unreachable: the server rejects a foreign currency that has no trip rate.
//   2. The three legacy money fields are gone from CREATE. fuel / toll / driver-allowance scalars
//      predate the expense ledger; collecting them here as well as in the ledger is how one tank of
//      diesel becomes Rs 12,000. They remain on EDIT so an existing trip's figures stay correctable
//      until the cutover migration retires them.
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import {
  Route as RouteIcon, Users, CalendarClock, Globe2, Receipt, Info, AlertTriangle,
} from "lucide-react";

import fleetService from "../api/fleetService";
import { bookingService } from "@features/bookings";
import { SearchableSelect } from "@features/leads";
import {
  LoadingState, useToast, errMsg, StatusBadge, TRIP_STATUS,
  toDateTimeInput, nowDateTimeInput,
} from "../components/fleetUi";
import {
  FleetForm, Section, Field, SaveBar, KeyboardHint, useFormKeyboard, fieldCls,
} from "../components/fleetFormKit";

const toNum = (v) => (v === "" || v === null || v === undefined ? null : Number(v));

const BLANK = {
  vehiclePublicId: "", driverPublicId: "", bookingPublicId: "",
  startDatetime: nowDateTimeInput(), endDatetime: "",
  startOdometer: "", endOdometer: "",
  routeFrom: "", routeTo: "", purpose: "",
  fxCurrency: "", fxRate: "",
  fuelCost: "", tollCost: "", driverAllowance: "", remarks: "",
};

const RULES = {
  vehiclePublicId: { required: "Vehicle is required" },
  driverPublicId: { required: "Driver is required" },
  startDatetime: { required: "Start time is required" },
  startOdometer: { min: { value: 0, message: "Can't be negative" } },
  endOdometer: { min: { value: 0, message: "Can't be negative" } },
  routeFrom: { maxLength: { value: 150, message: "Max 150 characters" } },
  routeTo: { maxLength: { value: 150, message: "Max 150 characters" } },
  purpose: { maxLength: { value: 150, message: "Max 150 characters" } },
  fxRate: { min: { value: 0.00000001, message: "Must be greater than 0" } },
};

/** Currencies the fleet actually crosses into. Free-form would invite typos the server rejects. */
const FX_CURRENCIES = [{ code: "NPR", label: "NPR — Nepali Rupee" }];

/** Sticky across Save & New: a dispatcher builds a day of duties on the same route and booking. */
const STICKY_KEYS = ["bookingPublicId", "routeFrom", "routeTo", "purpose", "startDatetime", "fxCurrency", "fxRate"];

export default function FleetTripForm() {
  const { publicId } = useParams();
  const isEdit = !!publicId;
  const navigate = useNavigate();
  const { showToast } = useToast();

  const formRef = useRef(null);
  const vehicleRef = useRef(null);

  const [loading, setLoading] = useState(isEdit);
  const [status, setStatus] = useState(null);
  const [vehicleOpts, setVehicleOpts] = useState([]);
  const [driverOpts, setDriverOpts] = useState([]);
  const [bookingOpts, setBookingOpts] = useState([]);
  const [addAnother, setAddAnother] = useState(false);

  const {
    register, handleSubmit, reset, watch, getValues, setValue,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: BLANK, mode: "onBlur", reValidateMode: "onChange" });

  // Vehicle and driver may only change while PLANNED; after that a change is a handover, which is a
  // different act with its own endpoint (PATCH /trips/{id}/swap) because it opens a new leg.
  const lockAssignment = isEdit && status && status !== "PLANNED";

  const vehiclePublicId = watch("vehiclePublicId");
  const driverPublicId = watch("driverPublicId");
  const bookingPublicId = watch("bookingPublicId");
  const fxCurrency = watch("fxCurrency");
  const endDatetime = watch("endDatetime");

  useEffect(() => {
    fleetService.vehicleOptions().then(setVehicleOpts).catch(() => setVehicleOpts([]));
    fleetService.driverOptions("ACTIVE").then(setDriverOpts).catch(() => setDriverOpts([]));
    bookingService
      .getAll(0, 500)
      .then((res) => {
        const list = res?.data?.data ?? res?.data ?? [];
        setBookingOpts(
          (Array.isArray(list) ? list : [])
            .filter((b) => b.publicId)
            .map((b) => ({
              publicId: b.publicId,
              label:
                [b.bookingCode || b.code || b.reference, b.customerName || b.customer, b.destination]
                  .filter(Boolean).join(" · ") || b.publicId,
            })),
        );
      })
      // Empty in a Fleet-only deployment — there is no booking module, and the field just shows no
      // options rather than erroring. See StandaloneJobReferencePort on the backend.
      .catch(() => setBookingOpts([]));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    let alive = true;
    setLoading(true);
    fleetService
      .getTrip(publicId)
      .then((t) => {
        if (!alive || !t) return;
        setStatus(t.status);
        reset({
          vehiclePublicId: t.vehiclePublicId ?? "",
          driverPublicId: t.driverPublicId ?? "",
          bookingPublicId: t.bookingPublicId ?? "",
          startDatetime: toDateTimeInput(t.startDatetime) || nowDateTimeInput(),
          endDatetime: toDateTimeInput(t.endDatetime),
          startOdometer: t.startOdometer ?? "",
          endOdometer: t.endOdometer ?? "",
          routeFrom: t.routeFrom ?? "", routeTo: t.routeTo ?? "", purpose: t.purpose ?? "",
          fxCurrency: t.fxCurrency ?? "", fxRate: t.fxRate ?? "",
          fuelCost: t.fuelCost ?? "", tollCost: t.tollCost ?? "",
          driverAllowance: t.driverAllowance ?? "", remarks: t.remarks ?? "",
        });
      })
      .catch((e) => showToast(errMsg(e, "Failed to load trip."), "error"))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [isEdit, publicId, reset, showToast]);

  const onKeyDown = useFormKeyboard(formRef, setAddAnother, isSubmitting);

  const resetForm = ({ keepSticky = true } = {}) => {
    if (!keepSticky) { reset(BLANK); return; }
    const current = getValues();
    const sticky = Object.fromEntries(STICKY_KEYS.map((k) => [k, current[k]]));
    reset({ ...BLANK, ...sticky });
  };

  const onSubmit = async (data) => {
    const common = {
      bookingPublicId: data.bookingPublicId || null,
      startDatetime: data.startDatetime || null,
      endDatetime: data.endDatetime || null,
      startOdometer: toNum(data.startOdometer),
      endOdometer: toNum(data.endOdometer),
      routeFrom: data.routeFrom?.trim() || null,
      routeTo: data.routeTo?.trim() || null,
      purpose: data.purpose?.trim() || null,
      fxCurrency: data.fxCurrency || null,
      fxRate: data.fxCurrency ? toNum(data.fxRate) : null,
      remarks: data.remarks?.trim() || null,
    };
    // Legacy scalars travel only on edit — see the header note. A new trip's costs belong in the
    // expense ledger, and sending both is how one tank of diesel is counted twice.
    const legacy = isEdit
      ? {
          fuelCost: toNum(data.fuelCost),
          tollCost: toNum(data.tollCost),
          driverAllowance: toNum(data.driverAllowance),
        }
      : {};

    try {
      if (isEdit) {
        const payload = lockAssignment
          ? { ...common, ...legacy }
          : { ...common, ...legacy, vehiclePublicId: data.vehiclePublicId, driverPublicId: data.driverPublicId };
        await fleetService.updateTrip(publicId, payload);
        showToast("Trip updated.", "success");
        navigate(`/fleet/trips/${publicId}`);
        return;
      }

      const created = await fleetService.createTrip({
        vehiclePublicId: data.vehiclePublicId,
        driverPublicId: data.driverPublicId,
        ...common,
      });
      showToast(
        created?.status === "COMPLETED" ? "Completed trip logged." : "Trip planned.",
        "success",
      );

      if (addAnother) {
        resetForm({ keepSticky: true });
        setTimeout(() => vehicleRef.current?.focus?.(), 0);
        return;
      }
      navigate(created?.publicId ? `/fleet/trips/${created.publicId}` : "/fleet/trips");
    } catch (e) {
      showToast(errMsg(e, "Couldn't save the trip."), "error");
    } finally {
      setAddAnother(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/60"
           style={{ fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}>
        <LoadingState label="Loading trip…" />
      </div>
    );
  }

  const Actions = ({ compact }) => (
    <SaveBar
      isEdit={isEdit}
      submitting={isSubmitting}
      compact={compact}
      onClear={() => resetForm({ keepSticky: false })}
      onIntent={setAddAnother}
      saveLabel={isEdit ? "Save changes" : endDatetime ? "Log completed trip" : "Plan trip"}
    />
  );

  return (
    <FleetForm
      formRef={formRef}
      onSubmit={handleSubmit(onSubmit)}
      onKeyDown={onKeyDown}
      icon={RouteIcon}
      title={isEdit ? "Edit trip" : "New trip"}
      subtitle={isEdit ? "Update trip details." : "Plan a duty, or log one that already happened."}
      badge={isEdit && status ? <StatusBadge config={TRIP_STATUS} value={status} /> : null}
      onBack={() => navigate("/fleet/trips")}
      actions={Actions}
      hint={<KeyboardHint showSaveAndNew={!isEdit} />}
    >
      <Section
        title="Assignment"
        hint={lockAssignment
          ? "Locked once the trip starts. A change on the road is a handover, not an edit — use Hand over on the trip page, which opens a new leg and keeps the odometer chain."
          : "Which vehicle and driver are running this duty."}
        first
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Vehicle" required error={errors.vehiclePublicId?.message}>
            <input type="hidden" {...register("vehiclePublicId", RULES.vehiclePublicId)} />
            <SearchableSelect
              accent="blue"
              loading={lockAssignment}
              options={vehicleOpts.map((o) => ({ value: o.publicId, label: o.label }))}
              value={vehiclePublicId || ""}
              onChange={(v) => setValue("vehiclePublicId", v, { shouldDirty: true, shouldValidate: true })}
              placeholder="Search vehicles…"
            />
          </Field>

          <Field label="Driver" required error={errors.driverPublicId?.message}>
            <input type="hidden" {...register("driverPublicId", RULES.driverPublicId)} />
            <SearchableSelect
              accent="blue"
              loading={lockAssignment}
              options={driverOpts.map((o) => ({ value: o.publicId, label: o.label }))}
              value={driverPublicId || ""}
              onChange={(v) => setValue("driverPublicId", v, { shouldDirty: true, shouldValidate: true })}
              placeholder="Search drivers…"
            />
          </Field>

          <Field
            label="Linked booking" optional
            note={bookingOpts.length === 0
              ? <><Info className="mt-px h-3 w-3 shrink-0" /> No booking module in this deployment</>
              : undefined}
          >
            <SearchableSelect
              accent="blue"
              options={[{ value: "", label: "— None —" },
                        ...bookingOpts.map((o) => ({ value: o.publicId, label: o.label }))]}
              value={bookingPublicId || ""}
              onChange={(v) => setValue("bookingPublicId", v, { shouldDirty: true })}
              placeholder="Search bookings…"
            />
          </Field>
        </div>
      </Section>

      <Section
        title="Schedule & route"
        hint={!isEdit
          ? "Set an end time to log a trip that has already happened — it is saved as completed, with no effect on vehicle status."
          : "Timing, odometer and route."}
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Start" required htmlFor="startDatetime" error={errors.startDatetime?.message}>
            <input id="startDatetime" type="datetime-local" className={fieldCls}
                   aria-invalid={!!errors.startDatetime}
                   {...register("startDatetime", RULES.startDatetime)} />
          </Field>

          <Field label="End" optional htmlFor="endDatetime"
                 note={!isEdit && endDatetime
                   ? <><Info className="mt-px h-3 w-3 shrink-0" /> Saves as a completed trip</>
                   : undefined}
                 noteTone="blue">
            <input id="endDatetime" type="datetime-local" className={fieldCls} {...register("endDatetime")} />
          </Field>

          <Field label="Start odometer" optional htmlFor="startOdometer" error={errors.startOdometer?.message}>
            <input id="startOdometer" type="number" inputMode="numeric" className={fieldCls}
                   placeholder="km" {...register("startOdometer", RULES.startOdometer)} />
          </Field>

          <Field label="End odometer" optional htmlFor="endOdometer" error={errors.endOdometer?.message}>
            <input id="endOdometer" type="number" inputMode="numeric" className={fieldCls}
                   placeholder="km" {...register("endOdometer", RULES.endOdometer)} />
          </Field>

          <Field label="From" optional htmlFor="routeFrom" error={errors.routeFrom?.message}>
            <input id="routeFrom" className={fieldCls} placeholder="Dehradun"
                   {...register("routeFrom", RULES.routeFrom)} />
          </Field>

          <Field label="To" optional htmlFor="routeTo" error={errors.routeTo?.message}>
            <input id="routeTo" className={fieldCls} placeholder="Kathmandu"
                   {...register("routeTo", RULES.routeTo)} />
          </Field>

          <Field label="Purpose" optional htmlFor="purpose" error={errors.purpose?.message}
                 className="sm:col-span-2">
            <input id="purpose" className={fieldCls} placeholder="Char Dham yatra, airport transfer…"
                   {...register("purpose", RULES.purpose)} />
          </Field>
        </div>
      </Section>

      <Section
        title="Cross-border"
        hint="Set one rate for the whole trip. Every foreign-currency cost recorded against it converts at this rate and freezes it — so the driver enters NPR as NPR and never touches a conversion."
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Foreign currency" optional htmlFor="fxCurrency">
            <select id="fxCurrency" className={fieldCls} {...register("fxCurrency")}>
              <option value="">— Domestic trip —</option>
              {FX_CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </Field>

          {fxCurrency && (
            <Field
              label={`Rate — 1 ${fxCurrency} = ? INR`}
              required
              htmlFor="fxRate"
              error={errors.fxRate?.message}
              note={<><AlertTriangle className="mt-px h-3 w-3 shrink-0" /> Editing this later does not restate costs already recorded</>}
              noteTone="amber"
            >
              <input id="fxRate" type="number" step="0.00000001" inputMode="decimal"
                     className={fieldCls} placeholder="0.625"
                     aria-invalid={!!errors.fxRate}
                     {...register("fxRate", { ...RULES.fxRate, required: "Set the rate for this trip" })} />
            </Field>
          )}
        </div>
      </Section>

      {/* OLD — replaced in Fleet Management redesign
        <FormSection title="Expenses" subtitle="Optional — recorded when the trip is closed" icon={Receipt}>
          <Field label="Fuel Cost (₹)"><Input type="number" {...register("fuelCost")} /></Field>
          <Field label="Toll Cost (₹)"><Input type="number" {...register("tollCost")} /></Field>
          <Field label="Driver Allowance (₹)"><Input type="number" {...register("driverAllowance")} /></Field>
        </FormSection>
        These three scalars predate the expense ledger. Collecting them here AND in the ledger is how
        one tank of diesel becomes Rs 12,000, so they are gone from create; on edit they stay
        editable so existing figures remain correctable until the cutover migration retires them. */}
      {isEdit && (
        <Section
          title="Legacy costs"
          hint="Recorded before the expense ledger existed. New costs belong in Expenses — these stay editable only so old figures can be corrected."
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="Fuel (₹)" optional htmlFor="fuelCost">
              <input id="fuelCost" type="number" step="0.01" inputMode="decimal" className={fieldCls}
                     {...register("fuelCost")} />
            </Field>
            <Field label="Toll (₹)" optional htmlFor="tollCost">
              <input id="tollCost" type="number" step="0.01" inputMode="decimal" className={fieldCls}
                     {...register("tollCost")} />
            </Field>
            <Field label="Driver allowance (₹)" optional htmlFor="driverAllowance">
              <input id="driverAllowance" type="number" step="0.01" inputMode="decimal" className={fieldCls}
                     {...register("driverAllowance")} />
            </Field>
          </div>
        </Section>
      )}

      {!isEdit && (
        <Section title="Costs" hint="Recorded against the trip as they happen.">
          <div className="flex max-w-2xl items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-[13px] text-blue-800">
            <Receipt className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Fuel, tolls, parking, Bhansar and the rest go in <strong>Fleet&nbsp;→&nbsp;Expenses</strong>,
              against this trip. Entering them there keeps the driver&apos;s cash settlement and the
              vehicle&apos;s running cost in one place.
            </p>
          </div>
        </Section>
      )}

      <Section title="Remarks">
        <textarea rows={3} className={`${fieldCls} max-w-3xl resize-y`}
                  placeholder="Anything worth noting about this duty…" {...register("remarks")} />
      </Section>
    </FleetForm>
  );
}
