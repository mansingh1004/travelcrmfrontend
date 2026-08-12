


// import React, { useMemo, useEffect, useState } from "react";

// /* ============================================================================
//    MODERN ITINERARY VIEW (Inspired by WeCare Holidays UI)
//    ----------------------------------------------------------------------------
//    Expected prop:
//      <ModernWebView data={q} pdfUrl={pdfUrl} />
//    ========================================================================== */

// const fmtDate = (value, long = false) => {
//   if (!value) return "—";
//   try {
//     return new Date(value).toLocaleDateString(long ? "en-US" : "en-GB",
//       long
//         ? { day: "numeric", month: "long", year: "numeric" }
//         : { day: "2-digit", month: "short", year: "numeric" }
//     );
//   } catch {
//     return value;
//   }
// };

// const getDayMonth = (value) => {
//   if (!value) return { day: "", month: "" };
//   try {
//     const d = new Date(value);
//     return {
//       day: d.getDate(),
//       month: d.toLocaleString('en-US', { month: 'short' }).toUpperCase()
//     };
//   } catch {
//     return { day: "", month: "" };
//   }
// };

// const inr = (value) => {
//   if (value == null || value === "") return "—";
//   const n = Number(value);
//   return Number.isFinite(n)
//     ? `₹${n.toLocaleString("en-IN")}`
//     : String(value);
// };

// const cleanPhone = (value = "") => String(value).replace(/\D/g, "");
// const first = (...values) => values.find((v) => v !== undefined && v !== null && v !== "") || "";

// const hotelImg = (h = {}) => first(h.imageUrl, h.imagePath, h.image, h.photo, h.coverImage, h.hotelImage, h.img, Array.isArray(h.images) ? h.images[0] : "");
// const activityImg = (a = {}) => first(a.imagePath, a.imageUrl, a.image, a.photo, a.coverImage, a.img);

// function Stars({ value = 0 }) {
//   const n = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
//   if (!n) return null;
//   return <span className="wc-stars">{"★".repeat(n)}</span>;
// }

// // Helper to render policy lists consistently
// function renderPolicyList(items) {
//   if (!Array.isArray(items) || !items.length) return <p>Not specified.</p>;
//   return (
//     <ul>
//       {items.map((item, index) => (
//         <li key={index}>{typeof item === "string" ? item : item?.text || item?.description || ""}</li>
//       ))}
//     </ul>
//   );
// }

// export default function LuxuryWebView({ data, pdfUrl }) {
//   const q = data || {};
//   const customer = q.customer || {};
//   const company = q.company || q.organization || {};
//   const totals = q.totals || {};

//   const [isScrolled, setIsScrolled] = useState(false);
//   const [selectedHotel, setSelectedHotel] = useState(null); // State for Hotel Modal

//   useEffect(() => {
//     const handleScroll = () => setIsScrolled(window.scrollY > 400);
//     window.addEventListener("scroll", handleScroll);
//     return () => window.removeEventListener("scroll", handleScroll);
//   }, []);

//   // Prevent background scrolling when modal is open
//   useEffect(() => {
//     if (selectedHotel) {
//       document.body.style.overflow = "hidden";
//     } else {
//       document.body.style.overflow = "auto";
//     }
//   }, [selectedHotel]);

//   const days = q.sightseeing?.included && Array.isArray(q.sightseeing?.days) ? q.sightseeing.days : [];
//   const hotels = q.hotel?.included && Array.isArray(q.hotel?.hotels) ? q.hotel.hotels : [];
  
//   const destinationText = customer.destination || (Array.isArray(q.destinations) ? q.destinations.join(" · ") : "") || q.destination || "Destination";
//   const title = q.title || destinationText;
  
//   const companyPhone = company.phone || company.contactNumber || q.companyPhone || "";
//   const grandTotal = totals.grandTotal ?? q.grandTotal;

//   const paxText = [
//     customer.adults ? `${customer.adults} Adults` : "",
//     customer.children ? `${customer.children} Children` : "",
//   ].filter(Boolean).join(" · ");

//   const dateRangeText = customer.travelDate 
//     ? `${fmtDate(customer.travelDate)} — ${fmtDate(q.endDate || new Date(new Date(customer.travelDate).getTime() + (q.nights || 0)*86400000))}` 
//     : "";

//   const heroImage = useMemo(() => {
//     const firstActivity = days.flatMap((d) => (Array.isArray(d.activities) ? d.activities : [])).find((a) => activityImg(a));
//     return q.coverImageUrl || q.heroImageUrl || q.bannerUrl || activityImg(firstActivity) || hotelImg(hotels[0]) || "https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&q=80&w=2000";
//   }, [q, days, hotels]);

//   const whatsappHref = companyPhone
//     ? `https://wa.me/${cleanPhone(companyPhone)}?text=${encodeURIComponent(`Hello, I have a question about package ${q.quoteNo || ""}`)}`
//     : "";

//   let policyCounter = 4;

//   return (
//     <div className="wc-root">
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap');

//         :root {
//           --brand-teal: #166464;
//           --brand-teal-dark: #0f4a4a;
//           --brand-red: #f84d4d;
//           --brand-red-hover: #e03c3c;
//           --bg-color: #f5f7f8;
//           --text-main: #333333;
//           --text-muted: #666666;
//           --border-light: #e5e7eb;
//           --white: #ffffff;
//         }

//         .wc-root { background: var(--bg-color); color: var(--text-main); font-family: 'Inter', sans-serif; min-height: 100vh; padding-bottom: 100px; }
//         .wc-root * { box-sizing: border-box; margin: 0; padding: 0; }
//         .serif { font-family: 'Playfair Display', serif; }

//         /* Topbar */
//         .wc-topbar { position: fixed; top: 0; left: 0; right: 0; height: 70px; display: flex; align-items: center; justify-content: space-between; padding: 0 40px; background: #fff; z-index: 100; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
//         .wc-logo { font-size: 20px; font-weight: 700; color: var(--brand-teal); display: flex; align-items: center; gap: 10px; }
//         .wc-logo img { height: 40px; }
//         .wc-topbar-actions { display: flex; align-items: center; gap: 20px; }
//         .wc-phone { font-weight: 600; color: var(--brand-teal); text-decoration: none; }
//         .wc-btn-primary { background: var(--brand-red); color: white; padding: 10px 24px; border-radius: 50px; text-decoration: none; font-weight: 600; font-size: 14px; transition: 0.2s; border: none; cursor: pointer; display: inline-block; text-align: center; }
//         .wc-btn-primary:hover { background: var(--brand-red-hover); }

//         /* Hero Section */
//         .wc-hero { position: relative; height: 75vh; min-height: 500px; display: flex; align-items: center; justify-content: center; text-align: center; color: white; margin-top: 70px; }
//         .wc-hero-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
//         .wc-hero-overlay { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.6)); }
//         .wc-hero-content { position: relative; z-index: 2; max-width: 800px; padding: 20px; }
//         .wc-trip-badge { display: inline-block; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.3); color: #fbd38d; padding: 6px 16px; border-radius: 50px; font-size: 12px; font-weight: 600; letter-spacing: 1px; margin-bottom: 20px; }
//         .wc-hero h1 { font-size: 5rem; margin-bottom: 15px; font-weight: 600; }
//         .wc-hero p { font-size: 1.1rem; color: rgba(255,255,255,0.9); margin-bottom: 30px; }
//         .wc-trust-badges { display: flex; justify-content: center; gap: 15px; flex-wrap: wrap; }
//         .wc-trust-badge { background: rgba(255,255,255,0.15); backdrop-filter: blur(5px); padding: 8px 16px; border-radius: 50px; font-size: 12px; display: flex; align-items: center; gap: 8px; border: 1px solid rgba(255,255,255,0.2); }
//         .wc-trust-badge .icon { background: var(--brand-teal); width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 10px; }

//         /* Sticky Summary Bar */
//         .wc-sticky-bar { position: sticky; top: 70px; z-index: 90; background: #fff; border-bottom: 1px solid var(--border-light); padding: 15px 40px; display: flex; justify-content: space-between; align-items: center; transform: translateY(-100%); opacity: 0; transition: all 0.3s ease; }
//         .wc-sticky-bar.visible { transform: translateY(0); opacity: 1; }
//         .wc-sticky-user { display: flex; align-items: center; gap: 15px; }
//         .wc-avatar { width: 40px; height: 40px; background: var(--brand-teal); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; }
//         .wc-sticky-details strong { display: block; font-size: 15px; }
//         .wc-sticky-details span { font-size: 12px; color: var(--text-muted); }
//         .wc-sticky-price { text-align: right; }
//         .wc-sticky-price span { font-size: 11px; text-transform: uppercase; color: var(--text-muted); display: block; }
//         .wc-sticky-price strong { font-size: 22px; color: var(--brand-teal); font-weight: 700; }

//         /* Layout Grid */
//         .wc-container { max-width: 1200px; margin: 40px auto; padding: 0 20px; display: grid; grid-template-columns: 1fr 340px; gap: 40px; align-items: start; }
        
//         /* Main Content */
//         .wc-section { margin-bottom: 60px; }
//         .wc-section-title { display: flex; align-items: center; gap: 15px; margin-bottom: 30px; }
//         .wc-section-no { background: var(--brand-teal); color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; }
//         .wc-section-title h2 { font-size: 28px; color: var(--brand-teal); font-weight: 600; }

//         /* Trip at a glance */
//         .wc-glance-card { background: white; border-radius: 12px; border: 1px solid var(--border-light); padding: 30px; box-shadow: 0 4px 15px rgba(0,0,0,0.02); }
//         .wc-glance-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; border-bottom: 1px solid var(--border-light); padding-bottom: 25px; margin-bottom: 25px; text-align: center; }
//         .wc-glance-stats div { border-right: 1px solid var(--border-light); }
//         .wc-glance-stats div:last-child { border: none; }
//         .wc-glance-stats strong { display: block; font-size: 32px; color: var(--brand-teal); font-family: 'Playfair Display', serif; }
//         .wc-glance-stats span { font-size: 11px; text-transform: uppercase; color: var(--text-muted); letter-spacing: 1px; margin-top: 5px; display: block; }

//         /* Hotels */
//         .wc-hotel-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
//         .wc-hotel-card { background: white; border-radius: 12px; overflow: hidden; border: 1px solid var(--border-light); box-shadow: 0 4px 15px rgba(0,0,0,0.02); display: flex; flex-direction: column; }
//         .wc-hotel-img { height: 180px; position: relative; }
//         .wc-hotel-img img { width: 100%; height: 100%; object-fit: cover; }
//         .wc-tag { position: absolute; bottom: 10px; left: 10px; background: white; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; color: var(--brand-teal); text-transform: uppercase; }
//         .wc-star-tag { position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.6); color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; display: flex; gap: 4px; align-items: center; }
//         .wc-hotel-info { padding: 20px; flex-grow: 1; display: flex; flex-direction: column; justify-content: center; }
//         .wc-hotel-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
//         .wc-hotel-header h3 { font-size: 18px; color: var(--text-main); font-weight: 600; }
//         .wc-meal-tag { background: #fff3e0; color: #e65100; font-size: 10px; padding: 4px 8px; border-radius: 4px; font-weight: 600; }
//         .wc-hotel-room { color: var(--brand-teal); font-size: 13px; margin-bottom: 10px; }
//         .wc-hotel-meta { font-size: 12px; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-light); padding-top: 15px; margin-top: auto; }
//         .wc-view-details { color: var(--brand-teal); font-weight: 600; cursor: pointer; text-decoration: none; }
//         .wc-view-details:hover { text-decoration: underline; }

//         /* Timeline */
//         .wc-timeline { position: relative; padding-left: 60px; }
//         .wc-timeline::before { content: ''; position: absolute; left: 25px; top: 0; bottom: 0; width: 2px; background: #e0e5e2; }
//         .wc-day-block { position: relative; margin-bottom: 40px; }
//         .wc-day-circle { position: absolute; left: -60px; width: 50px; height: 50px; background: var(--brand-teal); border-radius: 50%; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 2; border: 4px solid var(--bg-color); }
//         .wc-day-circle strong { font-size: 16px; line-height: 1; }
//         .wc-day-circle span { font-size: 10px; text-transform: uppercase; }
//         .wc-day-card { background: white; border: 1px solid var(--border-light); border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.02); }
//         .wc-day-header { padding: 20px; display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #f0f0f0; }
//         .wc-day-meta { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
//         .wc-day-title { font-size: 18px; font-weight: 600; color: var(--text-main); margin-bottom: 0; }
//         .wc-day-type { font-size: 11px; color: var(--brand-teal); background: #e6f0f0; padding: 4px 10px; border-radius: 50px; font-weight: 600; }
//         .wc-day-body { padding: 0; }
//         .wc-day-img { height: 200px; width: 100%; object-fit: cover; }
//         .wc-day-details-inner { padding: 20px; }
//         .wc-activity-list { border-left: 2px dashed var(--border-light); margin-left: 10px; padding-left: 20px; position: relative; }
//         .wc-activity-item { position: relative; margin-bottom: 20px; }
//         .wc-activity-item::before { content: ''; position: absolute; left: -26px; top: 4px; width: 10px; height: 10px; border-radius: 50%; background: var(--brand-teal); }
//         .wc-activity-item h4 { font-size: 14px; margin-bottom: 4px; }
//         .wc-activity-item p { font-size: 13px; color: var(--text-muted); line-height: 1.5; }

//         /* Inclusions */
//         .wc-inclusions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; background: white; padding: 30px; border-radius: 12px; border: 1px solid var(--border-light); margin-bottom: 30px; }
//         .wc-inc-list h3 { font-size: 16px; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }
//         .wc-inc-list h3.green { color: #059669; }
//         .wc-inc-list h3.red { color: #dc2626; }
//         .wc-inc-list ul { list-style: none; }
//         .wc-inc-list li { display: flex; gap: 12px; font-size: 13px; color: var(--text-muted); margin-bottom: 12px; line-height: 1.4; align-items: flex-start; }
//         .wc-icon-tick { color: #059669; font-weight: bold; }
//         .wc-icon-cross { color: #dc2626; font-weight: bold; }

//         /* Policies Accordions */
//         .wc-accordion { border-bottom: 1px solid var(--border-light); padding: 20px 0; }
//         .wc-accordion:last-child { border-bottom: none; }
//         .wc-accordion summary { font-size: 22px; font-weight: 500; color: var(--text-main); font-family: 'Playfair Display', serif; cursor: pointer; list-style: none; display: flex; align-items: center; justify-content: space-between; }
//         .wc-accordion summary::-webkit-details-marker { display: none; }
//         .wc-accordion summary::after { content: ''; width: 10px; height: 10px; border-right: 2px solid var(--brand-teal); border-bottom: 2px solid var(--brand-teal); transform: rotate(45deg); transition: transform 0.3s ease; }
//         .wc-accordion[open] summary::after { transform: rotate(-135deg); margin-top: 5px; }
//         .wc-accordion-title-wrap { display: flex; align-items: center; gap: 15px; }
//         .wc-accordion-no { color: var(--brand-red); font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 600; }
//         .wc-accordion-content { padding: 20px 0 10px 35px; color: var(--text-muted); font-size: 14px; line-height: 1.6; }
//         .wc-accordion-content ul, .wc-accordion-content ol { padding-left: 20px; margin-top: 10px; }
//         .wc-accordion-content li { margin-bottom: 10px; }

//         /* Sidebar Cost Card - Sticky Implementation */
//         .wc-sidebar-wrapper { position: relative; height: 100%; }
//         .wc-sidebar { position: sticky; top: 90px; } /* Ensures it sticks below the 70px navbar */
        
//         .wc-cost-card { background: white; border-radius: 12px; overflow: hidden; border: 1px solid var(--border-light); box-shadow: 0 10px 30px rgba(0,0,0,0.05); }
//         .wc-cost-header { background: var(--brand-teal); color: white; padding: 25px; }
//         .wc-cost-header span { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8; }
//         .wc-cost-header h2 { font-size: 38px; font-family: 'Playfair Display', serif; margin-top: 5px; }
//         .wc-cost-body { padding: 25px; }
//         .wc-cost-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid var(--border-light); }
//         .wc-cost-row:last-child { border: none; margin-bottom: 0; padding-bottom: 0; }
//         .wc-cost-row span { color: var(--text-muted); width: 40%; }
//         .wc-cost-row strong { color: var(--text-main); width: 60%; text-align: right; font-weight: 500; }
//         .wc-cost-actions { padding: 0 25px 25px; display: flex; flex-direction: column; gap: 12px; }
//         .wc-btn-full { width: 100%; }
//         .wc-btn-outline { background: white; border: 1px solid var(--brand-teal); color: var(--brand-teal); padding: 10px; border-radius: 50px; font-weight: 600; text-align: center; text-decoration: none; display: flex; justify-content: center; align-items: center; gap: 8px; }

//         /* Modal Styles */
//         .wc-modal-overlay {
//           position: fixed; inset: 0; background: rgba(0, 0, 0, 0.65); z-index: 1000;
//           display: flex; align-items: center; justify-content: center; padding: 20px;
//           backdrop-filter: blur(4px);
//         }
//         .wc-modal-content {
//           background: white; border-radius: 12px; width: 100%; max-width: 600px;
//           max-height: 90vh; overflow-y: auto; position: relative; padding: 30px;
//           box-shadow: 0 20px 50px rgba(0,0,0,0.2);
//         }
//         .wc-modal-close {
//           position: absolute; top: 20px; right: 20px; background: #f0f0f0; border: none;
//           width: 34px; height: 34px; border-radius: 50%; cursor: pointer; font-size: 20px;
//           display: flex; align-items: center; justify-content: center; color: var(--text-main);
//         }
//         .wc-modal-close:hover { background: #e0e0e0; }
//         .wc-modal-image { width: 100%; height: 260px; object-fit: cover; border-radius: 8px; margin-bottom: 20px; }
//         .wc-modal-title { font-size: 24px; font-family: 'Playfair Display', serif; color: var(--brand-teal); margin-bottom: 5px; }
//         .wc-modal-location { font-size: 13px; color: var(--text-muted); margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }
//         .wc-modal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; padding-bottom: 25px; border-bottom: 1px solid var(--border-light); }
//         .wc-modal-item label { display: block; font-size: 11px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 4px; }
//         .wc-modal-item strong { font-size: 14px; color: var(--text-main); }
//         .wc-modal-desc { font-size: 14px; line-height: 1.7; color: var(--text-muted); }

//         @media (max-width: 992px) {
//           .wc-container { grid-template-columns: 1fr; }
//           .wc-sidebar-wrapper { height: auto; }
//           .wc-sidebar { position: static; margin-top: 40px; }
//           .wc-hero h1 { font-size: 3.5rem; }
//         }
//         @media (max-width: 768px) {
//           .wc-hotel-grid { grid-template-columns: 1fr; }
//           .wc-inclusions-grid { grid-template-columns: 1fr; }
//           .wc-sticky-bar { display: none; }
//           .wc-topbar { padding: 0 20px; }
//           .wc-hero { min-height: 400px; }
//           .wc-accordion summary { font-size: 18px; }
//           .wc-modal-content { padding: 20px; }
//         }
//       `}</style>

//       {/* 1. Top Navigation Bar */}
//       <header className="wc-topbar">
//         <div className="wc-logo">
//           {company.logo || company.logoUrl ? (
//             <img src={company.logo || company.logoUrl} alt="Logo" />
//           ) : (
//             <span>demo</span>
//           )}
//         </div>
//         <div className="wc-topbar-actions">
//           {companyPhone && <a href={`tel:${companyPhone}`} className="wc-phone">📞 +91 {cleanPhone(companyPhone)}</a>}
//           {whatsappHref && <a href={whatsappHref} target="_blank" rel="noreferrer" className="wc-btn-primary">Chat with Us →</a>}
//         </div>
//       </header>

//       {/* 2. Hero Section */}
//       <section className="wc-hero">
//         <img src={heroImage} alt="Destination" className="wc-hero-bg" />
//         <div className="wc-hero-overlay"></div>
//         <div className="wc-hero-content">
//           <div className="wc-trip-badge">✦ TRIP {q.quoteNo ? `#${q.quoteNo}` : "CUSTOM"}</div>
//           <h1 className="serif">{title}</h1>
//           <p>Hi <strong>{customer.name || "Traveller"}</strong> — here's your handcrafted trip · {dateRangeText}</p>
          
//           <div className="wc-trust-badges">
//             <div className="wc-trust-badge"><span className="wc-stars" style={{color: '#fbd38d'}}>★★★★★</span> 4.8/5 · 12,000+ trips</div>
//             <div className="wc-trust-badge"><div className="icon">T</div> TripAdvisor Award Winner</div>
//             {company.contactPerson && <div className="wc-trust-badge"><div className="icon">{company.contactPerson.charAt(0)}</div> Trip Planner: {company.contactPerson}</div>}
//           </div>
//         </div>
//       </section>

//       {/* 3. Sticky Header (Appears on scroll) */}
//       <div className={`wc-sticky-bar ${isScrolled ? 'visible' : ''}`}>
//         <div className="wc-sticky-user">
//           <div className="wc-avatar">{(customer.name || "U").charAt(0).toUpperCase()}</div>
//           <div className="wc-sticky-details">
//             <strong>{customer.name || "Guest"}</strong>
//             <span>{dateRangeText} · {paxText}</span>
//           </div>
//         </div>
//         <div className="wc-sticky-price">
//           <span>Total</span>
//           <strong>{inr(grandTotal)}</strong>
//         </div>
//       </div>

//       {/* 4. Main Content Area */}
//       <div className="wc-container">
        
//         {/* LEFT COLUMN */}
//         <div className="wc-main-content">
          
//           {/* Trip At a Glance */}
//           <div className="wc-glance-card wc-section">
//             <div className="wc-glance-stats">
//               <div>
//                 <strong>{q.nights || 0}</strong>
//                 <span>Nights</span>
//               </div>
//               <div>
//                 <strong>{hotels.length > 0 ? hotels.length : "-"}</strong>
//                 <span>Stays</span>
//               </div>
//               <div>
//                 <strong>{days.length > 0 ? `${days.length}+` : "-"}</strong>
//                 <span>Days of Activities</span>
//               </div>
//             </div>
//             <div style={{fontSize: '14px', color: 'var(--text-muted)', textAlign: 'center'}}>
//                📍 Route: <strong>{destinationText}</strong>
//             </div>
//           </div>

//           {/* Where you'll stay */}
//           {hotels.length > 0 && (
//             <div className="wc-section">
//               <div className="wc-section-title">
//                 <div className="wc-section-no">01</div>
//                 <h2 className="serif">Where you'll stay</h2>
//               </div>
//               <div className="wc-hotel-grid">
//                 {hotels.map((h, i) => {
//                   const img = hotelImg(h); // REMOVED DEFAULT IMAGE FALLBACK
                  
//                   return (
//                     <div className="wc-hotel-card" key={i}>
//                       {img && (
//                         <div className="wc-hotel-img">
//                           <img src={img} alt={h.name} />
//                           {h.city && <span className="wc-tag">{h.city}</span>}
//                           {h.rating && <span className="wc-star-tag">{h.rating} ★</span>}
//                         </div>
//                       )}
                      
//                       <div className="wc-hotel-info">
//                         <div className="wc-hotel-header">
//                           <h3>{h.name || "Selected Hotel"}</h3>
//                           {h.mealPlan && <span className="wc-meal-tag">{h.mealPlan}</span>}
//                         </div>

//                         {/* Show tags here if image is missing */}
//                         {!img && (h.city || h.rating) && (
//                           <div style={{display: 'flex', gap: '10px', marginBottom: '10px', fontSize: '11px', color: 'var(--text-muted)'}}>
//                             {h.city && <span>📍 {h.city}</span>}
//                             {h.rating && <span>⭐ {h.rating} Star</span>}
//                           </div>
//                         )}

//                         <p className="wc-hotel-room">{h.roomType || "Standard Room"}</p>
//                         <div className="wc-hotel-meta">
//                           <span>{h.rooms || 1} Room(s) · {h.nights || 1} Night(s)</span>
//                           <span className="wc-view-details" onClick={() => setSelectedHotel(h)}>View details →</span>
//                         </div>
//                       </div>
//                     </div>
//                   );
//                 })}
//               </div>
//             </div>
//           )}

//           {/* Detailed Itinerary */}
//           {days.length > 0 && (
//             <div className="wc-section">
//               <div className="wc-section-title">
//                 <div className="wc-section-no">02</div>
//                 <h2 className="serif">{customer.name ? `${customer.name.split(" ")[0]}, here's your journey` : "Here's your journey"}</h2>
//               </div>
              
//               <div className="wc-timeline">
//                 {days.map((day, idx) => {
//                   const dateInfo = getDayMonth(day.date);
//                   const acts = Array.isArray(day.activities) ? day.activities : [];
//                   const firstAct = acts[0] || {};
//                   const img = acts.map(activityImg).find(Boolean) || (idx === 0 ? heroImage : "");
                  
//                   return (
//                     <div className="wc-day-block" key={idx}>
//                       <div className="wc-day-circle">
//                         <strong>{dateInfo.day || idx + 1}</strong>
//                         <span>{dateInfo.month || `DAY`}</span>
//                       </div>
//                       <div className="wc-day-card">
//                         <div className="wc-day-header">
//                           <div>
//                             <div className="wc-day-meta">
//                               DAY {day.day || idx + 1} · {day.date ? fmtDate(day.date) : ""} {day.location ? `· ${day.location}` : ""}
//                             </div>
//                             <h3 className="wc-day-title">{day.title || firstAct.attraction || `Sightseeing in ${day.location || "City"}`}</h3>
//                           </div>
//                           <span className="wc-day-type">{transfersPresent(acts) ? 'TRANSFER' : 'SIGHTSEEING'}</span>
//                         </div>
                        
//                         <div className="wc-day-body">
//                           {img && <img src={img} alt="Day" className="wc-day-img" />}
//                           <div className="wc-day-details-inner">
//                              {acts.length > 0 ? (
//                                <div className="wc-activity-list">
//                                  {acts.map((act, actIdx) => (
//                                    <div className="wc-activity-item" key={actIdx}>
//                                      <h4>{act.startTime ? `${act.startTime} - ` : ""}{act.attraction || act.title || "Activity"}</h4>
//                                      {act.description && <p>{act.description}</p>}
//                                    </div>
//                                  ))}
//                                </div>
//                              ) : (
//                                <p style={{color: 'var(--text-muted)', fontSize: '14px'}}>{day.description || "Day at leisure to explore."}</p>
//                              )}
//                           </div>
//                         </div>
//                       </div>
//                     </div>
//                   );
//                 })}
//               </div>
//             </div>
//           )}

//           {/* Inclusions & Policies Section Grouping */}
//           <div className="wc-section">
//             <div className="wc-section-title" style={{marginBottom: '20px'}}>
//               <div className="wc-section-no">03</div>
//               <h2 className="serif">Inclusions & Exclusions</h2>
//             </div>
            
//             <div className="wc-inclusions-grid">
//               <div className="wc-inc-list">
//                 <h3 className="green"><span className="wc-icon-tick">●</span> What's included</h3>
//                 <ul>
//                   {(q.inclusions && q.inclusions.length > 0) ? q.inclusions.map((inc, i) => (
//                     <li key={i}><span className="wc-icon-tick">✓</span> {typeof inc === 'string' ? inc : inc.text}</li>
//                   )) : (
//                     <>
//                       <li><span className="wc-icon-tick">✓</span> Accommodation as mentioned in itinerary</li>
//                       <li><span className="wc-icon-tick">✓</span> All sightseeing as per itinerary</li>
//                       <li><span className="wc-icon-tick">✓</span> Dedicated tour Planner</li>
//                     </>
//                   )}
//                 </ul>
//               </div>
//               <div className="wc-inc-list">
//                 <h3 className="red"><span className="wc-icon-cross">●</span> Not included</h3>
//                 <ul>
//                   {(q.exclusions && q.exclusions.length > 0) ? q.exclusions.map((exc, i) => (
//                     <li key={i}><span className="wc-icon-cross">✕</span> {typeof exc === 'string' ? exc : exc.text}</li>
//                   )) : (
//                     <>
//                       <li><span className="wc-icon-cross">✕</span> Airfare / train tickets</li>
//                       <li><span className="wc-icon-cross">✕</span> Personal expenses</li>
//                       <li><span className="wc-icon-cross">✕</span> Travel insurance</li>
//                     </>
//                   )}
//                 </ul>
//               </div>
//             </div>

//             {/* WeCare Styled Policies Accordions */}
//             {q.paymentPolicies?.length > 0 && (
//               <details className="wc-accordion">
//                 <summary>
//                   <div className="wc-accordion-title-wrap">
//                     <span className="wc-accordion-no">0{policyCounter++}</span>
//                     Payment schedule
//                   </div>
//                 </summary>
//                 <div className="wc-accordion-content">
//                   {renderPolicyList(q.paymentPolicies)}
//                 </div>
//               </details>
//             )}

//             {q.cancellationPolicies?.length > 0 && (
//               <details className="wc-accordion">
//                 <summary>
//                   <div className="wc-accordion-title-wrap">
//                     <span className="wc-accordion-no">0{policyCounter++}</span>
//                     Cancellation policy
//                   </div>
//                 </summary>
//                 <div className="wc-accordion-content">
//                   {renderPolicyList(q.cancellationPolicies)}
//                 </div>
//               </details>
//             )}

//             {q.bookingTerms?.length > 0 && (
//               <details className="wc-accordion">
//                 <summary>
//                   <div className="wc-accordion-title-wrap">
//                     <span className="wc-accordion-no">0{policyCounter++}</span>
//                     Terms & Conditions
//                   </div>
//                 </summary>
//                 <div className="wc-accordion-content">
//                   {renderPolicyList(q.bookingTerms)}
//                 </div>
//               </details>
//             )}
            
//           </div>
//         </div>

//         {/* RIGHT COLUMN (Sidebar) */}
//         <div className="wc-sidebar-wrapper">
//           <div className="wc-sidebar">
//             <div className="wc-cost-card">
//               <div className="wc-cost-header">
//                 <span>Total Tour Cost</span>
//                 <h2>{inr(grandTotal)}</h2>
//               </div>
//               <div className="wc-cost-body">
//                 <div className="wc-cost-row">
//                   <span>Route</span>
//                   <strong>{destinationText}</strong>
//                 </div>
//                 <div className="wc-cost-row">
//                   <span>Duration</span>
//                   <strong>{(q.nights || 0) + 1} Days / {q.nights || 0} Nights</strong>
//                 </div>
//                 <div className="wc-cost-row">
//                   <span>Dates</span>
//                   <strong>{dateRangeText || "Open Dates"}</strong>
//                 </div>
//                 <div className="wc-cost-row">
//                   <span>Travellers</span>
//                   <strong>{paxText}</strong>
//                 </div>
//                 {hotels[0]?.mealPlan && (
//                   <div className="wc-cost-row">
//                     <span>Meals</span>
//                     <strong>{hotels[0].mealPlan}</strong>
//                   </div>
//                 )}
//               </div>
//               <div className="wc-cost-actions">
//                 <a href={whatsappHref || "#"} className="wc-btn-primary wc-btn-full" target="_blank" rel="noreferrer">Proceed with This Package →</a>
//                 <a href={whatsappHref || "#"} className="wc-btn-outline" target="_blank" rel="noreferrer">
//                   <span style={{fontSize:'18px'}}>💬</span> Ask a Question
//                 </a>
//                 <div style={{textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', marginTop: '5px'}}>
//                   {company.name || "Travel Co."} · Est. {company.since || "2015"}
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>

//       </div>

//       {/* Hotel Details Modal (Popup) */}
//       {selectedHotel && (
//         <div className="wc-modal-overlay" onClick={() => setSelectedHotel(null)}>
//           <div className="wc-modal-content" onClick={(e) => e.stopPropagation()}>
//             <button className="wc-modal-close" onClick={() => setSelectedHotel(null)}>×</button>
            
//             {hotelImg(selectedHotel) && (
//               <img src={hotelImg(selectedHotel)} alt={selectedHotel.name} className="wc-modal-image" />
//             )}
            
//             <h3 className="wc-modal-title">{selectedHotel.name || "Selected Hotel"}</h3>
//             <div className="wc-modal-location">
//               {selectedHotel.city && <span>📍 {selectedHotel.city}</span>}
//               {selectedHotel.rating && <span>⭐ {selectedHotel.rating} Star</span>}
//             </div>

//             <div className="wc-modal-grid">
//               <div className="wc-modal-item">
//                 <label>Room Type</label>
//                 <strong>{selectedHotel.roomType || "Standard"}</strong>
//               </div>
//               <div className="wc-modal-item">
//                 <label>Meal Plan</label>
//                 <strong>{selectedHotel.mealPlan || "Room Only"}</strong>
//               </div>
//               {selectedHotel.checkIn && (
//                 <div className="wc-modal-item">
//                   <label>Check-in</label>
//                   <strong>{fmtDate(selectedHotel.checkIn)}</strong>
//                 </div>
//               )}
//               {selectedHotel.checkOut && (
//                 <div className="wc-modal-item">
//                   <label>Check-out</label>
//                   <strong>{fmtDate(selectedHotel.checkOut)}</strong>
//                 </div>
//               )}
//               <div className="wc-modal-item">
//                 <label>Rooms</label>
//                 <strong>{selectedHotel.rooms || 1}</strong>
//               </div>
//               <div className="wc-modal-item">
//                 <label>Nights</label>
//                 <strong>{selectedHotel.nights || 1}</strong>
//               </div>
//             </div>

//             {(selectedHotel.description || selectedHotel.text) && (
//               <div className="wc-modal-desc">
//                 <p>{selectedHotel.description || selectedHotel.text}</p>
//               </div>
//             )}
//           </div>
//         </div>
//       )}

//     </div>
//   );
// }

// function transfersPresent(activities) {
//   return activities.some(a => a.transfer || a.type === 'transfer');
// }







import React, { useMemo, useEffect, useState } from "react";

/* ============================================================================
   MODERN ITINERARY VIEW (Inspired by WeCare Holidays UI)
   ----------------------------------------------------------------------------
   Expected prop:
     <ModernWebView data={q} pdfUrl={pdfUrl} />
   ========================================================================== */

const fmtDate = (value, long = false) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString(long ? "en-US" : "en-GB",
      long
        ? { day: "numeric", month: "long", year: "numeric" }
        : { day: "2-digit", month: "short", year: "numeric" }
    );
  } catch {
    return value;
  }
};

const getDayMonth = (value) => {
  if (!value) return { day: "", month: "" };
  try {
    const d = new Date(value);
    return {
      day: d.getDate(),
      month: d.toLocaleString('en-US', { month: 'short' }).toUpperCase()
    };
  } catch {
    return { day: "", month: "" };
  }
};

const inr = (value) => {
  if (value == null || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n)
    ? `₹${n.toLocaleString("en-IN")}`
    : String(value);
};

const cleanPhone = (value = "") => String(value).replace(/\D/g, "");
const first = (...values) => values.find((v) => v !== undefined && v !== null && v !== "") || "";

const hotelImg = (h = {}) => first(h.imageUrl, h.imagePath, h.image, h.photo, h.coverImage, h.hotelImage, h.img, Array.isArray(h.images) ? h.images[0] : "");
const activityImg = (a = {}) => first(a.imagePath, a.imageUrl, a.image, a.photo, a.coverImage, a.img);
const vehicleImg = (v = {}) => first(v.imagePath, v.imageUrl, v.image, v.photo, v.coverImage, v.img);

function Stars({ value = 0 }) {
  const n = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
  if (!n) return null;
  return <span className="wc-stars">{"★".repeat(n)}</span>;
}

// Helper to render policy lists consistently
function renderPolicyList(items) {
  if (!Array.isArray(items) || !items.length) return <p>Not specified.</p>;
  return (
    <ul>
      {items.map((item, index) => (
        <li key={index}>{typeof item === "string" ? item : item?.text || item?.description || ""}</li>
      ))}
    </ul>
  );
}

export default function LuxuryWebView({ data, pdfUrl }) {
  const q = data || {};
  const customer = q.customer || {};
  const company = q.company || q.organization || {};
  const totals = q.totals || {};

  const [isScrolled, setIsScrolled] = useState(false);
  const [selectedHotel, setSelectedHotel] = useState(null); // State for Hotel Modal
  
  // Default: Open the first day (index 0)
  const [expandedDays, setExpandedDays] = useState(new Set([0]));

  const days = q.sightseeing?.included && Array.isArray(q.sightseeing?.days) ? q.sightseeing.days : [];
  const hotels = q.hotel?.included && Array.isArray(q.hotel?.hotels) ? q.hotel.hotels : [];
  const vehicles = q.vehicle?.included && Array.isArray(q.vehicle?.vehicles) ? q.vehicle.vehicles : [];

  const toggleDay = (idx) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const toggleAllDays = () => {
    if (expandedDays.size === days.length) {
      setExpandedDays(new Set());
    } else {
      setExpandedDays(new Set(days.map((_, i) => i)));
    }
  };

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 400);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (selectedHotel) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
  }, [selectedHotel]);

  const destinationText = customer.destination || (Array.isArray(q.destinations) ? q.destinations.join(" · ") : "") || q.destination || "Destination";
  const title = q.title || destinationText;
  
  const companyPhone = company.phone || company.contactNumber || q.companyPhone || "";
  const grandTotal = totals.grandTotal ?? q.grandTotal;

  const paxText = [
    customer.adults ? `${customer.adults} Adults` : "",
    customer.children ? `${customer.children} Children` : "",
  ].filter(Boolean).join(" · ");

  const dateRangeText = customer.travelDate 
    ? `${fmtDate(customer.travelDate)} — ${fmtDate(q.endDate || new Date(new Date(customer.travelDate).getTime() + (q.nights || 0)*86400000))}` 
    : "";

  const heroImage = useMemo(() => {
    const firstActivity = days.flatMap((d) => (Array.isArray(d.activities) ? d.activities : [])).find((a) => activityImg(a));
    return q.coverImageUrl || q.heroImageUrl || q.bannerUrl || activityImg(firstActivity) || hotelImg(hotels[0]) || "https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&q=80&w=2000";
  }, [q, days, hotels]);

  const whatsappHref = companyPhone
    ? `https://wa.me/${cleanPhone(companyPhone)}?text=${encodeURIComponent(`Hello, I have a question about package ${q.quoteNo || ""}`)}`
    : "";

  // Dynamic Section Counter
  let sectionCounter = 1;
  const getSectionNo = () => `0${sectionCounter++}`.slice(-2);

  // Dynamic Policy Counter
  let policyCounter = 4;

  return (
    <div className="wc-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap');

        :root {
          --brand-teal: #166464;
          --brand-teal-dark: #0f4a4a;
          --brand-red: #f84d4d;
          --brand-red-hover: #e03c3c;
          --bg-color: #f5f7f8;
          --text-main: #333333;
          --text-muted: #666666;
          --border-light: #e5e7eb;
          --white: #ffffff;
        }

        .wc-root { background: var(--bg-color); color: var(--text-main); font-family: 'Inter', sans-serif; min-height: 100vh; padding-bottom: 100px; }
        .wc-root * { box-sizing: border-box; margin: 0; padding: 0; }
        .serif { font-family: 'Playfair Display', serif; }

        /* Topbar */
        .wc-topbar { position: fixed; top: 0; left: 0; right: 0; height: 70px; display: flex; align-items: center; justify-content: space-between; padding: 0 40px; background: #fff; z-index: 100; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
        .wc-logo { font-size: 20px; font-weight: 700; color: var(--brand-teal); display: flex; align-items: center; gap: 10px; }
        .wc-logo img { height: 40px; }
        .wc-topbar-actions { display: flex; align-items: center; gap: 20px; }
        .wc-phone { font-weight: 600; color: var(--brand-teal); text-decoration: none; }
        .wc-btn-primary { background: var(--brand-red); color: white; padding: 10px 24px; border-radius: 50px; text-decoration: none; font-weight: 600; font-size: 14px; transition: 0.2s; border: none; cursor: pointer; display: inline-block; text-align: center; }
        .wc-btn-primary:hover { background: var(--brand-red-hover); }

        /* Hero Section */
        .wc-hero { position: relative; height: 75vh; min-height: 500px; display: flex; align-items: center; justify-content: center; text-align: center; color: white; margin-top: 70px; }
        .wc-hero-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .wc-hero-overlay { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.6)); }
        .wc-hero-content { position: relative; z-index: 2; max-width: 800px; padding: 20px; }
        .wc-trip-badge { display: inline-block; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.3); color: #fbd38d; padding: 6px 16px; border-radius: 50px; font-size: 12px; font-weight: 600; letter-spacing: 1px; margin-bottom: 20px; }
        .wc-hero h1 { font-size: 5rem; margin-bottom: 15px; font-weight: 600; }
        .wc-hero p { font-size: 1.1rem; color: rgba(255,255,255,0.9); margin-bottom: 30px; }
        .wc-trust-badges { display: flex; justify-content: center; gap: 15px; flex-wrap: wrap; }
        .wc-trust-badge { background: rgba(255,255,255,0.15); backdrop-filter: blur(5px); padding: 8px 16px; border-radius: 50px; font-size: 12px; display: flex; align-items: center; gap: 8px; border: 1px solid rgba(255,255,255,0.2); }
        .wc-trust-badge .icon { background: var(--brand-teal); width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 10px; }

        /* Sticky Summary Bar */
        .wc-sticky-bar { position: sticky; top: 70px; z-index: 90; background: #fff; border-bottom: 1px solid var(--border-light); padding: 15px 40px; display: flex; justify-content: space-between; align-items: center; transform: translateY(-100%); opacity: 0; transition: all 0.3s ease; }
        .wc-sticky-bar.visible { transform: translateY(0); opacity: 1; }
        .wc-sticky-user { display: flex; align-items: center; gap: 15px; }
        .wc-avatar { width: 40px; height: 40px; background: var(--brand-teal); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; }
        .wc-sticky-details strong { display: block; font-size: 15px; }
        .wc-sticky-details span { font-size: 12px; color: var(--text-muted); }
        .wc-sticky-price { text-align: right; }
        .wc-sticky-price span { font-size: 11px; text-transform: uppercase; color: var(--text-muted); display: block; }
        .wc-sticky-price strong { font-size: 22px; color: var(--brand-teal); font-weight: 700; }

        /* Layout Grid */
        .wc-container { max-width: 1200px; margin: 40px auto; padding: 0 20px; display: grid; grid-template-columns: 1fr 340px; gap: 40px; align-items: start; }
        
        /* Main Content */
        .wc-section { margin-bottom: 60px; }
        .wc-section-header-wrap { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .wc-section-title { display: flex; align-items: center; gap: 15px; }
        .wc-section-no { background: var(--brand-teal); color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; flex-shrink: 0; }
        .wc-section-title h2 { font-size: 28px; color: var(--brand-teal); font-weight: 600; margin: 0; }
        
        .wc-expand-btn { background: none; border: none; color: var(--brand-teal); font-weight: 600; font-size: 14px; cursor: pointer; text-decoration: none; padding: 5px 10px; border-radius: 4px; }
        .wc-expand-btn:hover { background: rgba(22, 100, 100, 0.05); }

        /* Trip at a glance */
        .wc-glance-card { background: white; border-radius: 12px; border: 1px solid var(--border-light); padding: 30px; box-shadow: 0 4px 15px rgba(0,0,0,0.02); }
        .wc-glance-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; border-bottom: 1px solid var(--border-light); padding-bottom: 25px; margin-bottom: 25px; text-align: center; }
        .wc-glance-stats div { border-right: 1px solid var(--border-light); }
        .wc-glance-stats div:last-child { border: none; }
        .wc-glance-stats strong { display: block; font-size: 32px; color: var(--brand-teal); font-family: 'Playfair Display', serif; }
        .wc-glance-stats span { font-size: 11px; text-transform: uppercase; color: var(--text-muted); letter-spacing: 1px; margin-top: 5px; display: block; }

        /* Hotels & Vehicles Grid */
        .wc-hotel-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
        .wc-hotel-card { background: white; border-radius: 12px; overflow: hidden; border: 1px solid var(--border-light); box-shadow: 0 4px 15px rgba(0,0,0,0.02); display: flex; flex-direction: column; }
        .wc-hotel-img { height: 180px; position: relative; }
        .wc-hotel-img img { width: 100%; height: 100%; object-fit: cover; }
        .wc-tag { position: absolute; bottom: 10px; left: 10px; background: white; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; color: var(--brand-teal); text-transform: uppercase; }
        .wc-star-tag { position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.6); color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; display: flex; gap: 4px; align-items: center; }
        .wc-hotel-info { padding: 20px; flex-grow: 1; display: flex; flex-direction: column; justify-content: center; }
        .wc-hotel-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
        .wc-hotel-header h3 { font-size: 18px; color: var(--text-main); font-weight: 600; }
        .wc-meal-tag { background: #fff3e0; color: #e65100; font-size: 10px; padding: 4px 8px; border-radius: 4px; font-weight: 600; }
        .wc-hotel-room { color: var(--brand-teal); font-size: 13px; margin-bottom: 10px; }
        .wc-hotel-meta { font-size: 12px; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-light); padding-top: 15px; margin-top: auto; }
        .wc-view-details { color: var(--brand-teal); font-weight: 600; cursor: pointer; text-decoration: none; }
        .wc-view-details:hover { text-decoration: underline; }

        /* Timeline / Accordion Itinerary */
        .wc-timeline-info-box { background: #fffdf2; border: 1px solid #f2e6c5; padding: 15px; border-radius: 8px; font-size: 13px; color: #8a6a1c; display: flex; gap: 10px; margin-bottom: 30px; }
        .wc-timeline { position: relative; padding-left: 60px; }
        .wc-timeline::before { content: ''; position: absolute; left: 25px; top: 0; bottom: 0; width: 2px; background: #e0e5e2; }
        
        .wc-day-block { position: relative; margin-bottom: 30px; }
        .wc-day-circle { position: absolute; left: -60px; width: 50px; height: 50px; background: var(--brand-teal); border-radius: 50%; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 2; border: 4px solid var(--bg-color); }
        .wc-day-circle strong { font-size: 16px; line-height: 1; }
        .wc-day-circle span { font-size: 10px; text-transform: uppercase; }
        
        .wc-day-card { background: white; border: 1px solid var(--border-light); border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.02); transition: all 0.3s ease; }
        
        .wc-day-header { padding: 20px; display: flex; justify-content: space-between; align-items: flex-start; cursor: pointer; user-select: none; }
        .wc-day-header:hover { background: #fafafa; }
        .wc-day-header.expanded { border-bottom: 1px solid #f0f0f0; }
        
        .wc-day-meta { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
        .wc-day-title { font-size: 18px; font-weight: 600; color: var(--text-main); margin-bottom: 0; }
        
        .wc-day-type-wrap { display: flex; align-items: center; gap: 15px; }
        .wc-day-type { font-size: 11px; color: var(--brand-teal); background: #e6f0f0; padding: 4px 10px; border-radius: 50px; font-weight: 600; display: flex; align-items: center; gap: 5px;}
        .wc-chevron { display: inline-flex; width: 24px; height: 24px; align-items: center; justify-content: center; color: var(--text-muted); font-size: 18px; transition: transform 0.3s ease; }
        .wc-chevron.open { transform: rotate(90deg); color: var(--brand-teal); }

        .wc-day-body { padding: 0; animation: slideDown 0.3s ease-out; }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        
        .wc-day-img { height: 200px; width: 100%; object-fit: cover; }
        .wc-day-details-inner { padding: 20px; }
        .wc-activity-list { border-left: 2px dashed var(--border-light); margin-left: 10px; padding-left: 20px; position: relative; }
        .wc-activity-item { position: relative; margin-bottom: 20px; }
        .wc-activity-item::before { content: ''; position: absolute; left: -26px; top: 4px; width: 10px; height: 10px; border-radius: 50%; background: var(--brand-teal); }
        .wc-activity-item h4 { font-size: 14px; margin-bottom: 4px; }
        .wc-activity-item p { font-size: 13px; color: var(--text-muted); line-height: 1.5; }

        /* Inclusions */
        .wc-inclusions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; background: white; padding: 30px; border-radius: 12px; border: 1px solid var(--border-light); margin-bottom: 30px; }
        .wc-inc-list h3 { font-size: 16px; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }
        .wc-inc-list h3.green { color: #059669; }
        .wc-inc-list h3.red { color: #dc2626; }
        .wc-inc-list ul { list-style: none; }
        .wc-inc-list li { display: flex; gap: 12px; font-size: 13px; color: var(--text-muted); margin-bottom: 12px; line-height: 1.4; align-items: flex-start; }
        .wc-icon-tick { color: #059669; font-weight: bold; }
        .wc-icon-cross { color: #dc2626; font-weight: bold; }

        /* Policies Accordions */
        .wc-accordion { border-bottom: 1px solid var(--border-light); padding: 20px 0; }
        .wc-accordion:last-child { border-bottom: none; }
        .wc-accordion summary { font-size: 22px; font-weight: 500; color: var(--text-main); font-family: 'Playfair Display', serif; cursor: pointer; list-style: none; display: flex; align-items: center; justify-content: space-between; }
        .wc-accordion summary::-webkit-details-marker { display: none; }
        .wc-accordion summary::after { content: ''; width: 10px; height: 10px; border-right: 2px solid var(--brand-teal); border-bottom: 2px solid var(--brand-teal); transform: rotate(45deg); transition: transform 0.3s ease; }
        .wc-accordion[open] summary::after { transform: rotate(-135deg); margin-top: 5px; }
        .wc-accordion-title-wrap { display: flex; align-items: center; gap: 15px; }
        .wc-accordion-no { color: var(--brand-red); font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 600; }
        .wc-accordion-content { padding: 20px 0 10px 35px; color: var(--text-muted); font-size: 14px; line-height: 1.6; }
        .wc-accordion-content ul, .wc-accordion-content ol { padding-left: 20px; margin-top: 10px; }
        .wc-accordion-content li { margin-bottom: 10px; }

        /* Sidebar Cost Card - Sticky Implementation */
        .wc-sidebar-wrapper { position: relative; height: 100%; }
        .wc-sidebar { position: sticky; top: 90px; }
        
        .wc-cost-card { background: white; border-radius: 12px; overflow: hidden; border: 1px solid var(--border-light); box-shadow: 0 10px 30px rgba(0,0,0,0.05); }
        .wc-cost-header { background: var(--brand-teal); color: white; padding: 25px; }
        .wc-cost-header span { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8; }
        .wc-cost-header h2 { font-size: 38px; font-family: 'Playfair Display', serif; margin-top: 5px; }
        .wc-cost-body { padding: 25px; }
        .wc-cost-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid var(--border-light); }
        .wc-cost-row:last-child { border: none; margin-bottom: 0; padding-bottom: 0; }
        .wc-cost-row span { color: var(--text-muted); width: 40%; }
        .wc-cost-row strong { color: var(--text-main); width: 60%; text-align: right; font-weight: 500; }
        .wc-cost-actions { padding: 0 25px 25px; display: flex; flex-direction: column; gap: 12px; }
        .wc-btn-full { width: 100%; }
        .wc-btn-outline { background: white; border: 1px solid var(--brand-teal); color: var(--brand-teal); padding: 10px; border-radius: 50px; font-weight: 600; text-align: center; text-decoration: none; display: flex; justify-content: center; align-items: center; gap: 8px; }

        /* Modal Styles */
        .wc-modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.65); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(4px); }
        .wc-modal-content { background: white; border-radius: 12px; width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto; position: relative; padding: 30px; box-shadow: 0 20px 50px rgba(0,0,0,0.2); }
        .wc-modal-close { position: absolute; top: 20px; right: 20px; background: #f0f0f0; border: none; width: 34px; height: 34px; border-radius: 50%; cursor: pointer; font-size: 20px; display: flex; align-items: center; justify-content: center; color: var(--text-main); }
        .wc-modal-close:hover { background: #e0e0e0; }
        .wc-modal-image { width: 100%; height: 260px; object-fit: cover; border-radius: 8px; margin-bottom: 20px; }
        .wc-modal-title { font-size: 24px; font-family: 'Playfair Display', serif; color: var(--brand-teal); margin-bottom: 5px; }
        .wc-modal-location { font-size: 13px; color: var(--text-muted); margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }
        .wc-modal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; padding-bottom: 25px; border-bottom: 1px solid var(--border-light); }
        .wc-modal-item label { display: block; font-size: 11px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 4px; }
        .wc-modal-item strong { font-size: 14px; color: var(--text-main); }
        .wc-modal-desc { font-size: 14px; line-height: 1.7; color: var(--text-muted); }

        @media (max-width: 992px) {
          .wc-container { grid-template-columns: 1fr; }
          .wc-sidebar-wrapper { height: auto; }
          .wc-sidebar { position: static; margin-top: 40px; }
          .wc-hero h1 { font-size: 3.5rem; }
        }
        @media (max-width: 768px) {
          .wc-hotel-grid { grid-template-columns: 1fr; }
          .wc-inclusions-grid { grid-template-columns: 1fr; }
          .wc-sticky-bar { display: none; }
          .wc-topbar { padding: 0 20px; }
          .wc-hero { min-height: 400px; }
          .wc-accordion summary { font-size: 18px; }
          .wc-modal-content { padding: 20px; }
          .wc-section-header-wrap { flex-direction: column; align-items: flex-start; gap: 15px; }
        }
      `}</style>

      {/* 1. Top Navigation Bar */}
      <header className="wc-topbar">
        <div className="wc-logo">
          {company.logo || company.logoUrl ? (
            <img src={company.logo || company.logoUrl} alt="Logo" />
          ) : (
            <span>demo</span>
          )}
        </div>
        <div className="wc-topbar-actions">
          {companyPhone && <a href={`tel:${companyPhone}`} className="wc-phone">📞 +91 {cleanPhone(companyPhone)}</a>}
          {whatsappHref && <a href={whatsappHref} target="_blank" rel="noreferrer" className="wc-btn-primary">Chat with Us →</a>}
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="wc-hero">
        <img src={heroImage} alt="Destination" className="wc-hero-bg" />
        <div className="wc-hero-overlay"></div>
        <div className="wc-hero-content">
          <div className="wc-trip-badge">✦ TRIP {q.quoteNo ? `#${q.quoteNo}` : "CUSTOM"}</div>
          <h1 className="serif">{title}</h1>
          <p>Hi <strong>{customer.name || "Traveller"}</strong> — here's your handcrafted trip · {dateRangeText}</p>
          
          <div className="wc-trust-badges">
            <div className="wc-trust-badge"><span className="wc-stars" style={{color: '#fbd38d'}}>★★★★★</span> 4.8/5 · 12,000+ trips</div>
            <div className="wc-trust-badge"><div className="icon">T</div> TripAdvisor Award Winner</div>
            {company.contactPerson && <div className="wc-trust-badge"><div className="icon">{company.contactPerson.charAt(0)}</div> Trip Planner: {company.contactPerson}</div>}
          </div>
        </div>
      </section>

      {/* 3. Sticky Header (Appears on scroll) */}
      <div className={`wc-sticky-bar ${isScrolled ? 'visible' : ''}`}>
        <div className="wc-sticky-user">
          <div className="wc-avatar">{(customer.name || "U").charAt(0).toUpperCase()}</div>
          <div className="wc-sticky-details">
            <strong>{customer.name || "Guest"}</strong>
            <span>{dateRangeText} · {paxText}</span>
          </div>
        </div>
        <div className="wc-sticky-price">
          <span>Total</span>
          <strong>{inr(grandTotal)}</strong>
        </div>
      </div>

      {/* 4. Main Content Area */}
      <div className="wc-container">
        
        {/* LEFT COLUMN */}
        <div className="wc-main-content">
          
          {/* Trip At a Glance */}
          <div className="wc-glance-card wc-section">
            <div className="wc-glance-stats">
              <div>
                <strong>{q.nights || 0}</strong>
                <span>Nights</span>
              </div>
              <div>
                <strong>{hotels.length > 0 ? hotels.length : "-"}</strong>
                <span>Stays</span>
              </div>
              <div>
                <strong>{days.length > 0 ? `${days.length}+` : "-"}</strong>
                <span>Days of Activities</span>
              </div>
            </div>
            <div style={{fontSize: '14px', color: 'var(--text-muted)', textAlign: 'center'}}>
               📍 Route: <strong>{destinationText}</strong>
            </div>
          </div>

          {/* SECTION: Where you'll stay (Hotels) */}
          {hotels.length > 0 && (
            <div className="wc-section">
              <div className="wc-section-header-wrap" style={{marginBottom: '20px'}}>
                <div className="wc-section-title">
                  <div className="wc-section-no">{getSectionNo()}</div>
                  <h2 className="serif">Where you'll stay</h2>
                </div>
              </div>
              <div className="wc-hotel-grid">
                {hotels.map((h, i) => {
                  const img = hotelImg(h); 
                  
                  return (
                    <div className="wc-hotel-card" key={i}>
                      {img && (
                        <div className="wc-hotel-img">
                          <img src={img} alt={h.name} />
                          {h.city && <span className="wc-tag">{h.city}</span>}
                          {h.rating && <span className="wc-star-tag">{h.rating} ★</span>}
                        </div>
                      )}
                      
                      <div className="wc-hotel-info">
                        <div className="wc-hotel-header">
                          <h3>{h.name || "Selected Hotel"}</h3>
                          {h.mealPlan && <span className="wc-meal-tag">{h.mealPlan}</span>}
                        </div>

                        {!img && (h.city || h.rating) && (
                          <div style={{display: 'flex', gap: '10px', marginBottom: '10px', fontSize: '11px', color: 'var(--text-muted)'}}>
                            {h.city && <span>📍 {h.city}</span>}
                            {h.rating && <span>⭐ {h.rating} Star</span>}
                          </div>
                        )}

                        <p className="wc-hotel-room">{h.roomType || "Standard Room"}</p>
                        <div className="wc-hotel-meta">
                          <span>{h.rooms || 1} Room(s) · {h.nights || 1} Night(s)</span>
                          <span className="wc-view-details" onClick={() => setSelectedHotel(h)}>View details →</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION: Vehicle Details */}
          {vehicles.length > 0 && (
            <div className="wc-section">
              <div className="wc-section-header-wrap" style={{marginBottom: '20px'}}>
                <div className="wc-section-title">
                  <div className="wc-section-no">{getSectionNo()}</div>
                  <h2 className="serif">Vehicle Details</h2>
                </div>
              </div>
              <div className="wc-hotel-grid">
                {vehicles.map((v, i) => {
                  const img = vehicleImg(v); 
                  
                  return (
                    <div className="wc-hotel-card" key={`veh-${i}`}>
                      {img && (
                        <div className="wc-hotel-img">
                          <img src={img} alt={v.model || v.name} />
                          {v.type && <span className="wc-tag">{v.type}</span>}
                        </div>
                      )}
                      
                      <div className="wc-hotel-info">
                        <div className="wc-hotel-header">
                          <h3>{v.model || v.name || "Private Transfer"}</h3>
                        </div>

                        {!img && v.type && (
                          <div style={{display: 'flex', gap: '10px', marginBottom: '10px', fontSize: '11px', color: 'var(--text-muted)'}}>
                            <span>🚙 {v.type}</span>
                          </div>
                        )}

                        <p className="wc-hotel-room" style={{color: 'var(--text-muted)'}}>
                          Private journey tailored for your comfort.
                        </p>

                        <div className="wc-hotel-meta">
                          <span>{v.capacity ? `${v.capacity} Seater` : "Private Vehicle"}</span>
                          {v.qty && <span>Qty: {v.qty}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION: Detailed Itinerary */}
          {days.length > 0 && (
            <div className="wc-section">
              
              <div className="wc-section-header-wrap">
                <div className="wc-section-title">
                  <div className="wc-section-no">{getSectionNo()}</div>
                  <h2 className="serif">{customer.name ? `${customer.name.split(" ")[0]}, here's your journey` : "Here's your journey"}</h2>
                </div>
                {/* Expand All / Collapse All Button */}
                <button onClick={toggleAllDays} className="wc-expand-btn">
                  {expandedDays.size === days.length ? 'Collapse all' : 'Expand all'}
                </button>
              </div>
              
              <div className="wc-timeline-info-box">
                <span>ⓘ</span>
                <div>Timings and durations are approximate, shown for planning reference only. Actual times may vary based on road conditions, weather and group pace.</div>
              </div>
              
              <div className="wc-timeline">
                {days.map((day, idx) => {
                  const dateInfo = getDayMonth(day.date);
                  const acts = Array.isArray(day.activities) ? day.activities : [];
                  const firstAct = acts[0] || {};
                  const img = acts.map(activityImg).find(Boolean) || (idx === 0 ? heroImage : "");
                  
                  const isExpanded = expandedDays.has(idx);
                  
                  // SMART BADGE LOGIC: If there is an attraction/sightseeing, always show Sightseeing badge.
                  const hasAttraction = acts.some(a => a.attraction || (a.title && !a.title.toLowerCase().includes('transfer')));
                  const badgeText = hasAttraction ? '📸 SIGHTSEEING' : '🚙 TRANSFER';
                  
                  return (
                    <React.Fragment key={idx}>
                      <div className="wc-day-block">
                        <div className="wc-day-circle">
                          <strong>{dateInfo.day || idx + 1}</strong>
                          <span>{dateInfo.month || `DAY`}</span>
                        </div>

                        <div className="wc-day-card">
                          
                          {/* Header (Clickable for Expand/Collapse) */}
                          <div 
                            className={`wc-day-header ${isExpanded ? 'expanded' : ''}`} 
                            onClick={() => toggleDay(idx)}
                          >
                            <div>
                              <div className="wc-day-meta">
                                DAY {day.day || idx + 1} · {day.date ? fmtDate(day.date) : ""} {day.location ? `· ${day.location}` : ""}
                              </div>
                              <h3 className="wc-day-title">{day.title || firstAct.attraction || `Sightseeing in ${day.location || "City"}`}</h3>
                            </div>
                            
                            <div className="wc-day-type-wrap">
                              <span className="wc-day-type">
                                {badgeText}
                              </span>
                              <span className={`wc-chevron ${isExpanded ? 'open' : ''}`}>›</span>
                            </div>
                          </div>
                          
                          {/* Body (Hidden if not expanded) */}
                          {isExpanded && (
                            <div className="wc-day-body">
                              {img && <img src={img} alt="Day" className="wc-day-img" />}
                              <div className="wc-day-details-inner">
                                {acts.length > 0 ? (
                                  <div className="wc-activity-list">
                                    {acts.map((act, actIdx) => (
                                      <div className="wc-activity-item" key={actIdx}>
                                        <h4>{act.startTime ? `${act.startTime} - ` : ""}{act.attraction || act.title || "Activity"}</h4>
                                        {act.description && <p>{act.description}</p>}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p style={{color: 'var(--text-muted)', fontSize: '14px'}}>{day.description || "Day at leisure to explore."}</p>
                                )}
                              </div>
                            </div>
                          )}
                          
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION: Inclusions & Policies Grouping */}
          <div className="wc-section">
            <div className="wc-section-header-wrap" style={{marginBottom: '20px'}}>
              <div className="wc-section-title">
                <div className="wc-section-no">{getSectionNo()}</div>
                <h2 className="serif">Inclusions & Exclusions</h2>
              </div>
            </div>
            
            <div className="wc-inclusions-grid">
              <div className="wc-inc-list">
                <h3 className="green"><span className="wc-icon-tick">●</span> What's included</h3>
                <ul>
                  {(q.inclusions && q.inclusions.length > 0) ? q.inclusions.map((inc, i) => (
                    <li key={i}><span className="wc-icon-tick">✓</span> {typeof inc === 'string' ? inc : inc.text}</li>
                  )) : (
                    <>
                      <li><span className="wc-icon-tick">✓</span> Accommodation as mentioned in itinerary</li>
                      <li><span className="wc-icon-tick">✓</span> All sightseeing as per itinerary</li>
                      <li><span className="wc-icon-tick">✓</span> Dedicated tour Planner</li>
                    </>
                  )}
                </ul>
              </div>
              <div className="wc-inc-list">
                <h3 className="red"><span className="wc-icon-cross">●</span> Not included</h3>
                <ul>
                  {(q.exclusions && q.exclusions.length > 0) ? q.exclusions.map((exc, i) => (
                    <li key={i}><span className="wc-icon-cross">✕</span> {typeof exc === 'string' ? exc : exc.text}</li>
                  )) : (
                    <>
                      <li><span className="wc-icon-cross">✕</span> Airfare / train tickets</li>
                      <li><span className="wc-icon-cross">✕</span> Personal expenses</li>
                      <li><span className="wc-icon-cross">✕</span> Travel insurance</li>
                    </>
                  )}
                </ul>
              </div>
            </div>

            {/* WeCare Styled Policies Accordions */}
            {q.paymentPolicies?.length > 0 && (
              <details className="wc-accordion">
                <summary>
                  <div className="wc-accordion-title-wrap">
                    <span className="wc-accordion-no">0{policyCounter++}</span>
                    Payment schedule
                  </div>
                </summary>
                <div className="wc-accordion-content">
                  {renderPolicyList(q.paymentPolicies)}
                </div>
              </details>
            )}

            {q.cancellationPolicies?.length > 0 && (
              <details className="wc-accordion">
                <summary>
                  <div className="wc-accordion-title-wrap">
                    <span className="wc-accordion-no">0{policyCounter++}</span>
                    Cancellation policy
                  </div>
                </summary>
                <div className="wc-accordion-content">
                  {renderPolicyList(q.cancellationPolicies)}
                </div>
              </details>
            )}

            {q.bookingTerms?.length > 0 && (
              <details className="wc-accordion">
                <summary>
                  <div className="wc-accordion-title-wrap">
                    <span className="wc-accordion-no">0{policyCounter++}</span>
                    Terms & Conditions
                  </div>
                </summary>
                <div className="wc-accordion-content">
                  {renderPolicyList(q.bookingTerms)}
                </div>
              </details>
            )}
            
          </div>
        </div>

        {/* RIGHT COLUMN (Sidebar) */}
        <div className="wc-sidebar-wrapper">
          <div className="wc-sidebar">
            <div className="wc-cost-card">
              <div className="wc-cost-header">
                <span>Total Tour Cost</span>
                <h2>{inr(grandTotal)}</h2>
              </div>
              <div className="wc-cost-body">
                <div className="wc-cost-row">
                  <span>Route</span>
                  <strong>{destinationText}</strong>
                </div>
                <div className="wc-cost-row">
                  <span>Duration</span>
                  <strong>{(q.nights || 0) + 1} Days / {q.nights || 0} Nights</strong>
                </div>
                <div className="wc-cost-row">
                  <span>Dates</span>
                  <strong>{dateRangeText || "Open Dates"}</strong>
                </div>
                <div className="wc-cost-row">
                  <span>Travellers</span>
                  <strong>{paxText}</strong>
                </div>
                {hotels[0]?.mealPlan && (
                  <div className="wc-cost-row">
                    <span>Meals</span>
                    <strong>{hotels[0].mealPlan}</strong>
                  </div>
                )}
              </div>
              <div className="wc-cost-actions">
                <a href={whatsappHref || "#"} className="wc-btn-primary wc-btn-full" target="_blank" rel="noreferrer">Proceed with This Package →</a>
                <a href={whatsappHref || "#"} className="wc-btn-outline" target="_blank" rel="noreferrer">
                  <span style={{fontSize:'18px'}}>💬</span> Ask a Question
                </a>
                <div style={{textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', marginTop: '5px'}}>
                  {company.name || "Travel Co."} · Est. {company.since || "2015"}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Hotel Details Modal (Popup) */}
      {selectedHotel && (
        <div className="wc-modal-overlay" onClick={() => setSelectedHotel(null)}>
          <div className="wc-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="wc-modal-close" onClick={() => setSelectedHotel(null)}>×</button>
            
            {hotelImg(selectedHotel) && (
              <img src={hotelImg(selectedHotel)} alt={selectedHotel.name} className="wc-modal-image" />
            )}
            
            <h3 className="wc-modal-title">{selectedHotel.name || "Selected Hotel"}</h3>
            <div className="wc-modal-location">
              {selectedHotel.city && <span>📍 {selectedHotel.city}</span>}
              {selectedHotel.rating && <span>⭐ {selectedHotel.rating} Star</span>}
            </div>

            <div className="wc-modal-grid">
              <div className="wc-modal-item">
                <label>Room Type</label>
                <strong>{selectedHotel.roomType || "Standard"}</strong>
              </div>
              <div className="wc-modal-item">
                <label>Meal Plan</label>
                <strong>{selectedHotel.mealPlan || "Room Only"}</strong>
              </div>
              {selectedHotel.checkIn && (
                <div className="wc-modal-item">
                  <label>Check-in</label>
                  <strong>{fmtDate(selectedHotel.checkIn)}</strong>
                </div>
              )}
              {selectedHotel.checkOut && (
                <div className="wc-modal-item">
                  <label>Check-out</label>
                  <strong>{fmtDate(selectedHotel.checkOut)}</strong>
                </div>
              )}
              <div className="wc-modal-item">
                <label>Rooms</label>
                <strong>{selectedHotel.rooms || 1}</strong>
              </div>
              <div className="wc-modal-item">
                <label>Nights</label>
                <strong>{selectedHotel.nights || 1}</strong>
              </div>
            </div>

            {(selectedHotel.description || selectedHotel.text) && (
              <div className="wc-modal-desc">
                <p>{selectedHotel.description || selectedHotel.text}</p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}