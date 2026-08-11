// src/features/mailbox/pages/Mailbox.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The agency inbox, read inside the CRM.
//
// Built to the Notion/Linear north star rather than the glass-card house kit:
// a dense two-pane reader, hairline borders, no gradients or drop shadows, and
// keyboard navigation as a first-class path. A mailbox is a screen people live
// in for minutes at a time — chrome costs more here than anywhere else.
//
// j / k (or ↑ / ↓) move the selection, Enter opens, Esc closes, r refreshes,
// g then i / g then s switch folders. Handlers ignore keystrokes typed into the
// filter box so the shortcuts never eat someone's search text.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Loader2, RefreshCw, Paperclip, ChevronLeft, AlertTriangle, MailPlus, Search, X, PenSquare, Send, Reply,
} from "lucide-react";

import { mailboxService } from "../api/mailboxService";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { toast } from "@shared/ui/toast";
import { hasPermission, P } from "@shared/lib/access";

const FONT = { fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" };

const FOLDERS = [
  { id: "INBOX", label: "Inbox", key: "i" },
  { id: "SENT", label: "Sent", key: "s" },
];

const fmtWhen = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(undefined,
    sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
};

const fmtFull = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
};

/**
 * Pull one attachment down and hand it to the browser.
 *
 * Module scope, not a hook: it closes over nothing and both the reading pane and any future preview
 * need the same behaviour. The object URL is revoked on the next tick — a leaked one pins the whole
 * blob in memory for the life of the tab, and a mailbox is a screen people leave open for hours.
 */
async function downloadAttachment(uid, index, fileName, folder) {
  try {
    const blob = await mailboxService.attachment(uid, index, folder);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName || "attachment";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  } catch (err) {
    if (isAlreadyReported(err)) return;
    /* The response is a BLOB, so an error body is a Blob too and getErrorMessage finds nothing on
       it. Read the JSON out first — the server refuses an oversized part with a real sentence, and
       "Could not download" instead of "larger than 25 MB" sends the operator looking for a bug. */
    let message = "Could not download that attachment.";
    try {
      const body = err?.response?.data;
      message = body instanceof Blob
        ? (JSON.parse(await body.text())?.message || message)
        : getErrorMessage(err, message);
    } catch { /* keep the fallback */ }
    toast.error(message);
  }
}

/** "Prasad Thombare <p@x.com>" → "Prasad Thombare"; a bare address stays as-is. */
const displayName = (addr) => {
  if (!addr) return "(unknown)";
  const m = addr.match(/^\s*(.+?)\s*<[^>]+>\s*$/);
  return (m ? m[1] : addr).replace(/^"|"$/g, "");
};

export default function Mailbox() {
  const [status, setStatus] = useState(null);
  const [folder, setFolder] = useState("INBOX");
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const [cursor, setCursor] = useState(0);
  const [openUid, setOpenUid] = useState(null);
  const [message, setMessage] = useState(null);
  const [opening, setOpening] = useState(false);
  /* Compose owns the reading pane, not a modal — half the reason to write from here is to answer
     something in the list, and a modal hides exactly that. null = not composing. */
  const [draft, setDraft] = useState(null);
  const canSend = useMemo(() => hasPermission(P.COMM_SEND), []);

  const searchRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    mailboxService
      .status()
      .then(setStatus)
      .catch(() => setStatus({ configured: false, message: "Could not check the mailbox." }));
  }, []);

  const load = useCallback(async () => {
    if (!status?.configured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { messages, meta: m } = await mailboxService.listMessages({ folder, page, size: 50 });
      setRows(messages);
      setMeta(m);
      setCursor(0);
    } catch (err) {
      // A mailbox that will not open IS the content of this screen — render it inline rather than
      // as a toast that vanishes while the user is still reading an empty list.
      setError(getErrorMessage(err, "Could not read the mailbox."));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [status, folder, page]);

  useEffect(() => { load(); }, [load]);

  // Client-side narrowing of the loaded page only — deliberately not called "search", because it
  // cannot see mail beyond the 50 rows already fetched.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((m) =>
      [m.subject, m.from, m.to].filter(Boolean).some((v) => v.toLowerCase().includes(q))
    );
  }, [rows, query]);

  const openMessage = useCallback(async (row) => {
    if (!row) return;
    setDraft(null);
    setOpenUid(row.uid);
    setOpening(true);
    try {
      setMessage(await mailboxService.getMessage(row.uid, folder));
    } catch (err) {
      setOpenUid(null);
      if (!isAlreadyReported(err)) {
        toast.error(getErrorMessage(err, "Could not open that message"));
      }
    } finally {
      setOpening(false);
    }
  }, [folder]);

  const startCompose = useCallback((prefill = {}) => {
    setOpenUid(null);
    setMessage(null);
    setDraft({ to: "", subject: "", body: "", ...prefill });
  }, []);

  /* Reply prefills the address and quotes the original underneath — the quote is why this is a
     button and not just "compose with the address filled in". `Re:` is added once only. */
  const replyTo = useCallback((m) => {
    if (!m) return;
    const addr = (m.from || "").match(/<([^>]+)>/)?.[1] || m.from || "";
    const subject = /^re:/i.test(m.subject || "") ? m.subject : `Re: ${m.subject || ""}`.trim();
    const quoted = (m.body || "").split("\n").map((l) => `> ${l}`).join("\n");
    startCompose({
      to: addr,
      subject,
      body: `\n\nOn ${m.sentAt || ""}, ${displayName(m.from)} wrote:\n${quoted}`,
    });
  }, [startCompose]);

  const switchFolder = useCallback((id) => {
    setFolder(id);
    setPage(0);
    setOpenUid(null);
    setMessage(null);
    setDraft(null);
    setQuery("");
  }, []);

  // ── keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let awaitingG = false;
    const onKey = (e) => {
      const el = e.target;
      const typing = el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.isContentEditable;
      if (typing) {
        if (e.key === "Escape") el.blur();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (awaitingG) {
        awaitingG = false;
        const target = FOLDERS.find((f) => f.key === e.key.toLowerCase());
        if (target) { e.preventDefault(); switchFolder(target.id); }
        return;
      }

      switch (e.key) {
        case "g":
          awaitingG = true;
          break;
        case "j":
        case "ArrowDown":
          e.preventDefault();
          setCursor((c) => Math.min(visible.length - 1, c + 1));
          break;
        case "k":
        case "ArrowUp":
          e.preventDefault();
          setCursor((c) => Math.max(0, c - 1));
          break;
        case "Enter":
          e.preventDefault();
          openMessage(visible[cursor]);
          break;
        case "Escape":
          setOpenUid(null);
          setMessage(null);
          setDraft(null);
          break;
        case "c":
          // Only when the agent can actually send — otherwise the key would open a pane whose
          // Send button the server will refuse.
          if (!canSend) break;
          e.preventDefault();
          startCompose();
          break;
        case "r":
          e.preventDefault();
          load();
          break;
        case "/":
          e.preventDefault();
          searchRef.current?.focus();
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, cursor, openMessage, switchFolder, load, canSend, startCompose]);

  // Keep the highlighted row in view when the cursor is driven from the keyboard.
  useEffect(() => {
    const node = listRef.current?.querySelector(`[data-idx="${cursor}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (status && !status.configured) {
    return (
      <div className="min-h-screen bg-white" style={FONT}>
        <NotConnected message={status.message} />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-white text-slate-900" style={FONT}>
      {/* header — one hairline, no shadow */}
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-2.5">
        <h1 className="text-[13px] font-semibold text-slate-900">Mailbox</h1>

        {/* COMM_SEND, not the COMM_READ that opened this screen — reading the agency inbox and
            writing to a customer from the agency's address are different acts, and the backend
            enforces the same split. A reader simply has no Compose button. */}
        {canSend && (
          <button
            onClick={() => startCompose()}
            title="Compose (c)"
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-2.5 py-1 text-[12px] font-semibold text-white transition hover:bg-slate-700"
          >
            <PenSquare size={12} /> Compose
          </button>
        )}

        <nav className="flex items-center gap-0.5 rounded-md bg-slate-100 p-0.5">
          {FOLDERS.map((f) => (
            <button
              key={f.id}
              onClick={() => switchFolder(f.id)}
              className={`rounded px-2.5 py-1 text-[12px] font-medium transition ${
                folder === f.id
                  ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {f.label}
            </button>
          ))}
        </nav>

        <div className="relative ml-auto">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter this page…"
            className="w-56 rounded-md border border-slate-200 bg-white py-1.5 pl-8 pr-7 text-[12px] text-slate-800 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <button
          onClick={load}
          title="Refresh (r)"
          className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>

        {status?.address && (
          <span className="hidden text-[11px] text-slate-400 lg:inline">{status.address}</span>
        )}
      </header>

      {/* two panes */}
      <div className="flex min-h-0 flex-1">
        <section
          ref={listRef}
          className={`min-h-0 overflow-y-auto border-slate-200 ${
            openUid ? "hidden w-[380px] shrink-0 border-r md:block" : "w-full"
          }`}
        >
          {loading ? (
            <Centered><Loader2 size={18} className="animate-spin text-slate-300" /></Centered>
          ) : error ? (
            <ErrorState message={error} />
          ) : visible.length === 0 ? (
            <Centered>
              <p className="text-[13px] text-slate-400">
                {query ? "Nothing on this page matches." : "Nothing here."}
              </p>
            </Centered>
          ) : (
            <ul>
              {visible.map((m, i) => {
                const active = m.uid === openUid;
                const highlighted = i === cursor && !active;
                return (
                  <li key={m.uid} data-idx={i}>
                    <button
                      onClick={() => { setCursor(i); openMessage(m); }}
                      className={`flex w-full items-baseline gap-2.5 border-b border-slate-100 px-4 py-2.5 text-left transition ${
                        active ? "bg-blue-50/70" : highlighted ? "bg-slate-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <span
                        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                          m.seen ? "bg-transparent" : "bg-blue-600"
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span
                            className={`min-w-0 flex-1 truncate text-[13px] ${
                              m.seen ? "font-medium text-slate-600" : "font-semibold text-slate-900"
                            }`}
                          >
                            {displayName(folder === "SENT" ? m.to : m.from)}
                          </span>
                          {m.hasAttachments && <Paperclip size={11} className="shrink-0 text-slate-400" />}
                          <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
                            {fmtWhen(m.sentAt)}
                          </span>
                        </span>
                        <span
                          className={`mt-0.5 block truncate text-[12.5px] ${
                            m.seen ? "text-slate-500" : "text-slate-700"
                          }`}
                        >
                          {m.subject || "(no subject)"}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {meta && meta.totalPages > 1 && !error && (
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2 text-[11px]">
              <button
                disabled={!meta.hasPrevious}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="rounded px-2 py-1 font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              >
                ← Newer
              </button>
              <span className="text-slate-400">
                {meta.page + 1} / {meta.totalPages}
              </span>
              <button
                disabled={!meta.hasNext}
                onClick={() => setPage((p) => p + 1)}
                className="rounded px-2 py-1 font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              >
                Older →
              </button>
            </div>
          )}
        </section>

        <section className={`min-h-0 flex-1 overflow-y-auto ${openUid || draft ? "block" : "hidden md:block"}`}>
          {draft ? (
            <ComposePane draft={draft} setDraft={setDraft} onSent={() => { setDraft(null); load(); }} />
          ) : opening ? (
            <Centered><Loader2 size={18} className="animate-spin text-slate-300" /></Centered>
          ) : message ? (
            <MessageView
              message={message}
              folder={folder}
              onBack={() => { setOpenUid(null); setMessage(null); }}
              onReply={canSend ? () => replyTo(message) : null}
            />
          ) : (
            <Centered>
              <p className="text-[13px] text-slate-400">Select a message</p>
              <Shortcuts />
            </Centered>
          )}
        </section>
      </div>
    </div>
  );
}

/* ────────────────────────────── pieces ────────────────────────────── */

function Centered({ children }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      {children}
    </div>
  );
}

/* The tenant twin of the console's compose. Same contract, same shortcuts, same validation — the two
   mailboxes are one feature in two realms and should not drift into two different products.

   No From field: the server sends as the address saved under Settings > Email. Offering one would be
   a choice the server overrides, and the one way a tenant could appear to send as an address it has
   not authenticated as. */
function ComposePane({ draft, setDraft, onSent }) {
  const [sending, setSending] = useState(false);
  const toRef = useRef(null);

  // Caret lands where the work is: To on a fresh compose, the body on a reply.
  useEffect(() => {
    if (draft.to) return;
    toRef.current?.focus();
  }, [draft.to]);

  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const recipients = String(draft.to || "").split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  const badAddress = recipients.find((a) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a));
  const canSendNow = recipients.length > 0 && !badAddress && draft.subject.trim() && !sending;

  const send = async () => {
    if (!canSendNow) return;
    setSending(true);
    try {
      await mailboxService.sendMessage({
        to: recipients.join(","),
        subject: draft.subject.trim(),
        body: draft.body,
      });
      toast.success(`Sent to ${recipients.join(", ")}`);
      onSent();
    } catch (err) {
      if (!isAlreadyReported(err)) toast.error(getErrorMessage(err, "Could not send that email"));
    } finally {
      setSending(false);
    }
  };

  const discard = () => {
    const typed = draft.to || draft.subject || draft.body.trim();
    if (typed && !window.confirm("Discard this draft?")) return;
    setDraft(null);
  };

  return (
    <div
      className="flex h-full flex-col"
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); send(); }
        if (e.key === "Escape") { e.preventDefault(); discard(); }
      }}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-4 py-2.5">
        <PenSquare size={13} className="text-slate-400" />
        <h2 className="text-[13px] font-semibold text-slate-900">New message</h2>
        <button
          onClick={discard}
          title="Discard (esc)"
          className="ml-auto rounded-md p-1 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
        >
          <X size={14} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <label className="flex items-baseline gap-3 border-b border-slate-200 py-2">
          <span className="w-16 shrink-0 text-[12px] font-semibold text-slate-400">To</span>
          <input
            ref={toRef}
            value={draft.to}
            onChange={(e) => set("to", e.target.value)}
            placeholder="someone@example.com — comma-separate for several"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none"
          />
        </label>
        <label className="flex items-baseline gap-3 border-b border-slate-200 py-2">
          <span className="w-16 shrink-0 text-[12px] font-semibold text-slate-400">Subject</span>
          <input
            value={draft.subject}
            onChange={(e) => set("subject", e.target.value)}
            placeholder="Subject"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none"
          />
        </label>
        <textarea
          value={draft.body}
          onChange={(e) => set("body", e.target.value)}
          placeholder="Write your message…"
          className="mt-3 min-h-[16rem] w-full resize-y bg-transparent font-sans text-[13.5px] leading-relaxed text-slate-700 placeholder:text-slate-400 focus:outline-none"
        />
      </div>

      <footer className="flex shrink-0 items-center gap-3 border-t border-slate-200 px-4 py-2.5">
        <button
          onClick={send}
          disabled={!canSendNow}
          className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-1.5 text-[13px] font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {sending ? "Sending…" : "Send"}
        </button>
        <span className="text-[11px] text-slate-400">
          <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px]">ctrl</kbd>
          {" + "}
          <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px]">↵</kbd>
          {" to send"}
        </span>
        {/* Says WHY Send is dead rather than leaving a greyed button to guess at. */}
        {badAddress && (
          <span className="ml-auto text-[11px] font-semibold text-rose-500">
            {badAddress} is not a valid address
          </span>
        )}
      </footer>
    </div>
  );
}

function Shortcuts() {
  const keys = [
    ["j / k", "move"],
    ["↵", "open"],
    ["c", "compose"],
    ["esc", "close"],
    ["r", "refresh"],
    ["g i / g s", "folder"],
    ["/", "filter"],
  ];
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
      {keys.map(([k, label]) => (
        <span key={k} className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
            {k}
          </kbd>
          {label}
        </span>
      ))}
    </div>
  );
}

function MessageView({ message, folder, onBack, onReply }) {
  return (
    <article className="mx-auto max-w-3xl px-5 py-5">
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800 md:hidden"
        >
          <ChevronLeft size={13} /> Back
        </button>
        {/* Absent without COMM_SEND — the reader keeps the whole screen, minus the one action the
            server would refuse. */}
        {onReply && (
          <button
            onClick={onReply}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Reply size={12} /> Reply
          </button>
        )}
      </div>

      <h2 className="text-[17px] font-semibold leading-snug text-slate-900">
        {message.subject || "(no subject)"}
      </h2>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[12px] text-slate-500">
        <span className="font-medium text-slate-700">{displayName(message.from)}</span>
        <span className="text-slate-400">{message.from}</span>
        <span className="ml-auto tabular-nums text-slate-400">{fmtFull(message.sentAt)}</span>
      </div>
      {folder === "SENT" && message.to && (
        <div className="mt-0.5 text-[12px] text-slate-400">to {message.to}</div>
      )}

      {/* Keyed by INDEX, not name: a message can carry two parts called invoice.pdf, and the server
          resolves the part positionally for exactly that reason. */}
      {message.attachmentNames?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {message.attachmentNames.map((n, i) => (
            <button
              key={`${i}-${n}`}
              type="button"
              onClick={() => downloadAttachment(message.uid, i, n, folder)}
              title={`Download ${n}`}
              className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
            >
              <Paperclip size={10} /> {n}
            </button>
          ))}
        </div>
      )}

      <hr className="my-4 border-slate-200" />

      {/* Plain text on purpose: the server strips HTML, so no sender can inject markup here. */}
      <pre className="whitespace-pre-wrap break-words font-sans text-[13.5px] leading-relaxed text-slate-700">
        {message.body || "(empty message)"}
      </pre>
    </article>
  );
}

function ErrorState({ message }) {
  return (
    <Centered>
      <AlertTriangle size={18} className="text-amber-500" />
      <p className="text-[13px] font-medium text-slate-700">{message}</p>
      <p className="max-w-sm text-[12px] leading-relaxed text-slate-400">
        For Gmail, IMAP must be switched on in the account and the saved password must be a
        16-character App Password — a normal account password is refused.
      </p>
      <Link to="/Settings" className="text-[12px] font-medium text-blue-600 hover:underline">
        Open Email settings
      </Link>
    </Centered>
  );
}

function NotConnected({ message }) {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-3 px-6 text-center">
      <MailPlus size={22} className="text-slate-300" />
      <p className="text-[14px] font-semibold text-slate-800">No mailbox connected</p>
      <p className="max-w-sm text-[12.5px] leading-relaxed text-slate-500">
        {message || "Add your email account under Settings > Email to read mail here."}
      </p>
      <Link
        to="/Settings"
        className="mt-1 rounded-md border border-slate-200 px-3 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50"
      >
        Open Email settings
      </Link>
    </div>
  );
}
