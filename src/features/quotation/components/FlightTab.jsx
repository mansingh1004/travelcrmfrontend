import { useState, useEffect, useRef } from "react";
import { Plane, Plus, IndianRupee, Users } from "lucide-react";
import { Label, Input, Select, SectionCard, AddBtn, RemoveBtn, IncludeToggle, FieldGrid } from "./Ui";
import { AIRLINES, CLASSES, AIRPORTS, JOURNEY_TYPES } from "../Constants";

function PriceBox({ label, value, highlight = false }) {
  return (
    <div className={`rounded-xl p-3 text-center ${highlight ? "bg-blue-600 text-white" : "bg-white border border-blue-100 text-blue-700"}`}>
      <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${highlight ? "text-blue-100" : "text-blue-400"}`}>{label}</p>
      <p className={`text-[15px] font-extrabold ${highlight ? "text-white" : "text-blue-700"}`}>
        ₹{Number(value || 0).toLocaleString("en-IN")}
      </p>
    </div>
  );
}

export default function FlightTab({ onDataChange, paxInfo = {}, defaultIncluded = true, initialData = null }) {
  const [included, setIncluded] = useState(defaultIncluded);
  const [title,    setTitle]    = useState("Flight Details");
  const [journey,  setJourney]  = useState("Round Trip");
  const [segments, setSegments] = useState([newSegment()]);

  // hydratedRef — saved quotation sirf EK BAAR seed ho.
  // includeTouchedRef — Include toggle ko lead ka default tabhi chhue jab user (ya saved
  // data) ne wo decision khud na liya ho.
  const hydratedRef = useRef(false);
  const includeTouchedRef = useRef(false);

  // ── EDIT MODE PREFILL ──
  // Backend se aaye segments/connections me `id` nahi hota (payload use strip kar deta hai),
  // par UI list keys aur update/remove usi id pe chalte hain — isliye yahan naye id lagate hain.
  useEffect(() => {
    if (hydratedRef.current || !initialData) return;
    hydratedRef.current = true;
    includeTouchedRef.current = true;   // saved choice jeetegi, lead ka default nahi

    if (typeof initialData.included === "boolean") setIncluded(initialData.included);
    if (initialData.title) setTitle(initialData.title);
    if (initialData.journey) setJourney(initialData.journey);

    if (Array.isArray(initialData.segments) && initialData.segments.length > 0) {
      setSegments(initialData.segments.map(seg => ({
        ...newSegment(),
        ...seg,
        id: Date.now() + Math.random(),
        connections: (seg.connections || []).map(conn => ({
          ...newConn(),
          ...conn,
          id: Date.now() + Math.random(),
        })),
      })));
    }
  }, [initialData]);

  // ── Lead ke services resolve hone par Include ka default set karo ──
  // Pehle ye parent ki remount `key` se hota tha, jo tab ki poori state uda deti thi.
  useEffect(() => {
    if (includeTouchedRef.current) return;
    setIncluded(defaultIncluded);
  }, [defaultIncluded]);

  function newSegment() {
    return {
      id: Date.now() + Math.random(),
      airline: "", flightNo: "", class: "", from: "", to: "",
      depDate: "", depTime: "", arrDate: "", arrTime: "",
      duration: "", cabin: "", checkin: "",
      pricePerPax: 0, pax: 1,
      connections: [],
    };
  }

  function newConn() {
    return {
      id: Date.now() + Math.random(),
      airline: "", flightNo: "", from: "", to: "",
      depDate: "", depTime: "", arrDate: "", arrTime: "",
    };
  }

  // ── Auto price calculation ────────────────────────────────
  const segmentTotals = segments.map(s => Number(s.pricePerPax) * Number(s.pax) || 0);
  const flightTotal   = segmentTotals.reduce((a, b) => a + b, 0);

  // ── Parent ko data do — flightTotal change hone pe bhi ──
  useEffect(() => {
    onDataChange?.({ included, title, journey, segments, amount: flightTotal });
  }, [included, title, journey, segments, flightTotal]);

  // ── Helpers ───────────────────────────────────────────────
  const addSeg    = () => setSegments(p => [...p, newSegment()]);
  const removeSeg = (id) => setSegments(p => p.filter(s => s.id !== id));
  const updateSeg = (id, k, v) =>
    setSegments(p => p.map(s => s.id === id ? { ...s, [k]: v } : s));
  const addConn = (sid) =>
    setSegments(p => p.map(s => s.id === sid ? { ...s, connections: [...s.connections, newConn()] } : s));
  const removeConn = (sid, cid) =>
    setSegments(p => p.map(s => s.id === sid ? { ...s, connections: s.connections.filter(c => c.id !== cid) } : s));
  const updateConn = (sid, cid, k, v) =>
    setSegments(p => p.map(s => s.id === sid
      ? { ...s, connections: s.connections.map(c => c.id === cid ? { ...c, [k]: v } : c) }
      : s));

  // ── Pax summary (lead se) ──
  const _adults = Number(paxInfo.adults) || 0;
  const _children = Number(paxInfo.children) || 0;
  const _infants = Number(paxInfo.infants) || 0;
  const _totalPax = paxInfo.totalPax || (_adults + _children + _infants);

  return (
    <div className="space-y-5">

      {/* ── Pax banner — total flight members ── */}
      {_totalPax > 0 && (
        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-blue-50 border border-blue-100">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Users size={18} className="text-white" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">Flight Members</p>
            <p className="text-sm font-extrabold text-slate-800">
              {_totalPax} Traveler{_totalPax > 1 ? "s" : ""}
              <span className="text-slate-400 font-medium ml-2">
                ({_adults} Adult{_adults !== 1 ? "s" : ""}{_children > 0 ? `, ${_children} Child` : ""}{_infants > 0 ? `, ${_infants} Infant` : ""})
              </span>
            </p>
          </div>
        </div>
      )}

      {/* ── Settings ── */}
      <SectionCard title="Flight Settings" icon={Plane}>
        <div className="space-y-4">
          <IncludeToggle included={included} onChange={() => { includeTouchedRef.current = true; setIncluded(p => !p); }} label="Include Flight in Quotation" />
          {included && (
            <FieldGrid cols={2}>
              <div><Label>Section Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Flight Details" /></div>
              <div><Label>Journey Type</Label><Select options={JOURNEY_TYPES} value={journey} onChange={e => setJourney(e.target.value)} /></div>
            </FieldGrid>
          )}
        </div>
      </SectionCard>

      {/* ── Segments ── */}
      {included && segments.map((seg, si) => (
        <SectionCard key={seg.id} title={`Segment ${si + 1}`} icon={Plane}
          headerRight={segments.length > 1 && <RemoveBtn onClick={() => removeSeg(seg.id)} />}>
          <div className="space-y-4">

            <FieldGrid cols={3}>
              <div><Label required>Airline</Label><Select options={AIRLINES} value={seg.airline} onChange={e => updateSeg(seg.id, "airline", e.target.value)} placeholder="Select airline" /></div>
              <div><Label>Flight No.</Label><Input value={seg.flightNo} onChange={e => updateSeg(seg.id, "flightNo", e.target.value)} placeholder="e.g. 6E 204" /></div>
              <div><Label>Class</Label><Select options={CLASSES} value={seg.class} onChange={e => updateSeg(seg.id, "class", e.target.value)} placeholder="Select class" /></div>
            </FieldGrid>

            <FieldGrid cols={2}>
              <div><Label required>From</Label><Select options={AIRPORTS} value={seg.from} onChange={e => updateSeg(seg.id, "from", e.target.value)} placeholder="Departure airport" /></div>
              <div><Label required>To</Label><Select options={AIRPORTS} value={seg.to} onChange={e => updateSeg(seg.id, "to", e.target.value)} placeholder="Arrival airport" /></div>
            </FieldGrid>

            <FieldGrid cols={4}>
              <div><Label required>Dep. Date</Label><Input type="date" value={seg.depDate} onChange={e => updateSeg(seg.id, "depDate", e.target.value)} /></div>
              <div><Label required>Dep. Time</Label><Input type="time" value={seg.depTime} onChange={e => updateSeg(seg.id, "depTime", e.target.value)} /></div>
              <div><Label>Arr. Date</Label><Input type="date" value={seg.arrDate} onChange={e => updateSeg(seg.id, "arrDate", e.target.value)} /></div>
              <div><Label>Arr. Time</Label><Input type="time" value={seg.arrTime} onChange={e => updateSeg(seg.id, "arrTime", e.target.value)} /></div>
            </FieldGrid>

            <FieldGrid cols={3}>
              <div><Label>Duration</Label><Input value={seg.duration} onChange={e => updateSeg(seg.id, "duration", e.target.value)} placeholder="e.g. 2h 30m" /></div>
              <div><Label>Cabin Luggage (kg)</Label><Input type="number" value={seg.cabin} onChange={e => updateSeg(seg.id, "cabin", e.target.value)} placeholder="7" /></div>
              <div><Label>Check-in Luggage (kg)</Label><Input type="number" value={seg.checkin} onChange={e => updateSeg(seg.id, "checkin", e.target.value)} placeholder="23" /></div>
            </FieldGrid>

            {/* ── Price Box ── */}
            <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-blue-50 border border-blue-100">
              <div>
                <Label>Price / Pax (₹)</Label>
                <Input type="number" min={0} value={seg.pricePerPax}
                  onChange={e => updateSeg(seg.id, "pricePerPax", e.target.value)}
                  placeholder="0" />
              </div>
              <div>
                <Label>No. of Pax</Label>
                <Input type="number" min={1} value={seg.pax}
                  onChange={e => setSegments(p => p.map(s => s.id === seg.id ? { ...s, pax: e.target.value, _paxTouched: true } : s))}
                  placeholder="1" />
              </div>
              <PriceBox label="Segment Total" value={segmentTotals[si]} />
            </div>

            {/* ── Connections ── */}
            {seg.connections.map((conn, ci) => (
              <div key={conn.id} className="mt-2 pl-4 border-l-2 border-blue-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wide">Connection {ci + 1}</span>
                  <RemoveBtn onClick={() => removeConn(seg.id, conn.id)} />
                </div>
                <FieldGrid cols={4}>
                  <div><Label>Airline</Label><Select options={AIRLINES} value={conn.airline} onChange={e => updateConn(seg.id, conn.id, "airline", e.target.value)} /></div>
                  <div><Label>Flight No.</Label><Input value={conn.flightNo} onChange={e => updateConn(seg.id, conn.id, "flightNo", e.target.value)} placeholder="e.g. AI 101" /></div>
                  <div><Label>From</Label><Select options={AIRPORTS} value={conn.from} onChange={e => updateConn(seg.id, conn.id, "from", e.target.value)} /></div>
                  <div><Label>To</Label><Select options={AIRPORTS} value={conn.to} onChange={e => updateConn(seg.id, conn.id, "to", e.target.value)} /></div>
                </FieldGrid>
                <FieldGrid cols={4}>
                  <div><Label>Dep. Date</Label><Input type="date" value={conn.depDate} onChange={e => updateConn(seg.id, conn.id, "depDate", e.target.value)} /></div>
                  <div><Label>Dep. Time</Label><Input type="time" value={conn.depTime} onChange={e => updateConn(seg.id, conn.id, "depTime", e.target.value)} /></div>
                  <div><Label>Arr. Date</Label><Input type="date" value={conn.arrDate} onChange={e => updateConn(seg.id, conn.id, "arrDate", e.target.value)} /></div>
                  <div><Label>Arr. Time</Label><Input type="time" value={conn.arrTime} onChange={e => updateConn(seg.id, conn.id, "arrTime", e.target.value)} /></div>
                </FieldGrid>
              </div>
            ))}

            <div className="flex pt-2 border-t border-slate-100">
              <AddBtn onClick={() => addConn(seg.id)} label="Add Connection" />
            </div>

          </div>
        </SectionCard>
      ))}

      {/* ── Flight Total Box ── */}
      {included && (
        <>
          <button onClick={addSeg} type="button"
            className="w-full py-3 border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/40 text-slate-500 hover:text-blue-600 text-sm font-bold rounded-2xl transition-all flex items-center justify-center gap-2">
            <Plus size={16} strokeWidth={2.5} /> Add Flight Segment
          </button>

          {/* Total Price Card */}
          <div className="flex items-center justify-between p-4 rounded-2xl"
            style={{ background: "linear-gradient(135deg,#3B82F6,#1D4ED8)" }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <IndianRupee size={18} className="text-white" />
              </div>
              <div>
                <p className="text-[10px] text-blue-100 font-semibold uppercase tracking-wider">Flight Total</p>
                <p className="text-[11px] text-blue-200">{segments.length} segment{segments.length > 1 ? "s" : ""}</p>
              </div>
            </div>
            <p className="text-2xl font-extrabold text-white">
              ₹{flightTotal.toLocaleString("en-IN")}
            </p>
          </div>
        </>
      )}
    </div>
  );
}