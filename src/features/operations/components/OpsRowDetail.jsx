// features/operations/components/OpsRowDetail.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The expanded row: what is arranged, per category — and the only place it gets changed.
//
// This used to be read-only, with every write living in a modal drawer behind a "Manage
// suppliers" button. That split cost the user their place in the queue for every single
// change, and it put the actions in a flat 430px list while the organised view — the one
// grouped the same way as the columns above — was the one you could not edit in. The
// drawer is gone; this is both surfaces at once.
//
// THE RULE THAT SHAPES THIS FILE: the server refuses CONFIRMED on a line with no supplier
// (BookingServiceItemServiceImpl.requireVendorBeforeConfirming), because the status is the
// board's only evidence an arrangement exists. So "Confirm" on an unassigned line does not
// fail — it opens the supplier picker, and choosing a supplier assigns AND confirms in one
// request. Placing a service and recording that the supplier agreed is one act; the UI now
// matches the domain instead of arguing with it.
//
// Deliberately no money beyond the balance already on the row. Line costs are withheld from
// anyone without BOOKING_PROFIT_READ; surfacing them here would make every operations
// executive need that permission just to confirm a room.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen, Check, Loader2, Search, Undo2, Wand2, X, Ban, Hash, Plus,
  Phone, MessageCircle, Mail, ExternalLink, Send, Clock,
} from "lucide-react";

import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { toast } from "@shared/ui/toast";
import { hasPermission, P } from "@shared/lib/access";

import { COLUMN_DIMENSIONS, Badge } from "./opsUi";
import OpsCheckpointPanel from "./OpsCheckpointPanel";
import operationsService from "../api/operationsService";
import VendorConversationDrawer from "./VendorConversationDrawer";
import LogCallModal from "./LogCallModal";

const money = (n) =>
  n == null ? "—" : `₹ ${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const fmtDate = (iso) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—";

const digits = (v) => (v || "").replace(/\D/g, "");

/** Whole days from today to an ISO date; negative once it has passed. */
const daysUntil = (iso) => {
  if (!iso) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${iso}T00:00:00`) - today) / 86400000);
};

/**
 * The hold's expiry, said the way it matters.
 *
 * <p>A supplier releases the room and tells nobody, so this counts DOWN rather than printing a
 * date the reader has to subtract from today. No date reads as an invitation to record one,
 * because "held until we don't know when" is the state that hurts.
 */
const releaseLabel = (iso) => {
  const d = daysUntil(iso);
  if (d == null) return "no hold date";
  if (d < 0) return `hold lapsed ${Math.abs(d)}d ago`;
  if (d === 0) return "hold lapses today";
  if (d === 1) return "hold lapses tomorrow";
  return `holds ${d} more days`;
};

const releaseTone = (iso) => {
  const d = daysUntil(iso);
  if (d == null) return "bg-slate-50 text-slate-400 ring-slate-200 hover:text-slate-600";
  if (d < 0) return "bg-rose-50 text-rose-700 ring-rose-200";
  if (d <= 2) return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-sky-50 text-sky-700 ring-sky-200";
};

/**
 * wa.me needs a country code and the vendor master stores whatever was typed.
 *
 * <p>Ten digits is treated as an Indian number, which is what the field holds in practice; a
 * longer string is assumed to already carry its own code and is passed through untouched. A
 * number that is neither yields no link rather than a wrong one.
 */
const waLink = (value) => {
  const d = digits(value);
  if (d.length < 10) return null;
  return `https://wa.me/${d.length === 10 ? `91${d}` : d}`;
};

/**
 * The server's token sets, mirrored — ALL of them, in the server's own order.
 *
 * The previous copy carried only the three that get a column, so a line typed "Flight" or
 * "Visa" fell through to Other while the board's readiness counted it under Travel or
 * Documents. Two views of one booking disagreeing about where a line lives is the failure
 * this grouping exists to prevent, so the mirror has to be complete.
 *
 * Still a mirror and not the source: the server owns the rule (OpsDimension.java), and this
 * only decides which card a line is drawn in. Where they drift, the badges in the table are
 * right — their counts come from the server, never from these arrays.
 */
const DIMENSION_TOKENS = [
  { key: "HOTEL",      label: "Hotel",       tokens: ["hotel", "stay", "accommodation", "resort", "room", "lodge"] },
  { key: "VEHICLE",    label: "Vehicle",     tokens: ["transport", "transfer", "cab", "taxi", "vehicle", "car", "pickup", "drop", "coach", "tempo"] },
  { key: "TRAVEL",     label: "Travel",      tokens: ["flight", "train", "bus", "ferry"] },
  { key: "DOCUMENTS",  label: "Documents",   tokens: ["visa", "passport", "insurance", "document", "permit"] },
  { key: "ACTIVITIES", label: "Sightseeing", tokens: ["sightseeing", "activity", "tour", "excursion", "attraction", "ticket"] },
];

/** Editor modes that show the supplier typeahead, and what each one does once a supplier is picked. */
const PICKER_MODES = new Set(["assign", "assignRequest", "assignConfirm"]);
const PICKER_STATUS = { assignRequest: "REQUESTED", assignConfirm: "CONFIRMED" };

/** First dimension whose tokens the free-text type names; OTHER when none do. */
function categorise(serviceType) {
  const t = (serviceType || "").toLowerCase();
  for (const dim of DIMENSION_TOKENS) {
    if (dim.tokens.some((token) => t.includes(token))) return dim.key;
  }
  return "OTHER";
}

/** Cards always shown (they have a column above), then any other dimension that has lines. */
const CARD_ORDER = [
  ...DIMENSION_TOKENS.map(({ key, label }) => ({
    key,
    label,
    always: COLUMN_DIMENSIONS.some((c) => c.key === key),
  })),
  { key: "OTHER", label: "Other", always: false },
];

export default function OpsRowDetail({
  entry, width, onChanged, onOpenLedger, onOpenBooking, onClose, onEditingChange,
}) {
  const canWrite = hasPermission(P.BOOKING_UPDATE);

  const [lines, setLines]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [failed, setFailed]     = useState(false);
  const [busyId, setBusyId]     = useState(null);
  const [generating, setGenerating] = useState(false);

  // One editor open at a time. `mode` remembers WHY the picker was opened: from "Confirm"
  // it assigns and confirms together, from the supplier name it only re-assigns.
  const [editor, setEditor] = useState(null);   // { lineId, mode: 'assign' | 'assignConfirm' | 'conf' }

  const [vendorQuery, setVendorQuery]     = useState("");
  const [vendors, setVendors]             = useState([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  // The vendor master sits behind VENDOR_READ, which an operations user may not hold. That is
  // a missing capability, not a broken panel — and it must not take the confirmation number
  // down with it, which is why that field has its own write path below.
  const [vendorsDenied, setVendorsDenied] = useState(false);
  const [confDraft, setConfDraft]         = useState("");
  const [releaseDraft, setReleaseDraft]   = useState("");

  /* Composing an email and logging a call are tasks, not field edits, so unlike every
     other editor on this panel they open over the board rather than expanding a row.
     Held here rather than in LineRow so only one can ever be open. */
  const [mailFor, setMailFor] = useState(null);
  const [waFor, setWaFor]     = useState(null);
  const [callFor, setCallFor] = useState(null);

  const bookingId = entry?.bookingPublicId;

  const load = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      setLines(await operationsService.serviceItems(bookingId));
      setFailed(false);
    } catch (err) {
      if (!isAlreadyReported(err)) console.warn("Operations row detail failed", err);
      setLines([]);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => { load(); }, [load]);

  /* ── Escape ownership ────────────────────────────────────────────────────
     The board also listens on window and collapses this row. It bails while an editor is
     open (via onEditingChange), and this closes the editor instead — the same split the
     lead alerts screen uses, where the parent's handler returns and "the drawer owns its
     own Escape". Both listeners are on window, so stopPropagation would do nothing: the
     parent has to be the one that stands down. */
  useEffect(() => { onEditingChange?.(Boolean(editor)); }, [editor, onEditingChange]);
  useEffect(() => () => onEditingChange?.(false), [onEditingChange]);

  useEffect(() => {
    if (!editor) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setEditor(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editor]);

  /* ── Supplier typeahead ───────────────────────────────────────────────────
     Runs only while a picker is open, so closing it stops the requests rather than leaving
     a timer firing at a panel nobody is looking at. */
  useEffect(() => {
    if (!editor || !PICKER_MODES.has(editor.mode)) return undefined;
    let cancelled = false;
    setVendorsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const found = await operationsService.searchVendors(vendorQuery.trim());
        if (!cancelled) { setVendors(found); setVendorsDenied(false); }
      } catch (err) {
        if (cancelled) return;
        if (err?.response?.status === 403) setVendorsDenied(true);
        else if (!isAlreadyReported(err)) console.warn("Vendor lookup failed", err);
        setVendors([]);
      } finally {
        if (!cancelled) setVendorsLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [editor, vendorQuery]);

  const replaceLine = (updated) =>
    setLines((cur) => cur.map((l) => (l.publicId === updated.publicId ? updated : l)));

  /** One patch path for every line write, so optimism and rollback are defined once. */
  const patchLine = async (line, patch, optimistic) => {
    if (!canWrite) return;
    const previous = lines;
    if (optimistic) {
      setLines((cur) => cur.map((l) => (l.publicId === line.publicId ? { ...l, ...optimistic } : l)));
    }
    setBusyId(line.publicId);
    try {
      const updated = await operationsService.updateServiceItem(bookingId, line.publicId, patch);
      if (updated) replaceLine(updated);
      onChanged?.();
    } catch (err) {
      setLines(previous);
      if (!isAlreadyReported(err)) toast.error(getErrorMessage(err, "Could not update that line"));
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Move a line along its status.
   *
   * <p>REQUESTED and CONFIRMED both need a supplier server-side — you cannot have asked nobody,
   * and a confirmation with no supplier is evidence of nothing. So on an unassigned line this
   * opens the picker instead of sending a request the server is going to refuse; choosing a
   * supplier then does both in one call.
   */
  const moveTo = (line, status) => {
    if (!canWrite) return;
    if (!line.vendorPublicId && (status === "REQUESTED" || status === "CONFIRMED")) {
      openPicker(line, status === "CONFIRMED" ? "assignConfirm" : "assignRequest");
      return;
    }
    patchLine(line, { status }, { status });
  };

  const setStatus = (line, status) => patchLine(line, { status }, { status });

  const openReleaseEditor = (line) => {
    setReleaseDraft(line.releaseDate ?? "");
    setEditor({ lineId: line.publicId, mode: "release" });
  };

  const saveRelease = async (line) => {
    const next = releaseDraft;
    setEditor(null);
    if (next === (line.releaseDate ?? "")) return;
    await patchLine(line, { releaseDate: next || null }, { releaseDate: next || null });
  };

  const openPicker = (line, mode) => {
    setVendorQuery("");
    setVendors([]);
    setVendorsDenied(false);
    setEditor({ lineId: line.publicId, mode });
  };

  const openConfEditor = (line) => {
    setConfDraft(line.confirmationNumber ?? "");
    setEditor({ lineId: line.publicId, mode: "conf" });
  };

  const saveConfirmation = async (line) => {
    const next = confDraft.trim();
    setEditor(null);
    if (next === (line.confirmationNumber ?? "")) return;
    // Its own request, needing only BOOKING_UPDATE. Previously this rode along inside vendor
    // assignment, so recording a reference meant re-picking the supplier — and was impossible
    // for anyone without VENDOR_READ, who is exactly the person doing the recording.
    await patchLine(line, { confirmationNumber: next }, { confirmationNumber: next });
  };

  const assign = async (line, vendor) => {
    if (!canWrite) return;
    const nextStatus = PICKER_STATUS[editor?.mode];
    setBusyId(line.publicId);
    try {
      const updated = await operationsService.assignVendor(bookingId, line.publicId, {
        vendorPublicId: vendor.publicId,
        // One request, not two. The server applies the status after the vendor, so asking or
        // confirming here can never trip its own "assign a supplier first" rule.
        status: nextStatus,
      });
      if (updated) replaceLine(updated);
      setEditor(null);
      onChanged?.();
      toast.success(
        nextStatus === "CONFIRMED" ? `${vendor.vendorName} assigned and confirmed`
        : nextStatus === "REQUESTED" ? `Sent to ${vendor.vendorName}`
        : `${vendor.vendorName} assigned`);
    } catch (err) {
      if (!isAlreadyReported(err)) toast.error(getErrorMessage(err, "Could not assign that supplier"));
    } finally {
      setBusyId(null);
    }
  };

  const generate = async () => {
    if (!canWrite) return;
    setGenerating(true);
    try {
      const result = await operationsService.generateTripPlan(bookingId);
      if (result?.outcome === "CREATED") {
        toast.success(`${result.createdCount} service line${result.createdCount === 1 ? "" : "s"} generated`);
        await load();
        onChanged?.();
      } else if (result?.outcome === "ALREADY_PLANNED") {
        toast.info("This booking already has service lines — nothing was changed");
      } else {
        toast.info("This booking has no itinerary to generate from");
      }
    } catch (err) {
      if (!isAlreadyReported(err)) toast.error(getErrorMessage(err, "Could not generate the service lines"));
    } finally {
      setGenerating(false);
    }
  };

  const active = lines.filter((l) => l.status !== "CANCELLED");
  const cards = CARD_ORDER
    .map((dim) => {
      const mine = active.filter((l) => categorise(l.serviceType) === dim.key);
      return { ...dim, lines: mine, done: mine.filter((l) => l.status === "CONFIRMED").length };
    })
    .filter((c) => c.always || c.lines.length > 0);

  return (
    // sticky left-0 + the scroller's own width: the detail stays where it can be read
    // instead of stretching to the 1180px table and needing a sideways scroll of its own.
    <div
      className="border-t border-slate-100 bg-slate-50/60 px-5 py-4 sticky left-0"
      style={width ? { width } : undefined}
    >
      {/* Header strip — the facts a decision needs, and the ways out of this screen. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pb-3 mb-3 border-b border-slate-200/70">
        {/* The way out. Everything this screen does not carry — travellers, documents, the
            full trip, amendments — lives on the booking, and there was no route to it. */}
        <span className="text-xs font-bold text-slate-500">
          Booking{" "}
          <button
            onClick={() => onOpenBooking?.(entry)}
            title="Open the full booking"
            className="inline-flex items-center gap-1 text-blue-600 hover:underline"
          >
            {entry.bookingCode}
            <ExternalLink className="w-3 h-3" />
          </button>
        </span>
        <span className="text-xs font-bold text-slate-500">
          Customer <span className="text-slate-700">{entry.customerName || "—"}</span>
        </span>
        <span className="text-xs font-bold text-slate-500">
          Pax <span className="text-slate-700 tabular-nums">{entry.pax ?? "—"}</span>
        </span>
        <span className="text-xs font-bold text-slate-500">
          Travel <span className="text-slate-700">{fmtDate(entry.travelDate)} – {fmtDate(entry.tripEndDate)}</span>
        </span>
        <span className="text-xs font-bold text-slate-500">
          Balance due{" "}
          <span className={Number(entry.balanceDue) > 0 ? "text-rose-600" : "text-emerald-600"}>
            {money(entry.balanceDue)}
          </span>
        </span>

        <div className="ml-auto flex items-center gap-2">
          {canWrite && active.length > 0 && (
            <button
              onClick={generate}
              disabled={generating}
              title="Add any missing service lines from this booking's itinerary"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-600 hover:text-blue-600 hover:border-blue-300 disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              From itinerary
            </button>
          )}
          <button
            onClick={() => onOpenLedger?.(entry)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-600 hover:text-blue-600 hover:border-blue-300"
          >
            <BookOpen className="w-3.5 h-3.5" /> View ledger
          </button>
          <button
            onClick={onClose}
            aria-label="Collapse this booking"
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Above the service-line cards, and above the loading state for them, because it
          answers a different question: the cards say what was arranged, this says whether
          the trip can leave. It renders nothing at all on a booking with no ops record,
          so it costs an older booking neither space nor an explanation. */}
      <OpsCheckpointPanel bookingPublicId={bookingId} onChanged={onChanged} />

      {loading && <p className="text-xs font-bold text-slate-400 py-4">Loading service lines…</p>}

      {!loading && failed && (
        <div className="flex items-center gap-3 py-4">
          <p className="text-xs font-bold text-slate-600">Could not load the service lines for this booking.</p>
          <button
            onClick={load}
            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-600 hover:text-blue-600 hover:border-blue-300"
          >
            Try again
          </button>
        </div>
      )}

      {/* Nothing planned yet. This is the first thing a fresh queue needs, so it lives on the
          row — it used to be reachable only from inside the drawer, which made a morning of
          ten unplanned bookings thirty clicks before any supplier work could start. */}
      {!loading && !failed && active.length === 0 && (
        <div className="flex flex-wrap items-center gap-3 py-4">
          <p className="text-xs font-bold text-slate-600">
            Nothing has been broken into service lines yet — there is nothing to confirm.
          </p>
          {canWrite && (
            <button
              onClick={generate}
              disabled={generating}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              Generate from itinerary
            </button>
          )}
        </div>
      )}

      {!loading && !failed && active.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <div key={card.key} className="bg-white rounded-xl border border-slate-200/70 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                <p className="text-xs font-extrabold text-slate-700">{card.label}</p>
                <Badge tone={card.lines.length === 0 ? "slate"
                  : card.done >= card.lines.length ? "green" : "amber"}>
                  {card.done} of {card.lines.length}
                </Badge>
              </div>

              {card.lines.length === 0 ? (
                <p className="px-3 py-3 text-[11px] font-bold text-slate-400">Nothing arranged</p>
              ) : (
                <ul className="divide-y divide-slate-50">
                  {card.lines.map((line) => (
                    <LineRow
                      key={line.publicId}
                      line={line}
                      canWrite={canWrite}
                      busy={busyId === line.publicId}
                      editor={editor?.lineId === line.publicId ? editor : null}
                      confDraft={confDraft}
                      setConfDraft={setConfDraft}
                      releaseDraft={releaseDraft}
                      setReleaseDraft={setReleaseDraft}
                      vendors={vendors}
                      vendorQuery={vendorQuery}
                      setVendorQuery={setVendorQuery}
                      vendorsLoading={vendorsLoading}
                      vendorsDenied={vendorsDenied}
                      onRequest={() => moveTo(line, "REQUESTED")}
                      onConfirm={() => moveTo(line, "CONFIRMED")}
                      onRevert={() => setStatus(line, "PENDING")}
                      onCancel={() => setStatus(line, "CANCELLED")}
                      onPickSupplier={() => openPicker(line, "assign")}
                      onEditConfirmation={() => openConfEditor(line)}
                      onSaveConfirmation={() => saveConfirmation(line)}
                      onEditRelease={() => openReleaseEditor(line)}
                      onSaveRelease={() => saveRelease(line)}
                      onAssign={(vendor) => assign(line, vendor)}
                      onCloseEditor={() => setEditor(null)}
                      onEmail={() => setMailFor(line)}
                      onWhatsApp={() => setWaFor(line)}
                      onCall={() => setCallFor(line)}
                    />
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* One drawer, two channels — the same shape the lead and customer drawers use, so an
          operator meets one pattern across the product. Which tab opens is decided by the button
          that was pressed; landing on the other one would mean switching back every time.

          Sending returns the persisted line — status and release date both move as part of that
          request — so the row is replaced from the response rather than re-fetched. */}
      {(mailFor || waFor) && (
        <VendorConversationDrawer
          bookingPublicId={bookingId}
          line={waFor || mailFor}
          initialChannel={waFor ? "WHATSAPP" : "EMAIL"}
          onSent={(updated) => { if (updated) replaceLine(updated); onChanged?.(); }}
          onClose={() => { setMailFor(null); setWaFor(null); }}
        />
      )}

      {callFor && (
        <LogCallModal
          bookingPublicId={bookingId}
          line={callFor}
          onLogged={() => onChanged?.()}
          onClose={() => setCallFor(null)}
        />
      )}
    </div>
  );
}

/**
 * How to reach the supplier on this line, one tap away.
 *
 * <p>The act that follows "hotel not confirmed" is phoning the hotel. Until this existed the
 * only way to get the number was the Vendors screen — which needs VENDOR_READ, a permission the
 * person doing the chasing usually does not have. The line carries the number itself now, so
 * the call happens without leaving the board.
 *
 * <p>Renders nothing when there is no supplier or no way to reach them, rather than a row of
 * dead icons.
 */
function SupplierContact({ line, canWrite, onEmail, onWhatsApp, onCall }) {
  const whatsapp = waLink(line.vendorWhatsapp || line.vendorPhone);
  const phone = digits(line.vendorPhone) || digits(line.vendorAlternatePhone);
  const email = (line.vendorEmail || "").trim();

  if (!line.vendorPublicId || (!phone && !whatsapp && !email)) return null;

  const iconCls =
    "inline-flex items-center justify-center w-5 h-5 rounded border border-slate-200 bg-white text-slate-400 transition-colors";

  return (
    <div className="mt-1 flex items-center gap-1.5">
      {line.vendorContactPerson && (
        <span className="text-[10px] text-slate-400 truncate min-w-0">{line.vendorContactPerson}</span>
      )}
      <div className="ml-auto flex items-center gap-1 shrink-0">
        {phone && (
          <a href={`tel:${phone}`} title={`Call ${line.vendorPhone || line.vendorAlternatePhone}`}
             className={`${iconCls} hover:text-blue-600 hover:border-blue-300`}>
            <Phone className="w-2.5 h-2.5" />
          </a>
        )}
        {/* Dialling and recording what was said are separate acts, so they are separate
            buttons. The tel: link above hands off to the phone and the CRM never hears
            about it again; this is where the outcome and the next chase date land. */}
        {canWrite && (phone || whatsapp) && (
          <button onClick={onCall} title="Log a call with this supplier"
                  className={`${iconCls} hover:text-blue-600 hover:border-blue-300`}>
            <Hash className="w-2.5 h-2.5" />
          </button>
        )}
        {/* Was a bare wa.me link, which opened an EMPTY chat: the operator retyped the booking
            code and the dates from memory, and nothing about the chase survived it. The composer
            pre-fills the message and records it — including when the operator ends up sending
            from their own WhatsApp, which is the only route most agencies have. */}
        {whatsapp && (
          canWrite ? (
            <button onClick={onWhatsApp} title="WhatsApp this supplier"
                    className={`${iconCls} hover:text-emerald-600 hover:border-emerald-300`}>
              <MessageCircle className="w-2.5 h-2.5" />
            </button>
          ) : (
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" title="WhatsApp this supplier"
               className={`${iconCls} hover:text-emerald-600 hover:border-emerald-300`}>
              <MessageCircle className="w-2.5 h-2.5" />
            </a>
          )
        )}
        {/* Was a mailto:, which handed the job to Gmail — the CRM kept no record, the line
            never moved to REQUESTED, and the supplier's reply landed somewhere this booking
            could not see. This opens the composer instead, and sending is logged. */}
        {email && (
          canWrite ? (
            <button onClick={onEmail} title={`Email ${email}`}
                    className={`${iconCls} hover:text-indigo-600 hover:border-indigo-300`}>
              <Mail className="w-2.5 h-2.5" />
            </button>
          ) : (
            <a href={`mailto:${email}`} title={`Email ${email}`}
               className={`${iconCls} hover:text-indigo-600 hover:border-indigo-300`}>
              <Mail className="w-2.5 h-2.5" />
            </a>
          )
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   One service line
   ═════════════════════════════════════════════════════════════════════════ */

function LineRow({
  line, canWrite, busy, editor, confDraft, setConfDraft, releaseDraft, setReleaseDraft,
  vendors, vendorQuery, setVendorQuery, vendorsLoading, vendorsDenied,
  onRequest, onConfirm, onRevert, onCancel, onPickSupplier, onEditConfirmation,
  onSaveConfirmation, onEditRelease, onSaveRelease, onAssign, onCloseEditor,
  onEmail, onWhatsApp, onCall,
}) {
  const confirmed = line.status === "CONFIRMED";
  const requested = line.status === "REQUESTED";
  const searchRef = useRef(null);

  useEffect(() => {
    if (editor && PICKER_MODES.has(editor.mode)) searchRef.current?.focus();
  }, [editor]);

  return (
    <li className="px-3 py-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-slate-700 truncate">{line.title}</p>
          <p className="text-[10px] text-slate-400 truncate">
            {fmtDate(line.serviceDate)}
            {line.endDate ? ` → ${fmtDate(line.endDate)}` : ""}
          </p>
        </div>

        {/* One primary action per state, following the order the work actually moves in:
            plan → ask the supplier → they reply. A line offering every transition at once
            makes the reader decide what happens next on every row. */}
        {busy ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 shrink-0 mt-0.5" />
        ) : confirmed ? (
          <button
            onClick={canWrite ? onRevert : undefined}
            disabled={!canWrite}
            title={canWrite ? "Move back to pending" : undefined}
            className="shrink-0 inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded ring-1 bg-emerald-50 text-emerald-700 ring-emerald-200 disabled:cursor-default"
          >
            <Check className="w-3 h-3" /> CONFIRMED
          </button>
        ) : !canWrite ? (
          <span className={`shrink-0 text-[10px] font-extrabold px-2 py-0.5 rounded ring-1 ${
            requested ? "bg-sky-50 text-sky-700 ring-sky-200" : "bg-amber-50 text-amber-700 ring-amber-200"
          }`}>
            {requested ? "REQUESTED" : "PENDING"}
          </span>
        ) : requested ? (
          // Asked and waiting. The only thing left is their answer.
          <button
            onClick={onConfirm}
            title="The supplier has confirmed"
            className="shrink-0 inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded ring-1 bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100"
          >
            <Check className="w-3 h-3" /> Confirm
          </button>
        ) : (
          <span className="shrink-0 inline-flex items-center gap-1">
            <button
              onClick={onRequest}
              title={line.vendorPublicId ? "Mark as sent to the supplier" : "Pick a supplier to send this to"}
              className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded ring-1 bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-100"
            >
              <Send className="w-3 h-3" /> Ask
            </button>
            {/* Already settled on the phone — skip the wait. */}
            <button
              onClick={onConfirm}
              title="Already confirmed — skip straight to confirmed"
              className="p-0.5 rounded text-slate-300 hover:text-emerald-600"
            >
              <Check className="w-3 h-3" />
            </button>
          </span>
        )}
      </div>

      {/* Supplier and reference, both editable in place. */}
      <div className="mt-1 flex items-center gap-2 text-[10px]">
        {canWrite ? (
          <button
            onClick={onPickSupplier}
            className={`truncate max-w-[45%] text-left hover:underline ${
              line.vendorName ? "text-slate-500" : "text-rose-500 font-bold"
            }`}
          >
            {line.vendorName || "no supplier"}
          </button>
        ) : (
          <span className={`truncate max-w-[45%] ${line.vendorName ? "text-slate-500" : "text-rose-500 font-bold"}`}>
            {line.vendorName || "no supplier"}
          </span>
        )}

        <span className="text-slate-300">·</span>

        {canWrite ? (
          <button
            onClick={onEditConfirmation}
            className="inline-flex items-center gap-1 text-slate-500 hover:text-blue-600 hover:underline truncate"
          >
            <Hash className="w-2.5 h-2.5 shrink-0" />
            {line.confirmationNumber
              ? <span className="font-mono truncate">{line.confirmationNumber}</span>
              : <span className="font-bold">add reference</span>}
          </button>
        ) : line.confirmationNumber ? (
          <span className="font-mono text-slate-500 truncate">{line.confirmationNumber}</span>
        ) : null}

        {canWrite && !confirmed && (
          <button
            onClick={onCancel}
            title="Cancel this line"
            className="ml-auto shrink-0 p-0.5 rounded text-slate-300 hover:text-rose-600"
          >
            <Ban className="w-3 h-3" />
          </button>
        )}
        {canWrite && confirmed && (
          <button
            onClick={onRevert}
            title="Move back to pending"
            className="ml-auto shrink-0 p-0.5 rounded text-slate-300 hover:text-amber-600"
          >
            <Undo2 className="w-3 h-3" />
          </button>
        )}
      </div>

      <SupplierContact line={line} canWrite={canWrite}
                       onEmail={onEmail} onWhatsApp={onWhatsApp} onCall={onCall} />

      {/* The hold's expiry. Shown while a line is out with a supplier, or whenever a date was
          recorded — a lapsed hold on a line somebody later confirmed is still worth seeing. */}
      {canWrite && (requested || line.releaseDate) && editor?.mode !== "release" && (
        <button
          onClick={onEditRelease}
          className={`mt-1 inline-flex items-center gap-1 text-[10px] font-bold rounded px-1.5 py-0.5 ring-1 ${releaseTone(line.releaseDate)}`}
        >
          <Clock className="w-2.5 h-2.5" />
          {releaseLabel(line.releaseDate)}
        </button>
      )}

      {editor?.mode === "release" && (
        <input
          autoFocus
          type="date"
          value={releaseDraft}
          onChange={(e) => setReleaseDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onSaveRelease(); } }}
          onBlur={onSaveRelease}
          aria-label="Supplier holds until"
          className="mt-1 px-2 py-1 rounded-lg border border-blue-300 bg-white text-[11px] font-bold text-slate-700 outline-none"
        />
      )}

      {/* Reference editor — its own request, so it needs no vendor access. */}
      {editor?.mode === "conf" && (
        <div className="mt-2 flex items-center gap-1.5">
          <input
            autoFocus
            value={confDraft}
            onChange={(e) => setConfDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); onSaveConfirmation(); }
            }}
            onBlur={onSaveConfirmation}
            maxLength={100}
            placeholder="Confirmation / PNR"
            aria-label="Confirmation number"
            className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-blue-300 bg-white text-[11px] font-mono text-slate-700 placeholder-slate-400 outline-none"
          />
        </div>
      )}

      {/* Supplier picker — in flow, so it simply makes the card taller. */}
      {editor && PICKER_MODES.has(editor.mode) && (
        <div className="mt-2 pt-2 border-t border-slate-100">
          {editor.mode === "assignConfirm" && (
            <p className="text-[10px] font-bold text-amber-700 mb-1.5">
              Pick the supplier — it will be assigned and confirmed together.
            </p>
          )}
          {editor.mode === "assignRequest" && (
            <p className="text-[10px] font-bold text-amber-700 mb-1.5">
              Who is this going to? It will be assigned and marked as sent.
            </p>
          )}

          {vendorsDenied ? (
            <p className="text-[10px] text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded-lg px-2 py-1.5">
              You don't have access to the supplier list. Ask your administrator for the Vendors
              permission — you can still record a reference number above.
            </p>
          ) : (
            <>
              <div className="relative mb-1.5">
                <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchRef}
                  value={vendorQuery}
                  onChange={(e) => setVendorQuery(e.target.value)}
                  placeholder="Search suppliers…"
                  aria-label="Search suppliers"
                  className="w-full pl-7 pr-2 py-1 rounded-lg border border-slate-200 bg-white text-[11px] text-slate-700 font-medium placeholder-slate-400 focus:border-blue-400 outline-none"
                />
              </div>

              {vendorsLoading && (
                <p className="text-[10px] text-slate-400 py-1 flex items-center gap-1">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" /> Searching…
                </p>
              )}

              {!vendorsLoading && vendors.length === 0 && (
                <p className="text-[10px] text-slate-400 py-1">
                  {vendorQuery ? "No supplier matches that." : "Type to search suppliers."}
                </p>
              )}

              <ul className="max-h-36 overflow-y-auto">
                {vendors.map((v) => (
                  <li key={v.publicId}>
                    <button
                      onClick={() => onAssign(v)}
                      disabled={busy}
                      className="w-full text-left px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-600 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
                    >
                      {v.vendorName}
                      {v.vendorType && <span className="text-slate-400 font-medium"> · {v.vendorType}</span>}
                    </button>
                  </li>
                ))}
              </ul>

              <button
                onClick={onCloseEditor}
                className="mt-1 text-[10px] font-bold text-slate-400 hover:text-slate-600"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      )}
    </li>
  );
}
