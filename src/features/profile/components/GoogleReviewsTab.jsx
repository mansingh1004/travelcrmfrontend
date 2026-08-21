// src/features/profile/components/GoogleReviewsTab.jsx
//
// The Google Reviews manager: connection state, rating summary, the review list, and replying.
//
// Self-contained by design — it owns its own data fetching and renders inside CompanyProfile as one
// more tab. Nothing outside the profile feature is touched, and if the backend endpoints do not
// exist yet the tab shows its "not connected" panel instead of erroring (see loadAll).

// useCallback went with loadAll — the two effects hold their fetch logic inline now.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Star, RefreshCw, ExternalLink, MessageSquare, Sparkles, Link2, Unplug,
  Check, X, Loader2, TriangleAlert, Pencil, Trash2, Copy, RotateCw, ShieldAlert,
} from "lucide-react";

import { getErrorMessage } from "@shared/api/apiError";
import googleReviewsService, { REVIEWS_PAGE_SIZE } from "../api/googleReviewsService";

/* Google's own cap. A reply longer than this is rejected by the API, so the composer stops at the
   same number rather than letting someone write 5,000 characters and lose them to a 400. */
const REPLY_MAX = 4096;

const FILTERS = [
  { id: "ALL", label: "All" },
  { id: "UNREPLIED", label: "Unreplied" },
  { id: "REPLIED", label: "Replied" },
];

const SORTS = [
  { id: "NEWEST", label: "Newest first" },
  { id: "OLDEST", label: "Oldest first" },
  { id: "LOWEST", label: "Lowest rated" },
  { id: "HIGHEST", label: "Highest rated" },
];

const unwrap = (r) =>
  (r?.data && typeof r.data === "object" && "data" in r.data) ? r.data.data : r.data;

const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString();
};

/* Only http(s) reaches an href or a src.
   profileUrl, reviewUrl and reviewerPhotoUrl all arrive from the server and land straight in the
   DOM. A `javascript:` value in any of them is stored XSS — one bad row in our own database, or one
   unescaped passthrough of something Google returned, and a link becomes script execution. There is
   no legitimate case for any other scheme here, so anything else resolves to null and the element
   simply is not rendered. */
const safeUrl = (raw) => {
  const value = String(raw || "").trim();
  if (!value) return null;
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:" ? value : null;
  } catch {
    return null; // not a parseable absolute URL
  }
};

/* Connection status, normalised.
   `status` is the field the tab branches on, but a server that ships the boolean before the enum
   would leave it undefined and every branch would miss. Derive it from `connected` in that case so
   a partial backend still renders something correct. */
const statusOf = (conn) =>
  conn?.status || (conn?.connected ? "CONNECTED" : "NOT_CONNECTED");

/* ─── STARS ──────────────────────────────────────────────────────────────────────────────────── */
function Stars({ value = 0, size = "w-4 h-4" }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${size} ${i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-slate-200 fill-slate-200"}`}
        />
      ))}
    </span>
  );
}

/* ─── RATING HISTOGRAM ───────────────────────────────────────────────────────────────────────── */
function Distribution({ distribution = {}, total = 0 }) {
  return (
    <div className="space-y-1.5">
      {[5, 4, 3, 2, 1].map((star) => {
        const count = Number(distribution[star]) || 0;
        // Guard the divide: a brand-new listing has 0 ratings, and 0/0 renders a NaN-width bar.
        const pct = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={star} className="flex items-center gap-2.5">
            <span className="w-11 flex-shrink-0 text-xs font-semibold text-slate-500">{star} star</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-9 flex-shrink-0 text-right text-xs font-bold text-slate-600 tabular-nums">
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── REPLY COMPOSER ─────────────────────────────────────────────────────────────────────────── */
/* The text lives in the PARENT, not here.
   It has two writers — the person typing and the AI draft arriving from an async call — and a local
   copy would need an effect to sync the second one in, which is both a lint error
   (react-hooks/set-state-in-effect) and the classic way two copies of one value drift apart. One
   owner, passed down. */
function ReplyComposer({ review, text, onChange, onCancel, onPost, onDraft, posting, drafting }) {
  const ref = useRef(null);

  // Focus on open — the composer is opened by a deliberate click, so the caret belongs in it.
  useEffect(() => { ref.current?.focus(); }, []);

  const over = text.length > REPLY_MAX;

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <textarea
        ref={ref}
        rows={4}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Thank them by name, address the specifics, and keep it public-facing…"
        className={`w-full resize-y rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-all placeholder-slate-400
          ${over ? "border-red-300 focus:ring-2 focus:ring-red-50" : "border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-50"}`}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* AI drafts INTO the box — it never posts. An unreviewed automated reply to a 1-star
              review is a public mistake, and this is the screen where that would happen. */}
          <button
            type="button"
            onClick={() => onDraft(review)}
            disabled={drafting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-fuchsia-600 to-purple-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
          >
            {drafting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {drafting ? "Drafting…" : "Draft with AI"}
          </button>
          <span className={`text-[11px] font-semibold ${over ? "text-red-500" : "text-slate-400"}`}>
            {text.length.toLocaleString()} / {REPLY_MAX.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onPost(review, text.trim())}
            disabled={posting || over || !text.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
          >
            {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {review.reply ? "Update reply" : "Post reply"}
          </button>
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
        Posted publicly on Google under your business name, usually within a few minutes.
      </p>
    </div>
  );
}

/* ─── ONE REVIEW ─────────────────────────────────────────────────────────────────────────────── */
function ReviewRow({ review, open, replyText, onReplyChange, onOpen, onCancel, onPost, onDraft, onDeleteReply, posting, drafting }) {
  const initials = (review.reviewerName || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="border-b border-slate-100 py-4 last:border-0">
      <div className="flex items-start gap-3">
        {safeUrl(review.reviewerPhotoUrl) ? (
          <img
            src={safeUrl(review.reviewerPhotoUrl)}
            alt=""
            className="h-9 w-9 flex-shrink-0 rounded-full object-cover"
            /* Google's avatar URLs expire. A broken image icon beside every review looks like the
               page is failing, so a dead one is swapped for the initial fallback. */
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        ) : (
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
            {initials}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-800">{review.reviewerName || "Google user"}</p>
              <p className="text-[11px] text-slate-400">{fmtDate(review.createTime)}</p>
            </div>
            {review.reply ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                <Check className="h-3 w-3" /> Replied
              </span>
            ) : (
              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">
                Not replied
              </span>
            )}
          </div>

          <div className="mt-1 flex items-center gap-1.5">
            <Stars value={review.starRating} size="w-3.5 h-3.5" />
            <span className="text-xs font-bold text-slate-600">{review.starRating}</span>
          </div>

          {/* A star rating with no text is normal on Google and is not an error state. */}
          {review.comment ? (
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">{review.comment}</p>
          ) : (
            <p className="mt-2 text-sm italic text-slate-400">Rating only — no written review.</p>
          )}

          {review.reply && !open && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Your reply</p>
                <div className="flex items-center gap-1">
                  <button
                    type="button" onClick={() => onOpen(review)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-500 transition hover:bg-white hover:text-blue-600"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                  <button
                    type="button" onClick={() => onDeleteReply(review)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-400 transition hover:bg-white hover:text-red-500"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              </div>
              <p className="mt-1.5 whitespace-pre-line text-sm text-slate-600">{review.reply.comment}</p>
            </div>
          )}

          {open ? (
            <ReplyComposer
              review={review}
              text={replyText}
              onChange={onReplyChange}
              onCancel={onCancel}
              onPost={onPost}
              onDraft={onDraft}
              posting={posting}
              drafting={drafting}
            />
          ) : !review.reply && (
            <button
              type="button"
              onClick={() => onOpen(review)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:border-blue-300 hover:text-blue-600"
            >
              <MessageSquare className="h-3.5 w-3.5" /> Reply
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   TAB
══════════════════════════════════════════════════════════════════════════════════════════════ */
export default function GoogleReviewsTab({ showToast, canManage, SectionCard, onConnectionChange }) {
  const [connection, setConnection] = useState(null);
  const [summary, setSummary] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [nextPageToken, setNextPageToken] = useState(null);

  /* TWO loading flags, not one.
     They cover different requests with different triggers, and conflating them meant a filter click
     blanked the whole tab — header, rating, histogram and all — to re-render figures that had not
     changed. `connLoading` gates the tab (is there a connection at all); `listLoading` gates only
     the list body, so filtering now dims the results and leaves the summary in place. */
  const [connLoading, setConnLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  /* Distinguishes "the backend has not built this yet" from "Google said no". The first is the
     expected state during rollout and must not shout; the second is a real fault. */
  const [unavailable, setUnavailable] = useState(false);

  /* Bumped to force a connection + summary refetch. Those two do NOT depend on the filters, so
     they must not be wired to them — see the two effects below. */
  const [reloadKey, setReloadKey] = useState(0);

  const [filter, setFilter] = useState("ALL");
  const [rating, setRating] = useState(null);
  const [sort, setSort] = useState("NEWEST");

  const [openId, setOpenId] = useState(null);
  // The composer's text, owned here — see ReplyComposer for why it is not local to it.
  const [replyText, setReplyText] = useState("");
  const [posting, setPosting] = useState(false);
  /* Which review is drafting, not merely THAT one is. A shared boolean put every open composer's
     button into "Drafting…" at once, including rows the request had nothing to do with. */
  const [draftingId, setDraftingId] = useState(null);
  const [copied, setCopied] = useState(false);

  /* Two guards for one race — see handleDraft.
     `openIdRef` mirrors openId so an async resolve can read the CURRENT composer rather than the
     one captured in its closure at click time. `draftTicket` numbers the requests so a superseded
     one cannot write even if the composer never moved. */
  const openIdRef = useRef(null);
  const draftTicket = useRef(0);

  const openComposer = (review) => {
    openIdRef.current = review.reviewId;
    setOpenId(review.reviewId);
    // Seeds the box with the existing reply, so "Edit" starts from what is live on Google.
    setReplyText(review.reply?.comment || "");
  };

  const closeComposer = () => {
    openIdRef.current = null;
    setOpenId(null);
    setReplyText("");
  };

  /* Changing a filter is a USER EVENT, so the spinner is raised here rather than in the effect
     below. Setting it inside the effect would be a synchronous setState during render-commit —
     the cascading-render pattern react-hooks/set-state-in-effect exists to catch.

     The equality guard is what stops the tab hanging on a no-op click. Re-clicking the ALREADY
     ACTIVE filter pill called setFilter with the value it already held; React bails out of an
     identical state write, so `listParams` kept its identity, so the loader useCallback kept its
     identity, so the effect never re-ran — and nothing ever cleared the spinner this function had
     just raised. Only a genuinely different filter unstuck it.
     The star buttons never hit this (clicking the active star clears it to null, which IS a
     change) and neither does the <select> (a browser fires no change event for re-picking the
     same option), which is why the symptom looked specific to the pills.
     Returning early also spares a pointless refetch — on a metered Google quota that matters. */
  const applyView = (next) => {
    const changed =
      ("filter" in next && next.filter !== filter) ||
      ("rating" in next && next.rating !== rating) ||
      ("sort" in next && next.sort !== sort);
    if (!changed) return;

    setListLoading(true);
    if ("filter" in next) setFilter(next.filter);
    if ("rating" in next) setRating(next.rating);
    if ("sort" in next) setSort(next.sort);
  };

  const listParams = useMemo(
    () => ({ filter, sort, ...(rating ? { rating } : {}) }),
    [filter, sort, rating]
  );

  const status = statusOf(connection);
  const isConnected = status === "CONNECTED";

  /* ── EFFECT 1 — connection + summary ─────────────────────────────────────────────────────────
     Neither of these depends on filter, sort or star, so neither is wired to them. Previously all
     three reads lived in one function whose useCallback deps included listParams, so every pill
     click fired THREE requests where one was needed. That is not just waste: the Google Business
     Profile API is quota-metered per Google Cloud PROJECT, shared across every tenant on this
     deployment, and exhausting it returns 429s that present exactly like lost access. One agent
     clicking through filters could degrade the feature for all of them.

     Re-runs only on mount and when reloadKey is bumped — connect, disconnect, sync.

     Kicked off from a resolved promise rather than called straight from the effect body: these
     write state, and doing that in the synchronous part of an effect is the cascading render
     react-hooks/set-state-in-effect flags. The microtask puts every write after the commit.

     `alive` now guards the WRITES, not merely the start. Before, it only decided whether the load
     began; once begun, every setState after an await still ran against an unmounted component —
     which this tab does hit, because CompanyProfile unmounts it whenever another tab is chosen. */
  useEffect(() => {
    let alive = true;

    Promise.resolve().then(async () => {
      if (!alive) return;
      try {
        const conn = unwrap(await googleReviewsService.getConnection()) || {};
        if (!alive) return;
        setConnection(conn);
        setUnavailable(false);
        onConnectionChange?.(statusOf(conn) === "CONNECTED");

        if (statusOf(conn) !== "CONNECTED") {
          setSummary(null);
          setReviews([]);
          return;
        }

        const sum = unwrap(await googleReviewsService.getSummary());
        if (!alive) return;
        setSummary(sum || null);
      } catch (err) {
        if (!alive) return;
        const httpStatus = err?.response?.status;
        /* 404 / 501 mean the route is not deployed yet — that is the normal state until the backend
           ships, and an error toast on every visit would train people to ignore toasts. Show the
           connect panel with a quiet note instead. */
        if (httpStatus === 404 || httpStatus === 501) {
          setUnavailable(true);
          setConnection({ status: "NOT_CONNECTED", connected: false });
        } else {
          showToast(getErrorMessage(err, "Couldn't load Google reviews."), "error");
          setConnection({ status: "NOT_CONNECTED", connected: false });
        }
        onConnectionChange?.(false);
      } finally {
        if (alive) setConnLoading(false);
      }
    });

    return () => { alive = false; };
  }, [reloadKey, showToast, onConnectionChange]);

  /* ── EFFECT 2 — the review list ──────────────────────────────────────────────────────────────
     The only fetch that depends on the filters, and now the only one they trigger. Gated on
     `isConnected` so it does not fire against a server that has told us there is no connection —
     including the NEEDS_RECONNECT case, where every call would 401. */
  useEffect(() => {
    if (!isConnected) return undefined;
    let alive = true;

    Promise.resolve().then(async () => {
      if (!alive) return;
      try {
        const page = unwrap(await googleReviewsService.list(listParams)) || {};
        if (!alive) return;
        setReviews(Array.isArray(page.reviews) ? page.reviews : []);
        setNextPageToken(page.nextPageToken || null);
      } catch (err) {
        if (!alive) return;
        /* No unavailable/connection handling here — effect 1 owns that verdict. A list failure is
           a list failure; deciding "the feature does not exist" from it would race effect 1. */
        showToast(getErrorMessage(err, "Couldn't load reviews."), "error");
      } finally {
        if (alive) setListLoading(false);
      }
    });

    return () => { alive = false; };
  }, [isConnected, listParams, reloadKey, showToast]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { authUrl } = unwrap(await googleReviewsService.connect()) || {};
      if (!authUrl) throw new Error("No authorisation URL returned");
      /* A full page navigation, not a popup or an iframe: Google refuses to render its consent
         screen inside a frame, and popups are blocked often enough to look broken. The server
         redirects back to this page when the exchange is done. */
      window.location.href = authUrl;
    } catch (err) {
      setConnecting(false);
      showToast(getErrorMessage(err, "Couldn't start Google sign-in."), "error");
    }
  };

  const handleDisconnect = async () => {
    try {
      await googleReviewsService.disconnect();
      showToast("Google Business Profile disconnected.");
      setConnLoading(true);
      // Bumping the key re-runs effect 1, which re-runs effect 2 through isConnected.
      setReloadKey((k) => k + 1);
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't disconnect."), "error");
    }
  };

  /* Copy the "leave a review" link.
     The point of storing reviewUrl at all: after a trip, an agent sends the customer the link that
     opens Google's review box directly. Without this the link is a field in a database nobody can
     reach. The tick reverts on its own so the button does not sit lying about a copy from a minute
     ago. */
  const handleCopyReviewLink = async () => {
    const url = safeUrl(connection?.reviewUrl);
    if (!url) return;
    try {
      /* navigator.clipboard needs a SECURE CONTEXT. Production is HTTPS, but on a plain-http LAN
         dev host the whole object is undefined and this throws — hence the check and the fallback
         message rather than a silent dead button. */
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Couldn't copy automatically — the link is on the View on Google button.", "error");
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = unwrap(await googleReviewsService.sync()) || {};
      setConnLoading(true);
      setReloadKey((k) => k + 1);

      /* Report what actually changed. A 300-review sync takes 20-30 seconds, and resolving that
         wait into "Reviews refreshed" tells the user nothing they had not already assumed. The
         zero case gets its own sentence — "0 new" reads like a failure. */
      const { newCount, syncedCount } = result;
      if (typeof newCount === "number" && newCount > 0) {
        showToast(`${newCount} new review${newCount === 1 ? "" : "s"} from Google.`);
      } else if (typeof syncedCount === "number") {
        showToast(`Up to date — ${syncedCount.toLocaleString()} reviews checked, none new.`);
      } else {
        showToast("Reviews refreshed from Google.");
      }
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't refresh from Google."), "error");
    } finally {
      setSyncing(false);
    }
  };

  const handleLoadMore = async () => {
    if (!nextPageToken) return;
    setLoadingMore(true);
    try {
      const page = unwrap(await googleReviewsService.list({ ...listParams, pageToken: nextPageToken })) || {};
      setReviews((prev) => [...prev, ...(Array.isArray(page.reviews) ? page.reviews : [])]);
      setNextPageToken(page.nextPageToken || null);
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't load more reviews."), "error");
    } finally {
      setLoadingMore(false);
    }
  };

  /* An AI draft is a slow write into a box the user can move away from.
     `replyText` is ONE string shared by whichever composer is open, and this resolve used to write
     it unconditionally. So: draft review A, cancel while it is in flight, open review B, start
     typing your own reply — A's draft lands and destroys what you wrote, with no undo.

     Reading `openId` here would not help: this closure captured it at CLICK time, and the value
     that matters is the one at RESOLVE time. Hence the ref.

     Two guards, because they catch different races. The ticket rejects a superseded request even
     when the composer never moved (draft twice on one review). The openIdRef check rejects a
     request whose composer has since closed or changed — including cancel-then-reopen-the-same-one,
     which the ticket alone would let through. This mirrors the `alive` flag on the effects and the
     searchTicket idiom used elsewhere in this repo. */
  const handleDraft = async (review) => {
    const ticket = (draftTicket.current += 1);
    setDraftingId(review.reviewId);
    try {
      const { comment } = unwrap(await googleReviewsService.draftReply(review.reviewId)) || {};
      if (draftTicket.current !== ticket) return;              // a newer draft owns the box
      if (openIdRef.current !== review.reviewId) return;        // the box moved, or closed
      if (comment) setReplyText(comment);
    } catch (err) {
      if (draftTicket.current !== ticket) return;
      showToast(getErrorMessage(err, "Couldn't draft a reply."), "error");
    } finally {
      // Only the request that is still current may clear the flag, or a stale finally
      // re-enables the button under a draft that is genuinely still running.
      if (draftTicket.current === ticket) setDraftingId(null);
    }
  };

  const handlePost = async (review, comment) => {
    setPosting(true);
    try {
      await googleReviewsService.reply(review.reviewId, comment);
      /* Patch the row in place rather than refetching the whole list: a refetch would re-sort and
         re-page, and the review just replied to could jump off screen mid-scroll. */
      setReviews((prev) => prev.map((r) =>
        r.reviewId === review.reviewId
          ? { ...r, reply: { comment, updateTime: new Date().toISOString() } }
          : r
      ));
      setSummary((s) => (s && !review.reply
        ? { ...s, unrepliedCount: Math.max(0, (s.unrepliedCount || 0) - 1) }
        : s));
      closeComposer();
      showToast("Reply posted to Google.");
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't post the reply."), "error");
    } finally {
      setPosting(false);
    }
  };

  const handleDeleteReply = async (review) => {
    try {
      await googleReviewsService.deleteReply(review.reviewId);
      setReviews((prev) => prev.map((r) => (r.reviewId === review.reviewId ? { ...r, reply: null } : r)));
      setSummary((s) => (s ? { ...s, unrepliedCount: (s.unrepliedCount || 0) + 1 } : s));
      showToast("Reply removed.");
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't remove the reply."), "error");
    }
  };

  /* ── Loading ─────────────────────────────────────────────────────────────────────────────── */
  if (connLoading) {
    return (
      <SectionCard title="Google Reviews" icon={<Star className="h-4 w-4" />}>
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading reviews…
        </div>
      </SectionCard>
    );
  }

  /* ── Needs reconnect ─────────────────────────────────────────────────────────────────────── */
  /* Checked BEFORE the not-connected panel, and deliberately not folded into it. The stored
     connection is intact — there is a business name on file — but the refresh token is dead, which
     happens when the owner revokes access, changes their Google password, loses admin on the
     Location, or simply leaves it unused past Google's inactivity window. None of that is anything
     the person looking at this screen did.
     Showing the first-time panel here would say "connect your profile" to someone who already has,
     sending them to look for a setting that is already correct. The verb is Reconnect, the business
     name is shown so they can see WHICH account, and the copy names the likely cause. */
  if (status === "NEEDS_RECONNECT") {
    return (
      <SectionCard
        title="Google Reviews"
        icon={<Star className="h-4 w-4" />}
        subtitle={connection?.businessName || "Your Google Business Profile"}
      >
        <div className="py-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-lg shadow-rose-200/60">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h3 className="text-sm font-extrabold text-slate-800">Google access needs renewing</h3>
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-slate-500">
            {connection?.businessName
              ? <>The connection to <span className="font-semibold text-slate-700">{connection.businessName}</span> has expired.</>
              : "The connection to your Google Business Profile has expired."}
            {" "}This happens when access is revoked in Google, the account password changes, or the
            profile has not been used for a long time. Your reviews on Google are unaffected — only
            this CRM’s access to them.
          </p>
          <button
            type="button"
            onClick={handleConnect}
            disabled={!canManage || connecting}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
          >
            {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
            {connecting ? "Opening Google…" : "Reconnect Google"}
          </button>
          {!canManage && (
            <p className="mt-3 text-[11px] text-slate-400">
              Only a user with Settings Manage permission can reconnect this account.
            </p>
          )}
        </div>
      </SectionCard>
    );
  }

  /* ── Not connected ───────────────────────────────────────────────────────────────────────── */
  if (!isConnected) {
    return (
      <SectionCard
        title="Google Reviews"
        icon={<Star className="h-4 w-4" />}
        subtitle="See and reply to your Google Business Profile reviews here"
      >
        <div className="py-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-200/60">
            <Star className="h-7 w-7" />
          </div>
          <h3 className="text-sm font-extrabold text-slate-800">Connect your Google Business Profile</h3>
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-slate-500">
            Sign in with the Google account that manages your business listing. Your ratings and
            reviews appear here, and you can reply without leaving the CRM.
          </p>

          {unavailable ? (
            <div className="mx-auto mt-5 max-w-md rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-left">
              <p className="flex items-start gap-2 text-xs font-semibold text-amber-800">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                Not available on this server yet
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-amber-700">
                The Google Reviews endpoints aren’t deployed. This screen is ready and will start
                working as soon as they are — nothing here needs changing.
              </p>
            </div>
          ) : (
            <>
              {/* ── Pre-flight warning ──────────────────────────────────────────────────────────
                  This is not decoration; it is the ONLY protection against the commonest failure
                  of this integration. While the OAuth app is in Google's Testing status, an
                  account that has not been whitelisted does not get a consent screen — it gets a
                  raw Google error page, and never returns to this app at all. So no error handler
                  of ours can catch it and explain. Someone who hits that with no prior warning
                  concludes the CRM is broken.
                  Shown only when the endpoints exist: pairing it with the "not deployed yet" box
                  would give two contradictory explanations at once. */}
              <div className="mx-auto mt-5 max-w-md rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-left">
                <p className="flex items-start gap-2 text-xs font-bold text-amber-900">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  Before you click: your Google account must be approved first
                </p>
                <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-amber-800">
                  <li>
                    <span className="font-semibold">Send your Google email address to your
                    administrator</span> and wait for confirmation. Until it is added, Google shows
                    an error page instead of a sign-in screen — that is not a fault in this CRM.
                  </li>
                  <li>
                    This app is pending Google’s verification, so you will see an
                    <span className="font-semibold"> “Google hasn’t verified this app”</span> screen.
                    Choose <span className="font-semibold">Advanced → Continue</span> to proceed.
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={handleConnect}
                disabled={!canManage || connecting}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
              >
                {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                {connecting ? "Opening Google…" : "Connect Google"}
              </button>
            </>
          )}

          {!canManage && !unavailable && (
            <p className="mt-3 text-[11px] text-slate-400">
              Only a user with Settings Manage permission can connect an account.
            </p>
          )}
        </div>
      </SectionCard>
    );
  }

  /* ── Connected ───────────────────────────────────────────────────────────────────────────── */
  const avg = Number(summary?.averageRating) || 0;
  const total = Number(summary?.totalReviews) || 0;
  const unreplied = Number(summary?.unrepliedCount) || 0;

  return (
    <div className="space-y-5">
      <SectionCard
        title="Google Reviews"
        icon={<Star className="h-4 w-4" />}
        subtitle={connection.businessName || "Your Google Business Profile"}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
            <Check className="h-3 w-3" /> Connected
            {connection.lastSyncedAt && (
              <span className="font-medium text-emerald-600/70">· synced {fmtDate(connection.lastSyncedAt)}</span>
            )}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {/* Copy the review link — the reason reviewUrl is stored at all. After a trip an agent
                pastes this into WhatsApp and the customer lands straight in Google's review box.
                First action in the row because it is the one used repeatedly; the others are
                occasional. */}
            {safeUrl(connection.reviewUrl) && (
              <button
                type="button" onClick={handleCopyReviewLink}
                title={safeUrl(connection.reviewUrl)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  copied
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600"
                }`}
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Link copied" : "Copy review link"}
              </button>
            )}
            {safeUrl(connection.profileUrl) && (
              <a
                href={safeUrl(connection.profileUrl)} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-blue-300 hover:text-blue-600"
              >
                View on Google <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <button
              type="button" onClick={handleSync} disabled={syncing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-blue-300 hover:text-blue-600 disabled:opacity-60"
            >
              <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Refreshing…" : "Refresh"}
            </button>
            {canManage && (
              <button
                type="button" onClick={handleDisconnect}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-red-300 hover:text-red-500"
              >
                <Unplug className="h-3 w-3" /> Disconnect
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-[auto_minmax(0,1fr)]">
          <div className="flex flex-col items-center justify-center rounded-xl bg-slate-50 px-6 py-4 md:min-w-40">
            <span className="text-4xl font-extrabold leading-none text-slate-800">{avg.toFixed(1)}</span>
            <Stars value={avg} />
            <span className="mt-1.5 text-xs font-semibold text-slate-500">
              {total.toLocaleString()} rating{total === 1 ? "" : "s"}
            </span>
          </div>
          <Distribution distribution={summary?.distribution} total={total} />
        </div>

        {unreplied > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50/60 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <MessageSquare className="h-4 w-4 flex-shrink-0 text-rose-500" />
              <div>
                <p className="text-sm font-extrabold text-slate-800">{unreplied.toLocaleString()}</p>
                <p className="text-[11px] text-slate-500">Reviews not replied</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => applyView({ filter: "UNREPLIED", rating: null })}
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-rose-700"
            >
              Show unreplied
            </button>
          </div>
        )}
      </SectionCard>

      <SectionCard title={`Reviews${total ? ` (${total.toLocaleString()})` : ""}`} icon={<MessageSquare className="h-4 w-4" />}>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id} type="button" onClick={() => applyView({ filter: f.id })}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                filter === f.id ? "bg-blue-600 text-white shadow-sm" : "border border-slate-200 text-slate-600 hover:border-blue-300"
              }`}
            >
              {f.label}
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-slate-200" />
          {[5, 4, 3, 2, 1].map((r) => (
            <button
              key={r} type="button"
              // Clicking the active star clears it — otherwise a rating filter is a one-way door.
              onClick={() => applyView({ rating: rating === r ? null : r })}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                rating === r ? "bg-amber-400 text-white shadow-sm" : "border border-slate-200 text-slate-600 hover:border-amber-300"
              }`}
            >
              {r} <Star className={`h-3 w-3 ${rating === r ? "fill-white" : "fill-amber-400 text-amber-400"}`} />
            </button>
          ))}
          <select
            value={sort}
            onChange={(e) => applyView({ sort: e.target.value })}
            className="ml-auto rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 outline-none focus:border-blue-400"
          >
            {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>

        {(rating || filter !== "ALL") && (
          <button
            type="button"
            onClick={() => applyView({ filter: "ALL", rating: null })}
            className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 transition hover:text-slate-600"
          >
            <X className="h-3 w-3" /> Clear filters
          </button>
        )}

        {/* listLoading dims the rows rather than replacing them. Swapping in a spinner would drop
            the list height to nothing and bounce the page under the cursor on every filter click. */}
        {listLoading && reviews.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading reviews…
          </div>
        ) : reviews.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">
            No reviews match these filters.
          </p>
        ) : (
          <div className={listLoading ? "pointer-events-none opacity-50 transition-opacity" : "transition-opacity"}>
            {reviews.map((r) => (
              <ReviewRow
                key={r.reviewId}
                review={r}
                open={openId === r.reviewId}
                replyText={replyText}
                onReplyChange={setReplyText}
                onOpen={openComposer}
                onCancel={closeComposer}
                onPost={handlePost}
                onDraft={handleDraft}
                onDeleteReply={handleDeleteReply}
                posting={posting}
                // Only the row whose draft is actually running shows the spinner.
                drafting={draftingId === r.reviewId}
              />
            ))}
          </div>
        )}

        {nextPageToken && (
          <div className="pt-4 text-center">
            <button
              type="button" onClick={handleLoadMore} disabled={loadingMore}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 transition hover:border-blue-300 hover:text-blue-600 disabled:opacity-60"
            >
              {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {loadingMore ? "Loading…" : `Load ${REVIEWS_PAGE_SIZE} more`}
            </button>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
