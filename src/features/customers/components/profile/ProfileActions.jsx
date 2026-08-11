import { useEffect, useRef, useState } from "react";
import {
  LoaderCircle, MessageSquarePlus, MoreHorizontal, Pencil, Plane, Trash2,
} from "lucide-react";

import { FOCUS_RING } from "./profileUi";
import RecordPaymentAction from "./RecordPaymentAction";

/**
 * Everything the page can DO to this customer, split between the band and an overflow menu.
 *
 * ── What sits in the bar, and why ────────────────────────────────────────────────────────────
 * The bar's budget belongs to the operator: call, WhatsApp and email (rendered by CommandBar
 * itself), then Record payment, New booking and Edit. Those are the actions someone takes with a
 * customer on the phone.
 *
 * Everything else is in the menu, and each demotion has a reason:
 *   • New enquiry   — sales-side, not counter-side. Still one click away.
 *   • Move to Trash — destructive. It must never be one mis-tap from Call.
 *   • New quotation — ABSENT entirely, not demoted. A quotation belongs to a lead, not a customer;
 *     there is no customer→quotation path in the data model, so a button here would promise a
 *     relationship the schema does not have. Quotations are reached through Enquiries.
 *
 * Nothing is hidden by breakpoint without a home: labels collapse to icons below lg, and the menu
 * is present at every width.
 */
export default function ProfileActions({
  customerId,
  summary,
  can,
  updating,
  onRecordPayment,
  onNewBooking,
  onNewEnquiry,
  onEdit,
  onMoveToTrash,
  onToast,
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);

  // Click-outside closes, and so does Escape — which also puts focus back on the trigger, or the
  // keyboard user is dumped at the top of the document with no idea where they were.
  useEffect(() => {
    if (!open) return undefined;

    const closeOnOutside = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const deleting = updating === "delete";

  return (
    <>
      {/* Only offered when there is something to pay against — the picker re-checks anyway, since
          a booking can be cancelled between the summary landing and the click. */}
      {can.managePayments && Number(summary.activeBookingCount) > 0 && (
        <RecordPaymentAction customerId={customerId} onNavigate={onRecordPayment} onToast={onToast} />
      )}

      {can.createBooking && (
        <button type="button" onClick={onNewBooking}
          className={`hidden h-10 items-center gap-2 rounded-xl bg-blue-600 px-3.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 sm:inline-flex ${FOCUS_RING}`}>
          <Plane className="h-4 w-4" /> <span className="hidden lg:inline">New booking</span>
        </button>
      )}

      {can.edit && (
        <button type="button" onClick={onEdit}
          className={`inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 ${FOCUS_RING}`}>
          <Pencil className="h-4 w-4" /> <span className="hidden lg:inline">Edit</span>
        </button>
      )}

      <div className="relative" ref={menuRef}>
        <button type="button" ref={triggerRef}
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open} aria-haspopup="menu" aria-label="More customer actions"
          className={`flex h-10 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-slate-600 hover:bg-slate-50 ${FOCUS_RING}`}>
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {open && (
          <div role="menu" aria-label="More customer actions"
            className="absolute right-0 z-10 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
            {can.createLead && (
              <MenuItem icon={MessageSquarePlus} onClick={() => { setOpen(false); onNewEnquiry(); }}>
                New enquiry
              </MenuItem>
            )}
            {can.delete && (
              <MenuItem
                icon={deleting ? LoaderCircle : Trash2}
                tone="rose"
                spinning={deleting}
                disabled={deleting}
                onClick={() => { setOpen(false); onMoveToTrash(); }}
              >
                Move to Trash
              </MenuItem>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/** A row in the overflow menu. `spinning` animates the glyph rather than adding a second one. */
function MenuItem({ icon: Icon, tone, spinning, disabled, onClick, children }) {
  const colour = tone === "rose"
    ? "text-rose-600 hover:bg-rose-50 focus-visible:ring-rose-500"
    : "text-slate-700 hover:bg-slate-50 focus-visible:ring-blue-500";
  return (
    <button type="button" role="menuitem" disabled={disabled} onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 ${colour}`}>
      <Icon className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`} />
      {children}
    </button>
  );
}
