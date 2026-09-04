import { useState, useEffect, useRef } from 'react';
import { Search, Plus, Eye, Edit, Trash2, Car, UploadCloud, Image as ImageIcon, X, AlertTriangle, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { vehicleService, normalizeVehicleList, transformVehicleResponse, uploadImageToCloudinary } from "../api/VehicleService";
import { getErrorMessage, isCanceled } from "@shared/api/apiError";

/* ─────────────────────────────────────────────
   🌟 CUSTOM TAILWIND TOAST SYSTEM
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
      setTimeout(() => setToasts((p) => p.filter((x) => x.id !== t.id)), 3000);
    };
    return () => { _toastSetter = null; };
  }, []);
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3">
      {toasts.map((t) => (
        <div key={t.id} className={`${t.type === "success" ? "bg-emerald-500" : "bg-rose-500"} text-white rounded-xl px-5 py-3.5 font-semibold text-sm shadow-lg flex items-center gap-2.5 animate-in slide-in-from-bottom-5 duration-300`}>
          <span>{t.type === "success" ? "✓" : "✕"}</span>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// NOTE: this page used to fall back to a hardcoded SEED_DATA list whenever the API failed, and also
// whenever a tenant's real list came back empty. Both were silent: a signed-out user, a 500, or a
// brand-new tenant would see three fake vehicles — "Toyota Innova Crysta", "Volvo 9400 Sleeper",
// "Mercedes S-Class" — indistinguishable from real records, quotable into a real quotation.
// A failure now shows a failure, and an empty tenant shows an empty state.

const EMPTY_FORM = { name: '', type: '', capacity: '', image: null, imagePreview: null, imagePath: null, description: '' };

// =========================================================================
// MAIN COMPONENT
// =========================================================================
/* A row imported from the Transport Marketplace. The platform owns every descriptive field on it
   — name, type, capacity, description, image — so the server refuses an edit (VehicleServiceImpl)
   and this says so before the click rather than after a 409. Delete stays enabled: removing a
   projection means dropping it from your list, and it is a soft delete, so re-importing brings it
   back. The Hotel Master has rendered its projections this way since the hotel marketplace
   shipped; the vehicle side simply never did. */
const PLATFORM_EDIT_HINT = "From the Transport Marketplace — the platform maintains this vehicle. Remove it, or add your own.";

function PlatformTag() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-600 ring-1 ring-violet-200">
      Platform
    </span>
  );
}

export default function VehicleMaster() {
  // --- State ---
  const [vehicles,      setVehicles]      = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [loadError,     setLoadError]     = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false); // upload progress indicator

  // Filtering
  const [searchTerm,    setSearchTerm]    = useState('');
  const [selectedType,  setSelectedType]  = useState('');

  // Modals
  const [showModal,       setShowModal]       = useState(false);
  const [showViewModal,   setShowViewModal]   = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Active Records
  const [editingVehicle,  setEditingVehicle]  = useState(null);
  const [viewingVehicle,  setViewingVehicle]  = useState(null);
  const [deletingVehicle, setDeletingVehicle] = useState(null);

  // Form
  const fileInputRef = useRef(null);
  const [errors,   setErrors]   = useState({});
  const [formData, setFormData] = useState({ ...EMPTY_FORM });

  // ── 1. Fetch all vehicles on mount ──────────────────────
  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await vehicleService.getAllVehicles();
      // normalizeVehicleList handles both array and wrapped { data: [] } responses
      // Backend: { success, data: [...] } ya { success, data: { content: [...] } }
      const raw  = response.data?.data ?? response.data;
      setVehicles(normalizeVehicleList(raw));
    } catch (error) {
      if (isCanceled(error)) return;   // component unmounted — leave state alone
      setVehicles([]);
      setLoadError(getErrorMessage(error, "Couldn't load vehicles."));
    } finally {
      setLoading(false);
    }
  };

  // --- Derived: client-side filtering ---
  const filteredVehicles = (Array.isArray(vehicles) ? vehicles : []).filter(v => {
    const safeName    = v?.name || '';
    const matchSearch = safeName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType   = selectedType === '' || v?.type === selectedType;
    return matchSearch && matchType;
  });

  // --- Form input handler ---
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
  };

  // ── 2. Image upload — multipart to our backend, which forwards to Cloudinary ──
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.match('image.*')) {
      setErrors(prev => ({ ...prev, image: 'Please upload a valid image file (JPG, PNG).' }));
      return;
    }

    // Local preview turant dikho
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFormData(prev => ({ ...prev, imagePreview: ev.target.result }));
    };
    reader.readAsDataURL(file);

    // Backend /vehicles/upload-image pe bhejo (quota-enforced + metered)
    setImageUploading(true);
    try {
      const secureUrl = await uploadImageToCloudinary(file, (percent) => {
        // Optional: progress track kar sakte ho
        console.log(`Upload progress: ${percent}%`);
      });

      // secureUrl = "https://res.cloudinary.com/..."
      setFormData(prev => ({
        ...prev,
        image:        secureUrl,
        imagePreview: secureUrl,
        imagePath:    secureUrl, // yahi backend ko jayega
      }));
      setErrors(prev => ({ ...prev, image: null }));
    } catch (err) {
      console.error("Image upload failed:", err);
      setFormData(prev => ({ ...prev, image: null, imagePath: null }));
      // Not `err.message || fallback` — axios always sets .message, so the fallback was dead code and
      // the user saw "Request failed with status code 413".
      setErrors(prev => ({ ...prev, image: getErrorMessage(err, 'Image upload failed. Try again.') }));
    } finally {
      setImageUploading(false);
    }
  };

  // --- Open add/edit modal ---
  const openModal = (vehicle = null) => {
    setErrors({});
    if (vehicle) {
      setEditingVehicle(vehicle);
      // transformVehicleResponse converts backend fields → formData shape
      setFormData(transformVehicleResponse(vehicle));
    } else {
      setEditingVehicle(null);
      setFormData({ ...EMPTY_FORM });
    }
    setShowModal(true);
  };

  // --- Validation ---
  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim())  newErrors.name = "Vehicle Name is required.";
    if (!formData.type.trim())  newErrors.type = "Vehicle Type is required.";
    if (formData.capacity && isNaN(Number(formData.capacity)))   newErrors.capacity = "Must be a numeric value.";
    else if (formData.capacity && Number(formData.capacity) <= 0) newErrors.capacity = "Must be greater than 0.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── 3. Save vehicle (create or update) ──────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setActionLoading(true);

    try {
      if (editingVehicle) {
        // UPDATE — publicId use karo (UUID), id nahi
        const pid = editingVehicle.publicId || editingVehicle.id;
        const res = await vehicleService.updateVehicle(pid, formData);
        const updated = res.data?.data ?? res.data ?? { ...editingVehicle, ...formData };
        setVehicles(prev => prev.map(v =>
          (v.publicId || v.id) === pid ? { ...v, ...updated } : v
        ));
        toast.success("Vehicle updated successfully!");
      } else {
        // CREATE
        const res = await vehicleService.createVehicle(formData);
        const created = res.data?.data ?? res.data ?? { ...formData, publicId: Date.now().toString(), createdAt: new Date().toISOString().slice(0, 10) };
        setVehicles(prev => [created, ...prev]);
        toast.success("Vehicle created successfully!");
      }
      setShowModal(false);
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Failed to save vehicle. Please try again."
      );
    } finally {
      setActionLoading(false);
    }
  };

  // ── 4. Delete vehicle ────────────────────────────────────
  const handleDelete = async () => {
    if (!deletingVehicle) return;
    setActionLoading(true);
    try {
      const dpid = deletingVehicle.publicId || deletingVehicle.id;
      await vehicleService.deleteVehicle(dpid);
      setVehicles(prev => prev.filter(v => (v.publicId || v.id) !== dpid));
      toast.success("Vehicle deleted successfully!");
      setShowDeleteModal(false);
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Failed to delete vehicle."
      );
    } finally {
      setActionLoading(false);
    }
  };

  // =========================================================================
  // RENDER
  // =========================================================================
  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 p-4 sm:p-6 lg:p-8"
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
      `}</style>

      <div className="max-w-screen-2xl mx-auto">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-600 to-blue-400 text-white rounded-2xl shadow-lg shadow-blue-500/25">
              <Car size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight m-0">Vehicle Master</h1>
              <p className="text-sm text-slate-500 mt-0.5 m-0 font-medium">Manage your transport fleet</p>
            </div>
          </div>
          <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
            <Link to="/" className="text-blue-600 hover:text-blue-800 transition-colors">Home</Link>
            <span className="text-slate-300">/</span>
            <span className="text-slate-500">Masters</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-700 bg-white/80 backdrop-blur border border-slate-200 px-3 py-1 rounded-lg shadow-sm">Vehicle</span>
          </div>
        </div>

        {/* MAIN CARD */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">

          {/* Filters & Actions */}
          <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4 w-full lg:w-auto">
              <div className="relative w-full sm:flex-1 sm:min-w-[260px] sm:max-w-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Search size={16} />
                </div>
                <input
                  type="text"
                  placeholder="Search vehicles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-700 shadow-sm hover:border-blue-300"
                />
              </div>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full sm:w-[200px] px-4 py-2.5 bg-white border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700 shadow-sm cursor-pointer hover:border-blue-300"
              >
                <option value="">All Vehicle Types</option>
                <option value="Sedan">Sedan</option>
                <option value="SUV">SUV</option>
                <option value="Bus">Bus</option>
                <option value="Tempo Traveller">Tempo Traveller</option>
              </select>
            </div>
            <button
              onClick={() => openModal()}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md shadow-blue-500/25 hover:shadow-lg active:scale-95 whitespace-nowrap w-full lg:w-auto"
            >
              <Plus size={18} strokeWidth={2.5} /> Add New Vehicle
            </button>
          </div>

          {/* ─────────── DESKTOP TABLE (md and up) ─────────── */}
          <div className="hidden md:block overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[900px] text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[12px] uppercase tracking-wider font-bold border-b border-slate-200">
                  <th className="px-6 py-4 text-left">ID</th>
                  <th className="px-6 py-4 text-left">Image</th>
                  <th className="px-6 py-4 text-left">Vehicle Name</th>
                  <th className="px-6 py-4 text-left">Vehicle Type</th>
                  <th className="px-6 py-4 text-left">Capacity</th>
                  <th className="px-6 py-4 text-left">Created At</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white/60">
                {loading ? (
                  // Loading skeleton rows
                  [1,2,3].map(i => (
                    <tr key={i}>
                      {[1,2,3,4,5,6,7].map(j => (
                        <td key={j} className="px-6 py-4">
                          <div className="h-4 bg-slate-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : loadError ? (
                  <tr>
                    <td colSpan="7" className="text-center py-16">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                          <AlertTriangle size={28} className="text-red-400" />
                        </div>
                        <p className="text-slate-700 font-semibold">Couldn't load vehicles</p>
                        <p className="text-slate-400 text-sm mt-0.5 max-w-sm">{loadError}</p>
                        <button
                          type="button"
                          onClick={fetchVehicles}
                          className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700"
                        >
                          Try again
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : filteredVehicles.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-16">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                          <Car size={28} className="text-slate-300" />
                        </div>
                        <p className="text-slate-500 font-semibold">No vehicles found</p>
                        <p className="text-slate-400 text-sm mt-0.5">Try a different search, or add a new vehicle.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredVehicles.map(vehicle => (
                    <tr key={vehicle.publicId || vehicle.id} className="hover:bg-blue-50/40 transition-colors group">
                      <td className="px-6 py-4 font-semibold text-slate-500">#{vehicle.id}</td>
                      <td className="px-6 py-4">
                        {vehicle.imagePreview || vehicle.image || vehicle.imagePath ? (
                          <img
                            src={vehicle.imagePreview || vehicle.imagePath || vehicle.image}
                            alt={vehicle.name}
                            className="w-16 h-10 object-cover rounded-lg border border-slate-200 shadow-sm"
                          />
                        ) : (
                          <div className="w-16 h-10 bg-slate-100 rounded-lg flex items-center justify-center border border-slate-200 text-slate-400">
                            <ImageIcon size={18} />
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900">
                        <span className="inline-flex items-center gap-2">{vehicle.name}{vehicle.platformOwned && <PlatformTag />}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-sky-100 text-sky-700 px-3 py-1 rounded-md text-[11px] font-extrabold uppercase tracking-wider border border-sky-200">{vehicle.type}</span>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700">
                        {vehicle.capacity ? `${vehicle.capacity} Persons` : '-'}
                      </td>
                      <td className="px-6 py-4 text-slate-500 font-medium">{vehicle.createdAt}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2 opacity-70 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setViewingVehicle(vehicle); setShowViewModal(true); }}
                            className="p-2 bg-teal-50 text-teal-600 hover:bg-teal-500 hover:text-white rounded-lg transition-colors shadow-sm"
                          ><Eye size={16} /></button>
                          <button
                            onClick={() => openModal(vehicle)}
                              disabled={vehicle.platformOwned}
                              title={vehicle.platformOwned ? PLATFORM_EDIT_HINT : "Edit"}
                            className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-colors shadow-sm disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-blue-50 disabled:hover:text-blue-600"
                          ><Edit size={16} /></button>
                          <button
                            onClick={() => { setDeletingVehicle(vehicle); setShowDeleteModal(true); }}
                            className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white rounded-lg transition-colors shadow-sm"
                          ><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ─────────── MOBILE CARDS (below md) ─────────── */}
          <div className="md:hidden">
            {loading ? (
              <div className="divide-y divide-slate-100">
                {[1,2,3].map(i => (
                  <div key={i} className="p-4 flex items-start gap-3">
                    <div className="w-20 h-16 rounded-xl bg-slate-100 animate-pulse flex-shrink-0" />
                    <div className="flex-1 space-y-2 pt-1">
                      <div className="h-4 bg-slate-100 rounded animate-pulse w-2/3" />
                      <div className="h-3 bg-slate-100 rounded animate-pulse w-1/2" />
                      <div className="h-3 bg-slate-100 rounded animate-pulse w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredVehicles.length === 0 ? (
              <div className="px-4 py-16 text-center flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                  <Car size={28} className="text-slate-300" />
                </div>
                <p className="text-slate-500 font-semibold">No vehicles found</p>
                <p className="text-slate-400 text-sm mt-0.5">Try a different search, or add a new vehicle.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredVehicles.map(vehicle => {
                  const img = vehicle.imagePreview || vehicle.imagePath || vehicle.image;
                  return (
                    <div key={vehicle.publicId || vehicle.id} className="p-4 hover:bg-blue-50/30 transition-colors animate-in fade-in duration-300">
                      <div className="flex items-start gap-3">
                        <div className="w-20 h-16 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center shadow-sm">
                          {img ? <img src={img} alt={vehicle.name} className="w-full h-full object-cover" /> : <ImageIcon size={20} className="text-slate-300" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-bold text-slate-900 truncate leading-tight">{vehicle.name}</h3>
                            {vehicle.platformOwned && <PlatformTag />}
                            <span className="flex-shrink-0 bg-sky-100 text-sky-700 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide border border-sky-200">{vehicle.type}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            {vehicle.capacity ? (
                              <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-medium"><Users size={12} className="text-slate-400" /> {vehicle.capacity} Persons</span>
                            ) : null}
                            <span className="text-[11px] text-slate-400 font-medium">{vehicle.createdAt}</span>
                            <span className="text-[10px] font-mono text-slate-300">#{vehicle.id}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                        <button
                          onClick={() => { setViewingVehicle(vehicle); setShowViewModal(true); }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-teal-50 text-teal-600 hover:bg-teal-500 hover:text-white text-xs font-bold transition-colors active:scale-95"
                        ><Eye size={14} /> View</button>
                        <button
                          onClick={() => openModal(vehicle)}
                            disabled={vehicle.platformOwned}
                            title={vehicle.platformOwned ? PLATFORM_EDIT_HINT : "Edit"}
                          className="flex items-center justify-center w-11 py-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-colors active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-blue-50 disabled:hover:text-blue-600"
                        ><Edit size={14} /></button>
                        <button
                          onClick={() => { setDeletingVehicle(vehicle); setShowDeleteModal(true); }}
                          className="flex items-center justify-center w-11 py-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white transition-colors active:scale-95"
                        ><Trash2 size={14} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── CREATE / EDIT MODAL ─────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 overflow-y-auto custom-scrollbar">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={() => !actionLoading && setShowModal(false)} />

          <div className="relative bg-white w-full max-w-4xl shadow-2xl mt-4 sm:mt-10 mb-10 rounded-2xl overflow-hidden border border-slate-200/60 animate-in zoom-in-95 duration-200">

            {/* Modal Header — clean white with icon chip */}
            <div className="bg-white px-5 sm:px-8 py-5 flex justify-between items-center border-b border-slate-100 gap-4">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl flex-shrink-0"><Car size={22} strokeWidth={2.5} /></div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate m-0">{editingVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}</h2>
                  <p className="text-slate-500 text-xs sm:text-sm font-medium truncate m-0">Enter the details for this vehicle.</p>
                </div>
              </div>
              <button onClick={() => !actionLoading && setShowModal(false)} className="text-slate-400 hover:bg-slate-100 hover:text-slate-600 p-2.5 rounded-full transition-colors active:scale-95 flex-shrink-0"><X size={20} strokeWidth={2.5} /></button>
            </div>

            <form onSubmit={handleSave}>
              <div className="p-5 sm:p-8 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 bg-[#fcfdff]">

                {/* Left Column */}
                <div className="space-y-6">
                  <div className="group">
                    <label className="block text-sm font-bold text-slate-700 mb-2 group-focus-within:text-blue-600 transition-colors">Vehicle Name <span className="text-rose-500">*</span></label>
                    <input type="text" name="name" placeholder="e.g. Toyota Innova" value={formData.name} onChange={handleInputChange}
                      className={`w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm ${errors.name ? 'border-rose-400' : 'border-slate-200'}`}
                    />
                    {errors.name && <p className="text-rose-600 text-xs mt-1.5 font-semibold flex items-center gap-1"><AlertTriangle size={12} />{errors.name}</p>}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="group">
                      <label className="block text-sm font-bold text-slate-700 mb-2 group-focus-within:text-blue-600 transition-colors">Vehicle Type <span className="text-rose-500">*</span></label>
                      <input type="text" name="type" placeholder="e.g. SUV, Bus" value={formData.type} onChange={handleInputChange}
                        className={`w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm ${errors.type ? 'border-rose-400' : 'border-slate-200'}`}
                      />
                      {errors.type && <p className="text-rose-600 text-xs mt-1.5 font-semibold flex items-center gap-1"><AlertTriangle size={12} />{errors.type}</p>}
                    </div>
                    <div className="group">
                      <label className="block text-sm font-bold text-slate-700 mb-2 group-focus-within:text-blue-600 transition-colors">Capacity (Persons)</label>
                      <input type="number" name="capacity" placeholder="e.g. 7" min="1" value={formData.capacity} onChange={handleInputChange}
                        className={`w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm ${errors.capacity ? 'border-rose-400' : 'border-slate-200'}`}
                      />
                      {errors.capacity && <p className="text-rose-600 text-xs mt-1.5 font-semibold flex items-center gap-1"><AlertTriangle size={12} />{errors.capacity}</p>}
                    </div>
                  </div>

                  <div className="group">
                    <label className="block text-sm font-bold text-slate-700 mb-2 group-focus-within:text-blue-600 transition-colors">Description</label>
                    <textarea name="description" rows="5" placeholder="Brief description about the vehicle's features..." value={formData.description} onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all resize-none shadow-sm"
                    />
                  </div>
                </div>

                {/* Right Column — Image Upload */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Vehicle Image
                    {imageUploading && <span className="ml-2 text-blue-500 font-normal text-xs animate-pulse">Uploading...</span>}
                  </label>
                  <div
                    className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all ${errors.image ? 'border-rose-400 bg-rose-50' : imageUploading ? 'border-blue-300 bg-blue-50' : 'border-slate-300 bg-slate-50/50 hover:bg-slate-100/60 cursor-pointer'}`}
                    onClick={() => !imageUploading && fileInputRef.current?.click()}
                  >
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />

                    {imageUploading ? (
                      <div className="py-10">
                        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-sm text-blue-600 font-medium">Uploading image...</p>
                      </div>
                    ) : !formData.imagePreview && !formData.image ? (
                      <div className="py-8 sm:py-10">
                        <UploadCloud size={48} className="mx-auto text-blue-500 mb-4" />
                        <h4 className="text-base font-bold text-slate-800 mb-1">Click to upload image</h4>
                        <p className="text-sm text-slate-500 font-medium m-0">PNG, JPG up to 5MB</p>
                      </div>
                    ) : (
                      <div>
                        <img
                          src={formData.imagePreview || formData.imagePath || formData.image}
                          alt="Preview"
                          className="w-full max-h-[280px] object-cover rounded-xl shadow-sm border border-slate-200 mb-4"
                        />
                        <span className="inline-block bg-blue-100 text-blue-700 px-4 py-2 rounded-lg text-sm font-bold">Change Image</span>
                      </div>
                    )}
                  </div>
                  {errors.image && <p className="text-rose-600 text-xs mt-2 font-semibold text-center flex items-center justify-center gap-1"><AlertTriangle size={12} />{errors.image}</p>}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 px-5 sm:px-8 py-4 sm:py-5 border-t border-slate-200 flex justify-end gap-3 rounded-b-2xl">
                <button type="button" onClick={() => setShowModal(false)} disabled={actionLoading}
                  className="px-5 sm:px-6 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                >Cancel</button>
                <button type="submit" disabled={actionLoading || imageUploading}
                  className="px-6 sm:px-8 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-blue-500/30 hover:shadow-blue-500/50 active:scale-95 disabled:cursor-not-allowed"
                >
                  {actionLoading ? 'Saving...' : editingVehicle ? 'Update Vehicle' : 'Save Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── VIEW MODAL ───────────────────────────────────────── */}
      {showViewModal && viewingVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowViewModal(false)} />
          <div className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto custom-scrollbar">

            {viewingVehicle.imagePreview || viewingVehicle.imagePath || viewingVehicle.image ? (
              <div className="w-full h-56 sm:h-64 bg-slate-900 relative">
                <img
                  src={viewingVehicle.imagePreview || viewingVehicle.imagePath || viewingVehicle.image}
                  alt={viewingVehicle.name}
                  className="w-full h-full object-cover opacity-80"
                />
                <button onClick={() => setShowViewModal(false)} className="absolute top-4 right-4 bg-black/40 text-white p-2 rounded-full hover:bg-black/60 transition-colors"><X size={20} /></button>
              </div>
            ) : (
              <div className="w-full h-40 bg-slate-100 flex items-center justify-center relative border-b border-slate-200">
                <Car size={48} className="text-slate-300" />
                <button onClick={() => setShowViewModal(false)} className="absolute top-4 right-4 bg-white border border-slate-200 text-slate-500 p-2 rounded-full hover:bg-slate-50"><X size={20} /></button>
              </div>
            )}

            <div className="p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">{viewingVehicle.name}</h2>
              <div className="flex gap-3 mb-6 flex-wrap">
                <span className="bg-sky-100 text-sky-700 px-4 py-1.5 rounded-lg text-sm font-bold uppercase tracking-wider border border-sky-200">{viewingVehicle.type}</span>
                {viewingVehicle.capacity && <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 px-4 py-1.5 rounded-lg text-sm font-bold"><Users size={14} /> {viewingVehicle.capacity} Persons</span>}
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Description</h4>
                <p className="text-slate-700 bg-slate-50 p-4 rounded-xl text-sm leading-relaxed border border-slate-100 m-0">{viewingVehicle.description || 'No description provided.'}</p>
              </div>
            </div>
            <div className="px-6 sm:px-8 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button onClick={() => setShowViewModal(false)} className="px-6 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-100 transition-all active:scale-95">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE MODAL ─────────────────────────────────────── */}
      {showDeleteModal && deletingVehicle && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !actionLoading && setShowDeleteModal(false)} />
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 sm:p-8 text-center animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <AlertTriangle size={32} className="text-rose-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Vehicle?</h3>
            <p className="text-slate-500 mb-8 font-medium">
              Are you sure you want to delete <strong className="text-rose-600">{deletingVehicle.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setShowDeleteModal(false)} disabled={actionLoading}
                className="px-6 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-100 transition-all active:scale-95 w-full disabled:opacity-50"
              >Cancel</button>
              <button onClick={handleDelete} disabled={actionLoading}
                className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-rose-500/30 active:scale-95 w-full disabled:opacity-50"
              >
                {actionLoading ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer />
    </div>
  );
}