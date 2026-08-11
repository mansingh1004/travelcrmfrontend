import { useCallback, useEffect, useState } from "react";
import {
  Building2, Check, ExternalLink, Globe, Loader2, Mail, MapPin, Phone, RefreshCw, User, X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@shared/ui/toast";
import { getErrorMessage } from "@shared/api/apiError";
import { hotelNominationService } from "../api/marketplaceAdminService";

/**
 * Hotels the tenants have proposed for the marketplace catalog — the step BEFORE a partner invite.
 *
 * The backend for this has existed for a while (`HotelNominationAdminController`: list, open-count,
 * review, accept, reject) and so has the console API client, but no screen ever consumed them. A
 * tenant nominated a property and it went nowhere anyone could see. This is that screen.
 *
 * Accepting does NOT create a catalog hotel. It sends the property a partner invitation, and the
 * hotel then fills in its own details and rate card — so the commercial terms come from the property
 * rather than from the tenant's guess at them. Once accepted the nomination carries the invite's
 * publicId, which is what lets the Hotel partners screen pick the story up from there.
 *
 * Console SEMANTIC tokens only (bg-surface / text-heading / bg-accent), never raw slate/blue —
 * those utilities resolve only inside `.sa-console`.
 */

const fmtDate = (s) => (s ? new Date(s).toLocaleString() : "—");

const STATUS = {
  PENDING:      { label: "Pending review", cls: "bg-amber-500/15 text-amber-600" },
  UNDER_REVIEW: { label: "Under review",   cls: "bg-accent-soft text-accent-soft-text" },
  INVITED:      { label: "Invited",        cls: "bg-emerald-500/15 text-emerald-600" },
  REJECTED:     { label: "Rejected",       cls: "bg-rose-500/15 text-rose-600" },
  WITHDRAWN:    { label: "Withdrawn",      cls: "bg-surface-hover text-muted" },
};

function Chip({ value }) {
  const c = STATUS[value] ?? { label: value ?? "—", cls: "bg-surface-hover text-muted" };
  return (
    <span className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${c.cls}`}>
      {c.label}
    </span>
  );
}

/* Two open states, not one: PENDING means nobody has looked, UNDER_REVIEW means somebody is on it.
   Collapsing them is how two SuperAdmins end up emailing the same hotel. */
const TABS = [
  { key: "PENDING",      label: "New" },
  { key: "UNDER_REVIEW", label: "Being worked" },
  { key: "INVITED",      label: "Invited" },
  { key: "REJECTED",     label: "Rejected" },
  { key: "",             label: "All" },
];

export default function HotelNominations() {
  const [tab, setTab] = useState("PENDING");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { items } = await hotelNominationService.list({ status: tab || undefined, size: 50 });
      setRows(items);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not load nominations."));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-extrabold text-heading">Hotel nominations</h1>
          <p className="mt-0.5 text-sm text-body">
            Properties your tenants want in the catalog. Accepting one invites the hotel to register
            itself — it does not add a hotel on their behalf.
          </p>
        </div>
        <button onClick={load}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-body hover:bg-surface-hover">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </header>

      <section className="rounded-2xl border border-border bg-surface shadow-[var(--sa-card-shadow)]">
        <div className="flex flex-wrap gap-1 border-b border-border px-3 pt-3">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => { setTab(t.key); setOpenId(null); }}
              className={`rounded-t-lg px-3 py-2 text-sm font-semibold transition ${
                tab === t.key ? "bg-accent-soft text-accent-soft-text" : "text-muted hover:text-heading"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted" /></div>
        ) : rows.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted">
            {tab === "PENDING" ? "No new nominations." : "Nothing here."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((n) => (
              <li key={n.publicId}>
                <button onClick={() => setOpenId(n.publicId === openId ? null : n.publicId)}
                  className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-surface-hover">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-bold text-heading">{n.hotelName || "Unnamed property"}</span>
                      <Chip value={n.status} />
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={11} /> {[n.cityName, n.countryCode].filter(Boolean).join(", ") || "—"}
                      </span>
                      {/* Which tenant asked matters: a property three tenants have nominated is a
                          different decision from one a single agency wants. */}
                      <span className="inline-flex items-center gap-1">
                        <Building2 size={11} /> {n.tenantName || n.tenantCode || "—"}
                      </span>
                      <span>Proposed {fmtDate(n.createdAt)}</span>
                    </div>
                  </div>
                </button>

                {openId === n.publicId && (
                  <NominationDetail nomination={n} onDone={() => { setOpenId(null); load(); }} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function NominationDetail({ nomination: n, onDone }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState("");
  const [mode, setMode] = useState("");     // "" | "accept" | "reject"
  const [note, setNote] = useState("");

  const decided = n.status === "INVITED" || n.status === "REJECTED" || n.status === "WITHDRAWN";

  const run = async (kind, fn, successMsg) => {
    setBusy(kind);
    try {
      await fn();
      toast.success(successMsg);
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err, "That did not go through."));
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="border-t border-border bg-surface-hover/40 px-5 py-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2 text-sm">
          <Row icon={User} label="Contact" value={n.contactName} />
          <Row icon={Mail} label="Email" value={n.contactEmail} />
          <Row icon={Phone} label="Phone" value={n.contactPhone} />
          <Row icon={Globe} label="Website" value={n.website} />
          <Row icon={MapPin} label="Address" value={n.address} />
        </div>
        <div className="space-y-3">
          {n.tenantNote && (
            <div>
              {/* The single most decision-relevant field: why this agency wants the property and
                  what volume they do there. */}
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Why they want it</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-body">{n.tenantNote}</p>
            </div>
          )}
          {decided && (
            <div className="rounded-lg border border-border bg-surface px-3 py-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Decision</p>
              <p className="mt-0.5 text-sm text-body">
                {n.decisionReason || "—"}
                <span className="ml-2 text-xs text-muted">{fmtDate(n.reviewedAt)}</span>
              </p>
              {/* The whole point of invitePublicId: the story continues on another screen and the
                  operator should not have to go looking for it. */}
              {n.invitePublicId && (
                <button
                  onClick={() => navigate("/console/hotel-partners")}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-accent hover:underline"
                >
                  <ExternalLink size={12} /> Open the invite this produced
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {!decided && (
        <div className="mt-4 border-t border-border pt-3">
          {mode === "" ? (
            <div className="flex flex-wrap gap-2">
              {n.status === "PENDING" && (
                <button
                  disabled={!!busy}
                  onClick={() => run("review", () => hotelNominationService.review(n.publicId),
                    "Marked as under review.")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-body hover:bg-surface-hover disabled:opacity-50"
                >
                  {busy === "review" ? <Loader2 size={13} className="animate-spin" /> : null}
                  I'm looking at this
                </button>
              )}
              <button
                disabled={!!busy}
                onClick={() => { setMode("accept"); setNote(""); }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-sm font-bold text-accent-text hover:bg-accent-hover disabled:opacity-50"
              >
                <Check size={14} /> Accept &amp; invite the hotel
              </button>
              <button
                disabled={!!busy}
                onClick={() => { setMode("reject"); setNote(""); }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-body hover:bg-surface-hover disabled:opacity-50"
              >
                <X size={14} /> Reject
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-body">
                {mode === "reject"
                  /* Tenant-visible on purpose — a rejection nobody can read is one the tenant
                     simply re-sends next month. */
                  ? "Why are you rejecting this? The tenant is shown this."
                  : "Anything to add to the invitation? Optional."}
              </p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                autoFocus
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus"
                placeholder={mode === "reject" ? "Already have two properties on this street…" : ""}
              />
              <div className="flex gap-2">
                <button
                  disabled={!!busy || (mode === "reject" && !note.trim())}
                  onClick={() => run(
                    mode,
                    () => (mode === "reject"
                      ? hotelNominationService.reject(n.publicId, note.trim())
                      : hotelNominationService.accept(n.publicId, note.trim() || undefined)),
                    mode === "reject" ? "Nomination rejected." : "Invitation sent to the hotel.",
                  )}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-sm font-bold text-accent-text hover:bg-accent-hover disabled:opacity-50"
                >
                  {busy ? <Loader2 size={13} className="animate-spin" /> : null}
                  {mode === "reject" ? "Reject" : "Send the invitation"}
                </button>
                <button
                  onClick={() => setMode("")}
                  className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-body hover:bg-surface-hover"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-baseline gap-2">
      <Icon size={12} className="mt-0.5 shrink-0 text-muted" />
      <span className="w-20 shrink-0 text-xs text-muted">{label}</span>
      <span className="min-w-0 flex-1 break-words text-heading">{value || "—"}</span>
    </div>
  );
}
