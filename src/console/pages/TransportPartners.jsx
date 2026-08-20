import { useCallback, useEffect, useState } from "react";
import {
  Copy, Loader2, Mail, MapPin, Plus, RefreshCw, Send, Trash2, X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@shared/ui/toast";
import { getErrorMessage } from "@shared/api/apiError";
import { transportPartnerService, INVITE_STATUS, REG_STATUS } from "../api/transportPartnerService";

/**
 * Transport partner onboarding — invite a fleet operator, then review the fleet they submit.
 *
 * Sibling of HotelPartners: same two sections, same invite lifecycle, same timeline. What is being
 * onboarded is different — a company with vehicles and rate cards rather than a property with rooms
 * — but nothing about the invite half changes because of that, so it deliberately does not diverge.
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

export default function TransportPartners() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("SUBMITTED");
  const [regs, setRegs] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  /* The invite whose history is open. Holds the whole row, not just the id, so the panel header can
     name the operator while the fetch is still in flight. */
  const [timelineFor, setTimelineFor] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, i] = await Promise.all([
        transportPartnerService.listRegistrations({ status: tab, size: 50 }),
        transportPartnerService.listInvites({ size: 50 }),
      ]);
      setRegs(r.rows);
      setInvites(i.rows);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not load transport partners."));
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-extrabold text-heading">Transport partners</h1>
          <p className="mt-0.5 text-sm text-body">
            Invite a fleet operator to register itself, then review the vehicles and rates they send.
          </p>
        </div>
        <button onClick={load}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-body hover:bg-surface-hover">
          <RefreshCw size={14} /> Refresh
        </button>
        <button onClick={() => setInviting(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-bold text-accent-text hover:bg-accent-hover">
          <Plus size={15} /> Invite an operator
        </button>
      </header>

      {/* ── Submissions ─────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-surface shadow-[var(--sa-card-shadow)]">
        <div className="flex flex-wrap gap-1 border-b border-border px-3 pt-3">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`rounded-t-lg px-3 py-2 text-sm font-semibold transition ${
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
                <button onClick={() => navigate(`/console/transport-partners/${r.publicId}`)}
                  className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-surface-hover">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-bold text-heading">{r.companyName || "Untitled operator"}</span>
                      <Chip map={REG_STATUS} value={r.status} />
                    </div>
                    {/* NO FLEET SIZE HERE, deliberately. `vehicles` is always `[]` on a list row —
                        the endpoint skips the join to avoid an N+1 — so "0 vehicles" would be a lie
                        about every operator on this page. The fleet appears when the row is opened. */}
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-muted">
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={11} /> {[r.cityName, r.countryCode].filter(Boolean).join(", ") || "—"}
                      </span>
                      {r.contactPerson ? <span className="truncate">{r.contactPerson}</span> : null}
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
                  title="Show everything that has happened with this operator"
                  className="min-w-0 flex-1 rounded-lg px-1 py-0.5 text-left hover:bg-surface-hover"
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-heading">{inv.contactName}</span>
                    <Chip map={INVITE_STATUS} value={inv.status} />
                  </div>
                  <p className="truncate text-xs text-muted">
                    {inv.contactEmail}
                    {inv.hintCompanyName ? ` · ${inv.hintCompanyName}` : ""}
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

/**
 * Resend rotates the token, so its response is the second (and last) moment a raw link exists.
 *
 * The link is PAINTED here rather than only pushed to the clipboard: `navigator.clipboard` is
 * unavailable on a non-secure origin and rejects when the document is not focused, and a silent
 * clipboard failure would leave the operator believing they hold a link that can never be recovered.
 * The panel survives the list reload because this component is keyed by the invite's publicId, which
 * a resend does not change.
 */
function InviteActions({ invite, onDone }) {
  const [busy, setBusy] = useState("");
  const [link, setLink] = useState("");
  const [mailFailed, setMailFailed] = useState(false);
  const terminal = ["COMPLETED", "REVOKED", "EXPIRED"].includes(invite.status);

  const resend = async () => {
    setBusy("resend");
    try {
      const dto = await transportPartnerService.resendInvite(invite.publicId);
      setLink(dto?.registrationLink || "");
      setMailFailed(Boolean(dto?.emailDeliveryFailed));
      toast.success(dto?.emailDeliveryFailed
        ? "A fresh link was issued, but the email did not send."
        : "A fresh link was emailed.");
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not resend that invite."));
    } finally {
      setBusy("");
    }
  };

  const revoke = async () => {
    setBusy("revoke");
    try {
      await transportPartnerService.revokeInvite(invite.publicId);
      toast.success("Invite revoked.");
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not revoke that invite."));
    } finally {
      setBusy("");
    }
  };

  if (terminal) return null;
  return (
    <>
      <div className="flex items-center gap-1.5">
        <button disabled={!!busy} onClick={resend}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-body hover:bg-surface-hover disabled:opacity-50">
          {busy === "resend" ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Resend
        </button>
        <button disabled={!!busy} onClick={revoke}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-hue-rose hover:bg-hue-rose-soft disabled:opacity-50">
          {busy === "revoke" ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Revoke
        </button>
      </div>
      {/* `w-full` inside the flex-wrap row: the panel takes its own line under the invite. */}
      {link && (
        <div className="w-full">
          <LinkBox link={link} mailFailed={mailFailed} onDismiss={() => setLink("")} />
        </div>
      )}
    </>
  );
}

/**
 * The one-time link, with the only copy control the app offers.
 *
 * Shown on create and on resend. There is deliberately no "show link" anywhere else: the server
 * keeps a SHA-256 of the token, so no later call can reconstruct it — offering the affordance would
 * be promising something the backend cannot do.
 */
function LinkBox({ link, mailFailed, onDismiss }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Copied.");
    } catch {
      // Non-secure origin, or the document lost focus. Say so — the text is still selectable.
      toast.error("Could not reach the clipboard. Select the link and copy it manually.");
    }
  };
  return (
    <div className={`rounded-lg px-3 py-2 ${mailFailed ? "bg-hue-amber-soft" : "bg-surface-hover"}`}>
      <div className="flex items-start justify-between gap-2">
        <p className={`text-xs font-semibold ${mailFailed ? "text-hue-amber" : "text-body"}`}>
          {mailFailed
            ? "The invite exists, but the email did not go out. Send this link to the operator yourself."
            : "Emailed. You can also share this link directly."}
        </p>
        {onDismiss && (
          <button onClick={onDismiss} className="shrink-0 rounded p-0.5 text-muted hover:text-heading">
            <X size={13} />
          </button>
        )}
      </div>
      <div className="mt-1.5 flex gap-2">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.target.select()}
          className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 font-mono text-[11px] text-heading outline-none focus:ring-2 focus:ring-focus"
        />
        <button onClick={copy}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-bold text-accent-text hover:bg-accent-hover">
          <Copy size={12} /> Copy
        </button>
      </div>
      <p className="mt-1 text-[11px] text-muted">
        Shown once — it is stored hashed. <strong>Resend</strong> issues a fresh one and invalidates this.
      </p>
    </div>
  );
}

function InviteDialog({ onClose, onDone }) {
  const [form, setForm] = useState({
    contactName: "", contactEmail: "", contactPhone: "",
    hintCompanyName: "", hintCityName: "", hintCountryCode: "IN",
  });
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");
  const [mailFailed, setMailFailed] = useState(false);
  /* An invite is created even when the email fails, and it is created even when no link comes back
     in some future response shape — so "created" is tracked separately from "have a link". Without
     it, a linkless success would leave the form on screen and invite a duplicate invite. */
  const [created, setCreated] = useState(false);

  const field = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading outline-none focus:ring-2 focus:ring-focus";

  const submit = async () => {
    setBusy(true);
    try {
      const dto = await transportPartnerService.createInvite(form);
      // The raw token exists only in THIS response — surface the link immediately and let the
      // operator copy it. It can never be shown again.
      setLink(dto?.registrationLink || "");
      setMailFailed(Boolean(dto?.emailDeliveryFailed));
      setCreated(true);
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not create the invite."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      {/* Height-capped, and the BODY is the scroller rather than the overlay. The overlay has no
          overflow of its own, so an unconstrained card on a short viewport does not scroll — it
          clips, and the clipped part is unreachable. The success state in particular must never be
          clipped: it holds the one-time registration link, which cannot be recovered. */}
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-surface shadow-[var(--sa-card-shadow)]"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-start justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-heading">Invite a transport operator</h3>
            <p className="mt-0.5 text-xs text-body">
              They get a link to fill in their company, their vehicles and their rate cards. No login
              needed.
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-surface-hover hover:text-heading">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
        {created ? (
          <div className="space-y-3">
            {link ? (
              <LinkBox link={link} mailFailed={mailFailed} />
            ) : (
              <p className="rounded-lg bg-hue-amber-soft px-3 py-2 text-sm text-hue-amber">
                The invite was created, but no link came back with it. Use <strong>Resend</strong> on
                the invite to issue one.
              </p>
            )}
            <button onClick={onClose}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm font-semibold text-body hover:bg-surface-hover">
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-body">Contact name *</span>
                <input className={field} maxLength={150} value={form.contactName}
                  onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-body">Email *</span>
                <input className={field} type="email" maxLength={150} value={form.contactEmail}
                  onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-body">Phone</span>
                <input className={field} maxLength={50} value={form.contactPhone}
                  onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
              </label>
              <label className="block">
                {/* The operator's COMPANY, not a vehicle — one invite onboards a whole fleet. */}
                <span className="mb-1 block text-xs font-semibold text-body">Company name</span>
                <input className={field} maxLength={200} value={form.hintCompanyName}
                  onChange={(e) => setForm({ ...form, hintCompanyName: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-body">Operating city</span>
                <input className={field} maxLength={120} value={form.hintCityName}
                  onChange={(e) => setForm({ ...form, hintCityName: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-body">Country code</span>
                <input className={field} maxLength={3} value={form.hintCountryCode}
                  onChange={(e) => setForm({ ...form, hintCountryCode: e.target.value.toUpperCase() })} />
              </label>
            </div>
            <p className="text-[11px] text-muted">
              Everything except the name and email is a hint — it pre-fills their form and they can
              change any of it.
            </p>
            <button disabled={busy || !form.contactName.trim() || !form.contactEmail.trim()}
              onClick={submit}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2.5 text-sm font-bold text-accent-text hover:bg-accent-hover disabled:opacity-50">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
              Send invite
            </button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

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
  /* The transport terminal event. Plural, and that is the difference from the hotel realm: one
     approval publishes the operator's whole fleet, not a single product. */
  VEHICLES_PUBLISHED: "bg-hue-emerald",
};

function TimelinePanel({ invite, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    transportPartnerService
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
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
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
              {invite.hintCompanyName ? ` · ${invite.hintCompanyName}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-surface-hover hover:text-heading">
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
