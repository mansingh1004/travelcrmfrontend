import { useCallback, useEffect, useState } from "react";
import {
  Megaphone, Send, Loader2, CheckCircle2, AlertTriangle, X, Users, Building2,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { announcementService } from "../api/announcementService";
import SuperAdminMfaActionModal from "../components/SuperAdminMfaActionModal";

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus";

const AUDIENCE = [
  { value: "ALL", label: "All operational (Active + Trial)" },
  { value: "ACTIVE", label: "Active only" },
  { value: "TRIAL", label: "Trial only" },
];
const RECIPIENTS = [
  { value: "ADMINS", label: "Tenant admins only" },
  { value: "ALL_USERS", label: "All active users" },
];
const labelOf = (arr, v) => arr.find((o) => o.value === v)?.label || v;

const fmt = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
};

export default function Announcements() {
  const [form, setForm] = useState({ title: "", message: "", audience: "ALL", recipientScope: "ADMINS" });
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({});
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mfaOpen, setMfaOpen] = useState(false);
  const [mfaError, setMfaError] = useState("");
  const [toast, setToast] = useState(null);

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { rows, pagination } = await announcementService.history({ page, size: 10 });
      setRows(rows);
      setPagination(pagination);
    } catch {
      showToast("error", "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [page, showToast]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const canSend = form.title.trim() && form.message.trim();

  const requestSend = () => {
    setMfaError("");
    setConfirming(false);
    setMfaOpen(true);
  };

  const send = async (mfaCode) => {
    setSending(true);
    setMfaError("");
    try {
      const res = await announcementService.send(form, mfaCode);
      setMfaOpen(false);
      showToast("success", `Sent to ${res.tenantCount} tenant(s) · ${res.recipientCount} user(s)`);
      setForm({ title: "", message: "", audience: "ALL", recipientScope: "ADMINS" });
      setPage(0);
      loadHistory();
    } catch (e) {
      setMfaError(e?.response?.data?.message || "Send failed");
    } finally {
      setSending(false);
    }
  };

  const totalPages = pagination.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-heading">Announcements</h1>
        <p className="text-sm text-body">Broadcast a message to tenants — delivered to their in-app notification bell.</p>
      </div>

      {/* Compose */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent-soft-text">
            <Megaphone size={16} />
          </div>
          <h2 className="text-sm font-bold text-heading">New announcement</h2>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Title</label>
            <input value={form.title} maxLength={200} onChange={(e) => setField("title", e.target.value)}
              placeholder="e.g. Scheduled maintenance this Sunday" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Message</label>
            <textarea rows={4} value={form.message} onChange={(e) => setField("message", e.target.value)}
              placeholder="Write the announcement…" className={inputCls} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">Audience</label>
              <select value={form.audience} onChange={(e) => setField("audience", e.target.value)} className={inputCls}>
                {AUDIENCE.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">Recipients</label>
              <select value={form.recipientScope} onChange={(e) => setField("recipientScope", e.target.value)} className={inputCls}>
                {RECIPIENTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={() => setConfirming(true)} disabled={!canSend}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-text hover:bg-accent-hover disabled:opacity-50">
              <Send size={15} /> Send announcement
            </button>
          </div>
        </div>
      </section>

      {/* History */}
      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-bold text-heading">History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border bg-surface-hover text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Sent</th>
                <th className="px-4 py-3 font-semibold">Announcement</th>
                <th className="px-4 py-3 font-semibold">Audience</th>
                <th className="px-4 py-3 text-right font-semibold">Reach</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-muted"><Loader2 size={18} className="mx-auto animate-spin" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-muted">
                  <Megaphone size={28} className="mx-auto mb-2 opacity-50" /> No announcements sent yet.
                </td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.publicId} className="align-top hover:bg-surface-hover/60">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">
                      {fmt(r.createdAt)}
                      {r.sentByEmail && <div className="text-[11px]">{r.sentByEmail}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-heading">{r.title}</div>
                      <div className="mt-0.5 line-clamp-2 max-w-[420px] text-xs text-muted">{r.message}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-body">
                      {labelOf(AUDIENCE, r.audience)}
                      <div className="text-muted">{labelOf(RECIPIENTS, r.recipientScope)}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-xs">
                      <div className="inline-flex items-center gap-1 font-semibold text-body"><Building2 size={12} /> {r.tenantCount}</div>
                      <div className="inline-flex items-center gap-1 text-muted"><Users size={12} /> {r.recipientCount}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
            <span className="text-muted">Page {page + 1} of {totalPages}</span>
            <div className="flex gap-1">
              <button disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-strong text-body hover:bg-surface-hover disabled:opacity-40">
                <ChevronLeft size={16} />
              </button>
              <button disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-strong text-body hover:bg-surface-hover disabled:opacity-40">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Confirm modal */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/50" onClick={sending ? undefined : () => setConfirming(false)} />
          <div className="relative w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-xl">
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-bold text-heading">Send announcement?</h3>
              <button onClick={() => setConfirming(false)} disabled={sending} className="text-muted hover:text-body"><X size={18} /></button>
            </div>
            <p className="mt-2 text-sm text-body">
              <b>{labelOf(AUDIENCE, form.audience)}</b> · <b>{labelOf(RECIPIENTS, form.recipientScope)}</b>.
              Recipients are notified immediately.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setConfirming(false)} disabled={sending}
                className="rounded-lg border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-body hover:bg-surface-hover">
                Cancel
              </button>
              <button onClick={requestSend} disabled={sending}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-text hover:bg-accent-hover disabled:opacity-60">
                {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Send
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[60] flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-lg ${
          toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
        }`}>
          {toast.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

      {mfaOpen && (
        <SuperAdminMfaActionModal
          title="Confirm announcement send"
          description="Enter your authenticator code to send this announcement to tenants."
          confirmLabel="Send"
          saving={sending}
          error={mfaError}
          onClose={() => (sending ? undefined : setMfaOpen(false))}
          onConfirm={send}
        />
      )}
    </div>
  );
}
