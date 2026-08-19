// src/features/profile/api/googleReviewsService.js
//
// Google Business Profile reviews — the frontend half of the contract.
//
// ═══ WHY EVERY CALL GOES THROUGH OUR OWN BACKEND ═══════════════════════════════════════════════
// None of this can talk to Google from the browser, and that is not a style preference:
//
//   1. The Business Profile API sends no CORS headers. A fetch from the SPA fails before it starts.
//   2. Replying to a review needs an OAuth access token minted from a REFRESH token, and a refresh
//      token is a long-lived credential to the company's Google account. Anything in frontend code
//      — env var, build constant, "hidden" field — is readable by anyone who opens DevTools.
//   3. Access to the API is granted per Google Cloud project after a manual review by Google. The
//      grant belongs to the server, not to a browser session.
//
// So the server holds the tokens, calls Google, and exposes the plain REST below. If any endpoint
// here is missing, the tab renders its "not connected" state rather than erroring — see
// GoogleReviewsTab.
//
// ═══ WHAT THE BACKEND HAS TO BUILD ═════════════════════════════════════════════════════════════
// Google side, once per deployment:
//   • A Google Cloud project with the **Business Profile API** enabled.
//   • An approved access request — https://developers.google.com/my-business/content/prereqs
//     Google reviews these by hand; budget days to weeks. Nothing below works until it lands.
//   • An OAuth 2.0 client (Web application) with scope
//     https://www.googleapis.com/auth/business.manage, requested with access_type=offline so a
//     refresh token comes back.
//
// Server side, per tenant:
//   • Store { refreshToken, accountName, locationName } against the company. The refresh token is a
//     credential — encrypt it at rest, never return it to the client, and never log it.
//   • `locationName` is Google's own identifier, shaped "locations/1234567890123456789". It is what
//     every reviews call is keyed on, so it must be captured at connect time.
//   • Exchange the refresh token for an access token per call (they expire in ~1h) and cache it.
//
// ═══ RATE LIMITS AND CACHING ═══════════════════════════════════════════════════════════════════
// The Business Profile API is metered per project and the default quota is small — a page that
// re-fetches on every mount will exhaust it. The server should cache the review list per location
// (a few minutes is plenty; reviews do not arrive by the second) and serve the cache to this page,
// refreshing on the explicit `sync` call below.

import API from "@shared/api/http";

/* Pagination.
   CORRECTED — this previously said the server passes Google's own nextPageToken through. It cannot.
   Google's reviews.list supports neither the filters this UI offers (UNREPLIED / REPLIED, by star)
   nor its sorts (OLDEST, LOWEST), so a Google cursor cannot describe "page 2 of the 1-star
   unreplied reviews, oldest first". The list is served from the server's own cache and the cursor
   is SERVER-MINTED — see the `list` contract below. The field keeps the name `nextPageToken` only
   because the UI treats it as an opaque string; nothing about it is Google's.
   20 keeps the first paint quick — the list is scrolled, not read whole. */
export const REVIEWS_PAGE_SIZE = 20;

export const googleReviewsService = {
  /* ── GET /api/company/google-reviews/connection ──────────────────────────────────────────────
     The only call the tab makes before anything else, and it must NOT 404 when nothing is set up —
     "not connected" is a normal state, not an error.

     → { status: "CONNECTED" | "NOT_CONNECTED" | "NEEDS_RECONNECT",
         connected: boolean,
         locationName: string|null,     // "locations/123…" — Google's id
         businessName: string|null,     // "Nepal Tours and Travels", for the header
         profileUrl:   string|null,     // the public Maps page, for "View on Google"
         reviewUrl:    string|null,     // the short "leave a review" link (g.page/r/…/review)
         lastSyncedAt: ISO string|null }

     ── status vs connected ──────────────────────────────────────────────────────────────────────
     NEEDS_RECONNECT is the single most common real-world failure of this integration and it needs
     its own state. A refresh token dies for reasons nobody on this screen did: the owner revoked
     access in their Google account, the password changed, the Google user lost admin on the
     Location, or the token went unused past Google's inactivity window. The stored row still LOOKS
     connected — there is a locationName and a businessName — but every call to Google 401s.

     Rendered as the first-time connect panel it reads as "we never set this up", which is wrong and
     sends the user hunting for a setting they already configured. Rendered as an error toast it is
     transient and unactionable. It gets its own panel and its own verb: Reconnect.

     `connected` is FALSE when status is NEEDS_RECONNECT. It is kept only so a consumer that reads
     the boolean alone still behaves safely, and "safely" means treating a dead token as unusable —
     every Google-backed call will fail. The tab branches on `status` first and falls back to
     `connected` when an older server omits it.

     ── profileUrl and reviewUrl ─────────────────────────────────────────────────────────────────
     BOTH are captured at CONNECT time from the Location resource and stored — they are not derived
     here and not fetched per page load. `profileUrl` is the public Maps listing; `reviewUrl` is the
     short "write a review" link Google exposes on the Location (the g.page/r/…/review form). The
     UI surfaces reviewUrl as a copy-to-clipboard action so an agent can send it to a customer after
     a trip, which is the whole reason a travel CRM wants it. */
  getConnection: () => API.get("/company/google-reviews/connection"),

  /* ── POST /api/company/google-reviews/connect ────────────────────────────────────────────────
     Starts OAuth. The server builds Google's consent URL (it owns the client id, the redirect URI
     and the state nonce) and returns it; the browser then leaves the SPA for Google.

     → { authUrl: string }

     Google redirects back to a SERVER route, which exchanges the code for a refresh token and then
     bounces the browser to one of exactly two URLs. The code must never reach this app.

       success →  /CompanyProfile?tab=reviews&googleConnected=1
       failure →  /CompanyProfile?tab=reviews&googleError=<reason>

     `tab=reviews` is load-bearing: without it the user lands on Company Details having just
     completed a Google consent flow, with nothing on screen acknowledging it. CompanyProfile reads
     both params, toasts, and strips them from the URL so a refresh does not replay the message.

     Reasons the tab has copy for: `access_denied` and `app_not_approved`. Anything else falls back
     to a generic message, so the server is free to add reasons without a frontend change.

     ⚠ A CAVEAT THE BACKEND AUTHOR MUST KNOW — while the OAuth app is in Testing status, a Google
     account that is NOT on the whitelist never reaches your redirect_uri at all. Google renders its
     own terminal error page and the flow ends there, so no `googleError=app_not_approved` is ever
     delivered for the commonest instance of that failure. The handler exists for the cases Google
     does redirect; the real mitigation is the pre-flight warning on the connect panel. Do not spend
     time trying to make Google deliver that callback — it will not. */
  connect: () => API.post("/company/google-reviews/connect"),

  /** DELETE — forget the stored tokens and location for this company. */
  disconnect: () => API.delete("/company/google-reviews/connection"),

  /* ── GET /api/company/google-reviews/summary ─────────────────────────────────────────────────
     The header figures. Google returns the star histogram already aggregated, so this is a cheap
     call the page can make independently of the (paged) list.

     → { averageRating: number,        // 4.6
         totalReviews:  number,        // 318
         distribution:  { 1: n, 2: n, 3: n, 4: n, 5: n },
         unrepliedCount: number } */
  getSummary: () => API.get("/company/google-reviews/summary"),

  /* ── GET /api/company/google-reviews ─────────────────────────────────────────────────────────
     params: { pageToken?, pageSize?, filter?: "ALL"|"UNREPLIED"|"REPLIED", rating?: 1..5,
               sort?: "NEWEST"|"OLDEST"|"HIGHEST"|"LOWEST" }

     → { reviews: [{
           reviewId:     string,       // Google's, and the key for replying
           reviewerName: string,
           reviewerPhotoUrl: string|null,
           starRating:   1..5,         // Google sends "FIVE" — the SERVER maps it to a number, so
                                       // the UI never has to know that enum
           comment:      string|null,  // a rating with no text is normal
           createTime:   ISO string,
           updateTime:   ISO string,
           reply: { comment: string, updateTime: ISO string } | null
         }],
         nextPageToken: string|null }

     ── THE LIST IS SERVED FROM THE SERVER'S CACHE, NOT PROXIED TO GOOGLE ────────────────────────
     CORRECTED — an earlier draft of this file said the server passes Google's nextPageToken
     through. It cannot, and building it that way would fail as soon as any filter is used:

       • Google's reviews.list has NO filter parameter. UNREPLIED / REPLIED and "only 1-star" have
         to be applied by us, over the full set.
       • Its only ordering options are by rating and by update time; OLDEST and LOWEST are not
         among them.
       • A Google page token encodes a position in GOOGLE's unfiltered, Google-ordered sequence. It
         is meaningless as a cursor into a differently-filtered, differently-sorted list, and
         handing one back would silently return the wrong page.

     So: the server syncs the full review set into its own store (see `sync`), applies filter, star
     and sort itself, pages the result, and mints its OWN opaque cursor. The field keeps the name
     `nextPageToken` purely so the UI needs no change — the tab treats it as an opaque string, never
     parses it, and only asks "is it null". Encode whatever you like in it; sign it if you prefer.

     This is also what keeps the feature inside Google's quota: browsing and filtering hit our
     database, and Google is only called on an explicit sync. */
  list: (params = {}) =>
    API.get("/company/google-reviews", {
      params: { pageSize: REVIEWS_PAGE_SIZE, ...params },
    }),

  /* ── PUT /api/company/google-reviews/{reviewId}/reply ────────────────────────────────────────
     Google's own call is a PUT and it UPSERTS: sending it again replaces the existing reply rather
     than adding a second one. The UI relies on that for "Edit reply".

     body: { comment: string }   → the updated review row
     Google rejects a reply over 4096 characters; the composer enforces the same limit. */
  reply: (reviewId, comment) =>
    API.put(`/company/google-reviews/${encodeURIComponent(reviewId)}/reply`, { comment }),

  /** DELETE the reply, leaving the review itself untouched. */
  deleteReply: (reviewId) =>
    API.delete(`/company/google-reviews/${encodeURIComponent(reviewId)}/reply`),

  /* ── POST /api/company/google-reviews/{reviewId}/ai-draft ────────────────────────────────────
     Drafts a reply. NOT sent to Google — it comes back into the composer for a human to read,
     edit and post, because an unreviewed automated reply to a 1-star review is a public mistake.

     → { comment: string }

     This is the one call that costs AI credits, which is why it is explicit rather than something
     that happens when a review scrolls into view. */
  draftReply: (reviewId, tone = "professional") =>
    API.post(`/company/google-reviews/${encodeURIComponent(reviewId)}/ai-draft`, { tone }),

  /* ── POST /api/company/google-reviews/sync ───────────────────────────────────────────────────
     Force a refresh of the server's cache from Google. Bound to an explicit button: on a metered
     quota, a page that syncs on mount is a page that stops working by mid-afternoon.

     → { syncedCount:  number,        // reviews examined in this run
         newCount:     number,        // not previously in our store
         updatedCount: number,        // existing rows whose text, rating or reply changed
         lastSyncedAt: ISO string }

     The response is not optional. Pulling ~300 reviews takes 20-30 seconds, and a spinner that
     resolves into "Reviews refreshed" tells the user nothing they could not have assumed — they
     waited half a minute to learn something happened. `newCount` is what they actually want to
     know, and it is what the success toast reports. This is the whole reason the endpoint returns
     a body rather than a 204. */
  sync: () => API.post("/company/google-reviews/sync"),
};

export default googleReviewsService;
