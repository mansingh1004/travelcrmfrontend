
import { memo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom"; 
import {
  Menu, Plane, Bell, User, ChevronDown, ChevronRight,
  Search, Settings, LogOut, HelpCircle, CheckCheck,
} from "lucide-react";
import { notificationService } from "@features/reminders";
import { companyService } from "@features/settings"; 
import { getErrorMessage } from "@shared/api/apiError";
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
};
const typeDot = (type = "") =>
  Object.entries(TYPE_DOT).find(([k]) => type.includes(k))?.[1] ?? "bg-slate-400";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
const bellAuthHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

async function fetchReminderAlerts() {
  try {
    const [ovRes, dtRes] = await Promise.all([
      fetch(`${API_BASE}/reminders/overdue`, { headers: bellAuthHeaders() }),
      fetch(`${API_BASE}/reminders/due-today`, { headers: bellAuthHeaders() }),
    ]);
    const overdue = ovRes.ok ? await ovRes.json() : [];
    const dueToday = dtRes.ok ? await dtRes.json() : [];
    const seen = new Set();
    return [...overdue, ...dueToday]
      .filter((r) => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      })
      .map((r) => ({
        id: `rem-${r.id}`,
        kind: "reminder",
        type: "REMIND",
        title: r.title,
        message: r.description || r.notes || "Reminder due",
        createdAt: r.dueDate,
        status: "UNREAD",
        link: "/Reminders",
      }));
  } catch {
    return [];
  }
}

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
  appName     = "Travixa",
  breadcrumb,
  onNewBooking,
}) {
  const navigate = useNavigate();

  const [dropdownOpen,  setDropdownOpen]  = useState(false);
  const [notifOpen,     setNotifOpen]     = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [reminderCount, setReminderCount] = useState(0);
  const [loading,       setLoading]       = useState(false);
  const sseRef = useRef(null);

  const badgeCount = unreadCount + reminderCount;
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

    if (savedEmail || savedRole) {
      const formattedRole = 
        savedRole === 'super_admin' ? 'Super Admin' :
        savedRole === 'admin' ? 'Tenant Admin' : 'Standard User';
      const emailName = savedEmail ? savedEmail.split('@')[0] : 'User';

      setLocalUser({
        email: savedEmail || 'No Email',
        role: formattedRole,
        name: emailName,
        initials: emailName.substring(0, 2).toUpperCase()
      });
    }
  }, []);

  useEffect(() => {
    notificationService.getUnreadCount().then(setUnreadCount).catch(() => setUnreadCount(0));
    fetchReminderAlerts().then((alerts) => setReminderCount(alerts.length)).catch(() => setReminderCount(0));
    sseRef.current = notificationService.subscribeToSSE((incoming) => {
      setNotifications((prev) => [{ ...incoming, kind: "notification" }, ...prev].slice(0, 20));
      setUnreadCount((c) => c + 1);
    });
    return () => sseRef.current?.close();
  }, []);

  const handleNotifOpen = async () => {
    const opening = !notifOpen;
    setNotifOpen(opening);
    setDropdownOpen(false);
    if (opening) {
      setLoading(true);
      try {
        const [data, reminderAlerts] = await Promise.all([
          notificationService.getNotifications({ size: 10 }),
          fetchReminderAlerts(),
        ]);
        const notifs = (data.content ?? []).map((n) => ({ ...n, kind: "notification" }));
        setReminderCount(reminderAlerts.length);
        const merged = [...notifs, ...reminderAlerts].sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
        setNotifications(merged);
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
    setNotifications((prev) =>
      prev.map((n) => (n.kind === "reminder" ? n : { ...n, status: "READ" }))
    );
    setUnreadCount(0);
  };

  const NOTIF_ROUTE_MAP = {
    LEAD: "/allleads",
    BOOKING: "/Allbookings",
    REMINDER: "/Reminders",
    CUSTOMER: "/AllCustomers",
    VENDOR: "/AllVendors",
  };

  const handleClickNotif = async (notif) => {
    if (notif.kind === "reminder") {
      setNotifOpen(false);
      navigate(notif.link || "/Reminders");
      return;
    }
    if (notif.status === "UNREAD") {
      try {
        await markNotificationReadById(notif.id);
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

  const closeAll = () => { setDropdownOpen(false); setNotifOpen(false); };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userRole");
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

        {/* New Booking CTA (Hidden on tiny phones, visible everywhere else) */}
        <button
          onClick={onNewBooking}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 active:scale-95 transition-all text-xs font-semibold border border-blue-100"
        >
          <Plane size={14} className="-rotate-45" />
          <span className="hidden lg:block">New Booking</span>
        </button>

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
            onClick={() => { setDropdownOpen(!dropdownOpen); setNotifOpen(false); }}
            className="flex items-center gap-2 p-1 sm:pl-1 sm:pr-2 rounded-full hover:bg-slate-100 active:scale-95 transition-all"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[11px] font-bold shadow-sm flex-shrink-0 border-2 border-white">
              {localUser.initials}
            </div>
            <div className="hidden md:block text-left mr-1">
              <p className="text-[13px] font-semibold text-slate-800 leading-none mb-0.5">{localUser.name}</p>
              <p className="text-[10px] text-slate-500 leading-none">{localUser.role}</p>
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
                  <p className="text-sm font-semibold text-slate-800 truncate">{localUser.name}</p>
                  <p className="text-xs text-slate-500 truncate">{localUser.email}</p>
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
      {(dropdownOpen || notifOpen) && (
        <div className="fixed inset-0 z-[-1]" onClick={closeAll} />
      )}
    </header>
  );
});

export default Navbar;