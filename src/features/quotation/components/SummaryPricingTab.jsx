

// // calculate price==========================================================
// import { useState, useEffect } from "react";
// import { BarChart2, Plane, Hotel, Map, Anchor, Car, Package, Tag, IndianRupee } from "lucide-react";
// import { Label, Input, Select, SectionCard, FieldGrid } from "./Ui";

// export default function SummaryPricingTab({ costs = {}, onDataChange }) {
//   const [discount, setDiscount] = useState(0);
//   const [discType, setDiscType] = useState("Fixed");
//   const [tax,      setTax]      = useState(18);
//   const [markup,   setMarkup]   = useState(0);

//   // ── Har state change pe parent ko data do ────────────────
//   useEffect(() => {
//     onDataChange?.({ discount, discType, tax, markup });
//   }, [discount, discType, tax, markup]);

//   // ── Live cost values — re-read on every render ───────────
//   // costs prop changes whenever any tab amount changes
//   const c = {
//     flight:      Number(costs?.flight)      || 0,
//     hotel:       Number(costs?.hotel)       || 0,
//     sightseeing: Number(costs?.sightseeing) || 0,
//     cruise:      Number(costs?.cruise)      || 0,
//     vehicle:     Number(costs?.vehicle)     || 0,
//     addons:      Number(costs?.addons)      || 0,
//   };

//   const subtotal   = Object.values(c).reduce((a, b) => a + b, 0);
//   const discAmt    = discType === "%" ? (subtotal * Number(discount)) / 100 : Number(discount);
//   const afterDisc  = subtotal - discAmt + Number(markup);
//   const taxAmt     = (afterDisc * Number(tax)) / 100;
//   const grandTotal = afterDisc + taxAmt;

//   const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

//   const breakdown = [
//     { label: "Flight Cost",      value: c.flight,      icon: Plane,    color: "text-blue-600",    bg: "bg-blue-50"    },
//     { label: "Hotel Cost",       value: c.hotel,       icon: Hotel,    color: "text-violet-600",  bg: "bg-violet-50"  },
//     { label: "Sightseeing Cost", value: c.sightseeing, icon: Map,      color: "text-amber-600",   bg: "bg-amber-50"   },
//     { label: "Cruise Cost",      value: c.cruise,      icon: Anchor,   color: "text-cyan-600",    bg: "bg-cyan-50"    },
//     { label: "Vehicle Cost",     value: c.vehicle,     icon: Car,      color: "text-orange-600",  bg: "bg-orange-50"  },
//     { label: "Add-On Cost",      value: c.addons,      icon: Package,  color: "text-rose-600",    bg: "bg-rose-50"    },
//   ];

//   return (
//     <div className="space-y-5">

//       {/* ── Live Price Breakdown ── */}
//       <SectionCard
//         title="Price Breakdown"
//         icon={BarChart2}
//         headerRight={
//           <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
//             <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
//           </span>
//         }
//       >
//         <div className="space-y-1">
//           {breakdown.map(({ label, value, icon: Icon, color, bg }) => (
//             <div key={label} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
//               <div className="flex items-center gap-3">
//                 <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center ${color}`}>
//                   <Icon size={15} />
//                 </div>
//                 <span className="text-sm font-semibold text-slate-700">{label}</span>
//               </div>
//               <span className={`text-sm font-bold ${value > 0 ? "text-slate-800" : "text-slate-400"}`}>
//                 {value > 0 ? fmt(value) : "—"}
//               </span>
//             </div>
//           ))}

//           {/* Subtotal row */}
//           <div className="flex items-center justify-between py-3 bg-slate-50 rounded-xl px-3 mt-2">
//             <span className="text-sm font-extrabold text-slate-800">Subtotal</span>
//             <span className="text-base font-extrabold text-slate-900">{fmt(subtotal)}</span>
//           </div>
//         </div>
//       </SectionCard>

//       {/* ── Adjustments ── */}
//       <SectionCard title="Adjustments" icon={Tag}>
//         <div className="space-y-5">
//           <FieldGrid cols={3}>
//             <div>
//               <Label>Markup (₹)</Label>
//               <Input type="number" value={markup} onChange={e => setMarkup(e.target.value)} placeholder="0.00" />
//             </div>
//             <div>
//               <Label>Discount</Label>
//               <div className="flex gap-2">
//                 <Input
//                   type="number" value={discount}
//                   onChange={e => setDiscount(e.target.value)}
//                   placeholder="0" className="flex-1"
//                 />
//                 <Select
//                   options={["%", "Fixed"]} value={discType}
//                   onChange={e => setDiscType(e.target.value)} className="w-24"
//                 />
//               </div>
//             </div>
//             <div>
//               <Label>Tax (%)</Label>
//               <Input type="number" value={tax} onChange={e => setTax(e.target.value)} placeholder="18" />
//             </div>
//           </FieldGrid>

//           {/* Calculation rows */}
//           <div className="space-y-2 pt-2 border-t border-slate-100">
//             {[
//               ["Subtotal",    fmt(subtotal),     "text-slate-700",   "bg-slate-50"   ],
//               ["Markup",      fmt(markup),       "text-blue-700",    "bg-blue-50"    ],
//               ["Discount",   `-${fmt(discAmt)}`, "text-emerald-700", "bg-emerald-50" ],
//               ["Tax (GST)",   fmt(taxAmt),       "text-amber-700",   "bg-amber-50"   ],
//             ].map(([lbl, val, cls, bg]) => (
//               <div key={lbl} className={`flex justify-between text-sm py-2 px-3 rounded-lg ${bg}`}>
//                 <span className="text-slate-600 font-medium">{lbl}</span>
//                 <span className={`font-bold ${cls}`}>{val}</span>
//               </div>
//             ))}
//           </div>
//         </div>
//       </SectionCard>

//       {/* ── Grand Total Card ── */}
//       <div
//         className="relative overflow-hidden rounded-[18px] p-6 flex flex-col justify-between min-h-[155px] cursor-default"
//         style={{ background: "linear-gradient(135deg, #00c6a7 0%, #00a389 40%, #007d6b 100%)" }}
//       >
//         <div className="absolute -top-9 -right-8 w-32 h-32 rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.13)" }} />
//         <div className="absolute bottom-[-20px] right-10 w-24 h-24 rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.09)" }} />
//         <div className="absolute top-5 right-[80px] w-12 h-12 rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.07)" }} />

//         <div className="w-12 h-12 rounded-xl flex items-center justify-center relative z-10"
//           style={{ background: "rgba(255,255,255,0.22)" }}>
//           <IndianRupee size={24} className="text-white" />
//         </div>

//         <div className="relative z-10 mt-4">
//           {/* Mini breakdown */}
//           <div className="flex gap-4 mb-3 flex-wrap">
//             {[
//               { label: "Subtotal", val: subtotal },
//               { label: "Discount", val: -discAmt },
//               { label: "Tax",      val: taxAmt   },
//             ].map(({ label, val }) => (
//               <div key={label}>
//                 <p className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: "rgba(255,255,255,0.6)" }}>{label}</p>
//                 <p className="text-[12px] font-bold text-white">{label === "Discount" ? `-${fmt(discAmt)}` : fmt(val)}</p>
//               </div>
//             ))}
//           </div>

//           <p className="text-[10px] font-semibold uppercase tracking-[.13em]" style={{ color: "rgba(255,255,255,0.72)" }}>
//             Final Quotation Total
//           </p>
//           <p className="text-[38px] font-extrabold text-white leading-none tracking-tight mt-1">
//             {fmt(grandTotal)}
//           </p>
//           <p className="text-[11px] mt-1.5" style={{ color: "rgba(255,255,255,0.60)" }}>
//             Including all taxes and charges
//           </p>
//         </div>
//       </div>

//     </div>
//   );
// }




// calculate price==========================================================
import { useState, useEffect, useRef } from "react";
import { BarChart2, Plane, Hotel, Map, Anchor, Car, Package, Tag, IndianRupee } from "lucide-react";
import { Label, Input, Select, SectionCard, FieldGrid } from "./Ui";

export default function SummaryPricingTab({ costs = {}, onDataChange, initialData = null }) {
  const [discount, setDiscount] = useState(0);
  const [discType, setDiscType] = useState("Fixed");
  const [tax,      setTax]      = useState(0);
  const [markup,   setMarkup]   = useState(0);

  const hydratedRef = useRef(false);

  // ── EDIT MODE PREFILL — saved pricing seed karo (ek hi baar) ──
  // 0 bhi valid saved value hai (0% tax, 0 discount) — isliye `!= null` check,
  // truthiness nahi.
  useEffect(() => {
    if (hydratedRef.current || !initialData) return;
    hydratedRef.current = true;

    if (initialData.discount != null) setDiscount(initialData.discount);
    if (initialData.discType) setDiscType(initialData.discType);
    if (initialData.tax != null) setTax(initialData.tax);
    if (initialData.markup != null) setMarkup(initialData.markup);
  }, [initialData]);

  // ── Har state change pe parent ko data do ────────────────
  useEffect(() => {
    onDataChange?.({ discount, discType, tax, markup });
  }, [discount, discType, tax, markup]);

  // ── Live cost values — re-read on every render ───────────
  // costs prop changes whenever any tab amount changes
  const c = {
    flight:      Number(costs?.flight)      || 0,
    hotel:       Number(costs?.hotel)       || 0,
    sightseeing: Number(costs?.sightseeing) || 0,
    cruise:      Number(costs?.cruise)      || 0,
    vehicle:     Number(costs?.vehicle)     || 0,
    addons:      Number(costs?.addons)      || 0,
  };

  const subtotal   = Object.values(c).reduce((a, b) => a + b, 0);
  const discAmt    = discType === "%" ? (subtotal * Number(discount)) / 100 : Number(discount);
  const afterDisc  = subtotal - discAmt + Number(markup);
  const taxAmt     = (afterDisc * Number(tax)) / 100;
  const grandTotal = afterDisc + taxAmt;

  const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  const breakdown = [
    { label: "Flight Cost",      value: c.flight,      icon: Plane,    color: "text-blue-600",    bg: "bg-blue-50"    },
    { label: "Hotel Cost",       value: c.hotel,       icon: Hotel,    color: "text-violet-600",  bg: "bg-violet-50"  },
    { label: "Sightseeing Cost", value: c.sightseeing, icon: Map,      color: "text-amber-600",   bg: "bg-amber-50"   },
    { label: "Cruise Cost",      value: c.cruise,      icon: Anchor,   color: "text-cyan-600",    bg: "bg-cyan-50"    },
    { label: "Vehicle Cost",     value: c.vehicle,     icon: Car,      color: "text-orange-600",  bg: "bg-orange-50"  },
    { label: "Add-On Cost",      value: c.addons,      icon: Package,  color: "text-rose-600",    bg: "bg-rose-50"    },
  ];

  return (
    <div className="space-y-5">

      {/* ── Live Price Breakdown ── */}
      <SectionCard
        title="Price Breakdown"
        icon={BarChart2}
        headerRight={
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
          </span>
        }
      >
        <div className="space-y-1">
          {breakdown.map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center ${color}`}>
                  <Icon size={15} />
                </div>
                <span className="text-sm font-semibold text-slate-700">{label}</span>
              </div>
              <span className={`text-sm font-bold ${value > 0 ? "text-slate-800" : "text-slate-400"}`}>
                {value > 0 ? fmt(value) : "—"}
              </span>
            </div>
          ))}

          {/* Subtotal row */}
          <div className="flex items-center justify-between py-3 bg-slate-50 rounded-xl px-3 mt-2">
            <span className="text-sm font-extrabold text-slate-800">Subtotal</span>
            <span className="text-base font-extrabold text-slate-900">{fmt(subtotal)}</span>
          </div>
        </div>
      </SectionCard>

      {/* ── Adjustments ── */}
      <SectionCard title="Adjustments" icon={Tag}>
        <div className="space-y-5">
          <FieldGrid cols={3}>
            <div>
              <Label>Markup (₹)</Label>
              <Input type="number" value={markup} onChange={e => setMarkup(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label>Discount</Label>
              <div className="flex gap-2">
                <Input
                  type="number" value={discount}
                  onChange={e => setDiscount(e.target.value)}
                  placeholder="0" className="flex-1"
                />
                <Select
                  options={["%", "Fixed"]} value={discType}
                  onChange={e => setDiscType(e.target.value)} className="w-24"
                />
              </div>
            </div>
            <div>
              <Label>Tax (%)</Label>
              <Input type="number" value={tax} onChange={e => setTax(e.target.value)} placeholder="0" />
            </div>
          </FieldGrid>

          {/* Calculation rows */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            {[
              ["Subtotal",    fmt(subtotal),     "text-slate-700",   "bg-slate-50"   ],
              ["Markup",      fmt(markup),       "text-blue-700",    "bg-blue-50"    ],
              ["Discount",   `-${fmt(discAmt)}`, "text-emerald-700", "bg-emerald-50" ],
              ["Tax (GST)",   fmt(taxAmt),       "text-amber-700",   "bg-amber-50"   ],
            ].map(([lbl, val, cls, bg]) => (
              <div key={lbl} className={`flex justify-between text-sm py-2 px-3 rounded-lg ${bg}`}>
                <span className="text-slate-600 font-medium">{lbl}</span>
                <span className={`font-bold ${cls}`}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* ── Grand Total Card ── */}
      <div
        className="relative overflow-hidden rounded-[18px] p-6 flex flex-col justify-between min-h-[155px] cursor-default"
        style={{ background: "linear-gradient(135deg, #00c6a7 0%, #00a389 40%, #007d6b 100%)" }}
      >
        <div className="absolute -top-9 -right-8 w-32 h-32 rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.13)" }} />
        <div className="absolute bottom-[-20px] right-10 w-24 h-24 rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.09)" }} />
        <div className="absolute top-5 right-[80px] w-12 h-12 rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.07)" }} />

        <div className="w-12 h-12 rounded-xl flex items-center justify-center relative z-10"
          style={{ background: "rgba(255,255,255,0.22)" }}>
          <IndianRupee size={24} className="text-white" />
        </div>

        <div className="relative z-10 mt-4">
          {/* Mini breakdown */}
          <div className="flex gap-4 mb-3 flex-wrap">
            {[
              { label: "Subtotal", val: subtotal },
              { label: "Discount", val: -discAmt },
              { label: "Tax",      val: taxAmt   },
            ].map(({ label, val }) => (
              <div key={label}>
                <p className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: "rgba(255,255,255,0.6)" }}>{label}</p>
                <p className="text-[12px] font-bold text-white">{label === "Discount" ? `-${fmt(discAmt)}` : fmt(val)}</p>
              </div>
            ))}
          </div>

          <p className="text-[10px] font-semibold uppercase tracking-[.13em]" style={{ color: "rgba(255,255,255,0.72)" }}>
            Final Quotation Total
          </p>
          <p className="text-[38px] font-extrabold text-white leading-none tracking-tight mt-1">
            {fmt(grandTotal)}
          </p>
          <p className="text-[11px] mt-1.5" style={{ color: "rgba(255,255,255,0.60)" }}>
            Including all taxes and charges
          </p>
        </div>
      </div>

    </div>
  );
}