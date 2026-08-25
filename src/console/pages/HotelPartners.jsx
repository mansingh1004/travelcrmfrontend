import { useCallback, useEffect, useState } from "react";
import {
  Copy, Loader2, Mail, MapPin, Plus, RefreshCw, Send, Star, Trash2, X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@shared/ui/toast";
import { getErrorMessage } from "@shared/api/apiError";
import { COUNTRY_OPTIONS, countryNameFromCode } from "@shared/lib/countries";
import { hotelPartnerService, INVITE_STATUS, REG_STATUS } from "../api/hotelPartnerService";

/**
 * Hotel partner onboarding — invite a hotel owner, then review what they submit.
 *
 * Styled with the console's SEMANTIC tokens (bg-surface / text-heading / bg-accent / hue chips), not
 * raw slate/blue. Those utilities only resolve inside `.sa-console`, and using them is what keeps
 * this page in the same visual language as the rest of the console.
 */

const fmtDate = (s) => (s ? new Date(s).toLocaleString() : "—");

function Chip({ map, value }) {
  const c = map[value] ?? { label: value ?? "—", cls: "bg-surface-hover text-muted" };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${c.cls}`}>
      {c.label}
    </span>
  );
}

const TABS = [
  { key: "SUBMITTED", label: "Awaiting review" },
  { key: "CHANGES_REQUESTED", label: "Sent back" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "", label: "All" },
];

export default function HotelPartners() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("SUBMITTED");
  const [regs, setRegs] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  /* The invite whose history is open. Holds the whole row, not just the id, so the panel header can
     name the partner while the fetch is still in flight. */
  const [timelineFor, setTimelineFor] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, i] = await Promise.all([
        hotelPartnerService.listRegistrations({ status: tab, size: 50 }),
        hotelPartnerService.listInvites({ size: 50 }),
      ]);
      setRegs(r.rows);
      setInvites(i.rows);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not load hotel partners."));
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const copyPublicRegistrationLink = async () => {
    const link = `${window.location.origin}/hotel-partner/register`;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(link);
      toast.success("Public hotel registration link copied.");
    } catch {
      // Clipboard access needs HTTPS (or localhost). The prompt keeps the link usable on a LAN.
      window.prompt("Copy the public hotel registration link:", link);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-extrabold text-heading">Hotel partners</h1>
          <p className="mt-0.5 text-sm text-body">
            Invite a hotel to register itself, then review and approve what they send.
          </p>
        </div>
        <button type="button" onClick={copyPublicRegistrationLink}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-bold text-white hover:bg-blue-700">
          <Copy size={15} /> Copy Public Registration Link
        </button>
        <button onClick={load}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-body hover:bg-surface-hover">
          <RefreshCw size={14} /> Refresh
        </button>
        <button onClick={() => setInviting(true)}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-bold text-accent-text hover:bg-accent-hover">
          <Plus size={15} /> Invite a hotel
        </button>
      </header>

      {/* ── Submissions ─────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-surface shadow-[var(--sa-card-shadow)]">
        <div className="flex flex-wrap gap-1 border-b border-border px-3 pt-3">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-t-lg px-3 py-2 text-sm font-semibold transition ${
                tab === t.key ? "bg-accent-soft text-accent-soft-text" : "text-muted hover:text-heading"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted" /></div>
        ) : regs.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted">Nothing here yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {regs.map((r) => (
              <li key={r.publicId}>
                {/* A route, not a drawer — the review needs the whole page, and the URL makes it
                    shareable and openable in a second tab for comparing duplicates. */}
                <button onClick={() => navigate(`/console/hotel-partners/${r.publicId}`)}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-surface-hover">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-bold text-heading">{r.name || "Untitled hotel"}</span>
                      <Chip map={REG_STATUS} value={r.status} />
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-muted">
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={11} /> {[r.cityName, countryNameFromCode(r.countryCode)].filter(Boolean).join(", ") || "—"}
                      </span>
                      {r.stars ? <span className="inline-flex items-center gap-1"><Star size={11} />{r.stars}</span> : null}
                      <span>Sent {fmtDate(r.submittedAt)}</span>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Invites ─────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-surface shadow-[var(--sa-card-shadow)]">
        <header className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-bold text-heading">Invites</h2>
        </header>
        {invites.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">No invites sent yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {invites.map((inv) => (
              <li key={inv.publicId} className="flex flex-wrap items-center gap-3 px-5 py-3">
                {/* The row itself opens the timeline. The actions stay separate buttons — resend
                    rotates the token and revoke is destructive, and neither should be one stray
                    click away from "I wanted to see what happened". */}
                <button
                  onClick={() => setTimelineFor(inv)}
                  title="Show everything that has happened with this partner"
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus min-w-0 flex-1 rounded-lg px-1 py-0.5 text-left hover:bg-surface-hover"
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-heading">{inv.contactName}</span>
                    <Chip map={INVITE_STATUS} value={inv.status} />
                  </div>
                  <p className="truncate text-xs text-muted">
                    {inv.contactEmail}
                    {inv.hintHotelName ? ` · ${inv.hintHotelName}` : ""}
                    {" · expires "}{fmtDate(inv.expiresAt)}
                  </p>
                </button>
                <InviteActions invite={inv} onDone={load} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {inviting && <InviteDialog onClose={() => setInviting(false)} onDone={load} />}
      {timelineFor && (
        <TimelinePanel invite={timelineFor} onClose={() => setTimelineFor(null)} />
      )}
    </div>
  );
}

function InviteActions({ invite, onDone }) {
  const [busy, setBusy] = useState("");
  const terminal = ["COMPLETED", "REVOKED", "EXPIRED"].includes(invite.status);

  const run = async (kind, fn) => {
    setBusy(kind);
    try {
      const res = await fn();
      if (kind === "resend" && res?.registrationLink) {
        await navigator.clipboard?.writeText(res.registrationLink).catch(() => {});
        toast.success("New link sent and copied to your clipboard.");
      } else {
        toast.success("Invite revoked.");
      }
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err, "That did not work."));
    } finally {
      setBusy("");
    }
  };

  if (terminal) return null;
  return (
    <div className="flex items-center gap-1.5">
      <button disabled={!!busy} onClick={() => run("resend", () => hotelPartnerService.resendInvite(invite.publicId))}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-body hover:bg-surface-hover disabled:opacity-50">
        {busy === "resend" ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Resend
      </button>
      <button disabled={!!busy} onClick={() => run("revoke", () => hotelPartnerService.revokeInvite(invite.publicId))}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-hue-rose hover:bg-hue-rose-soft disabled:opacity-50">
        <Trash2 size={12} /> Revoke
      </button>
    </div>
  );
}

function InviteDialog({ onClose, onDone }) {
  const [form, setForm] = useState({
    contactName: "", contactEmail: "", contactPhone: "",
    hintHotelName: "", hintCityName: "", hintCountryCode: "IN",
  });
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");
  const [mailFailed, setMailFailed] = useState(false);

  const field = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading outline-none focus:ring-2 focus:ring-focus";

  const submit = async () => {
    setBusy(true);
    try {
      const dto = await hotelPartnerService.createInvite(form);
      // The raw token exists only in THIS response — surface the link immediately and let the
      // operator copy it. It can never be shown again.
      setLink(dto.registrationLink || "");
      setMailFailed(Boolean(dto.emailDeliveryFailed));
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not create the invite."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-[var(--sa-card-shadow)]"
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-heading">Invite a hotel</h3>
            <p className="mt-0.5 text-xs text-body">
              They get a link to fill in their own details, rooms and rates. No login needed.
            </p>
          </div>
          <button onClick={onClose} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-lg p-1 text-muted hover:bg-surface-hover hover:text-heading">
            <X size={16} />
          </button>
        </div>

        {link ? (
          <div className="space-y-3">
            {mailFailed ? (
              <p className="rounded-lg bg-hue-amber-soft px-3 py-2 text-sm text-hue-amber">
                The invite was created but the email could not be sent. Share this link yourself.
              </p>
            ) : (
              <p className="rounded-lg bg-hue-emerald-soft px-3 py-2 text-sm text-hue-emerald">
                Invite emailed. You can also share this link directly.
              </p>
            )}
            <div className="flex gap-2">
              <input readOnly value={link} className={`${field} font-mono text-xs`} />
              <button onClick={() => { navigator.clipboard?.writeText(link); toast.success("Copied."); }}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-2 text-sm font-bold text-accent-text hover:bg-accent-hover">
                <Copy size={14} /> Copy
              </button>
            </div>
            <p className="text-xs text-muted">
              This link is shown only once — it is stored hashed. Use <strong>Resend</strong> later to
              issue a fresh one.
            </p>
            <button onClick={onClose}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus w-full rounded-lg border border-border px-3 py-2 text-sm font-semibold text-body hover:bg-surface-hover">
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-body">Contact name *</span>
                <input className={field} value={form.contactName}
                  onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-body">Email *</span>
                <input className={field} type="email" value={form.contactEmail}
                  onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-body">Phone</span>
                <input className={field} value={form.contactPhone}
                  onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-body">Hotel name</span>
                <input className={field} value={form.hintHotelName}
                  onChange={(e) => setForm({ ...form, hintHotelName: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-body">City</span>
                <input className={field} value={form.hintCityName}
                  onChange={(e) => setForm({ ...form, hintCityName: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-body">Country</span>
                <select className={field} value={form.hintCountryCode}
                  onChange={(e) => setForm({ ...form, hintCountryCode: e.target.value })}>
                  <option value="">Select country</option>
                  {COUNTRY_OPTIONS.map(({ code, name }) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
              </label>
            </div>
            <button disabled={busy || !form.contactName.trim() || !form.contactEmail.trim()}
              onClick={submit}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2.5 text-sm font-bold text-accent-text hover:bg-accent-hover disabled:opacity-50">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
              Send invite
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Slide-over review, mirroring the Hotel Requests decision panel: one mode open at a time. */
/* ── Partner timeline ─────────────────────────────────────────────────────────
   The lifecycle and the actual correspondence in one column, interleaved by time.

   Interleaved, not two stacked lists, because the question this screen answers is "why is this one
   stuck", and the answer is almost always the gap between two rows of different kinds — the invite
   went out on the 3rd, they replied with a question on the 4th, and nothing has happened since. Two
   separate lists put those three facts in two places and the gap in neither. */
const EVENT_TONE = {
  INVITE_CREATED: "bg-hue-sky",
  INVITE_SENT: "bg-hue-sky",
  INVITE_OPENED: "bg-hue-indigo",
  INVITE_CONSUMED: "bg-hue-indigo",
  REGISTRATION_SUBMITTED: "bg-hue-amber",
  REGISTRATION_REVIEWED: "bg-hue-amber",
  HOTEL_PUBLISHED: "bg-hue-emerald",
};

function TimelinePanel({ invite, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    hotelPartnerService
      .timeline(invite.publicId)
      .then((d) => { if (alive) setData(d); })
      .catch((err) => { if (alive) setError(getErrorMessage(err, "Could not load this timeline.")); });
    return () => { alive = false; };
  }, [invite.publicId]);

  /* One list, sorted by time. Messages carry `sentAt`, events carry `at` — normalised to a single
     `when` here so the sort has one key rather than a comparator that knows about both shapes. */
  const entries = [
    ...(data?.events || []).map((e) => ({ kind: "event", when: e.at, data: e })),
    ...(data?.messages || []).map((m) => ({ kind: "message", when: m.sentAt, data: m })),
  ].sort((a, b) => new Date(a.when) - new Date(b.when));

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-scrim" onClick={onClose}>
      <aside
        className="h-full w-full max-w-xl overflow-y-auto bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 flex items-center gap-3 border-b border-border bg-surface px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-bold text-heading">
              {invite.contactName || invite.contactEmail}
            </h3>
            <p className="truncate text-xs text-muted">
              {invite.contactEmail}
              {invite.hintHotelName ? ` · ${invite.hintHotelName}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-lg p-1 text-muted hover:bg-surface-hover hover:text-heading">
            <X size={17} />
          </button>
        </header>

        <div className="px-5 py-4">
          {error ? (
            <p className="rounded-lg bg-hue-rose-soft px-3 py-2 text-sm text-hue-rose">{error}</p>
          ) : !data ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted" /></div>
          ) : (
            <>
              {/* Soft failure: the lifecycle below is still real, so this is a note rather than the
                  whole pane's error state. */}
              {data.mailboxError && (
                <p className="mb-4 rounded-lg bg-hue-amber-soft px-3 py-2 text-xs text-hue-amber">
                  Email could not be read: {data.mailboxError}
                </p>
              )}

              {entries.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted">Nothing recorded yet.</p>
              ) : (
                <ol className="relative space-y-4 border-l border-border pl-5">
                  {entries.map((entry, i) =>
                    entry.kind === "event" ? (
                      <li key={`e-${i}`} className="relative">
                        <span
                          className={`absolute -left-[1.4rem] top-1.5 h-2 w-2 rounded-full ${
                            EVENT_TONE[entry.data.key] || "bg-border"
                          }`}
                        />
                        <p className="text-sm font-semibold text-heading">{entry.data.label}</p>
                        {entry.data.detail && (
                          <p className="mt-0.5 text-xs text-body">{entry.data.detail}</p>
                        )}
                        <p className="mt-0.5 text-[11px] text-muted">{fmtDate(entry.data.at)}</p>
                      </li>
                    ) : (
                      <li key={`m-${i}`} className="relative">
                        <span className="absolute -left-[1.4rem] top-1.5 flex h-2 w-2 items-center justify-center rounded-full bg-accent" />
                        <div className="rounded-lg border border-border bg-page px-3 py-2">
                          <div className="flex items-baseline gap-2">
                            <Mail size={11} className="shrink-0 text-muted" />
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-heading">
                              {entry.data.subject || "(no subject)"}
                            </span>
                            {entry.data.hasAttachments && (
                              <span className="shrink-0 text-[10px] font-semibold text-muted">FILE</span>
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-xs text-body">
                            {entry.data.from || "—"}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted">{fmtDate(entry.data.sentAt)}</p>
                        </div>
                      </li>
                    )
                  )}
                </ol>
              )}

              {/* No inline reader here on purpose. The mailbox already opens a message properly —
                  marks it read, renders the body as text, downloads attachments — and a second
                  half-implementation of that would be the one that renders sender HTML. */}
              <p className="mt-5 text-xs text-muted">
                Open a message in Platform Email to read it or reply.
              </p>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

