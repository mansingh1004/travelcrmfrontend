// src/features/masters/components/NominateHotelDialog.jsx
// ─────────────────────────────────────────────────────────────────────────────
// "We work with this hotel — put it on the platform."
//
// The nomination flow existed on every side except this one: the endpoint
// (POST /api/hotel-marketplace/nominations), the SuperAdmin review queue and the
// frontend service were all written, and no tenant screen ever called them. A
// tenant could not make the suggestion the reviewer was waiting for.
//
// The Hotel Master is the right place for it — these are properties the agency
// already has rate agreements with, which makes them the best-qualified leads for
// the catalog in the system. Accepting one does NOT create a catalog hotel: it
// sends the property a partner invitation, and the hotel fills in its own details
// and rate card. That is why the email is required and the rest is optional — the
// whole outcome of an accepted nomination is a message to that address.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { Send, X } from "lucide-react";

import { marketplaceService } from "@features/marketplace";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { toast } from "@shared/ui/toast";

const FIELD =
  "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 " +
  "font-medium placeholder-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none";

export default function NominateHotelDialog({ hotel, onClose, onDone }) {
  const [contactEmail, setContactEmail] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [emailError, setEmailError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    const email = contactEmail.trim();
    if (!email) {
      setEmailError("The hotel's contact email is required — the invitation is sent to it.");
      return;
    }
    setSaving(true);
    setEmailError("");
    try {
      /* Only `sourceHotelPublicId` and the email are sent. The server copies name, city, country
         and address off the tenant's own master row, so this cannot drift from what the agency
         already has on file — and re-submitting a hotel that already has an open nomination
         returns the existing one rather than erroring, so a double-click is not a duplicate. */
      await marketplaceService.submitNomination({
        sourceHotelPublicId: hotel.publicId,
        contactEmail: email,
        contactName: contactName.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        note: note.trim() || undefined,
      });
      toast.success(`${hotel.name} suggested to the platform.`);
      onDone?.();
      onClose();
    } catch (err) {
      // 400 is silent by contract (shared/api/authRealm.js) — the call site renders it.
      if (!isAlreadyReported(err)) {
        const msg = getErrorMessage(err, "Could not send the suggestion. Please try again.");
        if (/email/i.test(msg)) setEmailError(msg);
        else toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-slate-200/60 bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-base font-extrabold text-slate-800">Suggest to the platform</h3>
            <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
              {hotel.name}
              {hotel.city ? ` · ${hotel.city}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3.5 px-5 py-4">
          <p className="rounded-xl bg-blue-50/70 px-3.5 py-2.5 text-xs leading-5 font-medium text-blue-800">
            The platform contacts the hotel and invites it to register itself — it does not add the
            property on your behalf, and its rates come from the hotel, not from this form.
          </p>

          <label className="block">
            <span className="text-xs font-bold text-slate-600">
              Hotel&apos;s contact email <span className="text-rose-500">*</span>
            </span>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => { setContactEmail(e.target.value); setEmailError(""); }}
              placeholder="reservations@hotel.com"
              className={`mt-1 ${FIELD} ${emailError ? "border-rose-300 focus:border-rose-400 focus:ring-rose-50" : ""}`}
            />
            {emailError && <span className="mt-1 block text-xs font-semibold text-rose-600">{emailError}</span>}
          </label>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold text-slate-600">Contact person</span>
              <input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Optional"
                className={`mt-1 ${FIELD}`}
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-600">Phone</span>
              <input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="Optional"
                className={`mt-1 ${FIELD}`}
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-bold text-slate-600">Why it is worth contracting</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Volume, season, the rates you already get — the reviewer reads this."
              className={`mt-1 ${FIELD} resize-none`}
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-500 px-5 py-2 text-sm font-bold text-white shadow-md shadow-blue-200 transition-all hover:from-blue-700 hover:to-indigo-600 disabled:opacity-60"
          >
            <Send size={14} /> {saving ? "Sending…" : "Send suggestion"}
          </button>
        </div>
      </form>
    </div>
  );
}
