// src/features/leads/components/LeadAlertRow.jsx
//
// One lead in the incoming table.
//
// A real <tr> inside the page's <table>, sharing AllLeads.jsx's cell chrome (the TD constant, the
// 3px left accent on the first cell, the hover tint) so the two lead tables rule and hover alike.
// The accent carries the SOURCE colour here, where AllLeads uses it for stage.
//
// MEMOISED, and that is load-bearing. The provider re-renders every second to move the countdowns;
// without memo a 200-row feed would re-render 200 rows a second. `secondsLeft` is compared as a
// primitive so the check below is a number comparison, not a deep object walk.

import { memo } from "react";
import { formatMoney, paxSummary, formatClock, sourceStyle } from "../lib/leadAlertConstants";
import {
  Avatar,
  Btn,
  COLUMNS,
  IconBtn,
  LockedChip,
  OwnerCell,
  QuickActions,
  ReopenedChip,
  Sla,
  SourceCell,
  TD,
} from "./leadAlertUi";

function LeadAlertRow({
  lead,
  isMine,
  canClaim,
  canContact,
  canReassign,
  onClaim,
  onContact,
  onHistory,
  onFocus,
  onToggleExpand,
  /** Set while THIS row has an action in flight, so only its own buttons show a pending state. */
  busy,
  /** Normalised claim failure — see claimFailure(). Explained here, never in a toast. */
  failure,
  /** True once a terminal failure has been read and the row is on its way out. */
  fading,
  focused,
  expanded,
  index,
}) {
  const { color } = sourceStyle(lead.sourceKey, lead.source);
  const locked = !lead.openToClaim;
  const late = lead.secondsLeft != null && lead.secondsLeft <= 0;
  // Stamped by the provider from actorName on a lead-alert event — a reopen re-broadcasts under the
  // same event name as a new lead, and actorName is the only field that separates them. It is NOT
  // derived from firstResponseSeconds: LeadAlertDto does not carry that field at all, so the old
  // check was always false and this chip never rendered.
  const reopened = !locked && !!lead.reopened;
  const money = formatMoney(lead.value);
  const pax = paxSummary(lead);

  // Colour is reserved for the exceptional. An ordinary open lead gets the plain hover tint, so a
  // tinted row genuinely means "look at this one".
  const rowTone = fading
    ? "opacity-40"
    : focused
      ? "bg-blue-50/80"
      : late
        ? "bg-red-50/40 hover:bg-red-50/70"
        : "hover:bg-slate-50/70";

  return (
    <>
      <tr
        tabIndex={focused ? 0 : -1}
        data-lead-row={lead.leadPublicId}
        onFocus={onFocus}
        onClick={onFocus}
        className={`border-t border-slate-100 outline-none transition-colors ${rowTone}`}
        style={{ animation: "fadeUp .35s ease both", animationDelay: `${Math.min(index, 12) * 25}ms` }}
      >
        {/* Lead — carries the source accent, exactly where AllLeads carries its stage accent */}
        <td className={TD} style={{ borderLeft: `3px solid ${locked ? "#94a3b8" : color}` }}>
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar name={lead.customerName} />
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={onToggleExpand}
                  aria-expanded={!!expanded}
                  className="block max-w-full truncate text-left text-sm font-bold capitalize text-blue-600 hover:text-blue-700"
                >
                  {lead.customerName || "Unnamed enquiry"}
                </button>
                {locked ? <LockedChip label={lead.leadStage || "Contacted"} /> : null}
                {reopened ? <ReopenedChip /> : null}
              </div>
              {/* leadCode is null on un-backfilled rows — render nothing, not an em dash. */}
              {lead.leadCode ? (
                <div className="mt-0.5 truncate font-mono text-[10px] font-bold text-slate-400">
                  {lead.leadCode}
                </div>
              ) : null}
            </div>
          </div>
        </td>

        <td className={TD}>
          <SourceCell sourceKey={lead.sourceKey} source={lead.source} />
        </td>

        {/* destination is null when depart city was blank or literally "Not Specified" */}
        <td className={TD}>
          <div className="truncate text-xs font-semibold text-slate-600">{lead.destination || "—"}</div>
          {pax ? <div className="mt-0.5 truncate text-[10px] text-slate-400">{pax}</div> : null}
        </td>

        {/* Null value renders as the muted dash AllLeads uses, never ₹0 */}
        <td className={`${TD} text-right`}>
          <span
            className={`text-sm font-extrabold tabular-nums ${money ? "text-slate-800" : "text-slate-300"}`}
          >
            {money || "—"}
          </span>
        </td>

        <td className={TD}>
          <OwnerCell ownerName={lead.ownerName} isYou={isMine} />
        </td>

        <td className={`${TD} text-right`}>
          <Sla
            secondsLeft={lead.secondsLeft}
            targetSeconds={lead.slaTargetSeconds}
            firstResponseSeconds={lead.firstResponseSeconds}
          />
        </td>

        {/* Actions sit in one fixed-width column so the Claim button is in the same x-position on
            every row — it is a target zone, and a shifting target costs seconds. */}
        <td className={`${TD} text-right`}>
          <div className="inline-flex items-center gap-1.5">
            <QuickActions phone={lead.phone} customerName={lead.customerName} />

            {canReassign || locked ? (
              <IconBtn onClick={onHistory} title="Ownership history" aria-label="Ownership history">
                <span aria-hidden="true" className="text-sm leading-none">⋯</span>
              </IconBtn>
            ) : null}

            {/*
              Claim is HIDDEN, not disabled, when it cannot apply. A permanently dead button on
              every row is noise. It disappears for a locked lead (the backend refuses it anyway)
              and for a lead this user already owns — claiming your own lead is a server no-op that
              bumps no version and fires no event, so two tabs would silently fight over it.
            */}
            {!locked && canClaim && !isMine ? (
              <Btn variant="primary" onClick={onClaim} disabled={!!busy}>
                {busy === "claim" ? "Claiming…" : failure?.retryable ? "Claim anyway" : "Claim"}
              </Btn>
            ) : null}

            {!locked && canContact ? (
              <Btn
                variant="success"
                onClick={onContact}
                disabled={!!busy}
                data-contact-btn={lead.leadPublicId}
              >
                {busy === "contact" ? "Saving…" : "Mark Contacted"}
              </Btn>
            ) : null}
          </div>
        </td>
      </tr>

      {/*
        A failed action, and the expanded detail, are explained ON THE ROW.
        The shared toast host dedupes identical text inside 4s and expires at 6s, so the answer
        would be gone before the operator looked back at the list — and the answer is inherently
        positional: who has THIS lead, on THIS line.
      */}
      {failure || expanded ? (
        <tr className={`${fading ? "opacity-40" : ""} ${late ? "bg-red-50/40" : "bg-slate-50/60"}`}>
          <td colSpan={COLUMNS.length} className="px-4 pb-2.5 pt-0" style={{ borderLeft: "3px solid transparent" }}>
            {failure ? (
              <p
                className={`pl-11 text-[11.5px] font-bold ${
                  failure.retryable || failure.reason === "INELIGIBLE"
                    ? "text-amber-700"
                    : "text-slate-500"
                }`}
              >
                {failure.message}
              </p>
            ) : null}

            {expanded ? (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1 pl-11 pt-1.5 sm:grid-cols-4">
                <Detail label="Phone" value={lead.phone} />
                <Detail label="Stage" value={lead.leadStage} />
                <Detail label="Received" value={formatClock(lead.createdAt, true)} />
                {/* previousOwnerName / actorName are event-only — null on rows loaded from the feed
                    — so this line shows on live-updated rows and not after a reconnect. */}
                <Detail
                  label="Last move"
                  value={
                    lead.actorName
                      ? `${lead.previousOwnerName ? `from ${lead.previousOwnerName} ` : ""}by ${lead.actorName}`
                      : null
                  }
                />
              </dl>
            ) : null}
          </td>
        </tr>
      ) : null}
    </>
  );
}

function Detail({ label, value }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="truncate text-[11.5px] font-semibold text-slate-700">{value}</dd>
    </div>
  );
}

export default memo(LeadAlertRow, (a, b) => {
  const x = a.lead;
  const y = b.lead;
  return (
    x.leadPublicId === y.leadPublicId &&
    x.secondsLeft === y.secondsLeft &&
    x.claimVersion === y.claimVersion &&
    x.ownerName === y.ownerName &&
    x.openToClaim === y.openToClaim &&
    x.leadStage === y.leadStage &&
    x.firstResponseSeconds === y.firstResponseSeconds &&
    a.isMine === b.isMine &&
    a.busy === b.busy &&
    a.failure === b.failure &&
    a.fading === b.fading &&
    a.focused === b.focused &&
    a.expanded === b.expanded &&
    a.canClaim === b.canClaim &&
    a.canContact === b.canContact &&
    a.canReassign === b.canReassign &&
    a.index === b.index
  );
});
