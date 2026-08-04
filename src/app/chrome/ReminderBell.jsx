import { memo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlarmClock } from "lucide-react";
import { reminderService, extractReminderList } from "@features/reminders";

/**
 * ReminderBell
 *
 * General (lead / follow-up) reminders ONLY — a count badge plus a direct link to /Reminders.
 * Booking reminders have their own icon; notifications have the bell. The three stay separate.
 *
 * Counts the ACTIONABLE set — overdue plus due-today — so the badge stays a signal rather than
 * a permanent large number. Like the booking icon, this navigates instead of opening a panel.
 */
const ReminderBell = memo(function ReminderBell() {
  const navigate = useNavigate();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    // A reminder that is overdue AND due today can come back from both endpoints, so the two
    // lists are merged and de-duplicated on id before counting.
    Promise.all([reminderService.getOverdue(), reminderService.getDueToday()])
      .then(([ovRes, dtRes]) => {
        if (!alive) return;
        const seen = new Set();
        const merged = [...extractReminderList(ovRes), ...extractReminderList(dtRes)]
          .filter((r) => {
            const key = r?.id ?? r?.reminderId;
            if (key == null || seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        setCount(merged.length);
      })
      .catch(() => alive && setCount(0));
    return () => { alive = false; };
  }, []);

  return (
    <button
      onClick={() => navigate("/Reminders")}
      className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 active:scale-95 transition-all relative"
      aria-label={count > 0 ? `Reminders (${count} due)` : "Reminders"}
      title="Reminders"
    >
      <AlarmClock size={19} />
      {count > 0 && (
        <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-0.5 bg-amber-500 rounded-full ring-2 ring-white flex items-center justify-center text-[9px] font-bold text-white leading-none">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
});

export default ReminderBell;
