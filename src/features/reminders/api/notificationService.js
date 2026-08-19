// // src/services/notificationService.js
// // Connects to NotificationController REST endpoints + SSE stream

// const BASE = '/api/notifications';

// const authHeaders = () => ({
//   'Content-Type': 'application/json',
//   Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
// });

// const notificationService = {

//   // ── Fetch paginated notifications ────────────────────────────────────────
//   async getNotifications({ page = 0, size = 20 } = {}) {
//     const res = await fetch(`${BASE}?page=${page}&size=${size}`, {
//       headers: authHeaders(),
//     });
//     if (!res.ok) throw new Error('Failed to fetch notifications');
//     return res.json(); // PagedApiResponse<NotificationDTO>
//   },

//   // ── Unread count for bell badge ──────────────────────────────────────────
//   async getUnreadCount() {
//     try {
//       const res = await fetch(`${BASE}/unread-count`, { headers: authHeaders() });
//       if (!res.ok) return 0;
//       const data = await res.json();
//       return data.count ?? 0;
//     } catch {
//       return 0;
//     }
//   },

//   // ── Mark single notification as read ────────────────────────────────────
//   async markRead(publicId) {
//     await fetch(`${BASE}/${publicId}/read`, {
//       method: 'PUT',
//       headers: authHeaders(),
//     });
//   },

//   // ── Mark all as read ────────────────────────────────────────────────────
//   async markAllRead() {
//     await fetch(`${BASE}/mark-all-read`, {
//       method: 'PUT',
//       headers: authHeaders(),
//     });
//   },

//   // ── SSE: live push from server ───────────────────────────────────────────
//   // EventSource can't set Authorization header, so token is passed as query param.
//   // Backend validates it in a HandlerInterceptor before upgrading to SSE.
//   subscribeToSSE(onNotification, onError) {
//     const token = localStorage.getItem('accessToken');
//     const url   = `${BASE}/stream?token=${encodeURIComponent(token)}`;
//     const es    = new EventSource(url);

//     es.onmessage = (e) => {
//       try {
//         const notification = JSON.parse(e.data);
//         onNotification(notification);
//       } catch (err) {
//         console.error('[SSE] Parse error:', err);
//       }
//     };

//     es.onerror = (err) => {
//       console.warn('[SSE] Connection error — browser will auto-reconnect');
//       onError?.(err);
//     };

//     return es; // caller must call es.close() on unmount
//   },
// };

// export default notificationService;












// src/services/notificationService.js
// Connects to NotificationController REST endpoints + SSE stream

// Built off VITE_API_URL (which already ends in /api), same convention as
// shared/api/http.js. This was a bare relative '/api/notifications', which only
// resolves when the API shares an origin with the SPA. On a split-origin deploy
// (SPA on crm.*, API on api.*) it hit nginx's SPA root, got index.html back, and
// killed both the bell and the SSE stream below.
const BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:8080/api'}/notifications`;

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

const notificationService = {

  // ── Fetch paginated notifications ────────────────────────────────────────
  // Backend returns PagedApiResponse: { data: [...], pagination: {...} }
  // Navbar reads result.content so we normalise to { content: [...] }
  async getNotifications({ page = 0, size = 20 } = {}) {
    const res = await fetch(`${BASE}?page=${page}&size=${size}`, {
      headers: authHeaders(),
    });
    // Messages thrown from here reach the user verbatim (see shared/api/apiError.js), so they read
    // like copy rather than like a log line. The status goes to the console, not the toast.
    if (!res.ok) {
      console.warn(`GET ${BASE} failed with ${res.status}`);
      throw new Error("Couldn't load notifications.");
    }
    const body = await res.json();
    return { content: body.data ?? [] };
  },

  // ── Unread count for bell badge ──────────────────────────────────────────
  // Backend returns ApiResponse<Map>: { data: { count: N } }
  async getUnreadCount() {
    try {
      const res = await fetch(`${BASE}/unread-count`, { headers: authHeaders() });
      if (!res.ok) return 0;
      const body = await res.json();
      return body.data?.count ?? 0;
    } catch {
      return 0;
    }
  },

  // ── Mark single notification as read ────────────────────────────────────
  // `fetch` does NOT reject on 4xx/5xx — it only rejects on a transport failure. Without an
  // explicit res.ok check these two resolved successfully against a 401 or a 500, so the bell
  // cleared locally while the server never recorded the read, and the count came back on refresh.
  async markRead(publicId) {
    const res = await fetch(`${BASE}/${publicId}/read`, {
      method: 'PUT',
      headers: authHeaders(),
    });
    if (!res.ok) {
      console.warn(`PUT ${BASE}/${publicId}/read failed with ${res.status}`);
      throw new Error("Couldn't mark that notification as read.");
    }
  },

  // ── Mark all as read ────────────────────────────────────────────────────
  async markAllRead() {
    const res = await fetch(`${BASE}/mark-all-read`, {
      method: 'PUT',
      headers: authHeaders(),
    });
    if (!res.ok) {
      console.warn(`PUT ${BASE}/mark-all-read failed with ${res.status}`);
      throw new Error("Couldn't mark notifications as read.");
    }
  },

  // ── Delete one / clear all ──────────────────────────────────────────────
  // The Notifications page previously faked both: it dropped the row from local state and
  // reported success without calling anything, so everything came back on refresh. These assume
  // the conventional REST shape (DELETE on the item and on the collection). If the backend names
  // them differently the call 4xxs, the caller restores the rows and surfaces the error — a
  // visible failure, which is what the silent local-only delete was hiding.
  async remove(publicId) {
    const res = await fetch(`${BASE}/${publicId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!res.ok) {
      console.warn(`DELETE ${BASE}/${publicId} failed with ${res.status}`);
      throw new Error("Couldn't delete that notification.");
    }
  },

  async clearAll() {
    const res = await fetch(BASE, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!res.ok) {
      console.warn(`DELETE ${BASE} failed with ${res.status}`);
      throw new Error("Couldn't clear notifications.");
    }
  },

  // ── SSE: live push from server ───────────────────────────────────────────
  // EventSource can't set an Authorization header, so the JWT is passed as a query
  // param. The token is embedded in the URL, so the browser's built-in auto-reconnect
  // would reuse a STALE token forever (→ endless 401s after it expires). Instead we
  // self-manage reconnection: on a permanently-closed connection we rebuild the
  // EventSource with a FRESH token read from storage, and back off between attempts.
  // Returns a handle with the same { close() } contract the caller already relies on.
  //
  // TWO CALLING SHAPES, one connection:
  //   subscribeToSSE(fn, onError)                       — the original: fn gets "notification"
  //   subscribeToSSE({ notification, leadAlert, ... })  — one handler per named server event
  //
  // The map form exists because the lead claim window pushes three more named events on this SAME
  // stream. A second EventSource for them would double every tab's open connection AND duplicate
  // the stale-token reconnect logic below — the one genuinely subtle piece of this file, and the
  // one that must not exist in two copies drifting apart.
  //
  // The function form keeps working because Navbar.jsx calls it that way; changing that signature
  // would be a silent runtime break, not a compile error.
  subscribeToSSE(onNotification, onError) {
    // Normalise both shapes into one handler map. Unknown keys are simply never subscribed, so a
    // caller asking for an event this server version doesn't send degrades to silence, not a crash.
    const handlers =
      typeof onNotification === 'function' || onNotification == null
        ? { notification: onNotification }
        : onNotification;
    let onOpen = null;
    if (typeof onNotification !== 'function' && onNotification != null) {
      // Map form: the 2nd arg is still the error callback, but allow it on the map too.
      onError = onNotification.onError ?? onError;
      // onOpen exists because onError alone cannot describe the connection. A subscriber that only
      // hears about failures can flip itself to "offline" and has no signal to flip back, so one
      // transient blip pins it there for the rest of the session — and it also has no moment at
      // which to backfill the events the gap swallowed (this stream has no Last-Event-ID replay).
      onOpen = onNotification.onOpen ?? null;
    }

    // Server event name → handler key. The server names are the contract (LeadAlertEvent.java);
    // the camelCase keys are what reads well at the call site.
    const EVENT_MAP = {
      notification: 'notification',
      'lead-alert': 'leadAlert',
      'lead-claimed': 'leadClaimed',
      'lead-locked': 'leadLocked',
      // The operations board. Both carry { bookingPublicId, checkpointPublicId, rowVersion } —
      // a ping, not the row: the stream is tenant-wide and filters nothing, so it must never
      // carry data the receiving user may not be allowed to see. A subscriber re-fetches.
      'ops-checkpoint': 'opsCheckpoint',
      'ops-record': 'opsRecord',
    };

    let es = null;
    let stopped = false;
    let retryTimer = null;
    let backoff = 3000;              // 3s, doubles each failure, capped
    const MAX_BACKOFF = 30000;

    const cleanup = () => {
      if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
      if (es) { try { es.close(); } catch { /* noop */ } es = null; }
    };

    const scheduleReconnect = () => {
      if (stopped || retryTimer) return;
      // Logged out — nothing to reconnect with; stop cleanly.
      if (!localStorage.getItem('token')) { cleanup(); return; }
      retryTimer = setTimeout(() => { retryTimer = null; connect(); }, backoff);
      backoff = Math.min(backoff * 2, MAX_BACKOFF);
    };

    const connect = () => {
      if (stopped) return;
      const token = localStorage.getItem('token');
      if (!token) { cleanup(); return; }   // not logged in — don't open a socket

      if (es) { try { es.close(); } catch { /* noop */ } }
      es = new EventSource(`${BASE}/stream?token=${encodeURIComponent(token)}`);

      // Backend sends named events: SseEmitter.event().name("notification").data(...)
      // Named SSE events do NOT fire onmessage — must use addEventListener.
      for (const [serverEvent, key] of Object.entries(EVENT_MAP)) {
        const handler = handlers?.[key];
        if (typeof handler !== 'function') continue;   // not subscribed — don't attach a listener
        es.addEventListener(serverEvent, (e) => {
          let payload;
          try {
            payload = JSON.parse(e.data);
          } catch (err) {
            console.error(`[SSE] Parse error on '${serverEvent}':`, err);
            return;
          }
          // The handler runs OUTSIDE the parse try/catch on purpose: a render error thrown by a
          // subscriber must not be swallowed and mislabelled as a malformed server payload.
          handler(payload);
        });
      }

      es.onopen = () => {
        backoff = 3000;                       // reset backoff once connected
        try { onOpen?.(); } catch (err) { console.error('[SSE] onOpen handler threw:', err); }
      };

      es.onerror = (err) => {
        onError?.(err);
        // Transient blip → readyState CONNECTING; let the browser retry (token still valid).
        // Permanently CLOSED (e.g. a 401 from an expired token) → the browser won't recover
        // with the stale URL token, so reconnect ourselves with a fresh one.
        if (es && es.readyState === EventSource.CLOSED) {
          console.warn('[SSE] Connection closed — reconnecting with a fresh token');
          scheduleReconnect();
        }
      };
    };

    connect();

    return {
      close() { stopped = true; cleanup(); },
    };
  },
};

export default notificationService;