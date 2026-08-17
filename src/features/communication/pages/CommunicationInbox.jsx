// features/communication/pages/CommunicationInbox.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The Communication Center — list, conversation, contact. Three panes.
//
// The three-pane shape is what every shared inbox converges on (Front, Missive,
// Help Scout, Intercom) and for one reason: the operator's question is never
// "show me this message", it is "who is waiting, what did we say, and who is
// this person" — three questions that must be answerable without navigating.
//
// TWO DISTINCTIONS THIS SCREEN EXISTS TO MAKE VISIBLE
//
// 1. LEAD work vs OPERATIONS work. comm_conversations already separates them
//    (kind CUSTOMER vs VENDOR) but nothing showed it: the Center listed customer
//    threads only, so a supplier chasing a hotel confirmation was invisible here
//    and a lead reply was invisible on the ops board. Now both can be listed,
//    every row says which it is, and the filter defaults to Leads.
//
// 2. What can actually be SENT right now. WhatsApp's 24-hour window decides
//    whether the composer is a text box or a template picker, so it is stated on
//    the conversation header rather than discovered when Send fails.
//
// Notes live on the same timeline as the messages, per Missive's one real
// insight: "customer asked for a discount / we agreed 5% / quote sent" is one
// story, and splitting the middle line into a separate tab loses the sequence.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Link } from "react-router-dom";
import {
  AlertTriangle, CheckCircle2, ChevronDown, Clock, ExternalLink, Inbox, Loader2, Mail,
  MessageSquare, RefreshCw, RotateCcw, Search, StickyNote, UserMinus, UserPlus,
} from "lucide-react";
import { useToast } from "@shared/ui/toast";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { hasPermission, P } from "@shared/lib/access";
import { ChatThread, Composer } from "@features/whatsapp";
import communicationService from "../api/communicationService";

const FONT = { fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" };
const PAGE_SIZE = 30;

/* Channel is a filter, not a page. One table, one column — a page per channel is the same
   screen copied and drifting, and it hides the fact that one contact has both. */
const CHANNEL_FILTERS = [
  { key: null, label: "All" },
  { key: "WHATSAPP", label: "WhatsApp", Icon: MessageSquare },
  { key: "EMAIL", label: "Email", Icon: Mail },
];

const KIND_FILTERS = [
  { key: "CUSTOMER", label: "Leads" },
  { key: "VENDOR", label: "Operations" },
  { key: null, label: "Everything" },
];

function fmtWhen(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  const year = d.getFullYear() === now.getFullYear() ? undefined : "numeric";
  return d.toLocaleDateString([], { day: "numeric", month: "short", year });
}

function untilClose(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function Chip({ active, onClick, children, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11.5px] font-bold transition-colors ${
        active ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
      }`}
    >
      {children}
      {count > 0 && (
        <span className={`text-[10px] font-extrabold ${active ? "text-white/70" : "text-slate-400"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

/* One badge, two facts: which channel, and whether this is lead work or operations work.
   Operations rows are the ones a supplier is on — colouring them differently is the whole
   point of the distinction, not decoration. */
function RowTags({ thread }) {
  const ops = thread.kind === "VENDOR";
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={`text-[9.5px] font-extrabold rounded px-1.5 py-px ${
          thread.channel === "EMAIL" ? "bg-sky-50 text-sky-700" : "bg-emerald-50 text-emerald-700"
        }`}
      >
        {thread.channel === "EMAIL" ? "Email" : "WhatsApp"}
      </span>
      <span
        className={`text-[9.5px] font-extrabold rounded px-1.5 py-px ${
          ops ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-500"
        }`}
      >
        {ops ? "Ops" : "Lead"}
      </span>
    </span>
  );
}

function ThreadRow({ thread, active, onClick }) {
  const unread = thread.unreadCount > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 border-b border-slate-100 transition-colors ${
        active ? "bg-blue-50/70" : "bg-white hover:bg-slate-50"
      }`}
    >
      <div className="flex items-baseline gap-2">
        <span className={`flex-1 min-w-0 truncate text-[12.5px] ${unread ? "font-extrabold text-slate-900" : "font-bold text-slate-700"}`}>
          {thread.contactName || thread.contactValue || "Unknown"}
        </span>
        <span className="text-[10px] text-slate-400 font-semibold flex-shrink-0 tabular-nums">
          {fmtWhen(thread.lastMessageAt)}
        </span>
      </div>

      <div className="mt-1"><RowTags thread={thread} /></div>

      <div className="flex items-center gap-1.5 mt-1">
        <span className={`flex-1 min-w-0 truncate text-[11px] ${unread ? "text-slate-600 font-semibold" : "text-slate-400 font-medium"}`}>
          {thread.lastMessagePreview || thread.subject || "—"}
        </span>
        {thread.awaitingReply && (
          <span className="text-[9.5px] font-extrabold text-amber-700 bg-amber-50 rounded px-1.5 py-px flex-shrink-0">
            WAITING
          </span>
        )}
        {unread && (
          <span className="text-[9.5px] font-extrabold text-white bg-rose-500 rounded-full px-1.5 py-px flex-shrink-0">
            {thread.unreadCount}
          </span>
        )}
      </div>
    </button>
  );
}

function RailRow({ label, children }) {
  if (!children) return null;
  return (
    <div className="px-4 py-2 border-b border-slate-100 last:border-0">
      <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-[12px] font-bold text-slate-700 mt-0.5 break-words">{children}</p>
    </div>
  );
}

export default function CommunicationInbox({ channel: fixedChannel = null, kind: fixedKind = "CUSTOMER" }) {
  const { showToast } = useToast();
  const [params, setParams] = useSearchParams();

  const [channel, setChannel] = useState(fixedChannel);
  const [kind, setKind] = useState(fixedKind);
  const [q, setQ] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(0);

  const [threads, setThreads] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [listLoading, setListLoading] = useState(true);

  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);

  const [readiness, setReadiness] = useState(null);
  const [summary, setSummary] = useState(null);

  const [tab, setTab] = useState("MESSAGE");   // MESSAGE | NOTE
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [railOpen, setRailOpen] = useState(true);

  const canAssign = hasPermission(P.COMM_ASSIGN);

  /* ── list ──────────────────────────────────────────────────────────────── */

  const loadThreads = useCallback(
    async ({ keepSelection = false } = {}) => {
      setListLoading(true);
      try {
        const { items, pagination: pg } = await communicationService.conversations({
          channel: channel || undefined,
          kind: kind || undefined,
          page,
          size: PAGE_SIZE,
          q: q.trim() || undefined,
          unreadOnly: unreadOnly || undefined,
        });
        /* APPEND past page 0, never replace. "Load more" that replaces is a lie: it drops the rows
           the operator was reading, and with no Previous control they cannot get them back. Page 0
           replaces because that is a genuine reload — a filter changed, or Refresh was pressed.
           Deduped by publicId because a post-send refresh re-fetches the CURRENT page, and an
           inbox sorted by lastMessageAt reshuffles under paging anyway. */
        setThreads((prev) => {
          if (page === 0) return items;
          const seen = new Set(prev.map((t) => t.publicId));
          return [...prev, ...items.filter((t) => !seen.has(t.publicId))];
        });
        setPagination(pg);
        if (!keepSelection) {
          setSelected((prev) =>
            prev && items.some((t) => t.publicId === prev.publicId) ? prev : items[0] || null);
        }
      } catch (e) {
        if (!isAlreadyReported(e)) {
          showToast(getErrorMessage(e, "Could not load conversations."), "error");
        }
      } finally {
        setListLoading(false);
      }
    },
    [channel, kind, page, q, unreadOnly, showToast],
  );

  // Debounced, or the list refetches on every keystroke in the search box.
  useEffect(() => {
    const id = setTimeout(() => { loadThreads(); }, q ? 300 : 0);
    return () => clearTimeout(id);
  }, [loadThreads, q]);

  useEffect(() => { setPage(0); }, [channel, kind, unreadOnly, q]);

  useEffect(() => {
    communicationService.readiness().then(setReadiness).catch(() => setReadiness(null));
  }, []);

  // Re-counted whenever the kind filter moves, with the same kind the list is using — otherwise
  // "Conversations 41" sits above a list of 58.
  useEffect(() => {
    communicationService.summary(kind || undefined).then(setSummary).catch(() => setSummary(null));
  }, [kind]);

  // ?c=<publicId> so the drawer's "open in Communication Center" arrow lands on the right row.
  useEffect(() => {
    const wanted = params.get("c");
    if (!wanted || !threads.length) return;
    const match = threads.find((t) => t.publicId === wanted);
    if (match) setSelected(match);
  }, [params, threads]);

  /* ── thread ────────────────────────────────────────────────────────────── */

  const loadMessages = useCallback(
    async (publicId) => {
      if (!publicId) { setMessages([]); return; }
      setMsgLoading(true);
      try {
        const { items } = await communicationService.messages(publicId, { size: 50 });
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

  useEffect(() => { loadMessages(selected?.publicId); }, [selected?.publicId, loadMessages]);

  // Opening a thread clears its unread badge — the operator has just read it. Swallows failure:
  // it is a badge, and losing the message they came to read over it would be the wrong trade.
  useEffect(() => {
    if (!selected?.publicId || !selected.unreadCount) return;
    const id = selected.publicId;
    communicationService.markRead(id)
      .then((fresh) => {
        if (!fresh) return;
        setSelected((prev) => (prev?.publicId === id ? fresh : prev));
        setThreads((prev) => prev.map((t) => (t.publicId === id ? fresh : t)));
      })
      .catch(() => {});
  }, [selected?.publicId, selected?.unreadCount]);

  const replaceThread = (fresh) => {
    if (!fresh) return;
    setSelected(fresh);
    setThreads((prev) => prev.map((t) => (t.publicId === fresh.publicId ? fresh : t)));
  };

  const pick = (thread) => {
    setSelected(thread);
    setTab("MESSAGE");
    const next = new URLSearchParams(params);
    next.set("c", thread.publicId);
    setParams(next, { replace: true });
  };

  const triage = async (fn, okMessage) => {
    if (!selected) return;
    try {
      replaceThread(await fn());
      showToast(okMessage, "success");
    } catch (e) {
      if (!isAlreadyReported(e)) {
        showToast(getErrorMessage(e, "Could not update this conversation."), "error");
      }
    }
  };

  const addNote = async () => {
    if (!note.trim() || savingNote) return;
    setSavingNote(true);
    try {
      const saved = await communicationService.addNote(selected.publicId, note.trim());
      if (saved) setMessages((prev) => [...prev, saved]);
      setNote("");
      showToast("Note added.", "success");
    } catch (e) {
      if (!isAlreadyReported(e)) {
        showToast(getErrorMessage(e, "Could not save this note."), "error");
      }
    } finally {
      setSavingNote(false);
    }
  };

  /* The composer's state: the agency half (loaded once) plus this contact's half, which rides
     on the conversation — freeTextAllowed is computed server-side against the same window the
     send endpoint enforces, so the two can never disagree. */
  const composerCtx = useMemo(() => {
    if (!selected) return null;
    const isEmail = selected.channel === "EMAIL";
    return {
      whatsappConfigured: readiness?.whatsappConfigured ?? false,
      freeTextSupported: readiness?.freeTextSupported ?? false,
      emailConfigured: readiness?.emailConfigured ?? false,
      emailFrom: readiness?.emailFrom || null,
      emailSignature: readiness?.emailSignature || null,
      freeTextAllowed: Boolean(selected.freeTextAllowed),
      phone: isEmail ? null : selected.contactValue,
      email: isEmail ? selected.contactValue : null,
    };
  }, [selected, readiness]);

  const onSent = async (message) => {
    if (message) setMessages((prev) => [...prev, message]);
    try {
      const fresh = await communicationService.conversation(selected.publicId);
      replaceThread(fresh);
      if (!message) loadMessages(selected.publicId);
      loadThreads({ keepSelection: true });
    } catch {
      // A refresh failure must not undo a message that was sent.
    }
  };

  const closesIn = untilClose(selected?.windowExpiresAt);
  const totalPages = pagination?.totalPages ?? 1;
  const notesCount = messages.filter((m) => m.note || m.channel === "INTERNAL_NOTE").length;

  /* ── render ────────────────────────────────────────────────────────────── */

  return (
    <div style={FONT} className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      <div className="px-4 sm:px-6 lg:px-8 py-5">
        <header className="mb-3">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Communication Center</p>
          <h1 className="text-xl font-extrabold text-slate-800">Conversations</h1>
        </header>

        {/* Tiles are the queue's own numbers, not decoration: each one is a thing somebody has to
            do today. They count lead conversations — the list's default filter — so the numbers
            and the rows on screen are answers to the same question. */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {[
              { label: "Unread", value: summary.unreadConversations, tone: "text-rose-600" },
              { label: "Awaiting reply", value: summary.pendingReplies, tone: "text-amber-600" },
              { label: "Conversations", value: summary.totalConversations, tone: "text-slate-700" },
              { label: "Missed calls", value: summary.missedCalls, tone: "text-slate-700" },
            ].map((t) => (
              <div key={t.label} className="bg-white rounded-xl border border-slate-200 px-3 py-2">
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide">{t.label}</p>
                <p className={`text-lg font-extrabold tabular-nums ${t.tone}`}>{t.value ?? 0}</p>
              </div>
            ))}
          </div>
        )}

        {readiness && !readiness.whatsappConfigured && (
          <div className="mb-3 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-50 ring-1 ring-amber-200 text-[11.5px] font-semibold text-amber-800">
            <AlertTriangle className="w-3.5 h-3.5" />
            WhatsApp Business is not connected — replies can only go from your own WhatsApp.
            <Link to="/WhatsAppConfiguration" className="underline font-bold">Connect</Link>
          </div>
        )}

        <div className={`grid grid-cols-1 gap-3 ${railOpen ? "lg:grid-cols-[300px_1fr_248px]" : "lg:grid-cols-[300px_1fr]"}`}>
          {/* ── 1. list ── */}
          <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[calc(100vh-210px)]">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200">
              <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, number, subject"
                className="flex-1 min-w-0 text-[12px] font-medium text-slate-700 placeholder-slate-400 outline-none"
              />
              <button
                type="button"
                onClick={() => loadThreads({ keepSelection: true })}
                title="Refresh"
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Two filter rows, because they answer different questions: which channel, and whose
                work. Kind first — an operator is either doing sales or doing operations. */}
            <div className="flex items-center gap-1 px-2 py-1.5 border-b border-slate-100 overflow-x-auto">
              {KIND_FILTERS.map((k) => (
                <Chip key={k.label} active={kind === k.key} onClick={() => setKind(k.key)}>{k.label}</Chip>
              ))}
            </div>
            <div className="flex items-center gap-1 px-2 py-1.5 border-b border-slate-200 overflow-x-auto">
              {CHANNEL_FILTERS.map((c) => (
                <Chip key={c.label} active={channel === c.key} onClick={() => setChannel(c.key)}>
                  {c.Icon && <c.Icon className="w-3 h-3" />}{c.label}
                </Chip>
              ))}
              <Chip active={unreadOnly} onClick={() => setUnreadOnly((v) => !v)}>Unread</Chip>
            </div>

            <div className="flex-1 overflow-y-auto">
              {listLoading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-[12px] text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                </div>
              ) : threads.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <Inbox className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                  <p className="text-[12px] font-bold text-slate-500">Nothing here</p>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    A thread appears the moment someone messages you, or you message them from a
                    lead, customer or booking.
                  </p>
                </div>
              ) : (
                threads.map((t) => (
                  <ThreadRow
                    key={t.publicId}
                    thread={t}
                    active={selected?.publicId === t.publicId}
                    onClick={() => pick(t)}
                  />
                ))
              )}
            </div>

            {totalPages > 1 && (
              <button
                type="button"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-2 border-t border-slate-200 text-[11px] font-bold text-slate-500 hover:bg-slate-50 disabled:text-slate-300 flex items-center justify-center gap-1"
              >
                Load more <ChevronDown className="w-3 h-3" />
              </button>
            )}
          </section>

          {/* ── 2. conversation ── */}
          <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[calc(100vh-210px)]">
            {!selected ? (
              <div className="flex-1 flex items-center justify-center text-[12px] text-slate-400">
                Pick a conversation to read it.
              </div>
            ) : (
              <>
                <header className="flex items-start gap-3 px-4 py-3 border-b border-slate-200">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-[13.5px] font-extrabold text-slate-800 truncate">
                        {selected.contactName || selected.contactValue || "Unknown"}
                      </h2>
                      <RowTags thread={selected} />
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium truncate">
                      {selected.contactValue}
                      {selected.assignedUserName && ` · ${selected.assignedUserName}`}
                    </p>
                  </div>

                  {selected.channel === "WHATSAPP" && (
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5 flex-shrink-0 ${
                        selected.freeTextAllowed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                      }`}
                      title={selected.freeTextAllowed
                        ? "They messaged recently — you can type freely"
                        : "Outside the 24-hour window WhatsApp accepts approved templates only"}
                    >
                      <Clock className="w-3 h-3" />
                      {selected.freeTextAllowed
                        ? `Window open${closesIn ? ` · ${closesIn}` : ""}`
                        : "Template only"}
                    </span>
                  )}

                  {canAssign && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!selected.assignedUserPublicId ? (
                        <button type="button" title="Take this conversation"
                          onClick={() => triage(() => communicationService.claim(selected.publicId), "Assigned to you.")}
                          className="inline-flex items-center gap-1 text-[10.5px] font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md px-2 py-1">
                          <UserPlus className="w-3 h-3" /> Take
                        </button>
                      ) : (
                        <button type="button" title="Release — makes it visible to everyone again"
                          onClick={() => triage(() => communicationService.assign(selected.publicId, null), "Unassigned.")}
                          className="inline-flex items-center gap-1 text-[10.5px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md px-2 py-1">
                          <UserMinus className="w-3 h-3" /> Release
                        </button>
                      )}
                      {selected.status === "CLOSED" ? (
                        <button type="button"
                          onClick={() => triage(() => communicationService.setStatus(selected.publicId, "OPEN"), "Reopened.")}
                          className="inline-flex items-center gap-1 text-[10.5px] font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md px-2 py-1">
                          <RotateCcw className="w-3 h-3" /> Reopen
                        </button>
                      ) : (
                        <button type="button" title="Done with this — a later message opens a new thread"
                          onClick={() => triage(() => communicationService.setStatus(selected.publicId, "CLOSED"), "Closed.")}
                          className="inline-flex items-center gap-1 text-[10.5px] font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md px-2 py-1">
                          <CheckCircle2 className="w-3 h-3" /> Close
                        </button>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setRailOpen((v) => !v)}
                    title={railOpen ? "Hide contact panel" : "Show contact panel"}
                    className="hidden lg:block p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex-shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </header>

                <div className="flex-1 overflow-y-auto px-4 py-3 bg-slate-50/60">
                  <ChatThread messages={messages} loading={msgLoading} emptyHint="No messages on this thread yet." />
                </div>

                <div className="border-t border-slate-200">
                  <div className="flex items-center gap-1 px-4 pt-2">
                    {[
                      { key: "MESSAGE", label: "Message" },
                      { key: "NOTE", label: notesCount ? `Note (${notesCount})` : "Note" },
                    ].map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setTab(t.key)}
                        className={`px-2.5 py-1 text-[11.5px] font-bold rounded-md transition-colors ${
                          tab === t.key ? "bg-slate-100 text-slate-800" : "text-slate-400 hover:text-slate-600"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  <div className="px-4 py-3">
                    {tab === "MESSAGE" ? (
                      /* Operations threads are READ-ONLY here, deliberately. A supplier send is not
                         just a message: it moves the booking service line to REQUESTED and records
                         the hold expiry. A composer on this screen has no service line to move, so
                         it would be a second, statusless send path — the thing whatsappService.js
                         and WhatsAppInbox both refuse to build. Read the thread here, reply where
                         the state change lives. */
                      selected.kind === "VENDOR" ? (
                        <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-violet-50 ring-1 ring-violet-200">
                          <p className="text-[11.5px] font-semibold text-violet-900 leading-relaxed">
                            Operations thread — reply from the booking service line so the line moves
                            to REQUESTED and the hold expiry is recorded.
                          </p>
                          {selected.bookingPublicId && (
                            <Link
                              to="/operations"
                              className="inline-flex items-center gap-1 text-[11.5px] font-bold text-violet-800 underline flex-shrink-0"
                            >
                              Open booking <ExternalLink className="w-3 h-3" />
                            </Link>
                          )}
                        </div>
                      ) : (
                        <Composer
                          ctx={composerCtx}
                          channel={selected.channel}
                          thread={selected}
                          onSent={onSent}
                        />
                      )
                    ) : (
                      <div className="space-y-2">
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          onKeyDown={(e) => {
                            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); addNote(); }
                          }}
                          rows={3}
                          placeholder="Note for your colleagues — never sent to the customer"
                          className="w-full px-3 py-2 rounded-lg border border-amber-200 bg-amber-50/40 text-[12.5px] text-slate-700 font-medium placeholder-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-50 outline-none resize-none"
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-[10.5px] text-slate-400 font-medium inline-flex items-center gap-1">
                            <StickyNote className="w-3 h-3" /> Stays on this thread, in order, with the messages
                          </span>
                          <button
                            type="button"
                            onClick={addNote}
                            disabled={!note.trim() || savingNote}
                            title="Ctrl + Enter"
                            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12px] font-bold transition-colors ${
                              note.trim() && !savingNote
                                ? "bg-slate-900 text-white hover:bg-slate-800"
                                : "bg-slate-100 text-slate-400 cursor-not-allowed"
                            }`}
                          >
                            {savingNote && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Add note
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </section>

          {/* ── 3. contact ── */}
          {railOpen && selected && (
            <aside className="hidden lg:flex bg-white rounded-2xl border border-slate-200 overflow-hidden flex-col max-h-[calc(100vh-210px)]">
              <header className="px-4 py-3 border-b border-slate-200">
                <p className="text-[12px] font-extrabold text-slate-800">
                  {selected.kind === "VENDOR" ? "Supplier" : "Contact"}
                </p>
              </header>
              <div className="flex-1 overflow-y-auto">
                <RailRow label="Name">{selected.contactName}</RailRow>
                <RailRow label={selected.channel === "EMAIL" ? "Email" : "Phone"}>{selected.contactValue}</RailRow>
                <RailRow label="Assigned to">{selected.assignedUserName || "Unassigned"}</RailRow>
                <RailRow label="Status">{selected.status}</RailRow>
                <RailRow label="Subject">{selected.subject}</RailRow>

                <div className="px-4 py-3 space-y-1.5">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide mb-1">Open</p>
                  {selected.leadPublicId && (
                    <Link
                      to={`/EditLead/${selected.leadPublicId}`}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200 text-[12px] font-bold text-slate-700 hover:border-blue-300 hover:text-blue-700"
                    >
                      Lead <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                  {selected.bookingPublicId && (
                    <Link
                      to="/Allbookings"
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200 text-[12px] font-bold text-slate-700 hover:border-blue-300 hover:text-blue-700"
                    >
                      Booking <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                  {selected.customerPublicId && (
                    <Link
                      to={`/CustomerDetails/${selected.customerPublicId}`}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200 text-[12px] font-bold text-slate-700 hover:border-blue-300 hover:text-blue-700"
                    >
                      Customer <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                  {!selected.leadPublicId && !selected.bookingPublicId && !selected.customerPublicId && (
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Not linked to a record yet — it will link itself when this contact becomes a
                      lead or a customer.
                    </p>
                  )}
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
