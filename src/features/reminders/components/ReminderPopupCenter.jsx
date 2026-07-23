import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import {
  BellRing,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Phone,
  X,
} from "lucide-react";

import reminderService, {
  extractReminderList,
} from "../api/reminderService";

import bookingReminderService from "../api/bookingReminderService";
import { WhatsAppIcon } from "@shared/ui/WhatsAppIcon";


const POLL_INTERVAL = 60_000;

const HIDDEN_REMINDERS_KEY =
  "travelcrm-popup-reminders-hidden";

/* ─────────────────────────────────────────────────────────────
   BASIC HELPERS
───────────────────────────────────────────────────────────── */

const normalizeText = (value) =>
  String(value ?? "").trim().toLowerCase();

const getNumericId = (...values) => {
  for (const value of values) {
    if (
      value !== null &&
      value !== undefined &&
      value !== "" &&
      !Number.isNaN(Number(value))
    ) {
      return Number(value);
    }
  }

  return null;
};

const validDate = (value) => {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date;
};

const isToday = (value) => {
  const date = validDate(value);

  if (!date) return false;

  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
};

const formatType = (value) =>
  String(value || "Reminder")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );

const getWhatsAppNumber = (phone) => {
  let digits = String(phone ?? "").replace(/\D/g, "");

  if (!digits) return "";

  // Indian local number: 9876543210 -> 919876543210
  if (digits.length === 10) {
    return `91${digits}`;
  }

  // Indian number with leading zero: 09876543210 -> 919876543210
  if (digits.length === 11 && digits.startsWith("0")) {
    return `91${digits.slice(1)}`;
  }

  return digits;
};

/* ─────────────────────────────────────────────────────────────
   RESPONSE EXTRACTION
───────────────────────────────────────────────────────────── */

const extractBookingReminderList = (response) => {
  const body = response?.data ?? response;

  const candidates = [
    body?.data?.content,
    body?.data?.items,
    body?.data?.reminders,
    body?.data,
    body?.content,
    body?.items,
    body?.reminders,
    body,
  ];

  return candidates.find(Array.isArray) || [];
};

/* ─────────────────────────────────────────────────────────────
   NORMALIZE GENERAL REMINDER

   IMPORTANT:
   actionId must remain numeric because reminderService endpoints
   use @PathVariable Long id.
───────────────────────────────────────────────────────────── */

const normalizeGeneralReminder = (item = {}, index = 0) => {
  const actionId = getNumericId(
    item.id,
    item.reminderId,
    item.backendId
  );

  const publicId =
    item.publicId ||
    item.reminderPublicId ||
    null;

  return {
    popupId: `general-${
      actionId || publicId || index
    }`,

    source: "GENERAL",

    actionId,
    publicId,

    title:
      item.title ||
      item.subject ||
      "CRM Reminder",

    message:
      item.description ||
      item.notes ||
      "This reminder requires your attention.",

    customerName:
      item.leadName ||
      item.customerName ||
      item.lead?.customerName ||
      "Customer",

    phone:
      item.phone ||
      item.leadPhone ||
      item.lead?.phone ||
      "",

    type:
      item.type ||
      item.reminderType ||
      "Custom",

    priority: normalizeText(
      item.priority || "Medium"
    ),

    status: normalizeText(
      item.status || "Active"
    ),

    dueAt:
      item.dueDate ||
      item.dueAt ||
      item.followUpDate ||
      item.reminderDate ||
      item.remindAt ||
      null,

    snoozedUntil:
      item.snoozedUntil ||
      null,

    leadId:
      item.leadPublicId ||
      item.leadId ||
      item.lead?.publicId ||
      item.lead?.id ||
      null,

    assignedTo:
      item.assignToName ||
      item.assignedUserName ||
      item.assignedToName ||
      "",
  };
};

/* ─────────────────────────────────────────────────────────────
   NORMALIZE BOOKING REMINDER
───────────────────────────────────────────────────────────── */

const normalizeBookingReminder = (
  item = {},
  index = 0
) => {
  const actionId = getNumericId(
    item.id,
    item.reminderId
  );

  return {
    popupId: `booking-${
      actionId ||
      item.publicId ||
      item.bookingCode ||
      index
    }`,

    source: "BOOKING",

    actionId,

    title:
      item.title ||
      formatType(item.reminderType) ||
      "Booking Reminder",

    message:
      item.message ||
      item.description ||
      "This booking requires your attention.",

    customerName:
      item.customerName ||
      item.booking?.customerNameSnapshot ||
      "Customer",

    phone:
      item.phone ||
      item.booking?.customerPhone ||
      "",

    bookingCode:
      item.bookingCode ||
      item.booking?.bookingCode ||
      "",

    bookingId:
      item.bookingPublicId ||
      item.bookingId ||
      item.booking?.publicId ||
      item.booking?.id ||
      null,

    destination:
      item.destination ||
      item.booking?.destinationSnapshot ||
      "",

    type:
      item.reminderType ||
      "Booking",

    priority: normalizeText(
      item.priority ||
        (
          item.reminderType === "Travel_date" ||
          item.reminderType === "Final_payment"
            ? "High"
            : "Medium"
        )
    ),

    status: normalizeText(
      item.status || "Pending"
    ),

    dueAt:
      item.reminderDate ||
      item.dueDate ||
      item.remindAt ||
      null,

    travelDate:
      item.travelDate ||
      item.booking?.travelDate ||
      null,

    amount: Number(item.amount || 0),
  };
};

/* ─────────────────────────────────────────────────────────────
   LOCAL HIDE STORAGE

   Used especially for booking reminders because the current
   bookingReminderService does not have snooze/dismiss endpoints.
───────────────────────────────────────────────────────────── */

const getHiddenReminders = () => {
  try {
    const raw = localStorage.getItem(
      HIDDEN_REMINDERS_KEY
    );

    const parsed = raw
      ? JSON.parse(raw)
      : {};

    const now = Date.now();
    const cleaned = {};

    Object.entries(parsed).forEach(
      ([popupId, expiresAt]) => {
        if (Number(expiresAt) > now) {
          cleaned[popupId] = Number(expiresAt);
        }
      }
    );

    localStorage.setItem(
      HIDDEN_REMINDERS_KEY,
      JSON.stringify(cleaned)
    );

    return cleaned;
  } catch {
    return {};
  }
};

const hideReminderLocally = (
  popupId,
  minutes
) => {
  const hidden = getHiddenReminders();

  hidden[popupId] =
    Date.now() + minutes * 60_000;

  localStorage.setItem(
    HIDDEN_REMINDERS_KEY,
    JSON.stringify(hidden)
  );
};

/* ─────────────────────────────────────────────────────────────
   POPUP ELIGIBILITY
───────────────────────────────────────────────────────────── */

const isGeneralReminderDue = (
  reminder,
  now
) => {
  const dueAt = validDate(reminder.dueAt);

  if (!dueAt) return false;

  if (
    ["completed", "dismissed"].includes(
      reminder.status
    )
  ) {
    return false;
  }

  if (reminder.status === "snoozed") {
    const snoozedUntil = validDate(
      reminder.snoozedUntil
    );

    if (
      snoozedUntil &&
      snoozedUntil > now
    ) {
      return false;
    }
  }

  const allowedStatus = [
    "active",
    "snoozed",
  ].includes(reminder.status);

  return allowedStatus && dueAt <= now;
};

const isBookingReminderDue = (
  reminder,
  now
) => {
  if (reminder.status !== "pending") {
    return false;
  }

  const dueAt = validDate(reminder.dueAt);

  const reminderTimeReached =
    dueAt && dueAt <= now;

  const travelIsToday =
    isToday(reminder.travelDate);

  return reminderTimeReached || travelIsToday;
};

/* ─────────────────────────────────────────────────────────────
   PRIORITY / SORTING
───────────────────────────────────────────────────────────── */

const getUrgencyScore = (reminder) => {
  const now = new Date();
  const dueAt = validDate(reminder.dueAt);

  let score = 0;

  if (dueAt && dueAt < now) {
    score += 100;
  }

  if (reminder.priority === "high") {
    score += 80;
  }

  if (isToday(reminder.travelDate)) {
    score += 100;
  }

  if (
    [
      "payment",
      "payment_due",
      "final_payment",
    ].includes(normalizeText(reminder.type))
  ) {
    score += 60;
  }

  if (
    [
      "document",
      "visa",
      "confirmation",
      "travel_date",
    ].includes(normalizeText(reminder.type))
  ) {
    score += 40;
  }

  return score;
};

const getDueLabel = (value) => {
  const dueAt = validDate(value);

  if (!dueAt) {
    return "Due time not available";
  }

  const now = new Date();

  const differenceMinutes = Math.round(
    (dueAt.getTime() - now.getTime()) /
      60_000
  );

  if (differenceMinutes < 0) {
    const overdueMinutes =
      Math.abs(differenceMinutes);

    if (overdueMinutes < 60) {
      return `Overdue by ${overdueMinutes} minute${
        overdueMinutes === 1 ? "" : "s"
      }`;
    }

    const hours = Math.floor(
      overdueMinutes / 60
    );

    if (hours < 24) {
      return `Overdue by ${hours} hour${
        hours === 1 ? "" : "s"
      }`;
    }

    const days = Math.floor(hours / 24);

    return `Overdue by ${days} day${
      days === 1 ? "" : "s"
    }`;
  }

  if (differenceMinutes === 0) {
    return "Due now";
  }

  if (differenceMinutes < 60) {
    return `Due in ${differenceMinutes} minutes`;
  }

  return dueAt.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/* ═════════════════════════════════════════════════════════════
   MAIN POPUP COMPONENT
═════════════════════════════════════════════════════════════ */

export default function ReminderPopupCenter() {
  const navigate = useNavigate();

  const [queue, setQueue] = useState([]);
  const [activeIndex, setActiveIndex] =
    useState(0);

  const [fetching, setFetching] =
    useState(false);

  const [actionLoading, setActionLoading] =
    useState(false);

  const [actionError, setActionError] =
    useState("");

  const [snoozeOpen, setSnoozeOpen] =
    useState(false);

  const currentReminder =
    queue[activeIndex] || null;

  useEffect(() => {
    setSnoozeOpen(false);
    setActionError("");
  }, [currentReminder?.popupId]);

  const loadPopupReminders =
    useCallback(async () => {
      setFetching(true);

      try {
        const [
          generalResult,
          bookingResult,
        ] = await Promise.allSettled([
          reminderService.getAll(),
          bookingReminderService.getAll({
            status: "Pending",
          }),
        ]);

        const generalReminders =
          generalResult.status === "fulfilled"
            ? extractReminderList(
                generalResult.value
              ).map(normalizeGeneralReminder)
            : [];

        const bookingReminders =
          bookingResult.status === "fulfilled"
            ? extractBookingReminderList(
                bookingResult.value
              ).map(normalizeBookingReminder)
            : [];

        const hidden =
          getHiddenReminders();

        const now = new Date();

        const popupQueue = [
          ...generalReminders,
          ...bookingReminders,
        ]
          .filter((reminder) => {
            if (hidden[reminder.popupId]) {
              return false;
            }

            if (
              reminder.source === "GENERAL"
            ) {
              return isGeneralReminderDue(
                reminder,
                now
              );
            }

            return isBookingReminderDue(
              reminder,
              now
            );
          })
          .sort((first, second) => {
            const scoreDifference =
              getUrgencyScore(second) -
              getUrgencyScore(first);

            if (scoreDifference !== 0) {
              return scoreDifference;
            }

            const firstDate =
              validDate(first.dueAt)?.getTime() ||
              Number.MAX_SAFE_INTEGER;

            const secondDate =
              validDate(second.dueAt)?.getTime() ||
              Number.MAX_SAFE_INTEGER;

            return firstDate - secondDate;
          })
          .slice(0, 10);

        setQueue(popupQueue);

        setActiveIndex((currentIndex) =>
          Math.min(
            currentIndex,
            Math.max(
              popupQueue.length - 1,
              0
            )
          )
        );
      } catch (error) {
        console.error(
          "Reminder popup fetch error:",
          error
        );
      } finally {
        setFetching(false);
      }
    }, []);

  useEffect(() => {
    loadPopupReminders();

    const interval = window.setInterval(
      loadPopupReminders,
      POLL_INTERVAL
    );

    const handleWindowFocus = () => {
      loadPopupReminders();
    };

    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible"
      ) {
        loadPopupReminders();
      }
    };

    window.addEventListener(
      "focus",
      handleWindowFocus
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      window.clearInterval(interval);

      window.removeEventListener(
        "focus",
        handleWindowFocus
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, [loadPopupReminders]);

  const removeCurrentFromQueue =
    useCallback(() => {
      if (!currentReminder) return;

      setQueue((previousQueue) => {
        const updatedQueue =
          previousQueue.filter(
            (item) =>
              item.popupId !==
              currentReminder.popupId
          );

        setActiveIndex((currentIndex) =>
          Math.min(
            currentIndex,
            Math.max(
              updatedQueue.length - 1,
              0
            )
          )
        );

        return updatedQueue;
      });
    }, [currentReminder]);

  const runAction = async (
    action,
    errorMessage
  ) => {
    setActionLoading(true);
    setActionError("");

    try {
      await action();
      removeCurrentFromQueue();
    } catch (error) {
      console.error(error);

      setActionError(
        error?.response?.data?.message ||
          error?.message ||
          errorMessage
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = () => {
    if (!currentReminder) return;

    if (!currentReminder.actionId) {
      setActionError(
        "Numeric reminder ID is missing."
      );
      return;
    }

    runAction(
      () =>
        currentReminder.source === "BOOKING"
          ? bookingReminderService.markComplete(
              currentReminder.actionId
            )
          : reminderService.markComplete(
              currentReminder.actionId
            ),
      "Failed to complete reminder."
    );
  };

  const handleDismiss = () => {
    if (
      !currentReminder ||
      currentReminder.source !== "GENERAL"
    ) {
      return;
    }

    if (!currentReminder.actionId) {
      setActionError(
        "Numeric reminder ID is missing."
      );
      return;
    }

    runAction(
      () =>
        reminderService.dismiss(
          currentReminder.actionId
        ),
      "Failed to dismiss reminder."
    );
  };

  const handleSnooze = (minutes) => {
    if (!currentReminder) return;

    setSnoozeOpen(false);

    if (
      currentReminder.source === "BOOKING"
    ) {
      /*
       * Current bookingReminderService has no backend
       * snooze endpoint, therefore booking popup snooze
       * is temporarily stored in localStorage.
       */
      hideReminderLocally(
        currentReminder.popupId,
        minutes
      );
      removeCurrentFromQueue();
      return;
    }

    if (!currentReminder.actionId) {
      setActionError(
        "Numeric reminder ID is missing."
      );
      return;
    }

    const snoozedUntil = new Date(
      Date.now() + minutes * 60_000
    ).toISOString();

    runAction(
      () =>
        reminderService.snooze(
          currentReminder.actionId,
          snoozedUntil
        ),
      "Failed to snooze reminder."
    );
  };

 const handleViewDetails = () => {
  if (!currentReminder) return;

  // Navigation ke baad same popup turant dobara na aaye
  hideReminderLocally(
    currentReminder.popupId,
    10
  );

  removeCurrentFromQueue();

  // Booking reminder
  if (currentReminder.source === "BOOKING") {
    navigate("/BookingReminders", {
      state: {
        bookingCode: currentReminder.bookingCode,
        bookingId: currentReminder.bookingId,
      },
    });

    return;
  }

  // General reminder connected with a lead
  if (currentReminder.leadId) {
    navigate("/allleads", {
      state: {
        focusLeadId: String(
          currentReminder.leadId
        ),
        openLeadDetails: true,
      },
    });

    return;
  }

  // Reminder does not contain lead ID
  navigate("/Reminders");
};
   
  const isCritical = useMemo(() => {
    if (!currentReminder) return false;

    return (
      currentReminder.priority === "high" ||
      getUrgencyScore(currentReminder) >=
        100
    );
  }, [currentReminder]);

  if (!currentReminder) {
    return null;
  }

  const totalReminders = queue.length;
  const hasPhone = Boolean(
    String(currentReminder.phone ?? "").trim()
  );
  const whatsappNumber = getWhatsAppNumber(
    currentReminder.phone
  );

  return (
    <aside
      aria-live="polite"
      className="fixed right-2 top-16 z-[9999] w-[calc(100vw-16px)] max-w-[318px] pointer-events-none sm:right-4 sm:top-20"
    >
      <section
        className="pointer-events-auto overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-[0_18px_55px_-24px_rgba(15,23,42,0.45)] backdrop-blur-xl"
        style={{ animation: "reminderPremiumIn .24s ease both" }}
      >
        {/* Quiet premium header */}
        <div className="flex items-start gap-2.5 px-3.5 pt-3.5">
          <div className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
            <BellRing className="h-4 w-4" />

            <span
              className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
                isCritical ? "bg-red-500" : "bg-amber-400"
              }`}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-slate-400">
                {isCritical ? "Important reminder" : "Reminder"}
              </p>

              <div className="flex items-center gap-1.5">
                {totalReminders > 1 && (
                  <span className="text-[9px] font-bold text-slate-400">
                    {activeIndex + 1}/{totalReminders}
                  </span>
                )}

                <button
                  type="button"
                  title="Remind again in 15 minutes"
                  aria-label="Remind again in 15 minutes"
                  onClick={() => handleSnooze(15)}
                  disabled={actionLoading}
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <h3 className="mt-0.5 truncate text-[13px] font-extrabold text-slate-800">
              {currentReminder.title}
            </h3>

            <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">
              {currentReminder.customerName}
              {currentReminder.bookingCode
                ? ` · ${currentReminder.bookingCode}`
                : ""}
            </p>
          </div>
        </div>

        {/* Essential reminder information only */}
        <div className="space-y-2.5 px-3.5 pb-3.5 pt-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-2">
            <Clock3
              className={`h-3.5 w-3.5 flex-shrink-0 ${
                isCritical ? "text-red-500" : "text-slate-500"
              }`}
            />

            <p
              className={`min-w-0 flex-1 truncate text-[11px] font-bold ${
                isCritical ? "text-red-600" : "text-slate-700"
              }`}
            >
              {getDueLabel(currentReminder.dueAt)}
            </p>

            {currentReminder.priority === "high" && (
              <span className="flex-shrink-0 rounded-md bg-red-50 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wide text-red-600">
                High
              </span>
            )}
          </div>

          <p className="line-clamp-2 text-[11px] leading-4 text-slate-600">
            {currentReminder.message}
          </p>

          {actionError && (
            <p className="rounded-lg border border-red-100 bg-red-50 px-2.5 py-1.5 text-[10px] font-bold text-red-600">
              {actionError}
            </p>
          )}

          {/* Snooze selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setSnoozeOpen((open) => !open)}
              disabled={actionLoading}
              aria-expanded={snoozeOpen}
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              <span>Snooze reminder</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${
                  snoozeOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {snoozeOpen && (
              <div className="mt-1.5 grid grid-cols-2 gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1.5 shadow-sm">
                {[
                  { label: "15 min", minutes: 15 },
                  { label: "1 hour", minutes: 60 },
                  { label: "3 hours", minutes: 180 },
                  { label: "Tomorrow", minutes: 1440 },
                ].map((option) => (
                  <button
                    key={option.minutes}
                    type="button"
                    onClick={() => handleSnooze(option.minutes)}
                    disabled={actionLoading}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Call and WhatsApp */}
          <div className="grid grid-cols-2 gap-1.5">
            {hasPhone ? (
              <>
                <a
                  href={`tel:${currentReminder.phone}`}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-bold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <Phone className="h-3 w-3" />
                  Call now
                </a>

                <a
                  href={`https://wa.me/${whatsappNumber}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-bold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <WhatsAppIcon className="h-3 w-3" />
                  WhatsApp
                </a>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled
                  title="Phone number is not available for this reminder"
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] font-bold text-slate-400"
                >
                  <Phone className="h-3 w-3" />
                  Call now
                </button>

                <button
                  type="button"
                  disabled
                  title="Phone number is not available for this reminder"
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] font-bold text-slate-400"
                >
                  <WhatsAppIcon className="h-3 w-3" />
                  WhatsApp
                </button>
              </>
            )}
          </div>

          {/* Main actions */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={handleViewDetails}
              disabled={actionLoading}
              className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              <ExternalLink className="h-3 w-3" />

              {currentReminder.source === "BOOKING"
               ? "View Booking"
               : "View Lead"}
            </button>

            <button
              type="button"
              onClick={handleComplete}
              disabled={actionLoading}
              className="flex items-center justify-center gap-1 rounded-lg bg-slate-900 px-2 py-1.5 text-[10px] font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
            >
              <CheckCircle2 className="h-3 w-3" />
              {actionLoading ? "..." : "Done"}
            </button>
          </div>

          {/* Minimal queue controls */}
          {(totalReminders > 1 || currentReminder.source === "GENERAL") && (
            <div className="flex items-center justify-between border-t border-slate-100 pt-2">
              {currentReminder.source === "GENERAL" ? (
                <button
                  type="button"
                  onClick={handleDismiss}
                  disabled={actionLoading}
                  className="text-[9px] font-bold text-slate-400 transition-colors hover:text-slate-600 disabled:opacity-50"
                >
                  Dismiss
                </button>
              ) : (
                <span />
              )}

              {totalReminders > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={activeIndex === 0}
                    onClick={() =>
                      setActiveIndex((index) => Math.max(0, index - 1))
                    }
                    aria-label="Previous reminder"
                    className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-30"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    disabled={activeIndex === totalReminders - 1}
                    onClick={() =>
                      setActiveIndex((index) =>
                        Math.min(totalReminders - 1, index + 1)
                      )
                    }
                    aria-label="Next reminder"
                    className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-30"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {fetching && (
            <p className="text-right text-[8px] text-slate-400">
              Refreshing…
            </p>
          )}
        </div>
      </section>

      <style>{`
        @keyframes reminderPremiumIn {
          from {
            opacity: 0;
            transform: translateX(18px) translateY(-4px) scale(.98);
          }
          to {
            opacity: 1;
            transform: translateX(0) translateY(0) scale(1);
          }
        }

        @media (max-width: 380px) {
          .reminder-premium-card {
            max-width: calc(100vw - 16px);
          }
        }
      `}</style>
    </aside>
  );
}