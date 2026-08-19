// features/operations/components/OpsCheckpointPanel.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The nine checkpoints, and the only place they are moved.
//
// WHY THIS IS NOT THE SERVICE-LINE LIST BESIDE IT. A service line is something the
// customer bought; a checkpoint is something that must be true before the party can
// leave. Most of the time they line up — a hotel line and the HOTEL checkpoint — but
// four of the nine have no line to sit on at all: vouchers, the trip advance, the
// vendor payment, the pre-departure call. Those are exactly the ones that get
// forgotten, which is the whole reason the checkpoint model exists.
//
// TWO MODELS ON SCREEN AT ONCE, deliberately. The cards below still render the
// derived readiness map, and this panel renders what somebody recorded. They can
// disagree. Where they do, this one is the human answer — but the derived one is the
// ONLY answer on any booking confirmed before the model shipped, so this panel
// renders nothing rather than an empty shell when there is no record.
//
// Money is absent on purpose, matching OpsRowDetail: line costs sit behind
// BOOKING_PROFIT_READ, and confirming a room must not require it.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldCheck, TriangleAlert } from "lucide-react";

import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { toast } from "@shared/ui/toast";
import { hasPermission, P } from "@shared/lib/access";

import { Badge, SeverityBadge, DepartureCountdown } from "./opsUi";
import operationsService from "../api/operationsService";

/**
 * The statuses a human may set, in the order the work actually moves.
 *
 * NOT_APPLICABLE is offered because "this trip has no sightseeing" is a real answer and
 * the alternative is an amber checkpoint nobody can ever close. BLOCKED is offered
 * because the honest state of a visa the consulate has sat on is not "pending".
 */
const STATUSES = [
  { value: "PENDING", label: "Pending" },
  { value: "REQUESTED", label: "Requested" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "REJECTED", label: "Rejected" },
  { value: "EXPIRED", label: "Expired" },
  { value: "BLOCKED", label: "Blocked" },
  { value: "NOT_APPLICABLE", label: "Not applicable" },
];

const STATUS_TONE = {
  CONFIRMED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REQUESTED: "bg-sky-50 text-sky-700 border-sky-200",
  REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
  EXPIRED: "bg-rose-50 text-rose-700 border-rose-200",
  BLOCKED: "bg-rose-50 text-rose-700 border-rose-200",
  NOT_APPLICABLE: "bg-slate-50 text-slate-400 border-slate-200",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
};

const fmtWhen = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
      })
    : null;

export default function OpsCheckpointPanel({ bookingPublicId, onChanged }) {
  // OPS_MANAGE, not BOOKING_UPDATE. The server draws the same line and an operations
  // executive is expected to hold one without the other — gating on the wrong key here
  // would show controls that 403 on click.
  const canWrite = hasPermission(P.OPS_MANAGE);

  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    if (!bookingPublicId) return;
    setLoading(true);
    try {
      setRecord(await operationsService.checkpoints(bookingPublicId));
    } catch (err) {
      // A missing record is null, not an error — but a genuine failure must not masquerade
      // as "this booking predates the model", so it is logged and the panel stays absent.
      if (!isAlreadyReported(err)) console.warn("Ops checkpoints failed", err);
      setRecord(null);
    } finally {
      setLoading(false);
    }
  }, [bookingPublicId]);

  useEffect(() => { load(); }, [load]);

  /**
   * Move one checkpoint.
   *
   * `expectedRowVersion` makes every write optimistic-locked. A 409 here is not a bug and
   * not the user's fault — somebody else moved the same checkpoint while this panel was
   * open — and per the app's error policy a 409 is SILENT at the interceptor, so it has to
   * be said here or it is said nowhere.
   */
  const patch = async (checkpoint, body) => {
    if (!canWrite) return;
    setBusyId(checkpoint.publicId);
    try {
      const updated = await operationsService.updateCheckpoint(checkpoint.publicId, {
        ...body,
        expectedRowVersion: checkpoint.rowVersion,
      });
      // Replace from the server's answer rather than merging the patch: severity,
      // readyToTravel and the record's own counters all move with a checkpoint, and only
      // a reload gets those right. Cheap — it is one booking.
      if (updated) await load();
      onChanged?.();
    } catch (err) {
      if (err?.response?.status === 409) {
        toast("Somebody else changed this checkpoint just now — reloading.", "error");
        await load();
      } else if (!isAlreadyReported(err)) {
        toast(getErrorMessage(err, "Could not update the checkpoint."), "error");
      }
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <p className="text-xs font-bold text-slate-400 pb-3">Loading checkpoints…</p>
    );
  }

  // The ordinary "no record" case: confirmed before the checkpoint model shipped, or still
  // PENDING. Rendering nothing is correct — the derived readiness cards below are the
  // answer for those bookings, and an empty checkpoint panel would read as "nothing is
  // arranged" rather than "this booking is not on the new model".
  if (!record) return null;

  const checkpoints = record.checkpoints ?? [];

  return (
    <div className="bg-white rounded-xl border border-slate-200/70 mb-3 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-3 py-2 border-b border-slate-100">
        <p className="text-xs font-extrabold text-slate-700">Checkpoints</p>
        <SeverityBadge severity={record.severity} />
        <DepartureCountdown
          hours={record.hoursToDeparture}
          sourceLabel={record.departureAtSourceLabel}
        />
        {record.readyToTravel ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700">
            <ShieldCheck className="w-3.5 h-3.5" /> READY TO TRAVEL
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-700">
            <TriangleAlert className="w-3.5 h-3.5" /> MANDATORY WORK OPEN
          </span>
        )}
        {/* The departure's provenance, spelled out once here rather than only as a tooltip
            on the chip. "assumed" means nobody agreed this hour with anybody. */}
        {record.departureAtSourceLabel && (
          <span className="ml-auto text-[10px] font-bold text-slate-400">
            Departure {fmtWhen(record.departureAt) ?? "not set"} · {record.departureAtSourceLabel}
          </span>
        )}
      </div>

      <ul className="divide-y divide-slate-50">
        {checkpoints.map((c) => {
          const busy = busyId === c.publicId;
          const dim = c.status === "NOT_APPLICABLE";
          return (
            <li
              key={c.publicId}
              className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 ${dim ? "opacity-60" : ""}`}
            >
              <span className="w-9 shrink-0 text-[9px] font-extrabold text-slate-400">
                {c.shortCode}
              </span>
              <span className="w-32 shrink-0 text-xs font-bold text-slate-700 truncate">
                {c.label}
                {/* Optional is worth saying, because it is the difference between a
                    checkpoint that stops the trip and one that does not. */}
                {!c.mandatory && (
                  <span className="ml-1 text-[9px] font-bold text-slate-400">opt</span>
                )}
              </span>

              <select
                value={c.status}
                disabled={!canWrite || busy}
                onChange={(e) => patch(c, { status: e.target.value })}
                className={`text-[11px] font-bold px-2 py-1 rounded-lg border outline-none disabled:opacity-60 ${
                  STATUS_TONE[c.status] ?? STATUS_TONE.PENDING
                }`}
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>

              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}

              {/* Who is on the hook, if anybody has been named. `sourceLabel` is the
                  evidentiary standard — a platform confirmation and a phone call are not
                  the same green dot, and this is where that difference is legible. */}
              {c.sourceLabel && <Badge tone="slate">{c.sourceLabel}</Badge>}
              {c.vendorName && (
                <span className="text-[11px] font-bold text-slate-600 truncate max-w-[160px]">
                  {c.vendorName}
                </span>
              )}
              {c.confirmationNumber && (
                <span className="text-[10px] font-mono text-slate-500">#{c.confirmationNumber}</span>
              )}

              {/* A hold's cut-off, counted forward. This is the column the derived model
                  cannot have: booking_service_items.release_date is a DATE, so "expires at
                  the 18:00 cut-off" was unsayable. */}
              {c.dueAt && (
                <span className="text-[10px] font-bold text-amber-600">
                  due {fmtWhen(c.dueAt)}
                </span>
              )}

              {/* Why the planner put it in this state. Only shown when nobody has written a
                  note of their own — a human's note always outranks a derivation. */}
              <span className="ml-auto text-[10px] text-slate-400 truncate max-w-[220px]">
                {c.note || c.derivationNote || ""}
              </span>
            </li>
          );
        })}
      </ul>

      {!canWrite && (
        <p className="px-3 py-2 text-[10px] font-bold text-slate-400 border-t border-slate-100">
          Read-only — working checkpoints needs the Operations permission.
        </p>
      )}
    </div>
  );
}
