// src/features/leads/components/LeadHistoryDrawer.jsx
//
// Ownership history, and the two manager actions that had no home until now.
//
// WHY THIS EXISTS. Three service methods were written and wired and then called by nothing:
// getAssignmentHistory, reassign and reopenClaim. LEAD_REASSIGN_LOCKED gated no pixel in the whole
// product. And one real state — "contacted by Rakesh while still owned by Priya" — is invisible on
// every other screen, because the plain lead payload carries firstContactedAt but not who stamped
// it. Only the history endpoint can tell that story.
//
// A DRAWER, not a modal: the queue behind it is the operator's context and must stay on screen. Not
// an inline expansion either — it opens from three different lists.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { toast } from "@shared/ui/toast";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { leadAlertService, claimFailure } from "../api/leadAlertService";
import { formatClock, formatDuration } from "../lib/leadAlertConstants";
import { Btn, IconBtn, LockedChip } from "./leadAlertUi";

/** Section label — the house's uppercase micro-heading. */
const LABEL = "text-[10px] font-bold uppercase tracking-widest text-slate-400";

/** House control shape: rounded-xl, blue focus ring. Same as the AllLeads custom-date inputs. */
const CONTROL =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-50";

/**
 * eventType and strategyUsed arrive as raw ENUM NAMES, unlike leadStage which arrives as a display
 * name. Two conventions on one payload, so both need their own map.
 */
const EVENT = {
  AUTO_ASSIGNED: { label: "Auto-assigned", dot: "bg-slate-400" },
  CLAIMED: { label: "Claimed", dot: "bg-blue-500" },
  CONTACTED: { label: "Contacted", dot: "bg-emerald-500" },
  REASSIGNED: { label: "Reassigned", dot: "bg-amber-500" },
  REOPENED: { label: "Claim window reopened", dot: "bg-violet-500" },
};

const STRATEGY = {
  LOAD_BASED: "Load balanced",
  ROUND_ROBIN: "Round robin",
  SELF: "Self",
  MANUAL: "Manual",
};

/** One line describing what actually moved. CONTACTED and REOPENED change no ownership at all. */
function eventDetail(e) {
  switch (e.eventType) {
    case "AUTO_ASSIGNED":
      return e.toUserName ? `to ${e.toUserName}` : null;
    case "CLAIMED":
      return [e.actorName ? `by ${e.actorName}` : null, e.fromUserName ? `from ${e.fromUserName}` : null]
        .filter(Boolean)
        .join(" · ");
    case "REASSIGNED":
      return [
        e.fromUserName && e.toUserName ? `${e.fromUserName} → ${e.toUserName}` : null,
        e.actorName ? `by ${e.actorName}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
    default:
      return e.actorName ? `by ${e.actorName}` : null;
  }
}

export default function LeadHistoryDrawer({ lead, canReassign, onClose, onChanged }) {
  const [events, setEvents] = useState(null);
  const [pool, setPool] = useState(null);
  // Distinct from an empty pool: a manager who holds reassign but not create is REFUSED the list,
  // which is a real, expected state and not a fault.
  const [poolDenied, setPoolDenied] = useState(false);
  const [panel, setPanel] = useState(null); // "reassign" | "reopen"
  const [assignee, setAssignee] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [inlineError, setInlineError] = useState(null);

  const closeRef = useRef(null);
  const publicId = lead?.leadPublicId;
  const locked = lead ? !lead.openToClaim : false;
  // The backend refuses a reopen from anything past Contacted, naming the stage it found.
  const canReopen = locked && lead?.leadStage === "Contacted";

  useEffect(() => {
    if (!publicId) return undefined;
    let alive = true;
    setEvents(null);
    leadAlertService
      .getAssignmentHistory(publicId)
      .then((rows) => alive && setEvents(rows))
      .catch(() => alive && setEvents([]));
    return () => {
      alive = false;
    };
  }, [publicId]);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (panel) setPanel(null);
        else onClose();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [panel, onClose]);

  const openReassign = useCallback(() => {
    setPanel("reassign");
    setInlineError(null);
    if (pool || poolDenied) return;
    leadAlertService
      .getAssignmentPool()
      .then(setPool)
      .catch(() => setPoolDenied(true));
  }, [pool, poolDenied]);

  const submit = useCallback(
    async (kind) => {
      setSaving(true);
      setInlineError(null);
      try {
        const result =
          kind === "reassign"
            ? await leadAlertService.reassign(publicId, assignee, note || undefined)
            : await leadAlertService.reopenClaim(publicId, note || undefined);
        onChanged?.(result);
        toast.success(kind === "reassign" ? "Lead reassigned" : "Claim window reopened");
        onClose();
      } catch (err) {
        // Two 409 shapes land here: a lost race carries details.claimLost, a refused reopen carries
        // nothing but a message. claimFailure() flattens both; anything else is a genuine fault.
        const failure = claimFailure(err);
        if (failure) setInlineError(failure.message);
        else if (!isAlreadyReported(err)) setInlineError(getErrorMessage(err, "Could not save that."));
      } finally {
        setSaving(false);
      }
    },
    [publicId, assignee, note, onChanged, onClose]
  );

  if (!lead) return null;

  const eligible = pool?.eligibleUsers ?? [];

  return createPortal(
    <div className="fixed inset-0 z-[130]">
      <div
        className="absolute inset-0 bg-slate-900/20"
        onClick={onClose}
        role="presentation"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Ownership history — ${lead.customerName || lead.leadCode || "lead"}`}
        className="absolute inset-y-0 right-0 flex w-[480px] max-w-full flex-col border-l border-slate-200/60 bg-white shadow-2xl"
        style={{ animation: "slideIn .25s ease both" }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-extrabold capitalize text-slate-800">
                {lead.customerName || "Unnamed enquiry"}
              </h2>
              {lead.leadCode ? (
                <span className="font-mono text-[10px] font-bold text-slate-400">{lead.leadCode}</span>
              ) : null}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
              <span>
                Owner <b className="font-bold text-slate-700">{lead.ownerName || "—"}</b>
              </span>
              {locked ? <LockedChip label={lead.leadStage || "Contacted"} /> : null}
              {lead.firstResponseSeconds != null ? (
                <span>answered in {formatDuration(lead.firstResponseSeconds)}</span>
              ) : null}
            </div>
          </div>
          <IconBtn onClick={onClose} ref={closeRef} aria-label="Close">
            <X size={14} />
          </IconBtn>
        </div>

        {/* slideIn is defined page-locally by AllLeads; the drawer can portal onto any route, so it
            carries its own copy rather than depending on whatever page is mounted behind it. */}
        <style>{`@keyframes slideIn { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }`}</style>

        {/* Timeline */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className={LABEL}>Ownership</div>

          {events == null ? (
            <div className="mt-3 space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-slate-100" />
              ))}
            </div>
          ) : events.length === 0 ? (
            // Legitimate, not an error: the auto-assign row is written best-effort in its own
            // transaction, so a timeline can start at CLAIMED or be missing entirely.
            <p className="mt-3 text-[12.5px] text-slate-500">
              No ownership history recorded for this lead.
            </p>
          ) : (
            <ol className="mt-3 space-y-3.5 border-l border-slate-200 pl-4">
              {/* Rendered in the array's order. NEVER re-sorted by occurredAt — the backend orders
                  by row id precisely because a claim and the contact after it can share a second. */}
              {events.map((e) => {
                const meta = EVENT[e.eventType] || { label: e.eventType, dot: "bg-slate-400" };
                const detail = eventDetail(e);
                return (
                  <li key={e.id} className="relative">
                    <span
                      className={`absolute -left-[21px] top-1.5 h-2 w-2 rounded-full ring-2 ring-white ${meta.dot}`}
                    />
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[12.5px] font-medium text-slate-900">{meta.label}</span>
                      {e.strategyUsed ? (
                        <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-px text-[10.5px] text-slate-500">
                          {STRATEGY[e.strategyUsed] || e.strategyUsed}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[12px] text-slate-500">
                      {[detail, formatClock(e.occurredAt, true)].filter(Boolean).join(" · ")}
                    </div>
                    {e.note ? (
                      <div className="mt-0.5 text-[12px] italic text-slate-500">“{e.note}”</div>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/*
          Manager actions — gated on the PERMISSION only, deliberately not on `locked`.
          The drawer's live caller is the claim queue, and every row there is by definition still
          open, so an extra `locked` condition made this entire block unreachable and left
          LEAD_REASSIGN_LOCKED gating nothing anywhere in the product. The backend is the real
          guard: reassigning an open lead answers 409 NOT_LOCKED with copy telling the user to claim
          it instead, which the inline error below renders. Reopen still hides unless the stage is
          exactly Contacted, because the backend refuses that with a differently-shaped 409 that
          carries no claimLost block.
        */}
        {canReassign ? (
          <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4">
            {panel === null ? (
              <div className="flex flex-wrap items-center gap-2">
                <Btn onClick={openReassign}>Reassign…</Btn>
                {canReopen ? <Btn onClick={() => setPanel("reopen")}>Reopen claim window</Btn> : null}
                {!locked ? (
                  <span className="text-[11px] font-semibold text-slate-400">
                    still open — claiming is how this one moves
                  </span>
                ) : null}
              </div>
            ) : null}

            {panel === "reassign" ? (
              <div className="space-y-2.5">
                <div className={LABEL}>Reassign to</div>

                {poolDenied ? (
                  // Expected for a manager who holds LEAD_REASSIGN_LOCKED but not LEAD_CREATE — the
                  // pool endpoint is gated on the wrong permission. Degrade, do not toast, do not retry.
                  <p className="text-[12.5px] text-amber-800">
                    Reassign is unavailable — your account cannot load the agent list. Ask an
                    administrator.
                  </p>
                ) : (
                  <select
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                    className={`${CONTROL} cursor-pointer font-medium`}
                  >
                    <option value="">{pool ? "Choose an agent" : "Loading…"}</option>
                    {eligible.map((u) => (
                      <option key={u.id} value={u.id}>
                        {/* Workload is the whole reason a manager is picking manually. */}
                        {u.name}
                        {u.activeLeads != null ? ` — ${u.activeLeads} active` : ""}
                      </option>
                    ))}
                  </select>
                )}

                <NoteField note={note} setNote={setNote} />
                {inlineError ? <p className="text-[12px] text-amber-800">{inlineError}</p> : null}

                <div className="flex gap-2">
                  <Btn
                    variant="primary"
                    disabled={saving || !assignee || poolDenied}
                    onClick={() => submit("reassign")}
                  >
                    {saving ? "Saving…" : "Reassign"}
                  </Btn>
                  <Btn onClick={() => setPanel(null)}>Cancel</Btn>
                </div>
              </div>
            ) : null}

            {panel === "reopen" ? (
              <div className="space-y-2.5">
                <p className="text-[12.5px] text-slate-600">
                  This puts the lead back in the claim pool and resets its stage to New Lead. The
                  recorded first-response time is kept.
                </p>
                <NoteField note={note} setNote={setNote} />
                {inlineError ? <p className="text-[12px] text-amber-800">{inlineError}</p> : null}
                <div className="flex gap-2">
                  <Btn variant="primary" disabled={saving} onClick={() => submit("reopen")}>
                    {saving ? "Saving…" : "Reopen claim window"}
                  </Btn>
                  <Btn onClick={() => setPanel(null)}>Cancel</Btn>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </aside>
    </div>,
    document.body
  );
}

/** Free text for the audit trail. The server truncates at 255; warn before it silently cuts. */
function NoteField({ note, setNote }) {
  return (
    <div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 255))}
        placeholder="Note for the history (optional)"
        maxLength={255}
        className={CONTROL}
      />
      {note.length > 200 ? (
        <div className="mt-0.5 text-right text-[10px] font-bold text-slate-400 tabular-nums">
          {note.length}/255
        </div>
      ) : null}
    </div>
  );
}
