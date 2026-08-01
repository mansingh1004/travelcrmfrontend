// import { useEffect, useState } from "react";
// import { useParams } from "react-router-dom";
// import { getErrorMessage } from "@shared/api/apiError";
// import ModernWebView from "../components/ModernWebView";

// const API = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

// const inr = (v) => (v == null ? "—" : `₹${Number(v).toLocaleString("en-IN")}`);
// const fmtDate = (d) => {
//   if (!d) return "—";
//   try { return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
//   catch { return d; }
// };
// const fmtDateFull = (d) => {
//   if (!d) return "";
//   try { return new Date(d).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); }
//   catch { return d; }
// };

// // ── Image resolvers ──
// const hotelImg = (h) => h.imageUrl || h.imagePath || h.image || h.photo || h.coverImage || h.hotelImage || h.img || (Array.isArray(h.images) && h.images[0]) || null;
// const actImg   = (a) => a.imagePath || a.imageUrl || a.image || a.photo || a.img || null;
// const vehImg   = (v) => v.imagePath || v.imageUrl || v.image || v.photo || v.img || null;

// /* ━━━ LOADING / ERROR ━━━ */
// function Centered({ children }) {
//   return <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"linear-gradient(135deg,#f8fafc,#eef2ff)", padding:24 }}>{children}</div>;
// }
// function Spinner() {
//   return (
//     <div style={{ textAlign:"center" }}>
//       <div style={{ width:44, height:44, border:"3px solid #e0e7ff", borderTopColor:"#6366f1", borderRadius:"50%", animation:"qspin .8s linear infinite", margin:"0 auto 16px" }} />
//       <p style={{ fontSize:14, color:"#94a3b8", margin:0, fontWeight:600 }}>Loading your journey…</p>
//     </div>
//   );
// }
// function ErrBox({ msg }) {
//   return (
//     <div style={{ background:"#fff", border:"1px solid #fecaca", borderRadius:20, padding:"36px 40px", textAlign:"center", maxWidth:400, boxShadow:"0 20px 60px rgba(0,0,0,0.08)" }}>
//       <p style={{ fontSize:40, margin:"0 0 14px" }}>⚠️</p>
//       <p style={{ fontSize:15, color:"#991b1b", fontWeight:700, margin:0 }}>{msg}</p>
//     </div>
//   );
// }

// /* ━━━ SECTION HEADING ━━━ */
// function SectionTitle({ children, sub, light }) {
//   return (
//     <div style={{ textAlign:"center", marginBottom:36 }}>
//       <div style={{ display:"inline-flex", alignItems:"center", gap:10, marginBottom:14 }}>
//         <span style={{ width:28, height:2, background:"linear-gradient(90deg,transparent,#6366f1)", borderRadius:100 }} />
//         <span style={{ width:6, height:6, borderRadius:"50%", background:"#6366f1" }} />
//         <span style={{ width:28, height:2, background:"linear-gradient(90deg,#6366f1,transparent)", borderRadius:100 }} />
//       </div>
//       <h2 style={{ fontSize:"clamp(26px,4vw,36px)", fontWeight:800, color: light?"#fff":"#0f172a", margin:"0 0 8px", letterSpacing:"-0.8px" }}>{children}</h2>
//       {sub && <p style={{ fontSize:14, color: light?"rgba(255,255,255,0.6)":"#94a3b8", margin:0, fontWeight:500 }}>{sub}</p>}
//     </div>
//   );
// }

// /* ━━━ POLICY BLOCK ━━━ */
// function PolicyBlock({ title, items, accent, bg }) {
//   if (!items || items.length === 0) return null;
//   return (
//     <div style={{ marginBottom:24 }}>
//       <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
//         <span style={{ width:34, height:34, borderRadius:9, background:bg||"#eef2ff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
//           <span style={{ width:8, height:8, borderRadius:"50%", background:accent }} />
//         </span>
//         <h3 style={{ fontSize:16, fontWeight:700, color:"#0f172a", margin:0 }}>{title}</h3>
//       </div>
//       <div style={{ paddingLeft:44 }}>
//         {items.map((it, i) => (
//           <div key={i} style={{ display:"flex", gap:10, marginBottom:9, alignItems:"flex-start" }}>
//             <span style={{ fontSize:11, fontWeight:800, color:accent, minWidth:20, marginTop:1 }}>{String(i+1).padStart(2,"0")}</span>
//             <span style={{ fontSize:13.5, color:"#475569", lineHeight:1.7 }}>{it}</span>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }

// /* ━━━ MAIN ━━━ */
// export default function QuotationWebView({ publicId }) {
//   const [q, setQ]           = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError]   = useState(null);

//   useEffect(() => {
//     let active = true;
//     (async () => {
//       try {
//         setLoading(true); setError(null);
//         const res = await fetch(`${API}/public/quotations/${publicId}`);
//         if (!res.ok) throw new Error(res.status === 404 ? "This quotation link is invalid or no longer available." : "Failed to load the quotation.");
//         const body = await res.json();
//         const data = body?.data || body;
//         console.log("=== QUOTATION DATA ===", data);
//         if (active) setQ(data);
//       } catch (e) {
//         // getErrorMessage keeps the messages thrown just above (they were written for the reader),
//         // and turns a raw `fetch` transport failure into "Can't reach the server" instead of the
//         // browser's "Failed to fetch".
//         if (active) setError(getErrorMessage(e, "Failed to load the quotation."));
//       } finally {
//         if (active) setLoading(false);
//       }
//     })();
//     return () => { active = false; };
//   }, [publicId]);

//   if (loading) return <Centered><Spinner /></Centered>;
//   if (error)   return <Centered><ErrBox msg={error} /></Centered>;
//   if (!q)      return <Centered>Quotation not found.</Centered>;

//   if (q.templateStyle === "MODERN") return <ModernWebView data={q} pdfUrl={`${API}/public/quotations/${publicId}/pdf`} />;

//   const c = q.customer || {};
//   const company = q.company || q.organization || {};
//   const totals = q.totals || {};
//   const pdfUrl = `${API}/public/quotations/${publicId}/pdf`;

//   const destStr = c.destination || (Array.isArray(q.destinations) ? q.destinations.join(" → ") : "") || "";
//   const preparedBy = q.preparedBy || q.createdByName || company.contactPerson || "";
//   const companyPhone = company.phone || company.contactNumber || q.companyPhone || "";
//   const companyEmail = company.email || q.companyEmail || "";

//   // "What's Included" manifest. Har chip ka ✓ sirf tab jab section included HO aur uski list
//   // non-empty ho — wahi rule jo detail sections (:371, :468, :516) aur price breakdown follow
//   // karte hain, taaki teeno kabhi ek doosre se disagree na karein.
//   // KNOWN GAP: is Classic view me flight/cruise/add-on ke DETAIL sections abhi hain hi nahi,
//   // sirf chip aur price line hai. Chips isliye nahi hataye ki tab breakdown se desync ho jaata
//   // (paisa dikhta, service nahi) — asli fix wo teen sections add karna hai.
//   const services = [
//     { label:"Flights",     icon:"✈️", on: !!(q.flight?.included && q.flight?.segments?.length) },
//     { label:"Hotels",      icon:"🏨", on: !!(q.hotel?.included && q.hotel?.hotels?.length) },
//     { label:"Sightseeing", icon:"🗺️", on: !!(q.sightseeing?.included && q.sightseeing?.days?.length) },
//     { label:"Transport",   icon:"🚗", on: !!(q.vehicle?.included && q.vehicle?.vehicles?.length) },
//     { label:"Cruise",      icon:"🚢", on: !!(q.cruise?.included && q.cruise?.cruises?.length) },
//     { label:"Add-ons",     icon:"✨", on: !!(q.addons?.included && q.addons?.items?.length) },
//   ];

//   const testimonials = Array.isArray(q.testimonials) ? q.testimonials
//     : Array.isArray(q.reviews) ? q.reviews : [];

//   const grand = totals.grandTotal ?? q.grandTotal;
//   const perAdult = totals.perAdult ?? (grand && c.adults ? Math.round(grand / c.adults) : null);

//   return (
//     <div style={{ fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif", minHeight:"100%", background:"#f8fafc", color:"#0f172a", overflowX:"hidden", maxWidth:"100vw" }}>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
//         @keyframes qspin{to{transform:rotate(360deg)}}
//         @keyframes qfade{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
//         @keyframes qfadeUp{from{opacity:0;transform:translateY(40px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
//         @keyframes qfloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
//         @keyframes qfloat2{0%,100%{transform:translate(0,0)}33%{transform:translate(10px,-12px)}66%{transform:translate(-8px,8px)}}
//         @keyframes qshine{0%{background-position:-200% center}100%{background-position:200% center}}
//         @keyframes qpulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.15)}}
//         @keyframes qdrive{0%{left:-100px}100%{left:calc(100% + 20px)}}
//         @keyframes qspinwheel{to{transform:rotate(360deg)}}
//         @keyframes qroadmove{0%{transform:translateX(0)}100%{transform:translateX(-52px)}}
//         .qcar{animation:qdrive 9s linear infinite}
//         .qwheel{transform-box:fill-box;transform-origin:center;animation:qspinwheel .6s linear infinite}
//         .qroad{animation:qroadmove 1.2s linear infinite}
//         @media (prefers-reduced-motion:reduce){
//           .qcar{animation-duration:0s;left:20px}
//           .qwheel,.qroad{animation:none}
//         }
//         @keyframes qshimmer{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
//         @keyframes qglow{0%,100%{box-shadow:0 20px 60px rgba(99,102,241,0.4)}50%{box-shadow:0 24px 72px rgba(139,92,246,0.55)}}
//         @keyframes qborder{0%,100%{border-color:rgba(99,102,241,0.3)}50%{border-color:rgba(139,92,246,0.6)}}
//         @keyframes qrise{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}

//         .qfade{animation:qfadeUp .7s cubic-bezier(.16,1,.3,1) both}
//         .qcard{transition:transform .4s cubic-bezier(.16,1,.3,1),box-shadow .4s ease,border-color .3s ease;will-change:transform;position:relative}
//         .qcard:hover{transform:translateY(-8px)}
//         .qcard::after{content:'';position:absolute;inset:0;border-radius:inherit;box-shadow:0 30px 60px rgba(99,102,241,0);transition:box-shadow .4s ease;pointer-events:none}
//         .qcard:hover::after{box-shadow:0 30px 70px rgba(99,102,241,0.18)}
//         .qimg{transition:transform .6s cubic-bezier(.16,1,.3,1)}
//         .qimg-wrap{position:relative}
//         .qimg-wrap:hover .qimg{transform:scale(1.08)}
//         .qbtn{transition:transform .25s cubic-bezier(.16,1,.3,1),box-shadow .25s ease;position:relative;overflow:hidden}
//         .qbtn:hover{transform:translateY(-3px)}
//         .qbtn:active{transform:translateY(-1px) scale(.98)}
//         .qbtn::before{content:'';position:absolute;top:0;left:0;width:40%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent);transform:translateX(-150%);transition:none}
//         .qbtn:hover::before{animation:qshimmer .8s ease}
//         .qsvc{transition:transform .35s cubic-bezier(.16,1,.3,1),box-shadow .35s ease,border-color .3s ease}
//         .qsvc:hover{transform:translateY(-6px) scale(1.03)}
//         .qglass{backdrop-filter:blur(16px) saturate(160%);-webkit-backdrop-filter:blur(16px) saturate(160%)}
//         .qglow{animation:qglow 4s ease-in-out infinite}
//         .qmini{transition:transform .25s ease}
//         .qmini:hover{transform:translateX(2px)}
//         * { box-sizing:border-box; }

//         /* ─── OVERFLOW FIX — no horizontal scroll on mobile ─── */
//         html, body { overflow-x: hidden !important; max-width: 100%; margin: 0; padding: 0; }
//         img { max-width: 100%; }
//         p, h1, h2, h3, span { overflow-wrap: break-word; word-break: break-word; }

//         /* ─── RESPONSIVE (mobile / tablet) ─── */
//         @media (max-width: 900px) {
//           /* Hero cards: 4 → 2 per row on tablet */
//           .qherogrid { grid-template-columns: repeat(2, 1fr) !important; }
//         }
//         @media (max-width: 640px) {
//           /* Hero cards: 2 per row on mobile */
//           .qherogrid { grid-template-columns: repeat(2, 1fr) !important; }
//           /* Hotel/Vehicle 2-col grid → 1 col on mobile */
//           .qgrid2 { grid-template-columns: 1fr !important; }
//           /* Activity row: image upar, text neeche (stack) */
//           .qact-row { flex-direction: column !important; gap: 12px !important; }
//           .qact-img { width: 100% !important; }
//           .qact-img img { width: 100% !important; height: 200px !important; }
//           /* Section vertical padding kam */
//           .qsection { padding-top: 40px !important; padding-bottom: 0 !important; }
//           .qsection-last { padding-top: 40px !important; padding-bottom: 40px !important; }
//           /* Cards ka andar ka padding thoda kam */
//           .qpad { padding: 20px !important; }
//         }
//         @media (max-width: 440px) {
//           /* Hero cards: 1 per row on small mobile */
//           .qherogrid { grid-template-columns: 1fr !important; }
//           .qact-img img { height: 170px !important; }
//         }
//       `}</style>

//       {/* ━━━━━ HERO ━━━━━ */}
//       <div style={{ background:"linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#312e81 100%)", color:"#fff", position:"relative", overflow:"hidden" }}>
//         {/* Decorative orbs */}
//         <div style={{ position:"absolute", top:-100, right:-80, width:340, height:340, borderRadius:"50%", background:"radial-gradient(circle,rgba(99,102,241,0.35),transparent 70%)", animation:"qfloat 8s ease infinite" }} />
//         <div style={{ position:"absolute", bottom:-120, left:-100, width:320, height:320, borderRadius:"50%", background:"radial-gradient(circle,rgba(139,92,246,0.3),transparent 70%)", animation:"qfloat 10s ease infinite" }} />
//         <div style={{ position:"absolute", top:40, left:"30%", width:200, height:200, borderRadius:"50%", background:"radial-gradient(circle,rgba(59,130,246,0.2),transparent 70%)" }} />
//         {q.coverImageUrl && (
//           <img src={q.coverImageUrl} alt="" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", opacity:.12 }} />
//         )}

//         {/* ── Airplane orbit — tilted ellipse (45°): upar jaate waqt dikhe, wapas "under" se invisible ── */}
//         <div style={{ position:"absolute", inset:0, overflow:"hidden", pointerEvents:"none", zIndex:0 }}>
//           <svg width="100%" height="100%" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice" style={{ position:"absolute", inset:0 }}>
//             <defs>
//               {/* contrail gradient — plane ke peeche fading trail */}
//               <linearGradient id="qtrail" x1="0" y1="0" x2="1" y2="0">
//                 <stop offset="0" stopColor="#fff" stopOpacity="0"/>
//                 <stop offset="1" stopColor="#fff" stopOpacity="0.55"/>
//               </linearGradient>
//             </defs>
//             {/* The airplane — tilted-ellipse orbit, auto-rotates with path */}
//             <g className="qplaneG">
//               {/* contrail (rotate=auto ke saath hamesha plane ke peeche rahega) */}
//               <rect x="-98" y="-2.5" width="74" height="4" rx="2" fill="url(#qtrail)"/>
//               <rect x="-78" y="5" width="52" height="2.5" rx="1.5" fill="url(#qtrail)" opacity="0.6"/>
//               <g transform="translate(-26,-26)">
//                 <svg width="52" height="52" viewBox="0 0 92 92" fill="none">
//                   <path d="M78 46 C78 46 70 42 60 41 L48 20 C46.5 17 44 17 43 20 L45 39 L26 37 L18 26 C16.5 24 14 24 14 27 L17 40 C13 42 9 45 9 46 C9 47 13 50 17 52 L14 65 C14 68 16.5 68 18 66 L26 55 L45 53 L43 72 C44 75 46.5 75 48 72 L60 51 C70 50 78 46 78 46 Z" fill="#fff" opacity="0.97"/>
//                   <path d="M48 20 C46.5 17 44 17 43 20 L45 39 L54 40 L48 20 Z" fill="#dbe4ff"/>
//                   <path d="M43 72 C44 75 46.5 75 48 72 L54 53 L45 53 L43 72 Z" fill="#dbe4ff"/>
//                   <circle cx="58" cy="45" r="1.6" fill="#93a4d4"/>
//                   <circle cx="63" cy="45" r="1.6" fill="#93a4d4"/>
//                   <circle cx="68" cy="45.5" r="1.6" fill="#93a4d4"/>
//                   <circle cx="74" cy="46" r="2.4" fill="#fbbf24"/>
//                   <path d="M17 40 L14 27 C14 24 16.5 24 18 26 L23 34 Z" fill="#ef4444" opacity="0.9"/>
//                 </svg>
//               </g>
//               {/* Tilted ellipse path: bottom-left (140,360) → top-right (1060,60) → wapas */}
//               <animateMotion dur="22s" repeatCount="indefinite" rotate="auto"
//                 path="M 140 360 A 490 60 -18 0 1 1060 60 A 490 60 -18 0 1 140 360" />
//               {/* Forward (bottom→top): visible · Return (under side): invisible */}
//               <animate attributeName="opacity" dur="22s" repeatCount="indefinite"
//                 values="1;1;0;0;1" keyTimes="0;0.46;0.53;0.93;1" />
//             </g>
//           </svg>
//         </div>

//         {/* ── Animated car driving across (TravelCRM signature) ── */}
//         <div style={{ position:"absolute", bottom:0, left:0, right:0, height:70, overflow:"hidden", pointerEvents:"none", zIndex:0 }}>
//           {/* Road line with moving dashes */}
//           <div style={{ position:"absolute", bottom:18, left:0, right:0, height:2, background:"rgba(255,255,255,0.12)" }} />
//           <div className="qroad" style={{ position:"absolute", bottom:17, left:0, width:"200%", height:3, backgroundImage:"repeating-linear-gradient(90deg,rgba(251,191,36,0.5) 0 24px,transparent 24px 52px)" }} />
//           {/* The car */}
//           <div className="qcar" style={{ position:"absolute", bottom:14 }}>
//             <svg width="88" height="40" viewBox="0 0 88 40" fill="none" xmlns="http://www.w3.org/2000/svg">
//               {/* headlight glow */}
//               <ellipse cx="84" cy="22" rx="10" ry="4" fill="rgba(255,240,180,0.35)" />
//               {/* body */}
//               <path d="M6 26 L12 26 C13 20 16 15 24 14 L40 13 C46 13 50 15 55 19 L72 21 C78 22 82 24 82 27 L82 30 C82 31 81 32 80 32 L8 32 C7 32 6 31 6 30 Z" fill="#6366f1"/>
//               <path d="M24 14 L40 13 C46 13 50 15 55 19 L44 19 L38 15 L26 15 Z" fill="#818cf8"/>
//               {/* windows */}
//               <path d="M27 15 L37 15 L42 19 L27 19 Z" fill="#c7d2fe" opacity="0.9"/>
//               {/* headlight */}
//               <circle cx="81" cy="24" r="2" fill="#fde68a"/>
//               {/* wheels */}
//               <circle className="qwheel" cx="24" cy="32" r="6" fill="#1e293b" stroke="#475569" strokeWidth="1.5"/>
//               <circle cx="24" cy="32" r="2" fill="#94a3b8"/>
//               <circle className="qwheel" cx="64" cy="32" r="6" fill="#1e293b" stroke="#475569" strokeWidth="1.5"/>
//               <circle cx="64" cy="32" r="2" fill="#94a3b8"/>
//             </svg>
//           </div>
//         </div>
//         <div style={{ maxWidth:1040, margin:"0 auto", padding:"56px 24px 48px", position:"relative", zIndex:1 }}>
//           {/* Badge */}
//           <div className="qfade" style={{ textAlign:"center", marginBottom:20 }}>
//             <span style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.2)", borderRadius:100, padding:"7px 18px", backdropFilter:"blur(10px)" }}>
//               <span style={{ width:7, height:7, borderRadius:"50%", background:"#4ade80", animation:"qpulse 2s ease infinite" }} />
//               <span style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.85)", letterSpacing:".15em", textTransform:"uppercase" }}>Curated Travel Experience</span>
//             </span>
//           </div>
//           {/* Destination */}
//           <div className="qfade" style={{ textAlign:"center", marginBottom:10 }}>
//             <h1 style={{ fontSize:"clamp(40px,9vw,72px)", fontWeight:900, margin:0, letterSpacing:"-2px", lineHeight:1, background:"linear-gradient(90deg,#fff,#c7d2fe,#fff)", backgroundSize:"200% auto", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", animation:"qshine 6s linear infinite" }}>
//               {destStr.split("→")[0]?.trim() || q.title || "Your Trip"}
//             </h1>
//             <p style={{ fontSize:16, color:"rgba(255,255,255,0.65)", margin:"14px 0 0", fontWeight:600, letterSpacing:".05em" }}>
//               {q.nights ?? "—"} Nights · {q.days ?? "—"} Days
//             </p>
//           </div>
//           <p className="qfade" style={{ textAlign:"center", fontSize:"clamp(17px,3vw,24px)", fontWeight:700, color:"rgba(255,255,255,0.92)", margin:"0 0 40px" }}>{q.title || "Travel Package"}</p>

//           {/* Info grid — glassmorphism cards */}
//           <div className="qfade qherogrid" style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:12 }}>
//             {[
//               ["Traveler", c.name || "—", "👤"],
//               ["Travel Date", fmtDate(c.travelDate), "📅"],
//               ["Duration", `${q.nights ?? "—"}N / ${q.days ?? "—"}D`, "⏱️"],
//               ["Travelers", `${c.adults||0}A${c.children?` · ${c.children}C`:""}${c.infants?` · ${c.infants}I`:""}`, "👥"],
//               ["Rooms", q.rooms ? `${q.rooms}` : (c.rooms ? `${c.rooms}` : "—"), "🛏️"],
//               ["Quote ID", q.quoteNo ? `#${q.quoteNo}` : "—", "🎫"],
//               ["Destinations", destStr || "—", "📍"],
//               ["Prepared By", preparedBy || "—", "✍️"],
//             ].map(([label, val, icon], i) => (
//               <div key={i} className="qglass qmini" style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.14)", borderRadius:14, padding:"16px 16px", transition:"background .3s ease,border-color .3s ease" }}>
//                 <div style={{ fontSize:16, marginBottom:8, opacity:.9 }}>{icon}</div>
//                 <p style={{ fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.45)", textTransform:"uppercase", letterSpacing:".1em", margin:"0 0 4px" }}>{label}</p>
//                 <p style={{ fontSize:13, fontWeight:700, color:"#fff", margin:0, lineHeight:1.3, wordBreak:"break-word" }}>{val}</p>
//               </div>
//             ))}
//           </div>

//           {/* Price card — premium */}
//           <div className="qfade qglow" style={{ marginTop:32, background:"linear-gradient(135deg,#6366f1,#8b5cf6,#a855f7)", borderRadius:24, padding:"36px 28px", textAlign:"center", position:"relative", overflow:"hidden" }}>
//             <div style={{ position:"absolute", top:0, left:0, width:"60%", height:"100%", background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)", animation:"qshimmer 5s ease infinite", pointerEvents:"none" }} />
//             <div style={{ position:"absolute", top:-40, right:-40, width:160, height:160, borderRadius:"50%", border:"2px solid rgba(255,255,255,0.1)" }} />
//             <div style={{ position:"absolute", bottom:-50, left:-30, width:140, height:140, borderRadius:"50%", border:"2px solid rgba(255,255,255,0.08)" }} />
//             <p style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.8)", textTransform:"uppercase", letterSpacing:".18em", margin:"0 0 10px", position:"relative" }}>Total Package Price</p>
//             <p style={{ fontSize:"clamp(42px,9vw,64px)", fontWeight:900, margin:"0 0 6px", letterSpacing:"-2px", lineHeight:1, position:"relative", textShadow:"0 4px 20px rgba(0,0,0,0.2)" }}>{inr(grand)}</p>
//             <p style={{ fontSize:12, color:"rgba(255,255,255,0.8)", margin:"0 0 6px", position:"relative" }}>✓ Inclusive of all taxes</p>
//             {perAdult && c.adults ? (
//               <p style={{ fontSize:14, fontWeight:600, color:"rgba(255,255,255,0.9)", margin:"0 0 24px", position:"relative" }}>{c.adults} Adults × {inr(perAdult)}</p>
//             ) : <div style={{ height:24 }} />}
//             {companyPhone && (
//               <a href={`tel:${companyPhone}`} className="qbtn" style={{ display:"inline-flex", alignItems:"center", gap:8, background:"#fff", color:"#6366f1", fontSize:15, fontWeight:800, padding:"14px 36px", borderRadius:100, textDecoration:"none", boxShadow:"0 8px 24px rgba(0,0,0,0.15)", position:"relative" }}>
//                 📞 Contact Now
//               </a>
//             )}
//           </div>
//         </div>
//       </div>

//       {/* ━━━━━ SERVICES ━━━━━ */}
//       <div style={{ maxWidth:1040, margin:"0 auto", padding:"56px 24px 0" }}>
//         <SectionTitle sub="Everything included in your package">What's Included</SectionTitle>
//         <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(min(100%, 140px),1fr))", gap:14 }}>
//           {services.map((s, i) => (
//             <div key={i} className="qsvc" style={{ background:"#fff", border:`2px solid ${s.on?"#c7d2fe":"#f1f5f9"}`, borderRadius:18, padding:"22px 14px", textAlign:"center", boxShadow: s.on?"0 8px 24px rgba(99,102,241,0.08)":"0 2px 8px rgba(0,0,0,0.03)", opacity: s.on?1:0.6 }}>
//               <div style={{ fontSize:30, marginBottom:10, filter: s.on?"none":"grayscale(1)" }}>{s.icon}</div>
//               <p style={{ fontSize:14, fontWeight:700, color:s.on?"#0f172a":"#94a3b8", margin:"0 0 8px" }}>{s.label}</p>
//               <div style={{ width:26, height:26, borderRadius:"50%", background:s.on?"linear-gradient(135deg,#22c55e,#16a34a)":"#e2e8f0", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto", fontSize:14, color:"#fff", fontWeight:900 }}>
//                 {s.on ? "✓" : "✕"}
//               </div>
//             </div>
//           ))}
//         </div>
//       </div>

//       {/* ━━━━━ ITINERARY ━━━━━ */}
//       {q.sightseeing?.included && q.sightseeing?.days?.length > 0 && (
//         <div style={{ maxWidth:1040, margin:"0 auto", padding:"64px 24px 0" }}>
//           <SectionTitle sub="Your day-by-day journey unfolds">Your Itinerary</SectionTitle>
//           <div style={{ position:"relative" }}>
//             {/* Timeline line */}
//             <div style={{ position:"absolute", left:26, top:20, bottom:20, width:2, background:"linear-gradient(180deg,#c7d2fe,#e0e7ff,transparent)", display:"none" }} className="qtimeline" />
//             <div style={{ display:"flex", flexDirection:"column", gap:32 }}>
//               {q.sightseeing.days.map((d, i) => {
//                 const firstAct = (d.activities || [])[0] || {};
//                 return (
//                   <div key={i} className="qfade qcard" style={{ background:"#fff", borderRadius:24, overflow:"hidden", boxShadow:"0 10px 40px rgba(0,0,0,0.07)", border:"1px solid #eef2ff" }}>
//                     <div style={{ padding:"28px 30px" }}>
//                       {/* Day header */}
//                       <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:18 }}>
//                         <div style={{ width:52, height:52, borderRadius:16, background:"linear-gradient(135deg,#6366f1,#8b5cf6)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", flexShrink:0, boxShadow:"0 8px 20px rgba(99,102,241,0.3)" }}>
//                           <span style={{ fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.8)", textTransform:"uppercase", lineHeight:1 }}>Day</span>
//                           <span style={{ fontSize:22, fontWeight:900, color:"#fff", lineHeight:1 }}>{d.day}</span>
//                         </div>
//                         <div style={{ minWidth:0 }}>
//                           <h3 style={{ fontSize:22, fontWeight:800, color:"#0f172a", margin:"0 0 3px", letterSpacing:"-0.5px" }}>
//                             {firstAct.attraction || d.title || `Day ${d.day}`}
//                           </h3>
//                           <p style={{ fontSize:13, color:"#94a3b8", margin:0, fontWeight:600, display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
//                             {(d.location || firstAct.city) && <span>📍 {d.location || firstAct.city}</span>}
//                             {d.date && <span style={{ color:"#cbd5e1" }}>·</span>}
//                             {d.date && <span>{fmtDateFull(d.date)}</span>}
//                           </p>
//                         </div>
//                       </div>

//                       {/* Activities */}
//                       <div style={{ background:"linear-gradient(135deg,#f8fafc,#f1f5f9)", borderRadius:16, padding:"20px 22px" }}>
//                         <p style={{ fontSize:11, fontWeight:800, color:"#6366f1", textTransform:"uppercase", letterSpacing:".1em", margin:"0 0 16px" }}>✦ Activities & Highlights</p>
//                         {(d.activities || []).map((a, j) => {
//                           const meals = Array.isArray(a.meals) ? a.meals.filter(Boolean) : [];
//                           const aImg = actImg(a);
//                           const rawDesc = (a.description || "").trim();
//                           let descPoints = [];
//                           if (rawDesc) {
//                             if (/\n|\r/.test(rawDesc)) descPoints = rawDesc.split(/\n|\r/);
//                             else descPoints = rawDesc.split(/\.(?:\s+|$)/);
//                             descPoints = descPoints.map(s => s.replace(/^[-*•\s]+/, "").trim()).filter(Boolean);
//                           }
//                           return (
//                             <div key={j} className="qact-row" style={{ display:"flex", gap:16, marginBottom: j<(d.activities.length-1) ? 20 : 0, paddingBottom: j<(d.activities.length-1) ? 20 : 0, borderBottom: j<(d.activities.length-1) ? "1px dashed #e2e8f0" : "none" }}>
//                               {aImg && (
//                                 <div className="qimg-wrap qact-img" style={{ flexShrink:0, borderRadius:16, overflow:"hidden", boxShadow:"0 8px 20px rgba(0,0,0,0.1)" }}>
//                                   <img src={aImg} alt={a.attraction} className="qimg"
//                                     style={{ width:200, height:160, objectFit:"cover", display:"block" }}
//                                     onError={(e) => { e.target.style.display = "none"; }} />
//                                 </div>
//                               )}
//                               <div style={{ minWidth:0, flex:1 }}>
//                                 <p style={{ fontSize:16, fontWeight:800, color:"#0f172a", margin:"0 0 10px", display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
//                                   {a.attraction}
//                                   {a.startTime && <span style={{ fontSize:11, fontWeight:700, color:"#6366f1", background:"#eef2ff", padding:"3px 10px", borderRadius:100 }}>{a.startTime}</span>}
//                                 </p>
//                                 {descPoints.length > 0 && (
//                                   <div style={{ margin:"0 0 12px" }}>
//                                     {descPoints.map((line, li) => (
//                                       <div key={li} style={{ display:"flex", gap:8, marginBottom:7, alignItems:"flex-start" }}>
//                                         <span style={{ width:6, height:6, borderRadius:"50%", background:"linear-gradient(135deg,#6366f1,#8b5cf6)", flexShrink:0, marginTop:6 }} />
//                                         <span style={{ fontSize:13.5, color:"#475569", lineHeight:1.65 }}>{line}</span>
//                                       </div>
//                                     ))}
//                                   </div>
//                                 )}
//                                 <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
//                                   {a.transfer && (
//                                     <span style={{ fontSize:11, fontWeight:700, color:"#6366f1", background:"#eef2ff", border:"1px solid #c7d2fe", borderRadius:100, padding:"5px 13px" }}>🚐 {a.transfer}</span>
//                                   )}
//                                   {meals.length > 0 && (
//                                     <span style={{ fontSize:11, fontWeight:700, color:"#ea580c", background:"#fff7ed", border:"1px solid #fed7aa", borderRadius:100, padding:"5px 13px" }}>🍽 {meals.join(", ")}</span>
//                                   )}
//                                 </div>
//                               </div>
//                             </div>
//                           );
//                         })}
//                       </div>

//                       {d.overnightStay && (
//                         <div style={{ marginTop:16, display:"inline-flex", alignItems:"center", gap:8, background:"linear-gradient(135deg,#ecfdf5,#f0fdf4)", border:"1px solid #a7f3d0", borderRadius:12, padding:"10px 16px" }}>
//                           <span style={{ fontSize:16 }}>🌙</span>
//                           <span style={{ fontSize:13, fontWeight:700, color:"#059669" }}>Overnight Stay: {d.overnightStay}</span>
//                         </div>
//                       )}
//                     </div>
//                   </div>
//                 );
//               })}
//             </div>
//           </div>
//         </div>
//       )}

//       {/* ━━━━━ HOTELS ━━━━━ */}
//       {q.hotel?.included && q.hotel?.hotels?.length > 0 && (
//         <div style={{ maxWidth:1040, margin:"0 auto", padding:"64px 24px 0" }}>
//           <SectionTitle sub="Handpicked stays for your comfort">Where You'll Stay</SectionTitle>
//           <div className="qgrid2" style={{ display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gap:24 }}>
//             {q.hotel.hotels.map((h, i) => {
//               const img = hotelImg(h);
//               return (
//                 <div key={i} className="qfade qcard" style={{ background:"#fff", borderRadius:22, overflow:"hidden", boxShadow:"0 10px 40px rgba(0,0,0,0.08)", border:"1px solid #eef2ff" }}>
//                   {img && (
//                     <div className="qimg-wrap" style={{ width:"100%", height:200, overflow:"hidden", position:"relative" }}>
//                       <img src={img} alt={h.name} className="qimg" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}
//                         onError={(e) => { e.target.parentElement.style.display = "none"; }} />
//                       <div style={{ position:"absolute", inset:0, background:"linear-gradient(180deg,transparent 60%,rgba(0,0,0,0.4))" }} />
//                       {h.stars > 0 && (
//                         <span style={{ position:"absolute", top:12, right:12, background:"rgba(255,255,255,0.95)", color:"#f59e0b", fontSize:12, fontWeight:800, padding:"5px 12px", borderRadius:100, boxShadow:"0 4px 12px rgba(0,0,0,0.15)" }}>
//                           {"★".repeat(h.stars)}
//                         </span>
//                       )}
//                       <h3 style={{ position:"absolute", bottom:14, left:16, right:16, fontSize:20, fontWeight:800, color:"#fff", margin:0, textShadow:"0 2px 8px rgba(0,0,0,0.5)" }}>{h.name}</h3>
//                     </div>
//                   )}
//                   <div style={{ padding:"20px 22px" }}>
//                     {!img && <h3 style={{ fontSize:20, fontWeight:800, color:"#0f172a", margin:"0 0 3px" }}>{h.name}</h3>}
//                     <p style={{ fontSize:13, color:"#94a3b8", margin:"0 0 16px", fontWeight:600, display:"flex", alignItems:"center", gap:6 }}>📍 {[h.city, h.country].filter(Boolean).join(", ")}</p>
//                     <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
//                       {h.roomType && <MiniDetail icon="🛏️" label="Room" val={h.roomType} />}
//                       {h.mealPlan && <MiniDetail icon="🍴" label="Meals" val={h.mealPlan} />}
//                       {h.rooms ? <MiniDetail icon="🔑" label="Rooms" val={h.rooms} /> : null}
//                     </div>
//                     <div style={{ display:"flex", gap:10, borderTop:"1px solid #f1f5f9", paddingTop:16 }}>
//                       <div style={{ flex:1, background:"#ecfdf5", borderRadius:12, padding:"10px 12px" }}>
//                         <p style={{ fontSize:9, fontWeight:700, color:"#059669", textTransform:"uppercase", letterSpacing:".05em", margin:"0 0 3px" }}>Check-in</p>
//                         <p style={{ fontSize:12, fontWeight:700, color:"#0f172a", margin:0 }}>{fmtDate(h.checkIn)}</p>
//                       </div>
//                       <div style={{ flex:1, background:"#fef2f2", borderRadius:12, padding:"10px 12px" }}>
//                         <p style={{ fontSize:9, fontWeight:700, color:"#dc2626", textTransform:"uppercase", letterSpacing:".05em", margin:"0 0 3px" }}>Check-out</p>
//                         <p style={{ fontSize:12, fontWeight:700, color:"#0f172a", margin:0 }}>{fmtDate(h.checkOut)}</p>
//                       </div>
//                     </div>
//                   </div>
//                 </div>
//               );
//             })}
//           </div>
//         </div>
//       )}

//       {/* ━━━━━ TRANSPORT ━━━━━ */}
//       {q.vehicle?.included && q.vehicle?.vehicles?.length > 0 && (
//         <div style={{ maxWidth:1040, margin:"0 auto", padding:"64px 24px 0" }}>
//           <SectionTitle sub="Travel in comfort and style">Your Transport</SectionTitle>
//           <div className="qgrid2" style={{ display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gap:24 }}>
//             {q.vehicle.vehicles.map((v, i) => {
//               const img = vehImg(v);
//               return (
//                 <div key={i} className="qfade qcard" style={{ background:"#fff", borderRadius:22, overflow:"hidden", boxShadow:"0 10px 40px rgba(0,0,0,0.08)", border:"1px solid #eef2ff" }}>
//                   {img && (
//                     <div className="qimg-wrap" style={{ width:"100%", height:200, overflow:"hidden", position:"relative" }}>
//                       <img src={img} alt={v.model || v.type} className="qimg" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}
//                         onError={(e) => { e.target.parentElement.style.display = "none"; }} />
//                       <div style={{ position:"absolute", inset:0, background:"linear-gradient(180deg,transparent 60%,rgba(0,0,0,0.4))" }} />
//                       <h3 style={{ position:"absolute", bottom:14, left:16, right:16, fontSize:20, fontWeight:800, color:"#fff", margin:0, textShadow:"0 2px 8px rgba(0,0,0,0.5)" }}>{v.model || v.type}</h3>
//                     </div>
//                   )}
//                   <div style={{ padding:"20px 22px" }}>
//                     {!img && <h3 style={{ fontSize:20, fontWeight:800, color:"#0f172a", margin:"0 0 12px" }}>{v.model || v.type}</h3>}
//                     <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
//                       {v.type && <MiniDetail icon="🚗" label="Type" val={v.type} />}
//                       {v.capacity ? <MiniDetail icon="👥" label="Seats" val={v.capacity} /> : null}
//                       {(v.pickup || v.drop) && <MiniDetail icon="📍" label="Route" val={[v.pickup, v.drop].filter(Boolean).join(" → ")} />}
//                       {(v.startDate || v.endDate) && <MiniDetail icon="📅" label="Dates" val={`${fmtDate(v.startDate)}${v.endDate?` → ${fmtDate(v.endDate)}`:""}`} />}
//                       {v.qty ? <MiniDetail icon="#️⃣" label="Qty" val={v.qty} /> : null}
//                     </div>
//                     {v.notes && <p style={{ fontSize:12.5, color:"#64748b", margin:"14px 0 0", fontStyle:"italic", lineHeight:1.6, background:"#f8fafc", borderRadius:10, padding:"10px 14px" }}>💬 {v.notes}</p>}
//                   </div>
//                 </div>
//               );
//             })}
//           </div>
//         </div>
//       )}

//       {/* ━━━━━ TESTIMONIALS ━━━━━ */}
//       {testimonials.length > 0 && (
//         <div style={{ maxWidth:1040, margin:"0 auto", padding:"64px 24px 0" }}>
//           <SectionTitle sub="Stories from fellow travelers">Loved by Travelers</SectionTitle>
//           <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(min(100%, 280px),1fr))", gap:24 }}>
//             {testimonials.map((t, i) => {
//               const name = t.name || t.customerName || "Guest";
//               return (
//                 <div key={i} className="qcard" style={{ background:"#fff", borderRadius:22, padding:"26px 28px", boxShadow:"0 10px 40px rgba(0,0,0,0.07)", border:"1px solid #eef2ff", position:"relative" }}>
//                   <span style={{ position:"absolute", top:18, right:24, fontSize:56, color:"#eef2ff", fontWeight:900, lineHeight:1, fontFamily:"Georgia,serif" }}>"</span>
//                   <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:16, position:"relative" }}>
//                     <div style={{ width:52, height:52, borderRadius:"50%", background:"linear-gradient(135deg,#6366f1,#8b5cf6)", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:800, flexShrink:0, boxShadow:"0 6px 16px rgba(99,102,241,0.3)" }}>
//                       {name.charAt(0).toUpperCase()}
//                     </div>
//                     <div>
//                       <p style={{ fontSize:16, fontWeight:800, color:"#0f172a", margin:0 }}>{name}</p>
//                       {t.trip && <p style={{ fontSize:12, color:"#94a3b8", margin:0, fontStyle:"italic" }}>{t.trip}</p>}
//                     </div>
//                   </div>
//                   {(t.rating || t.stars) ? (
//                     <p style={{ color:"#f59e0b", fontSize:16, margin:"0 0 10px", letterSpacing:2 }}>{"★".repeat(Number(t.rating || t.stars) || 5)}</p>
//                   ) : null}
//                   <p style={{ fontSize:14, color:"#475569", lineHeight:1.75, margin:0 }}>{t.review || t.text || t.comment || ""}</p>
//                 </div>
//               );
//             })}
//           </div>
//         </div>
//       )}

//       {/* ━━━━━ PRICE BREAKDOWN ━━━━━ */}
//       {(totals.subtotal != null || grand != null) && (
//         <div style={{ maxWidth:1040, margin:"0 auto", padding:"64px 24px 0" }}>
//           <SectionTitle sub="Transparent, no hidden costs">Price Breakdown</SectionTitle>
//           <div style={{ maxWidth:540, margin:"0 auto", background:"#fff", borderRadius:24, overflow:"hidden", boxShadow:"0 20px 60px rgba(0,0,0,0.08)", border:"1px solid #eef2ff" }}>
//             <div style={{ padding:"28px 30px" }}>
//               {/* Do baatein yahan galat thi:
//                   1. Ye rows `totals.flightAmount`-type fields padhte the jo public Totals DTO pe
//                      EXIST hi nahi karte (wo sirf subtotal/discount/tax/grandTotal/perAdult deta
//                      hai) — isliye poora breakdown chupchaap gayab tha. Per-section amount SECTION
//                      object pe hota hai (q.flight.amount, q.hotel.amount, …), waise hi jaise
//                      ModernWebView padhta hai.
//                   2. Koi bhi row `included` check nahi karti thi — ek excluded section ka paisa bhi
//                      customer ke saamne line item ban ke aa jaata (cruise wali line pakki culprit).
//                   Ab dono: included AND amount > 0. */}
//               {q.flight?.included      && q.flight.amount      > 0 && <PLine label="✈️ Flights"     val={inr(q.flight.amount)} />}
//               {q.hotel?.included       && q.hotel.amount       > 0 && <PLine label="🏨 Hotels"      val={inr(q.hotel.amount)} />}
//               {q.sightseeing?.included && q.sightseeing.amount > 0 && <PLine label="🗺️ Sightseeing" val={inr(q.sightseeing.amount)} />}
//               {q.cruise?.included      && q.cruise.amount      > 0 && <PLine label="🚢 Cruise"      val={inr(q.cruise.amount)} />}
//               {q.vehicle?.included     && q.vehicle.amount     > 0 && <PLine label="🚗 Transport"   val={inr(q.vehicle.amount)} />}
//               {q.addons?.included      && q.addons.amount      > 0 && <PLine label="✨ Add-ons"     val={inr(q.addons.amount)} />}
//               {totals.subtotal != null && (
//                 <>
//                   <div style={{ height:1, background:"linear-gradient(90deg,transparent,#e2e8f0,transparent)", margin:"16px 0" }} />
//                   <PLine label="Subtotal" val={inr(totals.subtotal)} bold />
//                 </>
//               )}
//               {totals.discountAmount > 0 && <PLine label="🎉 Discount" val={`− ${inr(totals.discountAmount)}`} green />}
//               {totals.markup         > 0 && <PLine label="Service Charge" val={inr(totals.markup)} />}
//               {totals.taxAmount      > 0 && <PLine label={`Tax (${totals.taxPercent||0}%)`} val={inr(totals.taxAmount)} />}
//             </div>
//             <div style={{ background:"linear-gradient(135deg,#6366f1,#8b5cf6,#a855f7)", padding:"22px 30px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"relative", overflow:"hidden" }}>
//               <div style={{ position:"absolute", top:-30, right:-20, width:120, height:120, borderRadius:"50%", border:"2px solid rgba(255,255,255,0.1)" }} />
//               <span style={{ fontSize:15, fontWeight:700, color:"rgba(255,255,255,0.9)", position:"relative" }}>Grand Total</span>
//               <span style={{ fontSize:30, fontWeight:900, color:"#fff", position:"relative", textShadow:"0 2px 12px rgba(0,0,0,0.2)" }}>{inr(grand)}</span>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* ━━━━━ POLICIES ━━━━━ */}
//       {(q.inclusions?.length || q.exclusions?.length || q.paymentPolicies?.length || q.cancellationPolicies?.length || q.bookingTerms?.length) ? (
//         <div style={{ maxWidth:1040, margin:"0 auto", padding:"64px 24px 0" }}>
//           <SectionTitle sub="Everything you need to know">Terms & Policies</SectionTitle>
//           <div style={{ background:"#fff", borderRadius:24, padding:"32px 32px 12px", boxShadow:"0 10px 40px rgba(0,0,0,0.07)", border:"1px solid #eef2ff" }}>
//             <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(min(100%, 260px),1fr))", gap:28 }}>
//               <PolicyBlock title="Inclusions" items={q.inclusions} accent="#16a34a" bg="#ecfdf5" />
//               <PolicyBlock title="Exclusions" items={q.exclusions} accent="#dc2626" bg="#fef2f2" />
//             </div>
//             <PolicyBlock title="Payment Policies" items={q.paymentPolicies} accent="#6366f1" bg="#eef2ff" />
//             <PolicyBlock title="Cancellation Policies" items={q.cancellationPolicies} accent="#ea580c" bg="#fff7ed" />
//             <PolicyBlock title="Booking Terms" items={q.bookingTerms} accent="#8b5cf6" bg="#f5f3ff" />
//           </div>
//         </div>
//       ) : null}

//       {/* ━━━━━ CONTACT ━━━━━ */}
//       <div style={{ maxWidth:1040, margin:"0 auto", padding:"64px 24px 56px" }}>
//         <div style={{ background:"linear-gradient(135deg,#0f172a,#1e1b4b,#312e81)", borderRadius:28, padding:"48px 32px", color:"#fff", textAlign:"center", position:"relative", overflow:"hidden", boxShadow:"0 20px 60px rgba(15,23,42,0.3)" }}>
//           <div style={{ position:"absolute", top:-60, right:-40, width:200, height:200, borderRadius:"50%", background:"radial-gradient(circle,rgba(99,102,241,0.3),transparent 70%)" }} />
//           <div style={{ position:"absolute", bottom:-70, left:-50, width:220, height:220, borderRadius:"50%", background:"radial-gradient(circle,rgba(139,92,246,0.25),transparent 70%)" }} />
//           <div style={{ position:"relative" }}>
//             <h2 style={{ fontSize:30, fontWeight:800, margin:"0 0 10px", letterSpacing:"-0.5px" }}>Ready for This Journey?</h2>
//             <p style={{ fontSize:15, color:"rgba(255,255,255,0.65)", margin:"0 0 32px", maxWidth:500, marginLeft:"auto", marginRight:"auto", lineHeight:1.7 }}>
//               Get in touch to book or ask any questions. We're here to make your trip unforgettable.
//             </p>

//             {(company.logo || company.logoUrl) && (
//               <img src={company.logo || company.logoUrl} alt={company.name} style={{ maxHeight:70, borderRadius:12, marginBottom:20 }} />
//             )}
//             {company.name && <p style={{ fontSize:22, fontWeight:800, margin:"0 0 6px" }}>{company.name}</p>}
//             {preparedBy && <p style={{ fontSize:14, color:"rgba(255,255,255,0.7)", margin:"0 0 8px" }}>Your Travel Expert: {preparedBy}</p>}
//             {companyPhone && <p style={{ fontSize:15, color:"rgba(255,255,255,0.9)", margin:"0 0 2px", fontWeight:600 }}>{companyPhone}</p>}
//             {companyEmail && <p style={{ fontSize:14, color:"rgba(255,255,255,0.7)", margin:"0 0 8px" }}>{companyEmail}</p>}
//             {company.address && <p style={{ fontSize:13, color:"rgba(255,255,255,0.5)", margin:"0 0 28px", lineHeight:1.6, whiteSpace:"pre-line" }}>{company.address}</p>}

//             <div style={{ display:"flex", flexWrap:"wrap", gap:12, justifyContent:"center", marginBottom:20 }}>
//               {companyPhone && (
//                 <a href={`tel:${companyPhone}`} className="qbtn" style={{ display:"inline-flex", alignItems:"center", gap:8, background:"linear-gradient(135deg,#6366f1,#8b5cf6)", color:"#fff", fontSize:14, fontWeight:700, padding:"13px 26px", borderRadius:100, textDecoration:"none", boxShadow:"0 8px 24px rgba(99,102,241,0.4)" }}>
//                   📞 Call Now
//                 </a>
//               )}
//               {companyPhone && (
//                 <a href={`https://wa.me/${companyPhone.replace(/\D/g,"")}?text=${encodeURIComponent(`Hello, I'm interested in the travel quotation (${q.title || ""})`)}`} target="_blank" rel="noreferrer" className="qbtn" style={{ display:"inline-flex", alignItems:"center", gap:8, background:"linear-gradient(135deg,#22c55e,#16a34a)", color:"#fff", fontSize:14, fontWeight:700, padding:"13px 26px", borderRadius:100, textDecoration:"none", boxShadow:"0 8px 24px rgba(34,197,94,0.4)" }}>
//                   💬 WhatsApp
//                 </a>
//               )}
//               {companyEmail && (
//                 <a href={`mailto:${companyEmail}?subject=${encodeURIComponent(`Quotation Inquiry (${q.title || ""})`)}`} className="qbtn" style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(255,255,255,0.12)", color:"#fff", fontSize:14, fontWeight:700, padding:"13px 26px", borderRadius:100, textDecoration:"none", border:"1px solid rgba(255,255,255,0.2)", backdropFilter:"blur(10px)" }}>
//                   ✉️ Email
//                 </a>
//               )}
//               <a href={pdfUrl} target="_blank" rel="noreferrer" className="qbtn" style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(255,255,255,0.12)", color:"#fff", fontSize:14, fontWeight:700, padding:"13px 26px", borderRadius:100, textDecoration:"none", border:"1px solid rgba(255,255,255,0.2)", backdropFilter:"blur(10px)" }}>
//                 ⬇️ Download PDF
//               </a>
//             </div>

//             <div style={{ height:1, background:"rgba(255,255,255,0.1)", margin:"28px 0 18px" }} />
//             <p style={{ fontSize:12, color:"rgba(255,255,255,0.4)", margin:"0 0 5px" }}>
//               © {new Date().getFullYear()} {company.name || "Travel Company"}. All rights reserved.
//             </p>
//             <p style={{ fontSize:11, color:"rgba(255,255,255,0.3)", margin:0 }}>
//               {[company.since && `Since ${company.since}`, company.reviewsCount && `${company.reviewsCount} Reviews`, company.gst && `GST: ${company.gst}`].filter(Boolean).join(" · ")}
//             </p>
//             <p style={{ fontSize:11, color:"rgba(255,255,255,0.3)", margin:"6px 0 0" }}>
//               Quote {q.quoteNo ? `#${q.quoteNo}` : "—"} · Generated {fmtDate(q.createdAt)}
//             </p>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// /* ━━━ HELPERS ━━━ */
// function MiniDetail({ icon, label, val }) {
//   return (
//     <div>
//       <p style={{ fontSize:9, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:".05em", margin:"0 0 3px" }}>{icon} {label}</p>
//       <p style={{ fontSize:13, fontWeight:700, color:"#0f172a", margin:0, wordBreak:"break-word", overflowWrap:"anywhere" }}>{val}</p>
//     </div>
//   );
// }
// function PLine({ label, val, green, bold }) {
//   return (
//     <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
//       <span style={{ fontSize:14, color: bold?"#0f172a":"#64748b", fontWeight: bold?700:500 }}>{label}</span>
//       <span style={{ fontSize:14, fontWeight:700, color: green ? "#16a34a" : "#0f172a" }}>{val}</span>
//     </div>
//   );
// }

// /* ━━━ PUBLIC ROUTE ━━━ */
// export function PublicQuotationPage() {
//   const { publicId } = useParams();
//   return <div className="min-h-screen"><QuotationWebView publicId={publicId} /></div>;
// }










import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getErrorMessage } from "@shared/api/apiError";
import ModernWebView from "../components/ModernWebView";
import PremiumWebView from "../components/PremiumWebView";

const API = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

const inr = (v) => (v == null ? "—" : `₹${Number(v).toLocaleString("en-IN")}`);
const fmtDate = (d) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
};
const fmtDateFull = (d) => {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); }
  catch { return d; }
};

// ── Image resolvers ──
const hotelImg = (h) => h.imageUrl || h.imagePath || h.image || h.photo || h.coverImage || h.hotelImage || h.img || (Array.isArray(h.images) && h.images[0]) || null;
const actImg   = (a) => a.imagePath || a.imageUrl || a.image || a.photo || a.img || null;
const vehImg   = (v) => v.imagePath || v.imageUrl || v.image || v.photo || v.img || null;

/* ━━━ LOADING / ERROR ━━━ */
function Centered({ children }) {
  return <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"linear-gradient(135deg,#f8fafc,#eef2ff)", padding:24 }}>{children}</div>;
}
function Spinner() {
  return (
    <div style={{ textAlign:"center" }}>
      <div style={{ width:44, height:44, border:"3px solid #e0e7ff", borderTopColor:"#6366f1", borderRadius:"50%", animation:"qspin .8s linear infinite", margin:"0 auto 16px" }} />
      <p style={{ fontSize:14, color:"#94a3b8", margin:0, fontWeight:600 }}>Loading your journey…</p>
    </div>
  );
}
function ErrBox({ msg }) {
  return (
    <div style={{ background:"#fff", border:"1px solid #fecaca", borderRadius:20, padding:"36px 40px", textAlign:"center", maxWidth:400, boxShadow:"0 20px 60px rgba(0,0,0,0.08)" }}>
      <p style={{ fontSize:40, margin:"0 0 14px" }}>⚠️</p>
      <p style={{ fontSize:15, color:"#991b1b", fontWeight:700, margin:0 }}>{msg}</p>
    </div>
  );
}

/* ━━━ SECTION HEADING ━━━ */
function SectionTitle({ children, sub, light }) {
  return (
    <div style={{ textAlign:"center", marginBottom:36 }}>
      <div style={{ display:"inline-flex", alignItems:"center", gap:10, marginBottom:14 }}>
        <span style={{ width:28, height:2, background:"linear-gradient(90deg,transparent,#6366f1)", borderRadius:100 }} />
        <span style={{ width:6, height:6, borderRadius:"50%", background:"#6366f1" }} />
        <span style={{ width:28, height:2, background:"linear-gradient(90deg,#6366f1,transparent)", borderRadius:100 }} />
      </div>
      <h2 style={{ fontSize:"clamp(26px,4vw,36px)", fontWeight:800, color: light?"#fff":"#0f172a", margin:"0 0 8px", letterSpacing:"-0.8px" }}>{children}</h2>
      {sub && <p style={{ fontSize:14, color: light?"rgba(255,255,255,0.6)":"#94a3b8", margin:0, fontWeight:500 }}>{sub}</p>}
    </div>
  );
}

/* ━━━ POLICY BLOCK ━━━ */
function PolicyBlock({ title, items, accent, bg }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ marginBottom:24 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
        <span style={{ width:34, height:34, borderRadius:9, background:bg||"#eef2ff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <span style={{ width:8, height:8, borderRadius:"50%", background:accent }} />
        </span>
        <h3 style={{ fontSize:16, fontWeight:700, color:"#0f172a", margin:0 }}>{title}</h3>
      </div>
      <div style={{ paddingLeft:44 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display:"flex", gap:10, marginBottom:9, alignItems:"flex-start" }}>
            <span style={{ fontSize:11, fontWeight:800, color:accent, minWidth:20, marginTop:1 }}>{String(i+1).padStart(2,"0")}</span>
            <span style={{ fontSize:13.5, color:"#475569", lineHeight:1.7 }}>{it}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ━━━ MAIN ━━━
   styleOverride (optional): one-off design for the agent's internal preview picker.
   It never touches the quotation's saved templateStyle — the customer's /q/ link
   keeps rendering the stored design. */
export default function QuotationWebView({ publicId, styleOverride }) {
  const [q, setQ]           = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true); setError(null);
        const res = await fetch(`${API}/public/quotations/${publicId}`);
        if (!res.ok) throw new Error(res.status === 404 ? "This quotation link is invalid or no longer available." : "Failed to load the quotation.");
        const body = await res.json();
        const data = body?.data || body;
        console.log("=== QUOTATION DATA ===", data);
        if (active) setQ(data);
      } catch (e) {
        if (active) setError(getErrorMessage(e, "Failed to load the quotation."));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [publicId]);

  if (loading) return <Centered><Spinner /></Centered>;
  if (error)   return <Centered><ErrBox msg={error} /></Centered>;
  if (!q)      return <Centered>Quotation not found.</Centered>;

  const style = styleOverride || q.templateStyle;
  if (style === "MODERN")  return <ModernWebView  data={q} pdfUrl={`${API}/public/quotations/${publicId}/pdf`} />;
  if (style === "PREMIUM") return <PremiumWebView data={q} pdfUrl={`${API}/public/quotations/${publicId}/pdf`} />;

  const c = q.customer || {};
  const company = q.company || q.organization || {};
  const totals = q.totals || {};
  const pdfUrl = `${API}/public/quotations/${publicId}/pdf`;

  const destStr = c.destination || (Array.isArray(q.destinations) ? q.destinations.join(" → ") : "") || "";
  const preparedBy = q.preparedBy || q.createdByName || company.contactPerson || "";
  const companyPhone = company.phone || company.contactNumber || q.companyPhone || "";
  const companyEmail = company.email || q.companyEmail || "";

  const services = [
    { label:"Flights",     icon:"✈️", on: !!(q.flight?.included && q.flight?.segments?.length) },
    { label:"Hotels",      icon:"🏨", on: !!(q.hotel?.included && q.hotel?.hotels?.length) },
    { label:"Sightseeing", icon:"🗺️", on: !!(q.sightseeing?.included && q.sightseeing?.days?.length) },
    { label:"Transport",   icon:"🚗", on: !!(q.vehicle?.included && q.vehicle?.vehicles?.length) },
    { label:"Cruise",      icon:"🚢", on: !!(q.cruise?.included && q.cruise?.cruises?.length) },
    { label:"Add-ons",     icon:"✨", on: !!(q.addons?.included && q.addons?.items?.length) },
  ];

  const testimonials = Array.isArray(q.testimonials) ? q.testimonials
    : Array.isArray(q.reviews) ? q.reviews : [];

  const grand = totals.grandTotal ?? q.grandTotal;
  const perAdult = totals.perAdult ?? (grand && c.adults ? Math.round(grand / c.adults) : null);

  return (
    <div style={{ fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif", minHeight:"100%", background:"#f8fafc", color:"#0f172a", overflowX:"hidden", maxWidth:"100vw" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes qspin{to{transform:rotate(360deg)}}
        @keyframes qfade{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        @keyframes qfadeUp{from{opacity:0;transform:translateY(40px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes qfloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes qfloat2{0%,100%{transform:translate(0,0)}33%{transform:translate(10px,-12px)}66%{transform:translate(-8px,8px)}}
        @keyframes qshine{0%{background-position:-200% center}100%{background-position:200% center}}
        @keyframes qpulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.15)}}
        @keyframes qdrive{0%{left:-100px}100%{left:calc(100% + 20px)}}
        @keyframes qspinwheel{to{transform:rotate(360deg)}}
        @keyframes qroadmove{0%{transform:translateX(0)}100%{transform:translateX(-52px)}}
        .qcar{animation:qdrive 9s linear infinite}
        .qwheel{transform-box:fill-box;transform-origin:center;animation:qspinwheel .6s linear infinite}
        .qroad{animation:qroadmove 1.2s linear infinite}
        @media (prefers-reduced-motion:reduce){
          .qcar{animation-duration:0s;left:20px}
          .qwheel,.qroad{animation:none}
        }
        @keyframes qshimmer{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
        @keyframes qglow{0%,100%{box-shadow:0 20px 60px rgba(99,102,241,0.4)}50%{box-shadow:0 24px 72px rgba(139,92,246,0.55)}}
        @keyframes qborder{0%,100%{border-color:rgba(99,102,241,0.3)}50%{border-color:rgba(139,92,246,0.6)}}
        @keyframes qrise{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}

        .qfade{animation:qfadeUp .7s cubic-bezier(.16,1,.3,1) both}
        .qcard{transition:transform .4s cubic-bezier(.16,1,.3,1),box-shadow .4s ease,border-color .3s ease;will-change:transform;position:relative}
        .qcard:hover{transform:translateY(-8px)}
        .qcard::after{content:'';position:absolute;inset:0;border-radius:inherit;box-shadow:0 30px 60px rgba(99,102,241,0);transition:box-shadow .4s ease;pointer-events:none}
        .qcard:hover::after{box-shadow:0 30px 70px rgba(99,102,241,0.18)}
        .qimg{transition:transform .6s cubic-bezier(.16,1,.3,1)}
        .qimg-wrap{position:relative}
        .qimg-wrap:hover .qimg{transform:scale(1.08)}
        .qbtn{transition:transform .25s cubic-bezier(.16,1,.3,1),box-shadow .25s ease;position:relative;overflow:hidden}
        .qbtn:hover{transform:translateY(-3px)}
        .qbtn:active{transform:translateY(-1px) scale(.98)}
        .qbtn::before{content:'';position:absolute;top:0;left:0;width:40%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent);transform:translateX(-150%);transition:none}
        .qbtn:hover::before{animation:qshimmer .8s ease}
        .qsvc{transition:transform .35s cubic-bezier(.16,1,.3,1),box-shadow .35s ease,border-color .3s ease}
        .qsvc:hover{transform:translateY(-6px) scale(1.03)}
        .qglass{backdrop-filter:blur(16px) saturate(160%);-webkit-backdrop-filter:blur(16px) saturate(160%)}
        .qglow{animation:qglow 4s ease-in-out infinite}
        .qmini{transition:transform .25s ease}
        .qmini:hover{transform:translateX(2px)}
        * { box-sizing:border-box; }

        /* ─── OVERFLOW FIX — no horizontal scroll on mobile ─── */
        html, body { overflow-x: hidden !important; max-width: 100%; margin: 0; padding: 0; }
        img { max-width: 100%; }
        p, h1, h2, h3, span { overflow-wrap: break-word; word-break: break-word; }

        /* ─── RESPONSIVE (mobile / tablet) ─── */
        @media (max-width: 900px) {
          .qherogrid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 640px) {
          .qherogrid { grid-template-columns: repeat(2, 1fr) !important; }
          .qgrid2 { grid-template-columns: 1fr !important; }
          .qact-row { flex-direction: column !important; gap: 12px !important; }
          .qact-img { width: 100% !important; }
          .qact-img img { width: 100% !important; height: 200px !important; }
          .qsection { padding-top: 40px !important; padding-bottom: 0 !important; }
          .qsection-last { padding-top: 40px !important; padding-bottom: 40px !important; }
          .qpad { padding: 20px !important; }
        }
        @media (max-width: 440px) {
          .qherogrid { grid-template-columns: 1fr !important; }
          .qact-img img { height: 170px !important; }
        }
      `}</style>

      {/* ━━━━━ HERO ━━━━━ */}
      <div style={{ backgroundColor:"#000", color:"#fff", position:"relative", overflow:"hidden" }}>
        
        {/* Clean Background Image with adjusted opacity for text readability */}
        {q.coverImageUrl && (
          <img src={q.coverImageUrl} alt="" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", opacity: 0.5 }} />
        )}

        {/* ── Airplane orbit ── */}
        <div style={{ position:"absolute", inset:0, overflow:"hidden", pointerEvents:"none", zIndex:0 }}>
          <svg width="100%" height="100%" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice" style={{ position:"absolute", inset:0 }}>
            <defs>
              <linearGradient id="qtrail" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#fff" stopOpacity="0"/>
                <stop offset="1" stopColor="#fff" stopOpacity="0.55"/>
              </linearGradient>
            </defs>
            <g className="qplaneG">
              <rect x="-98" y="-2.5" width="74" height="4" rx="2" fill="url(#qtrail)"/>
              <rect x="-78" y="5" width="52" height="2.5" rx="1.5" fill="url(#qtrail)" opacity="0.6"/>
              <g transform="translate(-26,-26)">
                <svg width="52" height="52" viewBox="0 0 92 92" fill="none">
                  <path d="M78 46 C78 46 70 42 60 41 L48 20 C46.5 17 44 17 43 20 L45 39 L26 37 L18 26 C16.5 24 14 24 14 27 L17 40 C13 42 9 45 9 46 C9 47 13 50 17 52 L14 65 C14 68 16.5 68 18 66 L26 55 L45 53 L43 72 C44 75 46.5 75 48 72 L60 51 C70 50 78 46 78 46 Z" fill="#fff" opacity="0.97"/>
                  <path d="M48 20 C46.5 17 44 17 43 20 L45 39 L54 40 L48 20 Z" fill="#dbe4ff"/>
                  <path d="M43 72 C44 75 46.5 75 48 72 L54 53 L45 53 L43 72 Z" fill="#dbe4ff"/>
                  <circle cx="58" cy="45" r="1.6" fill="#93a4d4"/>
                  <circle cx="63" cy="45" r="1.6" fill="#93a4d4"/>
                  <circle cx="68" cy="45.5" r="1.6" fill="#93a4d4"/>
                  <circle cx="74" cy="46" r="2.4" fill="#fbbf24"/>
                  <path d="M17 40 L14 27 C14 24 16.5 24 18 26 L23 34 Z" fill="#ef4444" opacity="0.9"/>
                </svg>
              </g>
              {/* Animation path - removed the opacity animation completely so it stays visible */}
              <animateMotion dur="22s" repeatCount="indefinite" rotate="auto"
                path="M 140 360 A 490 60 -18 0 1 1060 60 A 490 60 -18 0 1 140 360" />
            </g>
          </svg>
        </div>

        {/* ── Animated car ── */}
        <div style={{ position:"absolute", bottom:0, left:0, right:0, height:70, overflow:"hidden", pointerEvents:"none", zIndex:0 }}>
          <div style={{ position:"absolute", bottom:18, left:0, right:0, height:2, background:"rgba(255,255,255,0.12)" }} />
          <div className="qroad" style={{ position:"absolute", bottom:17, left:0, width:"200%", height:3, backgroundImage:"repeating-linear-gradient(90deg,rgba(251,191,36,0.5) 0 24px,transparent 24px 52px)" }} />
          <div className="qcar" style={{ position:"absolute", bottom:14 }}>
            <svg width="88" height="40" viewBox="0 0 88 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="84" cy="22" rx="10" ry="4" fill="rgba(255,240,180,0.35)" />
              <path d="M6 26 L12 26 C13 20 16 15 24 14 L40 13 C46 13 50 15 55 19 L72 21 C78 22 82 24 82 27 L82 30 C82 31 81 32 80 32 L8 32 C7 32 6 31 6 30 Z" fill="#6366f1"/>
              <path d="M24 14 L40 13 C46 13 50 15 55 19 L44 19 L38 15 L26 15 Z" fill="#818cf8"/>
              <path d="M27 15 L37 15 L42 19 L27 19 Z" fill="#c7d2fe" opacity="0.9"/>
              <circle cx="81" cy="24" r="2" fill="#fde68a"/>
              <circle className="qwheel" cx="24" cy="32" r="6" fill="#1e293b" stroke="#475569" strokeWidth="1.5"/>
              <circle cx="24" cy="32" r="2" fill="#94a3b8"/>
              <circle className="qwheel" cx="64" cy="32" r="6" fill="#1e293b" stroke="#475569" strokeWidth="1.5"/>
              <circle cx="64" cy="32" r="2" fill="#94a3b8"/>
            </svg>
          </div>
        </div>
        
        <div style={{ maxWidth:1040, margin:"0 auto", padding:"56px 24px 48px", position:"relative", zIndex:1 }}>
          <div className="qfade" style={{ textAlign:"center", marginBottom:20 }}>
            <span style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.2)", borderRadius:100, padding:"7px 18px", backdropFilter:"blur(10px)" }}>
              <span style={{ width:7, height:7, borderRadius:"50%", background:"#4ade80", animation:"qpulse 2s ease infinite" }} />
              <span style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.85)", letterSpacing:".15em", textTransform:"uppercase" }}>Curated Travel Experience</span>
            </span>
          </div>
          <div className="qfade" style={{ textAlign:"center", marginBottom:10 }}>
            <h1 style={{ fontSize:"clamp(40px,9vw,72px)", fontWeight:900, margin:0, letterSpacing:"-2px", lineHeight:1, background:"linear-gradient(90deg,#fff,#c7d2fe,#fff)", backgroundSize:"200% auto", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", animation:"qshine 6s linear infinite" }}>
              {destStr.split("→")[0]?.trim() || q.title || "Your Trip"}
            </h1>
            <p style={{ fontSize:16, color:"rgba(255,255,255,0.65)", margin:"14px 0 0", fontWeight:600, letterSpacing:".05em" }}>
              {q.nights ?? "—"} Nights · {q.days ?? "—"} Days
            </p>
          </div>
          <p className="qfade" style={{ textAlign:"center", fontSize:"clamp(17px,3vw,24px)", fontWeight:700, color:"rgba(255,255,255,0.92)", margin:"0 0 40px" }}>{q.title || "Travel Package"}</p>

          <div className="qfade qherogrid" style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:12 }}>
            {[
              ["Traveler", c.name || "—", "👤"],
              ["Travel Date", fmtDate(c.travelDate), "📅"],
              ["Duration", `${q.nights ?? "—"}N / ${q.days ?? "—"}D`, "⏱️"],
              ["Travelers", `${c.adults||0}A${c.children?` · ${c.children}C`:""}${c.infants?` · ${c.infants}I`:""}`, "👥"],
              ["Rooms", q.rooms ? `${q.rooms}` : (c.rooms ? `${c.rooms}` : "—"), "🛏️"],
              ["Quote ID", q.quoteNo ? `#${q.quoteNo}` : "—", "🎫"],
              ["Destinations", destStr || "—", "📍"],
              ["Prepared By", preparedBy || "—", "✍️"],
            ].map(([label, val, icon], i) => (
              <div key={i} className="qglass qmini" style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.14)", borderRadius:14, padding:"16px 16px", transition:"background .3s ease,border-color .3s ease" }}>
                <div style={{ fontSize:16, marginBottom:8, opacity:.9 }}>{icon}</div>
                <p style={{ fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.45)", textTransform:"uppercase", letterSpacing:".1em", margin:"0 0 4px" }}>{label}</p>
                <p style={{ fontSize:13, fontWeight:700, color:"#fff", margin:0, lineHeight:1.3, wordBreak:"break-word" }}>{val}</p>
              </div>
            ))}
          </div>

          <div className="qfade qglow" style={{ marginTop:32, background:"linear-gradient(135deg,#6366f1,#8b5cf6,#a855f7)", borderRadius:24, padding:"36px 28px", textAlign:"center", position:"relative", overflow:"hidden" }}>
            <div style={{ position:"absolute", top:0, left:0, width:"60%", height:"100%", background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)", animation:"qshimmer 5s ease infinite", pointerEvents:"none" }} />
            <div style={{ position:"absolute", top:-40, right:-40, width:160, height:160, borderRadius:"50%", border:"2px solid rgba(255,255,255,0.1)" }} />
            <div style={{ position:"absolute", bottom:-50, left:-30, width:140, height:140, borderRadius:"50%", border:"2px solid rgba(255,255,255,0.08)" }} />
            <p style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.8)", textTransform:"uppercase", letterSpacing:".18em", margin:"0 0 10px", position:"relative" }}>Total Package Price</p>
            <p style={{ fontSize:"clamp(42px,9vw,64px)", fontWeight:900, margin:"0 0 6px", letterSpacing:"-2px", lineHeight:1, position:"relative", textShadow:"0 4px 20px rgba(0,0,0,0.2)" }}>{inr(grand)}</p>
            <p style={{ fontSize:12, color:"rgba(255,255,255,0.8)", margin:"0 0 6px", position:"relative" }}>✓ Inclusive of all taxes</p>
            {perAdult && c.adults ? (
              <p style={{ fontSize:14, fontWeight:600, color:"rgba(255,255,255,0.9)", margin:"0 0 24px", position:"relative" }}>{c.adults} Adults × {inr(perAdult)}</p>
            ) : <div style={{ height:24 }} />}
            {companyPhone && (
              <a href={`tel:${companyPhone}`} className="qbtn" style={{ display:"inline-flex", alignItems:"center", gap:8, background:"#fff", color:"#6366f1", fontSize:15, fontWeight:800, padding:"14px 36px", borderRadius:100, textDecoration:"none", boxShadow:"0 8px 24px rgba(0,0,0,0.15)", position:"relative" }}>
                📞 Contact Now
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ━━━━━ SERVICES ━━━━━ */}
      <div style={{ maxWidth:1040, margin:"0 auto", padding:"56px 24px 0" }}>
        <SectionTitle sub="Everything included in your package">What's Included</SectionTitle>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(min(100%, 140px),1fr))", gap:14 }}>
          {services.map((s, i) => (
            <div key={i} className="qsvc" style={{ background:"#fff", border:`2px solid ${s.on?"#c7d2fe":"#f1f5f9"}`, borderRadius:18, padding:"22px 14px", textAlign:"center", boxShadow: s.on?"0 8px 24px rgba(99,102,241,0.08)":"0 2px 8px rgba(0,0,0,0.03)", opacity: s.on?1:0.6 }}>
              <div style={{ fontSize:30, marginBottom:10, filter: s.on?"none":"grayscale(1)" }}>{s.icon}</div>
              <p style={{ fontSize:14, fontWeight:700, color:s.on?"#0f172a":"#94a3b8", margin:"0 0 8px" }}>{s.label}</p>
              <div style={{ width:26, height:26, borderRadius:"50%", background:s.on?"linear-gradient(135deg,#22c55e,#16a34a)":"#e2e8f0", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto", fontSize:14, color:"#fff", fontWeight:900 }}>
                {s.on ? "✓" : "✕"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ━━━━━ ITINERARY ━━━━━ */}
      {q.sightseeing?.included && q.sightseeing?.days?.length > 0 && (
        <div style={{ maxWidth:1040, margin:"0 auto", padding:"64px 24px 0" }}>
          <SectionTitle sub="Your day-by-day journey unfolds">Your Itinerary</SectionTitle>
          <div style={{ position:"relative" }}>
            <div style={{ position:"absolute", left:26, top:20, bottom:20, width:2, background:"linear-gradient(180deg,#c7d2fe,#e0e7ff,transparent)", display:"none" }} className="qtimeline" />
            <div style={{ display:"flex", flexDirection:"column", gap:32 }}>
              {q.sightseeing.days.map((d, i) => {
                const firstAct = (d.activities || [])[0] || {};
                return (
                  <div key={i} className="qfade qcard" style={{ background:"#fff", borderRadius:24, overflow:"hidden", boxShadow:"0 10px 40px rgba(0,0,0,0.07)", border:"1px solid #eef2ff" }}>
                    <div style={{ padding:"28px 30px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:18 }}>
                        <div style={{ width:52, height:52, borderRadius:16, background:"linear-gradient(135deg,#6366f1,#8b5cf6)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", flexShrink:0, boxShadow:"0 8px 20px rgba(99,102,241,0.3)" }}>
                          <span style={{ fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.8)", textTransform:"uppercase", lineHeight:1 }}>Day</span>
                          <span style={{ fontSize:22, fontWeight:900, color:"#fff", lineHeight:1 }}>{d.day}</span>
                        </div>
                        <div style={{ minWidth:0 }}>
                          <h3 style={{ fontSize:22, fontWeight:800, color:"#0f172a", margin:"0 0 3px", letterSpacing:"-0.5px" }}>
                            {firstAct.attraction || d.title || `Day ${d.day}`}
                          </h3>
                          <p style={{ fontSize:13, color:"#94a3b8", margin:0, fontWeight:600, display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                            {(d.location || firstAct.city) && <span>📍 {d.location || firstAct.city}</span>}
                            {d.date && <span style={{ color:"#cbd5e1" }}>·</span>}
                            {d.date && <span>{fmtDateFull(d.date)}</span>}
                          </p>
                        </div>
                      </div>

                      <div style={{ background:"linear-gradient(135deg,#f8fafc,#f1f5f9)", borderRadius:16, padding:"20px 22px" }}>
                        <p style={{ fontSize:11, fontWeight:800, color:"#6366f1", textTransform:"uppercase", letterSpacing:".1em", margin:"0 0 16px" }}>✦ Activities & Highlights</p>
                        {(d.activities || []).map((a, j) => {
                          const meals = Array.isArray(a.meals) ? a.meals.filter(Boolean) : [];
                          const aImg = actImg(a);
                          const rawDesc = (a.description || "").trim();
                          let descPoints = [];
                          if (rawDesc) {
                            if (/\n|\r/.test(rawDesc)) descPoints = rawDesc.split(/\n|\r/);
                            else descPoints = rawDesc.split(/\.(?:\s+|$)/);
                            descPoints = descPoints.map(s => s.replace(/^[-*•\s]+/, "").trim()).filter(Boolean);
                          }
                          return (
                            <div key={j} className="qact-row" style={{ display:"flex", gap:16, marginBottom: j<(d.activities.length-1) ? 20 : 0, paddingBottom: j<(d.activities.length-1) ? 20 : 0, borderBottom: j<(d.activities.length-1) ? "1px dashed #e2e8f0" : "none" }}>
                              {aImg && (
                                <div className="qimg-wrap qact-img" style={{ flexShrink:0, borderRadius:16, overflow:"hidden", boxShadow:"0 8px 20px rgba(0,0,0,0.1)" }}>
                                  <img src={aImg} alt={a.attraction} className="qimg"
                                    style={{ width:200, height:160, objectFit:"cover", display:"block" }}
                                    onError={(e) => { e.target.style.display = "none"; }} />
                                </div>
                              )}
                              <div style={{ minWidth:0, flex:1 }}>
                                <p style={{ fontSize:16, fontWeight:800, color:"#0f172a", margin:"0 0 10px", display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                                  {a.attraction}
                                  {a.startTime && <span style={{ fontSize:11, fontWeight:700, color:"#6366f1", background:"#eef2ff", padding:"3px 10px", borderRadius:100 }}>{a.startTime}</span>}
                                </p>
                                {descPoints.length > 0 && (
                                  <div style={{ margin:"0 0 12px" }}>
                                    {descPoints.map((line, li) => (
                                      <div key={li} style={{ display:"flex", gap:8, marginBottom:7, alignItems:"flex-start" }}>
                                        <span style={{ width:6, height:6, borderRadius:"50%", background:"linear-gradient(135deg,#6366f1,#8b5cf6)", flexShrink:0, marginTop:6 }} />
                                        <span style={{ fontSize:13.5, color:"#475569", lineHeight:1.65 }}>{line}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                                  {a.transfer && (
                                    <span style={{ fontSize:11, fontWeight:700, color:"#6366f1", background:"#eef2ff", border:"1px solid #c7d2fe", borderRadius:100, padding:"5px 13px" }}>🚐 {a.transfer}</span>
                                  )}
                                  {meals.length > 0 && (
                                    <span style={{ fontSize:11, fontWeight:700, color:"#ea580c", background:"#fff7ed", border:"1px solid #fed7aa", borderRadius:100, padding:"5px 13px" }}>🍽 {meals.join(", ")}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {d.overnightStay && (
                        <div style={{ marginTop:16, display:"inline-flex", alignItems:"center", gap:8, background:"linear-gradient(135deg,#ecfdf5,#f0fdf4)", border:"1px solid #a7f3d0", borderRadius:12, padding:"10px 16px" }}>
                          <span style={{ fontSize:16 }}>🌙</span>
                          <span style={{ fontSize:13, fontWeight:700, color:"#059669" }}>Overnight Stay: {d.overnightStay}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ━━━━━ HOTELS ━━━━━ */}
      {q.hotel?.included && q.hotel?.hotels?.length > 0 && (
        <div style={{ maxWidth:1040, margin:"0 auto", padding:"64px 24px 0" }}>
          <SectionTitle sub="Handpicked stays for your comfort">Where You'll Stay</SectionTitle>
          <div className="qgrid2" style={{ display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gap:24 }}>
            {q.hotel.hotels.map((h, i) => {
              const img = hotelImg(h);
              return (
                <div key={i} className="qfade qcard" style={{ background:"#fff", borderRadius:22, overflow:"hidden", boxShadow:"0 10px 40px rgba(0,0,0,0.08)", border:"1px solid #eef2ff" }}>
                  {img && (
                    <div className="qimg-wrap" style={{ width:"100%", height:200, overflow:"hidden", position:"relative" }}>
                      <img src={img} alt={h.name} className="qimg" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}
                        onError={(e) => { e.target.parentElement.style.display = "none"; }} />
                      <div style={{ position:"absolute", inset:0, background:"linear-gradient(180deg,transparent 60%,rgba(0,0,0,0.4))" }} />
                      {h.stars > 0 && (
                        <span style={{ position:"absolute", top:12, right:12, background:"rgba(255,255,255,0.95)", color:"#f59e0b", fontSize:12, fontWeight:800, padding:"5px 12px", borderRadius:100, boxShadow:"0 4px 12px rgba(0,0,0,0.15)" }}>
                          {"★".repeat(h.stars)}
                        </span>
                      )}
                      <h3 style={{ position:"absolute", bottom:14, left:16, right:16, fontSize:20, fontWeight:800, color:"#fff", margin:0, textShadow:"0 2px 8px rgba(0,0,0,0.5)" }}>{h.name}</h3>
                    </div>
                  )}
                  <div style={{ padding:"20px 22px" }}>
                    {!img && <h3 style={{ fontSize:20, fontWeight:800, color:"#0f172a", margin:"0 0 3px" }}>{h.name}</h3>}
                    <p style={{ fontSize:13, color:"#94a3b8", margin:"0 0 16px", fontWeight:600, display:"flex", alignItems:"center", gap:6 }}>📍 {[h.city, h.country].filter(Boolean).join(", ")}</p>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
                      {h.roomType && <MiniDetail icon="🛏️" label="Room" val={h.roomType} />}
                      {h.mealPlan && <MiniDetail icon="🍴" label="Meals" val={h.mealPlan} />}
                      {h.rooms ? <MiniDetail icon="🔑" label="Rooms" val={h.rooms} /> : null}
                    </div>
                    <div style={{ display:"flex", gap:10, borderTop:"1px solid #f1f5f9", paddingTop:16 }}>
                      <div style={{ flex:1, background:"#ecfdf5", borderRadius:12, padding:"10px 12px" }}>
                        <p style={{ fontSize:9, fontWeight:700, color:"#059669", textTransform:"uppercase", letterSpacing:".05em", margin:"0 0 3px" }}>Check-in</p>
                        <p style={{ fontSize:12, fontWeight:700, color:"#0f172a", margin:0 }}>{fmtDate(h.checkIn)}</p>
                      </div>
                      <div style={{ flex:1, background:"#fef2f2", borderRadius:12, padding:"10px 12px" }}>
                        <p style={{ fontSize:9, fontWeight:700, color:"#dc2626", textTransform:"uppercase", letterSpacing:".05em", margin:"0 0 3px" }}>Check-out</p>
                        <p style={{ fontSize:12, fontWeight:700, color:"#0f172a", margin:0 }}>{fmtDate(h.checkOut)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ━━━━━ TRANSPORT ━━━━━ */}
      {q.vehicle?.included && q.vehicle?.vehicles?.length > 0 && (
        <div style={{ maxWidth:1040, margin:"0 auto", padding:"64px 24px 0" }}>
          <SectionTitle sub="Travel in comfort and style">Your Transport</SectionTitle>
          <div className="qgrid2" style={{ display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gap:24 }}>
            {q.vehicle.vehicles.map((v, i) => {
              const img = vehImg(v);
              return (
                <div key={i} className="qfade qcard" style={{ background:"#fff", borderRadius:22, overflow:"hidden", boxShadow:"0 10px 40px rgba(0,0,0,0.08)", border:"1px solid #eef2ff" }}>
                  {img && (
                    <div className="qimg-wrap" style={{ width:"100%", height:200, overflow:"hidden", position:"relative" }}>
                      <img src={img} alt={v.model || v.type} className="qimg" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}
                        onError={(e) => { e.target.parentElement.style.display = "none"; }} />
                      <div style={{ position:"absolute", inset:0, background:"linear-gradient(180deg,transparent 60%,rgba(0,0,0,0.4))" }} />
                      <h3 style={{ position:"absolute", bottom:14, left:16, right:16, fontSize:20, fontWeight:800, color:"#fff", margin:0, textShadow:"0 2px 8px rgba(0,0,0,0.5)" }}>{v.model || v.type}</h3>
                    </div>
                  )}
                  <div style={{ padding:"20px 22px" }}>
                    {!img && <h3 style={{ fontSize:20, fontWeight:800, color:"#0f172a", margin:"0 0 12px" }}>{v.model || v.type}</h3>}
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                      {v.type && <MiniDetail icon="🚗" label="Type" val={v.type} />}
                      {v.capacity ? <MiniDetail icon="👥" label="Seats" val={v.capacity} /> : null}
                      {(v.pickup || v.drop) && <MiniDetail icon="📍" label="Route" val={[v.pickup, v.drop].filter(Boolean).join(" → ")} />}
                      {(v.startDate || v.endDate) && <MiniDetail icon="📅" label="Dates" val={`${fmtDate(v.startDate)}${v.endDate?` → ${fmtDate(v.endDate)}`:""}`} />}
                      {v.qty ? <MiniDetail icon="#️⃣" label="Qty" val={v.qty} /> : null}
                    </div>
                    {v.notes && <p style={{ fontSize:12.5, color:"#64748b", margin:"14px 0 0", fontStyle:"italic", lineHeight:1.6, background:"#f8fafc", borderRadius:10, padding:"10px 14px" }}>💬 {v.notes}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ━━━━━ TESTIMONIALS ━━━━━ */}
      {testimonials.length > 0 && (
        <div style={{ maxWidth:1040, margin:"0 auto", padding:"64px 24px 0" }}>
          <SectionTitle sub="Stories from fellow travelers">Loved by Travelers</SectionTitle>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(min(100%, 280px),1fr))", gap:24 }}>
            {testimonials.map((t, i) => {
              const name = t.name || t.customerName || "Guest";
              return (
                <div key={i} className="qcard" style={{ background:"#fff", borderRadius:22, padding:"26px 28px", boxShadow:"0 10px 40px rgba(0,0,0,0.07)", border:"1px solid #eef2ff", position:"relative" }}>
                  <span style={{ position:"absolute", top:18, right:24, fontSize:56, color:"#eef2ff", fontWeight:900, lineHeight:1, fontFamily:"Georgia,serif" }}>"</span>
                  <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:16, position:"relative" }}>
                    <div style={{ width:52, height:52, borderRadius:"50%", background:"linear-gradient(135deg,#6366f1,#8b5cf6)", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:800, flexShrink:0, boxShadow:"0 6px 16px rgba(99,102,241,0.3)" }}>
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p style={{ fontSize:16, fontWeight:800, color:"#0f172a", margin:0 }}>{name}</p>
                      {t.trip && <p style={{ fontSize:12, color:"#94a3b8", margin:0, fontStyle:"italic" }}>{t.trip}</p>}
                    </div>
                  </div>
                  {(t.rating || t.stars) ? (
                    <p style={{ color:"#f59e0b", fontSize:16, margin:"0 0 10px", letterSpacing:2 }}>{"★".repeat(Number(t.rating || t.stars) || 5)}</p>
                  ) : null}
                  <p style={{ fontSize:14, color:"#475569", lineHeight:1.75, margin:0 }}>{t.review || t.text || t.comment || ""}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ━━━━━ PRICE BREAKDOWN ━━━━━ */}
      {(totals.subtotal != null || grand != null) && (
        <div style={{ maxWidth:1040, margin:"0 auto", padding:"64px 24px 0" }}>
          <SectionTitle sub="Transparent, no hidden costs">Price Breakdown</SectionTitle>
          <div style={{ maxWidth:540, margin:"0 auto", background:"#fff", borderRadius:24, overflow:"hidden", boxShadow:"0 20px 60px rgba(0,0,0,0.08)", border:"1px solid #eef2ff" }}>
            <div style={{ padding:"28px 30px" }}>
              {q.flight?.included      && q.flight.amount      > 0 && <PLine label="✈️ Flights"     val={inr(q.flight.amount)} />}
              {q.hotel?.included       && q.hotel.amount       > 0 && <PLine label="🏨 Hotels"      val={inr(q.hotel.amount)} />}
              {q.sightseeing?.included && q.sightseeing.amount > 0 && <PLine label="🗺️ Sightseeing" val={inr(q.sightseeing.amount)} />}
              {q.cruise?.included      && q.cruise.amount      > 0 && <PLine label="🚢 Cruise"      val={inr(q.cruise.amount)} />}
              {q.vehicle?.included     && q.vehicle.amount     > 0 && <PLine label="🚗 Transport"   val={inr(q.vehicle.amount)} />}
              {q.addons?.included      && q.addons.amount      > 0 && <PLine label="✨ Add-ons"     val={inr(q.addons.amount)} />}
              {totals.subtotal != null && (
                <>
                  <div style={{ height:1, background:"linear-gradient(90deg,transparent,#e2e8f0,transparent)", margin:"16px 0" }} />
                  <PLine label="Subtotal" val={inr(totals.subtotal)} bold />
                </>
              )}
              {totals.discountAmount > 0 && <PLine label="🎉 Discount" val={`− ${inr(totals.discountAmount)}`} green />}
              {totals.markup         > 0 && <PLine label="Service Charge" val={inr(totals.markup)} />}
              {totals.taxAmount      > 0 && <PLine label={`Tax (${totals.taxPercent||0}%)`} val={inr(totals.taxAmount)} />}
            </div>
            <div style={{ background:"linear-gradient(135deg,#6366f1,#8b5cf6,#a855f7)", padding:"22px 30px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"relative", overflow:"hidden" }}>
              <div style={{ position:"absolute", top:-30, right:-20, width:120, height:120, borderRadius:"50%", border:"2px solid rgba(255,255,255,0.1)" }} />
              <span style={{ fontSize:15, fontWeight:700, color:"rgba(255,255,255,0.9)", position:"relative" }}>Grand Total</span>
              <span style={{ fontSize:30, fontWeight:900, color:"#fff", position:"relative", textShadow:"0 2px 12px rgba(0,0,0,0.2)" }}>{inr(grand)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ━━━━━ POLICIES ━━━━━ */}
      {(q.inclusions?.length || q.exclusions?.length || q.paymentPolicies?.length || q.cancellationPolicies?.length || q.bookingTerms?.length) ? (
        <div style={{ maxWidth:1040, margin:"0 auto", padding:"64px 24px 0" }}>
          <SectionTitle sub="Everything you need to know">Terms & Policies</SectionTitle>
          <div style={{ background:"#fff", borderRadius:24, padding:"32px 32px 12px", boxShadow:"0 10px 40px rgba(0,0,0,0.07)", border:"1px solid #eef2ff" }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(min(100%, 260px),1fr))", gap:28 }}>
              <PolicyBlock title="Inclusions" items={q.inclusions} accent="#16a34a" bg="#ecfdf5" />
              <PolicyBlock title="Exclusions" items={q.exclusions} accent="#dc2626" bg="#fef2f2" />
            </div>
            <PolicyBlock title="Payment Policies" items={q.paymentPolicies} accent="#6366f1" bg="#eef2ff" />
            <PolicyBlock title="Cancellation Policies" items={q.cancellationPolicies} accent="#ea580c" bg="#fff7ed" />
            <PolicyBlock title="Booking Terms" items={q.bookingTerms} accent="#8b5cf6" bg="#f5f3ff" />
          </div>
        </div>
      ) : null}

      {/* ━━━━━ CONTACT ━━━━━ */}
      <div style={{ maxWidth:1040, margin:"0 auto", padding:"64px 24px 56px" }}>
        <div style={{ background:"linear-gradient(135deg,#0f172a,#1e1b4b,#312e81)", borderRadius:28, padding:"48px 32px", color:"#fff", textAlign:"center", position:"relative", overflow:"hidden", boxShadow:"0 20px 60px rgba(15,23,42,0.3)" }}>
          <div style={{ position:"absolute", top:-60, right:-40, width:200, height:200, borderRadius:"50%", background:"radial-gradient(circle,rgba(99,102,241,0.3),transparent 70%)" }} />
          <div style={{ position:"absolute", bottom:-70, left:-50, width:220, height:220, borderRadius:"50%", background:"radial-gradient(circle,rgba(139,92,246,0.25),transparent 70%)" }} />
          <div style={{ position:"relative" }}>
            <h2 style={{ fontSize:30, fontWeight:800, margin:"0 0 10px", letterSpacing:"-0.5px" }}>Ready for This Journey?</h2>
            <p style={{ fontSize:15, color:"rgba(255,255,255,0.65)", margin:"0 0 32px", maxWidth:500, marginLeft:"auto", marginRight:"auto", lineHeight:1.7 }}>
              Get in touch to book or ask any questions. We're here to make your trip unforgettable.
            </p>

            {(company.logo || company.logoUrl) && (
              <img src={company.logo || company.logoUrl} alt={company.name} style={{ maxHeight:70, borderRadius:12, marginBottom:20 }} />
            )}
            {company.name && <p style={{ fontSize:22, fontWeight:800, margin:"0 0 6px" }}>{company.name}</p>}
            {preparedBy && <p style={{ fontSize:14, color:"rgba(255,255,255,0.7)", margin:"0 0 8px" }}>Your Travel Expert: {preparedBy}</p>}
            {companyPhone && <p style={{ fontSize:15, color:"rgba(255,255,255,0.9)", margin:"0 0 2px", fontWeight:600 }}>{companyPhone}</p>}
            {companyEmail && <p style={{ fontSize:14, color:"rgba(255,255,255,0.7)", margin:"0 0 8px" }}>{companyEmail}</p>}
            {company.address && <p style={{ fontSize:13, color:"rgba(255,255,255,0.5)", margin:"0 0 28px", lineHeight:1.6, whiteSpace:"pre-line" }}>{company.address}</p>}

            <div style={{ display:"flex", flexWrap:"wrap", gap:12, justifyContent:"center", marginBottom:20 }}>
              {companyPhone && (
                <a href={`tel:${companyPhone}`} className="qbtn" style={{ display:"inline-flex", alignItems:"center", gap:8, background:"linear-gradient(135deg,#6366f1,#8b5cf6)", color:"#fff", fontSize:14, fontWeight:700, padding:"13px 26px", borderRadius:100, textDecoration:"none", boxShadow:"0 8px 24px rgba(99,102,241,0.4)" }}>
                  📞 Call Now
                </a>
              )}
              {companyPhone && (
                <a href={`https://wa.me/${companyPhone.replace(/\D/g,"")}?text=${encodeURIComponent(`Hello, I'm interested in the travel quotation (${q.title || ""})`)}`} target="_blank" rel="noreferrer" className="qbtn" style={{ display:"inline-flex", alignItems:"center", gap:8, background:"linear-gradient(135deg,#22c55e,#16a34a)", color:"#fff", fontSize:14, fontWeight:700, padding:"13px 26px", borderRadius:100, textDecoration:"none", boxShadow:"0 8px 24px rgba(34,197,94,0.4)" }}>
                  💬 WhatsApp
                </a>
              )}
              {companyEmail && (
                <a href={`mailto:${companyEmail}?subject=${encodeURIComponent(`Quotation Inquiry (${q.title || ""})`)}`} className="qbtn" style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(255,255,255,0.12)", color:"#fff", fontSize:14, fontWeight:700, padding:"13px 26px", borderRadius:100, textDecoration:"none", border:"1px solid rgba(255,255,255,0.2)", backdropFilter:"blur(10px)" }}>
                  ✉️ Email
                </a>
              )}
              <a href={pdfUrl} target="_blank" rel="noreferrer" className="qbtn" style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(255,255,255,0.12)", color:"#fff", fontSize:14, fontWeight:700, padding:"13px 26px", borderRadius:100, textDecoration:"none", border:"1px solid rgba(255,255,255,0.2)", backdropFilter:"blur(10px)" }}>
                ⬇️ Download PDF
              </a>
            </div>

            <div style={{ height:1, background:"rgba(255,255,255,0.1)", margin:"28px 0 18px" }} />
            <p style={{ fontSize:12, color:"rgba(255,255,255,0.4)", margin:"0 0 5px" }}>
              © {new Date().getFullYear()} {company.name || "Travel Company"}. All rights reserved.
            </p>
            <p style={{ fontSize:11, color:"rgba(255,255,255,0.3)", margin:0 }}>
              {[company.since && `Since ${company.since}`, company.reviewsCount && `${company.reviewsCount} Reviews`, company.gst && `GST: ${company.gst}`].filter(Boolean).join(" · ")}
            </p>
            <p style={{ fontSize:11, color:"rgba(255,255,255,0.3)", margin:"6px 0 0" }}>
              Quote {q.quoteNo ? `#${q.quoteNo}` : "—"} · Generated {fmtDate(q.createdAt)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ━━━ HELPERS ━━━ */
function MiniDetail({ icon, label, val }) {
  return (
    <div>
      <p style={{ fontSize:9, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:".05em", margin:"0 0 3px" }}>{icon} {label}</p>
      <p style={{ fontSize:13, fontWeight:700, color:"#0f172a", margin:0, wordBreak:"break-word", overflowWrap:"anywhere" }}>{val}</p>
    </div>
  );
}
function PLine({ label, val, green, bold }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
      <span style={{ fontSize:14, color: bold?"#0f172a":"#64748b", fontWeight: bold?700:500 }}>{label}</span>
      <span style={{ fontSize:14, fontWeight:700, color: green ? "#16a34a" : "#0f172a" }}>{val}</span>
    </div>
  );
}


export function PublicQuotationPage() {
  const { publicId } = useParams();
  return <div className="min-h-screen"><QuotationWebView publicId={publicId} /></div>;
}