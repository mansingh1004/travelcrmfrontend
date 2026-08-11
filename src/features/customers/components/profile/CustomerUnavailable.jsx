import { AlertTriangle, ArrowLeft, Trash2 } from "lucide-react";

import { FONT, FOCUS_RING } from "./profileUi";

/**
 * The page when there is no customer to show.
 *
 * Covers three different situations with one card, because from the client they are barely
 * distinguishable: a malformed link, a load failure, and a customer that no longer exists.
 *
 * The Trash offer is the interesting part. A soft-deleted customer 404s exactly like one that never
 * existed — the API returns no signal separating the two (listed as a backend dependency). Rather
 * than assert something it cannot know, the card raises Trash as a POSSIBILITY, in those words, and
 * only to someone who can actually open it. Saying "this customer was deleted" would be a guess
 * presented as a fact, and would send people hunting through Trash for a record that was never
 * there.
 */
export default function CustomerUnavailable({ message, notFound, canViewTrash, onBack, onOpenTrash }) {
  const offerTrash = notFound && canViewTrash;

  return (
    <div className="mx-auto flex min-h-[65vh] max-w-xl items-center justify-center px-4" style={{ fontFamily: FONT }}>
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
          <AlertTriangle className="h-6 w-6" />
        </span>

        <h1 className="mt-4 text-xl font-extrabold text-slate-900">Customer unavailable</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {message || "The customer could not be found."}
        </p>

        {offerTrash && (
          <p className="mt-3 text-sm leading-6 text-slate-500">
            If this customer was deleted, it will be in Trash for 30 days.
          </p>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={onBack}
            className={`inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 ${FOCUS_RING}`}>
            <ArrowLeft className="h-4 w-4" /> Back to customers
          </button>
          {offerTrash && (
            <button type="button" onClick={onOpenTrash}
              className={`inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 ${FOCUS_RING}`}>
              <Trash2 className="h-4 w-4" /> Open Trash
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
