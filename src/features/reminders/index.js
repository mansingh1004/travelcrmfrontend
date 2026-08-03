// src/features/reminders/index.js
// Public API of the reminders feature.
// notificationService is exported for the app chrome (Navbar bell).

export { default as Reminders } from "./pages/Reminders";
export { default as CreateReminder } from "./pages/CreateReminder";
export { default as BookingReminders } from "./pages/BookingReminders";
export { default as Notifications } from "./pages/Notifications";
export { default as NotificationSettings } from "./pages/NotificationSettings";
export { default as notificationService } from "./api/notificationService";
export { default as bookingReminderService } from "./api/bookingReminderService";
export { default as reminderService, extractReminderList } from "./api/reminderService";

