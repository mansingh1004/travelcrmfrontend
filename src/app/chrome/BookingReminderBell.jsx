import { memo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock } from "lucide-react";
import { bookingReminderService } from "@features/reminders";

/**
 * BookingReminderBell
 *
 * Booking reminders ONLY — a count badge plus a direct link to /BookingReminders.
 *
 * Deliberately NOT a dropdown: clicking navigates. The full page already lists, filters and
 * actions these reminders, so a mini-panel duplicated it and added a failure mode (a click that
 * opened an empty or erroring panel). One click, one destination.
 *
 * The badge is loaded once on mount. A failure is swallowed to 0 rather than toasted — the bar
 * is chrome on every page, and a backend hiccup must not throw an error at the user on load.
 */
const BookingReminderBell = memo(function BookingReminderBell() {
  const navigate = useNavigate();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let alive = true;
    bookingReminderService
      .getAll({ status: "Pending" })
      .then((res) => {
        if (!alive) return;
        setPending(Array.isArray(res.data) ? res.data.length : 0);
      })
      .catch(() => alive && setPending(0));
    return () => { alive = false; };
  }, []);

  return (
    <button
      onClick={() => navigate("/BookingReminders")}
      className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 active:scale-95 transition-all relative"
      aria-label={pending > 0 ? `Booking reminders (${pending} pending)` : "Booking reminders"}
      title="Booking reminders"
    >
      <CalendarClock size={19} />
      {pending > 0 && (
        <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-0.5 bg-red-600 rounded-full ring-2 ring-white flex items-center justify-center text-[9px] font-bold text-white leading-none">
          {pending > 99 ? "99+" : pending}
        </span>
      )}
    </button>
  );
});

export default BookingReminderBell;
