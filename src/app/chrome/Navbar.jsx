
import { memo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom"; 
import {
  Menu, Plane, Bell, User, ChevronDown, ChevronRight, CalendarPlus,
  Settings, LogOut, HelpCircle, CheckCheck, Zap,
} from "lucide-react";
import { notificationService } from "@features/reminders";
import BookingReminderBell from "./BookingReminderBell";
import ReminderBell from "./ReminderBell";
import { companyService } from "@features/settings";
import { getErrorMessage } from "@shared/api/apiError";
import { hasPermission, P } from "@shared/lib/access";
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
              <span className="text-slate-700 font-medium">{item.label}</span>
            ) : (
              <a href={item.href ?? "#"} className="text-slate-400 hover:text-slate-600 transition-colors">
                {item.label}
              </a>
            )}
          </span>
        );
      })}
    </nav>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const Navbar = memo(function Navbar({
  toggleSidebar,
  appName     = "TravelCRM",
  breadcrumb,
}) {
  const navigate = useNavigate();

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
  const canCreateBooking = hasPermission(P.BOOKING_CREATE);
  const canCreateLead = hasPermission(P.LEAD_CREATE);
  const [company, setCompany] = useState(null);
  const menuItems = [
  { icon: User, label: "My Profile", path: "/CompanyProfile" },
  { icon: Settings, label: "Settings", path: "/CompanySettings" },
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

  const NOTIF_ROUTE_MAP = {
    LEAD: "/allleads",
    BOOKING: "/Allbookings",
    REMINDER: "/Reminders",
    CUSTOMER: "/AllCustomers",
    VENDOR: "/AllVendors",
    // An unmapped referenceType makes the notification silently unclickable. Task notifications
    // have been published with referenceType "TASK" since the task module shipped, but the backend
    // enum did not list it, so they persisted as null and never reached this map at all.
    TASK: "/tasks",
  };

  const handleClickNotif = async (notif) => {
    if (notif.status === "UNREAD") {
      try {
        // publicId first: the service is documented as markRead(publicId) and the Notifications
        // page passes one. The bell was sending the numeric `id`, so a read never registered
        // server-side and the count returned on refresh. `?? id` keeps it working if a payload
        // ever arrives without a publicId.
        await markNotificationReadById(notif.publicId ?? notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, status: "READ" } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch (err) {
        toast.error(getErrorMessage(err, "Couldn't mark that notification as read."));
      }
    }
    const dest = NOTIF_ROUTE_MAP[notif.referenceType];
    if (dest) {
      setNotifOpen(false);
      navigate(dest);
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
    navigate("/login");
  };

  // ──────────────────────────────────────────────────────────────────────────

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-6 lg:px-8 w-full sticky top-0 z-40 shadow-sm transition-all duration-300">

      {/* ── Left: toggle + logo + breadcrumb ─────────────────── */}
      <div className="flex items-center gap-3 md:gap-5 min-w-0">

        {/* Sidebar toggle - Visible everywhere so desktop mini-sidebar can expand */}
        {toggleSidebar && (
          <button
            onClick={toggleSidebar}
            className="p-2 -ml-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 active:scale-95 transition-all"
            aria-label="Toggle sidebar"
          >
            <Menu size={20} />
          </button>
        )}

        {/* Logo */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-sm overflow-hidden ring-1 ring-slate-200">
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
          <span className="hidden sm:block font-extrabold text-slate-800 text-[15px] md:text-[16px] tracking-tight">
            {appName.replace("TravelCRM", "Travel")}
            <span className="text-blue-600">
              {appName === "TravelCRM" ? "CRM" : ""}
            </span>
          </span>
        </div>

        {/* Divider + breadcrumb (Hidden on mobile, visible on desktop lg:) */}
        {breadcrumb && (
          <>
            <span className="hidden lg:block w-px h-5 bg-slate-200 flex-shrink-0 ml-1" />
            <Breadcrumb items={breadcrumb} />
          </>
        )}
      </div>

      {/* ── Right: actions ────────────────────────────────────── */}
      <div className="flex items-center gap-2 sm:gap-4">

        {/* Real Desktop Search Bar (Hidden on Mobile, Visible on Tablet/Desktop) */}
        {/* <div className="hidden md:flex relative max-w-xs xl:max-w-sm mr-2">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search..." 
            className="w-full pl-9 pr-4 py-1.5 bg-slate-100 border-transparent rounded-lg text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
          />
        </div> */}

        {/* Mobile Search Icon (Hidden on Tablet/Desktop) */}
        {/* <button className="md:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition">
          <Search size={18} />
        </button> */}

        {/* Fast-create menu: booking and Rapid Lead stay one click away without crowding the navbar. */}
        {(canCreateBooking || canCreateLead) && (
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setCreateOpen((open) => !open);
                setDropdownOpen(false);
                setNotifOpen(false);
              }}
              aria-label="Create booking or rapid lead"
              aria-haspopup="menu"
              aria-expanded={createOpen}
              title="Quick Create"
              className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-600 transition-all hover:bg-blue-100 active:scale-95 sm:px-3"
            >
              <CalendarPlus size={15} />
              <span className="hidden lg:block">Quick Create</span>
              <ChevronDown size={13} className={`hidden transition-transform sm:block ${createOpen ? "rotate-180" : ""}`} />
            </button>

            {createOpen && (
              <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-200/60">
                {canCreateBooking && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setCreateOpen(false); navigate("/CreateBooking"); }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-blue-50"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                      <CalendarPlus size={17} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-slate-800">Create Booking</span>
                      <span className="block text-[11px] text-slate-500">Start a new confirmed trip</span>
                    </span>
                  </button>
                )}
                {canCreateLead && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setCreateOpen(false); navigate("/createlead?mode=rapid"); }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-violet-50"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                      <Zap size={17} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-slate-800">New Enquiry · Rapid</span>
                      <span className="block text-[11px] text-slate-500">Fast intake and quick quotation</span>
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Booking reminders — deliberately NOT `hidden sm:flex` like the button above it, which
            disappears below 640px. This has to stay reachable on phones. */}
        <BookingReminderBell />

        {/* General (lead / follow-up) reminders — separate from booking reminders above and
            from the notification bell below. Also not `hidden sm:flex`: stays usable on phones. */}
        <ReminderBell />

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
                    key={n.id}
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
