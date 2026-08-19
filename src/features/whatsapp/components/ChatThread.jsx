// features/whatsapp/components/ChatThread.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The conversation itself — bubbles and a composer.
//
// Deliberately presentational: it takes messages and hands back what the operator
// typed. It does not fetch, and it does not send. Both surfaces that render it —
// the booking service line's modal and the standalone inbox — resolve a thread
// differently and send through the same booking endpoint, and a component that
// fetched for itself would have to know about both.
//
// Exported through the feature barrel so features/operations can use it without
// reaching into this feature's internals.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from "react";
import { AlertCircle, Check, Clock, Loader2, Paperclip, Phone, Smartphone } from "lucide-react";
import { safeHtml } from "@shared/lib/safeHtml";

const fmtTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const fmtDay = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(today);
  yest.setDate(today.getDate() - 1);
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Today";
  if (same(d, yest)) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
};

/**
 * An email body is HTML; a WhatsApp body is not.
 *
 * The composer sends what the rich editor produced, so `bodyText` on an email row holds
 * `<div>…<a href="…">`. Rendered as a React text child that is what the agent reads back — their
 * own markup, on the one screen built to show the formatting.
 *
 * So an email body is rendered as HTML, **through the shared sanitizer**. This is the one message
 * surface where the content can come from outside the company: an ingested customer reply. Today
 * the ingest path stores flattened text, but that is an accident of the current reader, not an
 * invariant, and a single change upstream would otherwise make this stored XSS. Sanitizing here
 * means the rule holds whatever the ingest does later.
 *
 * A WhatsApp body is never HTML and stays a plain text child — cheaper, and it means a customer
 * typing `<b>` sees `<b>`, which is what they typed.
 */
function isHtmlEmail(message) {
  return message.channel === "EMAIL" && /<[a-z][\s\S]*>/i.test(message.bodyText || "");
}

/** Delivery state, shown only where it tells the reader something they can act on. */
function StatusMark({ status, transport }) {
  if (status === "FAILED") {
    return <AlertCircle className="w-3 h-3 text-rose-500" aria-label="Failed" />;
  }
  if (status === "QUEUED") {
    return <Clock className="w-3 h-3 text-slate-300" aria-label="Queued" />;
  }
  // A DEVICE send never earns a tick. Nothing was transmitted by the server and no provider saw
  // it — the operator sent it from their own phone and told us. Drawing the same tick as an API
  // send would state a delivery the CRM has no basis for, which is the exact claim the transport
  // column was added to stop.
  if (transport === "DEVICE") {
    return (
      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-slate-400"
            aria-label="Sent from your phone, logged here">
        <Smartphone className="w-2.5 h-2.5" /> phone
      </span>
    );
  }
  // SENT / DELIVERED / READ all render the same tick. Distinguishing them would be a promise
  // this stack cannot keep: the WhatsApp provider returns no delivery callbacks today, and a
  // "delivered" tick nobody updates is worse than one that only claims "we sent it".
  return <Check className="w-3 h-3 text-slate-300" aria-label="Sent" />;
}

/**
 * WhatsApp's own palette, for the one surface where imitating it is the point.
 *
 * Operators live in WhatsApp all day. A thread that reads like the app they already know needs no
 * explanation — where the message is, which side is theirs, what the meta line under it means.
 *
 * Two things are deliberately NOT copied, and both are honesty rather than effort:
 *
 *  - the blue double tick. That is a READ receipt, and this stack receives no delivery or read
 *    callbacks at all (the provider posts them and the adapter discards them). A blue tick nobody
 *    updates is a claim about the customer that the CRM cannot support.
 *  - the always-available text box. WhatsApp has no 24-hour window because it is the customer's own
 *    client; here the composer is often a template picker, and drawing a hopeful text box produces
 *    messages that look sent and were refused.
 */
const WA = {
  wallpaper: "#efeae2",
  outgoing:  "#d9fdd3",
  incoming:  "#ffffff",
  meta:      "#667781",
  datePill:  "#ffffff",
  dateText:  "#54656f",
};

/**
 * The doodle wallpaper, inline as a data URI.
 *
 * A data URI rather than a file because the artifact CSP blocks external hosts and a missing
 * background would silently fall back to flat grey — and this is the single strongest cue that the
 * surface is a chat. Kept at low opacity so message text stays the thing being read.
 */
const WA_WALLPAPER =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='90' viewBox='0 0 90 90'%3E%3Cg fill='none' stroke='%23000' stroke-opacity='0.035' stroke-width='1.4' stroke-linecap='round'%3E%3Cpath d='M12 18h10M12 22h6'/%3E%3Ccircle cx='68' cy='16' r='5'/%3E%3Cpath d='M60 46l4 4 7-8'/%3E%3Cpath d='M20 58a6 6 0 1 1 12 0v6h-12z'/%3E%3Cpath d='M46 74h14M46 78h9'/%3E%3Cpath d='M78 62v10M73 67h10'/%3E%3Ccircle cx='30' cy='38' r='3'/%3E%3C/g%3E%3C/svg%3E\")";

export default function ChatThread({
  messages = [],
  loading = false,
  emptyHint = "No messages yet.",
  className = "",
  /**
   * "whatsapp" paints the familiar wallpaper-and-bubbles chat; anything else keeps the neutral
   * house styling. A prop rather than a channel check on the messages, because this component is
   * shared by three surfaces — the inbox, the booking service line and the contact drawer — and an
   * EMAIL thread rendered in WhatsApp green would be actively misleading about where it went.
   */
  skin = "plain",
}) {
  const endRef = useRef(null);
  const wa = skin === "whatsapp";

  // Chats read from the bottom. Jumping there on every change — not just on mount — keeps a
  // freshly sent message visible without the operator scrolling for it.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, loading]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center gap-2 py-10 text-[12px] text-slate-400 ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin" /> Loading conversation…
      </div>
    );
  }

  if (!messages.length) {
    return (
      <div
        className={`flex items-center justify-center py-10 text-[12px] ${wa ? "" : "text-slate-400"} ${className}`}
        /* The empty state carries the wallpaper too, or the thread visibly changes surface the
           moment the first message lands. */
        style={wa
          ? { backgroundColor: WA.wallpaper, backgroundImage: WA_WALLPAPER, color: WA.meta }
          : undefined}
      >
        {emptyHint}
      </div>
    );
  }

  let lastDay = null;

  return (
    <div
      className={`${wa ? "space-y-1 px-3.5 py-3 min-h-full" : "space-y-2"} ${className}`}
      /* The wallpaper carries its OWN padding and fills the scroll container, so the caller must not
         also pad — a chat with a margin of page background around it reads as a widget embedded in a
         form, not a conversation. min-h-full keeps a short thread from ending in bare grey. */
      style={wa ? { backgroundColor: WA.wallpaper, backgroundImage: WA_WALLPAPER } : undefined}
    >
      {messages.map((m) => {
        const outbound = m.direction === "OUTBOUND";
        const day = fmtDay(m.occurredAt);
        const showDay = day !== lastDay;
        lastDay = day;

        return (
          <div key={m.publicId}>
            {showDay && (
              <div className="flex justify-center my-3">
                <span
                  className={wa
                    ? "text-[11px] font-medium rounded-md px-2.5 py-1 shadow-sm"
                    : "text-[10px] font-bold text-slate-400 bg-slate-100 rounded-full px-2.5 py-0.5"}
                  style={wa ? { backgroundColor: WA.datePill, color: WA.dateText } : undefined}
                >
                  {day}
                </span>
              </div>
            )}

            <div className={`flex ${outbound ? "justify-end" : "justify-start"} ${wa ? "mb-0.5" : ""}`}>
              <div
                className={wa
                  ? `relative max-w-[75%] px-2.5 pt-1.5 pb-1 text-[13px] leading-[19px] whitespace-pre-wrap
                     break-words shadow-sm ${outbound ? "rounded-lg rounded-tr-none" : "rounded-lg rounded-tl-none"}`
                  : `max-w-[78%] rounded-xl px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap break-words ${
                      m.channel === "CALL"
                        ? "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                        : outbound
                          ? "bg-emerald-50 text-slate-700 ring-1 ring-emerald-200"
                          : "bg-white text-slate-700 ring-1 ring-slate-200"
                    }`}
                style={wa
                  ? {
                      backgroundColor: m.channel === "CALL"
                        ? "#f0f2f5"
                        : outbound ? WA.outgoing : WA.incoming,
                      color: "#111b21",
                    }
                  : undefined}
              >
                {/* The tail. Square-cut corner plus a triangle is how the real bubble is built — a
                    plain rounded rectangle is the single biggest tell that a chat UI is an
                    imitation, and it costs one pseudo-free div to fix. */}
                {wa && m.channel !== "CALL" && (
                  <span
                    aria-hidden="true"
                    className="absolute top-0 w-2 h-3"
                    style={{
                      [outbound ? "right" : "left"]: "-7px",
                      backgroundColor: outbound ? WA.outgoing : WA.incoming,
                      clipPath: outbound ? "polygon(0 0, 100% 0, 0 100%)" : "polygon(0 0, 100% 0, 100% 100%)",
                    }}
                  />
                )}
                {m.channel === "CALL" && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-wide mb-0.5">
                    <Phone className="w-2.5 h-2.5" /> Call
                  </span>
                )}

                {isHtmlEmail(m) ? (
                  <div
                    className="[&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
                      [&_a]:text-blue-600 [&_a]:underline [&_b]:font-bold [&_strong]:font-bold
                      [&_img]:max-w-full [&_img]:h-auto"
                    dangerouslySetInnerHTML={safeHtml(m.bodyText)}
                  />
                ) : (
                  m.bodyText || <span className="text-slate-400 italic">[no text]</span>
                )}

                {/* Files ride along under the body. The row already carried attachmentCount, so the
                    bubble could say "1 attachment" while nothing could open it — these are the
                    links that were missing. The bytes are not in the CRM: the endpoint streams
                    them from the mailbox and checks the caller may see this thread first. */}
                {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                  <div className="mt-1.5 flex flex-col gap-1">
                    {m.attachments.map((a) => (
                      <a
                        key={a.publicId}
                        href={`/api/communication/attachments/${a.publicId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/70 px-2 py-1 text-[10.5px] font-semibold text-slate-600 hover:bg-white hover:text-blue-600"
                      >
                        <Paperclip className="w-3 h-3 shrink-0" />
                        <span className="truncate max-w-[180px]">{a.fileName || "attachment"}</span>
                      </a>
                    ))}
                  </div>
                )}

                {/* A refused send says so on the bubble. Anywhere else and the operator reads a
                    message they believe was delivered. */}
                {m.status === "FAILED" && m.errorMessage && (
                  <p className="mt-1 text-[10px] font-semibold text-rose-600">{m.errorMessage}</p>
                )}

                {/* Time and ticks sit INSIDE the bubble, bottom-right, in WhatsApp's own meta grey.
                    Outside it — the neutral skin's placement — is the other classic imitation tell,
                    and it also costs a line of vertical space per message on a narrow drawer. */}
                <div
                  className={wa
                    ? "flex items-center justify-end gap-1 text-[11px] leading-none mt-0.5 -mr-0.5"
                    : `mt-1 flex items-center gap-1 text-[9.5px] text-slate-400 ${outbound ? "justify-end" : ""}`}
                  style={wa ? { color: WA.meta } : undefined}
                >
                  {!outbound && m.senderName && (
                    <span className={wa ? "font-medium mr-auto" : "font-bold"}>{m.senderName}</span>
                  )}
                  <span>{fmtTime(m.occurredAt)}</span>
                  {outbound && <StatusMark status={m.status} transport={m.transport} />}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
