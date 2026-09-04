// src/console/components/TenantNotes.jsx
// ─────────────────────────────────────────────────────────────────────────────
// What was said, next to what was done.
//
// The tenant detail page could already show everything a tenant DID — leads, last
// login, invoices, quota. It could not show anything that was SAID. So an operator
// rings an agency that went quiet, learns their ops lead is on leave for a month,
// and that fact lives in their own head until the health list flags the same
// tenant next week and somebody makes the same call again.
//
// PLATFORM-PRIVATE. These notes are written about the tenant, not for them, and
// there is no tenant-facing endpoint that can read them.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageSquarePlus, Trash2 } from "lucide-react";

import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { toast } from "@shared/ui/toast";

import { tenantNoteService } from "../api/platformHealthService";
import { ConsolePanel } from "./ConsoleUi";

function when(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function TenantNotes({ tenantPublicId }) {
  const [notes, setNotes] = useState([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setNotes(await tenantNoteService.list(tenantPublicId));
    } catch {
      // The panel says it is empty and the interceptor has already toasted anything
      // the operator can act on. A second toast for a background list is noise.
      setNotes([]);
    }
    setLoading(false);
  }, [tenantPublicId]);

  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    const text = body.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      const created = await tenantNoteService.add(tenantPublicId, text);
      // Prepend rather than refetch: the list is newest-first and the server just told us the row.
      setNotes((rows) => [created, ...rows]);
      setBody("");
    } catch (err) {
      // 400 is silent by contract (shared/api/authRealm) — the call site renders it or nobody does.
      if (!isAlreadyReported(err)) toast.error(getErrorMessage(err, "Could not save the note."));
    }
    setSaving(false);
  };

  const remove = async (note) => {
    const previous = notes;
    // Optimistic, and restored on failure. A note is cheap to re-render and the alternative is a
    // list that sits unchanged for a round trip after a click that clearly did something.
    setNotes((rows) => rows.filter((n) => n.publicId !== note.publicId));
    try {
      await tenantNoteService.remove(tenantPublicId, note.publicId);
    } catch (err) {
      setNotes(previous);
      if (!isAlreadyReported(err)) toast.error(getErrorMessage(err, "Could not remove the note."));
    }
  };

  return (
    <ConsolePanel
      title="Notes"
      description={
        loading ? "Loading…"
          : notes.length === 0
            ? "Nothing recorded yet. Only the platform can see these."
            : `${notes.length} note(s) · visible to the platform only`
      }
    >
      <form onSubmit={submit} className="border-b border-border px-5 py-4">
        <label className="sr-only" htmlFor="tenant-note">Add a note</label>
        <textarea
          id="tenant-note"
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={4000}
          placeholder="What did you discuss? e.g. Called 3 Sep — ops lead on leave until the 20th, will resume then."
          className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm text-body placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-xs text-muted">Never shown to the tenant.</span>
          <button
            type="submit"
            disabled={saving || !body.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <MessageSquarePlus size={13} />}
            Add note
          </button>
        </div>
      </form>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted" /></div>
      ) : notes.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted">
          The next person to open this page will see what you write here.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {notes.map((note) => (
            <li key={note.publicId} className="group flex items-start gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap break-words text-sm text-body">{note.body}</p>
                <p className="mt-1 text-xs text-muted">
                  {note.author || "Unknown"} · {when(note.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(note)}
                aria-label="Remove note"
                className="shrink-0 rounded-lg p-1.5 text-muted opacity-0 transition-opacity hover:bg-surface-hover hover:text-hue-rose focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent group-hover:opacity-100"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </ConsolePanel>
  );
}
