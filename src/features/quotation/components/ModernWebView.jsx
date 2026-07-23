// import { useEffect, useRef, useState } from "react";

// /* ════════════════════════════════════════════════════════════════
//    MODERN WEB VIEW — premium editorial template for the public
//    quotation weblink. Rendered by QuotationWebView when the DTO
//    carries templateStyle === "MODERN".

//    • Receives the already-fetched public DTO as `data` (never fetches).
//    • Self-contained: own <style> block + inline styles, no UI kits.
//    • Fonts: 'Fraunces' (editorial serif) + 'Outfit' (clean sans).
//    ════════════════════════════════════════════════════════════════ */

// /* ─── formatters (mirror Classic's guards) ─── */
// const inr = (v) => (v == null ? "—" : `₹${Number(v).toLocaleString("en-IN")}`);
// const fmtDate = (d) => {
//   if (!d) return "—";
//   try { return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
//   catch { return d; }
// };
// const fmtDateLong = (d) => {
//   if (!d) return "";
//   try { return new Date(d).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); }
//   catch { return d; }
// };
// const pad2 = (n) => String(n ?? "").padStart(2, "0");

// /* ─── image resolvers (same tolerant chain as Classic) ─── */
// const hotelImg = (h) => h.imageUrl || h.imagePath || h.image || h.photo || h.coverImage || h.hotelImage || h.img || (Array.isArray(h.images) && h.images[0]) || null;
// const actImg   = (a) => a.imagePath || a.imageUrl || a.image || a.photo || a.img || null;
// const vehImg   = (v) => v.imagePath || v.imageUrl || v.image || v.photo || v.img || null;

// /* ─── scroll-reveal (IntersectionObserver, respects reduced motion) ─── */
// function useReveal() {
//   const ref = useRef(null);
//   const [shown, setShown] = useState(false);
//   useEffect(() => {
//     const el = ref.current;
//     if (!el) return undefined;
//     const reduced = typeof window !== "undefined"
//       && window.matchMedia
//       && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
//     if (reduced || typeof IntersectionObserver === "undefined") { setShown(true); return undefined; }
//     const io = new IntersectionObserver(
//       (entries) => {
//         if (entries[0]?.isIntersecting) { setShown(true); io.disconnect(); }
//       },
//       { threshold: 0.1, rootMargin: "0px 0px -48px 0px" }
//     );
//     io.observe(el);
//     return () => io.disconnect();
//   }, []);
//   return [ref, shown];
// }

// function Reveal({ children, delay = 0, style }) {
//   const [ref, shown] = useReveal();
//   return (
//     <div ref={ref} className={`mv-reveal${shown ? " mv-in" : ""}`} style={{ transitionDelay: `${delay}ms`, ...style }}>
//       {children}
//     </div>
//   );
// }

// /* ─── small editorial building blocks ─── */
// function SectionHead({ kicker, title, sub }) {
//   return (
//     <header className="mv-shead">
//       {kicker && <p className="mv-kicker">{kicker}</p>}
//       <h2 className="mv-serif mv-stitle">{title}</h2>
//       {sub && <p className="mv-ssub">{sub}</p>}
//       <span className="mv-srule" aria-hidden="true" />
//     </header>
//   );
// }

// function Meta({ label, children }) {
//   return (
//     <div className="mv-meta">
//       <p className="mv-meta-l">{label}</p>
//       <p className="mv-meta-v">{children}</p>
//     </div>
//   );
// }

// function Stars({ count }) {
//   const n = Number(count) || 0;
//   if (n <= 0) return null;
//   return <span className="mv-stars" aria-label={`${n} star`}>{"★".repeat(Math.min(n, 7))}</span>;
// }

// function Tag({ children }) {
//   return <span className="mv-tag">{children}</span>;
// }

// function PriceRow({ label, value, minus, strong }) {
//   return (
//     <div className={`mv-prow${strong ? " mv-prow-strong" : ""}`}>
//       <span>{label}</span>
//       <span className={minus ? "mv-prow-minus" : ""}>{value}</span>
//     </div>
//   );
// }

// function Policy({ title, items, defaultOpen }) {
//   if (!items || items.length === 0) return null;
//   return (
//     <details className="mv-det" {...(defaultOpen ? { open: true } : {})}>
//       <summary>
//         <span className="mv-det-t">{title}</span>
//         <span className="mv-det-n">{items.length}</span>
//         <span className="mv-det-x" aria-hidden="true">+</span>
//       </summary>
//       <ol className="mv-det-list">
//         {items.map((it, i) => (
//           <li key={i}><span className="mv-det-i">{pad2(i + 1)}</span><span>{it}</span></li>
//         ))}
//       </ol>
//     </details>
//   );
// }

// /* ════════════════ MAIN ════════════════ */
// export default function ModernWebView({ data, pdfUrl }) {
//   const q = data || {};
//   const c = q.customer || {};
//   const company = q.company || q.organization || {};
//   const totals = q.totals || {};

//   const destStr = c.destination || (Array.isArray(q.destinations) ? q.destinations.join(" → ") : "") || "";
//   const heroPlace = destStr.split("→")[0]?.trim() || q.title || "Your Journey";
//   const preparedBy = q.preparedBy || q.createdByName || company.contactPerson || "";
//   const companyPhone = company.phone || company.contactNumber || q.companyPhone || "";
//   const companyEmail = company.email || q.companyEmail || "";

//   const grand = totals.grandTotal ?? q.grandTotal;
//   const perAdult = totals.perAdult ?? (grand && c.adults ? Math.round(grand / c.adults) : null);

//   const days      = q.sightseeing?.included && Array.isArray(q.sightseeing?.days)   ? q.sightseeing.days   : [];
//   const hotels    = q.hotel?.included       && Array.isArray(q.hotel?.hotels)       ? q.hotel.hotels       : [];
//   const segments  = q.flight?.included      && Array.isArray(q.flight?.segments)    ? q.flight.segments    : [];
//   const cruises   = q.cruise?.included      && Array.isArray(q.cruise?.cruises)     ? q.cruise.cruises     : [];
//   const vehicles  = q.vehicle?.included     && Array.isArray(q.vehicle?.vehicles)   ? q.vehicle.vehicles   : [];
//   // Add-ons me item-level `included` bhi hota hai — section ON ho par ek line OFF ho sakti hai.
//   // `== false` hi filter karo: null/undefined ka matlab "included" hai (builder aise rows likhta
//   // hai jinke baare me usne user se poocha hi nahi).
//   const addonItems = q.addons?.included     && Array.isArray(q.addons?.items)
//     ? q.addons.items.filter(a => a?.included !== false)
//     : [];
//   const testimonials = Array.isArray(q.testimonials) ? q.testimonials : Array.isArray(q.reviews) ? q.reviews : [];

//   const hasPricing = totals.subtotal != null || grand != null;
//   const hasPolicies = !!(q.inclusions?.length || q.exclusions?.length || q.paymentPolicies?.length || q.cancellationPolicies?.length || q.bookingTerms?.length);

//   const paxStr = [
//     c.adults   ? `${c.adults} Adult${c.adults > 1 ? "s" : ""}`      : "",
//     c.children ? `${c.children} Child${c.children > 1 ? "ren" : ""}` : "",
//     c.infants  ? `${c.infants} Infant${c.infants > 1 ? "s" : ""}`   : "",
//   ].filter(Boolean).join(" · ");

//   const navLinks = [
//     days.length     ? ["#itinerary", "Itinerary"] : null,
//     hotels.length   ? ["#stays", "Stays"]         : null,
//     segments.length ? ["#flights", "Flights"]     : null,
//     hasPricing      ? ["#pricing", "Pricing"]     : null,
//     ["#contact", "Contact"],
//   ].filter(Boolean);

//   /* reading-progress cue for the sticky bar */
//   const [prog, setProg] = useState(0);
//   useEffect(() => {
//     const onScroll = () => {
//       const el = document.documentElement;
//       const max = el.scrollHeight - el.clientHeight;
//       setProg(max > 0 ? Math.min(1, el.scrollTop / max) : 0);
//     };
//     onScroll();
//     window.addEventListener("scroll", onScroll, { passive: true });
//     return () => window.removeEventListener("scroll", onScroll);
//   }, []);

//   const waHref = companyPhone
//     ? `https://wa.me/${companyPhone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hello, I'm interested in the travel quotation (${q.title || ""})`)}`
//     : null;
//   const mailHref = companyEmail
//     ? `mailto:${companyEmail}?subject=${encodeURIComponent(`Quotation Inquiry (${q.title || ""})`)}`
//     : null;

//   return (
//     <div className="mvw">
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,300;1,9..144,400;1,9..144,500&family=Outfit:wght@300;400;500;600;700&display=swap');

//         html { scroll-behavior: smooth; }
//         html, body { margin: 0; padding: 0; background: #f5f1e8; overflow-x: hidden; max-width: 100%; }

//         .mvw {
//           --paper: #f5f1e8;
//           --panel: #fbf8f1;
//           --ink: #191611;
//           --soft: #55503f;
//           --muted: #8f886f;
//           --line: #ddd4be;
//           --accent: #9c5b33;
//           --accent-deep: #7a4325;
//           --forest: #47694f;
//           --rust: #a34a35;
//           font-family: 'Outfit', system-ui, sans-serif;
//           background: var(--paper);
//           color: var(--ink);
//           min-height: 100%;
//           overflow-x: hidden;
//           max-width: 100vw;
//           font-weight: 400;
//           line-height: 1.6;
//           -webkit-font-smoothing: antialiased;
//         }
//         .mvw, .mvw * { box-sizing: border-box; }
//         .mvw img { max-width: 100%; display: block; }
//         .mvw p, .mvw h1, .mvw h2, .mvw h3, .mvw span { overflow-wrap: break-word; word-break: break-word; }
//         .mv-serif { font-family: 'Fraunces', Georgia, serif; font-weight: 400; letter-spacing: -0.01em; }

//         /* ── reveal ── */
//         .mv-reveal { opacity: 0; transform: translateY(28px); transition: opacity .9s cubic-bezier(.16,1,.3,1), transform .9s cubic-bezier(.16,1,.3,1); will-change: opacity, transform; }
//         .mv-reveal.mv-in { opacity: 1; transform: translateY(0); }

//         /* ── sticky mini-nav ── */
//         .mv-nav { position: sticky; top: 0; z-index: 60; background: rgba(245,241,232,0.9); backdrop-filter: blur(14px) saturate(140%); -webkit-backdrop-filter: blur(14px) saturate(140%); border-bottom: 1px solid var(--line); }
//         .mv-prog { position: absolute; top: 0; left: 0; height: 2px; background: var(--accent); transition: width .15s linear; }
//         .mv-nav-in { max-width: 1120px; margin: 0 auto; padding: 13px 22px; display: flex; align-items: center; gap: 20px; }
//         .mv-brand { font-family: 'Fraunces', Georgia, serif; font-style: italic; font-size: 17px; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 46vw; }
//         .mv-nav-links { margin-left: auto; display: none; align-items: center; gap: 24px; }
//         .mv-nav-links a { font-size: 11px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: var(--soft); text-decoration: none; transition: color .2s; }
//         .mv-nav-links a:hover { color: var(--accent); }
//         .mv-nav-pdf { margin-left: auto; font-size: 11px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: var(--accent-deep); text-decoration: none; border: 1px solid var(--accent); border-radius: 100px; padding: 7px 16px; white-space: nowrap; transition: background .2s, color .2s; }
//         .mv-nav-pdf:hover { background: var(--accent); color: var(--paper); }
//         @media (min-width: 820px) {
//           .mv-nav-links { display: flex; }
//           .mv-nav-pdf { margin-left: 0; }
//         }

//         /* ── hero ── */
//         .mv-hero { position: relative; min-height: 100vh; min-height: 100svh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; overflow: hidden; padding: 96px 24px 110px; color: #f6f2e9; }
//         .mv-hero-media { position: absolute; inset: 0; }
//         .mv-hero-media img { width: 100%; height: 100%; object-fit: cover; }

//         .mv-hero-media::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(20,16,10,.52) 0%, rgba(20,16,10,.28) 42%, rgba(20,16,10,.78) 100%); }
//         .mv-hero-fallback { position: absolute; inset: 0; background: linear-gradient(158deg, #2a251b 0%, #38311f 46%, #17140d 100%); }
//         .mv-hero-fallback::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 70% 55% at 70% 18%, rgba(156,91,51,0.35), transparent 65%); }
//         .mv-hero-mark { position: absolute; right: -4vw; bottom: -14vh; font-family: 'Fraunces', Georgia, serif; font-style: italic; font-weight: 300; font-size: clamp(240px, 46vw, 560px); line-height: 1; color: rgba(246,242,233,0.05); pointer-events: none; user-select: none; }
//         .mv-hero-inner { position: relative; z-index: 2; max-width: 900px; }
//         .mv-hero-kicker { display: inline-flex; align-items: center; gap: 14px; font-size: 11px; font-weight: 600; letter-spacing: .3em; text-transform: uppercase; color: rgba(246,242,233,0.85); margin: 0 0 26px; }
//         .mv-hero-kicker::before, .mv-hero-kicker::after { content: ''; width: 34px; height: 1px; background: rgba(246,242,233,0.45); }
//         .mv-hero-title { font-size: clamp(52px, 11vw, 118px); line-height: 0.98; margin: 0; font-weight: 400; letter-spacing: -0.02em; }
//         .mv-hero-title em { font-style: italic; font-weight: 300; color: #e8c9a8; }
//         .mv-hero-sub { font-size: clamp(15px, 2.4vw, 19px); font-weight: 400; color: rgba(246,242,233,0.88); margin: 22px 0 0; letter-spacing: .01em; }
//         .mv-hero-meta { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px 0; margin: 34px auto 0; font-size: 13px; font-weight: 500; letter-spacing: .06em; text-transform: uppercase; color: rgba(246,242,233,0.75); }
//         .mv-hero-meta > span { padding: 0 18px; border-right: 1px solid rgba(246,242,233,0.28); }
//         .mv-hero-meta > span:last-child { border-right: none; }
//         .mv-hero-cue { position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%); z-index: 2; display: flex; flex-direction: column; align-items: center; gap: 10px; font-size: 10px; font-weight: 600; letter-spacing: .3em; text-transform: uppercase; color: rgba(246,242,233,0.65); }
//         .mv-hero-cue i { display: block; width: 1px; height: 44px; background: rgba(246,242,233,0.4); overflow: hidden; position: relative; }
//         .mv-hero-cue i::after { content: ''; position: absolute; left: 0; top: -50%; width: 1px; height: 50%; background: #e8c9a8; animation: mvDrop 2.1s cubic-bezier(.65,0,.35,1) infinite; }
//         @keyframes mvDrop { 0% { top: -50%; } 70%, 100% { top: 110%; } }

//         /* ── layout ── */
//         .mv-wrap { max-width: 1120px; margin: 0 auto; padding: 0 22px; }
//         .mv-section { padding: 86px 0 0; scroll-margin-top: 72px; }
//         .mv-section-last { padding-bottom: 96px; }
//         .mv-shead { margin-bottom: 46px; max-width: 640px; }
//         .mv-kicker { font-size: 11px; font-weight: 600; letter-spacing: .3em; text-transform: uppercase; color: var(--accent); margin: 0 0 12px; }
//         .mv-stitle { font-size: clamp(30px, 4.6vw, 46px); line-height: 1.06; margin: 0; color: var(--ink); }
//         .mv-ssub { font-size: 15px; color: var(--muted); margin: 12px 0 0; }
//         .mv-srule { display: block; width: 52px; height: 2px; background: var(--accent); margin-top: 22px; }

//         /* ── glance strip ── */
//         .mv-glance { border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); display: grid; grid-template-columns: repeat(2, 1fr); }
//         .mv-meta { padding: 22px 18px; border-right: 1px solid var(--line); }
//         .mv-meta:nth-child(2n) { border-right: none; }
//         .mv-meta:nth-child(n+3) { border-top: 1px solid var(--line); }
//         .mv-meta-l { font-size: 10px; font-weight: 600; letter-spacing: .22em; text-transform: uppercase; color: var(--muted); margin: 0 0 7px; }
//         .mv-meta-v { font-family: 'Fraunces', Georgia, serif; font-size: 18px; color: var(--ink); margin: 0; line-height: 1.3; }
//         @media (min-width: 760px) {
//           .mv-glance { grid-template-columns: repeat(6, 1fr); }
//           .mv-meta { border-top: none !important; }
//           .mv-meta:nth-child(2n) { border-right: 1px solid var(--line); }
//           .mv-meta:last-child { border-right: none; }
//         }

//         /* ── timeline ── */
//         .mv-tl { position: relative; padding-left: 34px; }
//         .mv-tl::before { content: ''; position: absolute; left: 5px; top: 8px; bottom: 8px; width: 1px; background: var(--line); }
//         .mv-tl-day { position: relative; padding-bottom: 58px; }
//         .mv-tl-day:last-child { padding-bottom: 6px; }
//         .mv-tl-day::before { content: ''; position: absolute; left: -33px; top: 7px; width: 11px; height: 11px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 5px var(--paper), 0 0 0 6px var(--line); }
//         .mv-daychip { display: inline-flex; align-items: baseline; gap: 8px; border: 1px solid var(--accent); color: var(--accent-deep); border-radius: 100px; padding: 5px 16px; font-size: 11px; font-weight: 700; letter-spacing: .22em; text-transform: uppercase; margin-bottom: 16px; background: var(--panel); }
//         .mv-tl-title { font-size: clamp(22px, 3.4vw, 30px); margin: 0 0 6px; line-height: 1.15; }
//         .mv-tl-date { font-size: 12.5px; font-weight: 500; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin: 0 0 20px; }
//         .mv-act { display: flex; gap: 22px; padding: 20px 0; border-top: 1px solid var(--line); }
//         .mv-act:first-of-type { border-top: none; padding-top: 4px; }
//         .mv-act-img { flex-shrink: 0; width: 190px; }
//         .mv-act-img img { width: 100%; aspect-ratio: 3 / 2; object-fit: cover; border-radius: 4px; }
//         .mv-act-name { font-size: 17px; font-weight: 600; color: var(--ink); margin: 0 0 8px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
//         .mv-time { font-size: 11px; font-weight: 600; letter-spacing: .08em; color: var(--accent-deep); border: 1px solid var(--line); background: var(--panel); border-radius: 100px; padding: 3px 11px; }
//         .mv-act-line { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 6px; }
//         .mv-act-line::before { content: ''; width: 14px; height: 1px; background: var(--accent); flex-shrink: 0; margin-top: 10px; }
//         .mv-act-line span { font-size: 14px; color: var(--soft); line-height: 1.65; }
//         .mv-tag { display: inline-block; font-size: 11px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: var(--soft); border: 1px solid var(--line); background: var(--panel); border-radius: 100px; padding: 5px 13px; margin: 8px 8px 0 0; }
//         .mv-overnight { display: inline-flex; align-items: center; gap: 9px; margin-top: 18px; font-size: 13px; font-weight: 600; color: var(--forest); border: 1px solid rgba(71,105,79,0.35); border-radius: 100px; padding: 8px 18px; background: rgba(71,105,79,0.07); }
//         .mv-overnight::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--forest); }
//         @media (max-width: 640px) {
//           .mv-act { flex-direction: column; gap: 14px; }
//           .mv-act-img { width: 100%; }
//         }

//         /* ── cards ── */
//         .mv-grid2 { display: grid; grid-template-columns: 1fr; gap: 28px; }
//         @media (min-width: 760px) { .mv-grid2 { grid-template-columns: repeat(2, 1fr); } }
//         .mv-card { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; overflow: hidden; transition: transform .45s cubic-bezier(.16,1,.3,1), box-shadow .45s ease; }
//         .mv-card:hover { transform: translateY(-5px); box-shadow: 0 26px 52px rgba(25,22,17,0.09); }
//         .mv-card-img { position: relative; aspect-ratio: 16 / 10; overflow: hidden; }
//         .mv-card-img img { width: 100%; height: 100%; object-fit: cover; transition: transform .8s cubic-bezier(.16,1,.3,1); }
//         .mv-card:hover .mv-card-img img { transform: scale(1.05); }
//         .mv-card-body { padding: 24px 26px 26px; }
//         .mv-card-title { font-size: 24px; margin: 0 0 4px; line-height: 1.15; }
//         .mv-card-sub { font-size: 12px; font-weight: 500; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin: 0 0 16px; }
//         .mv-stars { color: var(--accent); font-size: 14px; letter-spacing: 3px; }
//         .mv-kv { display: grid; grid-template-columns: 1fr 1fr; gap: 13px 18px; padding-top: 16px; border-top: 1px solid var(--line); }
//         .mv-kv-l { font-size: 10px; font-weight: 600; letter-spacing: .2em; text-transform: uppercase; color: var(--muted); margin: 0 0 3px; }
//         .mv-kv-v { font-size: 14px; font-weight: 500; color: var(--ink); margin: 0; }
//         .mv-note { font-size: 13px; color: var(--muted); font-style: italic; margin: 16px 0 0; border-left: 2px solid var(--line); padding-left: 14px; line-height: 1.6; }

//         /* ── flights ── */
//         .mv-flight { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 26px 28px; margin-bottom: 22px; }
//         .mv-flight-top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 22px; }
//         .mv-flight-air { font-size: 16px; font-weight: 600; color: var(--ink); }
//         .mv-chip { font-size: 10.5px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--accent-deep); border: 1px solid var(--accent); border-radius: 100px; padding: 4px 12px; }
//         .mv-route { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 18px; }
//         .mv-route-city { font-family: 'Fraunces', Georgia, serif; font-size: clamp(26px, 4.5vw, 38px); line-height: 1; color: var(--ink); margin: 0 0 6px; }
//         .mv-route-when { font-size: 12.5px; font-weight: 500; letter-spacing: .06em; color: var(--muted); margin: 0; text-transform: uppercase; }
//         .mv-route-mid { text-align: center; color: var(--muted); }
//         .mv-route-line { display: flex; align-items: center; gap: 6px; }
//         .mv-route-line::before, .mv-route-line::after { content: ''; width: clamp(20px, 6vw, 70px); height: 1px; background: var(--line); }
//         .mv-route-dur { font-size: 11px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; margin: 8px 0 0; }
//         .mv-conn { margin-top: 20px; padding-top: 16px; border-top: 1px dashed var(--line); }
//         .mv-conn p { font-size: 13.5px; color: var(--soft); margin: 0 0 7px; display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }
//         .mv-conn p::before { content: 'via'; font-size: 10px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; color: var(--accent); }
//         .mv-bag { margin-top: 16px; font-size: 12px; font-weight: 500; letter-spacing: .06em; color: var(--muted); text-transform: uppercase; }

//         /* ── addons list ── */
//         .mv-addon { display: flex; align-items: baseline; justify-content: space-between; gap: 18px; padding: 18px 4px; border-bottom: 1px solid var(--line); }
//         .mv-addon:first-child { border-top: 1px solid var(--line); }
//         .mv-addon-name { font-size: 16px; font-weight: 600; color: var(--ink); margin: 0 0 3px; }
//         .mv-addon-desc { font-size: 13.5px; color: var(--muted); margin: 0; }
//         .mv-addon-qty { font-family: 'Fraunces', Georgia, serif; font-size: 15px; color: var(--soft); white-space: nowrap; }

//         /* ── pricing ── */
//         .mv-price { max-width: 620px; }
//         .mv-prow { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding: 13px 2px; border-bottom: 1px solid var(--line); font-size: 14.5px; color: var(--soft); }
//         .mv-prow span:last-child { font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; }
//         .mv-prow-strong { font-weight: 600; color: var(--ink); }
//         .mv-prow-minus { color: var(--forest) !important; }
//         .mv-grand { margin-top: 30px; background: var(--ink); color: #f6f2e9; border-radius: 6px; padding: 34px 32px; display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 18px; position: relative; overflow: hidden; }
//         .mv-grand::after { content: ''; position: absolute; right: -60px; top: -60px; width: 200px; height: 200px; border-radius: 50%; border: 1px solid rgba(246,242,233,0.12); }
//         .mv-grand-l { font-size: 11px; font-weight: 600; letter-spacing: .28em; text-transform: uppercase; color: rgba(246,242,233,0.6); margin: 0 0 10px; }
//         .mv-grand-v { font-family: 'Fraunces', Georgia, serif; font-size: clamp(40px, 8vw, 62px); line-height: 1; margin: 0; }
//         .mv-grand-note { font-size: 12.5px; color: rgba(246,242,233,0.65); margin: 10px 0 0; }
//         .mv-grand-per { text-align: right; }
//         .mv-grand-per p { margin: 0; }
//         .mv-grand-per .n { font-family: 'Fraunces', Georgia, serif; font-size: 22px; color: #e8c9a8; }
//         .mv-grand-per .l { font-size: 11px; font-weight: 600; letter-spacing: .18em; text-transform: uppercase; color: rgba(246,242,233,0.55); margin-top: 4px; }

//         /* ── inclusions / exclusions ── */
//         .mv-ie { display: grid; grid-template-columns: 1fr; gap: 40px; }
//         @media (min-width: 760px) { .mv-ie { grid-template-columns: 1fr 1fr; } }
//         .mv-ie h3 { font-size: 13px; font-weight: 700; letter-spacing: .22em; text-transform: uppercase; margin: 0 0 18px; padding-bottom: 12px; border-bottom: 1px solid var(--line); }
//         .mv-ie-inc h3 { color: var(--forest); }
//         .mv-ie-exc h3 { color: var(--rust); }
//         .mv-ie li { list-style: none; display: flex; gap: 12px; align-items: flex-start; font-size: 14.5px; color: var(--soft); line-height: 1.65; margin-bottom: 11px; }
//         .mv-ie ul { margin: 0; padding: 0; }
//         .mv-ie-inc li::before { content: '+'; color: var(--forest); font-weight: 700; flex-shrink: 0; font-size: 15px; line-height: 1.55; }
//         .mv-ie-exc li::before { content: '−'; color: var(--rust); font-weight: 700; flex-shrink: 0; font-size: 15px; line-height: 1.55; }

//         /* ── collapsible policies ── */
//         .mv-det { border-top: 1px solid var(--line); }
//         .mv-det:last-of-type { border-bottom: 1px solid var(--line); }
//         .mv-det summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 14px; padding: 20px 4px; user-select: none; }
//         .mv-det summary::-webkit-details-marker { display: none; }
//         .mv-det-t { font-size: 15px; font-weight: 600; color: var(--ink); }
//         .mv-det-n { font-size: 11px; font-weight: 700; color: var(--accent-deep); border: 1px solid var(--line); border-radius: 100px; padding: 2px 10px; background: var(--panel); }
//         .mv-det-x { margin-left: auto; font-family: 'Fraunces', Georgia, serif; font-size: 22px; font-weight: 300; color: var(--accent); transition: transform .35s cubic-bezier(.16,1,.3,1); line-height: 1; }
//         .mv-det[open] .mv-det-x { transform: rotate(45deg); }
//         .mv-det-list { margin: 0; padding: 2px 4px 24px; }
//         .mv-det-list li { list-style: none; display: flex; gap: 14px; align-items: flex-start; font-size: 14px; color: var(--soft); line-height: 1.7; margin-bottom: 10px; }
//         .mv-det-i { font-size: 11px; font-weight: 700; color: var(--accent); min-width: 20px; padding-top: 3px; letter-spacing: .05em; }

//         /* ── testimonials ── */
//         .mv-quote { border-left: 2px solid var(--accent); padding: 4px 0 4px 24px; }
//         .mv-quote-text { font-family: 'Fraunces', Georgia, serif; font-style: italic; font-size: 18px; line-height: 1.55; color: var(--ink); margin: 0 0 14px; }
//         .mv-quote-name { font-size: 12px; font-weight: 600; letter-spacing: .18em; text-transform: uppercase; color: var(--muted); margin: 0; }

//         /* ── footer / contact ── */
//         .mv-foot { margin-top: 96px; background: var(--ink); color: #f6f2e9; padding: 84px 22px 46px; text-align: center; position: relative; overflow: hidden; scroll-margin-top: 72px; }
//         .mv-foot::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 62% 48% at 50% 0%, rgba(156,91,51,0.28), transparent 68%); pointer-events: none; }
//         .mv-foot-in { position: relative; max-width: 640px; margin: 0 auto; }
//         .mv-foot-logo { max-height: 62px; margin: 0 auto 22px; border-radius: 4px; }
//         .mv-foot-name { font-size: clamp(28px, 5vw, 40px); margin: 0 0 8px; }
//         .mv-foot-by { font-size: 13px; letter-spacing: .1em; text-transform: uppercase; color: rgba(246,242,233,0.6); margin: 0 0 26px; }
//         .mv-foot-contact { font-size: 15px; color: rgba(246,242,233,0.85); margin: 0 0 4px; }
//         .mv-foot-addr { font-size: 13px; color: rgba(246,242,233,0.5); white-space: pre-line; line-height: 1.7; margin: 14px 0 0; }
//         .mv-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin: 36px 0 0; }
//         .mv-btn { display: inline-flex; align-items: center; gap: 8px; font-family: 'Outfit', system-ui, sans-serif; font-size: 12px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; text-decoration: none; border-radius: 100px; padding: 15px 30px; transition: transform .25s cubic-bezier(.16,1,.3,1), background .25s, color .25s; }
//         .mv-btn:hover { transform: translateY(-2px); }
//         .mv-btn-solid { background: var(--accent); color: #f6f2e9; }
//         .mv-btn-solid:hover { background: var(--accent-deep); }
//         .mv-btn-ghost { border: 1px solid rgba(246,242,233,0.35); color: #f6f2e9; }
//         .mv-btn-ghost:hover { border-color: #e8c9a8; color: #e8c9a8; }
//         .mv-foot-rule { height: 1px; background: rgba(246,242,233,0.14); margin: 48px 0 22px; }
//         .mv-fine { font-size: 11.5px; color: rgba(246,242,233,0.42); margin: 0 0 6px; letter-spacing: .04em; }

//         /* ── reduced motion ── */
//         @media (prefers-reduced-motion: reduce) {
//           html { scroll-behavior: auto; }
//           .mvw *, .mvw *::before, .mvw *::after { animation: none !important; transition: none !important; }
//           .mv-reveal { opacity: 1 !important; transform: none !important; }
//         }
//       `}</style>

//       {/* ━━━ STICKY MINI-NAV + PROGRESS ━━━ */}
//       <nav className="mv-nav">
//         <span className="mv-prog" style={{ width: `${prog * 100}%` }} aria-hidden="true" />
//         <div className="mv-nav-in">
//           <span className="mv-brand">{company.name || q.title || "Travel Itinerary"}</span>
//           <div className="mv-nav-links">
//             {navLinks.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
//           </div>
//           <a className="mv-nav-pdf" href={pdfUrl} target="_blank" rel="noreferrer">PDF</a>
//         </div>
//       </nav>

//       {/* ━━━ HERO ━━━ */}
//       <header className="mv-hero">
//         {q.coverImageUrl ? (
//           <div className="mv-hero-media"><img src={q.coverImageUrl} alt="" /></div>
//         ) : (
//           <div className="mv-hero-fallback">
//             <span className="mv-hero-mark mv-serif" aria-hidden="true">{(heroPlace || "T").charAt(0)}</span>
//           </div>
//         )}
//         <div className="mv-hero-inner">
//           <p className="mv-hero-kicker">Private Itinerary{q.quoteNo ? ` · No. ${q.quoteNo}` : ""}</p>
//           <h1 className="mv-serif mv-hero-title">
//             {heroPlace}{q.nights != null ? <em>, {q.nights} nights</em> : null}
//           </h1>
//           {q.title && <p className="mv-hero-sub">{q.title}</p>}
//           <div className="mv-hero-meta">
//             {c.travelDate && <span>{fmtDate(c.travelDate)}</span>}
//             <span>{q.nights ?? "—"}N / {q.days ?? "—"}D</span>
//             {paxStr && <span>{paxStr}</span>}
//             {destStr && <span>{destStr}</span>}
//           </div>
//         </div>
//         <div className="mv-hero-cue" aria-hidden="true"><i /><span>Scroll</span></div>
//       </header>

//       {/* ━━━ AT A GLANCE ━━━ */}
//       <div className="mv-wrap">
//         <section className="mv-section" id="overview" style={{ paddingTop: 64 }}>
//           <Reveal>
//             <div className="mv-glance">
//               <Meta label="Traveler">{c.name || "—"}</Meta>
//               <Meta label="Travel Date">{fmtDate(c.travelDate)}</Meta>
//               <Meta label="Duration">{q.nights ?? "—"}N / {q.days ?? "—"}D</Meta>
//               <Meta label="Guests">{paxStr || "—"}</Meta>
//               <Meta label="Rooms">{q.rooms || c.rooms || "—"}</Meta>
//               <Meta label="Prepared By">{preparedBy || company.name || "—"}</Meta>
//             </div>
//           </Reveal>
//         </section>

//         {/* ━━━ ITINERARY TIMELINE ━━━ */}
//         {days.length > 0 && (
//           <section className="mv-section" id="itinerary">
//             <Reveal>
//               <SectionHead kicker="The Journey" title="Day by day" sub="A considered route, one day at a time." />
//             </Reveal>
//             <div className="mv-tl">
//               {days.map((d, i) => {
//                 const firstAct = (d.activities || [])[0] || {};
//                 return (
//                   <Reveal key={i} delay={Math.min(i * 60, 240)}>
//                     <article className="mv-tl-day">
//                       <span className="mv-daychip">Day {pad2(d.day)}</span>
//                       <h3 className="mv-serif mv-tl-title">{firstAct.attraction || d.title || `Day ${d.day}`}</h3>
//                       <p className="mv-tl-date">
//                         {[d.location || firstAct.city, d.date ? fmtDateLong(d.date) : ""].filter(Boolean).join("  ·  ") || " "}
//                       </p>
//                       {(d.activities || []).map((a, j) => {
//                         const img = actImg(a);
//                         const meals = Array.isArray(a.meals) ? a.meals.filter(Boolean) : [];
//                         const rawDesc = (a.description || "").trim();
//                         let points = [];
//                         if (rawDesc) {
//                           points = (/\n|\r/.test(rawDesc) ? rawDesc.split(/\n|\r/) : rawDesc.split(/\.(?:\s+|$)/))
//                             .map((s) => s.replace(/^[-*•\s]+/, "").trim()).filter(Boolean);
//                         }
//                         return (
//                           <div key={j} className="mv-act">
//                             {img && (
//                               <div className="mv-act-img">
//                                 <img src={img} alt={a.attraction || ""} onError={(e) => { e.target.parentElement.style.display = "none"; }} />
//                               </div>
//                             )}
//                             <div style={{ minWidth: 0, flex: 1 }}>
//                               <p className="mv-act-name">
//                                 {a.attraction}
//                                 {a.startTime && <span className="mv-time">{a.startTime}</span>}
//                               </p>
//                               {points.map((line, li) => (
//                                 <div key={li} className="mv-act-line"><span>{line}</span></div>
//                               ))}
//                               <div>
//                                 {a.transfer && <Tag>{a.transfer} transfer</Tag>}
//                                 {meals.length > 0 && <Tag>{meals.join(", ")}</Tag>}
//                               </div>
//                             </div>
//                           </div>
//                         );
//                       })}
//                       {d.overnightStay && <span className="mv-overnight">Overnight — {d.overnightStay}</span>}
//                     </article>
//                   </Reveal>
//                 );
//               })}
//             </div>
//           </section>
//         )}

//         {/* ━━━ HOTELS ━━━ */}
//         {hotels.length > 0 && (
//           <section className="mv-section" id="stays">
//             <Reveal>
//               <SectionHead kicker="The Stays" title="Where you'll rest" sub="Handpicked for comfort and character." />
//             </Reveal>
//             <div className="mv-grid2">
//               {hotels.map((h, i) => {
//                 const img = hotelImg(h);
//                 return (
//                   <Reveal key={i} delay={Math.min(i * 80, 240)}>
//                     <article className="mv-card">
//                       {img && (
//                         <div className="mv-card-img">
//                           <img src={img} alt={h.name || ""} onError={(e) => { e.target.parentElement.style.display = "none"; }} />
//                         </div>
//                       )}
//                       <div className="mv-card-body">
//                         <h3 className="mv-serif mv-card-title">{h.name}</h3>
//                         <p className="mv-card-sub">
//                           {[h.city, h.country].filter(Boolean).join(", ") || " "}
//                           {h.stars > 0 && <>{"  "}<Stars count={h.stars} /></>}
//                         </p>
//                         <div className="mv-kv">
//                           {h.roomType && <div><p className="mv-kv-l">Room</p><p className="mv-kv-v">{h.roomType}</p></div>}
//                           {h.mealPlan && <div><p className="mv-kv-l">Meals</p><p className="mv-kv-v">{h.mealPlan}</p></div>}
//                           {h.rooms ? <div><p className="mv-kv-l">Rooms</p><p className="mv-kv-v">{h.rooms}</p></div> : null}
//                           <div><p className="mv-kv-l">Check-in</p><p className="mv-kv-v">{fmtDate(h.checkIn)}</p></div>
//                           <div><p className="mv-kv-l">Check-out</p><p className="mv-kv-v">{fmtDate(h.checkOut)}</p></div>
//                         </div>
//                       </div>
//                     </article>
//                   </Reveal>
//                 );
//               })}
//             </div>
//           </section>
//         )}

//         {/* ━━━ FLIGHTS ━━━ */}
//         {segments.length > 0 && (
//           <section className="mv-section" id="flights">
//             <Reveal>
//               <SectionHead kicker="The Flights" title="Getting you there" sub={q.flight?.journey || undefined} />
//             </Reveal>
//             {segments.map((seg, i) => (
//               <Reveal key={i} delay={Math.min(i * 80, 240)}>
//                 <article className="mv-flight">
//                   <div className="mv-flight-top">
//                     {seg.airline && <span className="mv-flight-air">{seg.airline}</span>}
//                     {seg.flightNo && <span className="mv-chip">{seg.flightNo}</span>}
//                     {seg.class && <span className="mv-chip">{seg.class}</span>}
//                   </div>
//                   <div className="mv-route">
//                     <div>
//                       <p className="mv-serif mv-route-city">{seg.from || "—"}</p>
//                       <p className="mv-route-when">{[seg.depTime, fmtDate(seg.depDate)].filter(Boolean).join(" · ")}</p>
//                     </div>
//                     <div className="mv-route-mid">
//                       <div className="mv-route-line">
//                         <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
//                           <path d="M21 12 L3 12 M21 12 L15 6 M21 12 L15 18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
//                         </svg>
//                       </div>
//                       {seg.duration && <p className="mv-route-dur">{seg.duration}</p>}
//                     </div>
//                     <div style={{ textAlign: "right" }}>
//                       <p className="mv-serif mv-route-city">{seg.to || "—"}</p>
//                       <p className="mv-route-when">{[seg.arrTime, fmtDate(seg.arrDate)].filter(Boolean).join(" · ")}</p>
//                     </div>
//                   </div>
//                   {(seg.cabin > 0 || seg.checkin > 0) && (
//                     <p className="mv-bag">
//                       {[seg.cabin > 0 ? `Cabin ${seg.cabin}kg` : "", seg.checkin > 0 ? `Check-in ${seg.checkin}kg` : ""].filter(Boolean).join("  ·  ")}
//                     </p>
//                   )}
//                   {Array.isArray(seg.connections) && seg.connections.length > 0 && (
//                     <div className="mv-conn">
//                       {seg.connections.map((cn, k) => (
//                         <p key={k}>
//                           <span>
//                             {[cn.airline, cn.flightNo].filter(Boolean).join(" ")}
//                             {(cn.from || cn.to) && ` — ${cn.from || "?"} to ${cn.to || "?"}`}
//                             {(cn.depTime || cn.arrTime) && ` (${[cn.depTime, cn.arrTime].filter(Boolean).join(" – ")})`}
//                           </span>
//                         </p>
//                       ))}
//                     </div>
//                   )}
//                 </article>
//               </Reveal>
//             ))}
//           </section>
//         )}

//         {/* ━━━ CRUISE ━━━ */}
//         {cruises.length > 0 && (
//           <section className="mv-section" id="cruise">
//             <Reveal>
//               <SectionHead kicker="The Voyage" title="Time at sea" />
//             </Reveal>
//             <div className="mv-grid2">
//               {cruises.map((cr, i) => (
//                 <Reveal key={i} delay={Math.min(i * 80, 240)}>
//                   <article className="mv-card">
//                     <div className="mv-card-body">
//                       <h3 className="mv-serif mv-card-title">{cr.name || "Cruise"}</h3>
//                       <p className="mv-card-sub">{cr.type || " "}</p>
//                       <div className="mv-kv">
//                         {(cr.depPort || cr.arrPort) && (
//                           <div style={{ gridColumn: "1 / -1" }}>
//                             <p className="mv-kv-l">Route</p>
//                             <p className="mv-kv-v">{[cr.depPort, cr.arrPort].filter(Boolean).join(" → ")}</p>
//                           </div>
//                         )}
//                         {cr.depDate && <div><p className="mv-kv-l">Departure</p><p className="mv-kv-v">{fmtDate(cr.depDate)}</p></div>}
//                         {cr.nights ? <div><p className="mv-kv-l">Nights</p><p className="mv-kv-v">{cr.nights}</p></div> : null}
//                         {cr.cabin && <div><p className="mv-kv-l">Cabin</p><p className="mv-kv-v">{cr.cabin}</p></div>}
//                       </div>
//                     </div>
//                   </article>
//                 </Reveal>
//               ))}
//             </div>
//           </section>
//         )}

//         {/* ━━━ TRANSPORT ━━━ */}
//         {vehicles.length > 0 && (
//           <section className="mv-section" id="transport">
//             <Reveal>
//               <SectionHead kicker="On the Ground" title="Your transport" />
//             </Reveal>
//             <div className="mv-grid2">
//               {vehicles.map((v, i) => {
//                 const img = vehImg(v);
//                 return (
//                   <Reveal key={i} delay={Math.min(i * 80, 240)}>
//                     <article className="mv-card">
//                       {img && (
//                         <div className="mv-card-img">
//                           <img src={img} alt={v.model || v.type || ""} onError={(e) => { e.target.parentElement.style.display = "none"; }} />
//                         </div>
//                       )}
//                       <div className="mv-card-body">
//                         <h3 className="mv-serif mv-card-title">{v.model || v.type || "Vehicle"}</h3>
//                         <p className="mv-card-sub">{v.model && v.type ? v.type : " "}</p>
//                         <div className="mv-kv">
//                           {(v.pickup || v.drop) && (
//                             <div style={{ gridColumn: "1 / -1" }}>
//                               <p className="mv-kv-l">Route</p>
//                               <p className="mv-kv-v">{[v.pickup, v.drop].filter(Boolean).join(" → ")}</p>
//                             </div>
//                           )}
//                           {(v.startDate || v.endDate) && (
//                             <div><p className="mv-kv-l">Dates</p><p className="mv-kv-v">{fmtDate(v.startDate)}{v.endDate ? ` → ${fmtDate(v.endDate)}` : ""}</p></div>
//                           )}
//                           {v.capacity ? <div><p className="mv-kv-l">Seats</p><p className="mv-kv-v">{v.capacity}</p></div> : null}
//                           {v.qty ? <div><p className="mv-kv-l">Vehicles</p><p className="mv-kv-v">{v.qty}</p></div> : null}
//                         </div>
//                         {v.notes && <p className="mv-note">{v.notes}</p>}
//                       </div>
//                     </article>
//                   </Reveal>
//                 );
//               })}
//             </div>
//           </section>
//         )}

//         {/* ━━━ ADD-ONS ━━━ */}
//         {addonItems.length > 0 && (
//           <section className="mv-section" id="addons">
//             <Reveal>
//               <SectionHead kicker="The Extras" title="Thoughtful additions" />
//             </Reveal>
//             <Reveal>
//               <div style={{ maxWidth: 720 }}>
//                 {addonItems.map((a, i) => (
//                   <div key={i} className="mv-addon">
//                     <div style={{ minWidth: 0 }}>
//                       <p className="mv-addon-name">{a.serviceType || "Service"}</p>
//                       {a.description && <p className="mv-addon-desc">{a.description}</p>}
//                     </div>
//                     {a.quantity ? <span className="mv-addon-qty">× {a.quantity}</span> : null}
//                   </div>
//                 ))}
//               </div>
//             </Reveal>
//           </section>
//         )}

//         {/* ━━━ TESTIMONIALS ━━━ */}
//         {testimonials.length > 0 && (
//           <section className="mv-section" id="words">
//             <Reveal>
//               <SectionHead kicker="Kind Words" title="From fellow travelers" />
//             </Reveal>
//             <div className="mv-grid2">
//               {testimonials.map((t, i) => {
//                 const name = t.name || t.customerName || "Guest";
//                 const text = t.review || t.text || t.comment || "";
//                 if (!text) return null;
//                 return (
//                   <Reveal key={i} delay={Math.min(i * 80, 240)}>
//                     <blockquote className="mv-quote" style={{ margin: 0 }}>
//                       <p className="mv-quote-text">“{text}”</p>
//                       <p className="mv-quote-name">
//                         {name}{t.trip ? ` — ${t.trip}` : ""}
//                         {(t.rating || t.stars) ? <>{"  "}<Stars count={t.rating || t.stars} /></> : null}
//                       </p>
//                     </blockquote>
//                   </Reveal>
//                 );
//               })}
//             </div>
//           </section>
//         )}

//         {/* ━━━ PRICING ━━━ */}
//         {hasPricing && (
//           <section className="mv-section" id="pricing">
//             <Reveal>
//               <SectionHead kicker="The Investment" title="Transparent pricing" sub="Every rupee accounted for. No surprises." />
//             </Reveal>
//             <Reveal>
//               <div className="mv-price">
//                 {/* Per-section amounts live on the SECTION objects (flight.amount, hotel.amount, …) —
//                     the public Totals carries only subtotal/discount/tax/grandTotal/addonsTotal/perAdult.
//                     The totals.flightAmount-style fields this originally read DO NOT EXIST on the wire,
//                     so every one of these rows silently vanished against the real API. */}
//                 {q.flight?.included      && q.flight.amount      > 0 && <PriceRow label="Flights"     value={inr(q.flight.amount)} />}
//                 {q.hotel?.included       && q.hotel.amount       > 0 && <PriceRow label="Hotels"      value={inr(q.hotel.amount)} />}
//                 {q.sightseeing?.included && q.sightseeing.amount > 0 && <PriceRow label="Sightseeing" value={inr(q.sightseeing.amount)} />}
//                 {q.cruise?.included      && q.cruise.amount      > 0 && <PriceRow label="Cruise"      value={inr(q.cruise.amount)} />}
//                 {q.vehicle?.included     && q.vehicle.amount     > 0 && <PriceRow label="Transport"   value={inr(q.vehicle.amount)} />}
//                 {q.addons?.included      && q.addons.amount      > 0 && <PriceRow label="Add-ons"     value={inr(q.addons.amount)} />}
//                 {totals.subtotal != null       && <PriceRow label="Subtotal"    value={inr(totals.subtotal)} strong />}
//                 {totals.discountAmount    > 0 && <PriceRow label="Discount"     value={`− ${inr(totals.discountAmount)}`} minus />}
//                 {/* NO markup row, ever. The public DTO deliberately omits markup because it is the
//                     agency's margin — this is the customer-facing page. Do not re-add it. */}
//                 {totals.taxAmount         > 0 && <PriceRow label={`Tax (${totals.taxPercent || 0}%)`} value={inr(totals.taxAmount)} />}

//                 <div className="mv-grand">
//                   <div>
//                     <p className="mv-grand-l">Grand Total</p>
//                     <p className="mv-grand-v">{inr(grand)}</p>
//                     <p className="mv-grand-note">Inclusive of all taxes</p>
//                   </div>
//                   {perAdult && c.adults ? (
//                     <div className="mv-grand-per">
//                       <p className="n">{inr(perAdult)}</p>
//                       <p className="l">per adult · {c.adults} adults</p>
//                     </div>
//                   ) : null}
//                 </div>
//               </div>
//             </Reveal>
//           </section>
//         )}

//         {/* ━━━ INCLUSIONS / EXCLUSIONS + POLICIES ━━━ */}
//         {hasPolicies && (
//           <section className="mv-section mv-section-last" id="policies">
//             <Reveal>
//               <SectionHead kicker="The Fine Print" title="Good to know" />
//             </Reveal>
//             {(q.inclusions?.length || q.exclusions?.length) ? (
//               <Reveal>
//                 <div className="mv-ie" style={{ marginBottom: 52 }}>
//                   {q.inclusions?.length > 0 && (
//                     <div className="mv-ie-inc">
//                       <h3>Included</h3>
//                       <ul>{q.inclusions.map((it, i) => <li key={i}><span>{it}</span></li>)}</ul>
//                     </div>
//                   )}
//                   {q.exclusions?.length > 0 && (
//                     <div className="mv-ie-exc">
//                       <h3>Not Included</h3>
//                       <ul>{q.exclusions.map((it, i) => <li key={i}><span>{it}</span></li>)}</ul>
//                     </div>
//                   )}
//                 </div>
//               </Reveal>
//             ) : null}
//             <Reveal>
//               <div style={{ maxWidth: 760 }}>
//                 <Policy title="Payment Policy"      items={q.paymentPolicies} />
//                 <Policy title="Cancellation Policy" items={q.cancellationPolicies} />
//                 <Policy title="Booking Terms"       items={q.bookingTerms} />
//               </div>
//             </Reveal>
//           </section>
//         )}
//       </div>

//       {/* ━━━ CONTACT / FOOTER ━━━ */}
//       <footer className="mv-foot" id="contact">
//         <div className="mv-foot-in">
//           {(company.logo || company.logoUrl) && (
//             <img className="mv-foot-logo" src={company.logo || company.logoUrl} alt={company.name || ""} />
//           )}
//           <h2 className="mv-serif mv-foot-name">{company.name || "Ready when you are"}</h2>
//           {preparedBy && <p className="mv-foot-by">Your travel expert — {preparedBy}</p>}
//           {companyPhone && <p className="mv-foot-contact">{companyPhone}</p>}
//           {companyEmail && <p className="mv-foot-contact">{companyEmail}</p>}
//           {company.address && <p className="mv-foot-addr">{company.address}</p>}

//           <div className="mv-actions">
//             {companyPhone && <a className="mv-btn mv-btn-solid" href={`tel:${companyPhone}`}>Call Now</a>}
//             {waHref && <a className="mv-btn mv-btn-ghost" href={waHref} target="_blank" rel="noreferrer">WhatsApp</a>}
//             {mailHref && <a className="mv-btn mv-btn-ghost" href={mailHref}>Email</a>}
//             <a className="mv-btn mv-btn-ghost" href={pdfUrl} target="_blank" rel="noreferrer">Download PDF</a>
//           </div>

//           <div className="mv-foot-rule" />
//           <p className="mv-fine">© {new Date().getFullYear()} {company.name || "Travel Company"}. All rights reserved.</p>
//           <p className="mv-fine">
//             {[company.since && `Since ${company.since}`, company.reviewsCount && `${company.reviewsCount} Reviews`, company.gst && `GST: ${company.gst}`].filter(Boolean).join(" · ")}
//           </p>
//           <p className="mv-fine">Quote {q.quoteNo ? `#${q.quoteNo}` : "—"} · Generated {fmtDate(q.createdAt)}</p>
//         </div>
//       </footer>
//     </div>
//   );
// }








import { useEffect, useRef, useState } from "react";

/* ════════════════════════════════════════════════════════════════
   MODERN WEB VIEW — premium editorial template for the public
   quotation weblink. Rendered by QuotationWebView when the DTO
   carries templateStyle === "MODERN".

   • Receives the already-fetched public DTO as `data` (never fetches).
   • Self-contained: own <style> block + inline styles, no UI kits.
   • Fonts: 'Fraunces' (editorial serif) + 'Outfit' (clean sans).
   ════════════════════════════════════════════════════════════════ */

/* ─── formatters (mirror Classic's guards) ─── */
const inr = (v) => (v == null ? "—" : `₹${Number(v).toLocaleString("en-IN")}`);
const fmtDate = (d) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
};
const fmtDateLong = (d) => {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); }
  catch { return d; }
};
const pad2 = (n) => String(n ?? "").padStart(2, "0");

/* ─── image resolvers (same tolerant chain as Classic) ─── */
const hotelImg = (h) => h.imageUrl || h.imagePath || h.image || h.photo || h.coverImage || h.hotelImage || h.img || (Array.isArray(h.images) && h.images[0]) || null;
const actImg   = (a) => a.imagePath || a.imageUrl || a.image || a.photo || a.img || null;
const vehImg   = (v) => v.imagePath || v.imageUrl || v.image || v.photo || v.img || null;

/* ─── scroll-reveal (IntersectionObserver, respects reduced motion) ─── */
function useReveal() {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const reduced = typeof window !== "undefined"
      && window.matchMedia
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof IntersectionObserver === "undefined") { setShown(true); return undefined; }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) { setShown(true); io.disconnect(); }
      },
      { threshold: 0.1, rootMargin: "0px 0px -48px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, shown];
}

function Reveal({ children, delay = 0, style }) {
  const [ref, shown] = useReveal();
  return (
    <div ref={ref} className={`mv-reveal${shown ? " mv-in" : ""}`} style={{ transitionDelay: `${delay}ms`, ...style }}>
      {children}
    </div>
  );
}

/* ─── small editorial building blocks ─── */
function SectionHead({ kicker, title, sub }) {
  return (
    <header className="mv-shead">
      {kicker && <p className="mv-kicker">{kicker}</p>}
      <h2 className="mv-serif mv-stitle">{title}</h2>
      {sub && <p className="mv-ssub">{sub}</p>}
      <span className="mv-srule" aria-hidden="true" />
    </header>
  );
}

function Meta({ label, children }) {
  return (
    <div className="mv-meta">
      <p className="mv-meta-l">{label}</p>
      <p className="mv-meta-v">{children}</p>
    </div>
  );
}

function Stars({ count }) {
  const n = Number(count) || 0;
  if (n <= 0) return null;
  return <span className="mv-stars" aria-label={`${n} star`}>{"★".repeat(Math.min(n, 7))}</span>;
}

function Tag({ children }) {
  return <span className="mv-tag">{children}</span>;
}

function PriceRow({ label, value, minus, strong }) {
  return (
    <div className={`mv-prow${strong ? " mv-prow-strong" : ""}`}>
      <span>{label}</span>
      <span className={minus ? "mv-prow-minus" : ""}>{value}</span>
    </div>
  );
}

function Policy({ title, items, defaultOpen }) {
  if (!items || items.length === 0) return null;
  return (
    <details className="mv-det" {...(defaultOpen ? { open: true } : {})}>
      <summary>
        <span className="mv-det-t">{title}</span>
        <span className="mv-det-n">{items.length}</span>
        <span className="mv-det-x" aria-hidden="true">+</span>
      </summary>
      <ol className="mv-det-list">
        {items.map((it, i) => (
          <li key={i}><span className="mv-det-i">{pad2(i + 1)}</span><span>{it}</span></li>
        ))}
      </ol>
    </details>
  );
}

/* ════════════════ MAIN ════════════════ */
export default function ModernWebView({ data, pdfUrl }) {
  const q = data || {};
  const c = q.customer || {};
  const company = q.company || q.organization || {};
  const totals = q.totals || {};

  const destStr = c.destination || (Array.isArray(q.destinations) ? q.destinations.join(" → ") : "") || "";
  const heroPlace = destStr.split("→")[0]?.trim() || q.title || "Your Journey";
  const preparedBy = q.preparedBy || q.createdByName || company.contactPerson || "";
  const companyPhone = company.phone || company.contactNumber || q.companyPhone || "";
  const companyEmail = company.email || q.companyEmail || "";

  const grand = totals.grandTotal ?? q.grandTotal;
  const perAdult = totals.perAdult ?? (grand && c.adults ? Math.round(grand / c.adults) : null);

  const days      = q.sightseeing?.included && Array.isArray(q.sightseeing?.days)   ? q.sightseeing.days   : [];
  const hotels    = q.hotel?.included       && Array.isArray(q.hotel?.hotels)       ? q.hotel.hotels       : [];
  const segments  = q.flight?.included      && Array.isArray(q.flight?.segments)    ? q.flight.segments    : [];
  const cruises   = q.cruise?.included      && Array.isArray(q.cruise?.cruises)     ? q.cruise.cruises     : [];
  const vehicles  = q.vehicle?.included     && Array.isArray(q.vehicle?.vehicles)   ? q.vehicle.vehicles   : [];
  // Add-ons me item-level `included` bhi hota hai — section ON ho par ek line OFF ho sakti hai.
  // `== false` hi filter karo: null/undefined ka matlab "included" hai (builder aise rows likhta
  // hai jinke baare me usne user se poocha hi nahi).
  const addonItems = q.addons?.included     && Array.isArray(q.addons?.items)
    ? q.addons.items.filter(a => a?.included !== false)
    : [];
  const testimonials = Array.isArray(q.testimonials) ? q.testimonials : Array.isArray(q.reviews) ? q.reviews : [];

  const hasPricing = totals.subtotal != null || grand != null;
  const hasPolicies = !!(q.inclusions?.length || q.exclusions?.length || q.paymentPolicies?.length || q.cancellationPolicies?.length || q.bookingTerms?.length);

  const paxStr = [
    c.adults   ? `${c.adults} Adult${c.adults > 1 ? "s" : ""}`      : "",
    c.children ? `${c.children} Child${c.children > 1 ? "ren" : ""}` : "",
    c.infants  ? `${c.infants} Infant${c.infants > 1 ? "s" : ""}`   : "",
  ].filter(Boolean).join(" · ");

  const navLinks = [
    days.length     ? ["#itinerary", "Itinerary"] : null,
    hotels.length   ? ["#stays", "Stays"]         : null,
    segments.length ? ["#flights", "Flights"]     : null,
    hasPricing      ? ["#pricing", "Pricing"]     : null,
    ["#contact", "Contact"],
  ].filter(Boolean);

  /* reading-progress cue for the sticky bar */
  const [prog, setProg] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      setProg(max > 0 ? Math.min(1, el.scrollTop / max) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const waHref = companyPhone
    ? `https://wa.me/${companyPhone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hello, I'm interested in the travel quotation (${q.title || ""})`)}`
    : null;
  const mailHref = companyEmail
    ? `mailto:${companyEmail}?subject=${encodeURIComponent(`Quotation Inquiry (${q.title || ""})`)}`
    : null;

  return (
    <div className="mvw">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,300;1,9..144,400;1,9..144,500&family=Outfit:wght@300;400;500;600;700&display=swap');

        html { scroll-behavior: smooth; }
        html, body { margin: 0; padding: 0; background: #f5f1e8; overflow-x: hidden; max-width: 100%; }

        .mvw {
          --paper: #f5f1e8;
          --panel: #fbf8f1;
          --ink: #191611;
          --soft: #55503f;
          --muted: #8f886f;
          --line: #ddd4be;
          --accent: #9c5b33;
          --accent-deep: #7a4325;
          --forest: #47694f;
          --rust: #a34a35;
          font-family: 'Outfit', system-ui, sans-serif;
          background: var(--paper);
          color: var(--ink);
          min-height: 100%;
          overflow-x: hidden;
          max-width: 100vw;
          font-weight: 400;
          line-height: 1.6;
          -webkit-font-smoothing: antialiased;
        }
        .mvw, .mvw * { box-sizing: border-box; }
        .mvw img { max-width: 100%; display: block; }
        .mvw p, .mvw h1, .mvw h2, .mvw h3, .mvw span { overflow-wrap: break-word; word-break: break-word; }
        .mv-serif { font-family: 'Fraunces', Georgia, serif; font-weight: 400; letter-spacing: -0.01em; }

        /* ── reveal ── */
        .mv-reveal { opacity: 0; transform: translateY(28px); transition: opacity .9s cubic-bezier(.16,1,.3,1), transform .9s cubic-bezier(.16,1,.3,1); will-change: opacity, transform; }
        .mv-reveal.mv-in { opacity: 1; transform: translateY(0); }

        /* ── sticky mini-nav ── */
        .mv-nav { position: sticky; top: 0; z-index: 60; background: rgba(245,241,232,0.9); backdrop-filter: blur(14px) saturate(140%); -webkit-backdrop-filter: blur(14px) saturate(140%); border-bottom: 1px solid var(--line); }
        .mv-prog { position: absolute; top: 0; left: 0; height: 2px; background: var(--accent); transition: width .15s linear; }
        .mv-nav-in { max-width: 1120px; margin: 0 auto; padding: 13px 22px; display: flex; align-items: center; gap: 20px; }
        .mv-brand { font-family: 'Fraunces', Georgia, serif; font-style: italic; font-size: 17px; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 46vw; }
        .mv-nav-links { margin-left: auto; display: none; align-items: center; gap: 24px; }
        .mv-nav-links a { font-size: 11px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: var(--soft); text-decoration: none; transition: color .2s; }
        .mv-nav-links a:hover { color: var(--accent); }
        .mv-nav-pdf { margin-left: auto; font-size: 11px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: var(--accent-deep); text-decoration: none; border: 1px solid var(--accent); border-radius: 100px; padding: 7px 16px; white-space: nowrap; transition: background .2s, color .2s; }
        .mv-nav-pdf:hover { background: var(--accent); color: var(--paper); }
        @media (min-width: 820px) {
          .mv-nav-links { display: flex; }
          .mv-nav-pdf { margin-left: 0; }
        }

        /* ── hero ── */
        .mv-hero { position: relative; min-height: 100vh; min-height: 100svh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; overflow: hidden; padding: 96px 24px 110px; color: #f6f2e9; }
        .mv-hero-media { position: absolute; inset: 0; }
        .mv-hero-media img { width: 100%; height: 100%; object-fit: cover; }

        .mv-hero-media::after { content: ''; position: absolute; inset: 0; background: transparent; }
        .mv-hero-fallback { position: absolute; inset: 0; background: linear-gradient(158deg, #2a251b 0%, #38311f 46%, #17140d 100%); }
        .mv-hero-fallback::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 70% 55% at 70% 18%, rgba(156,91,51,0.35), transparent 65%); }
        .mv-hero-mark { position: absolute; right: -4vw; bottom: -14vh; font-family: 'Fraunces', Georgia, serif; font-style: italic; font-weight: 300; font-size: clamp(240px, 46vw, 560px); line-height: 1; color: rgba(246,242,233,0.05); pointer-events: none; user-select: none; }
        .mv-hero-inner { position: relative; z-index: 2; max-width: 900px; }
        .mv-hero-kicker { display: inline-flex; align-items: center; gap: 14px; font-size: 11px; font-weight: 600; letter-spacing: .3em; text-transform: uppercase; color: rgba(246,242,233,0.85); margin: 0 0 26px; }
        .mv-hero-kicker::before, .mv-hero-kicker::after { content: ''; width: 34px; height: 1px; background: rgba(246,242,233,0.45); }
        .mv-hero-title { font-size: clamp(52px, 11vw, 118px); line-height: 0.98; margin: 0; font-weight: 400; letter-spacing: -0.02em; }
        .mv-hero-title em { font-style: italic; font-weight: 300; color: #e8c9a8; }
        .mv-hero-sub { font-size: clamp(15px, 2.4vw, 19px); font-weight: 400; color: rgba(246,242,233,0.88); margin: 22px 0 0; letter-spacing: .01em; }
        .mv-hero-meta { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px 0; margin: 34px auto 0; font-size: 13px; font-weight: 500; letter-spacing: .06em; text-transform: uppercase; color: rgba(246,242,233,0.75); }
        .mv-hero-meta > span { padding: 0 18px; border-right: 1px solid rgba(246,242,233,0.28); }
        .mv-hero-meta > span:last-child { border-right: none; }
        .mv-hero-cue { position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%); z-index: 2; display: flex; flex-direction: column; align-items: center; gap: 10px; font-size: 10px; font-weight: 600; letter-spacing: .3em; text-transform: uppercase; color: rgba(246,242,233,0.65); }
        .mv-hero-cue i { display: block; width: 1px; height: 44px; background: rgba(246,242,233,0.4); overflow: hidden; position: relative; }
        .mv-hero-cue i::after { content: ''; position: absolute; left: 0; top: -50%; width: 1px; height: 50%; background: #e8c9a8; animation: mvDrop 2.1s cubic-bezier(.65,0,.35,1) infinite; }
        @keyframes mvDrop { 0% { top: -50%; } 70%, 100% { top: 110%; } }

        /* ── layout ── */
        .mv-wrap { max-width: 1120px; margin: 0 auto; padding: 0 22px; }
        .mv-section { padding: 86px 0 0; scroll-margin-top: 72px; }
        .mv-section-last { padding-bottom: 96px; }
        .mv-shead { margin-bottom: 46px; max-width: 640px; }
        .mv-kicker { font-size: 11px; font-weight: 600; letter-spacing: .3em; text-transform: uppercase; color: var(--accent); margin: 0 0 12px; }
        .mv-stitle { font-size: clamp(30px, 4.6vw, 46px); line-height: 1.06; margin: 0; color: var(--ink); }
        .mv-ssub { font-size: 15px; color: var(--muted); margin: 12px 0 0; }
        .mv-srule { display: block; width: 52px; height: 2px; background: var(--accent); margin-top: 22px; }

        /* ── glance strip ── */
        .mv-glance { border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); display: grid; grid-template-columns: repeat(2, 1fr); }
        .mv-meta { padding: 22px 18px; border-right: 1px solid var(--line); }
        .mv-meta:nth-child(2n) { border-right: none; }
        .mv-meta:nth-child(n+3) { border-top: 1px solid var(--line); }
        .mv-meta-l { font-size: 10px; font-weight: 600; letter-spacing: .22em; text-transform: uppercase; color: var(--muted); margin: 0 0 7px; }
        .mv-meta-v { font-family: 'Fraunces', Georgia, serif; font-size: 18px; color: var(--ink); margin: 0; line-height: 1.3; }
        @media (min-width: 760px) {
          .mv-glance { grid-template-columns: repeat(6, 1fr); }
          .mv-meta { border-top: none !important; }
          .mv-meta:nth-child(2n) { border-right: 1px solid var(--line); }
          .mv-meta:last-child { border-right: none; }
        }

        /* ── timeline ── */
        .mv-tl { position: relative; padding-left: 34px; }
        .mv-tl::before { content: ''; position: absolute; left: 5px; top: 8px; bottom: 8px; width: 1px; background: var(--line); }
        .mv-tl-day { position: relative; padding-bottom: 58px; }
        .mv-tl-day:last-child { padding-bottom: 6px; }
        .mv-tl-day::before { content: ''; position: absolute; left: -33px; top: 7px; width: 11px; height: 11px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 5px var(--paper), 0 0 0 6px var(--line); }
        .mv-daychip { display: inline-flex; align-items: baseline; gap: 8px; border: 1px solid var(--accent); color: var(--accent-deep); border-radius: 100px; padding: 5px 16px; font-size: 11px; font-weight: 700; letter-spacing: .22em; text-transform: uppercase; margin-bottom: 16px; background: var(--panel); }
        .mv-tl-title { font-size: clamp(22px, 3.4vw, 30px); margin: 0 0 6px; line-height: 1.15; }
        .mv-tl-date { font-size: 12.5px; font-weight: 500; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin: 0 0 20px; }
        .mv-act { display: flex; gap: 22px; padding: 20px 0; border-top: 1px solid var(--line); }
        .mv-act:first-of-type { border-top: none; padding-top: 4px; }
        .mv-act-img { flex-shrink: 0; width: 190px; }
        .mv-act-img img { width: 100%; aspect-ratio: 3 / 2; object-fit: cover; border-radius: 4px; }
        .mv-act-name { font-size: 17px; font-weight: 600; color: var(--ink); margin: 0 0 8px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .mv-time { font-size: 11px; font-weight: 600; letter-spacing: .08em; color: var(--accent-deep); border: 1px solid var(--line); background: var(--panel); border-radius: 100px; padding: 3px 11px; }
        .mv-act-line { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 6px; }
        .mv-act-line::before { content: ''; width: 14px; height: 1px; background: var(--accent); flex-shrink: 0; margin-top: 10px; }
        .mv-act-line span { font-size: 14px; color: var(--soft); line-height: 1.65; }
        .mv-tag { display: inline-block; font-size: 11px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: var(--soft); border: 1px solid var(--line); background: var(--panel); border-radius: 100px; padding: 5px 13px; margin: 8px 8px 0 0; }
        .mv-overnight { display: inline-flex; align-items: center; gap: 9px; margin-top: 18px; font-size: 13px; font-weight: 600; color: var(--forest); border: 1px solid rgba(71,105,79,0.35); border-radius: 100px; padding: 8px 18px; background: rgba(71,105,79,0.07); }
        .mv-overnight::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--forest); }
        @media (max-width: 640px) {
          .mv-act { flex-direction: column; gap: 14px; }
          .mv-act-img { width: 100%; }
        }

        /* ── cards ── */
        .mv-grid2 { display: grid; grid-template-columns: 1fr; gap: 28px; }
        @media (min-width: 760px) { .mv-grid2 { grid-template-columns: repeat(2, 1fr); } }
        .mv-card { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; overflow: hidden; transition: transform .45s cubic-bezier(.16,1,.3,1), box-shadow .45s ease; }
        .mv-card:hover { transform: translateY(-5px); box-shadow: 0 26px 52px rgba(25,22,17,0.09); }
        .mv-card-img { position: relative; aspect-ratio: 16 / 10; overflow: hidden; }
        .mv-card-img img { width: 100%; height: 100%; object-fit: cover; transition: transform .8s cubic-bezier(.16,1,.3,1); }
        .mv-card:hover .mv-card-img img { transform: scale(1.05); }
        .mv-card-body { padding: 24px 26px 26px; }
        .mv-card-title { font-size: 24px; margin: 0 0 4px; line-height: 1.15; }
        .mv-card-sub { font-size: 12px; font-weight: 500; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin: 0 0 16px; }
        .mv-stars { color: var(--accent); font-size: 14px; letter-spacing: 3px; }
        .mv-kv { display: grid; grid-template-columns: 1fr 1fr; gap: 13px 18px; padding-top: 16px; border-top: 1px solid var(--line); }
        .mv-kv-l { font-size: 10px; font-weight: 600; letter-spacing: .2em; text-transform: uppercase; color: var(--muted); margin: 0 0 3px; }
        .mv-kv-v { font-size: 14px; font-weight: 500; color: var(--ink); margin: 0; }
        .mv-note { font-size: 13px; color: var(--muted); font-style: italic; margin: 16px 0 0; border-left: 2px solid var(--line); padding-left: 14px; line-height: 1.6; }

        /* ── flights ── */
        .mv-flight { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 26px 28px; margin-bottom: 22px; }
        .mv-flight-top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 22px; }
        .mv-flight-air { font-size: 16px; font-weight: 600; color: var(--ink); }
        .mv-chip { font-size: 10.5px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--accent-deep); border: 1px solid var(--accent); border-radius: 100px; padding: 4px 12px; }
        .mv-route { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 18px; }
        .mv-route-city { font-family: 'Fraunces', Georgia, serif; font-size: clamp(26px, 4.5vw, 38px); line-height: 1; color: var(--ink); margin: 0 0 6px; }
        .mv-route-when { font-size: 12.5px; font-weight: 500; letter-spacing: .06em; color: var(--muted); margin: 0; text-transform: uppercase; }
        .mv-route-mid { text-align: center; color: var(--muted); }
        .mv-route-line { display: flex; align-items: center; gap: 6px; }
        .mv-route-line::before, .mv-route-line::after { content: ''; width: clamp(20px, 6vw, 70px); height: 1px; background: var(--line); }
        .mv-route-dur { font-size: 11px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; margin: 8px 0 0; }
        .mv-conn { margin-top: 20px; padding-top: 16px; border-top: 1px dashed var(--line); }
        .mv-conn p { font-size: 13.5px; color: var(--soft); margin: 0 0 7px; display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }
        .mv-conn p::before { content: 'via'; font-size: 10px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; color: var(--accent); }
        .mv-bag { margin-top: 16px; font-size: 12px; font-weight: 500; letter-spacing: .06em; color: var(--muted); text-transform: uppercase; }

        /* ── addons list ── */
        .mv-addon { display: flex; align-items: baseline; justify-content: space-between; gap: 18px; padding: 18px 4px; border-bottom: 1px solid var(--line); }
        .mv-addon:first-child { border-top: 1px solid var(--line); }
        .mv-addon-name { font-size: 16px; font-weight: 600; color: var(--ink); margin: 0 0 3px; }
        .mv-addon-desc { font-size: 13.5px; color: var(--muted); margin: 0; }
        .mv-addon-qty { font-family: 'Fraunces', Georgia, serif; font-size: 15px; color: var(--soft); white-space: nowrap; }

        /* ── pricing ── */
        .mv-price { max-width: 620px; }
        .mv-prow { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding: 13px 2px; border-bottom: 1px solid var(--line); font-size: 14.5px; color: var(--soft); }
        .mv-prow span:last-child { font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; }
        .mv-prow-strong { font-weight: 600; color: var(--ink); }
        .mv-prow-minus { color: var(--forest) !important; }
        .mv-grand { margin-top: 30px; background: var(--ink); color: #f6f2e9; border-radius: 6px; padding: 34px 32px; display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 18px; position: relative; overflow: hidden; }
        .mv-grand::after { content: ''; position: absolute; right: -60px; top: -60px; width: 200px; height: 200px; border-radius: 50%; border: 1px solid rgba(246,242,233,0.12); }
        .mv-grand-l { font-size: 11px; font-weight: 600; letter-spacing: .28em; text-transform: uppercase; color: rgba(246,242,233,0.6); margin: 0 0 10px; }
        .mv-grand-v { font-family: 'Fraunces', Georgia, serif; font-size: clamp(40px, 8vw, 62px); line-height: 1; margin: 0; }
        .mv-grand-note { font-size: 12.5px; color: rgba(246,242,233,0.65); margin: 10px 0 0; }
        .mv-grand-per { text-align: right; }
        .mv-grand-per p { margin: 0; }
        .mv-grand-per .n { font-family: 'Fraunces', Georgia, serif; font-size: 22px; color: #e8c9a8; }
        .mv-grand-per .l { font-size: 11px; font-weight: 600; letter-spacing: .18em; text-transform: uppercase; color: rgba(246,242,233,0.55); margin-top: 4px; }

        /* ── inclusions / exclusions ── */
        .mv-ie { display: grid; grid-template-columns: 1fr; gap: 40px; }
        @media (min-width: 760px) { .mv-ie { grid-template-columns: 1fr 1fr; } }
        .mv-ie h3 { font-size: 13px; font-weight: 700; letter-spacing: .22em; text-transform: uppercase; margin: 0 0 18px; padding-bottom: 12px; border-bottom: 1px solid var(--line); }
        .mv-ie-inc h3 { color: var(--forest); }
        .mv-ie-exc h3 { color: var(--rust); }
        .mv-ie li { list-style: none; display: flex; gap: 12px; align-items: flex-start; font-size: 14.5px; color: var(--soft); line-height: 1.65; margin-bottom: 11px; }
        .mv-ie ul { margin: 0; padding: 0; }
        .mv-ie-inc li::before { content: '+'; color: var(--forest); font-weight: 700; flex-shrink: 0; font-size: 15px; line-height: 1.55; }
        .mv-ie-exc li::before { content: '−'; color: var(--rust); font-weight: 700; flex-shrink: 0; font-size: 15px; line-height: 1.55; }

        /* ── collapsible policies ── */
        .mv-det { border-top: 1px solid var(--line); }
        .mv-det:last-of-type { border-bottom: 1px solid var(--line); }
        .mv-det summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 14px; padding: 20px 4px; user-select: none; }
        .mv-det summary::-webkit-details-marker { display: none; }
        .mv-det-t { font-size: 15px; font-weight: 600; color: var(--ink); }
        .mv-det-n { font-size: 11px; font-weight: 700; color: var(--accent-deep); border: 1px solid var(--line); border-radius: 100px; padding: 2px 10px; background: var(--panel); }
        .mv-det-x { margin-left: auto; font-family: 'Fraunces', Georgia, serif; font-size: 22px; font-weight: 300; color: var(--accent); transition: transform .35s cubic-bezier(.16,1,.3,1); line-height: 1; }
        .mv-det[open] .mv-det-x { transform: rotate(45deg); }
        .mv-det-list { margin: 0; padding: 2px 4px 24px; }
        .mv-det-list li { list-style: none; display: flex; gap: 14px; align-items: flex-start; font-size: 14px; color: var(--soft); line-height: 1.7; margin-bottom: 10px; }
        .mv-det-i { font-size: 11px; font-weight: 700; color: var(--accent); min-width: 20px; padding-top: 3px; letter-spacing: .05em; }

        /* ── testimonials ── */
        .mv-quote { border-left: 2px solid var(--accent); padding: 4px 0 4px 24px; }
        .mv-quote-text { font-family: 'Fraunces', Georgia, serif; font-style: italic; font-size: 18px; line-height: 1.55; color: var(--ink); margin: 0 0 14px; }
        .mv-quote-name { font-size: 12px; font-weight: 600; letter-spacing: .18em; text-transform: uppercase; color: var(--muted); margin: 0; }

        /* ── footer / contact ── */
        .mv-foot { margin-top: 96px; background: var(--ink); color: #f6f2e9; padding: 84px 22px 46px; text-align: center; position: relative; overflow: hidden; scroll-margin-top: 72px; }
        .mv-foot::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 62% 48% at 50% 0%, rgba(156,91,51,0.28), transparent 68%); pointer-events: none; }
        .mv-foot-in { position: relative; max-width: 640px; margin: 0 auto; }
        .mv-foot-logo { max-height: 62px; margin: 0 auto 22px; border-radius: 4px; }
        .mv-foot-name { font-size: clamp(28px, 5vw, 40px); margin: 0 0 8px; }
        .mv-foot-by { font-size: 13px; letter-spacing: .1em; text-transform: uppercase; color: rgba(246,242,233,0.6); margin: 0 0 26px; }
        .mv-foot-contact { font-size: 15px; color: rgba(246,242,233,0.85); margin: 0 0 4px; }
        .mv-foot-addr { font-size: 13px; color: rgba(246,242,233,0.5); white-space: pre-line; line-height: 1.7; margin: 14px 0 0; }
        .mv-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin: 36px 0 0; }
        .mv-btn { display: inline-flex; align-items: center; gap: 8px; font-family: 'Outfit', system-ui, sans-serif; font-size: 12px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; text-decoration: none; border-radius: 100px; padding: 15px 30px; transition: transform .25s cubic-bezier(.16,1,.3,1), background .25s, color .25s; }
        .mv-btn:hover { transform: translateY(-2px); }
        .mv-btn-solid { background: var(--accent); color: #f6f2e9; }
        .mv-btn-solid:hover { background: var(--accent-deep); }
        .mv-btn-ghost { border: 1px solid rgba(246,242,233,0.35); color: #f6f2e9; }
        .mv-btn-ghost:hover { border-color: #e8c9a8; color: #e8c9a8; }
        .mv-foot-rule { height: 1px; background: rgba(246,242,233,0.14); margin: 48px 0 22px; }
        .mv-fine { font-size: 11.5px; color: rgba(246,242,233,0.42); margin: 0 0 6px; letter-spacing: .04em; }

        /* ── reduced motion ── */
        @media (prefers-reduced-motion: reduce) {
          html { scroll-behavior: auto; }
          .mvw *, .mvw *::before, .mvw *::after { animation: none !important; transition: none !important; }
          .mv-reveal { opacity: 1 !important; transform: none !important; }
        }
      `}</style>

      {/* ━━━ STICKY MINI-NAV + PROGRESS ━━━ */}
      <nav className="mv-nav">
        <span className="mv-prog" style={{ width: `${prog * 100}%` }} aria-hidden="true" />
        <div className="mv-nav-in">
          <span className="mv-brand">{company.name || q.title || "Travel Itinerary"}</span>
          <div className="mv-nav-links">
            {navLinks.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
          </div>
          <a className="mv-nav-pdf" href={pdfUrl} target="_blank" rel="noreferrer">PDF</a>
        </div>
      </nav>

      {/* ━━━ HERO ━━━ */}
      <header className="mv-hero">
        {q.coverImageUrl ? (
          <div className="mv-hero-media"><img src={q.coverImageUrl} alt="" /></div>
        ) : (
          <div className="mv-hero-fallback">
            <span className="mv-hero-mark mv-serif" aria-hidden="true">{(heroPlace || "T").charAt(0)}</span>
          </div>
        )}
        <div className="mv-hero-inner">
          <p className="mv-hero-kicker">Private Itinerary{q.quoteNo ? ` · No. ${q.quoteNo}` : ""}</p>
          <h1 className="mv-serif mv-hero-title">
            {heroPlace}{q.nights != null ? <em>, {q.nights} nights</em> : null}
          </h1>
          {q.title && <p className="mv-hero-sub">{q.title}</p>}
          <div className="mv-hero-meta">
            {c.travelDate && <span>{fmtDate(c.travelDate)}</span>}
            <span>{q.nights ?? "—"}N / {q.days ?? "—"}D</span>
            {paxStr && <span>{paxStr}</span>}
            {destStr && <span>{destStr}</span>}
          </div>
        </div>
        <div className="mv-hero-cue" aria-hidden="true"><i /><span>Scroll</span></div>
      </header>

      {/* ━━━ AT A GLANCE ━━━ */}
      <div className="mv-wrap">
        <section className="mv-section" id="overview" style={{ paddingTop: 64 }}>
          <Reveal>
            <div className="mv-glance">
              <Meta label="Traveler">{c.name || "—"}</Meta>
              <Meta label="Travel Date">{fmtDate(c.travelDate)}</Meta>
              <Meta label="Duration">{q.nights ?? "—"}N / {q.days ?? "—"}D</Meta>
              <Meta label="Guests">{paxStr || "—"}</Meta>
              <Meta label="Rooms">{q.rooms || c.rooms || "—"}</Meta>
              <Meta label="Prepared By">{preparedBy || company.name || "—"}</Meta>
            </div>
          </Reveal>
        </section>

        {/* ━━━ ITINERARY TIMELINE ━━━ */}
        {days.length > 0 && (
          <section className="mv-section" id="itinerary">
            <Reveal>
              <SectionHead kicker="The Journey" title="Day by day" sub="A considered route, one day at a time." />
            </Reveal>
            <div className="mv-tl">
              {days.map((d, i) => {
                const firstAct = (d.activities || [])[0] || {};
                return (
                  <Reveal key={i} delay={Math.min(i * 60, 240)}>
                    <article className="mv-tl-day">
                      <span className="mv-daychip">Day {pad2(d.day)}</span>
                      <h3 className="mv-serif mv-tl-title">{firstAct.attraction || d.title || `Day ${d.day}`}</h3>
                      <p className="mv-tl-date">
                        {[d.location || firstAct.city, d.date ? fmtDateLong(d.date) : ""].filter(Boolean).join("  ·  ") || " "}
                      </p>
                      {(d.activities || []).map((a, j) => {
                        const img = actImg(a);
                        const meals = Array.isArray(a.meals) ? a.meals.filter(Boolean) : [];
                        const rawDesc = (a.description || "").trim();
                        let points = [];
                        if (rawDesc) {
                          points = (/\n|\r/.test(rawDesc) ? rawDesc.split(/\n|\r/) : rawDesc.split(/\.(?:\s+|$)/))
                            .map((s) => s.replace(/^[-*•\s]+/, "").trim()).filter(Boolean);
                        }
                        return (
                          <div key={j} className="mv-act">
                            {img && (
                              <div className="mv-act-img">
                                <img src={img} alt={a.attraction || ""} onError={(e) => { e.target.parentElement.style.display = "none"; }} />
                              </div>
                            )}
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <p className="mv-act-name">
                                {a.attraction}
                                {a.startTime && <span className="mv-time">{a.startTime}</span>}
                              </p>
                              {points.map((line, li) => (
                                <div key={li} className="mv-act-line"><span>{line}</span></div>
                              ))}
                              <div>
                                {a.transfer && <Tag>{a.transfer} transfer</Tag>}
                                {meals.length > 0 && <Tag>{meals.join(", ")}</Tag>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {d.overnightStay && <span className="mv-overnight">Overnight — {d.overnightStay}</span>}
                    </article>
                  </Reveal>
                );
              })}
            </div>
          </section>
        )}

        {/* ━━━ HOTELS ━━━ */}
        {hotels.length > 0 && (
          <section className="mv-section" id="stays">
            <Reveal>
              <SectionHead kicker="The Stays" title="Where you'll rest" sub="Handpicked for comfort and character." />
            </Reveal>
            <div className="mv-grid2">
              {hotels.map((h, i) => {
                const img = hotelImg(h);
                return (
                  <Reveal key={i} delay={Math.min(i * 80, 240)}>
                    <article className="mv-card">
                      {img && (
                        <div className="mv-card-img">
                          <img src={img} alt={h.name || ""} onError={(e) => { e.target.parentElement.style.display = "none"; }} />
                        </div>
                      )}
                      <div className="mv-card-body">
                        <h3 className="mv-serif mv-card-title">{h.name}</h3>
                        <p className="mv-card-sub">
                          {[h.city, h.country].filter(Boolean).join(", ") || " "}
                          {h.stars > 0 && <>{"  "}<Stars count={h.stars} /></>}
                        </p>
                        <div className="mv-kv">
                          {h.roomType && <div><p className="mv-kv-l">Room</p><p className="mv-kv-v">{h.roomType}</p></div>}
                          {h.mealPlan && <div><p className="mv-kv-l">Meals</p><p className="mv-kv-v">{h.mealPlan}</p></div>}
                          {h.rooms ? <div><p className="mv-kv-l">Rooms</p><p className="mv-kv-v">{h.rooms}</p></div> : null}
                          <div><p className="mv-kv-l">Check-in</p><p className="mv-kv-v">{fmtDate(h.checkIn)}</p></div>
                          <div><p className="mv-kv-l">Check-out</p><p className="mv-kv-v">{fmtDate(h.checkOut)}</p></div>
                        </div>
                      </div>
                    </article>
                  </Reveal>
                );
              })}
            </div>
          </section>
        )}

        {/* ━━━ FLIGHTS ━━━ */}
        {segments.length > 0 && (
          <section className="mv-section" id="flights">
            <Reveal>
              <SectionHead kicker="The Flights" title="Getting you there" sub={q.flight?.journey || undefined} />
            </Reveal>
            {segments.map((seg, i) => (
              <Reveal key={i} delay={Math.min(i * 80, 240)}>
                <article className="mv-flight">
                  <div className="mv-flight-top">
                    {seg.airline && <span className="mv-flight-air">{seg.airline}</span>}
                    {seg.flightNo && <span className="mv-chip">{seg.flightNo}</span>}
                    {seg.class && <span className="mv-chip">{seg.class}</span>}
                  </div>
                  <div className="mv-route">
                    <div>
                      <p className="mv-serif mv-route-city">{seg.from || "—"}</p>
                      <p className="mv-route-when">{[seg.depTime, fmtDate(seg.depDate)].filter(Boolean).join(" · ")}</p>
                    </div>
                    <div className="mv-route-mid">
                      <div className="mv-route-line">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M21 12 L3 12 M21 12 L15 6 M21 12 L15 18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      {seg.duration && <p className="mv-route-dur">{seg.duration}</p>}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p className="mv-serif mv-route-city">{seg.to || "—"}</p>
                      <p className="mv-route-when">{[seg.arrTime, fmtDate(seg.arrDate)].filter(Boolean).join(" · ")}</p>
                    </div>
                  </div>
                  {(seg.cabin > 0 || seg.checkin > 0) && (
                    <p className="mv-bag">
                      {[seg.cabin > 0 ? `Cabin ${seg.cabin}kg` : "", seg.checkin > 0 ? `Check-in ${seg.checkin}kg` : ""].filter(Boolean).join("  ·  ")}
                    </p>
                  )}
                  {Array.isArray(seg.connections) && seg.connections.length > 0 && (
                    <div className="mv-conn">
                      {seg.connections.map((cn, k) => (
                        <p key={k}>
                          <span>
                            {[cn.airline, cn.flightNo].filter(Boolean).join(" ")}
                            {(cn.from || cn.to) && ` — ${cn.from || "?"} to ${cn.to || "?"}`}
                            {(cn.depTime || cn.arrTime) && ` (${[cn.depTime, cn.arrTime].filter(Boolean).join(" – ")})`}
                          </span>
                        </p>
                      ))}
                    </div>
                  )}
                </article>
              </Reveal>
            ))}
          </section>
        )}

        {/* ━━━ CRUISE ━━━ */}
        {cruises.length > 0 && (
          <section className="mv-section" id="cruise">
            <Reveal>
              <SectionHead kicker="The Voyage" title="Time at sea" />
            </Reveal>
            <div className="mv-grid2">
              {cruises.map((cr, i) => (
                <Reveal key={i} delay={Math.min(i * 80, 240)}>
                  <article className="mv-card">
                    <div className="mv-card-body">
                      <h3 className="mv-serif mv-card-title">{cr.name || "Cruise"}</h3>
                      <p className="mv-card-sub">{cr.type || " "}</p>
                      <div className="mv-kv">
                        {(cr.depPort || cr.arrPort) && (
                          <div style={{ gridColumn: "1 / -1" }}>
                            <p className="mv-kv-l">Route</p>
                            <p className="mv-kv-v">{[cr.depPort, cr.arrPort].filter(Boolean).join(" → ")}</p>
                          </div>
                        )}
                        {cr.depDate && <div><p className="mv-kv-l">Departure</p><p className="mv-kv-v">{fmtDate(cr.depDate)}</p></div>}
                        {cr.nights ? <div><p className="mv-kv-l">Nights</p><p className="mv-kv-v">{cr.nights}</p></div> : null}
                        {cr.cabin && <div><p className="mv-kv-l">Cabin</p><p className="mv-kv-v">{cr.cabin}</p></div>}
                      </div>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </section>
        )}

        {/* ━━━ TRANSPORT ━━━ */}
        {vehicles.length > 0 && (
          <section className="mv-section" id="transport">
            <Reveal>
              <SectionHead kicker="On the Ground" title="Your transport" />
            </Reveal>
            <div className="mv-grid2">
              {vehicles.map((v, i) => {
                const img = vehImg(v);
                return (
                  <Reveal key={i} delay={Math.min(i * 80, 240)}>
                    <article className="mv-card">
                      {img && (
                        <div className="mv-card-img">
                          <img src={img} alt={v.model || v.type || ""} onError={(e) => { e.target.parentElement.style.display = "none"; }} />
                        </div>
                      )}
                      <div className="mv-card-body">
                        <h3 className="mv-serif mv-card-title">{v.model || v.type || "Vehicle"}</h3>
                        <p className="mv-card-sub">{v.model && v.type ? v.type : " "}</p>
                        <div className="mv-kv">
                          {(v.pickup || v.drop) && (
                            <div style={{ gridColumn: "1 / -1" }}>
                              <p className="mv-kv-l">Route</p>
                              <p className="mv-kv-v">{[v.pickup, v.drop].filter(Boolean).join(" → ")}</p>
                            </div>
                          )}
                          {(v.startDate || v.endDate) && (
                            <div><p className="mv-kv-l">Dates</p><p className="mv-kv-v">{fmtDate(v.startDate)}{v.endDate ? ` → ${fmtDate(v.endDate)}` : ""}</p></div>
                          )}
                          {v.capacity ? <div><p className="mv-kv-l">Seats</p><p className="mv-kv-v">{v.capacity}</p></div> : null}
                          {v.qty ? <div><p className="mv-kv-l">Vehicles</p><p className="mv-kv-v">{v.qty}</p></div> : null}
                        </div>
                        {v.notes && <p className="mv-note">{v.notes}</p>}
                      </div>
                    </article>
                  </Reveal>
                );
              })}
            </div>
          </section>
        )}

        {/* ━━━ ADD-ONS ━━━ */}
        {addonItems.length > 0 && (
          <section className="mv-section" id="addons">
            <Reveal>
              <SectionHead kicker="The Extras" title="Thoughtful additions" />
            </Reveal>
            <Reveal>
              <div style={{ maxWidth: 720 }}>
                {addonItems.map((a, i) => (
                  <div key={i} className="mv-addon">
                    <div style={{ minWidth: 0 }}>
                      <p className="mv-addon-name">{a.serviceType || "Service"}</p>
                      {a.description && <p className="mv-addon-desc">{a.description}</p>}
                    </div>
                    {a.quantity ? <span className="mv-addon-qty">× {a.quantity}</span> : null}
                  </div>
                ))}
              </div>
            </Reveal>
          </section>
        )}

        {/* ━━━ TESTIMONIALS ━━━ */}
        {testimonials.length > 0 && (
          <section className="mv-section" id="words">
            <Reveal>
              <SectionHead kicker="Kind Words" title="From fellow travelers" />
            </Reveal>
            <div className="mv-grid2">
              {testimonials.map((t, i) => {
                const name = t.name || t.customerName || "Guest";
                const text = t.review || t.text || t.comment || "";
                if (!text) return null;
                return (
                  <Reveal key={i} delay={Math.min(i * 80, 240)}>
                    <blockquote className="mv-quote" style={{ margin: 0 }}>
                      <p className="mv-quote-text">“{text}”</p>
                      <p className="mv-quote-name">
                        {name}{t.trip ? ` — ${t.trip}` : ""}
                        {(t.rating || t.stars) ? <>{"  "}<Stars count={t.rating || t.stars} /></> : null}
                      </p>
                    </blockquote>
                  </Reveal>
                );
              })}
            </div>
          </section>
        )}

        {/* ━━━ PRICING ━━━ */}
        {hasPricing && (
          <section className="mv-section" id="pricing">
            <Reveal>
              <SectionHead kicker="The Investment" title="Transparent pricing" sub="Every rupee accounted for. No surprises." />
            </Reveal>
            <Reveal>
              <div className="mv-price">
                {/* Per-section amounts live on the SECTION objects (flight.amount, hotel.amount, …) —
                    the public Totals carries only subtotal/discount/tax/grandTotal/addonsTotal/perAdult.
                    The totals.flightAmount-style fields this originally read DO NOT EXIST on the wire,
                    so every one of these rows silently vanished against the real API. */}
                {q.flight?.included      && q.flight.amount      > 0 && <PriceRow label="Flights"     value={inr(q.flight.amount)} />}
                {q.hotel?.included       && q.hotel.amount       > 0 && <PriceRow label="Hotels"      value={inr(q.hotel.amount)} />}
                {q.sightseeing?.included && q.sightseeing.amount > 0 && <PriceRow label="Sightseeing" value={inr(q.sightseeing.amount)} />}
                {q.cruise?.included      && q.cruise.amount      > 0 && <PriceRow label="Cruise"      value={inr(q.cruise.amount)} />}
                {q.vehicle?.included     && q.vehicle.amount     > 0 && <PriceRow label="Transport"   value={inr(q.vehicle.amount)} />}
                {q.addons?.included      && q.addons.amount      > 0 && <PriceRow label="Add-ons"     value={inr(q.addons.amount)} />}
                {totals.subtotal != null       && <PriceRow label="Subtotal"    value={inr(totals.subtotal)} strong />}
                {totals.discountAmount    > 0 && <PriceRow label="Discount"     value={`− ${inr(totals.discountAmount)}`} minus />}
                {/* NO markup row, ever. The public DTO deliberately omits markup because it is the
                    agency's margin — this is the customer-facing page. Do not re-add it. */}
                {totals.taxAmount         > 0 && <PriceRow label={`Tax (${totals.taxPercent || 0}%)`} value={inr(totals.taxAmount)} />}

                <div className="mv-grand">
                  <div>
                    <p className="mv-grand-l">Grand Total</p>
                    <p className="mv-grand-v">{inr(grand)}</p>
                    <p className="mv-grand-note">Inclusive of all taxes</p>
                  </div>
                  {perAdult && c.adults ? (
                    <div className="mv-grand-per">
                      <p className="n">{inr(perAdult)}</p>
                      <p className="l">per adult · {c.adults} adults</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </Reveal>
          </section>
        )}

        {/* ━━━ INCLUSIONS / EXCLUSIONS + POLICIES ━━━ */}
        {hasPolicies && (
          <section className="mv-section mv-section-last" id="policies">
            <Reveal>
              <SectionHead kicker="The Fine Print" title="Good to know" />
            </Reveal>
            {(q.inclusions?.length || q.exclusions?.length) ? (
              <Reveal>
                <div className="mv-ie" style={{ marginBottom: 52 }}>
                  {q.inclusions?.length > 0 && (
                    <div className="mv-ie-inc">
                      <h3>Included</h3>
                      <ul>{q.inclusions.map((it, i) => <li key={i}><span>{it}</span></li>)}</ul>
                    </div>
                  )}
                  {q.exclusions?.length > 0 && (
                    <div className="mv-ie-exc">
                      <h3>Not Included</h3>
                      <ul>{q.exclusions.map((it, i) => <li key={i}><span>{it}</span></li>)}</ul>
                    </div>
                  )}
                </div>
              </Reveal>
            ) : null}
            <Reveal>
              <div style={{ maxWidth: 760 }}>
                <Policy title="Payment Policy"      items={q.paymentPolicies} />
                <Policy title="Cancellation Policy" items={q.cancellationPolicies} />
                <Policy title="Booking Terms"       items={q.bookingTerms} />
              </div>
            </Reveal>
          </section>
        )}
      </div>

      {/* ━━━ CONTACT / FOOTER ━━━ */}
      <footer className="mv-foot" id="contact">
        <div className="mv-foot-in">
          {(company.logo || company.logoUrl) && (
            <img className="mv-foot-logo" src={company.logo || company.logoUrl} alt={company.name || ""} />
          )}
          <h2 className="mv-serif mv-foot-name">{company.name || "Ready when you are"}</h2>
          {preparedBy && <p className="mv-foot-by">Your travel expert — {preparedBy}</p>}
          {companyPhone && <p className="mv-foot-contact">{companyPhone}</p>}
          {companyEmail && <p className="mv-foot-contact">{companyEmail}</p>}
          {company.address && <p className="mv-foot-addr">{company.address}</p>}

          <div className="mv-actions">
            {companyPhone && <a className="mv-btn mv-btn-solid" href={`tel:${companyPhone}`}>Call Now</a>}
            {waHref && <a className="mv-btn mv-btn-ghost" href={waHref} target="_blank" rel="noreferrer">WhatsApp</a>}
            {mailHref && <a className="mv-btn mv-btn-ghost" href={mailHref}>Email</a>}
            <a className="mv-btn mv-btn-ghost" href={pdfUrl} target="_blank" rel="noreferrer">Download PDF</a>
          </div>

          <div className="mv-foot-rule" />
          <p className="mv-fine">© {new Date().getFullYear()} {company.name || "Travel Company"}. All rights reserved.</p>
          <p className="mv-fine">
            {[company.since && `Since ${company.since}`, company.reviewsCount && `${company.reviewsCount} Reviews`, company.gst && `GST: ${company.gst}`].filter(Boolean).join(" · ")}
          </p>
          <p className="mv-fine">Quote {q.quoteNo ? `#${q.quoteNo}` : "—"} · Generated {fmtDate(q.createdAt)}</p>
        </div>
      </footer>
    </div>
  );
}