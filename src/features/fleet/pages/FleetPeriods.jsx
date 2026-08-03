// src/features/fleet/pages/FleetPeriods.jsx
// Month close — the accountant's lock on the fleet ledger.
//
// A closed month refuses every write dated inside it: no new expense, no cash movement, no edit,
// no delete. Corrections to a closed month become dated reversals in the CURRENT month, which is
// how the numbers already reported to a CA stay the numbers on file. Closing is refused while any
// driver settlement in the month is still unsettled — locking it would make the cash return that
// squares the sheet impossible to record, freezing someone's money in limbo forever.
//
// Viewing rides FLEET_MONEY_READ (this is money structure); the close/reopen buttons additionally
// need FLEET_PERIOD_CLOSE, which is granted per user and NOT inherited from running the diary.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarClock, Lock, LockOpen, CheckCircle2, AlertTriangle, ArrowRight, RotateCcw,
} from "lucide-react";

import fleetService from "../api/fleetService";
import { hasPermission, P } from "@shared/lib/access";
import {
  Button, Badge, PageShell, PageHeader, LoadingState, ConfirmDialog,
  StatCard, StatCardRow, Panel,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, Field, Textarea,
  useToast, errMsg, fmtDateTime,
} from "../components/fleetUi";

/** Indian FY start year for a date: Apr 2026 → Mar 2027 is "2026". */
function currentFinancialYear() {
  const now = new Date();
  return now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
}

const fyLabel = (fy) => `FY ${fy}–${String((fy + 1) % 100).padStart(2, "0")}`;

export default function FleetPeriods() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [fy, setFy] = useState(currentFinancialYear());
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [closeTarget, setCloseTarget] = useState(null);     // FleetPeriodDto
  const [reopenTarget, setReopenTarget] = useState(null);   // FleetPeriodDto
  const [reopenReason, setReopenReason] = useState("");

  const canClose = hasPermission(P.FLEET_PERIOD_CLOSE);

  const load = useCallback(() => {
    setLoading(true);
    return fleetService.listPeriods(fy)
      .then((p) => setPeriods(p || []))
      .catch((e) => showToast(errMsg(e, "Failed to load periods."), "error"))
      .finally(() => setLoading(false));
  }, [fy]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const closedCount = useMemo(() => periods.filter((p) => p.closed).length, [periods]);
  const closableCount = useMemo(
    () => periods.filter((p) => p.ended && !p.closed).length, [periods]);
  const unsettledTotal = useMemo(
    () => periods.reduce((s, p) => s + Number(p.unsettledCount || 0), 0), [periods]);

  // The oldest open ended month is the one to close next — closing out of order is legal but
  // almost always a mistake, so the UI points at it rather than enforcing it.
  const nextToClose = useMemo(
    () => periods.find((p) => p.ended && !p.closed), [periods]);

  const doClose = async () => {
    setBusy(true);
    try {
      await fleetService.closePeriod(closeTarget.financialYear, closeTarget.month);
      showToast(`${closeTarget.monthName} ${closeTarget.calendarYear} closed.`, "success");
      setCloseTarget(null);
      await load();
    } catch (e) {
      // The server names the exact refusal — month not over, or N unsettled sheets inside it.
      showToast(errMsg(e, "Could not close the month."), "error");
    } finally { setBusy(false); }
  };

  const doReopen = async () => {
    if (!reopenReason.trim()) {
      showToast("Reopening a reported month needs a reason on record.", "error");
      return;
    }
    setBusy(true);
    try {
      await fleetService.reopenPeriod(reopenTarget.publicId, reopenReason.trim());
      showToast(`${reopenTarget.monthName} ${reopenTarget.calendarYear} reopened.`, "success");
      setReopenTarget(null);
      setReopenReason("");
      await load();
    } catch (e) {
      showToast(errMsg(e, "Could not reopen the month."), "error");
    } finally { setBusy(false); }
  };

  const fyChoices = useMemo(() => {
    const base = currentFinancialYear();
    return [base - 2, base - 1, base, base + 1];
  }, []);

  return (
    <PageShell>
      <PageHeader
        icon={CalendarClock}
        title="Month close"
        subtitle="A closed month refuses every write inside it. Corrections become dated reversals in the current month."
      >
        <div className="flex rounded-xl border border-slate-200 bg-white p-1">
          {fyChoices.map((y) => (
            <button key={y} onClick={() => setFy(y)}
                    className={`rounded-lg px-3.5 py-2 text-sm font-bold transition-all whitespace-nowrap ${
                      fy === y ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              {fyLabel(y)}
            </button>
          ))}
        </div>
      </PageHeader>

      <StatCardRow className="lg:grid-cols-3 xl:grid-cols-3">
        <StatCard label="Months closed" value={closedCount} icon={<Lock />} tone="green" />
        <StatCard label="Ready to close" value={closableCount} icon={<CalendarClock />} tone="blue" />
        <StatCard label="Unsettled sheets" value={unsettledTotal} icon={<AlertTriangle />}
                  tone={unsettledTotal > 0 ? "amber" : "slate"} />
      </StatCardRow>

      {unsettledTotal > 0 && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-800">
            <AlertTriangle className="mr-1.5 inline h-4 w-4" />
            {unsettledTotal} driver settlement{unsettledTotal === 1 ? "" : "s"} in this year
            {unsettledTotal === 1 ? " is" : " are"} still open — those months cannot be closed until
            the cash squares.
          </p>
          <button onClick={() => navigate("/fleet/settlements")}
                  className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 hover:underline">
            Driver cash <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      )}

      {loading ? (
        <Panel icon={CalendarClock} title={fyLabel(fy)}><LoadingState label="Loading…" /></Panel>
      ) : (
        <Panel icon={CalendarClock} title={fyLabel(fy)}
               description="April to March. Close months oldest-first — the highlighted one is next."
               action={
                 <button onClick={load}
                         className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700">
                   <RotateCcw className="h-3.5 w-3.5" /> Refresh
                 </button>
               }>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {periods.map((p) => {
              const isNext = nextToClose
                && p.financialYear === nextToClose.financialYear && p.month === nextToClose.month;
              const blocked = p.ended && !p.closed && p.unsettledCount > 0;
              return (
                <div key={`${p.financialYear}-${p.month}`}
                     className={`rounded-2xl border p-4 transition-all ${
                       p.closed ? "border-emerald-200 bg-emerald-50/50"
                         : isNext ? "border-blue-300 bg-blue-50/50 ring-2 ring-blue-100"
                         : p.ended ? "border-slate-200 bg-white"
                         : "border-slate-100 bg-slate-50/60"}`}>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-extrabold text-slate-800">
                        {p.monthName} <span className="font-semibold text-slate-400">{p.calendarYear}</span>
                      </p>
                      {p.closed ? (
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {fmtDateTime(p.closedAt)}{p.closedBy ? ` · ${p.closedBy}` : ""}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {p.ended ? (isNext ? "Close this one next" : "Open") : "Still running"}
                        </p>
                      )}
                    </div>
                    {p.closed ? (
                      <Badge className="border border-emerald-200 bg-emerald-100 text-emerald-700">
                        <Lock className="mr-1 inline h-3 w-3" />Closed
                      </Badge>
                    ) : p.ended ? (
                      <Badge className="border border-blue-200 bg-blue-100 text-blue-700">Open</Badge>
                    ) : (
                      <Badge className="bg-slate-100 text-slate-500">Running</Badge>
                    )}
                  </div>

                  {blocked && (
                    <p className="mb-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] font-bold text-amber-700">
                      <AlertTriangle className="mr-1 inline h-3 w-3" />
                      {p.unsettledCount} unsettled sheet{p.unsettledCount === 1 ? "" : "s"}
                    </p>
                  )}

                  {canClose && p.ended && !p.closed && (
                    <Button size="sm" className="w-full justify-center"
                            variant={blocked ? "outline" : "default"}
                            disabled={blocked}
                            title={blocked ? "Square the driver settlements in this month first" : undefined}
                            onClick={() => setCloseTarget(p)}>
                      <Lock /> Close month
                    </Button>
                  )}
                  {canClose && p.closed && (
                    <Button size="sm" variant="outline" className="w-full justify-center text-amber-600"
                            onClick={() => { setReopenTarget(p); setReopenReason(""); }}>
                      <LockOpen /> Reopen
                    </Button>
                  )}
                  {!canClose && p.closed && (
                    <p className="text-center text-[11px] text-slate-400">
                      <CheckCircle2 className="mr-1 inline h-3 w-3 text-emerald-500" />Locked
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      <ConfirmDialog
        open={!!closeTarget}
        onOpenChange={(open) => !open && setCloseTarget(null)}
        title={`Close ${closeTarget?.monthName} ${closeTarget?.calendarYear}?`}
        description="Every expense, cash movement and settlement dated in this month becomes read-only. Corrections afterwards are dated reversals in the current month — history is never edited."
        confirmLabel="Close month"
        busy={busy}
        onConfirm={doClose}
      />

      {reopenTarget && (
        <Dialog open onOpenChange={(o) => !o && setReopenTarget(null)}>
          <DialogContent className="max-w-md" onClose={() => setReopenTarget(null)}>
            <DialogHeader>
              <DialogTitle>Reopen {reopenTarget.monthName} {reopenTarget.calendarYear}?</DialogTitle>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <p className="text-sm text-slate-600">
                This month may already have been reported on. The reopening is recorded with your
                name and this reason.
              </p>
              <Field label="Reason" required>
                <Textarea rows={3} value={reopenReason} autoFocus
                          placeholder="Missed fuel bill for the 28th found in the glovebox…"
                          onChange={(e) => setReopenReason(e.target.value)} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReopenTarget(null)} disabled={busy}>Cancel</Button>
              <Button onClick={doReopen} disabled={busy}>
                <LockOpen /> {busy ? "Reopening…" : "Reopen month"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </PageShell>
  );
}
