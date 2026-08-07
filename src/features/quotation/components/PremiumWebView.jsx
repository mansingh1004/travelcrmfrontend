

import { useEffect, useState } from "react";

/* ─── formatters ─── */
const inr = (v) => (v == null ? "—" : `₹${Number(v).toLocaleString("en-IN")}`);
const fmtDate = (d) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
};
const pad2 = (n) => String(n ?? "").padStart(2, "0");
const dayMon = (d) => {
  if (!d) return null;
  try {
    const x = new Date(d);
    if (isNaN(x)) return null;
    return { day: pad2(x.getDate()), mon: x.toLocaleDateString("en-GB", { month: "short" }).toUpperCase() };
  } catch { return null; }
};
const diffNights = (a, b) => {
  try { const n = Math.round((new Date(b) - new Date(a)) / 864e5); return n > 0 ? n : null; }
  catch { return null; }
};

/* amount in words — Indian system ("Two Lakh Forty Five Thousand Only") */
const ONES = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
const TENS = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
const two2 = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? " " + ONES[n % 10] : ""}`);
const three3 = (n) => `${Math.floor(n / 100) ? ONES[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " : "") : ""}${n % 100 ? two2(n % 100) : ""}`;
const inrWords = (num) => {
  num = Math.round(Number(num));
  if (!num || num <= 0 || !isFinite(num) || num >= 1e9) return "";
  const parts = [];
  const cr = Math.floor(num / 1e7); num %= 1e7;
  const lk = Math.floor(num / 1e5); num %= 1e5;
  const th = Math.floor(num / 1e3); num %= 1e3;
  if (cr) parts.push(two2(cr) + " Crore");
  if (lk) parts.push(two2(lk) + " Lakh");
  if (th) parts.push(two2(th) + " Thousand");
  if (num) parts.push(three3(num));
  return parts.join(" ") + " Only";
};

/* ─── image helpers ─── */
const cdn = (url, t) =>
  url && typeof url === "string" && url.includes("/upload/")
    ? url.replace("/upload/", `/upload/${t}/`)
    : url;
const HERO  = "c_fill,w_1600,h_640,g_auto,f_auto,q_auto";
const BAND  = "c_fill,w_700,h_460,g_auto,f_auto,q_auto";
const STRIP = "c_fill,w_360,h_240,g_auto,f_auto,q_auto";
const CARD  = "c_fill,w_460,h_320,g_auto,f_auto,q_auto";
const THUMB = "c_fill,w_160,h_120,g_auto,f_auto,q_auto";
const FULL  = "c_limit,w_1600,f_auto,q_auto";
// c_fit (not c_fill): vehicles are cutout-style photos — a fill crop chops the car itself.
const VEH   = "c_fit,w_480,h_360,f_auto,q_auto";

const hotelImg = (h) => h.imageUrl || h.imagePath || h.image || h.photo || h.coverImage || h.hotelImage || h.img || (Array.isArray(h.images) && h.images[0]) || null;
const vehImg   = (v) => v.imageUrl || v.imagePath || v.image || v.photo || v.vehicleImage || v.img || (Array.isArray(v.images) && v.images[0]) || null;
const actImg   = (a) => a.imageUrl || a.imagePath || a.image || a.photo || a.img || null;

const telHref = (p) => (p ? `tel:${String(p).replace(/[^\d+]/g, "")}` : null);
const toList = (x) => (Array.isArray(x) ? x : (typeof x === "string" && x.trim() ? [x.trim()] : []));

/* ─── gold line icons (stroke: currentColor) ─── */
const I = ({ d, extra, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />{extra}
  </svg>
);
const IcoPlane    = (p) => <I {...p} d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />;
const IcoHotel    = (p) => <I {...p} d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6M9 11h.01M15 11h.01" />;
const IcoCamera   = (p) => <I {...p} d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" extra={<circle cx="12" cy="13" r="4" />} />;
const IcoMeal     = (p) => <I {...p} d="M7 3v8a2 2 0 0 1-2 2v8M5 3v6M9 3v6M16 3c-1.5 0-3 2.2-3 5 0 2 1 3.2 2 3.5V21" />;
const IcoCar      = (p) => <I {...p} d="M4 16l1.5-6h13L20 16M3 16h18v3h-2M3 19h2M7 12h10" extra={<><circle cx="7.5" cy="18" r="1.6" /><circle cx="16.5" cy="18" r="1.6" /></>} />;
const IcoBoat     = (p) => <I {...p} d="M2 20c2 1.2 4 1.2 6 0s4-1.2 6 0 4 1.2 6 0M4 17l-1-4 9-3 9 3-1 4M12 10V4M9 6h6" />;
const IcoShield   = (p) => <I {...p} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />;
const IcoDoc      = (p) => <I {...p} d="M9 3h6v3H9zM6 5H5v16h14V5h-1M9 12h6M9 16h6" />;
const IcoPin      = (p) => <I {...p} d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0z" extra={<circle cx="12" cy="10" r="3" />} />;
const IcoCal      = (p) => <I {...p} d="M5 5h14v16H5zM16 3v4M8 3v4M5 11h14" />;
const IcoUsers    = (p) => <I {...p} d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.9M16 3.1A4 4 0 0 1 16 11" extra={<circle cx="9" cy="7" r="4" />} />;
const IcoUser     = (p) => <I {...p} d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" extra={<circle cx="12" cy="7" r="4" />} />;
const IcoLandmark = (p) => <I {...p} d="M3 21h18M4 18h16M6 18v-7M10 18v-7M14 18v-7M18 18v-7M3 11l9-7 9 7z" />;
const IcoTrain    = (p) => <I {...p} d="M6 3h12a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a1 1 0 0 1 1-1zM5 10h14M9 20l-1.5 2M15 20l1.5 2M8.5 14h.01M15.5 14h.01" />;
const IcoMount    = (p) => <I {...p} d="M8 4l4 8 3.5-3.5L21 20H3L8 4z" />;
const IcoCrown    = (p) => <I {...p} d="M3 18h18M4 18l1.5-8 4.5 3.5L12 6l2 7.5L18.5 10 20 18" />;
const IcoRoute    = (p) => <I {...p} d="M6 19a3 3 0 1 0 0-6h9a3 3 0 1 1 0 6M6 5h.01" extra={<circle cx="18" cy="5" r="2" />} />;
const IcoPhone    = (p) => <I {...p} d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.6 3a2 2 0 0 1-.5 1.9L7.9 10a16 16 0 0 0 6 6l1.4-1.3a2 2 0 0 1 1.9-.5l3 .6a2 2 0 0 1 1.8 2.1z" />;
/* cycle for itinerary day medallions: first & last day = plane */
const DAY_ICONS = [IcoLandmark, IcoTrain, IcoMount, IcoCamera, IcoBoat, IcoCar];

/* ─── small building blocks ─── */
function SecHead({ Ico, title }) {
  return (
    <div className="pw-shd">
      <span className="pw-shd-ic"><Ico size={15} /></span>
      <span className="pw-shd-t">{title}</span>
      <span className="pw-shd-line" aria-hidden="true" />
    </div>
  );
}
function InfoRow({ Ico, label, children }) {
  return (
    <div className="pw-irow">
      {Ico && <span className="pw-irow-ic"><Ico size={14} /></span>}
      <div style={{ minWidth: 0 }}>
        <p className="pw-lab">{label}</p>
        <div className="pw-val">{children}</div>
      </div>
    </div>
  );
}
function Bullet({ tone = "gold", children }) {
  return (
    <div className="pw-bul">
      <span className={`pw-bul-m pw-${tone}`}>{tone === "red" ? "✕" : "•"}</span>
      <span>{children}</span>
    </div>
  );
}
function Stars({ count }) {
  const n = Number(count) || 0;
  if (n <= 0) return null;
  return <span className="pw-stars" aria-label={`${n} star`}>{"★".repeat(Math.min(n, 7))}</span>;
}
function ZoomImg({ src, full, alt, className, onZoom, hideSel }) {
  return (
    <button type="button" className={`pw-zoom ${className || ""}`} aria-label={`View photo — ${alt || "photo"}`} onClick={onZoom}>
      <img src={src} alt={alt || ""} loading="lazy"
        onError={(e) => { const w = hideSel ? e.currentTarget.closest(hideSel) : e.currentTarget.closest(".pw-zoom"); if (w) w.style.display = "none"; }} />
    </button>
  );
}

/* ════════════════ MAIN ════════════════ */
export default function PremiumWebView({ data, pdfUrl }) {
  const q = data || {};
  const c = q.customer || {};
  const company = q.company || q.organization || {};
  const totals = q.totals || {};

  const [zoom, setZoom] = useState(null);
  useEffect(() => {
    if (!zoom) return;
    const onKey = (e) => { if (e.key === "Escape") setZoom(null); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [zoom]);
  const z = (img, alt) => () => setZoom({ src: cdn(img, FULL), alt: alt || "" });

  /* ── derivations ── */
  const destStr = c.destination || (Array.isArray(q.destinations) ? q.destinations.join(" → ") : "") || "";
  const preparedBy = q.preparedBy || q.createdByName || company.contactPerson || "";
  const companyPhone = company.phone || company.contactNumber || q.companyPhone || "";
  const companyEmail = company.email || q.companyEmail || "";
  const custEmail = c.email || c.emailId || "";
  const custPhone = c.phone || c.mobile || c.contactNumber || "";
  const validTill = q.validUntil || q.quotationValidUntil || q.validTill || null;
  const bookingAmount = q.bookingAmount ?? totals.bookingAmount ?? null;
  const paySchedule = Array.isArray(q.paymentSchedule) ? q.paymentSchedule : [];
  const importantNotes = toList(q.importantNotes).concat(toList(q.notes)).slice(0, 6);

  const grand = totals.grandTotal ?? q.grandTotal;
  const perAdult = totals.perAdult ?? (grand && c.adults ? Math.round(grand / c.adults) : null);
  const grandWords = grand != null ? inrWords(grand) : "";

  const days      = q.sightseeing?.included && Array.isArray(q.sightseeing?.days)   ? q.sightseeing.days   : [];
  const hotels    = q.hotel?.included       && Array.isArray(q.hotel?.hotels)       ? q.hotel.hotels       : [];
  const segments  = q.flight?.included      && Array.isArray(q.flight?.segments)    ? q.flight.segments    : [];
  const cruises   = q.cruise?.included      && Array.isArray(q.cruise?.cruises)     ? q.cruise.cruises     : [];
  const vehicles  = q.vehicle?.included     && Array.isArray(q.vehicle?.vehicles)   ? q.vehicle.vehicles   : [];
  const addonItems = q.addons?.included     && Array.isArray(q.addons?.items)
    ? q.addons.items.filter(a => a?.included !== false)
    : [];

  const paxStr = [
    c.adults   ? `${c.adults} Adult${c.adults > 1 ? "s" : ""}`      : "",
    c.children ? `${c.children} Child${c.children > 1 ? "ren" : ""}` : "",
    c.infants  ? `${c.infants} Infant${c.infants > 1 ? "s" : ""}`   : "",
  ].filter(Boolean).join("  ·  ");

  const heroImg = q.coverImageUrl
    || hotels.map(hotelImg).find(Boolean)
    || days.flatMap(d => (d.activities || []).map(actImg)).find(Boolean)
    || vehicles.map(vehImg).find(Boolean)
    || null;

  const sightCards = days
    .flatMap(d => (d.activities || [])
      .filter(a => actImg(a))
      .map(a => ({ img: actImg(a), name: a.attraction || "Sightseeing", city: a.city || d.location || "" })))
    .slice(0, 8);
  const bandImg = (sightCards[1] || sightCards[0])?.img || (hotels[0] && hotelImg(hotels[0])) || heroImg;

  const mealsAny = hotels.some(h => h.mealPlan) || days.some(d => (d.activities || []).some(a => a.meals?.length));
  const svcRow = [
    segments.length  ? { Ico: IcoPlane,  label: "Flights",     sub: "As per itinerary" }   : null,
    hotels.length    ? { Ico: IcoHotel,  label: "Hotels",      sub: "Handpicked stays" }   : null,
    days.length      ? { Ico: IcoCamera, label: "Sightseeing", sub: "All tours & transfers" } : null,
    mealsAny         ? { Ico: IcoMeal,   label: "Meals",       sub: "As mentioned" }       : null,
    vehicles.length  ? { Ico: IcoCar,    label: "Transport",   sub: "Private vehicles" }   : null,
    cruises.length   ? { Ico: IcoBoat,   label: "Cruise",      sub: "As detailed" }        : null,
    addonItems.length? { Ico: IcoShield, label: "Add-ons",     sub: "Extra services" }     : null,
  ].filter(Boolean);

  const hasPricing = totals.subtotal != null || grand != null;
  const waHref = companyPhone
    ? `https://wa.me/${companyPhone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hello, I'm interested in the travel quotation (${q.title || ""})`)}`
    : null;
  const mailHref = companyEmail
    ? `mailto:${companyEmail}?subject=${encodeURIComponent(`Quotation Inquiry (${q.title || ""})`)}`
    : null;
  const callHref = telHref(companyPhone);
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  const dayIcon = (i, total) => (i === 0 || i === total - 1) ? IcoPlane : DAY_ICONS[(i - 1) % DAY_ICONS.length];

  return (
    <div className="pw">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Jost:wght@300;400;500;600;700&family=Great+Vibes&display=swap');

        html, body { margin:0; padding:0; background:#efe7d6; overflow-x:hidden; max-width:100%; }

        .pw {
          --navy:#1c2b4a; --navy2:#141f38; --ink:#232f49;
          --gold:#c19a3f; --gold2:#e9cd83; --goldline:#d8bd76;
          --paper:#efe7d6; --card:#fdfbf4; --line:#e2d6ba; --hair:#ede4cf;
          --soft:#54617a; --muted:#8d8468; --green:#3f6b4a; --red:#a3402f;
          font-family:'Jost',system-ui,sans-serif;
          background:var(--paper); color:var(--ink);
          padding:clamp(10px,2.5vw,30px);
          line-height:1.6; -webkit-font-smoothing:antialiased;
          overflow-x:hidden; max-width:100vw;
        }
        .pw, .pw * { box-sizing:border-box; }
        .pw img { max-width:100%; display:block; }
        .pw p, .pw h1, .pw h2, .pw h3, .pw span, .pw td, .pw th { overflow-wrap:break-word; word-break:break-word; }
        .pw a:focus-visible, .pw button:focus-visible { outline:2px solid var(--gold); outline-offset:3px; }
        .pw-serif { font-family:'Cormorant Garamond',Georgia,serif; }
        .pw-script { font-family:'Great Vibes',cursive; font-weight:400; }
        @media (max-width:720px){ .pw { padding-bottom:96px; } }

        .pw-page { max-width:1120px; margin:0 auto; display:flex; flex-direction:column; gap:14px; }
        .pw-card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:18px 20px; }

        /* gold gradient figure text */
        .pw-goldtx { background:linear-gradient(180deg,#f4e2a4 0%,#d9b558 55%,#a8842f 100%);
          -webkit-background-clip:text; background-clip:text; color:transparent; }

        /* section header: icon square + title + hairline */
        .pw-shd { display:flex; align-items:center; gap:10px; margin-bottom:16px; }
        .pw-shd-ic { width:30px; height:30px; flex:none; border:1px solid var(--goldline); border-radius:7px;
          color:var(--gold); display:flex; align-items:center; justify-content:center; background:#fbf5e6; }
        .pw-shd-t { font-size:13px; font-weight:700; letter-spacing:.18em; text-transform:uppercase; color:var(--navy); }
        .pw-shd-line { flex:1; height:1px; background:linear-gradient(90deg,var(--goldline),transparent); }

        /* ═ HERO HEADER ═ */
        .pw-hero { position:relative; border-radius:14px; overflow:hidden; background:var(--navy2); min-height:300px;
          display:flex; align-items:stretch; }
        .pw-hero-img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
        .pw-hero-scrim { position:absolute; inset:0;
          background:linear-gradient(100deg,rgba(16,26,48,0.95) 0%,rgba(16,26,48,0.82) 34%,rgba(16,26,48,0.28) 62%,rgba(16,26,48,0.55) 100%); }
        .pw-hero-in { position:relative; z-index:1; width:100%; padding:clamp(20px,4vw,34px);
          display:flex; justify-content:space-between; gap:20px; flex-wrap:wrap; }
        .pw-crest { width:52px; height:52px; border:1.5px solid var(--gold2); border-radius:10px; transform:rotate(45deg);
          display:flex; align-items:center; justify-content:center; margin:4px 0 14px 4px; background:rgba(20,31,56,0.5); }
        .pw-crest span { transform:rotate(-45deg); font-family:'Cormorant Garamond',serif; font-size:26px; color:var(--gold2); line-height:1; }
        .pw-hero-logo { height:52px; width:auto; border-radius:10px; margin-bottom:14px; }
        .pw-hero-co { font-size:clamp(20px,3.4vw,30px); font-weight:600; letter-spacing:.22em; text-transform:uppercase; color:#fff; margin:0; }
        .pw-hero-tag { font-size:10.5px; font-weight:600; letter-spacing:.3em; text-transform:uppercase; color:var(--gold2); margin:5px 0 0; }
        .pw-hero-title { font-size:clamp(30px,6vw,48px); font-weight:600; color:#fff; margin:20px 0 0; line-height:1.05; letter-spacing:.02em; }
        .pw-hero-script { font-size:clamp(20px,3.4vw,28px); color:var(--gold2); margin:8px 0 0; }
        .pw-hero-panel { align-self:flex-start; min-width:250px; background:rgba(16,25,46,0.72); backdrop-filter:blur(8px);
          border:1px solid rgba(233,205,131,0.45); border-radius:12px; padding:14px 16px; }
        .pw-hp-row { display:flex; justify-content:space-between; gap:14px; padding:7px 0; border-bottom:1px solid rgba(233,205,131,0.18); }
        .pw-hp-row:last-of-type { border-bottom:0; }
        .pw-hp-l { display:flex; align-items:center; gap:8px; font-size:10.5px; font-weight:600; letter-spacing:.1em;
          text-transform:uppercase; color:rgba(244,236,214,0.75); }
        .pw-hp-l svg { color:var(--gold2); }
        .pw-hp-v { font-size:12.5px; font-weight:600; color:#fff; text-align:right; }
        .pw-hp-pdf { display:inline-flex; width:100%; justify-content:center; margin-top:11px; padding:9px 12px;
          border:1px solid var(--gold2); border-radius:8px; color:var(--gold2); font-size:10.5px; font-weight:700;
          letter-spacing:.16em; text-transform:uppercase; text-decoration:none; transition:all .2s; }
        .pw-hp-pdf:hover { background:var(--gold2); color:var(--navy2); }
        @media (max-width:760px){ .pw-hero-panel { width:100%; } }

        /* ═ TRI INFO STRIP ═ */
        .pw-tri { display:grid; grid-template-columns:1.1fr 1.3fr 1.1fr; gap:0; padding:6px 0; }
        .pw-tri > div { padding:12px 20px; border-right:1px solid var(--hair); min-width:0; }
        .pw-tri > div:last-child { border-right:0; }
        .pw-tri-h { display:flex; align-items:center; gap:8px; font-size:11px; font-weight:700; letter-spacing:.18em;
          text-transform:uppercase; color:var(--gold); margin:0 0 10px; }
        .pw-tri-name { font-family:'Cormorant Garamond',serif; font-size:21px; font-weight:600; color:var(--navy); margin:0 0 3px; }
        .pw-tri-sub { font-size:12.5px; color:var(--soft); margin:0 0 2px; }
        .pw-irow { display:flex; gap:9px; align-items:flex-start; margin-bottom:9px; }
        .pw-irow:last-child { margin-bottom:0; }
        .pw-irow-ic { color:var(--gold); flex:none; margin-top:2px; }
        .pw-lab { font-size:9.5px; font-weight:700; letter-spacing:.16em; text-transform:uppercase; color:var(--muted); margin:0 0 2px; }
        .pw-val { font-size:13px; font-weight:600; color:var(--ink); }
        @media (max-width:820px){
          .pw-tri { grid-template-columns:1fr; }
          .pw-tri > div { border-right:0; border-bottom:1px solid var(--hair); }
          .pw-tri > div:last-child { border-bottom:0; }
        }

        /* ═ GRAND TOTAL BAND ═ */
        .pw-grand { background:linear-gradient(120deg,var(--navy2),var(--navy)); border:1px solid var(--goldline);
          border-radius:14px; padding:0; overflow:hidden; display:grid; grid-template-columns:1fr auto 1fr minmax(220px,300px); align-items:center; }
        .pw-g-cell { padding:24px 26px; }
        .pw-g-lab { font-size:11px; font-weight:700; letter-spacing:.24em; text-transform:uppercase; color:var(--gold2); margin:0 0 8px; }
        .pw-g-fig { font-family:'Cormorant Garamond',serif; font-size:clamp(34px,5.4vw,52px); font-weight:700; line-height:1; margin:0; }
        .pw-g-words { font-size:11px; color:rgba(244,236,214,0.6); margin:9px 0 0; letter-spacing:.04em; }
        .pw-badge { width:120px; height:120px; border-radius:50%; border:1px solid var(--gold2); position:relative; flex:none;
          display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; color:var(--gold2);
          margin:20px 6px; }
        .pw-badge::before { content:''; position:absolute; inset:6px; border-radius:50%; border:1px solid rgba(233,205,131,0.5); }
        .pw-badge span { position:relative; font-size:8.4px; font-weight:700; letter-spacing:.18em; text-transform:uppercase;
          line-height:1.7; max-width:86px; }
        .pw-badge svg { position:relative; margin-bottom:4px; }
        .pw-g-img { align-self:stretch; position:relative; min-height:180px; border-left:1px solid var(--goldline); }
        .pw-g-img .pw-zoom, .pw-g-img img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
        .pw-g-quote { position:absolute; right:12px; bottom:10px; left:12px; z-index:1; text-align:right;
          font-size:17px; color:#fff; text-shadow:0 2px 10px rgba(0,0,0,0.65); }
        @media (max-width:900px){
          .pw-grand { grid-template-columns:1fr 1fr; }
          .pw-badge { display:none; }
          .pw-g-img { grid-column:1 / -1; border-left:0; border-top:1px solid var(--goldline); min-height:150px; }
        }
        @media (max-width:560px){ .pw-grand { grid-template-columns:1fr; } .pw-g-cell { padding:20px 22px 6px; } .pw-g-cell + .pw-g-cell { padding-top:0; padding-bottom:20px; } }

        /* ═ ITINERARY TIMELINE ═ */
        .pw-tl { display:flex; overflow-x:auto; gap:0; padding-bottom:6px; scrollbar-width:thin; }
        .pw-tl-cell { min-width:150px; flex:1; padding:10px 12px 12px; border-right:1px dashed var(--line); text-align:center; }
        .pw-tl-cell:last-child { border-right:0; }
        .pw-tl-date { font-size:11px; font-weight:700; letter-spacing:.14em; color:var(--navy); }
        .pw-tl-date b { font-size:15px; }
        .pw-tl-ic { width:38px; height:38px; margin:10px auto; border:1px solid var(--goldline); border-radius:50%;
          color:var(--gold); display:flex; align-items:center; justify-content:center; background:#fbf5e6; }
        .pw-tl-t { font-size:11.5px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--navy); margin:0 0 3px; }
        .pw-tl-s { font-size:11px; color:var(--soft); margin:0; line-height:1.5; }
        .pw-tl-img { margin-top:11px; }
        .pw-tl-img img { width:100%; height:88px; object-fit:cover; border-radius:8px; }
        .pw-zoom { border:0; padding:0; background:none; cursor:zoom-in; display:block; width:100%; font:inherit; color:inherit; }

        /* ═ TABLES (hotels / flights) ═ */
        .pw-twrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
        .pw-tbl { width:100%; border-collapse:collapse; min-width:640px; }
        .pw-tbl th { background:var(--navy); color:#f2ead4; font-size:9.5px; font-weight:700; letter-spacing:.14em;
          text-transform:uppercase; text-align:left; padding:11px 12px; white-space:nowrap; }
        .pw-tbl td { padding:11px 12px; border-bottom:1px solid var(--hair); font-size:12.5px; color:var(--soft); vertical-align:middle; }
        .pw-tbl tr:last-child td { border-bottom:0; }
        .pw-tbl td b { color:var(--ink); font-weight:600; }
        .pw-stars { color:var(--gold); letter-spacing:2px; font-size:12px; }
        .pw-tbl .pw-thumb img { width:66px; height:48px; object-fit:cover; border-radius:6px; }

        /* ═ SERVICES SUMMARY ═ */
        .pw-svc { display:grid; grid-template-columns:repeat(auto-fit,minmax(112px,1fr)); gap:10px; }
        .pw-svc-i { text-align:center; padding:14px 8px; border:1px solid var(--hair); border-radius:10px; background:#fdfaf1; }
        .pw-svc-ic { width:38px; height:38px; margin:0 auto 8px; border:1px solid var(--goldline); border-radius:50%;
          color:var(--gold); display:flex; align-items:center; justify-content:center; }
        .pw-svc-l { font-size:10.5px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--navy); margin:0 0 2px; }
        .pw-svc-s { font-size:10px; color:var(--muted); margin:0; line-height:1.4; }

        /* ═ INC / EXC + generic bullets ═ */
        .pw-2col { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
        @media (max-width:720px){ .pw-2col { grid-template-columns:1fr; } }
        .pw-bul { display:flex; gap:9px; align-items:flex-start; font-size:12.5px; color:var(--soft); padding:4px 0; line-height:1.6; }
        .pw-bul-m { flex:none; font-weight:800; }
        .pw-gold { color:var(--gold); } .pw-greenc { color:var(--green); } .pw-red { color:var(--red); }
        .pw-subhead { display:flex; align-items:center; gap:8px; font-size:11px; font-weight:700; letter-spacing:.16em;
          text-transform:uppercase; margin:0 0 8px; }
        .pw-subhead svg { flex:none; }

        /* ═ PHOTO GRIDS (sightseeing / vehicles) ═ */
        .pw-pgrid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:12px; }
        .pw-pcard img { width:100%; height:110px; object-fit:cover; border-radius:9px; }
        .pw-pc-t { font-size:11.5px; font-weight:700; color:var(--navy); margin:8px 0 1px; letter-spacing:.03em; }
        .pw-pc-s { font-size:10.5px; color:var(--muted); margin:0; text-transform:uppercase; letter-spacing:.08em; }
        /* Vehicle rows: full un-cropped photo on the left (object-fit:contain — vehicle
           cutouts must never be cropped), details on the right. */
        .pw-vgrid { display:grid; grid-template-columns:1fr; gap:12px; }
        .pw-vcard { border:1px solid var(--hair); border-radius:10px; overflow:hidden; background:#fdfaf1;
          display:flex; align-items:stretch; }
        .pw-vcard .pw-zoom { flex:none; width:150px; background:#f5eeda; display:flex; align-items:center; justify-content:center; }
        .pw-vcard img { width:100%; height:110px; object-fit:contain; padding:6px; }
        .pw-vc-b { padding:12px 14px; text-align:left; min-width:0; align-self:center; }
        @media (max-width:420px){
          .pw-vcard { flex-direction:column; }
          .pw-vcard .pw-zoom { width:100%; }
        }

        /* ═ BOTTOM MONEY GRID ═ */
        .pw-money { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:14px; }
        .pw-mline { display:flex; justify-content:space-between; gap:12px; padding:6px 0; font-size:13px; color:var(--soft);
          border-bottom:1px solid var(--hair); }
        .pw-mline:last-of-type { border-bottom:0; }
        .pw-mline b { color:var(--ink); font-weight:600; font-variant-numeric:tabular-nums; }
        .pw-mline .pw-neg { color:var(--green); }
        .pw-mbar { margin-top:12px; background:var(--navy); border-radius:9px; padding:11px 15px;
          display:flex; justify-content:space-between; align-items:center; gap:10px; }
        .pw-mbar span { font-size:11px; font-weight:700; letter-spacing:.16em; text-transform:uppercase; color:#f2ead4; }
        .pw-mbar b { font-family:'Cormorant Garamond',serif; font-size:20px; font-weight:700; }

        /* ═ POLICIES ═ */
        .pw-pol { display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:20px; }
        .pw-pol-i { display:flex; gap:9px; align-items:flex-start; font-size:12px; color:var(--soft); padding:3.5px 0; line-height:1.65; }
        .pw-pol-i span:first-child { color:var(--gold); font-weight:700; flex:none; }

        /* ═ FOOTER ═ */
        .pw-foot { background:linear-gradient(120deg,var(--navy2),var(--navy)); border:1px solid var(--goldline);
          border-radius:14px; padding:22px 26px; color:#f2ead4; display:flex; flex-wrap:wrap; gap:22px;
          align-items:center; justify-content:space-between; }
        .pw-foot-thanks { max-width:250px; font-size:10.5px; font-weight:600; letter-spacing:.14em; text-transform:uppercase;
          line-height:1.9; color:rgba(244,236,214,0.75); }
        .pw-foot-script { font-size:clamp(22px,3.4vw,30px); color:var(--gold2); text-align:center; line-height:1.4; flex:1; min-width:220px; }
        .pw-foot-c { font-size:12.5px; line-height:2; text-align:right; }
        .pw-foot-c a { color:#fff; text-decoration:none; }
        .pw-qr { display:flex; align-items:center; gap:10px; justify-content:flex-end; margin-top:8px; }
        .pw-qr img { width:64px; height:64px; background:#fff; padding:4px; border-radius:8px; }
        .pw-qr span { font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:rgba(244,236,214,0.7); max-width:80px; text-align:left; line-height:1.6; }
        .pw-foot-fine { text-align:center; font-size:10.5px; color:var(--muted); letter-spacing:.06em; padding:4px 8px 14px; }
        @media (max-width:820px){ .pw-foot { flex-direction:column; text-align:center; } .pw-foot-thanks,.pw-foot-c { max-width:none; text-align:center; } .pw-qr { justify-content:center; } }

        /* ═ DOCK + LIGHTBOX ═ */
        .pw-dock { position:fixed; left:0; right:0; bottom:0; z-index:60; display:flex; gap:10px;
          padding:10px 14px calc(10px + env(safe-area-inset-bottom));
          background:rgba(253,251,244,0.95); backdrop-filter:blur(10px); border-top:1px solid var(--line); }
        .pw-btn { flex:1; display:inline-flex; align-items:center; justify-content:center; gap:7px; padding:13px 12px;
          border:1px solid var(--navy); border-radius:9px; color:var(--navy); background:transparent; font-size:11px;
          font-weight:700; letter-spacing:.14em; text-transform:uppercase; text-decoration:none; transition:all .2s; }
        .pw-btn:hover { background:var(--navy); color:#f2ead4; }
        .pw-btn-solid { background:var(--navy); color:#f2ead4; }
        .pw-btn-solid:hover { background:var(--navy2); }
        @media (min-width:721px){ .pw-dock { display:none; } }
        .pw-lb { position:fixed; inset:0; z-index:90; display:flex; align-items:center; justify-content:center;
          padding:24px; background:rgba(16,25,46,0.94); cursor:zoom-out; }
        .pw-lb img { max-width:100%; max-height:88vh; border:1px solid var(--gold2); padding:4px; background:var(--card); border-radius:6px; }

        @media (prefers-reduced-motion:reduce){
          .pw *, .pw *::before, .pw *::after { animation:none !important; transition:none !important; }
        }
        @media print {
          .pw-dock, .pw-lb, .pw-hp-pdf { display:none !important; }
          html, body, .pw { background:#fff; }
          .pw { padding:0; }
          .pw-card, .pw-hero, .pw-grand, .pw-foot { break-inside:avoid; border-radius:0; }
        }
      `}</style>

      <div className="pw-page">

        {/* ━━━ HERO HEADER ━━━ */}
        <header className="pw-hero">
          {heroImg && <img className="pw-hero-img" src={cdn(heroImg, HERO)} alt="" />}
          <div className="pw-hero-scrim" />
          <div className="pw-hero-in">
            <div style={{ minWidth: 0, maxWidth: 640 }}>
              {(company.logo || company.logoUrl)
                ? <img className="pw-hero-logo" src={company.logo || company.logoUrl} alt={company.name || ""} />
                : <div className="pw-crest"><span>{(company.name || q.title || "T").charAt(0)}</span></div>}
              <h1 className="pw-serif pw-hero-co">{company?.name || "Travel Company"}</h1>
              {(company.tagline || company.companyTagline) && (
                <p className="pw-hero-tag">{company.tagline || company.companyTagline}</p>
              )}
              <h2 className="pw-serif pw-hero-title">Public Quotation</h2>
              <p className="pw-script pw-hero-script">{q.title || "Crafted Experiences. Cherished Memories."}</p>
            </div>

            <aside className="pw-hero-panel">
              <div className="pw-hp-row">
                <span className="pw-hp-l"><IcoDoc size={13} /> Quotation No.</span>
                <span className="pw-hp-v">{q.quoteNo ? `#${q.quoteNo}` : "—"}</span>
              </div>
              <div className="pw-hp-row">
                <span className="pw-hp-l"><IcoCal size={13} /> Quotation Date</span>
                <span className="pw-hp-v">{fmtDate(q.createdAt)}</span>
              </div>
              {validTill && (
                <div className="pw-hp-row">
                  <span className="pw-hp-l"><IcoShield size={13} /> Valid Till</span>
                  <span className="pw-hp-v">{fmtDate(validTill)}</span>
                </div>
              )}
              {pdfUrl && <a className="pw-hp-pdf" href={pdfUrl} target="_blank" rel="noreferrer">Download PDF</a>}
            </aside>
          </div>
        </header>

        {/* ━━━ PREPARED FOR | TRIP OVERVIEW | PREPARED BY ━━━ */}
        <section className="pw-card" style={{ padding: "8px 0" }}>
          <div className="pw-tri">
            <div>
              <p className="pw-tri-h"><IcoUser size={14} /> Prepared For</p>
              <p className="pw-tri-name">{c.name || "Guest"}</p>
              {custEmail && <p className="pw-tri-sub">{custEmail}</p>}
              {custPhone && <p className="pw-tri-sub">{custPhone}</p>}
            </div>
            <div>
              <p className="pw-tri-h"><IcoRoute size={14} /> Trip Overview</p>
              {destStr && (
                <InfoRow Ico={IcoPin} label="Destination">{destStr}</InfoRow>
              )}
              <InfoRow Ico={IcoCal} label="Travel Dates">
                {fmtDate(c.travelDate)}
                {(q.nights != null || q.days != null) && (
                  <span style={{ color: "var(--soft)", fontWeight: 500 }}>
                    {"  "}({q.nights ?? "—"} Nights / {q.days ?? "—"} Days)
                  </span>
                )}
              </InfoRow>
              {paxStr && <InfoRow Ico={IcoUsers} label="Travelers">{paxStr}</InfoRow>}
            </div>
            <div>
              <p className="pw-tri-h"><IcoUser size={14} /> Prepared By</p>
              <p className="pw-tri-name">{preparedBy || company.name || "—"}</p>
              {preparedBy && <p className="pw-tri-sub">Travel Consultant</p>}
              {companyPhone && <p className="pw-tri-sub" style={{ marginTop: 8 }}>{companyPhone}</p>}
              {companyEmail && <p className="pw-tri-sub">{companyEmail}</p>}
            </div>
          </div>
        </section>

        {/* ━━━ GRAND TOTAL BAND ━━━ */}
        {grand != null && (
          <section className="pw-grand">
            <div className="pw-g-cell">
              <p className="pw-g-lab">Grand Total</p>
              <p className="pw-serif pw-g-fig pw-goldtx">{inr(grand)}</p>
              {grandWords && <p className="pw-g-words">{grandWords}</p>}
            </div>
            <div className="pw-badge" aria-hidden="true">
              <IcoCrown size={18} />
              <span>Thank you for choosing {(company.name || "us").split(" ")[0]}</span>
            </div>
            <div className="pw-g-cell">
              <p className="pw-g-lab">Price Per Adult</p>
              <p className="pw-serif pw-g-fig pw-goldtx" style={{ fontSize: "clamp(26px,4vw,38px)" }}>
                {perAdult != null ? inr(perAdult) : "—"}
              </p>
              <p className="pw-g-words">(Approx. · inclusive of all taxes)</p>
            </div>
            {bandImg && (
              <div className="pw-g-img">
                <ZoomImg src={cdn(bandImg, BAND)} alt={destStr || "Destination"} onZoom={z(bandImg, destStr)} hideSel=".pw-g-img" />
                <p className="pw-script pw-g-quote">A journey through iconic destinations, timeless beauty and unforgettable moments.</p>
              </div>
            )}
          </section>
        )}

        {/* ━━━ ITINERARY HIGHLIGHTS ━━━ */}
        {days.length > 0 && (
          <section className="pw-card">
            <SecHead Ico={IcoDoc} title="Itinerary Highlights" />
            <div className="pw-tl">
              {days.map((d, i) => {
                const firstAct = (d.activities || [])[0] || {};
                const dm = dayMon(d.date);
                const Ic = dayIcon(i, days.length);
                const img = (d.activities || []).map(actImg).find(Boolean);
                return (
                  <div key={i} className="pw-tl-cell">
                    <p className="pw-tl-date">{dm ? <><b>{dm.day}</b> {dm.mon}</> : <><b>{pad2(d.day)}</b> DAY</>}</p>
                    <div className="pw-tl-ic"><Ic size={17} /></div>
                    <p className="pw-tl-t">{firstAct.attraction || d.title || `Day ${d.day}`}</p>
                    {(firstAct.description || d.location) && (
                      <p className="pw-tl-s">
                        {(d.location || "")}
                        {d.location && (d.activities || []).length > 1 ? " · " : ""}
                        {(d.activities || []).length > 1 ? `${d.activities.length} activities` : ""}
                      </p>
                    )}
                    {img && (
                      <div className="pw-tl-img">
                        <ZoomImg src={cdn(img, STRIP)} alt={firstAct.attraction} onZoom={z(img, firstAct.attraction)} hideSel=".pw-tl-img" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ━━━ FLIGHT DETAILS (table — only when the section exists) ━━━ */}
        {segments.length > 0 && (
          <section className="pw-card">
            <SecHead Ico={IcoPlane} title="Flight Details" />
            <div className="pw-twrap">
              <table className="pw-tbl">
                <thead><tr>
                  <th>Airline</th><th>Flight</th><th>Route</th><th>Departs</th><th>Arrives</th><th>Class</th>
                </tr></thead>
                <tbody>
                  {segments.map((seg, i) => (
                    <tr key={i}>
                      <td><b>{seg.airline || "—"}</b></td>
                      <td>{seg.flightNo || "—"}</td>
                      <td><b>{seg.from || "—"} → {seg.to || "—"}</b></td>
                      <td>{[seg.depDate, seg.depTime].filter(Boolean).join(" · ") || "—"}</td>
                      <td>{[seg.arrDate, seg.arrTime].filter(Boolean).join(" · ") || "—"}</td>
                      <td>{seg.class || seg.travelClass || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ━━━ INCLUSIONS SUMMARY + INC/EXC ━━━ */}
        {(svcRow.length > 0 || q.inclusions?.length || q.exclusions?.length) && (
          <section className="pw-card">
            {svcRow.length > 0 && (
              <>
                <SecHead Ico={IcoShield} title="Inclusions Summary" />
                <div className="pw-svc" style={{ marginBottom: (q.inclusions?.length || q.exclusions?.length) ? 20 : 0 }}>
                  {svcRow.map((s, i) => (
                    <div key={i} className="pw-svc-i">
                      <div className="pw-svc-ic"><s.Ico size={16} /></div>
                      <p className="pw-svc-l">{s.label}</p>
                      <p className="pw-svc-s">{s.sub}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
            {(q.inclusions?.length || q.exclusions?.length) ? (
              <div className="pw-2col">
                {q.inclusions?.length > 0 && (
                  <div>
                    <p className="pw-subhead" style={{ color: "var(--green)" }}><IcoShield size={13} /> Inclusions</p>
                    {q.inclusions.map((it, i) => <Bullet key={i} tone="greenc">{it}</Bullet>)}
                  </div>
                )}
                {q.exclusions?.length > 0 && (
                  <div>
                    <p className="pw-subhead" style={{ color: "var(--red)" }}><IcoDoc size={13} /> Exclusions</p>
                    {q.exclusions.map((it, i) => <Bullet key={i} tone="red">{it}</Bullet>)}
                  </div>
                )}
              </div>
            ) : null}
          </section>
        )}

        {/* ━━━ HOTEL STAY DETAILS ━━━ */}
        {hotels.length > 0 && (
          <section className="pw-card">
            <SecHead Ico={IcoHotel} title="Hotel Stay Details" />
            <div className="pw-twrap">
              <table className="pw-tbl">
                <thead><tr>
                  <th>Destination</th><th>Hotel Name</th><th>Category</th><th>Nights</th><th>Room Type</th><th>Meals</th><th>Image</th>
                </tr></thead>
                <tbody>
                  {hotels.map((h, i) => {
                    const img = hotelImg(h);
                    const nights = h.nights ?? diffNights(h.checkIn, h.checkOut);
                    return (
                      <tr key={i}>
                        <td>{[h.city, h.country].filter(Boolean).join(", ") || "—"}</td>
                        <td><b>{h.name || "—"}</b></td>
                        <td>{h.stars ? <Stars count={h.stars} /> : "—"}</td>
                        <td>{nights ?? "—"}</td>
                        <td>{h.roomType || "—"}</td>
                        <td>{h.mealPlan || "—"}</td>
                        <td className="pw-thumb">
                          {img
                            ? <ZoomImg src={cdn(img, THUMB)} alt={h.name} onZoom={z(img, h.name)} />
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ━━━ SIGHTSEEING + VEHICLES ━━━ */}
        {(sightCards.length > 0 || vehicles.length > 0) && (
          <div className="pw-2col" style={{ alignItems: "start" }}>
            {sightCards.length > 0 && (
              <section className="pw-card">
                <SecHead Ico={IcoCamera} title="Sightseeing Included" />
                <div className="pw-pgrid">
                  {sightCards.map((s, i) => (
                    <div key={i} className="pw-pcard">
                      <ZoomImg src={cdn(s.img, CARD)} alt={s.name} onZoom={z(s.img, s.name)} hideSel=".pw-pcard" />
                      <p className="pw-pc-t">{s.name}</p>
                      {s.city && <p className="pw-pc-s">{s.city}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}
            {vehicles.length > 0 && (
              <section className="pw-card">
                <SecHead Ico={IcoCar} title="Vehicle Details" />
                <div className="pw-vgrid">
                  {vehicles.map((v, i) => {
                    const img = vehImg(v);
                    return (
                      <div key={i} className="pw-vcard">
                        {img && <ZoomImg src={cdn(img, VEH)} alt={v.model || v.type} onZoom={z(img, v.model || v.type)} />}
                        <div className="pw-vc-b">
                          <p className="pw-pc-t">{v.model || v.type || "Vehicle"}</p>
                          <p className="pw-pc-s">
                            {[v.model && v.type ? v.type : null,
                              v.capacity ? `${v.capacity} Pax` : null,
                              v.qty ? `× ${v.qty}` : null].filter(Boolean).join("  ·  ") || " "}
                          </p>
                          {(v.pickup || v.drop) && (
                            <p className="pw-pc-s" style={{ marginTop: 3, textTransform: "none", letterSpacing: 0 }}>
                              {[v.pickup, v.drop].filter(Boolean).join(" → ")}
                            </p>
                          )}
                          {/* Dates + notes: the DTO carries these (Classic/Modern show them),
                              this card used to drop them silently. */}
                          {(v.startDate || v.endDate) && (
                            <p className="pw-pc-s" style={{ marginTop: 3, textTransform: "none", letterSpacing: 0 }}>
                              {fmtDate(v.startDate)}{v.endDate ? ` → ${fmtDate(v.endDate)}` : ""}
                            </p>
                          )}
                          {v.notes && (
                            <p className="pw-pc-s" style={{ marginTop: 5, textTransform: "none", letterSpacing: 0, fontStyle: "italic", lineHeight: 1.5 }}>
                              {v.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ━━━ CRUISE (ledger — only when present) ━━━ */}
        {cruises.length > 0 && (
          <section className="pw-card">
            <SecHead Ico={IcoBoat} title="Cruise Details" />
            <div className="pw-twrap">
              <table className="pw-tbl">
                <thead><tr><th>Cruise</th><th>Cabin</th><th>Nights</th><th>Route</th><th>Departs</th></tr></thead>
                <tbody>
                  {cruises.map((cr, i) => (
                    <tr key={i}>
                      <td><b>{cr.name || "—"}</b></td>
                      <td>{cr.cabin || "—"}</td>
                      <td>{cr.nights ?? "—"}</td>
                      <td>{[cr.depPort, cr.arrPort].filter(Boolean).join(" → ") || "—"}</td>
                      <td>{cr.depDate ? fmtDate(cr.depDate) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ━━━ MONEY GRID: PRICE / PAYMENT / ADD-ONS / PASSENGERS ━━━ */}
        {(hasPricing || addonItems.length > 0) && (
          <div className="pw-money">
            {hasPricing && (
              <section className="pw-card">
                <SecHead Ico={IcoDoc} title="Price Summary" />
                {totals.subtotal != null && <div className="pw-mline"><span>Subtotal</span><b>{inr(totals.subtotal)}</b></div>}
                {totals.taxAmount > 0 && <div className="pw-mline"><span>Taxes {totals.taxPercent ? `(${totals.taxPercent}%)` : "& Fees"}</span><b>{inr(totals.taxAmount)}</b></div>}
                {q.addons?.included && q.addons.amount > 0 && <div className="pw-mline"><span>Add-ons</span><b>{inr(q.addons.amount)}</b></div>}
                {totals.discountAmount > 0 && <div className="pw-mline"><span>Discount</span><b className="pw-neg">− {inr(totals.discountAmount)}</b></div>}
                {/* NO markup row, ever — the public DTO omits the agency margin on purpose.
                    This is the customer-facing page. Do not re-add it. */}
                <div className="pw-mbar"><span>Grand Total</span><b className="pw-goldtx">{inr(grand)}</b></div>
              </section>
            )}

            {(bookingAmount != null || paySchedule.length > 0 || q.paymentPolicies?.length > 0) && (
              <section className="pw-card">
                <SecHead Ico={IcoCal} title="Payment Schedule" />
                {bookingAmount != null && (
                  <div className="pw-mline"><span>Booking Amount<br /><small style={{ color: "var(--muted)" }}>Upon confirmation</small></span><b>{inr(bookingAmount)}</b></div>
                )}
                {paySchedule.map((p, i) => (
                  <div key={i} className="pw-mline">
                    <span>{p.label || p.name || `Installment ${i + 1}`}{p.dueDate ? <><br /><small style={{ color: "var(--muted)" }}>On or before {fmtDate(p.dueDate)}</small></> : null}</span>
                    <b>{inr(p.amount ?? p.value)}</b>
                  </div>
                ))}
                {paySchedule.length === 0 && (q.paymentPolicies || []).slice(0, 4).map((p, i) => (
                  <div key={i} className="pw-pol-i"><span>{pad2(i + 1)}.</span><span>{p}</span></div>
                ))}
                {grand != null && <div className="pw-mbar"><span>Total Amount</span><b className="pw-goldtx">{inr(grand)}</b></div>}
              </section>
            )}

            {addonItems.length > 0 && (
              <section className="pw-card">
                <SecHead Ico={IcoShield} title="Add-Ons" />
                {addonItems.map((a, i) => {
                  const amt = a.amount ?? a.price ?? a.total;
                  return (
                    <div key={i} className="pw-mline">
                      <span>{a.serviceType || "Service"}{a.quantity ? `  × ${a.quantity}` : ""}</span>
                      <b>{amt != null ? inr(amt) : ""}</b>
                    </div>
                  );
                })}
                {q.addons?.amount > 0 && <div className="pw-mbar"><span>Total Add-Ons</span><b className="pw-goldtx">{inr(q.addons.amount)}</b></div>}
              </section>
            )}

            <section className="pw-card">
              <SecHead Ico={IcoUsers} title="Passenger Details" />
              {c.adults   ? <div className="pw-mline"><span>Adults</span><b>{c.adults}</b></div> : null}
              {c.children ? <div className="pw-mline"><span>Children</span><b>{c.children}</b></div> : null}
              {c.infants  ? <div className="pw-mline"><span>Infants</span><b>{c.infants}</b></div> : null}
              {(q.rooms || c.rooms) ? <div className="pw-mline"><span>Rooms</span><b>{q.rooms || c.rooms}</b></div> : null}
              {perAdult != null && (
                <div className="pw-mbar"><span>Price Per Adult</span><b className="pw-goldtx">{inr(perAdult)}</b></div>
              )}
            </section>
          </div>
        )}

        {/* ━━━ POLICIES & TERMS ━━━ */}
        {(q.paymentPolicies?.length || q.cancellationPolicies?.length || q.bookingTerms?.length || importantNotes.length) ? (
          <section className="pw-card">
            <SecHead Ico={IcoDoc} title="Policies & Terms" />
            <div className="pw-pol">
              {q.paymentPolicies?.length > 0 && (
                <div>
                  <p className="pw-subhead" style={{ color: "var(--navy)" }}><IcoCal size={13} /> Payment Policy</p>
                  {q.paymentPolicies.map((p, i) => <div key={i} className="pw-pol-i"><span>›</span><span>{p}</span></div>)}
                </div>
              )}
              {q.cancellationPolicies?.length > 0 && (
                <div>
                  <p className="pw-subhead" style={{ color: "var(--navy)" }}><IcoShield size={13} /> Cancellation Policy</p>
                  {q.cancellationPolicies.map((p, i) => <div key={i} className="pw-pol-i"><span>›</span><span>{p}</span></div>)}
                </div>
              )}
              {q.bookingTerms?.length > 0 && (
                <div>
                  <p className="pw-subhead" style={{ color: "var(--navy)" }}><IcoDoc size={13} /> Terms & Conditions</p>
                  {q.bookingTerms.map((t, i) => <div key={i} className="pw-pol-i"><span>›</span><span>{t}</span></div>)}
                </div>
              )}
              {importantNotes.length > 0 && (
                <div>
                  <p className="pw-subhead" style={{ color: "var(--navy)" }}><IcoPin size={13} /> Important Notes</p>
                  {importantNotes.map((t, i) => <div key={i} className="pw-pol-i"><span>›</span><span>{t}</span></div>)}
                </div>
              )}
            </div>
          </section>
        ) : null}

        {/* ━━━ FOOTER ━━━ */}
        <footer className="pw-foot">
          <p className="pw-foot-thanks">
            We thank you once again for giving us the opportunity to plan your holiday.
          </p>
          <p className="pw-script pw-foot-script">
            We look forward to welcoming you on this memorable journey.
          </p>
          <div className="pw-foot-c">
            {companyPhone && <div><IcoPhone size={12} /> <a href={callHref}>{companyPhone}</a></div>}
            {(company.website || q.companyWebsite) && <div>{company.website || q.companyWebsite}</div>}
            {company.address && <div style={{ color: "rgba(244,236,214,0.7)", whiteSpace: "pre-line" }}>{company.address}</div>}
            {pageUrl && (
              <div className="pw-qr qrwrap">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=6&data=${encodeURIComponent(pageUrl)}`}
                  alt="QR code for this quotation"
                  loading="lazy"
                  onError={(e) => { const w = e.currentTarget.closest(".qrwrap"); if (w) w.style.display = "none"; }}
                />
                <span>Scan to view on mobile</span>
              </div>
            )}
          </div>
        </footer>

        <p className="pw-foot-fine">
          © {new Date().getFullYear()} {company.name || "Travel Company"} · All rights reserved
          {company.gst ? ` · GST: ${company.gst}` : ""}
          {q.quoteNo ? ` · Quote #${q.quoteNo}` : ""}
          {q.createdAt ? ` · Generated ${fmtDate(q.createdAt)}` : ""}
        </p>
      </div>

      {/* ━━━ MOBILE ACTION DOCK ━━━ */}
      {(callHref || waHref) && (
        <nav className="pw-dock" aria-label="Quick actions">
          {waHref && <a className="pw-btn pw-btn-solid" href={waHref} target="_blank" rel="noreferrer">WhatsApp</a>}
          {callHref && <a className="pw-btn" href={callHref}>Call</a>}
          {mailHref && <a className="pw-btn" href={mailHref}>Email</a>}
        </nav>
      )}

      {/* ━━━ LIGHTBOX ━━━ */}
      {zoom && (
        <div className="pw-lb" role="dialog" aria-modal="true" aria-label="Photograph" onClick={() => setZoom(null)}>
          <img src={zoom.src} alt={zoom.alt} />
        </div>
      )}
    </div>
  );
}








