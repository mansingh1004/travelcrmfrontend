// import { useState, useMemo, useEffect } from "react";
// import { Search, Plus, ChevronDown, ChevronUp, X, Star, MapPin, Phone, Globe, Upload, Hotel, Building2, Utensils, Wifi, Car, Dumbbell, Waves, ConciergeBell, PlaneTakeoff, Edit2, Trash2, Check, AlertCircle, Home, ChevronRight, Shield } from "lucide-react";
// import { hotelService, transformHotelResponse, uploadHotelImageToCloudinary } from "../api/HotelService";
// import { geographyService } from "@shared/api/geographyService";
// import { getErrorMessage } from "@shared/api/apiError";
// import { toast } from "@shared/ui/toast";

// /* ─── CONSTANTS ──────────────────────────────────────────── */
// const AMENITIES = [
//   { id: "wifi",        label: "Free WiFi",       icon: Wifi        },
//   { id: "pool",        label: "Swimming Pool",    icon: Waves       },
//   { id: "restaurant",  label: "Restaurant",       icon: Utensils    },
//   { id: "parking",     label: "Parking",          icon: Car         },
//   { id: "spa",         label: "Spa",              icon: Star        },
//   { id: "gym",         label: "Gym",              icon: Dumbbell    },
//   { id: "roomservice", label: "Room Service",     icon: ConciergeBell },
//   { id: "airport",     label: "Airport Transfer", icon: PlaneTakeoff },
// ];

// const BED_TYPES          = ["Single", "Double", "Queen", "King", "Twin", "Bunk"];
// const MEAL_PLAN_EXAMPLES = ["EP (Room Only)", "CP (Breakfast)", "MAP (Half Board)", "AP (Full Board)"];

// const emptyHotel = {
//   name: "", city: "", destinationId: "", stars: 3, rating: "",
//   address: "", contact: "", phone: "", email: "", website: "",
//   mapUrl: "", lat: "", lng: "", overview: "",
//   amenities: [], isDefault: false, roomTypes: [], mealPlans: [],
//   imagePath: "",   // ← IMAGE URL (Cloudinary se)
// };
// const emptyRoom = { name: "", size: "", occupancy: "", bedType: "King", description: "" };
// const emptyMeal = { name: "", price: "", description: "" };

// /* ─── DESIGN TOKENS ──────────────────────────────────────── */
// const STAR_COLORS = {
//   5: "from-amber-400 to-amber-500",
//   4: "from-blue-400 to-blue-500",
//   3: "from-violet-400 to-violet-500",
//   2: "from-slate-400 to-slate-500",
//   1: "from-rose-400 to-rose-500",
// };

// /* ─── SMALL UI HELPERS ───────────────────────────────────── */
// function Badge({ children, color = "blue" }) {
//   const map = {
//     blue:  "bg-blue-100 text-blue-700 border-blue-200",
//     green: "bg-emerald-100 text-emerald-700 border-emerald-200",
//     amber: "bg-amber-100 text-amber-700 border-amber-200",
//     red:   "bg-red-100 text-red-700 border-red-200",
//     cyan:  "bg-cyan-100 text-cyan-700 border-cyan-200",
//   };
//   return (
//     <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${map[color]}`}>
//       {children}
//     </span>
//   );
// }

// function StarRow({ count }) {
//   return (
//     <span className="flex gap-0.5">
//       {[1,2,3,4,5].map(i => (
//         <Star key={i} size={11}
//           className={i <= count ? "text-amber-400 fill-amber-400" : "text-slate-200 fill-slate-200"} />
//       ))}
//     </span>
//   );
// }

// function FInput({ label, required, error, className = "", ...props }) {
//   return (
//     <div className={`flex flex-col gap-1 ${className}`}>
//       {label && (
//         <label className="text-xs font-semibold text-slate-600">
//           {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
//         </label>
//       )}
//       <input
//         className={`border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all
//           ${error ? "border-red-300 bg-red-50/50 focus:ring-red-200" : "border-slate-200 bg-white hover:border-slate-300"}`}
//         {...props}
//       />
//       {error && (
//         <span className="text-xs text-red-500 flex items-center gap-1 font-medium">
//           <AlertCircle size={10} />{error}
//         </span>
//       )}
//     </div>
//   );
// }

// function FSelect({ label, required, children, error, className = "", ...props }) {
//   return (
//     <div className={`flex flex-col gap-1 ${className}`}>
//       {label && (
//         <label className="text-xs font-semibold text-slate-600">
//           {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
//         </label>
//       )}
//       <select
//         className={`border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white transition-all
//           ${error ? "border-red-300" : "border-slate-200 hover:border-slate-300"}`}
//         {...props}
//       >
//         {children}
//       </select>
//       {error && (
//         <span className="text-xs text-red-500 flex items-center gap-1 font-medium">
//           <AlertCircle size={10} />{error}
//         </span>
//       )}
//     </div>
//   );
// }

// function FTextarea({ label, className = "", ...props }) {
//   return (
//     <div className={`flex flex-col gap-1 ${className}`}>
//       {label && <label className="text-xs font-semibold text-slate-600">{label}</label>}
//       <textarea
//         className="border border-slate-200 hover:border-slate-300 rounded-xl px-3 py-2.5 text-sm
//           focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
//           bg-white resize-none transition-all"
//         rows={3}
//         {...props}
//       />
//     </div>
//   );
// }

// function SectionCard({ icon: Icon, iconBg, iconColor, title, children }) {
//   return (
//     <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
//       <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
//         <div className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>
//           <Icon size={14} className={iconColor} />
//         </div>
//         <p className="text-[13px] font-bold text-slate-700">{title}</p>
//       </div>
//       <div className="p-4 sm:p-5">{children}</div>
//     </div>
//   );
// }

// function NestedModal({ title, subtitle, icon: Icon, iconBg, onClose, children }) {
//   return (
//     <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
//       style={{ background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)" }}>
//       <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col"
//         style={{ animation: "slideUp .25s ease both", maxHeight: "92vh" }}>
//         <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
//           <div className="flex items-center gap-3">
//             {Icon && (
//               <div className={`w-8 h-8 rounded-xl ${iconBg || "bg-blue-100"} flex items-center justify-center flex-shrink-0`}>
//                 <Icon size={15} className="text-blue-600" />
//               </div>
//             )}
//             <div>
//               <h3 className="font-bold text-slate-800 text-[15px]">{title}</h3>
//               {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
//             </div>
//           </div>
//           <button onClick={onClose}
//             className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all">
//             <X size={15} />
//           </button>
//         </div>
//         <div className="p-5 overflow-y-auto flex-1">{children}</div>
//       </div>
//     </div>
//   );
// }

// /* ─── MAIN COMPONENT ─────────────────────────────────────── */
// export default function HotelMaster() {
//   const [destinations,     setDestinations]     = useState([]);
//   const [loading,          setLoading]          = useState(true);
//   const [apiError,         setApiError]         = useState("");
//   const [formCountries,    setFormCountries]    = useState([]);
//   const [formCountryId,    setFormCountryId]    = useState("");
//   const [formDestinations, setFormDestinations] = useState([]);
//   const [formCities,       setFormCities]       = useState([]);
//   const [loadingFormDest,  setLoadingFormDest]  = useState(false);
//   const [loadingFormCity,  setLoadingFormCity]  = useState(false);
//   const [search,           setSearch]           = useState("");
//   const [filterDest,       setFilterDest]       = useState("");
//   const [filterCity,       setFilterCity]       = useState("");
//   const [filterStar,       setFilterStar]       = useState("");
//   const [expanded,         setExpanded]         = useState({});
//   const [showModal,        setShowModal]        = useState(false);
//   const [editingHotel,     setEditingHotel]     = useState(null);
//   const [form,             setForm]             = useState(emptyHotel);
//   const [errors,           setErrors]           = useState({});
//   const [saving,           setSaving]           = useState(false);
//   const [saveError,        setSaveError]        = useState("");
//   const [roomModal,        setRoomModal]        = useState(false);
//   const [mealModal,        setMealModal]        = useState(false);
//   const [roomForm,         setRoomForm]         = useState(emptyRoom);
//   const [mealForm,         setMealForm]         = useState(emptyMeal);
//   const [editRoomIdx,      setEditRoomIdx]      = useState(null);
//   const [editMealIdx,      setEditMealIdx]      = useState(null);
//   const [roomErrors,       setRoomErrors]       = useState({});
//   const [mealErrors,       setMealErrors]       = useState({});
//   const [roomSaving,       setRoomSaving]       = useState(false);
//   const [mealSaving,       setMealSaving]       = useState(false);
//   const [,                 setHotelImageFile]   = useState(null);
//   const [roomImageFiles,   setRoomImageFiles]   = useState(null);
//   const [imageUploading,   setImageUploading]   = useState(false);  // ← NEW
//   // Mobile modal tab — "info" ya "rooms"
//   const [mobileTab,        setMobileTab]        = useState("info");

//   // ── Image upload handler (backend-proxied) ──
//   const handleHotelImageUpload = async (e) => {
//     const file = e.target.files?.[0];
//     if (!file) return;
//     if (!file.type.match("image.*")) {
//       setSaveError("Please select a valid image file.");
//       return;
//     }
//     setHotelImageFile(file);
//     setImageUploading(true);
//     setSaveError("");
//     try {
//       const secureUrl = await uploadHotelImageToCloudinary(file);
//       setForm(f => ({ ...f, imagePath: secureUrl }));   // form mein save
//     } catch (err) {
//       console.error("Image upload failed:", err);
//       setSaveError(getErrorMessage(err, "Image upload failed."));
//       setHotelImageFile(null);
//     } finally {
//       setImageUploading(false);
//     }
//   };

//   useEffect(() => {
//     (async () => {
//       try {
//         // 1. Fetch all hotels (flat list)
//         const res = await hotelService.getAllHotels();
//         const raw  = res.data?.data ?? res.data;
//         const list = Array.isArray(raw)
//           ? raw
//           : Array.isArray(raw?.content)
//           ? raw.content
//           : [];

//         console.log("Hotels flat list:", list);

//         // 2. Fetch all destinations to get names
//         let allDestinations = [];
//         try {
//           allDestinations = await geographyService.getAllDestinations();
//         } catch { allDestinations = []; }

//         // Build destinationId → name map
//         const destNameMap = new Map();
//         allDestinations.forEach(d => destNameMap.set(String(d.id), d.name));

//         // 3. Group hotels by destinationId
//         const destMap = new Map();
//         list.forEach(hotel => {
//           const dId   = String(hotel.destinationId ?? hotel.destination?.id ?? "unknown");
//           const dName = destNameMap.get(dId)
//             ?? hotel.destinationName
//             ?? hotel.destination?.name
//             ?? `Destination ${dId}`;

//           if (!destMap.has(dId)) {
//             destMap.set(dId, { id: dId, name: dName, hotels: [] });
//           }
//           destMap.get(dId).hotels.push(hotel);
//         });

//         const grouped = Array.from(destMap.values());
//         console.log("Grouped destinations:", grouped);
//         setDestinations(grouped);
//       } catch (err) {
//         console.error("Hotels fetch error:", err);
//         setDestinations([]);
//         setApiError("Could not load hotels. Please try again.");
//       } finally {
//         setLoading(false);
//       }
//     })();
//   }, []);

//   useEffect(() => {
//     (async () => {
//       try { setFormCountries(await geographyService.getCountries()); }
//       catch { setFormCountries([]); }
//     })();
//   }, []);

//   const loadFormDestinations = async (countryId) => {
//     setFormDestinations([]); setFormCities([]);
//     if (!countryId) return;
//     setLoadingFormDest(true);
//     try { setFormDestinations(await geographyService.getDestinationsByCountry(countryId)); }
//     catch { setFormDestinations([]); }
//     finally { setLoadingFormDest(false); }
//   };

//   const loadFormCities = async (destinationId) => {
//     setFormCities([]);
//     if (!destinationId) return;
//     setLoadingFormCity(true);
//     try { setFormCities(await geographyService.getCitiesByDestination(destinationId)); }
//     catch { setFormCities([]); }
//     finally { setLoadingFormCity(false); }
//   };

//   const handleFormCountryChange = (countryId) => {
//     setFormCountryId(countryId);
//     setForm(f => ({ ...f, destinationId: "", city: "" }));
//     loadFormDestinations(countryId);
//   };

//   const handleFormDestinationChange = (destinationId) => {
//     setForm(f => ({ ...f, destinationId, city: "" }));
//     loadFormCities(destinationId);
//   };

//   const prefillCascade = async (destinationId) => {
//     setFormCountryId(""); setFormDestinations([]); setFormCities([]);
//     if (!destinationId) return;
//     try {
//       const dest = await geographyService.getDestinationById(destinationId);
//       if (dest?.countryId != null) {
//         setFormCountryId(String(dest.countryId));
//         setLoadingFormDest(true);
//         try { setFormDestinations(await geographyService.getDestinationsByCountry(dest.countryId)); }
//         finally { setLoadingFormDest(false); }
//       }
//       setLoadingFormCity(true);
//       try { setFormCities(await geographyService.getCitiesByDestination(destinationId)); }
//       finally { setLoadingFormCity(false); }
//     } catch { /* city load is best-effort */ }
//   };

//   const resetCascade = () => {
//     setFormCountryId(""); setFormDestinations([]); setFormCities([]);
//     setLoadingFormDest(false); setLoadingFormCity(false);
//   };

//   const allCities = useMemo(
//     () => [...new Set(
//       (Array.isArray(destinations) ? destinations : [])
//         .flatMap(d => d?.hotels?.map(h => h?.city).filter(Boolean) ?? [])
//     )],
//     [destinations]
//   );

//   const filtered = useMemo(() => (Array.isArray(destinations) ? destinations : [])
//     .filter(d => {
//       if (!d) return false;
//       if (filterDest && d.id !== parseInt(filterDest)) return false;
//       const hotels = (d.hotels || []).filter(h => {
//         if (!h) return false;
//         if (filterCity && h.city !== filterCity) return false;
//         if (filterStar && h.stars !== parseInt(filterStar)) return false;
//         if (search && !h.name?.toLowerCase().includes(search.toLowerCase()) &&
//             !d.name?.toLowerCase().includes(search.toLowerCase())) return false;
//         return true;
//       });
//       return hotels.length > 0 || (!filterCity && !filterStar && !search);
//     })
//     .map(d => ({
//       ...d,
//       hotels: (d.hotels || []).filter(h => {
//         if (!h) return false;
//         if (filterCity && h.city !== filterCity) return false;
//         if (filterStar && h.stars !== parseInt(filterStar)) return false;
//         if (search && !h.name?.toLowerCase().includes(search.toLowerCase()) &&
//             !d.name?.toLowerCase().includes(search.toLowerCase())) return false;
//         return true;
//       }),
//     })),
//     [destinations, search, filterDest, filterCity, filterStar]
//   );

//   const openAdd = () => {
//     setEditingHotel(null); setForm(emptyHotel); setErrors({});
//     setSaveError(""); setHotelImageFile(null); resetCascade();
//     setMobileTab("info");
//     setShowModal(true);
//   };

//   const openAddForDestination = (destId) => {
//     setEditingHotel(null);
//     setForm({ ...emptyHotel, destinationId: destId != null ? String(destId) : "" });
//     setErrors({}); setSaveError(""); setHotelImageFile(null);
//     prefillCascade(destId); setShowModal(true);
//   };

//   const openEdit = (hotel, destId) => {
//     setEditingHotel({ ...hotel, destinationId: destId });
//     setForm(transformHotelResponse({ ...hotel, destinationId: destId }));
//     setErrors({}); setSaveError(""); setHotelImageFile(null);
//     prefillCascade(destId);
//     setMobileTab("info");
//     setShowModal(true);
//   };

//   const closeModal = () => { setShowModal(false); setEditingHotel(null); setHotelImageFile(null); };

//   const validate = () => {
//     const e = {};
//     if (!form.destinationId) e.destinationId = "Required";
//     if (!form.city)          e.city          = "Required";
//     if (!form.name.trim())   e.name          = "Required";
//     if (!form.stars)         e.stars         = "Required";
//     setErrors(e);
//     return Object.keys(e).length === 0;
//   };

//   const handleSave = async () => {
//     if (!validate()) return;
//     setSaving(true); setSaveError("");
//     try {
//       let savedHotel;
//       if (editingHotel) {
//         const res = await hotelService.updateHotel(editingHotel.id, form);
//         savedHotel = res.data?.data ?? res.data;
//       } else {
//         const res = await hotelService.createHotel(form);
//         savedHotel = res.data?.data ?? res.data;
//       }
//       // ── Image ab Cloudinary se upload hoti hai — form.imagePath mein already hai ──
//       // (purana uploadHotelImage call hata diya)
//       if (form.isDefault && savedHotel?.id) await hotelService.setDefaultHotel(savedHotel.id, form.destinationId);

//       // Refetch latest data from backend after save
//       try {
//         const refreshRes = await hotelService.getAllHotels();
//         const raw2   = refreshRes.data?.data ?? refreshRes.data;
//         const list2  = Array.isArray(raw2) ? raw2
//           : Array.isArray(raw2?.content) ? raw2.content : [];
//         let allDest2 = [];
//         try { allDest2 = await geographyService.getAllDestinations(); } catch { /* destination list is best-effort */ }
//         const dNameMap2 = new Map();
//         allDest2.forEach(d => dNameMap2.set(String(d.id), d.name));
//         const destMap2 = new Map();
//         list2.forEach(hotel => {
//           const dId   = String(hotel.destinationId ?? hotel.destination?.id ?? "unknown");
//           const dName = dNameMap2.get(dId) ?? hotel.destinationName ?? hotel.destination?.name ?? `Destination ${dId}`;
//           if (!destMap2.has(dId)) {
//             destMap2.set(dId, { id: dId, name: dName, hotels: [] });
//           }
//           destMap2.get(dId).hotels.push(hotel);
//         });
//         setDestinations(Array.from(destMap2.values()));
//       } catch {
//         const destId = parseInt(form.destinationId);
//         setDestinations(prev => prev.map(d => {
//           if (d.id !== destId) return d;
//           const newHotel = { ...form, id: savedHotel?.id ?? (editingHotel ? editingHotel.id : Date.now()), stars: parseInt(form.stars) };
//           if (editingHotel) return { ...d, hotels: d.hotels.map(h => h.id === editingHotel.id ? newHotel : h) };
//           return { ...d, hotels: [...d.hotels, newHotel] };
//         }));
//       }
//       closeModal();
//     } catch (err) {
//       setSaveError(err?.response?.data?.message || "Failed to save hotel. Please try again.");
//     } finally {
//       setSaving(false);
//     }
//   };

//   const handleDelete = async (destId, hotelId) => {
//     if (!window.confirm("Delete this hotel?")) return;
//     try {
//       await hotelService.deleteHotel(hotelId);
//       setDestinations(prev => prev.map(d => d.id === destId ? { ...d, hotels: (d.hotels || []).filter(h => h.id !== hotelId) } : d));
//     } catch (err) {
//       toast.error(getErrorMessage(err, "Failed to delete hotel."));
//     }
//   };

//   const openAddRoom  = () => { setEditRoomIdx(null); setRoomForm(emptyRoom); setRoomErrors({}); setRoomImageFiles(null); setRoomModal(true); };
//   const openEditRoom = (idx) => { setEditRoomIdx(idx); setRoomForm({ ...form.roomTypes[idx] }); setRoomErrors({}); setRoomImageFiles(null); setRoomModal(true); };

//   const saveRoom = async () => {
//     const e = {};
//     if (!roomForm.name.trim()) e.name = "Required";
//     if (!roomForm.occupancy)   e.occupancy = "Required";
//     setRoomErrors(e);
//     if (Object.keys(e).length) return;
//     setRoomSaving(true);
//     try {
//       const hotelId = editingHotel?.id;
//       if (hotelId) {
//         if (editRoomIdx !== null) {
//           await hotelService.updateRoomType(hotelId, form.roomTypes[editRoomIdx].id, roomForm);
//         } else {
//           const res = await hotelService.addRoomType(hotelId, roomForm);
//           if (roomImageFiles && res.data?.id) await hotelService.uploadRoomImages(hotelId, res.data.id, roomImageFiles);
//         }
//       }
//       const rooms = [...(form.roomTypes || [])];
//       if (editRoomIdx !== null) { rooms[editRoomIdx] = { ...roomForm, id: rooms[editRoomIdx].id }; }
//       else { rooms.push({ ...roomForm, id: Date.now() }); }
//       setForm(f => ({ ...f, roomTypes: rooms }));
//       setRoomModal(false);
//     } catch (err) {
//       setRoomErrors({ api: err?.response?.data?.message || "Failed to save room type." });
//     } finally { setRoomSaving(false); }
//   };

//   const deleteRoom = async (idx) => {
//     const hotelId = editingHotel?.id;
//     const roomId  = form.roomTypes[idx]?.id;
//     if (hotelId && roomId) {
//       try { await hotelService.deleteRoomType(hotelId, roomId); }
//       catch (err) { toast.error(getErrorMessage(err, "Failed to delete.")); return; }
//     }
//     setForm(f => ({ ...f, roomTypes: f.roomTypes.filter((_, i) => i !== idx) }));
//   };

//   const openAddMeal  = () => { setEditMealIdx(null); setMealForm(emptyMeal); setMealErrors({}); setMealModal(true); };
//   const openEditMeal = (idx) => { setEditMealIdx(idx); setMealForm({ ...form.mealPlans[idx] }); setMealErrors({}); setMealModal(true); };

//   const saveMeal = async () => {
//     const e = {};
//     if (!mealForm.name.trim())               e.name  = "Required";
//     if (!mealForm.price && mealForm.price !== 0) e.price = "Required";
//     setMealErrors(e);
//     if (Object.keys(e).length) return;
//     setMealSaving(true);
//     try {
//       const hotelId = editingHotel?.id;
//       if (hotelId) {
//         if (editMealIdx !== null) { await hotelService.updateMealPlan(hotelId, form.mealPlans[editMealIdx].id, mealForm); }
//         else { await hotelService.addMealPlan(hotelId, mealForm); }
//       }
//       const meals = [...(form.mealPlans || [])];
//       if (editMealIdx !== null) { meals[editMealIdx] = { ...mealForm, id: meals[editMealIdx].id }; }
//       else { meals.push({ ...mealForm, id: Date.now() }); }
//       setForm(f => ({ ...f, mealPlans: meals }));
//       setMealModal(false);
//     } catch (err) {
//       setMealErrors({ api: err?.response?.data?.message || "Failed to save meal plan." });
//     } finally { setMealSaving(false); }
//   };

//   const deleteMeal = async (idx) => {
//     const hotelId = editingHotel?.id;
//     const mealId  = form.mealPlans[idx]?.id;
//     if (hotelId && mealId) {
//       try { await hotelService.deleteMealPlan(hotelId, mealId); }
//       catch (err) { toast.error(getErrorMessage(err, "Failed to delete.")); return; }
//     }
//     setForm(f => ({ ...f, mealPlans: f.mealPlans.filter((_, i) => i !== idx) }));
//   };

//   const toggleAmenity = (id) => setForm(f => ({
//     ...f,
//     amenities: f.amenities.includes(id) ? f.amenities.filter(a => a !== id) : [...f.amenities, id],
//   }));

//   const totalHotels = (Array.isArray(destinations) ? destinations : [])
//     .reduce((acc, d) => acc + (d?.hotels?.length || 0), 0);

//   /* ─── RENDER ──────────────────────────────────────────── */
//   return (
//     <div className="min-h-screen font-sans"
//       style={{
//         fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
//         background: "linear-gradient(135deg, #f8fafc 0%, #eff6ff20 50%, #f8fafc 100%)",
//       }}>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
//         @keyframes fadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
//         @keyframes slideUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
//         @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
//         .fade-up { animation: fadeUp .4s ease both; }
//         .hotel-card { transition: box-shadow .2s, transform .2s; }
//         .hotel-card:hover { box-shadow: 0 8px 30px rgba(15,23,42,0.08); transform: translateY(-1px); }
//         .amenity-btn { transition: all .15s; }
//         .amenity-btn:hover { transform: translateY(-1px); }
//         html, body { overflow-x: hidden; }
//         .modal-scroll { -webkit-overflow-scrolling: touch; }
//       `}</style>

//       {/* ── API Error Banner ── */}
//       {apiError && (
//         <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-2.5 flex items-center gap-2 text-sm text-amber-700">
//           <AlertCircle size={14} className="flex-shrink-0" /> {apiError}
//           <button onClick={() => setApiError("")} className="ml-auto p-1 hover:bg-amber-100 rounded-lg transition"><X size={13} /></button>
//         </div>
//       )}

//       {/* ── Page Header ── */}
//       <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
//         <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-4">
//           <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">

//             <div className="flex items-center gap-4">
//               <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-white shadow-lg shadow-blue-200">
//                 <Hotel size={20} strokeWidth={2.2} />
//               </div>
//               <div>
//                 <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-0.5">
//                   <Home size={11} />
//                   <ChevronRight size={9} className="text-slate-300" />
//                   <span className="text-blue-600 font-bold">Hotel Master</span>
//                 </div>
//                 <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">Hotel Master</h1>
//                 <p className="text-xs text-slate-400 font-medium hidden sm:block">
//                   {destinations.length} destinations · {totalHotels} hotels
//                 </p>
//               </div>
//             </div>

//             <button onClick={openAdd}
//               className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800
//                 text-white px-4 sm:px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95
//                 shadow-md shadow-blue-200 hover:shadow-lg">
//               <Plus size={16} strokeWidth={2.5} /> Add New Hotel
//             </button>
//           </div>
//         </div>
//       </div>

//       <div className="max-w-screen-xl mx-auto px-3 sm:px-6 py-4 sm:py-5 space-y-3 sm:space-y-5">

//         {/* ── Filters ── */}
//         <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-3 sm:p-4 fade-up">
//           <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
//             <div className="relative flex-1">
//               <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
//               <input value={search} onChange={e => setSearch(e.target.value)}
//                 placeholder="Search hotels or destinations..."
//                 className="w-full border border-slate-200 hover:border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm
//                   focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all bg-white" />
//             </div>
//             {[
//               { value: filterDest, onChange: e => setFilterDest(e.target.value), placeholder: "All Destinations", options: destinations.map(d => ({ v: d.id, l: d.name })) },
//               { value: filterCity, onChange: e => setFilterCity(e.target.value), placeholder: "All Cities",       options: allCities.map(c => ({ v: c, l: c })) },
//               { value: filterStar, onChange: e => setFilterStar(e.target.value), placeholder: "All Stars",        options: [5,4,3,2,1].map(s => ({ v: s, l: `${s} Star` })) },
//             ].map((sel, i) => (
//               <select key={i} value={sel.value} onChange={sel.onChange}
//                 className="border border-slate-200 hover:border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white
//                   focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all min-w-[130px]">
//                 <option value="">{sel.placeholder}</option>
//                 {sel.options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
//               </select>
//             ))}
//             {(search || filterDest || filterCity || filterStar) && (
//               <button onClick={() => { setSearch(""); setFilterDest(""); setFilterCity(""); setFilterStar(""); }}
//                 className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold text-slate-500 hover:text-red-500
//                   bg-slate-50 hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-xl transition-all whitespace-nowrap">
//                 <X size={12} /> Clear
//               </button>
//             )}
//           </div>
//         </div>

//         {/* ── Loading skeleton ── */}
//         {loading && (
//           <div className="space-y-3">
//             {[1,2,3].map(i => (
//               <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse">
//                 <div className="flex items-center gap-3">
//                   <div className="w-11 h-11 bg-slate-200 rounded-2xl" />
//                   <div className="flex-1 space-y-2">
//                     <div className="h-4 bg-slate-200 rounded-lg w-36" />
//                     <div className="h-3 bg-slate-100 rounded-lg w-24" />
//                   </div>
//                 </div>
//               </div>
//             ))}
//           </div>
//         )}

//         {/* ── Destination Accordion ── */}
//         {!loading && (
//           <div className="space-y-3">
//             {filtered.length === 0 ? (
//               <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-14 text-center fade-up">
//                 <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
//                   <Hotel size={28} className="text-slate-300" />
//                 </div>
//                 <p className="text-slate-600 font-bold text-base mb-1">No hotels found</p>
//                 <p className="text-slate-400 text-sm">Try adjusting your search or filters</p>
//               </div>
//             ) : filtered.map((dest, di) => {
//               const isOpen       = expanded[dest.id];
//               const defaultHotel = dest.hotels.find(h => h.isDefault);
//               const uniqueCities = [...new Set(dest.hotels.map(h => h.city))];
//               const maxStars     = dest.hotels.reduce((max, h) => Math.max(max, h.stars || 0), 0);
//               return (
//                 <div key={dest.id}
//                   className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden hotel-card fade-up"
//                   style={{ animationDelay: `${di * 40}ms` }}>

//                   {/* Destination Header */}
//                   <div
//                     className="flex flex-col sm:flex-row sm:items-center justify-between px-3 sm:px-6 py-3 sm:py-4 gap-2 sm:gap-3 cursor-pointer
//                       hover:bg-slate-50/60 transition-colors"
//                     onClick={() => setExpanded(e => ({ ...e, [dest.id]: !e[dest.id] }))}
//                   >
//                     <div className="flex items-center gap-3 flex-1 min-w-0">
//                       <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-100
//                         flex items-center justify-center flex-shrink-0 shadow-sm">
//                         <MapPin size={18} className="text-blue-600" />
//                       </div>
//                       <div className="min-w-0">
//                         <div className="flex items-center gap-2 flex-wrap">
//                           <h2 className="font-extrabold text-slate-800 text-[15px]">{dest.name}</h2>
//                           {defaultHotel && (
//                             <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
//                               ✓ Default: {defaultHotel.name}
//                             </span>
//                           )}
//                           {maxStars > 0 && (
//                             <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white bg-gradient-to-r ${STAR_COLORS[maxStars] || "from-slate-400 to-slate-500"}`}>
//                               Up to {maxStars}★
//                             </span>
//                           )}
//                         </div>
//                         <div className="flex items-center gap-3 mt-1 flex-wrap">
//                           <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
//                             <Hotel size={11} className="text-blue-400" />
//                             {dest.hotels.length} {dest.hotels.length === 1 ? "Hotel" : "Hotels"}
//                           </span>
//                           <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
//                             <Building2 size={11} className="text-violet-400" />
//                             {uniqueCities.length} {uniqueCities.length === 1 ? "City" : "Cities"}
//                           </span>
//                           {uniqueCities.slice(0, 3).map(c => (
//                             <span key={c} className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">{c}</span>
//                           ))}
//                           {uniqueCities.length > 3 && (
//                             <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">+{uniqueCities.length - 3}</span>
//                           )}
//                         </div>
//                       </div>
//                     </div>

//                     <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
//                       <button onClick={() => openAddForDestination(dest.id)}
//                         className="flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100
//                           border border-blue-200 hover:border-blue-300 px-3 py-1.5 rounded-xl transition-all">
//                         <Plus size={12} strokeWidth={2.5} /> Add Hotel
//                       </button>
//                       <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-slate-400
//                         transition-all ${isOpen ? "bg-blue-50 text-blue-500 rotate-0" : "bg-slate-50"}`}>
//                         {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
//                       </div>
//                     </div>
//                   </div>

//                   {/* Hotels List */}
//                   {isOpen && (
//                     <div className="border-t border-slate-100">
//                       {dest.hotels.length === 0 ? (
//                         <div className="py-10 text-center">
//                           <Hotel size={28} className="mx-auto text-slate-300 mb-2" />
//                           <p className="text-slate-400 text-sm font-medium">No hotels yet.</p>
//                           <button onClick={() => openAddForDestination(dest.id)}
//                             className="mt-3 text-xs font-bold text-blue-600 hover:text-blue-700 underline underline-offset-2">
//                             Add the first hotel
//                           </button>
//                         </div>
//                       ) : (
//                         <div className="divide-y divide-slate-50">
//                           {dest.hotels.map((hotel, hi) => (
//                             <div key={hotel.id}
//                               className="px-3 sm:px-6 py-3 sm:py-4 hover:bg-blue-50/20 transition-colors group"
//                               style={{ animation: `fadeIn .2s ease ${hi * 30}ms both` }}>
//                               <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">

//                                 {/* Hotel Info */}
//                                 <div className="flex items-start gap-3 min-w-0">
//                                   {/* Hotel avatar — IMAGE agar hai toh dikhao, warna icon */}
//                                   {hotel.imagePath || hotel.imageUrl ? (
//                                     <img
//                                       src={hotel.imagePath || hotel.imageUrl}
//                                       alt={hotel.name}
//                                       className="w-12 h-12 rounded-xl object-cover flex-shrink-0 mt-0.5 border border-slate-200 shadow-sm"
//                                     />
//                                   ) : (
//                                     <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${STAR_COLORS[hotel.stars] || "from-slate-400 to-slate-500"}
//                                       flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm`}>
//                                       <Hotel size={16} className="text-white" strokeWidth={2} />
//                                     </div>
//                                   )}
//                                   <div className="min-w-0 flex-1">
//                                     <div className="flex items-center gap-2 flex-wrap">
//                                       <span className="font-bold text-slate-800 text-[14px]">{hotel.name}</span>
//                                       {hotel.isDefault && <Badge color="cyan">Default</Badge>}
//                                       <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white
//                                         bg-gradient-to-r ${STAR_COLORS[hotel.stars] || "from-slate-400 to-slate-500"}`}>
//                                         {hotel.stars}★
//                                       </span>
//                                     </div>
//                                     <div className="flex items-center gap-3 mt-1 flex-wrap">
//                                       <span className="text-xs text-slate-500 flex items-center gap-1">
//                                         <MapPin size={10} className="text-rose-400" />{hotel.city}
//                                       </span>
//                                       {hotel.phone && (
//                                         <span className="text-xs text-slate-500 flex items-center gap-1">
//                                           <Phone size={10} className="text-emerald-400" />{hotel.phone}
//                                         </span>
//                                       )}
//                                       <StarRow count={hotel.stars} />
//                                     </div>
//                                     {hotel.amenities?.length > 0 && (
//                                       <div className="flex gap-1.5 mt-2 flex-wrap">
//                                         {hotel.amenities.slice(0, 5).map(a => {
//                                           const am = AMENITIES.find(x => x.id === a);
//                                           return am ? (
//                                             <span key={a} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
//                                               {am.label}
//                                             </span>
//                                           ) : null;
//                                         })}
//                                         {hotel.amenities.length > 5 && (
//                                           <span className="text-[10px] bg-blue-50 text-blue-500 px-2 py-0.5 rounded-full font-medium">
//                                             +{hotel.amenities.length - 5} more
//                                           </span>
//                                         )}
//                                       </div>
//                                     )}
//                                   </div>
//                                 </div>

//                                 <div className="flex items-center gap-1.5 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
//                                   <button onClick={() => openEdit(hotel, dest.id)}
//                                     className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100
//                                       text-blue-600 text-xs font-bold border border-blue-200 hover:border-blue-300 transition-all">
//                                     <Edit2 size={12} /> Edit
//                                   </button>
//                                   <button onClick={() => handleDelete(dest.id, hotel.id)}
//                                     className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100
//                                       text-rose-500 text-xs font-bold border border-rose-200 hover:border-rose-300 transition-all">
//                                     <Trash2 size={12} /> Delete
//                                   </button>
//                                 </div>
//                               </div>
//                             </div>
//                           ))}
//                         </div>
//                       )}
//                     </div>
//                   )}
//                 </div>
//               );
//             })}
//           </div>
//         )}
//       </div>

//       {/* ═══════════════════════════════════════════════════ */}
//       {/* MAIN HOTEL MODAL                                   */}
//       {/* ═══════════════════════════════════════════════════ */}
//       {showModal && (
//         <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
//           style={{ background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)" }}
//           onClick={e => e.target === e.currentTarget && closeModal()}>
//           <div className="bg-white w-full sm:rounded-2xl shadow-2xl flex flex-col"
//             style={{ maxWidth: 1280, maxHeight: "100dvh", minHeight: "60vh", animation: "slideUp .25s ease both" }}>

//             {/* Modal Header */}
//             <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4
//               bg-gradient-to-r from-blue-700 via-blue-600 to-blue-500
//               sm:rounded-t-2xl flex-shrink-0 shadow-sm">
//               <div className="flex items-center gap-3 min-w-0">
//                 <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0 ring-1 ring-white/30">
//                   <Hotel size={18} className="text-white" />
//                 </div>
//                 <div className="min-w-0">
//                   <h2 className="font-extrabold text-white text-[16px] sm:text-lg leading-tight">
//                     {editingHotel ? `Edit — ${editingHotel.name || "Hotel"}` : "Add New Hotel"}
//                   </h2>
//                   <p className="text-[11px] text-blue-200 font-medium hidden sm:block">
//                     Fill in the details below · Fields marked * are required
//                   </p>
//                 </div>
//               </div>
//               <div className="flex items-center gap-2 flex-shrink-0">
//                 <button onClick={handleSave} disabled={saving || imageUploading}
//                   className="flex items-center gap-2 bg-white hover:bg-blue-50 text-blue-700 font-bold
//                     px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-sm transition-all active:scale-95 shadow-sm disabled:opacity-60">
//                   {saving
//                     ? <><div className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /><span className="hidden sm:inline">Saving...</span></>
//                     : <><Check size={15} strokeWidth={2.5} /><span className="hidden sm:inline">Save Hotel</span></>
//                   }
//                 </button>
//                 <button onClick={closeModal}
//                   className="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-all">
//                   <X size={18} />
//                 </button>
//               </div>
//             </div>

//             {/* Save error */}
//             {saveError && (
//               <div className="mx-4 sm:mx-6 mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 flex items-center gap-2 flex-shrink-0">
//                 <AlertCircle size={14} className="flex-shrink-0" /> {saveError}
//                 <button onClick={() => setSaveError("")} className="ml-auto"><X size={13} /></button>
//               </div>
//             )}

//             {/* Mobile Tab Switcher */}
//             <div className="flex lg:hidden border-b border-slate-100 bg-white flex-shrink-0">
//               <button
//                 onClick={() => setMobileTab("info")}
//                 className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-all
//                   ${mobileTab === "info"
//                     ? "border-blue-600 text-blue-600 bg-blue-50/40"
//                     : "border-transparent text-slate-400 hover:text-slate-600"}`}>
//                 <Hotel size={15} /> Hotel Info
//               </button>
//               <button
//                 onClick={() => setMobileTab("rooms")}
//                 className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-all
//                   ${mobileTab === "rooms"
//                     ? "border-blue-600 text-blue-600 bg-blue-50/40"
//                     : "border-transparent text-slate-400 hover:text-slate-600"}`}>
//                 <Building2 size={15} />
//                 Rooms & Meals
//                 {(form.roomTypes?.length > 0 || form.mealPlans?.length > 0) && (
//                   <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">
//                     {(form.roomTypes?.length || 0) + (form.mealPlans?.length || 0)}
//                   </span>
//                 )}
//               </button>
//             </div>

//             {/* Modal Body */}
//             <div className="flex flex-col lg:flex-row flex-1 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-100">

//               {/* ── Left: Hotel Info ── */}
//               <div className={`flex-1 min-w-0 overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-4
//                 ${mobileTab === "info" ? "block" : "hidden lg:block"}`}>

//                 {/* Basic Info */}
//                 <SectionCard icon={Hotel} iconBg="bg-blue-100" iconColor="text-blue-600" title="Basic Information">
//                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//                     <FSelect label="Country" required value={formCountryId} onChange={e => handleFormCountryChange(e.target.value)}>
//                       <option value="">{formCountries.length === 0 ? "Loading…" : "Select country"}</option>
//                       {formCountries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
//                     </FSelect>
//                     <FSelect label="Destination" required error={errors.destinationId}
//                       value={form.destinationId} onChange={e => handleFormDestinationChange(e.target.value)}
//                       disabled={!formCountryId || loadingFormDest}>
//                       <option value="">{!formCountryId ? "Select country first" : loadingFormDest ? "Loading…" : formDestinations.length === 0 ? "No destinations" : "Select destination"}</option>
//                       {formDestinations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
//                     </FSelect>
//                     <FSelect label="City" required error={errors.city}
//                       value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
//                       disabled={!form.destinationId || loadingFormCity}>
//                       <option value="">{!form.destinationId ? "Select destination first" : loadingFormCity ? "Loading…" : formCities.length === 0 ? "No cities" : "Select city"}</option>
//                       {formCities.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
//                     </FSelect>
//                     <FInput label="Hotel Name" required error={errors.name}
//                       placeholder="e.g. The Grand Palace"
//                       value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />

//                     {/* ── Image Upload — backend-proxied, with preview ── */}
//                     <div className="sm:col-span-2">
//                       <label className="text-xs font-semibold text-slate-600 block mb-1.5">
//                         Hotel Image
//                         {imageUploading && <span className="ml-2 text-blue-500 animate-pulse">Uploading...</span>}
//                       </label>

//                       {/* Preview agar image hai */}
//                       {form.imagePath && !imageUploading && (
//                         <div className="mb-3 relative inline-block w-full">
//                           <img src={form.imagePath} alt="Hotel"
//                             className="w-full max-h-52 object-cover rounded-xl border border-slate-200" />
//                           <button type="button"
//                             onClick={() => { setForm(f => ({ ...f, imagePath: "" })); setHotelImageFile(null); }}
//                             className="absolute top-2 right-2 bg-rose-500 text-white p-1.5 rounded-lg hover:bg-rose-600 shadow-md">
//                             <X size={14} />
//                           </button>
//                         </div>
//                       )}

//                       <label className={`border-2 border-dashed rounded-xl p-4 flex items-center gap-3 cursor-pointer transition-all group
//                         ${imageUploading ? "border-blue-300 bg-blue-50" : "border-slate-200 hover:border-blue-300 hover:bg-blue-50/40"}`}>
//                         <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
//                           ${form.imagePath ? "bg-blue-100" : "bg-slate-100 group-hover:bg-blue-100"}`}>
//                           {imageUploading
//                             ? <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
//                             : <Upload size={16} className={form.imagePath ? "text-blue-500" : "text-slate-400 group-hover:text-blue-500"} />
//                           }
//                         </div>
//                         <div className="min-w-0">
//                           <p className={`text-sm font-semibold truncate ${form.imagePath ? "text-blue-600" : "text-slate-400 group-hover:text-blue-500"}`}>
//                             {imageUploading ? "Uploading to cloud..." : form.imagePath ? "Change image" : "Click to upload hotel image"}
//                           </p>
//                           <p className="text-xs text-slate-400">PNG, JPG up to 10MB</p>
//                         </div>
//                         <input type="file" className="hidden" accept="image/*"
//                           disabled={imageUploading}
//                           onChange={handleHotelImageUpload} />
//                       </label>
//                     </div>

//                     <FInput label="Full Address" placeholder="Street, area, landmark..."
//                       className="sm:col-span-2"
//                       value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
//                     <FSelect label="Star Category" required error={errors.stars}
//                       value={form.stars} onChange={e => setForm(f => ({ ...f, stars: e.target.value }))}>
//                       {[5,4,3,2,1].map(s => <option key={s} value={s}>{s} Star</option>)}
//                     </FSelect>
//                     <FInput label="Review Rating" type="number" min="0" max="5" step="0.1"
//                       placeholder="e.g. 4.5 / 5.0"
//                       value={form.rating} onChange={e => setForm(f => ({ ...f, rating: e.target.value }))} />
//                   </div>

//                   {/* Default toggle */}
//                   <label htmlFor="defaultHotel"
//                     className="mt-4 flex items-center gap-3 p-3 bg-blue-50/50 border border-blue-100
//                       hover:border-blue-300 rounded-xl cursor-pointer transition-all">
//                     <input type="checkbox" id="defaultHotel" checked={form.isDefault}
//                       onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))}
//                       className="w-4 h-4 accent-blue-600 cursor-pointer" />
//                     <div>
//                       <p className="text-sm font-semibold text-slate-700">Set as default hotel</p>
//                       <p className="text-xs text-slate-400">This hotel will be auto-selected for this destination</p>
//                     </div>
//                     {form.isDefault && (
//                       <span className="ml-auto text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
//                         Active
//                       </span>
//                     )}
//                   </label>
//                 </SectionCard>

//                 {/* Contact Info */}
//                 <SectionCard icon={Phone} iconBg="bg-indigo-100" iconColor="text-indigo-600" title="Contact Information">
//                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//                     <FInput label="Contact Person" placeholder="Full name"
//                       value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} />
//                     <FInput label="Phone Number" placeholder="+91 xxxxxxxxxx"
//                       value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
//                     <FInput label="Email Address" type="email" placeholder="hotel@example.com"
//                       value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
//                     <FInput label="Website" placeholder="www.example.com"
//                       value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
//                   </div>
//                 </SectionCard>

//                 {/* Description & Amenities */}
//                 <SectionCard icon={Globe} iconBg="bg-violet-100" iconColor="text-violet-600" title="Description & Amenities">
//                   <FTextarea label="Hotel Overview"
//                     placeholder="Describe the hotel, its location, unique features..."
//                     value={form.overview} onChange={e => setForm(f => ({ ...f, overview: e.target.value }))}
//                     rows={3} />
//                   <div className="mt-4">
//                     <p className="text-xs font-semibold text-slate-600 mb-2.5">Amenities</p>
//                     <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
//                       {AMENITIES.map(a => {
//                         const Icon     = a.icon;
//                         const selected = form.amenities?.includes(a.id);
//                         return (
//                           <button key={a.id} type="button" onClick={() => toggleAmenity(a.id)}
//                             className={`amenity-btn flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all
//                               ${selected
//                                 ? "border-blue-400 bg-blue-600 text-white shadow-md shadow-blue-200"
//                                 : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50"
//                               }`}>
//                             <Icon size={13} className={selected ? "text-white" : "text-slate-400"} />
//                             <span className="truncate flex-1 text-left">{a.label}</span>
//                             {selected && <Check size={11} className="text-white flex-shrink-0" />}
//                           </button>
//                         );
//                       })}
//                     </div>
//                   </div>
//                 </SectionCard>
//               </div>

//               {/* ── Right: Rooms + Meals ── */}
//               <div className={`lg:w-[420px] xl:w-[460px] flex-shrink-0 overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-4 bg-slate-50/40
//                 ${mobileTab === "rooms" ? "block" : "hidden lg:block"}`}>

//                 {/* Room Types */}
//                 <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
//                   <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
//                     <div className="flex items-center gap-2.5">
//                       <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
//                         <Building2 size={13} className="text-blue-600" />
//                       </div>
//                       <div>
//                         <p className="text-[13px] font-bold text-slate-700">Room Types</p>
//                         <p className="text-[10px] text-slate-400">{form.roomTypes?.length || 0} added</p>
//                       </div>
//                     </div>
//                     <button onClick={openAddRoom}
//                       className="flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50
//                         hover:bg-blue-600 hover:text-white border border-blue-200 hover:border-blue-600
//                         px-3 py-1.5 rounded-xl transition-all">
//                       <Plus size={12} strokeWidth={2.5} /> Add Room
//                     </button>
//                   </div>

//                   {!form.roomTypes?.length ? (
//                     <div className="py-10 text-center">
//                       <Building2 size={28} className="mx-auto text-slate-300 mb-2" />
//                       <p className="text-xs text-slate-400 font-medium">No room types added yet</p>
//                       <button onClick={openAddRoom}
//                         className="mt-3 text-xs font-bold text-blue-500 hover:text-blue-600 underline underline-offset-2">
//                         Add first room type
//                       </button>
//                     </div>
//                   ) : (
//                     <div className="divide-y divide-slate-50">
//                       {form.roomTypes.map((r, i) => (
//                         <div key={i} className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-blue-50/30 transition-colors group">
//                           <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
//                             <Building2 size={13} className="text-blue-500" />
//                           </div>
//                           <div className="flex-1 min-w-0">
//                             <p className="text-sm font-bold text-slate-700 truncate">{r.name}</p>
//                             <p className="text-xs text-slate-400">
//                               {r.bedType} · {r.occupancy} pax
//                               {r.size && ` · ${r.size}`}
//                             </p>
//                           </div>
//                           <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
//                             <button onClick={() => openEditRoom(i)}
//                               className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-500 flex items-center justify-center transition-all">
//                               <Edit2 size={12} />
//                             </button>
//                             <button onClick={() => deleteRoom(i)}
//                               className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-400 flex items-center justify-center transition-all">
//                               <Trash2 size={12} />
//                             </button>
//                           </div>
//                         </div>
//                       ))}
//                     </div>
//                   )}
//                 </div>

//                 {/* Meal Plans */}
//                 <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
//                   <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
//                     <div className="flex items-center gap-2.5">
//                       <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
//                         <Utensils size={13} className="text-emerald-600" />
//                       </div>
//                       <div>
//                         <p className="text-[13px] font-bold text-slate-700">Meal Plans</p>
//                         <p className="text-[10px] text-slate-400">{form.mealPlans?.length || 0} added</p>
//                       </div>
//                     </div>
//                     <button onClick={openAddMeal}
//                       className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50
//                         hover:bg-emerald-600 hover:text-white border border-emerald-200 hover:border-emerald-600
//                         px-3 py-1.5 rounded-xl transition-all">
//                       <Plus size={12} strokeWidth={2.5} /> Add Plan
//                     </button>
//                   </div>

//                   {!form.mealPlans?.length ? (
//                     <div className="py-10 text-center">
//                       <Utensils size={28} className="mx-auto text-slate-300 mb-2" />
//                       <p className="text-xs text-slate-400 font-medium">No meal plans added yet</p>
//                       <button onClick={openAddMeal}
//                         className="mt-3 text-xs font-bold text-emerald-500 hover:text-emerald-600 underline underline-offset-2">
//                         Add first meal plan
//                       </button>
//                     </div>
//                   ) : (
//                     <div className="divide-y divide-slate-50">
//                       {form.mealPlans.map((m, i) => (
//                         <div key={i} className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-emerald-50/30 transition-colors group">
//                           <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
//                             <Utensils size={13} className="text-emerald-500" />
//                           </div>
//                           <div className="flex-1 min-w-0">
//                             <p className="text-sm font-bold text-slate-700 truncate">{m.name}</p>
//                             <p className="text-xs text-emerald-600 font-semibold">₹{m.price} / person</p>
//                           </div>
//                           <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
//                             <button onClick={() => openEditMeal(i)}
//                               className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-500 flex items-center justify-center transition-all">
//                               <Edit2 size={12} />
//                             </button>
//                             <button onClick={() => deleteMeal(i)}
//                               className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-400 flex items-center justify-center transition-all">
//                               <Trash2 size={12} />
//                             </button>
//                           </div>
//                         </div>
//                       ))}
//                     </div>
//                   )}
//                 </div>

//                 {/* Trust badge */}
//                 {/* <div className="flex items-center gap-2.5 p-3 bg-white border border-slate-200 rounded-xl">
//                   <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
//                     <Shield size={13} className="text-white" />
//                   </div>
//                   <p className="text-[11px] text-slate-500 font-semibold">
//                     All changes are saved securely to Tripotomize.
//                   </p>
//                 </div> */}
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* ── Room Type Modal ── */}
//       {roomModal && (
//         <NestedModal
//           title={editRoomIdx !== null ? "Edit Room Type" : "Add Room Type"}
//           subtitle="Configure room capacity, size and bed type"
//           icon={Building2}
//           iconBg="bg-blue-100"
//           onClose={() => setRoomModal(false)}
//         >
//           <div className="space-y-4">
//             {roomErrors.api && (
//               <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 flex items-center gap-2">
//                 <AlertCircle size={14} /> {roomErrors.api}
//               </div>
//             )}
//             <FInput label="Room Name" required error={roomErrors.name}
//               placeholder="e.g. Deluxe Sea View Room"
//               value={roomForm.name} onChange={e => setRoomForm(f => ({ ...f, name: e.target.value }))} />
//             <div className="grid grid-cols-2 gap-4">
//               <FInput label="Room Size" placeholder="e.g. 45 sqm"
//                 value={roomForm.size} onChange={e => setRoomForm(f => ({ ...f, size: e.target.value }))} />
//               <FInput label="Max Occupancy" required error={roomErrors.occupancy}
//                 type="number" min="1" placeholder="e.g. 2"
//                 value={roomForm.occupancy} onChange={e => setRoomForm(f => ({ ...f, occupancy: e.target.value }))} />
//             </div>
//             <FSelect label="Bed Type" value={roomForm.bedType}
//               onChange={e => setRoomForm(f => ({ ...f, bedType: e.target.value }))}>
//               {BED_TYPES.map(b => <option key={b}>{b}</option>)}
//             </FSelect>
//             <div>
//               <label className="text-xs font-semibold text-slate-600 block mb-1.5">Room Images</label>
//               <label className="border-2 border-dashed border-slate-200 hover:border-blue-300 hover:bg-blue-50/40
//                 rounded-xl p-5 flex flex-col items-center gap-2 cursor-pointer transition-all">
//                 <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${roomImageFiles?.length ? "bg-blue-100" : "bg-slate-100"}`}>
//                   <Upload size={18} className={roomImageFiles?.length ? "text-blue-500" : "text-slate-400"} />
//                 </div>
//                 <span className={`text-sm font-medium ${roomImageFiles?.length ? "text-blue-600" : "text-slate-400"}`}>
//                   {roomImageFiles?.length ? `${roomImageFiles.length} file(s) selected` : "Upload room images"}
//                 </span>
//                 <span className="text-xs text-slate-400">PNG, JPG · Multiple allowed</span>
//                 <input type="file" className="hidden" accept="image/*" multiple
//                   onChange={e => setRoomImageFiles(e.target.files)} />
//               </label>
//             </div>
//             <FTextarea label="Description"
//               placeholder="Describe the room, view, features..."
//               value={roomForm.description} onChange={e => setRoomForm(f => ({ ...f, description: e.target.value }))} />
//             <button onClick={saveRoom} disabled={roomSaving}
//               className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800
//                 disabled:opacity-60 text-white py-3 rounded-xl text-sm font-bold transition-all active:scale-[.98]
//                 flex items-center justify-center gap-2 shadow-md shadow-blue-200">
//               {roomSaving
//                 ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
//                 : <><Check size={15} /> {editRoomIdx !== null ? "Update Room Type" : "Add Room Type"}</>}
//             </button>
//           </div>
//         </NestedModal>
//       )}

//       {/* ── Meal Plan Modal ── */}
//       {mealModal && (
//         <NestedModal
//           title={editMealIdx !== null ? "Edit Meal Plan" : "Add Meal Plan"}
//           subtitle="Set meal plan name, price and description"
//           icon={Utensils}
//           iconBg="bg-emerald-100"
//           onClose={() => setMealModal(false)}
//         >
//           <div className="space-y-4">
//             {mealErrors.api && (
//               <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 flex items-center gap-2">
//                 <AlertCircle size={14} /> {mealErrors.api}
//               </div>
//             )}
//             <div className="flex flex-col gap-1">
//               <label className="text-xs font-semibold text-slate-600">
//                 Meal Plan Name <span className="text-rose-500">*</span>
//               </label>
//               <input list="mealExamples" placeholder="e.g. CP (Breakfast)"
//                 value={mealForm.name} onChange={e => setMealForm(f => ({ ...f, name: e.target.value }))}
//                 className={`border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all
//                   ${mealErrors.name ? "border-red-300 bg-red-50/50" : "border-slate-200 bg-white hover:border-slate-300"}`} />
//               <datalist id="mealExamples">
//                 {MEAL_PLAN_EXAMPLES.map(m => <option key={m} value={m} />)}
//               </datalist>
//               {mealErrors.name && (
//                 <span className="text-xs text-red-500 flex items-center gap-1 font-medium">
//                   <AlertCircle size={10} />{mealErrors.name}
//                 </span>
//               )}
//             </div>
//             <FInput label="Price (₹ per person)" required error={mealErrors.price}
//               type="number" min="0" placeholder="e.g. 800"
//               value={mealForm.price} onChange={e => setMealForm(f => ({ ...f, price: e.target.value }))} />
//             <FTextarea label="What's Included"
//               placeholder="Breakfast buffet, evening snacks, beverages..."
//               value={mealForm.description} onChange={e => setMealForm(f => ({ ...f, description: e.target.value }))} />
//             <button onClick={saveMeal} disabled={mealSaving}
//               className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800
//                 disabled:opacity-60 text-white py-3 rounded-xl text-sm font-bold transition-all active:scale-[.98]
//                 flex items-center justify-center gap-2 shadow-md shadow-emerald-200">
//               {mealSaving
//                 ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
//                 : <><Check size={15} /> {editMealIdx !== null ? "Update Meal Plan" : "Add Meal Plan"}</>}
//             </button>
//           </div>
//         </NestedModal>
//       )}
//     </div>
//   );
// }






import { useState, useMemo, useEffect, useCallback } from "react";
import { Search, Plus, ChevronDown, ChevronUp, X, Star, MapPin, Phone, Globe, Upload, Hotel, Building2, Utensils, Wifi, Car, Dumbbell, Waves, ConciergeBell, PlaneTakeoff, Edit2, Trash2, Check, AlertCircle, Home, ChevronRight, ShieldCheck } from "lucide-react";
import { hotelService, transformHotelResponse, uploadHotelImageToCloudinary } from "../api/HotelService";
import { geographyService } from "@shared/api/geographyService";
import { getErrorMessage } from "@shared/api/apiError";
import { usePagedList } from "@shared/api/usePagedList";
import { Pager } from "@shared/ui/Pager";
import { toast } from "@shared/ui/toast";

/* ─── CONSTANTS ──────────────────────────────────────────── */
const AMENITIES = [
  { id: "wifi",        label: "Free WiFi",        icon: Wifi        },
  { id: "pool",        label: "Swimming Pool",    icon: Waves       },
  { id: "restaurant",  label: "Restaurant",       icon: Utensils    },
  { id: "parking",     label: "Parking",          icon: Car         },
  { id: "spa",         label: "Spa",              icon: Star        },
  { id: "gym",         label: "Gym",              icon: Dumbbell    },
  { id: "roomservice", label: "Room Service",     icon: ConciergeBell },
  { id: "airport",     label: "Airport Transfer", icon: PlaneTakeoff },
];

const BED_TYPES          = ["Single", "Double", "Queen", "King", "Twin", "Bunk"];
const MEAL_PLAN_EXAMPLES = ["EP (Room Only)", "CP (Breakfast)", "MAP (Half Board)", "AP (Full Board)"];

const emptyHotel = {
  name: "", city: "", destinationId: "", stars: 3, rating: "",
  address: "", contact: "", phone: "", email: "", website: "",
  mapUrl: "", lat: "", lng: "", overview: "",
  amenities: [], isDefault: false, roomTypes: [], mealPlans: [],
  imagePath: "",   // ← IMAGE URL (Cloudinary se)
};
const emptyRoom = { name: "", size: "", occupancy: "", bedType: "King", baseRate: "", description: "" };
const emptyMeal = { name: "", price: "", description: "" };

/* ─── DESIGN TOKENS ──────────────────────────────────────── */
const STAR_COLORS = {
  5: "from-amber-400 to-amber-500",
  4: "from-blue-400 to-blue-500",
  3: "from-violet-400 to-violet-500",
  2: "from-slate-400 to-slate-500",
  1: "from-rose-400 to-rose-500",
};

/* ─── SMALL UI HELPERS ───────────────────────────────────── */
function Badge({ children, color = "blue" }) {
  const map = {
    blue:  "bg-blue-100 text-blue-700 border-blue-200",
    green: "bg-emerald-100 text-emerald-700 border-emerald-200",
    amber: "bg-amber-100 text-amber-700 border-amber-200",
    red:   "bg-red-100 text-red-700 border-red-200",
    cyan:  "bg-cyan-100 text-cyan-700 border-cyan-200",
    violet:"bg-violet-100 text-violet-700 border-violet-200",
    rose:  "bg-rose-100 text-rose-700 border-rose-200",
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${map[color]}`}>
      {children}
    </span>
  );
}

function StarRow({ count }) {
  return (
    <span className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={11}
          className={i <= count ? "text-amber-400 fill-amber-400" : "text-slate-200 fill-slate-200"} />
      ))}
    </span>
  );
}

function FInput({ label, required, error, className = "", ...props }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label className="text-xs font-semibold text-slate-600">
          {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
      )}
      <input
        className={`border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all
          disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 disabled:hover:border-slate-200
          ${error ? "border-red-300 bg-red-50/50 focus:ring-red-200" : "border-slate-200 bg-white hover:border-slate-300"}`}
        {...props}
      />
      {error && (
        <span className="text-xs text-red-500 flex items-center gap-1 font-medium">
          <AlertCircle size={10} />{error}
        </span>
      )}
    </div>
  );
}

function FSelect({ label, required, children, error, className = "", ...props }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label className="text-xs font-semibold text-slate-600">
          {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
      )}
      <select
        className={`border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white transition-all
          disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 disabled:hover:border-slate-200
          ${error ? "border-red-300" : "border-slate-200 hover:border-slate-300"}`}
        {...props}
      >
        {children}
      </select>
      {error && (
        <span className="text-xs text-red-500 flex items-center gap-1 font-medium">
          <AlertCircle size={10} />{error}
        </span>
      )}
    </div>
  );
}

function FTextarea({ label, className = "", ...props }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && <label className="text-xs font-semibold text-slate-600">{label}</label>}
      <textarea
        className="border border-slate-200 hover:border-slate-300 rounded-xl px-3 py-2.5 text-sm
          focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
          bg-white resize-none transition-all disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 disabled:hover:border-slate-200"
        rows={3}
        {...props}
      />
    </div>
  );
}

function SectionCard({ icon: Icon, iconBg, iconColor, title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
        <div className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>
          <Icon size={14} className={iconColor} />
        </div>
        <p className="text-[13px] font-bold text-slate-700">{title}</p>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

function NestedModal({ title, subtitle, icon: Icon, iconBg, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)" }}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col"
        style={{ animation: "slideUp .25s ease both", maxHeight: "92vh" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className={`w-8 h-8 rounded-xl ${iconBg || "bg-blue-100"} flex items-center justify-center flex-shrink-0`}>
                <Icon size={15} className="text-blue-600" />
              </div>
            )}
            <div>
              <h3 className="font-bold text-slate-800 text-[15px]">{title}</h3>
              {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all">
            <X size={15} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

/* ─── MAIN COMPONENT ─────────────────────────────────────── */
export default function HotelMaster() {
  // `destinations` is the DESTINATION FILTER's option list (every destination the tenant has),
  // deliberately not derived from the hotels on screen: with a paged list, options built from the
  // current page would appear and vanish as you page, and you could never filter to a destination
  // whose hotels happen to sit on page 3.
  const [destinations,     setDestinations]     = useState([]);
  const [apiError,         setApiError]         = useState("");
  const [formCountries,    setFormCountries]    = useState([]);
  const [formCountryId,    setFormCountryId]    = useState("");
  const [formDestinations, setFormDestinations] = useState([]);
  const [formCities,       setFormCities]       = useState([]);
  const [loadingFormDest,  setLoadingFormDest]  = useState(false);
  const [loadingFormCity,  setLoadingFormCity]  = useState(false);
  const [filterDest,       setFilterDest]       = useState("");
  const [filterCity,       setFilterCity]       = useState("");
  const [filterStar,       setFilterStar]       = useState("");
  const [cityOptions,      setCityOptions]      = useState([]);
  const [expanded,         setExpanded]         = useState({});
  const [showModal,        setShowModal]        = useState(false);
  const [editingHotel,     setEditingHotel]     = useState(null);
  const [form,             setForm]             = useState(emptyHotel);
  const [errors,           setErrors]           = useState({});
  const [saving,           setSaving]           = useState(false);
  const [saveError,        setSaveError]        = useState("");
  const [roomModal,        setRoomModal]        = useState(false);
  const [mealModal,        setMealModal]        = useState(false);
  const [roomForm,         setRoomForm]         = useState(emptyRoom);
  const [mealForm,         setMealForm]         = useState(emptyMeal);
  const [editRoomIdx,      setEditRoomIdx]      = useState(null);
  const [editMealIdx,      setEditMealIdx]      = useState(null);
  const [roomErrors,       setRoomErrors]       = useState({});
  const [mealErrors,       setMealErrors]       = useState({});
  const [roomSaving,       setRoomSaving]       = useState(false);
  const [mealSaving,       setMealSaving]       = useState(false);
  const [,                 setHotelImageFile]   = useState(null);
  const [roomImageFiles,   setRoomImageFiles]   = useState(null);
  const [imageUploading,   setImageUploading]   = useState(false);  // ← NEW
  // Mobile modal tab — "info" ya "rooms"
  const [mobileTab,        setMobileTab]        = useState("info");

  // ── Image upload handler (backend-proxied) ──
  const handleHotelImageUpload = async (e) => {
    if (form.platformOwned) return;
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.match("image.*")) {
      setSaveError("Please select a valid image file.");
      return;
    }
    setHotelImageFile(file);
    setImageUploading(true);
    setSaveError("");
    try {
      const secureUrl = await uploadHotelImageToCloudinary(file);
      setForm(f => ({ ...f, imagePath: secureUrl }));   // form mein save
    } catch (err) {
      console.error("Image upload failed:", err);
      setSaveError(getErrorMessage(err, "Image upload failed."));
      setHotelImageFile(null);
    } finally {
      setImageUploading(false);
    }
  };

  /* ── Server-side paged hotel list ──────────────────────────────────────────
     Search + all three filters are sent to the backend. They must NOT be applied in the browser:
     a client-side predicate can only see the rows on the current page, so "3 Star" would mean
     "the 3-star hotels that happen to be on this page" — and past the page size, rows the user
     saved would look deleted. That is the exact defect this replaced. */
  const fetchHotels = useCallback((params) => hotelService.listHotels(params), []);

  const {
    rows, loading, error: listError,
    page, setPage, pageSize, setPageSize,
    q: search, setQ: setSearch,
    total, totalPages, reload,
  } = usePagedList(fetchHotels, {
    size: 25,
    sortBy: "name",
    sortDir: "asc",
    filters: {
      destinationId: filterDest || undefined,
      city:          filterCity || undefined,
      stars:         filterStar || undefined,
    },
  });

  useEffect(() => {
    setApiError(listError ? "Could not load hotels. Please try again." : "");
  }, [listError]);

  // Destination options for the filter — the full list, independent of what's on this page.
  useEffect(() => {
    (async () => {
      try { setDestinations(await geographyService.getAllDestinations()); }
      catch { setDestinations([]); }
    })();
  }, []);

  // City options follow the selected destination. Without a destination there is no bounded city
  // list to offer, so the dropdown falls back to the cities visible on this page.
  useEffect(() => {
    (async () => {
      if (!filterDest) { setCityOptions([]); return; }
      try {
        const cities = await geographyService.getCitiesByDestination(filterDest);
        setCityOptions(cities.map(c => c.name ?? c.label).filter(Boolean));
      } catch { setCityOptions([]); }
    })();
  }, [filterDest]);

  // Group THIS PAGE's hotels under their destination for the existing grouped layout.
  const filtered = useMemo(() => {
    const nameById = new Map((destinations || []).map(d => [String(d.id), d.name]));
    const grouped  = new Map();

    (rows || []).forEach(rawHotel => {
      // Normalise the id up front: HotelDto carries hotelId, some paths carry publicId, and the
      // row actions below all key off `.id`.
      const hotel = {
        ...rawHotel,
        id: rawHotel.id || rawHotel.hotelId || rawHotel._id || rawHotel.publicId,
      };
      const dId   = String(hotel.destinationId ?? hotel.destination?.id ?? "unknown");
      const dName = nameById.get(dId) ?? hotel.destinationName ?? hotel.destination?.name ?? `Destination ${dId}`;
      if (!grouped.has(dId)) grouped.set(dId, { id: dId, name: dName, hotels: [] });
      grouped.get(dId).hotels.push(hotel);
    });

    return Array.from(grouped.values());
  }, [rows, destinations]);

  useEffect(() => {
    (async () => {
      try { setFormCountries(await geographyService.getCountries()); }
      catch { setFormCountries([]); }
    })();
  }, []);

  const loadFormDestinations = async (countryId) => {
    setFormDestinations([]); setFormCities([]);
    if (!countryId) return;
    setLoadingFormDest(true);
    try { setFormDestinations(await geographyService.getDestinationsByCountry(countryId)); }
    catch { setFormDestinations([]); }
    finally { setLoadingFormDest(false); }
  };

  const loadFormCities = async (destinationId) => {
    setFormCities([]);
    if (!destinationId) return;
    setLoadingFormCity(true);
    try { setFormCities(await geographyService.getCitiesByDestination(destinationId)); }
    catch { setFormCities([]); }
    finally { setLoadingFormCity(false); }
  };

  const handleFormCountryChange = (countryId) => {
    setFormCountryId(countryId);
    setForm(f => ({ ...f, destinationId: "", city: "" }));
    loadFormDestinations(countryId);
  };

  const handleFormDestinationChange = (destinationId) => {
    setForm(f => ({ ...f, destinationId, city: "" }));
    loadFormCities(destinationId);
  };

  const prefillCascade = async (destinationId) => {
    setFormCountryId(""); setFormDestinations([]); setFormCities([]);
    if (!destinationId) return;
    try {
      const dest = await geographyService.getDestinationById(destinationId);
      if (dest?.countryId != null) {
        setFormCountryId(String(dest.countryId));
        setLoadingFormDest(true);
        try { setFormDestinations(await geographyService.getDestinationsByCountry(dest.countryId)); }
        finally { setLoadingFormDest(false); }
      }
      setLoadingFormCity(true);
      try { setFormCities(await geographyService.getCitiesByDestination(destinationId)); }
      finally { setLoadingFormCity(false); }
    } catch { /* city load is best-effort */ }
  };

  const resetCascade = () => {
    setFormCountryId(""); setFormDestinations([]); setFormCities([]);
    setLoadingFormDest(false); setLoadingFormCity(false);
  };

  // City filter options: the selected destination's cities when there is one, otherwise whatever
  // cities this page happens to show. No client-side narrowing of the list itself happens here —
  // `filtered` above is already exactly what the server returned for the active query.
  const allCities = useMemo(() => {
    if (cityOptions.length) return cityOptions;
    return [...new Set((rows || []).map(h => h?.city).filter(Boolean))];
  }, [cityOptions, rows]);

  const openAdd = () => {
    setEditingHotel(null); setForm(emptyHotel); setErrors({});
    setSaveError(""); setHotelImageFile(null); resetCascade();
    setMobileTab("info");
    setShowModal(true);
  };

  const openAddForDestination = (destId) => {
    setEditingHotel(null);
    setForm({ ...emptyHotel, destinationId: destId != null ? String(destId) : "" });
    setErrors({}); setSaveError(""); setHotelImageFile(null);
    prefillCascade(destId); setShowModal(true);
  };

  const openEdit = (hotel, destId) => {
    setEditingHotel({ ...hotel, destinationId: destId });
    setForm(transformHotelResponse({ ...hotel, destinationId: destId }));
    setErrors({}); setSaveError(""); setHotelImageFile(null);
    prefillCascade(destId);
    setMobileTab("info");
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditingHotel(null); setHotelImageFile(null); };

  const validate = () => {
    const e = {};
    if (!form.destinationId) e.destinationId = "Required";
    if (!form.city)          e.city          = "Required";
    if (!form.name.trim())   e.name          = "Required";
    if (!form.stars)         e.stars         = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true); setSaveError("");
    try {
      let savedHotel;
      if (editingHotel) {
        const res = await hotelService.updateHotel(editingHotel.id, form);
        savedHotel = res.data?.data ?? res.data;

        toast.success(`Hotel updated successfully!`);
      } else {
        const res = await hotelService.createHotel(form);
        savedHotel = res.data?.data ?? res.data;

console.log("✅ New Hotel Created! Backend assigned ID:", savedHotel.id || savedHotel.hotelId);
        
        // 2. Show the ID on the screen as a popup notification
        toast.success(`Hotel created successfully! ID: ${savedHotel.id || savedHotel.hotelId}`);

      }
      // ── Image ab Cloudinary se upload hoti hai — form.imagePath mein already hai ──
      // (purana uploadHotelImage call hata diya)
      if (form.isDefault && savedHotel?.id) await hotelService.setDefaultHotel(savedHotel.id, form.destinationId);

      // Refetch the current page from the backend. reload() re-runs the SAME paged query (page,
      // search and filters intact), so the saved row lands wherever the server says it belongs.
      // Splicing it into a locally-held array — the old behaviour — is what made the list drift
      // out of sync with the query the user was actually looking at.
      await reload();
      closeModal();
    } catch (err) {
      setSaveError(err?.response?.data?.message || "Failed to save hotel. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (hotel) => {
    const hotelId = hotel?.id;
    const prompt = hotel?.platformOwned
      ? "Remove this Platform hotel from My Hotels? Existing quotations will remain unchanged."
      : "Delete this hotel?";
    if (!window.confirm(prompt)) return;
    try {
      await hotelService.deleteHotel(hotelId);
      // Re-query rather than filtering the row out locally: deleting the last row on a page has to
      // pull the next page's rows up, and only the server knows what those are.
      await reload();
      toast.success(hotel?.platformOwned ? "Platform hotel removed from My Hotels." : "Hotel deleted successfully!");

    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete hotel."));
    }
  };

  const openAddRoom  = () => { setEditRoomIdx(null); setRoomForm(emptyRoom); setRoomErrors({}); setRoomImageFiles(null); setRoomModal(true); };
  const openEditRoom = (idx) => { setEditRoomIdx(idx); setRoomForm({ ...form.roomTypes[idx] }); setRoomErrors({}); setRoomImageFiles(null); setRoomModal(true); };

  const saveRoom = async () => {
    const e = {};
    if (!roomForm.name.trim()) e.name = "Required";
    if (!roomForm.occupancy)   e.occupancy = "Required";
    setRoomErrors(e);
    if (Object.keys(e).length) return;
    setRoomSaving(true);
    try {
      const hotelId = editingHotel?.id;
      if (hotelId) {
        if (editRoomIdx !== null) {
          const existingRoom = form.roomTypes[editRoomIdx];
          const res = existingRoom.platformOwned
            ? await hotelService.updateRoomBaseRate(hotelId, existingRoom.id, roomForm.baseRate)
            : await hotelService.updateRoomType(hotelId, existingRoom.id, roomForm);
          const savedRoom = res?.data?.data ?? res?.data ?? {};
          const savedRoomId = savedRoom.roomTypeId || savedRoom.id || existingRoom.id;
          if (!existingRoom.platformOwned && roomImageFiles?.length && savedRoomId) {
            await hotelService.uploadRoomImages(hotelId, savedRoomId, roomImageFiles);
          }
        } else {
          const res = await hotelService.addRoomType(hotelId, roomForm);
          const savedRoom = res?.data?.data ?? res?.data ?? {};
          const savedRoomId = savedRoom.roomTypeId || savedRoom.id;
          if (roomImageFiles?.length && savedRoomId) {
            await hotelService.uploadRoomImages(hotelId, savedRoomId, roomImageFiles);
          }
        }
      }
      const rooms = [...(form.roomTypes || [])];
      if (editRoomIdx !== null) { rooms[editRoomIdx] = { ...rooms[editRoomIdx], ...roomForm, id: rooms[editRoomIdx].id }; }
      else { rooms.push({ ...roomForm, id: Date.now() }); }
      setForm(f => ({ ...f, roomTypes: rooms }));
      setRoomModal(false);
    } catch (err) {
      setRoomErrors({ api: err?.response?.data?.message || "Failed to save room type." });
    } finally { setRoomSaving(false); }
  };

  const deleteRoom = async (idx) => {
    const hotelId = editingHotel?.id;
    const room = form.roomTypes[idx];
    if (room?.platformOwned) return;
    const roomId  = room?.id;
    if (hotelId && roomId) {
      try { await hotelService.deleteRoomType(hotelId, roomId); }
      catch (err) { toast.error(getErrorMessage(err, "Failed to delete.")); return; }
    }
    setForm(f => ({ ...f, roomTypes: f.roomTypes.filter((_, i) => i !== idx) }));
  };

  const openAddMeal  = () => { setEditMealIdx(null); setMealForm(emptyMeal); setMealErrors({}); setMealModal(true); };
  const openEditMeal = (idx) => { setEditMealIdx(idx); setMealForm({ ...form.mealPlans[idx] }); setMealErrors({}); setMealModal(true); };

  const saveMeal = async () => {
    const e = {};
    if (!mealForm.name.trim())               e.name  = "Required";
    if (!mealForm.price && mealForm.price !== 0) e.price = "Required";
    setMealErrors(e);
    if (Object.keys(e).length) return;
    setMealSaving(true);
    try {
      const hotelId = editingHotel?.id;
      if (hotelId) {
        if (editMealIdx !== null) { await hotelService.updateMealPlan(hotelId, form.mealPlans[editMealIdx].id, mealForm); }
        else { await hotelService.addMealPlan(hotelId, mealForm); }
      }
      const meals = [...(form.mealPlans || [])];
      if (editMealIdx !== null) { meals[editMealIdx] = { ...mealForm, id: meals[editMealIdx].id }; }
      else { meals.push({ ...mealForm, id: Date.now() }); }
      setForm(f => ({ ...f, mealPlans: meals }));
      setMealModal(false);
    } catch (err) {
      setMealErrors({ api: err?.response?.data?.message || "Failed to save meal plan." });
    } finally { setMealSaving(false); }
  };

  const deleteMeal = async (idx) => {
    const hotelId = editingHotel?.id;
    const meal = form.mealPlans[idx];
    if (meal?.platformOwned) return;
    const mealId  = meal?.id;
    if (hotelId && mealId) {
      try { await hotelService.deleteMealPlan(hotelId, mealId); }
      catch (err) { toast.error(getErrorMessage(err, "Failed to delete.")); return; }


    }
    setForm(f => ({ ...f, mealPlans: f.mealPlans.filter((_, i) => i !== idx) }));
    toast.success("Meal plan deleted!");
  };

  const toggleAmenity = (id) => setForm(f => ({
    ...f,
    amenities: f.amenities.includes(id) ? f.amenities.filter(a => a !== id) : [...f.amenities, id],
  }));

  const totalHotels = (Array.isArray(destinations) ? destinations : [])
    .reduce((acc, d) => acc + (d?.hotels?.length || 0), 0);

  /* ─── RENDER ──────────────────────────────────────────── */
  return (
    <div className="min-h-screen font-sans"
      style={{
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        background: "linear-gradient(135deg, #f8fafc 0%, #eff6ff20 50%, #f8fafc 100%)",
      }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes fadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        .fade-up { animation: fadeUp .4s ease both; }
        .hotel-card { transition: box-shadow .2s, transform .2s; }
        .hotel-card:hover { box-shadow: 0 8px 30px rgba(15,23,42,0.08); transform: translateY(-1px); }
        .amenity-btn { transition: all .15s; }
        .amenity-btn:hover { transform: translateY(-1px); }
        html, body { overflow-x: hidden; }
        .modal-scroll { -webkit-overflow-scrolling: touch; }
      `}</style>

      {/* ── API Error Banner ── */}
      {apiError && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-2.5 flex items-center gap-2 text-sm text-amber-700">
          <AlertCircle size={14} className="flex-shrink-0" /> {apiError}
          <button onClick={() => setApiError("")} className="ml-auto p-1 hover:bg-amber-100 rounded-lg transition"><X size={13} /></button>
        </div>
      )}

      {/* ── Page Header ── */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">

            <div className="flex items-center gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-white shadow-lg shadow-blue-200">
                <Hotel size={20} strokeWidth={2.2} />
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-0.5">
                  <Home size={11} />
                  <ChevronRight size={9} className="text-slate-300" />
                  <span className="text-blue-600 font-bold">Hotel Master</span>
                </div>
                <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">Hotel Master</h1>
                <p className="text-xs text-slate-400 font-medium hidden sm:block">
                  {destinations.length} destinations · {totalHotels} hotels
                </p>
              </div>
            </div>

            <button onClick={openAdd}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800
                text-white px-4 sm:px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95
                shadow-md shadow-blue-200 hover:shadow-lg">
              <Plus size={16} strokeWidth={2.5} /> Add New Hotel
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-3 sm:px-6 py-4 sm:py-5 space-y-3 sm:space-y-5">

        {/* ── Filters ── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-3 sm:p-4 fade-up">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search hotels or destinations..."
                className="w-full border border-slate-200 hover:border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all bg-white" />
            </div>
            {[
              { value: filterDest, onChange: e => setFilterDest(e.target.value), placeholder: "All Destinations", options: destinations.map(d => ({ v: d.id, l: d.name })) },
              { value: filterCity, onChange: e => setFilterCity(e.target.value), placeholder: "All Cities",       options: allCities.map(c => ({ v: c, l: c })) },
              { value: filterStar, onChange: e => setFilterStar(e.target.value), placeholder: "All Stars",        options: [5,4,3,2,1].map(s => ({ v: s, l: `${s} Star` })) },
            ].map((sel, i) => (
              <select key={i} value={sel.value} onChange={sel.onChange}
                className="border border-slate-200 hover:border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white
                  focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all min-w-[130px]">
                <option value="">{sel.placeholder}</option>
                {sel.options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            ))}
            {(search || filterDest || filterCity || filterStar) && (
              <button onClick={() => { setSearch(""); setFilterDest(""); setFilterCity(""); setFilterStar(""); }}
                className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold text-slate-500 hover:text-red-500
                  bg-slate-50 hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-xl transition-all whitespace-nowrap">
                <X size={12} /> Clear
              </button>
            )}
          </div>
        </div>

        {/* ── Loading skeleton ── */}
        {loading && (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-slate-200 rounded-2xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 rounded-lg w-36" />
                    <div className="h-3 bg-slate-100 rounded-lg w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Destination Accordion ── */}
        {!loading && (
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-14 text-center fade-up">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Hotel size={28} className="text-slate-300" />
                </div>
                <p className="text-slate-600 font-bold text-base mb-1">No hotels found</p>
                <p className="text-slate-400 text-sm">Try adjusting your search or filters</p>
              </div>
            ) : filtered.map((dest, di) => {
              const isOpen       = expanded[dest.id];
              const defaultHotel = dest.hotels.find(h => h.isDefault);
              const uniqueCities = [...new Set(dest.hotels.map(h => h.city))];
              const maxStars     = dest.hotels.reduce((max, h) => Math.max(max, h.stars || 0), 0);
              return (
                <div key={dest.id}
                  className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden hotel-card fade-up"
                  style={{ animationDelay: `${di * 40}ms` }}>

                  {/* Destination Header */}
                  <div
                    className="flex flex-col sm:flex-row sm:items-center justify-between px-3 sm:px-6 py-3 sm:py-4 gap-2 sm:gap-3 cursor-pointer
                      hover:bg-slate-50/60 transition-colors"
                    onClick={() => setExpanded(e => ({ ...e, [dest.id]: !e[dest.id] }))}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-100
                        flex items-center justify-center flex-shrink-0 shadow-sm">
                        <MapPin size={18} className="text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="font-extrabold text-slate-800 text-[15px]">{dest.name}</h2>
                          {defaultHotel && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                              ✓ Default: {defaultHotel.name}
                            </span>
                          )}
                          {maxStars > 0 && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white bg-gradient-to-r ${STAR_COLORS[maxStars] || "from-slate-400 to-slate-500"}`}>
                              Up to {maxStars}★
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                            <Hotel size={11} className="text-blue-400" />
                            {dest.hotels.length} {dest.hotels.length === 1 ? "Hotel" : "Hotels"}
                          </span>
                          <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                            <Building2 size={11} className="text-violet-400" />
                            {uniqueCities.length} {uniqueCities.length === 1 ? "City" : "Cities"}
                          </span>
                          {uniqueCities.slice(0, 3).map(c => (
                            <span key={c} className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">{c}</span>
                          ))}
                          {uniqueCities.length > 3 && (
                            <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">+{uniqueCities.length - 3}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <button onClick={() => openAddForDestination(dest.id)}
                        className="flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100
                          border border-blue-200 hover:border-blue-300 px-3 py-1.5 rounded-xl transition-all">
                        <Plus size={12} strokeWidth={2.5} /> Add Hotel
                      </button>
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-slate-400
                        transition-all ${isOpen ? "bg-blue-50 text-blue-500 rotate-0" : "bg-slate-50"}`}>
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>
                  </div>

                  {/* Hotels List */}
                  {isOpen && (
                    <div className="border-t border-slate-100">
                      {dest.hotels.length === 0 ? (
                        <div className="py-10 text-center">
                          <Hotel size={28} className="mx-auto text-slate-300 mb-2" />
                          <p className="text-slate-400 text-sm font-medium">No hotels yet.</p>
                          <button onClick={() => openAddForDestination(dest.id)}
                            className="mt-3 text-xs font-bold text-blue-600 hover:text-blue-700 underline underline-offset-2">
                            Add the first hotel
                          </button>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-50">
                          {dest.hotels.map((hotel, hi) => (
                            <div key={hotel.id}
                              className="px-3 sm:px-6 py-3 sm:py-4 hover:bg-blue-50/20 transition-colors group"
                              style={{ animation: `fadeIn .2s ease ${hi * 30}ms both` }}>
                              <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">

                                {/* Hotel Info */}
                                <div className="flex items-start gap-3 min-w-0">
                                  {/* Hotel avatar — IMAGE agar hai toh dikhao, warna icon */}
                                  {hotel.imagePath || hotel.imageUrl ? (
                                    <img
                                      src={hotel.imagePath || hotel.imageUrl}
                                      alt={hotel.name}
                                      className="w-12 h-12 rounded-xl object-cover flex-shrink-0 mt-0.5 border border-slate-200 shadow-sm"
                                    />
                                  ) : (
                                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${STAR_COLORS[hotel.stars] || "from-slate-400 to-slate-500"}
                                      flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm`}>
                                      <Hotel size={16} className="text-white" strokeWidth={2} />
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-bold text-slate-800 text-[14px]">{hotel.name}</span>
                                      {hotel.platformOwned && (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-violet-700">
                                          <ShieldCheck size={10} /> Platform
                                        </span>
                                      )}
                                      {hotel.isDefault && <Badge color="cyan">Default</Badge>}
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white
                                        bg-gradient-to-r ${STAR_COLORS[hotel.stars] || "from-slate-400 to-slate-500"}`}>
                                        {hotel.stars}★
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                                      <span className="text-xs text-slate-500 flex items-center gap-1">
                                        <MapPin size={10} className="text-rose-400" />{hotel.city}
                                      </span>
                                      {hotel.phone && (
                                        <span className="text-xs text-slate-500 flex items-center gap-1">
                                          <Phone size={10} className="text-emerald-400" />{hotel.phone}
                                        </span>
                                      )}
                                      <StarRow count={hotel.stars} />
                                    </div>
                                    {hotel.amenities?.length > 0 && (
                                      <div className="flex gap-1.5 mt-2 flex-wrap">
                                        {hotel.amenities.slice(0, 5).map(a => {
                                          const am = AMENITIES.find(x => x.id === a);
                                          return am ? (
                                            <span key={a} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                                              {am.label}
                                            </span>
                                          ) : null;
                                        })}
                                        {hotel.amenities.length > 5 && (
                                          <span className="text-[10px] bg-blue-50 text-blue-500 px-2 py-0.5 rounded-full font-medium">
                                            +{hotel.amenities.length - 5} more
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
                                  <button onClick={() => openEdit(hotel, dest.id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100
                                      text-blue-600 text-xs font-bold border border-blue-200 hover:border-blue-300 transition-all">
                                    <Edit2 size={12} /> {hotel.platformOwned ? "Manage" : "Edit"}
                                  </button>
                                  <button onClick={() => handleDelete(hotel)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100
                                      text-rose-500 text-xs font-bold border border-rose-200 hover:border-rose-300 transition-all">
                                    <Trash2 size={12} /> {hotel.platformOwned ? "Remove" : "Delete"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <Pager
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={pageSize}
              onPage={setPage}
              onPageSize={setPageSize}
              loading={loading}
              label="hotels"
            />
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* MAIN HOTEL MODAL                                   */}
      {/* ═══════════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
          style={{ background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)" }}
          onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="bg-white w-full sm:rounded-2xl shadow-2xl flex flex-col"
            style={{ maxWidth: 1280, maxHeight: "100dvh", minHeight: "60vh", animation: "slideUp .25s ease both" }}>

            {/* Modal Header */}
            <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4
              bg-gradient-to-r from-blue-700 via-blue-600 to-blue-500
              sm:rounded-t-2xl flex-shrink-0 shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0 ring-1 ring-white/30">
                  <Hotel size={18} className="text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-extrabold text-white text-[16px] sm:text-lg leading-tight">
                    {editingHotel
                      ? `${form.platformOwned ? "Manage" : "Edit"} — ${editingHotel.name || "Hotel"}`
                      : "Add New Hotel"}
                  </h2>
                  <p className="text-[11px] text-blue-200 font-medium hidden sm:block">
                    Fill in the details below · Fields marked * are required
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={handleSave} disabled={saving || imageUploading}
                  className="flex items-center gap-2 bg-white hover:bg-blue-50 text-blue-700 font-bold
                    px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-sm transition-all active:scale-95 shadow-sm disabled:opacity-60">
                  {saving
                    ? <><div className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /><span className="hidden sm:inline">Saving...</span></>
                    : <><Check size={15} strokeWidth={2.5} /><span className="hidden sm:inline">{form.platformOwned ? "Save Local Settings" : "Save Hotel"}</span></>
                  }
                </button>
                <button onClick={closeModal}
                  className="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-all">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Save error */}
            {saveError && (
              <div className="mx-4 sm:mx-6 mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 flex items-center gap-2 flex-shrink-0">
                <AlertCircle size={14} className="flex-shrink-0" /> {saveError}
                <button onClick={() => setSaveError("")} className="ml-auto"><X size={13} /></button>
              </div>
            )}

            {form.platformOwned && (
              <div className="mx-4 sm:mx-6 mt-4 flex items-start gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800 flex-shrink-0">
                <ShieldCheck size={16} className="mt-0.5 flex-shrink-0" />
                <span>
                  Platform maintains the hotel and room descriptions. You can manage the contact person,
                  default preference, tenant selling rates, and your own additional rooms or meal plans.
                </span>
              </div>
            )}

            {/* Mobile Tab Switcher */}
            <div className="flex lg:hidden border-b border-slate-100 bg-white flex-shrink-0">
              <button
                onClick={() => setMobileTab("info")}
                className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-all
                  ${mobileTab === "info"
                    ? "border-blue-600 text-blue-600 bg-blue-50/40"
                    : "border-transparent text-slate-400 hover:text-slate-600"}`}>
                <Hotel size={15} /> Hotel Info
              </button>
              <button
                onClick={() => setMobileTab("rooms")}
                className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-all
                  ${mobileTab === "rooms"
                    ? "border-blue-600 text-blue-600 bg-blue-50/40"
                    : "border-transparent text-slate-400 hover:text-slate-600"}`}>
                <Building2 size={15} />
                Rooms & Meals
                {(form.roomTypes?.length > 0 || form.mealPlans?.length > 0) && (
                  <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">
                    {(form.roomTypes?.length || 0) + (form.mealPlans?.length || 0)}
                  </span>
                )}
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex flex-col lg:flex-row flex-1 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-100">

              {/* ── Left: Hotel Info ── */}
              <div className={`flex-1 min-w-0 overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-4
                ${mobileTab === "info" ? "block" : "hidden lg:block"}`}>

                {/* Basic Info */}
                <SectionCard icon={Hotel} iconBg="bg-blue-100" iconColor="text-blue-600" title="Basic Information">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FSelect label="Country" required value={formCountryId} disabled={form.platformOwned}
                      onChange={e => handleFormCountryChange(e.target.value)}>
                      <option value="">{formCountries.length === 0 ? "Loading…" : "Select country"}</option>
                      {formCountries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </FSelect>
                    <FSelect label="Destination" required error={errors.destinationId}
                      value={form.destinationId} onChange={e => handleFormDestinationChange(e.target.value)}
                      disabled={form.platformOwned || !formCountryId || loadingFormDest}>
                      <option value="">{!formCountryId ? "Select country first" : loadingFormDest ? "Loading…" : formDestinations.length === 0 ? "No destinations" : "Select destination"}</option>
                      {formDestinations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </FSelect>
                    <FSelect label="City" required error={errors.city}
                      value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                      disabled={form.platformOwned || !form.destinationId || loadingFormCity}>
                      <option value="">{!form.destinationId ? "Select destination first" : loadingFormCity ? "Loading…" : formCities.length === 0 ? "No cities" : "Select city"}</option>
                      {formCities.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </FSelect>
                    <FInput label="Hotel Name" required error={errors.name}
                      placeholder="e.g. The Grand Palace"
                      disabled={form.platformOwned}
                      value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />

                    {/* ── Image Upload — backend-proxied, with preview ── */}
                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                        Hotel Image
                        {imageUploading && <span className="ml-2 text-blue-500 animate-pulse">Uploading...</span>}
                      </label>

                      {/* Preview agar image hai */}
                      {form.imagePath && !imageUploading && (
                        <div className="mb-3 relative inline-block w-full">
                          <img src={form.imagePath} alt="Hotel"
                            className="w-full max-h-52 object-cover rounded-xl border border-slate-200" />
                          {!form.platformOwned && (
                            <button type="button"
                              onClick={() => { setForm(f => ({ ...f, imagePath: "" })); setHotelImageFile(null); }}
                              className="absolute top-2 right-2 bg-rose-500 text-white p-1.5 rounded-lg hover:bg-rose-600 shadow-md">
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      )}

                      <label className={`border-2 border-dashed rounded-xl p-4 flex items-center gap-3 transition-all group
                        ${form.platformOwned ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-70" : "cursor-pointer"}
                        ${imageUploading ? "border-blue-300 bg-blue-50" : "border-slate-200 hover:border-blue-300 hover:bg-blue-50/40"}`}>
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
                          ${form.imagePath ? "bg-blue-100" : "bg-slate-100 group-hover:bg-blue-100"}`}>
                          {imageUploading
                            ? <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                            : <Upload size={16} className={form.imagePath ? "text-blue-500" : "text-slate-400 group-hover:text-blue-500"} />
                          }
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold truncate ${form.imagePath ? "text-blue-600" : "text-slate-400 group-hover:text-blue-500"}`}>
                            {form.platformOwned ? "Image maintained by Platform" : imageUploading ? "Uploading to cloud..." : form.imagePath ? "Change image" : "Click to upload hotel image"}
                          </p>
                          <p className="text-xs text-slate-400">PNG, JPG up to 10MB</p>
                        </div>
                        <input type="file" className="hidden" accept="image/*"
                          disabled={imageUploading || form.platformOwned}
                          onChange={handleHotelImageUpload} />
                      </label>
                    </div>

                    <FInput label="Full Address" placeholder="Street, area, landmark..."
                      className="sm:col-span-2"
                      disabled={form.platformOwned}
                      value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                    <FSelect label="Star Category" required error={errors.stars}
                      disabled={form.platformOwned}
                      value={form.stars} onChange={e => setForm(f => ({ ...f, stars: e.target.value }))}>
                      {[5,4,3,2,1].map(s => <option key={s} value={s}>{s} Star</option>)}
                    </FSelect>
                    <FInput label="Review Rating" type="number" min="0" max="5" step="0.1"
                      placeholder="e.g. 4.5 / 5.0"
                      disabled={form.platformOwned}
                      value={form.rating} onChange={e => setForm(f => ({ ...f, rating: e.target.value }))} />
                  </div>

                  {/* Default toggle */}
                  <label htmlFor="defaultHotel"
                    className="mt-4 flex items-center gap-3 p-3 bg-blue-50/50 border border-blue-100
                      hover:border-blue-300 rounded-xl cursor-pointer transition-all">
                    <input type="checkbox" id="defaultHotel" checked={form.isDefault}
                      onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))}
                      className="w-4 h-4 accent-blue-600 cursor-pointer" />
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Set as default hotel</p>
                      <p className="text-xs text-slate-400">This hotel will be auto-selected for this destination</p>
                    </div>
                    {form.isDefault && (
                      <span className="ml-auto text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    )}
                  </label>
                </SectionCard>

                {/* Contact Info */}
                <SectionCard icon={Phone} iconBg="bg-indigo-100" iconColor="text-indigo-600" title="Contact Information">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FInput label="Contact Person" placeholder="Full name"
                      value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} />
                    <FInput label="Phone Number" placeholder="+91 xxxxxxxxxx"
                      disabled={form.platformOwned}
                      value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                    <FInput label="Email Address" type="email" placeholder="hotel@example.com"
                      disabled={form.platformOwned}
                      value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                    <FInput label="Website" placeholder="www.example.com"
                      disabled={form.platformOwned}
                      value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
                  </div>
                </SectionCard>

                {/* Description & Amenities */}
                <SectionCard icon={Globe} iconBg="bg-violet-100" iconColor="text-violet-600" title="Description & Amenities">
                  <FTextarea label="Hotel Overview"
                    placeholder="Describe the hotel, its location, unique features..."
                    disabled={form.platformOwned}
                    value={form.overview} onChange={e => setForm(f => ({ ...f, overview: e.target.value }))}
                    rows={3} />
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-slate-600 mb-2.5">Amenities</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                      {AMENITIES.map(a => {
                        const Icon     = a.icon;
                        const selected = form.amenities?.includes(a.id);
                        return (
                          <button key={a.id} type="button" disabled={form.platformOwned} onClick={() => toggleAmenity(a.id)}
                            className={`amenity-btn flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all
                              ${selected
                                ? "border-blue-400 bg-blue-600 text-white shadow-md shadow-blue-200"
                                : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50"
                              }`}>
                            <Icon size={13} className={selected ? "text-white" : "text-slate-400"} />
                            <span className="truncate flex-1 text-left">{a.label}</span>
                            {selected && <Check size={11} className="text-white flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </SectionCard>
              </div>

              {/* ── Right: Rooms + Meals ── */}
              <div className={`lg:w-[420px] xl:w-[460px] flex-shrink-0 overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-4 bg-slate-50/40
                ${mobileTab === "rooms" ? "block" : "hidden lg:block"}`}>

                {/* Room Types */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Building2 size={13} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-slate-700">Room Types</p>
                        <p className="text-[10px] text-slate-400">{form.roomTypes?.length || 0} added</p>
                      </div>
                    </div>
                    <button onClick={openAddRoom}
                      className="flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50
                        hover:bg-blue-600 hover:text-white border border-blue-200 hover:border-blue-600
                        px-3 py-1.5 rounded-xl transition-all">
                      <Plus size={12} strokeWidth={2.5} /> Add Room
                    </button>
                  </div>

                  {!form.roomTypes?.length ? (
                    <div className="py-10 text-center">
                      <Building2 size={28} className="mx-auto text-slate-300 mb-2" />
                      <p className="text-xs text-slate-400 font-medium">No room types added yet</p>
                      <button onClick={openAddRoom}
                        className="mt-3 text-xs font-bold text-blue-500 hover:text-blue-600 underline underline-offset-2">
                        Add first room type
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {form.roomTypes.map((r, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-blue-50/30 transition-colors group">
                          <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                            <Building2 size={13} className="text-blue-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-slate-700 truncate">{r.name}</p>
                              {r.platformOwned && <Badge color="violet">Platform</Badge>}
                              {r.active === false && <Badge color="rose">Inactive</Badge>}
                            </div>
                            <p className="text-xs text-slate-400">
                              {r.bedType} · {r.occupancy} pax
                              {r.size && ` · ${r.size}`}
                            </p>
                            <p className={`mt-0.5 text-xs font-semibold ${r.baseRate !== "" && r.baseRate != null ? "text-emerald-600" : "text-amber-600"}`}>
                              {r.baseRate !== "" && r.baseRate != null
                                ? `₹${Number(r.baseRate).toLocaleString("en-IN")} / room / night`
                                : "No rate added"}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                            <button onClick={() => openEditRoom(i)}
                              title={r.platformOwned ? "Edit tenant selling rate" : "Edit room type"}
                              className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-500 flex items-center justify-center transition-all">
                              <Edit2 size={12} />
                            </button>
                            {!r.platformOwned && (
                              <button onClick={() => deleteRoom(i)}
                                className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-400 flex items-center justify-center transition-all">
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Meal Plans */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <Utensils size={13} className="text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-slate-700">Meal Plans</p>
                        <p className="text-[10px] text-slate-400">{form.mealPlans?.length || 0} added</p>
                      </div>
                    </div>
                    <button onClick={openAddMeal}
                      className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50
                        hover:bg-emerald-600 hover:text-white border border-emerald-200 hover:border-emerald-600
                        px-3 py-1.5 rounded-xl transition-all">
                      <Plus size={12} strokeWidth={2.5} /> Add Plan
                    </button>
                  </div>

                  {!form.mealPlans?.length ? (
                    <div className="py-10 text-center">
                      <Utensils size={28} className="mx-auto text-slate-300 mb-2" />
                      <p className="text-xs text-slate-400 font-medium">No meal plans added yet</p>
                      <button onClick={openAddMeal}
                        className="mt-3 text-xs font-bold text-emerald-500 hover:text-emerald-600 underline underline-offset-2">
                        Add first meal plan
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {form.mealPlans.map((m, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-emerald-50/30 transition-colors group">
                          <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                            <Utensils size={13} className="text-emerald-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-slate-700 truncate">{m.name}</p>
                              {m.platformOwned && <Badge color="violet">Platform</Badge>}
                              {m.active === false && <Badge color="rose">Inactive</Badge>}
                            </div>
                            <p className="text-xs text-emerald-600 font-semibold">₹{m.price} / person</p>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                            <button onClick={() => openEditMeal(i)}
                              className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-500 flex items-center justify-center transition-all">
                              <Edit2 size={12} />
                            </button>
                            {!m.platformOwned && (
                              <button onClick={() => deleteMeal(i)}
                                className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-400 flex items-center justify-center transition-all">
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Room Type Modal ── */}
      {roomModal && (
        <NestedModal
          title={roomForm.platformOwned ? "Set Tenant Selling Rate" : editRoomIdx !== null ? "Edit Room Type" : "Add Room Type"}
          subtitle={roomForm.platformOwned
            ? "Platform maintains the room details; this rate belongs to your agency"
            : "Configure room capacity, bed type and base selling rate"}
          icon={Building2}
          iconBg="bg-blue-100"
          onClose={() => setRoomModal(false)}
        >
          <div className="space-y-4">
            {roomErrors.api && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 flex items-center gap-2">
                <AlertCircle size={14} /> {roomErrors.api}
              </div>
            )}
            <FInput label="Room Name" required error={roomErrors.name}
              placeholder="e.g. Deluxe Sea View Room"
              disabled={roomForm.platformOwned}
              value={roomForm.name} onChange={e => setRoomForm(f => ({ ...f, name: e.target.value }))} />
            <div className="grid grid-cols-2 gap-4">
              <FInput label="Room Size" placeholder="e.g. 45 sqm"
                disabled={roomForm.platformOwned}
                value={roomForm.size} onChange={e => setRoomForm(f => ({ ...f, size: e.target.value }))} />
              <FInput label="Max Occupancy" required error={roomErrors.occupancy}
                type="number" min="1" placeholder="e.g. 2"
                disabled={roomForm.platformOwned}
                value={roomForm.occupancy} onChange={e => setRoomForm(f => ({ ...f, occupancy: e.target.value }))} />
            </div>
            <FSelect label="Bed Type" value={roomForm.bedType} disabled={roomForm.platformOwned}
              onChange={e => setRoomForm(f => ({ ...f, bedType: e.target.value }))}>
              {BED_TYPES.map(b => <option key={b}>{b}</option>)}
            </FSelect>
            <FInput label="Base Rate (₹ per room / night)" type="number" min="0" step="0.01"
              placeholder="Leave blank if rate is not available"
              value={roomForm.baseRate} onChange={e => setRoomForm(f => ({ ...f, baseRate: e.target.value }))} />
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">Room Images</label>
              <label className={`border-2 border-dashed border-slate-200 rounded-xl p-5 flex flex-col items-center gap-2 transition-all
                ${roomForm.platformOwned ? "cursor-not-allowed bg-slate-50 opacity-60" : "cursor-pointer hover:border-blue-300 hover:bg-blue-50/40"}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${roomImageFiles?.length ? "bg-blue-100" : "bg-slate-100"}`}>
                  <Upload size={18} className={roomImageFiles?.length ? "text-blue-500" : "text-slate-400"} />
                </div>
                <span className={`text-sm font-medium ${roomImageFiles?.length ? "text-blue-600" : "text-slate-400"}`}>
                  {roomImageFiles?.length ? `${roomImageFiles.length} file(s) selected` : "Upload room images"}
                </span>
                <span className="text-xs text-slate-400">PNG, JPG · Multiple allowed</span>
                <input type="file" className="hidden" accept="image/*" multiple
                  disabled={roomForm.platformOwned}
                  onChange={e => setRoomImageFiles(e.target.files)} />
              </label>
            </div>
            <FTextarea label="Description"
              placeholder="Describe the room, view, features..."
              disabled={roomForm.platformOwned}
              value={roomForm.description} onChange={e => setRoomForm(f => ({ ...f, description: e.target.value }))} />
            <button onClick={saveRoom} disabled={roomSaving}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800
                disabled:opacity-60 text-white py-3 rounded-xl text-sm font-bold transition-all active:scale-[.98]
                flex items-center justify-center gap-2 shadow-md shadow-blue-200">
              {roomSaving
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
                : <><Check size={15} /> {roomForm.platformOwned ? "Save Selling Rate" : editRoomIdx !== null ? "Update Room Type" : "Add Room Type"}</>}
            </button>
          </div>
        </NestedModal>
      )}

      {/* ── Meal Plan Modal ── */}
      {mealModal && (
        <NestedModal
          title={mealForm.platformOwned ? "Set Meal Selling Price" : editMealIdx !== null ? "Edit Meal Plan" : "Add Meal Plan"}
          subtitle={mealForm.platformOwned
            ? "Platform maintains the meal description; this price belongs to your agency"
            : "Set meal plan name, price and description"}
          icon={Utensils}
          iconBg="bg-emerald-100"
          onClose={() => setMealModal(false)}
        >
          <div className="space-y-4">
            {mealErrors.api && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 flex items-center gap-2">
                <AlertCircle size={14} /> {mealErrors.api}
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600">
                Meal Plan Name <span className="text-rose-500">*</span>
              </label>
              <input list="mealExamples" placeholder="e.g. CP (Breakfast)"
                disabled={mealForm.platformOwned}
                value={mealForm.name} onChange={e => setMealForm(f => ({ ...f, name: e.target.value }))}
                className={`border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all
                  ${mealErrors.name ? "border-red-300 bg-red-50/50" : "border-slate-200 bg-white hover:border-slate-300"}`} />
              <datalist id="mealExamples">
                {MEAL_PLAN_EXAMPLES.map(m => <option key={m} value={m} />)}
              </datalist>
              {mealErrors.name && (
                <span className="text-xs text-red-500 flex items-center gap-1 font-medium">
                  <AlertCircle size={10} />{mealErrors.name}
                </span>
              )}
            </div>
            <FInput label="Price (₹ per person)" required error={mealErrors.price}
              type="number" min="0" placeholder="e.g. 800"
              value={mealForm.price} onChange={e => setMealForm(f => ({ ...f, price: e.target.value }))} />
            <FTextarea label="What's Included"
              placeholder="Breakfast buffet, evening snacks, beverages..."
              disabled={mealForm.platformOwned}
              value={mealForm.description} onChange={e => setMealForm(f => ({ ...f, description: e.target.value }))} />
            <button onClick={saveMeal} disabled={mealSaving}
              className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800
                disabled:opacity-60 text-white py-3 rounded-xl text-sm font-bold transition-all active:scale-[.98]
                flex items-center justify-center gap-2 shadow-md shadow-emerald-200">
              {mealSaving
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
                : <><Check size={15} /> {editMealIdx !== null ? "Update Meal Plan" : "Add Meal Plan"}</>}
            </button>
          </div>
        </NestedModal>
      )}
    </div>
  );
}
