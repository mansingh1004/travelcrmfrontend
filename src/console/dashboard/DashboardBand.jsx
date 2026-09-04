// src/console/dashboard/DashboardBand.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The configurable band: add, remove and reorder panels, saved per operator.
//
// ── What is NOT configurable, and why ───────────────────────────────────────
// Everything above this band — the attention strip, the hero, the seven cards,
// the tenant health list, the activation funnel, the action inbox — is fixed.
//
// An operator may hide INFORMATION. An operator may not hide ACCOUNTABILITY. A
// dashboard where the queue of things waiting on you can be switched off is not
// a customisable dashboard, it is a way to stop seeing work. So this band holds
// the panels that are genuinely a matter of taste, and the ones that are not
// stay where they are.
//
// ── Storage ────────────────────────────────────────────────────────────────
// Server-side, keyed on the SuperAdmin. Not localStorage: several people share
// this console, and on a shared workstation localStorage would hand the next
// person the previous operator's arrangement of what needs attention.
// ─────────────────────────────────────────────────────────────────────────────

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Check, Layers, Loader2, Plus, Settings2, X } from "lucide-react";

import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { toast } from "@shared/ui/toast";

import { uiStateService } from "../api/platformHealthService";
import WidgetFrame from "./WidgetFrame";
import useReorderableList from "./useReorderableList";
import {
  DEFAULT_WIDGET_IDS, SPAN, WIDGETS, assertRegistryIntegrity, resolveWidgets,
} from "./widgetRegistry";

const STATE_KEY = "dashboard";
const STATE_VERSION = 1;

assertRegistryIntegrity();

export default function DashboardBand({ data }) {
  const [ids, setIds] = useState(DEFAULT_WIDGET_IDS);
  const [editing, setEditing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  /* Set the moment the operator changes anything. The saved layout arrives asynchronously and must
     not land on top of a change made while it was in flight — the operator would watch their own
     edit get undone by a response to a request they never made. */
  const touched = useRef(false);

  /* The band renders IMMEDIATELY, with the defaults, and the saved layout swaps in when it arrives.
     It used to sit behind a loading gate that hid the whole thing — header, Customise button and
     all — until the fetch came back. A slow or failing request therefore made the entire feature
     invisible with nothing on screen to explain why, which is a worse failure than briefly showing
     the wrong two panels: the defaults are known here, so there is nothing to wait for. */
  useEffect(() => {
    let cancelled = false;
    uiStateService.get(STATE_KEY)
      .then((state) => {
        if (cancelled || touched.current || !state?.stateJson) return;
        try {
          const parsed = JSON.parse(state.stateJson);
          if (Array.isArray(parsed?.widgets)) setIds(parsed.widgets);
        } catch {
          // A corrupt document must not blank the band. Keep the defaults on screen and let the
          // next save overwrite it — the alternative is a page the operator cannot fix from the UI.
        }
      })
      .catch(() => {
        // Nothing to do: the defaults are already rendered. The interceptor has toasted anything
        // the operator can act on, and a second message about a layout they can still change is
        // noise.
      });
    return () => { cancelled = true; };
  }, []);

  const persist = useCallback(async (next) => {
    touched.current = true;
    setIds(next);
    try {
      await uiStateService.save(STATE_KEY, JSON.stringify({ widgets: next }), STATE_VERSION);
    } catch (err) {
      if (!isAlreadyReported(err)) toast.error(getErrorMessage(err, "Could not save the layout."));
    }
  }, []);

  const { order, grabbedId, handleProps, move, moveTo, liveMessage } =
    useReorderableList({ items: ids, onCommit: persist, editing });

  const { render, unknown } = resolveWidgets(order);

  const add = (id) => persist([...order, id]);
  const remove = (id) => persist(order.filter((w) => w !== id));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted">
          <Layers size={14} />
          <span>Your panels</span>
          {/* Held, not dropped. See resolveWidgets — a widget missing because of a rollback comes
              back on its own, and pruning it would let an outage silently rewrite the layout. */}
          {unknown.length > 0 && (
            <span className="rounded bg-surface-hover px-1.5 py-0.5 text-[11px] font-medium">
              {unknown.length} panel(s) not in this build, kept
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {editing && (
            <button type="button" onClick={() => setPickerOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-body hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              <Plus size={13} /> Add panel
            </button>
          )}
          <button type="button" onClick={() => { setEditing((v) => !v); setPickerOpen(false); }}
            aria-pressed={editing}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              editing ? "bg-accent text-white shadow-sm" : "border border-border bg-surface text-body hover:bg-surface-hover"
            }`}>
            {editing ? <><Check size={13} /> Done</> : <><Settings2 size={13} /> Customise</>}
          </button>
        </div>
      </div>

      {/* Announces every move. Without it the keyboard path moves things silently, which is the same
          as not having one. */}
      <span aria-live="polite" className="sr-only">{liveMessage}</span>

      {render.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center">
          <p className="text-sm font-semibold text-heading">No optional panels on your dashboard.</p>
          <p className="mt-1 text-xs text-muted">
            Everything above stays regardless — this band is for what you personally want to keep an eye on.
          </p>
          <button type="button" onClick={() => { setEditing(true); setPickerOpen(true); }}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
            <Plus size={13} /> Add a panel
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-4">
          {render.map((widget) => (
            <div key={widget.id} className={SPAN[widget.span] || SPAN[6]}>
              <WidgetFrame
                widget={widget}
                editing={editing}
                grabbed={grabbedId === widget.id}
                handleProps={handleProps(widget.id)}
                onMoveUp={() => move(widget.id, -1)}
                onMoveDown={() => move(widget.id, 1)}
                onMoveTop={() => moveTo(widget.id, 0)}
                onRemove={() => remove(widget.id)}
              >
                <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted" /></div>}>
                  <widget.Component data={data} opts={widget.opts} />
                </Suspense>
              </WidgetFrame>
            </div>
          ))}
        </div>
      )}

      {pickerOpen && (
        <WidgetPicker
          placed={new Set(order)}
          onAdd={(id) => { add(id); setPickerOpen(false); }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * Add a panel.
 *
 * <p>Rendered INLINE rather than through a portal, on purpose. Every console token is declared on
 * `.sa-console` and `@theme inline` compiles `bg-surface` to `var(--sa-surface)` — a portal mounted
 * on document.body sits outside that scope, so every utility resolves to nothing and the sheet
 * renders as an unstyled ghost with no error anywhere. If this ever becomes a portal, its root must
 * carry `className="sa-console"`.
 */
function WidgetPicker({ placed, onAdd, onClose }) {
  const groups = WIDGETS.reduce((acc, w) => {
    if (placed.has(w.id)) return acc;
    (acc[w.group] ||= []).push(w);
    return acc;
  }, {});

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--sa-card-shadow)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-heading">Add a panel</h3>
        <button type="button" onClick={onClose} aria-label="Close"
          className="rounded-lg p-1 text-muted hover:bg-surface-hover hover:text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <X size={15} />
        </button>
      </div>

      {Object.keys(groups).length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Every available panel is already on your dashboard.</p>
      ) : (
        <div className="space-y-4">
          {Object.entries(groups).map(([group, widgets]) => (
            <div key={group}>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{group}</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {widgets.map((w) => {
                  const blocked = w.status === "blocked";
                  return (
                    <button
                      key={w.id}
                      type="button"
                      disabled={blocked}
                      onClick={() => !blocked && onAdd(w.id)}
                      className={`flex items-start gap-2.5 rounded-xl border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                        blocked
                          ? "cursor-not-allowed border-border bg-surface-hover/40 opacity-70"
                          : "border-border hover:border-accent/40 hover:bg-surface-hover"
                      }`}
                    >
                      <span className="mt-0.5 shrink-0 text-muted"><w.icon size={15} /></span>
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-heading">{w.title}</span>
                        <span className="mt-0.5 block text-xs text-muted">{w.blurb}</span>
                        {/* The data-gap audit, rendered. This is why the question stops being asked
                            in a meeting every few months. */}
                        {blocked && (
                          <span className="mt-1.5 block text-[11px] text-hue-orange">{w.blockedReason}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
