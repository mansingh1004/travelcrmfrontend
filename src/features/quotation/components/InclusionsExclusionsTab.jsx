import { useState, useEffect, useRef } from "react";
import { CheckCircle, XCircle, Plus, X, CreditCard, AlertTriangle, FileText } from "lucide-react";
import { Input, SectionCard } from "./Ui";

/* ─── Item List ──────────────────────────────────────── */
function ItemList({ items, setItems, color }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className={`flex items-start gap-3 p-3 rounded-xl border
          ${color === "green" ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"}`}>
          {color === "green"
            ? <CheckCircle size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
            : <XCircle    size={16} className="text-rose-500    flex-shrink-0 mt-0.5" />}
          <span className="text-sm text-slate-700 flex-1">{item}</span>
          <button
            onClick={() => setItems(p => p.filter((_, idx) => idx !== i))}
            className="text-slate-400 hover:text-rose-500 transition-colors flex-shrink-0">
            <X size={14} />
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ─── Policy Item List ───────────────────────────────── */
function PolicyList({ items, setItems, color = "slate" }) {
  const colors = {
    slate : "bg-slate-50 border-slate-100",
    amber : "bg-amber-50 border-amber-100",
    blue  : "bg-blue-50  border-blue-100",
  };
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${colors[color]}`}>
          <span className="w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[10px] font-extrabold text-slate-500 flex-shrink-0 mt-0.5">
            {i + 1}
          </span>
          <span className="text-sm text-slate-700 flex-1">{item}</span>
          <button
            onClick={() => setItems(p => p.filter((_, idx) => idx !== i))}
            className="text-slate-400 hover:text-rose-500 transition-colors flex-shrink-0">
            <X size={14} />
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ─── Add Input Row ──────────────────────────────────── */
function AddInputRow({ value, onChange, onAdd, onKeyDown, placeholder, btnColor = "bg-blue-600 hover:bg-blue-700" }) {
  return (
    <div className="flex gap-2 pt-2">
      <Input
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
      />
      <button
        onClick={onAdd}
        className={`px-4 py-2.5 text-white text-sm font-bold rounded-xl transition-all flex-shrink-0 flex items-center gap-1.5 ${btnColor}`}>
        <Plus size={15} /> Add
      </button>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────── */
export default function InclusionsExclusionsTab({ onDataChange, initialData = null }) {

  const hydratedRef = useRef(false);

  /* Inclusions & Exclusions */
  const [inclusions, setInclusions] = useState([
    "Daily Breakfast",
    "All transfers by AC vehicle",
    "Hotel accommodation",
  ]);
  const [exclusions, setExclusions] = useState([
    "International flights",
    "Travel insurance",
    "Personal expenses",
  ]);
  const [newInc, setNewInc] = useState("");
  const [newExc, setNewExc] = useState("");

  const addInc = () => { if (newInc.trim()) { setInclusions(p => [...p, newInc.trim()]); setNewInc(""); } };
  const addExc = () => { if (newExc.trim()) { setExclusions(p => [...p, newExc.trim()]); setNewExc(""); } };

  /* Payment Policies */
  // Three stages rather than two, and each one states its share, because the
  // quotation views read these lines back as the payment plan: a stage without a
  // percentage cannot be placed on the schedule, and the shares have to total 100
  // for it to be a schedule at all. The payment-method line carries no percentage
  // on purpose — it is a note, and the views leave it out of the plan.
  // Starting point only; the agent edits or removes any of it per quotation.
  const [paymentPolicies, setPaymentPolicies] = useState([
    "Advance Payment — 35% at the time of booking.",
    "Installment After Receiving Voucher — 35%.",
    "3 Days Before Arrival — 30%.",
    "Payments accepted via Bank Transfer, UPI, or Credit Card.",
  ]);
  const [newPayment, setNewPayment] = useState("");
  const addPayment = () => { if (newPayment.trim()) { setPaymentPolicies(p => [...p, newPayment.trim()]); setNewPayment(""); } };

  /* Cancellation Policies */
  const [cancellationPolicies, setCancellationPolicies] = useState([
    "Cancellation 30+ days before departure: 10% cancellation fee.",
    "Cancellation 15–29 days before departure: 25% cancellation fee.",
    "Cancellation 7–14 days before departure: 50% cancellation fee.",
    "Cancellation less than 7 days before departure: No refund.",
  ]);
  const [newCancellation, setNewCancellation] = useState("");
  const addCancellation = () => { if (newCancellation.trim()) { setCancellationPolicies(p => [...p, newCancellation.trim()]); setNewCancellation(""); } };

  /* Booking Terms */
  const [bookingTerms, setBookingTerms] = useState([
    "Valid government-issued photo ID required for all travelers.",
    "Itinerary is subject to change due to weather or operational reasons.",
    "The company is not responsible for delays caused by airlines or third parties.",
    "Travel insurance is highly recommended for all travelers.",
  ]);
  const [newTerm, setNewTerm] = useState("");
  const addTerm = () => { if (newTerm.trim()) { setBookingTerms(p => [...p, newTerm.trim()]); setNewTerm(""); } };

  // ── EDIT MODE PREFILL — saved quotation se list seed karo (ek hi baar) ──
  // Khaali array bhi valid saved value hai (user ne saari lines hata di thi), isliye
  // Array.isArray() check karte hain, length nahi — warna default suggestions wapas aa jaate.
  useEffect(() => {
    if (hydratedRef.current || !initialData) return;
    hydratedRef.current = true;

    if (Array.isArray(initialData.inclusions)) setInclusions(initialData.inclusions);
    if (Array.isArray(initialData.exclusions)) setExclusions(initialData.exclusions);
    if (Array.isArray(initialData.paymentPolicies)) setPaymentPolicies(initialData.paymentPolicies);
    if (Array.isArray(initialData.cancellationPolicies)) setCancellationPolicies(initialData.cancellationPolicies);
    if (Array.isArray(initialData.bookingTerms)) setBookingTerms(initialData.bookingTerms);
  }, [initialData]);

  // ── Har state change pe parent ko data do ────────────────
  useEffect(() => {
    onDataChange?.({
      inclusions,
      exclusions,
      paymentPolicies,
      cancellationPolicies,
      bookingTerms,
    });
  }, [inclusions, exclusions, paymentPolicies, cancellationPolicies, bookingTerms]);

  return (
    <div className="space-y-5">

      {/* ── Row 1: Inclusions + Exclusions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Inclusions */}
        <SectionCard
          title="Inclusions"
          icon={CheckCircle}
          iconColor="text-emerald-600"
          headerRight={
            <span className="text-xs bg-emerald-100 text-emerald-700 font-bold px-2.5 py-1 rounded-full">
              {inclusions.length} items
            </span>
          }>
          <div className="space-y-4">
            <ItemList items={inclusions} setItems={setInclusions} color="green" />
            <AddInputRow
              value={newInc}
              onChange={e => setNewInc(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addInc()}
              onAdd={addInc}
              placeholder="Add an inclusion..."
              btnColor="bg-emerald-600 hover:bg-emerald-700"
            />
          </div>
        </SectionCard>

        {/* Exclusions */}
        <SectionCard
          title="Exclusions"
          icon={XCircle}
          iconColor="text-rose-600"
          headerRight={
            <span className="text-xs bg-rose-100 text-rose-600 font-bold px-2.5 py-1 rounded-full">
              {exclusions.length} items
            </span>
          }>
          <div className="space-y-4">
            <ItemList items={exclusions} setItems={setExclusions} color="red" />
            <AddInputRow
              value={newExc}
              onChange={e => setNewExc(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addExc()}
              onAdd={addExc}
              placeholder="Add an exclusion..."
              btnColor="bg-rose-600 hover:bg-rose-700"
            />
          </div>
        </SectionCard>

      </div>

      {/* ── Row 2: Payment Policies ── */}
      <SectionCard
        title="Payment Policies"
        icon={CreditCard}
        iconColor="text-blue-600"
        headerRight={
          <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2.5 py-1 rounded-full">
            {paymentPolicies.length} policies
          </span>
        }>
        <div className="space-y-4">
          <PolicyList items={paymentPolicies} setItems={setPaymentPolicies} color="blue" />
          <AddInputRow
            value={newPayment}
            onChange={e => setNewPayment(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addPayment()}
            onAdd={addPayment}
            placeholder="Add a payment policy..."
            btnColor="bg-blue-600 hover:bg-blue-700"
          />
        </div>
      </SectionCard>

      {/* ── Row 3: Cancellation Policies ── */}
      <SectionCard
        title="Cancellation Policies"
        icon={AlertTriangle}
        iconColor="text-amber-600"
        headerRight={
          <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2.5 py-1 rounded-full">
            {cancellationPolicies.length} policies
          </span>
        }>
        <div className="space-y-4">
          <PolicyList items={cancellationPolicies} setItems={setCancellationPolicies} color="amber" />
          <AddInputRow
            value={newCancellation}
            onChange={e => setNewCancellation(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addCancellation()}
            onAdd={addCancellation}
            placeholder="Add a cancellation policy..."
            btnColor="bg-amber-600 hover:bg-amber-700"
          />
        </div>
      </SectionCard>

      {/* ── Row 4: Booking Terms & Conditions ── */}
      <SectionCard
        title="Booking Terms & Conditions"
        icon={FileText}
        iconColor="text-slate-600"
        headerRight={
          <span className="text-xs bg-slate-100 text-slate-600 font-bold px-2.5 py-1 rounded-full">
            {bookingTerms.length} terms
          </span>
        }>
        <div className="space-y-4">
          <PolicyList items={bookingTerms} setItems={setBookingTerms} color="slate" />
          <AddInputRow
            value={newTerm}
            onChange={e => setNewTerm(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addTerm()}
            onAdd={addTerm}
            placeholder="Add a term or condition..."
            btnColor="bg-slate-700 hover:bg-slate-800"
          />
        </div>
      </SectionCard>

    </div>
  );
}