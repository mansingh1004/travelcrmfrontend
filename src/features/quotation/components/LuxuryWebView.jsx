





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
// const vehicleImg = (v = {}) => first(v.imagePath, v.imageUrl, v.image, v.photo, v.coverImage, v.img);

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
  
//   // Default: Open the first day (index 0)
//   const [expandedDays, setExpandedDays] = useState(new Set([0]));

//   const days = q.sightseeing?.included && Array.isArray(q.sightseeing?.days) ? q.sightseeing.days : [];
//   const hotels = q.hotel?.included && Array.isArray(q.hotel?.hotels) ? q.hotel.hotels : [];
//   const vehicles = q.vehicle?.included && Array.isArray(q.vehicle?.vehicles) ? q.vehicle.vehicles : [];

//   const toggleDay = (idx) => {
//     setExpandedDays(prev => {
//       const next = new Set(prev);
//       if (next.has(idx)) {
//         next.delete(idx);
//       } else {
//         next.add(idx);
//       }
//       return next;
//     });
//   };

//   const toggleAllDays = () => {
//     if (expandedDays.size === days.length) {
//       setExpandedDays(new Set());
//     } else {
//       setExpandedDays(new Set(days.map((_, i) => i)));
//     }
//   };

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

//   // Dynamic Section Counter
//   let sectionCounter = 1;
//   const getSectionNo = () => `0${sectionCounter++}`.slice(-2);

//   // Dynamic Policy Counter
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
//         .wc-section-header-wrap { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
//         .wc-section-title { display: flex; align-items: center; gap: 15px; }
//         .wc-section-no { background: var(--brand-teal); color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; flex-shrink: 0; }
//         .wc-section-title h2 { font-size: 28px; color: var(--brand-teal); font-weight: 600; margin: 0; }
        
//         .wc-expand-btn { background: none; border: none; color: var(--brand-teal); font-weight: 600; font-size: 14px; cursor: pointer; text-decoration: none; padding: 5px 10px; border-radius: 4px; }
//         .wc-expand-btn:hover { background: rgba(22, 100, 100, 0.05); }

//         /* Trip at a glance */
//         .wc-glance-card { background: white; border-radius: 12px; border: 1px solid var(--border-light); padding: 30px; box-shadow: 0 4px 15px rgba(0,0,0,0.02); }
//         .wc-glance-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; border-bottom: 1px solid var(--border-light); padding-bottom: 25px; margin-bottom: 25px; text-align: center; }
//         .wc-glance-stats div { border-right: 1px solid var(--border-light); }
//         .wc-glance-stats div:last-child { border: none; }
//         .wc-glance-stats strong { display: block; font-size: 32px; color: var(--brand-teal); font-family: 'Playfair Display', serif; }
//         .wc-glance-stats span { font-size: 11px; text-transform: uppercase; color: var(--text-muted); letter-spacing: 1px; margin-top: 5px; display: block; }

//         /* Hotels & Vehicles Grid */
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

//         /* Timeline / Accordion Itinerary */
//         .wc-timeline-info-box { background: #fffdf2; border: 1px solid #f2e6c5; padding: 15px; border-radius: 8px; font-size: 13px; color: #8a6a1c; display: flex; gap: 10px; margin-bottom: 30px; }
//         .wc-timeline { position: relative; padding-left: 60px; }
//         .wc-timeline::before { content: ''; position: absolute; left: 25px; top: 0; bottom: 0; width: 2px; background: #e0e5e2; }
        
//         .wc-day-block { position: relative; margin-bottom: 30px; }
//         .wc-day-circle { position: absolute; left: -60px; width: 50px; height: 50px; background: var(--brand-teal); border-radius: 50%; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 2; border: 4px solid var(--bg-color); }
//         .wc-day-circle strong { font-size: 16px; line-height: 1; }
//         .wc-day-circle span { font-size: 10px; text-transform: uppercase; }
        
//         .wc-day-card { background: white; border: 1px solid var(--border-light); border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.02); transition: all 0.3s ease; }
        
//         .wc-day-header { padding: 20px; display: flex; justify-content: space-between; align-items: flex-start; cursor: pointer; user-select: none; }
//         .wc-day-header:hover { background: #fafafa; }
//         .wc-day-header.expanded { border-bottom: 1px solid #f0f0f0; }
        
//         .wc-day-meta { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
//         .wc-day-title { font-size: 18px; font-weight: 600; color: var(--text-main); margin-bottom: 0; }
        
//         .wc-day-type-wrap { display: flex; align-items: center; gap: 15px; }
//         .wc-day-type { font-size: 11px; color: var(--brand-teal); background: #e6f0f0; padding: 4px 10px; border-radius: 50px; font-weight: 600; display: flex; align-items: center; gap: 5px;}
//         .wc-chevron { display: inline-flex; width: 24px; height: 24px; align-items: center; justify-content: center; color: var(--text-muted); font-size: 18px; transition: transform 0.3s ease; }
//         .wc-chevron.open { transform: rotate(90deg); color: var(--brand-teal); }

//         .wc-day-body { padding: 0; animation: slideDown 0.3s ease-out; }
//         @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        
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
//         .wc-sidebar { position: sticky; top: 90px; }
        
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
//         .wc-modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.65); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(4px); }
//         .wc-modal-content { background: white; border-radius: 12px; width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto; position: relative; padding: 30px; box-shadow: 0 20px 50px rgba(0,0,0,0.2); }
//         .wc-modal-close { position: absolute; top: 20px; right: 20px; background: #f0f0f0; border: none; width: 34px; height: 34px; border-radius: 50%; cursor: pointer; font-size: 20px; display: flex; align-items: center; justify-content: center; color: var(--text-main); }
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
//           .wc-section-header-wrap { flex-direction: column; align-items: flex-start; gap: 15px; }
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

//           {/* SECTION: Where you'll stay (Hotels) */}
//           {hotels.length > 0 && (
//             <div className="wc-section">
//               <div className="wc-section-header-wrap" style={{marginBottom: '20px'}}>
//                 <div className="wc-section-title">
//                   <div className="wc-section-no">{getSectionNo()}</div>
//                   <h2 className="serif">Where you'll stay</h2>
//                 </div>
//               </div>
//               <div className="wc-hotel-grid">
//                 {hotels.map((h, i) => {
//                   const img = hotelImg(h); 
                  
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

//           {/* SECTION: Vehicle Details */}
//           {vehicles.length > 0 && (
//             <div className="wc-section">
//               <div className="wc-section-header-wrap" style={{marginBottom: '20px'}}>
//                 <div className="wc-section-title">
//                   <div className="wc-section-no">{getSectionNo()}</div>
//                   <h2 className="serif">Vehicle Details</h2>
//                 </div>
//               </div>
//               <div className="wc-hotel-grid">
//                 {vehicles.map((v, i) => {
//                   const img = vehicleImg(v); 
                  
//                   return (
//                     <div className="wc-hotel-card" key={`veh-${i}`}>
//                       {img && (
//                         <div className="wc-hotel-img">
//                           <img src={img} alt={v.model || v.name} />
//                           {v.type && <span className="wc-tag">{v.type}</span>}
//                         </div>
//                       )}
                      
//                       <div className="wc-hotel-info">
//                         <div className="wc-hotel-header">
//                           <h3>{v.model || v.name || "Private Transfer"}</h3>
//                         </div>

//                         {!img && v.type && (
//                           <div style={{display: 'flex', gap: '10px', marginBottom: '10px', fontSize: '11px', color: 'var(--text-muted)'}}>
//                             <span>🚙 {v.type}</span>
//                           </div>
//                         )}

//                         <p className="wc-hotel-room" style={{color: 'var(--text-muted)'}}>
//                           Private journey tailored for your comfort.
//                         </p>

//                         <div className="wc-hotel-meta">
//                           <span>{v.capacity ? `${v.capacity} Seater` : "Private Vehicle"}</span>
//                           {v.qty && <span>Qty: {v.qty}</span>}
//                         </div>
//                       </div>
//                     </div>
//                   );
//                 })}
//               </div>
//             </div>
//           )}

//           {/* SECTION: Detailed Itinerary */}
//           {days.length > 0 && (
//             <div className="wc-section">
              
//               <div className="wc-section-header-wrap">
//                 <div className="wc-section-title">
//                   <div className="wc-section-no">{getSectionNo()}</div>
//                   <h2 className="serif">{customer.name ? `${customer.name.split(" ")[0]}, here's your journey` : "Here's your journey"}</h2>
//                 </div>
//                 {/* Expand All / Collapse All Button */}
//                 <button onClick={toggleAllDays} className="wc-expand-btn">
//                   {expandedDays.size === days.length ? 'Collapse all' : 'Expand all'}
//                 </button>
//               </div>
              
//               <div className="wc-timeline-info-box">
//                 <span>ⓘ</span>
//                 <div>Timings and durations are approximate, shown for planning reference only. Actual times may vary based on road conditions, weather and group pace.</div>
//               </div>
              
//               <div className="wc-timeline">
//                 {days.map((day, idx) => {
//                   const dateInfo = getDayMonth(day.date);
//                   const acts = Array.isArray(day.activities) ? day.activities : [];
//                   const firstAct = acts[0] || {};
//                   const img = acts.map(activityImg).find(Boolean) || (idx === 0 ? heroImage : "");
                  
//                   const isExpanded = expandedDays.has(idx);
                  
//                   // SMART BADGE LOGIC: If there is an attraction/sightseeing, always show Sightseeing badge.
//                   const hasAttraction = acts.some(a => a.attraction || (a.title && !a.title.toLowerCase().includes('transfer')));
//                   const badgeText = hasAttraction ? '📸 SIGHTSEEING' : '🚙 TRANSFER';
                  
//                   return (
//                     <React.Fragment key={idx}>
//                       <div className="wc-day-block">
//                         <div className="wc-day-circle">
//                           <strong>{dateInfo.day || idx + 1}</strong>
//                           <span>{dateInfo.month || `DAY`}</span>
//                         </div>

//                         <div className="wc-day-card">
                          
//                           {/* Header (Clickable for Expand/Collapse) */}
//                           <div 
//                             className={`wc-day-header ${isExpanded ? 'expanded' : ''}`} 
//                             onClick={() => toggleDay(idx)}
//                           >
//                             <div>
//                               <div className="wc-day-meta">
//                                 DAY {day.day || idx + 1} · {day.date ? fmtDate(day.date) : ""} {day.location ? `· ${day.location}` : ""}
//                               </div>
//                               <h3 className="wc-day-title">{day.title || firstAct.attraction || `Sightseeing in ${day.location || "City"}`}</h3>
//                             </div>
                            
//                             <div className="wc-day-type-wrap">
//                               <span className="wc-day-type">
//                                 {badgeText}
//                               </span>
//                               <span className={`wc-chevron ${isExpanded ? 'open' : ''}`}>›</span>
//                             </div>
//                           </div>
                          
//                           {/* Body (Hidden if not expanded) */}
//                           {isExpanded && (
//                             <div className="wc-day-body">
//                               {img && <img src={img} alt="Day" className="wc-day-img" />}
//                               <div className="wc-day-details-inner">
//                                 {acts.length > 0 ? (
//                                   <div className="wc-activity-list">
//                                     {acts.map((act, actIdx) => (
//                                       <div className="wc-activity-item" key={actIdx}>
//                                         <h4>{act.startTime ? `${act.startTime} - ` : ""}{act.attraction || act.title || "Activity"}</h4>
//                                         {act.description && <p>{act.description}</p>}
//                                       </div>
//                                     ))}
//                                   </div>
//                                 ) : (
//                                   <p style={{color: 'var(--text-muted)', fontSize: '14px'}}>{day.description || "Day at leisure to explore."}</p>
//                                 )}
//                               </div>
//                             </div>
//                           )}
                          
//                         </div>
//                       </div>
//                     </React.Fragment>
//                   );
//                 })}
//               </div>
//             </div>
//           )}

//           {/* SECTION: Inclusions & Policies Grouping */}
//           <div className="wc-section">
//             <div className="wc-section-header-wrap" style={{marginBottom: '20px'}}>
//               <div className="wc-section-title">
//                 <div className="wc-section-no">{getSectionNo()}</div>
//                 <h2 className="serif">Inclusions & Exclusions</h2>
//               </div>
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


















// new ===========================================







import { useMemo, useEffect, useState } from "react";

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

/* ----------------------------------------------------------------------------
   Rebuilt against the reference design.

   The payload was inventoried first, and the reference belongs to a different
   company, so anything it shows that this payload cannot supply is DROPPED
   rather than filled with a constant. What went, and why:

     • hero trust pills (awards / trips completed / review counts) — no fields
     • "Est. <year>" — `company.since` exists but its only reader defaults it to
       the literal "2015", i.e. the reference site's own number. Rendered only
       when the payload actually carries it.
     • hotel address, occupancy, room amenities, hotel facilities — no fields
     • per-stop durations, "~N min drive" legs, day category tags — no fields
     • transfer duration and distance — vehicles carry pickup/drop, nothing else
     • the graded cancellation band (refund %, rupee amounts, days-out ruler,
       "applies today") — `cancellationPolicies[]` is FREE TEXT, no tiers

   Payment percentages are the one figure derived rather than dropped: the
   instalment amount over the grand total is arithmetic on two fields that are
   both present, not an invented number.
   -------------------------------------------------------------------------- */

const TEAL = "#0F4C4C";
const CORAL = "#FF6B5A";

/* Every image frame removes itself on error instead of leaving a broken icon —
   quotation photos come from operator feeds and dead URLs are routine. */
function Frame({ src, alt, className = "", imgClassName = "", children }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    <div className={className}>
      <img
        src={src}
        alt={alt || ""}
        loading="lazy"
        onError={() => setFailed(true)}
        className={imgClassName}
      />
      {children}
    </div>
  );
}

/* The section number is a small coral numeral set against the serif title, not a
   filled badge — it indexes the page without competing with the heading for
   weight. Coral is otherwise reserved for the single CTA; at this size it reads
   as an ordinal, and the button keeps the only solid fill on the screen. */
function SectionNo({ children }) {
  return (
    <span className="shrink-0 self-baseline text-[13px] font-bold tabular-nums" style={{ color: CORAL }}>
      {children}
    </span>
  );
}

function Chevron({ open }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="wc-motion shrink-0 text-slate-400"
      style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function SectionHeading({ no, title, right }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
      <div className="flex min-w-0 items-baseline gap-2.5">
        <SectionNo>{no}</SectionNo>
        <h2 className="wc-serif min-w-0 text-xl font-semibold text-slate-800 sm:text-2xl">{title}</h2>
      </div>
      {right}
    </div>
  );
}

/* The heading IS the toggle for the closing sections — a separate summary row
   above the content would restate the title and push the first figure further
   down the page. Real <button>, so Enter and Space work without extra key
   handling, and aria-expanded for anyone not looking at the chevron. */
function CollapsibleSection({ id, no, title, open, onToggle, children }) {
  return (
    <section>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={id}
        className="flex w-full items-center justify-between gap-3 border-b border-slate-200 pb-3 text-left"
      >
        <span className="flex min-w-0 items-baseline gap-2.5">
          <SectionNo>{no}</SectionNo>
          <span className="wc-serif min-w-0 text-xl font-semibold text-slate-800 sm:text-2xl">{title}</span>
        </span>
        <Chevron open={open} />
      </button>
      {open && <div id={id} className="pt-5">{children}</div>}
    </section>
  );
}

const textOf = (item) => (typeof item === "string" ? item : item?.text || item?.description || "");
const listOf = (value) =>
  (Array.isArray(value) ? value : typeof value === "string" && value.trim() ? [value] : [])
    .map(textOf)
    .filter((t) => String(t).trim());

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/* ── Cancellation tiers ───────────────────────────────────────────────────────
   The graded refund band needs exactly two numbers per rule: how many days
   before departure it stops applying, and what percentage comes back. Everything
   else on screen is arithmetic on figures already in the payload — the cut-off
   date is travelDate minus the days, the rupee value is grandTotal times the
   percentage.

   So those two are looked for, never assumed. Structured keys win; failing that
   the rule's own sentence is read, because the sentences these arrive as ("Cancel
   30+ days before departure — 90% refund") state both. A rule that yields neither
   is not turned into a tier — it stays a line of text.

   Fewer than two tiers means there is no gradient to draw, and the section falls
   back to the plain list. That is the whole safety net: the band appears only
   when the data genuinely describes one. */
function parseCancellationTiers(policies, travelDate, grandTotal) {
  const total = Number(grandTotal) || 0;
  const departure = travelDate ? new Date(travelDate) : null;
  const valid = departure && !Number.isNaN(departure.getTime());
  const tiers = [];

  (Array.isArray(policies) ? policies : []).forEach((item) => {
    const raw = String(textOf(item) || "").trim();

    let days = num(item?.daysBefore ?? item?.days ?? item?.daysPrior ?? item?.beforeDays);
    let pct = num(item?.refundPercent ?? item?.refundPercentage ?? item?.percent ?? item?.percentage);

    if (pct == null && raw) {
      const m = raw.match(/(\d{1,3})\s*%/);
      if (m) pct = Number(m[1]);
      else if (/no[-\s]*refund|non[-\s]*refundable/i.test(raw)) pct = 0;
    }
    if (days == null && raw) {
      const m = raw.match(/(\d{1,3})\s*\+?\s*days?/i);
      if (m) days = Number(m[1]);
      // "after check-in" / "after departure" is the zero-days end of the scale.
      else if (/after\s*(check[-\s]?in|departure|arrival|travel)/i.test(raw)) days = 0;
    }

    if (pct == null || days == null) return;
    tiers.push({ days, pct: Math.max(0, Math.min(100, pct)), text: raw });
  });

  if (tiers.length < 2) return null;

  tiers.sort((a, b) => b.days - a.days);
  return tiers.map((t) => {
    const refund = Math.round((total * t.pct) / 100);
    return {
      ...t,
      cutoff: valid ? new Date(departure.getTime() - t.days * 86400000) : null,
      refund,
      charge: Math.max(0, total - refund),
    };
  });
}

/* ── Payment plan ─────────────────────────────────────────────────────────────
   `paymentSchedule` is the structured form and wins whenever it is populated —
   but it frequently is not, and the instalments then live in `paymentPolicies`
   as sentences ("Advance Payment — 35%"). PremiumWebView just prints those lines;
   the percentage inside them is enough to build the same three-circle plan, with
   the rupee value derived the way the total already derives everything else.

   Two instalments is the floor: one line mentioning a percentage is a note, not
   a schedule, and drawing a single circle for it would overstate what is known.
   Below that the section still renders — as the policy lines, unchanged. */
function parsePaymentPlan(schedule, policies, grandTotal) {
  const total = Number(grandTotal) || 0;

  if (Array.isArray(schedule) && schedule.length > 0) {
    return {
      fromPolicies: false,
      items: schedule.map((p, i) => {
        const amount = Number(p?.amount ?? p?.value) || 0;
        return {
          label: p?.label || p?.name || `Installment ${i + 1}`,
          amount,
          pct: total > 0 ? Math.round((amount / total) * 100) : null,
          dueDate: p?.dueDate || null,
        };
      }),
    };
  }

  /* A percentage is not automatically an instalment. Tax and surcharge lines
     routinely sit in the same list ("GST 5% extra"), and counting one would put a
     fourth circle on a three-instalment plan and renumber every "N of N". */
  const NOISE = /\b(gst|tcs|tax|vat|cess|service\s*charge|surcharge|convenience|interest|penalty|discount)\b/i;
  /* ...and a line with no percentage is not automatically an instalment either.
     "Payment by bank transfer only" is a note; "Instalment after receiving
     voucher" is a stage. Only the second kind may claim the leftover share. */
  const NOT_A_STAGE = /\b(bank|neft|rtgs|imps|upi|cheque|cash|card|online|wire|contact|note|please|kindly|mode)\b/i;

  const rows = [];
  (Array.isArray(policies) ? policies : []).forEach((item, i) => {
    const raw = String(textOf(item) || "").trim();
    if (!raw || NOISE.test(raw)) return;
    const match = raw.match(/(\d{1,3})\s*%/);
    rows.push({ raw, index: i, pct: match ? Number(match[1]) : null });
  });

  const known = rows.filter((r) => r.pct != null);
  if (known.length === 0) return null;
  const unknown = rows.filter((r) => r.pct == null);
  const knownSum = known.reduce((acc, r) => acc + r.pct, 0);

  /* One stage without a stated percentage is recoverable: a schedule covers the
     whole booking, so whatever the others leave is exactly its share. Two blanks
     cannot be split without guessing how, and neither can a blank when the stated
     shares already reach 100 — in both cases the blanks are dropped and the
     stated instalments have to stand on their own. */
  let plan = rows;
  if (unknown.length === 1 && knownSum < 100 && !NOT_A_STAGE.test(unknown[0].raw)) {
    unknown[0].pct = 100 - knownSum;
  } else if (unknown.length > 0) {
    plan = known;
  }

  const items = plan
    .filter((r) => r.pct != null)
    .map((r) => ({
      /* The label is the sentence minus its percentage clause and any joining
         punctuation, so "Advance Payment — 35% of total" reads as "Advance
         Payment". The clause is replaced by a SPACE, not by nothing: cutting it
         out of the middle of a sentence welded the two halves together and
         printed "Remaining 50% to be paid" as "Remainingto be paid". */
      label: (() => {
        const stripped = r.raw
          .replace(/[-–—:,]?\s*\d{1,3}\s*%\s*(of\s+(the\s+)?(total|package|tour)\s*(cost|amount|value)?)?/i, " ")
          .replace(/\s+/g, " ")
          .replace(/[-–—:,.]\s*$/, "")
          .trim();
        if (!stripped) return `Installment ${r.index + 1}`;
        // Removing a leading "50% " leaves the sentence starting mid-word; give it
        // back its capital so the three labels read as headings, not fragments.
        return stripped.charAt(0).toUpperCase() + stripped.slice(1);
      })(),
      pct: r.pct,
      amount: total > 0 ? Math.round((total * r.pct) / 100) : null,
      dueDate: null,
    }));

  /* The plan has to account for the whole booking. Instalments that do not add up
     to 100% mean the lines were never a schedule — some other percentage got
     swept in, or part of the plan is missing — and half a payment plan shown as a
     whole one is worse than showing the terms as written. Two points of slack
     absorbs the rounding in figures like 33/33/34. */
  const sum = items.reduce((acc, p) => acc + p.pct, 0);
  return items.length >= 2 && Math.abs(sum - 100) <= 2 ? { fromPolicies: true, items } : null;
}

const refundTone = (pct) =>
  pct >= 60
    ? { bg: "#ECFDF5", bar: "#10B981", text: "#047857", chip: "#D1FAE5" }
    : pct >= 20
      ? { bg: "#FFFBEB", bar: "#F59E0B", text: "#B45309", chip: "#FEF3C7" }
      : { bg: "#FEF2F2", bar: "#EF4444", text: "#B91C1C", chip: "#FEE2E2" };

export default function LuxuryWebView({ data, pdfUrl }) {
  /* Memoised because the derived route, hero and meals below all key off these,
     and a fresh {} each render would rebuild every one of them on every render. */
  const q = useMemo(() => data || {}, [data]);
  const customer = q.customer || {};
  const company = q.company || q.organization || {};
  const totals = q.totals || {};

  const [selectedHotel, setSelectedHotel] = useState(null); // State for Hotel Modal

  // Default: Open the first day (index 0)
  const [expandedDays, setExpandedDays] = useState(new Set([0]));
  const [tab, setTab] = useState("itinerary");
  /* Payment schedule opens by default — after the price itself it is the thing a
     customer looks for, and it is three short lines. Cancellation and terms stay
     shut: they are long, and hiding the itinerary behind them helps nobody. */
  const [openPay, setOpenPay] = useState(true);
  const [openCancel, setOpenCancel] = useState(false);
  const [openTerms, setOpenTerms] = useState(false);

  /* `included` is a hard gate on every section: a populated array behind a falsy
     `included` is deliberately not shown. Memoised for the same reason as `q`. */
  const days = useMemo(
    () => (q.sightseeing?.included && Array.isArray(q.sightseeing?.days) ? q.sightseeing.days : []),
    [q]
  );
  const hotels = useMemo(
    () => (q.hotel?.included && Array.isArray(q.hotel?.hotels) ? q.hotel.hotels : []),
    [q]
  );
  const vehicles = useMemo(
    () => (q.vehicle?.included && Array.isArray(q.vehicle?.vehicles) ? q.vehicle.vehicles : []),
    [q]
  );

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

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (selectedHotel) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => { document.body.style.overflow = "auto"; };
  }, [selectedHotel]);

  useEffect(() => {
    if (!selectedHotel) return undefined;
    const onKey = (event) => { if (event.key === "Escape") setSelectedHotel(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedHotel]);

  const destinationText = customer.destination || (Array.isArray(q.destinations) ? q.destinations.join(" · ") : "") || q.destination || "Destination";
  const title = q.title || destinationText;

  const companyPhone = company.phone || company.contactNumber || q.companyPhone || "";
  const companyEmail = company.email || q.companyEmail || "";
  const companyName = company.name || "";
  const grandTotal = totals.grandTotal ?? q.grandTotal;
  /* Rounded whichever way it arrives — the server's own per-adult figure carries
     paise, and "₹21,246.65 per adult" reads as a bank statement rather than as a
     price. Every other figure on the page is whole rupees. */
  const perAdultRaw = totals.perAdult ?? (Number(grandTotal) > 0 && Number(customer.adults) > 0
    ? Number(grandTotal) / Number(customer.adults)
    : null);
  const perAdult = Number.isFinite(Number(perAdultRaw)) ? Math.round(Number(perAdultRaw)) : null;
  const validUntil = q.validUntil || q.quotationValidUntil || q.validTill || null;

  const paxText = [
    customer.adults ? `${customer.adults} Adults` : "",
    customer.children ? `${customer.children} Children` : "",
    customer.infants ? `${customer.infants} Infants` : "",
  ].filter(Boolean).join(" · ");

  const dateRangeText = customer.travelDate
    ? `${fmtDate(customer.travelDate)} — ${fmtDate(q.endDate || new Date(new Date(customer.travelDate).getTime() + (q.nights || 0)*86400000))}`
    : "";

  /* The strip's compact form: "16 Nov – 24 Nov · 8N · 4 Adults", built only from
     the pieces that are actually present so it never reads "· ·". */
  const shortRange = customer.travelDate
    ? `${new Date(customer.travelDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${
        new Date(q.endDate || new Date(customer.travelDate).getTime() + (q.nights || 0) * 86400000)
          .toLocaleDateString("en-GB", { day: "numeric", month: "short" })
      }`
    : "";
  const stripBits = [
    shortRange,
    q.nights ? `${q.nights}N` : "",
    customer.adults ? `${customer.adults} Adults` : "",
  ].filter(Boolean).join(" · ");

  const heroImage = useMemo(() => {
    const firstActivity = days.flatMap((d) => (Array.isArray(d.activities) ? d.activities : [])).find((a) => activityImg(a));
    return q.coverImageUrl || q.heroImageUrl || q.bannerUrl || activityImg(firstActivity) || hotelImg(hotels[0]) || "";
  }, [q, days, hotels]);

  const whatsappHref = companyPhone
    ? `https://wa.me/${cleanPhone(companyPhone)}?text=${encodeURIComponent(`Hello, I have a question about package ${q.quoteNo || ""}`)}`
    : "";

  /* Route stops are grouped out of the day list: consecutive days in the same
     city are one stop. Nights come from that city's hotel when there is one,
     because a hotel states nights outright; the day count is only the fallback. */
  const routeStops = useMemo(() => {
    const out = [];
    days.forEach((d) => {
      const city = String(d.location || (Array.isArray(d.activities) ? d.activities[0]?.city : "") || "").trim();
      if (!city) return;
      const acts = (Array.isArray(d.activities) ? d.activities : [])
        .map((a) => a?.attraction || a?.title)
        .filter(Boolean);
      const prev = out[out.length - 1];
      if (prev && prev.city.toLowerCase() === city.toLowerCase()) {
        prev.dayCount += 1;
        acts.forEach((a) => { if (!prev.attractions.includes(a)) prev.attractions.push(a); });
      } else {
        out.push({ city, dayCount: 1, attractions: [...new Set(acts)] });
      }
    });

    /* Hotels are the fallback, and often the better source: a hotel states its
       city and its night count outright, while a sightseeing day only carries a
       location when whoever built the itinerary filled that box in. With the days
       silent there is no route at all, and the whole timeline — the thing that
       shows a customer where they sleep and for how long — disappears. */
    if (out.length === 0) {
      hotels.forEach((h) => {
        const city = String(h?.city || "").trim();
        if (!city) return;
        const nights = Number(h?.nights);
        const prev = out[out.length - 1];
        if (prev && prev.city.toLowerCase() === city.toLowerCase()) {
          prev.dayCount += Number.isFinite(nights) && nights > 0 ? nights : 1;
        } else {
          out.push({
            city,
            dayCount: Number.isFinite(nights) && nights > 0 ? nights : 1,
            attractions: [],
          });
        }
      });
    }

    return out.map((stop) => {
      const match = hotels.find((h) => String(h?.city || "").trim().toLowerCase() === stop.city.toLowerCase());
      const n = Number(match?.nights);
      return { ...stop, nights: Number.isFinite(n) && n > 0 ? n : stop.dayCount };
    });
  }, [days, hotels]);

  /* Which vehicle covers the leg between two stops, tried from most specific to
     least:

       1. one that names both ends of exactly this leg
       2. one that names the arrival city — the drop is what identifies a leg;
          agents fill pickup less consistently
       3. the trip's only vehicle, when it names no route at all — a single
          unrouted vehicle IS the whole trip's transport, so saying so on each
          leg states what the quotation says

     Anything looser would be a guess. Note the pill carries the vehicle and the
     leg only: this payload has no per-leg duration or distance — VehicleTab
     captures neither — so neither is shown rather than estimated. */
  const soleVehicle = vehicles.length === 1
    && !String(vehicles[0]?.pickup || "").trim()
    && !String(vehicles[0]?.drop || "").trim()
    ? vehicles[0]
    : null;

  const transferBetween = (fromCity, toCity) => {
    if (!fromCity || !toCity) return null;
    const a = String(fromCity).trim().toLowerCase();
    const b = String(toCity).trim().toLowerCase();
    const at = (v, key) => String(v?.[key] || "").trim().toLowerCase();

    return (
      vehicles.find((v) => at(v, "pickup") === a && at(v, "drop") === b)
      || vehicles.find((v) => at(v, "drop") === b)
      || soleVehicle
      || null
    );
  };

  const citiesCount = routeStops.length;
  const thingsToDo = days.reduce((sum, d) => sum + (Array.isArray(d.activities) ? d.activities.length : 0), 0);
  const routeText = routeStops.map((s) => s.city).join(" → ") || destinationText;

  const mealsText = useMemo(() => {
    const plans = [...new Set(hotels.map((h) => String(h?.mealPlan || "").trim()).filter(Boolean))];
    return plans.join(" · ");
  }, [hotels]);

  const inclusions = listOf(q.inclusions);
  const exclusions = listOf(q.exclusions);
  const schedule = useMemo(
    () => (Array.isArray(q.paymentSchedule) ? q.paymentSchedule : []),
    [q]
  );
  const cancellation = useMemo(
    () => (Array.isArray(q.cancellationPolicies) ? q.cancellationPolicies : []),
    [q]
  );
  const terms = Array.isArray(q.bookingTerms) ? q.bookingTerms : [];
  const paymentNotes = useMemo(
    () => (Array.isArray(q.paymentPolicies) ? q.paymentPolicies : []),
    [q]
  );

  const paymentPlan = useMemo(
    () => parsePaymentPlan(schedule, paymentNotes, grandTotal),
    [schedule, paymentNotes, grandTotal]
  );
  const planTotal = paymentPlan
    ? paymentPlan.items.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    : 0;
  const showPayment = Boolean(paymentPlan) || paymentNotes.length > 0;

  const cancelTiers = useMemo(
    () => parseCancellationTiers(cancellation, customer.travelDate, grandTotal),
    [cancellation, customer.travelDate, grandTotal]
  );

  /* "Today" is read once, when the page mounts, rather than on every render — the
     band and the highlighted row must agree with each other, and a clock that
     moved between two renders could put them a day apart. */
  const [now] = useState(() => Date.now());

  /* Which rule a cancellation made today would fall under: the first one whose
     cut-off has not passed yet. -1 once every cut-off is behind us. */
  const activeTierIndex = useMemo(() => {
    if (!cancelTiers) return -1;
    return cancelTiers.findIndex((t) => t.cutoff && t.cutoff.getTime() >= now);
  }, [cancelTiers, now]);

  /* Segment widths track real elapsed time, so the band reads as a calendar rather
     than as equal boxes: the long stretch you are probably still in looks long.

     One width per TIER, not per boundary. A tier's segment runs from the previous
     tier's cut-off to its own, and the first runs from today to the first cut-off
     — so the widths are the gaps BETWEEN cut-offs, of which there are exactly as
     many as there are tiers. Getting that count wrong leaves the band short of
     100% and slides every date on the ruler one column to the left.

     A floor keeps a three-day window from collapsing to an invisible sliver. */
  const bandWidths = useMemo(() => {
    if (!cancelTiers) return [];
    const first = cancelTiers[0];
    if (!first?.cutoff) return cancelTiers.map(() => 100 / cancelTiers.length);
    const spans = [Math.max(0, Math.round((first.cutoff.getTime() - now) / 86400000))];
    for (let i = 1; i < cancelTiers.length; i += 1) {
      spans.push(Math.max(0, cancelTiers[i - 1].days - cancelTiers[i].days));
    }
    const raw = spans.map((s) => Math.max(s, 1));
    const sum = raw.reduce((a, b) => a + b, 0) || 1;
    const MIN = 8;
    const pct = raw.map((s) => Math.max(MIN, (s / sum) * 100));
    const scale = 100 / pct.reduce((a, b) => a + b, 0);
    return pct.map((p) => p * scale);
  }, [cancelTiers, now]);

  const noRefundAfter = useMemo(() => {
    if (!cancelTiers) return null;
    const zero = cancelTiers.filter((t) => t.pct === 0 && t.cutoff);
    return zero.length ? zero[0].cutoff : null;
  }, [cancelTiers]);

  /* Section numbers are assigned over the sections that will actually render, so
     dropping one does not leave a gap in the sequence. */
  const rendered = [
    hotels.length ? "hotels" : null,
    days.length ? "days" : null,
    (inclusions.length || exclusions.length) ? "incl" : null,
    showPayment ? "pay" : null,
    cancellation.length ? "cancel" : null,
    terms.length ? "terms" : null,
  ].filter(Boolean);
  const no = (key) => String(rendered.indexOf(key) + 1).padStart(2, "0");

  const aboutBits = [company.tagline || company.companyTagline, company.address, companyPhone, companyEmail, company.website || q.companyWebsite, company.gst].filter(Boolean);
  const showAbout = Boolean(companyName) && aboutBits.length > 0;

  const initial = String(customer.name || "").trim().charAt(0).toUpperCase() || "?";

  const costCard = (
    <div className="overflow-hidden rounded-2xl">
      <div className="px-5 py-5 text-white" style={{ background: TEAL }}>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">Total tour cost</p>
        <p className="wc-serif mt-1 text-3xl font-semibold">{inr(grandTotal)}</p>
        {perAdult != null && (
          <p className="mt-1 text-xs text-white/70">{inr(perAdult)} per adult</p>
        )}
      </div>
      <div className="border border-t-0 border-slate-200 bg-white">
        <dl className="divide-y divide-slate-100 text-sm">
          {routeText && (
            <div className="flex gap-3 px-4 py-3">
              <dt className="w-24 shrink-0 text-xs font-semibold text-slate-400">Route</dt>
              <dd className="min-w-0 font-semibold text-slate-700">{routeText}</dd>
            </div>
          )}
          {(q.days || q.nights) && (
            <div className="flex gap-3 px-4 py-3">
              <dt className="w-24 shrink-0 text-xs font-semibold text-slate-400">Duration</dt>
              <dd className="min-w-0 font-semibold text-slate-700">
                {[q.days ? `${q.days} Days` : "", q.nights ? `${q.nights} Nights` : ""].filter(Boolean).join(" · ")}
              </dd>
            </div>
          )}
          {dateRangeText && (
            <div className="flex gap-3 px-4 py-3">
              <dt className="w-24 shrink-0 text-xs font-semibold text-slate-400">Dates</dt>
              <dd className="min-w-0 font-semibold text-slate-700">{dateRangeText}</dd>
            </div>
          )}
          {(paxText || q.rooms || customer.rooms) && (
            <div className="flex gap-3 px-4 py-3">
              <dt className="w-24 shrink-0 text-xs font-semibold text-slate-400">Travellers</dt>
              <dd className="min-w-0 font-semibold text-slate-700">
                {[paxText, (q.rooms || customer.rooms) ? `${q.rooms || customer.rooms} Rooms` : ""].filter(Boolean).join(" · ")}
              </dd>
            </div>
          )}
          {mealsText && (
            <div className="flex gap-3 px-4 py-3">
              <dt className="w-24 shrink-0 text-xs font-semibold text-slate-400">Meals</dt>
              <dd className="min-w-0 font-semibold text-slate-700">{mealsText}</dd>
            </div>
          )}
          {validUntil && (
            <div className="flex gap-3 px-4 py-3">
              <dt className="w-24 shrink-0 text-xs font-semibold text-slate-400">Valid till</dt>
              <dd className="min-w-0 font-semibold text-slate-700">{fmtDate(validUntil)}</dd>
            </div>
          )}
        </dl>

        <div className="space-y-2 border-t border-slate-100 p-4">
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="block w-full rounded-lg px-4 py-3 text-center text-sm font-bold text-white"
              style={{ background: CORAL }}
            >
              Proceed with This Package →
            </a>
          )}
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-center text-sm font-bold"
              style={{ borderColor: TEAL, color: TEAL }}
            >
              <span aria-hidden="true">✆</span> Ask a Question
            </a>
          )}
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="block w-full text-center text-xs font-semibold text-slate-400 hover:text-slate-600"
            >
              Download PDF
            </a>
          )}
        </div>

        {(company.address || company.since) && (
          <p className="border-t border-slate-100 px-4 py-3 text-[11px] text-slate-400">
            {[company.address, company.since ? `Since ${company.since}` : ""].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F7F8F8] pb-24 text-slate-800 lg:pb-0">
      {/* Only the type faces and the two things Tailwind cannot express live here:
          the serif display face, and the reduced-motion opt-out. */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap');
        .wc-serif { font-family: 'Playfair Display', Georgia, serif; }
        .wc-stars { color: #E9C46A; letter-spacing: 1px; }
        .wc-policy ul { list-style: decimal; padding-left: 1.25rem; }
        .wc-policy li { margin-bottom: .5rem; font-size: .875rem; line-height: 1.6; color: #475569; }
        .wc-policy p { font-size: .875rem; color: #94a3b8; }
        .wc-motion { transition: transform .2s ease; }
        @media (prefers-reduced-motion: reduce) {
          .wc-motion, .wc-motion * { transition: none !important; animation: none !important; }
        }
      `}</style>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-3 py-2.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <Frame src={company.logo || company.logoUrl} alt={companyName} className="shrink-0" imgClassName="h-8 w-auto object-contain" />
            {companyName && (
              <span className="wc-serif truncate text-base font-semibold" style={{ color: TEAL }}>{companyName}</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {companyPhone && (
              <a href={`tel:${cleanPhone(companyPhone)}`} className="hidden text-sm font-semibold sm:block" style={{ color: TEAL }}>
                {companyPhone}
              </a>
            )}
            {whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="rounded-full px-3 py-2 text-xs font-bold text-white sm:px-5 sm:text-sm"
                style={{ background: CORAL }}
              >
                Chat with Us →
              </a>
            )}
          </div>
        </div>

        {/* Summary strip — sticks with the bar so the name and the total stay put. */}
        {(customer.name || grandTotal != null) && (
          <div className="border-t border-slate-100 bg-white">
            <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-3 py-2 sm:px-5">
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ background: TEAL }}
                  aria-hidden="true"
                >
                  {initial}
                </span>
                <div className="min-w-0">
                  {customer.name && <p className="truncate text-sm font-bold text-slate-800">{customer.name}</p>}
                  {stripBits && <p className="truncate text-[11px] text-slate-500">{stripBits}</p>}
                </div>
              </div>
              {grandTotal != null && (
                <div className="shrink-0 text-right">
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">Total</p>
                  <p className="text-base font-bold sm:text-lg" style={{ color: TEAL }}>{inr(grandTotal)}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      {/* Sized by min-height rather than by the text it holds: the cover photo is
          the first thing anyone sees and a hero that only ever grew to fit two
          lines of copy left it a letterbox strip. Heights climb with the viewport
          and stop short of filling it, so the itinerary still shows underneath and
          the page reads as a document, not a splash screen. */}
      <section
        className="relative isolate flex min-h-[340px] items-center overflow-hidden sm:min-h-[440px] lg:min-h-[560px]"
        style={{ background: TEAL }}
      >
        <Frame
          src={heroImage}
          alt={destinationText}
          className="absolute inset-0"
          imgClassName="h-full w-full object-cover"
        />
        {/* Teal scrim, not a plain black one — the headline has to hold on a bright
            beach photo and on a dark mountain one alike. */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(15,76,76,.55) 0%, rgba(15,76,76,.82) 100%)" }} aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-[900px] px-4 py-14 text-center text-white sm:py-20">
          {q.quoteNo && (
            <span className="inline-block rounded-full border border-[#E9C46A]/60 px-3 py-1 text-[11px] font-bold tracking-[0.15em] text-[#E9C46A]">
              ✦ TRIP #{q.quoteNo}
            </span>
          )}
          <h1 className="wc-serif mt-4 break-words text-3xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          {(customer.name || dateRangeText) && (
            <p className="mt-4 text-sm text-white/85 sm:text-base">
              {customer.name ? `Hi ${customer.name} — here's your handcrafted trip` : "Here's your handcrafted trip"}
              {dateRangeText && <span className="text-[#A7E8D2]"> · {dateRangeText}</span>}
            </p>
          )}
          {/* The reference's trust pills (awards, trips completed, review counts)
              have no field in this payload, so the row is dropped rather than
              filled with another company's numbers. */}
        </div>
      </section>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      {showAbout && (
        <div className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-[1200px] gap-1 overflow-x-auto px-3 sm:px-5">
            {[
              { key: "itinerary", label: "Your Itinerary" },
              { key: "about", label: `About ${companyName}` },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                aria-current={tab === t.key ? "page" : undefined}
                className="whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold"
                style={{
                  borderColor: tab === t.key ? TEAL : "transparent",
                  color: tab === t.key ? TEAL : "#94a3b8",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {showAbout && tab === "about" ? (
        <div className="mx-auto max-w-[1200px] px-3 py-8 sm:px-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="wc-serif text-xl font-semibold" style={{ color: TEAL }}>{companyName}</h2>
            {(company.tagline || company.companyTagline) && (
              <p className="mt-1 text-sm text-slate-500">{company.tagline || company.companyTagline}</p>
            )}
            <dl className="mt-4 divide-y divide-slate-100 text-sm">
              {[
                ["Address", company.address],
                ["Phone", companyPhone],
                ["Email", companyEmail],
                ["Website", company.website || q.companyWebsite],
                ["Since", company.since],
                ["GST", company.gst],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="flex gap-3 py-2.5">
                  <dt className="w-24 shrink-0 text-xs font-semibold text-slate-400">{k}</dt>
                  <dd className="min-w-0 break-words font-medium text-slate-700">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      ) : (
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-6 px-3 py-6 sm:px-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-8 lg:py-10">
          {/* On phones the cost card leads: the price is the first thing anyone
              opening a quotation looks for, and the sidebar is far below. */}
          <div className="lg:hidden">{costCard}</div>

          <main className="min-w-0 space-y-10">
            {/* ── Trip at a glance ─────────────────────────────────────────── */}
            {(q.nights || citiesCount > 0 || thingsToDo > 0) && (
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-white sm:px-5" style={{ background: TEAL }}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/75">Trip at a glance</p>
                  {routeText && (
                    <p className="min-w-0 truncate text-xs font-semibold">
                      <span aria-hidden="true">📍</span> {routeText}
                    </p>
                  )}
                </div>

                {/* Three tiles rather than three columns of one strip: each figure is
                    measured differently and the borders stop them being read as a sum. */}
                <div className="grid grid-cols-3 gap-3 p-4 sm:gap-4 sm:p-5">
                  {[
                    [q.nights, "Nights"],
                    [citiesCount || null, "Cities"],
                    [thingsToDo || null, "Things to do"],
                  ].map(([value, label]) => (
                    <div key={label} className="rounded-xl border border-slate-200 bg-slate-50/70 px-2 py-4 text-center sm:py-5">
                      <p className="wc-serif text-2xl font-semibold sm:text-3xl" style={{ color: TEAL }}>
                        {value ?? "—"}
                      </p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
                    </div>
                  ))}
                </div>

                {routeStops.length > 0 && (
                  <ol className="space-y-0 border-t border-slate-100 p-4 sm:p-5">
                    <li className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Route</li>
                    {routeStops.map((stop, i) => {
                      const nextStop = routeStops[i + 1];
                      const transfer = nextStop ? transferBetween(stop.city, nextStop.city) : null;
                      return (
                        <li key={`${stop.city}-${i}`}>
                          <div className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <span
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                                style={{ background: TEAL }}
                              >
                                {stop.nights}N
                              </span>
                              {nextStop && <span className="w-px flex-1 bg-slate-200" aria-hidden="true" />}
                            </div>
                            <div className="min-w-0 flex-1 pb-4">
                              <p className="wc-serif text-base font-semibold text-slate-800">{stop.city}</p>
                              {stop.attractions.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                  {stop.attractions.slice(0, 6).map((a, ai) => (
                                    <span key={ai} className="rounded-full bg-[#DFF3EE] px-2.5 py-1 text-[11px] font-semibold" style={{ color: TEAL }}>
                                      {a}
                                    </span>
                                  ))}
                                  {stop.attractions.length > 6 && (
                                    <span className="px-1 py-1 text-[11px] font-semibold text-slate-400">
                                      +{stop.attractions.length - 6} more
                                    </span>
                                  )}
                                </div>
                              )}
                              {transfer && (
                                <div className="mt-3 inline-flex flex-wrap items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-500">
                                  {vehicleImg(transfer) ? (
                                    <Frame
                                      src={vehicleImg(transfer)}
                                      alt=""
                                      className="h-4 w-4 shrink-0 overflow-hidden rounded-full"
                                      imgClassName="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <span aria-hidden="true">🚐</span>
                                  )}
                                  {transfer.model || transfer.type || "Transfer"}
                                  <span className="text-slate-300">·</span>
                                  {stop.city} → {nextStop.city}
                                </div>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>
            )}

            {/* ── 01 Where you'll stay ─────────────────────────────────────── */}
            {hotels.length > 0 && (
              <section>
                <SectionHeading no={no("hotels")} title="Where you'll stay" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {hotels.map((h, i) => {
                    const stars = h?.stars ?? h?.rating;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedHotel(h)}
                        className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left hover:border-slate-300"
                      >
                        <Frame
                          src={hotelImg(h)}
                          alt={h?.name}
                          className="relative h-40 w-full overflow-hidden"
                          imgClassName="h-full w-full object-cover"
                        >
                          {h?.city && (
                            <span className="absolute bottom-2 left-2 rounded bg-white/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: TEAL }}>
                              {h.city}
                            </span>
                          )}
                          {stars ? (
                            <span className="absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-[11px]">
                              <Stars value={stars} />
                            </span>
                          ) : null}
                        </Frame>

                        <div className="flex min-w-0 flex-1 flex-col p-4">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="min-w-0 text-sm font-bold text-slate-800">{h?.name || "Selected Hotel"}</h3>
                            {h?.mealPlan && (
                              <span className="shrink-0 rounded bg-[#FFF7ED] px-2 py-0.5 text-[10px] font-bold text-[#B45309]">
                                {h.mealPlan}
                              </span>
                            )}
                          </div>
                          {h?.roomType && <p className="mt-1 text-xs font-semibold" style={{ color: TEAL }}>{h.roomType}</p>}
                          <p className="mt-2 text-[11px] text-slate-500">
                            {[
                              h?.rooms ? `${h.rooms} Rooms` : "",
                              h?.nights ? `${h.nights} Nights` : "",
                              h?.mealPlan || "",
                            ].filter(Boolean).join(" · ")}
                          </p>
                          <span className="mt-auto border-t border-slate-100 pt-3 text-xs font-bold" style={{ color: TEAL }}>
                            View details →
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
                  Hotel ratings are as reported by the operator and photographs are indicative. Similar
                  properties may be substituted subject to availability.
                </p>
              </section>
            )}

            {/* ── 02 Day by day ───────────────────────────────────────────── */}
            {days.length > 0 && (
              <section>
                <SectionHeading
                  no={no("days")}
                  title={customer.name ? `${customer.name}, here's your journey` : "Here's your journey"}
                  right={
                    <button
                      type="button"
                      onClick={toggleAllDays}
                      aria-expanded={expandedDays.size === days.length}
                      className="rounded-lg px-2 py-1 text-xs font-bold hover:bg-slate-100"
                      style={{ color: TEAL }}
                    >
                      {expandedDays.size === days.length ? "Collapse all" : "Expand all"}
                    </button>
                  }
                />

                <p className="mb-4 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2.5 text-[11px] leading-relaxed text-[#92400E]">
                  Timings shown are approximate planning references and may shift with traffic, weather
                  and local conditions on the day.
                </p>

                <div className="space-y-3">
                  {days.map((d, idx) => {
                    const open = expandedDays.has(idx);
                    const acts = Array.isArray(d?.activities) ? d.activities : [];
                    const city = d?.location || acts[0]?.city || "";
                    const dm = getDayMonth(d?.date);
                    const dayNo = d?.day || idx + 1;
                    const dayTitle = acts[0]?.attraction || d?.title || `Day ${dayNo}`;
                    const startTime = acts.find((a) => a?.startTime)?.startTime || "";
                    const dayPhoto = activityImg(acts.find((a) => activityImg(a)) || {});
                    const nextCity = days[idx + 1]?.location || days[idx + 1]?.activities?.[0]?.city || "";
                    const transfer = nextCity && String(nextCity).toLowerCase() !== String(city).toLowerCase()
                      ? transferBetween(city, nextCity)
                      : null;

                    return (
                      <div key={idx}>
                        <div className="flex gap-3">
                          <div className="hidden w-14 shrink-0 flex-col items-center sm:flex">
                            {/* Solid rather than outlined: the rail repeats down the whole
                                itinerary, and filling it makes the dates read as one column
                                at a glance — the same deep teal the route timeline's night
                                circles use, so the two rails match. */}
                            <span
                              className="flex h-14 w-14 flex-col items-center justify-center rounded-xl"
                              style={{ background: TEAL }}
                            >
                              <span className="wc-serif text-lg font-semibold leading-none text-white">
                                {dm.day || dayNo}
                              </span>
                              <span className="mt-0.5 text-[9px] font-bold tracking-wide text-white/75">
                                {dm.month || "DAY"}
                              </span>
                            </span>
                            {idx < days.length - 1 && <span className="mt-2 w-px flex-1 bg-slate-200" aria-hidden="true" />}
                          </div>

                          <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white">
                            <button
                              type="button"
                              onClick={() => toggleDay(idx)}
                              aria-expanded={open}
                              aria-controls={`wc-day-${idx}`}
                              className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left hover:bg-slate-50"
                            >
                              <span className="min-w-0">
                                <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                                  {[`Day ${dayNo}`, dm.day ? `${dm.day} ${dm.month}` : "", city].filter(Boolean).join(" · ")}
                                </span>
                                <span className="wc-serif mt-0.5 block text-base font-semibold text-slate-800">
                                  {dayTitle}
                                </span>
                              </span>
                              <span className="flex shrink-0 items-center gap-2">
                                {startTime && (
                                  <span className="hidden rounded-full bg-[#DFF3EE] px-2 py-0.5 text-[10px] font-bold sm:inline" style={{ color: TEAL }}>
                                    {startTime}
                                  </span>
                                )}
                                <Chevron open={open} />
                              </span>
                            </button>

                            {open && (
                              <div id={`wc-day-${idx}`} className="border-t border-slate-100">
                                <Frame
                                  src={dayPhoto}
                                  alt={dayTitle}
                                  className="relative h-44 w-full overflow-hidden sm:h-56"
                                  imgClassName="h-full w-full object-cover"
                                >
                                  {city && (
                                    <span className="absolute bottom-2 left-2 rounded bg-white/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: TEAL }}>
                                      {city}
                                    </span>
                                  )}
                                </Frame>

                                {acts.length > 0 && (
                                  <p className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-[11px] font-semibold text-slate-500">
                                    {acts.length} {acts.length === 1 ? "stop" : "stops"}
                                    {city ? ` in ${city}` : ""}
                                  </p>
                                )}

                                {acts.length > 0 ? (
                                  <ol className="p-4">
                                    {acts.map((a, ai) => (
                                      <li key={ai} className="flex gap-3">
                                        {/* The time gutter only exists from sm up; on a phone the
                                            time sits inline above the stop instead. */}
                                        <span className="hidden w-14 shrink-0 pt-0.5 text-right text-[11px] font-bold text-slate-400 sm:block">
                                          {a?.startTime || ""}
                                        </span>
                                        <span className="flex flex-col items-center">
                                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: TEAL }} aria-hidden="true" />
                                          {ai < acts.length - 1 && <span className="w-px flex-1 bg-slate-200" aria-hidden="true" />}
                                        </span>
                                        <span className="min-w-0 flex-1 pb-4">
                                          {a?.startTime && (
                                            <span className="mb-0.5 block text-[11px] font-bold text-slate-400 sm:hidden">
                                              {a.startTime}
                                            </span>
                                          )}
                                          <span className="block text-sm font-semibold text-slate-800">
                                            {a?.attraction || a?.title || "Activity"}
                                          </span>
                                          {a?.description && (
                                            <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-slate-500">
                                              {a.description}
                                            </span>
                                          )}
                                          {Array.isArray(a?.meals) && a.meals.length > 0 && (
                                            <span className="mt-1.5 flex flex-wrap gap-1">
                                              {a.meals.map((m, mi) => (
                                                <span key={mi} className="rounded bg-[#FFF7ED] px-1.5 py-0.5 text-[10px] font-bold text-[#B45309]">
                                                  {m}
                                                </span>
                                              ))}
                                            </span>
                                          )}
                                        </span>
                                      </li>
                                    ))}
                                  </ol>
                                ) : (
                                  <p className="px-4 py-5 text-sm text-slate-400">
                                    {d?.description || "Day at leisure."}
                                  </p>
                                )}

                                {d?.overnightStay && (
                                  <p className="border-t border-slate-100 px-4 py-2.5 text-[11px] font-semibold text-slate-500">
                                    <span aria-hidden="true">🛏</span> Overnight · {d.overnightStay}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {transfer && (
                          <div className="my-2 flex justify-center">
                            <div className="inline-flex flex-wrap items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-500">
                              {vehicleImg(transfer) ? (
                                <Frame
                                  src={vehicleImg(transfer)}
                                  alt=""
                                  className="h-4 w-4 shrink-0 overflow-hidden rounded-full"
                                  imgClassName="h-full w-full object-cover"
                                />
                              ) : (
                                <span aria-hidden="true">🚐</span>
                              )}
                              {transfer.model || transfer.type || "Transfer"}
                              <span className="text-slate-300">·</span>
                              {city} → {nextCity}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── 03 Inclusions & exclusions ──────────────────────────────── */}
            {(inclusions.length > 0 || exclusions.length > 0) && (
              <section>
                <SectionHeading no={no("incl")} title="Inclusions & Exclusions" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {inclusions.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" /> Included
                      </p>
                      <ul className="divide-y divide-slate-100">
                        {inclusions.map((t, i) => (
                          <li key={i} className="flex gap-2 py-2 text-sm text-slate-600">
                            <span className="shrink-0 font-bold text-emerald-600" aria-hidden="true">✓</span>
                            <span className="min-w-0">{t}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {exclusions.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                        <span className="h-2 w-2 rounded-full bg-rose-500" aria-hidden="true" /> Not included
                      </p>
                      <ul className="divide-y divide-slate-100">
                        {exclusions.map((t, i) => (
                          <li key={i} className="flex gap-2 py-2 text-sm text-slate-600">
                            <span className="shrink-0 font-bold text-rose-500" aria-hidden="true">✕</span>
                            <span className="min-w-0">{t}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ── 04 Payment schedule ─────────────────────────────────────── */}
            {showPayment && (
              <CollapsibleSection
                id="wc-pay"
                no={no("pay")}
                title="Payment schedule"
                open={openPay}
                onToggle={() => setOpenPay((v) => !v)}
              >
                {paymentPlan ? (
                  <>
                    {/* Flex, not grid: the column count is data-driven and an inline
                        grid-template would beat the responsive class, forcing three
                        columns onto a 320px screen. Here the instalments simply stack
                        below sm and share the row above it, whatever the count.

                        The connector runs behind the circles — they carry their own
                        fill, so it reads as one track rather than passing through them
                        — and it stops at the first and last circle rather than running
                        to the edges. */}
                    <div className="relative flex flex-col gap-6 sm:flex-row sm:gap-4">
                      <span
                        className="absolute top-6 hidden h-px bg-slate-200 sm:block"
                        style={{
                          left: `${50 / paymentPlan.items.length}%`,
                          right: `${50 / paymentPlan.items.length}%`,
                        }}
                        aria-hidden="true"
                      />
                      {paymentPlan.items.map((p, i) => (
                        <div key={i} className="relative min-w-0 text-center sm:flex-1">
                          <span
                            className="relative z-10 mx-auto flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white"
                            style={{ background: TEAL }}
                          >
                            {p.pct != null ? `${p.pct}%` : i + 1}
                          </span>
                          <p className="mt-3 text-sm font-bold text-slate-800">{p.label}</p>
                          {p.amount != null && (
                            <p className="mt-1 text-sm font-bold" style={{ color: TEAL }}>{inr(p.amount)}</p>
                          )}
                          <p className="mt-1 text-[11px] text-slate-400">
                            Instalment {i + 1} of {paymentPlan.items.length}
                            {p.dueDate ? ` · due ${fmtDate(p.dueDate)}` : ""}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-100 px-4 py-3.5">
                      <span className="text-sm font-semibold text-slate-500">Total package value</span>
                      <span className="text-base font-bold" style={{ color: TEAL }}>
                        {inr(grandTotal ?? planTotal)}
                      </span>
                    </div>

                    {/* Only when the plan came from the structured schedule — if the
                        policy lines ARE the instalments, repeating them below the
                        circles would print the same three facts twice. */}
                    {!paymentPlan.fromPolicies && paymentNotes.length > 0 && (
                      <div className="wc-policy mt-4">{renderPolicyList(paymentNotes)}</div>
                    )}
                  </>
                ) : (
                  /* No percentage anywhere to build a plan from, so the payment terms
                     are shown as written rather than as invented instalments. */
                  <div className="wc-policy">{renderPolicyList(paymentNotes)}</div>
                )}
              </CollapsibleSection>
            )}

            {/* ── 05 Cancellation policy ──────────────────────────────────── */}
            {cancellation.length > 0 && (
              <CollapsibleSection
                id="wc-cancel"
                no={no("cancel")}
                title="Cancellation policy"
                open={openCancel}
                onToggle={() => setOpenCancel((v) => !v)}
              >
                {cancelTiers ? (
                    <div className="space-y-4">
                      {noRefundAfter && (
                        <p className="flex items-start gap-2 text-sm font-semibold text-rose-600">
                          <span aria-hidden="true">✕</span>
                          <span>No refund if cancelled after {fmtDate(noRefundAfter)}</span>
                        </p>
                      )}

                      {/* Band and ruler scroll together rather than compressing: at 320px
                          six segments would each be forty pixels wide and unreadable. */}
                      <div className="-mx-4 overflow-x-auto px-4">
                        <div className="min-w-[560px]">
                          <div className="flex overflow-hidden rounded-lg border border-slate-200">
                            {cancelTiers.map((t, i) => {
                              const tone = refundTone(t.pct);
                              return (
                                <div
                                  key={i}
                                  className="border-r border-white/70 px-2 py-2 text-center last:border-r-0"
                                  style={{ width: `${bandWidths[i]}%`, background: tone.bg }}
                                >
                                  <span className="text-[11px] font-bold" style={{ color: tone.text }}>
                                    {t.pct > 0 ? `${t.pct}% Refund` : "Non Refundable"}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          {/* Each cell is one band segment, and it labels its own LEFT
                              edge — so cell 0 reads "NOW" and every later cell reads the
                              cut-off that opened it. The trailing marker closes the last
                              segment and carries the departure date. */}
                          <div className="mt-1.5 flex">
                            {cancelTiers.map((t, i) => {
                              const boundary = i === 0 ? null : cancelTiers[i - 1];
                              return (
                                <div key={i} className="shrink-0 text-left" style={{ width: `${bandWidths[i]}%` }}>
                                  {boundary ? (
                                    <>
                                      <span className="block text-[10px] font-semibold text-slate-500">
                                        {boundary.cutoff
                                          ? boundary.cutoff.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                                          : "—"}
                                      </span>
                                      <span className="block text-[10px] font-bold" style={{ color: refundTone(boundary.pct).text }}>
                                        {boundary.days}d
                                      </span>
                                    </>
                                  ) : (
                                    <span className="block text-[10px] font-bold text-slate-500">NOW</span>
                                  )}
                                </div>
                              );
                            })}
                            <div className="shrink-0 text-left">
                              <span className="block text-[10px] font-semibold text-slate-500">
                                {customer.travelDate
                                  ? new Date(customer.travelDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                                  : "—"}
                              </span>
                              <span className="block text-[10px] font-bold text-slate-400">Check-in</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
                        {cancelTiers.map((t, i) => {
                          const tone = refundTone(t.pct);
                          const active = i === activeTierIndex;
                          return (
                            <li
                              key={i}
                              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-3"
                              style={active ? { background: tone.bg } : undefined}
                            >
                              {active && (
                                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: tone.bar }} aria-hidden="true" />
                              )}
                              <span className="min-w-0 flex-1 text-sm text-slate-700">
                                {t.text}
                                {active && <span className="ml-2 text-[10px] font-bold uppercase tracking-wide" style={{ color: tone.text }}>Applies today</span>}
                              </span>
                              <span className="shrink-0 text-right">
                                <span
                                  className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                                  style={{ background: tone.chip, color: tone.text }}
                                >
                                  {t.pct > 0 ? `${t.pct}% refund` : "No refund"}
                                </span>
                                <span className="mt-0.5 block text-[11px] font-semibold text-slate-500">
                                  {t.pct > 0 ? `${inr(t.refund)} back` : `${inr(t.charge)} charge`}
                                </span>
                              </span>
                            </li>
                          );
                        })}
                      </ul>

                      {Number(grandTotal) > 0 && (
                        <p className="text-[11px] leading-relaxed text-slate-400">
                          * Refund / cancellation charge is calculated on the total package cost of{" "}
                          <span className="font-bold text-slate-500">{inr(grandTotal)}</span>, not on the amount paid so far.
                        </p>
                      )}
                    </div>
                  ) : (
                    /* No parseable tier in the payload, so no gradient is drawn — the rules
                       are shown as written rather than as invented percentages. */
                    <div className="wc-policy">{renderPolicyList(cancellation)}</div>
                  )}
              </CollapsibleSection>
            )}

            {/* ── 06 Terms & conditions ───────────────────────────────────── */}
            {terms.length > 0 && (
              <CollapsibleSection
                id="wc-terms"
                no={no("terms")}
                title="Terms & Conditions"
                open={openTerms}
                onToggle={() => setOpenTerms((v) => !v)}
              >
                <div className="wc-policy">{renderPolicyList(terms)}</div>
              </CollapsibleSection>
            )}

            {listOf(q.importantNotes || q.notes).length > 0 && (
              <section className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#92400E]">Important notes</p>
                <ul className="space-y-1.5">
                  {listOf(q.importantNotes || q.notes).map((t, i) => (
                    <li key={i} className="text-[13px] leading-relaxed text-[#92400E]">• {t}</li>
                  ))}
                </ul>
              </section>
            )}

            {(q.preparedBy || q.createdByName || company.contactPerson) && (
              <p className="text-center text-[11px] text-slate-400">
                Prepared by {q.preparedBy || q.createdByName || company.contactPerson}
                {q.createdAt ? ` · ${fmtDate(q.createdAt)}` : ""}
              </p>
            )}
          </main>

          <aside className="hidden lg:sticky lg:top-32 lg:block">{costCard}</aside>
        </div>
      )}

      {/* ── Mobile action bar ───────────────────────────────────────────────── */}
      {whatsappHref && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white px-3 py-2.5 lg:hidden">
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">Total</p>
              <p className="truncate text-base font-bold" style={{ color: TEAL }}>{inr(grandTotal)}</p>
            </div>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="ml-auto shrink-0 rounded-lg px-4 py-3 text-sm font-bold text-white"
              style={{ background: CORAL }}
            >
              Proceed →
            </a>
          </div>
        </div>
      )}

      {/* ── Hotel modal ─────────────────────────────────────────────────────── */}
      {selectedHotel && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={(event) => { if (event.target === event.currentTarget) setSelectedHotel(null); }}
          role="dialog"
          aria-modal="true"
          aria-label={selectedHotel?.name || "Hotel details"}
        >
          {/* Bottom sheet on a phone, centred card from sm. The header is outside the
              scrolling body on purpose — the close button must stay reachable however
              long the room list runs. */}
          <div className="flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl">
            <div className="relative shrink-0">
              <Frame
                src={hotelImg(selectedHotel)}
                alt={selectedHotel?.name}
                className="h-40 w-full overflow-hidden sm:h-52"
                imgClassName="h-full w-full object-cover"
              />
              {selectedHotel?.nights ? (
                <span className="absolute bottom-2 left-3 rounded-full bg-white/95 px-3 py-1 text-[11px] font-bold" style={{ color: TEAL }}>
                  {selectedHotel.nights} Nights
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => setSelectedHotel(null)}
                aria-label="Close"
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-600 shadow"
              >
                ✕
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <h3 className="wc-serif text-lg font-semibold text-slate-800">{selectedHotel?.name || "Selected Hotel"}</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {[selectedHotel?.city, selectedHotel?.country].filter(Boolean).join(", ")}
                {(selectedHotel?.stars ?? selectedHotel?.rating) ? <> · <Stars value={selectedHotel?.stars ?? selectedHotel?.rating} /></> : null}
              </p>
              {/* The reference shows a street address, occupancy, room amenities and
                  hotel facilities. None of the four exists on this payload's hotel
                  objects, so they are not rendered as blank rows. */}

              {(selectedHotel?.checkIn || selectedHotel?.checkOut) && (
                <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Check in</p>
                    <p className="text-sm font-semibold text-slate-700">{fmtDate(selectedHotel.checkIn)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Check out</p>
                    <p className="text-sm font-semibold text-slate-700">{fmtDate(selectedHotel.checkOut)}</p>
                  </div>
                </div>
              )}

              <div className="mt-4 rounded-lg border border-slate-200 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Room</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-800">{selectedHotel?.roomType || "Standard"}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {[
                    selectedHotel?.rooms ? `${selectedHotel.rooms} Rooms` : "",
                    selectedHotel?.nights ? `${selectedHotel.nights} Nights` : "",
                    selectedHotel?.mealPlan || "",
                  ].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>

              {(selectedHotel?.description || selectedHotel?.text) && (
                <p className="mt-4 text-sm leading-relaxed text-slate-600">
                  {selectedHotel.description || selectedHotel.text}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
