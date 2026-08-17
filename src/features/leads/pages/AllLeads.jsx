

import { useState, useEffect, memo, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { leadService } from "../api/leadService";
import { leadAlertService } from "../api/leadAlertService";
import { quotationService } from "@features/quotation";
import { hasPermission, P } from "@shared/lib/access";
import { useToast } from "@shared/ui/toast";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import AccessDenied from "../components/AccessDenied";
// Lifted out of this file so AllLeadLogs can use the same popups instead of routing to the
// duplicate AddLeadLog / LeadLogs pages, which had drifted out of sync with these.
import { AddLogModal, LogsModal } from "../components/LeadLogModals";
import { formatToWhatsAppLink } from "../lib/whatsapp";
import PdfDownloadLoader from '@/shared/ui/PdfDownloadLoader';
import { usePdfDownload } from '@shared/hooks/usePdfDownload';
// The record-side conversation drawer, from the whatsapp feature's barrel. It talks to the
// Communication Center, so what it shows is the same thread the /WhatsApp inbox shows —
// unlike the old local WhatsAppPanel, whose "chat" was session state around a wa.me link.
import { ConversationDrawer } from "@features/whatsapp";
import {
  Users, Trophy, TrendingUp, Search,
  DownloadCloud, FileText, Plus, Upload,
  Inbox, User, Calendar, ChevronDown,
  Eye, Pencil, Trash2, X, Mail, Phone, MapPin, Briefcase, CheckCircle, Copy,
  BarChart3, ArrowRightLeft, MessageCircle,
  DollarSign, Sparkles,
  Building2, Plane, Ship, Car, Camera,  Bell, AlertCircle, BookOpen, Shield, ExternalLink
} from 'lucide-react';
import { WhatsAppIcon as FaWhatsapp } from "@shared/ui/WhatsAppIcon";
import { Link } from 'react-router-dom';
import { QuotationWebView } from "@features/quotation";
import { WeblinkAnalyticsModal } from "@features/quotation";
import { SuggestPackagesModal } from "@features/quotation";
import { QuotationStyleModal } from "@features/quotation";
import ImportLeadsModal from "../components/ImportLeadsModal";

/* @tanstack/react-table is no longer imported. It only supplied getPaginationRowModel() here —
   paginating a page the server had already paginated — and made every row a Row wrapper the markup
   had to unwrap. Sorting and paging are both server parameters now. */


/* ─── COLOR HELPERS ───────────────────────────────────── */
const AVATAR_GRADIENTS = [
  'from-blue-700 to-blue-800',
  'from-red-600 to-red-800',
  'from-violet-700 to-purple-800',
  'from-emerald-700 to-emerald-800',
  'from-pink-700 to-rose-800',
  'from-amber-700 to-amber-800',
];
const ACCENT_SOLIDS = ['#1553CC', '#B91C1C', '#6D28D9', '#047857', '#BE185D', '#B45309'];

function colorForIndex(idx) {
  const i = idx % AVATAR_GRADIENTS.length;
  return { avatar: AVATAR_GRADIENTS[i], accent: ACCENT_SOLIDS[i] };
}

const STAGE_PILL = {
  'New Lead': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Contacted': 'bg-blue-100 text-blue-700 border-blue-200',
  'Follow Up': 'bg-amber-100 text-amber-700 border-amber-200',
  'Qualified': 'bg-violet-100 text-violet-700 border-violet-200',
  'Proposal Sent': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'Converted': 'bg-green-100 text-green-700 border-green-200',
  'Reopened': 'bg-cyan-100 text-cyan-700 border-cyan-200',
  'Lost': 'bg-red-100 text-red-700 border-red-200',
};
const stagePill = (stage) => STAGE_PILL[stage] || 'bg-orange-100 text-orange-700 border-orange-200';

/* Stages selectable from the row dropdown. "Converted" is intentionally excluded — conversion
   runs through the Convert-to-booking flow, not a manual pick — but if a lead is already in a
   stage outside this list, the row still shows its real value (the option is prepended). */
const STAGES = ['New Lead', 'Contacted', 'Follow Up', 'Qualified', 'Proposal Sent', 'Lost'];

/* The two closed stages, by DISPLAY NAME — LeadStage serialises through @JsonValue, so the wire
   format is "Converted"/"Lost", never the constant name. Mirrors LeadStageGroups.TERMINAL_STAGES
   on the backend: active = everything that is not one of these, so a stage added to the enum later
   counts as active on both sides without a change here. */
const TERMINAL_STAGE_NAMES = ['Converted', 'Lost'];

/* Backend LeadType — the priority vocabulary, exactly four values. Colour runs cold-to-hot so the
   pill reads at a glance. The old keys here ('Hot Lead', 'Warm Lead', 'Cold Lead', 'VIP',
   'Corporate', 'Repeat Customer') were a mix of values the API never accepted and business
   categories that now live on the CUSTOMER record, not the lead. */
const TYPE_PILL = {
  'Fresh': 'bg-blue-100 text-blue-700 border-blue-200',
  'Hot':   'bg-red-100 text-red-700 border-red-200',
  'Warm':  'bg-amber-100 text-amber-700 border-amber-200',
  'Cold':  'bg-slate-100 text-slate-700 border-slate-300',
};
const typePill = (type) => TYPE_PILL[type] || 'bg-slate-100 text-slate-700 border-slate-200';

/* Selectable lead types for the Type dropdown — keys match TYPE_PILL. */
const LEAD_TYPES = ['Fresh', 'Hot', 'Warm', 'Cold'];

/* A lead's services are stored as the lowercase ids the form emits — "hotel", "vehicle" —
   see leads/components/ServicesSection.jsx. Both maps below are keyed that way, and every
   lookup goes through svcKey, so a backend that sends "Hotel" or "HOTEL" still resolves
   instead of silently falling through to the generic briefcase. */
const svcKey = (svc) => String(svc || '').trim().toLowerCase();

// Exact pastel colors per service, matched to the design mockup
const SERVICE_COLORS = {
  hotel: { bg: '#E6F1FB', text: '#042C53' },
  flight: { bg: '#EEEDFE', text: '#26215C' },
  cruise: { bg: '#E1F5EE', text: '#04342C' },
  vehicle: { bg: '#FAECE7', text: '#4A1B0C' },
  visa: { bg: '#FBEAF0', text: '#4B1528' },
  passport: { bg: '#F1EFE8', text: '#2C2C2A' },
  sightseeing: { bg: '#FAEEDA', text: '#412402' },
  insurance: { bg: '#F3E8FF', text: '#3B0764' },
};
const serviceColor = (svc) => SERVICE_COLORS[svcKey(svc)] || { bg: '#F1F5F9', text: '#334155' };

/* One glyph per service — the Services column shows an icon strip, not text chips. */
const SERVICE_ICON = {
  hotel: Building2,
  flight: Plane,
  cruise: Ship,
  vehicle: Car,
  visa: FileText,
  passport: BookOpen,
  sightseeing: Camera,
  insurance: Shield,
};
const serviceIcon = (svc) => SERVICE_ICON[svcKey(svc)] || Briefcase;

/* Single source of truth for every traveller/pax display.
   long  → "2 Adults · 1 Child · 1 Infant"  (detail views: modal)
   short → "2A · 1C · 1I"                   (dense table cells)
   Zero values are omitted; pluralisation is correct in long mode. */
function formatTravellers(adults = 0, children = 0, infants = 0, { short = false } = {}) {
  const long = { a: ['Adult', 'Adults'], c: ['Child', 'Children'], i: ['Infant', 'Infants'] };
  const cell = (n, key, abbr) => short ? `${n}${abbr}` : `${n} ${long[key][n === 1 ? 0 : 1]}`;
  const parts = [];
  if (adults) parts.push(cell(adults, 'a', 'A'));
  if (children) parts.push(cell(children, 'c', 'C'));
  if (infants) parts.push(cell(infants, 'i', 'I'));
  return parts.length ? parts.join(' · ') : (short ? '—' : 'No travellers');
}

const fmtMoneyINR = (v) => v == null ? null
  : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);

/* Amount / Margin columns show paise, matching the old CRM's "₹310,000.00". */
const fmtAmountINR = (v) => v == null ? null
  : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

/* Lakh/crore short form for the money CARDS only — a pipeline sum is eight digits and the full
   "₹1,24,50,000" wraps and stops being readable at a glance. Table cells keep the exact figures
   above; this is deliberately the summary form, and the card says so. */
const fmtMoneyCompactINR = (v) => {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return fmtMoneyINR(n);
};

/* Seconds → the shortest honest unit. null stays "—": the backend sends null for "nobody has been
   contacted yet", and rendering that as 0s would read as an instant response — the opposite fact.
   Same rule the Incoming Leads page applies to the identical field. */
const fmtDurationShort = (seconds) => {
  if (seconds == null) return '—';
  const s = Number(seconds);
  if (!Number.isFinite(s)) return '—';
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${(s / 3600).toFixed(1)}h`;
};

/* Stage / type counts off the summary payload. Both arrive zero-filled from the server, so a
   missing key means the summary itself has not loaded — hence null, never 0, so callers can fall
   back to the loaded page instead of flashing a confident wrong zero. */
const stageCount = (summary, stage) =>
  summary?.byStage?.find(s => s.stage === stage)?.count ?? null;
const typeCount = (summary, type) =>
  summary?.byType?.find(t => t.type === type)?.count ?? null;

/* "1 Aug" — for the reporting-window caption on the conversion card. Parsed at local midnight
   rather than as a bare "YYYY-MM-DD" (which Date treats as UTC and renders a day early west of
   Greenwich). */
const fmtDayMon = (iso) => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

/* ─── NEXT ACTION ─────────────────────────────────────
   The column that answers the only question this screen exists to answer: who do I call next.
   Everything else in a row is reference data the agent has to read and judge; this is a verdict.

   Computed entirely from fields the list response already carries — followUpDate, logCount,
   firstContactedAt, createdAt, travelDate, leadStage, the claim/SLA window and whether a quotation
   exists — so it costs no extra request and no backend change.

   First match wins: the order of the blocks below IS the priority order. Only 'late' and 'due' get
   colour; everything else stays grey on purpose, so a coloured Next action always means the same
   thing — someone is waiting on us. */

const DAY_MS = 86400000;
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

/* "2026-09-12" is a LocalDate, not an instant — new Date() reads it as UTC midnight and lands on
   the previous day in any negative-offset zone. Split it instead. */
const parseDateOnly = (s) => {
  if (!s) return null;
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return (y && m && d) ? new Date(y, m - 1, d) : null;
};
const daysBetween = (later, earlier) => Math.round((later - earlier) / DAY_MS);

/* Stages a lead cannot be in unless a human already spoke to the customer. Display names, because
   that is the wire format — LeadStage serialises via @JsonValue, never NEW_LEAD. */
const CONTACTED_STAGES = new Set(['Contacted', 'Follow Up', 'Qualified', 'Proposal Sent', 'Reopened']);

function nextAction(lead, now = Date.now()) {
  const today = startOfToday();
  const stage = lead.leadStage;

  // Closed either way — nothing is owed, so it must not compete for attention.
  if (stage === 'Converted' || lead.convertedBookingPublicId) return { tone: 'done', label: 'Booked' };
  if (stage === 'Lost') return { tone: 'none', label: 'Closed' };

  /* 1. The trip already happened and this lead is STILL open.
        Ranked above the follow-up on purpose: chasing a quotation for a journey that has already
        come and gone is not work, it is noise, and the row needs a decision — close it, or re-date
        it. These leads are otherwise completely invisible; they sit in the pipeline inflating the
        Active card and the conversion rate forever, because nothing on the screen ever pointed at
        them. Amber, not red: nobody is waiting on us, but the row does need a hand today. */
  const travel = parseDateOnly(lead.travelDate);
  if (travel) {
    const past = daysBetween(today, travel);
    if (past > 0) return { tone: 'due', label: `Trip date passed · ${past}d` };
  }

  // 2. An explicit promise to the customer outranks every heuristic below it.
  const due = parseDateOnly(lead.followUpDate);
  if (due) {
    const late = daysBetween(today, due);
    if (late > 0) return { tone: 'late', label: `Follow-up ${late}d overdue` };
    if (late === 0) return { tone: 'due', label: 'Follow-up today' };
    if (late === -1) return { tone: 'soon', label: 'Follow-up tomorrow' };
  }

  // 3. Unclaimed lead with the first-response clock still running.
  if (lead.openToClaim && lead.createdAt) {
    const leftMs = (lead.slaTargetSeconds || 0) * 1000 - (now - new Date(lead.createdAt).getTime());
    return leftMs <= 0
      ? { tone: 'late', label: 'Unclaimed · SLA missed' }
      : { tone: 'due', label: `Unclaimed · ${Math.ceil(leftMs / 60000)}m left` };
  }

  /* 4. Never contacted. One day of silence is normal, three is a leak.
        "Never contacted" has to mean exactly that. Log count alone is not evidence: an agent who
        calls a customer and then flips the Stage dropdown to Contacted HAS contacted them, logged
        or not — and a lead sitting in Contacted that keeps being called never-contacted is how a
        column like this stops being believed. Three independent signals, any one is enough. */
  const everContacted =
    !!lead.firstContactedAt ||
    (lead.logCount || 0) > 0 ||
    CONTACTED_STAGES.has(stage);

  const created = lead.createdAt ? new Date(lead.createdAt) : null;
  const ageDays = created
    ? daysBetween(today, new Date(created.getFullYear(), created.getMonth(), created.getDate()))
    : 0;
  if (!everContacted && ageDays >= 1) {
    return { tone: ageDays >= 3 ? 'late' : 'due', label: `Never contacted · ${ageDays}d` };
  }

  /* 5. Contacted once, then went quiet. The natural continuation of rule 4: that one answers "has
        anyone EVER spoken to them", this one answers "when did we last", which is how live leads
        actually die — nobody decides to drop them, they just stop being called.

        Reads lastActivityAt (newest non-deleted LeadLog, added to the list DTO for this). Absent on
        a lead whose contact was recorded only as a stage change, and that is correct: with no log
        there is no date to age, and rule 4's stage signal already stopped it shouting. */
  const lastActivity = lead.lastActivityAt ? new Date(lead.lastActivityAt) : null;
  if (lastActivity && !Number.isNaN(lastActivity.getTime())) {
    const quietDays = daysBetween(
      today,
      new Date(lastActivity.getFullYear(), lastActivity.getMonth(), lastActivity.getDate()));
    // 7 days is a week gone by with no touch; 14 is a lead nobody is working any more.
    if (quietDays >= 14) return { tone: 'late', label: `No contact · ${quietDays}d` };
    if (quietDays >= 7) return { tone: 'due', label: `No contact · ${quietDays}d` };
  }

  // 6. Departure closing in while the lead is still open. (Past dates were handled by rule 1.)
  if (travel) {
    const inDays = daysBetween(travel, today);
    if (inDays === 0) return { tone: 'due', label: 'Travels today' };
    if (inDays > 0 && inDays <= 14) return { tone: 'due', label: `Travels in ${inDays}d` };
  }

  /* 7. Pipeline nudges — a hint, never a shout.

        The quote being well above what the customer said they could spend is the single most common
        reason a "sent" quotation never gets answered, and both numbers were already sitting in the
        row four columns apart with nothing comparing them. Ranked above "chase reply" because the
        action is different: revise or renegotiate, not follow up again. */
  const budget = Number(lead.budget);
  const quoted = Number(lead.latestQuotation?.grandTotal);
  if (Number.isFinite(budget) && budget > 0 && Number.isFinite(quoted) && quoted > budget) {
    const overPct = Math.round(((quoted - budget) / budget) * 100);
    // 15% is the line between "rounding and extras" and "this is not the trip they asked for".
    if (overPct >= 15) return { tone: 'hint', label: `Quote ${overPct}% over budget` };
  }

  if (lead.latestQuotation?.publicId) return { tone: 'hint', label: 'Quote sent · chase reply' };
  if (stage === 'Qualified') return { tone: 'hint', label: 'Send quotation' };
  // The hygiene case rule 3 deliberately stopped shouting about: contact happened, but there is no
  // record of what was said. Worth a nudge, not a red row.
  if (!(lead.logCount > 0)) return { tone: 'hint', label: 'Contacted · no log yet' };
  // A lead parked in Follow Up with no date will never surface in rule 1 — say so.
  if (stage === 'Follow Up' && !due) return { tone: 'hint', label: 'Set a follow-up date' };
  if (stage === 'New Lead' || stage === 'Contacted') return { tone: 'hint', label: 'Qualify this lead' };

  // 8. A follow-up genuinely in the future needs nothing today — state it and stay quiet.
  if (due) return { tone: 'none', label: `Follow-up ${due.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}` };

  return { tone: 'none', label: '—' };
}

const ACTION_TONE = {
  late: { dot: 'bg-red-500',     text: 'text-red-700',   wrap: 'bg-red-50 border-red-200' },
  due:  { dot: 'bg-amber-500',   text: 'text-amber-800', wrap: 'bg-amber-50 border-amber-200' },
  soon: { dot: 'bg-slate-400',   text: 'text-slate-600', wrap: 'bg-white border-slate-200' },
  hint: { dot: 'bg-blue-400',    text: 'text-slate-500', wrap: 'bg-transparent border-transparent' },
  done: { dot: 'bg-emerald-500', text: 'text-slate-400', wrap: 'bg-transparent border-transparent' },
  none: { dot: 'bg-slate-200',   text: 'text-slate-400', wrap: 'bg-transparent border-transparent' },
};

/* ─── TABLE LAYOUT ────────────────────────────────────── */
/* One source of truth for the columns — header, every row and the loading skeleton read
   this, so nothing can drift out of alignment. The table scrolls horizontally inside its
   wrapper (16 columns don't fit any laptop, same as the legacy CRM). */
const LEAD_COLUMNS = [
  { key: 'select', label: '', width: 44, align: 'center' },
  /* One person, one column. This was two — a 132px "Lead ID" holding a code and a created date,
     sitting next to a 208px "Lead Info" holding the same person's name. The code now rides on the
     name line and the created date moved into Next action, where a lead's age is the thing that
     makes it urgent. */
  { key: 'info', label: 'Lead', width: 232, sortKey: 'customerName' },
  /* Placed second on purpose: after identity, the very next thing an agent should read is what they
     owe this lead — not the destination. */
  { key: 'action', label: 'Next action', width: 172 },
  { key: 'dest', label: 'Destination', width: 152 },
  { key: 'travel', label: 'Travelers Info', width: 176, sortKey: 'travelDate' },
  { key: 'services', label: 'Services', width: 96, align: 'center' },
  { key: 'quote', label: 'Quotation', width: 160, align: 'center' },
  { key: 'booking', label: 'Booking', width: 122, align: 'center' },
  { key: 'weblink', label: 'Weblink', width: 126, align: 'center' },
  { key: 'logging', label: 'Logging', width: 94, align: 'center' },
  { key: 'assigned', label: 'Assigned To', width: 150 },
  { key: 'amount', label: 'Amount', width: 132, align: 'right' },
  { key: 'margin', label: 'Margin', width: 120, align: 'right' },
  { key: 'type', label: 'Type', width: 128, align: 'center', sortKey: 'leadType' },
  { key: 'stage', label: 'Stage', width: 138, align: 'center', sortKey: 'leadStage' },
  { key: 'actions', label: 'Actions', width: 112, align: 'center' },
];

/* Which headers are clickable. `sortKey` is the ENTITY property the backend sorts on, and every value
   here must be in LeadServiceImpl.LEAD_SORT_WHITELIST or the server silently falls back to createdAt.

   Amount and Margin are deliberately NOT sortable: both live on the lead's latest QUOTATION, not on
   Lead, so there is no column for Postgres to order by. Sorting them would need the list query to
   join the latest-quotation projection — real work, not a flag. Offering a header that quietly
   sorted by something else would be worse than not offering it. */
const LEAD_TABLE_MIN_W = LEAD_COLUMNS.reduce((sum, c) => sum + c.width, 0);

/* Shared cell chrome — vertical rules between columns, consistent padding.
   Two paddings, identical otherwise: density changes the row HEIGHT and nothing else, so compact is
   the same table with more of it on screen. LeadRow shadows `TD` with whichever applies;
   everything else (the skeleton) keeps the comfortable default. */
const TD_COMFY = 'px-2.5 py-2.5 align-middle border-r border-slate-100 last:border-r-0';
const TD_COMPACT = 'px-2.5 py-1 align-middle border-r border-slate-100 last:border-r-0';
const TD = TD_COMFY;

/* Frozen first columns.

   The table is 2154px wide and always scrolls sideways on a laptop, so reaching Stage or Actions
   means the name has already left the screen — you end up scrolling back and forth to check whose
   row you are about to change. Pinning the checkbox and the Lead column removes that entirely, and
   costs nothing visually until you actually scroll.

   The cells need their OWN background: a sticky cell floats over its neighbours, so without one the
   scrolled content shows straight through. That in turn breaks the row's `hover:bg-slate-50/70`,
   which is why the <tr> carries `group` and these use `group-hover:`.

   Edge separation is a box-shadow, not a border: `border-collapse: collapse` (set on the table)
   drops borders on sticky cells in several browsers, and the shadow doubles as the depth cue that
   tells you the column is pinned. */
const FROZEN_TH = {
  select: 'sticky left-0 z-20 bg-blue-600',
  info: 'sticky left-[44px] z-20 bg-blue-600 shadow-[2px_0_5px_-2px_rgba(15,23,42,.35)]',
};
const FROZEN_TD = {
  select: 'sticky left-0 z-10 bg-white group-hover:bg-slate-50',
  info: 'sticky left-[44px] z-10 bg-white group-hover:bg-slate-50 shadow-[2px_0_5px_-2px_rgba(15,23,42,.12)]',
};
const alignClass = (a) => a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left';

/* ─── PAGINATION ─────────────────────────────────────── */
function buildPageNumbers(totalPages, pageIndex) {
  if (totalPages <= 0) return [];
  return Array.from({ length: totalPages }, (_, i) => i)
    .filter(p => p === 0 || p === totalPages - 1 || Math.abs(p - pageIndex) <= 1)
    .reduce((acc, p, i, arr) => {
      if (i > 0 && p - arr[i - 1] > 1) acc.push('\u2026');
      acc.push(p);
      return acc;
    }, []);
}

const NavButton = memo(function NavButton({ label, onClick, disabled }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 text-xs font-bold
        hover:border-blue-300 hover:text-blue-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {label}
    </button>
  );
});

const PageButton = memo(function PageButton({ page, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all border ${isActive
        ? 'bg-gradient-to-br from-blue-500 to-blue-600 border-blue-600 text-white shadow-sm'
        : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600'
        }`}
    >
      {page + 1}
    </button>
  );
});

function CommonPagination({ pageIndex, pageSize, totalElements, totalPages, goToPage, changePageSize }) {
  const from = totalElements === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min((pageIndex + 1) * pageSize, totalElements);

  const pageNumbers = useMemo(
    () => buildPageNumbers(totalPages, pageIndex),
    [totalPages, pageIndex]
  );

  if (totalElements === 0) return null;

  const isFirst = pageIndex === 0;
  const isLast = pageIndex >= totalPages - 1;

  return (
    <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3">
      <p className="text-xs text-slate-400 font-medium">
        Showing <span className="font-bold text-slate-600">{from}</span>{'\u2013'}<span className="font-bold text-slate-600">{to}</span> of <span className="font-bold text-slate-600">{totalElements}</span>
      </p>
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        <NavButton label="«" onClick={() => goToPage(0)} disabled={isFirst} />
        <NavButton label="‹" onClick={() => goToPage(pageIndex - 1)} disabled={isFirst} />
        {pageNumbers.map((p, i) =>
          typeof p === 'string'
            ? <span key={`e${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-slate-400">{'\u2026'}</span>
            : <PageButton key={p} page={p} isActive={pageIndex === p} onClick={() => goToPage(p)} />
        )}
        <NavButton label="›" onClick={() => goToPage(pageIndex + 1)} disabled={isLast} />
        <NavButton label="»" onClick={() => goToPage(totalPages - 1)} disabled={isLast} />
        <select
          value={pageSize}
          onChange={e => changePageSize(Number(e.target.value))}
          className="ml-2 h-8 px-2 rounded-lg border border-slate-200 text-xs text-slate-600 font-medium bg-white focus:border-blue-400 outline-none cursor-pointer"
        >
          {[10, 25, 50, 100].map(s => <option key={s} value={s}>{s} / page</option>)}
        </select>
      </div>
    </div>
  );
}

/* ─── STAT CARD ──────────────────────────────────────── */
/* Same card as the Bookings dashboard (Allbookings.jsx:117) — label above the figure, icon in a
   rounded tile top-right, two decorative circles, requestAnimationFrame count-up. Kept visually
   identical on purpose: two list screens in the same product showing two different card languages
   reads as two different products.

   Two additions this page needs and Bookings does not:

   `value` may be a pre-formatted STRING — "₹4.20 L", "12m", "—". Money and durations must not go
   through the counter (it steps in integers), so a non-number is rendered as-is.

   `caption` is not decoration. These nine cards are measured over three different populations —
   the caller's own row scope, the tenant as a whole (the two claim-window figures), and the
   reporting period — so without a line saying which, the numbers look like they should add up,
   don't, and get reported as a bug. */
function StatCard({ card, value, caption, loading = false, onClick }) {
  const numeric = typeof value === 'number' && Number.isFinite(value);
  const [disp, setDisp] = useState(0);
  const raf = useRef(null);

  useEffect(() => {
    cancelAnimationFrame(raf.current);
    if (!numeric) return;
    const target = value;
    if (!target) { setDisp(0); return; }
    const start = performance.now();
    const step = (ts) => {
      const p = Math.min((ts - start) / 900, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisp(Math.round(ease * target));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [value, numeric]);

  const Icon = card.icon;
  const clickable = typeof onClick === 'function';

  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={clickable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
      } : undefined}
      className={`bg-gradient-to-br ${card.gradient} rounded-2xl p-5 text-white shadow-lg relative
        overflow-hidden group transition-all duration-300 outline-none h-full
        focus-visible:ring-4 focus-visible:ring-white/40
        ${clickable ? 'cursor-pointer hover:-translate-y-1 hover:shadow-xl' : ''}`}
    >
      <div className="absolute -right-5 -top-5 w-24 h-24 rounded-full bg-white/10 group-hover:scale-110 transition-transform duration-500" />
      <div className="absolute -right-2 -bottom-7 w-20 h-20 rounded-full bg-white/10" />

      <div className="relative z-10 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-widest opacity-80 mb-1">{card.label}</p>
          {loading ? (
            <div className="h-7 w-20 rounded-lg bg-white/25 animate-pulse" />
          ) : (
            <p className="text-2xl sm:text-3xl font-extrabold leading-none truncate">
              {numeric ? disp.toLocaleString('en-IN') : (value ?? '—')}
            </p>
          )}
          {caption ? (
            <p className="text-[10px] font-medium opacity-75 mt-1.5 leading-snug">{caption}</p>
          ) : null}
        </div>
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
          <Icon size={18} strokeWidth={2.4} />
        </div>
      </div>
    </div>
  );
}

/* ─── SKELETON ROW ───────────────────────────────────── */
function SkeletonRow() {
  return (
    <tr className="border-t border-slate-100">
      {LEAD_COLUMNS.map(c => (
        <td key={c.key} className={TD}>
          <div className="h-4 rounded-lg bg-slate-200 animate-pulse" style={{ width: `${45 + Math.random() * 45}%` }} />
        </td>
      ))}
    </tr>
  );
}

/* ─── VIEW LEAD MODAL ────────────────────────────────── */
/* "Edit" here NAVIGATES to the standalone /EditLead/:id page instead of
   opening a popup — see onEdit prop wired in the main component below. */
function ViewLeadModal({ lead, onClose, onEdit, canEdit }) {
  if (!lead) return null;
  const budgetStr = lead.budget != null ? fmtMoneyINR(lead.budget) : null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto z-10">
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-5 rounded-t-2xl">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xl font-extrabold shadow-lg flex-shrink-0">
                {(lead.customerName || 'U').charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-white text-xl font-extrabold capitalize">{lead.customerName || 'N/A'}</h2>
                <p className="text-slate-400 text-sm font-medium">{lead.leadCode || '—'}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full border border-slate-300 bg-slate-100 text-slate-700">{lead.leadType || 'N/A'}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{lead.leadStage || 'N/A'}
                  </span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-all flex-shrink-0">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              [Phone, 'Phone', lead.phone, 'bg-green-50 text-green-600'],
              [Mail, 'Email', lead.email, 'bg-blue-50 text-blue-600'],
              [Users, 'Travelers', formatTravellers(lead.adults, lead.children, lead.infants), 'bg-purple-50 text-purple-600'],
              [User, 'Assigned To', lead.assignedUser?.fullName || lead.assignedUser?.name || lead.assignedUser?.username || lead.assignedUserName || lead.assignTo || 'Unassigned', 'bg-orange-50 text-orange-600'],
              [Calendar, 'Created', lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '\u2014', 'bg-teal-50 text-teal-600'],
              [Briefcase, 'Lead Type', lead.leadType, 'bg-indigo-50 text-indigo-600'],
              [DollarSign, 'Budget', budgetStr, 'bg-yellow-50 text-yellow-700'],
              [MapPin, 'Departure City', lead.departCity, 'bg-rose-50 text-rose-600'],
            ].map(([Icon, label, val, ic]) => (
              <div key={label} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${ic}`}><Icon size={14} /></div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 font-medium">{label}</p>
                  <p className="text-sm font-bold text-slate-700 truncate">{val || '\u2014'}</p>
                </div>
              </div>
            ))}
          </div>
          {lead.itinerary && lead.itinerary.length > 0 && (
            <div>
              <p className="text-sm font-extrabold text-slate-700 mb-3 flex items-center gap-2"><MapPin size={14} className="text-blue-500" /> Destination & Itinerary</p>
              <div className="flex flex-wrap gap-2">
                {lead.itinerary.map((item, i) => (
                  <span key={i} className="bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl text-sm font-semibold text-slate-700">
                    {item.destination} <span className="text-blue-600 font-extrabold">({item.nights}N)</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {lead.services && lead.services.length > 0 && (
            <div>
              <p className="text-sm font-extrabold text-slate-700 mb-3">Services</p>
              <div className="flex flex-wrap gap-1.5">
                {lead.services.map((service, i) => (
                  <span key={i} className="bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider">{service}</span>
                ))}
              </div>
            </div>
          )}
          {lead.notes && (
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
              <p className="text-xs font-extrabold text-amber-700 mb-1.5">Notes</p>
              <p className="text-sm text-amber-800 leading-relaxed whitespace-pre-wrap">{lead.notes}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {canEdit && (
              <button onClick={() => onEdit(lead)} className="flex-1 min-w-[100px] py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all">
                <Pencil size={14} /> Edit
              </button>
            )}
            <button onClick={onClose} className="flex-1 min-w-[100px] py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold flex items-center justify-center gap-2 transition-all border border-slate-200">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── DELETE CONFIRM ─────────────────────────────────── */
function DeleteConfirm({ lead, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm z-10 p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4"><Trash2 size={26} className="text-red-500" /></div>
        <h3 className="text-lg font-extrabold text-slate-800 mb-1">Delete Lead?</h3>
        <p className="text-sm text-slate-500 mb-5">
          Are you sure you want to delete lead <span className="font-bold text-slate-700">#{lead?.id} ({lead?.customerName || 'N/A'})</span>? This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md shadow-red-200 transition-all">Yes, Delete</button>
        </div>
      </div>
    </div>
  );
}

/* Phone number rendered as a WhatsApp click-to-chat link (opens wa.me in a new tab).
   Empty / unparseable phone → plain "—". */
function PhoneLink({ phone, iconSize = 11, className = '', onWhatsApp }) {
  const href = formatToWhatsAppLink(phone);
  if (!href) return <span className={className}>—</span>;
  const handleClick = (e) => {
    e.stopPropagation();
    if (onWhatsApp) { e.preventDefault(); onWhatsApp(); }
  };
  return (
    <a href={href} target={onWhatsApp ? "_self" : "_blank"} rel="noopener noreferrer"
      onClick={handleClick}
      title="Chat on WhatsApp"
      className={`inline-flex items-center gap-1 min-w-0 hover:text-green-600 transition-colors cursor-pointer ${className}`}>
      <MessageCircle size={iconSize} className="text-green-500 flex-shrink-0" />
      <span className="truncate">{phone}</span>
    </a>
  );
}

/* Hover tooltip listing a lead's full itinerary — the Destination cell shows only the first
   city, and the "+N cities" hint opens this instead of growing the row.

   Rendered through a portal into <body> on purpose: the table sits inside overflow-x-auto,
   and setting overflow-x also makes overflow-y scroll, so an absolutely-positioned tip would
   be clipped away on the top and bottom rows. Fixed coordinates are measured off the trigger,
   flipped above it when there is no room below, and clamped to the viewport. Any scroll closes
   the tip — those coordinates go stale the moment the table or page moves.

   Tap toggles it as well, since touch devices never fire hover. */
function CityTip({ destinations, children }) {
  const [pos, setPos] = useState(null);
  const totalNights = destinations.reduce((s, d) => s + (Number(d.nights) || 0), 0);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    window.addEventListener('scroll', close, true);   // capture — catches the table's own scroll too
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [pos]);

  const open = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const W = 210;
    // Height is estimated from the row count so the flip is decided before the tip paints.
    const h = 42 + destinations.length * 20;
    const below = window.innerHeight - r.bottom > h + 12;
    setPos({
      top: below ? r.bottom + 8 : r.top - h - 8,
      left: Math.min(Math.max(8, r.left + r.width / 2 - W / 2), window.innerWidth - W - 8),
      width: W,
    });
  };

  return (
    <>
      <span
        onMouseEnter={open}
        onMouseLeave={() => setPos(null)}
        onClick={(e) => pos ? setPos(null) : open(e)}
        className="mt-0.5 inline-block text-[10px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer underline decoration-dotted underline-offset-2"
      >
        {children}
      </span>

      {pos && createPortal(
        <div
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999, animation: 'fadeIn .15s ease both' }}
          className="pointer-events-none rounded-xl border border-slate-200 bg-white p-2.5 shadow-xl"
        >
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
            Itinerary {'·'} {totalNights}N
          </p>
          <div className="space-y-1">
            {destinations.map((d, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-700 truncate">
                  <span className="text-slate-300 mr-1">{i + 1}.</span>{d.destination}
                </span>
                <span className="text-[11px] font-extrabold text-[#a07830] flex-shrink-0">{d.nights}N</span>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

/* ─── LEAD ROW ────────────────────────────────────────── */
/* Flat table row — every field is its own column. No expand panel: what used to be
   hidden inside it (email, itinerary, services, logs, quotation and booking actions)
   now lives in the columns below. */
function LeadRow({
  lead, index, selected, onToggleSelect,
  onView, onEditNavigate, onDelete, onStageChange, onTypeChange,
  onViewQuotations, onSuggestPackages, onConvert, onAddLog, onViewLogs,
  onWeblinkStats, onWeblinkView, onWhatsApp,
  canEdit, canDelete, canConvert, canCreateQuotation, dense,
}) {
  // Shadows the module-level TD for this row only — density is a row-height setting.
  const TD = dense ? TD_COMPACT : TD_COMFY;
  const { avatar, accent } = colorForIndex(index);
  const name = lead.customerName || 'N/A';
  const initial = (name || 'U').charAt(0).toUpperCase();

  const assigneeName =
    lead.assignedUser?.fullName ||
    lead.assignedUser?.name ||
    lead.assignedUser?.username ||
    lead.assignedUserName ||
    lead.assignTo ||
    null;

  const q = lead.latestQuotation;
  const isConverted = lead.leadStage === 'Converted' || !!lead.convertedBookingPublicId;

  // Human-readable code when the backend sends one (lead_sequences), else an em-dash.
  //
  // NO UUID FALLBACK. The old chain ended in `LD-${lead.id}`, and LeadResponseDto exposes the UUID
  // as `id` (there is no `publicId` key on the wire), so the moment leadCode was missing this
  // printed the full raw UUID — "LD-296ebd28-af1f-40db-9e1f-f8d84f5ffb58" — in the Lead ID column.
  // A UUID is not a lead reference anyone can read out on a call; showing nothing is strictly better
  // than showing something wrong, and it surfaces a missing code instead of disguising it.
  const displayCode = lead.displayCode || lead.leadCode || '—';

  const destinations = Array.isArray(lead.itinerary) ? lead.itinerary.filter(d => d && d.destination) : [];
  const totalNights = destinations.reduce((s, d) => s + (Number(d.nights) || 0), 0);
  const services = Array.isArray(lead.services) ? lead.services : [];

  const fmtDate = (d, withYear) =>
    d ? new Date(d).toLocaleDateString('en-US', withYear
      ? { day: 'numeric', month: 'short', year: 'numeric' }
      : { day: 'numeric', month: 'short' }) : null;
  const travelStr = fmtDate(lead.travelDate, true);
  const createdStr = fmtDate(lead.createdAt, false);

  // The verdict this row exists to deliver, from fields the list response already carries.
  const action = nextAction(lead);
  const tone = ACTION_TONE[action.tone] || ACTION_TONE.none;

  const amountStr = q?.grandTotal != null ? fmtAmountINR(q.grandTotal) : null;
  // Margin comes off the quotation when the backend exposes it; "—" until then.
  const marginVal = q?.margin ?? q?.marginAmount ?? lead.margin ?? null;
  const marginStr = marginVal != null ? fmtAmountINR(marginVal) : null;

  // Weblink view count — whichever field the analytics payload carries.
  const weblinkViews = q?.viewCount ?? q?.weblinkViews ?? q?.views ?? 0;
  const logCount = lead.logCount ?? (Array.isArray(lead.logs) ? lead.logs.length : 0);
  const webLink = q?.publicId ? `${window.location.origin}/q/${q.publicId}` : null;

  // Always show the lead's real stage/type even if it's outside the manually-selectable set.
  const stageOptions = STAGES.includes(lead.leadStage) ? STAGES : [lead.leadStage, ...STAGES].filter(Boolean);
  const typeOptions = LEAD_TYPES.includes(lead.leadType) ? LEAD_TYPES : [lead.leadType, ...LEAD_TYPES].filter(Boolean);

  // Quick share — pure client-side, no API call. The full "email the PDF from the server"
  // flow still lives in QuotationsModal.
  // Both work with or without a quotation: when there is no weblink yet these just open the
  // chat / mail draft on a plain greeting, so an agent can reach a brand-new lead from the row.
  const waShare = () => {
    const msg = webLink
      ? `Hi ${lead.customerName || ''}, here is your travel quotation ${q?.version || ''}: ${webLink}`.trim()
      : `Hi ${lead.customerName || ''},`.trim();
    const phone = (lead.phone || '').replace(/\D/g, '');
    window.open(
      phone ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`,
      '_blank', 'noopener,noreferrer'
    );
  };
  const mailShare = () => {
    const subject = webLink ? `Travel Quotation ${q?.version || ''}`.trim() : 'Your travel enquiry';
    const body = webLink
      ? `Dear ${lead.customerName || 'Customer'},\n\nView your travel quotation online: ${webLink}\n\nRegards,\nTeam`
      : `Dear ${lead.customerName || 'Customer'},\n\n\nRegards,\nTeam`;
    window.location.href = `mailto:${lead.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const iconBtn = 'w-7 h-7 rounded-lg flex items-center justify-center transition-all flex-shrink-0';

  return (
    <tr
      className="group border-t border-slate-100 hover:bg-slate-50/70 transition-colors"
      style={{ animation: 'fadeUp .35s ease both', animationDelay: `${index * 30}ms` }}
    >
      {/* ── Select ── */}
      <td className={`${TD} text-center ${FROZEN_TD.select}`} style={{ borderLeft: `3px solid ${accent}` }}>
        <input
          type="checkbox" checked={selected} onChange={() => onToggleSelect(lead.id)}
          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-400 cursor-pointer"
        />
      </td>

      {/* ── Lead (identity: name + code + how to reach them) ── */}
      <td className={`${TD} ${FROZEN_TD.info}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatar} flex items-center justify-center text-white text-xs font-extrabold shadow-sm flex-shrink-0`}>{initial}</div>
          <div className="min-w-0">
            {/* Name leads, code follows it — the code is what a customer quotes back on the phone,
                so it has to be visible, but it is never what the agent scans for. */}
            <div className="flex items-baseline gap-1.5 min-w-0">
              <button onClick={() => onView(lead)}
                className="text-sm font-bold text-blue-600 hover:text-blue-700 capitalize truncate text-left min-w-0">
                {name}
              </button>
              <span className="text-[10px] font-bold text-slate-400 font-mono flex-shrink-0" title={lead.publicId || lead.id}>
                {displayCode}
              </span>
            </div>
            <PhoneLink phone={lead.phone} iconSize={10}
              className="text-[11px] text-slate-500 max-w-full"
              onWhatsApp={onWhatsApp ? () => onWhatsApp(lead, 'WHATSAPP') : undefined} />
            {lead.email && (
              /* The address opens the same drawer on its Email tab. A mailto: here would
                 hand the conversation to a desktop client and the CRM would never learn
                 that the lead was contacted — the whole reason the drawer exists. */
              <button type="button"
                onClick={(e) => { e.stopPropagation(); onWhatsApp?.(lead, 'EMAIL'); }}
                title={`Email ${lead.email}`}
                className="text-[11px] text-slate-400 hover:text-blue-600 truncate max-w-full inline-flex items-center gap-1 transition-colors">
                <Mail size={10} className="flex-shrink-0" /> <span className="truncate">{lead.email}</span>
              </button>
            )}
          </div>
        </div>
      </td>

      {/* ── Next action ── */}
      {/* The verdict, not the data. Red/amber only when someone is actually waiting; the created
          date sits underneath because age is what makes a lead urgent. */}
      <td className={TD}>
        <div className={`inline-flex items-start gap-1.5 px-2 py-1 rounded-lg border max-w-full ${tone.wrap}`}>
          <span className={`w-1.5 h-1.5 rounded-full mt-[5px] flex-shrink-0 ${tone.dot}`} />
          <span className="min-w-0">
            <span className={`block text-[11px] font-bold leading-tight truncate ${tone.text}`} title={action.label}>
              {action.label}
            </span>
            <span className="block text-[10px] text-slate-400 font-medium mt-0.5">
              {createdStr ? `Added ${createdStr}` : '—'}
            </span>
          </span>
        </div>
      </td>

      {/* ── Destination ── */}
      <td className={TD}>
        {destinations.length > 0 ? (
          <>
            <span className="inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 mb-1.5">
              {totalNights}N Total
            </span>
            {/* Only ever the first city — the rest live in the hover tip, so the row height
                stays fixed no matter how long the itinerary is. */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-2 py-1.5 text-center">
              <div className="truncate" title={`${destinations[0].destination} · ${destinations[0].nights}N`}>
                <span className="text-[11px] font-extrabold text-slate-700 uppercase">{destinations[0].destination}</span>
                <span className="block text-[11px] font-extrabold text-[#a07830]">{destinations[0].nights}N</span>
              </div>
              {destinations.length > 1 && (
                <CityTip destinations={destinations}>
                  +{destinations.length - 1} cities
                </CityTip>
              )}
            </div>
          </>
        ) : <span className="text-xs text-slate-300">—</span>}
      </td>

      {/* ── Travelers Info ── */}
      <td className={TD}>
        <div className="space-y-1">
          {lead.departCity && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 border border-slate-200 max-w-full">
              <MapPin size={10} className="flex-shrink-0 text-blue-500" /> <span className="truncate">{lead.departCity}</span>
            </span>
          )}
          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border max-w-full ${travelStr ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-300 border-slate-200'}`}>
            <Calendar size={10} className="flex-shrink-0" /> <span className="truncate">{travelStr || 'Not set'}</span>
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 max-w-full">
            <Users size={10} className="flex-shrink-0" />
            <span className="truncate">{formatTravellers(lead.adults, lead.children, lead.infants, { short: true })}</span>
          </span>
        </div>
      </td>

      {/* ── Services ── */}
      <td className={`${TD} text-center`}>
        {services.length > 0 ? (
          <div className="flex flex-wrap gap-1 justify-center">
            {services.map((s, i) => {
              const Icon = serviceIcon(s);
              const c = serviceColor(s);
              return (
                <span key={i} title={s}
                  className="w-6 h-6 rounded-md flex items-center justify-center"
                  style={{ background: c.bg, color: c.text }}>
                  <Icon size={12} />
                </span>
              );
            })}
          </div>
        ) : <span className="text-xs text-slate-300">—</span>}
      </td>

      {/* ── Quotation ── */}
      <td className={`${TD} text-center`}>
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-1">
            {q?.publicId && (
              <button onClick={() => onViewQuotations(lead)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition-all">
                <Eye size={11} /> View
              </button>
            )}
            {canCreateQuotation && (
              <Link to={`/createquotation?leadId=${lead.publicId || lead.id}`}
                className="inline-flex items-center gap-0.5 px-2 py-1 rounded-md bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 border border-slate-200 text-[10px] font-bold transition-all">
                <Plus size={11} /> New
              </Link>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={waShare} title={webLink ? 'Share weblink on WhatsApp' : 'Message on WhatsApp'}
              className={`${iconBtn} bg-green-500 hover:bg-green-600 text-white`}>
              <FaWhatsapp size={13} />
            </button>
            <button onClick={mailShare} title={webLink ? 'Email the weblink' : 'Email this lead'}
              className={`${iconBtn} bg-blue-500 hover:bg-blue-600 text-white`}>
              <Mail size={12} />
            </button>
            {canCreateQuotation && (
              <button onClick={() => onSuggestPackages(lead)} title="Suggest packages"
                className={`${iconBtn} bg-violet-50 hover:bg-violet-100 text-violet-600 border border-violet-200`}>
                <Sparkles size={12} />
              </button>
            )}
          </div>
        </div>
      </td>

      {/* ── Booking ── */}
      <td className={`${TD} text-center`}>
        {isConverted ? (
          <Link to={`/BookingDetails/${lead.convertedBookingPublicId || lead.bookingPublicId || ''}`}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-50 text-green-700 border border-green-200 text-[10px] font-bold hover:bg-green-100 transition-all">
            <CheckCircle size={11} /> Booked ↗
          </Link>
        ) : !q?.publicId ? (
          <span className="text-[11px] font-semibold text-slate-400 leading-tight">Quote<br />Required</span>
        ) : canConvert ? (
          <button onClick={() => onConvert(lead)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold transition-all">
            <ArrowRightLeft size={11} /> Convert
          </button>
        ) : <span className="text-xs text-slate-300">—</span>}
      </td>

      {/* ── Weblink ── */}
      <td className={`${TD} text-center`}>
        {webLink ? (
          <div className="inline-flex items-center rounded-lg overflow-hidden shadow-sm">
            {/* Design picker first, then the link opens — same contract as the quotation list's
                Weblink button. Was a plain <a href>; it is a <button> now because the click has to
                await the style PATCH before the tab opens. */}
            <button onClick={() => onWeblinkView(lead)} title="Open weblink"
              className="inline-flex items-center gap-1 px-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition-all">
              <ExternalLink size={11} /> VIEW
            </button>
            <button onClick={() => onWeblinkStats(lead)} title="Weblink views"
              className="inline-flex items-center gap-1 px-2 py-1.5 bg-[#eeda92] hover:bg-[#e6ce78] text-[#3d2a00] text-[10px] font-extrabold transition-all">
              <Eye size={11} /> {weblinkViews}
            </button>
          </div>
        ) : <span className="text-xs text-slate-300">—</span>}
      </td>

      {/* ── Logging ── */}
      <td className={`${TD} text-center`}>
        <div className="inline-flex items-center gap-1">
          {canEdit && (
            <button onClick={() => onAddLog(lead)} title="Add log"
              className={`${iconBtn} bg-blue-600 hover:bg-blue-700 text-white`}>
              <Plus size={13} />
            </button>
          )}
          <button onClick={() => onViewLogs(lead)} disabled={!logCount} title={logCount ? `${logCount} log(s)` : 'No logs yet'}
            className={`${iconBtn} relative bg-blue-50 hover:bg-blue-100 text-blue-600 disabled:opacity-40`}>
            <Eye size={12} />
            {logCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 rounded-full bg-[#eeda92] text-[#3d2a00] text-[9px] font-extrabold flex items-center justify-center">
                {logCount}
              </span>
            )}
          </button>
        </div>
      </td>

      {/* ── Assigned To ── */}
      <td className={TD}>
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 text-white flex items-center justify-center text-[10px] font-extrabold flex-shrink-0">
            {assigneeName ? assigneeName.charAt(0).toUpperCase() : 'U'}
          </div>
          <span className="text-xs font-semibold text-slate-700 truncate" title={assigneeName || 'Unassigned'}>
            {assigneeName || 'Unassigned'}
          </span>
        </div>
      </td>

      {/* ── Amount ── */}
      <td className={`${TD} text-right`}>
        <span className={`text-sm font-extrabold tabular-nums ${amountStr ? 'text-slate-800' : 'text-slate-300'}`}>{amountStr || '—'}</span>
      </td>

      {/* ── Margin ── */}
      <td className={`${TD} text-right`}>
        <span className={`text-sm font-bold tabular-nums ${marginStr ? 'text-emerald-700' : 'text-slate-300'}`}>{marginStr || '—'}</span>
      </td>

      {/* ── Type ── */}
      <td className={`${TD} text-center`}>
        <select value={lead.leadType || 'Fresh'} onChange={e => onTypeChange(lead, e.target.value)} disabled={!canEdit}
          className={`text-[11px] font-bold px-2 py-1 rounded-full border outline-none appearance-none text-center transition-all max-w-full truncate ${canEdit ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'} ${typePill(lead.leadType)}`}>
          {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </td>

      {/* ── Stage ── */}
      <td className={`${TD} text-center`}>
        <select value={lead.leadStage || 'New Lead'} onChange={e => onStageChange(lead, e.target.value)} disabled={!canEdit}
          className={`text-[11px] font-bold px-2 py-1 rounded-full border outline-none appearance-none text-center transition-all max-w-full truncate ${canEdit ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'} ${stagePill(lead.leadStage)}`}>
          {stageOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>

      {/* ── Actions ── */}
      <td className={`${TD} text-center`}>
        <div className="inline-flex items-center gap-1">
          <button onClick={() => onView(lead)} title="View" className={`${iconBtn} bg-blue-50 hover:bg-blue-100 text-blue-600`}><Eye size={13} /></button>
          {canEdit && <button onClick={() => onEditNavigate(lead)} title="Edit" className={`${iconBtn} bg-indigo-50 hover:bg-indigo-100 text-indigo-600`}><Pencil size={13} /></button>}
          {canDelete && <button onClick={() => onDelete(lead)} title="Delete" className={`${iconBtn} bg-red-50 hover:bg-red-100 text-red-600`}><Trash2 size={13} /></button>}
        </div>
      </td>
    </tr>
  );
}

/* ─── QUOTATIONS LIST MODAL ──────────────────────────── */
const QUOTE_STAGE_PILL = {
  Draft: 'bg-slate-100 text-slate-700 border-slate-200',
  Sent: 'bg-blue-100 text-blue-700 border-blue-200',
  Approved: 'bg-green-100 text-green-700 border-green-200',
  Rejected: 'bg-red-100 text-red-700 border-red-200',
};

function QuotationsModal({ lead, onClose, canDelete, canEdit }) {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloadingId, setDownloading] = useState(null);
  const [stylePickFor, setStylePickFor] = useState(null);   // quotation whose PDF design is being picked
  const [sharePickFor, setSharePickFor] = useState(null);   // quotation whose SHARE design is being picked
  const [weblinkPickFor, setWeblinkPickFor] = useState(null);   // quotation whose WEBLINK design is being picked
  const [emailingId, setEmailing] = useState(null);
  const [webViewQ, setWebViewQ] = useState(null);   // quotation shown in the web view overlay
  const [previewPickFor, setPreviewPickFor] = useState(null);  // quotation whose weblink DESIGN is being picked
  const [webViewStyle, setWebViewStyle] = useState(null);      // one-off design override for the open web view
  const [copied, setCopied] = useState(false);
  const [analyticsQ, setAnalyticsQ] = useState(null);   // quotation shown in the weblink-analytics modal
  const [deletingId, setDeletingId] = useState(null);   // quotation being deleted

  const { showToast } = useToast();

  const removeQuotation = async (q) => {
    if (!window.confirm(`Delete quotation ${q.version || ''}? This cannot be undone.`)) return;
    try {
      setDeletingId(q.publicId);
      await quotationService.deleteQuotation(q.publicId);
      setList(prev => prev.filter(x => x.publicId !== q.publicId));
      showToast('Quotation deleted.', 'success');
    } catch (e) {
      if (isAlreadyReported(e)) return;   // <ToastHost/> already showed it
      showToast(getErrorMessage(e, 'Failed to delete quotation.'), 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const leadId = lead.publicId || lead.id;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const res = await quotationService.getQuotationsByLead(leadId);
        const body = res.data;
        const data = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
        // Defensive client-side sort: latest → oldest (backend already orders by createdAt desc)
        data.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        if (active) setList(data);
      } catch (e) {
        // An inline banner, not a toast — it explains the empty list in place, so it is shown
        // even for errors the interceptor already toasted.
        if (active) setError(getErrorMessage(e, 'Could not load quotations. Please try again.'));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [leadId]);

  // Shared PDF pipeline: usePdfDownload streams the blob (real % only when the server sends a
  // usable total) and <PdfDownloadLoader/> below shows the full-screen "preparing your PDF" card.
  const { downloadPdf: runPdfDownload, isDownloading: pdfBusy, progress: pdfProgress, progressSupported: pdfProgressSupported } = usePdfDownload();

  // Style is chosen in the download dialog and passed straight through as a one-off override —
  // deliberately NOT saved on the quotation, so downloading a Premium copy does not change what the
  // customer sees on the share link.
  const downloadPdf = async (q, style) => {
    try {
      setStylePickFor(null);
      setDownloading(q.publicId);
      // Readable business code in the file name — never the raw UUID when a code exists.
      const code = q.quoteNo || q.version || String(q.publicId).slice(0, 8).toUpperCase();
      await runPdfDownload({
        endpoint: `/quotations/${q.publicId}/pdf`,
        params: style ? { style } : undefined,
        fileName: `TravelCRM-Quotation-${code}.pdf`,
      });
    } catch (e) {
      // The hook rehydrates the Blob error envelope, so getErrorMessage can read the real message.
      if (isAlreadyReported(e)) return;
      showToast(getErrorMessage(e, 'Could not download the PDF. Please try again.'), 'error');
    } finally {
      setDownloading(null);
    }
  };

  // The shareable WEB link (customer-facing web view): {origin}/q/{publicId}.
  const webLink = (q) => `${window.location.origin}/q/${q.publicId}`;

  // Copy the web link so the agent can paste it anywhere to share with the client.
  // The design being previewed is SAVED first (same rule as the WhatsApp share flow): the
  // customer's link renders the STORED style, so what the agent saw must be what the link
  // opens. If the save fails, nothing is copied — a link to the wrong design must never
  // leave the clipboard.
  const copyLink = async (q, style) => {
    try {
      if (style && style !== (q.templateStyle || 'CLASSIC')) {
        await quotationService.setTemplateStyle(q.publicId, style);
        setList(prev => prev.map(x => x.publicId === q.publicId ? { ...x, templateStyle: style } : x));
        setWebViewQ(prev => (prev && prev.publicId === q.publicId ? { ...prev, templateStyle: style } : prev));
      }
    } catch (e) {
      if (isAlreadyReported(e)) return;
      showToast(getErrorMessage(e, 'Could not set the design. Link not copied.'), 'error');
      return;
    }
    try {
      await navigator.clipboard.writeText(webLink(q));
      setCopied(true);
      showToast('Link copied to clipboard', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // navigator.clipboard, not axios — a denied permission or an insecure origin. No envelope.
      showToast('Could not copy the link.', 'error');
    }
  };

  // Share on WhatsApp, in a chosen design. The style is SAVED first (the customer opens the link
  // later, so the server must already know what to render), THEN wa.me opens — never the other way
  // round, or the agent sends a link that still shows the old design.
  const shareWhatsAppWithStyle = async (q, style) => {
    try {
      setSharePickFor(null);
      if (style && style !== (q.templateStyle || 'CLASSIC')) {
        await quotationService.setTemplateStyle(q.publicId, style);
        setList(prev => prev.map(x => x.publicId === q.publicId ? { ...x, templateStyle: style } : x));
      }
      shareWhatsApp(q);
    } catch (e) {
      // The link was NOT opened — sharing a design we failed to save would show the customer the
      // old one with no sign anything went wrong.
      if (isAlreadyReported(e)) return;
      showToast(getErrorMessage(e, 'Could not set the design. Nothing was shared.'), 'error');
    }
  };

  // Open the weblink in a chosen design. Same contract as shareWhatsAppWithStyle: the style is
  // SAVED first, because the web view renders from the STORED design — opening the overlay before
  // the PATCH lands would show the old design, and the customer's link would disagree with it.
  const openWebViewWithStyle = async (q, style) => {
    try {
      setWeblinkPickFor(null);
      if (style && style !== (q.templateStyle || 'CLASSIC')) {
        await quotationService.setTemplateStyle(q.publicId, style);
        setList(prev => prev.map(x => x.publicId === q.publicId ? { ...x, templateStyle: style } : x));
        setWebViewQ({ ...q, templateStyle: style });
        return;
      }
      setWebViewQ(q);
    } catch (e) {
      // The overlay was NOT opened — showing a design we failed to save would misrepresent what
      // the customer will actually see on their link.
      if (isAlreadyReported(e)) return;
      showToast(getErrorMessage(e, 'Could not set the design. The weblink was not opened.'), 'error');
    }
  };

  // Share on WhatsApp — opens wa.me with a prefilled message + the web-view link.
  const shareWhatsApp = (q) => {
    const url = webLink(q);
    const msg = `Hi ${lead.customerName || ''}, here is your travel quotation ${q.version || ''}: ${url}`.trim();
    const phone = (lead.phone || '').replace(/\D/g, '');
    const wa = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(wa, '_blank', 'noopener,noreferrer');
  };

  // Email — sends the PDF to the lead's email via the backend, with the web link in the body.
  // Confirmed first (outward action).
  const shareEmail = async (q) => {
    if (!lead.email) { showToast('This lead has no email address.', 'error'); return; }
    if (!window.confirm(`Send quotation ${q.version || ''} to ${lead.email}?`)) return;
    const url = webLink(q);
    try {
      setEmailing(q.publicId);
      await quotationService.sendEmail(q.publicId, {
        toEmail: lead.email,
        subject: `Travel Quotation ${q.version || ''}`.trim(),
        message: `Dear ${lead.customerName || 'Customer'},\n\nView your travel quotation online: ${url}\n\n(A PDF copy is attached.)\n\nRegards,\nTeam`,
      });
      showToast(`Quotation emailed to ${lead.email}`, 'success');
    } catch (e) {
      // A mail failure comes back as a 502 whose copy the server wrote, so it lands in the
      // interceptor's INTERNAL_ERROR branch and is already toasted.
      if (isAlreadyReported(e)) return;
      showToast(getErrorMessage(e, 'Failed to send the email.'), 'error');
    } finally {
      setEmailing(null);
    }
  };

  const fmtMoney = (v) => v == null ? '—' : `₹${Number(v).toLocaleString('en-IN')}`;
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col z-10">
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 rounded-t-2xl flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white flex-shrink-0"><FileText size={18} /></div>
            <div className="min-w-0">
              <h2 className="text-white font-extrabold text-base truncate">Quotations{!loading && ` (${list.length})`}</h2>
              <p className="text-slate-300 text-xs truncate">{lead.customerName || 'Lead'} {'·'} latest first</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center flex-shrink-0"><X size={16} /></button>
        </div>

        <div className="p-5 overflow-y-auto">
          {loading ? (
            <div className="py-10 text-center text-slate-400 text-sm">Loading quotations{'…'}</div>
          ) : error ? (
            <div className="py-10 text-center text-red-500 text-sm">{error}</div>
          ) : list.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm">No quotations yet for this lead.</div>
          ) : (
            <div className="space-y-3">
              {list.map((q, idx) => (
                <div key={q.publicId} className={`border rounded-xl p-4 transition-all ${idx === 0 ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200 hover:border-blue-300'}`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-extrabold text-slate-900">{q.version || 'v1.0'}</span>
                        <p className="text-sm font-semibold text-slate-600 truncate">{q.title || 'Quotation'}</p>
                        {idx === 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">Latest</span>}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${QUOTE_STAGE_PILL[q.quotationStage] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>{q.quotationStage || '—'}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 truncate">
                        {q.destination ? `${q.destination} · ` : ''}{fmtDate(q.createdAt)}
                      </p>
                    </div>
                    <p className="text-sm font-extrabold text-slate-800 whitespace-nowrap">{fmtMoney(q.grandTotal)}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <button onClick={() => setWeblinkPickFor(q)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all">
                      <Eye size={13} /> Weblink
                    </button>

                    <button onClick={() => setStylePickFor(q)} disabled={downloadingId === q.publicId || pdfBusy}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-blue-300 text-slate-600 hover:text-blue-600 text-xs font-bold transition-all disabled:opacity-50">
                      <DownloadCloud size={13} /> {downloadingId === q.publicId ? 'Downloading…' : 'PDF'}
                    </button>
                    {/* Share — icon only */}
                    <button onClick={() => setSharePickFor(q)} title="Share on WhatsApp"
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-green-200 bg-green-50 hover:bg-green-100 text-green-600 transition-all">
                      <FaWhatsapp size={15} />
                    </button>
                    <button onClick={() => shareEmail(q)} disabled={emailingId === q.publicId} title="Email to customer"
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-600 transition-all disabled:opacity-50">
                      <Mail size={14} />
                    </button>
                    <button onClick={() => setAnalyticsQ(q)} title="Weblink views"
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 transition-all">
                      <BarChart3 size={14} />
                    </button>

                    <div className="ml-auto flex items-center gap-2">
                      {canEdit && (
                        <button onClick={() => { onClose(); navigate(`/createquotation?leadId=${lead.publicId || lead.id}&quotationId=${q.publicId}`); }}
                          title="Edit quotation"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-600 transition-all">
                          <Pencil size={14} />
                        </button>
                      )}

                      {canDelete && (
                        <button onClick={() => removeQuotation(q)} disabled={deletingId === q.publicId} title="Delete quotation"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-500 transition-all disabled:opacity-50">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

     
      {webViewQ && (
        <div className="fixed inset-0 z-[60] bg-white overflow-y-auto">
          <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-3">
            <button onClick={() => { setWebViewQ(null); setWebViewStyle(null); }}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-blue-600 flex-shrink-0">
              <X size={16} /> Back
            </button>
            
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <button onClick={() => copyLink(webViewQ, webViewStyle)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-blue-300 text-slate-600 hover:text-blue-600 text-xs font-bold transition-all">
                <Copy size={13} /> {copied ? 'Copied!' : 'Copy link'}
              </button>
              <button onClick={() => setSharePickFor(webViewQ)} title="Share on WhatsApp"
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-green-200 bg-green-50 hover:bg-green-100 text-green-600 transition-all">
                <FaWhatsapp size={15} />
              </button>
              <button onClick={() => shareEmail(webViewQ)} disabled={emailingId === webViewQ.publicId} title="Email to customer"
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-600 transition-all disabled:opacity-50">
                <Mail size={14} />
              </button>
            </div>
          </div>
          <QuotationWebView publicId={webViewQ.publicId} styleOverride={webViewStyle} />
        </div>
      )}

     
      {previewPickFor && (
        <QuotationStyleModal
          mode="preview"
          savedStyle={previewPickFor.templateStyle}
          onSelect={(style) => {
            setWebViewStyle(style);
            setWebViewQ(previewPickFor);
            setPreviewPickFor(null);
          }}
          onClose={() => setPreviewPickFor(null)}
        />
      )}

      {analyticsQ && <WeblinkAnalyticsModal quotation={analyticsQ} onClose={() => setAnalyticsQ(null)} />}
      {stylePickFor && (
        <QuotationStyleModal
          savedStyle={stylePickFor.templateStyle}
          onSelect={(style) => downloadPdf(stylePickFor, style)}
          onClose={() => setStylePickFor(null)}
        />
      )}
      {sharePickFor && (
        <QuotationStyleModal
          mode="share"
          savedStyle={sharePickFor.templateStyle}
          onSelect={(style) => shareWhatsAppWithStyle(sharePickFor, style)}
          onClose={() => setSharePickFor(null)}
        />
      )}
      {/* Weblink → pick a design first. mode="share" because the pick is PERSISTED and is exactly
          what the customer sees on their link — same contract as the WhatsApp share dialog. */}
      {weblinkPickFor && (
        <QuotationStyleModal
          mode="share"
          savedStyle={weblinkPickFor.templateStyle}
          onSelect={(style) => openWebViewWithStyle(weblinkPickFor, style)}
          onClose={() => setWeblinkPickFor(null)}
        />
      )}

      {/* Full-screen "preparing your PDF" overlay — z-above the web view (z-[60]) and pickers. */}
      <PdfDownloadLoader
        open={pdfBusy}
        documentType="Quotation"
        progress={pdfProgress}
        progressSupported={pdfProgressSupported}
      />
    </div>
  );
}


// Local yyyy-mm-dd (never toISOString, which is UTC and can shift the day across a timezone).
function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Maps the quick date filter to the inclusive [fromDate,toDate] the backend expects (ISO date).
// Returns {} for 'all' (no date restriction). Mirrors the old client-side date logic 1:1.
function dateRangeFor(dateFilter, startDate, endDate) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (dateFilter === 'today') return { fromDate: isoDate(today), toDate: isoDate(today) };
  if (dateFilter === 'yesterday') {
    const y = new Date(today); y.setDate(today.getDate() - 1);
    return { fromDate: isoDate(y), toDate: isoDate(y) };
  }
  if (dateFilter === 'last_7_days') {
    const w = new Date(today); w.setDate(today.getDate() - 7);
    return { fromDate: isoDate(w), toDate: isoDate(today) };
  }
  if (dateFilter === 'custom' && startDate && endDate) return { fromDate: startDate, toDate: endDate };
  return {};
}

/* ─── MAIN COMPONENT ─────────────────────────────────── */
const Leads = () => {
  const navigate = useNavigate();
  /* The ONE dataset on this screen: the current server page, already narrowed by search, tab and
     date in SQL. Nothing below re-filters it.

     Until now the page fetched this AND a separate one-shot 200-row `overviewLeads`, rendered the
     SECOND one, and threw this away — so every server filter was discarded, the stage dropdown
     snapped back to its old value after a successful save, and deleted or imported leads did not
     move on screen. */
  const [leads, setLeads] = useState([]);            // current SERVER page — the table's rows
  const [meta, setMeta] = useState(null);            // server pagination: {page,size,totalElements,totalPages}
  const [loading, setLoading] = useState(true);

  /* Row density, persisted — someone who works this list all day sets it once. Read lazily so the
     first paint is already correct instead of flipping after mount. */
  const [dense, setDense] = useState(() => {
    try { return localStorage.getItem('leads:density') === 'compact'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('leads:density', dense ? 'compact' : 'comfortable'); } catch { /* private mode */ }
  }, [dense]);

  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [activeTab, setActiveTab] = useState('All');

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');   // settled value that actually hits the server
  /* Sorting is a SERVER parameter, so it orders the whole result set — not the page. This used to be
     `useState('desc')` with no setter ever called and no clickable header anywhere, so the list was
     permanently newest-first and Travel Date could not be sorted at all. */
  const [sort, setSort] = useState({ by: 'createdAt', dir: 'desc' });
  const toggleSort = (sortKey) => {
    if (!sortKey) return;
    setSort(prev => prev.by === sortKey
      // Same column: flip. Dates and names want opposite first clicks, but one predictable rule
      // beats a per-column special case nobody can remember.
      ? { by: sortKey, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { by: sortKey, dir: 'asc' });
  };
  const [dateFilter, setDateFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Open by default: this block IS the business overview. Collapsed-by-default meant the first
  // thing the page told anyone about their pipeline was nothing.
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  /* ── Dashboard numbers ─────────────────────────────────────────────────────
     TWO sources, deliberately not merged, because they answer at two different scopes:

       summary     GET /leads/stats/summary  — the caller's OWN row scope (admin ⇒ tenant,
                   manager ⇒ team, agent ⇒ own), aggregated in the database.
       alertStats  GET /leads/alerts/stats   — tenant-WIDE by design: an open lead is visible to
                   everyone precisely so anyone can claim it, so this figure is the same number for
                   the whole team. The two cards built on it say "tenant-wide" for that reason.

     Both stay null until they land. Consumers fall back to the loaded page and label it — they
     never render a confident zero for a number that simply has not arrived. */
  const [summary, setSummary] = useState(null);
  const [alertStats, setAlertStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  /* The day every "today" figure is measured against. The server computes its counts in the
     TENANT's timezone and echoes the date back, so the client agrees with the card instead of
     drifting by a day for anyone whose browser sits in another zone.

     Declared HERE, above serverParams, and not further down where it used to sit: serverParams
     reads it during render, and a `const` below would be in the temporal dead zone. */
  const todayKey = summary?.today ?? new Date().toLocaleDateString('en-CA');

  const [viewLead, setViewLead] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [quotationsLead, setQuotationsLead] = useState(null);
  const [suggestLead, setSuggestLead] = useState(null);   // "Suggest packages" modal target
  const [logLead, setLogLead] = useState(null);
  const [logsViewLead, setLogsViewLead] = useState(null);
  const [weblinkLead, setWeblinkLead] = useState(null);   // lead whose weblink analytics are open
  const [weblinkStyleLead, setWeblinkStyleLead] = useState(null);   // lead whose weblink design is being picked
  // { lead, channel } — which record the conversation drawer is open on, and which tab it
  // opened to. Two fields rather than two states: clicking the email of a lead whose WhatsApp
  // drawer is already open must switch the tab, not stack a second panel.
  const [convo, setConvo] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);     // row checkbox selection
  const [denied, setDenied] = useState(false);
  const [importOpen, setImportOpen] = useState(false);    // bulk CSV/Excel import modal

  // Centralized toaster: <ToastHost/> (mounted beside the router in App.jsx) renders it.
  // Argument order is (message, type) everywhere — see shared/ui/toast.jsx.
  const { showToast } = useToast();

  // Debounce the search box so a keystroke isn't a request — only the settled value hits the server.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Any change to WHAT is listed resets to page 0 (else you land on page 5 of a 1-page result).
  useEffect(() => {
    setPagination(p => (p.pageIndex === 0 ? p : { ...p, pageIndex: 0 }));
  }, [debouncedSearch, activeTab, dateFilter, startDate, endDate, pagination.pageSize, sort.by, sort.dir]);

  /* Tabs + date filter → the server params the backend understands.

     THREE vocabularies share one `activeTab` state and they do NOT all map to `stage`:
       · Fresh / Hot / Warm / Cold  are leadTypes
       · Active and Follow-ups      are work queues, not stages at all
       · everything else            is a real LeadStage displayName

     This used to send `stage=<tab>` for every non-Fresh tab, so Active, Follow-ups and Hot posted
     `stage=Active` etc. — and LeadStage.fromValue throws on those, i.e. a 400. It was invisible only
     because the table rendered a different array and the failed response was discarded.

     `activeOnly` and `followUpDueBy` are the two predicates added to LeadSpecification for exactly
     this; Follow-ups sends BOTH, so it means "overdue or due today, still open" — the same thing
     getStatsSummary counts for the card that opens this tab. */
  const serverParams = useMemo(() => {
    const p = {};
    if (LEAD_TYPES.includes(activeTab)) {
      p.leadType = activeTab;
    } else if (activeTab === 'Active') {
      p.activeOnly = true;
    } else if (activeTab === 'Follow-ups') {
      p.activeOnly = true;
      p.followUpDueBy = todayKey;
    } else if (activeTab !== 'All') {
      p.stage = activeTab;
    }
    const { fromDate, toDate } = dateRangeFor(dateFilter, startDate, endDate);
    if (fromDate) p.fromDate = fromDate;
    if (toDate) p.toDate = toDate;
    return p;
  }, [activeTab, dateFilter, startDate, endDate, todayKey]);
  const serverParamsKey = JSON.stringify(serverParams);

  // Guards against out-of-order responses: only the newest request in flight may render.
  const reqId = useRef(0);

  // The TABLE's data source — one server page (search + filters applied in the DB, so this finds
  // matches across the whole tenant, not just a client-side slice).
  const fetchLeads = useCallback(async () => {
    const id = ++reqId.current;
    try {
      setLoading(true);
      const response = await leadService.listLeads({
        page: pagination.pageIndex,
        size: pagination.pageSize,
        sortBy: sort.by,
        sortDir: sort.dir,
        q: debouncedSearch || undefined,
        ...JSON.parse(serverParamsKey),
      });
      if (id !== reqId.current) return;              // a newer request already won
      const body = response?.data ?? {};
      setLeads(Array.isArray(body.data) ? body.data : []);
      setMeta(body.pagination ?? null);
      setDenied(false);
    } catch (err) {
      if (id !== reqId.current) return;
      // A 403 here means the page was opened without LEAD_READ (e.g. by URL).
      if (err.response?.status === 403) setDenied(true);
      setLeads([]); setMeta(null);
      // 403 lands in isAlreadyReported too, so the interceptor's toast is the only one.
      if (isAlreadyReported(err)) return;
      showToast(getErrorMessage(err, 'Failed to load leads. Please try again.'), 'error');
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [pagination.pageIndex, pagination.pageSize, sort.by, sort.dir, debouncedSearch, serverParamsKey]);

  /**
   * The cards' data. Ambient by nature: a failed roll-up leaves the cards showing "—" and this
   * function adds NO toast of its own — the list is what the user asked for, and a broken badge
   * must not put a second error in front of them.
   *
   * (The shared interceptor may still speak for 401/403/429/5xx — see shared/api/authRealm.js. That
   * is its contract for things the user cannot act on, and it is one toast, not two: nothing here
   * re-reports it the way fetchLeads has to.)
   *
   * allSettled, not all: the two calls have different scopes and different failure modes, and one
   * being down must not blank the other.
   */
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    const [summaryRes, alertRes] = await Promise.allSettled([
      leadService.getStatsSummary(),
      leadAlertService.getStats(),
    ]);
    // leadService returns the raw axios response (ApiResponse envelope); leadAlertService unwraps.
    setSummary(summaryRes.status === 'fulfilled' ? (summaryRes.value?.data?.data ?? null) : null);
    setAlertStats(alertRes.status === 'fulfilled' ? (alertRes.value ?? null) : null);
    setStatsLoading(false);
  }, []);

  /* Both effects are guarded on the SAME key the page gates on. Hooks run before the `denied`
     early-return below (:AccessDenied), so without this a user who reaches /allleads by URL
     without LEAD_READ fires requests that all 403 — and the shared interceptor toasts each one on
     top of the access-denied screen. */
  useEffect(() => {
    if (!hasPermission(P.LEAD_READ)) return;
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    if (!hasPermission(P.LEAD_READ)) return;
    fetchStats();
  }, [fetchStats]);

  /* REMOVED: the second, uncapped `getAllLeads(0, 200)` overview fetch that used to live here.
     A whole extra list request on every mount, whose only job was to feed card and badge FALLBACKS
     that were wrong by construction (a 200-row sample presented as scope totals) and that
     /leads/stats/summary now answers correctly in SQL. It was also the one effect on this page NOT
     gated on LEAD_READ, so opening /allleads by URL without the permission fired a 403 and the
     interceptor toasted it on top of the AccessDenied screen.

     Consequence, deliberately: when a roll-up has not landed, cards and badges show "—" rather than
     a confident number derived from one page. */

  // ── Navigate to standalone /EditLead/:id page ──
  const handleEditNavigate = (lead) => {
    navigate(`/EditLead/${lead.publicId || lead.id}`);
  };

  // ── Weblink row button: pick a design, SAVE it, then open /q/{publicId} ──
  // The style is persisted before the tab opens because the public page renders from the STORED
  // design — opening first would show the old one, and the customer's link would disagree with it.
  const openLeadWeblinkWithStyle = async (lead, style) => {
    const q = lead?.latestQuotation;
    setWeblinkStyleLead(null);
    if (!q?.publicId) return;
    try {
      if (style && style !== (q.templateStyle || 'CLASSIC')) {
        await quotationService.setTemplateStyle(q.publicId, style);
        setLeads(prev => prev.map(l => l.id === lead.id
          ? { ...l, latestQuotation: { ...l.latestQuotation, templateStyle: style } }
          : l));
      }
      window.open(`${window.location.origin}/q/${q.publicId}`, '_blank', 'noopener,noreferrer');
    } catch (e) {
      // The tab was NOT opened — a design we failed to save would misrepresent what the customer sees.
      if (isAlreadyReported(e)) return;
      showToast(getErrorMessage(e, 'Could not set the design. The weblink was not opened.'), 'error');
    }
  };

  const handleStageChange = async (leadToUpdate, newStage) => {
    try {
      const safeAssignedUserId =
        leadToUpdate.assignedUserId ||
        leadToUpdate.assignedUser?.publicId ||
        leadToUpdate.assignedUser?.id ||
        null;

      const completePayload = {
        ...leadToUpdate,
        leadStage: newStage,
        assignedUserId: safeAssignedUserId
      };

      await leadService.updateLead(
        leadToUpdate.publicId || leadToUpdate.id,
        completePayload,
        leadToUpdate.services || [],
        leadToUpdate.itinerary || []
      );

      setLeads(prev => prev.map(l => l.id === leadToUpdate.id ? { ...l, leadStage: newStage } : l));
      // A stage move changes Active / Proposal Sent / Converted and the pipeline value with it.
      // The row is patched locally, but the cards are server-side — they have to be re-asked.
      fetchStats();
      showToast(`Lead ${leadToUpdate.leadCode || leadToUpdate.customerName || ''} marked as ${newStage}!`);
    } catch (err) {
      if (isAlreadyReported(err)) return;   // <ToastHost/> already showed it
      showToast(getErrorMessage(err, 'Error updating lead stage. Please try again.'), 'error');
    }
  };

  // Same "send the complete payload" pattern as the stage change — the Type column is a dropdown.
  const handleTypeChange = async (leadToUpdate, newType) => {
    try {
      const safeAssignedUserId =
        leadToUpdate.assignedUserId ||
        leadToUpdate.assignedUser?.publicId ||
        leadToUpdate.assignedUser?.id ||
        null;

      await leadService.updateLead(
        leadToUpdate.publicId || leadToUpdate.id,
        { ...leadToUpdate, leadType: newType, assignedUserId: safeAssignedUserId },
        leadToUpdate.services || [],
        leadToUpdate.itinerary || []
      );

      setLeads(prev => prev.map(l => l.id === leadToUpdate.id ? { ...l, leadType: newType } : l));
      fetchStats();   // the Fresh badge is a server count now
      showToast(`Lead #${leadToUpdate.id} set to ${newType}!`);
    } catch (err) {
      if (isAlreadyReported(err)) return;   // <ToastHost/> already showed it
      showToast(getErrorMessage(err, 'Error updating lead type. Please try again.'), 'error');
    }
  };

  const handleDelete = async () => {
    try {
      if (typeof leadService.deleteLead === 'function') {
        await leadService.deleteLead(deleteTarget.publicId || deleteTarget.id);
      }
      // Drop it immediately so the row goes away, then re-read the page: with server-side paging a
      // deletion shifts every following row up by one, so the local filter alone would leave the
      // page one short and the total stale until the next navigation.
      setLeads(prev => prev.filter(l => l.id !== deleteTarget.id));
      setSelectedIds(prev => prev.filter(id => id !== deleteTarget.id));
      fetchLeads();
      fetchStats();
      showToast(`Lead ${deleteTarget.leadCode || deleteTarget.customerName || ''} has been deleted.`);
      setDeleteTarget(null);
    } catch (err) {
      if (isAlreadyReported(err)) return;   // <ToastHost/> already showed it
      showToast(getErrorMessage(err, 'Failed to delete lead. Please try again.'), 'error');
    }
  };

  // Reflect a successful conversion in the list: flip the lead to Converted and link the booking,
  // so the row's action relabels to "Booked ↗" and a second conversion can't be started.
  const handleConvertNavigate = (lead) => {
    navigate(`/CreateBooking/${lead.publicId || lead.id}`);
  };

  const handleLogAdded = (leadId) => {
    setLeads(prev => prev.map(l =>
      (l.id === leadId || l.publicId === leadId)
        ? { ...l, logCount: (l.logCount || 0) + 1 }
        : l
    ));
  };

  /* The table's rows — the current server page. */
  const safeLeads = useMemo(() => (Array.isArray(leads) ? leads : []), [leads]);

  /* TWO different totals, and conflating them is what made the old header badge lie:
       scopeTotal    — every lead in the caller's row scope, IGNORING the current filters. Only the
                       server roll-up knows this, so it is null until /stats/summary lands.
       filteredTotal — how many rows the CURRENT query matched, across all pages. This is what the
                       "N results" pill and the pager must read.
     Neither is ever computed from the loaded rows. A page-derived figure dressed as a total is the
     defect this change exists to remove, so where a number is genuinely unknown the UI shows "—". */
  const scopeTotal = summary?.totalLeads ?? null;
  const filteredTotal = meta?.totalElements ?? safeLeads.length;

  const summaryMissing = !statsLoading && !summary;

  /* Counts that used to come from a 200-row client-side sample. Server aggregate or nothing. */
  const followUpsDueCount = summary
    ? summary.followUpsOverdue + summary.followUpsDueToday
    : null;

  /* ── The nine cards ────────────────────────────────────────────────────────────────────────
     Four on the first row, five on the second, in the order the owner specified. Shape and styling
     are the Bookings dashboard's (Allbookings.jsx:76) so the two list screens read as one product.

     Every figure is a SERVER aggregate. Two different scopes are represented and that is why every
     card carries a caption:
       · seven of them follow the caller's own LEAD_READ row scope (admin ⇒ tenant, manager ⇒ team,
         agent ⇒ own) — GET /leads/stats/summary;
       · "Needs 1st Contact" and "Avg 1st Response" are TENANT-WIDE by design — an open lead is
         broadcast to everyone precisely so anyone can claim it, so those two will not add up
         against the rest and say so.

     `value: null` is what a card shows as "—". It is never coerced to 0: for the response-time card
     null means "nobody has been contacted yet", and 0 would read as an instant reply. */
  const periodLabel = summary
    ? `${fmtDayMon(summary.periodFrom)}–${fmtDayMon(summary.periodTo)}`
    : 'this month';
  /* Was "this page only — roll-up unavailable", back when a failed roll-up fell back to counting the
     loaded rows. Nothing falls back to the page any more: a missing aggregate renders "—", so the
     caption says only that the number is unknown, not that it describes a page. */
  const rollupDown = summaryMissing ? 'roll-up unavailable' : null;

  const statCards = [
    // ── Row 1: what the pipeline IS, right now ──
    {
      key: 'total', label: 'Total Leads', icon: Users, gradient: 'from-blue-600 to-indigo-500',
      // The caller's whole scope, NOT meta.totalElements — that one moves with the active filter,
      // and a "Total Leads" card that drops when you type in the search box is a bug report.
      value: scopeTotal,
      caption: rollupDown ?? 'all leads in your scope',
      loading: statsLoading && !summary,
      onClick: () => setActiveTab('All'),
    },
    {
      key: 'hot', label: 'Hot Leads', icon: Sparkles, gradient: 'from-rose-500 to-red-600',
      value: typeCount(summary, 'Hot'),
      caption: rollupDown ?? 'highest-priority enquiries',
      loading: statsLoading && !summary,
      onClick: () => setActiveTab('Hot'),
    },
    {
      key: 'active', label: 'Active', icon: Inbox, gradient: 'from-cyan-500 to-teal-600',
      value: summary?.activeLeads ?? null,
      caption: rollupDown ?? 'open — not Converted or Lost',
      loading: statsLoading && !summary,
      onClick: () => setActiveTab('Active'),
    },
    {
      key: 'lost', label: 'Lost Leads', icon: X, gradient: 'from-slate-600 to-slate-700',
      value: summary?.lostLeads ?? null,
      caption: rollupDown ?? 'closed without a booking',
      loading: statsLoading && !summary,
      onClick: () => setActiveTab('Lost'),
    },

    // ── Row 2: what the team DID, and what is owed ──
    {
      // All-time converted, so it sits in the same family as Total/Active/Lost. The period figure
      // and the COHORT rate (of the leads created in that window, how many closed) ride in the
      // caption — pairing a period's wins with all-time creations would divide two populations.
      key: 'converted', label: 'Converted', icon: Trophy, gradient: 'from-green-500 to-emerald-600',
      value: summary?.convertedLeads ?? null,
      caption: summary
        ? (summary.conversionRate == null
            ? `${summary.convertedInPeriod} in ${periodLabel}`
            : `${summary.convertedInPeriod} in ${periodLabel} · ${summary.conversionRate}% of ${summary.createdInPeriod} new`)
        : (rollupDown ?? 'won leads'),
      loading: statsLoading && !summary,
      onClick: () => setActiveTab('Converted'),
    },
    {
      key: 'followups', label: 'Follow-ups Due', icon: Bell, gradient: 'from-amber-500 to-orange-500',
      value: followUpsDueCount,
      caption: summary
        ? `${summary.followUpsOverdue} overdue · ${summary.followUpsDueToday} today`
        : (rollupDown ?? 'overdue + due today'),
      loading: statsLoading && !summary,
      onClick: () => setActiveTab('Follow-ups'),
    },
    {
      key: 'unclaimed', label: 'Needs 1st Contact', icon: AlertCircle, gradient: 'from-orange-600 to-red-600',
      value: alertStats?.openToClaim ?? null,
      caption: alertStats
        ? `${alertStats.slaBreaches ?? 0} past target · tenant-wide`
        : 'tenant-wide',
      loading: statsLoading && !alertStats,
      onClick: () => navigate('/leads/incoming'),
    },
    {
      key: 'response', label: 'Avg 1st Response', icon: TrendingUp, gradient: 'from-violet-500 to-purple-600',
      value: alertStats ? fmtDurationShort(alertStats.avgFirstResponseSeconds) : null,
      caption: alertStats
        ? `target ${Math.max(1, Math.round((alertStats.slaTargetSeconds ?? 300) / 60))}m · today · tenant-wide`
        : 'contacted today · tenant-wide',
      loading: statsLoading && !alertStats,
      onClick: () => navigate('/leads/incoming'),
    },
    {
      // Σ budget over ACTIVE leads. The coverage line is not optional: budget is nullable and often
      // empty on a fresh enquiry, so the sum alone reads as "the pipeline is worth this" when it may
      // be describing four leads out of eighty.
      key: 'pipeline', label: 'Pipeline Value', icon: DollarSign, gradient: 'from-sky-600 to-blue-700',
      value: summary ? (fmtMoneyCompactINR(summary.activePipelineValue) ?? '₹0') : null,
      caption: summary
        ? `${summary.activeWithBudget} of ${summary.activeLeads} active have a budget`
        : 'customer-stated budget',
      loading: statsLoading && !summary,
      onClick: () => setActiveTab('Active'),
    },
  ];

  /* REMOVED: the client-side `filteredLeads` memo. It re-applied search, the date window and the
     tab to rows the server had ALREADY narrowed by exactly those three — a second, weaker copy of
     the same rules running over one page, which is what made every "filter" a lie past the fetch
     cap. `serverParams` above is now the single place a filter is expressed. */

  /* REMOVED: the TanStack table. It only ever supplied getPaginationRowModel() here — paginating a
     page the server had already paginated — and in exchange every row arrived as a Row WRAPPER that
     the markup had to unwrap via row.original. Sorting is a server parameter (sortBy/sortDir) and
     paging is server-side, so it had no job left.

     It had to go together with the client-side filtering above: fixing the data source alone would
     have made the screen worse, because page 2 of any filtered result would render empty. */
  const pageRows = safeLeads;
  const totalPages = Math.max(1, meta?.totalPages ?? 1);
  const safePageIndex = meta?.page ?? pagination.pageIndex;
  const pageSize = pagination.pageSize;

  /* Deleting the last row of the last page leaves the client asking for a page the server no longer
     has, and the answer to that is an empty grid on a non-empty list. Step back instead; changing
     pageIndex re-runs fetchLeads through its useCallback dependency. Filter changes are already
     handled by the reset-to-page-0 effect above — this covers only the shrink-underneath case. */
  useEffect(() => {
    if (!meta) return;
    const lastPage = Math.max(0, (meta.totalPages ?? 1) - 1);
    if (pagination.pageIndex > lastPage) {
      setPagination(p => ({ ...p, pageIndex: lastPage }));
    }
  }, [meta, pagination.pageIndex]);

  // Header checkbox works on the current page, like the old CRM.
  const pageIds = pageRows.map(l => l.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id));
  const toggleSelect = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleSelectAll = () => setSelectedIds(prev => allPageSelected
    ? prev.filter(id => !pageIds.includes(id))
    : [...new Set([...prev, ...pageIds])]);

  const goToPage = (page) => setPagination(p => ({ ...p, pageIndex: Math.max(0, Math.min(page, totalPages - 1)) }));
  const changePageSize = (size) => setPagination({ pageIndex: 0, pageSize: size });

  // Blocked page (no LEAD_READ, or the list load was forbidden) → friendly full-page block.
  if (denied || !hasPermission(P.LEAD_READ)) return <AccessDenied />;

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 font-sans"
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes fadeUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn  { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideIn { from{transform:translateX(110%);opacity:0}  to{transform:translateX(0);opacity:1} }
        .fade-up { animation: fadeUp .4s ease both; }
      `}</style>

      {/* Refetches only when leads actually landed, so a cancelled or all-duplicate
          import does not churn the list. */}
      <ImportLeadsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => { fetchLeads(); fetchStats(); }}
      />

      {convo && (
        /* Keyed on the lead so switching records remounts the drawer: its thread, templates
           and half-typed message all belong to one contact and must not survive the change. */
        <ConversationDrawer
          key={convo.lead.publicId || convo.lead.id}
          lead={convo.lead}
          initialChannel={convo.channel}
          onClose={() => setConvo(null)}
        />
      )}
      {viewLead && <ViewLeadModal lead={viewLead} onClose={() => setViewLead(null)} onEdit={l => { setViewLead(null); handleEditNavigate(l); }} canEdit={hasPermission(P.LEAD_UPDATE)} />}
      {deleteTarget && <DeleteConfirm lead={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} />}
      {/* No onToast prop: every modal reaches the shared toast store directly. */}
      {quotationsLead && <QuotationsModal lead={quotationsLead} onClose={() => setQuotationsLead(null)} canEdit={hasPermission(P.QUOTATION_UPDATE)} canDelete={hasPermission(P.QUOTATION_DELETE)} />}
      {suggestLead && <SuggestPackagesModal lead={suggestLead} onClose={() => setSuggestLead(null)} />}
      {logLead && <AddLogModal lead={logLead} onClose={() => setLogLead(null)} onLogAdded={handleLogAdded} />}
      {logsViewLead && <LogsModal lead={logsViewLead} onClose={() => setLogsViewLead(null)} canDelete={hasPermission(P.LEAD_UPDATE)} />}
      {weblinkLead?.latestQuotation && <WeblinkAnalyticsModal quotation={weblinkLead.latestQuotation} onClose={() => setWeblinkLead(null)} />}
      {/* Weblink row button → pick a design first. mode="share" because the pick is PERSISTED and
          is exactly what the customer sees when they open the link. */}
      {weblinkStyleLead?.latestQuotation && (
        <QuotationStyleModal
          mode="share"
          savedStyle={weblinkStyleLead.latestQuotation.templateStyle}
          onSelect={(style) => openLeadWeblinkWithStyle(weblinkStyleLead, style)}
          onClose={() => setWeblinkStyleLead(null)}
        />
      )}

      <div className="bg-white/70 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-white shadow-lg shadow-blue-200">
                <Users size={24} strokeWidth={2.2} />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                  Leads Management
                  {/* The caller's real total, off `pagination.totalElements` — not the page size,
                      which is what this badge used to show. */}
                  <span className="hidden sm:inline text-xs bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold px-2.5 py-0.5 rounded-full">
                    {scopeTotal == null ? '—' : scopeTotal.toLocaleString('en-IN')} total
                  </span>
                </h1>
                <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1 font-medium">
                  <span className="hover:text-blue-600 cursor-pointer transition-colors">Home</span>
                  <span className="mx-1 text-slate-300">/</span>
                  <span className="text-blue-600 font-bold">Leads</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Link to="/AllLeadLogs" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-blue-300 bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-600 text-sm font-bold transition-all shadow-sm">
                <FileText size={15} /> Logs
              </Link>
              {hasPermission(P.LEAD_CREATE) && (
                <>
                  {/* Opens the preview-then-confirm importer. The file input lives inside the modal
                      so the picker is never the whole interaction — a bare <input> here used to
                      swallow the chosen file with no request and no feedback. */}
                  <button
                    type="button"
                    onClick={() => setImportOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-blue-300 bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-600 text-sm font-bold transition-all shadow-sm cursor-pointer"
                  >
                    <Upload size={15} /> Import
                  </button>
                  <Link to="/CreateLead" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-200 hover:shadow-lg transition-all">
                    <Plus size={16} strokeWidth={2.5} /> Create Lead
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          {/* Collapsed/expanded toggle bar — always visible */}
          <button
            onClick={() => setAnalyticsOpen(o => !o)}
            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50/60 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <BarChart3 size={16} />
            </div>
            <span className="text-sm font-extrabold text-slate-700 flex-shrink-0">Analytics</span>

            {/* Compact values when the cards are collapsed — the same four the team watches most,
                read off the same server roll-up so collapsing changes the layout, not the truth. */}
            {!analyticsOpen && (
              <div className="flex items-center gap-2 flex-wrap ml-1">
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-teal-100 text-teal-700 border border-teal-200">
                  {summary ? summary.activeLeads.toLocaleString('en-IN') : '—'} Active
                </span>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                  {followUpsDueCount == null ? '—' : followUpsDueCount.toLocaleString('en-IN')} Follow-ups
                </span>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-red-100 text-red-700 border border-red-200">
                  {/* "—", not 0, when the tiles have not landed — the same rule the card follows.
                      A fabricated 0 here is the worst one on the page: it is the figure that tells
                      someone to go and claim a lead nobody has answered. */}
                  {alertStats ? alertStats.openToClaim.toLocaleString('en-IN') : '—'} Unclaimed
                </span>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
                  {summary ? summary.convertedLeads.toLocaleString('en-IN') : '—'} Converted
                </span>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                  {summary ? (fmtMoneyCompactINR(summary.activePipelineValue) ?? '₹0') : '—'} Pipeline
                </span>
              </div>
            )}

            <ChevronDown
              size={16}
              className="text-slate-400 ml-auto flex-shrink-0 transition-transform duration-300"
              style={{ transform: analyticsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </button>

          {/* ── The nine cards: 4 on the first row, 5 on the second ───────────────────────────
              Two separate grids, not one 9-item grid — a single grid would wrap 5+4 or 3+3+3
              depending on the breakpoint, and the split is specified. Both collapse to 2 columns
              on phones, where "row 1 / row 2" stops meaning anything anyway.

              Definitions (and the reason each caption exists) are on `statCards` above. */}
          {analyticsOpen && (
            <div className="px-5 pb-5 space-y-4" style={{ animation: 'fadeIn .25s ease both' }}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {statCards.slice(0, 4).map((card, i) => (
                  <div key={card.key} className="fade-up" style={{ animationDelay: `${i * 40}ms` }}>
                    <StatCard
                      card={card}
                      value={card.value}
                      caption={card.caption}
                      loading={card.loading}
                      onClick={card.onClick}
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
                {statCards.slice(4).map((card, i) => (
                  <div key={card.key} className="fade-up" style={{ animationDelay: `${(i + 4) * 40}ms` }}>
                    <StatCard
                      card={card}
                      value={card.value}
                      caption={card.caption}
                      loading={card.loading}
                      onClick={card.onClick}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">

          <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-base font-extrabold text-slate-700">Leads Directory</h2>
                <span className="text-xs bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold px-3 py-1 rounded-full">{filteredTotal.toLocaleString('en-IN')} results</span>
              </div>
              {/* REMOVED: the "this table holds the newest N" truncation notice. It described a real
                  problem — cards measured over the whole scope, table over a capped in-memory slice —
                  and it could never actually render, because the totalCount it was gated on was only
                  ever decremented, never set. Both halves are moot now: the table is a true server
                  page, so the cards and the list describe the same population. */}
            </div>
            {(searchTerm || dateFilter !== 'all' || activeTab !== 'All') && (
              <button onClick={() => { setDateFilter('all'); setSearchTerm(''); setActiveTab('All'); }} className="text-xs text-slate-400 hover:text-red-500 font-bold flex items-center gap-1.5 transition-colors">
                {'\u2715'} Clear all filters
              </button>
            )}
          </div>

          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60">
            <div className="flex flex-col sm:flex-row gap-3 flex-wrap items-stretch sm:items-center">
              <div className="relative flex-1 min-w-[220px] max-w-sm group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors"><Search size={15} /></div>
                <input
                  type="text" placeholder="Search by name, email, phone, or ID..."
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-full border border-slate-200 bg-white text-sm text-slate-700 placeholder-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none transition-all"
                />
              </div>
              <div className="relative min-w-[160px]">
                <select value={dateFilter} onChange={e => setDateFilter(e.target.value)}
                  className="w-full pl-9 pr-8 py-2.5 rounded-full border border-slate-200 bg-white text-sm text-slate-600 font-medium focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none appearance-none cursor-pointer transition-all">
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="last_7_days">Last 7 Days</option>
                  <option value="custom">Custom Date</option>
                </select>
                <div className="absolute inset-y-0 left-0  pl-3 flex items-center pointer-events-none text-slate-400"><Calendar size={15} /></div>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400"><ChevronDown size={13} /></div>
              </div>
              {dateFilter === 'custom' && (
                <div className="flex items-center gap-2 fade-up flex-wrap">
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none transition-all" />
                  <span className="text-slate-400 text-sm font-medium">to</span>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none transition-all" />
                </div>
              )}

              {/* Row density. Persisted in localStorage['leads:density'] — someone who works this
                  list all day sets it once. Pushed right so it reads as a VIEW control, not a
                  filter: it changes nothing about which leads are listed. */}
              <div className="sm:ml-auto flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
                {[
                  { key: false, label: 'Comfortable' },
                  { key: true, label: 'Compact' },
                ].map(opt => (
                  <button
                    key={String(opt.key)}
                    onClick={() => setDense(opt.key)}
                    aria-pressed={dense === opt.key}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${dense === opt.key
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm shadow-blue-200'
                      : 'text-slate-500 hover:text-blue-600'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="px-5 py-4 border-b border-slate-100 overflow-x-auto">
            {(() => {
              /* Badges read the SERVER roll-up and fall back to the loaded page only while it is
                 in flight (or if it failed) — they used to be page counts unconditionally, so
                 "Contacted 41" meant "41 of the newest 100", not 41 in the pipeline.

                 Every tab a card can click into has a button here, so the selected filter is
                 always visible: Active and Follow-ups exist for exactly that reason. */
              const tabs = [
                { name: 'All',        count: scopeTotal },
                { name: 'Active',     count: summary?.activeLeads ?? null },
                { name: 'Follow-ups', count: followUpsDueCount },
                { name: 'Hot',        count: typeCount(summary, 'Hot'),
                                      dot: 'bg-red-500 shadow-red-500/50' },
                { name: 'Fresh',      count: typeCount(summary, 'Fresh'),
                                      dot: 'bg-emerald-500 shadow-emerald-500/50' },
                { name: 'New Lead',   count: stageCount(summary, 'New Lead') },
                { name: 'Contacted',  count: stageCount(summary, 'Contacted') },
                { name: 'Converted',  count: stageCount(summary, 'Converted') },
                { name: 'Lost',       count: stageCount(summary, 'Lost') },
              ];

              const btnClass = (tabName) => `px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 shadow-sm transition-all border ${activeTab === tabName
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-transparent shadow-blue-200'
                : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'
                }`;

              const badgeClass = (tabName) => `px-2 py-0.5 rounded-md text-xs font-black ${activeTab === tabName ? 'bg-white/20' : 'bg-slate-100 text-slate-700'
                }`;

              return (
                <div className="flex gap-2 min-w-max">
                  {tabs.map(tab => (
                    <button key={tab.name} onClick={() => setActiveTab(tab.name)} className={btnClass(tab.name)}>
                      {tab.dot && <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${tab.dot}`} />}
                      {tab.name}
                      {/* null → "—". Number(null) is 0, so the old cast printed a confident zero for
                          every badge whose roll-up had not arrived yet. */}
                      <span className={badgeClass(tab.name)}>
                        {tab.count == null ? '—' : Number(tab.count).toLocaleString('en-IN')}
                      </span>
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Selection strip — only visible when something is ticked */}
          {selectedIds.length > 0 && (
            <div className="px-5 py-2.5 bg-blue-50 border-b border-blue-100 flex items-center gap-3 flex-wrap" style={{ animation: 'fadeIn .2s ease both' }}>
              <span className="text-xs font-extrabold text-blue-700">{selectedIds.length} selected</span>
              <button onClick={() => setSelectedIds([])} className="text-xs font-bold text-slate-500 hover:text-red-500 transition-colors">Clear</button>
            </div>
          )}

          {/* ── The table. 16 columns, horizontally scrollable — same shape as the old CRM. ── */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: `${LEAD_TABLE_MIN_W}px` }}>
              <colgroup>
                {LEAD_COLUMNS.map(c => <col key={c.key} style={{ width: `${c.width}px` }} />)}
              </colgroup>

              <thead>
                <tr className="bg-blue-600  text-[11px] font-extrabold text-white uppercase tracking-wider">
                  {LEAD_COLUMNS.map(c => {
                    const active = c.sortKey && sort.by === c.sortKey;
                    return (
                      <th key={c.key}
                        aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                        className={`px-2.5 py-3 border-r border-blue-500/60 last:border-r-0 whitespace-nowrap
                          ${alignClass(c.align)} ${FROZEN_TH[c.key] || ''}`}>
                        {c.key === 'select' ? (
                          <input
                            type="checkbox" checked={allPageSelected} onChange={toggleSelectAll}
                            aria-label="Select all leads on this page"
                            className="w-4 h-4 rounded border-white/60 text-emerald-700 focus:ring-white cursor-pointer"
                          />
                        ) : c.sortKey ? (
                          /* Sorts the WHOLE result set server-side, not the page. The caret only
                             appears on the active column — sixteen permanent carets would be noise. */
                          <button
                            type="button"
                            onClick={() => toggleSort(c.sortKey)}
                            title={`Sort by ${c.label}`}
                            className={`group inline-flex items-center gap-1 uppercase tracking-wider font-extrabold
                              transition-opacity hover:opacity-80 ${alignClass(c.align)}`}
                          >
                            {c.label}
                            <ChevronDown
                              size={12}
                              className={`transition-all ${active
                                ? `opacity-100 ${sort.dir === 'asc' ? 'rotate-180' : ''}`
                                : 'opacity-0 group-hover:opacity-50'}`}
                            />
                          </button>
                        ) : c.label}
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  [...Array(Math.min(pageSize, 5))].map((_, i) => <SkeletonRow key={i} />)
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={LEAD_COLUMNS.length} className="text-center py-24 px-5">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-20 h-20 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mb-5 shadow-sm transform -rotate-3">
                          <Inbox size={32} className="text-slate-400" />
                        </div>
                        <p className="text-lg font-extrabold text-slate-600 mb-1">No Leads Found</p>
                        <p className="text-sm text-slate-400 mb-5 max-w-sm mx-auto leading-relaxed">We couldn't find any leads matching your selected criteria.</p>
                        <button onClick={() => { setDateFilter('all'); setSearchTerm(''); setActiveTab('All'); }} className="px-4 py-2 rounded-xl bg-blue-50 text-blue-600 font-bold text-sm hover:bg-blue-100 transition-all">Clear Filters</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pageRows.map((lead, idx) => {
                    // Plain lead objects now — the TanStack Row wrapper (and the row.original
                    // unwrapping it forced on every field read) went with the client-side table.
                    return (
                      <LeadRow
                        key={lead.id}
                        lead={lead}
                        index={idx}
                        selected={selectedIds.includes(lead.id)}
                        onToggleSelect={toggleSelect}
                        onView={setViewLead}
                        onEditNavigate={handleEditNavigate}
                        onDelete={setDeleteTarget}
                        onStageChange={handleStageChange}
                        onTypeChange={handleTypeChange}
                        onViewQuotations={setQuotationsLead}
                        onSuggestPackages={setSuggestLead}
                        onConvert={handleConvertNavigate}
                        onAddLog={setLogLead}
                        onViewLogs={setLogsViewLead}
                        onWeblinkStats={setWeblinkLead}
                        onWeblinkView={setWeblinkStyleLead}
                        onWhatsApp={(lead, channel = 'WHATSAPP') => setConvo({ lead, channel })}
                        canEdit={hasPermission(P.LEAD_UPDATE)}
                        canDelete={hasPermission(P.LEAD_DELETE)}
                        canConvert={hasPermission(P.BOOKING_CREATE)}
                        canCreateQuotation={hasPermission(P.QUOTATION_CREATE)}
                        dense={dense}
                      />
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <CommonPagination
            pageIndex={safePageIndex}
            pageSize={pageSize}
            totalElements={filteredTotal}
            totalPages={totalPages}
            goToPage={goToPage}
            changePageSize={changePageSize}
          />

        </div>
      </div>
    </div>
  );
};

export default Leads;
