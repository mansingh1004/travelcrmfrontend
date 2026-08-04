// src/features/leads/pages/LeadAlerts.jsx
//
// "Incoming Leads" — the claim window's screen. Every new lead lands here live, auto-assigned but
// open to anyone until someone marks it contacted.
//
// Reads its state from LeadAlertProvider (mounted in Layout) rather than fetching its own, so the
// page and the global alert host share ONE SSE subscription. Navigating here and away does not open
// or close a connection.
//
// SKIN: the house chrome from AllLeads.jsx — same gradient shell, same translucent header strip,
// same glass panel, same gradient stat cards, same blue-600 table header — wrapped around a data
// surface that keeps the operator discipline: fixed columns, tabular numerics, colour only for the
// exceptional, and full keyboard control. The metric this screen is judged on is seconds from
// broadcast to claim, and reaching for the mouse is most of that: j/k move, c claims, m contacts,
// h opens history.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  BellRing,
  Users,
  Inbox,
  Timer,
  AlertTriangle,
  Volume2,
  VolumeX,
  RefreshCw,
  Search,
  List,
} from "lucide-react";
import { toast } from "@shared/ui/toast";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { useLeadAlerts } from "../hooks/useLeadAlerts";
import { leadAlertService, claimFailure } from "../api/leadAlertService";
import { FONT_STACK, formatDuration } from "../lib/leadAlertConstants";
import LeadAlertRow from "../components/LeadAlertRow";
import LeadHistoryDrawer from "../components/LeadHistoryDrawer";
import AccessDenied from "../components/AccessDenied";
import {
  Banner,
  Btn,
  COLUMNS,
  EmptyState,
  IconBtn,
  Key,
  LivePill,
  PANEL,
  SkeletonRow,
  StatTile,
  TABLE_MIN_W,
  alignClass,
} from "../components/leadAlertUi";

const SOUND_KEY = "leadAlertSound";

/** The server caps the feed here and sends no truncation flag — hitting it is the only signal. */
const FEED_CAP = 200;

/** How long a dead row stays readable before it goes. A gone lead still owes the operator a reason. */
const FADE_MS = { GONE: 4000, DEFAULT: 6000 };

const TABS = [
  { key: "all", label: "All" },
  { key: "mine", label: "Mine" },
  { key: "late", label: "Past target" },
];

const isTyping = (el) =>
  !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

export default function LeadAlerts() {
  const ctx = useLeadAlerts();

  // Per-lead action state, keyed by publicId, so one row's pending spinner or failure note never
  // appears on another row.
  const [busy, setBusy] = useState({});
  const [failures, setFailures] = useState({});
  const [fading, setFading] = useState({});

  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("all");
  const [focusIdx, setFocusIdx] = useState(0);
  const [expanded, setExpanded] = useState(null);
  const [drawerLead, setDrawerLead] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [soundOn, setSoundOn] = useState(
    () => typeof localStorage === "undefined" || localStorage.getItem(SOUND_KEY) !== "off"
  );

  const searchRef = useRef(null);
  const timers = useRef({});

  useEffect(
    () => () => {
      Object.values(timers.current).forEach(clearTimeout);
    },
    []
  );

  const leads = ctx?.leads;
  const isMine = ctx?.isMine;

  // Live view of the feed for callbacks that resume after an await — by then the snapshot they
  // closed over can be several SSE events out of date.
  const leadsRef = useRef(leads);
  leadsRef.current = leads;

  /* ── Filtering. Client-side over the in-memory feed, which is the whole dataset here. ───────── */

  const visible = useMemo(() => {
    if (!leads) return [];
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (scope === "mine" && !isMine?.(l)) return false;
      // Labelled "Past target", never "Breached": a reopened lead shows a deeply negative countdown
      // while its frozen first-response measurement may well have beaten the target.
      if (scope === "late" && !(l.secondsLeft != null && l.secondsLeft <= 0)) return false;
      if (!q) return true;
      return [l.customerName, l.phone, l.leadCode, l.destination]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [leads, query, scope, isMine]);

  const counts = useMemo(() => {
    const all = leads?.length ?? 0;
    let mine = 0;
    let late = 0;
    (leads ?? []).forEach((l) => {
      if (isMine?.(l)) mine += 1;
      if (l.secondsLeft != null && l.secondsLeft <= 0) late += 1;
    });
    return { all, mine, late };
  }, [leads, isMine]);

  /* ── Roving focus ───────────────────────────────────────────────────────────────────────────── */

  const clampedIdx = Math.min(focusIdx, Math.max(0, visible.length - 1));

  /**
   * Set by the key handlers and by a row removal — the only two things allowed to MOVE the DOM
   * focus. Without it the effect below can only follow focus that is already in the list, so j/k
   * would highlight rows the screen reader never announces; with it unguarded, every one-second
   * countdown re-render would yank focus out of the filter box mid-word.
   */
  const navByKey = useRef(false);

  /**
   * Deliberately keyed on the focused lead's ID, NOT on the `visible` array.
   *
   * `visible` is a fresh array every second — the provider rebuilds every row to move the
   * countdowns — so depending on it re-ran this effect at 1 Hz. With scrollIntoView outside the
   * guard that meant the viewport was yanked back to the focused row once a second, and an operator
   * scrolling down the queue could not stay anywhere. Scrolling now happens ONLY as a consequence of
   * keyboard navigation, which is the only thing entitled to move the viewport.
   */
  const focusedId = visible[clampedIdx]?.leadPublicId;

  useEffect(() => {
    if (!focusedId) return;
    if (!navByKey.current || isTyping(document.activeElement)) return;
    navByKey.current = false;
    const el = document.querySelector(`[data-lead-row="${focusedId}"]`);
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: "nearest" });
  }, [clampedIdx, focusedId]);

  /* ── Actions ────────────────────────────────────────────────────────────────────────────────── */

  /**
   * Fade a dead row out rather than yanking it. The operator has just lost a race and is owed the
   * sentence explaining why; removing the row on the same frame as the answer arrives means they
   * read nothing.
   */
  const scheduleRemoval = useCallback(
    (publicId, ms) => {
      setFading((f) => ({ ...f, [publicId]: true }));
      timers.current[publicId] = setTimeout(() => {
        // The row that takes this index inherits the focus. Losing a lead is exactly when the
        // operator should be one keystroke from claiming the next one.
        navByKey.current = true;
        ctx.dropLead(publicId);
        setFading((f) => {
          const next = { ...f };
          delete next[publicId];
          return next;
        });
        setFailures((f) => {
          const next = { ...f };
          delete next[publicId];
          return next;
        });
        delete timers.current[publicId];
      }, ms);
    },
    [ctx]
  );

  const handleFailure = useCallback(
    (lead, err, fallback) => {
      const failure = claimFailure(err);
      if (!failure) {
        if (!isAlreadyReported(err)) toast.error(getErrorMessage(err, fallback));
        return;
      }

      // The row is the right place to explain a failure — but only while the row still exists.
      // The common case for ALREADY_CONTACTED is that the colleague's lead-locked broadcast beat
      // our own 409 back (the claim path does more server work than the contact stamp), so the row
      // is already gone and a note keyed to it would render nowhere at all. Read the live list, not
      // the snapshot this callback closed over before the await.
      const stillListed = leadsRef.current?.some((l) => l.leadPublicId === lead.leadPublicId);
      if (!stillListed) {
        toast.error(failure.message);
        return;
      }

      setFailures((f) => ({ ...f, [lead.leadPublicId]: failure }));

      if (failure.retryable && failure.claimVersion != null) {
        // THE POINT OF THE COMPARE-AND-SWAP. The 409 carries the fresh version; re-arming the button
        // with it lets the operator click again inside a second. The first cut called refresh()
        // here, which threw this away, cost a round trip, and re-entered the race late.
        ctx.patchLead(lead.leadPublicId, {
          claimVersion: failure.claimVersion,
          ownerName: failure.ownerName ?? lead.ownerName,
        });
        return;
      }

      if (failure.reason === "INELIGIBLE") {
        // A property of the account, not of this lead. Stop offering Claim for the session.
        ctx.markClaimIneligible();
        return;
      }

      if (failure.gone) {
        scheduleRemoval(lead.leadPublicId, FADE_MS[failure.reason] ?? FADE_MS.DEFAULT);
      }
    },
    [ctx, scheduleRemoval]
  );

  const handleClaim = useCallback(
    async (lead) => {
      if (busy[lead.leadPublicId]) return; // debounce: every claim runs a full tenant user read server-side
      setBusy((b) => ({ ...b, [lead.leadPublicId]: "claim" }));
      setFailures((f) => ({ ...f, [lead.leadPublicId]: null }));
      try {
        // The version THIS user saw — not a re-read. Sending a fresh one would turn the server's
        // compare-and-swap into a blind overwrite that always wins.
        const result = await leadAlertService.claim(lead.leadPublicId, lead.claimVersion);
        ctx.applyResult(result);
        toast.success(`Claimed — ${lead.customerName || lead.leadCode || "lead"}`);
        // THE ATTENTION HAND-OFF. The race is over; the SLA clock is still running and is now this
        // operator's problem. One keystroke from here should answer the phone, not hunt for a button.
        requestAnimationFrame(() => {
          document.querySelector(`[data-contact-btn="${lead.leadPublicId}"]`)?.focus();
        });
      } catch (err) {
        handleFailure(lead, err, "Could not claim this lead.");
      } finally {
        setBusy((b) => ({ ...b, [lead.leadPublicId]: null }));
      }
    },
    [busy, ctx, handleFailure]
  );

  const handleContact = useCallback(
    async (lead) => {
      if (busy[lead.leadPublicId]) return;
      setBusy((b) => ({ ...b, [lead.leadPublicId]: "contact" }));
      setFailures((f) => ({ ...f, [lead.leadPublicId]: null }));
      try {
        const result = await leadAlertService.markContacted(lead.leadPublicId);
        ctx.applyResult(result);
        toast.success(
          `Marked contacted${
            result?.firstResponseSeconds != null
              ? ` — ${formatDuration(result.firstResponseSeconds)} response`
              : ""
          }`
        );
      } catch (err) {
        // Losing a simultaneous contact stamp means a colleague did the right thing first. It is
        // reported as ALREADY_CONTACTED and handled as "gone", not as an error the user caused.
        handleFailure(lead, err, "Could not mark this lead as contacted.");
      } finally {
        setBusy((b) => ({ ...b, [lead.leadPublicId]: null }));
      }
    },
    [busy, ctx, handleFailure]
  );

  const toggleSound = useCallback(() => {
    setSoundOn((on) => {
      const next = !on;
      try {
        localStorage.setItem(SOUND_KEY, next ? "on" : "off");
      } catch {
        /* private mode */
      }
      return next;
    });
  }, []);

  /* ── Keyboard ───────────────────────────────────────────────────────────────────────────────── */

  const focusedLead = visible[clampedIdx];

  useEffect(() => {
    const onKey = (e) => {
      // Escape closes the shortcut sheet first, before the bail below swallows it.
      if (e.key === "Escape" && showHelp) {
        e.preventDefault();
        setShowHelp(false);
        return;
      }
      // While an overlay is up, NOTHING else is live. The shortcut sheet is the dangerous one: it
      // never takes focus, so without this bail an operator reading the line "m — mark contacted"
      // and pressing m would silently lock the row behind the overlay — a change only a manager can
      // undo. The drawer owns its own Escape.
      if (drawerLead || showHelp) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (isTyping(e.target)) {
        if (e.key === "Escape") {
          e.preventDefault();
          setQuery("");
          e.target.blur();
        }
        return;
      }

      switch (e.key) {
        case "j":
        case "ArrowDown":
          e.preventDefault();
          navByKey.current = true;
          // Clamped through Math.max as well: on an empty list `length - 1` is -1, and a negative
          // focus index survives into the next non-empty render and points at nothing.
          setFocusIdx((i) => Math.max(0, Math.min(i + 1, visible.length - 1)));
          break;
        case "k":
        case "ArrowUp":
          e.preventDefault();
          navByKey.current = true;
          setFocusIdx((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          if (!focusedLead) break;
          e.preventDefault();
          setExpanded((x) => (x === focusedLead.leadPublicId ? null : focusedLead.leadPublicId));
          break;
        case "c":
          if (focusedLead && ctx.canClaim && focusedLead.openToClaim && !isMine?.(focusedLead)) {
            e.preventDefault();
            handleClaim(focusedLead);
          }
          break;
        case "m":
          if (focusedLead && ctx.canContact && focusedLead.openToClaim) {
            e.preventDefault();
            handleContact(focusedLead);
          }
          break;
        case "h":
          if (focusedLead) {
            e.preventDefault();
            setDrawerLead(focusedLead);
          }
          break;
        case "/":
          e.preventDefault();
          searchRef.current?.focus();
          break;
        case "?":
          e.preventDefault();
          setShowHelp((v) => !v);
          break;
        case "Escape":
          // The shortcut sheet was already handled above; this only collapses an expanded row.
          if (expanded) {
            e.preventDefault();
            setExpanded(null);
          }
          break;
        default:
          break;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible.length, focusedLead, drawerLead, showHelp, expanded, ctx, isMine, handleClaim, handleContact]);

  /* ── Render ─────────────────────────────────────────────────────────────────────────────────── */

  const avg = useMemo(() => {
    const s = ctx?.stats?.avgFirstResponseSeconds;
    // Null means nobody has been contacted yet. Rendering that as "0m" would read as an instant
    // response — the opposite of the truth.
    if (s == null) return { value: "—", unit: "" };
    if (s < 60) return { value: Math.round(s), unit: "s" };
    return { value: Math.round(s / 60), unit: "m" };
  }, [ctx?.stats]);

  if (!ctx) return null;
  if (!ctx.canSee) return <AccessDenied />;

  const { stats, loading, connected } = ctx;
  const targetMinutes = Math.max(1, Math.round((stats?.slaTargetSeconds ?? 300) / 60));
  const openCount = stats?.openToClaim ?? 0;
  const truncated = leads.length >= FEED_CAP || (openCount > leads.length && leads.length > 0);
  const emptyButStatsDisagree = !loading && leads.length === 0 && openCount > 0;
  const filtered = query.trim() || scope !== "all";

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 font-sans"
      style={{ fontFamily: FONT_STACK }}
    >
      {/* Page-local keyframes — the same set AllLeads defines, referenced by the stat cards, the
          rows and the banners. Without it the page renders unanimated. */}
      <style>{`
        @keyframes fadeUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn  { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
        .fade-up { animation: fadeUp .4s ease both; }
      `}</style>

      {/* ── Header strip ─────────────────────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-100 bg-white/70 backdrop-blur-md">
        <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-blue-400 text-white shadow-lg shadow-blue-200">
                <BellRing size={24} strokeWidth={2.2} />
              </div>
              <div>
                <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-slate-800">
                  Incoming Leads
                  <span className="hidden rounded-full bg-gradient-to-r from-violet-500 to-purple-600 px-2.5 py-0.5 text-xs font-bold text-white sm:inline">
                    {openCount} open
                  </span>
                  <LivePill connected={connected} />
                </h1>
                <div className="mt-0.5 flex items-center gap-1 text-xs font-medium text-slate-400">
                  <Link to="/allleads" className="transition-colors hover:text-blue-600">
                    Leads
                  </Link>
                  <span className="mx-1 text-slate-300">/</span>
                  <span className="font-bold text-blue-600">Incoming</span>
                  <span className="mx-1 text-slate-300">·</span>
                  <span>auto-assigned by workload, open to claim until contacted</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Btn variant="secondary" onClick={ctx.refresh}>
                <RefreshCw size={14} /> Refresh
              </Btn>
              <Btn variant="secondary" onClick={toggleSound}>
                {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
                {soundOn ? "Sound on" : "Sound off"}
              </Btn>
              <Btn variant="secondary" onClick={() => setShowHelp((v) => !v)} title="Keyboard shortcuts">
                <Key>?</Key> Shortcuts
              </Btn>
              <Link
                to="/allleads"
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-200 transition-all hover:bg-blue-700 hover:shadow-lg"
              >
                <List size={15} /> All Leads
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-screen-2xl space-y-6 px-4 py-6 sm:px-6">
        {/* Tiles. Every caption is required — three different time windows across four numbers. */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatTile
            icon={Users}
            label="New Today"
            value={stats?.newToday ?? 0}
            caption="created today"
            gradient="from-cyan-400 via-teal-500 to-teal-600"
            delay={0}
          />
          <StatTile
            icon={Inbox}
            label="Open to Claim"
            value={openCount}
            caption="all time, not just today"
            gradient="from-blue-400 via-blue-500 to-indigo-600"
            delay={60}
          />
          <StatTile
            icon={Timer}
            label="Avg First Response"
            value={avg.value}
            unit={avg.unit}
            caption={`contacted today · target ${targetMinutes}m`}
            gradient="from-violet-400 via-violet-500 to-purple-600"
            delay={120}
          />
          <StatTile
            icon={AlertTriangle}
            label="Past Target"
            value={stats?.slaBreaches ?? 0}
            caption="among today's leads"
            gradient="from-rose-400 via-red-500 to-red-600"
            delay={180}
          />
        </div>

        {/* The panel */}
        <div className={PANEL}>
          {!connected ? (
            <Banner
              action={
                <Btn variant="secondary" onClick={ctx.refresh}>
                  Refresh
                </Btn>
              }
            >
              Live updates paused — this list is a snapshot. Claiming still works.
            </Banner>
          ) : null}

          {truncated ? (
            <Banner>
              Showing the {Math.min(leads.length, FEED_CAP)} newest of {openCount} open leads. Older
              ones are in All Leads.
            </Banner>
          ) : null}

          {emptyButStatsDisagree ? (
            <Banner
              action={
                <Btn variant="secondary" onClick={ctx.refresh}>
                  Refresh
                </Btn>
              }
            >
              {openCount} leads are open to claim but none loaded.
            </Banner>
          ) : null}

          {/* Panel head */}
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-base font-extrabold text-slate-700">Claim Queue</h2>
              <span className="rounded-full bg-gradient-to-r from-violet-500 to-purple-600 px-3 py-1 text-xs font-bold text-white">
                {visible.length} shown
              </span>
            </div>
            {filtered ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setScope("all");
                  setFocusIdx(0);
                }}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-400 transition-colors hover:text-red-500"
              >
                ✕ Clear all filters
              </button>
            ) : null}
          </div>

          {/* Filters */}
          <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-4">
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <div className="group relative min-w-[220px] max-w-sm flex-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 transition-colors group-focus-within:text-blue-600">
                  <Search size={15} />
                </div>
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, phone, code, destination…"
                  className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-9 pr-10 text-sm text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                />
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <Key>/</Key>
                </div>
              </div>

              <div className="flex min-w-max gap-2 overflow-x-auto">
                {TABS.map((t) => {
                  const active = scope === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setScope(t.key);
                        setFocusIdx(0);
                      }}
                      className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold shadow-sm transition-all ${
                        active
                          ? "border-transparent bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-200"
                          : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600"
                      }`}
                    >
                      {t.key === "late" && counts.late > 0 && !active ? (
                        <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-sm shadow-red-500/50" />
                      ) : null}
                      {t.label}
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-black tabular-nums ${
                          active ? "bg-white/20" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {counts[t.key === "all" ? "all" : t.key]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: `${TABLE_MIN_W}px` }}>
              <colgroup>
                {COLUMNS.map((c) => (
                  <col key={c.key} style={{ width: `${c.width}px` }} />
                ))}
              </colgroup>
              <thead>
                <tr className="bg-blue-600 text-[11px] font-extrabold uppercase tracking-wider text-white">
                  {COLUMNS.map((c) => (
                    <th
                      key={c.key}
                      className={`whitespace-nowrap border-r border-blue-500/60 px-2.5 py-3 last:border-r-0 ${alignClass(c.align)}`}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <>
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                  </>
                ) : visible.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length}>
                      <EmptyState />
                    </td>
                  </tr>
                ) : (
                  visible.map((lead, i) => (
                    <LeadAlertRow
                      key={lead.leadPublicId}
                      index={i}
                      lead={lead}
                      isMine={!!isMine?.(lead)}
                      canClaim={ctx.canClaim}
                      canContact={ctx.canContact}
                      canReassign={ctx.canReassign}
                      busy={busy[lead.leadPublicId]}
                      failure={failures[lead.leadPublicId]}
                      fading={!!fading[lead.leadPublicId]}
                      focused={i === clampedIdx}
                      expanded={expanded === lead.leadPublicId}
                      onFocus={() => setFocusIdx(i)}
                      onToggleExpand={() =>
                        setExpanded((x) => (x === lead.leadPublicId ? null : lead.leadPublicId))
                      }
                      onClaim={() => handleClaim(lead)}
                      onContact={() => handleContact(lead)}
                      onHistory={() => setDrawerLead(lead)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Shortcut strip — keyboard-first is only real if it is discoverable */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-100 bg-slate-50/60 px-5 py-2.5 text-[11px] font-semibold text-slate-400">
            <span className="flex items-center gap-1">
              <Key>j</Key>
              <Key>k</Key> move
            </span>
            <span className="flex items-center gap-1">
              <Key>c</Key> claim
            </span>
            <span className="flex items-center gap-1">
              <Key>m</Key> contacted
            </span>
            <span className="flex items-center gap-1">
              <Key>h</Key> history
            </span>
            <span className="flex items-center gap-1">
              <Key>Enter</Key> expand
            </span>
            <span className="flex items-center gap-1">
              <Key>/</Key> search
            </span>
            <span className="flex items-center gap-1">
              <Key>?</Key> all shortcuts
            </span>
          </div>
        </div>
      </div>

      {showHelp ? <ShortcutHelp onClose={() => setShowHelp(false)} /> : null}

      {drawerLead ? (
        <LeadHistoryDrawer
          lead={ctx.leads.find((l) => l.leadPublicId === drawerLead.leadPublicId) || drawerLead}
          canReassign={ctx.canReassign}
          onClose={() => setDrawerLead(null)}
          onChanged={(result) => {
            ctx.applyResult(result);
            ctx.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function ShortcutHelp({ onClose }) {
  const rows = [
    ["j / ↓", "Next lead"],
    ["k / ↑", "Previous lead"],
    ["c", "Claim the focused lead"],
    ["m", "Mark the focused lead contacted"],
    ["h", "Ownership history"],
    ["Enter", "Expand / collapse detail"],
    ["/", "Focus the search box"],
    ["Esc", "Collapse, or clear the search"],
    ["Alt + C", "Claim the newest alert popup, from any page"],
    ["Alt + X", "Dismiss the newest alert popup"],
    ["Alt + I", "Jump to Incoming Leads"],
  ];
  return (
    <div
      className="fixed inset-0 z-[140] grid place-items-center bg-slate-900/30 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-slate-200/60 bg-white p-5 shadow-2xl"
        style={{ animation: "fadeUp .25s ease both" }}
      >
        <h3 className="mb-3 text-base font-extrabold text-slate-700">Keyboard Shortcuts</h3>
        <dl className="space-y-2">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4">
              <dt className="text-[13px] font-semibold text-slate-600">{v}</dt>
              <dd>
                <Key>{k}</Key>
              </dd>
            </div>
          ))}
        </dl>
        <IconBtn className="sr-only" onClick={onClose} aria-label="Close" />
      </div>
    </div>
  );
}
