import { useCallback, useEffect, useState } from "react";
import {
  BedDouble, Check, Copy, Loader2, Mail, MapPin, Plus, RefreshCw, Send, Star, Trash2, X,
} from "lucide-react";
import { toast } from "@shared/ui/toast";
import { getErrorMessage } from "@shared/api/apiError";
import { hotelPartnerService, INVITE_STATUS, REG_STATUS } from "../api/hotelPartnerService";

/**
 * Hotel partner onboarding — invite a hotel owner, then review what they submit.
 *
 * Styled with the console's SEMANTIC tokens (bg-surface / text-heading / bg-accent / hue chips), not
 * raw slate/blue. Those utilities only resolve inside `.sa-console`, and using them is what keeps
 * this page in the same visual language as the rest of the console.
 */

const money = (a, c = "INR") =>
  a === null || a === undefined ? "—"
    : `${c === "INR" ? "₹" : c + " "}${Number(a).toLocaleString("en-IN")}`;
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
  const [tab, setTab] = useState("SUBMITTED");
  const [regs, setRegs] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [inviting, setInviting] = useState(false);

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

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-extrabold text-heading">Hotel partners</h1>
          <p className="mt-0.5 text-sm text-body">
            Invite a hotel to register itself, then review and approve what they send.
          </p>
        </div>
        <button onClick={load}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-body hover:bg-surface-hover">
          <RefreshCw size={14} /> Refresh
        </button>
        <button onClick={() => setInviting(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-bold text-accent-text hover:bg-accent-hover">
          <Plus size={15} /> Invite a hotel
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
                <button onClick={() => setSelected(r.publicId)}
                  className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-surface-hover">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-bold text-heading">{r.name || "Untitled hotel"}</span>
                      <Chip map={REG_STATUS} value={r.status} />
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-muted">
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={11} /> {[r.cityName, r.countryCode].filter(Boolean).join(", ") || "—"}
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
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-heading">{inv.contactName}</span>
                    <Chip map={INVITE_STATUS} value={inv.status} />
                  </div>
                  <p className="truncate text-xs text-muted">
                    {inv.contactEmail}
                    {inv.hintHotelName ? ` · ${inv.hintHotelName}` : ""}
                    {" · expires "}{fmtDate(inv.expiresAt)}
                  </p>
                </div>
                <InviteActions invite={inv} onDone={load} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {inviting && <InviteDialog onClose={() => setInviting(false)} onDone={load} />}
      {selected && (
        <ReviewPanel publicId={selected} onClose={() => setSelected(null)} onDecided={load} />
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
        className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-body hover:bg-surface-hover disabled:opacity-50">
        {busy === "resend" ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Resend
      </button>
      <button disabled={!!busy} onClick={() => run("revoke", () => hotelPartnerService.revokeInvite(invite.publicId))}
        className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-hue-rose hover:bg-hue-rose-soft disabled:opacity-50">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-[var(--sa-card-shadow)]"
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-heading">Invite a hotel</h3>
            <p className="mt-0.5 text-xs text-body">
              They get a link to fill in their own details, rooms and rates. No login needed.
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-surface-hover hover:text-heading">
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
                className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-2 text-sm font-bold text-accent-text hover:bg-accent-hover">
                <Copy size={14} /> Copy
              </button>
            </div>
            <p className="text-xs text-muted">
              This link is shown only once — it is stored hashed. Use <strong>Resend</strong> later to
              issue a fresh one.
            </p>
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
                <span className="mb-1 block text-xs font-semibold text-body">Country code</span>
                <input className={field} maxLength={3} value={form.hintCountryCode}
                  onChange={(e) => setForm({ ...form, hintCountryCode: e.target.value.toUpperCase() })} />
              </label>
            </div>
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
  );
}

/** Slide-over review, mirroring the Hotel Requests decision panel: one mode open at a time. */
function ReviewPanel({ publicId, onClose, onDecided }) {
  const [reg, setReg] = useState(null);
  const [dups, setDups] = useState([]);
  const [mode, setMode] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [r, d] = await Promise.all([
          hotelPartnerService.getRegistration(publicId),
          hotelPartnerService.duplicates(publicId).catch(() => []),
        ]);
        if (!alive) return;
        setReg(r);
        setDups(d || []);
      } catch (err) {
        if (alive) setError(getErrorMessage(err, "Could not load this submission."));
      }
    })();
    return () => { alive = false; };
  }, [publicId]);

  const decide = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      toast.success("Done.");
      onDecided();
      onClose();
    } catch (err) {
      // Kept INSIDE the panel: a 409 the operator cannot see is a button that does nothing.
      setError(getErrorMessage(err, "That did not work."));
    } finally {
      setBusy(false);
    }
  };

  const decidable = reg?.status === "SUBMITTED";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <aside className="h-full w-full max-w-xl overflow-y-auto bg-surface shadow-xl" onClick={(e) => e.stopPropagation()}>
        <header className="sticky top-0 flex items-center gap-3 border-b border-border bg-surface px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-bold text-heading">{reg?.name || "Submission"}</h3>
            {reg && <Chip map={REG_STATUS} value={reg.status} />}
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-surface-hover hover:text-heading">
            <X size={17} />
          </button>
        </header>

        {!reg ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-muted" /></div>
        ) : (
          <div className="space-y-5 px-5 py-4">
            {dups.length > 0 && (
              <div className="rounded-lg bg-hue-amber-soft px-3 py-2 text-sm text-hue-amber">
                <strong>Possible duplicate.</strong> {dups.length} other submission
                {dups.length === 1 ? "" : "s"} share this name and city. Check before approving.
              </div>
            )}

            <Section title="Property">
              <KV k="City" v={[reg.cityName, reg.stateName, reg.countryCode].filter(Boolean).join(", ")} />
              <KV k="Address" v={reg.address} />
              <KV k="Stars" v={reg.stars} />
              <KV k="Guest rating" v={reg.rating} />
              <KV k="Phone" v={reg.phone} />
              <KV k="Email" v={reg.email} />
              <KV k="Website" v={reg.website} />
              <KV k="Map" v={reg.mapUrl} />
              <KV k="Check-in / out" v={[reg.checkInTime, reg.checkOutTime].filter(Boolean).join(" — ")} />
            </Section>

            {reg.overview && <Section title="About"><p className="text-sm text-body">{reg.overview}</p></Section>}

            {reg.images?.length > 0 && (
              <Section title={`Photos (${reg.images.length})`}>
                <div className="grid grid-cols-4 gap-2">
                  {reg.images.map((src, i) => (
                    <img key={i} src={src} alt="" className="h-20 w-full rounded-lg object-cover" />
                  ))}
                </div>
              </Section>
            )}

            {reg.amenities?.length > 0 && (
              <Section title="Amenities">
                <div className="flex flex-wrap gap-1.5">
                  {reg.amenities.map((a) => (
                    <span key={a} className="rounded-md bg-surface-hover px-2 py-0.5 text-xs text-body">{a}</span>
                  ))}
                </div>
              </Section>
            )}

            <Section title={`Rooms & net rates (${reg.rooms?.length ?? 0})`}>
              {(reg.rooms ?? []).map((room) => (
                <div key={room.publicId} className="rounded-lg border border-border p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <BedDouble size={14} className="text-muted" />
                    <span className="font-semibold text-heading">{room.name}</span>
                    <span className="text-xs text-muted">
                      {[room.bedType, room.size].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  <table className="w-full text-xs">
                    <tbody>
                      {(room.rates ?? []).map((rt) => (
                        <tr key={rt.publicId} className="border-t border-border">
                          <td className="py-1.5 text-body">{rt.mealPlanCode}</td>
                          <td className="py-1.5 text-muted">{rt.occupancyBasis?.replace(/_/g, " ").toLowerCase()}</td>
                          <td className="py-1.5 text-muted">
                            {rt.refundable === true ? "Refundable" : rt.refundable === false ? "Non-refundable" : "—"}
                          </td>
                          <td className="py-1.5 text-right font-bold text-heading">
                            {money(rt.netRate, rt.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </Section>

            {error && <p className="rounded-lg bg-hue-rose-soft px-3 py-2 text-sm text-hue-rose">{error}</p>}

            {decidable && (
              <div className="space-y-3 border-t border-border pt-4">
                {!mode ? (
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => decide(() => hotelPartnerService.approve(publicId))} disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-bold text-accent-text hover:bg-accent-hover disabled:opacity-50">
                      {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={15} />} Approve
                    </button>
                    <button onClick={() => { setMode("changes"); setNote(""); }}
                      className="rounded-lg border border-border px-3.5 py-2 text-sm font-semibold text-body hover:bg-surface-hover">
                      Request changes
                    </button>
                    <button onClick={() => { setMode("reject"); setNote(""); }}
                      className="rounded-lg border border-border px-3.5 py-2 text-sm font-semibold text-hue-rose hover:bg-hue-rose-soft">
                      Reject
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-body">
                      {mode === "reject"
                        ? "Why are you rejecting this? The hotel is shown this."
                        : "What should they change? The hotel is shown this and can edit again."}
                    </p>
                    <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading outline-none focus:ring-2 focus:ring-focus" />
                    <div className="flex gap-2">
                      <button disabled={busy || !note.trim()}
                        onClick={() => decide(() =>
                          mode === "reject"
                            ? hotelPartnerService.reject(publicId, note)
                            : hotelPartnerService.requestChanges(publicId, note))}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-bold text-accent-text hover:bg-accent-hover disabled:opacity-50">
                        {busy && <Loader2 size={14} className="animate-spin" />}
                        {mode === "reject" ? "Reject" : "Send back"}
                      </button>
                      <button onClick={() => setMode("")}
                        className="rounded-lg border border-border px-3.5 py-2 text-sm font-semibold text-body hover:bg-surface-hover">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted">
                  Approving creates a <strong>draft</strong> hotel in the catalog. It stays invisible to
                  tenants until you publish it from Hotel Catalog.
                </p>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-bold uppercase tracking-wide text-muted">{title}</h4>
      {children}
    </section>
  );
}

function KV({ k, v }) {
  if (v === null || v === undefined || v === "") return null;
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-32 shrink-0 text-muted">{k}</span>
      <span className="min-w-0 flex-1 break-words text-body">{String(v)}</span>
    </div>
  );
}
