// features/operations/components/VendorWhatsAppModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Chase a supplier on WhatsApp, and have the CRM know it happened.
//
// The old wa.me icon on the board opened WhatsApp with an empty chat: the operator
// retyped the booking code and the dates from memory, and nothing about the chase
// survived it. This pre-fills the message from the booking and — whichever way it
// actually goes out — files it against the service line and moves the line to
// REQUESTED, exactly like the email composer.
//
// WHY TWO SEND BUTTONS. WhatsApp is not email, and pretending otherwise here would
// mislead. Meta only accepts a message from a business API outside a 24-hour window
// if it is a pre-approved template, and that window opens only when the SUPPLIER
// messages first — which a hotel never does. So:
//
//   • "Send from CRM"      — needs the agency's WhatsApp Business account connected.
//                            Goes out as their approved template. Truly automatic.
//   • "Open WhatsApp"      — works for everyone, today, with no provider at all.
//                            Opens WhatsApp with the text ready; the operator presses
//                            send there and then tells us it went.
//
// The second is a weaker record — we take the operator's word — and it is still
// enormously better than a chase that exists only in one person's phone.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { ExternalLink, Loader2, MessageCircle, Send, X } from "lucide-react";

import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { toast } from "@shared/ui/toast";
// Through the barrel, never into the feature's internals — the same component the standalone
// WhatsApp screen renders, so a bubble looks and behaves identically in both places.
import { ChatThread, whatsappService } from "@features/whatsapp";
import operationsService from "../api/operationsService";

const labelCls = "text-[10px] font-extrabold uppercase tracking-wide text-slate-400";
const fieldCls =
  "w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-700 " +
  "font-medium placeholder-slate-400 focus:border-emerald-400 outline-none";

export default function VendorWhatsAppModal({ bookingPublicId, line, onSent, onClose, embedded = false }) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(null);

  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [releaseDate, setReleaseDate] = useState(line?.releaseDate || "");
  // Set once the operator has followed the deep link. Until then "I sent it" would be a
  // claim about something that has not happened yet.
  const [opened, setOpened] = useState(false);

  // The conversation so far. Loaded separately from the draft and allowed to fail on its own:
  // a thread that will not load must not stop the operator sending the message they came to send.
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await operationsService.vendorWhatsAppDraft(bookingPublicId, line.publicId);
        if (cancelled) return;
        setDraft(d);
        setTo(d?.toDisplay || d?.to || "");
        setMessage(d?.message || "");

        // Its own request, and its own failure. A thread that will not load must not stop the
        // operator sending the message they opened this to send.
        if (d?.conversationPublicId) {
          try {
            const { items } = await whatsappService.messages(d.conversationPublicId, { size: 40 });
            if (!cancelled) setHistory(items);
          } catch {
            if (!cancelled) setHistory([]);
          }
        }
        if (!cancelled) setHistoryLoading(false);
      } catch (err) {
        if (cancelled) return;
        if (!isAlreadyReported(err)) toast.error(getErrorMessage(err, "Could not build the message"));
        setDraft({ recipientResolved: false, apiAvailable: false });
        setHistoryLoading(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [bookingPublicId, line.publicId]);

  // Not bound when embedded: the drawer owns Escape there, and two handlers calling the same
  // onClose would fire it twice on one keypress.
  useEffect(() => {
    if (embedded) return undefined;
    const onKey = (e) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy, embedded]);

  const digits = (to || "").replace(/\D/g, "");

  /* The link is rebuilt from the CURRENT text, not from draft.deviceLink — the operator has
     almost certainly edited the message, and opening WhatsApp with the original would send
     something they did not write. */
  const openWhatsApp = () => {
    if (!digits) { toast.error("Add a number first"); return; }
    window.open(
      `https://wa.me/${digits}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer"
    );
    setOpened(true);
  };

  const submit = async (transport) => {
    if (busy) return;
    if (!digits) { toast.error("Add a number first"); return; }
    if (!message.trim()) { toast.error("The message is empty"); return; }

    setBusy(true);
    try {
      const updated = await operationsService.sendVendorWhatsApp(bookingPublicId, line.publicId, {
        transport,
        to: to.trim(),
        message,
        releaseDate: releaseDate || undefined,
      });
      toast.success(transport === "API" ? "Sent on WhatsApp" : "Logged as sent");
      onSent?.(updated);
      onClose();
    } catch (err) {
      if (!isAlreadyReported(err)) toast.error(getErrorMessage(err, "Could not record that message"));
    } finally {
      setBusy(false);
    }
  };

  const noRecipient = !loading && !digits;
  const apiReady = draft?.apiAvailable && Boolean(draft?.templateName);

  /*
   * The composer itself, with no chrome of its own.
   *
   * Split out so this component can be either a centered dialog (opened straight from a service
   * line) or a tab inside VendorConversationDrawer, WITHOUT the send logic being written twice.
   * That logic is the whole value here — the 24-hour window check, the device-link rebuild from
   * the current text, the release-date write and the PENDING → REQUESTED move — and a second copy
   * of it in the drawer would drift from this one within a release.
   */
  const body = (
    <>
        {loading ? (
          <div className="px-4 py-10 flex items-center justify-center gap-2 text-[12px] text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Composing…
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {/* What has already been said, above the box that adds to it. Absent entirely on a
                  first message rather than showing an empty chat frame — a thread that does not
                  exist yet should not look like one that does and is empty. */}
              {(historyLoading || history.length > 0) && (
                <div className="-mx-1 px-1 py-2 rounded-lg bg-slate-50 ring-1 ring-slate-100 max-h-56 overflow-y-auto">
                  <ChatThread messages={history} loading={historyLoading} />
                </div>
              )}

              {noRecipient && (
                <p className="text-[11px] font-semibold text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded-lg px-2.5 py-2">
                  This line has no supplier WhatsApp number. Add one to the vendor, or type a
                  number below.
                </p>
              )}

              <div>
                <label className={labelCls} htmlFor="vwa-to">Number</label>
                <input
                  id="vwa-to"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="+91 98765 43210"
                  className={`${fieldCls} mt-1 font-bold`}
                />
              </div>

              <div>
                <label className={labelCls} htmlFor="vwa-message">Message</label>
                <textarea
                  id="vwa-message"
                  value={message}
                  onChange={(e) => { setMessage(e.target.value); setOpened(false); }}
                  rows={7}
                  className={`${fieldCls} mt-1 resize-y leading-relaxed`}
                />
                <p className="mt-1 text-[10px] text-slate-400">
                  Kept short on purpose — nobody reads a letter on WhatsApp.
                </p>
              </div>

              <div>
                <label className={labelCls} htmlFor="vwa-release">Holds until</label>
                <input
                  id="vwa-release"
                  type="date"
                  value={releaseDate}
                  onChange={(e) => setReleaseDate(e.target.value)}
                  className="mt-1 block px-2 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-700 outline-none focus:border-emerald-400"
                />
              </div>

              {!apiReady && (
                <p className="text-[10px] text-slate-500 bg-slate-50 ring-1 ring-slate-200 rounded-lg px-2.5 py-2">
                  {draft?.apiAvailable
                    ? "WhatsApp Business is connected but no approved template is set, so this has to go from your own WhatsApp."
                    : "WhatsApp Business is not connected for this agency, so this goes from your own WhatsApp — the CRM will still record it."}
                </p>
              )}
              {apiReady && !draft?.freeTextAllowed && (
                <p className="text-[10px] text-slate-500 bg-slate-50 ring-1 ring-slate-200 rounded-lg px-2.5 py-2">
                  Sending from the CRM uses your approved template
                  {draft?.templateName ? ` “${draft.templateName}”` : ""} — WhatsApp only allows free
                  text within 24 hours of the supplier messaging you.
                </p>
              )}
            </div>

            <div className="px-4 py-3 border-t border-slate-100 space-y-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={openWhatsApp}
                  disabled={busy || !digits}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 text-[11px] font-extrabold px-3 py-2 rounded-lg ring-1 ring-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open WhatsApp
                </button>
                {apiReady && (
                  <button
                    onClick={() => submit("API")}
                    disabled={busy || !digits}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 text-[11px] font-extrabold px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Send from CRM
                  </button>
                )}
              </div>

              {/* Only offered after the link was actually followed — otherwise this button lets
                  an operator record a message they never sent. */}
              <button
                onClick={() => submit("DEVICE")}
                disabled={busy || !opened}
                title={opened ? undefined : "Open WhatsApp first"}
                className="w-full text-[11px] font-extrabold px-3 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
              >
                {opened ? "I sent it — log it and mark REQUESTED" : "Open WhatsApp first, then log it here"}
              </button>

              <p className="text-[10px] text-slate-400 text-center">
                Logging marks this line <span className="font-extrabold text-sky-700">REQUESTED</span>,
                never confirmed.
              </p>
            </div>
          </>
        )}
    </>
  );

  // Inside the drawer the header, the close button and the Escape handling all belong to the
  // drawer — two of each would be a panel arguing with itself.
  if (embedded) {
    return <div className="flex-1 flex flex-col min-h-0">{body}</div>;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="WhatsApp the supplier"
        className="w-full max-w-md max-h-[88vh] flex flex-col rounded-xl border border-slate-200 bg-white shadow-xl"
        style={{ fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}
      >
        <div className="flex items-start gap-2 px-4 py-3 border-b border-slate-100">
          <MessageCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-extrabold text-slate-700 truncate">
              {draft?.vendorName || line.vendorName || "Supplier"}
            </p>
            <p className="text-[11px] text-slate-400 truncate">{line.title}</p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="shrink-0 p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {body}
      </div>
    </div>
  );
}
