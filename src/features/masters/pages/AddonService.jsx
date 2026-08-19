import { useState, useRef, useEffect, memo, useMemo } from "react";
import { Search, Plus, Eye, Edit, Trash2, X, Settings, Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, List, ListOrdered, Eraser, ChevronDown, ChevronUp, Home, Package, IndianRupee, Sparkles, ToggleLeft, ToggleRight, CheckCircle, XCircle, Inbox, ArrowUp, ArrowDown } from "lucide-react";
import { safeHtml } from "@shared/lib/safeHtml";

/* ─── PAGINATION ─────────────────────────────────────────── */
function buildPageNumbers(totalPages, pageIndex) {
  if (totalPages <= 0) return [];
  return Array.from({ length: totalPages }, (_, i) => i)
    .filter(p => p === 0 || p === totalPages - 1 || Math.abs(p - pageIndex) <= 1)
    .reduce((acc, p, i, arr) => {
      if (i > 0 && p - arr[i - 1] > 1) acc.push("…");
      acc.push(p);
      return acc;
    }, []);
}

const NavButton = memo(function NavButton({ label, onClick, disabled }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 text-xs font-bold
        hover:border-blue-300 hover:text-blue-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {label}
    </button>
  );
});

const PageButton = memo(function PageButton({ page, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all border ${
        isActive
          ? "bg-blue-600 border-blue-600 text-white shadow-sm"
          : "bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600"
      }`}
    >
      {page + 1}
    </button>
  );
});

function CommonPagination({ pageIndex, pageSize, totalElements, totalPages, goToPage, changePageSize }) {
  const from = totalElements === 0 ? 0 : pageIndex * pageSize + 1;
  const to   = Math.min((pageIndex + 1) * pageSize, totalElements);
  const pageNumbers = useMemo(() => buildPageNumbers(totalPages, pageIndex), [totalPages, pageIndex]);
  if (totalElements === 0) return null;
  const isFirst = pageIndex === 0;
  const isLast  = pageIndex >= totalPages - 1;
  return (
    <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3">
      <p className="text-xs text-slate-400 font-medium">
        Showing <span className="font-bold text-slate-600">{from}</span>–<span className="font-bold text-slate-600">{to}</span> of <span className="font-bold text-slate-600">{totalElements}</span>
      </p>
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        <NavButton label="«" onClick={() => goToPage(0)}             disabled={isFirst} />
        <NavButton label="‹" onClick={() => goToPage(pageIndex - 1)} disabled={isFirst} />
        {pageNumbers.map((p, i) =>
          typeof p === "string"
            ? <span key={`e${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-slate-400">…</span>
            : <PageButton key={p} page={p} isActive={pageIndex === p} onClick={() => goToPage(p)} />
        )}
        <NavButton label="›" onClick={() => goToPage(pageIndex + 1)} disabled={isLast} />
        <NavButton label="»" onClick={() => goToPage(totalPages - 1)} disabled={isLast} />
        <select
          value={pageSize}
          onChange={e => changePageSize(Number(e.target.value))}
          className="ml-2 h-8 px-2 rounded-lg border border-slate-200 text-xs text-slate-600 font-medium bg-white focus:border-blue-400 outline-none cursor-pointer"
        >
          {[5, 10, 25, 50].map(s => <option key={s} value={s}>{s} / page</option>)}
        </select>
      </div>
    </div>
  );
}

/* ─── TOAST ──────────────────────────────────────────────── */
function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div
      className={`fixed top-5 right-5 z-[999] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl max-w-xs
        ${type === "success" ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}
      style={{ animation: "slideIn .3s ease both" }}
    >
      {type === "success" ? <CheckCircle size={18} className="text-green-600" /> : <XCircle size={18} className="text-red-600" />}
      <p className="text-sm font-semibold flex-1">{msg}</p>
      <button onClick={onClose} className="opacity-50 hover:opacity-100 ml-1"><X size={16} /></button>
    </div>
  );
}

/* ─── SKELETON ROW ───────────────────────────────────────── */
function SkeletonRow() {
  return (
    <tr>
      {[...Array(6)].map((_, i) => (
        <td key={i} className="px-5 py-4">
          <div className="h-4 rounded-lg bg-slate-200 animate-pulse" style={{ width: `${40 + Math.random() * 50}%` }} />
        </td>
      ))}
    </tr>
  );
}

/* ─── RICH TEXT EDITOR ───────────────────────────────────── */
const RichTextEditor = ({ name, initialValue, onChange, placeholder }) => {
  const editorRef = useRef(null);
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== initialValue) {
      editorRef.current.innerHTML = initialValue || "";
    }
  }, []);
  const handleInput = () => {
    if (onChange && editorRef.current)
      onChange({ target: { name, value: editorRef.current.innerHTML } });
  };
  const exec = (e, cmd, arg = null) => {
    e.preventDefault();
    document.execCommand(cmd, false, arg);
    editorRef.current.focus();
    handleInput();
  };
  const ToolBtn = ({ children, cmd }) => (
    <button type="button" onMouseDown={(e) => exec(e, cmd)}
      className="p-1.5 rounded-md hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors">
      {children}
    </button>
  );
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex flex-wrap items-center gap-1 select-none">
        <button type="button" onMouseDown={(e) => exec(e, "formatBlock", "P")}
          className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors">
          Normal <ChevronDown size={12} className="text-slate-400" />
        </button>
        <div className="w-px h-4 bg-slate-300 mx-1" />
        <div className="flex items-center gap-0.5">
          <ToolBtn cmd="bold"><Bold size={14} strokeWidth={2.5} /></ToolBtn>
          <ToolBtn cmd="italic"><Italic size={14} /></ToolBtn>
          <ToolBtn cmd="underline"><Underline size={14} /></ToolBtn>
          <ToolBtn cmd="strikeThrough"><Strikethrough size={14} /></ToolBtn>
        </div>
        <div className="w-px h-4 bg-slate-300 mx-1" />
        <div className="flex items-center gap-0.5">
          <ToolBtn cmd="justifyLeft"><AlignLeft size={14} /></ToolBtn>
          <ToolBtn cmd="justifyCenter"><AlignCenter size={14} /></ToolBtn>
          <ToolBtn cmd="insertUnorderedList"><List size={14} /></ToolBtn>
          <ToolBtn cmd="insertOrderedList"><ListOrdered size={14} /></ToolBtn>
        </div>
        <div className="w-px h-4 bg-slate-300 mx-1" />
        <ToolBtn cmd="removeFormat"><Eraser size={14} /></ToolBtn>
      </div>
      <div
        ref={editorRef}
        contentEditable suppressContentEditableWarning
        onInput={handleInput} onBlur={handleInput}
        data-placeholder={placeholder || "Write something…"}
        className="w-full px-4 py-3 focus:outline-none text-sm text-slate-700 leading-relaxed
          [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1
          [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1
          [&_b]:font-bold [&_i]:italic [&_u]:underline
          empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 empty:before:pointer-events-none"
        style={{ minHeight: 110 }}
      />
    </div>
  );
};

/* ─── VIEW MODAL ─────────────────────────────────────────── */
function ViewServiceModal({ service, onClose, onEdit }) {
  if (!service) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto z-10">
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-5 rounded-t-2xl">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xl font-extrabold shadow-lg flex-shrink-0">
                {(service.name || "S").charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-white text-lg font-extrabold">{service.name}</h2>
                <p className="text-slate-400 text-sm font-medium">Service ID #{service.id}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full
                    ${service.active ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-600"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${service.active ? "bg-emerald-500" : "bg-rose-400"}`} />
                    {service.active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-all flex-shrink-0">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center flex-shrink-0">
              <IndianRupee size={14} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Price</p>
              <p className="text-sm font-bold text-slate-700">
                {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(service.price)}
              </p>
            </div>
          </div>
          {service.description ? (
            <div>
              <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Description</p>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-sm text-slate-600 leading-relaxed"
                dangerouslySetInnerHTML={safeHtml(service.description)} />
            </div>
          ) : (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-sm text-slate-400 italic text-center">No description provided</div>
          )}
          <div className="flex gap-3 pt-1">
            <button onClick={() => { onClose(); onEdit(service); }}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all">
              <Edit size={14} /> Edit
            </button>
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold flex items-center justify-center gap-2 transition-all border border-slate-200">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── DELETE CONFIRM ─────────────────────────────────────── */
function DeleteConfirm({ service, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm z-10 p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <Trash2 size={26} className="text-red-500" />
        </div>
        <h3 className="text-lg font-extrabold text-slate-800 mb-1">Delete Service?</h3>
        <p className="text-sm text-slate-500 mb-5">
          Are you sure you want to delete <span className="font-bold text-slate-700">"{service?.name}"</span>? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose}    className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all">Cancel</button>
          <button onClick={onConfirm}  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md shadow-red-200 transition-all">Yes, Delete</button>
        </div>
      </div>
    </div>
  );
}

/* ─── MOBILE CARD ────────────────────────────────────────── */
function ServiceCard({ service, onView, onEdit, onDelete }) {
  const formatINR = (v) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(v);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-extrabold flex-shrink-0 shadow-sm">
            {(service.name || "S").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate">{service.name}</p>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">ID #{service.id}</p>
          </div>
        </div>
        <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border
          ${service.active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-600 border-rose-200"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${service.active ? "bg-emerald-500" : "bg-rose-400"}`} />
          {service.active ? "Active" : "Inactive"}
        </span>
      </div>
      {service.description && (
        <div className="text-xs text-slate-500 leading-relaxed line-clamp-2"
          dangerouslySetInnerHTML={safeHtml(service.description)} />
      )}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <span className="text-sm font-bold text-slate-800">{formatINR(service.price)}</span>
        <div className="flex items-center gap-1.5 opacity-80">
          <button onClick={() => onView(service)} className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition-all border border-blue-200"><Eye size={14} /></button>
          <button onClick={() => onEdit(service)} className="w-8 h-8 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 flex items-center justify-center transition-all border border-indigo-200"><Edit size={14} /></button>
          <button onClick={() => onDelete(service)} className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 flex items-center justify-center transition-all border border-red-200"><Trash2 size={14} /></button>
        </div>
      </div>
    </div>
  );
}

/* ─── SEED DATA ──────────────────────────────────────────── */
const SEED_DATA = [
  { id: 73, name: "Arrival Card",      description: "",           price: 0,     active: true  },
  { id: 77, name: "Bali eVISA",        description: "<span class='bg-yellow-100 text-yellow-800 font-semibold px-1 rounded'>Docs Required:</span> Passport Copies (Front + Back) | White background Photos | Pan Cards | Flight tickets (both ways) | Hotel Voucher", price: 0, active: true },
  { id: 70, name: "Ferry Service",     description: "",           price: 0,     active: true  },
  { id: 76, name: "Floating Breakfast",description: "",           price: 0,     active: true  },
  { id: 94, name: "Nepal Tour Package",description: "Complete Nepal tour package including transportation, 3-star hotel accommodation, breakfast, permits, toll taxes, fuel charges, and driver expenses.", price: 90000, active: true },
  { id: 81, name: "Airport Transfer",  description: "Round-trip airport pickup and drop service with AC vehicle.", price: 1500, active: false },
  { id: 82, name: "Travel Insurance",  description: "Comprehensive travel insurance covering medical, trip cancellation, and baggage loss.", price: 800, active: true },
  { id: 83, name: "Sim Card",          description: "International SIM card with data plan.", price: 500, active: true },
  { id: 84, name: "Travel Kit",        description: "Customized travel kit with essentials.", price: 1200, active: false },
  { id: 85, name: "Visa On Arrival",   description: "Assistance for visa on arrival processing.", price: 2500, active: true },
  { id: 86, name: "Honeymoon Setup",   description: "Romantic room decoration with flowers and candles.", price: 3500, active: true },
  { id: 87, name: "Guided City Tour",  description: "Half-day guided sightseeing tour.", price: 1800, active: true },
];

const EMPTY_FORM = { name: "", description: "", price: "0.00", active: true };
const formatINR   = (v) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(v);
const inputCls    = "w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 shadow-sm transition focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

/* ─── MAIN COMPONENT ─────────────────────────────────────── */
export default function AddOnServicesMaster() {
  const [services,       setServices]       = useState(SEED_DATA);
  const [loading,        setLoading]        = useState(false);
  const [search,         setSearch]         = useState("");
  const [filterStatus,   setFilterStatus]   = useState("all");
  const [sortField,      setSortField]      = useState("id");
  const [sortOrder,      setSortOrder]      = useState("desc");
  const [modalOpen,      setModalOpen]      = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [formData,       setFormData]       = useState({ ...EMPTY_FORM });
  const [resetKey,       setResetKey]       = useState(Date.now());
  const [viewService,    setViewService]    = useState(null);
  const [deleteTarget,   setDeleteTarget]   = useState(null);
  const [toast,          setToast]          = useState(null);

  const [addOnStatsOpen, setAddOnStatsOpen] = useState(false);

  // Pagination
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize,  setPageSize]  = useState(10);

  const showToast = (msg, type = "success") => setToast({ msg, type });

  // Filter + sort
  const filteredServices = useMemo(() => {
    return services
      .filter(s => {
        const q = search.trim().toLowerCase();
        const matchSearch = q === "" ||
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.id.toString().includes(q);
        const matchStatus =
          filterStatus === "all" ||
          (filterStatus === "active"   && s.active) ||
          (filterStatus === "inactive" && !s.active);
        return matchSearch && matchStatus;
      })
      .sort((a, b) => {
        if (sortField === "price") return sortOrder === "asc" ? a.price - b.price : b.price - a.price;
        if (sortField === "name")  return sortOrder === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
        return sortOrder === "asc" ? a.id - b.id : b.id - a.id;
      });
  }, [services, search, filterStatus, sortField, sortOrder]);

  // Reset page on filter change
  useEffect(() => { setPageIndex(0); }, [search, filterStatus, pageSize]);

  // Pagination derived
  const totalElements = filteredServices.length;
  const totalPages    = Math.max(1, Math.ceil(totalElements / pageSize));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const currentServices = useMemo(() => {
    const start = safePageIndex * pageSize;
    return filteredServices.slice(start, start + pageSize);
  }, [filteredServices, safePageIndex, pageSize]);

  const goToPage      = (page) => setPageIndex(Math.max(0, Math.min(page, totalPages - 1)));
  const changePageSize = (size) => { setPageSize(size); setPageIndex(0); };

  const toggleSort = (field) => {
    if (sortField === field) setSortOrder(o => o === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortOrder("asc"); }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ArrowUp size={12} className="text-slate-300" />;
    return sortOrder === "asc"
      ? <ArrowUp size={12} className="text-blue-500" />
      : <ArrowDown size={12} className="text-blue-500" />;
  };

  // Stats
  const totalActive = services.filter(s => s.active).length;
  const totalValue  = services.reduce((a, s) => a + Number(s.price), 0);

  const openModal = (service = null) => {
    setEditingService(service);
    setFormData(service ? { ...service, price: service.price.toString() } : { ...EMPTY_FORM });
    setResetKey(Date.now());
    setModalOpen(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(p => ({ ...p, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 500));
    if (editingService) {
      setServices(prev => prev.map(s => s.id === editingService.id
        ? { ...formData, id: s.id, price: Number(formData.price) } : s));
      showToast("Service updated successfully!");
    } else {
      setServices(prev => [
        { ...formData, id: Math.floor(Math.random() * 900) + 100, price: Number(formData.price) },
        ...prev,
      ]);
      showToast("Service created successfully!");
    }
    setLoading(false);
    setModalOpen(false);
  };

  const handleDelete = () => {
    setServices(prev => prev.filter(s => s.id !== deleteTarget.id));
    showToast("Service deleted.");
    setDeleteTarget(null);
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 font-sans"
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes fadeUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideIn { from{transform:translateX(110%);opacity:0}  to{transform:translateX(0);opacity:1} }
        .fade-up { animation: fadeUp .4s ease both; }
      `}</style>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {viewService  && <ViewServiceModal service={viewService} onClose={() => setViewService(null)} onEdit={openModal} />}
      {deleteTarget && <DeleteConfirm service={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} />}

      {/* PAGE HEADER */}
      <div className="bg-white/70 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-white shadow-lg shadow-blue-200">
                <Settings size={24} strokeWidth={2.2} />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                  Add-On Services Master
                  <span className="hidden sm:inline text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">{services.length} total</span>
                </h1>
                <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1 font-medium">
                  <Home size={11} className="text-slate-400" />
                  <span className="hover:text-blue-600 cursor-pointer transition-colors">Home</span>
                  <span className="mx-1 text-slate-300">/</span>
                  <span>Masters</span>
                  <span className="mx-1 text-slate-300">/</span>
                  <span className="text-blue-600 font-bold">Add-On Services</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => openModal()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-200 hover:shadow-lg transition-all active:scale-95"
              >
                <Plus size={16} strokeWidth={2.5} /> Add New Service
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* STAT CARDS */}
        {/* <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[
            { icon: Package,     label: "Total Services", value: services.length, gradient: "from-cyan-500 to-cyan-600",     delay: 0   },
            { icon: Sparkles,    label: "Active",          value: totalActive,     gradient: "from-green-500 to-emerald-600", delay: 60  },
            { icon: IndianRupee, label: "Total Value",     value: Math.round(totalValue / 1000), suffix: "K", gradient: "from-violet-500 to-violet-600", delay: 120 },
          ].map(({ icon: Icon, label, value, suffix = "", gradient, delay }) => (
            <div key={label}
              className={`bg-gradient-to-br ${gradient} rounded-2xl p-5 text-white shadow-lg relative overflow-hidden group
                hover:-translate-y-1 hover:shadow-xl transition-all duration-300 cursor-pointer fade-up`}
              style={{ animationDelay: `${delay}ms` }}>
              <div className="absolute -right-5 -top-5 w-24 h-24 rounded-full bg-white/10 group-hover:scale-110 transition-transform duration-300" />
              <div className="absolute -right-3 -bottom-8 w-32 h-32 rounded-full bg-white/10 group-hover:scale-110 transition-transform duration-300" />
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 group-hover:bg-white/30 flex items-center justify-center transition-all">
                    <Icon size={20} strokeWidth={2.2} />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold leading-none mb-1">{value}{suffix}</p>
                <p className="text-xs font-bold uppercase tracking-widest opacity-80">{label}</p>
              </div>
            </div>
          ))}
        </div> */}

        {/* ── COLLAPSIBLE ADD-ON SERVICES ANALYTICS ── */}
<div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden fade-up">

  {/* Toggle header */}
  <button
    type="button"
    onClick={() =>
      setAddOnStatsOpen((previous) => !previous)
    }
    aria-expanded={addOnStatsOpen}
    className="w-full px-4 sm:px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
  >
    <div className="flex items-center gap-3 flex-wrap min-w-0">
      <div className="flex items-center gap-2">
        <Package size={16} className="text-blue-600" />

        <span className="text-sm font-extrabold text-slate-700">
          Add-On Services Analytics
        </span>
      </div>

      {/* Small values shown when cards are closed */}
      {!addOnStatsOpen && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-full bg-cyan-100 text-cyan-700 text-[11px] font-bold">
            {services.length} Services
          </span>

          <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-[11px] font-bold">
            {totalActive} Active
          </span>

          <span className="px-2.5 py-1 rounded-full bg-violet-100 text-violet-700 text-[11px] font-bold">
            Value {formatINR(totalValue)}
          </span>
        </div>
      )}
    </div>

    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
      {addOnStatsOpen ? (
        <ChevronUp size={16} />
      ) : (
        <ChevronDown size={16} />
      )}
    </div>
  </button>

  {/* Expandable cards */}
  <div
    className={`grid transition-all duration-300 ease-in-out ${
      addOnStatsOpen
        ? "grid-rows-[1fr] opacity-100"
        : "grid-rows-[0fr] opacity-0"
    }`}
  >
    <div className="min-h-0 overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 p-4 pt-1">
        {[
          {
            icon: Package,
            label: "Total Services",
            value: services.length,
            gradient: "from-cyan-500 to-cyan-600",
            delay: 0,
          },
          {
            icon: Sparkles,
            label: "Active",
            value: totalActive,
            gradient: "from-green-500 to-emerald-600",
            delay: 60,
          },
          {
            icon: IndianRupee,
            label: "Total Value",
            value: Math.round(totalValue / 1000),
            suffix: "K",
            gradient: "from-violet-500 to-violet-600",
            delay: 120,
          },
        ].map(
          ({
            icon: Icon,
            label,
            value,
            suffix = "",
            gradient,
            delay,
          }) => (
            <div
              key={label}
              className={`bg-gradient-to-br ${gradient}
                rounded-2xl p-5 text-white shadow-lg relative
                overflow-hidden group hover:-translate-y-1
                hover:shadow-xl transition-all duration-300 fade-up`}
              style={{ animationDelay: `${delay}ms` }}
            >
              <div className="absolute -right-5 -top-5 w-24 h-24 rounded-full bg-white/10 group-hover:scale-110 transition-transform duration-300" />

              <div className="absolute -right-3 -bottom-8 w-32 h-32 rounded-full bg-white/10 group-hover:scale-110 transition-transform duration-300" />

              <div className="relative z-10">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 group-hover:bg-white/30 flex items-center justify-center transition-all">
                    <Icon size={20} strokeWidth={2.2} />
                  </div>
                </div>

                <p className="text-2xl sm:text-3xl font-extrabold leading-none mb-1">
                  {value}
                  {suffix}
                </p>

                <p className="text-xs font-bold uppercase tracking-widest opacity-80">
                  {label}
                </p>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  </div>
</div>

        {/* MAIN CARD */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">

          {/* List header */}
          <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-base font-extrabold text-slate-700">Services Directory</h2>
              <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2.5 py-1 rounded-full">{totalElements} results</span>
            </div>
            {(search || filterStatus !== "all") && (
              <button onClick={() => { setSearch(""); setFilterStatus("all"); }}
                className="text-xs text-slate-400 hover:text-red-500 font-bold flex items-center gap-1.5 transition-colors">
                ✕ Clear all filters
              </button>
            )}
          </div>

          {/* Filters Bar */}
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60">
            <div className="flex flex-col sm:flex-row gap-3 flex-wrap items-stretch sm:items-center">
              <div className="relative flex-1 min-w-[220px] max-w-sm group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                  <Search size={15} />
                </div>
                <input type="text" placeholder="Search by name, description, or ID…"
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none transition-all" />
              </div>
              <div className="relative min-w-[160px]">
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                  className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 font-medium focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none appearance-none cursor-pointer transition-all">
                  <option value="all">All Status</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><Settings size={14} /></div>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400"><ChevronDown size={13} /></div>
              </div>
            </div>
          </div>

          {/* Status Tabs */}
          <div className="px-5 py-4 border-b border-slate-100 overflow-x-auto">
            <div className="flex gap-2 min-w-max">
              {[
                { key: "all",      label: "All",      count: services.length              },
                { key: "active",   label: "Active",   count: totalActive                  },
                { key: "inactive", label: "Inactive", count: services.length - totalActive },
              ].map(tab => (
                <button key={tab.key}
                  onClick={() => setFilterStatus(tab.key)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm
                    ${filterStatus === tab.key
                      ? "bg-blue-600 text-white shadow-blue-200"
                      : "bg-white text-slate-600 border border-slate-200 hover:border-blue-300 hover:text-blue-600"}`}>
                  {tab.key === "active"   && <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />}
                  {tab.key === "inactive" && <span className="w-2 h-2 rounded-full bg-rose-400 shadow-sm shadow-rose-400/50"    />}
                  {tab.label}
                  <span className={`px-2 py-0.5 rounded-md text-xs font-black ${filterStatus === tab.key ? "bg-white/20" : "bg-slate-100 text-slate-700"}`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm border-collapse">
              <thead className="bg-slate-50/80 border-b border-slate-100">
                <tr className="text-slate-500 text-xs uppercase tracking-wider font-extrabold">
                  <th className="px-5 py-3.5 text-left cursor-pointer hover:text-blue-600 select-none" onClick={() => toggleSort("id")}>
                    <div className="flex items-center gap-1.5">ID <SortIcon field="id" /></div>
                  </th>
                  <th className="px-5 py-3.5 text-left cursor-pointer hover:text-blue-600 select-none" onClick={() => toggleSort("name")}>
                    <div className="flex items-center gap-1.5">Service Name <SortIcon field="name" /></div>
                  </th>
                  <th className="px-5 py-3.5 text-left">Description</th>
                  <th className="px-5 py-3.5 text-left cursor-pointer hover:text-blue-600 select-none" onClick={() => toggleSort("price")}>
                    <div className="flex items-center gap-1.5">Price <SortIcon field="price" /></div>
                  </th>
                  <th className="px-5 py-3.5 text-left">Status</th>
                  <th className="px-5 py-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 bg-white">
                {loading ? (
                  [...Array(pageSize)].map((_, i) => <SkeletonRow key={i} />)
                ) : currentServices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-24">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-20 h-20 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mb-5 shadow-sm transform -rotate-3">
                          <Inbox size={32} className="text-slate-400" />
                        </div>
                        <p className="text-lg font-extrabold text-slate-600 mb-1">No Services Found</p>
                        <p className="text-sm text-slate-400 mb-5">Try adjusting your search or filters.</p>
                        <button onClick={() => { setSearch(""); setFilterStatus("all"); }}
                          className="px-4 py-2 rounded-xl bg-blue-50 text-blue-600 font-bold text-sm hover:bg-blue-100 transition-all">
                          Clear Filters
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentServices.map((service, idx) => (
                    <tr key={service.id}
                      className="group transition-all duration-150 hover:bg-blue-50/40 hover:shadow-[inset_3px_0_0_#2563eb]"
                      style={{ animation: "fadeUp .35s ease both", animationDelay: `${idx * 30}ms` }}>
                      <td className="px-5 py-4 text-slate-400 font-mono text-xs font-medium">#{service.id}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-extrabold flex-shrink-0 shadow-sm">
                            {(service.name || "S").charAt(0).toUpperCase()}
                          </div>
                          <span className="font-bold text-slate-800">{service.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 max-w-xs">
                        {service.description ? (
                          <div className="text-[13px] text-slate-500 leading-relaxed line-clamp-2"
                            dangerouslySetInnerHTML={safeHtml(service.description)} />
                        ) : (
                          <span className="text-slate-300 text-xs italic">No description</span>
                        )}
                      </td>
                      <td className="px-5 py-4 font-bold text-slate-700 whitespace-nowrap">{formatINR(service.price)}</td>
                      <td className="px-5 py-4">
                        {service.active ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setViewService(service)} title="View"
                            className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition-all"><Eye size={14} /></button>
                          <button onClick={() => openModal(service)} title="Edit"
                            className="w-8 h-8 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 flex items-center justify-center transition-all"><Edit size={14} /></button>
                          <button onClick={() => setDeleteTarget(service)} title="Delete"
                            className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 flex items-center justify-center transition-all"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden p-4 space-y-3">
            {currentServices.length > 0 ? (
              currentServices.map(s => (
                <ServiceCard key={s.id} service={s}
                  onView={setViewService}
                  onEdit={openModal}
                  onDelete={setDeleteTarget} />
              ))
            ) : (
              <div className="py-16 text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mb-4 transform -rotate-3">
                  <Inbox size={28} className="text-slate-400" />
                </div>
                <p className="text-base font-extrabold text-slate-600 mb-1">No Services Found</p>
                <p className="text-sm text-slate-400">Try adjusting your search or filters.</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          <CommonPagination
            pageIndex={safePageIndex}
            pageSize={pageSize}
            totalElements={totalElements}
            totalPages={totalPages}
            goToPage={goToPage}
            changePageSize={changePageSize}
          />
        </div>
      </div>

      {/* ADD / EDIT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl my-6 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
                  <Settings size={17} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {editingService ? "Edit Service" : "New Add-On Service"}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {editingService ? `Editing #${editingService.id}` : "Fill in the service details below"}
                  </p>
                </div>
              </div>
              <button onClick={() => setModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500">
              <p className="text-white text-sm font-semibold">Service Information</p>
            </div>

            <form onSubmit={handleSave}>
              <div className="px-6 py-5 space-y-5 overflow-y-auto" style={{ maxHeight: "65vh" }}>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Service Name <span className="text-rose-500">*</span>
                  </label>
                  <input type="text" name="name" required placeholder="e.g. Airport Transfer, Visa Assistance"
                    value={formData.name} onChange={handleChange} className={inputCls} />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description</label>
                  <RichTextEditor
                    key={`desc-${resetKey}`}
                    name="description"
                    initialValue={formData.description}
                    onChange={handleChange}
                    placeholder="Describe what this service includes…"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Price (INR) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">₹</span>
                    <input type="number" name="price" step="0.01" min="0" required
                      value={formData.price} onChange={handleChange}
                      className={`${inputCls} pl-7`} />
                  </div>
                  <p className="mt-1 text-xs text-slate-400">Enter 0 for complimentary services</p>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Active status</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formData.active ? "Visible and bookable in packages" : "Hidden from packages"}
                    </p>
                  </div>
                  <button type="button" onClick={() => setFormData(p => ({ ...p, active: !p.active }))} className="flex-shrink-0 transition active:scale-95">
                    {formData.active
                      ? <ToggleRight size={32} className="text-blue-600" strokeWidth={1.5} />
                      : <ToggleLeft  size={32} className="text-slate-400" strokeWidth={1.5} />}
                  </button>
                </div>

              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-200">
                <button type="button" onClick={() => setModalOpen(false)} disabled={loading}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition shadow-sm">
                  Cancel
                </button>
                <button type="submit" disabled={loading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition shadow-sm shadow-blue-200 active:scale-95 disabled:bg-blue-400 min-w-[130px] justify-center">
                  {loading
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
                    : editingService
                      ? <><Edit size={14} /> Update Service</>
                      : <><Plus size={14} /> Create Service</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}