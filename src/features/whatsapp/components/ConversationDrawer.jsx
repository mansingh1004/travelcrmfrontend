// features/whatsapp/components/ConversationDrawer.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Message a lead without leaving the list.
//
// WHAT THIS REPLACES, AND WHY IT IS NOT A RESKIN
// The old leads panel drew a WhatsApp-shaped chat whose Send button opened a
// wa.me link. Nothing it displayed was real: the "history" was React state that
// died with the panel, a message could not fail because nothing was sent, and
// the CRM ended up with no record that the customer had been contacted at all.
// This panel talks to the Communication Center — the same conversation the
// inbox at /WhatsApp shows — so what is on screen is what actually happened.
//
// THE ONE RULE THE LAYOUT IS BUILT AROUND
// WhatsApp accepts free text only inside the 24-hour window opened by the
// customer's last inbound message; outside it, only an approved template is
// deliverable. That is not an edge case here — a new lead has never written to
// the agency, so the *default* state of this drawer is "template only". So the
// window state is stated above the composer rather than discovered on send.
//
// Both halves are shared, not local: <ChatThread/> is the same bubble list the
// inbox and the booking service line render, and <Composer/> is the same writer
// the Communication Center uses. A second copy of either would drift, and the
// way a composer drifts is by offering a message the rules do not allow.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, ArrowUpRight, Clock, Loader2, Mail, MessageSquare, Settings, X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@shared/ui/toast";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import conversationService from "../api/conversationService";
import whatsappService from "../api/whatsappService";
import ChatThread from "./ChatThread";
import Composer from "./Composer";

const FONT = { fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" };

/* How long until the reply window shuts, in the words an operator uses. */
function untilClose(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function Tab({ active, onClick, icon: Icon, label, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-bold rounded-lg transition-colors ${
        active ? "bg-white text-slate-800 ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
      {badge > 0 && (
        <span className="ml-0.5 text-[10px] font-extrabold text-white bg-rose-500 rounded-full px-1.5 py-px">
          {badge}
        </span>
      )}
    </button>
  );
}

function Notice({ tone = "slate", icon: Icon, children, action }) {
  const tones = {
    slate: "bg-slate-50 text-slate-600 ring-slate-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    emerald: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    rose: "bg-rose-50 text-rose-700 ring-rose-200",
  };
  return (
    <div className={`flex items-start gap-2 px-3.5 py-2 text-[11.5px] font-semibold ring-1 ${tones[tone]}`}>
      {Icon && <Icon className="w-3.5 h-3.5 mt-px flex-shrink-0" />}
      <span className="flex-1 leading-relaxed">{children}</span>
      {action}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @param lead      the record when opened from a lead list
 * @param customer  the record when opened from a customer list — pass one or the other. Two props
 *                  rather than a generic `record` + `kind`: the two are different endpoints and
 *                  different ownership rules server-side, and a single prop would let a caller pass
 *                  a lead and silently get the customer lookup.
 */
export default function ConversationDrawer({ lead, customer, initialChannel = "WHATSAPP", onClose }) {
  const { showToast } = useToast();

  const [channel, setChannel] = useState(initialChannel);
  const [ctx, setCtx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);

  const record = lead || customer;
  const isLead = Boolean(lead);
  const recordId = record?.publicId || record?.id;
  const name = ctx?.contactName || record?.customerName || record?.name || (isLead ? "Lead" : "Customer");
  const thread = channel === "WHATSAPP" ? ctx?.whatsappThread : ctx?.emailThread;

  /* ── load ──────────────────────────────────────────────────────────────── */

  const loadContext = useCallback(async () => {
    if (!recordId) return null;
    const data = isLead
      ? await conversationService.forLead(recordId)
      : await conversationService.forCustomer(recordId);
    setCtx(data);
    return data;
  }, [recordId, isLead]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadContext()
      .catch((e) => {
        if (!alive || isAlreadyReported(e)) return;
        showToast(getErrorMessage(e, "Could not open this conversation."), "error");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [loadContext, showToast]);

  // Messages follow the thread, and a thread only exists once something has been
  // sent — so this correctly does nothing on a lead nobody has contacted.
  const loadMessages = useCallback(
    async (threadPublicId) => {
      if (!threadPublicId) {
        setMessages([]);
        return;
      }
      setMsgLoading(true);
      try {
        const { items } = await whatsappService.messages(threadPublicId, { size: 50 });
        setMessages(items);
      } catch (e) {
        if (!isAlreadyReported(e)) {
          showToast(getErrorMessage(e, "Could not load this conversation."), "error");
        }
      } finally {
        setMsgLoading(false);
      }
    },
    [showToast],
  );

  useEffect(() => {
    loadMessages(thread?.publicId);
  }, [thread?.publicId, loadMessages]);

  /* Composer hands back the stored message on success and null on failure. Either way the
     context is re-read: the thread may have just been created, the window may have moved,
     and a refused send left a FAILED row that belongs on screen. */
  const onSent = async (message) => {
    if (message) setMessages((prev) => [...prev, message]);
    try {
      const fresh = await loadContext();
      const t = channel === "WHATSAPP" ? fresh?.whatsappThread : fresh?.emailThread;
      if (t?.publicId && (!message || !thread?.publicId)) loadMessages(t.publicId);
    } catch {
      // A refresh failure must not undo a message that was sent. The bubble stands.
    }
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const closesIn = untilClose(ctx?.windowExpiresAt);
  const freeTextPossible = Boolean(ctx?.freeTextSupported && ctx?.freeTextAllowed);

  /* ── render ────────────────────────────────────────────────────────────── */

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/20" onClick={onClose} />

      <aside
        style={{ ...FONT, width: "clamp(360px, 34vw, 460px)" }}
        className="fixed top-0 right-0 h-full z-50 flex flex-col bg-white border-l border-slate-200 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — who, and how to reach them. No avatar: the name is the identity here,
            and a coloured initial circle is decoration on a panel this narrow. */}
        <header className="flex items-start gap-3 px-4 py-3 border-b border-slate-200">
          <div className="flex-1 min-w-0">
            <h2 className="text-[14px] font-extrabold text-slate-800 truncate">{name}</h2>
            <p className="text-[11px] text-slate-500 font-medium truncate">
              {ctx?.phone || record?.phone || "no phone"}
              {(ctx?.email || record?.email) && ` · ${ctx?.email || record?.email}`}
            </p>
          </div>
          {record?.leadStage && (
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5 flex-shrink-0">
              {record.leadStage}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            title="Close (Esc)"
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex items-center gap-1 px-3 py-2 bg-slate-50 border-b border-slate-200">
          <Tab
            active={channel === "WHATSAPP"}
            onClick={() => setChannel("WHATSAPP")}
            icon={MessageSquare}
            label="WhatsApp"
            badge={ctx?.whatsappThread?.unreadCount || 0}
          />
          <Tab
            active={channel === "EMAIL"}
            onClick={() => setChannel("EMAIL")}
            icon={Mail}
            label="Email"
            badge={ctx?.emailThread?.unreadCount || 0}
          />
          {thread?.publicId && (
            <Link
              to={channel === "WHATSAPP" ? "/communication/whatsapp" : "/communication/email"}
              title="Open in the Communication Center"
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-white"
            >
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          )}
        </div>

        {/* State strip. Always present for WhatsApp, because "can I type?" is the first
            question and the answer changes by the hour. */}
        {!loading && channel === "WHATSAPP" && (
          <>
            {!ctx?.whatsappConfigured ? (
              <Notice
                tone="rose"
                icon={AlertTriangle}
                action={
                  <Link
                    to="/WhatsAppConfiguration"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 underline"
                  >
                    <Settings className="w-3 h-3" /> Connect
                  </Link>
                }
              >
                WhatsApp Business is not connected — you can still send from your own WhatsApp below.
              </Notice>
            ) : freeTextPossible ? (
              <Notice tone="emerald" icon={Clock}>
                Reply window open{closesIn ? ` · closes in ${closesIn}` : ""} — you can type freely.
              </Notice>
            ) : (
              <Notice tone="amber" icon={Clock}>
                {ctx?.freeTextSupported
                  ? "24-hour reply window is closed — WhatsApp only accepts an approved template until they message you."
                  : "This provider sends approved templates only."}
              </Notice>
            )}
          </>
        )}

        {!loading && channel === "EMAIL" && !ctx?.emailConfigured && (
          <Notice
            tone="rose"
            icon={AlertTriangle}
            action={
              /* /EmailConfiguration, the route that actually exists — router.jsx:450. An earlier
                 /settings here was a dead link: no such route, so the click did nothing at all. */
              <Link
                to="/EmailConfiguration"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 underline"
              >
                <Settings className="w-3 h-3" /> Set up
              </Link>
            }
          >
            The agency mailbox is not set up, so email cannot be sent.
          </Notice>
        )}

        {/* No page padding on the WhatsApp tab: ChatThread paints the wallpaper edge to edge, and a
            strip of grey around it reads as a widget embedded in a form rather than a conversation. */}
        <div className={`flex-1 overflow-y-auto ${
          channel === "WHATSAPP" ? "" : "px-3.5 py-3 bg-slate-50/60"
        }`}>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-[12px] text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Opening conversation…
            </div>
          ) : (
            <ChatThread
              messages={messages}
              loading={msgLoading}
              /* Only WhatsApp gets the WhatsApp skin. An email thread painted in chat green would
                 misrepresent which channel the customer was actually reached on. */
              skin={channel === "WHATSAPP" ? "whatsapp" : "plain"}
              emptyHint={
                channel === "WHATSAPP"
                  ? "No WhatsApp messages yet. The first message you send starts the thread."
                  : "No emails on this contact yet."
              }
            />
          )}
        </div>

        <div className="border-t border-slate-200 bg-white px-3.5 py-3">
          {!loading && (
            <Composer
              ctx={ctx}
              channel={channel}
              thread={thread}
              target={isLead ? { leadPublicId: recordId } : { customerPublicId: recordId }}
              onSent={onSent}
            />
          )}
        </div>
      </aside>
    </>
  );
}
