// features/operations/components/VendorEmailModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Write to the supplier about ONE service line, without leaving the board.
//
// Why a modal here, when every other editor on this panel expands in flow: those
// edit a single field — a reference number, a date — and a row that grows by one
// input keeps the queue readable. Composing an email is a task, not a field, and
// it needs room the 1180px board row does not have.
//
// The one product rule this screen enforces, and the reason it is not just a
// mailto: link: sending marks the line REQUESTED and can never mark it CONFIRMED.
// A mailto: hands the job to Gmail and the CRM learns nothing — no record, no
// status change, and the reply lands somewhere the booking cannot see.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { Loader2, Mail, Paperclip, Send, X } from "lucide-react";

import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { toast } from "@shared/ui/toast";
// Through the barrel, never into the feature internals — the same thread component the WhatsApp
// composer and the standalone inbox render, so an email bubble looks identical everywhere.
import { ChatThread, whatsappService } from "@features/whatsapp";
import operationsService from "../api/operationsService";

const labelCls = "text-[10px] font-extrabold uppercase tracking-wide text-slate-400";
const fieldCls =
  "w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-700 " +
  "font-medium placeholder-slate-400 focus:border-blue-400 outline-none";

export default function VendorEmailModal({ bookingPublicId, line, onSent, onClose, embedded = false }) {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState(null);

  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachVoucher, setAttachVoucher] = useState(false);
  const [releaseDate, setReleaseDate] = useState(line?.releaseDate || "");

  // The exchange so far. Loaded separately from the draft and allowed to fail on its own.
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const subjectRef = useRef(null);

  /* The draft is fetched, not composed here. The server already knows the guest, the
     dates and the booking code; duplicating that in the browser would mean two places
     to fix when the wording changes, and one of them would be missed. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await operationsService.vendorEmailDraft(bookingPublicId, line.publicId);
        if (cancelled) return;
        setDraft(d);
        setTo(d?.to || "");
        setSubject(d?.subject || "");
        setBody(d?.body || "");

        /* The exchange so far — its own request and its own failure, exactly as the WhatsApp
           composer does it. A thread that will not load must never stop the operator sending the
           message they opened this to send. This composer had no history at all until now, which
           is why it read as a form while the WhatsApp one read as a conversation. */
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
        if (!isAlreadyReported(err)) toast.error(getErrorMessage(err, "Could not build the draft"));
        setDraft({ recipientResolved: false });
        setHistoryLoading(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [bookingPublicId, line.publicId]);

  // Escape closes. This modal is rendered from inside the board's expanded row, which
  // has its own Escape handler on window — but the row stands down while an editor is
  // open, so there is no contest here.
  // Not bound when embedded — the drawer owns Escape there. See VendorWhatsAppModal.
  useEffect(() => {
    if (embedded) return undefined;
    const onKey = (e) => { if (e.key === "Escape" && !sending) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, sending, embedded]);

  const send = async () => {
    if (sending) return;
    if (!to.trim()) { toast.error("Add a recipient first"); return; }
    if (!subject.trim()) { toast.error("A subject is required"); return; }
    if (!body.trim()) { toast.error("The message is empty"); return; }

    setSending(true);
    try {
      const updated = await operationsService.sendVendorEmail(bookingPublicId, line.publicId, {
        to: to.trim(),
        cc: cc.trim() || undefined,
        subject: subject.trim(),
        body,
        attachVoucher,
        releaseDate: releaseDate || undefined,
      });
      toast.success(`Sent to ${to.trim()}`);
      onSent?.(updated);
      onClose();
    } catch (err) {
      // 400/404/409/422 are silent by contract in the interceptor — this is the call
      // site, so it is the one that has to say what went wrong.
      if (!isAlreadyReported(err)) toast.error(getErrorMessage(err, "Could not send that email"));
    } finally {
      setSending(false);
    }
  };

  const noRecipient = !loading && draft && draft.recipientResolved === false && !to.trim();

  /*
   * The composer with no chrome of its own — see VendorWhatsAppModal for the same split and why.
   * Everything that makes a supplier email more than a mail form lives in here: the server-built
   * draft, the voucher attachment, the release date, and the PENDING → REQUESTED move that a
   * generic composer cannot produce.
   */
  const composer = (
    <>
        {loading ? (
          <div className="px-4 py-10 flex items-center justify-center gap-2 text-[12px] text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Building the draft…
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {/* What has already been said, above the box that adds to it. Absent entirely on a
                  first message rather than showing an empty frame — a thread that does not exist
                  yet should not look like one that does and is empty. */}
              {(historyLoading || history.length > 0) && (
                <div className="-mx-1 px-1 py-2 rounded-lg bg-slate-50 ring-1 ring-slate-100 max-h-56 overflow-y-auto">
                  <ChatThread messages={history} loading={historyLoading} />
                </div>
              )}

              {noRecipient && (
                <p className="text-[11px] font-semibold text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded-lg px-2.5 py-2">
                  This line has no supplier email on file. Assign a vendor with an email address,
                  or type a recipient below.
                </p>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <label className={labelCls} htmlFor="vem-to">To</label>
                  {!showCc && (
                    <button
                      onClick={() => setShowCc(true)}
                      className="text-[10px] font-bold text-slate-400 hover:text-blue-600"
                    >
                      Add Cc
                    </button>
                  )}
                </div>
                <input
                  id="vem-to"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="reservations@hotel.com"
                  className={`${fieldCls} mt-1`}
                />
              </div>

              {showCc && (
                <div>
                  <label className={labelCls} htmlFor="vem-cc">Cc</label>
                  <input
                    id="vem-cc"
                    autoFocus
                    value={cc}
                    onChange={(e) => setCc(e.target.value)}
                    placeholder="Comma separated"
                    className={`${fieldCls} mt-1`}
                  />
                </div>
              )}

              <div>
                <label className={labelCls} htmlFor="vem-subject">Subject</label>
                <input
                  id="vem-subject"
                  ref={subjectRef}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={300}
                  className={`${fieldCls} mt-1 font-bold`}
                />
              </div>

              <div>
                <label className={labelCls} htmlFor="vem-body">Message</label>
                <textarea
                  id="vem-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={11}
                  className={`${fieldCls} mt-1 resize-y leading-relaxed`}
                />
              </div>

              <div className="flex flex-wrap items-end gap-4 pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={attachVoucher}
                    onChange={(e) => setAttachVoucher(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-400"
                  />
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600">
                    <Paperclip className="w-3 h-3" /> Attach service voucher
                  </span>
                </label>

                <div className="ml-auto">
                  {/* Captured here because "sent to the hotel, they hold it until the 20th" is
                      one sentence. Splitting it across two screens is how the second half
                      never gets entered. */}
                  <label className={labelCls} htmlFor="vem-release">Holds until</label>
                  <input
                    id="vem-release"
                    type="date"
                    value={releaseDate}
                    onChange={(e) => setReleaseDate(e.target.value)}
                    className="mt-1 px-2 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-700 outline-none focus:border-blue-400"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 flex-1 min-w-0">
                Sending marks this line <span className="font-extrabold text-sky-700">REQUESTED</span>.
                Confirm it after the supplier replies.
              </p>
              <button
                onClick={onClose}
                disabled={sending}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-700 px-2 py-1.5 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={send}
                disabled={sending}
                className="inline-flex items-center gap-1.5 text-[11px] font-extrabold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {sending
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</>
                  : <><Send className="w-3.5 h-3.5" /> Send</>}
              </button>
            </div>
          </>
        )}
    </>
  );

  if (embedded) {
    return <div className="flex-1 flex flex-col min-h-0">{composer}</div>;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !sending) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Email the supplier"
        className="w-full max-w-xl max-h-[88vh] flex flex-col rounded-xl border border-slate-200 bg-white shadow-xl"
        style={{ fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}
      >
        {/* Header — says which line this is about, because the board has many */}
        <div className="flex items-start gap-2 px-4 py-3 border-b border-slate-100">
          <Mail className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-extrabold text-slate-700 truncate">
              {draft?.vendorName || line.vendorName || "Supplier"}
            </p>
            <p className="text-[11px] text-slate-400 truncate">{line.title}</p>
          </div>
          <button
            onClick={onClose}
            disabled={sending}
            aria-label="Close"
            className="shrink-0 p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {composer}
      </div>
    </div>
  );
}
