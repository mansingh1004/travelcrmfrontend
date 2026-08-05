// src/features/leads/components/LeadLogModals.jsx
//
// The activity-log popups, lifted verbatim out of AllLeads.jsx so AllLeadLogs can use them too.
// They replace the routed AddLeadLog / LeadLogs pages, which duplicated this behaviour and had
// drifted: the page version faked its save with a setTimeout and never persisted a log, and its
// list had no delete. These modals were always the working implementation.

import { useState, useEffect } from "react";
import { X, Trash2, Calendar, NotebookPen, Phone, AlertCircle, Bell } from "lucide-react";
import { useToast } from "@shared/ui/toast";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { leadService } from "../api/leadService";

/* ─── ADD LOG MODAL ──────────────────────────────────── */
/* Popup version of the old AddLeadLog page: read-only current stage + hint, inline field
   validation, and an amber follow-up box that auto-creates a reminder assigned to you. */
function AddLogModal({ lead, onClose, onLogAdded }) {
  const [comment, setComment] = useState('');
  const [createReminder, setCreateReminder] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [errs, setErrs] = useState({});
  const [saving, setSaving] = useState(false);
  const leadId = lead.publicId || lead.id;
  const today = new Date().toISOString().slice(0, 10);

  const { showToast } = useToast();

  const validate = () => {
    const e = {};
    if (!comment.trim()) e.comment = 'Log comment is required';
    else if (comment.trim().length < 5) e.comment = 'Comment must be at least 5 characters';
    if (createReminder && !followUpDate) e.followUpDate = 'Please select a follow-up date for the reminder';
    return e;
  };

  const submit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrs(e); showToast('Please fix the errors below.', 'error'); return; }
    try {
      setSaving(true);
      await leadService.addLog(leadId, { comment, createReminder, followUpDate, stage: lead.leadStage });
      showToast('Log saved successfully!', 'success');
      if (onLogAdded) onLogAdded(leadId);
      onClose();
    } catch (err) {
      if (isAlreadyReported(err)) return;   // <ToastHost/> already showed it
      showToast(getErrorMessage(err, 'Failed to save log. Please try again.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto z-10">
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-5 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-amber-300 flex-shrink-0"><NotebookPen size={18} /></div>
            <div className="min-w-0">
              <h2 className="text-white font-extrabold text-base truncate">Add Log for {lead.customerName || 'Lead'}</h2>
              {lead.phone && (
                <p className="text-slate-300 text-xs mt-0.5 inline-flex items-center gap-1"><Phone size={11} /> {lead.phone}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center flex-shrink-0"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-5">

          {/* Current Stage — read-only (snapshotted onto the log server-side) */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">Current Stage</label>
            <input type="text" value={lead.leadStage || '—'} readOnly
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-600 font-medium cursor-not-allowed" />
            <p className="mt-1 text-[11px] text-slate-400">Stage is read-only here — change it from the stage dropdown in the leads list.</p>
          </div>

          {/* Log comment — required, inline validation */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">Log Comment <span className="text-red-500">*</span></label>
            <textarea rows={5} value={comment} autoFocus
              onChange={e => { setComment(e.target.value); setErrs(p => ({ ...p, comment: '' })); }}
              placeholder="Enter notes, follow-up details, call summary, or any important info about this lead…"
              className={`w-full px-3 py-2.5 rounded-xl border text-sm text-slate-700 placeholder-slate-400 outline-none transition-all resize-none ${errs.comment ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-50' : 'border-slate-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-50'}`} />
            {errs.comment
              ? <p className="mt-1 text-[11px] text-red-500 flex items-center gap-1"><AlertCircle size={12} className="flex-shrink-0" />{errs.comment}</p>
              : <p className="mt-1 text-[11px] text-slate-400">Minimum 5 characters.</p>}
          </div>

          {/* Create reminder + follow-up date */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <input id="createReminder" type="checkbox" checked={createReminder}
                onChange={e => { setCreateReminder(e.target.checked); if (!e.target.checked) { setFollowUpDate(''); setErrs(p => ({ ...p, followUpDate: '' })); } }}
                className="w-4 h-4 mt-0.5 rounded border-slate-300 text-amber-600 focus:ring-amber-400 cursor-pointer" />
              <div className="flex-1">
                <label htmlFor="createReminder" className="text-sm font-bold text-slate-700 cursor-pointer select-none">Create reminder for follow-up</label>
                <p className="text-[11px] text-slate-400 mt-0.5">Check this to also create a follow-up reminder.</p>
              </div>
              <Bell size={16} className={`mt-0.5 flex-shrink-0 transition-colors ${createReminder ? 'text-amber-500' : 'text-slate-300'}`} />
            </div>

            {createReminder && (
              <div className="ml-7 p-4 bg-amber-50 border border-amber-200 rounded-xl fade-up">
                <label className="text-[11px] font-extrabold text-amber-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Calendar size={13} /> Follow-up Date <span className="text-red-500">*</span>
                </label>
                <input type="date" value={followUpDate} min={today}
                  onChange={e => { setFollowUpDate(e.target.value); setErrs(p => ({ ...p, followUpDate: '' })); }}
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm text-slate-700 bg-white outline-none transition-all ${errs.followUpDate ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-50' : 'border-amber-300 focus:border-amber-400 focus:ring-2 focus:ring-amber-50'}`} />
                {errs.followUpDate && (
                  <p className="mt-1 text-[11px] text-red-500 flex items-center gap-1"><AlertCircle size={12} className="flex-shrink-0" />{errs.followUpDate}</p>
                )}
                <p className="mt-2 text-[11px] text-amber-600">A reminder will be automatically created and assigned to you.</p>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} disabled={saving} className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 hover:border-slate-300 text-slate-600 font-bold text-sm transition-all bg-white hover:bg-slate-50 disabled:opacity-50">Cancel</button>
            <button onClick={submit} disabled={saving} className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm transition-all shadow-md bg-slate-800 hover:bg-slate-900 disabled:opacity-50 inline-flex items-center justify-center gap-2">
              {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {saving ? 'Saving…' : 'Save Log'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── LOGS LIST MODAL (all activity logs for one lead) ─── */
function LogsModal({ lead, onClose, canDelete }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const leadId = lead.publicId || lead.id;

  const { showToast } = useToast();

  const remove = async (logEntry) => {
    if (!window.confirm('Delete this log entry? This cannot be undone.')) return;
    try {
      setDeletingId(logEntry.id);
      await leadService.deleteLog(leadId, logEntry.id);
      setList(prev => prev.filter(l => l.id !== logEntry.id));
      showToast('Log deleted.', 'success');
    } catch (e) {
      if (isAlreadyReported(e)) return;   // <ToastHost/> already showed it
      showToast(getErrorMessage(e, 'Failed to delete log.'), 'error');
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const res = await leadService.getLeadLogs(leadId);
        const body = res.data;
        const data = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
        // Newest first (backend already orders desc; defensive re-sort).
        data.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        if (active) setList(data);
      } catch (e) {
        // Inline banner, not a toast — it explains the empty list in place.
        if (active) setError(getErrorMessage(e, 'Could not load logs. Please try again.'));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [leadId]);

  const fmtDateTime = (d) => d
    ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';
  const fmtDate = (d) => d
    ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col z-10">
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 rounded-t-2xl flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-amber-300 flex-shrink-0"><NotebookPen size={18} /></div>
            <div className="min-w-0">
              <h2 className="text-white font-extrabold text-base truncate">Activity Logs{!loading && !error ? ` (${list.length})` : ''}</h2>
              <p className="text-slate-300 text-xs truncate">{lead.customerName || 'Lead'} {'·'} newest first</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center flex-shrink-0"><X size={16} /></button>
        </div>

        <div className="p-5 overflow-y-auto">
          {loading ? (
            <div className="py-10 text-center text-slate-400 text-sm">Loading logs{'…'}</div>
          ) : error ? (
            <div className="py-10 text-center text-red-500 text-sm">{error}</div>
          ) : list.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm">No logs yet for this lead.</div>
          ) : (
            <div className="space-y-3">
              {list.map((log, idx) => (
                <div key={log.id || idx} className={`border rounded-xl p-4 transition-all ${idx === 0 ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200'}`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {idx === 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">Latest</span>}
                      {log.stage && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-100 text-slate-700 border-slate-200">{log.stage}</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <p className="text-xs text-slate-400 whitespace-nowrap inline-flex items-center gap-1"><Calendar size={11} /> {fmtDateTime(log.createdAt)}</p>
                      {canDelete && (
                        <button onClick={() => remove(log)} disabled={deletingId === log.id} title="Delete log"
                          className="w-6 h-6 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-all disabled:opacity-50 flex-shrink-0">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed mt-2 whitespace-pre-wrap">{log.comment}</p>
                  <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                      <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-[9px] font-extrabold">{(log.addedBy || 'S').charAt(0).toUpperCase()}</span>
                      {log.addedBy || 'System'}
                    </span>
                    {fmtDate(log.followUpDate) && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600"><Bell size={11} /> Follow-up: {fmtDate(log.followUpDate)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { AddLogModal, LogsModal };
