// features/operations/components/VendorConversationDrawer.jsx
// ─────────────────────────────────────────────────────────────────────────────
// One side panel for talking to a supplier about one service line — the same
// shape the lead and customer drawers use, so an operator meets one pattern
// across the product instead of a dialog here and a drawer there.
//
// WHY IT HOSTS THE TWO COMPOSERS RATHER THAN REPLACING THEM
//
// A supplier message is not a generic message. Sending one moves the line
// PENDING → REQUESTED, can write a release date, and on WhatsApp has to respect
// Meta's 24-hour window and fall back to a device link — none of which a generic
// composer produces. That is exactly why the Communication Center is read-only on
// VENDOR threads (analysis §7 Q5): a second, statusless send path would drift
// from this one within a release and leave the board reporting lines as
// never-contacted that had been chased twice.
//
// So the composers keep every line of their send logic and this file owns only
// the chrome: the overlay, the header, the tabs, Escape and the close button.
// They render with `embedded`, which drops their own dialog frame.
//
// WHAT THIS DELIBERATELY DOES NOT DO
//
// It does not add a third channel. Calls are logged through LogCallModal and
// stay that way: the CRM never places a call, and a "Call" tab next to two that
// really do send would imply it does.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { Mail, MessageCircle, X } from "lucide-react";

import VendorEmailModal from "./VendorEmailModal";
import VendorWhatsAppModal from "./VendorWhatsAppModal";

const FONT = { fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" };

function Tab({ active, onClick, icon: Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11.5px] font-bold transition-colors ${
        active
          ? "bg-white text-slate-800 shadow-sm ring-1 ring-slate-200"
          : "text-slate-500 hover:text-slate-700"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

/**
 * @param initialChannel which tab opens first. The board's row actions know which button was
 *        pressed, and landing on the other channel would make the operator switch back every time.
 */
export default function VendorConversationDrawer({
  bookingPublicId,
  line,
  initialChannel = "WHATSAPP",
  onSent,
  onClose,
}) {
  const [channel, setChannel] = useState(initialChannel);

  /* Escape closes the drawer, and it lives HERE rather than in the composers: with both mounted
     the modal versions would each register a handler and the first Escape would fire two closes.
     The composers only bind their own when they are not embedded. */
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const vendorName = line?.vendorName || "Supplier";

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/20" onClick={onClose} />

      <aside
        style={{ ...FONT, width: "clamp(380px, 38vw, 560px)" }}
        className="fixed top-0 right-0 h-full z-50 flex flex-col bg-white border-l border-slate-200 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* The supplier and the line, because the board has many of both and a panel that named
            only one of them would be ambiguous on every booking with two hotels. */}
        <header className="flex items-start gap-3 px-4 py-3 border-b border-slate-200">
          <div className="flex-1 min-w-0">
            <h2 className="text-[14px] font-extrabold text-slate-800 truncate">{vendorName}</h2>
            <p className="text-[11px] text-slate-500 font-medium truncate">{line?.title}</p>
          </div>
          {line?.status && (
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5 flex-shrink-0">
              {line.status}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            title="Close (Esc)"
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex items-center gap-1 px-3 py-2 bg-slate-50 border-b border-slate-200">
          <Tab active={channel === "WHATSAPP"} onClick={() => setChannel("WHATSAPP")}
               icon={MessageCircle} label="WhatsApp" />
          <Tab active={channel === "EMAIL"} onClick={() => setChannel("EMAIL")}
               icon={Mail} label="Email" />
        </div>

        {/*
          Keyed on the channel so switching tabs REMOUNTS the composer.
          Deliberate: each one fetches its own server-built draft on mount, and a retained
          instance would show the previous channel's recipient and body until its effect caught
          up — on a panel whose whole job is "send the right thing to the right supplier", a
          stale To field is the one mistake that cannot be taken back.
        */}
        {channel === "WHATSAPP" ? (
          <VendorWhatsAppModal
            key="whatsapp"
            embedded
            bookingPublicId={bookingPublicId}
            line={line}
            onSent={onSent}
            onClose={onClose}
          />
        ) : (
          <VendorEmailModal
            key="email"
            embedded
            bookingPublicId={bookingPublicId}
            line={line}
            onSent={onSent}
            onClose={onClose}
          />
        )}
      </aside>
    </>
  );
}
