

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Search, Star, MapPin, Moon, Wallet, Pencil, Trash2,
  Archive, PackageOpen, Loader2, X, LayoutGrid,
} from "lucide-react";
import { templateService } from "../api/templateService";
import { hasPermission, P } from "@shared/lib/access";
import { toast } from "@shared/ui/toast";
import { getErrorMessage } from "@shared/api/apiError";

const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtMoney = (v) =>
  v == null ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

export default function PackageTemplates() {
  const navigate = useNavigate();
  const canCreate = hasPermission(P.QUOTATION_CREATE);
  const canEdit = hasPermission(P.QUOTATION_UPDATE);
  const canDelete = hasPermission(P.QUOTATION_DELETE);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [activeFilter, setActiveFilter] = useState("all"); // all | active | archived
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const active = activeFilter === "all" ? null : activeFilter === "active";
      const { items } = await templateService.list({ keyword, active, size: 100, sortBy: "updatedAt", sortDir: "desc" });
      setItems(items);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't load templates."));
    } finally {
      setLoading(false);
    }
  }, [keyword, activeFilter]);

  // Debounce the search; filter changes apply immediately.
  useEffect(() => {
    const t = setTimeout(load, keyword ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, keyword]);

  const confirmDelete = async () => {
    const tpl = deleteTarget;
    setDeleteTarget(null);
    try {
      await templateService.remove(tpl.id);
      toast.success(`Template “${tpl.name}” deleted.`);
      setItems((prev) => prev.filter((t) => t.id !== tpl.id));
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't delete this template."));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-5 py-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
              <LayoutGrid size={22} />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-slate-800">Package Templates</h1>
              <p className="text-xs text-slate-500">Reusable blueprints that seed quotations and power lead matching</p>
            </div>
          </div>
          {canCreate && (
            <button onClick={() => navigate("/quotations/templates/new")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-all active:scale-95 shadow-lg shadow-indigo-600/20">
              <Plus size={16} strokeWidth={2.5} /> New Template
            </button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 py-5">
        {/* Controls */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Search templates…"
              className="w-full pl-10 pr-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
          </div>
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
            {[["all", "All"], ["active", "Active"], ["archived", "Archived"]].map(([val, lbl]) => (
              <button key={val} onClick={() => setActiveFilter(val)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeFilter === val ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Loader2 size={28} className="animate-spin mb-3" />
            <p className="text-sm font-semibold">Loading templates…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4 -rotate-3">
              <PackageOpen size={30} className="text-slate-400" />
            </div>
            <p className="text-base font-bold text-slate-600 mb-1">No templates yet</p>
            <p className="text-sm text-slate-400 mb-5 max-w-sm">
              Build a reusable package once — itinerary, hotels, pricing — then match it to leads and
              clone it into quotations in one click.
            </p>
            {canCreate && (
              <button onClick={() => navigate("/quotations/templates/new")}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-all">
                <Plus size={16} strokeWidth={2.5} /> Create your first template
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((tpl) => (
              <TemplateCard key={tpl.id} tpl={tpl}
                onEdit={canEdit ? () => navigate(`/quotations/templates/${tpl.id}/edit`) : null}
                onDelete={canDelete ? () => setDeleteTarget(tpl) : null} />
            ))}
          </div>
        )}
      </div>

      {deleteTarget && (
        <DeleteConfirm tpl={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
      )}
    </div>
  );
}

function TemplateCard({ tpl, onEdit, onDelete }) {
  const archived = tpl.active === false;
  return (
    <div className={`group bg-white border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all ${archived ? "border-slate-200 opacity-75" : "border-slate-200"}`}>
      {/* Cover */}
      <div className="relative h-28 bg-gradient-to-br from-indigo-500 to-violet-600 overflow-hidden">
        {tpl.coverImageUrl && (
          <img src={tpl.coverImageUrl} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        {archived && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800/80 text-white text-[10px] font-bold">
            <Archive size={10} /> Archived
          </span>
        )}
        {tpl.hotelTier && (
          <span className="absolute top-2 right-2 inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-white/90 text-amber-600 text-[11px] font-extrabold">
            {tpl.hotelTier}<Star size={11} className="fill-amber-400 text-amber-400" />
          </span>
        )}
        <div className="absolute bottom-2 left-3 right-3">
          <h3 className="text-white font-extrabold text-sm truncate drop-shadow">{tpl.name}</h3>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-2 flex-wrap min-h-[16px]">
          {tpl.cities?.length > 0 && (
            <span className="inline-flex items-center gap-1"><MapPin size={12} className="text-slate-400" />{tpl.cities.join(" · ")}</span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-600 mb-3 flex-wrap">
          {tpl.durationNights != null && (
            <span className="inline-flex items-center gap-1"><Moon size={12} className="text-slate-400" />{tpl.durationNights}N / {tpl.durationDays}D</span>
          )}
          <span className="inline-flex items-center gap-1 font-bold text-slate-800"><Wallet size={12} className="text-slate-400" />{fmtMoney(tpl.basePrice)}</span>
        </div>

        {/* Season chips */}
        <div className="flex items-center gap-1 mb-3 flex-wrap min-h-[20px]">
          {tpl.seasonMonths?.length > 0 ? (
            tpl.seasonMonths.map((m) => (
              <span key={m} className="px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 text-[10px] font-bold">{MONTHS[m]}</span>
            ))
          ) : (
            <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[10px] font-bold">Year-round</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
          {onEdit && (
            <button onClick={onEdit} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all">
              <Pencil size={13} /> Edit
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} title="Delete" className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-500 transition-all">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DeleteConfirm({ tpl, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-extrabold text-slate-800">Delete template?</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400"><X size={16} /></button>
        </div>
        <p className="text-sm text-slate-500 mb-5">
          Delete <span className="font-bold text-slate-700">“{tpl.name}”</span>? It will stop appearing
          in matches. Quotations already created from it are untouched.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md shadow-rose-200 transition-all">Yes, delete</button>
        </div>
      </div>
    </div>
  );
}