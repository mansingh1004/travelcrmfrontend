import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mail as FiMail, ChevronRight as FiChevronRight, Check as FiCheck, Zap as FiZap, Shield as FiShield, Globe as FiGlobe, Bell as FiBell, Settings as FaCog, Users as FaUsers, Server as FaServer, FlaskConical as FaFlask, MailOpen as FaEnvelopeOpen, FileCode as FaFileCode, MessageCircleMore as FaCommentDots, Building2 as FaBuilding, ToggleRight as FaToggleOn, Settings as MdOutlineSettings } from "lucide-react";
import { WhatsAppIcon as FaWhatsapp } from "@shared/ui/WhatsAppIcon";

import { companyService } from "../api/companyService";
import emailConfigurationService from "../api/emailConfigurationService";
import whatsAppConfigService from "../api/whatsAppConfigService";

/* ─── STATS ACROSS TOP ───────────────────────────────────────── */
const STATS = [
  { icon:<FiMail className="w-5 h-5"/>,    label:"Email Config",    value:"Not Set",   color:"text-blue-600",  bg:"bg-blue-50"  },
  { icon:<FaWhatsapp className="w-5 h-5"/>, label:"WhatsApp",       value:"Active",    color:"text-green-600", bg:"bg-green-50" },
  { icon:<FaBuilding className="w-5 h-5"/>, label:"Company Profile", value:"Complete",  color:"text-teal-600",  bg:"bg-teal-50"  },
  { icon:<FiBell className="w-5 h-5"/>,     label:"Notifications",  value:"Enabled",   color:"text-amber-600", bg:"bg-amber-50" },
];

/* ─── SETTINGS CARDS ─────────────────────────────────────────── */
const CARDS = [
  {
    id:       "email",
    icon:     <FiMail className="w-6 h-6"/>,
    title:    "Email Configuration",
    subtitle: "SMTP & Delivery Settings",
    headerGradient: "from-blue-600 via-blue-500 to-indigo-500",
    glowColor: "shadow-blue-100",
    accentBorder: "border-blue-500",
    btnGradient: "from-blue-600 to-indigo-500",
    btnShadow:   "shadow-blue-200",
    ringColor:   "ring-blue-100",
    badgeBg:     "bg-blue-100",
    badgeText:   "text-blue-700",
    statusColor: "text-blue-600",
    badgeLabel:  "Not Configured",
    badgeIcon:   "⚠️",
    description: "Set up SMTP for automated emails, quotations, and client communications from your company domain.",
    features: [
      { icon:<FaServer className="w-3.5 h-3.5"/>,      label:"SMTP Server Settings"     },
      { icon:<FaFlask  className="w-3.5 h-3.5"/>,      label:"Email Testing"            },
      { icon:<FaEnvelopeOpen className="w-3.5 h-3.5"/>,label:"From Address Configuration"},
    ],
    quickStats: [
      { label:"Sent Today",   value:"—" },
      { label:"Delivery Rate",value:"—" },
    ],
    btnLabel: "Configure Email",
    btnIcon:  <FaCog className="w-3.5 h-3.5"/>,
    route:    "/EmailConfiguration",
    delay:    0,
  },
  {
    id:       "whatsapp",
    icon:     <FaWhatsapp className="w-6 h-6"/>,
    title:    "WhatsApp Integration",
    subtitle: "Business Messaging API",
    headerGradient: "from-green-500 via-green-500 to-emerald-600",
    glowColor: "shadow-green-100",
    accentBorder: "border-green-500",
    btnGradient: "from-green-500 to-emerald-600",
    btnShadow:   "shadow-green-200",
    ringColor:   "ring-green-100",
    badgeBg:     "bg-green-100",
    badgeText:   "text-green-700",
    statusColor: "text-green-600",
    badgeLabel:  "Active",
    badgeIcon:   "✅",
    description: "Send quotations, confirmations, and updates via WhatsApp Business API to clients directly from the CRM.",
    features: [
      { icon:<FaFileCode    className="w-3.5 h-3.5"/>, label:"API Configuration"  },
      { icon:<FaFileCode    className="w-3.5 h-3.5"/>, label:"Template Management"},
      { icon:<FaCommentDots className="w-3.5 h-3.5"/>, label:"Message Testing"    },
    ],
    quickStats: [
      { label:"Messages Sent", value:"128" },
      { label:"Delivery Rate", value:"98%" },
    ],
    btnLabel: "Configure WhatsApp",
    btnIcon:  <FaWhatsapp className="w-3.5 h-3.5"/>,
    route:    "/WhatsAppConfiguration",
    delay:    100,
  },
  {
    id:       "general",
    icon:     <MdOutlineSettings className="w-6 h-6"/>,
    title:    "General Settings",
    subtitle: "Company & System Preferences",
    headerGradient: "from-teal-500 via-teal-500 to-cyan-500",
    glowColor: "shadow-teal-100",
    accentBorder: "border-teal-500",
    btnGradient: "from-teal-500 to-cyan-500",
    btnShadow:   "shadow-teal-200",
    ringColor:   "ring-teal-100",
    badgeBg:     "bg-teal-100",
    badgeText:   "text-teal-700",
    statusColor: "text-teal-600",
    badgeLabel:  "Configured",
    badgeIcon:   "✅",
    description: "Manage company profile, set notification preferences, and configure system-wide settings for your CRM.",
    features: [
      { icon:<FaBuilding  className="w-3.5 h-3.5"/>, label:"Company Profile"          },
      { icon:<FiBell      className="w-3.5 h-3.5"/>, label:"Notification Preferences" },
      { icon:<FaToggleOn  className="w-3.5 h-3.5"/>, label:"System Preferences"       },
    ],
    quickStats: [
      { label:"Active Users",  value:"4"    },
      { label:"Plan",          value:"Dolphin" },
    ],
    btnLabel: "General Settings",
    btnIcon:  <FaUsers className="w-3.5 h-3.5"/>,
    route:    "/CompanyProfile",
    delay:    200,
  },
];

/* ─── STAT PILL COMPONENT ────────────────────────────────────── */
function StatPill({ icon, label, value, color, bg }) {
  return (
    <div className={`flex items-center gap-3 ${bg} px-4 py-3 rounded-2xl border border-white/60`}>
      <div className={`${color} opacity-80`}>{icon}</div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-0.5">{label}</p>
        <p className={`text-xs font-extrabold ${color}`}>{value}</p>
      </div>
    </div>
  );
}

/* ─── SETTINGS CARD ──────────────────────────────────────────── */
function SettingsCard({ card, onNavigate }) {
  const [, setPressed] = useState(false);

  return (
    <div
      className={`relative bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/60
        shadow-lg ${card.glowColor} overflow-hidden flex flex-col
        hover:-translate-y-2 hover:shadow-2xl transition-all duration-300 group cursor-pointer`}
      style={{ animation:`fadeUp .5s ease both`, animationDelay:`${card.delay}ms` }}
      onClick={() => onNavigate(card.route)}
    >
      {/* ── Top gradient header ── */}
      <div className={`bg-gradient-to-br ${card.headerGradient} px-6 pt-6 pb-10 relative overflow-hidden`}>
        {/* Background decorative circles */}
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 group-hover:scale-125 transition-transform duration-500"/>
        <div className="absolute -right-3 bottom-0 w-20 h-20 rounded-full bg-white/10"/>
        <div className="absolute left-1/2 -bottom-6 w-16 h-16 rounded-full bg-white/5"/>

        {/* Badge + icon row */}
        <div className="relative z-10 flex items-start justify-between mb-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm
            flex items-center justify-center text-white border border-white/30
            group-hover:bg-white/30 transition-all duration-300">
            {card.icon}
          </div>
          <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full ${card.badgeBg} ${card.badgeText}`}>
            {card.badgeIcon} {card.badgeLabel}
          </span>
        </div>

        {/* Title + subtitle */}
        <div className="relative z-10">
          <h2 className="text-lg font-extrabold text-white leading-tight tracking-tight">
            {card.title}
          </h2>
          <p className="text-white/70 text-xs font-medium mt-0.5">{card.subtitle}</p>
        </div>
      </div>

      {/* ── Overlap quick stats ── */}
      <div className="relative z-20 -mt-5 mx-5">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm grid grid-cols-2 divide-x divide-slate-100">
          {card.quickStats.map(s => (
            <div key={s.label} className="px-4 py-2.5 text-center">
              <p className="text-base font-extrabold text-slate-800 leading-none">{s.value}</p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Card body ── */}
      <div className="px-6 pt-4 pb-6 flex flex-col flex-1 space-y-4">
        {/* Description */}
        <p className="text-sm text-slate-500 leading-relaxed">
          {card.description}
        </p>

        {/* Feature checklist */}
        <ul className="space-y-2 flex-1">
          {card.features.map(f => (
            <li key={f.label} className="flex items-center gap-3 group/item">
              <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${card.headerGradient}
                flex items-center justify-center text-white flex-shrink-0
                group-hover/item:scale-110 transition-transform duration-200`}>
                <FiCheck className="w-3 h-3"/>
              </div>
              <span className="text-sm text-slate-700 font-medium">{f.label}</span>
              <FiChevronRight className="w-3.5 h-3.5 text-slate-300 ml-auto opacity-0 group-hover/item:opacity-100 transition-opacity"/>
            </li>
          ))}
        </ul>

        {/* Divider */}
        <div className="border-t border-slate-100"/>

        {/* Action button */}
        <button
          onClick={e => { e.stopPropagation(); onNavigate(card.route); }}
          onMouseDown={() => setPressed(true)}
          onMouseUp={() => setPressed(false)}
          className={`w-full flex items-center justify-center gap-2.5 px-5 py-3 rounded-2xl
            bg-gradient-to-r ${card.btnGradient} text-white text-sm font-bold
            shadow-md ${card.btnShadow} transition-all duration-200
            hover:shadow-lg hover:scale-[1.01] active:scale-95
            ring-0 hover:ring-4 ${card.ringColor}`}
        >
          {card.btnIcon}
          {card.btnLabel}
          <FiChevronRight className="w-4 h-4 ml-auto opacity-70"/>
        </button>
      </div>

      {/* Left accent border */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${card.headerGradient}
        opacity-0 group-hover:opacity-100 transition-opacity duration-300`}/>
    </div>
  );
}

/* ─── MAIN PAGE ──────────────────────────────────────────────── */
export default function CompanySettings() {
  const navigate = useNavigate();

  // ── Live status for the cards (replaces the hardcoded template values) ──
  const [live, setLive] = useState({ email: null, emailStats: null, wa: null, waStats: null, plan: null });

  useEffect(() => {
    const val = r => (r.status === "fulfilled" ? r.value?.data?.data : null);
    Promise.allSettled([
      emailConfigurationService.getConfig(),
      emailConfigurationService.getStats(),
      whatsAppConfigService.getConfig(),
      whatsAppConfigService.getStats(),
      companyService.getSubscription(),
    ]).then(([email, emailStats, wa, waStats, sub]) => {
      setLive({
        email:      val(email),
        emailStats: val(emailStats),
        wa:         val(wa),
        waStats:    val(waStats),
        plan:       val(sub)?.plan || null,
      });
    });
  }, []);

  const emailConfigured = !!live.email?.configured;
  const waConfigured    = !!live.wa?.configured;

  // Per-card dynamic overrides merged over the static CARDS template.
  const cardOverride = {
    email: {
      badgeLabel: emailConfigured ? "Configured" : "Not Configured",
      badgeIcon:  emailConfigured ? "✅" : "⚠️",
      quickStats: [
        { label: "Sent Today", value: live.emailStats ? String(live.emailStats.sentToday) : "—" },
        { label: "Failed",     value: live.emailStats ? String(live.emailStats.failedToday) : "—" },
      ],
    },
    whatsapp: {
      badgeLabel: waConfigured ? "Active" : "Inactive",
      badgeIcon:  waConfigured ? "✅" : "⚠️",
      quickStats: [
        { label: "Messages Sent", value: live.waStats ? String(live.waStats.messagesSent) : "—" },
        { label: "Delivery Rate", value: live.waStats?.deliveryRate || "—" },
      ],
    },
    general: {
      quickStats: [
        { label: "Active Users", value: "—" },
        { label: "Plan",         value: live.plan || "—" },
      ],
    },
  };
  const cards = CARDS.map(c => ({ ...c, ...(cardOverride[c.id] || {}) }));

  // Top stat pills — reflect real email / whatsapp status.
  const stats = STATS.map(s => {
    if (s.label === "Email Config") return { ...s, value: emailConfigured ? "Configured" : "Not Set" };
    if (s.label === "WhatsApp")     return { ...s, value: waConfigured ? "Active" : "Inactive" };
    return s;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100"
      style={{fontFamily:"'Plus Jakarta Sans', system-ui, sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes fadeUp  { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideIn { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }
        .fade-up { animation: fadeUp .5s ease both; }
      `}</style>

      {/* ── PAGE HEADER ── */}
      <div className="bg-white/70 backdrop-blur-md border-b border-slate-100/80">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Animated gear icon */}
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-500
                flex items-center justify-center text-white shadow-lg shadow-slate-200 flex-shrink-0 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20 opacity-0 group-hover:opacity-100 transition-opacity"/>
                <MdOutlineSettings className="w-6 h-6 relative z-10"/>
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">
                  Company Settings
                </h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  Manage integrations, email, and system preferences
                  <span className="hidden sm:inline ml-3 text-slate-300">|</span>
                  <span className="hidden sm:inline ml-3 text-xs">
                    <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={() => navigate("/")}>Home</span>
                    <span className="mx-1 text-slate-300">/</span>
                    <span className="text-blue-600 font-bold">Settings</span>
                  </span>
                </p>
              </div>
            </div>
            {/* Last updated badge */}
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-500 font-medium">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
              All Systems Operational
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── QUICK STAT PILLS ROW ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 fade-up">
          {stats.map(s => <StatPill key={s.label} {...s}/>)}
        </div>

        {/* ── SECTION HEADER ── */}
        <div className="flex items-center gap-4 fade-up" style={{animationDelay:"60ms"}}>
          <div>
            <h2 className="text-sm font-extrabold text-slate-500 uppercase tracking-[0.15em]">
              Configuration Modules
            </h2>
            <div className="mt-1 w-10 h-0.5 bg-gradient-to-r from-blue-500 to-teal-400 rounded-full"/>
          </div>
          <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent"/>
        </div>

        {/* ── 3 SETTINGS CARDS ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {cards.map(card => (
            <SettingsCard key={card.id} card={card} onNavigate={r => navigate(r)}/>
          ))}
        </div>

        {/* ── BOTTOM INFO STRIP ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" style={{animationDelay:"350ms"}}>
          {[
            {
              icon:<FiZap className="w-4 h-4 text-amber-500"/>,
              bg:"bg-amber-50 border-amber-200",
              title:"Quick Setup",
              desc:"Complete all 3 configurations to unlock full CRM capabilities.",
            },
            {
              icon:<FiShield className="w-4 h-4 text-blue-500"/>,
              bg:"bg-blue-50 border-blue-200",
              title:"Secure by Default",
              desc:"All credentials are encrypted at rest. Never stored in plain text.",
            },
            {
              icon:<FiGlobe className="w-4 h-4 text-teal-500"/>,
              bg:"bg-teal-50 border-teal-200",
              title:"Need Help?",
              desc:"Contact support or check documentation for detailed guides.",
            },
          ].map(b => (
            <div key={b.title}
              className={`flex items-start gap-3 px-4 py-3.5 rounded-2xl border fade-up ${b.bg}`}>
              <div className="mt-0.5 flex-shrink-0">{b.icon}</div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-slate-700 mb-0.5">{b.title}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}