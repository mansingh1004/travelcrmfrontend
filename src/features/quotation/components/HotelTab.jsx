
import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import {
  Hotel, Search, Info, Plus, IndianRupee, Star, MapPin,
  ChevronDown, Edit2, X, Check, Upload, AlertCircle, BedDouble, ShieldCheck
} from "lucide-react";
import { Label, Input, Select, SectionCard, RemoveBtn, IncludeToggle, RichText } from "./Ui";
import { ROOM_TYPES, MEAL_PLANS } from "../Constants";
import { hotelService, uploadHotelImageToCloudinary } from "@features/masters";
import { geographyService } from "@shared/api/geographyService";
import { getErrorMessage } from "@shared/api/apiError";

/* Room type ready list (dropdown ke liye) */
const ROOM_TYPE_OPTIONS = ["Standard", "Deluxe", "Super Deluxe", "Suite", "Executive", "Premium"];

function calcNights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const diff = new Date(checkOut) - new Date(checkIn);
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

/* ════════════════════════════════════════════════════════
   INLINE HOTEL SEARCH DROPDOWN
═══════════════════════════════════════════════════════ */
function HotelSearchDropdown({ value, onSelect, allHotels, loading, onAdd, onEdit, selectedHotelId, selectedPlatformOwned = false, defaultCity = "", placeholder = "Type to search hotels..." }) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState("");
  const [pos,    setPos]    = useState(null);

  const buttonRef = useRef(null);
  const searchRef = useRef(null);
  const panelRef  = useRef(null);

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
        panelRef.current  && !panelRef.current.contains(e.target)
      ) { setOpen(false); setSearch(""); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const getImage = (h) =>
    h.imagePath || h.imageUrl || h.image || h.photo || h.coverImage
    || h.hotelImage || h.imageURL || h.img
    || (Array.isArray(h.images) && h.images[0]) || null;
  const getCity = (h) =>
    h.city || h.destinationName || h.cityName || h.location || "";
  const starLabel = (h) => h.stars ? ` (${h.stars} Star)` : "";

  const term = search.trim().toLowerCase();

  // ── Flexible city match: "Dubai" ↔ "Dubai, UAE" sab match ──
  const cityMatches = (h) => {
    const hc = getCity(h).trim().toLowerCase();
    const dc = (defaultCity || "").trim().toLowerCase();
    if (!hc || !dc) return false;
    return hc === dc || hc.includes(dc) || dc.includes(hc);
  };

  // ── STRICT city filter: city set hai to SIRF usi city ke hotels. Match na ho to khaali. ──
  const selectableHotels = (allHotels || []).filter((hotel) => {
    const platformOwned = hotel.platformOwned || hotel.origin === "PLATFORM_SYNC";
    if (!platformOwned) return true;
    return hotel.syncStatus !== "SOURCE_INACTIVE" && hotel.marketplaceBookable !== false;
  });
  const baseList = defaultCity ? selectableHotels.filter(cityMatches) : selectableHotels;
  const filtered = term
    ? baseList.filter(h => (h.name || "").toLowerCase().includes(term))
    : baseList;

  if (defaultCity && (allHotels || []).length > 0) {
    console.log(`[HOTEL strict city] "${defaultCity}" → ${baseList.length}/${allHotels.length} hotels`);
  }

  const handleToggle = () => { setOpen(p => !p); setSearch(""); };
  const handlePick = (hotel) => {
    setOpen(false); setSearch("");
    onSelect?.({ ...hotel, _image: getImage(hotel), _city: getCity(hotel) });
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
          placeholder="Search hotel name or city..."
          className="w-full pl-8 pr-2 py-2 text-sm rounded-lg border border-slate-200
            outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20"
        />
      </div>
      {defaultCity && (
        <div className="flex items-center px-3 py-1.5 bg-violet-50 border-b border-violet-100 flex-shrink-0">
          <span className="text-[11px] font-semibold text-violet-700 flex items-center gap-1">
            <MapPin size={11} /> {defaultCity} hotels only
          </span>
        </div>
      )}
      <ul className="overflow-y-auto flex-1 min-h-0">
        {filtered.length === 0 ? (
          <li className="px-3 py-4 text-sm text-slate-400 text-center">
            {(allHotels || []).length === 0 ? "No hotels found in master" : defaultCity ? `No hotels found for ${defaultCity}` : "No matching hotels"}
          </li>
        ) : (
          filtered.map((h, idx) => {
            const img  = getImage(h);
            const city = getCity(h);
            const sel  = h.name === value;
            return (
              <li
                key={h.publicId || h.hotelId || h.id || idx}
                onClick={() => handlePick(h)}
                className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors border-b border-slate-50 last:border-0
                  ${sel ? "bg-violet-50" : "hover:bg-violet-50/60"}`}>
                {img ? (
                  <img src={img} alt={h.name}
                    onError={(e) => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }}
                    className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-slate-200" />
                ) : null}
                <div style={{ display: img ? "none" : "flex" }}
                  className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-100 to-violet-200 items-center justify-center flex-shrink-0 text-base">
                  🏨
                </div>
                <div className="min-w-0 flex-1">
                  <span className={`text-sm truncate block ${sel ? "text-violet-700 font-semibold" : "text-slate-700 font-medium"}`}>
                    {h.name}{starLabel(h)}
                  </span>
                  {(h.platformOwned || h.origin === "PLATFORM_SYNC") && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-violet-700">
                      <ShieldCheck size={9} /> Platform
                    </span>
                  )}
                  {city && (
                    <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                      <MapPin size={9} className="text-rose-400 flex-shrink-0" />
                      <span className="truncate">{city}</span>
                    </div>
                  )}
                </div>
                {h.stars > 0 && (
                  <span className="flex items-center gap-0.5 flex-shrink-0">
                    {Array.from({ length: h.stars }).map((_, k) => (
                      <Star key={k} size={9} className="fill-amber-400 text-amber-400" />
                    ))}
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
    <div className="relative min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        {/* Search button */}
        <button
          ref={buttonRef} type="button" onClick={handleToggle} disabled={loading}
          className="flex-1 min-w-0 flex items-center justify-between gap-2 pl-3 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white
            text-sm text-left focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400
            transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:border-slate-300">
          <span className={`truncate ${value ? "text-slate-700 font-medium" : "text-slate-400"}`}>
            {loading ? "Loading hotels..." : (value || placeholder)}
          </span>
          <ChevronDown size={16} className={`text-slate-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {/* ➕ Add button */}
        <button
          type="button" onClick={onAdd} title="Add new hotel"
          className="w-9 h-10 sm:w-10 flex items-center justify-center rounded-xl bg-blue-50 hover:bg-blue-600
            text-blue-600 hover:text-white border border-blue-200 hover:border-blue-600 transition-all flex-shrink-0">
          <Plus size={16} strokeWidth={2.5} />
        </button>

        {/* ✏️ Edit button (sirf jab hotel select ho) */}
        <button
          type="button" onClick={onEdit} disabled={!selectedHotelId || selectedPlatformOwned}
          title={selectedPlatformOwned ? "Platform hotel details are managed by SuperAdmin" : selectedHotelId ? "Edit selected hotel" : "Select a hotel first"}
          className="w-9 h-10 sm:w-10 flex items-center justify-center rounded-xl bg-amber-50 hover:bg-amber-500
            text-amber-600 hover:text-white border border-amber-200 hover:border-amber-500 transition-all flex-shrink-0
            disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-amber-50 disabled:hover:text-amber-600">
          <Edit2 size={15} />
        </button>
      </div>
      {panel}
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   ADD / EDIT HOTEL MODAL
═══════════════════════════════════════════════════════ */
const emptyHotelForm = {
  name: "", destinationId: "", city: "", stars: 3, rating: "",
  imagePath: "", roomType: "Standard",
};

/* Exported so the QUICK QUOTATION can open the same modal, exactly as it does with
   SightseeingFormModal. Quick Quotation is in this same feature, so it imports this directly rather
   than through the barrel — this is shared internals, not public API.

   One form, two callers, on purpose: a hotel created from the quick quote has to be
   indistinguishable from one created here, and two forms writing to the Hotel Master would drift in
   their fields, their room-type handling and their validation.
   onSaved(saved, isEdit). */
export function HotelFormModal({ open, onClose, editHotel, onSaved }) {
  const [form,        setForm]        = useState(emptyHotelForm);
  const [errors,      setErrors]      = useState({});
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState("");
  const [imageUploading, setImageUploading] = useState(false);

  // Geography cascades
  const [countries,    setCountries]    = useState([]);
  const [countryId,    setCountryId]    = useState("");
  const [destinations, setDestinations] = useState([]);
  const [cities,       setCities]       = useState([]);
  const [loadingDest,  setLoadingDest]  = useState(false);
  const [loadingCity,  setLoadingCity]  = useState(false);

  // Load countries
  useEffect(() => {
    if (!open) return;
    (async () => {
      try { setCountries(await geographyService.getCountries()); }
      catch { setCountries([]); }
    })();
  }, [open]);

  // Prefill for edit
  useEffect(() => {
    if (!open) return;
    if (editHotel) {
      setForm({
        name:          editHotel.name || "",
        destinationId: String(editHotel.destinationId || ""),
        city:          editHotel.city || "",
        stars:         editHotel.stars || 3,
        rating:        editHotel.rating?.toString() || "",
        imagePath:     editHotel.imagePath || editHotel.imageUrl || "",
        roomType:      editHotel.roomTypes?.[0]?.name || "Standard",
      });
      // Prefill cascade
      (async () => {
        try {
          const dest = await geographyService.getDestinationById(editHotel.destinationId);
          if (dest?.countryId != null) {
            setCountryId(String(dest.countryId));
            setLoadingDest(true);
            try { setDestinations(await geographyService.getDestinationsByCountry(dest.countryId)); }
            finally { setLoadingDest(false); }
          }
          setLoadingCity(true);
          try { setCities(await geographyService.getCitiesByDestination(editHotel.destinationId)); }
          finally { setLoadingCity(false); }
        } catch { /* best-effort */ }
      })();
    } else {
      setForm(emptyHotelForm);
      setCountryId(""); setDestinations([]); setCities([]);
    }
    setErrors({}); setSaveError("");
  }, [open, editHotel]);

  const handleCountryChange = async (cid) => {
    setCountryId(cid);
    setForm(f => ({ ...f, destinationId: "", city: "" }));
    setDestinations([]); setCities([]);
    if (!cid) return;
    setLoadingDest(true);
    try { setDestinations(await geographyService.getDestinationsByCountry(cid)); }
    catch { setDestinations([]); }
    finally { setLoadingDest(false); }
  };

  const handleDestChange = async (did) => {
    setForm(f => ({ ...f, destinationId: did, city: "" }));
    setCities([]);
    if (!did) return;
    setLoadingCity(true);
    try { setCities(await geographyService.getCitiesByDestination(did)); }
    catch { setCities([]); }
    finally { setLoadingCity(false); }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.match("image.*")) { setSaveError("Please select a valid image."); return; }
    setImageUploading(true); setSaveError("");
    try {
      const url = await uploadHotelImageToCloudinary(file);
      setForm(f => ({ ...f, imagePath: url }));
    } catch (err) {
      setSaveError(getErrorMessage(err, "Image upload failed."));
    } finally { setImageUploading(false); }
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim())   e.name          = "Required";
    if (!form.destinationId) e.destinationId = "Required";
    if (!form.city)          e.city          = "Required";
    if (!form.stars)         e.stars         = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true); setSaveError("");
    try {
      // Backend ko bhejne ke liye — roomTypes array banao
      const payload = {
        ...form,
        roomTypes: form.roomType ? [{ name: form.roomType, occupancy: 2, bedType: "King" }] : [],
      };
      let saved;
      if (editHotel) {
        const res = await hotelService.updateHotel(editHotel.hotelId || editHotel.id, payload);
        saved = res.data?.data ?? res.data;
      } else {
        const res = await hotelService.createHotel(payload);
        saved = res.data?.data ?? res.data;
      }
      onSaved?.(saved, !!editHotel);  // parent ko batao (list refresh + auto-select)
      onClose();
    } catch (err) {
      setSaveError(err?.response?.data?.message || "Failed to save hotel.");
    } finally { setSaving(false); }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[2147483646] flex items-center justify-center p-3 sm:p-4"
      style={{ background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full sm:max-w-lg rounded-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: "92vh", animation: "htmSlide .22s ease both" }}>
        <style>{`@keyframes htmSlide{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>

        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 flex-shrink-0
          bg-gradient-to-r from-violet-600 to-violet-700 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center ring-1 ring-white/30">
              <Hotel size={17} className="text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-[15px]">
                {editHotel ? "Edit Hotel" : "Add New Hotel"}
              </h3>
              <p className="text-[11px] text-violet-200">Saves to Hotel Master too</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {saveError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 flex items-center gap-2">
              <AlertCircle size={14} className="flex-shrink-0" /> {saveError}
            </div>
          )}

          {/* Hotel Name */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600">
              Hotel Name <span className="text-rose-500">*</span>
            </label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. The Grand Palace"
              className={`border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all
                ${errors.name ? "border-red-300 bg-red-50/50" : "border-slate-200 hover:border-slate-300"}`}
            />
            {errors.name && <span className="text-xs text-red-500">{errors.name}</span>}
          </div>

          {/* Country / Destination / City */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600">Country <span className="text-rose-500">*</span></label>
              <select value={countryId} onChange={e => handleCountryChange(e.target.value)}
                className="border border-slate-200 hover:border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400">
                <option value="">{countries.length === 0 ? "Loading…" : "Select"}</option>
                {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600">Destination <span className="text-rose-500">*</span></label>
              <select value={form.destinationId} onChange={e => handleDestChange(e.target.value)}
                disabled={!countryId || loadingDest}
                className={`border rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400
                  ${errors.destinationId ? "border-red-300" : "border-slate-200 hover:border-slate-300"}`}>
                <option value="">{!countryId ? "Country first" : loadingDest ? "Loading…" : "Select"}</option>
                {destinations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600">City <span className="text-rose-500">*</span></label>
              <select value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                disabled={!form.destinationId || loadingCity}
                className={`border rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400
                  ${errors.city ? "border-red-300" : "border-slate-200 hover:border-slate-300"}`}>
                <option value="">{!form.destinationId ? "Destination first" : loadingCity ? "Loading…" : "Select"}</option>
                {cities.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {/* Star Category + Star Rating */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600">Star Category <span className="text-rose-500">*</span></label>
              <select value={form.stars} onChange={e => setForm(f => ({ ...f, stars: parseInt(e.target.value) }))}
                className="border border-slate-200 hover:border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400">
                {[1,2,3,4,5].map(s => <option key={s} value={s}>{s} Star{s > 1 ? "s" : ""}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600">Star Rating</label>
              <input type="number" min="0" max="5" step="0.1"
                value={form.rating} onChange={e => setForm(f => ({ ...f, rating: e.target.value }))}
                placeholder="e.g. 4.5"
                className="border border-slate-200 hover:border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400" />
            </div>
          </div>

          {/* Room Type */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600">Room Type</label>
            <select value={form.roomType} onChange={e => setForm(f => ({ ...f, roomType: e.target.value }))}
              className="border border-slate-200 hover:border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400">
              {ROOM_TYPE_OPTIONS.map(rt => <option key={rt} value={rt}>{rt}</option>)}
            </select>
          </div>

          {/* Hotel Image */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600">
              Hotel Image
              {imageUploading && <span className="ml-2 text-violet-500 animate-pulse">Uploading...</span>}
            </label>
            {form.imagePath && !imageUploading && (
              <div className="relative inline-block w-full mb-1">
                <img src={form.imagePath} alt="Hotel"
                  className="w-full max-h-44 object-cover rounded-xl border border-slate-200" />
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, imagePath: "" }))}
                  className="absolute top-2 right-2 bg-rose-500 text-white p-1.5 rounded-lg hover:bg-rose-600 shadow-md">
                  <X size={14} />
                </button>
              </div>
            )}
            <label className={`border-2 border-dashed rounded-xl p-4 flex items-center gap-3 cursor-pointer transition-all group
              ${imageUploading ? "border-violet-300 bg-violet-50" : "border-slate-200 hover:border-violet-300 hover:bg-violet-50/40"}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
                ${form.imagePath ? "bg-violet-100" : "bg-slate-100 group-hover:bg-violet-100"}`}>
                {imageUploading
                  ? <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                  : <Upload size={16} className={form.imagePath ? "text-violet-500" : "text-slate-400 group-hover:text-violet-500"} />}
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-semibold truncate ${form.imagePath ? "text-violet-600" : "text-slate-400 group-hover:text-violet-500"}`}>
                  {imageUploading ? "Uploading to cloud..." : form.imagePath ? "Change image" : "Click to upload"}
                </p>
                <p className="text-xs text-slate-400">PNG, JPG up to 10MB</p>
              </div>
              <input type="file" className="hidden" accept="image/*" disabled={imageUploading} onChange={handleImageUpload} />
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-4 border-t border-slate-100 flex-shrink-0">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 border-2 border-slate-200 hover:border-slate-300 text-slate-600 font-bold text-sm rounded-xl transition-all bg-white hover:bg-slate-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || imageUploading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 font-bold text-sm rounded-xl text-white
              bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 transition-all
              disabled:opacity-60 disabled:cursor-not-allowed shadow-md shadow-violet-200">
            {saving
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
              : <><Check size={15} /> {editHotel ? "Update Hotel" : "Add Hotel"}</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ════════════════════════════════════════════════════════
   MAIN HOTEL TAB
═══════════════════════════════════════════════════════ */
export default function HotelTab({ onDataChange, paxInfo = {}, destinations = [], defaultIncluded = true, initialData = null }) {
  const [included, setIncluded] = useState(defaultIncluded);
  const [title,    setTitle]    = useState("Hotel Details");
  const [notes,    setNotes]    = useState("");
  const [hotels,   setHotels]   = useState([newHotel()]);
  const hotelsAutoFilledRef = useRef(false);  // destinations se hotels ek hi baar auto-build ho
  const hydratedRef = useRef(false);          // saved quotation ek hi baar seed ho
  const includeTouchedRef = useRef(false);

  const [allHotels,     setAllHotels]     = useState([]);
  const [hotelsLoading, setHotelsLoading] = useState(true);

  // Modal state
  const [modalOpen,   setModalOpen]   = useState(false);
  const [editHotel,   setEditHotel]   = useState(null);
  const [activeRowId, setActiveRowId] = useState(null); // kis hotel row ke liye modal khula

  // ── Hotels load (reusable) ──
  // fetchAllHotels, NOT the paged list: the picker must be able to offer EVERY hotel the tenant
  // has. It used to call a bare GET that returned only the server's first page, so any hotel past
  // the newest 20 was unquotable — invisible here while sitting fine in the master.
  const loadHotels = useCallback(async () => {
    try {
      setHotelsLoading(true);
      const list = await hotelService.fetchAllHotels();
      setAllHotels(list);
      return list;
    } catch (err) {
      console.error("Hotel load error:", err);
      setAllHotels([]);
      return [];
    } finally {
      setHotelsLoading(false);
    }
  }, []);

  useEffect(() => { loadHotels(); }, [loadHotels]);

  function newHotel(city = "", checkIn = "", checkOut = "", nights = null) {
    return {
      id: Date.now() + Math.random(),
      name: "", city, checkIn, checkOut,
      roomType: "", mealPlan: "", refundable: true,
      pricePerRoom: 0, rooms: 1,
      imagePath: "", hotelId: null, platformHotelPublicId: null, platformOwned: false, stars: 0,
      _nightsHint: nights,  // display ke liye, backend ko nahi jaata
    };
  }

  // ── EDIT MODE PREFILL — saved quotation se state seed karo (ek hi baar) ──
  // Saved rows me `id` nahi hota (payload strip kar deta hai) par UI keys aur update/remove
  // usi id pe chalte hain — isliye naye id lagate hain.
  // Saath hi auto-build/auto-fill ko band kar dete hain: saved data hamesha lead ke
  // itinerary-derived defaults se upar hai.
  useEffect(() => {
    if (hydratedRef.current || !initialData) return;
    hydratedRef.current = true;
    includeTouchedRef.current = true;
    hotelsAutoFilledRef.current = true;

    if (typeof initialData.included === "boolean") setIncluded(initialData.included);
    if (initialData.title) setTitle(initialData.title);
    if (initialData.notes) setNotes(initialData.notes);
    if (Array.isArray(initialData.hotels) && initialData.hotels.length > 0) {
      setHotels(initialData.hotels.map(h => ({
        ...newHotel(),
        ...h,
        id: Date.now() + Math.random(),
        // Saved rooms ko lead-wala auto-fill dobara na chhue.
        _roomsTouched: true,
      })));
    }
  }, [initialData]);

  // ── Lead ke services se Include default (remount key ki jagah) ──
  useEffect(() => {
    if (includeTouchedRef.current) return;
    setIncluded(defaultIncluded);
  }, [defaultIncluded]);

  // ── Lead ke itinerary se ek hotel-row per city auto-build ──
  // Sirf EK BAAR chalta hai jab destinations aata hai aur hotels abhi tak default/pristine hai.
  useEffect(() => {
    if (!destinations.length || hotelsAutoFilledRef.current) return;
    const isPristine = hotels.length === 1 && !hotels[0].name && !hotels[0].city;
    if (!isPristine) return;  // user ne already kuch edit kar diya, overwrite mat karo

    const built = destinations.map(d => newHotel(d.city, d.checkIn, d.checkOut, d.nights));
    setHotels(built);
    hotelsAutoFilledRef.current = true;
    console.log("=== HOTEL ROWS AUTO-BUILT FROM LEAD ITINERARY ===", built.map(h => ({ city: h.city, checkIn: h.checkIn, checkOut: h.checkOut })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destinations]);

  const hotelTotals = hotels.map(h => {
    const nights = calcNights(h.checkIn, h.checkOut);
    return Number(h.pricePerRoom) * Number(h.rooms) * nights || 0;
  });
  const hotelTotal = hotelTotals.reduce((a, b) => a + b, 0);

  // ── paxInfo.rooms aane par hotels ka rooms auto-fill (default 1 ko hi replace karo) ──
  useEffect(() => {
    const r = Number(paxInfo.rooms) || 0;
    if (r > 0) {
      setHotels(prev => prev.map(h => (
        (!h._roomsTouched && (h.rooms === 1 || h.rooms === "1" || !h.rooms))
          ? { ...h, rooms: r }
          : h
      )));
    }
     
  }, [paxInfo.rooms]);

  useEffect(() => {
    onDataChange?.({ included, title, notes, hotels, amount: hotelTotal });
  }, [included, title, notes, hotels, hotelTotal]);

  const addHotel    = () => setHotels(p => [...p, newHotel()]);
  const removeHotel = (id) => setHotels(p => p.filter(h => h.id !== id));
  const updateHotel = (id, k, v) =>
    setHotels(p => p.map(h => h.id === id ? { ...h, [k]: v } : h));

  const handleHotelSelect = (id, hotel) => {
    setHotels(prev => prev.map(h => {
      if (h.id !== id) return h;
      return {
        ...h,
        name:     hotel.name || h.name,
        city:     hotel._city || hotel.city || hotel.destinationName || h.city,
        imagePath: hotel._image || hotel.imagePath || hotel.imageUrl || "",
        hotelId:  hotel.publicId || hotel.hotelId || hotel.id || null,
        platformHotelPublicId: hotel.platformHotelPublicId || null,
        platformOwned: hotel.platformOwned === true || hotel.origin === "PLATFORM_SYNC",
        stars:    hotel.stars || 0,
      };
    }));
  };

  // ── Add button → modal khaali ──
  const handleAdd = (rowId) => {
    setActiveRowId(rowId);
    setEditHotel(null);
    setModalOpen(true);
  };

  // ── Edit button → modal with selected hotel ka data ──
  const handleEdit = (rowId, hotelRow) => {
    if (!hotelRow.hotelId) return;
    // allHotels mein se poora hotel object dhundo
    const fullHotel = allHotels.find(
      h => (h.publicId || h.hotelId || h.id) === hotelRow.hotelId
    );
    if (fullHotel?.platformOwned || fullHotel?.origin === "PLATFORM_SYNC") return;
    setActiveRowId(rowId);
    setEditHotel(fullHotel || { ...hotelRow });
    setModalOpen(true);
  };

  // ── Modal save hone par → list refresh + row auto-fill ──
  const handleModalSaved = async (savedHotel) => {
    const freshList = await loadHotels();
    // saved hotel ko allHotels se nikaalo (latest data)
    const fresh = freshList.find(
      h => (h.publicId || h.hotelId || h.id) ===
           (savedHotel?.publicId || savedHotel?.hotelId || savedHotel?.id)
    ) || savedHotel;

    if (fresh && activeRowId != null) {
      const getImg  = (h) => h.imagePath || h.imageUrl || h.image || "";
      const getCity = (h) => h.city || h.destinationName || "";
      setHotels(prev => prev.map(h => {
        if (h.id !== activeRowId) return h;
        return {
          ...h,
          name:     fresh.name || h.name,
          city:     getCity(fresh) || h.city,
          imagePath: getImg(fresh) || "",
          hotelId:  fresh.publicId || fresh.hotelId || fresh.id || null,
          stars:    fresh.stars || 0,
        };
      }));
    }
    setActiveRowId(null);
  };

  return (
    <div className="space-y-4 sm:space-y-5">

      {/* Add/Edit modal */}
      <HotelFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditHotel(null); }}
        editHotel={editHotel}
        onSaved={handleModalSaved}
      />

      {/* ── Rooms banner (lead se) ── */}
      {paxInfo.rooms ? (
        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-violet-50 border border-violet-100">
          <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center flex-shrink-0">
            <BedDouble size={18} className="text-white" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-violet-400 uppercase tracking-wider">Hotel Rooms</p>
            <p className="text-sm font-extrabold text-slate-800">
              {paxInfo.rooms} Room{paxInfo.rooms > 1 ? "s" : ""}
              {paxInfo.totalPax > 0 && (
                <span className="text-slate-400 font-medium ml-2">for {paxInfo.totalPax} Traveler{paxInfo.totalPax > 1 ? "s" : ""}</span>
              )}
            </p>
          </div>
        </div>
      ) : null}

      {/* ── Settings ── */}
      <SectionCard title="Hotel Settings" icon={Hotel}>
        <div className="space-y-4 sm:space-y-5">
          <IncludeToggle
            included={included}
            onChange={() => { includeTouchedRef.current = true; setIncluded(p => !p); }}
            label="Include Hotels in Quotation"
          />
          {included && (
            <>
              <div>
                <Label>Section Title</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Hotel Details" />
              </div>
              <div>
                <Label>Hotel Notes</Label>
                <RichText value={notes} onChange={setNotes}
                  placeholder="Add notes about hotel selection, policies, etc." rows={3} />
              </div>
            </>
          )}
        </div>
      </SectionCard>

      {/* ── Hotel Cards ── */}
      {included && hotels.map((h, hi) => {
        const nights    = calcNights(h.checkIn, h.checkOut);
        const thisTotal = hotelTotals[hi];

        return (
          <SectionCard
            key={h.id}
            title={hi === 0 ? "Default Hotel Option" : `Hotel Option ${hi + 1}`}
            icon={Hotel}
            headerRight={
              <div className="flex items-center gap-2 flex-shrink-0">
                <span
                  className={`text-[10px] sm:text-[11px] font-bold px-2 sm:px-2.5 py-1 rounded-full border cursor-pointer transition-all whitespace-nowrap
                    ${h.refundable
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-rose-50 text-rose-600 border-rose-200"}`}
                  onClick={() => updateHotel(h.id, "refundable", !h.refundable)}>
                  {h.refundable ? "Refundable" : "Non-Refundable"}
                </span>
                {hotels.length > 1 && <RemoveBtn onClick={() => removeHotel(h.id)} />}
              </div>
            }>

            <div className="space-y-3 sm:space-y-4">

              {/* Hotel Name (searchable + add/edit) + City */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="min-w-0">
                  <Label required>Hotel Name</Label>
                  <HotelSearchDropdown
                    value={h.name}
                    onSelect={(hotel) => handleHotelSelect(h.id, hotel)}
                    allHotels={allHotels}
                    loading={hotelsLoading}
                    onAdd={() => handleAdd(h.id)}
                    onEdit={() => handleEdit(h.id, h)}
                    selectedHotelId={h.hotelId}
                    selectedPlatformOwned={h.platformOwned || allHotels.some((hotel) =>
                      (hotel.publicId || hotel.hotelId || hotel.id) === h.hotelId
                      && (hotel.platformOwned || hotel.origin === "PLATFORM_SYNC"))}
                    defaultCity={h.city}
                    placeholder={h.city ? `Search hotels in ${h.city}...` : "Type to search hotels..."}
                  />
                </div>
                <div>
                  <Label required>City</Label>
                  {/* City lead ke itinerary se aati hai aur LOCKED (disabled) hai — user badal
                      nahi sakta. Yahi city upar wale hotel search ko us city pe scope karti hai. */}
                  <Input value={h.city} placeholder="City (from lead)" />
                </div>
              </div>

              {/* ── Hotel image preview ── */}
              {h.imagePath && (
                <div className="flex items-center gap-3 p-2.5 bg-violet-50 rounded-xl border border-violet-100">
                  <img src={h.imagePath} alt={h.name}
                    className="w-20 h-16 rounded-lg object-cover flex-shrink-0 border border-violet-200 shadow-sm" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-slate-800 truncate">{h.name}</p>
                      {h.stars > 0 && (
                        <span className="flex items-center gap-0.5 flex-shrink-0">
                          {Array.from({ length: h.stars }).map((_, k) => (
                            <Star key={k} size={10} className="fill-amber-400 text-amber-400" />
                          ))}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                      <MapPin size={10} className="text-rose-400" /> {h.city}
                    </p>
                    <span className="inline-block mt-1 text-[10px] font-bold text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full">
                      ✓ From Hotel Master
                    </span>
                  </div>
                </div>
              )}

              {/* Dates + Room Type + Meal Plan */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <Label required>Check-In</Label>
                  <Input type="date" value={h.checkIn} onChange={e => updateHotel(h.id, "checkIn", e.target.value)} />
                </div>
                <div>
                  <Label required>Check-Out</Label>
                  <Input type="date" value={h.checkOut} onChange={e => updateHotel(h.id, "checkOut", e.target.value)} />
                </div>
                <div>
                  <Label>Room Type</Label>
                  <Select options={ROOM_TYPES} value={h.roomType}
                    onChange={e => updateHotel(h.id, "roomType", e.target.value)} placeholder="Select room" />
                </div>
                <div>
                  <Label>Meal Plan</Label>
                  <Select options={MEAL_PLANS} value={h.mealPlan}
                    onChange={e => updateHotel(h.id, "mealPlan", e.target.value)} placeholder="Select plan" />
                </div>
              </div>

              {/* Price Box */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 sm:p-4 rounded-2xl bg-violet-50 border border-violet-100">
                <div>
                  <Label>Price / Room (₹)</Label>
                  <Input type="number" min={0} value={h.pricePerRoom}
                    onChange={e => updateHotel(h.id, "pricePerRoom", e.target.value)} placeholder="0" />
                </div>
                <div>
                  <Label>Rooms</Label>
                  <Input type="number" min={1} value={h.rooms}
                    onChange={e => setHotels(p => p.map(x => x.id === h.id ? { ...x, rooms: e.target.value, _roomsTouched: true } : x))} placeholder="1" />
                </div>
                <div>
                  <Label>Nights</Label>
                  <div className="h-10 flex items-center justify-center bg-white border border-violet-200 rounded-xl text-sm font-extrabold text-violet-700">
                    {nights > 0 ? `${nights}N` : "—"}
                  </div>
                </div>
                <div>
                  <Label>Hotel Total</Label>
                  <div className="h-10 flex items-center justify-center bg-violet-600 rounded-xl text-sm font-extrabold text-white">
                    ₹{thisTotal.toLocaleString("en-IN")}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-700 font-medium flex items-center gap-2">
                <Info size={13} className="flex-shrink-0" />
                <span>Nights auto-calculated · Total = Price × Rooms × Nights</span>
              </div>

            </div>
          </SectionCard>
        );
      })}

      {/* ── Add Hotel Option + Total ── */}
      {included && (
        <>
          <button onClick={addHotel} type="button"
            className="w-full py-3 border-2 border-dashed border-slate-300
              hover:border-violet-400 hover:bg-violet-50/40 text-slate-500 hover:text-violet-600
              text-sm font-bold rounded-2xl transition-all flex items-center justify-center gap-2">
            <Plus size={16} strokeWidth={2.5} /> Add Hotel Option
          </button>

          <div className="flex items-center justify-between p-3 sm:p-4 rounded-2xl"
            style={{ background: "linear-gradient(135deg,#7C3AED,#4C1D95)" }}>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <IndianRupee size={16} className="text-white" />
              </div>
              <div>
                <p className="text-[10px] text-violet-200 font-semibold uppercase tracking-wider">Hotel Total</p>
                <p className="text-[11px] text-violet-300">{hotels.length} option{hotels.length > 1 ? "s" : ""}</p>
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-extrabold text-white">₹{hotelTotal.toLocaleString("en-IN")}</p>
          </div>
        </>
      )}
    </div>
  );
}
