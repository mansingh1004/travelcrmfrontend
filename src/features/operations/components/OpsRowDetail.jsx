// features/operations/components/OpsRowDetail.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The expanded row: what is actually arranged, per category, without leaving the board.
//
// Read-only on purpose. The board's job is to tell you WHICH booking needs work and WHAT
// kind; changing a supplier is a different act with different consequences, and it lives in
// the drawer behind "Manage suppliers". Two ways to edit the same field on one screen is how
// two of them end up disagreeing.
//
// Categories here are the SERVER's dimensions, matched by the same token rules the readiness
// columns use — not a second client-side guess at what "Hotel" means. A line the server did
// not sort into hotel/vehicle/sightseeing still appears, under Other, because a line nobody
// can see is the failure this whole column set was built to fix.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react";
import { BookOpen, Users2, Wrench, X } from "lucide-react";

import { isAlreadyReported } from "@shared/api/apiError";
import { COLUMN_DIMENSIONS, Badge } from "./opsUi";
import operationsService from "../api/operationsService";

const money = (n) =>
  n == null ? "—" : `₹ ${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const fmtDate = (iso) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—";

/**
 * Which category a free-text service type belongs to.
 *
 * Mirrors the server's token sets. It is a mirror and not the source: the server owns the rule,
 * and this only decides which card a line is drawn in. If they ever drift, the badges in the
 * table are right and this grouping is wrong — which is why the counts under the badges come
 * from the server, not from counting these arrays.
 */
const TOKENS = {
  HOTEL: ["hotel", "stay", "accommodation", "resort", "room", "lodge"],
  VEHICLE: ["transport", "transfer", "cab", "taxi", "vehicle", "car", "pickup", "drop", "coach", "tempo"],
  ACTIVITIES: ["sightseeing", "activity", "tour", "excursion", "attraction", "ticket"],
};

function categorise(serviceType) {
  const t = (serviceType || "").toLowerCase();
  for (const { key } of COLUMN_DIMENSIONS) {
    if ((TOKENS[key] ?? []).some((token) => t.includes(token))) return key;
  }
  return "OTHER";
}

const STATUS_CHIP = {
  CONFIRMED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  PENDING: "bg-amber-50 text-amber-700 ring-amber-200",
  CANCELLED: "bg-slate-50 text-slate-400 ring-slate-200",
};

export default function OpsRowDetail({ entry, onOpenDrawer, onOpenLedger, onClose }) {
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);

  const bookingId = entry?.bookingPublicId;

  const load = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      setLines(await operationsService.serviceItems(bookingId));
    } catch (err) {
      // Degrades to "nothing to show" rather than a toast on top of the interceptor's.
      if (!isAlreadyReported(err)) console.warn("Operations row detail failed", err);
      setLines([]);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => { load(); }, [load]);

  const active = lines.filter((l) => l.status !== "CANCELLED");
  const cards = [...COLUMN_DIMENSIONS, { key: "OTHER", label: "Other" }].map((dim) => {
    const mine = active.filter((l) => categorise(l.serviceType) === dim.key);
    const done = mine.filter((l) => l.status === "CONFIRMED").length;
    return { ...dim, lines: mine, done };
  // "Other" only appears when it has something in it — an always-empty fourth card would
  // train people to ignore the row that eventually matters.
  }).filter((c) => c.key !== "OTHER" || c.lines.length > 0);

  return (
    <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4">
      {/* Header strip — the facts a decision needs before opening anything else. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pb-3 mb-3 border-b border-slate-200/70">
        <span className="text-xs font-bold text-slate-500">
          Booking <span className="text-blue-600">{entry.bookingCode}</span>
        </span>
        <span className="text-xs font-bold text-slate-500">
          Customer <span className="text-slate-700">{entry.customerName || "—"}</span>
        </span>
        <span className="text-xs font-bold text-slate-500">
          Pax <span className="text-slate-700 tabular-nums">{entry.pax ?? "—"}</span>
        </span>
        <span className="text-xs font-bold text-slate-500">
          Travel <span className="text-slate-700">{fmtDate(entry.travelDate)} – {fmtDate(entry.tripEndDate)}</span>
        </span>
        <span className="text-xs font-bold text-slate-500">
          Balance due{" "}
          <span className={Number(entry.balanceDue) > 0 ? "text-rose-600" : "text-emerald-600"}>
            {money(entry.balanceDue)}
          </span>
        </span>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => onOpenLedger?.(entry)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow-sm hover:from-blue-700 hover:to-indigo-600"
          >
            <BookOpen className="w-3.5 h-3.5" /> View ledger
          </button>
          <button
            onClick={() => onOpenDrawer?.(entry)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-600 hover:text-blue-600 hover:border-blue-300"
          >
            <Wrench className="w-3.5 h-3.5" /> Manage suppliers
          </button>
          <button
            onClick={onClose}
            aria-label="Collapse this booking"
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {loading && <p className="text-xs font-bold text-slate-400 py-4">Loading service lines…</p>}

      {!loading && active.length === 0 && (
        <div className="flex items-center gap-2 py-4">
          <Users2 className="w-4 h-4 text-rose-500" />
          <p className="text-xs font-bold text-slate-600">
            Nothing has been broken into service lines yet — there is no hotel, vehicle or
            sightseeing on this booking to confirm.
          </p>
        </div>
      )}

      {!loading && active.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <div key={card.key} className="bg-white rounded-xl border border-slate-200/70 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                <p className="text-xs font-extrabold text-slate-700">{card.label}</p>
                <Badge tone={card.lines.length === 0 ? "slate"
                  : card.done >= card.lines.length ? "green" : "amber"}>
                  {card.done} of {card.lines.length}
                </Badge>
              </div>

              {card.lines.length === 0 ? (
                <p className="px-3 py-3 text-[11px] font-bold text-slate-400">Nothing arranged</p>
              ) : (
                <ul className="divide-y divide-slate-50">
                  {card.lines.map((line) => (
                    <li key={line.publicId} className="flex items-center gap-2 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-700 truncate">{line.title}</p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {fmtDate(line.serviceDate)}
                          {line.vendorNameSnapshot ? ` · ${line.vendorNameSnapshot}` : " · no supplier"}
                        </p>
                      </div>
                      <span className={`shrink-0 text-[10px] font-extrabold px-2 py-0.5 rounded ring-1 ${
                        STATUS_CHIP[line.status] ?? STATUS_CHIP.PENDING
                      }`}>
                        {line.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
