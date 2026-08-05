// src/features/quotation/components/SuggestPackagesModal.jsx
//
// "Suggest packages for this lead." Reads the lead's cities / nights / budget / travel month from
// the backend, lets the agent nudge star tier + budget + month, and shows the ranked templates with
// an explainable match badge. Picking one clones it into a fresh DRAFT quotation and drops the agent
// into the builder.

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, X, MapPin, Moon, Wallet, CalendarRange, Star, Loader2, PackageOpen, ArrowRight, Repeat } from "lucide-react";
import { templateService } from "../api/templateService";
import MatchBadge, { matchTone } from "./MatchBadge";
import { toast } from "@shared/ui/toast";
import { getErrorMessage } from "@shared/api/apiError";

const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtMoney = (v) =>
  v == null ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

export default function SuggestPackagesModal({ lead, onClose }) {
  const navigate = useNavigate();
  const leadId = lead?.publicId || lead?.id;

  // Overrides — start empty; the backend falls back to the lead's own values.
  const [tier, setTier] = useState("");
  const [budget, setBudget] = useState("");
  const [month, setMonth] = useState("");

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applyingId, setApplyingId] = useState(null);

  const runMatch = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    try {
      const body = { leadId };
      if (tier) body.hotelTier = Number(tier);
      if (budget) body.budget = Number(budget);
      if (month) body.travelMonth = Number(month);
      const data = await templateService.match(body);
      setResults(data);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't load package suggestions."));
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [leadId, tier, budget, month]);

  // First run on open. Re-running after an override tweak is a manual button, so typing a budget
  // doesn't fire a request per keystroke — hence leadId is the only dependency here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { runMatch(); }, [leadId]);

  const apply = async (tpl) => {
    setApplyingId(tpl.id);
    try {
      const quotation = await templateService.apply(tpl.id, { leadId });
      toast.success(`Draft quotation created from “${tpl.name}”.`);
      const qId = quotation?.publicId;
      onClose?.();
      navigate(`/createquotation?leadId=${leadId}&quotationId=${qId}`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't apply this package."));
      setApplyingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl max-h-[88vh] flex flex-col bg-slate-50 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold leading-tight">Suggested Packages</h2>
              <p className="text-xs text-white/80">
                for {lead?.customerName || "this lead"}
                {lead?.itinerary?.length ? ` · ${lead.itinerary.map((l) => l.city).filter(Boolean).join(", ")}` : ""}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Override bar */}
        <div className="px-6 py-3 bg-white border-b border-slate-100 flex flex-wrap items-end gap-3 flex-shrink-0">
          <Override icon={Star} label="Star tier">
            <select value={tier} onChange={(e) => setTier(e.target.value)} className="override-input">
              <option value="">Any</option>
              {[3, 4, 5].map((s) => <option key={s} value={s}>{s}★</option>)}
            </select>
          </Override>
          <Override icon={Wallet} label="Budget ₹">
            <input type="number" min="0" value={budget} onChange={(e) => setBudget(e.target.value)}
              placeholder={lead?.budget ? String(lead.budget) : "lead's"} className="override-input w-28" />
          </Override>
          <Override icon={CalendarRange} label="Travel month">
            <select value={month} onChange={(e) => setMonth(e.target.value)} className="override-input">
              <option value="">{lead?.travelDate ? "From lead" : "Any"}</option>
              {MONTHS.slice(1).map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </Override>
          <button onClick={runMatch} disabled={loading}
            className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold transition-all">
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Re-match
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Loader2 size={28} className="animate-spin mb-3" />
              <p className="text-sm font-semibold">Scoring packages…</p>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4 -rotate-3">
                <PackageOpen size={26} className="text-slate-400" />
              </div>
              <p className="text-sm font-bold text-slate-600 mb-1">No packages yet</p>
              <p className="text-xs text-slate-400 max-w-xs">
                Build a quotation for this lead and use <b>Save as Package</b> — it will be suggested
                automatically the next time a similar enquiry comes in.
              </p>
            </div>
          ) : (
            <>
              {/* Cold start: the backend flags these when NOTHING cleared the score threshold. They
                  are "here is what you have", not "here is what fits", and must never be mixed in
                  with real matches — hence the divider rather than a subtler visual cue. */}
              {results[0]?.belowThreshold && (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs font-bold text-slate-600">Nothing scored a strong match</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Your closest packages are below, so you can start from one and edit — or widen the
                    budget and star tier above and re-match.
                  </p>
                </div>
              )}
              {results.map((tpl) => (
                <TemplateCard key={tpl.id} tpl={tpl} onApply={() => apply(tpl)} applying={applyingId === tpl.id} anyApplying={applyingId != null} />
              ))}
            </>
          )}
        </div>
      </div>

      {/* Local styles for the compact override inputs — kept here so the modal is self-contained. */}
      <style>{`
        .override-input {
          padding: 6px 10px; font-size: 12px; font-weight: 600; color: #334155;
          background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; outline: none;
        }
        .override-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.15); }
      `}</style>
    </div>
  );
}

function Override({ icon: Icon, label, children }) {
  return (
    <div>
      <label className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
        <Icon size={11} /> {label}
      </label>
      {children}
    </div>
  );
}

function TemplateCard({ tpl, onApply, applying, anyApplying }) {
  const tone = matchTone(tpl.matchPercentage);
  return (
    <div className={`bg-white border rounded-2xl p-4 shadow-sm transition-all hover:shadow-md ${tpl.matchPercentage >= 75 ? "border-emerald-200" : "border-slate-200"}`}>
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-extrabold text-slate-800 truncate">{tpl.name}</h3>
            {tpl.hotelTier && (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-amber-600">
                {tpl.hotelTier}<Star size={11} className="fill-amber-400 text-amber-400" />
              </span>
            )}
            {/* Usage is the ranking's tie-breaker, so showing it explains why two equal scores
                ordered the way they did. */}
            {tpl.timesApplied > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400">
                <Repeat size={10} /> used {tpl.timesApplied}×
              </span>
            )}
          </div>
          {tpl.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{tpl.description}</p>}

          <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500 flex-wrap">
            {tpl.cities?.length > 0 && (
              <span className="inline-flex items-center gap-1"><MapPin size={12} className="text-slate-400" />{tpl.cities.join(" · ")}</span>
            )}
            {tpl.durationNights != null && (
              <span className="inline-flex items-center gap-1"><Moon size={12} className="text-slate-400" />{tpl.durationNights}N</span>
            )}
            <span className="inline-flex items-center gap-1 font-bold text-slate-700"><Wallet size={12} className="text-slate-400" />{fmtMoney(tpl.basePrice)}</span>
          </div>
        </div>

        <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center ring-1 flex-shrink-0 ${tone.bg} ${tone.ring}`}>
          <span className={`text-lg font-extrabold leading-none ${tone.text}`}>{tpl.matchPercentage}</span>
          <span className={`text-[9px] font-bold uppercase ${tone.text} opacity-70`}>match</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 flex items-end justify-between gap-3">
        <div className="flex-1 min-w-0">
          <MatchBadgeInline components={tpl.components} />
        </div>
        <button onClick={onApply} disabled={anyApplying}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold transition-all flex-shrink-0 active:scale-95">
          {applying ? <><Loader2 size={13} className="animate-spin" /> Creating…</> : <>Use package <ArrowRight size={13} /></>}
        </button>
      </div>
    </div>
  );
}

// A trimmed, always-inline version of the breakdown (no ring — the card already shows the %).
function MatchBadgeInline({ components = [] }) {
  return <MatchBadge percentage={null} components={components} defaultOpen={false} inlineOnly />;
}