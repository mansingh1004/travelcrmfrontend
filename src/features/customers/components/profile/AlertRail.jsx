import { AlertTriangle, CalendarClock } from "lucide-react";

import { ALERT_TONE, FOCUS_RING, daysUntil, fmtDate, money } from "./profileUi";

/**
 * The two or three facts worth interrupting someone for.
 *
 * Fed entirely from the summary call, so a warning about an expiring passport does not require
 * opening the Documents tab — which is precisely the failure the old page had: the data existed,
 * the scheduler ran, and nothing surfaced it where anyone would look.
 *
 * Renders nothing when there is nothing wrong. An always-present empty rail trains people to skip
 * it, and then the one time it matters they skip that too.
 *
 * Lifted out of ProfileHeader.jsx, which was retired when the hero and the money strip were
 * replaced by CommandBand + MoneyBand.
 */
export function AlertRail({ summary, onOpenDocuments, onOpenMoney }) {
  const alerts = [];

  const passportIn = daysUntil(summary.passportExpiry);
  if (passportIn !== null && passportIn < 0) {
    alerts.push({ tone: "rose", text: `Passport expired on ${fmtDate(summary.passportExpiry)}` });
  } else if (passportIn !== null && passportIn <= 180) {
    // 180 days, not 60: most consulates and carriers require six months' validity beyond travel,
    // so "not expired yet" is not the same as "usable".
    alerts.push({
      tone: "amber",
      text: `Passport expires in ${passportIn} days (${fmtDate(summary.passportExpiry)}) — many destinations need 6 months' validity`,
    });
  }

  if (summary.documentsExpiringSoon > 0) {
    alerts.push({
      tone: "amber",
      text: `${summary.documentsExpiringSoon} uploaded document${summary.documentsExpiringSoon === 1 ? "" : "s"} expiring soon`,
      action: { label: "View documents", onClick: onOpenDocuments },
    });
  }

  const overdue = daysUntil(summary.nextDueTravelDate);
  if (Number(summary.outstanding) > 0 && overdue !== null && overdue < 0) {
    alerts.push({
      tone: "rose",
      text: `${money(summary.outstanding)} outstanding on a trip whose travel date has passed`,
      action: { label: "View money", onClick: onOpenMoney },
    });
  }

  if (alerts.length === 0) return null;

  return (
    <section aria-label="Alerts" className="space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.text}
          className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-2.5 text-sm font-semibold ${
            ALERT_TONE[alert.tone] || ALERT_TONE.amber}`}
        >
          {alert.tone === "rose"
            ? <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            : <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />}
          <span className="min-w-0 flex-1">{alert.text}</span>
          {alert.action && (
            <button
              type="button"
              onClick={alert.action.onClick}
              className={`shrink-0 rounded-lg bg-white/70 px-2.5 py-1 text-xs font-bold hover:bg-white ${FOCUS_RING}`}
            >
              {alert.action.label}
            </button>
          )}
        </div>
      ))}
    </section>
  );
}

export default AlertRail;
