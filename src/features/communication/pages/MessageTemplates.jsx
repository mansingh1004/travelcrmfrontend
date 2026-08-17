// features/communication/pages/MessageTemplates.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The template library — and the reason the WhatsApp composer is usable at all.
//
// WhatsApp accepts only pre-approved templates outside the 24-hour window, so a
// lead who has never written to the agency can be reached in exactly one way:
// through a row in this table. Until this screen existed those rows had to be
// inserted into comm_templates by hand.
//
// THE WORKFLOW THIS SCREEN IS SHAPED AROUND
// An agency writes the copy here, submits it to the provider, and comes back days
// later to record the approved name against it. DRAFT is that waiting state, and
// it is why the list shows drafts by default while the composer never does.
//
// Two rules are the server's, and both are surfaced before the save rather than
// after the refusal:
//   • arity is DERIVED from the body — the highest {{n}}, not how many appear —
//     because a mismatched parameter count is the commonest provider refusal
//   • a WhatsApp template cannot go ACTIVE without its approved provider name;
//     there would be nothing for WhatsApp to render
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Check, Loader2, Mail, MessageSquare, Pencil, Plus, Trash2, X,
} from "lucide-react";
import { useToast } from "@shared/ui/toast";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import communicationService from "../api/communicationService";

const FONT = { fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" };

const CHANNELS = [
  { key: "WHATSAPP", label: "WhatsApp", Icon: MessageSquare },
  { key: "EMAIL", label: "Email", Icon: Mail },
];

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-[12.5px] text-slate-700 " +
  "font-medium placeholder-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none";

const labelCls = "block text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wide mb-1";

/* The same rule the server applies: the HIGHEST index, not the count. A body using
   {{1}} and {{3}} needs three values — the provider counts positions, not mentions —
   and showing anything else here would promise a send that gets refused. */
function arityOf(body) {
  let max = 0;
  for (const m of String(body || "").matchAll(/\{\{\s*(\d+)\s*\}\}/g)) {
    max = Math.max(max, Number(m[1]));
  }
  return max;
}

const emptyForm = {
  channel: "WHATSAPP",
  name: "",
  category: "",
  subject: "",
  body: "",
  providerTemplateName: "",
  languageCode: "en",
  variables: "",
  status: "DRAFT",
};

function Modal({ open, onClose, children, title }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/25" onClick={onClose} />
      <div
        style={FONT}
        className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto pointer-events-none"
      >
        <div className="w-full max-w-lg mt-12 bg-white rounded-2xl border border-slate-200 shadow-xl pointer-events-auto">
          <header className="flex items-center gap-3 px-5 py-3 border-b border-slate-200">
            <h2 className="flex-1 text-[14px] font-extrabold text-slate-800">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </header>
          <div className="px-5 py-4">{children}</div>
        </div>
      </div>
    </>
  );
}

export default function MessageTemplates() {
  const { showToast } = useToast();

  const [channel, setChannel] = useState("WHATSAPP");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(null); // null = closed, {} = new
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await communicationService.templates(channel, { activeOnly: false }));
    } catch (e) {
      if (!isAlreadyReported(e)) {
        showToast(getErrorMessage(e, "Could not load templates."), "error");
      }
    } finally {
      setLoading(false);
    }
  }, [channel, showToast]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setForm({ ...emptyForm, channel });
    setEditing({});
  };

  const openEdit = (t) => {
    setForm({
      channel: t.channel,
      name: t.name || "",
      category: t.category || "",
      subject: t.subject || "",
      body: t.body || "",
      providerTemplateName: t.providerTemplateName || "",
      languageCode: t.languageCode || "en",
      variables: (t.variables || []).join(", "),
      status: t.status || "DRAFT",
    });
    setEditing(t);
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const arity = arityOf(form.body);
  const varLabels = form.variables.split(",").map((s) => s.trim()).filter(Boolean);

  // The server refuses this combination; saying so here turns a 422 into a disabled
  // button and a sentence that names the missing field.
  const blockedReason =
    form.status === "ACTIVE" && form.channel === "WHATSAPP" && !form.providerTemplateName.trim()
      ? "A WhatsApp template needs its approved provider name before it can go active."
      : null;

  const canSave = form.name.trim() && form.body.trim() && !blockedReason && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        channel: form.channel,
        name: form.name.trim(),
        category: form.category.trim() || undefined,
        subject: form.channel === "EMAIL" ? form.subject.trim() || undefined : undefined,
        body: form.body,
        providerTemplateName: form.providerTemplateName.trim() || undefined,
        languageCode: form.languageCode.trim() || undefined,
        variables: varLabels,
        status: form.status,
      };
      if (editing?.publicId) {
        await communicationService.updateTemplate(editing.publicId, payload);
        showToast("Template updated.", "success");
      } else {
        await communicationService.createTemplate(payload);
        showToast("Template created.", "success");
      }
      setEditing(null);
      load();
    } catch (e) {
      if (!isAlreadyReported(e)) {
        showToast(getErrorMessage(e, "Could not save this template."), "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t) => {
    if (!window.confirm(`Delete the template "${t.name}"? Messages already sent from it keep their record.`)) {
      return;
    }
    try {
      await communicationService.deleteTemplate(t.publicId);
      showToast("Template deleted.", "success");
      load();
    } catch (e) {
      if (!isAlreadyReported(e)) {
        showToast(getErrorMessage(e, "Could not delete this template."), "error");
      }
    }
  };

  const activeCount = useMemo(() => rows.filter((r) => r.status === "ACTIVE").length, [rows]);

  return (
    <div style={FONT} className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      <div className="px-4 sm:px-6 lg:px-8 py-5 max-w-5xl">
        <header className="flex items-start gap-3 mb-4">
          <div className="flex-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Communication Center</p>
            <h1 className="text-xl font-extrabold text-slate-800">Message templates</h1>
            <p className="text-[12px] text-slate-500 font-medium mt-1 leading-relaxed max-w-2xl">
              Outside the 24-hour reply window WhatsApp delivers approved templates only — these are
              them. Write the copy here, get it approved with your provider, then paste the approved
              name in and mark it active.
            </p>
          </div>
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12px] font-bold bg-slate-900 text-white hover:bg-slate-800 transition-colors flex-shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> New template
          </button>
        </header>

        <div className="flex items-center gap-1 mb-3">
          {CHANNELS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setChannel(c.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${
                channel === c.key
                  ? "bg-white text-slate-800 ring-1 ring-slate-200"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <c.Icon className="w-3.5 h-3.5" /> {c.label}
            </button>
          ))}
          {!loading && (
            <span className="ml-2 text-[11px] font-semibold text-slate-400">
              {rows.length} total · {activeCount} active
            </span>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-[12px] text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-[12.5px] font-bold text-slate-600">No {channel === "EMAIL" ? "email" : "WhatsApp"} templates yet</p>
              <p className="text-[11.5px] text-slate-400 mt-1 leading-relaxed max-w-md mx-auto">
                {channel === "WHATSAPP"
                  ? "Until one exists and is active, a lead who has not messaged you in the last 24 hours cannot be reached from the CRM."
                  : "Email has no approval requirement — a template here is just saved copy you can reuse."}
              </p>
            </div>
          ) : (
            rows.map((t) => (
              <div
                key={t.publicId}
                className="flex items-start gap-3 px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12.5px] font-extrabold text-slate-800">{t.name}</span>
                    {t.category && (
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                        {t.category}
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5 ${
                        t.status === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {t.status === "ACTIVE" ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                      {t.status === "ACTIVE" ? "Active" : "Draft"}
                    </span>
                    {t.arity > 0 && (
                      <span className="text-[10px] font-bold text-slate-400">
                        {t.arity} value{t.arity === 1 ? "" : "s"}
                      </span>
                    )}
                    {t.usageCount > 0 && (
                      <span className="text-[10px] font-semibold text-slate-400">sent {t.usageCount}×</span>
                    )}
                  </div>
                  {t.subject && (
                    <p className="text-[11.5px] font-bold text-slate-600 mt-1 truncate">{t.subject}</p>
                  )}
                  <p className="text-[11.5px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{t.body}</p>
                  {t.channel === "WHATSAPP" && (
                    <p className="text-[10.5px] text-slate-400 mt-1 font-mono">
                      {t.providerTemplateName
                        ? `${t.providerTemplateName}${t.languageCode ? ` · ${t.languageCode}` : ""}`
                        : "no approved name yet"}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(t)}
                    title="Edit"
                    className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(t)}
                    title="Delete"
                    className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.publicId ? "Edit template" : "New template"}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Channel</label>
              <select
                value={form.channel}
                onChange={(e) => set("channel", e.target.value)}
                disabled={Boolean(editing?.publicId)}
                className={`${inputCls} disabled:bg-slate-50 disabled:text-slate-400`}
              >
                <option value="WHATSAPP">WhatsApp</option>
                <option value="EMAIL">Email</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Name</label>
              <input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Follow-up · options shared"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Category</label>
              <input
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                placeholder="Follow-up"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select value={form.status} onChange={(e) => set("status", e.target.value)} className={inputCls}>
                <option value="DRAFT">Draft — not offered to the composer</option>
                <option value="ACTIVE">Active — ready to send</option>
              </select>
            </div>
          </div>

          {form.channel === "EMAIL" && (
            <div>
              <label className={labelCls}>Subject</label>
              <input
                value={form.subject}
                onChange={(e) => set("subject", e.target.value)}
                placeholder="Your revised options"
                className={inputCls}
              />
            </div>
          )}

          <div>
            <label className={labelCls}>
              Body — use {"{{1}}"}, {"{{2}}"} for the parts that change
            </label>
            <textarea
              value={form.body}
              onChange={(e) => set("body", e.target.value)}
              rows={4}
              placeholder="Hi {{1}}, your {{2}} plan is ready — starting at {{3}}."
              className={`${inputCls} resize-none`}
            />
            <p className="text-[10.5px] text-slate-400 font-semibold mt-1">
              {arity === 0
                ? "No placeholders — this sends exactly as written."
                : `${arity} value${arity === 1 ? "" : "s"} will be asked for when sending.`}
            </p>
          </div>

          {arity > 0 && (
            <div>
              <label className={labelCls}>Value labels (optional, comma separated)</label>
              <input
                value={form.variables}
                onChange={(e) => set("variables", e.target.value)}
                placeholder="Customer name, Destination, Price"
                className={inputCls}
              />
              <p className="text-[10.5px] text-slate-400 mt-1">
                Only labels the composer shows above each box — they change nothing about the message.
              </p>
            </div>
          )}

          {form.channel === "WHATSAPP" && (
            <div className="grid grid-cols-[1fr_100px] gap-3">
              <div>
                <label className={labelCls}>Approved name on your provider</label>
                <input
                  value={form.providerTemplateName}
                  onChange={(e) => set("providerTemplateName", e.target.value)}
                  placeholder="followup_options_v2"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Language</label>
                <input
                  value={form.languageCode}
                  onChange={(e) => set("languageCode", e.target.value)}
                  placeholder="en"
                  className={inputCls}
                />
              </div>
            </div>
          )}

          {form.channel === "WHATSAPP" && (
            <p className="text-[11px] leading-relaxed text-slate-500 bg-slate-50 ring-1 ring-slate-200 rounded-lg px-3 py-2">
              WhatsApp renders the copy <b>approved on your provider account</b>, matched by the name
              above — not the body typed here. Keep them identical, or the thread will show something
              the customer never received.
            </p>
          )}

          {blockedReason && (
            <p className="text-[11px] font-semibold leading-relaxed text-amber-800 bg-amber-50 ring-1 ring-amber-200 rounded-lg px-3 py-2">
              {blockedReason}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="text-[12px] font-bold text-slate-500 hover:text-slate-700 px-3 py-2"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!canSave}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-bold transition-colors ${
                canSave ? "bg-slate-900 text-white hover:bg-slate-800" : "bg-slate-100 text-slate-400 cursor-not-allowed"
              }`}
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editing?.publicId ? "Save changes" : "Create template"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
