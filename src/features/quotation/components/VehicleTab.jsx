import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Car, Plus, IndianRupee, Users, Image as ImageIcon } from "lucide-react";
import { Label, Input, Textarea, SectionCard, RemoveBtn, IncludeToggle, EmptyState } from "./Ui";
import { vehicleService } from "@features/masters";
import { transportMarketplaceService } from "@features/marketplace";

// export default function VehicleTab({ onDataChange }) {
//   const [included, setIncluded] = useState(true);

   export default function VehicleTab({ onDataChange, paxInfo = {}, defaultIncluded = true, initialData = null }) {
  const [included, setIncluded] = useState(defaultIncluded);
  const [title,    setTitle]    = useState("Vehicle Details");
  const [vehicles, setVehicles] = useState([newVehicle()]);

  const hydratedRef = useRef(false);
  const includeTouchedRef = useRef(false);

  // ── Vehicle Master se saare vehicles (ek baar load) ──
  const [masterList,   setMasterList]   = useState([]);
  const [masterLoading, setMasterLoading] = useState(true);

  const loadMaster = useCallback(async () => {
    try {
      setMasterLoading(true);
      const res = await vehicleService.getAllVehicles();
      const raw = res.data?.data ?? res.data;
      const list = Array.isArray(raw) ? raw
        : Array.isArray(raw?.content) ? raw.content : [];
      // master loaded
      // The tenant's OWN vehicles, plus the platform catalog — as ONE list.
      //
      // Deliberately merged rather than given a second "Book via Platform" mode: this tab's whole
      // interaction is type then model, and a parallel mode would fork it into two things that
      // drift. A platform row is just another option, marked so the agent knows what they picked.
      //
      // A LINKED PRODUCT MUST APPEAR ONCE, not once from each source (design doc §8). Importing a
      // catalog product creates a projection in the tenant's own master, so a naive concat shows the
      // same vehicle twice — once as theirs, once as the platform's — and the agent has no way to
      // tell which is which. So an imported product ANNOTATES its projection with the catalog ids
      // instead of adding a row, and only un-imported products are appended.
      let platform = [];
      try {
        const { rows } = await transportMarketplaceService.searchVehicles({ page: 0, size: 100 });
        platform = rows ?? [];
      } catch {
        // No TRANSPORT_MARKETPLACE add-on is the ordinary case, and it answers 403. The tab then
        // shows the tenant's own master exactly as it always did.
      }

      const byProjection = new Map(
        platform.filter((p) => p.tenantVehiclePublicId).map((p) => [p.tenantVehiclePublicId, p]),
      );

      const merged = list.map((m) => {
        const linked = byProjection.get(m.publicId);
        if (!linked) return m;
        // Their own row, still theirs — it just also knows where it came from. Recording BOTH ids
        // is what keeps a saved line meaningful if the projection is later deleted.
        return {
          ...m,
          _platform: true,
          _platformPublicId: linked.publicId,
          _tenantProjectionPublicId: m.publicId,
        };
      });

      for (const p of platform) {
        if (p.tenantVehiclePublicId) continue; // already folded into its projection above
        merged.push({
          publicId: p.publicId,
          name: p.name,
          type: p.vehicleType,
          capacity: p.passengerCapacity,
          imagePath: p.primaryImageUrl,
          _platform: true,
          _platformPublicId: p.publicId,
          _tenantProjectionPublicId: null,
        });
      }

      setMasterList(merged);
    } catch (err) {
      console.error("Vehicle master load error:", err);
      setMasterList([]);
    } finally {
      setMasterLoading(false);
    }
  }, []);

  useEffect(() => { loadMaster(); }, [loadMaster]);

  // ── Master se unique TYPES nikaalo (dropdown ke liye) ──
  const vehicleTypes = useMemo(() => {
    const set = new Set(
      masterList.map(v => (v.type || "").trim()).filter(Boolean)
    );
    return [...set].sort();
  }, [masterList]);

  function newVehicle() {
    return {
      id: Date.now() + Math.random(),
      type: "", model: "", pickup: "", drop: "",
      vehicleMasterPublicId: null, platformTransportProductPublicId: null, platformRatePublicId: null,
      rateSource: "MANUAL",
      startDate: "", endDate: "",
      pricePerVehicle: 0, qty: 1, notes: "",
      // model select hone par auto-fill hote hain:
      imagePath: "", capacity: "", _vehicleId: null,
    };
  }

  // ── Auto price ────────────────────────────────────────────
  const vehicleTotals = vehicles.map(v => Number(v.pricePerVehicle) * Number(v.qty) || 0);
  const vehicleTotal  = vehicleTotals.reduce((a, b) => a + b, 0);

  // ── EDIT MODE PREFILL — saved quotation se state seed karo (ek hi baar) ──
  useEffect(() => {
    if (hydratedRef.current || !initialData) return;
    hydratedRef.current = true;
    includeTouchedRef.current = true;

    if (typeof initialData.included === "boolean") setIncluded(initialData.included);
    if (initialData.title) setTitle(initialData.title);
    if (Array.isArray(initialData.vehicles) && initialData.vehicles.length > 0) {
      setVehicles(initialData.vehicles.map(v => ({
        ...newVehicle(),
        ...v,
        id: Date.now() + Math.random(),
      })));
    }
  }, [initialData]);

  // ── Lead ke services se Include default (remount key ki jagah) ──
  useEffect(() => {
    if (includeTouchedRef.current) return;
    setIncluded(defaultIncluded);
  }, [defaultIncluded]);

  useEffect(() => {
    onDataChange?.({ included, title, vehicles, amount: vehicleTotal });
  }, [included, title, vehicles, vehicleTotal]);

  const add    = () => setVehicles(p => [...p, newVehicle()]);
  const remove = (id) => setVehicles(p => p.filter(v => v.id !== id));
  const update = (id, k, v) =>
    setVehicles(p => p.map(vh => vh.id === id ? { ...vh, [k]: v } : vh));

  // ── Type change → model reset (us type ke models filter honge) ──
  const handleTypeChange = (id, type) => {
    setVehicles(p => p.map(vh => vh.id === id
      ? { ...vh, type, model: "", imagePath: "", capacity: "", _vehicleId: null,
          // Cleared with the model. A stale platform id under a newly chosen type would quietly
          // attribute the line to a vehicle the agent had moved away from.
          vehicleMasterPublicId: null, platformTransportProductPublicId: null, platformRatePublicId: null,
          rateSource: "MANUAL" }
      : vh));
  };

  // ── Model change → us model ka image + capacity auto-fill (PDF mein dikhega) ──
  const handleModelChange = (id, modelName, type) => {
    // Master se woh exact vehicle dhundho (type + name match)
    const found = masterList.find(v =>
      (v.name || "").trim() === modelName.trim() &&
      (!type || (v.type || "").trim() === type.trim())
    );
    // image field backend se imagePath, par fallback bhi rakho (VehicleMaster jaisa)
    const img = found?.imagePath || found?.imagePreview || found?.image || "";
    setVehicles(p => p.map(vh => vh.id === id
      ? {
          ...vh,
          model: modelName,
          imagePath: img,
          capacity:  found?.capacity != null ? String(found.capacity) : "",
          _vehicleId: found?.publicId || found?.id || null,
          // Which row this line actually came from. A platform pick records BOTH ids where it can:
          // the catalog id is the one that survives the tenant deleting their imported projection.
          vehicleMasterPublicId: found?._platform
            ? (found._tenantProjectionPublicId ?? null)
            : (found?.publicId ?? null),
          platformTransportProductPublicId: found?._platform ? found._platformPublicId : null,
          // Rates are display-only in v1 and this tab shows none, so there is nothing honest to put
          // here yet. Left null rather than guessed.
          platformRatePublicId: null,
          // What this line was priced from, recorded at save time. PLATFORM only when the pick came
          // from the catalog; MASTER when it is the tenant's own row; MANUAL is the default a
          // hand-typed line keeps.
          rateSource: found ? (found._platform ? "PLATFORM" : "MASTER") : "MANUAL",
        }
      : vh));
  };

  // ── Kisi type ke liye available models ──
  const modelsForType = (type) =>
    masterList.filter(v => (v.type || "").trim() === (type || "").trim());

  return (
    <div className="space-y-4 sm:space-y-5">

      {/* ── Settings ── */}
      <SectionCard title="Vehicle Settings" icon={Car}>
        <div className="space-y-4">
          <IncludeToggle
            included={included}
            onChange={() => { includeTouchedRef.current = true; setIncluded(p => !p); }}
            label="Include Vehicle in Quotation"
          />
          {included && (
            <div>
              <Label>Section Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} />
            </div>
          )}
        </div>
      </SectionCard>

      {included ? (
        <>
          {vehicles.map((v, vi) => {
            const models = modelsForType(v.type);
            return (
            <SectionCard
              key={v.id}
              title={`Vehicle ${vi + 1}`}
              icon={Car}
              headerRight={
                vehicles.length > 1 && <RemoveBtn onClick={() => remove(v.id)} />
              }>

              <div className="space-y-3 sm:space-y-4">

                {/* ── Vehicle Type (left) + Model (right) ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Type — Master se unique types */}
                  <div>
                    <Label required>Vehicle Type</Label>
                    <select
                      value={v.type}
                      onChange={e => handleTypeChange(v.id, e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 cursor-pointer">
                      <option value="">
                        {masterLoading ? "Loading types…" : vehicleTypes.length === 0 ? "No types in master" : "Select type"}
                      </option>
                      {vehicleTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  {/* Model — us type ke models (Master se) */}
                  <div>
                    <Label required>Vehicle Model</Label>
                    <select
                      value={v.model}
                      onChange={e => handleModelChange(v.id, e.target.value, v.type)}
                      disabled={!v.type || masterLoading}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
                      <option value="">
                        {!v.type ? "Select type first" : models.length === 0 ? "No models for this type" : "Select model"}
                      </option>
                      {models.map(m => (
                        <option key={m.publicId || m.id} value={m.name}>
                          {m.name}{m.capacity ? ` (${m.capacity} seats)` : ""}{m._platform ? " · Platform" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* ── Selected model preview (image + capacity) — PDF mein bhi yahi image jaayega ── */}
                {v.model && v.imagePath && (
                  <div className="flex items-center gap-3 p-2.5 bg-orange-50 rounded-xl border border-orange-100">
                    <img src={v.imagePath} alt={v.model}
                      onError={(e) => {
                        e.target.style.display = "none";
                        if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
                      }}
                      className="w-20 h-16 rounded-lg object-cover flex-shrink-0 border border-orange-200 shadow-sm" />
                    <div style={{ display: "none" }}
                      className="w-20 h-16 rounded-lg bg-gradient-to-br from-orange-100 to-orange-200 items-center justify-center flex-shrink-0">
                      <Car size={22} className="text-orange-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{v.model}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {v.capacity && (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                            <Users size={11} className="text-orange-400" /> {v.capacity} seats
                          </span>
                        )}
                        <span className="inline-block text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
                          ✓ From Vehicle Master
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Model selected but no image — chhota note */}
                {v.model && !v.imagePath && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                    <ImageIcon size={13} className="text-slate-400" />
                    No image for this model in Vehicle Master.
                  </div>
                )}

                {/* Pickup + Drop */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label required>Pickup Location</Label>
                    <Input
                      value={v.pickup}
                      onChange={e => update(v.id, "pickup", e.target.value)}
                      placeholder="e.g. Airport"
                    />
                  </div>
                  <div>
                    <Label>Drop Location</Label>
                    <Input
                      value={v.drop}
                      onChange={e => update(v.id, "drop", e.target.value)}
                      placeholder="e.g. Hotel"
                    />
                  </div>
                </div>

                {/* Start + End Date — 2 cols always */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={v.startDate}
                      onChange={e => update(v.id, "startDate", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={v.endDate}
                      onChange={e => update(v.id, "endDate", e.target.value)}
                    />
                  </div>
                </div>

                {/* ── Price Box — 1 col mobile, 3 cols desktop ── */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 sm:p-4 rounded-2xl bg-orange-50 border border-orange-100">
                  <div>
                    <Label>Price / Vehicle (₹)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={v.pricePerVehicle}
                      onChange={e => update(v.id, "pricePerVehicle", e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label>Qty</Label>
                    <Input
                      type="number"
                      min={1}
                      value={v.qty}
                      onChange={e => update(v.id, "qty", e.target.value)}
                      placeholder="1"
                    />
                  </div>
                  <div>
                    <Label>Vehicle Total</Label>
                    <div className="h-10 flex items-center justify-center bg-orange-600 rounded-xl text-sm font-extrabold text-white">
                      ₹{vehicleTotals[vi].toLocaleString("en-IN")}
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={v.notes}
                    onChange={e => update(v.id, "notes", e.target.value)}
                    rows={2}
                    placeholder="e.g. AC vehicle, experienced driver..."
                  />
                </div>

              </div>
            </SectionCard>
            );
          })}

          {/* Add Vehicle button */}
          <button
            onClick={add}
            type="button"
            className="w-full py-3 border-2 border-dashed border-slate-300
              hover:border-orange-400 hover:bg-orange-50/40
              text-slate-500 hover:text-orange-600
              text-sm font-bold rounded-2xl transition-all
              flex items-center justify-center gap-2">
            <Plus size={16} strokeWidth={2.5} /> Add Vehicle
          </button>

          {/* Vehicle Total Card */}
          <div
            className="flex items-center justify-between p-3 sm:p-4 rounded-2xl"
            style={{ background: "linear-gradient(135deg,#EA580C,#7C2D12)" }}>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <IndianRupee size={16} className="text-white" />
              </div>
              <div>
                <p className="text-[10px] text-orange-200 font-semibold uppercase tracking-wider">
                  Vehicle Total
                </p>
                <p className="text-[11px] text-orange-300">
                  {vehicles.length} vehicle{vehicles.length > 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-extrabold text-white">
              ₹{vehicleTotal.toLocaleString("en-IN")}
            </p>
          </div>
        </>
      ) : (
        <EmptyState
          icon={Car}
          title="No Vehicle Added"
          desc="Enable vehicle above to add vehicle details."
        />
      )}

    </div>
  );
}
