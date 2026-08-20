// src/features/fleet/pages/SupplierListings.jsx
//
// The operator's own listings on the platform transport catalog — what they are offering agencies.
//
// Creating never publishes. A listing lands as a DRAFT and a platform admin still presses Publish,
// so an operator can prepare their fleet without anything becoming sellable by accident. The
// `editable` flag on each row is the server's answer to "is this still mine to change" — once
// published, or once an order exists against it, parts of a listing stop being editable. Respect the
// flag rather than re-deriving it from the status, which is how the two quietly disagree.

import { useCallback, useEffect, useState } from "react";
import { Car, Lock, Plus, Trash2 } from "lucide-react";
import { transportSupplierService } from "../api/transportSupplierService";
import {
  Badge, Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
  EmptyState, Field, GlassCard, Input, LoadingState, PageHeader, PageShell, Pager, Select, Textarea,
  errMsg,
} from "../components/fleetUi";
import { useToast } from "@shared/ui/toast";

const PAGE_SIZE = 20;

const VEHICLE_TYPES = [
  "SEDAN", "HATCHBACK", "SUV", "MUV", "TEMPO_TRAVELLER", "MINI_BUS", "BUS", "COACH", "LUXURY",
];

const STATUS_VARIANT = {
  ACTIVE: "green",
  DRAFT: "amber",
  INACTIVE: "slate",
  SUSPENDED: "red",
};

const STATUS_LABEL = {
  ACTIVE: "Live",
  DRAFT: "Draft — awaiting review",
  INACTIVE: "Unpublished",
  SUSPENDED: "Suspended",
};

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
};

export default function SupplierListings() {
  const { showToast } = useToast();

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(null); // { publicId? } | null
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { rows: data, pagination: meta } = await transportSupplierService.listListings({
        page,
        size: PAGE_SIZE,
      });
      setRows(data ?? []);
      setPagination(meta);
    } catch (e) {
      showToast(errMsg(e, "Could not load your listings."), "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  function startCreate() {
    setForm(EMPTY);
    setEditing({});
  }

  function startEdit(row) {
    setForm({
      ...EMPTY,
      ...row,
      passengerCapacity: row.passengerCapacity ?? "",
      luggageCapacity: row.luggageCapacity ?? "",
      amenities: Array.isArray(row.amenities) ? row.amenities.join(", ") : "",
    });
    setEditing({ publicId: row.publicId });
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        vehicleType: form.vehicleType,
        passengerCapacity: form.passengerCapacity === "" ? null : Number(form.passengerCapacity),
        luggageCapacity: form.luggageCapacity === "" ? null : Number(form.luggageCapacity),
        airConditioned: !!form.airConditioned,
        description: form.description?.trim() || null,
        primaryImageUrl: form.primaryImageUrl?.trim() || null,
        amenities: form.amenities ? form.amenities.split(",").map((a) => a.trim()).filter(Boolean) : [],
        countryCode: form.countryCode?.trim() || null,
        stateName: form.stateName?.trim() || null,
        cityName: form.cityName?.trim() || null,
        cityCode: form.cityCode?.trim() || null,
        coverageNote: form.coverageNote?.trim() || null,
      };
      if (editing.publicId) await transportSupplierService.updateListing(editing.publicId, payload);
      else await transportSupplierService.createListing(payload);
      showToast(
        editing.publicId ? "Listing updated." : "Listing created as a draft — the platform team reviews it next.",
        "success",
      );
      setEditing(null);
      await load();
    } catch (e) {
      showToast(errMsg(e, "Could not save that listing."), "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(row) {
    try {
      await transportSupplierService.deleteListing(row.publicId);
      showToast("Listing removed.", "success");
      await load();
    } catch (e) {
      // The server refuses while agencies hold a copy or orders exist — that refusal is the safety,
      // and its message names the reason, so show it verbatim.
      showToast(errMsg(e, "Could not remove that listing."), "error");
    }
  }

  const totalPages = pagination?.totalPages ?? 0;
  const total = pagination?.totalElements ?? rows.length;

  return (
    <PageShell>
      <PageHeader
        icon={Car}
        title="My platform listings"
        subtitle="What agencies can request from you. A new listing is a draft until the platform team publishes it."
      >
        <Button onClick={startCreate}>
          <Plus className="size-4" /> Add a listing
        </Button>
      </PageHeader>

      {loading ? (
        <LoadingState label="Loading your listings…" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Car}
          title="No listings yet"
          hint="Add the vehicles you want to offer through the platform. Nothing goes live until it is reviewed."
          action={<Button onClick={startCreate}><Plus className="size-4" /> Add a listing</Button>}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => (
              <GlassCard key={r.publicId} className="flex flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-slate-900">{r.name}</h3>
                    <p className="mt-0.5 text-[13px] text-slate-500">
                      {String(r.vehicleType ?? "").replace(/_/g, " ")}
                      {r.passengerCapacity ? ` · ${r.passengerCapacity} pax` : ""}
                      {r.airConditioned ? " · AC" : ""}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[r.status] ?? "slate"}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </Badge>
                </div>

                {(r.cityName || r.stateName) && (
                  <p className="mt-2 text-[13px] text-slate-500">
                    Reports from {[r.cityName, r.stateName].filter(Boolean).join(", ")}
                  </p>
                )}

                <div className="mt-auto flex items-center gap-2 pt-3">
                  {r.editable ? (
                    <>
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => startEdit(r)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => remove(r)} title="Remove this listing">
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  ) : (
                    /* Not a disabled Edit button: an operator seeing a greyed control assumes it is
                       broken. Say WHY it is locked instead. */
                    <p className="flex items-center gap-1.5 text-[13px] text-slate-500">
                      <Lock className="size-3.5" />
                      Locked — the platform is selling this. Ask the team to change it.
                    </p>
                  )}
                </div>
              </GlassCard>
            ))}
          </div>

          <Pager page={page} totalPages={totalPages} total={total} onPage={setPage} className="mt-5" />
        </>
      )}

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-lg" onClose={() => setEditing(null)}>
          <DialogHeader>
            <DialogTitle>{editing?.publicId ? "Edit listing" : "New listing"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 px-6 py-4">
            <Field label="Name" required hint="What an agency sees — e.g. Innova Crysta (Goa)">
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Type">
                <Select value={form.vehicleType} onChange={(e) => setForm((f) => ({ ...f, vehicleType: e.target.value }))}>
                  {VEHICLE_TYPES.map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Air conditioned">
                <label className="flex h-10 items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={!!form.airConditioned}
                    onChange={(e) => setForm((f) => ({ ...f, airConditioned: e.target.checked }))}
                  />
                  Yes
                </label>
              </Field>
              <Field label="Passengers">
                <Input
                  type="number"
                  value={form.passengerCapacity}
                  onChange={(e) => setForm((f) => ({ ...f, passengerCapacity: e.target.value }))}
                />
              </Field>
              <Field label="Luggage pieces">
                <Input
                  type="number"
                  value={form.luggageCapacity}
                  onChange={(e) => setForm((f) => ({ ...f, luggageCapacity: e.target.value }))}
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="City" hint="Where the driver reports from">
                <Input value={form.cityName} onChange={(e) => setForm((f) => ({ ...f, cityName: e.target.value }))} />
              </Field>
              <Field label="State">
                <Input value={form.stateName} onChange={(e) => setForm((f) => ({ ...f, stateName: e.target.value }))} />
              </Field>
              <Field label="Country">
                <Input value={form.countryCode} onChange={(e) => setForm((f) => ({ ...f, countryCode: e.target.value }))} />
              </Field>
            </div>

            <Field label="Coverage note" hint="Anything an agency should know about where you will and will not go.">
              <Input value={form.coverageNote} onChange={(e) => setForm((f) => ({ ...f, coverageNote: e.target.value }))} />
            </Field>

            <Field label="Amenities" hint="Comma separated — water, charger, child seat">
              <Input value={form.amenities} onChange={(e) => setForm((f) => ({ ...f, amenities: e.target.value }))} />
            </Field>

            <Field label="Image URL">
              <Input value={form.primaryImageUrl} onChange={(e) => setForm((f) => ({ ...f, primaryImageUrl: e.target.value }))} />
            </Field>

            <Field label="Description">
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.name.trim()}>
              {saving ? "Saving…" : editing?.publicId ? "Save" : "Create as draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
