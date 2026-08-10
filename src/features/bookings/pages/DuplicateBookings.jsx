// src/features/bookings/pages/DuplicateBookings.jsx
// ─────────────────────────────────────────────────────────────
// Duplicate bookings — the clean-up screen.
// Route: /DuplicateBookings
//
// A lead is supposed to carry at most one active booking. The server enforces that twice over now
// (a check when a booking is created, and a database-level reservation that catches the simultaneous
// double-submit the check would race past), so this screen is NOT the guard — it is where the
// duplicates that got in BEFORE those guards, and the rare race that beats them, get cleaned up.
//
// The endpoint returns candidates FLAT, ordered by lead. Grouping is the whole point of the screen:
// "these three bookings are all for the same lead, decide which one is real" is the question being
// asked, and a flat list cannot ask it.
//
// Deliberately not a bulk tool. Each resolution cancels a booking and can turn money already
// received into a refund, so every one is confirmed individually with a stated reason.
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import bookingService from "../api/bookingService";
import ResolveDuplicateModal from "../components/ResolveDuplicateModal";
import { useToast } from "@shared/ui/toast";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { hasPermission, P } from "@shared/lib/access";
import {
  FiArrowLeft, FiRefreshCw, FiCopy, FiCheckCircle, FiAlertTriangle,
  FiExternalLink, FiInbox,
} from "react-icons/fi";

/* ─── HELPERS ────────────────────────────────────────────────── */
const fmtINR = (n) =>
  n != null
    ? "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "₹0.00";

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const STATUS_PILL = {
  PENDING:   "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-green-100 text-green-700",
  COMPLETED: "bg-blue-100 text-blue-700",
};

/**
 * Group the flat candidate list by its source lead.
 *
 * `leadId` on the response is the lead's publicId (a UUID), not an internal number. A row with no
 * lead cannot be a duplicate under this definition — the whole rule is "one active booking per
 * lead" — so those are dropped rather than collected under a null key, which would render a bogus
 * group of unrelated bookings that share only the absence of a lead.
 */
const groupByLead = (rows) => {
  const groups = new Map();
  rows.forEach((b) => {
    const key = b.leadId || b.sourceLeadPublicId;
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(b);
  });
  return [...groups.entries()]
    .map(([leadPublicId, bookings]) => ({
      leadPublicId,
      // Oldest first: the first one entered is normally the real booking, and it is also the row the
      // server's own release trigger promotes when a reservation frees up. That makes it the honest
      // default for "keep", not just a convenient one.
      bookings: [...bookings].sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || ""))),
    }))
    // Only groups that still have something to decide.
    .filter((g) => g.bookings.length > 1);
};

/* ═══════════════════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════════════════ */
export default function DuplicateBookings() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  // The endpoint is BOOKING_READ, but resolving needs BOOKING_CANCEL on the route AND BOOKING_REFUND
  // in the service — waiving the customer's charge is a money decision. Both are checked here so the
  // action is disabled with a reason rather than offered and refused.
  const canCancel = hasPermission(P.BOOKING_CANCEL);
  const canRefund = hasPermission(P.BOOKING_REFUND);
  const canResolve = canCancel && canRefund;

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [keepChoice, setKeepChoice] = useState({});   // leadPublicId → booking publicId to retain
  const [pending, setPending] = useState(null);       // { duplicate, original } for the modal

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await bookingService.getDuplicateCandidates();
      const rows = res.data?.data ?? res.data ?? [];
      const next = groupByLead(Array.isArray(rows) ? rows : []);
      setGroups(next);

      // Seed each group's "keep" to the oldest booking, but never clobber a choice already made —
      // a refetch after resolving one row must not silently move the selection under the operator.
      setKeepChoice((prev) => {
        const seeded = { ...prev };
        next.forEach((g) => {
          const stillPresent = g.bookings.some((b) => b.publicId === seeded[g.leadPublicId]);
          if (!stillPresent) seeded[g.leadPublicId] = g.bookings[0]?.publicId;
        });
        return seeded;
      });
    } catch (error) {
      if (isAlreadyReported(error)) return;
      showToast(getErrorMessage(error, "Could not load duplicate bookings."), "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalDuplicates = useMemo(
    () => groups.reduce((sum, g) => sum + g.bookings.length - 1, 0),
    [groups]
  );

  const handleResolve = async (body) => {
    if (!pending) return;
    setSaving(true);
    try {
      const res = await bookingService.resolveDuplicate(pending.duplicate.publicId, body);
      const result = res.data?.data ?? res.data ?? {};
      setPending(null);

      // The refund position is the one thing the operator cannot see coming, so it is said out loud
      // rather than left for them to find in the ledger.
      showToast(
        result.refundRequired
          ? `${pending.duplicate.bookingCode} resolved — ${fmtINR(result.refundDue)} is now refund-due.`
          : `${pending.duplicate.bookingCode} resolved as a duplicate.`,
        "success"
      );
      fetchData();
    } catch (error) {
      if (isAlreadyReported(error)) return;
      showToast(getErrorMessage(error, "Could not resolve the duplicate."), "error");
    } finally {
      setSaving(false);
    }
  };

  /* ─── RENDER ──────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-slate-100"
      style={{ fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* ── HEADER ── */}
      <div className="bg-white/70 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-all">
              <FiArrowLeft className="w-4 h-4 text-slate-600" />
            </button>
            <div>
              <h1 className="text-lg font-extrabold text-slate-800">Duplicate Bookings</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Leads carrying more than one active booking
              </p>
            </div>
          </div>
          <button onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-blue-600 text-xs font-bold transition-all">
            <FiRefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-5 space-y-5">

        {!canResolve && !loading && groups.length > 0 && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
            <FiAlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              You can see these, but resolving one waives a customer charge and may create a refund,
              so it needs both <span className="font-extrabold">Cancel booking</span> and{" "}
              <span className="font-extrabold">Refund</span> permissions
              {canCancel ? " — you're missing Refund." : canRefund ? " — you're missing Cancel booking." : "."}
            </span>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-500 font-semibold text-sm">Checking for duplicates…</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center"
            style={{ animation: "fadeUp .4s ease both" }}>
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <FiInbox className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="text-base font-extrabold text-slate-700">No duplicates</p>
            <p className="text-sm text-slate-400 font-medium mt-1 max-w-md mx-auto leading-relaxed">
              Every lead has at most one active booking. New duplicates are blocked at creation, so
              this page normally stays empty.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <FiCopy className="w-3.5 h-3.5 text-rose-500" />
              {groups.length} {groups.length === 1 ? "lead" : "leads"} affected ·{" "}
              {totalDuplicates} extra {totalDuplicates === 1 ? "booking" : "bookings"} to resolve
            </div>

            {groups.map((group, gi) => {
              const keptId = keepChoice[group.leadPublicId] || group.bookings[0]?.publicId;
              const original = group.bookings.find((b) => b.publicId === keptId) || group.bookings[0];

              return (
                <div key={group.leadPublicId}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
                  style={{ animation: `fadeUp .4s ease both ${gi * 60}ms` }}>

                  <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-slate-700 truncate">
                        {group.bookings[0]?.customerNameSnapshot || "Unnamed customer"}
                      </p>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                        {group.bookings.length} active bookings on one lead — choose the one to keep
                      </p>
                    </div>
                    <button
                      onClick={() => navigate(`/EditLead/${group.leadPublicId}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-blue-600 hover:border-blue-200 text-[11px] font-bold transition-all"
                    >
                      <FiExternalLink className="w-3 h-3" /> Open lead
                    </button>
                  </div>

                  <div className="divide-y divide-slate-50">
                    {group.bookings.map((b) => {
                      const isKept = b.publicId === keptId;
                      return (
                        <div key={b.publicId}
                          className={`px-5 py-4 flex items-start gap-4 transition-colors ${isKept ? "bg-emerald-50/40" : "hover:bg-slate-50/60"}`}>

                          {/* Radio, not a button: exactly one of the group survives, and a radio is
                              the control that says "one of these" without a legend explaining it. */}
                          <label className="flex items-center gap-2 pt-0.5 cursor-pointer shrink-0">
                            <input
                              type="radio"
                              name={`keep-${group.leadPublicId}`}
                              checked={isKept}
                              onChange={() => setKeepChoice((p) => ({ ...p, [group.leadPublicId]: b.publicId }))}
                              className="h-4 w-4 accent-emerald-600"
                            />
                          </label>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                onClick={() => navigate(`/BookingDetails/${b.publicId}`)}
                                className="text-sm font-extrabold text-slate-800 hover:text-blue-600 transition-colors"
                              >
                                {b.bookingCode}
                              </button>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_PILL[b.status] || "bg-slate-100 text-slate-600"}`}>
                                {b.status}
                              </span>
                              {isKept && (
                                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                  <FiCheckCircle className="w-3 h-3" /> Keeping
                                </span>
                              )}
                            </div>

                            <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-[11px]">
                              <span className="text-slate-400">
                                Travel: <span className="font-semibold text-slate-600">{fmtDate(b.travelDate)}</span>
                              </span>
                              <span className="text-slate-400">
                                Amount: <span className="font-semibold text-slate-600">{fmtINR(b.customerAmount)}</span>
                              </span>
                              <span className="text-slate-400">
                                Paid: <span className={`font-semibold ${Number(b.paidAmount) > 0 ? "text-green-600" : "text-slate-600"}`}>
                                  {fmtINR(b.paidAmount)}
                                </span>
                              </span>
                              <span className="text-slate-400">
                                Created: <span className="font-semibold text-slate-600">{fmtDateTime(b.createdAt)}</span>
                              </span>
                            </div>
                          </div>

                          <div className="shrink-0">
                            {isKept ? (
                              <span className="text-[11px] font-bold text-emerald-600">Survives</span>
                            ) : (
                              <button
                                onClick={() => setPending({ duplicate: b, original })}
                                disabled={!canResolve || saving}
                                title={canResolve ? undefined : "Needs Cancel booking + Refund permissions"}
                                className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-[11px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                Mark as duplicate
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {pending && (
        <ResolveDuplicateModal
          duplicate={pending.duplicate}
          original={pending.original}
          saving={saving}
          onClose={() => setPending(null)}
          onConfirm={handleResolve}
        />
      )}
    </div>
  );
}
