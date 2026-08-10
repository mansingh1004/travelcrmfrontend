
import { memo, useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Menu, Plane, Bell, User, ChevronDown, ChevronRight,
  LogOut, HelpCircle, CheckCheck, Search, Plus,
} from "lucide-react";
import { useNav } from "../nav/NavProvider";
import { notificationService } from "@features/reminders";
import BookingReminderBell from "./BookingReminderBell";
import ReminderBell from "./ReminderBell";
import { companyService } from "@features/settings";
import { getErrorMessage } from "@shared/api/apiError";
import { clearMyEntitlements, clearMyPermissions, hasPermission, hasModule, P } from "@shared/lib/access";
import { toast } from "@shared/ui/toast";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso) {
  const m = Math.floor((Date.now() - new Date(iso)) / 60_000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const TYPE_DOT = {
  BOOKING: "bg-blue-500",
  PAYMENT: "bg-emerald-500",
  LEAD:    "bg-violet-500",
  REMIND:  "bg-amber-500",
  // Substring match, so this one key covers TASK_ASSIGNED / TASK_COMPLETED / TASK_OVERDUE.
  TASK:    "bg-rose-500",
};
const typeDot = (type = "") =>
  Object.entries(TYPE_DOT).find(([k]) => type.includes(k))?.[1] ?? "bg-slate-400";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
const bellAuthHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

// The backend writes a notification row when a reminder falls due — same taxonomy the
// Notifications page uses to bucket them as "Reminder_alert" (type containing REMIND / LEAD).
// Those belong to the reminder icon, not the bell, so the bell filters them out. LEAD is NOT
// matched here: a lead notification is a real notification, it is only the reminder-generated
// ones we are moving.
const isReminderNotif = (n) => (n?.type || "").toUpperCase().includes("REMIND");

const unreadOf = (list = []) =>
  list.filter((n) => !isReminderNotif(n) && n.status === "UNREAD").length;

async function markNotificationReadById(id) {
  const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
    method: "PUT",
    headers: bellAuthHeaders(),
  });
  if (!res.ok) {
    console.warn(`PUT /api/notifications/${id}/read failed with ${res.status}`);
    throw new Error("Couldn't mark that notification as read.");
  }
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────

function Breadcrumb({ items }) {
  if (!items) return null;

  if (!Array.isArray(items)) {
    return (
      <nav aria-label="breadcrumb" className="hidden lg:flex items-center gap-1 text-xs text-slate-400">
        {items}
      </nav>
    );
  }

  return (
    <nav aria-label="breadcrumb" className="hidden lg:flex items-center gap-1 text-xs">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={11} className="text-slate-300 flex-shrink-0" />}
            {isLast ? (
              <span className="text-slate-400 font-medium">{item.label}</span>
            ) : item.href ? (
              // A real client-side Link, not an <a>: an anchor here reloaded the whole
              // SPA — losing every cached page chunk — just to move up one level.
              <Link to={item.href} className="text-slate-400 hover:text-slate-600 transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className="text-slate-400">{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const isMacPlatform =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || "");

// Quick Create icon chips. Light surface, so the soft-bg / strong-fg pairing
// rather than the rail's dark-surface ramp.
const CREATE_TONE = {
  violet: "bg-violet-100 text-violet-600",
  cyan: "bg-cyan-100 text-cyan-600",
  emerald: "bg-emerald-100 text-emerald-600",
  teal: "bg-teal-100 text-teal-600",
  orange: "bg-orange-100 text-orange-600",
  amber: "bg-amber-100 text-amber-600",
  rose: "bg-rose-100 text-rose-600",
  sky: "bg-sky-100 text-sky-600",
  pink: "bg-pink-100 text-pink-600",
  slate: "bg-slate-100 text-slate-600",
};

const Navbar = memo(function Navbar({
  appName     = "TravelCRM",
  breadcrumb,
}) {
  const navigate = useNavigate();

  // Nav state lives in NavProvider so the rail, the tab bar, the launcher and this
  // header can never disagree about what is open.
  const {
    accountItems,
    quickActions,
    breadcrumb: autoBreadcrumb,
    activeDestination,
    setPaletteOpen,
    openLauncher,
  } = useNav();

  // An explicit `breadcrumb` prop still wins — a page that knows something the
  // registry cannot (a record's name, say) should be able to say so.
  const crumbs = breadcrumb ?? autoBreadcrumb;

  // Quick Create is now driven by the same gated registry the ⌘K palette uses, so
  // every create form in the app is offered here — the hand-written version listed
  // two of thirteen. `group` keeps the menu scannable at that length.
  const createGroups = quickActions.reduce((acc, action) => {
    const key = action.group || "Create";
    (acc[key] ||= []).push(action);
    return acc;
  }, {});

  const [dropdownOpen,  setDropdownOpen]  = useState(false);
  const [notifOpen,     setNotifOpen]     = useState(false);
  const [createOpen,    setCreateOpen]    = useState(false);
  // The booking-reminder and reminder icons navigate straight to their pages — they hold no
  // open-state, so only the notification bell and the profile menu take part in the dropdown
  // exclusion below.
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [loading,       setLoading]       = useState(false);
  const sseRef = useRef(null);

  // The bell is notifications-only: the badge is the server's unread-notification count and
  // nothing else. Reminders have their own surface and must never be added back in here.
  const badgeCount = unreadCount;
  // (The old canCreateBooking / canCreateLead pair is gone: Quick Create now reads
  //  its whole list — and its gates — from the nav registry.)
  const [company, setCompany] = useState(null);

  // Account destinations come from the nav registry, so they are gated the same way
  // as everything else (a sub-agent has no company profile or subscription page)
  // and stay searchable from ⌘K. This menu is now their ONLY home — the rail drops
  // them so it can stay a short list of work screens.
  const menuItems = [
    ...accountItems.map((item) => ({ icon: item.Icon ?? User, label: item.label, path: item.path })),
    { icon: HelpCircle, label: "Help & Support", path: "#" },
  ];

  useEffect(() => {
    const loadCompany = () => {
      if (!localStorage.getItem("token")) return;
      companyService
        .get()
        .then((res) => setCompany(res.data?.data ?? res.data ?? null))
        .catch(() => setCompany(null));
    };

    loadCompany();
    window.addEventListener("company-updated", loadCompany);
    return () => window.removeEventListener("company-updated", loadCompany);
  }, []);

  useEffect(() => {
    const url = company?.faviconUrl;
    if (!url) return;
    document.querySelectorAll("link[rel~='icon']").forEach((el) => el.remove());
    const link = document.createElement("link");
    link.rel  = "icon";
    link.type = url.toLowerCase().endsWith(".ico") ? "image/x-icon" : "image/png";
    link.href = `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`;
    document.head.appendChild(link);
  }, [company?.faviconUrl]);

  useEffect(() => {
    if (company?.name) document.title = company.name;
  }, [company?.name]);

  const [localUser, setLocalUser] = useState({
    name: "User",
    email: "loading...",
    role: "User",
    initials: "U"
  });

  useEffect(() => {
    const savedEmail = localStorage.getItem('userEmail');
    const savedRole = localStorage.getItem('userRole');
    // The person's real full name, stamped at login from the API response.
    const savedName = localStorage.getItem('userName');

    if (savedEmail || savedRole || savedName) {
      const formattedRole =
        savedRole === 'super_admin' ? 'Super Admin' :
        savedRole === 'admin' ? 'Tenant Admin' : 'Standard User';

      // Prefer the stored full name. The email local-part is only a last-resort fallback for a
      // session that predates userName being stamped — it is NOT a valid display name any more,
      // because staff email is no longer unique: a whole office sharing info@agency.com would
      // otherwise every one of them show up as "info".
      const displayName = (savedName && savedName.trim())
        || (savedEmail ? savedEmail.split('@')[0] : 'User');

      // Initials from the name: first letter of the first two words ("Demo Admin" → "DA"),
      // falling back to the first two characters for a single-word name.
      const words = displayName.trim().split(/\s+/).filter(Boolean);
      const initials = (words.length >= 2
        ? words[0][0] + words[1][0]
        : displayName.substring(0, 2)).toUpperCase();

      setLocalUser({
        email: savedEmail || 'No Email',
        role: formattedRole,
        name: displayName,
        initials
      });
    }
  }, []);

  useEffect(() => {
    // NOT getUnreadCount(): the server counts every unread row, including the notifications it
    // mints when a reminder falls due (type contains REMIND). Those belong to the reminder icon,
    // so the badge is derived from the same filtered list the dropdown renders — otherwise the
    // count and the rows disagree.
    notificationService
      .getNotifications({ size: 50 })
      .then((data) => setUnreadCount(unreadOf(data.content)))
      .catch(() => setUnreadCount(0));

    sseRef.current = notificationService.subscribeToSSE((incoming) => {
      if (isReminderNotif(incoming)) return;   // reminder pushes belong to the reminder icon
      setNotifications((prev) => [incoming, ...prev].slice(0, 20));
      setUnreadCount((c) => c + 1);
    });
    return () => sseRef.current?.close();
  }, []);

  const handleNotifOpen = async () => {
    const opening = !notifOpen;
    setNotifOpen(opening);
    setDropdownOpen(false);
    setCreateOpen(false);
    if (opening) {
      setLoading(true);
      try {
        // 50, not 10: reminder-type rows are filtered out below, so a small page could come
        // back almost empty once they are dropped.
        const data = await notificationService.getNotifications({ size: 50 });
        const visible = (data.content ?? []).filter((n) => !isReminderNotif(n));
        setNotifications(visible.slice(0, 20));
        setUnreadCount(unreadOf(visible));
      } catch (err) {
        setNotifications([]);
        toast.error(getErrorMessage(err, "Couldn't load notifications."));
      } finally {
        setLoading(false);
      }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead();
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't mark notifications as read."));
      return;
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, status: "READ" })));
    setUnreadCount(0);
  };

  // referenceType → destination. Each entry is a function of the notification's
  // referencePublicId, so a notification lands on the RECORD it is about instead of dumping the
  // user at the top of an unfiltered list to find it by hand.
  //
  // Only types whose detail route genuinely accepts a UUID deep-link:
  //   • LEAD     /EditLead/:id      — leadService is publicId-keyed throughout
  //   • BOOKING  /BookingDetails/:id — bookingService: "a booking id is its publicId (UUID)"
  //   • CUSTOMER /CustomerDetails/:id — CustomerController @PathVariable UUID id
  // VENDOR deliberately stays a list link: VendorController's /{id} is a @PathVariable **Long**,
  // so feeding it a referencePublicId would 400. Give Vendor a UUID lookup before changing this.
  // REMINDER and TASK have no detail route at all yet.
  const NOTIF_ROUTE_MAP = {
    LEAD: (ref) => (ref ? `/EditLead/${ref}` : "/allleads"),
    BOOKING: (ref) => (ref ? `/BookingDetails/${ref}` : "/Allbookings"),
    CUSTOMER: (ref) => (ref ? `/CustomerDetails/${ref}` : "/AllCustomers"),
    VENDOR: () => "/AllVendors",
    REMINDER: () => "/Reminders",
    // An unmapped referenceType makes the notification silently unclickable. Task notifications
    // have been published with referenceType "TASK" since the task module shipped, but the backend
    // enum did not list it, so they persisted as null and never reached this map at all.
    TASK: () => "/tasks",
  };

  const handleClickNotif = async (notif) => {
    if (notif.status === "UNREAD") {
      try {
        // publicId first: the service is documented as markRead(publicId) and the Notifications
        // page passes one. The bell was sending the numeric `id`, so a read never registered
        // server-side and the count returned on refresh. `?? id` keeps it working if a payload
        // ever arrives without a publicId.
        await markNotificationReadById(notif.publicId ?? notif.id);
        // Match on publicId. NotificationResponseDTO carries NO `id` field at all (it is
        // documented backend-side as "publicId is the only identifier consumers get"), so
        // `n.id === notif.id` was `undefined === undefined` — true for EVERY row. One click
        // greyed the whole dropdown while the badge dropped by one, and reopening the bell
        // silently reverted it.
        setNotifications((prev) =>
          prev.map((n) => (n.publicId === notif.publicId ? { ...n, status: "READ" } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch (err) {
        toast.error(getErrorMessage(err, "Couldn't mark that notification as read."));
      }
    }
    const resolve = NOTIF_ROUTE_MAP[notif.referenceType];
    if (resolve) {
      setNotifOpen(false);
      navigate(resolve(notif.referencePublicId));
    }
  };

  const closeAll = () => { setDropdownOpen(false); setNotifOpen(false); setCreateOpen(false); };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userRole");
    // Must be cleared with the rest: a surviving userName shows the previous person's name in the
    // Navbar until the next login overwrites it.
    localStorage.removeItem("userName");
    // This is now the ONLY sign-out in the shell (the rail's copy is gone), so it
    // has to do the full clear the rail used to do. Leaving these behind means the
    // next person on a shared browser renders against the previous user's cached
    // permissions and module entitlements until their own fetch lands.
    clearMyPermissions();
    clearMyEntitlements();
    navigate("/login");
  };

  // ──────────────────────────────────────────────────────────────────────────

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-6 lg:px-8 w-full sticky top-0 z-40 shadow-sm transition-all duration-300">

      {/* ── Left: toggle + context (logo on mobile, page title on desktop) ───── */}
      <div className="flex items-center gap-2 md:gap-4 min-w-0">

        {/* The 3-line button opens "All apps". Collapsing the rail lives on the rail
            itself (and ⌘B); opening the mobile drawer lives on the bottom tab bar —
            so this one keeps a single, predictable job at every width. */}
        <button
          onClick={(e) => openLauncher(e.currentTarget)}
          className="p-2 -ml-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 active:scale-95 transition-all"
          aria-label="All apps"
          title="All apps"
        >
          <Menu size={20} />
        </button>

        {/* Logo — phones only. On desktop the sidebar already carries the brand, so
            this space goes to the page title and the search box instead of showing
            the same logo twice. */}
        <div className="flex items-center gap-2.5 flex-shrink-0 md:hidden">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-sm overflow-hidden ring-1 ring-slate-200">
            {company?.logoUrl ? (
              <img
                src={company.logoUrl}
                alt={company.name || "Company logo"}
                className="w-full h-full object-contain bg-white p-0.5"
              />
            ) : (
              <Plane size={15} className="text-white -rotate-45" />
            )}
          </div>
          <span className="hidden sm:block font-extrabold text-slate-800 text-[15px] tracking-tight">
            {appName.replace("TravelCRM", "Travel")}
            <span className="text-blue-600">{appName === "TravelCRM" ? "CRM" : ""}</span>
          </span>
        </div>

        {/* Where you are — derived from the nav registry, so every screen gets one
            without each page having to remember to pass it. */}
        {/* Page title, with the module it belongs to underneath. Two levels, which
            is exactly how deep the navigation goes — no invented hierarchy. */}
        <div className="hidden min-w-0 md:block">
          <p className="truncate text-[15px] font-bold leading-tight text-slate-800">
            {activeDestination?.label ?? company?.name ?? appName}
          </p>
          {crumbs && <Breadcrumb items={crumbs} />}
        </div>
      </div>

      {/* ── Middle: global search ─────────────────────────────────────────────
          Opens the ⌘K palette rather than being a live input: one search surface,
          one result ranking, and it works identically from the sidebar button, the
          keyboard and here. */}
      <div className="hidden flex-1 justify-center px-4 md:flex lg:px-8">
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="flex w-full max-w-md items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400 transition-colors hover:border-slate-300 hover:bg-white"
        >
          <Search size={15} className="shrink-0" />
          <span className="flex-1 truncate text-left">Search leads, customers, bookings…</span>
          <kbd className="hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 font-sans text-[10px] font-semibold text-slate-500 lg:block">
            {isMacPlatform ? "⌘" : "Ctrl"} K
          </kbd>
        </button>
      </div>

      {/* ── Right: actions ────────────────────────────────────── */}
      <div className="flex items-center gap-2 sm:gap-3">

        {/* Search — phones, where the middle bar is not rendered. */}
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="md:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
          aria-label="Search"
        >
          <Search size={19} />
        </button>

        {/* Quick Create — every create form the caller is allowed to open. */}
        {quickActions.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setCreateOpen((open) => !open);
                setDropdownOpen(false);
                setNotifOpen(false);
              }}
              aria-label="Quick create"
              aria-haspopup="menu"
              aria-expanded={createOpen}
              title="Quick Create"
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95 sm:px-3"
            >
              <Plus size={15} />
              <span className="hidden lg:block">Quick Create</span>
              <ChevronDown size={13} className={`hidden transition-transform sm:block ${createOpen ? "rotate-180" : ""}`} />
            </button>

            {createOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-2 max-h-[70vh] w-72 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-200/60"
              >
                {Object.entries(createGroups).map(([group, actions]) => (
                  <div key={group} className="pb-1 last:pb-0">
                    <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      {group}
                    </p>
                    {actions.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        role="menuitem"
                        onClick={() => { setCreateOpen(false); action.run(); }}
                        className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition hover:bg-slate-50"
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            CREATE_TONE[action.tone] || CREATE_TONE.slate
                          }`}
                        >
                          <action.Icon size={16} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-bold text-slate-800">
                            {action.label}
                          </span>
                          {action.sublabel && (
                            <span className="block truncate text-[11px] text-slate-500">
                              {action.sublabel}
                            </span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Booking reminders — deliberately NOT `hidden sm:flex` like the button above it, which
            disappears below 640px. This has to stay reachable on phones.

            GATED. Both bells fetch on mount with no permission check, so a user without the
            permission (an accountant has no REMINDER_READ) or without the module got a 403 on
            every page load — and authRealm toasts PERMISSION_DENIED / MODULE_NOT_ENABLED. The
            bell's own .catch(() => 0) hid it from the badge but not from the interceptor.
            Same gates the nav registry already applies to these destinations. */}
        {hasPermission(P.BOOKING_READ) && hasModule("BOOKINGS") && <BookingReminderBell />}

        {/* General (lead / follow-up) reminders — separate from booking reminders above and
            from the notification bell below. Also not `hidden sm:flex`: stays usable on phones. */}
        {hasPermission(P.REMINDER_READ) && <ReminderBell />}

        {/* Bell */}
        <div className="relative">
          <button
            onClick={handleNotifOpen}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 active:scale-95 transition-all relative"
            aria-label="Notifications"
          >
            <Bell size={19} />
            {badgeCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-0.5 bg-rose-500 rounded-full ring-2 ring-white flex items-center justify-center text-[9px] font-bold text-white leading-none">
                {badgeCount > 99 ? "99+" : badgeCount}
              </span>
            )}
          </button>

          {/* Notif Dropdown - Responsive width fixes */}
          {notifOpen && (
            <div className="absolute -right-2 sm:right-0 top-full mt-2 w-[calc(100vw-24px)] sm:w-80 md:w-96 bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/60 overflow-hidden z-50 origin-top-right">
              {/* Header */}
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800">Notifications</p>
                  {badgeCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-600 text-[10px] font-bold leading-none">
                      {badgeCount}
                    </span>
                  )}
                </div>
                {badgeCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="flex items-center gap-1 text-xs text-blue-600 font-medium hover:underline"
                  >
                    <CheckCheck size={11} />
                    Mark all read
                  </button>
                )}
              </div>

              {/* List */}
              <div className="divide-y divide-slate-50 max-h-72 md:max-h-96 overflow-y-auto custom-scrollbar">
                {loading ? (
                  <div className="py-8 text-center text-slate-400 text-xs">Loading…</div>
                ) : notifications.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    <Bell size={22} className="mx-auto mb-2 opacity-20" />
                    No notifications yet
                  </div>
                ) : notifications.map((n) => (
                  <div
                    key={n.publicId}
                    onClick={() => handleClickNotif(n)}
                    className={`px-4 py-3 cursor-pointer transition flex items-start gap-3
                      ${n.status === "UNREAD" ? "bg-blue-50/40 hover:bg-blue-50" : "hover:bg-slate-50"}`}
                  >
                    <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${typeDot(n.type)}`} />
                    <div className="min-w-0">
                      <p className={`text-[13px] sm:text-sm leading-snug ${n.status === "UNREAD" ? "text-slate-800 font-semibold" : "text-slate-600 font-medium"}`}>
                        {n.title}
                      </p>
                      {n.message && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{n.message}</p>
                      )}
                      <p className="text-[10px] text-slate-400 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div
                onClick={() => navigate("/Notifications")}
                className="px-4 py-2.5 border-t border-slate-100 text-center bg-slate-50 hover:bg-slate-100 transition cursor-pointer"
               >
              <span className="text-xs text-blue-600 font-semibold">
                 View all notifications
              </span>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-slate-200 hidden sm:block mx-1" />

        {/* User dropdown */}
        <div className="relative">
          <button
            onClick={() => { setDropdownOpen(!dropdownOpen); setNotifOpen(false); setCreateOpen(false); }}
            className="flex items-center gap-2 p-1 sm:pl-1 sm:pr-2 rounded-full hover:bg-slate-100 active:scale-95 transition-all"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[11px] font-bold shadow-sm flex-shrink-0 border-2 border-white">
              {localUser.initials}
            </div>
            {/* min-w-0 lets this flex child shrink, max-w caps it: without both, a long full name
                ("Rajeshwari Venkataraman") stretches the button and pushes the navbar layout.
                `truncate` then renders it as "Rajeshwari Ve…"; title reveals it in full on hover.
                leading-tight, not leading-none — truncate adds overflow-hidden, and a line box
                exactly one em tall clips the descenders on g/j/p/q/y. */}
            <div className="hidden md:block text-left mr-1 min-w-0 max-w-[9.5rem]">
              <p className="text-[13px] font-semibold text-slate-800 leading-tight mb-0.5 truncate"
                 title={localUser.name}>{localUser.name}</p>
              <p className="text-[10px] text-slate-500 leading-none truncate">{localUser.role}</p>
            </div>
            <ChevronDown
              size={14}
              className={`hidden md:block text-slate-400 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
            />
          </button>

          {/* User Profile Menu - Responsive positioning */}
          {dropdownOpen && (
            <div className="absolute -right-2 sm:right-0 top-full mt-2 w-56 bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/60 overflow-hidden z-50 origin-top-right">
              {/* Profile Header */}
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-inner">
                  {localUser.initials}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate"
                     title={localUser.name}>{localUser.name}</p>
                  <p className="text-xs text-slate-500 truncate"
                     title={localUser.email}>{localUser.email}</p>
                </div>
              </div>

              {/* Menu Links */}
              

              <div className="py-2">
                {menuItems.map(({ icon: Icon, label, path }) => (
                  <button
                    key={label}
                    onClick={() => navigate(path)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors text-left"
                  >
                    <Icon size={16} className="text-slate-400" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {/* Logout Button */}
              <div className="border-t border-slate-100 py-2">
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-rose-500 hover:bg-rose-50 transition-colors text-left"
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Click-outside overlay */}
      {(dropdownOpen || notifOpen || createOpen) && (
        <div className="fixed inset-0 z-[-1]" onClick={closeAll} />
      )}
    </header>
  );
});

export default Navbar;
