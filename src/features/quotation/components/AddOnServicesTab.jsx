import { useState, useEffect, useRef } from "react";
import { Package, IndianRupee } from "lucide-react";
import { Label, Input, Select, SectionCard, AddBtn, RemoveBtn, EmptyState, FieldGrid } from "./Ui";
import { SERVICE_TYPES } from "../Constants";

export default function AddOnServicesTab({ onDataChange, initialData = null }) {
  const [services, setServices] = useState([newService()]);

  const hydratedRef = useRef(false);

  function newService() {
    return { id: Date.now() + Math.random(), type: "", description: "", pricePerUnit: 0, qty: 1, included: true };
  }

  // ── EDIT MODE PREFILL — saved quotation se state seed karo (ek hi baar) ──
  // Payload ke naam local state se alag hain (serviceType→type, quantity→qty),
  // isliye yahan wapas map karna padta hai.
  useEffect(() => {
    if (hydratedRef.current || !initialData) return;
    hydratedRef.current = true;

    if (Array.isArray(initialData.items) && initialData.items.length > 0) {
      setServices(initialData.items.map(item => ({
        ...newService(),
        id: Date.now() + Math.random(),
        type: item.serviceType ?? item.type ?? "",
        description: item.description ?? "",
        pricePerUnit: item.pricePerUnit ?? 0,
        qty: item.quantity ?? item.qty ?? 1,
        included: item.included ?? true,
      })));
    }
  }, [initialData]);

  // ── Auto price ────────────────────────────────────────────
  const serviceTotals = services.map(s => Number(s.pricePerUnit) * Number(s.qty) || 0);
  const addonTotal    = serviceTotals.reduce((a, b) => a + b, 0);

  useEffect(() => {
    const items = services.map(s => ({
      serviceType  : s.type,
      description  : s.description,
      quantity     : Number(s.qty)          || 1,
      pricePerUnit : Number(s.pricePerUnit) || 0,
      included     : s.included,
    }));
    onDataChange?.({ items, amount: addonTotal });
  }, [services]);

  const add    = () => setServices(p => [...p, newService()]);
  const remove = (id) => setServices(p => p.filter(s => s.id !== id));
  const update = (id, k, v) => setServices(p => p.map(s => s.id === id ? { ...s, [k]: v } : s));

  return (
    <div className="space-y-5">
      <SectionCard
        title="Add-On Services"
        icon={Package}
        headerRight={<AddBtn onClick={add} label="Add Service" />}
      >
        {services.length === 0 ? (
          <EmptyState icon={Package} title="No Services Added" desc="Add extra services to the quotation." onAdd={add} addLabel="Add Service" />
        ) : (
          <div className="space-y-3">
            {services.map((s, si) => (
              <div key={s.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Service {si + 1}</span>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={s.included}
                        onChange={e => update(s.id, "included", e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500" />
                      <span className="text-xs font-semibold text-slate-600">Include</span>
                    </label>
                    {services.length > 1 && <RemoveBtn onClick={() => remove(s.id)} />}
                  </div>
                </div>

                <FieldGrid cols={4}>
                  <div className="col-span-2 sm:col-span-1">
                    <Label>Service Type</Label>
                    <Select options={SERVICE_TYPES} value={s.type} onChange={e => update(s.id, "type", e.target.value)} />
                  </div>
                  <div>
                    <Label>Qty</Label>
                    <Input type="number" min={1} value={s.qty} onChange={e => update(s.id, "qty", e.target.value)} />
                  </div>
                  <div>
                    <Label>Price / Unit (₹)</Label>
                    <Input type="number" min={0} value={s.pricePerUnit} onChange={e => update(s.id, "pricePerUnit", e.target.value)} placeholder="0" />
                  </div>
                  <div>
                    <Label>Subtotal</Label>
                    <div className="h-10 flex items-center justify-center bg-rose-600 rounded-xl text-sm font-extrabold text-white">
                      ₹{serviceTotals[si].toLocaleString("en-IN")}
                    </div>
                  </div>
                </FieldGrid>

                <div className="mt-3">
                  <Label>Description</Label>
                  <Input value={s.description} onChange={e => update(s.id, "description", e.target.value)} placeholder="Describe this service..." />
                </div>
              </div>
            ))}

            {/* Add-on Total */}
            <div className="flex items-center justify-between p-4 rounded-2xl"
              style={{ background: "linear-gradient(135deg,#E11D48,#881337)" }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center"><IndianRupee size={18} className="text-white" /></div>
                <div>
                  <p className="text-[10px] text-rose-200 font-semibold uppercase tracking-wider">Add-On Total</p>
                  <p className="text-[11px] text-rose-300">{services.length} service{services.length > 1 ? "s" : ""}</p>
                </div>
              </div>
              <p className="text-2xl font-extrabold text-white">₹{addonTotal.toLocaleString("en-IN")}</p>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}