


import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { leadService } from "@features/leads";
import reminderService from "../api/reminderService";
import { Bell as FiBell, Plus as FiPlus, X as FiX, Clock as FiClock, CircleAlert as FiAlertCircle, CircleCheck as FiCheckCircle, Pen as FiEdit2, Trash2 as FiTrash2, Search as FiSearch, ChevronDown as FiChevronDown, Calendar as FiCalendar, User as FiUser, Phone as FiPhone, Eye as FiEye, RefreshCw as FiRefreshCw, Mail as FiMail, MapPin as FiMapPin, Tag as FiTag, UserCheck as FiUserCheck, DollarSign as FiDollarSign, ExternalLink as FiExternalLink, StickyNote as FaStickyNote, Phone as FaPhoneAlt, AlarmClock as MdSnooze, ListPlus as MdOutlineAddTask } from "lucide-react";
import { WhatsAppIcon as FaWhatsapp } from "@shared/ui/WhatsAppIcon";

/* ─── CONSTANTS ──────────────────────────────────────────────── */
const SNOOZE_OPTS = [
  { label:"1 Hour",   hours:1   },
  { label:"3 Hours",  hours:3   },
  { label:"Tomorrow", hours:24  },
  { label:"2 Days",   hours:48  },
  { label:"1 Week",   hours:168 },
];

const STATUSES    = ["All Status","Active","Snoozed","Completed","Dismissed"];
const PRIORITIES  = ["All Priorities","High","Medium","Low"];
const TYPES       = ["All Types","First_contact","Follow_up","Quotation","Payment","Document","Birthday","Confirmation","Custom"];

const PRIORITY_CFG = {
  High:   { bg:"bg-red-100",    text:"text-red-700",    border:"border-red-200",    dot:"bg-red-500",    icon:"🔴" },
  Medium: { bg:"bg-amber-100",  text:"text-amber-700",  border:"border-amber-200",  dot:"bg-amber-500",  icon:"🟡" },
  Low:    { bg:"bg-slate-100",  text:"text-slate-500",  border:"border-slate-200",  dot:"bg-slate-400",  icon:"⚪" },
};
const STATUS_CFG = {
  Active:    { bg:"bg-green-100",  text:"text-green-700",  dot:"bg-green-500",  icon:"✅" },
  Snoozed:   { bg:"bg-blue-100",   text:"text-blue-700",   dot:"bg-blue-500",   icon:"😴" },
  Completed: { bg:"bg-teal-100",   text:"text-teal-700",   dot:"bg-teal-500",   icon:"☑️" },
  Dismissed: { bg:"bg-slate-100",  text:"text-slate-500",  dot:"bg-slate-400",  icon:"🚫" },
};
const TYPE_CFG = {
  First_contact: { icon:"👋", label:"First Contact"       },
  Follow_up:     { icon:"🔄", label:"Follow Up"            },
  Quotation:     { icon:"📄", label:"Quotation"            },
  Payment:       { icon:"💳", label:"Payment"              },
  Document:      { icon:"📋", label:"Document"             },
  Birthday:      { icon:"🎂", label:"Birthday/Anniversary" },
  Confirmation:  { icon:"✅", label:"Confirmation"         },
  Custom:        { icon:"⭐", label:"Custom"               },
};
const STAGE_CFG = {
  "New Lead":      { bg:"bg-blue-100",   text:"text-blue-700"   },
  "Contacted":     { bg:"bg-yellow-100", text:"text-yellow-700" },
  "Follow Up":     { bg:"bg-orange-100", text:"text-orange-700" },
  "Qualified":     { bg:"bg-purple-100", text:"text-purple-700" },
  "Proposal Sent": { bg:"bg-indigo-100", text:"text-indigo-700" },
  "Converted":     { bg:"bg-green-100",  text:"text-green-700"  },
  "Lost":          { bg:"bg-red-100",    text:"text-red-700"    },
};
const LEAD_TYPE_CFG = {
  "Fresh Lead":     { bg:"bg-blue-50",   text:"text-blue-700",   border:"border-blue-200"   },
  "Repeat Customer":{ bg:"bg-teal-50",   text:"text-teal-700",   border:"border-teal-200"   },
  "Corporate":      { bg:"bg-indigo-50", text:"text-indigo-700", border:"border-indigo-200" },
  "VIP":            { bg:"bg-amber-50",  text:"text-amber-700",  border:"border-amber-200"  },
  "Regular":        { bg:"bg-green-50",  text:"text-green-700",  border:"border-green-200"  },
};
const SERVICE_ICON = {
  Hotel:"🏨", Flight:"✈️", Visa:"📋", Sightseeing:"🗺️",
  Vehicle:"🚗", Cruise:"🚢", Insurance:"🛡️", Passport:"📔",
};

const AVATAR_GRADS = [
  "from-blue-500 to-blue-600","from-purple-500 to-purple-600",
  "from-teal-500 to-teal-600","from-rose-500 to-rose-600",
  "from-amber-500 to-amber-600","from-indigo-500 to-indigo-600",
];
const avatarGrad = id => AVATAR_GRADS[(typeof id === "number" ? id : String(id).charCodeAt(0) || 0) % AVATAR_GRADS.length];
const initials   = name => (name || "U").trim().split(" ").map(w => w[0] || "").join("").slice(0,2).toUpperCase();

/* ─── HELPERS ────────────────────────────────────────────────── */
const fmtINR = n => n ? "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 0 }) : "₹0";
const fmtDate = d => d ? new Date(d).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) : "—";
const fmtDateTime = d => d ? new Date(d).toLocaleString("en-IN", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }) : "—";

function getDueText(dueDate) {
  if (!dueDate) return { text: "No due date", overdue: false, soon: false };
  const due   = new Date(dueDate); due.setHours(0,0,0,0);
  const today = new Date();        today.setHours(0,0,0,0);
  const diff  = Math.round((due - today) / 86400000);
  if (diff < 0)  return { text:`Overdue by ${Math.abs(diff)} day${Math.abs(diff)===1?"":"s"}`, overdue:true, soon:false };
  if (diff === 0) return { text:"Due Today!", overdue:false, soon:true };
  if (diff <= 3)  return { text:`Due in ${diff} day${diff===1?"":"s"}`, overdue:false, soon:true };
  return { text:`Due ${fmtDate(dueDate)}`, overdue:false, soon:false };
}

/* ─── MAP backend data → reminder shape ─────────────────────── */
const STATUS_MAP = {
  active: "Active",
  snoozed: "Snoozed",
  completed: "Completed",
  dismissed: "Dismissed",
};

const PRIORITY_MAP = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const TYPE_MAP = {
  first_contact: "First_contact",
  firstcontact: "First_contact",
  follow_up: "Follow_up",
  followup: "Follow_up",
  quotation: "Quotation",
  payment: "Payment",
  document: "Document",
  birthday: "Birthday",
  confirmation: "Confirmation",
  custom: "Custom",
};

const normaliseKey = value => String(value ?? "")
  .trim()
  .replace(/[\s-]+/g, "_")
  .toLowerCase();

const normaliseStatus = value => STATUS_MAP[normaliseKey(value)] || "Active";
const normalisePriority = value => PRIORITY_MAP[normaliseKey(value)] || "Medium";
const normaliseType = value => TYPE_MAP[normaliseKey(value)] || "Custom";

function extractReminderArray(res) {
  const body = res?.data;
  const candidates = [
    body?.data?.content,
    body?.data?.reminders,
    body?.data?.items,
    body?.data,
    body?.content,
    body?.reminders,
    body?.items,
    body,
  ];
  return candidates.find(Array.isArray) || [];
}

function mapToReminder(item = {}, idx = 0) {
  const dueDate =
    item.dueDate ||
    item.dueAt ||
    item.followUpDate ||
    item.reminderDate ||
    item.remindAt ||
    null;

  const publicId = item.publicId || item.reminderPublicId || item.id || `r-${idx}`;
  const leadId = item.leadPublicId || item.leadId || item.lead?.publicId || item.lead?.id || "";
  const assignedUser = item.assignToName || item.assignedUserName || item.assignedToName ||
    item.assignedUser?.fullName || item.assignedUser?.name || item.assignTo || "Unassigned";

  return {
    id: publicId,
    reminderId: publicId,
    backendId: item.id ?? null,
    leadId,
    leadName: item.leadName || item.customerName || item.lead?.customerName || "Unknown",
    phone: item.phone || item.leadPhone || item.lead?.phone || "",
    title: item.title || item.subject || "Untitled Reminder",
    description: item.description || item.notes || "",
    type: normaliseType(item.type || item.reminderType),
    priority: normalisePriority(item.priority),
    status: item.completed ? "Completed" : normaliseStatus(item.status),
    dueDate,
    snoozedUntil: item.snoozedUntil || null,
    notes: item.notes || "",
    createdAt: item.createdAt || new Date().toISOString(),
    leadStage: item.leadStage || item.lead?.leadStage || "New Lead",
    leadType: item.leadType || item.lead?.leadType || "Fresh Lead",
    assignTo: assignedUser,
    assignToPublicId: item.assignToPublicId || item.assignedUserPublicId || item.assignedUser?.publicId || null,
  };
}

/* ─── TOAST ──────────────────────────────────────────────────── */
function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed top-5 right-5 z-[999] flex items-center gap-3 px-4 py-3.5 rounded-2xl border shadow-2xl max-w-sm
      ${type === "success" ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}
      style={{ animation:"slideIn .3s ease both" }}>
      <span className="text-lg flex-shrink-0">{type === "success" ? "✅" : "❌"}</span>
      <p className="text-sm font-semibold flex-1">{msg}</p>
      <button onClick={onClose} className="opacity-50 hover:opacity-100 text-lg">×</button>
    </div>
  );
}

/* ─── SNOOZE MENU ───────────────────────────────────────────── */
function SnoozeMenu({ onSnooze, onClose }) {
  return (
    <div style={{ position:"absolute", top:"calc(100% + 6px)", left:0, zIndex:10000,
      background:"#fff", border:"1px solid #e2e8f0", borderRadius:"14px",
      boxShadow:"0 8px 40px rgba(0,0,0,0.18)", minWidth:"175px",
      padding:"6px 0", whiteSpace:"nowrap" }}
      onClick={e => e.stopPropagation()}>
      <p style={{ padding:"6px 14px 8px", fontSize:"10px", fontWeight:800,
        color:"#94a3b8", textTransform:"uppercase", letterSpacing:".07em" }}>
        Snooze for…
      </p>
      {SNOOZE_OPTS.map(opt => (
        <button key={opt.label}
          onClick={e => { e.stopPropagation(); onSnooze(opt.hours); onClose(); }}
          style={{ display:"flex", alignItems:"center", gap:"10px", width:"100%",
            textAlign:"left", padding:"9px 14px", fontSize:"13px", fontWeight:600,
            color:"#334155", background:"none", border:"none", cursor:"pointer" }}
          onMouseEnter={e => { e.currentTarget.style.background="#eff6ff"; e.currentTarget.style.color="#1d4ed8"; }}
          onMouseLeave={e => { e.currentTarget.style.background="none"; e.currentTarget.style.color="#334155"; }}>
          <MdSnooze style={{ width:15, height:15, color:"#60a5fa", flexShrink:0 }} />
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ─── VIEW LEAD MODAL ────────────────────────────────────────── */
function ViewLeadModal({ reminder, onClose }) {
  const navigate = useNavigate();
  const [lead,    setLead]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!reminder) return;
    const leadId = reminder.leadId;
    if (!leadId) {
      setLead({
        name: reminder.leadName, phone: reminder.phone,
        email:"—", source:"—", type: reminder.leadType || "Fresh Lead",
        stage: reminder.leadStage || "New Lead", assignTo: reminder.assignTo || "—",
        destination:"—", travelDate:null, travellers:"—",
        services:[], budget:0, itinerary:[],
        notes: reminder.notes || "", createdAt: reminder.createdAt,
        _noId: true,
      });
      setLoading(false);
      return;
    }
    setLoading(true);
    leadService.getLeadById(leadId)
      .then(res => {
        const b = res.data?.data ?? res.data;
        const adults   = b.adults   || 0;
        const children = b.children || 0;
        const infants  = b.infants  || 0;
        const trav = [];
        if (adults)   trav.push(`${adults} Adult${adults>1?"s":""}`);
        if (children) trav.push(`${children} Child${children>1?"ren":""}`);
        if (infants)  trav.push(`${infants} Infant${infants>1?"s":""}`);
        setLead({
          leadId:      b.publicId || leadId,
          name:        b.customerName    || reminder.leadName,
          phone:       b.phone           || reminder.phone,
          email:       b.email           || "—",
          source:      b.leadSource      || "—",
          type:        b.leadType        || "Fresh Lead",
          stage:       b.leadStage       || "New Lead",
          assignTo:    b.assignedUser?.fullName || b.assignedUser?.name || b.assignTo || "—",
          destination: b.itinerary?.[0]?.destination || b.departCity || "—",
          travelDate:  b.travelDate      || null,
          travellers:  trav.join(" · ")  || "—",
          services:    Array.isArray(b.services)   ? b.services   : [],
          itinerary:   Array.isArray(b.itinerary)  ? b.itinerary  : [],
          budget:      b.budget || 0,
          notes:       b.notes  || reminder.notes || "",
          createdAt:   b.createdAt || reminder.createdAt,
        });
      })
      .catch(() => {
        setLead({
          name: reminder.leadName, phone: reminder.phone,
          email:"—", source:"—", type: reminder.leadType || "Fresh Lead",
          stage: reminder.leadStage || "New Lead", assignTo: reminder.assignTo || "—",
          destination:"—", travelDate:null, travellers:"—",
          services:[], budget:0, itinerary:[],
          notes: reminder.notes || "", createdAt: reminder.createdAt,
          _fallback: true,
        });
      })
      .finally(() => setLoading(false));
  }, [reminder]);

  if (!reminder) return null;

  const stageCfg = STAGE_CFG[lead?.stage]    || STAGE_CFG["New Lead"];
  const typeCfg  = LEAD_TYPE_CFG[lead?.type] || LEAD_TYPE_CFG["Fresh Lead"];
  const leadId   = reminder.leadId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto z-10"
        style={{ animation:"popIn .25s ease both" }}>

        <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-5 rounded-t-2xl">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${avatarGrad(1)} flex items-center justify-center text-white font-extrabold text-lg shadow-lg flex-shrink-0`}>
                {loading ? "…" : initials(lead?.name || "?")}
              </div>
              <div>
                <h2 className="text-white text-xl font-extrabold">
                  {loading ? "Loading…" : (lead?.name || reminder.leadName)}
                </h2>
                <p className="text-white/70 text-sm">{leadId ? `#${String(leadId).slice(0,16)}` : "No lead ID"}</p>
                {!loading && lead && (
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${stageCfg.bg} ${stageCfg.text}`}>{lead.stage}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${typeCfg?.border||""} ${typeCfg?.bg||""} ${typeCfg?.text||""}`}>{lead.type}</span>
                  </div>
                )}
              </div>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-lg transition-all flex-shrink-0">
              ×
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {!loading && (lead?._noId || lead?._fallback) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
              <span className="text-amber-500 flex-shrink-0">⚠️</span>
              <p className="text-xs text-amber-700 font-medium">
                {lead._noId
                  ? "This reminder has no linked lead ID. Showing reminder data only."
                  : "Could not load lead from backend. Showing reminder data as fallback."}
              </p>
            </div>
          )}

          {loading && (
            <div className="space-y-3 animate-pulse">
              {[...Array(4)].map((_,i) => <div key={i} className="h-14 bg-slate-100 rounded-xl"/>)}
            </div>
          )}

          {!loading && lead && (
            <>
              <div className="bg-blue-50 rounded-xl px-4 py-3 border border-blue-100 flex items-start gap-3">
                <FiBell className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-extrabold text-blue-700">Related Reminder</p>
                  <p className="text-sm font-semibold text-blue-800 mt-0.5">{reminder.title}</p>
                  <p className="text-xs text-blue-500 mt-0.5">Due: {fmtDate(reminder.dueDate)}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  [FiPhone,     "Phone",       lead.phone,    "bg-green-50 text-green-600"  ],
                  [FiMail,      "Email",        lead.email,    "bg-blue-50 text-blue-600"    ],
                  [FiTag,       "Source",       lead.source,   "bg-purple-50 text-purple-600"],
                  [FiUserCheck, "Assigned To",  lead.assignTo, "bg-indigo-50 text-indigo-600"],
                ].map(([Icon, label, val, ic]) => (
                  <div key={label} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${ic}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-400 font-medium">{label}</p>
                      <p className="text-sm font-bold text-slate-700 truncate">{val || "—"}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  [FiMapPin,     "Destination", lead.destination],
                  [FiCalendar,   "Travel Date",  fmtDate(lead.travelDate)],
                  [FiUser,       "Travellers",   lead.travellers],
                  [FiDollarSign, "Budget",        fmtINR(lead.budget)],
                ].map(([Icon, label, val]) => (
                  <div key={label} className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
                    <Icon className="w-4 h-4 text-slate-400 mx-auto mb-1" />
                    <p className="text-xs text-slate-400 font-medium">{label}</p>
                    <p className="text-xs font-bold text-slate-700 mt-0.5 truncate">{val || "—"}</p>
                  </div>
                ))}
              </div>

              {lead.itinerary?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Itinerary</p>
                  <div className="flex flex-wrap gap-2">
                    {lead.itinerary.map((item,i) => (
                      <span key={i} className="bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl text-sm font-semibold text-slate-700">
                        {item.destination} <span className="text-blue-600 font-extrabold">({item.nights}N)</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {lead.services?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Services Required</p>
                  <div className="flex flex-wrap gap-2">
                    {lead.services.map(s => (
                      <span key={s} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                        {SERVICE_ICON[s] || "📌"} {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {lead.notes && (
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                  <p className="text-xs font-extrabold text-amber-700 mb-1.5 flex items-center gap-1.5">
                    <FaStickyNote className="w-3 h-3" /> Notes
                  </p>
                  <p className="text-sm text-amber-800 leading-relaxed whitespace-pre-line">{lead.notes}</p>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-100 pt-3">
                <span>Lead created: {fmtDateTime(lead.createdAt)}</span>
                <span>Reminder due: {fmtDate(reminder.dueDate)}</span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <a href={`tel:${lead.phone}`}
                  className="flex-1 min-w-[100px] py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all">
                  <FaPhoneAlt className="w-3.5 h-3.5" /> Call
                </a>
                <a href={`https://wa.me/${(lead.phone||"").replace(/\D/g,"")}`} target="_blank" rel="noreferrer"
                  className="flex-1 min-w-[100px] py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all">
                  <FaWhatsapp className="w-4 h-4" /> WhatsApp
                </a>
                {leadId && (
                  <button onClick={() => { onClose(); navigate(`/EditLead/${leadId}`); }}
                    className="flex-1 min-w-[100px] py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all">
                    <FiExternalLink className="w-3.5 h-3.5" /> Edit Lead
                  </button>
                )}
                <button onClick={onClose}
                  className="flex-1 min-w-[100px] py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 text-sm font-bold flex items-center justify-center gap-2 transition-all">
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── ADD LOG MODAL ──────────────────────────────────────────── */
function LogModal({ reminder, onClose, onSaved }) {
  const [comment,        setComment]        = useState("");
  const [createReminder, setCreateReminder] = useState(false);
  const [followUpDate,   setFollowUpDate]   = useState("");
  const [saving,         setSaving]         = useState(false);
  const [err,            setErr]            = useState("");
  const today = new Date().toISOString().slice(0,10);

  const handleSave = async () => {
    if (!comment.trim() || comment.trim().length < 5) {
      setErr("Comment must be at least 5 characters."); return;
    }
    if (createReminder && !followUpDate) {
      setErr("Please pick a follow-up date."); return;
    }
    setSaving(true);
    try {
      const leadId = reminder.leadId;
      if (leadId) {
        await leadService.addLog(leadId, {
          comment,
          createReminder,
          followUpDate: followUpDate || null,
          stage: reminder.leadStage || "",
        });
      }
      onSaved(comment);
      onClose();
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to save log. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 p-6"
        style={{ animation:"popIn .25s ease both" }}>
        <h3 className="text-base font-extrabold text-slate-800 mb-0.5">Add Activity Log</h3>
        <p className="text-xs text-slate-500 mb-4">{reminder?.leadName} — {reminder?.title}</p>

        {err && (
          <div className="flex items-center gap-2 text-xs text-red-500 font-semibold mb-3 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            <FiAlertCircle className="w-3.5 h-3.5 flex-shrink-0"/> {err}
          </div>
        )}

        <textarea
          rows={4}
          value={comment}
          onChange={e => { setComment(e.target.value); setErr(""); }}
          placeholder="What happened? e.g. Called customer, no answer. Will retry tomorrow 10am..."
          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700
            placeholder-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none transition-all resize-none mb-3"/>

        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={createReminder}
              onChange={e => { setCreateReminder(e.target.checked); if (!e.target.checked) { setFollowUpDate(""); setErr(""); } }}
              className="w-4 h-4 mt-0.5 rounded border-slate-300 text-amber-600 focus:ring-amber-400 cursor-pointer"/>
            <div>
              <p className="text-sm font-bold text-slate-700 select-none">Create follow-up reminder</p>
              <p className="text-xs text-slate-400 mt-0.5">Check to add a dated follow-up task</p>
            </div>
          </label>
          {createReminder && (
            <input type="date" value={followUpDate} min={today}
              onChange={e => { setFollowUpDate(e.target.value); setErr(""); }}
              className="mt-2 w-full px-3 py-2 rounded-xl border border-amber-300 bg-white text-sm focus:border-amber-400 outline-none"/>
          )}
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} disabled={saving}
            className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/>}
            {saving ? "Saving…" : "Save Log"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── EDIT REMINDER MODAL ────────────────────────────────────── */
function ReminderFormModal({ reminder, onClose, onSave }) {
  const [form, setForm] = useState(reminder || {
    title:"", description:"", type:"Follow_up", priority:"Medium",
    status:"Active", leadName:"", phone:"", dueDate:"", notes:"",
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const dueDateForInput = form.dueDate ? new Date(form.dueDate).toISOString().slice(0,16) : "";
  const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none transition-all";
  const selCls   = inputCls + " appearance-none cursor-pointer";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto z-10 p-6"
        style={{ animation:"popIn .25s ease both" }}>
        <h3 className="text-base font-extrabold text-slate-800 mb-4">Edit Reminder</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Title *</label>
            <input value={form.title} onChange={e => set("title", e.target.value)} placeholder="Reminder title" className={inputCls}/>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Description</label>
            <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={2} placeholder="Description" className={inputCls + " resize-none"}/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Type</label>
              <div className="relative">
                <select value={form.type} onChange={e => set("type", e.target.value)} className={selCls + " pr-8"}>
                  {Object.entries(TYPE_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">▼</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Priority</label>
              <div className="relative">
                <select value={form.priority} onChange={e => set("priority", e.target.value)} className={selCls + " pr-8"}>
                  <option>High</option><option>Medium</option><option>Low</option>
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">▼</span>
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Due Date & Time *</label>
            <input type="datetime-local" value={dueDateForInput}
              onChange={e => set("dueDate", new Date(e.target.value).toISOString())} className={inputCls}/>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Notes</label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3} placeholder="Additional notes" className={inputCls + " resize-none"}/>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all">Cancel</button>
          <button onClick={() => onSave(form)} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition-all">Save Changes</button>
        </div>
      </div>
    </div>
  );
}

/* ─── REMINDER CARD ──────────────────────────────────────────── */
function ReminderCard({ r, onComplete, onDismiss, onSnooze, onEdit, onDelete, onAddLog, onViewLead, idx }) {
  const [showSnooze, setShowSnooze] = useState(false);
  const pc         = PRIORITY_CFG[r.priority] || PRIORITY_CFG.Medium;
  const sc         = STATUS_CFG[r.status]     || STATUS_CFG.Active;
  const tc         = TYPE_CFG[r.type]         || TYPE_CFG.Custom;
  const due        = getDueText(r.dueDate);
  const isCompleted = r.status === "Completed";
  const isDismissed = r.status === "Dismissed";
  const isDone      = isCompleted || isDismissed;

  return (
    <div className={`bg-white rounded-2xl border shadow-sm transition-all duration-300 group
      ${isDone ? "opacity-60 border-slate-200" : due.overdue ? "border-red-200 shadow-red-50" : "border-slate-200 hover:border-blue-200 hover:shadow-md"}`}
      style={{
        animation:"fadeUp .4s ease both",
        animationDelay:`${idx * 50}ms`,
        position:"relative",
        zIndex: showSnooze ? 500 : 1,
      }}>

      <div className={`h-1 w-full rounded-t-2xl ${due.overdue && !isDone ? "bg-red-500" : r.status === "Snoozed" ? "bg-blue-400" : isCompleted ? "bg-green-500" : r.priority === "High" ? "bg-amber-500" : r.priority === "Medium" ? "bg-yellow-400" : "bg-slate-300"}`} />

      <div className="px-4 pt-3 pb-0 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${sc.bg} ${sc.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
            {sc.icon} {r.status}
          </span>
          <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
            {tc.icon} {tc.label}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => onEdit(r)}
            className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-all">
            <FiEdit2 className="w-3 h-3" />
          </button>
          <button onClick={() => onDelete(r.id)}
            className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-red-100 text-slate-400 hover:text-red-500 flex items-center justify-center transition-all">
            <FiTrash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="p-4 pt-2 space-y-2.5">
        <div>
          <h3 className={`text-sm font-extrabold leading-tight mb-0.5 ${isDone ? "line-through text-slate-400" : "text-slate-800"}`}>
            {r.title}
          </h3>
          <p className="text-xs text-slate-400">{r.description}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${avatarGrad(idx)} flex items-center justify-center text-white text-xs font-extrabold flex-shrink-0`}>
            {initials(r.leadName)}
          </div>
          <div>
            <p className="text-xs font-bold text-blue-600">{r.leadName}</p>
            <p className="text-xs text-slate-400">{r.phone}</p>
          </div>
        </div>

        <div className={`flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-2
          ${due.overdue && !isDone ? "bg-red-50 text-red-600 border border-red-100" :
            due.soon && !isDone    ? "bg-amber-50 text-amber-600 border border-amber-100" :
            isDone                 ? "bg-slate-50 text-slate-400" :
                                     "bg-slate-50 text-slate-500"}`}>
          <FiClock className="w-3 h-3 flex-shrink-0" />
          {isDone ? `Was due: ${fmtDateTime(r.dueDate)}` : due.text}
        </div>

        {r.notes && (
          <div className="bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
            <p className="text-xs text-amber-700 font-medium leading-relaxed line-clamp-2">{r.notes}</p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border ${pc.border} ${pc.bg} ${pc.text}`}>
            {pc.icon} {r.priority} Priority
          </span>
          <span className="text-xs text-slate-400">{fmtDateTime(r.dueDate)}</span>
        </div>

        {!isDone && (
          <div className="pt-2 border-t border-slate-100">
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              <button onClick={() => onComplete(r.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold transition-all shadow-sm">
                <FiCheckCircle className="w-3 h-3" /> Complete
              </button>

              <div style={{ position:"relative", zIndex: showSnooze ? 1000 : "auto" }}>
                <button
                  onClick={e => { e.stopPropagation(); setShowSnooze(s => !s); }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-sm">
                  <MdSnooze className="w-3.5 h-3.5" /> Snooze
                  <FiChevronDown className={`w-3 h-3 transition-transform ${showSnooze ? "rotate-180" : ""}`} />
                </button>
                {showSnooze && (
                  <SnoozeMenu
                    onSnooze={h => { onSnooze(r.id, h); setShowSnooze(false); }}
                    onClose={() => setShowSnooze(false)}
                  />
                )}
              </div>
              {showSnooze && (
                <div style={{ position:"fixed", inset:0, zIndex:999 }}
                  onClick={() => setShowSnooze(false)} />
              )}

              <button onClick={() => onDismiss(r.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-500 hover:bg-slate-600 text-white text-xs font-bold transition-all shadow-sm">
                <FiX className="w-3 h-3" /> Dismiss
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => onAddLog(r)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm">
                <MdOutlineAddTask className="w-3.5 h-3.5" /> Add Log
              </button>
              <button onClick={() => onViewLead(r)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold transition-all shadow-sm">
                <FiEye className="w-3 h-3" /> View Lead
              </button>
              <a href={`tel:${r.phone}`}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm">
                <FaPhoneAlt className="w-3 h-3" />
              </a>
              <a href={`https://wa.me/${(r.phone||"").replace(/\D/g,"")}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white text-xs font-bold transition-all shadow-sm">
                <FaWhatsapp className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}

        {isDone && (
          <div className="pt-2 border-t border-slate-100 flex gap-2">
            <button onClick={() => onEdit(r)}
              className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-all">
              ✏️ Edit
            </button>
            <button onClick={() => onViewLead(r)}
              className="flex-1 py-2 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5">
              <FiEye className="w-3 h-3" /> View Lead
            </button>
            <button onClick={() => onDelete(r.id)}
              className="flex-1 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 border border-red-200 text-xs font-bold transition-all">
              🗑 Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */
export default function Reminders() {
  const navigate = useNavigate();

  const [reminders, setReminders] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [fStatus,   setFStatus]   = useState("All Status");
  const [fPriority, setFPriority] = useState("All Priorities");
  const [fType,     setFType]     = useState("All Types");
  const [editR,     setEditR]     = useState(null);
  const [logR,      setLogR]      = useState(null);
  const [viewLeadR, setViewLeadR] = useState(null);
  const [toast,     setToast]     = useState(null);
  const [view,      setView]      = useState("grid");

  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  const showToast = useCallback((msg, type = "success") => setToast({ msg, type }), []);

  /* ── FETCH REAL DATA ── */
  const fetchReminders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reminderService.getAll();
      const rawArray = extractReminderArray(res);

      const items = rawArray
        .map((item, index) => ({ ...mapToReminder(item, index), _localId: index + 1 }))
        .sort((a, b) => {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;

          const aOverdue = a.status === "Active" && new Date(a.dueDate) < new Date();
          const bOverdue = b.status === "Active" && new Date(b.dueDate) < new Date();
          if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;

          return new Date(a.dueDate) - new Date(b.dueDate);
        });

      setReminders(items);
    } catch (err) {
      console.error("Reminders fetch error:", err);
      showToast(err?.response?.data?.message || "Failed to load reminders.", "error");
      setReminders([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  const stats = useMemo(() => ({
    total: reminders.length,
    active: reminders.filter(r => r.status === "Active").length,
    overdue: reminders.filter(r =>
      r.status === "Active" && r.dueDate && new Date(r.dueDate) < new Date()
    ).length,
    completed: reminders.filter(r => r.status === "Completed").length,
    snoozed: reminders.filter(r => r.status === "Snoozed").length,
  }), [reminders]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return reminders.filter(r => {
      if (
        query &&
        !String(r.title || "").toLowerCase().includes(query) &&
        !String(r.leadName || "").toLowerCase().includes(query) &&
        !String(r.phone || "").includes(query)
      ) return false;

      if (fStatus !== "All Status" && r.status !== fStatus) return false;
      if (fPriority !== "All Priorities" && r.priority !== fPriority) return false;
      if (fType !== "All Types" && r.type !== fType) return false;
      return true;
    });
  }, [reminders, search, fStatus, fPriority, fType]);

  const findReminder = useCallback(
    id => reminders.find(r => r.id === id || r._localId === id),
    [reminders]
  );

  const handleComplete = async id => {
    const current = findReminder(id);
    if (!current) return;

    try {
      await reminderService.updateStatus(current.reminderId, "Completed");
      setReminders(prev => prev.map(r =>
        r.id === current.id ? { ...r, status: "Completed" } : r
      ));
      showToast("Marked as completed! ✅");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to complete reminder.", "error");
    }
  };

  const handleDismiss = async id => {
    const current = findReminder(id);
    if (!current) return;

    try {
      await reminderService.updateStatus(current.reminderId, "Dismissed");
      setReminders(prev => prev.map(r =>
        r.id === current.id ? { ...r, status: "Dismissed" } : r
      ));
      showToast("Reminder dismissed.");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to dismiss reminder.", "error");
    }
  };

  const handleSnooze = async (id, hours) => {
    const current = findReminder(id);
    if (!current) return;

    const until = new Date();
    until.setHours(until.getHours() + hours);

    try {
      await reminderService.snooze(current.reminderId, until.toISOString());
      setReminders(prev => prev.map(r =>
        r.id === current.id
          ? {
              ...r,
              status: "Snoozed",
              snoozedUntil: until.toISOString(),
              dueDate: until.toISOString(),
            }
          : r
      ));
      const option = SNOOZE_OPTS.find(o => o.hours === hours);
      showToast(`Snoozed for ${option?.label || `${hours}h`} 😴`);
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to snooze reminder.", "error");
    }
  };

  const handleDelete = async id => {
    const current = findReminder(id);
    if (!current) return;
    if (!window.confirm(`Delete reminder "${current.title}"?`)) return;

    try {
      await reminderService.remove(current.reminderId);
      setReminders(prev => prev.filter(r => r.id !== current.id));
      showToast("Reminder deleted.");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to delete reminder.", "error");
    }
  };

  const handleSave = async form => {
    if (!form.title?.trim()) {
      showToast("Title is required.", "error");
      return;
    }
    if (!form.dueDate) {
      showToast("Due date is required.", "error");
      return;
    }
    if (!editR?.reminderId) {
      showToast("Reminder ID is missing.", "error");
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description?.trim() || "",
      type: form.type,
      priority: form.priority,
      status: form.status || editR.status,
      dueDate: form.dueDate,
      notes: form.notes?.trim() || "",
      leadPublicId: editR.leadId || null,
      assignToPublicId: editR.assignToPublicId || null,
      phone: editR.phone || "",
    };

    try {
      const res = await reminderService.update(editR.reminderId, payload);
      const updatedBody = res?.data?.data ?? res?.data;
      const updated = updatedBody && !Array.isArray(updatedBody)
        ? mapToReminder(updatedBody)
        : { ...editR, ...payload };

      setReminders(prev => prev.map(r =>
        r.id === editR.id ? { ...r, ...updated, id: r.id, reminderId: r.reminderId } : r
      ));
      showToast("Reminder updated.");
      setEditR(null);
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to update reminder.", "error");
    }
  };

  const handleLogSaved = async () => {
    showToast("Activity log added. Refreshing... ⏳");
    await fetchReminders();
  };

  function Sel({ val, onChange, opts }) {
    return (
      <div className="relative">
        <select value={val} onChange={e => onChange(e.target.value)}
          className="w-full pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 font-medium
            focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none appearance-none cursor-pointer transition-all">
          {opts.map(o => <option key={o}>{o}</option>)}
        </select>
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none">▼</span>
      </div>
    );
  }

  const STAT_CARDS = [
    { gradient:"from-cyan-500 to-cyan-600",     icon:"🔔", label:"Total",     value:stats.total     },
    { gradient:"from-amber-500 to-orange-500",  icon:"⏰", label:"Active",    value:stats.active    },
    { gradient:"from-red-500 to-red-600",       icon:"⚠️",  label:"Overdue",   value:stats.overdue   },
    { gradient:"from-green-500 to-emerald-600", icon:"✅", label:"Completed",  value:stats.completed },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-100"
      style={{ fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes slideIn { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn  { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes popIn   { from{transform:scale(.92);opacity:0} to{transform:scale(1);opacity:1} }
        .fade-up { animation:fadeUp .4s ease both; }
        select { -webkit-appearance:none; appearance:none; }
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:#f1f5f9;border-radius:99px}::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:99px}
      `}</style>

      {toast      && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {editR      && <ReminderFormModal reminder={editR} onClose={() => setEditR(null)} onSave={handleSave} />}
      {logR       && <LogModal reminder={logR} onClose={() => setLogR(null)} onSaved={comment => handleLogSaved(logR, comment)} />}
      {viewLeadR  && <ViewLeadModal reminder={viewLeadR} onClose={() => setViewLeadR(null)} />}

      <div className="bg-white/70 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-white text-xl shadow-lg shadow-blue-200">
                <FiBell className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-extrabold text-slate-800 tracking-tight">My Reminders</h1>
                <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">
                  <span className="hover:text-blue-600 cursor-pointer" onClick={() => navigate("/")}>Home</span>
                  <span className="mx-1">/</span>
                  <span className="text-blue-600 font-bold">Reminders</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={fetchReminders}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-blue-300 bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-600 text-sm font-bold transition-all shadow-sm">
                <FiRefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
              </button>
              <button onClick={() => navigate("/CreateReminder")}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-200 hover:shadow-lg transition-all">
                <FiPlus className="w-4 h-4" strokeWidth={2.5} /> Add Reminder
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {STAT_CARDS.map(({ gradient, icon, label, value }, i) => (
            <div key={label}
              className={`bg-gradient-to-br ${gradient} rounded-2xl p-5 text-white shadow-lg relative overflow-hidden group hover:-translate-y-1 hover:shadow-xl transition-all duration-300`}
              style={{ animation:"fadeUp .4s ease both", animationDelay:`${i*60}ms` }}>
              <div className="absolute -right-3 -bottom-3 text-white/20 text-7xl pointer-events-none">{icon}</div>
              <div className="relative z-10">
                <p className="text-3xl font-extrabold">{value}</p>
                <p className="text-xs font-bold uppercase tracking-widest opacity-85 mt-1">{label}</p>
              </div>
            </div>
          ))}
        </div> */}

        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
  {/* Collapsed/expanded toggle bar — default closed */}
  <button
    onClick={() => setAnalyticsOpen(o => !o)}
    className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50/60 transition-colors text-left"
  >
    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
      <FiBell className="w-4 h-4" />
    </div>
    <span className="text-sm font-extrabold text-slate-700 flex-shrink-0">Analytics</span>

    {/* Summary pills — only shown when collapsed */}
    {!analyticsOpen && (
      <div className="flex items-center gap-2 flex-wrap ml-1">
        <span className="text-xs font-bold px-3 py-1 rounded-full bg-cyan-100 text-cyan-700 border border-cyan-200">{stats.total} Total</span>
        <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">{stats.active} Active</span>
        <span className="text-xs font-bold px-3 py-1 rounded-full bg-red-100 text-red-700 border border-red-200">{stats.overdue} Overdue</span>
        <span className="text-xs font-bold px-3 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">{stats.completed} Completed</span>
      </div>
    )}

    <FiChevronDown
      className="w-4 h-4 text-slate-400 ml-auto flex-shrink-0 transition-transform duration-300"
      style={{ transform: analyticsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
    />
  </button>

  {/* Full gradient cards — only rendered when open */}
  {analyticsOpen && (
    <div
      className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-5 pb-5"
      style={{ animation: "fadeIn .25s ease both" }}
    >
      {STAT_CARDS.map(({ gradient, icon, label, value }, i) => (
        <div key={label}
          className={`bg-gradient-to-br ${gradient} rounded-2xl p-5 text-white shadow-lg relative overflow-hidden group hover:-translate-y-1 hover:shadow-xl transition-all duration-300`}
          style={{ animation:"fadeUp .4s ease both", animationDelay:`${i*60}ms` }}>
          <div className="absolute -right-3 -bottom-3 text-white/20 text-7xl pointer-events-none">{icon}</div>
          <div className="relative z-10">
            <p className="text-3xl font-extrabold">{value}</p>
            <p className="text-xs font-bold uppercase tracking-widest opacity-85 mt-1">{label}</p>
          </div>
        </div>
      ))}
    </div>
  )}
</div>

        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search lead name, phone, title…"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none transition-all"/>
            </div>
            <div className="w-full sm:w-40"><Sel val={fStatus}   onChange={setFStatus}   opts={STATUSES}/></div>
            <div className="w-full sm:w-44"><Sel val={fPriority} onChange={setFPriority} opts={PRIORITIES}/></div>
            <div className="w-full sm:w-48"><Sel val={fType}     onChange={setFType}     opts={TYPES}/></div>
            {(search || fStatus !== "All Status" || fPriority !== "All Priorities" || fType !== "All Types") && (
              <button onClick={() => { setSearch(""); setFStatus("All Status"); setFPriority("All Priorities"); setFType("All Types"); }}
                className="text-xs text-red-400 hover:text-red-600 font-bold flex items-center gap-1 px-3 py-2 rounded-xl hover:bg-red-50 transition-all whitespace-nowrap">
                <FiX className="w-3 h-3"/> Clear
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500 font-medium">
            <span className="font-extrabold text-slate-700">{filtered.length}</span> reminder{filtered.length !== 1 ? "s" : ""}
            {filtered.length !== reminders.length && ` (filtered from ${reminders.length})`}
          </p>
          <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1">
            {["grid","list"].map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === v ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                {v === "grid" ? "⊞ Grid" : "☰ List"}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_,i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 h-64 animate-pulse"/>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm p-16 text-center">
            <div className="text-6xl mb-4">🔔</div>
            <p className="text-lg font-extrabold text-slate-600 mb-2">No reminders found</p>
            {reminders.length === 0 ? (
              <>
                <p className="text-sm text-slate-400 mb-2">No reminders or follow-up logs yet.</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  To create reminders: go to <strong>Leads</strong> → expand a lead → click <strong>Add Log</strong> → check <strong>"Create follow-up reminder"</strong> → pick a date.
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-400">Try adjusting your filters.</p>
            )}
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((r, idx) => (
              <ReminderCard key={r.id || r._localId} r={r} idx={idx}
                onComplete={handleComplete}
                onDismiss={handleDismiss}
                onSnooze={handleSnooze}
                onEdit={setEditR}
                onDelete={handleDelete}
                onAddLog={setLogR}
                onViewLead={setViewLeadR}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                <tr>
                  {["Status","Lead","Title","Due Date","Priority","Type","Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((r, idx) => {
                  const pc  = PRIORITY_CFG[r.priority] || PRIORITY_CFG.Medium;
                  const sc  = STATUS_CFG[r.status]     || STATUS_CFG.Active;
                  const tc  = TYPE_CFG[r.type]         || TYPE_CFG.Custom;
                  const due = getDueText(r.dueDate);
                  return (
                    <tr key={r.id || r._localId}
                      className={`transition-colors hover:bg-slate-50 ${due.overdue && r.status==="Active" ? "bg-red-50/30" : ""}`}
                      style={{ animation:"fadeUp .35s ease both", animationDelay:`${idx*20}ms` }}>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}/>{sc.icon} {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-800 text-xs">{r.leadName}</p>
                        <p className="text-slate-400 text-[10px]">{r.phone}</p>
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="font-semibold text-slate-700 truncate text-xs">{r.title}</p>
                        {r.description && <p className="text-slate-400 text-[10px] truncate">{r.description}</p>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className={`text-xs font-bold ${due.overdue && r.status==="Active" ? "text-red-600" : due.soon ? "text-amber-600" : "text-slate-700"}`}>
                          {fmtDate(r.dueDate)}
                        </p>
                        <p className="text-[10px] text-slate-400">{due.text}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${pc.border} ${pc.bg} ${pc.text}`}>
                          {pc.icon} {r.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-500">{tc.icon} {tc.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setViewLeadR(r)} title="View Lead"
                            className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition-all">
                            <FiEye className="w-3 h-3"/>
                          </button>
                          <button onClick={() => setLogR(r)} title="Add Log"
                            className="w-7 h-7 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-600 flex items-center justify-center transition-all">
                            <MdOutlineAddTask className="w-3 h-3"/>
                          </button>
                          <button onClick={() => setEditR(r)} title="Edit"
                            className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 flex items-center justify-center transition-all">
                            <FiEdit2 className="w-3 h-3"/>
                          </button>
                          <button onClick={() => handleDelete(r.id || r._localId)} title="Delete"
                            className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-all">
                            <FiTrash2 className="w-3 h-3"/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
