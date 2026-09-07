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
import { useCallback, useEffect, useRef, useState } from "react";
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

/**
 * Where the work is being arranged from — the field that made CONFIRMED unreachable.
 *
 * A checkpoint provisioned NOT_SOURCED cannot be confirmed (OpsCheckpointTransitions.confirmBlocker,
 * and ck_ops_checkpoint_confirmed_has_source in the database), and the planner provisions TRANSPORT,
 * SIGHTSEEING and DRIVER as NOT_SOURCED unconditionally. The API has always accepted `source`; no
 * screen ever sent it. So the dropdown offered "Confirmed", the server refused with
 * "Choose where transport is being arranged from before confirming it", and there was nowhere in
 * the product to choose it. This select is that missing control.
 *
 * The list of choices comes from the server, per checkpoint, as `allowedSources` — a hotel cannot be
 * arranged from the fleet and a voucher run cannot come from a vendor, and `OpsCheckpoint` owns that
 * rule. Hardcoding it here would put a second copy of it in the client: wrong for some kinds
 * immediately, and for more of them later.
 */

/**
 * Sources the marketplace flow owns. Filtered out of the picker because choosing one by hand only
 * swaps this dead end for another: they need a marketplace order, which no operations screen can
 * create, and the database CHECK forbids naming a vendor alongside them. An already-set platform
 * source still renders as a read-only badge.
 */
const PLATFORM_SOURCES = new Set(["PLATFORM_HOTEL", "PLATFORM_VEHICLE"]);

/**
 * What a chosen source must still name before the server will accept CONFIRMED.
 *
 * Mirrors OpsCheckpointTransitions.confirmBlocker: a vendor-payable source needs a supplier, an
 * own-fleet one needs a vehicle or a driver. Everything else needs nothing.
 */
const needsFor = (source) => {
  if (source === "EXTERNAL_VENDOR" || PLATFORM_SOURCES.has(source)) return "vendor";
  if (source === "OWN_FLEET") return "fleet";
  return null;
};

const STATUS_TONE = {
  CONFIRMED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REQUESTED: "bg-sky-50 text-sky-700 border-sky-200",
  REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
  EXPIRED: "bg-rose-50 text-rose-700 border-rose-200",
  BLOCKED: "bg-rose-50 text-rose-700 border-rose-200",
  NOT_APPLICABLE: "bg-slate-50 text-slate-400 border-slate-200",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
};

/**
 * departureAt and dueAt, read as the TENANT's wall clock rather than the device's.
 *
 * These are OffsetDateTimes the server stamped with TenantTimeZone, and Jackson keeps that offset
 * on the wire — so the wall clock is already in the string. `new Date(iso).toLocaleString(...)`
 * re-zones it into the browser's, which turns an 18:00 IST cut-off into 12:30 on a device set to
 * UTC. The parts are rebuilt as a local Date only to reuse the locale's formatting: byte-identical
 * output for an in-zone device, correct for any other. The Today panel formats these the same way,
 * so the two renderings of one checkpoint on one screen cannot disagree.
 */
const WHEN_PARTS = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/;
const fmtWhen = (iso) => {
  if (!iso) return null;
  const m = WHEN_PARTS.exec(String(iso));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
};

/**
 * @param onRecord Optional. Called with (record, error) after every load and every successful
 *   write, so a HOST can render the record's standing — severity, the departure countdown,
 *   readyToTravel, the ops owner — without fetching the same endpoint a second time. The
 *   operations detail page needs exactly that, and two fetches of one record is also two
 *   answers: confirm the last mandatory checkpoint and the header would still say the trip
 *   is not ready until something re-fetched it.
 *
 *   The second argument is the load error, because null-record and failed-load are different
 *   facts that this panel deliberately collapses (it renders nothing either way). A host that
 *   wants to say "could not load" rather than "this booking predates the model" needs them apart.
 */
export default function OpsCheckpointPanel({ bookingPublicId, onChanged, onRecord }) {
  // OPS_MANAGE, not BOOKING_UPDATE. The server draws the same line and an operations
  // executive is expected to hold one without the other — gating on the wrong key here
  // would show controls that 403 on click.
  const canWrite = hasPermission(P.OPS_MANAGE);

  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  /**
   * Options for the two sources that demand evidence, fetched once and only when something on this
   * record actually asks for them.
   *
   * Both endpoints sit behind a permission an operations user may not hold — VENDOR_READ and
   * FLEET_READ. A 403 leaves the list empty, which renders as "no options" beside the source rather
   * than an error: the operator can still pick a source that needs no evidence, and the panel is not
   * broken just because they cannot see the vendor master.
   */
  const [vendorOptions, setVendorOptions] = useState([]);
  const [vehicleOptions, setVehicleOptions] = useState([]);
  const [driverOptions, setDriverOptions] = useState([]);
  const loadedNeeds = useRef({ vendor: false, fleet: false });

  const ensureOptions = useCallback(async (needs) => {
    if (!needs || loadedNeeds.current[needs]) return;
    loadedNeeds.current[needs] = true;
    try {
      if (needs === "vendor") {
        setVendorOptions(await operationsService.searchVendors(""));
      } else {
        const [vehicles, drivers] = await Promise.all([
          operationsService.fleetVehicleOptions(),
          operationsService.fleetDriverOptions(),
        ]);
        setVehicleOptions(vehicles);
        setDriverOptions(drivers);
      }
    } catch {
      // Permission or network. Silent by design — see above.
    }
  }, []);

  // Held in a ref so `load` does not depend on it. An inline arrow from the host would give
  // this a new identity every render, and a load() that changed identity every render would
  // re-fetch every render.
  const onRecordRef = useRef(onRecord);
  useEffect(() => { onRecordRef.current = onRecord; }, [onRecord]);

  const load = useCallback(async () => {
    if (!bookingPublicId) return;
    setLoading(true);
    try {
      const next = await operationsService.checkpoints(bookingPublicId);
      setRecord(next);
      onRecordRef.current?.(next, null);
    } catch (err) {
      // A missing record is null, not an error — but a genuine failure must not masquerade
      // as "this booking predates the model", so it is logged and the panel stays absent.
      if (!isAlreadyReported(err)) console.warn("Ops checkpoints failed", err);
      setRecord(null);
      onRecordRef.current?.(null, err);
    } finally {
      setLoading(false);
    }
  }, [bookingPublicId]);

  useEffect(() => { load(); }, [load]);

  // Pre-load the pickers for sources already in use on this record, so a checkpoint that is
  // ALREADY OWN_FLEET shows its vehicle list without the operator first having to re-pick the
  // source they had chosen last week.
  useEffect(() => {
    (record?.checkpoints ?? []).forEach((c) => ensureOptions(needsFor(c.source)));
  }, [record, ensureOptions]);

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
      // `toast` is an object of methods, not a callable — the (msg, "error") form here threw a
      // TypeError from inside the catch, so the two failures this branch exists to explain were
      // the two the user was never told about.
      if (err?.response?.status === 409) {
        toast.error("Somebody else changed this checkpoint just now — reloading.");
        await load();
      } else if (!isAlreadyReported(err)) {
        toast.error(getErrorMessage(err, "Could not update the checkpoint."));
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

              {/* Who is on the hook. `sourceLabel` is the evidentiary standard — a platform
                  confirmation and a phone call are not the same green dot, and this is where
                  that difference is legible.

                  Editable now, because until it was, CONFIRMED was unreachable for TRANSPORT,
                  SIGHTSEEING and DRIVER: the planner leaves them NOT_SOURCED and the server
                  refuses to confirm one. A platform source stays a read-only badge — it is set
                  by the marketplace flow and cannot honestly be typed here. */}
              {(() => {
                const options = (c.allowedSources ?? []).filter(
                  (s) => !PLATFORM_SOURCES.has(s.value)
                );
                // Read-only when the operator cannot write, when the marketplace owns this source,
                // or when the server offers nothing to choose from.
                if (!canWrite || PLATFORM_SOURCES.has(c.source) || options.length === 0) {
                  return c.sourceLabel ? <Badge tone="slate">{c.sourceLabel}</Badge> : null;
                }
                return (
                  <select
                    value={options.some((s) => s.value === c.source) ? c.source : ""}
                    disabled={busy}
                    onChange={(e) => {
                      const next = e.target.value || null;
                      if (!next) return;   // NOT_SOURCED is the state to leave, not one to choose
                      ensureOptions(needsFor(next));
                      // Only the source is sent. applySource on the server already clears evidence
                      // that belonged to the old one — it has to, because
                      // ck_ops_checkpoint_target_matches_source rejects a vendor on an OWN_FLEET row
                      // and a fleet id on an EXTERNAL_VENDOR one. Sending nulls here would do
                      // nothing anyway: the update treats every null field as "leave unchanged".
                      patch(c, { source: next });
                    }}
                    className="text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 outline-none disabled:opacity-60"
                  >
                    <option value="">Not sourced</option>
                    {options.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                );
              })()}

              {/* The evidence the chosen source demands. Without it the server still refuses
                  CONFIRMED — "Name the supplier…" / "Pick the vehicle or driver…" — so these are
                  the other half of the same fix, not a nicety. */}
              {canWrite && needsFor(c.source) === "vendor" && (
                <select
                  value={c.vendorPublicId ?? ""}
                  disabled={busy}
                  onChange={(e) => patch(c, { vendorPublicId: e.target.value || null })}
                  className="text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 outline-none disabled:opacity-60 max-w-[180px]"
                >
                  <option value="">
                    {vendorOptions.length ? "Pick supplier" : "No vendor access"}
                  </option>
                  {vendorOptions.map((v) => (
                    <option key={v.publicId} value={v.publicId}>{v.vendorName}</option>
                  ))}
                </select>
              )}

              {canWrite && needsFor(c.source) === "fleet" && (
                <>
                  <select
                    value={c.fleetVehiclePublicId ?? ""}
                    disabled={busy}
                    onChange={(e) => patch(c, { fleetVehiclePublicId: e.target.value || null })}
                    className="text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 outline-none disabled:opacity-60 max-w-[150px]"
                  >
                    <option value="">
                      {vehicleOptions.length ? "Pick vehicle" : "No fleet access"}
                    </option>
                    {vehicleOptions.map((v) => (
                      <option key={v.publicId} value={v.publicId}>{v.label}</option>
                    ))}
                  </select>
                  <select
                    value={c.fleetDriverPublicId ?? ""}
                    disabled={busy}
                    onChange={(e) => patch(c, { fleetDriverPublicId: e.target.value || null })}
                    className="text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 outline-none disabled:opacity-60 max-w-[150px]"
                  >
                    <option value="">
                      {driverOptions.length ? "Pick driver" : "No fleet access"}
                    </option>
                    {driverOptions.map((d) => (
                      <option key={d.publicId} value={d.publicId}>{d.label}</option>
                    ))}
                  </select>
                </>
              )}

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
