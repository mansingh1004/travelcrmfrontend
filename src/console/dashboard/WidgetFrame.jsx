// src/console/dashboard/WidgetFrame.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The shell every configurable panel renders inside.
//
// The frame owns the card, the border, the shadow, the header, the grip, the
// menu and the empty/error states. A widget body renders CONTENT ONLY — which is
// what makes design-system compliance structural rather than a matter of each
// author remembering. The console already carries three near-duplicate metric
// tiles from the alternative.
//
// Zero hex anywhere in here: semantic tokens only, so `.dark` and the runtime
// `sa-brand` accent override both keep working with no extra code.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { ChevronUp, ChevronDown, GripVertical, MoreHorizontal, X } from "lucide-react";

export default function WidgetFrame({
  widget, editing, grabbed, handleProps, onMoveUp, onMoveDown, onMoveTop, onRemove, children,
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <section
      data-widget-id={widget.id}
      className={`overflow-hidden rounded-2xl border bg-surface shadow-[var(--sa-card-shadow)] transition-shadow ${
        grabbed ? "border-accent ring-2 ring-accent" : "border-border"
      }`}
      aria-label={widget.title}
    >
      <header className="flex items-center gap-2 border-b border-border px-5 py-3">
        {editing && (
          <span
            {...handleProps}
            className="-ml-1 shrink-0 rounded p-1 text-muted hover:bg-surface-hover hover:text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <GripVertical size={14} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-heading">{widget.title}</h3>
          {widget.blurb && <p className="truncate text-xs text-muted">{widget.blurb}</p>}
        </div>

        {editing && (
          <div className="relative shrink-0">
            {/* The third way to move a panel, and on a desktop usually the fastest for a one-slot
                nudge. It is also the only path guaranteed to work on every input device, which is
                why it exists alongside the drag rather than instead of it. */}
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={`Options for ${widget.title}`}
              aria-expanded={menuOpen}
              className="rounded-lg p-1.5 text-muted hover:bg-surface-hover hover:text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <MoreHorizontal size={15} />
            </button>
            {menuOpen && (
              <>
                <button
                  type="button"
                  aria-hidden="true"
                  tabIndex={-1}
                  onClick={() => setMenuOpen(false)}
                  className="fixed inset-0 z-10 cursor-default"
                />
                <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg">
                  <MenuItem Icon={ChevronUp} label="Move up" onClick={() => { onMoveUp(); setMenuOpen(false); }} />
                  <MenuItem Icon={ChevronDown} label="Move down" onClick={() => { onMoveDown(); setMenuOpen(false); }} />
                  <MenuItem Icon={ChevronUp} label="Move to top" onClick={() => { onMoveTop(); setMenuOpen(false); }} />
                  <MenuItem Icon={X} label="Remove" danger onClick={() => { onRemove(); setMenuOpen(false); }} />
                </div>
              </>
            )}
          </div>
        )}
      </header>

      {children}
    </section>
  );
}

function MenuItem({ Icon, label, onClick, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-surface-hover focus-visible:outline-none focus-visible:bg-surface-hover ${
        danger ? "text-hue-rose" : "text-body"
      }`}
    >
      <Icon size={13} /> {label}
    </button>
  );
}
