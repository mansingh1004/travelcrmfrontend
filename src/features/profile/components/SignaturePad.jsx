// src/features/profile/components/SignaturePad.jsx
//
// A hand-rolled signature surface. ~100 lines of pointer events on a <canvas> and no dependency —
// the libraries that do this add a bundle for behaviour that is a few dozen lines, and none of
// them trim the export, which is the part that actually determines whether the signature looks
// right in a PDF.
//
// Draws nothing but ink on transparency, and exports a TRIMMED transparent PNG.

import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Eraser as FiEraser, Undo2 as FiUndo } from "lucide-react";

/* Backing-store multiplier, CAPPED.
   A canvas sized to its CSS pixels is visibly pixelated by the time it reaches print, so the
   backing store is oversampled. But dpr * 2 unbounded is a trap: on a 3x phone that is 6x, and a
   640x160 CSS canvas becomes 3840x960 — around 15MB of RGBA for this one, far worse for a larger
   box. Some mobile Safari builds quietly refuse the allocation and hand back a BLANK canvas, which
   surfaces to the user as "my signature saved empty".
   4x of a 640px-wide box is 2560px, comfortably past 300dpi at the size a signature occupies on a
   page. Past that is memory spent on detail no printer resolves. */
const MAX_SCALE = 4;
const scaleFor = () => Math.min((window.devicePixelRatio || 1) * 2, MAX_SCALE);

const INK = "#0f172a";        // slate-900. Near-black reads as ink; pure black looks printed.
const MIN_W = 1.1;
const MAX_W = 2.8;
const V_REF = 2.2;            // px/ms at which the stroke reaches its thinnest
const TRIM_PAD = 8;           // CSS px of breathing room kept around the ink on export

/* Alpha above which a pixel counts as ink.
   NOT > 0. Antialiasing leaves a halo of alpha 1-8 well outside the visible stroke, so a zero
   threshold finds "ink" almost everywhere and the trim box comes back barely smaller than the
   canvas — i.e. the trim silently does nothing, which is the whole failure this component exists
   to avoid. ~5% keeps the soft edge of a real stroke and rejects the halo. */
const INK_ALPHA = 12;

/* Below this, an export is refused as an accident rather than a signature. A stray tap produces a
   handful of pixels which would export as a speck and render as a smudge on the document. */
const MIN_INK_PIXELS = 60;

export default function SignaturePad({ ref, disabled = false, onDirtyChange }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  /* Strokes are the model; the canvas is only a view of them.
     Every point is in CSS pixels, so the model is resolution-independent — that is what lets a
     resize or a DPI change replay losslessly, and what makes undo a pop rather than a redraw hack
     over saved bitmaps. */
  const strokes = useRef([]);
  const current = useRef(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const markDirty = useCallback(() => {
    const empty = strokes.current.length === 0;
    setIsEmpty(empty);
    onDirtyChange?.(!empty);
  }, [onDirtyChange]);

  /* Full repaint from the model.
     Declared BEFORE resize, which calls it — a const is in its temporal dead zone until its own
     line runs, so the other order only works by accident of when the effect happens to fire.
     NEVER fills a background. The canvas stays transparent end to end — a white rectangle pasted
     into a PDF footer covers the layout underneath it, and that is invisible until someone opens
     the finished document. */
  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    strokes.current.forEach((stroke) => drawStroke(ctx, stroke));
  }, []);

  /* Size the backing store and put the context into CSS-pixel space.
     After setTransform every draw call below can use CSS coordinates directly and forget the
     device ratio exists. Called on mount and on every resize — and it must repaint, because
     assigning canvas.width wipes the surface. */
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const scale = scaleFor();
    const { width, height } = wrap.getBoundingClientRect();
    if (!width || !height) return;

    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = INK;
    repaint();
  }, [repaint]);

  useEffect(() => {
    resize();
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => resize());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [resize]);

  /* ── Pointer handling ──────────────────────────────────────────────────────────────────────
     POINTER events, not mouse events: finger, stylus and mouse all arrive through this one path,
     with pressure and tilt available if ever wanted. A mouse-event implementation needs a parallel
     touch implementation and the two drift.
     setPointerCapture means a stroke that wanders off the canvas still ends correctly instead of
     leaving the pad stuck in drawing mode. */
  const pointFrom = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      t: event.timeStamp,
      w: MAX_W,
    };
  };

  const onPointerDown = (event) => {
    if (disabled) return;
    event.preventDefault();
    canvasRef.current.setPointerCapture?.(event.pointerId);
    current.current = [pointFrom(event)];
  };

  const onPointerMove = (event) => {
    if (disabled || !current.current) return;
    event.preventDefault();
    const points = current.current;
    const prev = points[points.length - 1];
    const next = pointFrom(event);

    // Drop sub-pixel jitter: it adds points that cannot be seen and only destabilises the width.
    const dist = Math.hypot(next.x - prev.x, next.y - prev.y);
    if (dist < 0.7) return;

    /* Width from speed. A fast stroke thins, a slow one thickens — which is what a pen does, and
       what stops the result reading as a uniform-weight cartoon. Exponentially smoothed against
       the previous width so a single erratic sample cannot produce a visible blob. */
    const dt = Math.max(next.t - prev.t, 1);
    const speed = Math.min(dist / dt / V_REF, 1);
    const target = MAX_W - (MAX_W - MIN_W) * speed;
    next.w = prev.w * 0.6 + target * 0.4;

    points.push(next);
    // Draw only the new segment. Repainting the whole stroke on every move is quadratic and shows
    // as lag on a long signature.
    drawSegment(canvasRef.current.getContext("2d"), points, points.length - 1);
  };

  const endStroke = () => {
    if (!current.current) return;
    // A tap with no movement is still a legitimate mark (a dot on an i), so it is kept.
    strokes.current = [...strokes.current, current.current];
    current.current = null;
    markDirty();
  };

  /* useCallback because the imperative handle below exposes it, and an unstable identity there
     would hand the parent a new object on every render. */
  const clear = useCallback(() => {
    strokes.current = [];
    current.current = null;
    repaint();
    markDirty();
  }, [repaint, markDirty]);

  const undo = () => {
    strokes.current = strokes.current.slice(0, -1);
    repaint();
    markDirty();
  };

  /* ── EXPORT: the part that matters ─────────────────────────────────────────────────────────
     Returns a trimmed transparent PNG Blob, or null if there is nothing worth exporting.

     Trimming is not a nicety. The PDF drops the image into a fixed slot and scales it to fit, so
     an untrimmed 640x160 export whose ink occupies the middle third arrives as a signature
     rendered at a third of its slot — tiny, floating, and obviously wrong. Cropping to the ink
     means the slot is filled by ink.

     Reads ALPHA ONLY. The ink is a single colour on transparency, so alpha alone separates
     foreground from background and there is no need to touch RGB. */
  const exportBlob = useCallback(async () => {
    if (strokes.current.length === 0) return null;

    const scale = scaleFor();
    const wrap = wrapRef.current;
    const { width: cssW, height: cssH } = wrap.getBoundingClientRect();

    /* Rendered fresh offscreen rather than read from the visible canvas. The on-screen surface can
       carry a focus ring or a guide line depending on browser and state; the export must be a
       function of the stroke model and nothing else. */
    const src = document.createElement("canvas");
    src.width = Math.round(cssW * scale);
    src.height = Math.round(cssH * scale);
    const sctx = src.getContext("2d");
    sctx.setTransform(scale, 0, 0, scale, 0, 0);
    sctx.lineCap = "round";
    sctx.lineJoin = "round";
    sctx.strokeStyle = INK;
    strokes.current.forEach((stroke) => drawStroke(sctx, stroke));

    /* Bounding box in BACKING-STORE pixels — this is the easy thing to get wrong. getImageData
       works on the device grid, not the CSS grid, so the loop bounds and the resulting box are
       both in device pixels and the padding has to be scaled to match. */
    const { data } = sctx.getImageData(0, 0, src.width, src.height);
    let minX = src.width;
    let minY = src.height;
    let maxX = -1;
    let maxY = -1;
    let inkPixels = 0;

    for (let y = 0; y < src.height; y += 1) {
      for (let x = 0; x < src.width; x += 1) {
        // +3 is the alpha byte of the RGBA quad.
        if (data[(y * src.width + x) * 4 + 3] > INK_ALPHA) {
          inkPixels += 1;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    // Empty, or an accidental dot. Refused rather than exported as a speck.
    if (maxX < 0 || inkPixels < MIN_INK_PIXELS) return null;

    const pad = Math.round(TRIM_PAD * scale);
    const sx = Math.max(0, minX - pad);
    const sy = Math.max(0, minY - pad);
    const sw = Math.min(src.width, maxX + pad + 1) - sx;
    const sh = Math.min(src.height, maxY + pad + 1) - sy;

    const out = document.createElement("canvas");
    out.width = sw;
    out.height = sh;
    // 1:1 copy — no resampling, so the oversampled detail survives intact into the file.
    out.getContext("2d").drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);

    return new Promise((resolve) => {
      // PNG, never JPEG: JPEG has no alpha channel and would composite the transparency to black.
      out.toBlob((blob) => resolve(blob), "image/png");
    });
  }, []);

  useImperativeHandle(ref, () => ({ exportBlob, clear, isEmpty: () => strokes.current.length === 0 }),
    [exportBlob, clear]);

  return (
    <div>
      <div
        ref={wrapRef}
        className="relative w-full overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-white"
        /* 4:1. Signatures are wide; a square box makes people cramp theirs into a corner and the
           trimmed export ends up a fraction of the width it should be. */
        style={{ aspectRatio: "4 / 1", maxWidth: 640 }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerLeave={endStroke}
          onPointerCancel={endStroke}
          /* touch-action:none is load-bearing. Without it the browser claims the gesture for
             scrolling and the page slides around under the finger while someone tries to sign —
             on a phone the pad is simply unusable. */
          className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
          style={{ touchAction: "none" }}
        />
        {isEmpty && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1">
            <span className="text-xs font-semibold text-slate-300">Sign here</span>
            <span className="text-[10px] text-slate-300">Use a finger, stylus or mouse</span>
          </div>
        )}
        {/* Signing line, drawn in the DOM rather than on the canvas — anything painted on the
            canvas would be picked up by the alpha scan and trimmed into the exported PNG. */}
        <div className="pointer-events-none absolute inset-x-6 bottom-5 border-b border-slate-200" />
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button" onClick={undo} disabled={disabled || isEmpty}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-blue-300 hover:text-blue-600 disabled:opacity-40"
        >
          <FiUndo className="h-3.5 w-3.5" /> Undo
        </button>
        <button
          type="button" onClick={clear} disabled={disabled || isEmpty}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-red-300 hover:text-red-500 disabled:opacity-40"
        >
          <FiEraser className="h-3.5 w-3.5" /> Clear
        </button>
      </div>
    </div>
  );
}

/* ── Rendering helpers ────────────────────────────────────────────────────────────────────────
   Kept outside the component: they are pure functions of (context, points) and re-creating them
   per render would be noise.

   Midpoint-quadratic smoothing. The curve passes through the midpoint of each pair of samples,
   using the sample itself as the control point, so curvature stays continuous. Straight lines
   between raw samples produce the seismograph look — visibly polygonal wherever the hand moved
   quickly, which is exactly where a signature has its character. */
function drawSegment(ctx, points, index) {
  if (index < 1) return;
  const p0 = points[index - 1];
  const p1 = points[index];

  if (index === 1) {
    ctx.beginPath();
    ctx.lineWidth = p1.w;
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
    return;
  }

  const prev = points[index - 2];
  const from = { x: (prev.x + p0.x) / 2, y: (prev.y + p0.y) / 2 };
  const to = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };

  /* One path per segment, because the width changes per segment and lineWidth applies to a whole
     path. Round caps and joins make the seams between segments invisible. */
  ctx.beginPath();
  ctx.lineWidth = p1.w;
  ctx.moveTo(from.x, from.y);
  ctx.quadraticCurveTo(p0.x, p0.y, to.x, to.y);
  ctx.stroke();
}

function drawStroke(ctx, points) {
  if (points.length === 1) {
    // A lone tap: a dot, sized to the pen. Without this an "i" loses its dot on repaint.
    const p = points[0];
    ctx.beginPath();
    ctx.fillStyle = INK;
    ctx.arc(p.x, p.y, MAX_W / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  for (let i = 1; i < points.length; i += 1) drawSegment(ctx, points, i);
}
