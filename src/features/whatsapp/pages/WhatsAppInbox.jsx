// features/whatsapp/pages/WhatsAppInbox.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Every WhatsApp conversation in one place — the twin of the Mailbox screen.
//
// WHY IT EXISTS BESIDE THE BOOKING MODAL. The modal answers "what have we said to
// THIS supplier about THIS line", which is what an operator working a booking
// needs. This answers the other question — "who is waiting on us" — which cannot
// be asked from inside a booking, because you would have to already know which
// booking to open.
//
// It reads the Communication Center's own endpoints with channel=WHATSAPP rather
// than a parallel API, so a thread shows the same rows here, in the booking
// timeline, and in the modal.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, Loader2, MessageCircle, RefreshCw, Search } from "lucide-react";

import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { toast } from "@shared/ui/toast";

import whatsappService from "../api/whatsappService";
import ChatThread from "../components/ChatThread";

const FONT = "'Plus Jakarta Sans',system-ui,sans-serif";

const fmtWhen = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { day: "numeric", month: "short" });
};

export default function WhatsAppInbox() {
  const navigate = useNavigate();

  const [threads, setThreads] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listFailed, setListFailed] = useState(false);

  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);

  const [query, setQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const { items } = await whatsappService.conversations({
        q: query.trim() || undefined,
        unreadOnly: unreadOnly || undefined,
        size: 50,
      });
      setThreads(items);
      setListFailed(false);
    } catch (err) {
      if (!isAlreadyReported(err)) console.warn("WhatsApp inbox failed", err);
      setThreads([]);
      setListFailed(true);
    } finally {
      setLoadingList(false);
    }
  }, [query, unreadOnly]);

  // Debounced so typing a supplier's name does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(loadList, 300);
    return () => clearTimeout(t);
  }, [loadList]);

  const openThread = async (thread) => {
    setSelected(thread);
    setLoadingThread(true);
    try {
      const { items } = await whatsappService.messages(thread.publicId, { size: 60 });
      setMessages(items);
    } catch (err) {
      if (!isAlreadyReported(err)) toast.error(getErrorMessage(err, "Could not open that conversation"));
      setMessages([]);
    } finally {
      setLoadingThread(false);
    }
  };

  /* Replying happens on the booking, not here. The send endpoint is mounted under the service
     line because sending is what moves the line to REQUESTED and records a hold expiry; a second
     send path on this screen would be statusless and would drift from that one. So this hands the
     operator to the place that can do the whole job. */
  const openBooking = () => {
    if (selected?.bookingPublicId) navigate(`/Allbookings?booking=${selected.bookingPublicId}`);
  };

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: FONT }}>
      <div className="px-5 py-4 border-b border-slate-200 bg-white flex items-center gap-2">
        <MessageCircle className="w-5 h-5 text-emerald-600" />
        <h1 className="text-[15px] font-extrabold text-slate-700">WhatsApp</h1>
        <button
          onClick={loadList}
          title="Refresh"
          className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className={`w-4 h-4 ${loadingList ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="flex" style={{ height: "calc(100vh - 61px)" }}>
        {/* ── Chat list ───────────────────────────────────────────────── */}
        <aside className="w-[320px] shrink-0 border-r border-slate-200 bg-white flex flex-col">
          <div className="p-3 space-y-2 border-b border-slate-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search suppliers…"
                aria-label="Search conversations"
                className="w-full pl-8 pr-2 py-1.5 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-700 font-medium placeholder-slate-400 focus:border-emerald-400 outline-none"
              />
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(e) => setUnreadOnly(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-400"
              />
              <span className="text-[11px] font-bold text-slate-500">Unread only</span>
            </label>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingList && threads.length === 0 && (
              <p className="p-4 text-[12px] text-slate-400 flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
              </p>
            )}

            {!loadingList && listFailed && (
              <p className="p-4 text-[12px] text-amber-700">
                Could not load conversations. Refresh to try again.
              </p>
            )}

            {!loadingList && !listFailed && threads.length === 0 && (
              <div className="p-4 text-[12px] text-slate-400 space-y-2">
                <p className="font-bold text-slate-500">No WhatsApp conversations yet.</p>
                <p>
                  A thread appears the first time you message a supplier from a booking service
                  line — Operations, expand a booking, then the WhatsApp icon on a line.
                </p>
              </div>
            )}

            <ul className="divide-y divide-slate-50">
              {threads.map((t) => {
                const on = selected?.publicId === t.publicId;
                return (
                  <li key={t.publicId}>
                    <button
                      onClick={() => openThread(t)}
                      className={`w-full text-left px-3 py-2.5 transition-colors ${
                        on ? "bg-emerald-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <p className="text-[12.5px] font-extrabold text-slate-700 truncate min-w-0 flex-1">
                          {t.contactName || t.contactValue || "Unknown"}
                        </p>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {fmtWhen(t.lastMessageAt)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {t.lastMessagePreview || t.subject || "—"}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        {t.subject && (
                          <span className="text-[9.5px] font-bold text-slate-400 truncate max-w-[180px]">
                            {t.subject}
                          </span>
                        )}
                        {t.unreadCount > 0 && (
                          <span className="ml-auto text-[9.5px] font-extrabold text-white bg-emerald-600 rounded-full px-1.5 py-0.5 tabular-nums">
                            {t.unreadCount}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        {/* ── Thread ──────────────────────────────────────────────────── */}
        <section className="flex-1 min-w-0 flex flex-col bg-slate-50">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-[12px] text-slate-400">
              Pick a conversation.
            </div>
          ) : (
            <>
              <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-extrabold text-slate-700 truncate">
                    {selected.contactName || selected.contactValue}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {selected.subject || selected.contactValue}
                    {selected.assignedUserName ? ` · ${selected.assignedUserName}` : ""}
                  </p>
                </div>
                {selected.bookingPublicId && (
                  <button
                    onClick={openBooking}
                    className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-extrabold px-3 py-1.5 rounded-lg ring-1 ring-slate-200 bg-white text-slate-600 hover:text-emerald-700 hover:ring-emerald-300"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Open booking
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3">
                <ChatThread
                  messages={messages}
                  loading={loadingThread}
                  emptyHint="Nothing on this thread yet."
                />
              </div>

              {/* No composer here, on purpose — see openBooking above. */}
              <div className="px-4 py-3 bg-white border-t border-slate-200">
                <p className="text-[11px] text-slate-400">
                  {selected.bookingServiceItemPublicId
                    ? "Reply from the booking's service line, so the message is recorded against it and the line can move to REQUESTED."
                    : "This thread is not tied to a service line, so it cannot be replied to from here."}
                </p>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
