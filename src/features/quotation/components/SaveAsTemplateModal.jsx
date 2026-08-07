// src/features/quotation/components/SaveAsTemplateModal.jsx
//
// "Save this quotation as a reusable package."
//
// The whole dialog is driven by a server-computed preview rather than by anything the builder holds
// in memory. That is deliberate: a Quotation stores no master ids and has no table for flights,
// cruises, vehicles or add-ons, so what can actually be captured is a backend question. Asking it
// first means the losses are shown BEFORE the agent commits, and the dialog can never drift from
// what the save really does.
//
// Visual language matches SuggestPackagesModal (indigo→violet), since the two are the two ends of
// the same loop: save a package here, get it suggested there.

import { useState, useEffect, useCallback } from "react";
import {
  BookmarkPlus, X, Loader2, AlertTriangle, Check, MapPin, Moon,
  CircleAlert, PackageOpen,
} from "lucide-react";
import { templateService } from "../api/templateService";
import { toast } from "@shared/ui/toast";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const SERVICE_LABEL = {
  flight: "Flights",
  hotel: "Hotels",
  sightseeing: "Sightseeing",
  cruise: "Cruise",
  vehicle: "Vehicles",
  addons: "Add-ons",
};

export default function SaveAsTemplateModal({ quotationId, onClose, onSaved }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Overrides. Empty string means "keep whatever the server derived" — never send a blank.
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tier, setTier] = useState("");
  const [price, setPrice] = useState("");
  const [months, setMonths] = useState([]);
  const [replaceExisting, setReplaceExisting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await templateService.previewFromQuotation(quotationId);
        if (cancelled) return;
        setPreview(data);
        setName(data?.name ?? "");
        setDescription(data?.description ?? "");
        setTier(data?.hotelTier != null ? String(data.hotelTier) : "");
        setPrice(data?.basePrice != null ? String(data.basePrice) : "");
      } catch (err) {
        if (cancelled) return;
        if (!isAlreadyReported(err)) {
          toast.error(getErrorMessage(err, "Couldn't read this quotation."));
        }
        onClose?.();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [quotationId, onClose]);

  const toggleMonth = useCallback((index) => {
    setMonths((prev) =>
      prev.includes(index) ? prev.filter((m) => m !== index) : [...prev, index].sort((a, b) => a - b));
  }, []);

  const save = async () => {
    if (!name.trim()) {
      toast.error("Give the package a name.");
      return;
    }
    setSaving(true);
    try {
      const body = { quotationId, name: name.trim() };
      if (description.trim()) body.description = description.trim();
      if (tier) body.hotelTier = Number(tier);
      if (price) body.basePrice = Number(price);
      // Always send the array — an empty one is a meaningful value here ("sold year-round"), so it
      // must not be confused with "keep what you derived".
      body.seasonMonths = months;
      if (replaceExisting && preview?.nearDuplicate?.id) {
        body.updateTemplateId = preview.nearDuplicate.id;
      }

      const saved = await templateService.saveFromQuotation(body);
      toast.success(
        replaceExisting ? `Updated “${saved?.name ?? name}”.` : `Saved “${saved?.name ?? name}” as a package.`);
      onSaved?.(saved);
      onClose?.();
    } catch (err) {
      // 400/404/409 are silent by contract, so a duplicate-name conflict needs saying here.
      if (!isAlreadyReported(err)) {
        toast.error(getErrorMessage(err, "Couldn't save this package."));
      }
      setSaving(false);
    }
  };

  const unresolved = (preview?.cities ?? []).filter((c) => !c.resolved);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !saving && onClose()} />

      <div className="relative w-full max-w-xl max-h-[88vh] flex flex-col bg-slate-50 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
              <BookmarkPlus size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold leading-tight">Save as Package</h2>
              <p className="text-xs text-white/80">Reuse this quotation for the next similar enquiry</p>
            </div>
          </div>
          <button onClick={() => !saving && onClose()}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all">
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 size={28} className="animate-spin mb-3" />
            <p className="text-sm font-semibold">Reading the quotation…</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Near-duplicate warning — scored by the same matcher that ranks suggestions. */}
              {preview?.nearDuplicate && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-amber-900">
                        You already have a very similar package
                      </p>
                      <p className="text-[11px] text-amber-700 mt-0.5">
                        “{preview.nearDuplicate.name}” scores {preview.nearDuplicate.matchPercentage}% against
                        this quotation. Saving another will give you two near-identical suggestions.
                      </p>
                      <label className="mt-2 flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={replaceExisting}
                          onChange={(e) => setReplaceExisting(e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-amber-300 text-amber-600 focus:ring-amber-400" />
                        <span className="text-[11px] font-bold text-amber-900">
                          Update “{preview.nearDuplicate.name}” instead of creating a new one
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Name + description */}
              <Field label="Package name" required>
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={150}
                  placeholder="e.g. Kerala Classic 5N" className="sat-input" />
              </Field>

              <Field label="Description" hint="Shown on the suggestion card">
                <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                  rows={2} className="sat-input resize-none" placeholder="What makes this package worth reusing?" />
              </Field>

              {/* What we captured */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Captured from this quotation</p>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-600">
                  {preview?.cities?.length > 0 && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin size={12} className="text-slate-400" />
                      {preview.cities.map((c) => c.name).join(" · ")}
                    </span>
                  )}
                  {preview?.durationNights != null && (
                    <span className="inline-flex items-center gap-1.5">
                      <Moon size={12} className="text-slate-400" />{preview.durationNights} nights
                    </span>
                  )}
                </div>

                {preview?.services?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {preview.services.map((s) => (
                      <span key={s} className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                        {SERVICE_LABEL[s] ?? s}
                      </span>
                    ))}
                  </div>
                )}

                {preview?.capturedSections?.length > 0 && (
                  <ul className="space-y-1">
                    {preview.capturedSections.map((s) => (
                      <li key={s} className="flex items-center gap-1.5 text-[11px] text-emerald-700">
                        <Check size={12} className="flex-shrink-0" />{s}
                      </li>
                    ))}
                  </ul>
                )}

                {/* The losses. Stated plainly — a package template has no table for these. */}
                {preview?.droppedSections?.length > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                      Not carried into the package
                    </p>
                    <ul className="space-y-1">
                      {preview.droppedSections.map((s) => (
                        <li key={s} className="flex items-center gap-1.5 text-[11px] text-slate-400">
                          <X size={11} className="flex-shrink-0" />{s}
                        </li>
                      ))}
                    </ul>
                    <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                      A package stores the itinerary, hotels and inclusions. Prices are always recalculated
                      when it is applied to a new enquiry.
                    </p>
                  </div>
                )}

                {unresolved.length > 0 && (
                  <div className="flex items-start gap-1.5 pt-2 border-t border-slate-100">
                    <CircleAlert size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-700 leading-relaxed">
                      {unresolved.map((c) => c.name).join(", ")} {unresolved.length === 1 ? "is" : "are"} not in
                      your City master, so {unresolved.length === 1 ? "it" : "they"} can only be matched by name.
                    </p>
                  </div>
                )}
              </div>

              {/* Scoring inputs */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Star tier" hint="Used to match star preference">
                  <select value={tier} onChange={(e) => setTier(e.target.value)} className="sat-input">
                    <option value="">Not set</option>
                    {[1, 2, 3, 4, 5].map((s) => <option key={s} value={s}>{s} star</option>)}
                  </select>
                </Field>
                <Field
                  label="Indicative price ₹"
                  hint={preview?.pricedForPax ? `Quoted for ${preview.pricedForPax} pax` : "Used to match budget"}>
                  <input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)}
                    className="sat-input" placeholder="Not set" />
                </Field>
              </div>

              <Field label="Sold in" hint="Leave all unticked for a year-round package">
                <div className="flex flex-wrap gap-1.5">
                  {MONTHS.map((m, i) => {
                    const on = months.includes(i + 1);
                    return (
                      <button key={m} type="button" onClick={() => toggleMonth(i + 1)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                          on ? "bg-indigo-600 text-white shadow-sm"
                             : "bg-white text-slate-500 border border-slate-200 hover:border-indigo-300"}`}>
                        {m}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 bg-white border-t border-slate-100 flex-shrink-0">
              <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
                <PackageOpen size={12} /> Appears in Suggested Packages straight away
              </p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={onClose} disabled={saving}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all disabled:opacity-60">
                  Cancel
                </button>
                <button type="button" onClick={save} disabled={saving}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all active:scale-95 disabled:opacity-60">
                  {saving
                    ? <><Loader2 size={13} className="animate-spin" /> Saving…</>
                    : <><BookmarkPlus size={13} /> {replaceExisting ? "Update package" : "Save package"}</>}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Kept local so the modal is self-contained, matching SuggestPackagesModal's convention. */}
      <style>{`
        .sat-input {
          width: 100%; padding: 8px 12px; font-size: 13px; font-weight: 500; color: #334155;
          background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; outline: none;
        }
        .sat-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.15); }
      `}</style>
    </div>
  );
}

function Field({ label, hint, required, children }) {
  return (
    <div>
      <label className="flex items-baseline gap-2 mb-1.5">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
          {label}{required && <span className="text-rose-400"> *</span>}
        </span>
        {hint && <span className="text-[10px] text-slate-400 font-medium">{hint}</span>}
      </label>
      {children}
    </div>
  );
}
