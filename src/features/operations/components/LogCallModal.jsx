// features/operations/components/LogCallModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Write down what the supplier said on the phone.
//
// The call happens either way — the board already puts the number one click away.
// What goes missing is everything after it: what they said, and when to chase again.
// So this form is deliberately shaped around those two fields, not around the call.
//
// It does NOT move the line's status. A phone call is a real contact, but it is also
// how "I rang them, I think they said yes" enters a system as fact. Confirming stays
// a separate, deliberate act.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { Loader2, Phone, X } from "lucide-react";

import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { toast } from "@shared/ui/toast";
import operationsService from "../api/operationsService";

/* An open vocabulary on the server (a varchar, not an enum, so a team can invent its
   own) — these are just the ones worth one click. Typing anything else is allowed. */
const QUICK_OUTCOMES = [
  "Confirmed",
  "Awaiting reply",
  "Rate revised",
  "Not available",
  "Callback requested",
  "No answer",
];

const labelCls = "text-[10px] font-extrabold uppercase tracking-wide text-slate-400";
const fieldCls =
  "w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-700 " +
  "font-medium placeholder-slate-400 focus:border-blue-400 outline-none";

export default function LogCallModal({ bookingPublicId, line, onLogged, onClose }) {
  const [saving, setSaving] = useState(false);
  const [direction, setDirection] = useState("OUTGOING");
  const [outcome, setOutcome] = useState("");
  const [minutes, setMinutes] = useState("");
  const [notes, setNotes] = useState("");
  const [followUp, setFollowUp] = useState("");

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !saving) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await operationsService.logVendorCall(bookingPublicId, line.publicId, {
        direction,
        toNumber: line.vendorPhone || line.vendorAlternatePhone || undefined,
        durationSeconds: Math.max(0, Math.round(Number(minutes || 0) * 60)),
        outcome: outcome.trim() || undefined,
        notes: notes.trim() || undefined,
        // datetime-local is wall-clock with no zone. new Date() reads it as local and
        // toISOString converts to UTC, which is what an Instant wants — never send the
        // raw string, it would be read as UTC and land hours off.
        followUpAt: followUp ? new Date(followUp).toISOString() : undefined,
      });
      toast.success("Call logged");
      onLogged?.();
      onClose();
    } catch (err) {
      if (!isAlreadyReported(err)) toast.error(getErrorMessage(err, "Could not log that call"));
    } finally {
      setSaving(false);
    }
  };

  const dirBtn = (value, label) => (
    <button
      key={value}
      onClick={() => setDirection(value)}
      className={`text-[11px] font-extrabold px-2.5 py-1 rounded-lg ring-1 transition-colors ${
        direction === value
          ? "bg-blue-50 text-blue-700 ring-blue-300"
          : "bg-white text-slate-500 ring-slate-200 hover:text-slate-700"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Log a supplier call"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl"
        style={{ fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}
      >
        <div className="flex items-start gap-2 px-4 py-3 border-b border-slate-100">
          <Phone className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-extrabold text-slate-700 truncate">
              {line.vendorName || "Supplier"}
            </p>
            <p className="text-[11px] text-slate-400 truncate">{line.title}</p>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="shrink-0 p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-3 space-y-3">
          <div className="flex items-center gap-1.5">
            {dirBtn("OUTGOING", "I called")}
            {dirBtn("INCOMING", "They called")}
            {dirBtn("MISSED", "Missed")}
            <div className="ml-auto flex items-center gap-1">
              <input
                type="number"
                min="0"
                step="1"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="0"
                aria-label="Duration in minutes"
                className="w-14 px-2 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-700 text-right outline-none focus:border-blue-400"
              />
              <span className="text-[10px] font-bold text-slate-400">min</span>
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="lcm-outcome">Outcome</label>
            <input
              id="lcm-outcome"
              autoFocus
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              maxLength={40}
              placeholder="What came of it"
              className={`${fieldCls} mt-1`}
            />
            <div className="mt-1.5 flex flex-wrap gap-1">
              {QUICK_OUTCOMES.map((o) => (
                <button
                  key={o}
                  onClick={() => setOutcome(o)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 transition-colors ${
                    outcome === o
                      ? "bg-blue-50 text-blue-700 ring-blue-300"
                      : "bg-white text-slate-400 ring-slate-200 hover:text-slate-600"
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="lcm-notes">Notes</label>
            <textarea
              id="lcm-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Confirmation number, rate, who you spoke to…"
              className={`${fieldCls} mt-1 resize-y`}
            />
          </div>

          <div>
            {/* The most valuable field on this form: a call whose next step is not written
                down is a call whose next step depends on somebody remembering. */}
            <label className={labelCls} htmlFor="lcm-followup">Chase again on</label>
            <input
              id="lcm-followup"
              type="datetime-local"
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              className={`${fieldCls} mt-1 font-bold`}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-100">
          <p className="text-[10px] text-slate-400 flex-1 min-w-0">
            Logging a call does not change the line's status.
          </p>
          <button
            onClick={onClose}
            disabled={saving}
            className="text-[11px] font-bold text-slate-500 hover:text-slate-700 px-2 py-1.5 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 text-[11px] font-extrabold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : "Log call"}
          </button>
        </div>
      </div>
    </div>
  );
}
