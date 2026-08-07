// features/calendar/components/TripPicker.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Optional "link this task to a trip" control for AddEventModal.
//
// One link fills THREE All Tasks columns at once: TaskServiceImpl.applyReferences snapshots the
// booking's code, its guest name and the originating lead's source onto the task row at save time,
// so the grid renders "For (Trip#)", "Guest" and "Trip Source" with no join. Without a link those
// three columns are permanently "—" — which is what they were before this control existed, since
// nothing in the UI had ever sent bookingPublicId.
//
// Search goes to GET /api/bookings/search?keyword= and deliberately NOT to the paged list:
// GET /api/bookings accepts only page/size/sortBy/sortDir, so the `search` param that
// bookingService.list() sends is silently dropped by Spring and every keystroke would return the
// same newest-N rows. That endpoint is unbounded, so the result set is capped here.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X, Loader2, Ticket } from "lucide-react";
import { bookingService } from "@features/bookings";
import { isAlreadyReported } from "@shared/api/apiError";

const MAX_RESULTS = 20;
const RECENT_COUNT = 8;
const DEBOUNCE_MS = 300;
const MIN_CHARS = 2;

/** "TRP79799 · Amit Sharma" — what the task row will show once linked. */
export function tripLabel(code, guest) {
  return [code, guest].filter(Boolean).join(" · ");
}

/** Both endpoints wrap their payload the same way: ApiResponse.data / PagedApiResponse.data. */
const rows = (res) => (Array.isArray(res?.data?.data) ? res.data.data : []);

const shortDate = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString([], { day: "2-digit", month: "short", year: "2-digit" });
};

export default function TripPicker({ value, label, onChange, disabled = false }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  // Only the newest request may render — a slow 2-char search must not overwrite the 5-char
  // results that already came back. Same guard as usePagedList.
  const reqId = useRef(0);

  const fetchTrips = useCallback(async (term) => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const res = term.length >= MIN_CHARS
        ? await bookingService.search(term)
        : await bookingService.list({ size: RECENT_COUNT });
      if (id !== reqId.current) return;
      setResults(rows(res).slice(0, MAX_RESULTS));
    } catch (err) {
      if (id !== reqId.current) return;
      // A picker that can't load must not block task creation, and the interceptor already
      // surfaced anything actionable (a 403 here just means no BOOKING_READ).
      if (!isAlreadyReported(err)) console.warn("Trip search failed", err);
      setResults([]);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || value) return;
    const t = setTimeout(() => fetchTrips(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, open, value, fetchTrips]);

  const select = (b) => {
    onChange(b.publicId, tripLabel(b.bookingCode, b.customerNameSnapshot));
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const clear = () => {
    onChange("", "");
    setQuery("");
    setOpen(false);
  };

  const field =
    "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-colors";

  // ── Linked: a chip, not an input. Re-picking means clearing first, which keeps the
  //    "what is this task attached to" answer unambiguous at a glance.
  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50/60 px-3 py-2">
        <span className="flex min-w-0 items-center gap-2">
          <Ticket size={15} className="shrink-0 text-blue-600" />
          <span className="truncate text-sm font-semibold text-slate-700">
            {label || "Linked trip"}
          </span>
        </span>
        <button
          type="button"
          onClick={clear}
          disabled={disabled}
          title="Remove trip link"
          aria-label="Remove trip link"
          className="shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-white hover:text-rose-600 disabled:opacity-50"
        >
          <X size={15} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        className={`${field} pl-9`}
        value={query}
        disabled={disabled}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        placeholder="Search trip code or guest… (optional)"
        aria-label="Link to trip"
        autoComplete="off"
      />
      {loading && (
        <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
      )}

      {open && (
        // preventDefault on mousedown keeps the input from blurring before the click lands —
        // without it the list closes and the selection never fires.
        <div
          onMouseDown={(e) => e.preventDefault()}
          className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          {!loading && results.length === 0 && (
            <p className="px-3 py-3 text-xs font-medium text-slate-400">
              {query.trim().length >= MIN_CHARS ? "No trips match." : "Start typing to search trips."}
            </p>
          )}
          {results.map((b) => (
            <button
              key={b.publicId}
              type="button"
              onClick={() => select(b)}
              className="flex w-full items-center justify-between gap-3 border-b border-slate-50 px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-blue-50"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-slate-700">
                  {b.bookingCode || "—"}
                </span>
                <span className="block truncate text-[11px] text-slate-500">
                  {b.customerNameSnapshot || "No guest name"}
                  {b.destinationSnapshot ? ` · ${b.destinationSnapshot}` : ""}
                </span>
              </span>
              {shortDate(b.travelDate) && (
                <span className="shrink-0 text-[11px] font-semibold text-slate-400">
                  {shortDate(b.travelDate)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
