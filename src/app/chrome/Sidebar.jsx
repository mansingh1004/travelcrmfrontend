import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

import { LayoutDashboard, Users, Database, ChevronDown, Circle, Plane, FileText, CalendarDays, CalendarPlus, UserCheck, Store, UserCog, BarChart3, Settings, CircleUser, User, CreditCard, LogOut, Bell, BellRing, CalendarClock, CalendarCheck, Trash2, Truck, Network, HandCoins, Landmark, Receipt, Megaphone, Plug, Building2, ClipboardList } from 'lucide-react';
import { isSuperAdmin, isTenantAdmin, isSubAgent, hasPermission, hasAnyPermission, hasModule, loadMyEntitlements, clearMyPermissions, clearMyEntitlements, P } from "@shared/lib/access";
import { companyService } from "@features/settings";


// that has not uploaded one.
// (name || "") — NOT a `= ""` default: a default only fires on `undefined`, so a null company name
// (any tenant that has not filled its profile) would hit null.trim() and crash the whole shell.
const initialsOf = (name) =>
  (name || "").trim().split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "CO";

const Sidebar = ({ isExpanded, setExpanded }) => {
  const [openDropdown, setOpenDropdown] = useState('');
  const [activeTab, setActiveTab] = useState('Dashboard');

  const [isHovered, setIsHovered] = useState(false);
  const showSidebar = isExpanded || isHovered;

  // Tenant branding for the header. Reloads on the "company-updated" event the profile
  // page fires after a save, so a new logo lands here without a page reload.
  const [company, setCompany] = useState(null);
  const brandName = company?.name || "TravelCRM";

  useEffect(() => {
    const loadCompany = () => {
      if (!localStorage.getItem("token")) return;
      companyService
        .get()
        .then((res) => setCompany(res.data?.data ?? res.data ?? null))
        .catch(() => setCompany(null)); // header falls back to initials
    };

    loadCompany();
    window.addEventListener("company-updated", loadCompany);
    return () => window.removeEventListener("company-updated", loadCompany);
  }, []);

  // Re-fetch the tenant's module entitlements on mount + whenever the tab regains focus, then
  // re-render. Login also caches them, but a plan/flag change made while the user is already
  // logged in only reflects here — so a disabled module disappears from the menu on reload /
  // tab-refocus, without needing a full re-login. (The backend still hard-blocks it regardless.)
  const [, forceEntitlementRefresh] = useState(0);
  useEffect(() => {
    let alive = true;
    const refresh = () =>
      loadMyEntitlements().finally(() => { if (alive) forceEntitlementRefresh((n) => n + 1); });
    refresh();
    window.addEventListener('focus', refresh);
    return () => { alive = false; window.removeEventListener('focus', refresh); };
  }, []);

  const handleMenuClick = (menuName) => {
    setActiveTab(menuName);
    setOpenDropdown(openDropdown === menuName ? '' : menuName);
  };

  const handleLinkClick = (menuName) => {
    setActiveTab(menuName);
    setOpenDropdown('');

    // 👉 YAHAN UPDATE KIYA HAI: Mobile par touch karte hi hover state ko force-reset karna zaroori hai
    setIsHovered(false);

    // Mobile view (width < 768px) hone par sidebar auto-close ho jayega
    if (window.innerWidth < 768 && setExpanded) {
      setExpanded(false);
    }
  };

  // 👉 Naya Function: Logout handle karne ke liye
  const handleLogout = () => {
    const confirmLogout = window.confirm("Are you sure you want to log out?");
    if (confirmLogout) {
      localStorage.removeItem('token');
      localStorage.removeItem('userRole');
      localStorage.removeItem('userEmail');
      clearMyPermissions();     // drop cached effective permissions (no stale set on a shared browser)
      clearMyEntitlements();    // drop cached module entitlements
      window.location.href = '/login';
    }
  };

  return (
    <aside
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`fixed md:relative z-50 h-screen bg-[#1e2329] text-[#94a3b8] flex flex-col shrink-0 font-sans transition-all duration-300 ease-in-out border-r border-white/5 ${showSidebar ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0 w-64 md:w-[72px]'
        }`}
    >
      {/* Brand Header — company logo + name, both pulled from the company profile */}
      <div className={`h-[72px] flex items-center border-b border-white/10 shrink-0 overflow-hidden whitespace-nowrap transition-all duration-300 ${showSidebar ? 'px-5' : 'px-0 justify-center'}`}>
        <div className={`flex items-center min-w-0 ${showSidebar ? 'gap-3' : ''}`}>

          {/* Logo mark — falls back to the company's initials until a logo is uploaded.
              The white backdrop keeps a transparent-PNG logo legible on the dark rail. */}
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-white/10">
            {company?.logoUrl ? (
              <img
                src={company.logoUrl}
                alt={brandName}
                className="w-full h-full object-contain bg-white p-0.5"
              />
            ) : (
              <span className="text-base font-bold text-white">{initialsOf(company?.name)}</span>
            )}
          </div>

          {/* Name only in the expanded rail — the collapsed rail is 72px, logo only.
              `truncate` clips a long name to one line with an ellipsis; `title` puts the
              full name in a hover tooltip so nothing is silently lost. */}
          {showSidebar && (
            <p
              title={brandName}
              className="text-base font-bold text-white tracking-wide leading-tight truncate min-w-0"
            >
              {brandName}
            </p>
          )}
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto py-5 custom-scrollbar overflow-x-hidden">
        <ul className="space-y-1.5 px-3">

          {/* Module-gated to match the backend: ModuleAccessFilter maps /api/dashboard → DASHBOARD.
              Ungated, this menu showed for a Fleet-only tenant and every click 403'd. */}
          {!isSubAgent() && hasModule("DASHBOARD") && (
            <li>
              <Link
                to="/Dashboard"
                onClick={() => handleLinkClick('Dashboard')}
                className={`flex items-center py-3 rounded-xl transition-all duration-200 ${showSidebar ? 'px-4 gap-3.5' : 'justify-center px-0'} ${activeTab === 'Dashboard' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-semibold' : 'hover:bg-white/5 hover:text-white font-medium'
                  }`}
              >
                <LayoutDashboard size={20} strokeWidth={activeTab === 'Dashboard' ? 2.5 : 2} className={`shrink-0 ${activeTab === 'Dashboard' ? 'text-white' : 'text-blue-400'}`} />
                {showSidebar && <span className="text-[14px] whitespace-nowrap tracking-wide">Dashboard</span>}
              </Link>
            </li>
          )}

          {/* --- Calendar (Task & Team Calendar) --- */}
          {/* TASKS, not a key of its own — the calendar is an aggregation over tasks, and that is
              exactly how ModuleAccessFilter maps both /api/tasks and /api/calendar. */}
          {hasPermission(P.TASK_READ) && hasModule("TASKS") && (
            <li>
              <Link
                to="/calendar"
                onClick={() => handleLinkClick('Calendar')}
                className={`flex items-center py-3 rounded-xl transition-all duration-200 ${showSidebar ? 'px-4 gap-3.5' : 'justify-center px-0'} ${activeTab === 'Calendar' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-semibold' : 'hover:bg-white/5 hover:text-white font-medium'
                  }`}
              >
                <CalendarCheck size={20} strokeWidth={activeTab === 'Calendar' ? 2.5 : 2} className={`shrink-0 ${activeTab === 'Calendar' ? 'text-white' : 'text-fuchsia-400'}`} />
                {showSidebar && <span className="text-[14px] whitespace-nowrap tracking-wide">Calendar</span>}
              </Link>
            </li>
          )}

          {/* --- Leads Dropdown --- */}
          {hasPermission(P.LEAD_READ) && hasModule("LEADS") && (
            <li>
              <button
                onClick={() => handleMenuClick('Leads')}
                className={`w-full flex items-center py-3 rounded-xl transition-all duration-200 ${showSidebar ? 'justify-between px-4' : 'justify-center px-0'} ${activeTab === 'Leads' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-semibold' : 'hover:bg-white/5 hover:text-white font-medium'
                  }`}
              >
                <div className={`flex items-center ${showSidebar ? 'gap-3.5' : ''}`}>
                  <Users size={20} strokeWidth={activeTab === 'Leads' ? 2.5 : 2} className={`shrink-0 ${activeTab === 'Leads' ? 'text-white' : 'text-cyan-400'}`} />
                  {showSidebar && <span className="text-[14px] whitespace-nowrap tracking-wide">Leads</span>}
                </div>
                {showSidebar && <ChevronDown size={16} className={`transition-transform duration-200 opacity-70 ${openDropdown === 'Leads' ? 'rotate-180' : ''}`} />}
              </button>

              {showSidebar && openDropdown === 'Leads' && (
                <ul className="mt-1 space-y-1 mb-2">
                  {/* Incoming Leads — the claim window. First in the submenu deliberately: it is the
                      time-critical one (an SLA countdown is running on every row), unlike the two
                      below it. Amber dot rather than the cyan the rest use, for the same reason. */}
                  <li><Link to="/leads/incoming" onClick={() => handleLinkClick('Leads')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><Circle size={6} className="fill-current text-amber-400/70" /><span>Incoming leads</span></Link></li>
                  <li><Link to="allleads" onClick={() => handleLinkClick('Leads')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><Circle size={6} className="fill-current text-cyan-400/50" /><span>All leads</span></Link></li>
                  <li><Link to="/CreateLead" onClick={() => handleLinkClick('Leads')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><Circle size={6} className="fill-current text-cyan-400/50" /><span>Add new lead</span></Link></li>
                </ul>
              )}
            </li>
          )}

          {/* --- Reminders Dropdown --- */}
          {hasPermission(P.REMINDER_READ) && (
            <li>
              <button
                onClick={() => handleMenuClick("Reminders")}
                className={`w-full flex items-center py-3 rounded-xl transition-all duration-200 ${showSidebar ? "justify-between px-4" : "justify-center px-0"
                  } ${activeTab === "Reminders"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/20 font-semibold"
                    : "hover:bg-white/5 hover:text-white font-medium"
                  }`}
              >
                <div className={`flex items-center ${showSidebar ? "gap-3.5" : ""}`}>
                  <BellRing
                    size={20}
                    strokeWidth={activeTab === "Reminders" ? 2.5 : 2}
                    className={`shrink-0 ${activeTab === "Reminders"
                        ? "text-white"
                        : "text-rose-400"
                      }`}
                  />
                  {showSidebar && (
                    <span className="text-[14px] whitespace-nowrap tracking-wide">
                      Reminders
                    </span>
                  )}
                </div>

                {showSidebar && (
                  <ChevronDown
                    size={16}
                    className={`transition-transform duration-200 opacity-70 ${openDropdown === "Reminders" ? "rotate-180" : ""
                      }`}
                  />
                )}
              </button>

              {showSidebar && openDropdown === "Reminders" && (
                <ul className="mt-1 space-y-1 mb-2">

                  <li>
                    <Link
                      to="/reminders"
                      onClick={() => handleLinkClick('Reminders')}
                      className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"
                    >
                      <Bell size={14} className="text-rose-400/60" />
                      <span>My Reminders</span>
                    </Link>
                  </li>

                  <li>
                    <Link
                      to="/BookingReminders"
                      onClick={() => handleLinkClick('Reminders')}
                      className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"
                    >
                      <CalendarClock size={14} className="text-rose-400/60" />
                      <span>Booking Reminders</span>
                    </Link>
                  </li>

                  <li>
                    <Link
                      to="/Notifications"
                      onClick={() => handleLinkClick('Reminders')}
                      className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"
                    >
                      <BellRing size={14} className="text-rose-400/60" />
                      <span>Notifications</span>
                    </Link>
                  </li>

                  <li>
                    <Link
                      to="/NotificationSettings"
                      onClick={() => handleLinkClick('Reminders')}
                      className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"
                    >
                      <Settings size={14} className="text-rose-400/60" />
                      <span>Notification Settings</span>
                    </Link>
                  </li>
                </ul>
              )}
            </li>
          )}

          {/* --- Masters Dropdown --- */}
          {hasPermission(P.MASTER_READ) && hasModule("MASTERS") && (
            <li>
              <button
                onClick={() => handleMenuClick('Masters')}
                className={`w-full flex items-center py-3 rounded-xl transition-all duration-200 ${showSidebar ? 'justify-between px-4' : 'justify-center px-0'} ${activeTab === 'Masters' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-semibold' : 'hover:bg-white/5 hover:text-white font-medium'
                  }`}
              >
                <div className={`flex items-center ${showSidebar ? 'gap-3.5' : ''}`}>
                  <Database size={20} strokeWidth={activeTab === 'Masters' ? 2.5 : 2} className={`shrink-0 ${activeTab === 'Masters' ? 'text-white' : 'text-purple-400'}`} />
                  {showSidebar && <span className="text-[14px] whitespace-nowrap tracking-wide">Masters</span>}
                </div>
                {showSidebar && <ChevronDown size={16} className={`transition-transform duration-200 opacity-70 ${openDropdown === 'Masters' ? 'rotate-180' : ''}`} />}
              </button>

              {showSidebar && openDropdown === 'Masters' && (
                <ul className="mt-1 space-y-1 mb-2">
                  <li><Link to="/masters/city" onClick={() => handleLinkClick('Masters')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><Circle size={6} className="fill-current text-purple-400/50" /><span>Cities</span></Link></li>
                  <li><Link to="/masters/destinations" onClick={() => handleLinkClick('Masters')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><Circle size={6} className="fill-current text-purple-400/50" /><span>Destinations</span></Link></li>
                  <li><Link to="/masters/hotels" onClick={() => handleLinkClick('Masters')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><Circle size={6} className="fill-current text-purple-400/50" /><span>Hotels</span></Link></li>
                  <li><Link to="/masters/airlines" onClick={() => handleLinkClick('Masters')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><Plane size={14} className="opacity-70 text-purple-400/50" /><span>Airlines</span></Link></li>
                  <li><Link to="/masters/cruises" onClick={() => handleLinkClick('Masters')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><Circle size={6} className="fill-current text-purple-400/50" /><span>Cruises</span></Link></li>
                  <li><Link to="/masters/vehicles" onClick={() => handleLinkClick('Masters')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><Circle size={6} className="fill-current text-purple-400/50" /><span>Vehicles</span></Link></li>
                  <li><Link to="/masters/sightseeing" onClick={() => handleLinkClick('Masters')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><Circle size={6} className="fill-current text-purple-400/50" /><span>Sightseeing</span></Link></li>
                  <li><Link to="/masters/add-on-services" onClick={() => handleLinkClick('Masters')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><Circle size={6} className="fill-current text-purple-400/50" /><span>Add-on Services</span></Link></li>
                  <li><Link to="/masters/testimonials" onClick={() => handleLinkClick('Masters')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><Circle size={6} className="fill-current text-purple-400/50" /><span>Testimonials</span></Link></li>
                </ul>
              )}
            </li>
          )}

          {/* --- Quotations Dropdown --- */}
          {hasPermission(P.QUOTATION_READ) && hasModule("QUOTATIONS") && (
            <li>
              <button
                onClick={() => handleMenuClick('Quotations')}
                className={`w-full flex items-center py-3 rounded-xl transition-all duration-200 ${showSidebar ? 'justify-between px-4' : 'justify-center px-0'} ${activeTab === 'Quotations' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-semibold' : 'hover:bg-white/5 hover:text-white font-medium'
                  }`}
              >
                <div className={`flex items-center ${showSidebar ? 'gap-3.5' : ''}`}>
                  <FileText size={20} strokeWidth={activeTab === 'Quotations' ? 2.5 : 2} className={`shrink-0 ${activeTab === 'Quotations' ? 'text-white' : 'text-emerald-400'}`} />
                  {showSidebar && <span className="text-[14px] whitespace-nowrap tracking-wide">Quotations</span>}
                </div>
                {showSidebar && <ChevronDown size={16} className={`transition-transform duration-200 opacity-70 ${openDropdown === 'Quotations' ? 'rotate-180' : ''}`} />}
              </button>
              {showSidebar && openDropdown === 'Quotations' && (
                <ul className="mt-1 space-y-1 mb-2">
                  <li><Link to="/quotations/templates" onClick={() => handleLinkClick('Quotations')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><Circle size={6} className="fill-current text-emerald-400/50" /><span>Templates</span></Link></li>
                </ul>
              )}
            </li>
          )}

          {/* --- Bookings Dropdown --- */}
          {hasPermission(P.BOOKING_READ) && hasModule("BOOKINGS") && (
            <li>
              <button
                onClick={() => handleMenuClick('Bookings')}
                className={`w-full flex items-center py-3 rounded-xl transition-all duration-200 ${showSidebar ? 'justify-between px-4' : 'justify-center px-0'} ${activeTab === 'Bookings' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-semibold' : 'hover:bg-white/5 hover:text-white font-medium'
                  }`}
              >
                <div className={`flex items-center ${showSidebar ? 'gap-3.5' : ''}`}>
                  <CalendarDays size={20} strokeWidth={activeTab === 'Bookings' ? 2.5 : 2} className={`shrink-0 ${activeTab === 'Bookings' ? 'text-white' : 'text-orange-400'}`} />
                  {showSidebar && <span className="text-[14px] whitespace-nowrap tracking-wide">Bookings</span>}
                </div>
                {showSidebar && <ChevronDown size={16} className={`transition-transform duration-200 opacity-70 ${openDropdown === 'Bookings' ? 'rotate-180' : ''}`} />}
              </button>
              {showSidebar && openDropdown === 'Bookings' && (
                <ul className="mt-1 space-y-1 mb-2">
                  <li><Link to="/Allbookings" onClick={() => handleLinkClick('Bookings')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><Circle size={6} className="fill-current text-orange-400/50" /><span>All Bookings</span></Link></li>
                  <li><Link to="/CreateBooking" onClick={() => handleLinkClick('Bookings')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><CalendarPlus size={15} className="text-orange-400" /><span>Add New Booking</span></Link></li>
                </ul>
              )}
            </li>
          )}

          {/* --- Customers Dropdown --- */}
          {hasPermission(P.CUSTOMER_READ) && hasModule("CUSTOMERS") && (
            <li>
              <button
                onClick={() => handleMenuClick('Customers')}
                className={`w-full flex items-center py-3 rounded-xl transition-all duration-200 ${showSidebar ? 'justify-between px-4' : 'justify-center px-0'} ${activeTab === 'Customers' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-semibold' : 'hover:bg-white/5 hover:text-white font-medium'
                  }`}
              >
                <div className={`flex items-center ${showSidebar ? 'gap-3.5' : ''}`}>
                  <UserCheck size={20} strokeWidth={activeTab === 'Customers' ? 2.5 : 2} className={`shrink-0 ${activeTab === 'Customers' ? 'text-white' : 'text-teal-400'}`} />
                  {showSidebar && <span className="text-[14px] whitespace-nowrap tracking-wide">Customers</span>}
                </div>
                {showSidebar && <ChevronDown size={16} className={`transition-transform duration-200 opacity-70 ${openDropdown === 'Customers' ? 'rotate-180' : ''}`} />}
              </button>
              {showSidebar && openDropdown === 'Customers' && (
                <ul className="mt-1 space-y-1 mb-2">
                  <li><Link to="/AllCustomers" onClick={() => handleLinkClick('Customers')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><Circle size={6} className="fill-current text-teal-400/50" /><span>All Customers</span></Link></li>
                  <li><Link to="/Createcustomer" onClick={() => handleLinkClick('Customers')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><Circle size={6} className="fill-current text-teal-400/50" /><span>Add New Customer</span></Link></li>
                </ul>
              )}
            </li>
          )}

          {/* --- Marketing & Campaigns Dropdown --- */}
          {hasPermission(P.MARKETING_READ) && hasModule("MARKETING") && (
            <li>
              <button
                onClick={() => handleMenuClick('Marketing')}
                className={`w-full flex items-center py-3 rounded-xl transition-all duration-200 ${showSidebar ? 'justify-between px-4' : 'justify-center px-0'} ${activeTab === 'Marketing' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-semibold' : 'hover:bg-white/5 hover:text-white font-medium'
                  }`}
              >
                <div className={`flex items-center ${showSidebar ? 'gap-3.5' : ''}`}>
                  <Megaphone size={20} strokeWidth={activeTab === 'Marketing' ? 2.5 : 2} className={`shrink-0 ${activeTab === 'Marketing' ? 'text-white' : 'text-yellow-400'}`} />
                  {showSidebar && <span className="text-[14px] whitespace-nowrap tracking-wide">Marketing</span>}
                </div>
                {showSidebar && <ChevronDown size={16} className={`transition-transform duration-200 opacity-70 ${openDropdown === 'Marketing' ? 'rotate-180' : ''}`} />}
              </button>
              {showSidebar && openDropdown === 'Marketing' && (
                <ul className="mt-1 space-y-1 mb-2">
                  <li><Link to="/marketing" onClick={() => handleLinkClick('Marketing')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><Circle size={6} className="fill-current text-yellow-400/50" /><span>Overview</span></Link></li>
                  <li><Link to="/marketing/segments" onClick={() => handleLinkClick('Marketing')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><Circle size={6} className="fill-current text-yellow-400/50" /><span>Segments</span></Link></li>
                  <li><Link to="/marketing/campaigns" onClick={() => handleLinkClick('Marketing')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><Circle size={6} className="fill-current text-yellow-400/50" /><span>Campaigns</span></Link></li>
                  <li><Link to="/marketing/drips" onClick={() => handleLinkClick('Marketing')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><Circle size={6} className="fill-current text-yellow-400/50" /><span>Drip Sequences</span></Link></li>
                  <li><Link to="/marketing/automations" onClick={() => handleLinkClick('Marketing')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><Circle size={6} className="fill-current text-yellow-400/50" /><span>Automations</span></Link></li>
                </ul>
              )}
            </li>
          )}

          {/* --- Vendors Dropdown --- */}
          {hasPermission(P.VENDOR_READ) && hasModule("VENDORS") && (
            <li>
              <button
                onClick={() => handleMenuClick('Vendors')}
                className={`w-full flex items-center py-3 rounded-xl transition-all duration-200 ${showSidebar ? 'justify-between px-4' : 'justify-center px-0'} ${activeTab === 'Vendors' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-semibold' : 'hover:bg-white/5 hover:text-white font-medium'
                  }`}
              >
                <div className={`flex items-center ${showSidebar ? 'gap-3.5' : ''}`}>
                  <Store size={20} strokeWidth={activeTab === 'Vendors' ? 2.5 : 2} className={`shrink-0 ${activeTab === 'Vendors' ? 'text-white' : 'text-amber-400'}`} />
                  {showSidebar && <span className="text-[14px] whitespace-nowrap tracking-wide">Vendors</span>}
                </div>
                {showSidebar && <ChevronDown size={16} className={`transition-transform duration-200 opacity-70 ${openDropdown === 'Vendors' ? 'rotate-180' : ''}`} />}
              </button>
              {showSidebar && openDropdown === 'Vendors' && (
                <ul className="mt-1 space-y-1 mb-2">
                  <li><Link to="/AllVendors" onClick={() => handleLinkClick('Vendors')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><Circle size={6} className="fill-current text-amber-400/50" /><span>All Vendors</span></Link></li>
                  <li><Link to="/CreateVendor" onClick={() => handleLinkClick('Vendors')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><Circle size={6} className="fill-current text-amber-400/50" /><span>Add New Vendor</span></Link></li>
                </ul>
              )}
            </li>
          )}

          {/* --- Fleet / Vehicle Diary Dropdown --- */}
          {hasPermission(P.FLEET_READ) && hasModule("FLEET") && (
            <li>
              <button
                onClick={() => handleMenuClick('Fleet')}
                className={`w-full flex items-center py-3 rounded-xl transition-all duration-200 ${showSidebar ? 'justify-between px-4' : 'justify-center px-0'} ${activeTab === 'Fleet' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-semibold' : 'hover:bg-white/5 hover:text-white font-medium'
                  }`}
              >
                <div className={`flex items-center ${showSidebar ? 'gap-3.5' : ''}`}>
                  <Truck size={20} strokeWidth={activeTab === 'Fleet' ? 2.5 : 2} className={`shrink-0 ${activeTab === 'Fleet' ? 'text-white' : 'text-sky-400'}`} />
                  {showSidebar && <span className="text-[14px] whitespace-nowrap tracking-wide">Vehicle Diary</span>}
                </div>
                {showSidebar && <ChevronDown size={16} className={`transition-transform duration-200 opacity-70 ${openDropdown === 'Fleet' ? 'rotate-180' : ''}`} />}
              </button>
              {showSidebar && openDropdown === 'Fleet' && (
                <ul className="mt-1 space-y-1 mb-2">
                  <li><Link to="/fleet" onClick={() => handleLinkClick('Fleet')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><Circle size={6} className="fill-current text-sky-400/50" /><span>Dashboard</span></Link></li>
                  <li><Link to="/fleet/vehicles" onClick={() => handleLinkClick('Fleet')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><Circle size={6} className="fill-current text-sky-400/50" /><span>Vehicles</span></Link></li>
                  <li><Link to="/fleet/drivers" onClick={() => handleLinkClick('Fleet')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><Circle size={6} className="fill-current text-sky-400/50" /><span>Drivers</span></Link></li>
                  <li><Link to="/fleet/trips" onClick={() => handleLinkClick('Fleet')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><Circle size={6} className="fill-current text-sky-400/50" /><span>Trips</span></Link></li>
                  {/* Gated on FLEET_MONEY_READ, not FLEET_READ: a dispatcher runs the diary without
                      seeing cost structure or who is holding the company's cash. */}
                  {hasPermission(P.FLEET_MONEY_READ) && (
                    <li><Link to="/fleet/expenses" onClick={() => handleLinkClick('Fleet')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><Circle size={6} className="fill-current text-sky-400/50" /><span>Expenses</span></Link></li>
                  )}
                  {hasPermission(P.FLEET_MONEY_READ) && (
                    <li><Link to="/fleet/settlements" onClick={() => handleLinkClick('Fleet')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><Circle size={6} className="fill-current text-sky-400/50" /><span>Driver Cash</span></Link></li>
                  )}
                  {hasPermission(P.FLEET_MONEY_READ) && (
                    <li><Link to="/fleet/periods" onClick={() => handleLinkClick('Fleet')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><Circle size={6} className="fill-current text-sky-400/50" /><span>Month Close</span></Link></li>
                  )}
                  {/* Operational, not money — gated on FLEET_READ like the rest of the diary. */}
                  <li><Link to="/fleet/compliance" onClick={() => handleLinkClick('Fleet')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><Circle size={6} className="fill-current text-sky-400/50" /><span>Compliance</span></Link></li>
                </ul>
              )}
            </li>
          )}

          {/* --- Hotel Marketplace --- */}
          {/* Replaces the old "Hotel Management" dropdown, which was a fully-mocked PMS (occupancy,
              ADR, housekeeping, channel manager) with no backend — every screen showed fabricated
              data to real users. Its supply-side pages now live in the SuperAdmin console, where the
              catalog is actually owned. What a TENANT gets is a single entry: browse the platform
              catalog and import a hotel into its own master.
              Gated on the HOTEL_MARKETPLACE add-on, NOT on MASTERS: the tenant's own private hotel
              master must keep working on every plan even when the marketplace is off. */}
          {hasPermission(P.HOTEL_MARKETPLACE_VIEW) && hasModule("HOTEL_MARKETPLACE") && (
            <li>
              <Link
                to="/marketplace"
                onClick={() => handleLinkClick('Marketplace')}
                className={`w-full flex items-center py-3 rounded-xl transition-all duration-200 ${showSidebar ? 'px-4' : 'justify-center px-0'} ${activeTab === 'Marketplace' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-semibold' : 'hover:bg-white/5 hover:text-white font-medium'
                  }`}
              >
                <div className={`flex items-center ${showSidebar ? 'gap-3.5' : ''}`}>
                  <Building2 size={20} strokeWidth={activeTab === 'Marketplace' ? 2.5 : 2} className={`shrink-0 ${activeTab === 'Marketplace' ? 'text-white' : 'text-blue-400'}`} />
                  {showSidebar && <span className="text-[14px] whitespace-nowrap tracking-wide">Hotel Marketplace</span>}
                </div>
              </Link>
            </li>
          )}

          {/* --- Hotel booking requests (tenant side of the approval queue) ---
              Same gate as the catalog: VIEW + the add-on. Sending a request needs
              HOTEL_MARKETPLACE_BOOK, but *reading your own* requests does not — a manager who
              cannot place orders still needs to see where the ones already placed have got to. */}
          {hasPermission(P.HOTEL_MARKETPLACE_VIEW) && hasModule("HOTEL_MARKETPLACE") && (
            <li>
              <Link
                to="/marketplace/bookings"
                onClick={() => handleLinkClick('HotelRequests')}
                className={`w-full flex items-center py-3 rounded-xl transition-all duration-200 ${showSidebar ? 'px-4' : 'justify-center px-0'} ${activeTab === 'HotelRequests' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-semibold' : 'hover:bg-white/5 hover:text-white font-medium'
                  }`}
              >
                <div className={`flex items-center ${showSidebar ? 'gap-3.5' : ''}`}>
                  <ClipboardList size={20} strokeWidth={activeTab === 'HotelRequests' ? 2.5 : 2} className={`shrink-0 ${activeTab === 'HotelRequests' ? 'text-white' : 'text-blue-400'}`} />
                  {showSidebar && <span className="text-[14px] whitespace-nowrap tracking-wide">Hotel Requests</span>}
                </div>
              </Link>
            </li>
          )}

          {/* --- Accounting / GST Dropdown (ACCOUNTANT/MANAGER + TENANT_ADMIN) --- */}
          {hasAnyPermission(P.ACCOUNTING_INVOICE_READ, P.ACCOUNTING_TDS_READ) && hasModule("ACCOUNTING") && (
            <li>
              <button
                onClick={() => handleMenuClick('Accounting')}
                className={`w-full flex items-center py-3 rounded-xl transition-all duration-200 ${showSidebar ? 'justify-between px-4' : 'justify-center px-0'} ${activeTab === 'Accounting' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-semibold' : 'hover:bg-white/5 hover:text-white font-medium'
                  }`}
              >
                <div className={`flex items-center ${showSidebar ? 'gap-3.5' : ''}`}>
                  <Landmark size={20} strokeWidth={activeTab === 'Accounting' ? 2.5 : 2} className={`shrink-0 ${activeTab === 'Accounting' ? 'text-white' : 'text-lime-400'}`} />
                  {showSidebar && <span className="text-[14px] whitespace-nowrap tracking-wide">Accounting</span>}
                </div>
                {showSidebar && <ChevronDown size={16} className={`transition-transform duration-200 opacity-70 ${openDropdown === 'Accounting' ? 'rotate-180' : ''}`} />}
              </button>
              {showSidebar && openDropdown === 'Accounting' && (
                <ul className="mt-1 space-y-1 mb-2">
                  {hasPermission(P.ACCOUNTING_INVOICE_READ) && (
                    <li><Link to="/accounting" onClick={() => handleLinkClick('Accounting')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><LayoutDashboard size={14} className="text-lime-400/60" /><span>Dashboard</span></Link></li>
                  )}
                  {hasPermission(P.ACCOUNTING_INVOICE_READ) && (
                    <li><Link to="/accounting/invoices" onClick={() => handleLinkClick('Accounting')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><FileText size={14} className="text-lime-400/60" /><span>Invoices</span></Link></li>
                  )}
                  {hasPermission(P.ACCOUNTING_TDS_READ) && (
                    <li><Link to="/accounting/vendor-bills" onClick={() => handleLinkClick('Accounting')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><Receipt size={14} className="text-lime-400/60" /><span>Vendor Bills &amp; TDS</span></Link></li>
                  )}
                  {hasPermission(P.ACCOUNTING_INVOICE_READ) && (
                    <li><Link to="/accounting/reports" onClick={() => handleLinkClick('Accounting')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><BarChart3 size={14} className="text-lime-400/60" /><span>Reports</span></Link></li>
                  )}
                  {hasPermission(P.ACCOUNTING_SETTINGS_MANAGE) && (
                    <li><Link to="/accounting/settings" onClick={() => handleLinkClick('Accounting')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><Settings size={14} className="text-lime-400/60" /><span>GST Settings</span></Link></li>
                  )}
                </ul>
              )}
            </li>
          )}

          {/* --- Users Dropdown --- */}
          {hasPermission(P.USER_READ) && (
            <li>
              <button
                onClick={() => handleMenuClick('Users')}
                className={`w-full flex items-center py-3 rounded-xl transition-all duration-200 ${showSidebar ? 'justify-between px-4' : 'justify-center px-0'
                  } ${activeTab === 'Users'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-semibold'
                    : 'hover:bg-white/5 hover:text-white font-medium'
                  }`}
              >
                <div className={`flex items-center ${showSidebar ? 'gap-3.5' : ''}`}>
                  <UserCog
                    size={20}
                    strokeWidth={activeTab === 'Users' ? 2.5 : 2}
                    className={`shrink-0 ${activeTab === 'Users' ? 'text-white' : 'text-pink-400'
                      }`}
                  />
                  {showSidebar && (
                    <span className="text-[14px] whitespace-nowrap tracking-wide">
                      Users
                    </span>
                  )}
                </div>

                {showSidebar && (
                  <ChevronDown
                    size={16}
                    className={`transition-transform duration-200 opacity-70 ${openDropdown === 'Users' ? 'rotate-180' : ''
                      }`}
                  />
                )}
              </button>

              {showSidebar && openDropdown === 'Users' && (
                <ul className="mt-1 space-y-1 mb-2">

                  <li>
                    <Link
                      to="/Users"
                      onClick={() => handleLinkClick('Users')}
                      className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"
                    >
                      <Circle size={6} className="fill-current text-pink-400/50" />
                      <span>All Users</span>
                    </Link>
                  </li>

                  <li>
                    <Link
                      to="/CreateUser"
                      onClick={() => handleLinkClick('Users')}
                      className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"
                    >
                      <Circle size={6} className="fill-current text-pink-400/50" />
                      <span>Add New User</span>
                    </Link>
                  </li>

                  <li>
                    <Link
                      to="/PermissionTemplates"
                      onClick={() => handleLinkClick('Users')}
                      className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"
                    >
                      <Circle size={6} className="fill-current text-pink-400/50" />
                      <span>Permission Templates</span>
                    </Link>
                  </li>

                </ul>
              )}
            </li>
          )}


          {/* --- Organization Dropdown --- */}
          {/* <li>
          <li>

            <button 
              onClick={() => handleMenuClick('Organization')}
              className={`w-full flex items-center py-3 rounded-xl transition-all duration-200 ${showSidebar ? 'justify-between px-4' : 'justify-center px-0'} ${
                activeTab === 'Organization' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-semibold' : 'hover:bg-white/5 hover:text-white font-medium'
              }`}
            >
              <div className={`flex items-center ${showSidebar ? 'gap-3.5' : ''}`}>
                <UserCog size={20} strokeWidth={activeTab === 'Organization' ? 2.5 : 2} className={`shrink-0 ${activeTab === 'Organization' ? 'text-white' : 'text-pink-400'}`} />
                {showSidebar && <span className="text-[14px] whitespace-nowrap tracking-wide">Organization</span>}
              </div>
              {showSidebar && <ChevronDown size={16} className={`transition-transform duration-200 opacity-70 ${openDropdown === 'Organization' ? 'rotate-180' : ''}`} />}
            </button>
            {showSidebar && openDropdown === 'Organization' && (
              <ul className="mt-1 space-y-1 mb-2">
                <li><Link to="/allorganization" className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><Circle size={6} className="fill-current text-pink-400/50" /><span>All Organization</span></Link></li>
                {/* <li><Link to="/add-user" className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><Circle size={6} className="fill-current text-pink-400/50" /><span>Add New Organization</span></Link></li>
                <li><Link to="/users/permission-templates" className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><Circle size={6} className="fill-current text-pink-400/50" /><span>Permission Templates</span></Link></li> */}
          {/* </ul>
            )}
          </li> */}


          {/* --- Travel Partners (B2B franchise) Dropdown — TENANT_ADMIN only --- */}
          {isTenantAdmin() && (
            <li>
              <button
                onClick={() => handleMenuClick('SubAgents')}
                className={`w-full flex items-center py-3 rounded-xl transition-all duration-200 ${showSidebar ? 'justify-between px-4' : 'justify-center px-0'} ${activeTab === 'SubAgents' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-semibold' : 'hover:bg-white/5 hover:text-white font-medium'
                  }`}
              >
                <div className={`flex items-center ${showSidebar ? 'gap-3.5' : ''}`}>
                  <Network size={20} strokeWidth={activeTab === 'SubAgents' ? 2.5 : 2} className={`shrink-0 ${activeTab === 'SubAgents' ? 'text-white' : 'text-indigo-400'}`} />
                  {showSidebar && <span className="text-[14px] whitespace-nowrap tracking-wide">Travel Partners</span>}
                </div>
                {showSidebar && <ChevronDown size={16} className={`transition-transform duration-200 opacity-70 ${openDropdown === 'SubAgents' ? 'rotate-180' : ''}`} />}
              </button>
              {showSidebar && openDropdown === 'SubAgents' && (
                <ul className="mt-1 space-y-1 mb-2">
                  <li><Link to="/subagents" onClick={() => handleLinkClick('SubAgents')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><Circle size={6} className="fill-current text-indigo-400/50" /><span>Manage</span></Link></li>
                  <li><Link to="/subagents/rollup" onClick={() => handleLinkClick('SubAgents')} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-[13.5px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg whitespace-nowrap transition-colors"><HandCoins size={14} className="text-indigo-400/60" /><span>Roll-up &amp; Commissions</span></Link></li>
                </ul>
              )}
            </li>
          )}

          {/* --- Platform Console (SUPERADMIN / platform owner only) --- */}
          {/* Organization/tenant management now lives in the dedicated SuperAdmin console at /console
    (separate realm + login). This is the bridge link from the tenant app. */}
          {isSuperAdmin() && (
            <li>
              <Link
                to="/console"
                onClick={() => handleLinkClick('Console')}
                className={`flex items-center py-3 rounded-xl transition-all duration-200 ${showSidebar ? 'px-4 gap-3.5' : 'justify-center px-0'} ${activeTab === 'Console'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-semibold'
                    : 'hover:bg-white/5 hover:text-white font-medium'
                  }`}
              >
                <UserCog
                  size={20}
                  strokeWidth={activeTab === 'Console' ? 2.5 : 2}
                  className={`shrink-0 ${activeTab === 'Console' ? 'text-white' : 'text-pink-400'}`}
                />
                {showSidebar && (
                  <span className="text-[14px] whitespace-nowrap tracking-wide">Platform Console</span>
                )}
              </Link>
            </li>
          )}



          {/* --- Reports (Normal Link) --- */}
          {hasPermission(P.REPORT_VIEW) && hasModule("REPORTS") && (
            <li>
              <Link
                to="/ReportsDashboard"
                onClick={() => handleLinkClick('Reports')}
                className={`flex items-center py-3 rounded-xl transition-all duration-200 ${showSidebar ? 'px-4 gap-3.5' : 'justify-center px-0'} ${activeTab === 'Reports' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-semibold' : 'hover:bg-white/5 hover:text-white font-medium'
                  }`}
              >
                <BarChart3 size={20} strokeWidth={activeTab === 'Reports' ? 2.5 : 2} className={`shrink-0 ${activeTab === 'Reports' ? 'text-white' : 'text-indigo-400'}`} />
                {showSidebar && <span className="text-[14px] whitespace-nowrap tracking-wide">Reports</span>}
              </Link>
            </li>
          )}


          {/* --- Trash (Recycle Bin) --- */}
          {hasPermission(P.TRASH_VIEW) && (
            <li>
              <Link
                to="/trash"
                onClick={() => handleLinkClick('Trash')}
                className={`flex items-center py-3 rounded-xl transition-all duration-200 ${showSidebar ? 'px-4 gap-3.5' : 'justify-center px-0'} ${activeTab === 'Trash' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-semibold' : 'hover:bg-white/5 hover:text-white font-medium'
                  }`}
              >
                <Trash2 size={20} strokeWidth={activeTab === 'Trash' ? 2.5 : 2} className={`shrink-0 ${activeTab === 'Trash' ? 'text-white' : 'text-red-400'}`} />
                {showSidebar && <span className="text-[14px] whitespace-nowrap tracking-wide">Trash</span>}
              </Link>
            </li>
          )}

          {/* --- My Commission (SUB_AGENT self view) --- */}
          {isSubAgent() && (
            <li>
              <Link
                to="/my-commission"
                onClick={() => handleLinkClick('MyCommission')}
                className={`flex items-center py-3 rounded-xl transition-all duration-200 ${showSidebar ? 'px-4 gap-3.5' : 'justify-center px-0'} ${activeTab === 'MyCommission' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-semibold' : 'hover:bg-white/5 hover:text-white font-medium'
                  }`}
              >
                <HandCoins size={20} strokeWidth={activeTab === 'MyCommission' ? 2.5 : 2} className={`shrink-0 ${activeTab === 'MyCommission' ? 'text-white' : 'text-emerald-400'}`} />
                {showSidebar && <span className="text-[14px] whitespace-nowrap tracking-wide">My Commission</span>}
              </Link>
            </li>
          )}

          {/* Divider */}
          <li className="py-2 px-2">
            <div className="h-px bg-white/10 w-full rounded-full"></div>
          </li>

          {/* Settings & Bottom links */}
          {hasPermission(P.SETTINGS_MANAGE) && (
            <li>
              <Link
                to="/CompanySettings"
                onClick={() => handleLinkClick('Settings')}
                className={`flex items-center py-3 rounded-xl transition-all duration-200 ${showSidebar ? 'px-4 gap-3.5' : 'justify-center px-0'} ${activeTab === 'Settings' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-semibold' : 'hover:bg-white/5 hover:text-white font-medium'
                  }`}
              >
                <Settings size={20} strokeWidth={activeTab === 'Settings' ? 2.5 : 2} className={`shrink-0 ${activeTab === 'Settings' ? 'text-white' : 'text-slate-400'}`} />
                {showSidebar && <span className="text-[14px] whitespace-nowrap tracking-wide">Settings</span>}
              </Link>
            </li>
          )}

          {/* --- Integrations Dropdown ---
              Groups every "connect an external service" screen under one roof: leads come IN here,
              messages go OUT there, and all three are the same job — hand a provider our credentials.
              Icon is Plug, deliberately NOT Network: Network is already rendered for Sub-Agents (:594),
              and two menu items with the same glyph read as the same thing. */}
          {hasPermission(P.SETTINGS_MANAGE) && (
            <li>
              <Link to="/LeadSources"
                onClick={() => handleMenuClick('Integrations')}
                className={`w-full flex items-center py-3 rounded-xl transition-all duration-200 ${showSidebar ? 'justify-between px-4' : 'justify-center px-0'} ${activeTab === 'Integrations' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-semibold' : 'hover:bg-white/5 hover:text-white font-medium'
                  }`}
              >
                <div className={`flex items-center ${showSidebar ? 'gap-3.5' : ''}`}>
                  <Plug size={20} strokeWidth={activeTab === 'Integrations' ? 2.5 : 2} className={`shrink-0 ${activeTab === 'Integrations' ? 'text-white' : 'text-emerald-400'}`} />
                  {showSidebar && <span className="text-[14px] whitespace-nowrap tracking-wide">Integrations</span>}
                </div>
              </Link>
            </li>
          )}

          {!isSubAgent() && showSidebar && (
            <li className="mt-6 mb-2 px-4">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-slate-700" />
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                  ACCOUNT
                </span>
                <div className="h-px flex-1 bg-slate-700" />
              </div>
            </li>
          )}


          {/* --- My Profile (personal — shown to SUB_AGENT, who has no company profile access) --- */}
          {isSubAgent() && (
            <li>
              <Link
                to="/my-profile"
                onClick={() => handleLinkClick('MyProfile')}
                className={`flex items-center py-3 rounded-xl transition-all duration-200 ${showSidebar ? 'px-4 gap-3.5' : 'justify-center px-0'} ${activeTab === 'MyProfile' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-semibold' : 'hover:bg-white/5 hover:text-white font-medium'
                  }`}
              >
                <CircleUser size={20} strokeWidth={activeTab === 'MyProfile' ? 2.5 : 2} className={`shrink-0 ${activeTab === 'MyProfile' ? 'text-white' : 'text-slate-400'}`} />
                {showSidebar && <span className="text-[14px] whitespace-nowrap tracking-wide">My Profile</span>}
              </Link>
            </li>
          )}

          {!isSubAgent() && (
            <li>
              <Link
                to="/CompanyProfile"
                onClick={() => handleLinkClick('Profile')}
                className={`flex items-center py-3 rounded-xl transition-all duration-200 ${showSidebar ? 'px-4 gap-3.5' : 'justify-center px-0'} ${activeTab === 'Profile' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-semibold' : 'hover:bg-white/5 hover:text-white font-medium'
                  }`}
              >
                <User size={20} strokeWidth={activeTab === 'Profile' ? 2.5 : 2} className={`shrink-0 ${activeTab === 'Profile' ? 'text-white' : 'text-slate-400'}`} />
                {showSidebar && <span className="text-[14px] whitespace-nowrap tracking-wide">Profile</span>}
              </Link>
            </li>
          )}

          {!isSubAgent() && (
            <li>
              <Link
                to="/SubscriptionInfo"
                onClick={() => handleLinkClick('Subscription')}
                className={`flex items-center py-3 rounded-xl transition-all duration-200 ${showSidebar ? 'px-4 gap-3.5' : 'justify-center px-0'} ${activeTab === 'Subscription' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-semibold' : 'hover:bg-white/5 hover:text-white font-medium'
                  }`}
              >
                <CreditCard size={20} strokeWidth={activeTab === 'Subscription' ? 2.5 : 2} className={`shrink-0 ${activeTab === 'Subscription' ? 'text-white' : 'text-slate-400'}`} />
                {showSidebar && <span className="text-[14px] whitespace-nowrap tracking-wide">Subscription Info</span>}
              </Link>
            </li>
          )}

          {/* 👉 SIRF YAHAN CHANGE KIYA HAI: <Link> ko <button> banaya aur onClick lagaya */}
          <li className="pb-4 pt-2">
            <button
              onClick={handleLogout}
              className={`w-full flex items-center py-3 rounded-xl hover:bg-red-500/10 hover:text-red-400 transition-colors text-slate-400 font-medium ${showSidebar ? 'px-4 gap-3.5' : 'justify-center px-0'}`}
            >
              <LogOut size={20} strokeWidth={2} className="shrink-0 text-red-400/80" />
              {showSidebar && <span className="text-[14px] whitespace-nowrap tracking-wide">Logout</span>}
            </button>
          </li>

        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;
