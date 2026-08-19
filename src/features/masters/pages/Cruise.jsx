import { useState, useEffect, useRef } from "react";
import { safeHtml } from "@shared/lib/safeHtml";

/* ─────────────────────────────────────────────
   TOAST SYSTEM (Converted to Tailwind)
───────────────────────────────────────────── */
let _toastSetter = null;
const toast = {
  success: (msg) => _toastSetter?.({ msg, type: "success", id: Date.now() }),
  error:   (msg) => _toastSetter?.({ msg, type: "error",   id: Date.now() }),
};

function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  
  useEffect(() => {
    _toastSetter = (t) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => setToasts((p) => p.filter((x) => x.id !== t.id)), 3200);
    };
    return () => { _toastSetter = null; };
  }, []);
  
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2.5">
      {toasts.map((t) => (
        <div key={t.id} className={`${t.type === "success" ? "bg-emerald-500" : "bg-[#ff6b6b]"} text-white rounded-xl px-5 py-3 font-semibold text-sm shadow-[0_8px_24px_rgba(0,0,0,0.2)] max-w-xs flex items-center gap-2 animate-in fade-in slide-in-from-bottom-5 duration-200`}>
          <span>{t.type === "success" ? "✓" : "✕"}</span>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   SEED DATA
───────────────────────────────────────────── */
const SEED = [
  {
    id: 1,
    name: "Azure Horizon",
    description: "A luxurious 7-night Mediterranean voyage with world-class dining.",
    image: null,
    roomTypes: [
      { id: 1, name: "Deluxe Room",  capacity: 2, price: 15000, description: "Luxury ocean-view room" },
      { id: 2, name: "Suite",        capacity: 4, price: 28000, description: "Premium balcony suite" },
    ],
    created: "2025-11-12",
  },
  {
    id: 2,
    name: "Pearl of the Pacific",
    description: "Explore hidden coves and tropical islands on this 10-day Pacific tour.",
    image: null,
    roomTypes: [
      { id: 1, name: "Standard Cabin", capacity: 2, price: 9000,  description: "Cozy inner cabin" },
      { id: 2, name: "Premium Suite",  capacity: 3, price: 22000, description: "Panoramic sea views" },
    ],
    created: "2025-12-01",
  },
];

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
const fmt = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
const priceRange = (rooms) => {
  if (!rooms.length) return "—";
  const prices = rooms.map((r) => Number(r.price));
  return `${fmt(Math.min(...prices))} – ${fmt(Math.max(...prices))}`;
};
const today = () => new Date().toISOString().slice(0, 10);

const EMPTY_FORM = { name: "", description: "", image: null, imagePreview: null };
const EMPTY_ROOM = { name: "", capacity: "", price: "", description: "" };

/* ─────────────────────────────────────────────
   ROOM TYPE MINI-MODAL
───────────────────────────────────────────── */
function RoomModal({ room, onSave, onClose }) {
  const [form, setForm] = useState(room || { ...EMPTY_ROOM });
  const [errs, setErrs] = useState({});
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  
  const validate = () => {
    const e = {};
    if (!form.name.trim())          e.name     = "Room name required";
    if (!form.capacity || isNaN(+form.capacity) || +form.capacity <= 0) e.capacity = "Valid capacity required";
    if (!form.price    || isNaN(+form.price)    || +form.price    <= 0) e.price    = "Valid price required";
    setErrs(e);
    return !Object.keys(e).length;
  };
  
  const save = () => { if (validate()) onSave({ ...form, capacity: +form.capacity, price: +form.price }); };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1100] flex items-center justify-center p-5" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white border border-slate-200 rounded-[18px] w-full max-w-[440px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        <div className="relative bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 flex items-center justify-between overflow-hidden">
          <div className="absolute inset-x-0 -top-1/2 h-full bg-gradient-to-b from-white/20 to-transparent opacity-60 pointer-events-none" />
          <span className="relative text-base font-black text-white">
            {room?.id ? "✏️ Edit Room Type" : "➕ Add Room Type"}
          </span>
          <button className="relative bg-white/20 hover:bg-white/30 text-white rounded-xl w-9 h-9 text-xl cursor-pointer flex items-center justify-center shrink-0 transition-colors" onClick={onClose}>×</button>
        </div>
        
        <div className="p-5.5 px-5 py-5">
          {[
            { k: "name",     label: "Room Type Name *", type: "text"   },
            { k: "capacity", label: "Capacity *",       type: "number" },
            { k: "price",    label: "Price (₹) *",      type: "number" },
          ].map(({ k, label, type }) => (
            <div key={k}>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">{label}</label>
              <input
                type={type}
                value={form[k]}
                onChange={(e) => set(k, e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-lg border ${errs[k] ? 'border-[#ff6b6b]' : 'border-slate-200'} bg-white text-slate-800 text-sm mb-4 outline-none focus:border-blue-500 transition-colors`}
                placeholder={label.replace(" *", "")}
              />
              {errs[k] && <p className="text-[#ff6b6b] text-xs -mt-2.5 mb-2.5">{errs[k]}</p>}
            </div>
          ))}
          
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm mb-4 outline-none resize-y min-h-[90px] focus:border-blue-500 transition-colors"
            placeholder="Brief description…"
            rows={3}
          />
        </div>
        
        <div className="px-5 py-3.5 border-t border-slate-200 flex justify-end gap-3 bg-slate-100">
          <button className="bg-white text-slate-800 border border-slate-200 rounded-xl px-5 py-2 font-semibold text-sm cursor-pointer hover:bg-slate-100 transition-colors" onClick={onClose}>Cancel</button>
          <button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-none rounded-xl px-6 py-2 font-bold text-sm cursor-pointer shadow-md shadow-blue-200 transition-all" onClick={save}>Save Room</button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   VIEW CRUISE MODAL
───────────────────────────────────────────── */
function ViewModal({ cruise, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-start justify-center p-5 overflow-y-auto" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-[1100px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] animate-in fade-in zoom-in-95 duration-200 overflow-hidden my-2.5">
        
        <div className="relative bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 px-5 sm:px-7 py-5 flex items-center justify-between overflow-hidden">
          <div className="absolute inset-x-0 -top-1/2 h-full bg-gradient-to-b from-white/20 to-transparent opacity-60 pointer-events-none" />
          <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10" />
          <div className="relative flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-xl shadow-inner flex-shrink-0">🚢</div>
            <span className="text-lg sm:text-xl font-black text-white truncate">{cruise.name}</span>
          </div>
          <button className="relative bg-white/20 hover:bg-white/30 text-white rounded-xl w-9 h-9 text-xl cursor-pointer flex items-center justify-center shrink-0 transition-colors" onClick={onClose}>×</button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-7 p-7">
          {/* left */}
          <div>
            {cruise.imagePreview || cruise.image ? (
              <img src={cruise.imagePreview || cruise.image} alt="" className="w-full rounded-xl mb-4 max-h-[200px] object-cover border border-slate-200" />
            ) : (
              <div className="w-full h-[140px] rounded-xl bg-slate-100 flex items-center justify-center text-5xl mb-4 border border-slate-200">🛳️</div>
            )}
            <h3 className="m-0 mb-2 text-[#0e4f8a] font-bold text-lg">{cruise.name}</h3>
            <p className="text-slate-600 text-sm leading-relaxed m-0" dangerouslySetInnerHTML={safeHtml(cruise.description || "No description.")} />
            <p className="text-xs text-slate-400 mt-3">Created: {cruise.created}</p>
          </div>
          
          {/* right */}
          <div>
            <p className="text-[15px] font-bold text-[#0a1628] mb-4 pb-2.5 border-b border-slate-200 flex items-center gap-2">🛏️ Room Types ({cruise.roomTypes.length})</p>
            {cruise.roomTypes.map((r) => (
              <div key={r.id} className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 mb-2.5">
                <div className="font-bold text-sm mb-1 text-[#0a1628]">{r.name}</div>
                <div className="text-xs text-slate-600 mb-2">
                  👥 {r.capacity} guests &nbsp;·&nbsp; 💰 {fmt(r.price)}<br />
                  {r.description && <span className="italic text-slate-400 block mt-1">{r.description}</span>}
                </div>
              </div>
            ))}
            <div className="mt-3 px-4 py-3 bg-[#f8fafd] rounded-lg border border-slate-200 flex justify-between items-center">
              <span className="text-xs text-slate-600 font-semibold">Price Range</span>
              <div className="font-bold text-[#1a7fd4] text-base">{priceRange(cruise.roomTypes)}</div>
            </div>
          </div>
        </div>
        
        <div className="px-7 py-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-100">
          <button className="bg-white text-slate-800 border border-slate-200 rounded-lg px-5 py-2.5 font-semibold text-sm cursor-pointer hover:bg-slate-50 transition-colors" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   DELETE CONFIRM MODAL
───────────────────────────────────────────── */
function DeleteModal({ cruise, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1100] flex items-center justify-center p-5">
      <div className="bg-white border border-slate-200 rounded-[18px] w-full max-w-[440px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        
        <div className="p-6 pt-8 text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <span className="absolute inset-0 rounded-2xl bg-red-100 animate-ping opacity-40" />
            <div className="relative w-16 h-16 bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-200 ring-4 ring-red-50 text-2xl">🗑️</div>
          </div>
          <h3 className="text-lg font-black text-slate-900 mb-1">Delete Cruise?</h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            Are you sure you want to delete <span className="font-bold text-slate-800">{cruise.name}</span>?<br className="hidden sm:block" /> This action cannot be undone.
          </p>
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 bg-slate-50">
          <button className="bg-white text-slate-800 border border-slate-200 rounded-xl px-5 py-2.5 font-semibold text-sm cursor-pointer hover:bg-slate-100 transition-colors w-full sm:w-auto" onClick={onClose}>Cancel</button>
          <button className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white border-none rounded-xl px-5 py-2.5 font-bold text-sm cursor-pointer transition-all shadow-md shadow-red-200 w-full sm:w-auto" onClick={onConfirm}>Delete Cruise</button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   CREATE / EDIT CRUISE MODAL
───────────────────────────────────────────── */
function CruiseModal({ cruise, onSave, onClose }) {
  const isEdit = !!cruise?.id;
  const [form, setForm] = useState(
    isEdit
      ? { name: cruise.name, description: cruise.description, image: cruise.image, imagePreview: cruise.imagePreview }
      : { ...EMPTY_FORM }
  );
  const [roomTypes, setRoomTypes] = useState(isEdit ? cruise.roomTypes : []);
  const [errs, setErrs] = useState({});
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hoveredRow, setHoveredRow] = useState(null);
  const fileRef = useRef();
  const nextRoomId = useRef(isEdit ? (Math.max(0, ...cruise.roomTypes.map((r) => r.id)) + 1) : 1);

  const setF = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setF("imagePreview", ev.target.result);
      setF("image", ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim())    e.name      = "Cruise name is required";
    if (!roomTypes.length)    e.roomTypes = "At least one room type is required";
    setErrs(e);
    return !Object.keys(e).length;
  };

  const saveRoom = (room) => {
    if (editingRoom?.id) {
      setRoomTypes((p) => p.map((r) => (r.id === editingRoom.id ? { ...room, id: r.id } : r)));
    } else {
      setRoomTypes((p) => [...p, { ...room, id: nextRoomId.current++ }]);
    }
    setShowRoomModal(false);
    setEditingRoom(null);
    setErrs((p) => ({ ...p, roomTypes: undefined }));
  };

  const deleteRoom = (id) => setRoomTypes((p) => p.filter((r) => r.id !== id));

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    onSave({
      ...(isEdit ? cruise : {}),
      name: form.name.trim(),
      description: form.description,
      image: form.image,
      imagePreview: form.imagePreview,
      roomTypes,
      created: isEdit ? cruise.created : today(),
    });
    setLoading(false);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-start justify-center p-5 overflow-y-auto" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-[1100px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] animate-in fade-in zoom-in-95 duration-200 overflow-hidden my-2.5">
          
          {/* header */}
          <div className="relative bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 px-5 sm:px-7 py-5 flex items-center justify-between overflow-hidden">
            <div className="absolute inset-x-0 -top-1/2 h-full bg-gradient-to-b from-white/20 to-transparent opacity-60 pointer-events-none" />
            <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10" />
            <div className="relative flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-xl shadow-inner flex-shrink-0">🚢</div>
              <div>
                <span className="block text-lg sm:text-xl font-black text-white leading-tight">{isEdit ? "Edit Cruise" : "Create Cruise"}</span>
                <span className="text-xs text-white/70">{isEdit ? "Update cruise & room details" : "Add a new cruise to your fleet"}</span>
              </div>
            </div>
            <button className="relative bg-white/20 hover:bg-white/30 text-white rounded-xl w-9 h-9 text-xl cursor-pointer flex items-center justify-center shrink-0 transition-colors" onClick={onClose}>×</button>
          </div>

          {/* body */}
          <div className="p-7 grid grid-cols-1 md:grid-cols-2 gap-7">
            
            {/* LEFT */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
              <div className="text-[15px] font-bold text-[#0a1628] mb-4 pb-2.5 border-b border-slate-200 flex items-center gap-2">🛳️ Cruise Information</div>

              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Cruise Name *</label>
              <input
                value={form.name}
                onChange={(e) => { setF("name", e.target.value); setErrs((p) => ({ ...p, name: undefined })); }}
                className={`w-full px-3.5 py-2.5 rounded-lg border ${errs.name ? 'border-[#ff6b6b]' : 'border-slate-200'} bg-white text-slate-800 text-sm mb-4 outline-none transition-colors focus:border-blue-500`}
                placeholder="e.g. Azure Horizon"
              />
              {errs.name && <p className="text-[#ff6b6b] text-xs -mt-2.5 mb-2.5">{errs.name}</p>}

              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setF("description", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm mb-4 outline-none resize-y min-h-[90px] focus:border-blue-500 transition-colors"
                placeholder="Describe this cruise experience…"
                rows={4}
              />

              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Cruise Image</label>
              <div className="border-2 border-dashed border-slate-400 rounded-xl p-6 text-center cursor-pointer mb-4 bg-slate-100 transition-all hover:bg-slate-200" onClick={() => fileRef.current?.click()}>
                <div className="text-3xl mb-1.5">📷</div>
                <div className="text-[13px] color-slate-600 font-medium">Click to upload image</div>
                <div className="text-[11px] text-slate-400 mt-1 font-semibold">PNG, JPG up to 10 MB</div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
              </div>

              {form.imagePreview && (
                <>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Image Preview</label>
                  <img src={form.imagePreview} alt="Preview" className="w-full max-h-[160px] object-cover rounded-lg border border-slate-200 mb-4" />
                </>
              )}
            </div>

            {/* RIGHT */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
              <div className="text-[15px] font-bold text-[#0a1628] mb-4 pb-2.5 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
                <span className="flex items-center gap-2">🛏️ Room Types</span>
                <button className="bg-slate-100 text-[#0a1628] border border-slate-200 rounded-lg px-4 py-2 font-bold text-[13px] cursor-pointer flex items-center gap-1.5 hover:bg-slate-200 transition-colors" onClick={() => { setEditingRoom(null); setShowRoomModal(true); }}>
                  + Add Room Type
                </button>
              </div>

              {errs.roomTypes && <p className="text-[#ff6b6b] text-xs -mt-1 mb-3 font-semibold">⚠️ {errs.roomTypes}</p>}

              {!roomTypes.length ? (
                <div className="text-center py-8 px-4 text-slate-400">
                  <div className="text-4xl mb-2.5">🛏️</div>
                  <p className="text-sm text-slate-600 m-0 font-medium">No room types added yet.</p>
                  <p className="text-xs m-0 mt-1">Click <strong>Add Room Type</strong> to add one.</p>
                </div>
              ) : (
                <div className="max-h-[340px] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-black/5 [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-md pr-1">
                  {roomTypes.map((r) => (
                    <div
                      key={r.id}
                      className={`bg-white border ${hoveredRow === r.id ? 'border-[#38bdf8]' : 'border-slate-200'} rounded-xl px-4 py-3.5 mb-2.5 transition-colors`}
                      onMouseEnter={() => setHoveredRow(r.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      <div className="font-bold text-sm mb-1 text-[#0a1628]">{r.name}</div>
                      <div className="text-xs text-slate-600 mb-2">
                        👥 Capacity: <strong className="text-slate-800">{r.capacity}</strong>
                        &nbsp; · &nbsp;
                        💰 Price: <strong className="text-[#0a1628]">{fmt(r.price)}</strong>
                        {r.description && <><br /><span className="italic text-slate-500 mt-1 block">{r.description}</span></>}
                      </div>
                      <div className="flex gap-1.5 flex-wrap mt-2">
                        <button
                          className="bg-[#0e4f8a]/10 text-[#0e4f8a] border border-[#0e4f8a]/30 rounded-lg px-2.5 py-1 text-[13px] font-semibold cursor-pointer hover:bg-[#0e4f8a]/20 transition-colors"
                          onClick={() => { setEditingRoom(r); setShowRoomModal(true); }}
                        >✏️ Edit</button>
                        <button
                          className="bg-[#ff6b6b]/10 text-[#ff6b6b] border border-[#ff6b6b]/30 rounded-lg px-2.5 py-1 text-[13px] font-semibold cursor-pointer hover:bg-[#ff6b6b]/20 transition-colors"
                          onClick={() => deleteRoom(r.id)}
                        >🗑️ Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {roomTypes.length > 0 && (
                <div className="mt-3.5 px-4 py-3 bg-[#f8fafd] rounded-lg border border-slate-200 flex justify-between items-center">
                  <span className="text-xs text-slate-600 font-semibold">Price Range</span>
                  <span className="font-bold text-[#0d1f3c] text-base">{priceRange(roomTypes)}</span>
                </div>
              )}
            </div>
          </div>

          {/* footer */}
          <div className="px-5 sm:px-7 py-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 bg-slate-50">
            <button className="bg-white text-slate-800 border border-slate-200 rounded-xl px-5 py-2.5 font-semibold text-sm cursor-pointer hover:bg-slate-100 transition-colors w-full sm:w-auto" onClick={onClose}>Cancel</button>
            <button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-none rounded-xl px-6 py-2.5 font-bold text-sm cursor-pointer shadow-md shadow-blue-200 disabled:opacity-60 transition-all w-full sm:w-auto" onClick={handleSave} disabled={loading}>
              {loading ? "⏳ Saving…" : isEdit ? "💾 Update Cruise" : "🚀 Save Cruise"}
            </button>
          </div>
        </div>
      </div>

      {showRoomModal && (
        <RoomModal
          room={editingRoom}
          onSave={saveRoom}
          onClose={() => { setShowRoomModal(false); setEditingRoom(null); }}
        />
      )}
    </>
  );
}

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
export default function CruiseMaster() {
  const [cruises,       setCruises]      = useState(SEED);
  const [search,        setSearch]       = useState("");
  const [showCreate,    setShowCreate]   = useState(false);
  const [editingCruise, setEditingCruise]= useState(null);
  const [viewingCruise, setViewingCruise]= useState(null);
  const [deletingCruise,setDeletingCruise]=useState(null);
  const [hoveredRow,    setHoveredRow]   = useState(null);

  const [cruiseStatsOpen, setCruiseStatsOpen] = useState(false);
  const nextId = useRef(SEED.length + 1);

  const filtered = cruises.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase())
  );

  const saveCruise = (data) => {
    if (data.id) {
      setCruises((p) => p.map((c) => (c.id === data.id ? data : c)));
      toast.success("Cruise updated successfully!");
    } else {
      setCruises((p) => [...p, { ...data, id: nextId.current++ }]);
      toast.success("Cruise created successfully!");
    }
    setShowCreate(false);
    setEditingCruise(null);
  };

  const confirmDelete = () => {
    setCruises((p) => p.filter((c) => c.id !== deletingCruise.id));
    toast.success(`"${deletingCruise.name}" deleted.`);
    setDeletingCruise(null);
  };

  const totalRooms = cruises.reduce((a, c) => a + c.roomTypes.length, 0);
  const avgPrice   = cruises.length
    ? cruises.reduce((a, c) => a + (c.roomTypes.length ? c.roomTypes.reduce((s, r) => s + r.price, 0) / c.roomTypes.length : 0), 0) / cruises.length
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 text-slate-800"
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        ::-webkit-scrollbar{width:6px;height:6px}
        ::-webkit-scrollbar-track{background:#f1f5f9;border-radius:99px}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:99px}
      `}</style>

      {/* ── HEADER ── */}
      <header className="bg-white/80 backdrop-blur-xl px-4 sm:px-6 py-4 flex items-center justify-between shadow-sm border-b border-slate-200/60 gap-3 sm:gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-200 overflow-hidden flex-shrink-0">
            <div className="absolute inset-x-0 -top-1/2 h-full bg-gradient-to-b from-white/25 to-transparent opacity-60" />
            <span className="relative text-xl">⚓</span>
          </div>
          <div>
            <h1 className="m-0 text-lg sm:text-xl font-black tracking-tight text-slate-800">Cruise Master</h1>
            <p className="m-0 text-xs text-slate-400 mt-0.5 font-medium">Manage your fleet &amp; room inventory</p>
          </div>
        </div>

        {/* search */}
        <div className="relative w-full sm:flex-1 sm:max-w-[340px] order-3 sm:order-2">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[15px]">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cruises…"
            className="w-full py-2.5 px-4 pl-10 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm outline-none placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>

        <button className="order-2 sm:order-3 flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 shadow-md shadow-blue-200 hover:-translate-y-0.5 whitespace-nowrap flex-shrink-0" onClick={() => setShowCreate(true)}>
          ➕ <span className="hidden sm:inline">Add New Cruise</span><span className="sm:hidden">Add</span>
        </button>
      </header>

      {/* ── MAIN ── */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 pb-16">
        {/* stats */}
        {/* <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {[
            { label: "Total Cruises",    value: cruises.length,  gradient: "from-blue-500 to-indigo-600",   icon: "🚢" },
            { label: "Total Room Types", value: totalRooms,      gradient: "from-amber-500 to-orange-600",  icon: "🛏️" },
            { label: "Avg. Room Price",  value: fmt(avgPrice),   gradient: "from-emerald-500 to-green-600", icon: "💰" },
            { label: "Search Results",   value: filtered.length, gradient: "from-rose-500 to-red-600",      icon: "🔍" },
          ].map((s) => (
            <div key={s.label} className={`relative overflow-hidden bg-gradient-to-br ${s.gradient} rounded-2xl p-4 sm:p-5 shadow-lg ring-1 ring-white/10 hover:-translate-y-0.5 transition-transform`}>
              <div className="absolute inset-x-0 -top-1/2 h-full bg-gradient-to-b from-white/20 to-transparent opacity-60 pointer-events-none" />
              <div className="relative flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center text-xl shadow-inner flex-shrink-0">{s.icon}</div>
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-black text-white leading-none truncate">{s.value}</p>
                  <p className="text-[10px] sm:text-xs text-white/70 mt-1 font-semibold uppercase tracking-wider">{s.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div> */}


        {/* ── COLLAPSIBLE CRUISE ANALYTICS ── */}
<div className="mb-6 bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">

  {/* Toggle header */}
  <button
    type="button"
    onClick={() => setCruiseStatsOpen((previous) => !previous)}
    aria-expanded={cruiseStatsOpen}
    className="w-full px-4 sm:px-5 py-3 flex items-center justify-between gap-3
      hover:bg-slate-50 transition-colors"
  >
    <div className="flex items-center gap-3 flex-wrap min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-base">🚢</span>

        <span className="text-sm font-extrabold text-slate-700">
          Cruise Analytics
        </span>
      </div>

      {/* Small values visible when cards are closed */}
      {!cruiseStatsOpen && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold">
            {cruises.length} Cruises
          </span>

          <span className="px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 text-[11px] font-bold">
            {totalRooms} Room Types
          </span>

          <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-[11px] font-bold">
            Avg. {fmt(avgPrice)}
          </span>

          <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-[11px] font-bold">
            {filtered.length} Results
          </span>
        </div>
      )}
    </div>

    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0 text-xs font-black">
      {cruiseStatsOpen ? "▲" : "▼"}
    </div>
  </button>

  {/* Expandable cards */}
  <div
    className={`grid transition-all duration-300 ease-in-out ${
      cruiseStatsOpen
        ? "grid-rows-[1fr] opacity-100"
        : "grid-rows-[0fr] opacity-0"
    }`}
  >
    <div className="min-h-0 overflow-hidden">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 p-4 pt-1">
        {[
          {
            label: "Total Cruises",
            value: cruises.length,
            gradient: "from-blue-500 to-indigo-600",
            icon: "🚢",
          },
          {
            label: "Total Room Types",
            value: totalRooms,
            gradient: "from-amber-500 to-orange-600",
            icon: "🛏️",
          },
          {
            label: "Avg. Room Price",
            value: fmt(avgPrice),
            gradient: "from-emerald-500 to-green-600",
            icon: "💰",
          },
          {
            label: "Search Results",
            value: filtered.length,
            gradient: "from-rose-500 to-red-600",
            icon: "🔍",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`relative overflow-hidden bg-gradient-to-br ${stat.gradient}
              rounded-2xl p-4 sm:p-5 shadow-lg ring-1 ring-white/10
              hover:-translate-y-0.5 transition-transform`}
          >
            <div className="absolute inset-x-0 -top-1/2 h-full bg-gradient-to-b from-white/20 to-transparent opacity-60 pointer-events-none" />

            <div className="relative flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center text-xl shadow-inner flex-shrink-0">
                {stat.icon}
              </div>

              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-black text-white leading-none truncate">
                  {stat.value}
                </p>

                <p className="text-[10px] sm:text-xs text-white/70 mt-1 font-semibold uppercase tracking-wider">
                  {stat.label}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
</div>

        {/* table */}
        <div className="bg-white/80 backdrop-blur-md border border-slate-200/60 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-black/5 [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-md">
            <table className="w-full border-collapse min-w-[700px]">
              <thead className="bg-slate-50">
                <tr>
                  {["ID", "Image", "Name", "Description", "Room Types", "Price Range", "Created", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-[#0d1f3c] border-b border-slate-200 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!filtered.length ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-3.5 text-sm align-middle border-b border-slate-200 text-center py-[60px] text-slate-400">
                      <div className="text-[44px] mb-2">🌊</div>
                      <p className="m-0 font-medium text-base">No cruises found{search ? ` for "${search}"` : ""}.</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => (
                    <tr
                      key={c.id}
                      className={`${hoveredRow === c.id ? 'bg-[#f8fafd]' : 'bg-transparent'} transition-colors cursor-default`}
                      onMouseEnter={() => setHoveredRow(c.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      <td className="px-4 py-3.5 text-sm align-middle border-b border-slate-200 text-slate-800">
                        <span className="bg-[#0e4f8a]/15 text-[#0e4f8a] border border-[#0e4f8a]/40 rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap font-mono">#{c.id}</span>
                      </td>
                      <td className="px-4 py-3.5 text-sm align-middle border-b border-slate-200 text-slate-800">
                        {c.imagePreview || c.image ? (
                          <img src={c.imagePreview || c.image} alt={c.name} className="w-[60px] h-[42px] object-cover rounded-lg border border-slate-200" />
                        ) : (
                          <div className="w-[60px] h-[42px] rounded-lg bg-slate-100 flex items-center justify-center text-[22px] border border-slate-200 shadow-inner">🛳️</div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-sm align-middle border-b border-slate-200 font-bold text-[#0a1628]">{c.name}</td>
                      <td className="px-4 py-3.5 text-sm align-middle border-b border-slate-200 max-w-[200px]">
                        <div
                          className="overflow-hidden text-ellipsis whitespace-nowrap text-slate-600 text-[13px]"
                          dangerouslySetInnerHTML={safeHtml(c.description || "—")}
                        />
                      </td>
                      <td className="px-4 py-3.5 text-sm align-middle border-b border-slate-200">
                        <span className="bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/40 rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap">{c.roomTypes.length} types</span>
                      </td>
                      <td className="px-4 py-3.5 text-sm align-middle border-b border-slate-200 font-semibold text-[#f59e0b] whitespace-nowrap">
                        {priceRange(c.roomTypes)}
                      </td>
                      <td className="px-4 py-3.5 text-sm align-middle border-b border-slate-200 color-slate-600 text-[13px] whitespace-nowrap">
                        📅 {c.created}
                      </td>
                      <td className="px-4 py-3.5 text-sm align-middle border-b border-slate-200">
                        <div className="flex gap-1.5 flex-wrap">
                          <button className="bg-[#0e4f8a]/10 text-[#0e4f8a] border border-[#0e4f8a]/30 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold cursor-pointer hover:bg-[#0e4f8a]/20 transition-colors" onClick={() => setViewingCruise(c)}>👁️</button>
                          <button className="bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/30 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold cursor-pointer hover:bg-[#f59e0b]/20 transition-colors" onClick={() => setEditingCruise(c)}>✏️</button>
                          <button className="bg-[#ff6b6b]/10 text-[#ff6b6b] border border-[#ff6b6b]/30 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold cursor-pointer hover:bg-[#ff6b6b]/20 transition-colors" onClick={() => setDeletingCruise(c)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* table footer */}
          <div className="px-5 py-3 border-t border-slate-200 text-xs text-slate-600 flex justify-between items-center flex-wrap gap-2 bg-slate-50">
            <span className="font-medium">Showing {filtered.length} of {cruises.length} cruises</span>
            <span className="text-[#0e4f8a] font-bold tracking-wide">⚓ Cruise Master v1.0</span>
          </div>
        </div>
      </main>

      {/* ── MODALS ── */}
      {(showCreate || editingCruise) && (
        <CruiseModal
          cruise={editingCruise}
          onSave={saveCruise}
          onClose={() => { setShowCreate(false); setEditingCruise(null); }}
        />
      )}

      {viewingCruise && (
        <ViewModal cruise={viewingCruise} onClose={() => setViewingCruise(null)} />
      )}

      {deletingCruise && (
        <DeleteModal
          cruise={deletingCruise}
          onConfirm={confirmDelete}
          onClose={() => setDeletingCruise(null)}
        />
      )}

      <ToastContainer />
    </div>
  );
}