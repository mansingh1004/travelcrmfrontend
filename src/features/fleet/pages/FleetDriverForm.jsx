// src/features/fleet/pages/FleetDriverForm.jsx
// Create / edit a fleet driver (one component, both routes).
//
// Same treatment as the vehicle form, on the shared fleetFormKit: keyboard-first entry, onBlur
// validation, a comfortable single surface, and Save & New for onboarding a roster in one sitting.
// See fleetFormKit.jsx for the shell and the keyboard contract.
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { IdCard, AlertTriangle, Check, Info } from "lucide-react";

import fleetService from "../api/fleetService";
import { LoadingState, useToast, errMsg, toDateInput } from "../components/fleetUi";
import {
  FleetForm, Section, Field, SaveBar, KeyboardHint, useFormKeyboard, fieldCls,
} from "../components/fleetFormKit";

const BLANK = { name: "", phone: "", licenseNumber: "", licenseExpiry: "", notes: "" };

/** Validation, hoisted so the schema reads as one thing. Bounds mirror the backend columns. */
const RULES = {
  name: {
    required: "Name is required",
    maxLength: { value: 150, message: "Max 150 characters" },
  },
  phone: {
    maxLength: { value: 30, message: "Max 30 characters" },
    // Deliberately loose: the roster includes Nepali numbers on attached drivers and landlines for
    // older men. A strict 10-digit Indian pattern would make real drivers unenterable.
    pattern: { value: /^[0-9+\-\s()]*$/, message: "Digits, spaces and + - ( ) only" },
  },
  licenseNumber: { maxLength: { value: 40, message: "Max 40 characters" } },
};

/** Days until a date; negative once it has passed. */
function daysUntil(value) {
  if (!value) return null;
  const target = new Date(`${value}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86_400_000);
}

export default function FleetDriverForm() {
  const { publicId } = useParams();
  const isEdit = !!publicId;
  const navigate = useNavigate();
  const { showToast } = useToast();

  const formRef = useRef(null);
  const nameRef = useRef(null);

  const [loading, setLoading] = useState(isEdit);
  const [addAnother, setAddAnother] = useState(false);

  const {
    register, handleSubmit, reset, watch,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: BLANK, mode: "onBlur", reValidateMode: "onChange" });

  useEffect(() => {
    if (!isEdit) return;
    let alive = true;
    setLoading(true);
    fleetService
      .getDriver(publicId)
      .then((d) => {
        if (!alive || !d) return;
        reset({
          name: d.name ?? "",
          phone: d.phone ?? "",
          licenseNumber: d.licenseNumber ?? "",
          licenseExpiry: toDateInput(d.licenseExpiry),
          notes: d.notes ?? "",
        });
      })
      .catch((e) => showToast(errMsg(e, "Failed to load driver."), "error"))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [isEdit, publicId, reset, showToast]);

  const onKeyDown = useFormKeyboard(formRef, setAddAnother, isSubmitting);

  const onSubmit = async (data) => {
    const payload = {
      name: data.name?.trim(),
      phone: data.phone?.trim() || null,
      licenseNumber: data.licenseNumber?.trim() || null,
      licenseExpiry: data.licenseExpiry || null,
      notes: data.notes?.trim() || null,
    };
    try {
      if (isEdit) {
        await fleetService.updateDriver(publicId, payload);
        showToast("Driver updated.", "success");
        navigate("/fleet/drivers");
        return;
      }
      await fleetService.createDriver(payload);
      showToast(`${payload.name} added.`, "success");

      if (addAnother) {
        // Nothing carries over — every field here belongs to one man — so this is a blank slate,
        // just without the round trip through the list page.
        reset(BLANK);
        setTimeout(() => nameRef.current?.focus(), 0);
        return;
      }
      navigate("/fleet/drivers");
    } catch (e) {
      showToast(errMsg(e, "Couldn't save the driver."), "error");
    } finally {
      setAddAnother(false);
    }
  };

  /** Licence expiry is the one field that stops a vehicle at a check-post, so it says where it stands. */
  const licenceNote = () => {
    const d = daysUntil(watch("licenseExpiry"));
    if (d === null) {
      return {
        note: <><Info className="mt-px h-3 w-3 shrink-0" /> No date — this driver gets no expiry alert</>,
        noteTone: "slate",
      };
    }
    if (d < 0) return { note: <><AlertTriangle className="mt-px h-3 w-3 shrink-0" /> Expired {Math.abs(d)} day{Math.abs(d) === 1 ? "" : "s"} ago</>, noteTone: "red" };
    if (d === 0) return { note: <><AlertTriangle className="mt-px h-3 w-3 shrink-0" /> Expires today</>, noteTone: "amber" };
    if (d <= 30) return { note: <><AlertTriangle className="mt-px h-3 w-3 shrink-0" /> {d} days left</>, noteTone: "amber" };
    return { note: <><Check className="mt-px h-3 w-3 shrink-0" /> Valid</>, noteTone: "green" };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/60"
           style={{ fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}>
        <LoadingState label="Loading driver…" />
      </div>
    );
  }

  const nameReg = register("name", RULES.name);

  const Actions = ({ compact }) => (
    <SaveBar
      isEdit={isEdit}
      submitting={isSubmitting}
      compact={compact}
      onClear={() => reset(BLANK)}
      onIntent={setAddAnother}
      saveLabel={isEdit ? "Save changes" : "Add driver"}
    />
  );

  return (
    <FleetForm
      formRef={formRef}
      onSubmit={handleSubmit(onSubmit)}
      onKeyDown={onKeyDown}
      icon={IdCard}
      title={isEdit ? "Edit driver" : "New driver"}
      subtitle="Licence details drive the expiry alerts."
      onBack={() => navigate("/fleet/drivers")}
      actions={Actions}
      hint={<KeyboardHint showSaveAndNew={!isEdit} />}
    >
      <Section title="Identity" first>
        <div className="grid max-w-md grid-cols-1 gap-5">
          <Field label="Full name" required htmlFor="name" error={errors.name?.message}>
            <input
              {...nameReg}
              ref={(el) => { nameReg.ref(el); nameRef.current = el; }}
              id="name"
              className={fieldCls}
              placeholder="Ramesh Kumar"
              autoComplete="off"
              autoFocus
              aria-invalid={!!errors.name}
            />
          </Field>
        </div>
      </Section>

      <Section title="Contact" hint="Used for duty messages and expiry reminders.">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Phone" optional htmlFor="phone" error={errors.phone?.message}>
            <input id="phone" type="tel" inputMode="tel" className={fieldCls}
                   placeholder="+91 90000 00000" autoComplete="off"
                   aria-invalid={!!errors.phone} {...register("phone", RULES.phone)} />
          </Field>
        </div>
      </Section>

      <Section title="Licence"
               hint="An expired licence stops the vehicle at a check-post — these dates feed the alerts.">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Licence number" optional htmlFor="licenseNumber" error={errors.licenseNumber?.message}>
            <input id="licenseNumber" className={`${fieldCls} font-mono uppercase tracking-wide`}
                   placeholder="MH0120180000000" autoComplete="off"
                   {...register("licenseNumber", RULES.licenseNumber)} />
          </Field>

          <Field label="Licence expiry" optional htmlFor="licenseExpiry" {...licenceNote()}>
            <input id="licenseExpiry" type="date" className={fieldCls} {...register("licenseExpiry")} />
          </Field>
        </div>
      </Section>

      <Section title="Notes">
        <textarea rows={3} className={`${fieldCls} max-w-3xl resize-y`}
                  placeholder="Routes he knows, languages, anything worth remembering…"
                  {...register("notes")} />
      </Section>
    </FleetForm>
  );
}
