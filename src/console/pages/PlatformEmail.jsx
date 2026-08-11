// src/console/pages/PlatformEmail.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The platform mailbox: the single address SuperAdmin alerts and hotel-partner
// invites are sent from, plus a read-only view of its Inbox and Sent folders so
// nobody has to open webmail to find out whether an invite actually left.
//
// Dense two-pane reader with keyboard navigation (j/k, Enter, Esc, r), hairline
// borders, no drop shadows — matching the tenant Mailbox screen. Colours come
// from the console's semantic tokens, never raw slate/blue.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2, Mail, Inbox, Send, Save, ShieldCheck, AlertTriangle, CheckCircle2,
  RefreshCw, Paperclip, ChevronLeft, Server, Search, X, PenSquare, Reply,
} from "lucide-react";
import { platformMailService } from "../api/platformMailService";
import SuperAdminMfaActionModal from "../components/SuperAdminMfaActionModal";

const inputCls =
  "w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] text-heading " +
  "placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus";

/* Folders are the page. Settings used to be the FIRST of three peer tabs and the default view, so
   opening Platform Email put you in an SMTP form and the mailbox — the thing anyone actually comes
   here for — was two clicks and a guess away. It is a destination off to the right now, and the
   inbox is what the page opens on. */
const FOLDERS = [
  { id: "INBOX", label: "Inbox", Icon: Inbox },
  { id: "SENT", label: "Sent", Icon: Send },
];

/* The console shell is a sticky h-14 header over `<main class="flex-1 p-4 sm:p-6">`, so the room
   left for a full-bleed pane is the viewport minus the header and that padding. Spelled out rather
   than using h-full: `main` only has an intrinsic height while the page is short, and a mail client
   that grows the document instead of scrolling its own list is the thing being fixed here. */
const PAGE_H = "h-[calc(100vh-5.5rem)] sm:h-[calc(100vh-6.5rem)]";

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

const displayName = (addr) => {
  if (!addr) return "(unknown)";
  const m = addr.match(/^\s*(.+?)\s*<[^>]+>\s*$/);
  return (m ? m[1] : addr).replace(/^"|"$/g, "");
};

const errText = (e, fallback) => e?.response?.data?.message || fallback;

export default function PlatformEmail() {
  // Opens on the Inbox. The page-level <h1> that used to sit above the tabs is gone with it: the
  // console header already names the screen, and a title block plus a description paragraph is a
  // sixth of the viewport a mail client cannot spare.
  const [tab, setTab] = useState("INBOX");
  const [toast, setToast] = useState(null);

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4500);
  }, []);

  return (
    <div className={`flex flex-col ${PAGE_H}`}>
      <div className="flex shrink-0 items-center gap-1 border-b border-border">
        {FOLDERS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-3.5 py-2 text-[13px] font-semibold transition ${
              tab === id ? "border-accent text-heading" : "border-transparent text-body hover:text-heading"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
        <button
          onClick={() => setTab("settings")}
          title="Mailbox settings"
          className={`-mb-px ml-auto flex items-center gap-2 border-b-2 px-3.5 py-2 text-[13px] font-semibold transition ${
            tab === "settings" ? "border-accent text-heading" : "border-transparent text-muted hover:text-heading"
          }`}
        >
          <Server size={14} />
          Settings
        </button>
      </div>

      {tab === "settings" ? (
        <div className="min-h-0 flex-1 overflow-y-auto pt-4">
          <SettingsTab showToast={showToast} />
        </div>
      ) : (
        <MailboxTab key={tab} folder={tab} showToast={showToast} />
      )}

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[80] flex max-w-md items-start gap-2 rounded-lg px-4 py-3 text-[13px] text-white ${
            toast.type === "success" ? "bg-emerald-600" : "bg-rose-600"
          }`}
        >
          {toast.type === "success" ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────── Settings ────────────────────────────── */

function SettingsTab({ showToast }) {
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mfaOpen, setMfaOpen] = useState(false);
  const [mfaError, setMfaError] = useState("");
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await platformMailService.getSettings();
      setForm({
        host: s.host || "",
        port: s.port || 587,
        username: s.username || "",
        password: "",
        ssl: !!s.ssl,
        fromName: s.fromName || "",
        enabled: s.enabled !== false,
        passwordSet: !!s.passwordSet,
        source: s.source || "ENVIRONMENT",
      });
      setTestTo((prev) => prev || s.username || "");
    } catch (e) {
      showToast("error", errText(e, "Failed to load platform email settings"));
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const confirmSave = async (mfaCode) => {
    setMfaError("");
    setSaving(true);
    try {
      await platformMailService.saveSettings(
        {
          host: form.host,
          port: Number(form.port) || 587,
          username: form.username,
          password: form.password || undefined,
          ssl: !!form.ssl,
          fromName: form.fromName,
          enabled: !!form.enabled,
        },
        mfaCode
      );
      setMfaOpen(false);
      showToast("success", "Platform email settings saved");
      load();
    } catch (e) {
      setMfaError(errText(e, "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      await platformMailService.sendTest(testTo);
      showToast("success", `Test email sent to ${testTo}. Check the inbox (and spam).`);
    } catch (e) {
      showToast("error", errText(e, "Test email failed"));
    } finally {
      setTesting(false);
    }
  };

  if (loading || !form) {
    return <div className="py-16 text-center"><Loader2 size={18} className="mx-auto animate-spin text-muted" /></div>;
  }

  return (
    <div className="max-w-3xl space-y-5">
      <section className="rounded-lg border border-border bg-surface">
        <header className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
          <div>
            <h2 className="flex items-center gap-2 text-[13px] font-bold text-heading">
              <Mail size={14} /> Sending mailbox
            </h2>
            <p className="mt-0.5 text-[12px] leading-relaxed text-body">
              The From address is always the SMTP username — that is why there is no separate field.
              Gmail rejects mail whose From is not the account it authenticated as.
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
              form.source === "DATABASE" ? "bg-accent/15 text-accent" : "bg-amber-500/15 text-amber-600"
            }`}
          >
            {form.source === "DATABASE" ? "Saved here" : "Server env"}
          </span>
        </header>

        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label="SMTP host">
            <input className={inputCls} value={form.host}
              onChange={(e) => set("host", e.target.value)} placeholder="smtp.gmail.com" />
          </Field>
          <Field label="Port">
            <input className={inputCls} type="number" value={form.port}
              onChange={(e) => set("port", e.target.value)} placeholder="587" />
          </Field>
          <Field label="Username — also the From address">
            <input className={inputCls} value={form.username}
              onChange={(e) => set("username", e.target.value)} placeholder="you@yourdomain.com" />
          </Field>
          <Field
            label="App password"
            hint={form.passwordSet ? "A password is saved. Leave blank to keep it." : "Required."}
          >
            <input className={inputCls} type="password" value={form.password}
              onChange={(e) => set("password", e.target.value)}
              placeholder={form.passwordSet ? "••••••••••••" : "16-character app password"} />
          </Field>
          <Field label="Display name">
            <input className={inputCls} value={form.fromName}
              onChange={(e) => set("fromName", e.target.value)} placeholder="Veto Tech IT" />
          </Field>
          <div className="flex flex-col justify-end gap-2 pb-1">
            <Check label="Implicit SSL (port 465)" checked={form.ssl} onChange={(v) => set("ssl", v)} />
            <Check label="Platform email enabled" checked={form.enabled} onChange={(v) => set("enabled", v)} />
          </div>
        </div>

        <footer className="flex justify-end border-t border-border px-4 py-3">
          <button
            onClick={() => { setMfaError(""); setMfaOpen(true); }}
            className="inline-flex items-center gap-2 rounded-md bg-accent px-3.5 py-1.5 text-[13px] font-bold text-white hover:opacity-90"
          >
            <Save size={14} /> Save settings
          </button>
        </footer>
      </section>

      <section className="rounded-lg border border-border bg-surface px-4 py-3">
        <h2 className="flex items-center gap-2 text-[13px] font-bold text-heading">
          <ShieldCheck size={14} /> Send a test
        </h2>
        <p className="mt-0.5 text-[12px] text-body">
          Uses the settings actually in force. If this arrives, invites will too.
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <input className={`${inputCls} max-w-xs`} value={testTo}
            onChange={(e) => setTestTo(e.target.value)} placeholder="where.to@example.com" />
          <button
            onClick={sendTest}
            disabled={testing || !testTo}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-[13px] font-semibold text-heading hover:bg-page disabled:opacity-50"
          >
            {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Send test email
          </button>
        </div>
      </section>

      {mfaOpen && (
        <SuperAdminMfaActionModal
          title="Confirm platform email change"
          description="Enter your authenticator code to update the platform mailbox."
          confirmLabel="Save"
          saving={saving}
          error={mfaError}
          onClose={() => setMfaOpen(false)}
          onConfirm={confirmSave}
        />
      )}
    </div>
  );
}

/* ────────────────────────────── Mailbox ────────────────────────────── */

function MailboxTab({ folder, showToast }) {
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

  /* Compose owns the reading pane rather than a modal. A dialog over a mail list is the one place a
     modal is actively wrong: half the reason to write from here is to answer something in the list,
     and a modal hides exactly that. `draft` null = not composing. */
  const [draft, setDraft] = useState(null);

  const listRef = useRef(null);
  const searchRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { messages, meta: m } = await platformMailService.listMessages({ folder, page, size: 50 });
      setRows(messages);
      setMeta(m);
      setCursor(0);
    } catch (e) {
      // Inline, not a toast: an unreadable mailbox is the entire content of this pane.
      setError(errText(e, "Could not read the mailbox."));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [folder, page]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((m) =>
      [m.subject, m.from, m.to].filter(Boolean).some((v) => v.toLowerCase().includes(q))
    );
  }, [rows, query]);

  const openMessage = useCallback(async (row) => {
    if (!row) return;
    setDraft(null);          // a half-typed draft must not sit behind a message the agent then reads
    setOpenUid(row.uid);
    setOpening(true);
    try {
      setMessage(await platformMailService.getMessage(row.uid, folder));
    } catch (e) {
      setOpenUid(null);
      showToast("error", errText(e, "Could not open that message"));
    } finally {
      setOpening(false);
    }
  }, [folder, showToast]);

  const startCompose = useCallback((prefill = {}) => {
    setOpenUid(null);
    setMessage(null);
    setDraft({ to: "", subject: "", body: "", ...prefill });
  }, []);

  /* Reply prefills from the message on screen and quotes it underneath — the quote is why this is a
     button and not just "compose with the address filled in". `Re:` is only added once, so replying
     to a reply does not stack prefixes. */
  const replyTo = useCallback((m) => {
    if (!m) return;
    const addr = (m.from || "").match(/<([^>]+)>/)?.[1] || m.from || "";
    const subject = /^re:/i.test(m.subject || "") ? m.subject : `Re: ${m.subject || ""}`.trim();
    const quoted = (m.body || "")
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
    startCompose({
      to: addr,
      subject,
      body: `\n\nOn ${fmtFull(m.sentAt)}, ${displayName(m.from)} wrote:\n${quoted}`,
    });
  }, [startCompose]);

  useEffect(() => {
    const onKey = (e) => {
      const el = e.target;
      if (el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.isContentEditable) {
        if (e.key === "Escape") el.blur();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case "j": case "ArrowDown":
          e.preventDefault(); setCursor((c) => Math.min(visible.length - 1, c + 1)); break;
        case "k": case "ArrowUp":
          e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); break;
        case "Enter":
          e.preventDefault(); openMessage(visible[cursor]); break;
        case "Escape":
          setOpenUid(null); setMessage(null); setDraft(null); break;
        case "r":
          e.preventDefault(); load(); break;
        case "c":
          e.preventDefault(); startCompose(); break;
        case "/":
          e.preventDefault(); searchRef.current?.focus(); break;
        default: break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, cursor, openMessage, load, startCompose]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <button
          onClick={() => startCompose()}
          title="Compose (c)"
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[13px] font-bold text-white transition hover:opacity-90"
        >
          <PenSquare size={13} /> Compose
        </button>
        <span className="text-[12px] text-body">
          {meta ? `${meta.totalElements} message${meta.totalElements === 1 ? "" : "s"}` : ""}
        </span>
        <div className="relative ml-auto">
          <Search size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter this page…"
            className={`${inputCls} w-52 pl-7 pr-6`}
          />
          {query && (
            <button onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-heading">
              <X size={11} />
            </button>
          )}
        </div>
        <button onClick={load} title="Refresh (r)"
          className="rounded-md border border-border p-1.5 text-body hover:bg-page hover:text-heading">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      {/* Was a fixed h-[62vh] card. It now fills whatever the shell left, so the list scrolls
          against the window instead of the page growing a second scrollbar behind it. */}
      <div className="flex min-h-0 flex-1">
        <section
          ref={listRef}
          className={`min-h-0 overflow-y-auto border-border ${
            openUid || draft ? "hidden w-[360px] shrink-0 border-r lg:block" : "w-full"
          }`}
        >
          {loading ? (
            <Centered><Loader2 size={18} className="animate-spin text-muted" /></Centered>
          ) : error ? (
            <Centered>
              <AlertTriangle size={18} className="text-amber-500" />
              <p className="text-[13px] font-medium text-heading">{error}</p>
              <p className="max-w-sm text-[12px] leading-relaxed text-muted">
                For Gmail, IMAP must be enabled on the account and the password must be a
                16-character App Password — a normal password is refused.
              </p>
            </Centered>
          ) : visible.length === 0 ? (
            <Centered>
              <p className="text-[13px] text-muted">
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
                      className={`flex w-full items-baseline gap-2.5 border-b border-border px-3.5 py-2.5 text-left transition ${
                        active ? "bg-accent/10" : highlighted ? "bg-page" : "hover:bg-page"
                      }`}
                    >
                      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${m.seen ? "bg-transparent" : "bg-accent"}`} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className={`min-w-0 flex-1 truncate text-[13px] ${m.seen ? "font-medium text-body" : "font-semibold text-heading"}`}>
                            {displayName(folder === "SENT" ? m.to : m.from)}
                          </span>
                          {m.hasAttachments && <Paperclip size={11} className="shrink-0 text-muted" />}
                          <span className="shrink-0 text-[11px] tabular-nums text-muted">{fmtWhen(m.sentAt)}</span>
                        </span>
                        <span className={`mt-0.5 block truncate text-[12.5px] ${m.seen ? "text-muted" : "text-body"}`}>
                          {m.subject || "(no subject)"}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className={`min-h-0 flex-1 overflow-y-auto ${openUid || draft ? "block" : "hidden lg:block"}`}>
          {draft ? (
            <ComposePane
              draft={draft}
              setDraft={setDraft}
              showToast={showToast}
              onSent={() => {
                setDraft(null);
                // Sent mail belongs in Sent — reload so it is there rather than making the agent
                // wonder whether it left. On INBOX this is a cheap no-op refresh.
                if (folder === "SENT") load();
              }}
            />
          ) : opening ? (
            <Centered><Loader2 size={18} className="animate-spin text-muted" /></Centered>
          ) : message ? (
            <article className="mx-auto max-w-2xl px-5 py-4">
              <div className="mb-3 flex items-center gap-2">
                <button
                  onClick={() => { setOpenUid(null); setMessage(null); }}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-medium text-body hover:bg-page hover:text-heading lg:hidden"
                >
                  <ChevronLeft size={13} /> Back
                </button>
                <button
                  onClick={() => replyTo(message)}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[12px] font-semibold text-heading transition hover:bg-page"
                >
                  <Reply size={12} /> Reply
                </button>
              </div>
              <h2 className="text-[16px] font-semibold leading-snug text-heading">
                {message.subject || "(no subject)"}
              </h2>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[12px]">
                <span className="font-medium text-heading">{displayName(message.from)}</span>
                <span className="text-muted">{message.from}</span>
                <span className="ml-auto tabular-nums text-muted">{fmtFull(message.sentAt)}</span>
              </div>
              {folder === "SENT" && message.to && (
                <div className="mt-0.5 text-[12px] text-muted">to {message.to}</div>
              )}
              {message.attachmentNames?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {message.attachmentNames.map((n) => (
                    <span key={n} className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[11px] text-muted">
                      <Paperclip size={10} /> {n}
                    </span>
                  ))}
                </div>
              )}
              <hr className="my-4 border-border" />
              {/* Plain text on purpose — the server strips HTML so no sender can inject markup. */}
              <pre className="whitespace-pre-wrap break-words font-sans text-[13.5px] leading-relaxed text-body">
                {message.body || "(empty message)"}
              </pre>
            </article>
          ) : (
            <Centered>
              <p className="text-[13px] text-muted">Select a message</p>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
                {[["j / k", "move"], ["↵", "open"], ["c", "compose"], ["esc", "close"], ["r", "refresh"], ["/", "filter"]].map(([k, l]) => (
                  <span key={k} className="flex items-center gap-1.5 text-[11px] text-muted">
                    <kbd className="rounded border border-border bg-page px-1.5 py-0.5 font-mono text-[10px]">{k}</kbd>
                    {l}
                  </span>
                ))}
              </div>
            </Centered>
          )}
        </section>
      </div>

      {meta && meta.totalPages > 1 && !error && (
        <footer className="flex items-center justify-between border-t border-border px-3 py-2 text-[11px]">
          <button disabled={!meta.hasPrevious} onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded px-2 py-1 font-medium text-body hover:bg-page disabled:opacity-40">← Newer</button>
          <span className="text-muted">{meta.page + 1} / {meta.totalPages}</span>
          <button disabled={!meta.hasNext} onClick={() => setPage((p) => p + 1)}
            className="rounded px-2 py-1 font-medium text-body hover:bg-page disabled:opacity-40">Older →</button>
        </footer>
      )}
    </div>
  );
}

/* ────────────────────────────── Compose ────────────────────────────── */

/* There is no From field, and that is the same decision the settings form makes: the server sends as
   the SMTP username because Gmail rejects mail whose From is not the account it authenticated as.
   Showing an editable From here would be offering a choice the server then overrides. */
function ComposePane({ draft, setDraft, showToast, onSent }) {
  const [sending, setSending] = useState(false);
  const toRef = useRef(null);

  // Land the caret in whichever field is still empty — To on a fresh compose, the body on a reply,
  // where the address and subject are already right.
  useEffect(() => {
    if (draft.to) return;
    toRef.current?.focus();
  }, [draft.to]);

  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const recipients = String(draft.to || "")
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const badAddress = recipients.find((a) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a));
  const canSend = recipients.length > 0 && !badAddress && draft.subject.trim() && !sending;

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      await platformMailService.sendMessage({
        to: recipients.join(","),
        subject: draft.subject.trim(),
        body: draft.body,
      });
      showToast("success", `Sent to ${recipients.join(", ")}`);
      onSent();
    } catch (e) {
      // Inline is wrong here — the draft stays on screen and the agent needs the reason next to the
      // Send button they just pressed, not in a pane they have to scroll.
      showToast("error", errText(e, "Could not send that email"));
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
      // Ctrl/Cmd+Enter sends from anywhere in the form, including the body textarea — the one
      // shortcut every mail client has and the reason this does not need a mouse at all.
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); send(); }
        if (e.key === "Escape") { e.preventDefault(); discard(); }
      }}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2.5">
        <PenSquare size={13} className="text-muted" />
        <h2 className="text-[13px] font-bold text-heading">New message</h2>
        <button
          onClick={discard}
          className="ml-auto rounded-md p-1 text-muted transition hover:bg-page hover:text-heading"
          title="Discard (esc)"
        >
          <X size={14} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <label className="flex items-baseline gap-3 border-b border-border py-2">
          <span className="w-16 shrink-0 text-[12px] font-semibold text-muted">To</span>
          <input
            ref={toRef}
            value={draft.to}
            onChange={(e) => set("to", e.target.value)}
            placeholder="someone@example.com — comma-separate for several"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-heading placeholder:text-muted focus:outline-none"
          />
        </label>
        <label className="flex items-baseline gap-3 border-b border-border py-2">
          <span className="w-16 shrink-0 text-[12px] font-semibold text-muted">Subject</span>
          <input
            value={draft.subject}
            onChange={(e) => set("subject", e.target.value)}
            placeholder="Subject"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-heading placeholder:text-muted focus:outline-none"
          />
        </label>
        <textarea
          value={draft.body}
          onChange={(e) => set("body", e.target.value)}
          placeholder="Write your message…"
          className="mt-3 min-h-[16rem] w-full resize-y bg-transparent font-sans text-[13.5px] leading-relaxed text-body placeholder:text-muted focus:outline-none"
        />
      </div>

      <footer className="flex shrink-0 items-center gap-3 border-t border-border px-4 py-2.5">
        <button
          onClick={send}
          disabled={!canSend}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-1.5 text-[13px] font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {sending ? "Sending…" : "Send"}
        </button>
        <span className="text-[11px] text-muted">
          <kbd className="rounded border border-border bg-page px-1.5 py-0.5 font-mono text-[10px]">ctrl</kbd>
          {" + "}
          <kbd className="rounded border border-border bg-page px-1.5 py-0.5 font-mono text-[10px]">↵</kbd>
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

/* ────────────────────────────── bits ────────────────────────────── */

function Centered({ children }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2.5 px-6 text-center">
      {children}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-semibold text-heading">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </label>
  );
}

function Check({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-body">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-border" />
      {label}
    </label>
  );
}
