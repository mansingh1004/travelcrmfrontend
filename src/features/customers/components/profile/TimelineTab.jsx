import {
  ArrowDownLeft, ArrowUpRight, History, MessageSquare, Phone, Plane, Receipt,
} from "lucide-react";

import Pager from "@shared/ui/Pager";

import {
  EmptyState, GLYPH_TONE, SectionCard, SectionError, TIMELINE_TONE, TimelineSkeleton, fmtDateTime,
} from "./profileUi";
import { useClientPage } from "./profilePaging";

/**
 * The customer's activity timeline.
 *
 * The narrative here is `LeadLog` — the only place in the product where a person types what
 * actually happened. Booking and payment milestones are folded in around it so the money and the
 * conversation read as one story.
 *
 * It is deliberately NOT an audit log. `activity_logs` has no entity id and no entity type; its
 * description is a generated "Update — Controller.method [PUT /api/…]" string and reads are never
 * recorded. Nothing here comes from it.
 */
/** Glyph per entry kind. The COLOUR for each lives in profileTokens (TIMELINE_TONE). */
const KIND_ICON = {
  LEAD_LOG: MessageSquare,
  BOOKING_CREATED: Plane,
  PAYMENT_RECEIVED: ArrowDownLeft,
  REFUND_ISSUED: ArrowUpRight,
  INVOICE_ISSUED: Receipt,
};

/** A "Call"/"WhatsApp" activityKind gets its own glyph; anything else keeps the lead-log default. */
const ACTIVITY_ICON = { CALL: Phone, WHATSAPP: MessageSquare, MEETING: MessageSquare };

export default function TimelineTab({ state, onOpenRef }) {
  const { data, loading, error, reload } = state;
  const entries = Array.isArray(data) ? data : [];
  // 100 entries by default from the server (bounded at 500), so this only ever bites the busiest
  // customers — but when it does, it is 500 list items in one DOM.
  const paged = useClientPage(entries, 50);

  return (
    <SectionCard
      icon={History}
      title="Activity timeline"
      description="What was said and what was paid, newest first"
    >
      {loading ? <TimelineSkeleton rows={5} /> : error ? <SectionError error={error} onRetry={reload} />
        : entries.length === 0 ? (
          <EmptyState
            icon={History}
            title="Nothing recorded yet"
            hint="Notes agents add against this customer's enquiries appear here, alongside booking and payment events."
          />
        ) : (
          <>
          <ol className="relative px-5 py-5">
            {/* The rail. Inset to sit behind the glyphs, not through the text. */}
            <span aria-hidden className="absolute bottom-6 left-[2.1rem] top-8 w-px bg-slate-200" />

            {paged.slice.map((entry, index) => {
              const plate = GLYPH_TONE[TIMELINE_TONE[entry.kind]] || GLYPH_TONE.slate;
              const KindGlyph = KIND_ICON[entry.kind] || History;
              const ActivityGlyph = entry.kind === "LEAD_LOG"
                ? (ACTIVITY_ICON[String(entry.activityKind || "").toUpperCase()] || KindGlyph)
                : KindGlyph;

              return (
                <li key={`${entry.kind}-${entry.occurredAt}-${index}`} className="relative flex gap-4 pb-6 last:pb-0">
                  <span className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-4 ring-white ${plate}`}>
                    <ActivityGlyph className="h-4 w-4" />
                  </span>

                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <p className="text-sm font-bold text-slate-800">{entry.title}</p>
                      {entry.refLabel && (
                        <button
                          type="button"
                          onClick={() => onOpenRef(entry.refType, entry.refPublicId)}
                          disabled={!entry.refPublicId}
                          className="text-xs font-bold text-blue-700 hover:underline disabled:text-slate-400 disabled:no-underline"
                        >
                          {entry.refLabel}
                        </button>
                      )}
                    </div>

                    {entry.body && (
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{entry.body}</p>
                    )}

                    <p className="mt-1.5 text-xs text-slate-500">
                      {fmtDateTime(entry.occurredAt)}
                      {entry.actorName ? ` · ${entry.actorName}` : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="border-t border-slate-100 px-4">
            <Pager {...paged} label="entries" />
          </div>
          </>
        )}
    </SectionCard>
  );
}
