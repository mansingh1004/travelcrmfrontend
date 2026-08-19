// src/features/leads/hooks/useLeadAlerts.jsx
//
// The claim window's live state, shared by the incoming-leads page and the global alert host.
//
// WHY A CONTEXT AND NOT A HOOK EACH. Two consumers mount at once (the alert host lives in Layout and
// is always mounted; the page mounts on navigation). If each opened its own SSE subscription the
// server would hold two connections per tab and every broadcast would fire both handlers — the user
// would get two cards for one lead. One provider, one subscription, many readers.
//
// .jsx, not .js: this file returns JSX, and no .js file in this repo does.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { notificationService } from "@features/reminders";
import { hasPermission, P } from "@shared/lib/access";
import { leadAlertService } from "../api/leadAlertService";
import { publishLeadStateChanged } from "../lib/leadEvents";

const LeadAlertContext = createContext(null);

/** How often the SLA countdown re-renders. One timer for the whole list, never one per row. */
const TICK_MS = 1000;

/**
 * Full re-sync interval. SSE is the primary channel; this is the safety net for three separate holes
 * in it — a dropped connection replays nothing (events carry no id and the server buffers none), a
 * send failure is swallowed server-side, and the terminal transitions (Lost, Converted, deleted)
 * broadcast NOTHING at all, so those rows would sit on screen indefinitely.
 */
const RESYNC_MS = 45_000;

/** Anything longer than this hidden and the countdowns are stale enough to re-read rather than tick. */
const STALE_HIDDEN_MS = 60_000;

/**
 * Stamp when a payload reached this client. The countdown is decremented from the server's
 * `slaSecondsRemaining` using elapsed time since THIS moment — so a browser clock that is minutes
 * off still shows a countdown consistent with the server's own breach count.
 */
const stamp = (alert) => ({ ...alert, receivedAt: Date.now() });

/**
 * Is this payload newer than what we already hold?
 *
 * Reassign carries no expected-version guard, so two managers acting at once both succeed and both
 * broadcast. Without this the owner label flickers back to whoever's event happened to land second.
 */
const isStaleEvent = (existing, incoming) =>
  existing != null &&
  typeof existing.claimVersion === "number" &&
  typeof incoming.claimVersion === "number" &&
  incoming.claimVersion < existing.claimVersion;

export function LeadAlertProvider({ children }) {
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  /** Live broadcast cards. Keyed by leadPublicId — see cardUpsert. */
  const [cards, setCards] = useState([]);

  const canSee = hasPermission(P.LEAD_READ);
  const canClaim = hasPermission(P.LEAD_CLAIM);

  /**
   * This user's own publicId, when we can get it.
   *
   * Nothing in the auth payload carries it, so the only source is the assignment-pool endpoint — and
   * that is gated on LEAD_CREATE. When it is unavailable we fall back to comparing the display name
   * the login stored, which is what the first cut did throughout. That fallback is wrong for two
   * staff who share a name, so prefer the id whenever we have one.
   */
  const [myUserId, setMyUserId] = useState(null);
  const myName = typeof localStorage !== "undefined" ? localStorage.getItem("userName") || "" : "";

  /**
   * Set once a claim comes back 403 "your account cannot be assigned leads". It is a property of the
   * account, not of the lead, so once we know it every Claim button in the session should stop
   * offering an action that can only fail.
   */
  const [claimIneligible, setClaimIneligible] = useState(
    () => typeof sessionStorage !== "undefined" && sessionStorage.getItem("leadClaimIneligible") === "1"
  );

  const markClaimIneligible = useCallback(() => {
    try {
      sessionStorage.setItem("leadClaimIneligible", "1");
    } catch {
      /* private mode — the in-memory flag still holds for this session */
    }
    setClaimIneligible(true);
  }, []);

  /* ── Server reads ──────────────────────────────────────────────────────── */

  const refreshStats = useCallback(() => {
    leadAlertService.getStats().then(setStats).catch(() => {
      /* the interceptor already surfaced anything actionable */
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!canSee) {
      setLoading(false);
      return;
    }
    try {
      const [open, s] = await Promise.all([
        leadAlertService.getOpenLeads(),
        leadAlertService.getStats(),
      ]);
      setLeads(open.map(stamp));
      setStats(s);
    } catch {
      // Interceptor already toasted anything the user can act on (401/403/500/network). A failed
      // background refresh must not raise a second toast — and must NOT blank the list, or one
      // network blip would erase leads the user can still see and act on.
    } finally {
      setLoading(false);
    }
  }, [canSee]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, RESYNC_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // Identity, best effort and exactly once. A 403 here is expected for anyone without LEAD_CREATE.
  useEffect(() => {
    if (!canSee || !hasPermission(P.LEAD_CREATE)) return;
    let alive = true;
    leadAlertService
      .getAssignmentPool()
      .then((pool) => {
        if (alive && pool?.self?.id) setMyUserId(pool.self.id);
      })
      .catch(() => {
        /* name comparison remains the fallback */
      });
    return () => {
      alive = false;
    };
  }, [canSee]);

  /**
   * Does this lead belong to the person looking at it?
   *
   * Ownership decides whether a Claim button is shown at all: claiming a lead you already own is a
   * server-side no-op that bumps no version and fires no event, so two tabs of the same user would
   * silently fight over a button that can never do anything.
   */
  const isMine = useCallback(
    (lead) => {
      if (!lead) return false;
      if (myUserId && lead.ownerPublicId) return lead.ownerPublicId === myUserId;
      return !!myName && lead.ownerName === myName;
    },
    [myUserId, myName]
  );

  /* ── Live push ─────────────────────────────────────────────────────────── */

  // Kept in refs so the subscription effect depends only on `canSee`. Depending on state would tear
  // down and rebuild the EventSource on every incoming lead.
  const refreshStatsRef = useRef(refreshStats);
  refreshStatsRef.current = refreshStats;
  const isMineRef = useRef(isMine);
  isMineRef.current = isMine;

  /** False until the stream has opened once, so the first open does not double-fetch the feed. */
  const openedBefore = useRef(false);

  useEffect(() => {
    if (!canSee) return undefined;

    /** Insert at the top (a genuinely new or reopened lead) or update where it already sits. */
    const upsertLead = (alert, mode) =>
      setLeads((prev) => {
        const at = prev.findIndex((l) => l.leadPublicId === alert.leadPublicId);
        const existing = at >= 0 ? prev[at] : null;
        if (isStaleEvent(existing, alert)) return prev;

        // Not openToClaim ⇒ it left the pool. Dropping it here is what makes one person's
        // "Mark contacted" remove the row from everyone else's screen.
        if (!alert.openToClaim) return at >= 0 ? prev.filter((_, i) => i !== at) : prev;

        const merged = stamp({ ...existing, ...alert });
        // In place for a claim: the row must not jump under a cursor that is already reaching for it.
        if (mode === "inplace" && at >= 0) {
          const next = prev.slice();
          next[at] = merged;
          return next;
        }
        return [merged, ...prev.filter((l) => l.leadPublicId !== alert.leadPublicId)];
      });

    /**
     * Cards are keyed on leadPublicId, never on a synthetic per-arrival id. A reopened lead
     * re-broadcasts under the SAME event name as a new one, so a synthetic key would stack a second
     * card for a lead already on screen.
     */
    const cardUpsert = (alert, kind) =>
      setCards((prev) => {
        const at = prev.findIndex((c) => c.leadPublicId === alert.leadPublicId);
        const card = {
          ...(at >= 0 ? prev[at] : null),
          ...alert,
          kind,
          // A reopen is a manager correcting a mis-click, not a new opportunity: it must not chime.
          silent: kind === "reopened",
          // Bumped so the host knows to restart this card's timer even though the key is unchanged.
          arrivedAt: Date.now(),
          // The card ticks its own countdown down from this instant, exactly like a row. Without it
          // the elapsed term is always zero and the card's clock is frozen at the server value.
          receivedAt: Date.now(),
        };
        if (at < 0) return [...prev, card];
        const next = prev.slice();
        next[at] = card;
        return next;
      });

    const cardRemove = (publicId) =>
      setCards((prev) => prev.filter((c) => c.leadPublicId !== publicId));

    // Receiving anything at all is proof the stream is live. Needed as well as onOpen because a
    // reconnect that the browser handles internally does not always surface an open event.
    const alive = () => setConnected(true);

    const sub = notificationService.subscribeToSSE({
      onOpen: () => {
        setConnected(true);
        // Backfill after a RECONNECT. Events in the gap are gone for good — no id, no replay, no
        // server buffer — so the feed endpoint is the only way back to the truth. Skipped on the
        // very first open, where the mount effect has already fetched and this would just be a
        // second identical 200-row GET a moment later.
        if (openedBefore.current) refresh();
        openedBefore.current = true;
      },

      leadAlert: (alert) => {
        alive();
        // actorName is null on creation and set to the reopening manager on a reopen — the only way
        // to tell the two apart, since they share an event name. LeadAlertDto carries no
        // firstResponseSeconds and no reopened flag, so this is stamped onto the row here or the
        // row can never know. It does not survive the 45s resync; that is the honest limit.
        const reopened = !!alert.actorName;
        publishLeadStateChanged(alert);
        upsertLead(reopened ? { ...alert, reopened: true } : alert, "front");
        cardUpsert(alert, reopened ? "reopened" : "new");
        // Re-read rather than increment: the tiles include SLA maths (breaches accrue with elapsed
        // time), and a client-side counter would drift from the server within a minute.
        refreshStatsRef.current();
      },

      leadClaimed: (alert) => {
        alive();
        publishLeadStateChanged(alert);
        upsertLead(alert, "inplace");
        setCards((prev) => {
          const at = prev.findIndex((c) => c.leadPublicId === alert.leadPublicId);
          // Never INSERT on a claim — only a broadcast of a new lead may open a card.
          if (at < 0) return prev;
          // My own other tab won it. Nothing left to offer here.
          if (isMineRef.current(alert)) return prev.filter((_, i) => i !== at);
          const next = prev.slice();
          // The lead is still open: keep the card, re-arm it with the bumped version, and shorten
          // its life — the opportunity is now materially worse than it was a second ago.
          // arrivedAt is bumped so the host reschedules against the SHORTER window; leaving it
          // would drain the progress bar to zero while the old 10s dismissal timer still ran.
          next[at] = {
            ...next[at],
            ...alert,
            shorten: true,
            arrivedAt: Date.now(),
            receivedAt: Date.now(),
          };
          return next;
        });
      },

      leadLocked: (alert) => {
        alive();
        publishLeadStateChanged(alert);
        upsertLead(alert, "inplace");
        cardRemove(alert.leadPublicId);
        refreshStatsRef.current();
      },

      onError: () => setConnected(false),
    });

    return () => {
      sub.close();
      setConnected(false);
    };
    // `refresh` is stable (useCallback on canSee) so this cannot churn the subscription.
  }, [canSee, refresh]);

  /* ── SLA countdown ─────────────────────────────────────────────────────── */

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      // Nothing on a hidden tab needs a countdown, and browsers throttle the interval anyway.
      if (document.visibilityState === "visible") setTick((t) => t + 1);
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  /**
   * Re-read after a long hide. `slaSecondsRemaining` is only true at the instant of receipt and the
   * payload carries no server timestamp to re-base it against, so after a laptop sleep every
   * countdown on screen is silently wrong until the server recomputes it.
   */
  const hiddenSince = useRef(null);
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenSince.current = Date.now();
        return;
      }
      const away = hiddenSince.current ? Date.now() - hiddenSince.current : 0;
      hiddenSince.current = null;
      if (away > STALE_HIDDEN_MS) refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [refresh]);

  // Recomputed on every tick. Elapsed time is measured from `receivedAt` rather than counted down
  // step by step, so a backgrounded tab (where intervals are throttled) catches up correctly instead
  // of falling behind by however long it was hidden.
  const leadsWithCountdown = leads.map((l) => ({
    ...l,
    secondsLeft:
      l.slaSecondsRemaining == null
        ? null
        : Math.round(l.slaSecondsRemaining - (Date.now() - (l.receivedAt ?? Date.now())) / 1000),
  }));

  /* ── Local updates, so a click feels instant ───────────────────────────── */

  const applyResult = useCallback((result) => {
    if (!result?.leadPublicId) return;
    // The SSE broadcast normally follows this response, but publishing the committed result here
    // keeps All Leads in sync even while this tab's stream is reconnecting.
    publishLeadStateChanged(result);
    setLeads((prev) => {
      const at = prev.findIndex((l) => l.leadPublicId === result.leadPublicId);
      if (!result.openToClaim) return at >= 0 ? prev.filter((_, i) => i !== at) : prev;

      // ABSENT means a lead-locked broadcast (or the 45s resync) already removed this row — the
      // server has newer knowledge than this in-flight response. Re-inserting it would resurrect a
      // contacted lead as an open, claimable row with a running countdown that nobody can win.
      if (at < 0) return prev;

      const existing = prev[at];
      // Same staleness rule the SSE path uses: a response that commits before an event we have
      // already applied must not roll the row backwards.
      if (isStaleEvent(existing, result)) return prev;

      // Merge, never replace: the action response is a LeadClaimResultDto, which deliberately
      // carries less than a LeadAlertDto (no phone, no source, no pax). Replacing the row with it
      // would blank half the row until the next refresh — and there is no createdAt on it either,
      // so the countdown would lose its origin.
      const next = prev.slice();
      next[at] = { ...existing, ...result, receivedAt: existing.receivedAt ?? Date.now() };
      return next;
    });
    setCards((prev) => prev.filter((c) => c.leadPublicId !== result.leadPublicId));
  }, []);

  /**
   * Merge a few fields into one row without touching the rest.
   *
   * The reason this exists: a lost race answers with the FRESH claimVersion, and re-arming the
   * button with it is the whole point of the server's compare-and-swap. Re-fetching the feed instead
   * costs a round trip and re-enters the race late.
   */
  const patchLead = useCallback((publicId, patch) => {
    const apply = (prev) => {
      const at = prev.findIndex((x) => x.leadPublicId === publicId);
      if (at < 0) return prev;
      const next = prev.slice();
      next[at] = { ...next[at], ...patch };
      return next;
    };
    setLeads(apply);
    // Cards too, or a re-arm after a lost race never reaches the popup: the alert host reads
    // claimVersion off the CARD, so patching only the row leaves Alt+C posting the same stale
    // version forever — the exact dead-button state the compare-and-swap retry exists to avoid.
    setCards(apply);
  }, []);

  /** Remove a row locally — a lead that has been contacted, gone terminal, or 404'd. */
  const dropLead = useCallback((publicId) => {
    setLeads((prev) => prev.filter((l) => l.leadPublicId !== publicId));
    setCards((prev) => prev.filter((c) => c.leadPublicId !== publicId));
  }, []);

  const dismissCard = useCallback((publicId) => {
    setCards((prev) => prev.filter((c) => c.leadPublicId !== publicId));
  }, []);

  const value = {
    leads: leadsWithCountdown,
    stats,
    loading,
    connected,
    cards,
    refresh,
    refreshStats,
    applyResult,
    patchLead,
    dropLead,
    dismissCard,
    isMine,
    claimIneligible,
    markClaimIneligible,
    canSee,
    canClaim: canClaim && !claimIneligible,
    canContact: hasPermission(P.LEAD_UPDATE),
    canReassign: hasPermission(P.LEAD_REASSIGN_LOCKED),
  };

  return <LeadAlertContext.Provider value={value}>{children}</LeadAlertContext.Provider>;
}

/**
 * Read the live claim-window state.
 *
 * Returns null when no provider is mounted rather than throwing: the alert host renders on every
 * page, and a hook that threw outside the provider would take the whole app to RouteErrorBoundary
 * over a missing popup.
 */
export function useLeadAlerts() {
  return useContext(LeadAlertContext);
}

export default useLeadAlerts;
