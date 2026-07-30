// import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
// import { createPortal } from "react-dom";
// import { Map, Sun, Coffee, Utensils, Moon, Plus, IndianRupee, Search, ChevronDown, MapPin, Pencil, X, Globe, Building2, Hash, Clock, UploadCloud, AlertTriangle } from "lucide-react";
// import { Label, Input, Textarea, AddBtn, RemoveBtn, IncludeToggle, FieldGrid, RichText } from "./Ui";
// import { MEALS_OPT, TRANSFER } from "../Constants";
// import { sightseeingService } from "@features/masters";
// import { geographyService } from "@shared/api/geographyService";

// /* ════════════════════════════════════════════════════════
//    INLINE SIGHTSEEING SEARCH DROPDOWN (HotelTab jaisa)
//    - Button → click → portal dropdown (search box andar)
//    - Type → filter (title + city)
//    - Select → onSelect(sightseeing) auto-fill
// ═══════════════════════════════════════════════════════ */
// function SightseeingSearchDropdown({ value, onSelect, allItems, loading, defaultCity = "", placeholder = "Type to search attractions..." }) {
//   const [open,   setOpen]   = useState(false);
//   const [search, setSearch] = useState("");
//   const [pos,    setPos]    = useState(null);

//   const buttonRef = useRef(null);
//   const searchRef = useRef(null);
//   const panelRef  = useRef(null);

//   const MAX_PANEL_H = 300, MIN_PANEL_H = 160;

//   const calcPos = useCallback(() => {
//     const btn = buttonRef.current;
//     if (!btn) return;
//     const r = btn.getBoundingClientRect();
//     const GAP = 4, MARGIN = 12;
//     const spaceBelow = window.innerHeight - r.bottom - GAP - MARGIN;
//     const maxH = Math.max(MIN_PANEL_H, Math.min(MAX_PANEL_H, spaceBelow));
//     setPos({ left: r.left, width: r.width, top: r.bottom + GAP, maxH });
//   }, []);

//   useLayoutEffect(() => { if (open) calcPos(); }, [open, calcPos]);

//   useEffect(() => {
//     if (!open) return;
//     const handler = () => calcPos();
//     window.addEventListener("scroll", handler, true);
//     window.addEventListener("resize", handler);
//     return () => {
//       window.removeEventListener("scroll", handler, true);
//       window.removeEventListener("resize", handler);
//     };
//   }, [open, calcPos]);

//   useEffect(() => {
//     if (open && searchRef.current) {
//       const t = setTimeout(() => searchRef.current?.focus(), 60);
//       return () => clearTimeout(t);
//     }
//   }, [open]);

//   useEffect(() => {
//     if (!open) return;
//     const handler = (e) => {
//       if (
//         buttonRef.current && !buttonRef.current.contains(e.target) &&
//         panelRef.current  && !panelRef.current.contains(e.target)
//       ) { setOpen(false); setSearch(""); }
//     };
//     document.addEventListener("mousedown", handler);
//     return () => document.removeEventListener("mousedown", handler);
//   }, [open]);

//   // Image + city helpers (multiple field names)
//   const getImage = (s) =>
//     s.imagePath || s.imageUrl || s.image || s.photo || s.coverImage || null;
//   const getCity = (s) =>
//     s.city || s.cityName || s.destinationName || s.location || "";

//   const term = search.trim().toLowerCase();

//   // ── Flexible city match: "Dubai" ↔ "Dubai, UAE" sab match ──
//   const cityMatches = (s) => {
//     const sc = getCity(s).trim().toLowerCase();
//     const dc = (defaultCity || "").trim().toLowerCase();
//     if (!sc || !dc) return false;
//     return sc === dc || sc.includes(dc) || dc.includes(sc);
//   };

//   // ── STRICT city filter: day ki city set hai to SIRF usi city ki attractions ──
//   // Search bhi usi city ke andar hota hai — dusri city ki attraction kabhi nahi dikhegi.
//   const baseList = defaultCity ? (allItems || []).filter(cityMatches) : (allItems || []);
//   const filtered = term
//     ? baseList.filter(s => (s.title || "").toLowerCase().includes(term))
//     : baseList;

//   if (defaultCity && (allItems || []).length > 0) {
//     console.log(`[SIGHTSEEING strict city] "${defaultCity}" → ${baseList.length}/${allItems.length} attractions`);
//   }

//   const handleToggle = () => { setOpen(p => !p); setSearch(""); };
//   const handlePick = (item) => {
//     setOpen(false); setSearch("");
//     onSelect?.({ ...item, _image: getImage(item), _city: getCity(item) });
//   };

//   const panel = (open && !loading && pos) ? createPortal(
//     <div
//       ref={panelRef}
//       style={{
//         position: "fixed",
//         left: `${pos.left}px`, top: `${pos.top}px`, width: `${pos.width}px`,
//         maxHeight: `${pos.maxH}px`, zIndex: 2147483647,
//       }}
//       className="bg-white border border-slate-200 rounded-xl shadow-2xl flex flex-col overflow-hidden">
//       <div className="relative p-2 border-b border-slate-100 flex-shrink-0 bg-white">
//         <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
//         <input
//           ref={searchRef} type="text" value={search}
//           onChange={e => setSearch(e.target.value)}
//           placeholder="Search attraction or city..."
//           className="w-full pl-8 pr-2 py-2 text-sm rounded-lg border border-slate-200
//             outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
//         />
//       </div>
//       {defaultCity && (
//         <div className="flex items-center px-3 py-1.5 bg-blue-50 border-b border-blue-100 flex-shrink-0">
//           <span className="text-[11px] font-semibold text-blue-700 flex items-center gap-1">
//             <MapPin size={11} /> {defaultCity} attractions only
//           </span>
//         </div>
//       )}
//       <ul className="overflow-y-auto flex-1 min-h-0">
//         {filtered.length === 0 ? (
//           <li className="px-3 py-4 text-sm text-slate-400 text-center">
//             {(allItems || []).length === 0 ? "No attractions in master" : defaultCity ? `No attractions found for ${defaultCity}` : "No matching attractions"}
//           </li>
//         ) : (
//           filtered.map((s, idx) => {
//             const img  = getImage(s);
//             const city = getCity(s);
//             const sel  = s.title === value;
//             return (
//               <li
//                 key={s.publicId || s.id || idx}
//                 onClick={() => handlePick(s)}
//                 className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors border-b border-slate-50 last:border-0
//                   ${sel ? "bg-blue-50" : "hover:bg-blue-50/60"}`}>
//                 {img ? (
//                   <img src={img} alt={s.title}
//                     onError={(e) => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }}
//                     className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-slate-200" />
//                 ) : null}
//                 <div style={{ display: img ? "none" : "flex" }}
//                   className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-blue-200 items-center justify-center flex-shrink-0 text-base">
//                   🗺️
//                 </div>
//                 <div className="min-w-0 flex-1">
//                   <span className={`text-sm truncate block ${sel ? "text-blue-700 font-semibold" : "text-slate-700 font-medium"}`}>
//                     {s.title}
//                   </span>
//                   {city && (
//                     <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
//                       <MapPin size={9} className="text-rose-400 flex-shrink-0" />
//                       <span className="truncate">{city}</span>
//                     </div>
//                   )}
//                 </div>
//                 {s.estimatedHours && (
//                   <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full flex-shrink-0">
//                     {s.estimatedHours}h
//                   </span>
//                 )}
//               </li>
//             );
//           })
//         )}
//       </ul>
//     </div>,
//     document.body
//   ) : null;

//   return (
//     <div className="relative">
//       <button
//         ref={buttonRef} type="button" onClick={handleToggle} disabled={loading}
//         className="w-full flex items-center justify-between gap-2 pl-3 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white
//           text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
//           transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:border-slate-300">
//         <span className={`truncate ${value ? "text-slate-700 font-medium" : "text-slate-400"}`}>
//           {loading ? "Loading attractions..." : (value || placeholder)}
//         </span>
//         <ChevronDown size={16} className={`text-slate-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
//       </button>
//       {panel}
//     </div>
//   );
// }


// /* ════════════════════════════════════════════════════════
//    INLINE ADD / EDIT SIGHTSEEING MODAL (HotelTab jaisa)
//    - Country → Destination → City cascade (ID-based)
//    - Title, Sequence, Est. Hours, Start Time
//    - Cloudinary image upload + preview
//    - Save → Sightseeing Master mein bhi add/update ho jaata
// ═══════════════════════════════════════════════════════ */
// const ssEmptyForm = {
//   destination: "", destinationId: "", city: "", title: "", sequence: "1",
//   estimatedHours: "", suggestedStartTime: "",
//   imagePath: "", imagePreview: "", description: "", remarks: "",
// };

// function SightseeingFormModal({ isOpen, onClose, editingItem, onSaved }) {
//   const [form, setForm]   = useState({ ...ssEmptyForm });
//   const [saving, setSaving]       = useState(false);
//   const [imgUploading, setImgUploading] = useState(false);
//   const [error, setError] = useState("");
//   const fileRef = useRef();

//   // Geography cascade
//   const [countries,   setCountries]   = useState([]);
//   const [countryId,   setCountryId]   = useState("");
//   const [destOptions, setDestOptions] = useState([]);
//   const [cityOptions, setCityOptions] = useState([]);
//   const [loadingDest, setLoadingDest] = useState(false);
//   const [loadingCity, setLoadingCity] = useState(false);

//   useEffect(() => {
//     if (!isOpen) return;
//     setError(""); setCountryId(""); setDestOptions([]); setCityOptions([]);
//     geographyService.getCountries().then(setCountries).catch(() => setCountries([]));

//     if (editingItem) {
//       // 🔍 DEBUG — kaunsa id field hai dekho
//       console.log("=== EDIT MODAL editingItem ===", {
//         id: editingItem.id,
//         publicId: editingItem.publicId,
//         sightseeingId: editingItem.sightseeingId,
//         title: editingItem.title,
//         fullObject: editingItem,
//       });
//       // Edit mode — existing values prefill
//       setForm({
//         ...ssEmptyForm,
//         title:              editingItem.title || "",
//         destination:        editingItem.destination || editingItem.destinationName || "",
//         destinationId:      editingItem.destinationId || "",
//         city:               editingItem.city || editingItem.cityName || "",
//         sequence:           editingItem.sequence != null ? String(editingItem.sequence) : "1",
//         estimatedHours:     editingItem.estimatedHours != null ? String(editingItem.estimatedHours) : "",
//         suggestedStartTime: editingItem.suggestedStartTime || "",
//         imagePath:          editingItem.imagePath || editingItem.imageUrl || "",
//         imagePreview:       editingItem.imagePath || editingItem.imageUrl || "",
//         description:        editingItem.description || "",
//         remarks:            editingItem.remarks || "",
//       });
//       // destinationId se country + cities prefill
//       const destId = editingItem.destinationId;
//       if (destId) {
//         (async () => {
//           try {
//             const dest = await geographyService.getDestinationById(destId);
//             if (dest?.countryId != null) {
//               setCountryId(String(dest.countryId));
//               setLoadingDest(true);
//               try { setDestOptions(await geographyService.getDestinationsByCountry(dest.countryId)); }
//               finally { setLoadingDest(false); }
//             }
//             setLoadingCity(true);
//             try { setCityOptions(await geographyService.getCitiesByDestination(destId)); }
//             finally { setLoadingCity(false); }
//           } catch { /* best-effort */ }
//         })();
//       }
//     } else {
//       setForm({ ...ssEmptyForm });
//     }
//   }, [isOpen, editingItem]);

//   const handleCountryChange = async (cid) => {
//     setCountryId(cid);
//     setForm(p => ({ ...p, destination: "", destinationId: "", city: "" }));
//     setDestOptions([]); setCityOptions([]);
//     if (!cid) return;
//     setLoadingDest(true);
//     try { setDestOptions(await geographyService.getDestinationsByCountry(cid)); }
//     catch { setDestOptions([]); }
//     finally { setLoadingDest(false); }
//   };

//   const handleDestChange = async (destId) => {
//     const sel = destOptions.find(d => String(d.id) === String(destId));
//     setForm(p => ({ ...p, destinationId: destId, destination: sel?.name || "", city: "" }));
//     setCityOptions([]);
//     if (!destId) return;
//     setLoadingCity(true);
//     try { setCityOptions(await geographyService.getCitiesByDestination(destId)); }
//     catch { setCityOptions([]); }
//     finally { setLoadingCity(false); }
//   };

//   const handleFile = async (e) => {
//     const file = e.target.files[0];
//     if (!file) return;
//     if (!file.type.match("image.*")) { setError("Please select a valid image file."); return; }
//     const reader = new FileReader();
//     reader.onload = (ev) => setForm(p => ({ ...p, imagePreview: ev.target.result }));
//     reader.readAsDataURL(file);
//     setImgUploading(true);
//     try {
//       const url = await sightseeingService.uploadSightseeingImage(file);
//       setForm(p => ({ ...p, imagePath: url, imagePreview: url }));
//     } catch (err) {
//       setError(err.message || "Image upload failed.");
//     } finally {
//       setImgUploading(false);
//     }
//   };

//   const handleSave = async () => {
//     if (!form.destination || !form.city || !form.title) {
//       setError("Destination, City and Title are required.");
//       return;
//     }
//     // Edit ke liye valid numeric id chahiye — kai field names try karo
//     const editId = editingItem
//       ? (editingItem.id ?? editingItem.sightseeingId ?? editingItem.publicId)
//       : null;

//     // Guard: edit mode mein id na mile to crash se bachao
//     if (editingItem && (editId == null || editId === "undefined")) {
//       setError("Cannot edit: this attraction has no valid ID. Try selecting it again from the dropdown.");
//       console.error("Edit failed — editingItem has no id:", editingItem);
//       return;
//     }

//     setSaving(true); setError("");
//     try {
//       let saved;
//       if (editingItem && sightseeingService.updateSightseeing) {
//         const res = await sightseeingService.updateSightseeing(editId, form);
//         saved = res.data?.data ?? res.data;
//       } else {
//         const res = await sightseeingService.createSightseeing(form);
//         saved = res.data?.data ?? res.data;
//       }
//       onSaved?.(saved, editingItem ? "update" : "create");
//       onClose();
//     } catch (err) {
//       setError(err?.response?.data?.message || "Save failed. Please try again.");
//     } finally {
//       setSaving(false);
//     }
//   };

//   if (!isOpen) return null;

//   const inputCls = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10";

//   return createPortal(
//     <div className="fixed inset-0 flex items-start justify-center p-4 overflow-y-auto" style={{ zIndex: 2147483646 }}>
//       <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !saving && onClose()} />
//       <div className="relative bg-white w-full max-w-3xl shadow-2xl mt-6 mb-10 rounded-2xl overflow-hidden border border-slate-200">
//         {/* Header */}
//         <div className="bg-blue-600 px-4 sm:px-6 py-4 flex justify-between items-center text-white">
//           <div className="flex items-center gap-3">
//             <div className="p-2 bg-blue-500 rounded-xl"><Map size={18} strokeWidth={2.5} /></div>
//             <div>
//               <h2 className="text-base font-bold m-0">{editingItem ? "Edit Sightseeing" : "Add New Sightseeing"}</h2>
//               <p className="text-[11px] text-blue-100 m-0">Saves to Sightseeing Master</p>
//             </div>
//           </div>
//           <button onClick={() => !saving && onClose()} className="text-white hover:bg-white/20 p-2 rounded-full transition"><X size={18} /></button>
//         </div>

//         {error && (
//           <div className="mx-6 mt-4 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5 text-sm text-rose-600 flex items-center gap-2">
//             <AlertTriangle size={14} /> {error}
//           </div>
//         )}

//         <div className="p-6 space-y-5 bg-slate-50/50 max-h-[70vh] overflow-y-auto">
//           {/* Country / Destination / City */}
//           <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
//             <div>
//               <Label>Country <span className="text-rose-500">*</span></Label>
//               <div className="relative">
//                 <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
//                 <select className={`${inputCls} pl-9 appearance-none pr-7 cursor-pointer`} value={countryId} onChange={(e) => handleCountryChange(e.target.value)}>
//                   <option value="">{countries.length === 0 ? "Loading…" : "Select"}</option>
//                   {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
//                 </select>
//                 <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
//               </div>
//             </div>
//             <div>
//               <Label>Destination <span className="text-rose-500">*</span></Label>
//               <div className="relative">
//                 <Map size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
//                 <select className={`${inputCls} pl-9 appearance-none pr-7 cursor-pointer disabled:opacity-60`}
//                   value={form.destinationId} onChange={(e) => handleDestChange(e.target.value)} disabled={!countryId || loadingDest}>
//                   <option value="">{loadingDest ? "Loading…" : !countryId ? "Country first" : destOptions.length === 0 ? "None" : "Select"}</option>
//                   {destOptions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
//                 </select>
//                 <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
//               </div>
//             </div>
//             <div>
//               <Label>City <span className="text-rose-500">*</span></Label>
//               <div className="relative">
//                 <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
//                 <select className={`${inputCls} pl-9 appearance-none pr-7 cursor-pointer disabled:opacity-60`}
//                   value={form.city} onChange={(e) => setForm(p => ({ ...p, city: e.target.value }))} disabled={!form.destinationId || loadingCity}>
//                   <option value="">{!form.destinationId ? "Destination first" : loadingCity ? "Loading…" : cityOptions.length === 0 ? "None" : "Select"}</option>
//                   {cityOptions.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
//                 </select>
//                 <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
//               </div>
//             </div>
//           </div>

//           {/* Title */}
//           <div>
//             <Label>Title <span className="text-rose-500">*</span></Label>
//             <input type="text" className={inputCls} placeholder="e.g. Pashupatinath Temple Visit" value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} />
//           </div>

//           {/* Sequence / Est Hours / Start Time */}
//           <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
//             <div>
//               <Label>Sequence</Label>
//               <div className="relative">
//                 <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
//                 <input type="number" min={1} className={`${inputCls} pl-9`} value={form.sequence} onChange={(e) => setForm(p => ({ ...p, sequence: e.target.value }))} />
//               </div>
//             </div>
//             <div>
//               <Label>Est. Hours</Label>
//               <input type="text" className={inputCls} placeholder="2.5" value={form.estimatedHours} onChange={(e) => setForm(p => ({ ...p, estimatedHours: e.target.value }))} />
//             </div>
//             <div>
//               <Label>Start Time</Label>
//               <div className="relative">
//                 <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
//                 <input type="time" className={`${inputCls} pl-9 cursor-pointer`} value={form.suggestedStartTime} onChange={(e) => setForm(p => ({ ...p, suggestedStartTime: e.target.value }))} />
//               </div>
//             </div>
//           </div>

//           {/* Image */}
//           <div>
//             <Label>Attraction Image {imgUploading && <span className="ml-1 text-blue-500 text-xs animate-pulse">Uploading...</span>}</Label>
//             <div className={`border-2 border-dashed rounded-2xl p-5 text-center transition cursor-pointer ${imgUploading ? "border-blue-300 bg-blue-50" : "border-slate-300 bg-white hover:border-blue-400"}`}
//               onClick={() => !imgUploading && fileRef.current?.click()}>
//               {imgUploading ? (
//                 <div className="py-4"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" /><p className="text-sm text-blue-600">Uploading...</p></div>
//               ) : form.imagePreview ? (
//                 <div className="flex flex-col items-center">
//                   <img src={form.imagePreview} alt="preview" className="max-h-32 w-full object-cover rounded-xl border border-slate-200 mb-2" />
//                   <button className="text-xs font-bold text-rose-500 bg-rose-50 px-3 py-1 rounded-lg" onClick={(e) => { e.stopPropagation(); setForm(p => ({ ...p, imagePath: "", imagePreview: "" })); }}>Remove</button>
//                 </div>
//               ) : (
//                 <div className="py-3"><UploadCloud size={32} className="mx-auto text-blue-500 mb-2" /><p className="text-sm font-bold text-slate-700">Click to upload</p><p className="text-xs text-slate-500 m-0">JPG, PNG up to 2MB</p></div>
//               )}
//               <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
//             </div>
//           </div>

//           {/* Description */}
//           <div>
//             <Label>Description</Label>
//             <Textarea value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} rows={3} placeholder="Describe this attraction..." />
//           </div>
//         </div>

//         {/* Footer */}
//         <div className="bg-white px-4 sm:px-6 py-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
//           <button type="button" onClick={onClose} disabled={saving} className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-50 transition text-sm">Cancel</button>
//           <button type="button" onClick={handleSave} disabled={saving || imgUploading} className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-bold text-sm shadow-md transition active:scale-95 flex items-center justify-center gap-2">
//             {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</> : editingItem ? "Update" : "Save to Master"}
//           </button>
//         </div>
//       </div>
//     </div>,
//     document.body
//   );
// }

// /* ════════════════════════════════════════════════════════
//    MAIN SIGHTSEEING TAB
// ═══════════════════════════════════════════════════════ */
// /* ── Dashboard-style card (TravelCRM dashboard look) — sirf is page ke liye, shared ui untouched ── */
// function DashCard({ title, icon: Icon, iconColor = "", headerRight, children }) {
//   // iconColor se gradient map — dashboard jaise gradient icon discs
//   const grad = iconColor.includes("amber")
//     ? "from-amber-500 to-orange-500 shadow-amber-500/25"
//     : iconColor.includes("emerald") || iconColor.includes("green")
//       ? "from-emerald-500 to-teal-600 shadow-emerald-500/25"
//       : "from-blue-500 to-indigo-600 shadow-blue-500/25";
//   return (
//     <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
//       <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 px-4 sm:px-5 py-3.5 border-b border-slate-100">
//         <div className="flex items-center gap-3 min-w-0 flex-1">
//           <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${grad} shadow-md flex items-center justify-center flex-shrink-0`}>
//             {Icon && <Icon size={17} className="text-white" />}
//           </div>
//           <h3 className="text-sm font-bold text-slate-800 truncate">{title}</h3>
//         </div>
//         {headerRight && <div className="w-full sm:w-auto sm:flex-shrink-0">{headerRight}</div>}
//       </div>
//       <div className="p-4 sm:p-5">{children}</div>
//     </div>
//   );
// }

// export default function SightseeingTab({ onDataChange, paxInfo = {}, dayCityMap = {} }) {
//   const [included, setIncluded] = useState(true);
//   const [title,    setTitle]    = useState("Sightseeing");
//   const [notes,    setNotes]    = useState("");
//   const [days,     setDays]     = useState([newDay(1)]);
//   const daysAutoFilledRef = useRef(false);  // dayCityMap se days ek hi baar auto-build ho

//   // ── Sightseeing Master se saare attractions (ek baar load) ──
//   const [allItems,     setAllItems]     = useState([]);
//   const [itemsLoading, setItemsLoading] = useState(true);

//   // ── Add/Edit modal state ──
//   const [modalOpen,   setModalOpen]   = useState(false);
//   const [editingItem, setEditingItem] = useState(null);
//   const [modalTarget, setModalTarget] = useState(null); // { did, aid } — kis activity ke liye

//   const loadAllItems = useCallback(async () => {
//     try {
//       setItemsLoading(true);
//       const res = await sightseeingService.getAllSightseeings();
//       const raw  = res.data?.data ?? res.data;
//       const list = Array.isArray(raw) ? raw
//         : Array.isArray(raw?.content) ? raw.content : [];
//       console.log("=== SIGHTSEEINGS LOADED ===", list.length, list[0]);
//       setAllItems(list);
//       return list;
//     } catch (err) {
//       console.error("Sightseeing load error:", err);
//       setAllItems([]);
//       return [];
//     } finally {
//       setItemsLoading(false);
//     }
//   }, []);

//   useEffect(() => { loadAllItems(); }, [loadAllItems]);

//   function newDay(num, city = "") {
//     return { id: Date.now() + Math.random(), day: num, date: "", city, pricePerPax: 0, pax: 1, activities: [newActivity(city)] };
//   }
//   function newActivity(city = "") {
//     return { id: Date.now() + Math.random(), attraction: "", startTime: "", description: "", meals: [], transfer: "Private", imagePath: "", city };
//   }

//   // ── Lead ke itinerary se days auto-build (day 1 → Dubai, day 2 → Dubai, day 3 → Manali...) ──
//   // Sirf EK BAAR chalta hai jab dayCityMap aata hai aur days abhi tak default/pristine hai.
//   useEffect(() => {
//     const totalDays = Object.keys(dayCityMap).length;
//     if (totalDays === 0 || daysAutoFilledRef.current) return;
//     const isPristine = days.length === 1 && !days[0].date && (days[0].activities || []).every(a => !a.attraction && !a.description);
//     if (!isPristine) return;  // user ne already kuch edit kar diya, overwrite mat karo

//     const built = [];
//     for (let d = 1; d <= totalDays; d++) {
//       built.push(newDay(d, dayCityMap[d] || ""));
//     }
//     setDays(built);
//     daysAutoFilledRef.current = true;
//     console.log("=== DAYS AUTO-BUILT FROM LEAD ITINERARY ===", built.map(d => ({ day: d.day, city: d.city })));
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [dayCityMap]);

//   // ── Auto price ────────────────────────────────────────────
//   const dayTotals       = days.map(d => Number(d.pricePerPax) * Number(d.pax) || 0);
//   const sightseeingTotal = dayTotals.reduce((a, b) => a + b, 0);

//   // ── paxInfo aane par days ka pax auto-fill (default 1 ko hi replace karo) ──
//   useEffect(() => {
//     const total = paxInfo.totalPax || 0;
//     if (total > 0) {
//       setDays(prev => prev.map(d => (
//         (!d._paxTouched && (d.pax === 1 || d.pax === "1" || !d.pax))
//           ? { ...d, pax: total }
//           : d
//       )));
//     }

//   }, [paxInfo.totalPax]);

//   // ── Parent ko data do ─────────────────────────────────────
//   useEffect(() => {
//     onDataChange?.({ included, title, notes, days, amount: sightseeingTotal });
//   }, [included, title, notes, days, sightseeingTotal]);

//   // ── Helpers ───────────────────────────────────────────────
//   const addDay    = () => setDays(p => [...p, newDay(p.length + 1, dayCityMap[p.length + 1] || "")]);
//   const removeDay = (id) => setDays(p => p.filter(d => d.id !== id));
//   const updateDay = (id, k, v) => setDays(p => p.map(d => d.id === id ? { ...d, [k]: v } : d));
//   const addAct    = (did) => setDays(p => p.map(d => d.id === did ? { ...d, activities: [...d.activities, newActivity(d.city)] } : d));
//   const removeAct = (did, aid) => setDays(p => p.map(d => d.id === did ? { ...d, activities: d.activities.filter(a => a.id !== aid) } : d));
//   const updateAct = (did, aid, k, v) => setDays(p => p.map(d => d.id === did ? {
//     ...d, activities: d.activities.map(a => a.id === aid ? { ...a, [k]: v } : a)
//   } : d));

//   // ── Jab dropdown se attraction select ho → auto-fill ──
//   const fillActivity = (did, aid, item) => {
//     setDays(p => p.map(d => {
//       if (d.id !== did) return d;
//       return {
//         ...d,
//         activities: d.activities.map(a => {
//           if (a.id !== aid) return a;
//           const desc = item.description
//             ? item.description.replace(/<[^>]*>/g, "").trim()
//             : a.description;
//           return {
//             ...a,
//             attraction: item.title || a.attraction,
//             description: desc,
//             imagePath: item._image || item.imagePath || item.imageUrl || "",
//             city: item._city || item.city || "",
//             _sightseeingId: item.id || item.publicId || a._sightseeingId, // edit ke liye id yaad rakho
//           };
//         }),
//       };
//     }));
//   };

//   const handleAttractionSelect = (did, aid, item) => fillActivity(did, aid, item);

//   // ── ➕ Add button → modal khulo (naya) ──
//   const openAddModal = (did, aid) => {
//     setEditingItem(null);
//     setModalTarget({ did, aid });
//     setModalOpen(true);
//   };

//   // ── ✏️ Edit button → selected attraction ko master se dhundho, edit modal ──
//   const openEditModal = (did, aid, act) => {
//     // act ki attraction master se dhundho — id se ya title se (case-insensitive)
//     const found = allItems.find(s => {
//       const byId = act._sightseeingId &&
//         (String(s.id) === String(act._sightseeingId) || String(s.publicId) === String(act._sightseeingId));
//       const byTitle = s.title && act.attraction &&
//         s.title.trim().toLowerCase() === act.attraction.trim().toLowerCase();
//       return byId || byTitle;
//     });

//     // 🔍 DEBUG
//     console.log("=== TAB OPEN EDIT ===", {
//       attraction: act.attraction,
//       _sightseeingId: act._sightseeingId,
//       foundItem: found,
//       totalMasterItems: allItems.length,
//     });

//     if (!found) {
//       // Master mein nahi mila — user ko batao (silent fail nahi)
//       alert("This attraction was not found in Sightseeing Master.\n\nPlease select an attraction from the dropdown first, then click Edit.");
//       return;
//     }
//     setEditingItem(found);
//     setModalTarget({ did, aid });
//     setModalOpen(true);
//   };

//   // ── Modal save hone ke baad → list refresh + activity auto-fill ──
//   const handleModalSaved = async (saved) => {
//     const freshList = await loadAllItems(); // master list refresh
//     // jis activity ke liye modal khula tha usme bharo
//     if (modalTarget && saved) {
//       const item = freshList.find(s =>
//         s.id === saved.id || s.publicId === saved.publicId || s.title === saved.title
//       ) || saved;
//       fillActivity(modalTarget.did, modalTarget.aid, {
//         ...item,
//         _image: item.imagePath || item.imageUrl || "",
//         _city:  item.city || item.cityName || "",
//       });
//     }
//     setModalTarget(null);
//   };

//   const toggleMeal = (did, aid, meal) => {
//     const act = days.find(d => d.id === did)?.activities.find(a => a.id === aid);
//     if (!act) return;
//     const meals = act.meals.includes(meal) ? act.meals.filter(m => m !== meal) : [...act.meals, meal];
//     updateAct(did, aid, "meals", meals);
//   };

//   return (
//     <div className="space-y-5">

//       <DashCard title="Sightseeing Settings" icon={Map}>
//         <div className="space-y-4">
//           <IncludeToggle included={included} onChange={() => setIncluded(p => !p)} label="Include Sightseeing in Quotation" />
//           {included && (
//             <>
//               <div><Label>Section Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
//               <div><Label>Sightseeing Notes</Label><RichText value={notes} onChange={setNotes} placeholder="General notes..." rows={3} /></div>
//             </>
//           )}
//         </div>
//       </DashCard>

//       {included && days.map((day, di) => (
//         <DashCard key={day.id} title={day.city ? `Day ${day.day} — ${day.city}` : `Day ${day.day}`} icon={Sun} iconColor="text-amber-600"
//           headerRight={
//             <div className="flex items-center gap-2 min-w-0">
//               <Input type="date" value={day.date} onChange={e => updateDay(day.id, "date", e.target.value)} className="flex-1 sm:flex-initial sm:w-36 min-w-0 text-xs py-1.5" />
//               {days.length > 1 && <RemoveBtn onClick={() => removeDay(day.id)} />}
//             </div>
//           }>
//           <div className="space-y-4">

//             {/* ── Price Box per Day ── */}
//             <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-2xl bg-amber-50 border border-amber-100">
//               <div>
//                 <Label>Price / Pax (₹)</Label>
//                 <Input type="number" min={0} value={day.pricePerPax}
//                   onChange={e => updateDay(day.id, "pricePerPax", e.target.value)} placeholder="0" />
//               </div>
//               <div>
//                 <Label>No. of Pax</Label>
//                 <Input type="number" min={1} value={day.pax}
//                   onChange={e => setDays(p => p.map(d => d.id === day.id ? { ...d, pax: e.target.value, _paxTouched: true } : d))} placeholder="1" />
//               </div>
//               <div>
//                 <Label>Day Total</Label>
//                 <div className="h-10 flex items-center justify-center bg-amber-600 rounded-xl text-sm font-extrabold text-white">
//                   ₹{dayTotals[di].toLocaleString("en-IN")}
//                 </div>
//               </div>
//             </div>

//             {/* ── Activities ── */}
//             {day.activities.map((act, ai) => (
//               <div key={act.id} className={ai > 0 ? "pt-4 border-t border-slate-100" : ""}>
//                 <div className="flex items-center justify-between mb-3">
//                   <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Activity {ai + 1}</span>
//                   {day.activities.length > 1 && <RemoveBtn onClick={() => removeAct(day.id, act.id)} />}
//                 </div>
//                 <FieldGrid cols={2}>
//                   <div>
//                     <Label>Attraction / Activity</Label>
//                     {/* ── Searchable dropdown + Add/Edit (HotelTab jaisa) ── */}
//                     <div className="flex items-center gap-2">
//                       <div className="flex-1 min-w-0">
//                         <SightseeingSearchDropdown
//                           value={act.attraction}
//                           onSelect={(item) => handleAttractionSelect(day.id, act.id, item)}
//                           allItems={allItems}
//                           loading={itemsLoading}
//                           defaultCity={day.city}
//                           placeholder={day.city ? `Search attractions in ${day.city}...` : "Type to search attractions..."}
//                         />
//                       </div>
//                       {/* ➕ Add new sightseeing */}
//                       <button type="button" onClick={() => openAddModal(day.id, act.id)} title="Add new attraction"
//                         className="flex-shrink-0 w-9 sm:w-10 h-10 flex items-center justify-center rounded-xl border border-blue-500 text-blue-600 hover:bg-blue-600 hover:text-white transition shadow-sm">
//                         <Plus size={16} strokeWidth={2.5} />
//                       </button>
//                       {/* ✏️ Edit selected sightseeing */}
//                       <button type="button" onClick={() => openEditModal(day.id, act.id, act)} title="Edit selected attraction"
//                         disabled={!act.attraction}
//                         className="flex-shrink-0 w-9 sm:w-10 h-10 flex items-center justify-center rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">
//                         <Pencil size={15} />
//                       </button>
//                     </div>
//                   </div>
//                   <div><Label>Start Time</Label><Input type="time" value={act.startTime} onChange={e => updateAct(day.id, act.id, "startTime", e.target.value)} /></div>
//                 </FieldGrid>

//                 {/* ── Attraction image preview (select hone par) ── */}
//                 {act.imagePath && (
//                   <div className="mt-3 flex items-center gap-3 p-2.5 bg-blue-50 rounded-xl border border-blue-100">
//                     <img src={act.imagePath} alt={act.attraction}
//                       className="w-20 h-16 rounded-lg object-cover flex-shrink-0 border border-blue-200 shadow-sm" />
//                     <div className="min-w-0">
//                       <p className="text-sm font-bold text-slate-800 truncate">{act.attraction}</p>
//                       {act.city && (
//                         <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
//                           <MapPin size={10} className="text-rose-400" /> {act.city}
//                         </p>
//                       )}
//                       <span className="inline-block mt-1 text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
//                         ✓ From Sightseeing Master
//                       </span>
//                     </div>
//                   </div>
//                 )}

//                 <div className="mt-3"><Label>Description</Label>
//                   <Textarea value={act.description} onChange={e => updateAct(day.id, act.id, "description", e.target.value)} rows={2} placeholder="Describe this activity..." />
//                 </div>
//                 <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
//                   <div>
//                     <Label>Meals Included</Label>
//                     <div className="flex gap-2 mt-1.5 flex-wrap">
//                       {MEALS_OPT.map(m => (
//                         <button key={m} type="button" onClick={() => toggleMeal(day.id, act.id, m)}
//                           className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5
//                             ${act.meals.includes(m) ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-slate-200 text-slate-600 hover:border-blue-300"}`}>
//                           {m === "Breakfast" && <Coffee size={11} />}{m === "Lunch" && <Utensils size={11} />}{m === "Dinner" && <Moon size={11} />}{m}
//                         </button>
//                       ))}
//                     </div>
//                   </div>
//                   <div>
//                     <Label>Daily Transfer</Label>
//                     <div className="flex gap-2 mt-1.5 flex-wrap">
//                       {TRANSFER.map(t => (
//                         <button key={t} type="button" onClick={() => updateAct(day.id, act.id, "transfer", t)}
//                           className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all
//                             ${act.transfer === t ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-slate-200 text-slate-600 hover:border-blue-300"}`}>{t}
//                         </button>
//                       ))}
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             ))}
//             <div className="pt-3 border-t border-slate-100">
//               <AddBtn onClick={() => addAct(day.id)} label="Add Activity" />
//             </div>
//           </div>
//         </DashCard>
//       ))}

//       {included && (
//         <>
//           <button onClick={addDay} type="button"
//             className="w-full py-3 border-2 border-dashed border-slate-300 hover:border-amber-400 hover:bg-amber-50/40 text-slate-500 hover:text-amber-600 text-sm font-bold rounded-2xl transition-all flex items-center justify-center gap-2">
//             <Plus size={16} strokeWidth={2.5} /> Add Day
//           </button>
//           <div className="flex items-center justify-between p-4 rounded-2xl"
//             style={{ background: "linear-gradient(135deg,#D97706,#92400E)" }}>
//             <div className="flex items-center gap-3">
//               <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
//                 <IndianRupee size={18} className="text-white" />
//               </div>
//               <div>
//                 <p className="text-[10px] text-amber-200 font-semibold uppercase tracking-wider">Sightseeing Total</p>
//                 <p className="text-[11px] text-amber-300">{days.length} day{days.length > 1 ? "s" : ""}</p>
//               </div>
//             </div>
//             <p className="text-2xl font-extrabold text-white">₹{sightseeingTotal.toLocaleString("en-IN")}</p>
//           </div>
//         </>
//       )}

//       {/* ── Add/Edit Sightseeing Modal ── */}
//       <SightseeingFormModal
//         isOpen={modalOpen}
//         onClose={() => { setModalOpen(false); setEditingItem(null); }}
//         editingItem={editingItem}
//         onSaved={handleModalSaved}
//       />
//     </div>
//   );
// }






















// import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
// import { createPortal } from "react-dom";
// import { Map, Sun, Coffee, Utensils, Moon, Plus, IndianRupee, Search, ChevronDown, MapPin, Pencil, X, Globe, Building2, Hash, Clock, UploadCloud, AlertTriangle } from "lucide-react";
// import { Label, Input, Textarea, AddBtn, RemoveBtn, IncludeToggle, FieldGrid, RichText } from "./Ui";
// import { MEALS_OPT, TRANSFER } from "../Constants";
// import { sightseeingService } from "@features/masters";
// import { geographyService } from "@shared/api/geographyService";

// /* ════════════════════════════════════════════════════════
//    INLINE SIGHTSEEING SEARCH DROPDOWN (HotelTab jaisa)
//    - Button → click → portal dropdown (search box andar)
//    - Type → filter (title + city)
//    - Select → onSelect(sightseeing) auto-fill
// ═══════════════════════════════════════════════════════ */
// function SightseeingSearchDropdown({ value, onSelect, allItems, loading, defaultCity = "", placeholder = "Type to search attractions..." }) {
//   const [open,   setOpen]   = useState(false);
//   const [search, setSearch] = useState("");
//   const [pos,    setPos]    = useState(null);

//   const buttonRef = useRef(null);
//   const searchRef = useRef(null);
//   const panelRef  = useRef(null);

//   const MAX_PANEL_H = 300, MIN_PANEL_H = 160;

//   const calcPos = useCallback(() => {
//     const btn = buttonRef.current;
//     if (!btn) return;
//     const r = btn.getBoundingClientRect();
//     const GAP = 4, MARGIN = 12;
//     const spaceBelow = window.innerHeight - r.bottom - GAP - MARGIN;
//     const maxH = Math.max(MIN_PANEL_H, Math.min(MAX_PANEL_H, spaceBelow));
//     setPos({ left: r.left, width: r.width, top: r.bottom + GAP, maxH });
//   }, []);

//   useLayoutEffect(() => { if (open) calcPos(); }, [open, calcPos]);

//   useEffect(() => {
//     if (!open) return;
//     const handler = () => calcPos();
//     window.addEventListener("scroll", handler, true);
//     window.addEventListener("resize", handler);
//     return () => {
//       window.removeEventListener("scroll", handler, true);
//       window.removeEventListener("resize", handler);
//     };
//   }, [open, calcPos]);

//   useEffect(() => {
//     if (open && searchRef.current) {
//       const t = setTimeout(() => searchRef.current?.focus(), 60);
//       return () => clearTimeout(t);
//     }
//   }, [open]);

//   useEffect(() => {
//     if (!open) return;
//     const handler = (e) => {
//       if (
//         buttonRef.current && !buttonRef.current.contains(e.target) &&
//         panelRef.current  && !panelRef.current.contains(e.target)
//       ) { setOpen(false); setSearch(""); }
//     };
//     document.addEventListener("mousedown", handler);
//     return () => document.removeEventListener("mousedown", handler);
//   }, [open]);

//   // Image + city helpers (multiple field names)
//   const getImage = (s) =>
//     s.imagePath || s.imageUrl || s.image || s.photo || s.coverImage || null;
//   const getCity = (s) =>
//     s.city || s.cityName || s.destinationName || s.location || "";

//   const term = search.trim().toLowerCase();

//   // ── Flexible city match: "Dubai" ↔ "Dubai, UAE" sab match ──
//   const cityMatches = (s) => {
//     const sc = getCity(s).trim().toLowerCase();
//     const dc = (defaultCity || "").trim().toLowerCase();
//     if (!sc || !dc) return false;
//     return sc === dc || sc.includes(dc) || dc.includes(sc);
//   };

//   // ── STRICT city filter: day ki city set hai to SIRF usi city ki attractions ──
//   // Search bhi usi city ke andar hota hai — dusri city ki attraction kabhi nahi dikhegi.
//   const baseList = defaultCity ? (allItems || []).filter(cityMatches) : (allItems || []);
//   const filtered = term
//     ? baseList.filter(s => (s.title || "").toLowerCase().includes(term))
//     : baseList;

//   // if (defaultCity && (allItems || []).length > 0) {
//   //   // console.log(`[SIGHTSEEING strict city] "${defaultCity}" → ${baseList.length}/${allItems.length} attractions`);
//   // }

//   const handleToggle = () => { setOpen(p => !p); setSearch(""); };
//   const handlePick = (item) => {
//     setOpen(false); setSearch("");
//     onSelect?.({ ...item, _image: getImage(item), _city: getCity(item) });
//   };

//   const panel = (open && !loading && pos) ? createPortal(
//     <div
//       ref={panelRef}
//       style={{
//         position: "fixed",
//         left: `${pos.left}px`, top: `${pos.top}px`, width: `${pos.width}px`,
//         maxHeight: `${pos.maxH}px`, zIndex: 2147483647,
//       }}
//       className="bg-white border border-slate-200 rounded-xl shadow-2xl flex flex-col overflow-hidden">
//       <div className="relative p-2 border-b border-slate-100 flex-shrink-0 bg-white">
//         <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
//         <input
//           ref={searchRef} type="text" value={search}
//           onChange={e => setSearch(e.target.value)}
//           placeholder="Search attraction or city..."
//           className="w-full pl-8 pr-2 py-2 text-sm rounded-lg border border-slate-200
//             outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
//         />
//       </div>
//       {defaultCity && (
//         <div className="flex items-center px-3 py-1.5 bg-blue-50 border-b border-blue-100 flex-shrink-0">
//           <span className="text-[11px] font-semibold text-blue-700 flex items-center gap-1">
//             <MapPin size={11} /> {defaultCity} attractions only
//           </span>
//         </div>
//       )}
//       <ul className="overflow-y-auto flex-1 min-h-0">
//         {filtered.length === 0 ? (
//           <li className="px-3 py-4 text-sm text-slate-400 text-center">
//             {(allItems || []).length === 0 ? "No attractions in master" : defaultCity ? `No attractions found for ${defaultCity}` : "No matching attractions"}
//           </li>
//         ) : (
//           filtered.map((s, idx) => {
//             const img  = getImage(s);
//             const city = getCity(s);
//             const sel  = s.title === value;
//             return (
//               <li
//                 key={s.publicId || s.id || idx}
//                 onClick={() => handlePick(s)}
//                 className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors border-b border-slate-50 last:border-0
//                   ${sel ? "bg-blue-50" : "hover:bg-blue-50/60"}`}>
//                 {img ? (
//                   <img src={img} alt={s.title}
//                     onError={(e) => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }}
//                     className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-slate-200" />
//                 ) : null}
//                 <div style={{ display: img ? "none" : "flex" }}
//                   className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-blue-200 items-center justify-center flex-shrink-0 text-base">
//                   🗺️
//                 </div>
//                 <div className="min-w-0 flex-1">
//                   <span className={`text-sm truncate block ${sel ? "text-blue-700 font-semibold" : "text-slate-700 font-medium"}`}>
//                     {s.title}
//                   </span>
//                   {city && (
//                     <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
//                       <MapPin size={9} className="text-rose-400 flex-shrink-0" />
//                       <span className="truncate">{city}</span>
//                     </div>
//                   )}
//                 </div>
//                 {s.estimatedHours && (
//                   <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full flex-shrink-0">
//                     {s.estimatedHours}h
//                   </span>
//                 )}
//               </li>
//             );
//           })
//         )}
//       </ul>
//     </div>,
//     document.body
//   ) : null;

//   return (
//     <div className="relative">
//       <button
//         ref={buttonRef} type="button" onClick={handleToggle} disabled={loading}
//         className="w-full flex items-center justify-between gap-2 pl-3 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white
//           text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
//           transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:border-slate-300">
//         <span className={`truncate ${value ? "text-slate-700 font-medium" : "text-slate-400"}`}>
//           {loading ? "Loading attractions..." : (value || placeholder)}
//         </span>
//         <ChevronDown size={16} className={`text-slate-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
//       </button>
//       {panel}
//     </div>
//   );
// }


// /* ════════════════════════════════════════════════════════
//    INLINE ADD / EDIT SIGHTSEEING MODAL (HotelTab jaisa)
//    - Country → Destination → City cascade (ID-based)
//    - Title, Sequence, Est. Hours, Start Time
//    - Cloudinary image upload + preview
//    - Save → Sightseeing Master mein bhi add/update ho jaata
// ═══════════════════════════════════════════════════════ */
// const ssEmptyForm = {
//   destination: "", destinationId: "", city: "", title: "", sequence: "1",
//   estimatedHours: "", suggestedStartTime: "",
//   imagePath: "", imagePreview: "", description: "", remarks: "",
// };

// function SightseeingFormModal({ isOpen, onClose, editingItem, onSaved }) {
//   const [form, setForm]   = useState({ ...ssEmptyForm });
//   const [saving, setSaving]       = useState(false);
//   const [imgUploading, setImgUploading] = useState(false);
//   const [error, setError] = useState("");
//   const fileRef = useRef();

//   // Geography cascade
//   const [countries,   setCountries]   = useState([]);
//   const [countryId,   setCountryId]   = useState("");
//   const [destOptions, setDestOptions] = useState([]);
//   const [cityOptions, setCityOptions] = useState([]);
//   const [loadingDest, setLoadingDest] = useState(false);
//   const [loadingCity, setLoadingCity] = useState(false);

//   useEffect(() => {
//     if (!isOpen) return;
//     setError(""); setCountryId(""); setDestOptions([]); setCityOptions([]);
//     geographyService.getCountries().then(setCountries).catch(() => setCountries([]));

//     if (editingItem) {
//       // 🔍 DEBUG — kaunsa id field hai dekho
//       console.log("=== EDIT MODAL editingItem ===", {
//         id: editingItem.id,
//         publicId: editingItem.publicId,
//         sightseeingId: editingItem.sightseeingId,
//         title: editingItem.title,
//         fullObject: editingItem,
//       });
//       // Edit mode — existing values prefill
//       setForm({
//         ...ssEmptyForm,
//         title:              editingItem.title || "",
//         destination:        editingItem.destination || editingItem.destinationName || "",
//         destinationId:      editingItem.destinationId || "",
//         city:               editingItem.city || editingItem.cityName || "",
//         sequence:           editingItem.sequence != null ? String(editingItem.sequence) : "1",
//         estimatedHours:     editingItem.estimatedHours != null ? String(editingItem.estimatedHours) : "",
//         suggestedStartTime: editingItem.suggestedStartTime || "",
//         imagePath:          editingItem.imagePath || editingItem.imageUrl || "",
//         imagePreview:       editingItem.imagePath || editingItem.imageUrl || "",
//         description:        editingItem.description || "",
//         remarks:            editingItem.remarks || "",
//       });
//       // destinationId se country + cities prefill
//       const destId = editingItem.destinationId;
//       if (destId) {
//         (async () => {
//           try {
//             const dest = await geographyService.getDestinationById(destId);
//             if (dest?.countryId != null) {
//               setCountryId(String(dest.countryId));
//               setLoadingDest(true);
//               try { setDestOptions(await geographyService.getDestinationsByCountry(dest.countryId)); }
//               finally { setLoadingDest(false); }
//             }
//             setLoadingCity(true);
//             try { setCityOptions(await geographyService.getCitiesByDestination(destId)); }
//             finally { setLoadingCity(false); }
//           } catch { /* best-effort */ }
//         })();
//       }
//     } else {
//       setForm({ ...ssEmptyForm });
//     }
//   }, [isOpen, editingItem]);

//   const handleCountryChange = async (cid) => {
//     setCountryId(cid);
//     setForm(p => ({ ...p, destination: "", destinationId: "", city: "" }));
//     setDestOptions([]); setCityOptions([]);
//     if (!cid) return;
//     setLoadingDest(true);
//     try { setDestOptions(await geographyService.getDestinationsByCountry(cid)); }
//     catch { setDestOptions([]); }
//     finally { setLoadingDest(false); }
//   };

//   const handleDestChange = async (destId) => {
//     const sel = destOptions.find(d => String(d.id) === String(destId));
//     setForm(p => ({ ...p, destinationId: destId, destination: sel?.name || "", city: "" }));
//     setCityOptions([]);
//     if (!destId) return;
//     setLoadingCity(true);
//     try { setCityOptions(await geographyService.getCitiesByDestination(destId)); }
//     catch { setCityOptions([]); }
//     finally { setLoadingCity(false); }
//   };

//   const handleFile = async (e) => {
//     const file = e.target.files[0];
//     if (!file) return;
//     if (!file.type.match("image.*")) { setError("Please select a valid image file."); return; }
//     const reader = new FileReader();
//     reader.onload = (ev) => setForm(p => ({ ...p, imagePreview: ev.target.result }));
//     reader.readAsDataURL(file);
//     setImgUploading(true);
//     try {
//       const url = await sightseeingService.uploadSightseeingImage(file);
//       setForm(p => ({ ...p, imagePath: url, imagePreview: url }));
//     } catch (err) {
//       setError(err.message || "Image upload failed.");
//     } finally {
//       setImgUploading(false);
//     }
//   };

//   const handleSave = async () => {
//     if (!form.destination || !form.city || !form.title) {
//       setError("Destination, City and Title are required.");
//       return;
//     }
//     // Edit ke liye valid numeric id chahiye — kai field names try karo
//     const editId = editingItem
//       ? (editingItem.id ?? editingItem.sightseeingId ?? editingItem.publicId)
//       : null;

//     // Guard: edit mode mein id na mile to crash se bachao
//     if (editingItem && (editId == null || editId === "undefined")) {
//       setError("Cannot edit: this attraction has no valid ID. Try selecting it again from the dropdown.");
//       // console.error("Edit failed — editingItem has no id:", editingItem);
//       return;
//     }

//     setSaving(true); setError("");
//     try {
//       let saved;
//       if (editingItem && sightseeingService.updateSightseeing) {
//         const res = await sightseeingService.updateSightseeing(editId, form);
//         saved = res.data?.data ?? res.data;
//       } else {
//         const res = await sightseeingService.createSightseeing(form);
//         saved = res.data?.data ?? res.data;
//       }
//       onSaved?.(saved, editingItem ? "update" : "create");
//       onClose();
//     } catch (err) {
//       setError(err?.response?.data?.message || "Save failed. Please try again.");
//     } finally {
//       setSaving(false);
//     }
//   };

//   if (!isOpen) return null;

//   const inputCls = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10";

//   return createPortal(
//     <div className="fixed inset-0 flex items-start justify-center p-4 overflow-y-auto" style={{ zIndex: 2147483646 }}>
//       <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !saving && onClose()} />
//       <div className="relative bg-white w-full max-w-3xl shadow-2xl mt-6 mb-10 rounded-2xl overflow-hidden border border-slate-200">
//         {/* Header */}
//         <div className="bg-blue-600 px-4 sm:px-6 py-4 flex justify-between items-center text-white">
//           <div className="flex items-center gap-3">
//             <div className="p-2 bg-blue-500 rounded-xl"><Map size={18} strokeWidth={2.5} /></div>
//             <div>
//               <h2 className="text-base font-bold m-0">{editingItem ? "Edit Sightseeing" : "Add New Sightseeing"}</h2>
//               <p className="text-[11px] text-blue-100 m-0">Saves to Sightseeing Master</p>
//             </div>
//           </div>
//           <button onClick={() => !saving && onClose()} className="text-white hover:bg-white/20 p-2 rounded-full transition"><X size={18} /></button>
//         </div>

//         {error && (
//           <div className="mx-6 mt-4 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5 text-sm text-rose-600 flex items-center gap-2">
//             <AlertTriangle size={14} /> {error}
//           </div>
//         )}

//         <div className="p-6 space-y-5 bg-slate-50/50 max-h-[70vh] overflow-y-auto">
//           {/* Country / Destination / City */}
//           <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
//             <div>
//               <Label>Country <span className="text-rose-500">*</span></Label>
//               <div className="relative">
//                 <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
//                 <select className={`${inputCls} pl-9 appearance-none pr-7 cursor-pointer`} value={countryId} onChange={(e) => handleCountryChange(e.target.value)}>
//                   <option value="">{countries.length === 0 ? "Loading…" : "Select"}</option>
//                   {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
//                 </select>
//                 <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
//               </div>
//             </div>
//             <div>
//               <Label>Destination <span className="text-rose-500">*</span></Label>
//               <div className="relative">
//                 <Map size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
//                 <select className={`${inputCls} pl-9 appearance-none pr-7 cursor-pointer disabled:opacity-60`}
//                   value={form.destinationId} onChange={(e) => handleDestChange(e.target.value)} disabled={!countryId || loadingDest}>
//                   <option value="">{loadingDest ? "Loading…" : !countryId ? "Country first" : destOptions.length === 0 ? "None" : "Select"}</option>
//                   {destOptions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
//                 </select>
//                 <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
//               </div>
//             </div>
//             <div>
//               <Label>City <span className="text-rose-500">*</span></Label>
//               <div className="relative">
//                 <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
//                 <select className={`${inputCls} pl-9 appearance-none pr-7 cursor-pointer disabled:opacity-60`}
//                   value={form.city} onChange={(e) => setForm(p => ({ ...p, city: e.target.value }))} disabled={!form.destinationId || loadingCity}>
//                   <option value="">{!form.destinationId ? "Destination first" : loadingCity ? "Loading…" : cityOptions.length === 0 ? "None" : "Select"}</option>
//                   {cityOptions.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
//                 </select>
//                 <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
//               </div>
//             </div>
//           </div>

//           {/* Title */}
//           <div>
//             <Label>Title <span className="text-rose-500">*</span></Label>
//             <input type="text" className={inputCls} placeholder="e.g. Pashupatinath Temple Visit" value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} />
//           </div>

//           {/* Sequence / Est Hours / Start Time */}
//           <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
//             <div>
//               <Label>Sequence</Label>
//               <div className="relative">
//                 <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
//                 <input type="number" min={1} className={`${inputCls} pl-9`} value={form.sequence} onChange={(e) => setForm(p => ({ ...p, sequence: e.target.value }))} />
//               </div>
//             </div>
//             <div>
//               <Label>Est. Hours</Label>
//               <input type="text" className={inputCls} placeholder="2.5" value={form.estimatedHours} onChange={(e) => setForm(p => ({ ...p, estimatedHours: e.target.value }))} />
//             </div>
//             <div>
//               <Label>Start Time</Label>
//               <div className="relative">
//                 <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
//                 <input type="time" className={`${inputCls} pl-9 cursor-pointer`} value={form.suggestedStartTime} onChange={(e) => setForm(p => ({ ...p, suggestedStartTime: e.target.value }))} />
//               </div>
//             </div>
//           </div>

//           {/* Image */}
//           <div>
//             <Label>Attraction Image {imgUploading && <span className="ml-1 text-blue-500 text-xs animate-pulse">Uploading...</span>}</Label>
//             <div className={`border-2 border-dashed rounded-2xl p-5 text-center transition cursor-pointer ${imgUploading ? "border-blue-300 bg-blue-50" : "border-slate-300 bg-white hover:border-blue-400"}`}
//               onClick={() => !imgUploading && fileRef.current?.click()}>
//               {imgUploading ? (
//                 <div className="py-4"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" /><p className="text-sm text-blue-600">Uploading...</p></div>
//               ) : form.imagePreview ? (
//                 <div className="flex flex-col items-center">
//                   <img src={form.imagePreview} alt="preview" className="max-h-32 w-full object-cover rounded-xl border border-slate-200 mb-2" />
//                   <button className="text-xs font-bold text-rose-500 bg-rose-50 px-3 py-1 rounded-lg" onClick={(e) => { e.stopPropagation(); setForm(p => ({ ...p, imagePath: "", imagePreview: "" })); }}>Remove</button>
//                 </div>
//               ) : (
//                 <div className="py-3"><UploadCloud size={32} className="mx-auto text-blue-500 mb-2" /><p className="text-sm font-bold text-slate-700">Click to upload</p><p className="text-xs text-slate-500 m-0">JPG, PNG up to 2MB</p></div>
//               )}
//               <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
//             </div>
//           </div>

//           {/* Description */}
//           <div>
//             <Label>Description</Label>
//             <Textarea value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} rows={3} placeholder="Describe this attraction..." />
//           </div>
//         </div>

//         {/* Footer */}
//         <div className="bg-white px-4 sm:px-6 py-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
//           <button type="button" onClick={onClose} disabled={saving} className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-50 transition text-sm">Cancel</button>
//           <button type="button" onClick={handleSave} disabled={saving || imgUploading} className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-bold text-sm shadow-md transition active:scale-95 flex items-center justify-center gap-2">
//             {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</> : editingItem ? "Update" : "Save to Master"}
//           </button>
//         </div>
//       </div>
//     </div>,
//     document.body
//   );
// }

// /* ════════════════════════════════════════════════════════
//    MAIN SIGHTSEEING TAB
// ═══════════════════════════════════════════════════════ */
// /* ── Dashboard-style card (TravelCRM dashboard look) — sirf is page ke liye, shared ui untouched ── */
// function DashCard({ title, icon: Icon, iconColor = "", headerRight, children }) {
//   // iconColor se gradient map — dashboard jaise gradient icon discs
//   const grad = iconColor.includes("amber")
//     ? "from-amber-500 to-orange-500 shadow-amber-500/25"
//     : iconColor.includes("emerald") || iconColor.includes("green")
//       ? "from-emerald-500 to-teal-600 shadow-emerald-500/25"
//       : "from-blue-500 to-indigo-600 shadow-blue-500/25";
//   return (
//     <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
//       <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 px-4 sm:px-5 py-3.5 border-b border-slate-100">
//         <div className="flex items-center gap-3 min-w-0 flex-1">
//           <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${grad} shadow-md flex items-center justify-center flex-shrink-0`}>
//             {Icon && <Icon size={17} className="text-white" />}
//           </div>
//           <h3 className="text-sm font-bold text-slate-800 truncate">{title}</h3>
//         </div>
//         {headerRight && <div className="w-full sm:w-auto sm:flex-shrink-0">{headerRight}</div>}
//       </div>
//       <div className="p-4 sm:p-5">{children}</div>
//     </div>
//   );
// }

// export default function SightseeingTab({ onDataChange, paxInfo = {}, dayCityMap = {}, travelDate = "" }) {
//   const [included, setIncluded] = useState(true);
//   const [title,    setTitle]    = useState("Sightseeing");
//   const [notes,    setNotes]    = useState("");
//   const [days,     setDays]     = useState([newDay(1)]);
//   const daysAutoFilledRef = useRef(false);  // dayCityMap se days ek hi baar auto-build ho

//   // ── Sightseeing Master se saare attractions (ek baar load) ──
//   const [allItems,     setAllItems]     = useState([]);
//   const [itemsLoading, setItemsLoading] = useState(true);

//   // ── Add/Edit modal state ──
//   const [modalOpen,   setModalOpen]   = useState(false);
//   const [editingItem, setEditingItem] = useState(null);
//   const [modalTarget, setModalTarget] = useState(null); // { did, aid } — kis activity ke liye

//   const loadAllItems = useCallback(async () => {
//     try {
//       setItemsLoading(true);
//       const res = await sightseeingService.getAllSightseeings();
//       const raw  = res.data?.data ?? res.data;
//       const list = Array.isArray(raw) ? raw
//         : Array.isArray(raw?.content) ? raw.content : [];
//       // console.log("=== SIGHTSEEINGS LOADED ===", list.length, list[0]);
//       setAllItems(list);
//       return list;
//     } catch (err) {
//       console.error("Sightseeing load error:", err);
//       setAllItems([]);
//       return [];
//     } finally {
//       setItemsLoading(false);
//     }
//   }, []);

//   useEffect(() => { loadAllItems(); }, [loadAllItems]);

//   function newDay(num, city = "") {
//     return { id: Date.now() + Math.random(), day: num, date: "", city, pricePerPax: 0, pax: 1, activities: [newActivity(city)] };
//   }
//   function newActivity(city = "") {
//     return { id: Date.now() + Math.random(), attraction: "", startTime: "", description: "", meals: [], transfer: "Private", imagePath: "", city };
//   }

//   // ── Day N ki date = travelDate + (N-1) din → "YYYY-MM-DD" (date input format) ──
//   function dateForDay(n) {
//     if (!travelDate) return "";
//     const d = new Date(travelDate);
//     if (isNaN(d.getTime())) return "";
//     d.setDate(d.getDate() + (n - 1));
//     return d.toISOString().slice(0, 10);
//   }

//   // ── Lead ke itinerary se days auto-build (day 1 → Dubai, day 2 → Dubai, day 3 → Manali...) ──
//   // Sirf EK BAAR chalta hai jab dayCityMap aata hai aur days abhi tak default/pristine hai.
//   useEffect(() => {
//     const totalDays = Object.keys(dayCityMap).length;
//     if (totalDays === 0 || daysAutoFilledRef.current) return;
//     const isPristine = days.length === 1 && !days[0].date && (days[0].activities || []).every(a => !a.attraction && !a.description);
//     if (!isPristine) return;  // user ne already kuch edit kar diya, overwrite mat karo

//     const built = [];
//     for (let d = 1; d <= totalDays; d++) {
//       built.push({ ...newDay(d, dayCityMap[d] || ""), date: dateForDay(d) });
//     }
//     setDays(built);
//     daysAutoFilledRef.current = true;
//     // console.log("=== DAYS AUTO-BUILT FROM LEAD ITINERARY ===", built.map(d => ({ day: d.day, city: d.city, date: d.date })));
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [dayCityMap, travelDate]);

//   // ── Auto price ────────────────────────────────────────────
//   const dayTotals       = days.map(d => Number(d.pricePerPax) * Number(d.pax) || 0);
//   const sightseeingTotal = dayTotals.reduce((a, b) => a + b, 0);

//   // ── paxInfo aane par days ka pax auto-fill (default 1 ko hi replace karo) ──
//   useEffect(() => {
//     const total = paxInfo.totalPax || 0;
//     if (total > 0) {
//       setDays(prev => prev.map(d => (
//         (!d._paxTouched && (d.pax === 1 || d.pax === "1" || !d.pax))
//           ? { ...d, pax: total }
//           : d
//       )));
//     }

//   }, [paxInfo.totalPax]);

//   // ── Parent ko data do ─────────────────────────────────────
//   useEffect(() => {
//     onDataChange?.({ included, title, notes, days, amount: sightseeingTotal });
//   }, [included, title, notes, days, sightseeingTotal]);

//   // ── Helpers ───────────────────────────────────────────────
//   const addDay    = () => setDays(p => [...p, { ...newDay(p.length + 1, dayCityMap[p.length + 1] || ""), date: dateForDay(p.length + 1) }]);
//   const removeDay = (id) => setDays(p => p.filter(d => d.id !== id));
//   const updateDay = (id, k, v) => setDays(p => p.map(d => d.id === id ? { ...d, [k]: v } : d));
//   const addAct    = (did) => setDays(p => p.map(d => d.id === did ? { ...d, activities: [...d.activities, newActivity(d.city)] } : d));
//   const removeAct = (did, aid) => setDays(p => p.map(d => d.id === did ? { ...d, activities: d.activities.filter(a => a.id !== aid) } : d));
//   const updateAct = (did, aid, k, v) => setDays(p => p.map(d => d.id === did ? {
//     ...d, activities: d.activities.map(a => a.id === aid ? { ...a, [k]: v } : a)
//   } : d));

//   // ── Jab dropdown se attraction select ho → auto-fill ──
//   const fillActivity = (did, aid, item) => {
//     setDays(p => p.map(d => {
//       if (d.id !== did) return d;
//       return {
//         ...d,
//         activities: d.activities.map(a => {
//           if (a.id !== aid) return a;
//           const desc = item.description
//             ? item.description.replace(/<[^>]*>/g, "").trim()
//             : a.description;
//           return {
//             ...a,
//             attraction: item.title || a.attraction,
//             description: desc,
//             imagePath: item._image || item.imagePath || item.imageUrl || "",
//             city: item._city || item.city || "",
//             _sightseeingId: item.id || item.publicId || a._sightseeingId, // edit ke liye id yaad rakho
//           };
//         }),
//       };
//     }));
//   };

//   const handleAttractionSelect = (did, aid, item) => fillActivity(did, aid, item);

//   // ── ➕ Add button → modal khulo (naya) ──
//   const openAddModal = (did, aid) => {
//     setEditingItem(null);
//     setModalTarget({ did, aid });
//     setModalOpen(true);
//   };

//   // ── ✏️ Edit button → selected attraction ko master se dhundho, edit modal ──
//   const openEditModal = (did, aid, act) => {
//     // act ki attraction master se dhundho — id se ya title se (case-insensitive)
//     const found = allItems.find(s => {
//       const byId = act._sightseeingId &&
//         (String(s.id) === String(act._sightseeingId) || String(s.publicId) === String(act._sightseeingId));
//       const byTitle = s.title && act.attraction &&
//         s.title.trim().toLowerCase() === act.attraction.trim().toLowerCase();
//       return byId || byTitle;
//     });

//     // 🔍 DEBUG
//     // console.log("=== TAB OPEN EDIT ===", {
//     //   attraction: act.attraction,
//     //   _sightseeingId: act._sightseeingId,
//     //   foundItem: found,
//     //   totalMasterItems: allItems.length,
//     // });

//     if (!found) {
//       // Master mein nahi mila — user ko batao (silent fail nahi)
//       alert("This attraction was not found in Sightseeing Master.\n\nPlease select an attraction from the dropdown first, then click Edit.");
//       return;
//     }
//     setEditingItem(found);
//     setModalTarget({ did, aid });
//     setModalOpen(true);
//   };

//   // ── Modal save hone ke baad → list refresh + activity auto-fill ──
//   const handleModalSaved = async (saved) => {
//     const freshList = await loadAllItems(); // master list refresh
//     // jis activity ke liye modal khula tha usme bharo
//     if (modalTarget && saved) {
//       const item = freshList.find(s =>
//         s.id === saved.id || s.publicId === saved.publicId || s.title === saved.title
//       ) || saved;
//       fillActivity(modalTarget.did, modalTarget.aid, {
//         ...item,
//         _image: item.imagePath || item.imageUrl || "",
//         _city:  item.city || item.cityName || "",
//       });
//     }
//     setModalTarget(null);
//   };

//   const toggleMeal = (did, aid, meal) => {
//     const act = days.find(d => d.id === did)?.activities.find(a => a.id === aid);
//     if (!act) return;
//     const meals = act.meals.includes(meal) ? act.meals.filter(m => m !== meal) : [...act.meals, meal];
//     updateAct(did, aid, "meals", meals);
//   };

//   return (
//     <div className="space-y-5">

//       <DashCard title="Sightseeing Settings" icon={Map}>
//         <div className="space-y-4">
//           <IncludeToggle included={included} onChange={() => setIncluded(p => !p)} label="Include Sightseeing in Quotation" />
//           {included && (
//             <>
//               <div><Label>Section Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
//               <div><Label>Sightseeing Notes</Label><RichText value={notes} onChange={setNotes} placeholder="General notes..." rows={3} /></div>
//             </>
//           )}
//         </div>
//       </DashCard>

//       {included && days.map((day, di) => {
//         // ── Day ki city LOCKED source: lead itinerary (dayCityMap) — user editable nahi ──
//         const dayNum  = day.day || (di + 1);
//         const dayCity = dayCityMap[dayNum] || day.city || "";
//         return (
//         <DashCard key={day.id} title={`Day ${day.day}`} icon={Sun} iconColor="text-amber-600"
//           headerRight={
//             <div className="flex items-center gap-2 min-w-0">
//               {dayCity && (
//                 <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-50 border border-violet-200 text-[11px] font-bold text-violet-700 flex-shrink-0"
//                   title="City locked from lead itinerary">
//                   <MapPin size={11} className="flex-shrink-0" /> {dayCity}
//                 </span>
//               )}
//               <Input type="date" value={day.date} onChange={e => updateDay(day.id, "date", e.target.value)} className="flex-1 sm:flex-initial sm:w-36 min-w-0 text-xs py-1.5" />
//               {days.length > 1 && <RemoveBtn onClick={() => removeDay(day.id)} />}
//             </div>
//           }>
//           <div className="space-y-4">

//             {/* ── Price Box per Day ── */}
//             <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-2xl bg-amber-50 border border-amber-100">
//               <div>
//                 <Label>Price / Pax (₹)</Label>
//                 <Input type="number" min={0} value={day.pricePerPax}
//                   onChange={e => updateDay(day.id, "pricePerPax", e.target.value)} placeholder="0" />
//               </div>
//               <div>
//                 <Label>No. of Pax</Label>
//                 <Input type="number" min={1} value={day.pax}
//                   onChange={e => setDays(p => p.map(d => d.id === day.id ? { ...d, pax: e.target.value, _paxTouched: true } : d))} placeholder="1" />
//               </div>
//               <div>
//                 <Label>Day Total</Label>
//                 <div className="h-10 flex items-center justify-center bg-amber-600 rounded-xl text-sm font-extrabold text-white">
//                   ₹{dayTotals[di].toLocaleString("en-IN")}
//                 </div>
//               </div>
//             </div>

//             {/* ── Activities ── */}
//             {day.activities.map((act, ai) => (
//               <div key={act.id} className={ai > 0 ? "pt-4 border-t border-slate-100" : ""}>
//                 <div className="flex items-center justify-between mb-3">
//                   <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Activity {ai + 1}</span>
//                   {day.activities.length > 1 && <RemoveBtn onClick={() => removeAct(day.id, act.id)} />}
//                 </div>
//                 <FieldGrid cols={2}>
//                   <div>
//                     <Label>Attraction / Activity</Label>
//                     {/* ── Searchable dropdown + Add/Edit (HotelTab jaisa) ── */}
//                     <div className="flex items-center gap-2">
//                       <div className="flex-1 min-w-0">
//                         <SightseeingSearchDropdown
//                           value={act.attraction}
//                           onSelect={(item) => handleAttractionSelect(day.id, act.id, item)}
//                           allItems={allItems}
//                           loading={itemsLoading}
//                           defaultCity={dayCity}
//                           placeholder={dayCity ? `Search attractions in ${dayCity}...` : "Type to search attractions..."}
//                         />
//                       </div>
//                       {/* ➕ Add new sightseeing */}
//                       <button type="button" onClick={() => openAddModal(day.id, act.id)} title="Add new attraction"
//                         className="flex-shrink-0 w-9 sm:w-10 h-10 flex items-center justify-center rounded-xl border border-blue-500 text-blue-600 hover:bg-blue-600 hover:text-white transition shadow-sm">
//                         <Plus size={16} strokeWidth={2.5} />
//                       </button>
//                       {/* ✏️ Edit selected sightseeing */}
//                       <button type="button" onClick={() => openEditModal(day.id, act.id, act)} title="Edit selected attraction"
//                         disabled={!act.attraction}
//                         className="flex-shrink-0 w-9 sm:w-10 h-10 flex items-center justify-center rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">
//                         <Pencil size={15} />
//                       </button>
//                     </div>
//                   </div>
//                   <div><Label>Start Time</Label><Input type="time" value={act.startTime} onChange={e => updateAct(day.id, act.id, "startTime", e.target.value)} /></div>
//                 </FieldGrid>

//                 {/* ── Attraction image preview (select hone par) ── */}
//                 {act.imagePath && (
//                   <div className="mt-3 flex items-center gap-3 p-2.5 bg-blue-50 rounded-xl border border-blue-100">
//                     <img src={act.imagePath} alt={act.attraction}
//                       className="w-20 h-16 rounded-lg object-cover flex-shrink-0 border border-blue-200 shadow-sm" />
//                     <div className="min-w-0">
//                       <p className="text-sm font-bold text-slate-800 truncate">{act.attraction}</p>
//                       {act.city && (
//                         <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
//                           <MapPin size={10} className="text-rose-400" /> {act.city}
//                         </p>
//                       )}
//                       <span className="inline-block mt-1 text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
//                         ✓ From Sightseeing Master
//                       </span>
//                     </div>
//                   </div>
//                 )}

//                 <div className="mt-3"><Label>Description</Label>
//                   <Textarea value={act.description} onChange={e => updateAct(day.id, act.id, "description", e.target.value)} rows={2} placeholder="Describe this activity..." />
//                 </div>
//                 <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
//                   <div>
//                     <Label>Meals Included</Label>
//                     <div className="flex gap-2 mt-1.5 flex-wrap">
//                       {MEALS_OPT.map(m => (
//                         <button key={m} type="button" onClick={() => toggleMeal(day.id, act.id, m)}
//                           className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5
//                             ${act.meals.includes(m) ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-slate-200 text-slate-600 hover:border-blue-300"}`}>
//                           {m === "Breakfast" && <Coffee size={11} />}{m === "Lunch" && <Utensils size={11} />}{m === "Dinner" && <Moon size={11} />}{m}
//                         </button>
//                       ))}
//                     </div>
//                   </div>
//                   <div>
//                     <Label>Daily Transfer</Label>
//                     <div className="flex gap-2 mt-1.5 flex-wrap">
//                       {TRANSFER.map(t => (
//                         <button key={t} type="button" onClick={() => updateAct(day.id, act.id, "transfer", t)}
//                           className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all
//                             ${act.transfer === t ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-slate-200 text-slate-600 hover:border-blue-300"}`}>{t}
//                         </button>
//                       ))}
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             ))}
//             <div className="pt-3 border-t border-slate-100">
//               <AddBtn onClick={() => addAct(day.id)} label="Add Activity" />
//             </div>
//           </div>
//         </DashCard>
//         );
//       })}

//       {included && (
//         <>
//           <button onClick={addDay} type="button"
//             className="w-full py-3 border-2 border-dashed border-slate-300 hover:border-amber-400 hover:bg-amber-50/40 text-slate-500 hover:text-amber-600 text-sm font-bold rounded-2xl transition-all flex items-center justify-center gap-2">
//             <Plus size={16} strokeWidth={2.5} /> Add Day
//           </button>
//           <div className="flex items-center justify-between p-4 rounded-2xl"
//             style={{ background: "linear-gradient(135deg,#D97706,#92400E)" }}>
//             <div className="flex items-center gap-3">
//               <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
//                 <IndianRupee size={18} className="text-white" />
//               </div>
//               <div>
//                 <p className="text-[10px] text-amber-200 font-semibold uppercase tracking-wider">Sightseeing Total</p>
//                 <p className="text-[11px] text-amber-300">{days.length} day{days.length > 1 ? "s" : ""}</p>
//               </div>
//             </div>
//             <p className="text-2xl font-extrabold text-white">₹{sightseeingTotal.toLocaleString("en-IN")}</p>
//           </div>
//         </>
//       )}

//       {/* ── Add/Edit Sightseeing Modal ── */}
//       <SightseeingFormModal
//         isOpen={modalOpen}
//         onClose={() => { setModalOpen(false); setEditingItem(null); }}
//         editingItem={editingItem}
//         onSaved={handleModalSaved}
//       /> 
//     </div>
//   );
// }








//222222222222222222222222222222222222222222222


import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Map, Sun, Coffee, Utensils, Moon, Plus, IndianRupee, Search, ChevronDown, MapPin, Pencil, X, Globe, Building2, Hash, Clock, UploadCloud, AlertTriangle } from "lucide-react";
import { Label, Input, Textarea, AddBtn, RemoveBtn, IncludeToggle, FieldGrid, RichText } from "./Ui";
import { MEALS_OPT, TRANSFER } from "../Constants";
import { sightseeingService } from "@features/masters";
import { geographyService } from "@shared/api/geographyService";
import { getErrorMessage } from "@shared/api/apiError";
import { toast } from "@shared/ui/toast";

/* ════════════════════════════════════════════════════════
   INLINE SIGHTSEEING SEARCH DROPDOWN (HotelTab jaisa)
   - Button → click → portal dropdown (search box andar)
   - Type → filter (title + city)
   - Select → onSelect(sightseeing) auto-fill
═══════════════════════════════════════════════════════ */
function SightseeingSearchDropdown({ value, onSelect, allItems, loading, defaultCity = "", placeholder = "Type to search attractions..." }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pos, setPos] = useState(null);

  const buttonRef = useRef(null);
  const searchRef = useRef(null);
  const panelRef = useRef(null);

  const MAX_PANEL_H = 300, MIN_PANEL_H = 160;

  const calcPos = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const GAP = 4, MARGIN = 12;
    const spaceBelow = window.innerHeight - r.bottom - GAP - MARGIN;
    const maxH = Math.max(MIN_PANEL_H, Math.min(MAX_PANEL_H, spaceBelow));
    setPos({ left: r.left, width: r.width, top: r.bottom + GAP, maxH });
  }, []);

  useLayoutEffect(() => { if (open) calcPos(); }, [open, calcPos]);

  useEffect(() => {
    if (!open) return;
    const handler = () => calcPos();
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
  }, [open, calcPos]);

  useEffect(() => {
    if (open && searchRef.current) {
      const t = setTimeout(() => searchRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        buttonRef.current && !buttonRef.current.contains(e.target) &&
        panelRef.current && !panelRef.current.contains(e.target)
      ) { setOpen(false); setSearch(""); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Image + city helpers (multiple field names)
  const getImage = (s) =>
    s.imagePath || s.imageUrl || s.image || s.photo || s.coverImage || null;
  const getCity = (s) =>
    s.city || s.cityName || s.destinationName || s.location || "";

  const term = search.trim().toLowerCase();

  // ── Flexible city match: "Dubai" ↔ "Dubai, UAE" sab match ──
  const cityMatches = (s) => {
    const sc = getCity(s).trim().toLowerCase();
    const dc = (defaultCity || "").trim().toLowerCase();
    if (!sc || !dc) return false;
    return sc === dc || sc.includes(dc) || dc.includes(sc);
  };

  // ── STRICT city filter: day ki city set hai to SIRF usi city ki attractions ──
  // Search bhi usi city ke andar hota hai — dusri city ki attraction kabhi nahi dikhegi.
  const baseList = defaultCity ? (allItems || []).filter(cityMatches) : (allItems || []);
  const filtered = term
    ? baseList.filter(s => (s.title || "").toLowerCase().includes(term))
    : baseList;

  // if (defaultCity && (allItems || []).length > 0) {
  //   // console.log(`[SIGHTSEEING strict city] "${defaultCity}" → ${baseList.length}/${allItems.length} attractions`);
  // }

  const handleToggle = () => { setOpen(p => !p); setSearch(""); };
  const handlePick = (item) => {
    setOpen(false); setSearch("");
    onSelect?.({ ...item, _image: getImage(item), _city: getCity(item) });
  };

  const panel = (open && !loading && pos) ? createPortal(
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        left: `${pos.left}px`, top: `${pos.top}px`, width: `${pos.width}px`,
        maxHeight: `${pos.maxH}px`, zIndex: 2147483647,
      }}
      className="bg-white border border-slate-200 rounded-xl shadow-2xl flex flex-col overflow-hidden">
      <div className="relative p-2 border-b border-slate-100 flex-shrink-0 bg-white">
        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          ref={searchRef} type="text" value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search attraction or city..."
          className="w-full pl-8 pr-2 py-2 text-sm rounded-lg border border-slate-200
            outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
        />
      </div>
      {defaultCity && (
        <div className="flex items-center px-3 py-1.5 bg-blue-50 border-b border-blue-100 flex-shrink-0">
          <span className="text-[11px] font-semibold text-blue-700 flex items-center gap-1">
            <MapPin size={11} /> {defaultCity} attractions only
          </span>
        </div>
      )}
      <ul className="overflow-y-auto flex-1 min-h-0">
        {filtered.length === 0 ? (
          <li className="px-3 py-4 text-sm text-slate-400 text-center">
            {(allItems || []).length === 0 ? "No attractions in master" : defaultCity ? `No attractions found for ${defaultCity}` : "No matching attractions"}
          </li>
        ) : (
          filtered.map((s, idx) => {
            const img = getImage(s);
            const city = getCity(s);
            const sel = s.title === value;
            return (
              <li
                key={s.publicId || s.id || idx}
                onClick={() => handlePick(s)}
                className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors border-b border-slate-50 last:border-0
                  ${sel ? "bg-blue-50" : "hover:bg-blue-50/60"}`}>
                {img ? (
                  <img src={img} alt={s.title}
                    onError={(e) => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }}
                    className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-slate-200" />
                ) : null}
                <div style={{ display: img ? "none" : "flex" }}
                  className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-blue-200 items-center justify-center flex-shrink-0 text-base">
                  🗺️
                </div>
                <div className="min-w-0 flex-1">
                  <span className={`text-sm truncate block ${sel ? "text-blue-700 font-semibold" : "text-slate-700 font-medium"}`}>
                    {s.title}
                  </span>
                  {city && (
                    <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                      <MapPin size={9} className="text-rose-400 flex-shrink-0" />
                      <span className="truncate">{city}</span>
                    </div>
                  )}
                </div>
                {s.estimatedHours && (
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full flex-shrink-0">
                    {s.estimatedHours}h
                  </span>
                )}
              </li>
            );
          })
        )}
      </ul>
    </div>,
    document.body
  ) : null;

  return (
    <div className="relative">
      <button
        ref={buttonRef} type="button" onClick={handleToggle} disabled={loading}
        className="w-full flex items-center justify-between gap-2 pl-3 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white
          text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
          transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:border-slate-300">
        <span className={`truncate ${value ? "text-slate-700 font-medium" : "text-slate-400"}`}>
          {loading ? "Loading attractions..." : (value || placeholder)}
        </span>
        <ChevronDown size={16} className={`text-slate-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {panel}
    </div>
  );
}


/* ════════════════════════════════════════════════════════
   INLINE ADD / EDIT SIGHTSEEING MODAL (HotelTab jaisa)
   - Country → Destination → City cascade (ID-based)
   - Title, Sequence, Est. Hours, Start Time
   - Cloudinary image upload + preview
   - Save → Sightseeing Master mein bhi add/update ho jaata
═══════════════════════════════════════════════════════ */
const ssEmptyForm = {
  destination: "", destinationId: "", city: "", title: "", sequence: "1",
  estimatedHours: "", suggestedStartTime: "",
  imagePath: "", imagePreview: "", description: "", remarks: "",
};

function SightseeingFormModal({ isOpen, onClose, editingItem, onSaved }) {
  const [form, setForm] = useState({ ...ssEmptyForm });
  const [saving, setSaving] = useState(false);
  const [imgUploading, setImgUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef();

  // Geography cascade
  const [countries, setCountries] = useState([]);
  const [countryId, setCountryId] = useState("");
  const [destOptions, setDestOptions] = useState([]);
  const [cityOptions, setCityOptions] = useState([]);
  const [loadingDest, setLoadingDest] = useState(false);
  const [loadingCity, setLoadingCity] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError(""); setCountryId(""); setDestOptions([]); setCityOptions([]);
    geographyService.getCountries().then(setCountries).catch(() => setCountries([]));

    if (editingItem) {
      // 🔍 DEBUG — kaunsa id field hai dekho
      console.log("=== EDIT MODAL editingItem ===", {
        id: editingItem.id,
        publicId: editingItem.publicId,
        sightseeingId: editingItem.sightseeingId,
        title: editingItem.title,
        fullObject: editingItem,
      });
      // Edit mode — existing values prefill
      setForm({
        ...ssEmptyForm,
        title: editingItem.title || "",
        destination: editingItem.destination || editingItem.destinationName || "",
        destinationId: editingItem.destinationId || "",
        city: editingItem.city || editingItem.cityName || "",
        sequence: editingItem.sequence != null ? String(editingItem.sequence) : "1",
        estimatedHours: editingItem.estimatedHours != null ? String(editingItem.estimatedHours) : "",
        suggestedStartTime: editingItem.suggestedStartTime || "",
        imagePath: editingItem.imagePath || editingItem.imageUrl || "",
        imagePreview: editingItem.imagePath || editingItem.imageUrl || "",
        description: editingItem.description || "",
        remarks: editingItem.remarks || "",
      });
      // destinationId se country + cities prefill
      const destId = editingItem.destinationId;
      if (destId) {
        (async () => {
          try {
            const dest = await geographyService.getDestinationById(destId);
            if (dest?.countryId != null) {
              setCountryId(String(dest.countryId));
              setLoadingDest(true);
              try { setDestOptions(await geographyService.getDestinationsByCountry(dest.countryId)); }
              finally { setLoadingDest(false); }
            }
            setLoadingCity(true);
            try { setCityOptions(await geographyService.getCitiesByDestination(destId)); }
            finally { setLoadingCity(false); }
          } catch { /* best-effort */ }
        })();
      }
    } else {
      setForm({ ...ssEmptyForm });
    }
  }, [isOpen, editingItem]);

  const handleCountryChange = async (cid) => {
    setCountryId(cid);
    setForm(p => ({ ...p, destination: "", destinationId: "", city: "" }));
    setDestOptions([]); setCityOptions([]);
    if (!cid) return;
    setLoadingDest(true);
    try { setDestOptions(await geographyService.getDestinationsByCountry(cid)); }
    catch { setDestOptions([]); }
    finally { setLoadingDest(false); }
  };

  const handleDestChange = async (destId) => {
    const sel = destOptions.find(d => String(d.id) === String(destId));
    setForm(p => ({ ...p, destinationId: destId, destination: sel?.name || "", city: "" }));
    setCityOptions([]);
    if (!destId) return;
    setLoadingCity(true);
    try { setCityOptions(await geographyService.getCitiesByDestination(destId)); }
    catch { setCityOptions([]); }
    finally { setLoadingCity(false); }
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.match("image.*")) { setError("Please select a valid image file."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setForm(p => ({ ...p, imagePreview: ev.target.result }));
    reader.readAsDataURL(file);
    setImgUploading(true);
    try {
      const url = await sightseeingService.uploadSightseeingImage(file);
      setForm(p => ({ ...p, imagePath: url, imagePreview: url }));
    } catch (err) {
      setError(getErrorMessage(err, "Image upload failed."));
    } finally {
      setImgUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.destination || !form.city || !form.title) {
      setError("Destination, City and Title are required.");
      return;
    }
    // Edit ke liye valid numeric id chahiye — kai field names try karo
    const editId = editingItem
      ? (editingItem.id ?? editingItem.sightseeingId ?? editingItem.publicId)
      : null;

    // Guard: edit mode mein id na mile to crash se bachao
    if (editingItem && (editId == null || editId === "undefined")) {
      setError("Cannot edit: this attraction has no valid ID. Try selecting it again from the dropdown.");
      // console.error("Edit failed — editingItem has no id:", editingItem);
      return;
    }

    setSaving(true); setError("");
    try {
      let saved;
      if (editingItem && sightseeingService.updateSightseeing) {
        const res = await sightseeingService.updateSightseeing(editId, form);
        saved = res.data?.data ?? res.data;
      } else {
        const res = await sightseeingService.createSightseeing(form);
        saved = res.data?.data ?? res.data;
      }
      onSaved?.(saved, editingItem ? "update" : "create");
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || "Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const inputCls = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10";

  return createPortal(
    <div className="fixed inset-0 flex items-start justify-center p-4 overflow-y-auto" style={{ zIndex: 2147483646 }}>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !saving && onClose()} />
      <div className="relative bg-white w-full max-w-3xl shadow-2xl mt-6 mb-10 rounded-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-blue-600 px-4 sm:px-6 py-4 flex justify-between items-center text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500 rounded-xl"><Map size={18} strokeWidth={2.5} /></div>
            <div>
              <h2 className="text-base font-bold m-0">{editingItem ? "Edit Sightseeing" : "Add New Sightseeing"}</h2>
              <p className="text-[11px] text-blue-100 m-0">Saves to Sightseeing Master</p>
            </div>
          </div>
          <button onClick={() => !saving && onClose()} className="text-white hover:bg-white/20 p-2 rounded-full transition"><X size={18} /></button>
        </div>

        {error && (
          <div className="mx-6 mt-4 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5 text-sm text-rose-600 flex items-center gap-2">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        <div className="p-6 space-y-5 bg-slate-50/50 max-h-[70vh] overflow-y-auto">
          {/* Country / Destination / City */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>Country <span className="text-rose-500">*</span></Label>
              <div className="relative">
                <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select className={`${inputCls} pl-9 appearance-none pr-7 cursor-pointer`} value={countryId} onChange={(e) => handleCountryChange(e.target.value)}>
                  <option value="">{countries.length === 0 ? "Loading…" : "Select"}</option>
                  {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <Label>Destination <span className="text-rose-500">*</span></Label>
              <div className="relative">
                <Map size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select className={`${inputCls} pl-9 appearance-none pr-7 cursor-pointer disabled:opacity-60`}
                  value={form.destinationId} onChange={(e) => handleDestChange(e.target.value)} disabled={!countryId || loadingDest}>
                  <option value="">{loadingDest ? "Loading…" : !countryId ? "Country first" : destOptions.length === 0 ? "None" : "Select"}</option>
                  {destOptions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <Label>City <span className="text-rose-500">*</span></Label>
              <div className="relative">
                <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select className={`${inputCls} pl-9 appearance-none pr-7 cursor-pointer disabled:opacity-60`}
                  value={form.city} onChange={(e) => setForm(p => ({ ...p, city: e.target.value }))} disabled={!form.destinationId || loadingCity}>
                  <option value="">{!form.destinationId ? "Destination first" : loadingCity ? "Loading…" : cityOptions.length === 0 ? "None" : "Select"}</option>
                  {cityOptions.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Title */}
          <div>
            <Label>Title <span className="text-rose-500">*</span></Label>
            <input type="text" className={inputCls} placeholder="e.g. Pashupatinath Temple Visit" value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} />
          </div>

          {/* Sequence / Est Hours / Start Time */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>Sequence</Label>
              <div className="relative">
                <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input type="number" min={1} className={`${inputCls} pl-9`} value={form.sequence} onChange={(e) => setForm(p => ({ ...p, sequence: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Est. Hours</Label>
              <input type="text" className={inputCls} placeholder="2.5" value={form.estimatedHours} onChange={(e) => setForm(p => ({ ...p, estimatedHours: e.target.value }))} />
            </div>
            <div>
              <Label>Start Time</Label>
              <div className="relative">
                <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input type="time" className={`${inputCls} pl-9 cursor-pointer`} value={form.suggestedStartTime} onChange={(e) => setForm(p => ({ ...p, suggestedStartTime: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Image */}
          <div>
            <Label>Attraction Image {imgUploading && <span className="ml-1 text-blue-500 text-xs animate-pulse">Uploading...</span>}</Label>
            <div className={`border-2 border-dashed rounded-2xl p-5 text-center transition cursor-pointer ${imgUploading ? "border-blue-300 bg-blue-50" : "border-slate-300 bg-white hover:border-blue-400"}`}
              onClick={() => !imgUploading && fileRef.current?.click()}>
              {imgUploading ? (
                <div className="py-4"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" /><p className="text-sm text-blue-600">Uploading...</p></div>
              ) : form.imagePreview ? (
                <div className="flex flex-col items-center">
                  <img src={form.imagePreview} alt="preview" className="max-h-32 w-full object-cover rounded-xl border border-slate-200 mb-2" />
                  <button className="text-xs font-bold text-rose-500 bg-rose-50 px-3 py-1 rounded-lg" onClick={(e) => { e.stopPropagation(); setForm(p => ({ ...p, imagePath: "", imagePreview: "" })); }}>Remove</button>
                </div>
              ) : (
                <div className="py-3"><UploadCloud size={32} className="mx-auto text-blue-500 mb-2" /><p className="text-sm font-bold text-slate-700">Click to upload</p><p className="text-xs text-slate-500 m-0">JPG, PNG up to 2MB</p></div>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            </div>
          </div>

          {/* Description */}
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} rows={3} placeholder="Describe this attraction..." />
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white px-4 sm:px-6 py-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button type="button" onClick={onClose} disabled={saving} className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-50 transition text-sm">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving || imgUploading} className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-bold text-sm shadow-md transition active:scale-95 flex items-center justify-center gap-2">
            {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</> : editingItem ? "Update" : "Save to Master"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ════════════════════════════════════════════════════════
   MAIN SIGHTSEEING TAB
═══════════════════════════════════════════════════════ */
/* ── Dashboard-style card (TravelCRM dashboard look) — sirf is page ke liye, shared ui untouched ── */
function DashCard({ title, icon: Icon, iconColor = "", headerRight, children }) {
  // iconColor se gradient map — dashboard jaise gradient icon discs
  const grad = iconColor.includes("amber")
    ? "from-amber-500 to-orange-500 shadow-amber-500/25"
    : iconColor.includes("emerald") || iconColor.includes("green")
      ? "from-emerald-500 to-teal-600 shadow-emerald-500/25"
      : "from-blue-500 to-indigo-600 shadow-blue-500/25";
  return (
    <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 px-4 sm:px-5 py-3.5 border-b border-slate-100">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${grad} shadow-md flex items-center justify-center flex-shrink-0`}>
            {Icon && <Icon size={17} className="text-white" />}
          </div>
          <h3 className="text-sm font-bold text-slate-800 truncate">{title}</h3>
        </div>
        {headerRight && <div className="w-full sm:w-auto sm:flex-shrink-0">{headerRight}</div>}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

// export default function SightseeingTab({ onDataChange, paxInfo = {}, dayCityMap = {}, travelDate = "", defaultIncluded = true }) {

export default function SightseeingTab({
  onDataChange,
  paxInfo = {},
  dayCityMap = {},
  departureDay = null,
  travelDate = "",
  defaultIncluded = true,
  initialData = null,
}) {
  const [included, setIncluded] = useState(defaultIncluded);
  const [title, setTitle] = useState("Sightseeing");
  const [notes, setNotes] = useState("");
  const [days, setDays] = useState([newDay(1)]);
  const daysAutoFilledRef = useRef(false);  // dayCityMap se days ek hi baar auto-build ho
  const hydratedRef = useRef(false);        // saved quotation ek hi baar seed ho
  const includeTouchedRef = useRef(false);

  // ── Sightseeing Master se saare attractions (ek baar load) ──
  const [allItems, setAllItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(true);

  // ── Add/Edit modal state ──
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [modalTarget, setModalTarget] = useState(null); // { did, aid } — kis activity ke liye

  const loadAllItems = useCallback(async () => {
    try {
      setItemsLoading(true);
      const res = await sightseeingService.getAllSightseeings();
      const raw = res.data?.data ?? res.data;
      const list = Array.isArray(raw) ? raw
        : Array.isArray(raw?.content) ? raw.content : [];
      // console.log("=== SIGHTSEEINGS LOADED ===", list.length, list[0]);
      setAllItems(list);
      return list;
    } catch (err) {
      console.error("Sightseeing load error:", err);
      setAllItems([]);
      return [];
    } finally {
      setItemsLoading(false);
    }
  }, []);

  useEffect(() => { loadAllItems(); }, [loadAllItems]);

  function newDay(num, city = "") {
    return { id: Date.now() + Math.random(), day: num, date: "", city, pricePerPax: 0, pax: 1, activities: [newActivity(city)] };
  }
  function newActivity(city = "") {
    return { id: Date.now() + Math.random(), attraction: "", startTime: "", description: "", meals: [], transfer: "Private", imagePath: "", city };
  }

  // ── Day N ki date = travelDate + (N-1) din → "YYYY-MM-DD" (date input format) ──
  function dateForDay(n) {
    if (!travelDate) return "";
    const d = new Date(travelDate);
    if (isNaN(d.getTime())) return "";
    d.setDate(d.getDate() + (n - 1));
    return d.toISOString().slice(0, 10);
  }


  // ── Normal sightseeing day ya final departure day create karo ──
  function buildItineraryDay(dayNumber) {
    const city = dayCityMap[dayNumber] || "";

    const dayData = {
      ...newDay(dayNumber, city),
      date: dateForDay(dayNumber),
    };

    const isDepartureDay =
      departureDay != null &&
      Number(dayNumber) === Number(departureDay);

    if (!isDepartureDay) {
      return dayData;
    }

    return {
      ...dayData,
      isDepartureDay: true,
      pricePerPax: 0,

      activities: [
        {
          ...newActivity(city),

          attraction: city
            ? `Departure from ${city}`
            : "Departure",

          description: city
            ? `Check-out and departure from ${city}.`
            : "Check-out and departure.",
        },
      ],
    };
  }

  // ── Lead ke itinerary se days auto-build (day 1 → Dubai, day 2 → Dubai, day 3 → Manali...) ──
  // Sirf EK BAAR chalta hai jab dayCityMap aata hai aur days abhi tak default/pristine hai.
  // useEffect(() => {
  //   const totalDays = Object.keys(dayCityMap).length;
  //   if (totalDays === 0 || daysAutoFilledRef.current) return;
  //   const isPristine = days.length === 1 && !days[0].date && (days[0].activities || []).every(a => !a.attraction && !a.description);
  //   if (!isPristine) return;  // user ne already kuch edit kar diya, overwrite mat karo

  //   const built = [];
  //   for (let d = 1; d <= totalDays; d++) {
  //     built.push({ ...newDay(d, dayCityMap[d] || ""), date: dateForDay(d) });
  //   }
  //   setDays(built);
  //   daysAutoFilledRef.current = true;
  //   // console.log("=== DAYS AUTO-BUILT FROM LEAD ITINERARY ===", built.map(d => ({ day: d.day, city: d.city, date: d.date })));
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [dayCityMap, travelDate]);



  useEffect(() => {
    const dayNumbers = Object.keys(dayCityMap)
      .map(Number)
      .filter(Number.isFinite);

    const totalDays =
      dayNumbers.length > 0
        ? Math.max(...dayNumbers)
        : 0;

    if (totalDays === 0 || daysAutoFilledRef.current) {
      return;
    }

    const isPristine =
      days.length === 1 &&
      !days[0].date &&
      (days[0].activities || []).every(
        (activity) =>
          !activity.attraction &&
          !activity.description
      );

    // User ne manually data enter kar diya ho to overwrite mat karo.
    if (!isPristine) {
      return;
    }

    const builtDays = [];

    for (let dayNumber = 1; dayNumber <= totalDays; dayNumber++) {
      builtDays.push(buildItineraryDay(dayNumber));
    }

    setDays(builtDays);
    daysAutoFilledRef.current = true;

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayCityMap, departureDay, travelDate]);

  // ── EDIT MODE PREFILL — saved quotation se state seed karo (ek hi baar) ──
  // days/activities me id nahi hota (payload strip kar deta hai) — UI keys aur update/remove
  // usi id pe chalte hain, isliye naye lagate hain. `_paxTouched` isliye ki saved pax ko
  // lead-wala auto-fill dobara na badle. daysAutoFilledRef band — saved data lead ke
  // itinerary-derived days se upar hai.
  useEffect(() => {
    if (hydratedRef.current || !initialData) return;
    hydratedRef.current = true;
    includeTouchedRef.current = true;
    daysAutoFilledRef.current = true;

    if (typeof initialData.included === "boolean") setIncluded(initialData.included);
    if (initialData.title) setTitle(initialData.title);
    if (initialData.notes) setNotes(initialData.notes);
    if (Array.isArray(initialData.days) && initialData.days.length > 0) {
      setDays(initialData.days.map((d, i) => ({
        ...newDay(d.day || i + 1),
        ...d,
        id: Date.now() + Math.random(),
        _paxTouched: true,
        activities: (d.activities || []).map(a => ({
          ...newActivity(),
          ...a,
          id: Date.now() + Math.random(),
        })),
      })));
    }
  }, [initialData]);

  // ── Lead ke services se Include default (remount key ki jagah) ──
  useEffect(() => {
    if (includeTouchedRef.current) return;
    setIncluded(defaultIncluded);
  }, [defaultIncluded]);

  // ── Auto price ────────────────────────────────────────────
  const dayTotals = days.map(d => Number(d.pricePerPax) * Number(d.pax) || 0);
  const sightseeingTotal = dayTotals.reduce((a, b) => a + b, 0);

  // ── paxInfo aane par days ka pax auto-fill (default 1 ko hi replace karo) ──
  useEffect(() => {
    const total = paxInfo.totalPax || 0;
    if (total > 0) {
      setDays(prev => prev.map(d => (
        (!d._paxTouched && (d.pax === 1 || d.pax === "1" || !d.pax))
          ? { ...d, pax: total }
          : d
      )));
    }

  }, [paxInfo.totalPax]);

  // ── Parent ko data do ─────────────────────────────────────
  useEffect(() => {
    onDataChange?.({ included, title, notes, days, amount: sightseeingTotal });
  }, [included, title, notes, days, sightseeingTotal]);

  // ── Helpers ───────────────────────────────────────────────
  // const addDay    = () => setDays(p => [...p, { ...newDay(p.length + 1, dayCityMap[p.length + 1] || ""), date: dateForDay(p.length + 1) }]);

  const addDay = () => {
    setDays((previousDays) => {
      const nextDayNumber = previousDays.length + 1;

      return [
        ...previousDays,
        buildItineraryDay(nextDayNumber),
      ];
    });
  };
  const removeDay = (id) => setDays(p => p.filter(d => d.id !== id));
  const updateDay = (id, k, v) => setDays(p => p.map(d => d.id === id ? { ...d, [k]: v } : d));
  const addAct = (did) => setDays(p => p.map(d => d.id === did ? { ...d, activities: [...d.activities, newActivity(d.city)] } : d));
  const removeAct = (did, aid) => setDays(p => p.map(d => d.id === did ? { ...d, activities: d.activities.filter(a => a.id !== aid) } : d));
  const updateAct = (did, aid, k, v) => setDays(p => p.map(d => d.id === did ? {
    ...d, activities: d.activities.map(a => a.id === aid ? { ...a, [k]: v } : a)
  } : d));

  // ── Jab dropdown se attraction select ho → auto-fill ──
  const fillActivity = (did, aid, item) => {
    setDays(p => p.map(d => {
      if (d.id !== did) return d;
      return {
        ...d,
        activities: d.activities.map(a => {
          if (a.id !== aid) return a;
          const desc = item.description
            ? item.description.replace(/<[^>]*>/g, "").trim()
            : a.description;
          return {
            ...a,
            attraction: item.title || a.attraction,
            description: desc,
            imagePath: item._image || item.imagePath || item.imageUrl || "",
            city: item._city || item.city || "",
            _sightseeingId: item.id || item.publicId || a._sightseeingId, // edit ke liye id yaad rakho
          };
        }),
      };
    }));
  };

  const handleAttractionSelect = (did, aid, item) => fillActivity(did, aid, item);

  // ── ➕ Add button → modal khulo (naya) ──
  const openAddModal = (did, aid) => {
    setEditingItem(null);
    setModalTarget({ did, aid });
    setModalOpen(true);
  };

  // ── ✏️ Edit button → selected attraction ko master se dhundho, edit modal ──
  const openEditModal = (did, aid, act) => {
    // act ki attraction master se dhundho — id se ya title se (case-insensitive)
    const found = allItems.find(s => {
      const byId = act._sightseeingId &&
        (String(s.id) === String(act._sightseeingId) || String(s.publicId) === String(act._sightseeingId));
      const byTitle = s.title && act.attraction &&
        s.title.trim().toLowerCase() === act.attraction.trim().toLowerCase();
      return byId || byTitle;
    });

    // 🔍 DEBUG
    // console.log("=== TAB OPEN EDIT ===", {
    //   attraction: act.attraction,
    //   _sightseeingId: act._sightseeingId,
    //   foundItem: found,
    //   totalMasterItems: allItems.length,
    // });

    if (!found) {
      // Master mein nahi mila — user ko batao (silent fail nahi)
      toast.error("This attraction isn't in the Sightseeing Master. Select one from the dropdown first, then click Edit.");
      return;
    }
    setEditingItem(found);
    setModalTarget({ did, aid });
    setModalOpen(true);
  };

  // ── Modal save hone ke baad → list refresh + activity auto-fill ──
  const handleModalSaved = async (saved) => {
    const freshList = await loadAllItems(); // master list refresh
    // jis activity ke liye modal khula tha usme bharo
    if (modalTarget && saved) {
      const item = freshList.find(s =>
        s.id === saved.id || s.publicId === saved.publicId || s.title === saved.title
      ) || saved;
      fillActivity(modalTarget.did, modalTarget.aid, {
        ...item,
        _image: item.imagePath || item.imageUrl || "",
        _city: item.city || item.cityName || "",
      });
    }
    setModalTarget(null);
  };

  const toggleMeal = (did, aid, meal) => {
    const act = days.find(d => d.id === did)?.activities.find(a => a.id === aid);
    if (!act) return;
    const meals = act.meals.includes(meal) ? act.meals.filter(m => m !== meal) : [...act.meals, meal];
    updateAct(did, aid, "meals", meals);
  };

  return (
    <div className="space-y-5">

      <DashCard title="Sightseeing Settings" icon={Map}>
        <div className="space-y-4">
          <IncludeToggle included={included} onChange={() => { includeTouchedRef.current = true; setIncluded(p => !p); }} label="Include Sightseeing in Quotation" />
          {included && (
            <>
              <div><Label>Section Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
              <div><Label>Sightseeing Notes</Label><RichText value={notes} onChange={setNotes} placeholder="General notes..." rows={3} /></div>
            </>
          )}
        </div>
      </DashCard>

      {/* {included && days.map((day, di) => {
        // ── Day ki city LOCKED source: lead itinerary (dayCityMap) — user editable nahi ──
        const dayNum  = day.day || (di + 1);
        const dayCity = dayCityMap[dayNum] || day.city || "";
        return (
        <DashCard key={day.id} title={`Day ${day.day}${day.city ? ` · ${day.city}` : ""}`} icon={Sun} iconColor="text-amber-600"
          headerRight={
            <div className="flex items-center gap-2 min-w-0"> */}


      {included && days.map((day, di) => {
        // Day city lead itinerary se
        const dayNum = day.day || di + 1;
        const dayCity = dayCityMap[dayNum] || day.city || "";

        // Departure day par special heading
        const dayTitle = day.isDepartureDay
          ? `Day ${dayNum} · Departure from ${dayCity || "Destination"}`
          : `Day ${dayNum}${dayCity ? ` · ${dayCity}` : ""}`;

        return (
          <DashCard
            key={day.id}
            title={dayTitle}
            icon={Sun}
            iconColor="text-amber-600"
            headerRight={
              <div className="flex items-center gap-2 min-w-0 flex-wrap">

                {/* Departure Day badge */}
                {day.isDepartureDay && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-[11px] font-bold text-rose-700 flex-shrink-0">
                    Departure Day
                  </span>
                )}

                {dayCity && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-50 border border-violet-200 text-[11px] font-bold text-violet-700 flex-shrink-0"
                    title="City locked from lead itinerary">
                    <MapPin size={11} className="flex-shrink-0" /> {dayCity}
                  </span>
                )}
                <Input type="date" value={day.date} onChange={e => updateDay(day.id, "date", e.target.value)} className="flex-1 sm:flex-initial sm:w-36 min-w-0 text-xs py-1.5" />
                {days.length > 1 && <RemoveBtn onClick={() => removeDay(day.id)} />}
              </div>
            }>
            <div className="space-y-4">

              {/* ── Price Box per Day ── */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-2xl bg-amber-50 border border-amber-100">
                <div>
                  <Label>Price / Pax (₹)</Label>
                  <Input type="number" min={0} value={day.pricePerPax}
                    onChange={e => updateDay(day.id, "pricePerPax", e.target.value)} placeholder="0" />
                </div>
                <div>
                  <Label>No. of Pax</Label>
                  <Input type="number" min={1} value={day.pax}
                    onChange={e => setDays(p => p.map(d => d.id === day.id ? { ...d, pax: e.target.value, _paxTouched: true } : d))} placeholder="1" />
                </div>
                <div>
                  <Label>Day Total</Label>
                  <div className="h-10 flex items-center justify-center bg-amber-600 rounded-xl text-sm font-extrabold text-white">
                    ₹{dayTotals[di].toLocaleString("en-IN")}
                  </div>
                </div>
              </div>

              {/* ── Activities ── */}
              {day.activities.map((act, ai) => (
                <div key={act.id} className={ai > 0 ? "pt-4 border-t border-slate-100" : ""}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Activity {ai + 1}</span>
                    {day.activities.length > 1 && <RemoveBtn onClick={() => removeAct(day.id, act.id)} />}
                  </div>
                  <FieldGrid cols={2}>
                    <div>
                      <Label>Attraction / Activity</Label>
                      {/* ── Searchable dropdown + Add/Edit (HotelTab jaisa) ── */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <SightseeingSearchDropdown
                            value={act.attraction}
                            onSelect={(item) => handleAttractionSelect(day.id, act.id, item)}
                            allItems={allItems}
                            loading={itemsLoading}
                            defaultCity={dayCity}
                            placeholder={dayCity ? `Search attractions in ${dayCity}...` : "Type to search attractions..."}
                          />
                        </div>
                        {/* ➕ Add new sightseeing */}
                        <button type="button" onClick={() => openAddModal(day.id, act.id)} title="Add new attraction"
                          className="flex-shrink-0 w-9 sm:w-10 h-10 flex items-center justify-center rounded-xl border border-blue-500 text-blue-600 hover:bg-blue-600 hover:text-white transition shadow-sm">
                          <Plus size={16} strokeWidth={2.5} />
                        </button>
                        {/* ✏️ Edit selected sightseeing */}
                        <button type="button" onClick={() => openEditModal(day.id, act.id, act)} title="Edit selected attraction"
                          disabled={!act.attraction}
                          className="flex-shrink-0 w-9 sm:w-10 h-10 flex items-center justify-center rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">
                          <Pencil size={15} />
                        </button>
                      </div>
                    </div>
                    <div><Label>Start Time</Label><Input type="time" value={act.startTime} onChange={e => updateAct(day.id, act.id, "startTime", e.target.value)} /></div>
                  </FieldGrid>

                  {/* ── Attraction image preview (select hone par) ── */}
                  {act.imagePath && (
                    <div className="mt-3 flex items-center gap-3 p-2.5 bg-blue-50 rounded-xl border border-blue-100">
                      <img src={act.imagePath} alt={act.attraction}
                        className="w-20 h-16 rounded-lg object-cover flex-shrink-0 border border-blue-200 shadow-sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">{act.attraction}</p>
                        {act.city && (
                          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                            <MapPin size={10} className="text-rose-400" /> {act.city}
                          </p>
                        )}
                        <span className="inline-block mt-1 text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                          ✓ From Sightseeing Master
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="mt-3"><Label>Description</Label>
                    <Textarea value={act.description} onChange={e => updateAct(day.id, act.id, "description", e.target.value)} rows={2} placeholder="Describe this activity..." />
                  </div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Meals Included</Label>
                      <div className="flex gap-2 mt-1.5 flex-wrap">
                        {MEALS_OPT.map(m => (
                          <button key={m} type="button" onClick={() => toggleMeal(day.id, act.id, m)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5
                            ${act.meals.includes(m) ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-slate-200 text-slate-600 hover:border-blue-300"}`}>
                            {m === "Breakfast" && <Coffee size={11} />}{m === "Lunch" && <Utensils size={11} />}{m === "Dinner" && <Moon size={11} />}{m}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label>Daily Transfer</Label>
                      <div className="flex gap-2 mt-1.5 flex-wrap">
                        {TRANSFER.map(t => (
                          <button key={t} type="button" onClick={() => updateAct(day.id, act.id, "transfer", t)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all
                            ${act.transfer === t ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-slate-200 text-slate-600 hover:border-blue-300"}`}>{t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div className="pt-3 border-t border-slate-100">
                <AddBtn onClick={() => addAct(day.id)} label="Add Activity" />
              </div>
            </div>
          </DashCard>
        );
      })}

      {included && (
        <>
          <button onClick={addDay} type="button"
            className="w-full py-3 border-2 border-dashed border-slate-300 hover:border-amber-400 hover:bg-amber-50/40 text-slate-500 hover:text-amber-600 text-sm font-bold rounded-2xl transition-all flex items-center justify-center gap-2">
            <Plus size={16} strokeWidth={2.5} /> Add Day
          </button>
          <div className="flex items-center justify-between p-4 rounded-2xl"
            style={{ background: "linear-gradient(135deg,#D97706,#92400E)" }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <IndianRupee size={18} className="text-white" />
              </div>
              <div>
                <p className="text-[10px] text-amber-200 font-semibold uppercase tracking-wider">Sightseeing Total</p>
                <p className="text-[11px] text-amber-300">{days.length} day{days.length > 1 ? "s" : ""}</p>
              </div>
            </div>
            <p className="text-2xl font-extrabold text-white">₹{sightseeingTotal.toLocaleString("en-IN")}</p>
          </div>
        </>
      )}

      {/* ── Add/Edit Sightseeing Modal ── */}
      <SightseeingFormModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingItem(null); }}
        editingItem={editingItem}
        onSaved={handleModalSaved}
      />
    </div>
  );
}