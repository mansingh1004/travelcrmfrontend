import { useState, useEffect, useRef } from "react";
import { Anchor, Plus, IndianRupee } from "lucide-react";
import { Label, Input, Select, SectionCard, RemoveBtn, IncludeToggle, EmptyState, FieldGrid } from "./Ui";
import { CRUISE_TYPES, CABIN_CATS } from "../Constants";

// export default function CruiseTab({ onDataChange }) {
//   const [included, setIncluded] = useState(false);

  export default function CruiseTab({ onDataChange, paxInfo = {}, defaultIncluded = true, initialData = null }) {
  const [included, setIncluded] = useState(defaultIncluded);
  const [title,    setTitle]    = useState("Cruise Details");
  const [cruises,  setCruises]  = useState([newCruise()]);

  const hydratedRef = useRef(false);
  const includeTouchedRef = useRef(false);

  function newCruise() {
    return { id: Date.now() + Math.random(), name: "", type: "", depPort: "", arrPort: "", depDate: "", nights: 0, cabin: "", pricePerPax: 0, pax: 1 };
  }

  // ── EDIT MODE PREFILL — saved quotation se state seed karo (ek hi baar) ──
  useEffect(() => {
    if (hydratedRef.current || !initialData) return;
    hydratedRef.current = true;
    includeTouchedRef.current = true;

    if (typeof initialData.included === "boolean") setIncluded(initialData.included);
    if (initialData.title) setTitle(initialData.title);
    if (Array.isArray(initialData.cruises) && initialData.cruises.length > 0) {
      setCruises(initialData.cruises.map(c => ({
        ...newCruise(),
        ...c,
        id: Date.now() + Math.random(),
      })));
    }
  }, [initialData]);

  // ── Lead ke services se Include default (remount key ki jagah) ──
  useEffect(() => {
    if (includeTouchedRef.current) return;
    setIncluded(defaultIncluded);
  }, [defaultIncluded]);

  // ── Auto price ────────────────────────────────────────────
  const cruiseTotals = cruises.map(c => Number(c.pricePerPax) * Number(c.pax) || 0);
  const cruiseTotal  = cruiseTotals.reduce((a, b) => a + b, 0);

  useEffect(() => {
    onDataChange?.({ included, title, cruises, amount: cruiseTotal });
  }, [included, title, cruises, cruiseTotal]);

  const add    = () => setCruises(p => [...p, newCruise()]);
  const remove = (id) => setCruises(p => p.filter(c => c.id !== id));
  const update = (id, k, v) => setCruises(p => p.map(c => c.id === id ? { ...c, [k]: v } : c));

  return (
    <div className="space-y-5">
      <SectionCard title="Cruise Settings" icon={Anchor}>
        <div className="space-y-4">
          <IncludeToggle included={included} onChange={() => { includeTouchedRef.current = true; setIncluded(p => !p); }} label="Include Cruise in Quotation" />
          {included && <div><Label>Section Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>}
        </div>
      </SectionCard>

      {included ? (
        <>
          {cruises.map((c, ci) => (
            <SectionCard key={c.id} title={`Cruise ${ci + 1}`} icon={Anchor}
              headerRight={cruises.length > 1 && <RemoveBtn onClick={() => remove(c.id)} />}>
              <div className="space-y-4">
                <FieldGrid cols={2}>
                  <div><Label required>Cruise Name</Label><Input value={c.name} onChange={e => update(c.id, "name", e.target.value)} placeholder="e.g. Royal Caribbean Explorer" /></div>
                  <div><Label>Cruise Type</Label><Select options={CRUISE_TYPES} value={c.type} onChange={e => update(c.id, "type", e.target.value)} /></div>
                </FieldGrid>
                <FieldGrid cols={2}>
                  <div><Label>Departure Port</Label><Input value={c.depPort} onChange={e => update(c.id, "depPort", e.target.value)} placeholder="e.g. Mumbai" /></div>
                  <div><Label>Arrival Port</Label><Input value={c.arrPort} onChange={e => update(c.id, "arrPort", e.target.value)} placeholder="e.g. Goa" /></div>
                </FieldGrid>
                <FieldGrid cols={3}>
                  <div><Label>Departure Date</Label><Input type="date" value={c.depDate} onChange={e => update(c.id, "depDate", e.target.value)} /></div>
                  <div><Label>Nights</Label><Input type="number" min={0} value={c.nights} onChange={e => update(c.id, "nights", e.target.value)} placeholder="5" /></div>
                  <div><Label>Cabin Category</Label><Select options={CABIN_CATS} value={c.cabin} onChange={e => update(c.id, "cabin", e.target.value)} /></div>
                </FieldGrid>
                {/* ── Price Box ── */}
                <div className="grid grid-cols-3 gap-3 p-3 rounded-2xl bg-cyan-50 border border-cyan-100">
                  <div><Label>Price / Pax (₹)</Label><Input type="number" min={0} value={c.pricePerPax} onChange={e => update(c.id, "pricePerPax", e.target.value)} placeholder="0" /></div>
                  <div><Label>No. of Pax</Label><Input type="number" min={1} value={c.pax} onChange={e => update(c.id, "pax", e.target.value)} placeholder="1" /></div>
                  <div><Label>Cruise Total</Label>
                    <div className="h-10 flex items-center justify-center bg-cyan-600 rounded-xl text-sm font-extrabold text-white">
                      ₹{cruiseTotals[ci].toLocaleString("en-IN")}
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>
          ))}
          <button onClick={add} type="button"
            className="w-full py-3 border-2 border-dashed border-slate-300 hover:border-cyan-400 hover:bg-cyan-50/40 text-slate-500 hover:text-cyan-600 text-sm font-bold rounded-2xl transition-all flex items-center justify-center gap-2">
            <Plus size={16} strokeWidth={2.5} /> Add Cruise
          </button>
          <div className="flex items-center justify-between p-4 rounded-2xl"
            style={{ background: "linear-gradient(135deg,#0891B2,#164E63)" }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center"><IndianRupee size={18} className="text-white" /></div>
              <div>
                <p className="text-[10px] text-cyan-200 font-semibold uppercase tracking-wider">Cruise Total</p>
                <p className="text-[11px] text-cyan-300">{cruises.length} cruise{cruises.length > 1 ? "s" : ""}</p>
              </div>
            </div>
            <p className="text-2xl font-extrabold text-white">₹{cruiseTotal.toLocaleString("en-IN")}</p>
          </div>
        </>
      ) : (
        <EmptyState icon={Anchor} title="No Cruise Added" desc="Enable cruise above to add cruise details." />
      )}
    </div>
  );
}