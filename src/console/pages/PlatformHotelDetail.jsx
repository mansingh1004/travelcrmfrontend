// src/console/pages/PlatformHotelDetail.jsx
//
// The catalog editor for one hotel. Converted from the old mocked
// `features/hotels/pages/HotelDetails.jsx` — same section layout and gallery, but the PMS tabs
// (bookings, housekeeping, occupancy) are gone: this screen describes a product the platform sells,
// not a property someone operates.
//
// Publish and unpublish are the only two actions here that change what every tenant on the platform
// can buy, so both go through the SuperAdmin step-up MFA modal — the same treatment as a plan change.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  BedDouble, Building2, Check, MapPin, Pencil, Plus, Trash2, UtensilsCrossed, X as XIcon,
} from "lucide-react";
import {
  PageShell, HotelStyles, GlassCard, SectionCard, FormHeader,
  Input, Textarea, Label, Select, Button, Badge,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter,
  LoadingState, EmptyState, StarRating, useToast, errMsg,
} from "../components/hotelUi";
import SuperAdminMfaActionModal from "../components/SuperAdminMfaActionModal";
import { useStepUp } from "../components/useStepUp";
import { platformHotelService, CATALOG_STATUS, MEAL_PLAN_CODES } from "../api/platformHotelService";
import { CatalogStatusBadge } from "./PlatformHotels";

export default function PlatformHotelDetail() {
  const { publicId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [hotel, setHotel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mfaAction, setMfaAction] = useState(null);   // {type:'publish'|'unpublish', target?, reason?}
  const [mfaSaving, setMfaSaving] = useState(false);
  const [mfaError, setMfaError] = useState("");
  const [unpublishOpen, setUnpublishOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setHotel(await platformHotelService.get(publicId));
    } catch (e) {
      showToast(errMsg(e, "Failed to load the hotel."), "error");
    } finally {
      setLoading(false);
    }
  }, [publicId, showToast]);

  useEffect(() => { load(); }, [load]);

  const activeRooms = (hotel?.rooms ?? []).filter((r) => r.active);
  const canPublish = activeRooms.length > 0;

  const confirmMfa = async (code) => {
    if (!mfaAction) return;
    setMfaSaving(true);
    setMfaError("");
    try {
      const updated = mfaAction.type === "publish"
        ? await platformHotelService.publish(publicId, code)
        : await platformHotelService.unpublish(publicId, mfaAction.target, mfaAction.reason, code);
      setHotel(updated);
      setMfaAction(null);
      showToast(mfaAction.type === "publish" ? "Hotel published." : "Hotel withdrawn from sale.", "success");
    } catch (e) {
      setMfaError(errMsg(e, "Action failed."));
    } finally {
      setMfaSaving(false);
    }
  };

  if (loading) return <PageShell><HotelStyles /><LoadingState label="Loading hotel…" /></PageShell>;
  if (!hotel) {
    return (
      <PageShell>
        <HotelStyles />
        <GlassCard><EmptyState icon={Building2} title="Hotel not found" hint="It may have been deleted." /></GlassCard>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <HotelStyles />

      <FormHeader
        backLabel="Hotel Catalog"
        onBack={() => navigate("/console/hotel-catalog")}
        icon={Building2}
        title={hotel.name}
        subtitle={[hotel.cityName, hotel.stateName, hotel.countryCode].filter(Boolean).join(", ")}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <CatalogStatusBadge value={hotel.status} />
            <Badge variant="slate">v{hotel.catalogVersion}</Badge>
            {hotel.linkedTenantCount > 0 && (
              <Badge variant="blue">Imported by {hotel.linkedTenantCount} tenant{hotel.linkedTenantCount === 1 ? "" : "s"}</Badge>
            )}
            {/* The detail page was read-only apart from publishing, so a hotel could be created and
                then never filled in — and a hotel with no active room cannot be published at all. */}
            <Button size="sm" variant="outline" onClick={() => navigate(`/console/hotel-catalog/${publicId}/edit`)}>
              Edit
            </Button>
            {hotel.status === "ACTIVE" ? (
              <Button size="sm" variant="outline" onClick={() => setUnpublishOpen(true)}>Unpublish</Button>
            ) : (
              <Button
                size="sm"
                disabled={!canPublish}
                title={canPublish ? undefined : "Add at least one active room first"}
                onClick={() => { setMfaError(""); setMfaAction({ type: "publish" }); }}
              >
                Publish
              </Button>
            )}
          </div>
        }
      />

      {!canPublish && hotel.status !== "ACTIVE" && (
        <GlassCard className="mb-5 border-amber-200 bg-amber-50/70 p-4">
          <p className="text-sm font-semibold text-amber-800">
            This hotel has no active room, so it cannot be published. A published hotel with nothing
            sellable appears in tenant search and dead-ends there.
          </p>
        </GlassCard>
      )}

      {hotel.status === "ACTIVE" && (
        <GlassCard className="mb-5 flex items-center gap-3 p-4">
          <StarRating value={hotel.rating ?? hotel.stars ?? 0} size={15} showValue />
          <span className="text-sm text-muted">
            Live in Platform Hotel — every entitled tenant can search and import it.
          </span>
        </GlassCard>
      )}

      <IdentitySection hotel={hotel} onSaved={setHotel} />
      <AmenitiesSection hotel={hotel} onSaved={setHotel} />
      <RoomsSection hotel={hotel} onChanged={load} />
      <MealPlansSection hotel={hotel} onChanged={load} />

      {unpublishOpen && (
        <UnpublishDialog
          hotel={hotel}
          onClose={() => setUnpublishOpen(false)}
          onConfirm={({ target, reason }) => {
            setUnpublishOpen(false);
            setMfaError("");
            setMfaAction({ type: "unpublish", target, reason });
          }}
        />
      )}

      {mfaAction && (
        <SuperAdminMfaActionModal
          title={mfaAction.type === "publish" ? "Confirm publish" : "Confirm unpublish"}
          description={
            mfaAction.type === "publish"
              ? "This makes the hotel visible to every entitled tenant."
              : "This stops new sales. Tenants keep what they already imported."
          }
          confirmLabel={mfaAction.type === "publish" ? "Publish" : "Unpublish"}
          saving={mfaSaving}
          error={mfaError}
          onClose={() => { if (!mfaSaving) { setMfaAction(null); setMfaError(""); } }}
          onConfirm={confirmMfa}
        />
      )}
    </PageShell>
  );
}

/* ═════════════════════════════════════════════════════════════
   Identity / location / content
═════════════════════════════════════════════════════════════ */

function IdentitySection({ hotel, onSaved }) {
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => toForm(hotel));
  const stepUp = useStepUp();
  const saving = stepUp.busy;

  useEffect(() => { setForm(toForm(hotel)); }, [hotel]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = () => stepUp.request({
    title: "Confirm hotel changes",
    description: "This updates the platform catalogue entry. Every tenant's copy re-syncs from it.",
    confirmLabel: "Save hotel",
    run: async (mfaCode) => {
      // amenities are owned by the section below — carry them through untouched so this PUT
      // does not blank them.
      const updated = await platformHotelService.update(hotel.publicId, {
        ...toPayload(form),
        amenities: hotel.amenities ?? [],
      }, mfaCode);
      onSaved(updated);
      setEditing(false);
      showToast("Hotel updated. Tenant copies will re-sync.", "success");
    },
  });

  return (
    <SectionCard
      title="Identity & location"
      subtitle="Copied into every tenant's hotel master on sync"
      icon={MapPin}
      right={
        editing ? (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setForm(toForm(hotel)); setEditing(false); }} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={save} disabled={saving || !form.name.trim() || !form.cityName.trim()}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit</Button>
        )
      }
    >
      {editing ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Hotel name" required><Input value={form.name} onChange={set("name")} /></Field>
          <Field label="City" required><Input value={form.cityName} onChange={set("cityName")} /></Field>
          <Field
            label="Country code (ISO)"
            hint="A tenant's own Country master is matched on exactly this code at import time. A wrong code is why an import later reports LOCATION_MAPPING_REQUIRED."
          >
            <Input
              value={form.countryCode}
              onChange={(e) => setForm((f) => ({ ...f, countryCode: e.target.value.toUpperCase().slice(0, 3) }))}
            />
          </Field>
          <Field label="State / region"><Input value={form.stateName} onChange={set("stateName")} /></Field>
          <Field label="City code"><Input value={form.cityCode} onChange={set("cityCode")} /></Field>
          <Field label="Stars">
            <Select value={form.stars} onChange={set("stars")}>
              <option value="">—</option>
              {[1, 2, 3, 4, 5, 6, 7].map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Rating (0–5)"><Input type="number" step="0.1" min="0" max="5" value={form.rating} onChange={set("rating")} /></Field>
          <Field label="Primary image URL"><Input value={form.primaryImageUrl} onChange={set("primaryImageUrl")} /></Field>
          <Field label="Address" className="md:col-span-2"><Input value={form.address} onChange={set("address")} /></Field>
          <Field label="Latitude"><Input type="number" step="any" value={form.latitude} onChange={set("latitude")} /></Field>
          <Field label="Longitude"><Input type="number" step="any" value={form.longitude} onChange={set("longitude")} /></Field>
          <Field label="Website"><Input value={form.website} onChange={set("website")} /></Field>
          <Field label="Map URL"><Input value={form.mapUrl} onChange={set("mapUrl")} /></Field>
          <Field label="Guest phone" hint="Printed on the voucher — never a settlement contact."><Input value={form.phone} onChange={set("phone")} /></Field>
          <Field label="Guest email"><Input value={form.email} onChange={set("email")} /></Field>
          <Field label="Overview" className="md:col-span-2"><Textarea rows={4} value={form.overview} onChange={set("overview")} /></Field>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2">
          <ReadRow label="Address" value={hotel.address} />
          <ReadRow label="Location" value={[hotel.cityName, hotel.stateName, hotel.countryCode].filter(Boolean).join(", ")} />
          <ReadRow label="City code" value={hotel.cityCode} />
          <ReadRow label="Stars" value={hotel.stars} />
          <ReadRow label="Rating" value={hotel.rating} />
          <ReadRow label="Coordinates" value={hotel.latitude != null && hotel.longitude != null ? `${hotel.latitude}, ${hotel.longitude}` : null} />
          <ReadRow label="Website" value={hotel.website} />
          <ReadRow label="Guest contact" value={[hotel.phone, hotel.email].filter(Boolean).join(" · ")} />
          {hotel.overview && (
            <div className="md:col-span-2">
              <p className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-muted">Overview</p>
              <p className="text-sm leading-relaxed text-body">{hotel.overview}</p>
            </div>
          )}
        </div>
      )}
      {stepUp.dialog}
    </SectionCard>
  );
}

/* ═════════════════════════════════════════════════════════════
   Amenities
═════════════════════════════════════════════════════════════ */

function AmenitiesSection({ hotel, onSaved }) {
  const [draft, setDraft] = useState("");
  const stepUp = useStepUp();
  const saving = stepUp.busy;

  /* An amenity edit is a PUT of the whole hotel, which is PLATFORM_HOTEL_UPDATE server-side — so
     adding or removing one chip needs the same step-up code as renaming the property. */
  const persist = (next, verb) => stepUp.request({
    title: verb === "add" ? "Confirm amenity" : "Confirm amenity removal",
    description: "Amenities are part of the catalogue entry, so this re-syncs to every tenant's copy.",
    confirmLabel: verb === "add" ? "Add amenity" : "Remove amenity",
    run: async (mfaCode) => {
      onSaved(await platformHotelService.update(
        hotel.publicId, { ...toPayload(toForm(hotel)), amenities: next }, mfaCode));
    },
  });

  const add = (e) => {
    e.preventDefault();
    const value = draft.trim();
    if (!value) return;
    const current = hotel.amenities ?? [];
    if (current.some((a) => a.toLowerCase() === value.toLowerCase())) { setDraft(""); return; }
    setDraft("");
    persist([...current, value], "add");
  };

  return (
    <SectionCard title="Amenities" subtitle="Synced to every tenant copy" icon={Check}>
      <div className="mb-3 flex flex-wrap gap-2">
        {(hotel.amenities ?? []).length === 0 && (
          <p className="text-sm text-muted">No amenities yet.</p>
        )}
        {(hotel.amenities ?? []).map((a) => (
          <span key={a} className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-[13px] font-bold text-accent-hover">
            {a}
            <button
              type="button"
              disabled={saving}
              onClick={() => persist((hotel.amenities ?? []).filter((x) => x !== a), "remove")}
              className="text-focus transition-colors hover:text-accent-hover disabled:opacity-50"
              aria-label={`Remove ${a}`}
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>
      <form onSubmit={add} className="flex gap-2">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Free WiFi" className="max-w-xs" />
        <Button type="submit" variant="outline" size="sm" disabled={saving || !draft.trim()}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </form>
      {stepUp.dialog}
    </SectionCard>
  );
}

/* ═════════════════════════════════════════════════════════════
   Rooms — descriptive + occupancy only. No price: a room's price
   depends on date, meal plan and occupancy, so it belongs to a
   rate plan and a dated calendar, not here.
═════════════════════════════════════════════════════════════ */

const EMPTY_ROOM = { name: "", maxAdults: "", maxChildren: "", maxOccupancy: "", bedType: "", size: "", description: "", active: true };

/** ₹4,000 / $120 — compact enough to sit inside a table cell. */
const netMoney = (amount, currency = "INR") => {
  if (amount === null || amount === undefined) return "—";
  const n = Number(amount).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  return currency === "INR" ? `₹${n}` : `${currency} ${n}`;
};

const OCCUPANCY_SHORT = {
  SINGLE: "SGL", DOUBLE: "DBL", TRIPLE: "TPL",
  EXTRA_BED: "EXB", CHILD_WITH_BED: "CWB", CHILD_NO_BED: "CNB",
};

/**
 * The rates for one room, as `CP·DBL ₹4,000` chips.
 *
 * Rates arrive as a FLAT list on the hotel keyed by roomPublicId, not nested inside the room — the
 * room DTO is the same type tenants receive, so nesting a supplier net rate there would leak it.
 * Grouping is therefore the client's job.
 */
function RoomRates({ rates }) {
  if (!rates?.length) {
    return <span className="text-xs text-muted">No rate set</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {rates.map((r) => (
        <span key={r.publicId}
          title={[r.rateCode, r.refundable === false ? "Non-refundable" : r.refundable === true ? "Refundable" : null]
            .filter(Boolean).join(" · ") || undefined}
          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
            r.active ? "bg-accent-soft text-accent-soft-text" : "bg-surface-hover text-muted"}`}>
          <span className="opacity-70">{r.mealPlanCode}·{OCCUPANCY_SHORT[r.occupancyBasis] ?? r.occupancyBasis}</span>
          {netMoney(r.netRate, r.currency)}
        </span>
      ))}
    </div>
  );
}

function RoomsSection({ hotel, onChanged }) {
  const { showToast } = useToast();
  const [editing, setEditing] = useState(null);   // {mode:'add'|'edit', row}
  const stepUp = useStepUp();

  const ratesByRoom = useMemo(() => {
    const m = new Map();
    for (const r of hotel.rates ?? []) {
      if (!m.has(r.roomPublicId)) m.set(r.roomPublicId, []);
      m.get(r.roomPublicId).push(r);
    }
    return m;
  }, [hotel.rates]);

  const remove = (room) => stepUp.request({
    title: "Remove room",
    description: `This removes ${room.name} and its net rates from the catalogue. A hotel cannot be published without at least one active room.`,
    confirmLabel: "Remove room",
    run: async (mfaCode) => {
      await platformHotelService.deleteRoom(hotel.publicId, room.publicId, mfaCode);
      showToast(`${room.name} removed.`, "success");
      onChanged();
    },
  });

  return (
    <SectionCard
      title="Rooms & net rates"
      subtitle="Net rates are what the platform pays the hotel — never shown to a tenant"
      icon={BedDouble}
      right={<Button size="sm" onClick={() => setEditing({ mode: "add", row: EMPTY_ROOM })}><Plus className="h-4 w-4" /> Add room</Button>}
      bodyClass="p-0"
    >
      {(hotel.rooms ?? []).length === 0 ? (
        <div className="p-6"><EmptyState icon={BedDouble} title="No rooms yet" hint="A hotel cannot be published without at least one active room." /></div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Room</TableHead>
              <TableHead>Occupancy</TableHead>
              <TableHead>Bed</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Net rates</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(hotel.rooms ?? []).map((r) => (
              <TableRow key={r.publicId}>
                <TableCell className="font-bold text-body">{r.name}</TableCell>
                <TableCell className="text-body">
                  {[r.maxAdults != null ? `${r.maxAdults} adult${r.maxAdults === 1 ? "" : "s"}` : null,
                    r.maxChildren ? `${r.maxChildren} child${r.maxChildren === 1 ? "" : "ren"}` : null,
                    r.maxOccupancy != null ? `max ${r.maxOccupancy}` : null]
                    .filter(Boolean).join(" · ") || "—"}
                </TableCell>
                <TableCell className="text-body">{r.bedType || "—"}</TableCell>
                <TableCell className="text-body">{r.size || "—"}</TableCell>
                <TableCell>
                  <RoomRates rates={ratesByRoom.get(r.publicId)} />
                </TableCell>
                <TableCell>
                  <Badge variant={r.active ? "green" : "slate"}>{r.active ? "Active" : "Inactive"}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setEditing({ mode: "edit", row: r })} aria-label="Edit room">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(r)} aria-label="Remove room">
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {editing && (
        <RoomDialog
          hotel={hotel}
          mode={editing.mode}
          initial={editing.row}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onChanged(); }}
        />
      )}
      {stepUp.dialog}
    </SectionCard>
  );
}

function RoomDialog({ hotel, mode, initial, onClose, onSaved }) {
  const { showToast } = useToast();
  const [form, setForm] = useState(() => ({
    name: initial.name ?? "",
    maxAdults: initial.maxAdults ?? "",
    maxChildren: initial.maxChildren ?? "",
    maxOccupancy: initial.maxOccupancy ?? "",
    bedType: initial.bedType ?? "",
    size: initial.size ?? "",
    description: initial.description ?? "",
    active: initial.active ?? true,
  }));
  const stepUp = useStepUp();
  const saving = stepUp.busy;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Validate before asking for a code — a room with no name should fail on the form, not after the
  // operator has typed six digits.
  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || saving) return;
    const payload = {
      name: form.name.trim(),
      maxAdults: num(form.maxAdults),
      maxChildren: num(form.maxChildren),
      maxOccupancy: num(form.maxOccupancy),
      bedType: form.bedType.trim() || null,
      size: form.size.trim() || null,
      description: form.description.trim() || null,
      active: form.active,
    };
    stepUp.request({
      title: mode === "add" ? "Confirm new room" : "Confirm room changes",
      description: "Rooms are part of the catalogue entry, so this re-syncs to every tenant's copy.",
      confirmLabel: mode === "add" ? "Add room" : "Save room",
      run: async (mfaCode) => {
        if (mode === "add") await platformHotelService.addRoom(hotel.publicId, payload, mfaCode);
        else await platformHotelService.updateRoom(hotel.publicId, initial.publicId, payload, mfaCode);
        showToast(mode === "add" ? "Room added." : "Room updated.", "success");
        onSaved();
      },
    });
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !saving) onClose(); }}>
      <DialogContent onClose={() => { if (!saving) onClose(); }}>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{mode === "add" ? "Add room" : "Edit room"}</DialogTitle>
            <DialogDescription>Rooms carry no price — rates live on a dated calendar.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4 py-2">
            <Field label="Room name" required><Input value={form.name} onChange={set("name")} autoFocus placeholder="Deluxe Sea View" /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Max adults"><Input type="number" min="0" value={form.maxAdults} onChange={set("maxAdults")} /></Field>
              <Field label="Max children"><Input type="number" min="0" value={form.maxChildren} onChange={set("maxChildren")} /></Field>
              <Field label="Max occupancy"><Input type="number" min="1" value={form.maxOccupancy} onChange={set("maxOccupancy")} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bed type"><Input value={form.bedType} onChange={set("bedType")} placeholder="King" /></Field>
              <Field label="Size"><Input value={form.size} onChange={set("size")} placeholder="32 sqm" /></Field>
            </div>
            <Field label="Description"><Textarea rows={3} value={form.description} onChange={set("description")} /></Field>
            <label className="flex items-center gap-2 text-sm font-semibold text-body">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
              Active — offered to tenants
            </label>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving || !form.name.trim()}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
      {stepUp.dialog}
    </Dialog>
  );
}

/* ═════════════════════════════════════════════════════════════
   Meal plans — an inclusion, not a rate. No price field.
═════════════════════════════════════════════════════════════ */

function MealPlansSection({ hotel, onChanged }) {
  const { showToast } = useToast();
  const [editing, setEditing] = useState(null);
  const stepUp = useStepUp();

  const remove = (plan) => stepUp.request({
    title: "Remove meal plan",
    description: `This removes ${plan.code} from the catalogue. Rates that name this plan become uninterpretable, so check them after.`,
    confirmLabel: "Remove plan",
    run: async (mfaCode) => {
      await platformHotelService.deleteMealPlan(hotel.publicId, plan.publicId, mfaCode);
      showToast(`${plan.code} removed.`, "success");
      onChanged();
    },
  });

  return (
    <SectionCard
      title="Meal plans"
      subtitle="Inclusions offered with the rooms"
      icon={UtensilsCrossed}
      right={<Button size="sm" onClick={() => setEditing({ mode: "add", row: { code: "CP", name: "", description: "", active: true } })}><Plus className="h-4 w-4" /> Add plan</Button>}
      bodyClass="p-0"
    >
      {(hotel.mealPlans ?? []).length === 0 ? (
        <div className="p-6"><EmptyState icon={UtensilsCrossed} title="No meal plans yet" hint="Optional — a room-only hotel needs none." /></div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(hotel.mealPlans ?? []).map((m) => (
              <TableRow key={m.publicId}>
                <TableCell><Badge variant="indigo">{m.code}</Badge></TableCell>
                <TableCell className="font-bold text-body">{m.name}</TableCell>
                <TableCell className="text-body">{m.description || "—"}</TableCell>
                <TableCell><Badge variant={m.active ? "green" : "slate"}>{m.active ? "Active" : "Inactive"}</Badge></TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setEditing({ mode: "edit", row: m })} aria-label="Edit meal plan">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(m)} aria-label="Remove meal plan">
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {editing && (
        <MealPlanDialog
          hotel={hotel}
          mode={editing.mode}
          initial={editing.row}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onChanged(); }}
        />
      )}
      {stepUp.dialog}
    </SectionCard>
  );
}

function MealPlanDialog({ hotel, mode, initial, onClose, onSaved }) {
  const { showToast } = useToast();
  const [form, setForm] = useState(() => ({
    code: initial.code ?? "CP",
    name: initial.name ?? "",
    description: initial.description ?? "",
    active: initial.active ?? true,
  }));
  const stepUp = useStepUp();
  const saving = stepUp.busy;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    if (saving) return;
    const payload = {
      code: form.code,
      // Blank is allowed: the backend falls back to the code's own label, so a plan never renders
      // as a bare acronym.
      name: form.name.trim() || null,
      description: form.description.trim() || null,
      active: form.active,
    };
    stepUp.request({
      title: mode === "add" ? "Confirm new meal plan" : "Confirm meal plan changes",
      description: "Meal plans are part of the catalogue entry, so this re-syncs to every tenant's copy.",
      confirmLabel: mode === "add" ? "Add plan" : "Save plan",
      run: async (mfaCode) => {
        if (mode === "add") await platformHotelService.addMealPlan(hotel.publicId, payload, mfaCode);
        else await platformHotelService.updateMealPlan(hotel.publicId, initial.publicId, payload, mfaCode);
        showToast(mode === "add" ? "Meal plan added." : "Meal plan updated.", "success");
        onSaved();
      },
    });
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !saving) onClose(); }}>
      <DialogContent className="max-w-md" onClose={() => { if (!saving) onClose(); }}>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{mode === "add" ? "Add meal plan" : "Edit meal plan"}</DialogTitle>
            <DialogDescription>An inclusion, not a rate — there is no price field.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4 py-2">
            <Field label="Code" required>
              <Select value={form.code} onChange={set("code")}>
                {MEAL_PLAN_CODES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </Select>
            </Field>
            <Field label="Display name" hint="Leave blank to use the code's standard label.">
              <Input value={form.name} onChange={set("name")} placeholder="Breakfast" />
            </Field>
            <Field label="Description"><Textarea rows={3} value={form.description} onChange={set("description")} /></Field>
            <label className="flex items-center gap-2 text-sm font-semibold text-body">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
              Active — offered to tenants
            </label>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
      {stepUp.dialog}
    </Dialog>
  );
}

/* ═════════════════════════════════════════════════════════════
   Unpublish
═════════════════════════════════════════════════════════════ */

function UnpublishDialog({ hotel, onClose, onConfirm }) {
  const [target, setTarget] = useState("INACTIVE");
  const [reason, setReason] = useState("");

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md" onClose={onClose}>
        <DialogHeader>
          <DialogTitle>Withdraw from sale</DialogTitle>
          <DialogDescription>
            {hotel.linkedTenantCount > 0
              ? `${hotel.linkedTenantCount} tenant${hotel.linkedTenantCount === 1 ? " has" : "s have"} imported this hotel. Their copies are kept — quotations and bookings reference them — but stop being bookable through Platform Hotel.`
              : "No tenant has imported this hotel yet."}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4 py-2">
          <Field label="New status">
            <Select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="INACTIVE">{CATALOG_STATUS.INACTIVE.label} — withdrawn normally</option>
              <option value="SUSPENDED">{CATALOG_STATUS.SUSPENDED.label} — withdrawn for cause</option>
            </Select>
          </Field>
          <Field label="Reason" hint="Recorded in the platform audit log.">
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Supplier contract ended" />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={() => onConfirm({ target, reason: reason.trim() })}>Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ═════════════════════════════════════════════════════════════
   small helpers
═════════════════════════════════════════════════════════════ */

function Field({ label, required, hint, className, children }) {
  return (
    <div className={className}>
      <Label required={required}>{label}</Label>
      {children}
      {hint && <p className="mt-1 text-[11px] leading-relaxed text-muted">{hint}</p>}
    </div>
  );
}

function ReadRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-surface-hover py-2 last:border-0">
      <span className="text-[11px] font-extrabold uppercase tracking-wide text-muted">{label}</span>
      <span className="text-right text-sm font-semibold text-body">{value ?? "—"}</span>
    </div>
  );
}

/** Entity → controlled-input strings (nulls become "" so React never warns about uncontrolled inputs). */
function toForm(h) {
  return {
    name: h.name ?? "",
    cityName: h.cityName ?? "",
    countryCode: h.countryCode ?? "",
    stateName: h.stateName ?? "",
    cityCode: h.cityCode ?? "",
    address: h.address ?? "",
    latitude: h.latitude ?? "",
    longitude: h.longitude ?? "",
    stars: h.stars ?? "",
    rating: h.rating ?? "",
    website: h.website ?? "",
    mapUrl: h.mapUrl ?? "",
    overview: h.overview ?? "",
    primaryImageUrl: h.primaryImageUrl ?? "",
    phone: h.phone ?? "",
    email: h.email ?? "",
  };
}

/** Form strings → PlatformHotelRequest. Blanks become null, not "" — the DTO validates lengths. */
function toPayload(f) {
  return {
    name: f.name.trim(),
    cityName: f.cityName.trim(),
    countryCode: f.countryCode.trim().toUpperCase() || null,
    stateName: f.stateName.trim() || null,
    cityCode: f.cityCode.trim().toUpperCase() || null,
    address: f.address.trim() || null,
    latitude: num(f.latitude),
    longitude: num(f.longitude),
    stars: num(f.stars),
    rating: num(f.rating),
    website: f.website.trim() || null,
    mapUrl: f.mapUrl.trim() || null,
    overview: f.overview.trim() || null,
    primaryImageUrl: f.primaryImageUrl.trim() || null,
    phone: f.phone.trim() || null,
    email: f.email.trim() || null,
  };
}

function num(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}
