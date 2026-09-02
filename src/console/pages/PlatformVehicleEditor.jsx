// src/console/pages/PlatformVehicleEditor.jsx
//
// Enter or edit one catalog vehicle. Split out of PlatformVehicles' drawer for the same reason the
// hotel editor is its own route: the form carries identity, capacity, coverage, presentation and a
// rate table, and at `max-w-xl` a drawer showed a fraction of it while the decision to publish was
// taken on the rest. A route is also shareable and openable in a second tab, which is what comparing
// two listings actually needs.
//
// Sibling of PlatformHotelEditor — same shell, same back-link-plus-sticky-save shape. It stops short
// of that page's keyboard grid and MFA confirmation: this is the drawer's behaviour on a page, not a
// new set of guarantees.

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Save, Trash2 } from "lucide-react";
import {
  PageShell, HotelStyles, GlassCard,
  Input, Textarea, Label, Select, Button,
} from "../components/hotelUi";
import SuperAdminMfaActionModal from "../components/SuperAdminMfaActionModal";
import { transportAdminService as svc } from "../api/transportAdminService";

/** Mirrors `TransportVehicleType` loosely — the field is a free string server-side, so this is a
    convenience list rather than a constraint. An operator can still type something new. */
const VEHICLE_TYPES = [
  "SEDAN", "HATCHBACK", "SUV", "MUV", "TEMPO_TRAVELLER", "MINI_BUS", "BUS", "COACH", "LUXURY",
];

const EMPTY = {
  name: "",
  vehicleType: "SEDAN",
  passengerCapacity: "",
  luggageCapacity: "",
  airConditioned: true,
  description: "",
  primaryImageUrl: "",
  amenities: "",
  countryCode: "IN",
  stateName: "",
  cityName: "",
  cityCode: "",
  coverageNote: "",
  supplierVendorPublicId: "",
  // Who the vehicle actually belongs to. These MUST be on the form even though nothing here reads
  // them for display: the server applies the request wholesale (`PlatformVehicleCatalogServiceImpl
  // .apply` sets both unconditionally), so a field the editor does not send is a field the next save
  // nulls. A listing promoted from a transport partner arrives carrying both, and this page was
  // quietly erasing them on every edit.
  ownerCompanyName: "",
  ownerName: "",
};

export default function PlatformVehicleEditor() {
  const { publicId } = useParams();
  const navigate = useNavigate();
  const isNew = !publicId;

  const [form, setForm] = useState(EMPTY);
  // Rate cards are loaded with the vehicle rather than with the list: they are only ever shown in
  // the editor, and a list of twenty vehicles would otherwise drag every rate row with it.
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [mfaOpen, setMfaOpen] = useState(false);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const hydrate = useCallback((full) => {
    setRates(full.rates ?? []);
    setForm({
      ...EMPTY,
      ...full,
      // The admin DTO is @JsonInclude(NON_NULL), so an unset field is ABSENT rather than null and the
      // spread above leaves it undefined — which flips its input from controlled to uncontrolled.
      // Every optional string the form binds therefore gets an explicit "" here.
      passengerCapacity: full.passengerCapacity ?? "",
      luggageCapacity: full.luggageCapacity ?? "",
      supplierVendorPublicId: full.supplierVendorPublicId ?? "",
      ownerCompanyName: full.ownerCompanyName ?? "",
      ownerName: full.ownerName ?? "",
      description: full.description ?? "",
      primaryImageUrl: full.primaryImageUrl ?? "",
      stateName: full.stateName ?? "",
      cityCode: full.cityCode ?? "",
      coverageNote: full.coverageNote ?? "",
      // The wire carries a list; the editor is one comma-separated box, because a chip editor for
      // six words is more machinery than the job needs.
      amenities: Array.isArray(full.amenities) ? full.amenities.join(", ") : "",
    });
  }, []);

  useEffect(() => {
    if (isNew) return undefined;
    let alive = true;
    setLoading(true);
    setLoadError("");
    svc
      .getVehicle(publicId)
      .then((full) => {
        if (!alive) return;
        if (!full) { setLoadError("That vehicle could not be found."); return; }
        hydrate(full);
      })
      .catch((e) => {
        if (alive) setLoadError(e?.normalized?.message ?? "Could not load that vehicle.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [publicId, isNew, hydrate]);

  /* Create and update are both `@RequireSuperAdminStepUp` server-side (PLATFORM_VEHICLE_CREATE /
     _UPDATE), and `SuperAdminStepUpAspect` reads the code off the `X-SuperAdmin-Mfa-Code` header. It
     is collected once here and threaded through, exactly as PlatformHotelEditor does.

     This page used to call `svc.updateVehicle(publicId, payload)` with no code at all. It looked
     correct locally only because `app.super-admin.dev-login.enabled=true` makes
     `SuperAdminStepUpService.requireCode` return early; against a real deployment every save on this
     screen was a 403 with no way past it. A missing code is not a silent no-op. */
  async function save(mfaCode) {
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        name: form.name.trim(),
        vehicleType: form.vehicleType,
        passengerCapacity: form.passengerCapacity === "" ? null : Number(form.passengerCapacity),
        luggageCapacity: form.luggageCapacity === "" ? null : Number(form.luggageCapacity),
        airConditioned: !!form.airConditioned,
        description: form.description?.trim() || null,
        primaryImageUrl: form.primaryImageUrl?.trim() || null,
        amenities: form.amenities
          ? form.amenities.split(",").map((a) => a.trim()).filter(Boolean)
          : [],
        countryCode: form.countryCode?.trim() || null,
        stateName: form.stateName?.trim() || null,
        cityName: form.cityName?.trim() || null,
        cityCode: form.cityCode?.trim() || null,
        coverageNote: form.coverageNote?.trim() || null,
        supplierVendorPublicId: form.supplierVendorPublicId?.trim() || null,
        ownerCompanyName: form.ownerCompanyName?.trim() || null,
        ownerName: form.ownerName?.trim() || null,
      };
      // Land on the RECORD, not the list. A save that dumps the operator back into a catalog of
      // twelve cards makes them hunt for the row to check the change took — and a newly created
      // draft is invisible there until they think to filter. `create` answers with the DTO, so the
      // new vehicle has a page to go to as well.
      if (publicId) {
        await svc.updateVehicle(publicId, payload, mfaCode);
        navigate(`/console/transport-catalog/${publicId}`);
      } else {
        const created = await svc.createVehicle(payload, mfaCode);
        navigate(created?.publicId
          ? `/console/transport-catalog/${created.publicId}`
          : "/console/transport-catalog");
      }
    } catch (e) {
      setFormError(e?.normalized?.message ?? "Could not save that vehicle.");
      // Keep the operator on the page with the modal shut: the message belongs beside the form,
      // where the field that caused it is, not inside a dialog they must dismiss to read it.
      setMfaOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <PageShell>
        <HotelStyles />
        <p className="flex items-center justify-center gap-2 py-24 text-sm text-muted">
          <Loader2 size={15} className="animate-spin" /> Loading vehicle…
        </p>
      </PageShell>
    );
  }

  if (loadError) {
    return (
      <PageShell>
        <HotelStyles />
        <p className="py-24 text-center text-sm text-heading">{loadError}</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <HotelStyles />
      <div className="pb-28">
        {/* Back to where the edit was decided on, not to the top of the catalog: an operator who
            opened a vehicle, chose Edit and then changed their mind expects the row they were
            reading, not a list they have to find it in again. A NEW vehicle has no detail page to
            return to, so that one goes to the catalog. */}
        <button
          onClick={() => navigate(isNew ? "/console/transport-catalog" : `/console/transport-catalog/${publicId}`)}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <ArrowLeft size={15} /> {isNew ? "Transport catalog" : "Back to vehicle"}
        </button>

        <header className="mb-4">
          <h1 className="text-xl font-extrabold text-heading">
            {isNew ? "New catalog vehicle" : form.name || "Edit vehicle"}
          </h1>
          <p className="mt-0.5 text-xs text-muted">
            Creating mints a draft. Publishing is done from the catalog list, and is what makes the
            row sellable.
          </p>
        </header>

        {formError && (
          <p className="mb-4 rounded-lg border border-hue-rose/25 bg-hue-rose-soft px-3 py-2 text-sm text-hue-rose">
            {formError}
          </p>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Vehicle details">
            <F id="v-name" label="Name" required value={form.name} autoFocus onChange={(e) => set({ name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="v-type">Type</Label>
                <Select id="v-type" value={form.vehicleType} onChange={(e) => set({ vehicleType: e.target.value })}>
                  {VEHICLE_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                </Select>
              </div>
              <label className="flex items-end gap-2 pb-2.5 text-sm font-medium text-body">
                <input
                  type="checkbox"
                  checked={!!form.airConditioned}
                  onChange={(e) => set({ airConditioned: e.target.checked })}
                />
                Air conditioned
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F id="v-pax" label="Passengers" type="number" value={form.passengerCapacity} onChange={(e) => set({ passengerCapacity: e.target.value })} />
              <F id="v-bags" label="Luggage pieces" type="number" value={form.luggageCapacity} onChange={(e) => set({ luggageCapacity: e.target.value })} />
            </div>
          </Section>

          {/* Where the driver REPORTS FROM. It is also what a tenant's import resolves against —
              and transport deliberately refuses to invent a city they do not have, so a wrong
              value here turns into a 409 on their side rather than a silently wrong master row. */}
          <Section title="Reports from">
            <div className="grid grid-cols-2 gap-3">
              {/* Required server-side (@NotBlank). Marked and gated here too, or a blank city is a
                  400 the operator meets only after pressing Save. */}
              <F id="v-city" label="City" required value={form.cityName} onChange={(e) => set({ cityName: e.target.value })} />
              <F id="v-state" label="State" value={form.stateName} onChange={(e) => set({ stateName: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F id="v-country" label="Country code" value={form.countryCode} onChange={(e) => set({ countryCode: e.target.value })} />
              <F id="v-citycode" label="City code" value={form.cityCode} onChange={(e) => set({ cityCode: e.target.value })} />
            </div>
            <F id="v-coverage" label="Coverage note" value={form.coverageNote} onChange={(e) => set({ coverageNote: e.target.value })} />
          </Section>

          <Section title="How it is presented">
            <F id="v-image" label="Primary image" placeholder="Paste an image URL…" value={form.primaryImageUrl} onChange={(e) => set({ primaryImageUrl: e.target.value })} />
            <F
              id="v-amenities"
              label="Amenities"
              hint="Comma separated — water, charger, child seat"
              value={form.amenities}
              onChange={(e) => set({ amenities: e.target.value })}
            />
            <div>
              <Label htmlFor="v-desc">Description</Label>
              <Textarea
                id="v-desc"
                rows={3}
                value={form.description ?? ""}
                onChange={(e) => set({ description: e.target.value })}
              />
            </div>
          </Section>

          <Section title="Supplier">
            <F
              id="v-vendor"
              label="Supplier vendor publicId"
              hint="Optional. Ties the listing to the operator it belongs to."
              value={form.supplierVendorPublicId}
              onChange={(e) => set({ supplierVendorPublicId: e.target.value })}
            />
            {/* Carried over when a transport partner's fleet is promoted into the catalog. Editable
                here so a save round-trips them instead of clearing them — see the note on EMPTY. */}
            <div className="grid grid-cols-2 gap-3">
              <F
                id="v-owner-company"
                label="Owner company"
                value={form.ownerCompanyName}
                onChange={(e) => set({ ownerCompanyName: e.target.value })}
              />
              <F
                id="v-owner-name"
                label="Owner name"
                value={form.ownerName}
                onChange={(e) => set({ ownerName: e.target.value })}
              />
            </div>
          </Section>

          {/* Rates hang off a product publicId, so there is nothing to attach them to until the
              vehicle has been created once. */}
          {publicId && (
            <div className="lg:col-span-2">
              <RateCards
                vehiclePublicId={publicId}
                rates={rates}
                onChanged={async () => {
                  const full = await svc.getVehicle(publicId);
                  setRates(full?.rates ?? []);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Sticky, because a vehicle with its rates is a long page and the operator must never scroll
          back up to save. */}
      <div className="sticky bottom-0 z-20 -mx-4 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => { setFormError(""); setMfaOpen(true); }}
            disabled={saving || !form.name.trim() || !form.cityName.trim()}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Saving…" : isNew ? "Create as draft" : "Save changes"}
          </Button>
          <span className="text-xs text-muted">
            {isNew
              ? "Created as a draft — no agency sees it until you publish."
              : "Publishing is done from the catalog list."}
          </span>
        </div>
      </div>

      {mfaOpen && (
        <SuperAdminMfaActionModal
          title={isNew ? "Confirm new vehicle" : "Confirm vehicle changes"}
          description={
            isNew
              ? "This adds the vehicle to the platform catalog as a draft. No agency sees it until it is published."
              : "This saves the vehicle. Every agency holding a copy re-syncs it on their next read."
          }
          confirmLabel={isNew ? "Create draft" : "Save changes"}
          saving={saving}
          onClose={saving ? undefined : () => setMfaOpen(false)}
          onConfirm={save}
        />
      )}
    </PageShell>
  );
}

/* ── pieces ───────────────────────────────────────────────────────────── */

function Section({ title, className = "", children }) {
  return (
    <GlassCard className={`space-y-3 p-4 ${className}`}>
      <h2 className="text-sm font-extrabold text-heading">{title}</h2>
      {children}
    </GlassCard>
  );
}

function F({ id, label, hint, required, ...rest }) {
  return (
    <div>
      <Label htmlFor={id}>
        {label}{required && <span className="ml-0.5 text-hue-rose">*</span>}
      </Label>
      <Input id={id} {...rest} />
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Rate cards.

   DISPLAY-ONLY by design: they drive no pricing in v1. They exist so the person approving an order
   can see what the platform actually contracted while typing the approval figure — without them the
   approver is guessing, which is how a margin quietly goes negative.

   `netRate` is the platform's cost and must NEVER reach a tenant. It is safe here because this file
   is console-only; nothing in `features/` may import this component or the service behind it.

   Only reachable once the vehicle exists — a rate hangs off a product publicId, so the section is
   hidden while creating and appears after the first save.
   ═══════════════════════════════════════════════════════════════════════════ */

const RATE_MODELS = [
  "FLAT_PER_TRANSFER", "FLAT_PER_VEHICLE", "PER_KILOMETRE", "PER_DAY", "PER_HOUR",
  "PACKAGE", "ROUTE_FIXED", "CUSTOM_QUOTE",
];

const RATE_SERVICE_TYPES = [
  "AIRPORT_TRANSFER", "RAILWAY_TRANSFER", "POINT_TO_POINT", "LOCAL_PACKAGE",
  "OUTSTATION_ONE_WAY", "OUTSTATION_ROUND_TRIP", "MULTI_DAY_TOUR", "HOURLY_RENTAL", "CUSTOM",
];

const EMPTY_RATE = {
  serviceType: "POINT_TO_POINT",
  rateModel: "FLAT_PER_TRANSFER",
  netRate: "",
  currency: "INR",
  rateCode: "",
  includedKm: "",
  includedHours: "",
  extraKmRate: "",
  extraHourRate: "",
  driverAllowance: "",
  nightHalt: "",
  inclusionsText: "",
  active: true,
};

function RateCards({ vehiclePublicId, rates, onChanged }) {
  const [draft, setDraft] = useState(EMPTY_RATE);
  const [editingRate, setEditingRate] = useState(null); // publicId | null
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);
  /* All three rate verbs are `@RequireSuperAdminStepUp(PLATFORM_VEHICLE_RATE_CHANGE)` — a supplier's
     net rate is the number every approval is priced from. They cannot batch under one code the way
     the hotel editor's sequence does, because each is its own button press; so the pending action is
     parked here and the modal below replays it once a code is in hand. */
  const [pending, setPending] = useState(null); // {kind:"save"} | {kind:"delete", rate}

  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const num = (v) => (v === "" || v === null || v === undefined ? null : Number(v));

  function loadForEdit(r) {
    setDraft({
      ...EMPTY_RATE,
      ...r,
      netRate: r.netRate ?? "",
      includedKm: r.includedKm ?? "",
      includedHours: r.includedHours ?? "",
      extraKmRate: r.extraKmRate ?? "",
      extraHourRate: r.extraHourRate ?? "",
      driverAllowance: r.driverAllowance ?? "",
      nightHalt: r.nightHalt ?? "",
      inclusionsText: r.inclusionsText ?? "",
    });
    setEditingRate(r.publicId);
    setOpen(true);
  }

  function reset() {
    setDraft(EMPTY_RATE);
    setEditingRate(null);
    setErr("");
  }

  async function save(mfaCode) {
    setBusy(true);
    setErr("");
    try {
      const payload = {
        serviceType: draft.serviceType,
        rateModel: draft.rateModel,
        netRate: num(draft.netRate),
        currency: draft.currency || "INR",
        rateCode: draft.rateCode?.trim() || null,
        includedKm: num(draft.includedKm),
        includedHours: num(draft.includedHours),
        extraKmRate: num(draft.extraKmRate),
        extraHourRate: num(draft.extraHourRate),
        driverAllowance: num(draft.driverAllowance),
        nightHalt: num(draft.nightHalt),
        inclusionsText: draft.inclusionsText?.trim() || null,
        active: !!draft.active,
      };
      if (editingRate) await svc.updateRate(vehiclePublicId, editingRate, payload, mfaCode);
      else await svc.addRate(vehiclePublicId, payload, mfaCode);
      reset();
      setOpen(false);
      await onChanged();
    } catch (e) {
      setErr(e?.normalized?.message ?? "Could not save that rate.");
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  async function remove(r, mfaCode) {
    setBusy(true);
    setErr("");
    try {
      await svc.deleteRate(vehiclePublicId, r.publicId, mfaCode);
      if (editingRate === r.publicId) reset();
      await onChanged();
    } catch (e) {
      setErr(e?.normalized?.message ?? "Could not delete that rate.");
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  /** Replays whichever verb the operator pressed, once the modal has handed back a code. */
  const runPending = (mfaCode) =>
    pending?.kind === "delete" ? remove(pending.rate, mfaCode) : save(mfaCode);

  return (
    <GlassCard className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-extrabold text-heading">Contracted rates</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted">
            What the platform pays the operator. Shown to whoever approves an order so the figure they
            type has something behind it — these drive no pricing on their own, and no agency ever sees
            them.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => { reset(); setOpen((o) => !o); }}
          className="shrink-0"
        >
          {open ? "Close" : "Add a rate"}
        </Button>
      </div>

      {err && (
        <p className="mt-3 rounded-lg border border-hue-rose/25 bg-hue-rose-soft px-3 py-2 text-sm text-hue-rose">{err}</p>
      )}

      {rates.length > 0 ? (
        <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
          {rates.map((r) => (
            <li key={r.publicId} className="flex items-center gap-3 px-3 py-2">
              <button onClick={() => loadForEdit(r)} className="min-w-0 flex-1 text-left">
                <div className="truncate text-sm font-semibold text-heading">
                  {String(r.serviceType ?? "").replace(/_/g, " ")}
                  <span className="ml-2 font-normal text-muted">
                    {String(r.rateModel ?? "").replace(/_/g, " ").toLowerCase()}
                  </span>
                  {!r.active && <span className="ml-2 text-[11px] font-semibold text-muted">(inactive)</span>}
                </div>
                <div className="mt-0.5 text-[11px] text-muted">
                  {[
                    r.rateCode,
                    r.includedKm ? `${r.includedKm} km` : null,
                    r.includedHours ? `${r.includedHours} hr` : null,
                    r.extraKmRate ? `+${r.extraKmRate}/km` : null,
                    r.driverAllowance ? `DA ${r.driverAllowance}` : null,
                    r.nightHalt ? `NH ${r.nightHalt}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </div>
              </button>
              <div className="shrink-0 text-right text-sm font-semibold tabular-nums text-heading">
                {r.netRate == null ? "—" : `${r.currency === "INR" ? "₹" : `${r.currency} `}${Number(r.netRate).toLocaleString("en-IN")}`}
              </div>
              <button
                onClick={() => { setErr(""); setPending({ kind: "delete", rate: r }); }}
                disabled={busy}
                title="Delete this rate"
                className="shrink-0 rounded-lg border border-hue-rose/25 px-2 py-1 text-xs font-semibold text-hue-rose hover:bg-hue-rose-soft disabled:opacity-50"
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">
          No rates recorded. The vehicle still sells — every listing is on request — but whoever
          approves will be working without the contracted figures.
        </p>
      )}

      {open && (
        <div className="mt-4 space-y-3 rounded-xl border border-border bg-page p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="r-service">Service</Label>
              <Select id="r-service" value={draft.serviceType} onChange={(e) => set("serviceType", e.target.value)}>
                {RATE_SERVICE_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="r-model">Charged as</Label>
              <Select id="r-model" value={draft.rateModel} onChange={(e) => set("rateModel", e.target.value)}>
                {RATE_MODELS.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <F id="r-net" label="Net rate" type="number" value={draft.netRate} onChange={(e) => set("netRate", e.target.value)} />
            <F id="r-cur" label="Currency" value={draft.currency} onChange={(e) => set("currency", e.target.value)} />
            <F id="r-code" label="Rate code" value={draft.rateCode} onChange={(e) => set("rateCode", e.target.value)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <F id="r-km" label="Included km" type="number" value={draft.includedKm} onChange={(e) => set("includedKm", e.target.value)} />
            <F id="r-hr" label="Included hours" type="number" value={draft.includedHours} onChange={(e) => set("includedHours", e.target.value)} />
            <F id="r-xkm" label="Extra / km" type="number" value={draft.extraKmRate} onChange={(e) => set("extraKmRate", e.target.value)} />
            <F id="r-xhr" label="Extra / hour" type="number" value={draft.extraHourRate} onChange={(e) => set("extraHourRate", e.target.value)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <F id="r-da" label="Driver allowance" type="number" value={draft.driverAllowance} onChange={(e) => set("driverAllowance", e.target.value)} />
            <F id="r-nh" label="Night halt" type="number" value={draft.nightHalt} onChange={(e) => set("nightHalt", e.target.value)} />
          </div>

          <F id="r-inc" label="What it includes" value={draft.inclusionsText} onChange={(e) => set("inclusionsText", e.target.value)} />

          <label className="flex items-center gap-2 text-sm font-medium text-body">
            <input type="checkbox" checked={!!draft.active} onChange={(e) => set("active", e.target.checked)} />
            Active
          </label>

          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => { reset(); setOpen(false); }}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => { setErr(""); setPending({ kind: "save" }); }}
              disabled={busy}
            >
              {busy ? "Saving…" : editingRate ? "Update rate" : "Add rate"}
            </Button>
          </div>
        </div>
      )}

      {pending && (
        <SuperAdminMfaActionModal
          title={pending.kind === "delete" ? "Confirm rate removal" : "Confirm rate change"}
          description={
            pending.kind === "delete"
              ? "This removes the contracted rate. Whoever approves the next order for this vehicle will price it without one."
              : "This changes what the platform pays the operator. No agency sees this figure."
          }
          confirmLabel={pending.kind === "delete" ? "Remove rate" : editingRate ? "Update rate" : "Add rate"}
          saving={busy}
          onClose={busy ? undefined : () => setPending(null)}
          onConfirm={runPending}
        />
      )}
    </GlassCard>
  );
}
