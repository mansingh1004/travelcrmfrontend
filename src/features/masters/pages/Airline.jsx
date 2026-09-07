import {
  useState,
  useRef,
  useMemo,
  useEffect,
} from "react";

import SupplierPicker from "../components/SupplierPicker";
import { vendorService } from "@features/vendors";


import { useNavigate } from "react-router-dom";
import { Plane, Plus, Search, Edit2, Trash2, Eye, X, Upload, CheckCircle2, AlertCircle, Clock, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Globe, Tag } from "lucide-react";

import {
  airlineService,
  normalizeAirlineList,
  transformAirlineResponse,
  uploadAirlineLogo,
} from "../api/airlineService";
import { toast } from "@shared/ui/toast";
import { getErrorMessage } from "@shared/api/apiError";

const STATUS_STYLES = {
  Active: "bg-green-50 text-green-700 border border-green-200",
  Inactive: "bg-gray-100 text-gray-500 border border-gray-200",
  Suspended: "bg-red-50 text-red-600 border border-red-200",
};

const CARD_THEMES = [
  { bg: "from-blue-500 via-blue-600 to-indigo-700", badge: "bg-blue-400/30 text-blue-50", icon: "bg-white/20", stat: "bg-white/10" },
  { bg: "from-orange-400 via-orange-500 to-red-500", badge: "bg-orange-400/30 text-orange-50", icon: "bg-white/20", stat: "bg-white/10" },
  { bg: "from-red-500 via-red-600 to-rose-700", badge: "bg-red-400/30 text-red-50", icon: "bg-white/20", stat: "bg-white/10" },
  { bg: "from-purple-500 via-purple-600 to-violet-700", badge: "bg-purple-400/30 text-purple-50", icon: "bg-white/20", stat: "bg-white/10" },
  { bg: "from-sky-500 via-sky-600 to-cyan-600", badge: "bg-sky-400/30 text-sky-50", icon: "bg-white/20", stat: "bg-white/10" },
  { bg: "from-rose-500 via-rose-600 to-pink-700", badge: "bg-rose-400/30 text-rose-50", icon: "bg-white/20", stat: "bg-white/10" },
  { bg: "from-teal-500 via-teal-600 to-emerald-700", badge: "bg-teal-400/30 text-teal-50", icon: "bg-white/20", stat: "bg-white/10" },
  { bg: "from-amber-500 via-amber-600 to-yellow-600", badge: "bg-amber-400/30 text-amber-50", icon: "bg-white/20", stat: "bg-white/10" },
  { bg: "from-fuchsia-500 via-fuchsia-600 to-purple-700", badge: "bg-fuchsia-400/30 text-fuchsia-50", icon: "bg-white/20", stat: "bg-white/10" },
  { bg: "from-lime-500 via-green-500 to-emerald-600", badge: "bg-lime-400/30 text-lime-50", icon: "bg-white/20", stat: "bg-white/10" },
  { bg: "from-cyan-500 via-cyan-600 to-blue-600", badge: "bg-cyan-400/30 text-cyan-50", icon: "bg-white/20", stat: "bg-white/10" },
  { bg: "from-indigo-500 via-indigo-600 to-blue-700", badge: "bg-indigo-400/30 text-indigo-50", icon: "bg-white/20", stat: "bg-white/10" },
];

const PAGE_SIZE_OPTIONS = [4, 8, 12];

const EMPTY_FORM = {
  name: "",
  iata: "",
  status: "Active",
  country: "",
  fleet: "",
  logoFile: null,
  logoUrl: null,
  preview: null,
  /* Blank = the carrier is its own supplier; a vendor is minted when a ticket cost needs a payee. */
  vendorPublicId: "", clearVendorLink: false, vendorLabel: "",
};

function formatDate(str) {
  if (!str) return "—";

  const date = new Date(str);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getDisplayId(airline) {
  const value =
    airline?.publicId ??
    airline?.id ??
    "";

  return String(value)
    .slice(0, 8)
    .toUpperCase();
}


function AirlineLogo({ airline, size = "md" }) {
  const sz = size === "sm" ? "w-8 h-8 text-xs" : size === "lg" ? "w-16 h-16 text-lg" : "w-12 h-12 text-sm";
  if (airline.logo) return <img src={airline.logo} alt={airline.name} className={`${sz} rounded-2xl object-contain bg-white border border-white/30 shadow-lg`} />;
  return (
    <div className={`${sz} rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center shadow-lg flex-shrink-0`}>
      <span className="font-black text-white leading-none">{airline.initials}</span>
    </div>
  );
}

function StatusBadge({ status }) {
  const icons = { Active: <CheckCircle2 size={11} />, Inactive: <Clock size={11} />, Suspended: <AlertCircle size={11} /> };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLES[status] || STATUS_STYLES.Inactive}`}>
      {icons[status]}{status}
    </span>
  );
}

function AirlineCard({ airline, theme, onView, onEdit, onDelete }) {
  return (
    <div className="rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 group">
      {/* Colorful top section */}
      <div className={`bg-gradient-to-br ${theme.bg} p-5 relative overflow-hidden`}>
        {/* Decorative circles */}
        <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10" />
        <div className="absolute -bottom-8 -left-4 w-20 h-20 rounded-full bg-white/10" />
        <div className="absolute top-1/2 right-8 w-10 h-10 rounded-full bg-white/5" />

        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-3">
            <AirlineLogo airline={airline} size="md" />
            <div>
              <h3 className="font-black text-white text-base leading-tight">{airline.name}</h3>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${theme.badge}`}>{airline.iata || "—"}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${theme.badge} flex items-center gap-1`}>
                  <Globe size={9} />
                   {airline.country || "Unknown"}
                </span>
              </div>
              {/* The consolidator tickets are actually bought through — rarely the carrier itself,
                  and the one thing this card could never tell you. Absent until one is linked. */}
              {airline.vendorName && (
                <p className="mt-1 text-[11px] font-semibold text-white/70">via {airline.vendorName}</p>
              )}
            </div>
          </div>
          <StatusBadge status={airline.status} />
        </div>

        {/* Stats row */}
        <div className="relative mt-4 grid grid-cols-2 gap-2">
          <div className={`${theme.stat} rounded-xl px-3 py-2`}>
            <p className="text-white/60 text-xs">Fleet Size</p>
            <p className="text-white font-bold text-lg leading-none mt-0.5">{airline.fleet ?? 0}</p>
          </div>
          <div className={`${theme.stat} rounded-xl px-3 py-2`}>
            <p className="text-white/60 text-xs">Added</p>
            <p className="text-white font-semibold text-xs leading-none mt-1">{formatDate(airline.createdAt)}</p>
          </div>
        </div>
      </div>

      {/* White bottom action bar */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-t-0">
        <div className="flex items-center gap-1.5">
          <Tag size={12} className="text-gray-400" />
          <span className="text-xs text-gray-400">
            ID #{getDisplayId(airline)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onView(airline)} title="View"
            className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition active:scale-90">
            <Eye size={14} />
          </button>
          <button onClick={() => onEdit(airline)} title="Edit"
            className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition active:scale-90">
            <Edit2 size={14} />
          </button>
          <button onClick={() => onDelete(airline)} title="Delete"
            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition active:scale-90">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Pagination({ current, total, pageSize, onPage, onPageSize, totalItems }) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1 && pageSize >= total) return null;

  const getPages = () => {
    if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, "...", pages];
    if (current >= pages - 3) return [1, "...", pages - 4, pages - 3, pages - 2, pages - 1, pages];
    return [1, "...", current - 1, current, current + 1, "...", pages];
  };

  const from = (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-1">
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500">Showing <span className="font-semibold text-gray-700">{from}–{to}</span> of <span className="font-semibold text-gray-700">{totalItems}</span></span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">Per page:</span>
          <select value={pageSize} onChange={e => onPageSize(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button onClick={() => onPage(1)} disabled={current === 1}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed transition">
          <ChevronsLeft size={14} />
        </button>
        <button onClick={() => onPage(current - 1)} disabled={current === 1}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed transition">
          <ChevronLeft size={14} />
        </button>

        {getPages().map((p, i) => (
          p === "..." ? (
            <span key={`dot-${i}`} className="w-8 h-8 flex items-center justify-center text-gray-400 text-sm">…</span>
          ) : (
            <button key={p} onClick={() => onPage(p)}
              className={`w-8 h-8 rounded-lg text-xs font-semibold border transition ${p === current ? "bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-200" : "border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600"}`}>
              {p}
            </button>
          )
        ))}

        <button onClick={() => onPage(current + 1)} disabled={current === pages}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed transition">
          <ChevronRight size={14} />
        </button>
        <button onClick={() => onPage(pages)} disabled={current === pages}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed transition">
          <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  );
}

function Modal({ show, onClose, children }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[600px] max-h-[90vh] overflow-y-auto transform transition-all duration-200 animate-in fade-in zoom-in-95">
        {children}
      </div>
    </div>
  );
}

function ViewModal({ airline, onClose }) {
  if (!airline) return null;

  const themeIndex =
    Number.isInteger(airline.themeIndex)
      ? airline.themeIndex
      : 0;

  const theme =
    CARD_THEMES[
      themeIndex % CARD_THEMES.length
    ] ?? CARD_THEMES[0];
  return (
    <Modal show={!!airline} onClose={onClose}>
      <div className={`bg-gradient-to-br ${theme.bg} rounded-t-2xl p-6 relative overflow-hidden`}>
        <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10" />
        <div className="absolute -bottom-8 -left-4 w-24 h-24 rounded-full bg-white/10" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <AirlineLogo airline={airline} size="lg" />
            <div>
              <h3 className="text-2xl font-black text-white">{airline.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${theme.badge}`}>{airline.iata || "—"}</span>
                <span className={`text-xs px-2.5 py-1 rounded-full ${theme.badge}`}>{airline.country || "Unknown"}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition flex-shrink-0"><X size={18} /></button>
        </div>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            ["Airline ID",  `#${getDisplayId(airline)}`,],
            ["IATA Code", airline.iata || "—"],
            ["Country", airline.country || "Unknown"],
            ["Fleet Size", `${airline.fleet ?? 0} aircraft`],
            ["Date Added", formatDate(airline.createdAt)],
            ["Status", airline.status],
          ].map(([k, v]) => (
            <div key={k} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="text-xs text-gray-400 mb-0.5">{k}</p>
              <p className="text-sm font-bold text-gray-800">{v}</p>
            </div>
          ))}
        </div>
        <div className="mb-2">
          <StatusBadge status={airline.status} />
        </div>
      </div>
      <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
        <button onClick={onClose} className="px-5 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Close</button>
      </div>
    </Modal>
  );
}

export default function AirlineMaster() {
  const navigate = useNavigate();

  const [airlines, setAirlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  const [airlineStatsOpen, setAirlineStatsOpen] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ ...EMPTY_FORM });

  const [errors, setErrors] = useState({});
  const [drag, setDrag] = useState(false);

  const fileRef = useRef(null);

  const loadAirlines = async () => {
  try {
    setLoading(true);

    const response = await airlineService.getAllAirlines();

    const rawAirlines = normalizeAirlineList(response.data);

    const mappedAirlines = rawAirlines.map((airline, index) =>
      transformAirlineResponse(airline, index)
    );

    setAirlines(mappedAirlines);
  } catch (error) {
    console.error("Failed to load airlines:", error);

    setAirlines([]);

    toast.error(
      getErrorMessage(error, "Unable to load airlines.")
    );
  } finally {
    setLoading(false);
  }
};

useEffect(() => {
  loadAirlines();
}, []);

useEffect(() => {
  return () => {
    if (
      form.preview &&
      form.preview.startsWith("blob:")
    ) {
      URL.revokeObjectURL(form.preview);
    }
  };
}, [form.preview]);

  const filtered = useMemo(() => {
  const query = search.trim().toLowerCase();

  let list = airlines.filter((airline) => {
    const name = airline.name?.toLowerCase() ?? "";
    const country = airline.country?.toLowerCase() ?? "";
    const iata = airline.iata?.toLowerCase() ?? "";

    return (
      name.includes(query) ||
      country.includes(query) ||
      iata.includes(query)
    );
  });

  list = [...list].sort((a, b) => {
    const firstValue = a[sortField] ?? "";
    const secondValue = b[sortField] ?? "";

    if (sortDir === "asc") {
      return firstValue > secondValue ? 1 : -1;
    }

    return firstValue < secondValue ? 1 : -1;
  });

  return list;
}, [airlines, search, sortField, sortDir]);

  const paginated = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  useEffect(() => {
  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / pageSize)
  );

  if (page > totalPages) {
    setPage(totalPages);
  }
}, [filtered.length, page, pageSize]);

  const handlePageSize = (s) => { setPageSize(s); setPage(1); };
  const handleSearch = (v) => { setSearch(v); setPage(1); };

  const openAdd = () => {
  setForm({ ...EMPTY_FORM });
  setErrors({});
  setEditing(null);
  setUploadProgress(0);
  setShowAdd(true);
};


  const openEdit = (airline) => {
  setForm({
    name: airline.name ?? "",
    iata: airline.iata ?? "",
    status: airline.status ?? "Active",
    country: airline.country ?? "",
    fleet:
      airline.fleet != null
        ? String(airline.fleet)
        : "",
    logoFile: null,
    logoUrl: airline.logo ?? null,
    preview: airline.logo ?? null,
    vendorPublicId: "", clearVendorLink: false, vendorLabel: "",
  });

  // One row, when the form opens — the airline DTO deliberately does not carry the link. A failed
  // lookup leaves the picker blank, and a blank picker never sends clearVendorLink, so it cannot
  // unlink the carrier by accident.
  const airlineId = airline?.id ?? airline?.airlineId;
  if (airlineId) {
    vendorService.linkOf("AIRLINE", airlineId)
      .then((linked) => setForm(f => ({
        ...f,
        vendorPublicId: linked?.publicId || "",
        vendorLabel:    linked?.vendorName || "",
      })))
      .catch(() => {});
  }

  setErrors({});
  setEditing(airline);
  setUploadProgress(0);
  setShowAdd(true);
};

const resetFormModal = () => {
  setShowAdd(false);
  setEditing(null);
  setForm({ ...EMPTY_FORM });
  setErrors({});
  setDrag(false);
  setUploadProgress(0);

  if (fileRef.current) {
    fileRef.current.value = "";
  }
};

const closeFormModal = () => {
  if (saving) return;

  resetFormModal();
};

  const handleFile = (file) => {
  if (!file) return;

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/svg+xml",
    "image/webp",
  ];

  if (!allowedTypes.includes(file.type)) {
    setErrors((previous) => ({
      ...previous,
      logo: "Only JPG, PNG, SVG and WEBP files are allowed.",
    }));
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    setErrors((previous) => ({
      ...previous,
      logo: "Maximum file size is 2 MB.",
    }));
    return;
  }

  if (
  form.preview &&
  form.preview.startsWith("blob:")
) {
  URL.revokeObjectURL(form.preview);
}

  const previewUrl = URL.createObjectURL(file);

  setForm((previous) => ({
    ...previous,
    logoFile: file,
    preview: previewUrl,
  }));

  setErrors((previous) => ({
    ...previous,
    logo: null,
  }));
};

  const validate = () => {
  const validationErrors = {};

  if (!form.name.trim()) {
    validationErrors.name = "Airline name is required";
  }

  if (!form.iata.trim()) {
    validationErrors.iata = "IATA code is required";
  } else if (!/^[A-Z0-9]{2,3}$/.test(form.iata.trim())) {
    validationErrors.iata =
      "IATA code must contain 2 or 3 letters/numbers";
  }

  if (form.fleet !== "") {
  const fleetSize = Number(form.fleet);

  if (!Number.isInteger(fleetSize)) {
    validationErrors.fleet =
      "Fleet size must be a whole number";
  } else if (fleetSize < 0) {
    validationErrors.fleet =
      "Fleet size cannot be negative";
  }
}

  setErrors(validationErrors);

  return Object.keys(validationErrors).length === 0;
};

  const handleSave = async () => {
  if (!validate() || saving) return;

  try {
    setSaving(true);

    let logoUrl = form.logoUrl;

    if (form.logoFile) {
      try {
        setUploadingLogo(true);
        setUploadProgress(0);

        logoUrl = await uploadAirlineLogo(
          form.logoFile,
          (percent) => {
            setUploadProgress(percent);
          }
        );
      } finally {
        setUploadingLogo(false);
      }
    }

    const payload = {
      ...form,
      logoUrl,
    };

    if (editing) {
      const publicId =
        editing.publicId ?? editing.id;

      await airlineService.updateAirline(
        publicId,
        payload
      );

      toast.success(
        "Airline updated successfully."
      );
    } else {
      await airlineService.createAirline(payload);

      toast.success(
        "Airline created successfully."
      );
    }

    resetFormModal();
    setPage(1);

    await loadAirlines();
  } catch (error) {
    console.error("Failed to save airline:", error);

    toast.error(
      getErrorMessage(
        error,
        editing
          ? "Unable to update airline."
          : "Unable to create airline."
      )
    );
  } finally {
    setSaving(false);
    setUploadingLogo(false);
  }
};



  const handleDelete = async (airline) => {
  const publicId =
    airline.publicId ?? airline.id;

  if (!publicId || deletingId) return;

  try {
    setDeletingId(publicId);

    await airlineService.deleteAirline(publicId);

    setAirlines((previous) =>
      previous.filter(
        (item) =>
          (item.publicId ?? item.id) !== publicId
      )
    );

    setDeleting(null);

    toast.success(
      "Airline deleted successfully."
    );
  } catch (error) {
    console.error("Failed to delete airline:", error);

    toast.error(
      getErrorMessage(
        error,
        "Unable to delete airline."
      )
    );
  } finally {
    setDeletingId(null);
  }
};



  const handleSort = (f) => { if (sortField === f) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortField(f); setSortDir("asc"); } };
  const SortIcon = ({ field }) => sortField === field ? (sortDir === "asc" ? <ChevronUp size={13} className="text-blue-600" /> : <ChevronDown size={13} className="text-blue-600" />) : <ChevronDown size={13} className="text-gray-300" />;

  const activeCount = airlines.filter(a => a.status === "Active").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100"
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        ::-webkit-scrollbar{width:6px;height:6px}
        ::-webkit-scrollbar-track{background:#f1f5f9;border-radius:99px}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:99px}
      `}</style>
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-md shadow-blue-200 overflow-hidden flex-shrink-0">
                <div className="absolute inset-x-0 -top-1/2 h-full bg-gradient-to-b from-white/25 to-transparent opacity-60" />
                <Plane size={18} className="relative text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-black text-slate-800 leading-none">Airline Master</h1>
                <p className="text-xs text-slate-400 mt-1">
                  Manage airlines
                  <span className="hidden sm:inline ml-2 text-slate-300">|</span>
                  <span className="hidden sm:inline ml-2">
                    <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={() => navigate("/")}>Home</span>
                    <span className="mx-1 text-slate-300">/</span>
                    <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={() => navigate("/masters/cruises")}>Masters</span>
                    <span className="mx-1 text-slate-300">/</span>
                    <span className="text-blue-600 font-bold">Airlines</span>
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={e => handleSearch(e.target.value)} placeholder="Search name, country, IATA..." className="border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64 transition bg-slate-50 focus:bg-white" />
              </div>
              <button onClick={openAdd} className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 text-white px-3 sm:px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md shadow-blue-200 whitespace-nowrap flex-shrink-0">
                <Plus size={16} /> <span className="hidden sm:inline">Add New Airline</span><span className="sm:hidden">Add</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      {/* <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Airlines", value: airlines.length, gradient: "from-blue-500 to-indigo-600", icon: "bg-white/20" },
            { label: "Active", value: activeCount, gradient: "from-green-500 to-emerald-600", icon: "bg-white/20" },
            { label: "Inactive", value: airlines.filter(a => a.status === "Inactive").length, gradient: "from-gray-400 to-gray-600", icon: "bg-white/20" },
            { label: "Suspended", value: airlines.filter(a => a.status === "Suspended").length, gradient: "from-red-500 to-rose-600", icon: "bg-white/20" },
          ].map(s => (
            <div key={s.label} className={`relative overflow-hidden bg-gradient-to-br ${s.gradient} rounded-2xl px-4 py-4 flex items-center gap-3 shadow-lg ring-1 ring-white/10 hover:-translate-y-0.5 transition-transform`}>
              <div className="absolute inset-x-0 -top-1/2 h-full bg-gradient-to-b from-white/20 to-transparent opacity-60 pointer-events-none" />
              <div className={`relative w-10 h-10 rounded-xl ${s.icon} flex items-center justify-center flex-shrink-0 shadow-inner`}>
                <Plane size={18} className="text-white" />
              </div>
              <div className="relative">
                <p className="text-2xl font-black text-white leading-none">{s.value}</p>
                <p className="text-xs text-white/70 mt-0.5 font-medium">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div> */}

      {/* ── COLLAPSIBLE AIRLINE ANALYTICS ── */}
<div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-4">
  <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">

    {/* Toggle header */}
    <button
      type="button"
      onClick={() => setAirlineStatsOpen((previous) => !previous)}
      aria-expanded={airlineStatsOpen}
      className="w-full px-4 sm:px-5 py-3 flex items-center justify-between gap-3
        hover:bg-slate-50 transition-colors"
    >
      <div className="flex items-center gap-3 flex-wrap min-w-0">
        <div className="flex items-center gap-2">
          <Plane size={16} className="text-blue-600" />

          <span className="text-sm font-extrabold text-slate-700">
            Airline Analytics
          </span>
        </div>

        {/* Small values visible when closed */}
        {!airlineStatsOpen && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold">
              {airlines.length} Total
            </span>

            <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-[11px] font-bold">
              {activeCount} Active
            </span>

            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold">
              {airlines.filter((a) => a.status === "Inactive").length} Inactive
            </span>

            <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-[11px] font-bold">
              {airlines.filter((a) => a.status === "Suspended").length} Suspended
            </span>
          </div>
        )}
      </div>

      <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
        {airlineStatsOpen ? (
          <ChevronUp size={16} />
        ) : (
          <ChevronDown size={16} />
        )}
      </div>
    </button>

    {/* Expandable cards */}
    <div
      className={`grid transition-all duration-300 ease-in-out ${
        airlineStatsOpen
          ? "grid-rows-[1fr] opacity-100"
          : "grid-rows-[0fr] opacity-0"
      }`}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 pt-1">
          {[
            {
              label: "Total Airlines",
              value: airlines.length,
              gradient: "from-blue-500 to-indigo-600",
              icon: "bg-white/20",
            },
            {
              label: "Active",
              value: activeCount,
              gradient: "from-green-500 to-emerald-600",
              icon: "bg-white/20",
            },
            {
              label: "Inactive",
              value: airlines.filter(
                (airline) => airline.status === "Inactive"
              ).length,
              gradient: "from-gray-400 to-gray-600",
              icon: "bg-white/20",
            },
            {
              label: "Suspended",
              value: airlines.filter(
                (airline) => airline.status === "Suspended"
              ).length,
              gradient: "from-red-500 to-rose-600",
              icon: "bg-white/20",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`relative overflow-hidden bg-gradient-to-br ${stat.gradient}
                rounded-2xl px-4 py-4 flex items-center gap-3 shadow-lg
                ring-1 ring-white/10 hover:-translate-y-0.5
                transition-transform`}
            >
              <div className="absolute inset-x-0 -top-1/2 h-full bg-gradient-to-b from-white/20 to-transparent opacity-60 pointer-events-none" />

              <div
                className={`relative w-10 h-10 rounded-xl ${stat.icon}
                  flex items-center justify-center flex-shrink-0 shadow-inner`}
              >
                <Plane size={18} className="text-white" />
              </div>

              <div className="relative">
                <p className="text-2xl font-black text-white leading-none">
                  {stat.value}
                </p>

                <p className="text-xs text-white/70 mt-0.5 font-medium">
                  {stat.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
</div>

      {/* Cards Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 overflow-hidden shadow-sm">
          {/* Card area header */}
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-extrabold text-slate-800">Airlines Directory</h2>
              <p className="text-xs text-slate-400 mt-0.5">{filtered.length} of {airlines.length} airlines</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400">Sort:</span>
              {[["name", "Name"], ["createdAt", "Date"], ["status", "Status"]].map(([f, l]) => (
                <button key={f} onClick={() => handleSort(f)}
                  className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border transition font-medium ${sortField === f ? "bg-blue-600 border-blue-600 text-white" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                  {l} <SortIcon field={f} />
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {loading ? (
            <div className="py-16 text-center">
            <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto" />

            <p className="text-sm text-slate-500 mt-4">
             Loading airlines...
            </p>
            </div>
            ) : paginated.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Plane size={28} className="text-blue-300" />
                </div>
                <h3 className="text-base font-semibold text-gray-600 mb-1">No Airlines Found</h3>
                <p className="text-sm text-gray-400 mb-5">{search ? "Try a different search term" : "Get started by adding your first airline"}</p>
                {!search && (
                  <button onClick={openAdd} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition">
                    <Plus size={15} /> Add New Airline
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {paginated.map((airline, index) => (
                 <AirlineCard
                  key={airline.publicId ?? airline.id}
                  airline={airline}
                  theme={
                   CARD_THEMES[
                   ((page - 1) * pageSize + index) %
                  CARD_THEMES.length
                  ]
                 }
                    onView={setViewing}
                    onEdit={openEdit}
                    onDelete={setDeleting}
                  />
                  ))}
              </div>
            )}

            {/* Pagination */}
            {filtered.length > 0 && (
              <div className="mt-6 pt-5 border-t border-gray-100">
                <Pagination
                  current={page}
                  total={filtered.length}
                  pageSize={pageSize}
                  onPage={setPage}
                  onPageSize={handlePageSize}
                  totalItems={filtered.length}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        show={showAdd}
        onClose={closeFormModal}
      >
        <div className="relative bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 rounded-t-2xl px-6 py-5 flex items-center justify-between overflow-hidden">
          <div className="absolute inset-x-0 -top-1/2 h-full bg-gradient-to-b from-white/20 to-transparent opacity-60 pointer-events-none" />
          <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10" />
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-inner flex-shrink-0">
              <Plane size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-black text-white leading-tight">{editing ? "Edit Airline" : "Add New Airline"}</h2>
              <p className="text-xs text-white/70">{editing ? "Update airline details" : "Create a new airline record"}</p>
            </div>
          </div>
          <button
             type="button"
            onClick={closeFormModal}
             disabled={saving}
            className="relative p-2 rounded-xl bg-white/20 hover:bg-white/30 disabled:opacity-50 text-white transition flex-shrink-0"
          >
          <X size={18} />
           </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Airline Name <span className="text-red-500">*</span></label>
            <input value={form.name} onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(er => ({ ...er, name: null })); }}
              placeholder="Enter airline name"
              className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${errors.name ? "border-red-400 bg-red-50" : "border-gray-200 bg-white"}`} />
            {errors.name && <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.name}</p>}
          </div>


          <div>
           <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            IATA Code
           <span className="text-red-500"> *</span>
         </label>

         <input
           type="text"
           value={form.iata}
           maxLength={3}
           onChange={(event) => {
           const value = event.target.value
           .toUpperCase()
           .replace(/[^A-Z0-9]/g, "");

          setForm((previous) => ({
           ...previous,
           iata: value,
         }));

          setErrors((previous) => ({
            ...previous,
          iata: null,
          }));
        }}
          placeholder="e.g. AI"
          className={`w-full border rounded-xl px-4 py-2.5 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
          errors.iata
          ? "border-red-400 bg-red-50"
          : "border-gray-200 bg-white"
          }`}
         />

         {errors.iata && (
         <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
             <AlertCircle size={11} />
          {errors.iata}
        </p>
         )}
        </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Country</label>
              <input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="e.g. India" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-white" />
            </div>
            {/* Most agencies pay a consolidator, not the carrier — this is where that is recorded,
                so every ticket cost lands on the party that actually invoices them. */}
            <div className="sm:col-span-2">
              <SupplierPicker
                value={form.vendorPublicId}
                linkedLabel={form.vendorLabel}
                hint="Usually your consolidator. Leave blank to treat the carrier as its own supplier."
                onChange={(publicId) => setForm(f => ({
                  ...f,
                  vendorPublicId: publicId,
                  clearVendorLink: !publicId && Boolean(f.vendorLabel || f.vendorPublicId),
                }))}
              />
            </div>
            <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Fleet Size
          </label>

          <input
            value={form.fleet}
            onChange={(event) => {
            setForm((previous) => ({
            ...previous,
            fleet: event.target.value,
          }));

             setErrors((previous) => ({
             ...previous,
             fleet: null,
            }));
           }}
            type="number"
            min="0"
            placeholder="e.g. 120"
            className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-white ${
            errors.fleet
              ? "border-red-400"
              : "border-gray-200"
            }`}
           />

            {errors.fleet && (
             <p className="mt-1.5 text-xs text-red-500">
            {errors.fleet}
              </p>
             )}
          </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Status</label>
            <div className="flex gap-2">
              {["Active", "Inactive", "Suspended"].map(s => (
                <button key={s} type="button" onClick={() => setForm(f => ({ ...f, status: s }))}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${form.status === s ? s === "Active" ? "bg-green-600 border-green-600 text-white" : s === "Suspended" ? "bg-red-500 border-red-500 text-white" : "bg-gray-600 border-gray-600 text-white" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Airline Logo</label>
            {form.preview ? (
              <div className="relative border-2 border-blue-200 rounded-2xl p-4 flex flex-col items-center gap-3 bg-blue-50">
                <img src={form.preview} alt="Preview" className="w-20 h-20 object-contain rounded-xl border border-gray-100 bg-white shadow-sm" />
                <p className="text-xs text-green-600 font-semibold flex items-center gap-1">
                <CheckCircle2 size={13} />
                 {form.logoFile
                  ? "New logo selected"
                  : "Current logo"}
                  </p>
                <button
                  type="button"
                  onClick={() =>
                  setForm((previous) => ({
                    ...previous,
                    logoFile: null,
                    logoUrl: null,
                   preview: null,
                   }))
                  }
                   className="absolute top-3 right-3 p-1 rounded-lg hover:bg-white text-gray-400 transition"
                   >
                   <X size={14} />
                  </button>
              </div>
            ) : (
              <div
                onDragOver={e => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
                onClick={() => fileRef.current.click()}
                className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer transition ${drag ? "border-blue-400 bg-blue-50" : errors.logo ? "border-red-300 bg-red-50" : "border-gray-200 hover:border-blue-300 hover:bg-blue-50/50"}`}>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition ${drag ? "bg-blue-100" : "bg-gray-100"}`}>
                  <Upload size={22} className={drag ? "text-blue-600" : "text-gray-400"} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-700">Drag & drop or <span className="text-blue-600">browse</span></p>
                  <p className="text-xs text-gray-400 mt-0.5">JPG, PNG, SVG, WEBP — Max 2MB</p>
                </div>
                <input
                 ref={fileRef}
                 type="file"
                 className="hidden"
                 accept="image/jpeg,image/png,image/svg+xml,image/webp"
                 onChange={(event) => {
                  handleFile(event.target.files?.[0]);
                  event.target.value = "";
                 }}
               />
              </div>
            )}
            {errors.logo && <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.logo}</p>}

            {uploadingLogo && (
            <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
             <span>Uploading logo...</span>
             <span>{uploadProgress}%</span>
            </div>

             <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
               className="h-full bg-blue-600 transition-all"
               style={{
               width: `${uploadProgress}%`,
               }}
              />
              </div>
             </div>
             )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button
            type="button"
            onClick={closeFormModal}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
           Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl text-sm font-bold transition active:scale-95 shadow-md shadow-blue-200"
          >
            {saving ? (
            <>
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />

         {uploadingLogo
          ? `Uploading ${uploadProgress}%`
          : editing
          ? "Updating..."
          : "Saving..."}
         </>
         ) : (
         <>
         <Plane size={14} />
          {editing
          ? "Update Airline"
          : "Save Airline"}
           </>
          )}
         </button>
        </div>
      </Modal>

      <ViewModal airline={viewing} onClose={() => setViewing(null)} />

      {/* Delete Confirm */}
      <Modal
       show={!!deleting}
       onClose={() => {
        if (!deletingId) {
         setDeleting(null);
        }
      }}
      >
        {deleting && (
          <>
            <div className="p-6 pt-8 text-center">
              <div className="relative w-16 h-16 mx-auto mb-4">
                <span className="absolute inset-0 rounded-2xl bg-red-100 animate-ping opacity-40" />
                <div className="relative w-16 h-16 bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-200 ring-4 ring-red-50">
                  <Trash2 size={26} className="text-white" />
                </div>
              </div>
              <h3 className="text-lg font-black text-gray-900 mb-1">Delete Airline?</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Are you sure you want to delete <span className="font-bold text-gray-800">{deleting.name}</span>?<br className="hidden sm:block" /> This action cannot be undone.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                disabled={Boolean(deletingId)}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition w-full sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleting)}
                disabled={
                 deletingId ===
                (deleting.publicId ?? deleting.id)
               }
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-bold transition active:scale-95 shadow-md shadow-red-200 w-full sm:w-auto"
              >
              {deletingId ===
               (deleting.publicId ?? deleting.id)
                ? "Deleting..."
                : "Delete Airline"}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}




