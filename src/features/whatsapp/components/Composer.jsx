// features/whatsapp/components/Composer.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Writing and sending, for both surfaces that do it.
//
// The lead drawer and the Communication Center inbox compose the same message
// against the same endpoint, and the rules they must obey are not cosmetic: a
// WhatsApp free-text box is only legal inside the 24-hour window, a template
// needs exactly as many values as it declares, and a missing provider name or
// mailbox is a setup problem with a different answer than either. Two copies of
// that would agree on the day they were written and drift by the next release,
// and the way they drift is silently — one surface offering a text box the other
// knows is illegal.
//
// So this owns all of it: template loading, mode, validation, the send call. The
// surfaces pass in who they are writing to and get told when something was sent.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Search, Send } from "lucide-react";
import { useToast } from "@shared/ui/toast";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { hasPermission, P } from "@shared/lib/access";
import conversationService from "../api/conversationService";
import MailEditor from "./MailEditor";

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-[12.5px] text-slate-700 " +
  "font-medium placeholder-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none";

/* Substitute {{1}}, {{2}} … so the operator reads the message, not the placeholders.
   This is the CRM's render; WhatsApp renders the APPROVED body with the same values.
   The two agree only while the stored copy matches what was approved, which is why
   this is labelled a preview and never called the message. */
function render(body, values) {
  if (!body) return "";
  return body.replace(/\{\{\s*(\d+)\s*\}\}/g, (whole, n) => {
    const v = values[Number(n) - 1];
    return v && v.trim() ? v : whole;
  });
}

/* A dropdown rather than a modal: choosing a template is one step of composing, and
   a modal would take the thread off screen at the moment the operator is deciding
   what to say about it. */
function TemplatePicker({ templates, value, onPick, loading }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const boxRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 10);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return templates;
    return templates.filter(
      (t) =>
        (t.name || "").toLowerCase().includes(needle) ||
        (t.category || "").toLowerCase().includes(needle) ||
        (t.body || "").toLowerCase().includes(needle),
    );
  }, [templates, q]);

  const selected = templates.find((t) => t.publicId === value);

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-left hover:border-slate-300 transition-colors"
      >
        <span className="min-w-0">
          {selected ? (
            <>
              <span className="block text-[12.5px] font-bold text-slate-800 truncate">{selected.name}</span>
              <span className="block text-[10.5px] text-slate-400 truncate">
                {selected.category ? `${selected.category} · ` : ""}
                {selected.arity} value{selected.arity === 1 ? "" : "s"}
              </span>
            </>
          ) : (
            <span className="text-[12.5px] font-semibold text-slate-400">
              {loading ? "Loading templates…" : "Choose an approved template"}
            </span>
          )}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 z-20 rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-slate-100">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search templates"
              className="flex-1 text-[12px] font-medium text-slate-700 placeholder-slate-400 outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {shown.length === 0 && (
              <p className="px-3 py-4 text-[11.5px] text-slate-400 text-center">
                {templates.length === 0 ? "No approved templates yet." : "Nothing matches that."}
              </p>
            )}
            {shown.map((t) => (
              <button
                key={t.publicId}
                type="button"
                onClick={() => {
                  onPick(t);
                  setOpen(false);
                  setQ("");
                }}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-50 last:border-0"
              >
                <span className="flex items-center gap-1.5">
                  <span className="text-[12px] font-bold text-slate-800 truncate">{t.name}</span>
                  {t.publicId === value && <Check className="w-3 h-3 text-emerald-600" />}
                </span>
                <span className="block text-[10.5px] text-slate-400 truncate">{t.body}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * @param ctx      the readiness bundle from conversationService.forLead/forCustomer
 * @param target   { leadPublicId } or { customerPublicId } — used only for the FIRST message,
 *                 when no thread exists yet. Ignored once conversationPublicId is known.
 * @param onSent   called with the new message so the caller can append it and refresh
 */
export default function Composer({
  ctx,
  channel,
  thread,
  target = {},
  onSent,
  autoFocus = false,
}) {
  const { showToast } = useToast();

  /* Replying is a separate authority from reading, and the split is load-bearing: the backend's
     viewer role holds COMM_READ without COMM_SEND, so a composer that renders unconditionally hands
     every viewer a Send button the server then 403s. The Mailbox has always done this correctly
     (Mailbox.jsx: canSend); this component did not, and shipped the exact failure access.js warns
     about. Rendering nothing at all — rather than a disabled box — because a composer a user can
     never use is furniture. */
  const canSend = hasPermission(P.COMM_SEND);
  if (!canSend) {
    return (
      <p className="text-[11.5px] text-slate-400 font-medium leading-relaxed">
        You can read this conversation but not reply to it. Ask an admin for the “Send messages”
        permission.
      </p>
    );
  }
  return <ComposerBody {...{ ctx, channel, thread, target, onSent, autoFocus }} />;
}

function ComposerBody({ ctx, channel, thread, target, onSent, autoFocus }) {
  const { showToast } = useToast();

  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  const [mode, setMode] = useState("TEMPLATE");
  const [template, setTemplate] = useState(null);
  const [values, setValues] = useState([]);
  const [text, setText] = useState("");

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [showCopies, setShowCopies] = useState(false);

  const [sending, setSending] = useState(false);
  /** Bumped to remount the uncontrolled editor — the only way to actually clear it. */
  const [mailKey, setMailKey] = useState(0);
  const firstFieldRef = useRef(null);

  useEffect(() => {
    let alive = true;
    setTemplatesLoading(true);
    setTemplate(null);
    setValues([]);
    conversationService
      .templates(channel)
      .then((rows) => alive && setTemplates(rows))
      .catch(() => alive && setTemplates([]))
      .finally(() => alive && setTemplatesLoading(false));
    return () => {
      alive = false;
    };
  }, [channel]);

  useEffect(() => {
    if (autoFocus) setTimeout(() => firstFieldRef.current?.focus(), 60);
  }, [autoFocus, channel]);

  /* Seed the agency signature INTO the body, the way the Mailbox compose does, rather than
     appending it server-side: the operator can then edit or delete it for this one message,
     and a reply that quotes an earlier one keeps a single signature instead of stacking.

     HTML, because the body is now a rich editor — and escaped, because a signature is stored
     text and a stray "<" in it would otherwise open a tag in every email the agency sends.
     Only ever seeds an untouched body; typing must never be overwritten by a late ctx. */
  useEffect(() => {
    if (channel !== "EMAIL") return;
    const sig = ctx?.emailSignature;
    if (!sig) return;
    const safe = String(sig)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\n/g, "<br/>");
    setBody((prev) => (prev ? prev : `<br/><br/>-- <br/>${safe}`));
  }, [channel, ctx?.emailSignature]);

  // Free text needs BOTH: a provider that can send it and an open window. A provider that
  // only sends templates makes the window moot, and saying "window closed" there would be
  // a wrong diagnosis the operator would wait out for nothing.
  const freeTextPossible = Boolean(ctx?.freeTextSupported && ctx?.freeTextAllowed);

  useEffect(() => {
    if (!freeTextPossible && mode === "TEXT") setMode("TEMPLATE");
  }, [freeTextPossible, mode]);

  const pickTemplate = (t) => {
    setTemplate(t);
    setValues(Array.from({ length: t.arity || 0 }, (_, i) => values[i] || ""));
  };

  const setValue = (i, v) => setValues((prev) => prev.map((old, idx) => (idx === i ? v : old)));

  // DEVICE needs no Business account — it is the operator's own phone — so it is the one mode
  // that works for an agency which has not connected WhatsApp at all.
  const canSendWhatsApp =
    mode === "DEVICE"
      ? Boolean(text.trim() && ctx?.phone)
      : ctx?.whatsappConfigured &&
        (mode === "TEXT"
          ? text.trim().length > 0
          : Boolean(template) &&
            values.length === (template?.arity || 0) &&
            values.every((v) => v.trim()));

  /* An "empty" rich editor is not an empty string — it holds <br> or <div><br></div>, which
     .trim() reads as content and would enable Send on a blank email. Strip tags and entities
     before deciding. The signature counts as written text on purpose: a message that is only a
     signature is a mistake the operator should have to notice, not one the button makes for them. */
  const emailHasBody = String(body)
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim().length > 0;

  const canSendEmail = Boolean(ctx?.emailConfigured && subject.trim() && emailHasBody);
  const canSend = channel === "WHATSAPP" ? canSendWhatsApp : canSendEmail;

  const send = async () => {
    if (!canSend || sending) return;

    // DEVICE opens WhatsApp FIRST, inside the click, or the browser blocks the popup — an async
    // await before window.open loses the user gesture. The log write follows; if it fails the
    // message has still gone, which is the right way round for the two to fail.
    if (channel === "WHATSAPP" && mode === "DEVICE") {
      const digits = String(ctx?.phone || "").replace(/\D/g, "");
      window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text.trim())}`,
        "_blank", "noopener,noreferrer");
    }

    setSending(true);
    try {
      let message;
      if (channel === "WHATSAPP") {
        message = await conversationService.sendWhatsApp({
          ...target,
          conversationPublicId: thread?.publicId,
          ...(mode === "DEVICE"
            ? { mode: "TEXT", transport: "DEVICE", text: text.trim() }
            : mode === "TEXT"
              ? { mode: "TEXT", text: text.trim() }
              : { mode: "TEMPLATE", templatePublicId: template.publicId, bodyValues: values }),
        });
        setText("");
        setValues((prev) => prev.map(() => ""));
      } else {
        message = await conversationService.sendEmail({
          ...target,
          conversationPublicId: thread?.publicId,
          subject: subject.trim(),
          // Already HTML — the body comes from the rich editor. Do NOT run a \n → <br/>
          // conversion over it: the editor emits <div>/<br> for line breaks itself, and a
          // second pass would double-space every message it touched.
          body: body.trim(),
          cc: cc.trim() || undefined,
          bcc: bcc.trim() || undefined,
        });
        setSubject("");
        setBody("");
        setCc("");
        setBcc("");
        setMailKey((k) => k + 1);
      }
      showToast(channel === "WHATSAPP" ? "Message sent." : "Email sent.", "success");
      onSent?.(message);
    } catch (e) {
      // A provider refusal still wrote a FAILED row on the thread, so tell the caller to
      // reload — the operator should see the attempt, not just a toast that disappears.
      onSent?.(null);
      if (!isAlreadyReported(e)) {
        showToast(
          getErrorMessage(e, channel === "WHATSAPP" ? "WhatsApp delivery failed." : "Could not send this email."),
          "error",
        );
      }
    } finally {
      setSending(false);
    }
  };

  // Ctrl/⌘+Enter from anywhere inside the composer. Scoped to this subtree rather than the
  // document so two mounted composers can never both fire on one keystroke.
  const onKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      send();
    }
  };

  const preview = template ? render(template.body, values) : "";

  return (
    <div className="space-y-2" onKeyDown={onKeyDown}>
      {channel === "WHATSAPP" ? (
        <>
          {/* Three ways to say something, and which ones exist right now is the whole point:
              TEMPLATE always; TEXT only while the window is open AND the provider supports it;
              DEVICE whenever there is a number, because a person messaging a person is bound by
              none of WhatsApp's business rules. */}
          <div className="flex items-center gap-1 text-[11px] font-bold flex-wrap">
            {[
              { key: "TEMPLATE", label: "Template", show: true },
              { key: "TEXT", label: "Type a message", show: freeTextPossible },
              { key: "DEVICE", label: "From my WhatsApp", show: Boolean(ctx?.phone) },
            ]
              .filter((m) => m.show)
              .map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMode(m.key)}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    mode === m.key ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {m.label}
                </button>
              ))}
          </div>

          {mode === "DEVICE" && (
            <p className="text-[11px] leading-relaxed text-amber-800 bg-amber-50 ring-1 ring-amber-200 rounded-lg px-3 py-2">
              This opens WhatsApp on your device with the message ready — you press send there. The
              CRM records it on this thread on your word; it cannot confirm delivery.
            </p>
          )}

          {mode === "TEXT" || mode === "DEVICE" ? (
            /* Pill-shaped and two rows, the way the real composer sits. Three rows of empty box
               under a chat is a form; this is a message being typed. It stays a textarea rather
               than an input because a WhatsApp message is routinely multi-line and Ctrl+Enter is
               already the send binding. */
            <textarea
              ref={firstFieldRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              placeholder="Type a message"
              className="w-full px-3.5 py-2 rounded-2xl border border-slate-200 bg-white text-[13px]
                leading-[19px] text-slate-700 placeholder-slate-400 resize-none outline-none
                focus:border-emerald-300 focus:ring-2 focus:ring-emerald-50"
            />
          ) : (
            <>
              <TemplatePicker
                templates={templates}
                value={template?.publicId}
                onPick={pickTemplate}
                loading={templatesLoading}
              />

              {/* One input per placeholder, counted from the template's own arity — sending the
                  wrong number of values is the most common provider refusal there is, so the
                  form cannot express it. */}
              {template && (template.arity || 0) > 0 && (
                <div className="space-y-1.5">
                  {values.map((v, i) => (
                    <label key={i} className="flex items-center gap-2">
                      <span className="text-[10.5px] font-extrabold text-slate-400 w-8 flex-shrink-0">
                        {`{{${i + 1}}}`}
                      </span>
                      <input
                        value={v}
                        onChange={(e) => setValue(i, e.target.value)}
                        placeholder={template.variables?.[i] || `Value ${i + 1}`}
                        className={inputCls}
                      />
                    </label>
                  ))}
                </div>
              )}

              {template && (
                <p className="text-[11.5px] leading-relaxed text-slate-600 bg-slate-50 ring-1 ring-slate-200 rounded-lg px-3 py-2 whitespace-pre-wrap">
                  {preview}
                </p>
              )}

              {!templatesLoading && templates.length === 0 && (
                <p className="text-[11px] text-slate-400 font-medium">
                  No approved templates yet — add them under Message templates, then approve them with
                  your provider.
                </p>
              )}
            </>
          )}
        </>
      ) : (
        <>
          <input
            ref={firstFieldRef}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className={inputCls}
          />
          {showCopies ? (
            <div className="grid grid-cols-2 gap-1.5">
              <input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="Cc" className={inputCls} />
              <input value={bcc} onChange={(e) => setBcc(e.target.value)} placeholder="Bcc" className={inputCls} />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCopies(true)}
              className="text-[11px] font-bold text-slate-400 hover:text-slate-600"
            >
              Add Cc / Bcc
            </button>
          )}
          {/* Keyed on mailKey so a successful send gives a genuinely empty editor: the editor is
              uncontrolled (React must not own innerHTML while the caret is in it), so clearing
              state alone would leave the sent text on screen. */}
          <MailEditor
            key={mailKey}
            initialValue={body}
            onChange={setBody}
            minHeight={150}
          />
        </>
      )}

      <div className="flex items-center justify-between pt-0.5">
        {/* Who it goes to, and — for email — who it comes FROM. The From is shown and never
            editable: the server resolves it from settings, and a client-supplied one is the one
            way a tenant could appear to send as an address it has not authenticated as. */}
        <span className="text-[10.5px] text-slate-400 font-medium truncate">
          {channel === "WHATSAPP"
            ? `to ${ctx?.phone || "—"}`
            : `${ctx?.emailFrom ? `${ctx.emailFrom} → ` : "to "}${ctx?.email || "—"}`}
        </span>
        <button
          type="button"
          onClick={send}
          disabled={!canSend || sending}
          title="Ctrl + Enter"
          className={`inline-flex items-center gap-1.5 text-[12px] font-bold transition-colors ${
            /* Plain free text on WhatsApp gets the round green send button — the one control every
               operator already knows. The template and device modes keep a labelled button on
               purpose: they do something the icon does not describe (pick an approved template, or
               hand off to the phone and log it), and a bare arrow there would hide the difference
               between a business-account send and a person sending it themselves. */
            channel === "WHATSAPP" && mode === "TEXT"
              ? "justify-center w-9 h-9 rounded-full shrink-0"
              : "rounded-lg px-3.5 py-2"
          } ${
            !canSend || sending
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : channel === "WHATSAPP" && mode === "TEXT"
                ? "bg-[#00a884] text-white hover:bg-[#017561]"
                : "bg-slate-900 text-white hover:bg-slate-800"
          }`}
        >
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          {channel === "WHATSAPP" && mode === "TEXT" ? null : channel !== "WHATSAPP"
            ? "Send"
            : mode === "TEMPLATE"
              ? "Send template"
              : mode === "DEVICE"
                ? "Open WhatsApp & log"
                : "Send"}
        </button>
      </div>
    </div>
  );
}
