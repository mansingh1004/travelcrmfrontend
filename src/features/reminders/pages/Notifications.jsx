import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell as FiBell, Mail as FiMail, Clock as FiClock, TriangleAlert as FiAlertTriangle, Check as FiCheck, Trash2 as FiTrash2, RefreshCw as FiRefreshCw, BellOff as FiBellOff, Banknote as FaMoneyBillWave, BookUser as FaPassport, CircleAlert as FaExclamationCircle, MailCheck as MdOutlineMarkEmailRead,ChevronDown as FiChevronDown,
ChevronUp as FiChevronUp,
BarChart3 as FiBarChart3, } from "lucide-react";


import notificationService from "../api/notificationService";

/* ─── MOCK DATA ──────────────────────────────────────────────── */


const CATEGORY_CFG = {
  Reminder_alert: { label:"Reminder Alert", icon:<FiClock className="w-4 h-4"/>,             bg:"bg-blue-100",   text:"text-blue-700",   iconBg:"bg-blue-500",   grad:"from-blue-500 to-indigo-500",     accent:"bg-blue-500",   glow:"shadow-blue-200/60"   },
  Escalation:     { label:"Escalation",     icon:<FaExclamationCircle className="w-4 h-4"/>, bg:"bg-red-100",    text:"text-red-700",    iconBg:"bg-red-500",    grad:"from-red-500 to-rose-500",        accent:"bg-red-500",    glow:"shadow-red-200/60"    },
  Payment:        { label:"Payment",        icon:<FaMoneyBillWave className="w-4 h-4"/>,     bg:"bg-green-100",  text:"text-green-700",  iconBg:"bg-green-500",  grad:"from-emerald-500 to-green-500",   accent:"bg-emerald-500",glow:"shadow-emerald-200/60"},
  Document:       { label:"Document",       icon:<FaPassport className="w-4 h-4"/>,          bg:"bg-amber-100",  text:"text-amber-700",  iconBg:"bg-amber-500",  grad:"from-amber-500 to-orange-500",    accent:"bg-amber-500",  glow:"shadow-amber-200/60"  },
  System:         { label:"System",         icon:<FiBell className="w-4 h-4"/>,              bg:"bg-slate-100",  text:"text-slate-600",  iconBg:"bg-slate-500",  grad:"from-slate-500 to-slate-600",     accent:"bg-slate-400",  glow:"shadow-slate-200/60"  },
};

const FILTERS = ["All Notifications", "Unread", "Reminder Alerts", "Escalations"];

/* ─── HELPERS ────────────────────────────────────────────────── */
function timeAgo(dateStr) {
  const now  = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const mins  = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (mins < 1)   return "Just now";
  if (mins < 60)  return `${mins} min${mins !== 1 ? "s" : ""} ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  if (days < 7)   return `${days} day${days !== 1 ? "s" : ""} ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
}

/* ─── TOAST ──────────────────────────────────────────────────── */
function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed top-5 right-5 z-[999] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl max-w-xs
      ${type === "success" ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}
      style={{ animation: "slideIn .3s ease both" }}>
      <span className="text-lg">{type === "success" ? "✅" : "❌"}</span>
      <p className="text-sm font-semibold flex-1">{msg}</p>
      <button onClick={onClose} className="opacity-50 hover:opacity-100 text-lg ml-1">×</button>
    </div>
  );
}

/* ─── ANIMATED NUMBER ────────────────────────────────────────── */
function AnimNum({ target }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (target === 0) { setV(0); return; }
    let s = 0; const step = Math.max(1, Math.ceil(target / 40));
    const iv = setInterval(() => { s = Math.min(s + step, target); setV(s); if (s >= target) clearInterval(iv); }, 20);
    return () => clearInterval(iv);
  }, [target]);
  return <span>{v}</span>;
}

/* ─── DELETE CONFIRM ─────────────────────────────────────────── */
function DeleteConfirm({ item, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm z-10 p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-3xl mx-auto mb-4">🗑️</div>
        <h3 className="text-lg font-extrabold text-slate-800 mb-1">Delete Notification?</h3>
        <p className="text-sm text-slate-500 mb-5">
          Remove <span className="font-bold text-slate-700">"{item?.title}"</span>? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md shadow-red-200 transition-all">Yes, Delete</button>
        </div>
      </div>
    </div>
  );
}

/* ─── NOTIFICATION ROW ───────────────────────────────────────── */
function NotificationRow({ item, onMarkRead, onDelete, onNavigate, idx }) {
  const cfg = CATEGORY_CFG[item.category] || CATEGORY_CFG.System;

  return (
    <div
      className={`flex items-start gap-4 px-5 py-4 transition-all duration-150 cursor-pointer group
        hover:bg-blue-50/40 hover:shadow-[inset_3px_0_0_#2563eb]
        ${!item.isRead ? "bg-blue-50/30" : "bg-white"}`}
      style={{ animation: "fadeUp .35s ease both", animationDelay: `${idx * 30}ms` }}
      onClick={() => onNavigate(item)}
    >
      {/* Icon */}
      <div className={`w-10 h-10 rounded-xl ${cfg.iconBg} flex items-center justify-center text-white flex-shrink-0 shadow-sm`}>
        {cfg.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-sm leading-snug ${!item.isRead ? "font-extrabold text-slate-800" : "font-bold text-slate-600"}`}>
              {item.title}
            </p>
            {!item.isRead && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
          </div>
          <span className="text-xs text-slate-400 flex-shrink-0 whitespace-nowrap">{timeAgo(item.createdAt)}</span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.message}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
          {item.isEscalated && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
              <FiAlertTriangle className="w-3 h-3" /> Escalated
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}>
        {!item.isRead && (
          <button onClick={() => onMarkRead(item.id)} title="Mark as read"
            className="w-8 h-8 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 flex items-center justify-center text-sm transition-all">
            <FiCheck />
          </button>
        )}
        <button onClick={() => onDelete(item)} title="Delete"
          className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 flex items-center justify-center text-sm transition-all">
          <FiTrash2 />
        </button>
      </div>
    </div>
  );
}

/* ─── NOTIFICATION CARD (grid view) ──────────────────────────── */
function NotificationCard({ item, onMarkRead, onDelete, onNavigate, idx }) {
  const cfg = CATEGORY_CFG[item.category] || CATEGORY_CFG.System;

  return (
    <div
      className={`group relative flex flex-col rounded-2xl border bg-white overflow-hidden cursor-pointer
        transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-xl ${cfg.glow}
        ${!item.isRead ? "border-slate-200 ring-1 ring-blue-100" : "border-slate-200/70 hover:border-slate-300"}`}
      style={{ animation: "fadeUp .35s ease both", animationDelay: `${idx * 40}ms` }}
      onClick={() => onNavigate(item)}
    >
      {/* Left category accent bar */}
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${cfg.accent}`} />

      {/* Soft decorative blob */}
      <div className={`absolute -right-8 -top-8 w-28 h-28 rounded-full bg-gradient-to-br ${cfg.grad} opacity-[0.07] group-hover:opacity-[0.12] group-hover:scale-110 transition-all duration-500`} />

      <div className="relative p-5 pl-6 flex flex-col flex-1">
        {/* Top row: gradient icon + time / unread */}
        <div className="flex items-start justify-between gap-2 mb-3.5">
          <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${cfg.grad} flex items-center justify-center text-white flex-shrink-0 shadow-md ${cfg.glow} group-hover:scale-105 transition-transform duration-300`}>
            {cfg.icon}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {!item.isRead && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
              </span>
            )}
            <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap">{timeAgo(item.createdAt)}</span>
          </div>
        </div>

        {/* Title + message */}
        <h3 className={`text-[15px] leading-snug tracking-tight ${!item.isRead ? "font-extrabold text-slate-800" : "font-bold text-slate-600"}`}>
          {item.title}
        </h3>
        <p className="text-[13px] text-slate-500 mt-1.5 leading-relaxed line-clamp-3 flex-1">{item.message}</p>

        {/* Badges */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
            {cfg.icon} {cfg.label}
          </span>
          {item.isEscalated && (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
              <FiAlertTriangle className="w-3 h-3" /> Escalated
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-2 mt-4 pt-3.5 border-t border-slate-100"
          onClick={(e) => e.stopPropagation()}>
          <span className={`text-[11px] font-bold ${!item.isRead ? "text-blue-600" : "text-slate-300"}`}>
            {!item.isRead ? "● Unread" : "Read"}
          </span>
          <div className="flex items-center gap-1.5">
            {!item.isRead && (
              <button onClick={() => onMarkRead(item.id)} title="Mark as read"
                className="w-8 h-8 rounded-lg bg-green-50 hover:bg-green-500 text-green-600 hover:text-white flex items-center justify-center text-sm transition-all duration-200 hover:shadow-md hover:shadow-green-200">
                <FiCheck />
              </button>
            )}
            <button onClick={() => onDelete(item)} title="Delete"
              className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-500 text-red-400 hover:text-white flex items-center justify-center text-sm transition-all duration-200 hover:shadow-md hover:shadow-red-200">
              <FiTrash2 />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── MAIN PAGE ──────────────────────────────────────────────── */
export default function Notifications() {
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [filter,   setFilter]   = useState("All Notifications");
  const [view,     setView]     = useState("list");   // "grid" | "list"
  const [loading,  setLoading]  = useState(true);
  const [toast,    setToast]    = useState(null);
  const [delItem,  setDelItem]  = useState(null);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    // Map the backend's free-form `type` onto the page's category vocabulary
    // so the existing CATEGORY_CFG styling always resolves.
    const toCategory = (type) => {
      const t = (type || "").toUpperCase();
      if (t.includes("ESCALAT")) return "Escalation";
      if (t.includes("PAYMENT")) return "Payment";
      if (t.includes("DOCUMENT") || t.includes("VISA")) return "Document";
      if (t.includes("REMIND") || t.includes("LEAD")) return "Reminder_alert";
      return "System";
    };
    notificationService.getNotifications({ page: 0, size: 50 })
      .then((res) => {
        const items = (res.content || []).map((n) => {
          const category = toCategory(n.type);
          return {
            id:          n.publicId,
            title:       n.title,
            message:     n.message,
            category,
            isRead:      n.status === "READ",
            isEscalated: category === "Escalation",
            createdAt:   n.createdAt,
            link:        null,
          };
        });
        setNotifications(items);
      })
      .catch(() => setToast({ msg: "Failed to load notifications.", type: "error" }))
      .finally(() => setLoading(false));
  }, []);

  const showToast = (msg, type = "success") => setToast({ msg, type });

  /* stats */
  const stats = useMemo(() => ({
    total:      notifications.length,
    unread:     notifications.filter(n => !n.isRead).length,
    reminders:  notifications.filter(n => n.category === "Reminder_alert").length,
    escalations:notifications.filter(n => n.isEscalated).length,
  }), [notifications]);

  /* filter */
  const filtered = useMemo(() => {
    let out = [...notifications];
    if (filter === "Unread")           out = out.filter(n => !n.isRead);
    if (filter === "Reminder Alerts")  out = out.filter(n => n.category === "Reminder_alert");
    if (filter === "Escalations")      out = out.filter(n => n.isEscalated);
    out.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return out;
  }, [notifications, filter]);

  const anyFilter = filter !== "All Notifications";

  /* handlers */
  const handleMarkRead = (id) => {
    setNotifications(p => p.map(n => n.id === id ? { ...n, isRead: true } : n));
    notificationService.markRead(id).catch(() => {});
  };

  const handleMarkAllRead = () => {
    setNotifications(p => p.map(n => ({ ...n, isRead: true })));
    showToast("All notifications marked as read. ✅");
    notificationService.markAllRead().catch(() => {});
  };

  // Both of these used to drop rows locally and report success without calling the server, so
  // everything reappeared on the next load. They now hit the API and PUT THE ROWS BACK if it
  // fails — a delete that did not happen must not look like one that did.
  const handleDelete = () => {
    const target = delItem;
    const prev = notifications;
    setNotifications(p => p.filter(n => n.id !== target.id));
    setDelItem(null);
    notificationService.remove(target.id)
      .then(() => showToast("Notification deleted."))
      .catch(err => {
        setNotifications(prev);
        showToast(err?.message || "Failed to delete.", "error");
      });
  };

  const handleClearAll = () => {
    const prev = notifications;
    setNotifications([]);
    notificationService.clearAll()
      .then(() => showToast("All notifications cleared."))
      .catch(err => {
        setNotifications(prev);
        showToast(err?.message || "Failed to clear.", "error");
      });
  };

  const handleNavigate = (item) => {
    if (!item.isRead) handleMarkRead(item.id);
    if (item.link) navigate(item.link);
  };

  const resetFilters = () => setFilter("All Notifications");

  // const STAT_CARDS = [
  //   { gradient:"from-cyan-500 to-cyan-600",  icon:<FiBell className="w-5 h-5"/>,            label:"Total Notifications", value:stats.total       },
  //   { gradient:"from-amber-500 to-orange-500",icon:<FiMail className="w-5 h-5"/>,           label:"Unread",              value:stats.unread      },
  //   { gradient:"from-blue-500 to-blue-600",  icon:<FiClock className="w-5 h-5"/>,           label:"Reminder Alerts",     value:stats.reminders   },
  //   { gradient:"from-red-500 to-red-600",    icon:<FiAlertTriangle className="w-5 h-5"/>,   label:"Escalations",         value:stats.escalations },
  // ];

  const STAT_CARDS = [
  {
    gradient: "from-cyan-500 to-cyan-600",
    icon: <FiBell className="w-5 h-5" />,
    label: "Total Notifications",
    value: stats.total,
  },
  {
    gradient: "from-amber-500 to-orange-500",
    icon: <FiMail className="w-5 h-5" />,
    label: "Unread",
    value: stats.unread,
  },
  {
    gradient: "from-blue-500 to-blue-600",
    icon: <FiClock className="w-5 h-5" />,
    label: "Reminder Alerts",
    value: stats.reminders,
  },
  {
    gradient: "from-red-500 to-red-600",
    icon: <FiAlertTriangle className="w-5 h-5" />,
    label: "Escalations",
    value: stats.escalations,
  },
];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-100"
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes slideIn { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .fade-up { animation: fadeUp .4s ease both; }
        select { -webkit-appearance:none; appearance:none; }
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#f1f5f9;border-radius:99px}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:99px}
      `}</style>

      {toast   && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {delItem && <DeleteConfirm item={delItem} onClose={() => setDelItem(null)} onConfirm={handleDelete} />}

      {/* ── PAGE HEADER ── */}
      <div className="bg-white/70 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-white text-xl shadow-lg shadow-blue-200">
                <FiBell className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                  Notifications
                  {stats.unread > 0 && (
                    <span className="text-xs bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">{stats.unread} unread</span>
                  )}
                </h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  Stay on top of reminders, escalations & system alerts
                  <span className="hidden sm:inline ml-3 text-slate-300">|</span>
                  <span className="hidden sm:inline ml-3">
                    <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={() => navigate("/")}>Home</span>
                    <span className="mx-1 text-slate-300">/</span>
                    <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={() => navigate("/Reminders")}>Reminders</span>
                    <span className="mx-1 text-slate-300">/</span>
                    <span className="text-blue-600 font-bold">Notifications</span>
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {stats.unread > 0 && (
                <button onClick={handleMarkAllRead}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-green-200 hover:border-green-400
                    bg-green-50 hover:bg-green-100 text-green-700 text-sm font-bold transition-all">
                  <MdOutlineMarkEmailRead className="w-4 h-4" /> Mark All Read
                </button>
              )}
              {notifications.length > 0 && (
                <button onClick={handleClearAll}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-red-300
                    bg-white hover:bg-red-50 text-slate-500 hover:text-red-600 text-sm font-bold transition-all">
                  <FiTrash2 className="w-4 h-4" /> Clear All
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── STAT CARDS ── */}
        {/* <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {STAT_CARDS.map((card, i) => (
            <div key={card.label}
              className={`bg-gradient-to-br ${card.gradient} rounded-2xl p-5 text-white shadow-lg relative overflow-hidden group
                hover:-translate-y-1 hover:shadow-xl transition-all duration-300 cursor-pointer fade-up`}
              style={{ animationDelay: `${i * 60}ms` }}>
              <div className="absolute -right-5 -top-5 w-24 h-24 rounded-full bg-white/10 group-hover:scale-110 transition-transform" />
              <div className="absolute -right-3 -bottom-8 w-32 h-32 rounded-full bg-white/10" />
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">{card.icon}</div>
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold leading-none mb-1">
                  <AnimNum target={card.value} />
                </p>
                <p className="text-xs font-bold uppercase tracking-widest opacity-80">{card.label}</p>
              </div>
            </div>
          ))}
        </div> */}

        {/* ── COLLAPSIBLE ANALYTICS SECTION ── */}
<div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

  {/* Analytics toggle header */}
  <button
    type="button"
    onClick={() => setAnalyticsOpen((previous) => !previous)}
    aria-expanded={analyticsOpen}
    className="w-full px-4 py-3 flex items-center justify-between
      hover:bg-slate-50 transition-colors"
  >
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <FiBarChart3 className="w-4 h-4 text-blue-600" />

        <span className="text-sm font-extrabold text-slate-700">
          Analytics
        </span>
      </div>

      {/* Compact counts visible when closed */}
      {!analyticsOpen && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-full bg-cyan-100 text-cyan-700 text-xs font-bold">
            {stats.total} Notifications
          </span>

          <span className="px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">
            {stats.unread} Unread
          </span>

          <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
            {stats.reminders} Reminders
          </span>

          <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold">
            {stats.escalations} Escalations
          </span>
        </div>
      )}
    </div>

    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center">
      {analyticsOpen ? (
        <FiChevronUp className="w-4 h-4" />
      ) : (
        <FiChevronDown className="w-4 h-4" />
      )}
    </div>
  </button>

  {/* Expandable four cards */}
  <div
    className={`grid transition-all duration-300 ease-in-out ${
      analyticsOpen
        ? "grid-rows-[1fr] opacity-100"
        : "grid-rows-[0fr] opacity-0"
    }`}
  >
    <div className="min-h-0 overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 pt-1">
        {STAT_CARDS.map((card, i) => (
          <div
            key={card.label}
            className={`bg-gradient-to-br ${card.gradient}
              rounded-2xl p-5 text-white shadow-lg relative overflow-hidden group
              hover:-translate-y-1 hover:shadow-xl
              transition-all duration-300 fade-up`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="absolute -right-5 -top-5 w-24 h-24 rounded-full bg-white/10 group-hover:scale-110 transition-transform" />

            <div className="absolute -right-3 -bottom-8 w-32 h-32 rounded-full bg-white/10" />

            <div className="relative z-10">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  {card.icon}
                </div>
              </div>

              <p className="text-2xl sm:text-3xl font-extrabold leading-none mb-1">
                <AnimNum target={card.value} />
              </p>

              <p className="text-xs font-bold uppercase tracking-widest opacity-80">
                {card.label}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
</div>

        {/* ── NOTIFICATIONS LIST CARD ── */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">

          {/* List header + filter tabs */}
          <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-base font-extrabold text-slate-700">All Notifications</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex rounded-xl border border-slate-200 overflow-hidden flex-wrap">
                {FILTERS.map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={`px-3.5 py-2 text-xs font-bold transition-all whitespace-nowrap
                      ${filter === f ? "bg-blue-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
                    {f}
                  </button>
                ))}
              </div>
              <button onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 600); }}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-600 font-semibold transition-colors px-2">
                <FiRefreshCw className="w-3.5 h-3.5" />
              </button>

              {/* Grid / List view toggle */}
              <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1">
                {["grid", "list"].map(v => (
                  <button key={v} onClick={() => setView(v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                      ${view === v ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                    {v === "grid" ? "⊞ Grid" : "☰ List"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── SKELETON ── */}
          {loading && (
            <div className="divide-y divide-slate-50">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-start gap-4 px-5 py-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-200 animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 rounded-lg bg-slate-200 animate-pulse w-1/3" />
                    <div className="h-3 rounded-lg bg-slate-200 animate-pulse w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── EMPTY STATE (matches reference screenshot) ── */}
          {!loading && filtered.length === 0 && (
            <div className="py-20 text-center fade-up">
              <FiBellOff className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-lg font-extrabold text-slate-600 mb-1">No Notifications</p>
              <p className="text-sm text-slate-400">
                {anyFilter ? "No notifications matching the current filter." : "You don't have any notifications yet."}
              </p>
              {anyFilter && (
                <button onClick={resetFilters} className="mt-5 px-4 py-2 rounded-xl bg-blue-50 text-blue-600 font-bold text-sm hover:bg-blue-100 transition-all">
                  Clear Filter
                </button>
              )}
            </div>
          )}

          {/* ── LIST VIEW ── */}
          {!loading && filtered.length > 0 && view === "list" && (
            <div className="divide-y divide-slate-50">
              {filtered.map((item, idx) => (
                <NotificationRow
                  key={item.id} item={item} idx={idx}
                  onMarkRead={handleMarkRead}
                  onDelete={setDelItem}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          )}

          {/* ── GRID VIEW ── */}
          {!loading && filtered.length > 0 && view === "grid" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 p-4 sm:p-5">
              {filtered.map((item, idx) => (
                <NotificationCard
                  key={item.id} item={item} idx={idx}
                  onMarkRead={handleMarkRead}
                  onDelete={setDelItem}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}