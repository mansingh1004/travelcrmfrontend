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
import { AlertCircle, Check, Clock, Loader2, Phone } from "lucide-react";
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
function StatusMark({ status }) {
  if (status === "FAILED") {
    return <AlertCircle className="w-3 h-3 text-rose-500" aria-label="Failed" />;
  }
  if (status === "QUEUED") {
    return <Clock className="w-3 h-3 text-slate-300" aria-label="Queued" />;
  }
  // SENT / DELIVERED / READ all render the same tick. Distinguishing them would be a promise
  // this stack cannot keep: the WhatsApp provider returns no delivery callbacks today, and a
  // "delivered" tick nobody updates is worse than one that only claims "we sent it".
  return <Check className="w-3 h-3 text-slate-300" aria-label="Sent" />;
}

export default function ChatThread({
  messages = [],
  loading = false,
  emptyHint = "No messages yet.",
  className = "",
}) {
  const endRef = useRef(null);

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
      <div className={`flex items-center justify-center py-10 text-[12px] text-slate-400 ${className}`}>
        {emptyHint}
      </div>
    );
  }

  let lastDay = null;

  return (
    <div className={`space-y-2 ${className}`}>
      {messages.map((m) => {
        const outbound = m.direction === "OUTBOUND";
        const day = fmtDay(m.occurredAt);
        const showDay = day !== lastDay;
        lastDay = day;

        return (
          <div key={m.publicId}>
            {showDay && (
              <div className="flex justify-center my-3">
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 rounded-full px-2.5 py-0.5">
                  {day}
                </span>
              </div>
            )}

            <div className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[78%] rounded-xl px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap break-words ${
                  m.channel === "CALL"
                    ? "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                    : outbound
                      ? "bg-emerald-50 text-slate-700 ring-1 ring-emerald-200"
                      : "bg-white text-slate-700 ring-1 ring-slate-200"
                }`}
              >
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

                {/* A refused send says so on the bubble. Anywhere else and the operator reads a
                    message they believe was delivered. */}
                {m.status === "FAILED" && m.errorMessage && (
                  <p className="mt-1 text-[10px] font-semibold text-rose-600">{m.errorMessage}</p>
                )}

                <div className={`mt-1 flex items-center gap-1 text-[9.5px] text-slate-400 ${
                  outbound ? "justify-end" : ""
                }`}>
                  {!outbound && m.senderName && <span className="font-bold">{m.senderName}</span>}
                  <span>{fmtTime(m.occurredAt)}</span>
                  {outbound && <StatusMark status={m.status} />}
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
