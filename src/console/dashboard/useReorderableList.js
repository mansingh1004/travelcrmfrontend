// src/console/dashboard/useReorderableList.js
// ─────────────────────────────────────────────────────────────────────────────
// Drag-to-reorder with no new dependency, and with the keyboard as the PRIMARY
// path rather than the fallback.
//
// ── Why not a library ───────────────────────────────────────────────────────
// framer-motion is already installed and ships Reorder.Group, but it is
// vertical-list-shaped rather than grid-shaped, ships no keyboard reorder, and —
// decisively — the console's panels are `overflow-hidden rounded-2xl`, which
// clips a dragged card. HTML5 drag-and-drop is also out: it never fires from
// touch, and Firefox fires no `drop` when the pointer is released outside the
// window.
//
// ── Three ways to move a panel, and they are not ranked by effort ───────────
//   1. Keyboard on the grip: Enter/Space grabs, arrows move, Escape cancels.
//   2. The panel menu: Move up / Move down / Move to top.
//   3. Pointer drag.
// The keyboard path and the menu are built FIRST and must both work, because
// "accessibility once the drag is polished" is a ticket that never lands.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * @param {string[]} items    ordered ids
 * @param {(next: string[]) => void} onCommit  called with the new order, only when it changed
 * @param {boolean} editing   pointer handlers are inert unless true, so a normal working shift can
 *                            never drag a panel by accident and widget bodies stay clickable
 */
export default function useReorderableList({ items, onCommit, editing }) {
  const [order, setOrder] = useState(items);
  const [grabbedId, setGrabbedId] = useState(null);
  const [liveMessage, setLiveMessage] = useState("");

  /* Rects are snapshotted ONCE at drag start and hit-tested against that snapshot. Recomputing
     getBoundingClientRect on every pointermove is what makes hand-rolled drag feel like mud, and it
     also fights the very reflow the drag is causing. */
  const rects = useRef([]);
  const startOrder = useRef(items);

  useEffect(() => { setOrder(items); }, [items]);

  const move = useCallback((id, delta) => {
    setOrder((current) => {
      const from = current.indexOf(id);
      if (from < 0) return current;
      const to = Math.min(Math.max(from + delta, 0), current.length - 1);
      if (to === from) return current;
      const next = [...current];
      next.splice(to, 0, next.splice(from, 1)[0]);
      setLiveMessage(`Moved to position ${to + 1} of ${next.length}`);
      onCommit(next);
      return next;
    });
  }, [onCommit]);

  const moveTo = useCallback((id, index) => {
    setOrder((current) => {
      const from = current.indexOf(id);
      if (from < 0 || from === index) return current;
      const next = [...current];
      next.splice(index, 0, next.splice(from, 1)[0]);
      setLiveMessage(`Moved to position ${index + 1} of ${next.length}`);
      onCommit(next);
      return next;
    });
  }, [onCommit]);

  /** Props for the grip. A real button, so it is focusable and announced without extra work. */
  const handleProps = useCallback((id) => ({
    role: "button",
    tabIndex: 0,
    "aria-roledescription": "draggable panel",
    "aria-label": "Reorder panel",
    "aria-pressed": grabbedId === id,
    /* touch-action on the GRIP only. Put it on the whole row and the page stops scrolling on a
       phone — a bug that never shows up on the developer's desktop. */
    style: { touchAction: "none", cursor: editing ? "grab" : "default" },

    onKeyDown: (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (grabbedId === id) {
          setGrabbedId(null);
          setLiveMessage("Dropped");
        } else {
          startOrder.current = order;
          setGrabbedId(id);
          setLiveMessage(`Grabbed. Position ${order.indexOf(id) + 1} of ${order.length}. Use arrow keys.`);
        }
        return;
      }
      if (e.key === "Escape" && grabbedId === id) {
        e.preventDefault();
        setOrder(startOrder.current);
        onCommit(startOrder.current);
        setGrabbedId(null);
        setLiveMessage("Cancelled");
        return;
      }
      if (grabbedId !== id) return;
      /* The grid wraps, so up/left and down/right both map honestly onto one index. Pretending the
         two axes are independent would mean an arrow that sometimes does nothing. */
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); move(id, -1); }
      if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); move(id, 1); }
      if (e.key === "Home") { e.preventDefault(); moveTo(id, 0); }
      if (e.key === "End") { e.preventDefault(); moveTo(id, order.length - 1); }
    },

    onPointerDown: (e) => {
      if (!editing || e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      startOrder.current = order;
      setGrabbedId(id);
      rects.current = order.map((otherId) => {
        const el = document.querySelector(`[data-widget-id="${CSS.escape(otherId)}"]`);
        return { id: otherId, rect: el?.getBoundingClientRect() };
      });
    },

    onPointerMove: (e) => {
      if (grabbedId !== id) return;
      // Hit-test the midpoint of each snapshotted rect. Whichever card the pointer is over becomes
      // the target index; the list re-renders and the snapshot deliberately does NOT update.
      const hit = rects.current.find(({ rect }) => rect
        && e.clientX >= rect.left && e.clientX <= rect.right
        && e.clientY >= rect.top && e.clientY <= rect.bottom);
      if (!hit || hit.id === id) return;
      const target = order.indexOf(hit.id);
      if (target >= 0) moveTo(id, target);
    },

    onPointerUp: (e) => {
      if (grabbedId !== id) return;
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      setGrabbedId(null);
      rects.current = [];
    },
  }), [editing, grabbedId, move, moveTo, onCommit, order]);

  return { order, grabbedId, handleProps, move, moveTo, liveMessage };
}
