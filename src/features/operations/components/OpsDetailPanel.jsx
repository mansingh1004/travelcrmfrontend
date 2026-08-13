// features/operations/components/OpsDetailPanel.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The panel that opens beside a board row.
//
// It exists so operations never leaves the board. Confirming a hotel, marking a
// transfer arranged, generating the service breakdown from the itinerary — all of it
// happens here, with the row that prompted it still on screen. Navigating to the
// booking screen and back for each of these is twenty page changes a morning.
//
// Deliberately no money. Line costs exist on the API and are withheld from anyone
// without BOOKING_PROFIT_READ; showing them here would make every operations
// executive need that permission just to confirm a room.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Wand2, Loader2, CheckCircle2, Circle, Ban, ListChecks, UserPlus, Search } from "lucide-react";

import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { toast } from "@shared/ui/toast";
import { hasPermission, P } from "@shared/lib/access";

import { Badge, ReadinessList, GridEmpty } from "./opsUi";
import operationsService from "../api/operationsService";

const STATUS_META = {
  CONFIRMED: { tone: "green", Icon: CheckCircle2, label: "Confirmed" },
  PENDING:   { tone: "amber", Icon: Circle,       label: "Pending" },
  CANCELLED: { tone: "slate", Icon: Ban,          label: "Cancelled" },
};

const fmtDate = (iso) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—";

export default function OpsDetailPanel({ entry, onClose, onChanged }) {
  const canWrite = hasPermission(P.BOOKING_UPDATE);

  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [generating, setGenerating] = useState(false);

  // Supplier picker. Open for one line at a time — a panel with six open pickers is a
  // panel nobody can read.
  const [pickerFor, setPickerFor] = useState(null);
  const [vendorQuery, setVendorQuery] = useState("");
  const [vendors, setVendors] = useState([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  // The vendor master sits behind VENDOR_READ, which an operations user may not hold.
  // That is a missing capability, not a broken panel, so it degrades to a message.
  const [vendorsDenied, setVendorsDenied] = useState(false);
  const [confirmationNo, setConfirmationNo] = useState("");

  const bookingId = entry?.bookingPublicId;

  const load = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      setLines(await operationsService.serviceItems(bookingId));
    } catch (err) {
      if (!isAlreadyReported(err)) toast.error(getErrorMessage(err, "Could not load service lines"));
      setLines([]);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => { load(); }, [load]);

  // Escape closes. A panel that can only be dismissed with the mouse is a panel that
  // stays open while someone is typing somewhere else.
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const setStatus = async (line, status) => {
    if (!canWrite) return;
    setBusyId(line.publicId);
    // Optimistic: the dot moves immediately and rolls back if the server disagrees.
    const previous = lines;
    setLines((cur) => cur.map((l) => (l.publicId === line.publicId ? { ...l, status } : l)));
    try {
      await operationsService.setServiceStatus(bookingId, line.publicId, status);
      onChanged?.();
    } catch (err) {
      setLines(previous);
      if (!isAlreadyReported(err)) toast.error(getErrorMessage(err, "Could not update that line"));
    } finally {
      setBusyId(null);
    }
  };

  const generate = async () => {
    if (!canWrite) return;
    setGenerating(true);
    try {
      const result = await operationsService.generateTripPlan(bookingId);
      // The outcome distinguishes a real generation from a no-op, so the message is not
      // a lie when the booking already had lines or had no itinerary to work from.
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

  // Debounced typeahead. Runs only while a picker is open, so closing it stops the
  // requests rather than leaving a timer firing against a panel nobody is looking at.
  useEffect(() => {
    if (!pickerFor) return undefined;
    let cancelled = false;
    setVendorsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const found = await operationsService.searchVendors(vendorQuery.trim());
        if (!cancelled) { setVendors(found); setVendorsDenied(false); }
      } catch (err) {
        if (cancelled) return;
        // 403 means this user cannot read the vendor master — a missing capability, not a
        // failure worth a toast on top of the interceptor's own.
        if (err?.response?.status === 403) setVendorsDenied(true);
        else if (!isAlreadyReported(err)) console.warn("Vendor lookup failed", err);
        setVendors([]);
      } finally {
        if (!cancelled) setVendorsLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [pickerFor, vendorQuery]);

  const openPicker = (line) => {
    setPickerFor(line.publicId);
    setVendorQuery("");
    setVendors([]);
    setVendorsDenied(false);
    setConfirmationNo(line.confirmationNumber ?? "");
  };

  const assign = async (line, vendor) => {
    if (!canWrite) return;
    setBusyId(line.publicId);
    try {
      await operationsService.assignVendor(bookingId, line.publicId, {
        vendorPublicId: vendor.publicId,
        confirmationNumber: confirmationNo.trim() || undefined,
      });
      setPickerFor(null);
      await load();
      onChanged?.();
      toast.success(`${vendor.vendorName} assigned`);
    } catch (err) {
      if (!isAlreadyReported(err)) toast.error(getErrorMessage(err, "Could not assign that supplier"));
    } finally {
      setBusyId(null);
    }
  };

  if (!entry) return null;

  // PORTALLED TO document.body, not rendered in place. `position: fixed` is only
  // viewport-relative while no ancestor establishes a containing block — and this app has
  // backdrop-blur on its cards and a sticky navbar, either of which silently turns the
  // drawer into a clipped box somewhere inside the page. The portal is what makes it
  // reliably a drawer. Same reason fleetUi's Dialog portals.
  //
  // z sits above the navbar's z-40 so the drawer covers the chrome rather than sliding
  // underneath it.
  return createPortal(
    <>
      {/* Backdrop. The panel overlays the board rather than sitting in the layout, so
          opening a booking never reflows the table underneath — the row you clicked
          stays exactly where your eye left it. */}
      <div
        className="fixed inset-0 z-[60] bg-slate-900/30"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        className="fixed right-0 top-0 z-[70] h-screen w-full sm:w-[430px] p-3"
        aria-label={`Operations detail for ${entry.bookingCode}`}
        style={{ animation: "slideIn .25s ease both", fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}
      >
        {/* h-full + inner scroll: a booking with a dozen service lines scrolls INSIDE the
            drawer instead of running off the bottom of the screen. */}
        {/* NOT <Panel>. Panel's base is `bg-white/80 backdrop-blur-md`, and passing `bg-white`
            through className does not override it: both utilities have the same specificity, so
            the winner is whichever Tailwind emitted later in the stylesheet, not whichever came
            later in the class attribute. The drawer rendered translucent with the board showing
            through it. A drawer is a surface you read forms on — it has to be opaque, so it
            states its own background rather than fighting a base class for it. */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-2xl h-full overflow-y-auto">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-blue-600 truncate">{entry.bookingCode}</p>
            <p className="text-xs font-semibold text-slate-600 truncate">{entry.customerName || "—"}</p>
            <p className="text-[11px] text-slate-400 truncate">
              {entry.destination || "—"} · {fmtDate(entry.travelDate)} → {fmtDate(entry.tripEndDate)}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close detail panel"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Readiness — omitted entirely when the caller opened this from somewhere that does
            not carry it (a day card can name a booking the board has not loaded). Rendering
            the grid with nothing in it would read as "nothing is ready", which is a lie. */}
        {entry.readiness && (
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-2.5">Readiness</p>
            <ReadinessList readiness={entry.readiness} />
          </div>
        )}

        {/* Service lines */}
        <div className="px-5 py-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
              Service lines
            </p>
            {/* Counted from the lines this panel actually loaded, not from the board row.
                The row may not exist — a day card can open a booking the board has not
                fetched — and these are the same lines the count describes anyway. */}
            {lines.length > 0 && (() => {
              const active = lines.filter((l) => l.status !== "CANCELLED");
              const done = active.filter((l) => l.status === "CONFIRMED").length;
              return (
                <Badge tone={done >= active.length ? "green" : "amber"}>
                  {done} / {active.length} confirmed
                </Badge>
              );
            })()}
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-400 py-6 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading lines…
            </div>
          )}

          {!loading && lines.length === 0 && (
            <div className="text-center py-6">
              <GridEmpty
                icon={ListChecks}
                title="Nothing broken down yet"
                hint="Generate the service lines from this booking's itinerary, then assign a supplier to each."
              />
              {canWrite && (
                <button
                  onClick={generate}
                  disabled={generating}
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-700 hover:to-indigo-600 text-white shadow-md shadow-blue-200 disabled:opacity-50 transition-all"
                >
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  Generate from itinerary
                </button>
              )}
            </div>
          )}

          {!loading && lines.length > 0 && (
            <ul className="space-y-2">
              {lines.map((line) => {
                const meta = STATUS_META[line.status] ?? STATUS_META.PENDING;
                const busy = busyId === line.publicId;
                return (
                  <li key={line.publicId} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-700 truncate">{line.title}</p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {line.serviceType} · {fmtDate(line.serviceDate)}
                          {line.endDate ? ` → ${fmtDate(line.endDate)}` : ""}
                        </p>
                      </div>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-[11px] text-slate-500 truncate min-w-0">
                        {line.vendorName
                          ? <>Supplier <b className="text-slate-700">{line.vendorName}</b></>
                          : <span className="text-rose-500 font-semibold">No supplier assigned</span>}
                        {line.confirmationNumber && <> · <span className="font-mono">{line.confirmationNumber}</span></>}
                      </p>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {canWrite && (
                          <button
                            onClick={() => (pickerFor === line.publicId ? setPickerFor(null) : openPicker(line))}
                            aria-expanded={pickerFor === line.publicId}
                            title={line.vendorName ? "Change supplier" : "Assign a supplier"}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-all"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {canWrite && (
                          <select
                            value={line.status}
                            disabled={busy}
                            onChange={(e) => setStatus(line, e.target.value)}
                            aria-label={`Status for ${line.title}`}
                            className="text-[11px] font-bold rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-600 focus:border-blue-400 outline-none disabled:opacity-50"
                          >
                            <option value="PENDING">Pending</option>
                            <option value="CONFIRMED">Confirmed</option>
                            <option value="CANCELLED">Cancelled</option>
                          </select>
                        )}
                      </div>
                    </div>

                    {/* Supplier picker — inline, because leaving the panel to assign a
                        supplier defeats the point of the panel. */}
                    {pickerFor === line.publicId && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-100">
                        {vendorsDenied ? (
                          <p className="text-[11px] text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded-lg px-2.5 py-2">
                            You don't have access to the vendor list. Ask your administrator for the
                            Vendors permission, or set the supplier from the booking screen.
                          </p>
                        ) : (
                          <>
                            <div className="relative mb-2">
                              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                              <input
                                autoFocus
                                value={vendorQuery}
                                onChange={(e) => setVendorQuery(e.target.value)}
                                placeholder="Search suppliers…"
                                aria-label="Search suppliers"
                                className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 font-medium placeholder-slate-400 focus:border-blue-400 outline-none"
                              />
                            </div>

                            <input
                              value={confirmationNo}
                              onChange={(e) => setConfirmationNo(e.target.value)}
                              placeholder="Confirmation number (optional)"
                              aria-label="Confirmation number"
                              className="w-full mb-2 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 font-medium placeholder-slate-400 focus:border-blue-400 outline-none"
                            />

                            {vendorsLoading && (
                              <p className="text-[11px] text-slate-400 py-2 flex items-center gap-1.5">
                                <Loader2 className="w-3 h-3 animate-spin" /> Searching…
                              </p>
                            )}

                            {!vendorsLoading && vendors.length === 0 && (
                              <p className="text-[11px] text-slate-400 py-2">
                                {vendorQuery ? "No supplier matches that." : "Type to search suppliers."}
                              </p>
                            )}

                            <ul className="max-h-40 overflow-y-auto space-y-1">
                              {vendors.map((v) => (
                                <li key={v.publicId}>
                                  <button
                                    onClick={() => assign(line, v)}
                                    disabled={busy}
                                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50 transition-colors"
                                  >
                                    {v.vendorName}
                                    {v.vendorType && <span className="text-slate-400 font-medium"> · {v.vendorType}</span>}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        </div>
      </aside>
    </>,
    document.body
  );
}
