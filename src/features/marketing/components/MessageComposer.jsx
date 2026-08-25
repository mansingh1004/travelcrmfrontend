// src/features/marketing/components/MessageComposer.jsx
// Reusable channel + subject + body composer with merge-tag insertion and a live
// preview. Used by the campaign composer, each drip step, and the automation editor.
import { useRef } from "react";
import { MessageCircle, Mail, Eye } from "lucide-react";
import { Field, inputCls } from "./marketingUi";
import { safeHtml } from "@shared/lib/safeHtml";

/** Replace {{token}} occurrences with example values for the preview. */
function renderPreview(body, mergeTags) {
  let out = body || "";
  (mergeTags || []).forEach((t) => {
    out = out.split(t.token).join(t.example);
  });
  return out;
}

export default function MessageComposer({
  channel, onChannel, lockChannel = false,
  subject, onSubject,
  body, onBody,
  templateName, onTemplateName,
  mergeTags = [],
  errors = {},
}) {
  const bodyRef = useRef(null);
  const isEmail = channel === "EMAIL";

  const insertTag = (token) => {
    const el = bodyRef.current;
    if (!el) { onBody((body || "") + token); return; }
    const start = el.selectionStart ?? (body || "").length;
    const end = el.selectionEnd ?? start;
    const next = (body || "").slice(0, start) + token + (body || "").slice(end);
    onBody(next);
    requestAnimationFrame(() => { el.focus(); const pos = start + token.length; el.setSelectionRange(pos, pos); });
  };

  return (
    <div className="space-y-4">
      {/* Channel selector */}
      <Field label="Channel" required>
        <div className="grid grid-cols-2 gap-2.5">
          {[{ v: "WHATSAPP", label: "WhatsApp", Icon: MessageCircle }, { v: "EMAIL", label: "Email", Icon: Mail }].map(({ v, label, Icon }) => {
            const on = channel === v;
            return (
              <button key={v} type="button" disabled={lockChannel && !on} onClick={() => onChannel(v)}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${on
                  ? "border-blue-400 bg-blue-50 text-blue-700 shadow-sm"
                  : "border-slate-200 bg-white text-slate-500 hover:border-blue-300"} ${lockChannel && !on ? "opacity-40 cursor-not-allowed" : ""}`}>
                <Icon className="w-4 h-4" />{label}
              </button>
            );
          })}
        </div>
      </Field>

      {/* WhatsApp template override */}
      {!isEmail && onTemplateName && (
        <Field label="WhatsApp template (optional)" hint="Leave blank to use your tenant's default approved template.">
          <input className={inputCls} value={templateName || ""} onChange={(e) => onTemplateName(e.target.value)} placeholder="e.g. marketing_promo_v1" />
        </Field>
      )}

      {/* Email subject */}
      {isEmail && (
        <Field label="Subject" required error={errors.subject}>
          <input className={inputCls} value={subject || ""} onChange={(e) => onSubject(e.target.value)} placeholder="Your subject line" />
        </Field>
      )}

      {/* Merge tag chips */}
      {mergeTags.length > 0 && (
        <div>
          <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">Insert merge tag</p>
          <div className="flex flex-wrap gap-1.5">
            {mergeTags.map((t) => (
              <button key={t.token} type="button" onClick={() => insertTag(t.token)}
                title={`${t.label} · e.g. ${t.example}`}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 text-xs font-bold font-mono transition-colors">
                {t.token}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Body */}
      <Field label="Message body" required error={errors.body} hint={isEmail ? "Basic HTML is supported." : "Plain text is sent as your WhatsApp template's body value."}>
        <textarea ref={bodyRef} rows={isEmail ? 6 : 4} className={inputCls + " font-medium leading-relaxed resize-y"}
          value={body || ""} onChange={(e) => onBody(e.target.value)}
          placeholder={isEmail ? "<p>Hi {{firstName}}, ...</p>" : "Hi {{name}}, ..."} />
      </Field>

      {/* Live preview */}
      {(body || "").trim() && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2 mb-2 text-slate-500">
            <Eye className="w-3.5 h-3.5" />
            <span className="text-[11px] font-extrabold uppercase tracking-wide">Preview (sample data)</span>
          </div>
          {isEmail && subject && <p className="text-sm font-extrabold text-slate-700 mb-1">{renderPreview(subject, mergeTags)}</p>}
          {/* Sanitized. This body is authored by one staff user, persisted, and re-rendered for
              another — a colleague opening the campaign to approve it — so an unsanitized preview
              runs their payload in the reviewer's session, where the token lives. Split into two
              elements rather than one with a conditional `dangerouslySetInnerHTML`: React forbids
              passing both that prop and children, and the old form only escaped it because one of
              the two was always undefined. */}
          {isEmail ? (
            <div
              className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed"
              dangerouslySetInnerHTML={safeHtml(renderPreview(body, mergeTags))}
            />
          ) : (
            <div className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
              {renderPreview(body, mergeTags)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}