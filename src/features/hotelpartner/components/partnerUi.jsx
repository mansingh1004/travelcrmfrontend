/**
 * Local UI primitives for the hotel-partner registration form.
 *
 * Feature-local by the repo's rule — kits are never imported across features. The idiom follows
 * `marketplaceUi.jsx` (the Notion/Linear north star) because it is the only kit whose Row is
 * mobile-first by construction: stacked on a phone, two-column from `sm:` up. That matters more here
 * than anywhere else in the app — the person filling this in is a non-technical hotel owner on a
 * phone, not a CRM user at a desk.
 *
 * This page renders OUTSIDE the app Layout and outside `.sa-console`, so neither the tenant kit's
 * gradient shell nor the console's semantic tokens apply. Everything is plain Tailwind, and the font
 * is set explicitly by <Page> — the app sets no global font-family.
 */
import { useRef, useState } from "react";
import { ImagePlus, Loader2, Minus, Plus, Star, Trash2 } from "lucide-react";

export const FONT = "'Plus Jakarta Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";

/**
 * `text-base` is 16px and that is load-bearing, not a preference: iOS Safari auto-zooms into any
 * field whose computed font-size is below 16px, and on a form this long the page then jumps on
 * every single tap. (It used to be 15px here, which is exactly one pixel into that behaviour.)
 *
 * `min-h-11` is the 44px touch target from the iOS/Material guidelines — a select at the default
 * 40px is a miss-and-retry on a phone.
 */
export const inputCls =
  "w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base text-slate-800 " +
  "placeholder-slate-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 " +
  "disabled:bg-slate-50 disabled:text-slate-500";

export function Page({ children }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900" style={{ fontFamily: FONT }}>
      {children}
    </div>
  );
}

/**
 * A form section.
 *
 * `id` doubles as the scroll-spy anchor, so `scroll-mt` has to clear whatever is sticky above it:
 * header + section chips on a phone, header only from `lg:` where the nav moves into the sidebar.
 */
export function Card({ id, title, hint, right, children }) {
  return (
    <section
      id={id}
      className="scroll-mt-32 rounded-2xl border border-slate-200 bg-white shadow-sm lg:scroll-mt-24"
    >
      {title && (
        <header className="flex items-start gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-bold text-slate-900">{title}</h2>
            {hint && <p className="mt-0.5 text-[13px] leading-snug text-slate-500">{hint}</p>}
          </div>
          {right}
        </header>
      )}
      <div className="space-y-4 p-4 sm:p-5">{children}</div>
    </section>
  );
}

/**
 * Stacked on a phone, label-left from `sm:` up.
 *
 * Rendered as a <label> so the whole label text is part of the control's tap target — on a phone
 * that roughly doubles the area a shaky thumb can hit.
 */
export function Row({ label, hint, required, error, children }) {
  return (
    <label className="flex flex-col gap-1.5 sm:flex-row sm:gap-4">
      <span className={`text-[13px] font-semibold sm:w-44 sm:shrink-0 sm:pt-3 ${error ? "text-rose-600" : "text-slate-700"}`}>
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
        {hint && <span className="block text-[12px] font-normal text-slate-400">{hint}</span>}
      </span>
      <span className={`min-w-0 flex-1 ${error ? INVALID : ""}`}>
        {children}
        {error && <span className="mt-1 block text-[12px] font-semibold text-rose-600">{error}</span>}
      </span>
    </label>
  );
}

/**
 * Turns whatever control sits inside red, without every caller having to thread an error class into
 * its own input.
 *
 * <p>Descendant variants rather than a prop on each input: this form has inputs, selects and
 * textareas across eight sections, and asking each one to know about validity is how half of them
 * end up not knowing. The wrapper owns it, so marking a field is one prop at the Row.</p>
 */
const INVALID =
  "[&_input]:border-rose-400 [&_input]:ring-rose-100 " +
  "[&_select]:border-rose-400 [&_textarea]:border-rose-400";

/**
 * Label stacked ABOVE the control — for dense grids (rate rows) where Row's side label would leave
 * no usable width on a phone.
 */
export function Field({ label, hint, error, className = "", children }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className={`mb-1 block truncate text-[12px] font-semibold ${error ? "text-rose-600" : "text-slate-600"}`}>
        {label}
        {hint && <span className="ml-1 font-normal text-slate-400">· {hint}</span>}
      </span>
      <span className={`block ${error ? INVALID : ""}`}>{children}</span>
      {error && <span className="mt-1 block text-[12px] font-semibold text-rose-600">{error}</span>}
    </label>
  );
}

export function Btn({ variant = "primary", size = "md", className = "", children, busy, ...rest }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl font-bold transition " +
    "disabled:cursor-not-allowed disabled:opacity-50";
  const sizes = {
    sm: "min-h-9 px-3 py-1.5 text-[13px]",
    md: "min-h-11 px-4 py-2.5 text-[14px]",
  };
  const tones = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
    ghost: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
    danger: "bg-white text-rose-600 border border-rose-200 hover:bg-rose-50",
  };
  return (
    <button
      type="button"
      className={`${base} ${sizes[size]} ${tones[variant]} ${className}`}
      disabled={busy || rest.disabled}
      {...rest}
    >
      {busy && <Loader2 size={15} className="animate-spin" />}
      {children}
    </button>
  );
}

export function Notice({ tone = "info", children }) {
  const tones = {
    info: "border-blue-200 bg-blue-50 text-blue-800",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    error: "border-rose-200 bg-rose-50 text-rose-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };
  return <div className={`rounded-xl border px-4 py-3 text-[14px] leading-relaxed ${tones[tone]}`}>{children}</div>;
}

/** Toggle pill. Used for meal plans and for the amenity quick-picks. */
export function Chip({ on, disabled, onClick, className = "", children }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={on}
      className={`min-h-10 rounded-xl border px-3.5 text-[13px] font-semibold transition
        disabled:cursor-not-allowed disabled:opacity-60 ${
          on
            ? "border-blue-500 bg-blue-50 text-blue-700"
            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
        } ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * Tap-a-star rating.
 *
 * All seven are rendered because the backend accepts 1–7. Offering only five would give a 6- or
 * 7-star property no matching control, and since this form round-trips its own values that would
 * silently rewrite the stored rating on the next save — the same data-loss shape as the lead-source
 * `<select>` documented in CLAUDE.md.
 */
export function Stars({ value, onChange, disabled, max = 7 }) {
  const current = Number(value) || 0;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          aria-label={`${n} star`}
          aria-pressed={current === n}
          onClick={() => onChange(current === n ? "" : n)}
          className="grid h-10 w-9 place-items-center rounded-lg transition hover:bg-amber-50 disabled:hover:bg-transparent"
        >
          <Star
            size={22}
            className={n <= current ? "fill-amber-400 text-amber-400" : "text-slate-300"}
          />
        </button>
      ))}
      <span className="ml-1 text-[13px] font-medium text-slate-500">
        {current ? `${current} star` : "Not rated"}
      </span>
    </div>
  );
}

/**
 * Number input with −/+ buttons.
 *
 * The bare `type="number"` spinners are ~10px tall and unusable with a thumb; the field itself stays
 * typeable so a desktop user is not forced to click seven times.
 */
export function Stepper({ value, onChange, min = 0, max = 99, disabled }) {
  const n = value === "" || value === null || value === undefined ? null : Number(value);
  const step = (by) => {
    const next = Math.min(max, Math.max(min, (n ?? min) + by));
    onChange(String(next));
  };
  const btn =
    "grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white " +
    "text-slate-600 transition hover:bg-slate-50 disabled:opacity-40";
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" className={btn} disabled={disabled || (n ?? min) <= min}
        onClick={() => step(-1)} aria-label="Decrease">
        <Minus size={16} />
      </button>
      <input
        type="number" inputMode="numeric" min={min} max={max} value={value} disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} [appearance:textfield] px-1 text-center font-semibold
                    [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
      />
      <button type="button" className={btn} disabled={disabled || (n ?? min) >= max}
        onClick={() => step(1)} aria-label="Increase">
        <Plus size={16} />
      </button>
    </div>
  );
}

export function ProgressBar({ done, total }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${
          pct === 100 ? "bg-emerald-500" : "bg-blue-600"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/**
 * Photo picker + thumbnail grid. Used for both hotel and room photos.
 *
 * `capture` is deliberately NOT set on the input: omitting it lets the phone offer BOTH the camera
 * and the gallery, and a hotel owner almost always already has the photos.
 *
 * Uploads run one at a time rather than in parallel — a phone on mobile data pushing six 4 MB files
 * at once stalls all six, and sequential uploads let each thumbnail appear as it lands.
 */
export function PhotoUploader({ images, onAdd, onRemove, onMakeMain, onUpload, disabled, showMainBadge }) {
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [at, setAt] = useState([0, 0]);   // [current, total] — "Uploading 2 of 5"
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const pick = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setError("");
    setBusy(true);
    try {
      for (let i = 0; i < files.length; i++) {
        setAt([i + 1, files.length]);
        setPct(0);
        const url = await onUpload(files[i], setPct);
        if (url) onAdd(url);
      }
    } catch (err) {
      setError(err?.message || "Upload failed.");
    } finally {
      setBusy(false);
      setPct(0);
      setAt([0, 0]);
      // Reset so re-picking the SAME file still fires onChange.
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2.5">
      {!disabled && (
        <div>
          {/* Driven by the button below via ref, so it needs no id/label pairing. */}
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple
            className="hidden" onChange={pick} disabled={busy} />
          <button type="button" disabled={busy} onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed
                       border-slate-300 bg-white px-4 py-5 text-[14px] font-semibold text-slate-600
                       transition hover:border-blue-400 hover:bg-blue-50/40 hover:text-blue-600 disabled:opacity-60">
            {busy ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>
                  Uploading {at[1] > 1 ? `${at[0]} of ${at[1]} · ` : ""}{pct}%
                </span>
              </>
            ) : (
              <>
                <ImagePlus size={20} />
                <span>{images.length ? "Add more photos" : "Add photos"}</span>
                <span className="text-[12px] font-normal text-slate-400">
                  JPG, PNG or WebP · up to 5 MB each
                </span>
              </>
            )}
          </button>
        </div>
      )}

      {error && <p className="text-[13px] font-medium text-rose-600">{error}</p>}

      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          {images.map((src, i) => (
            <div key={`${src}-${i}`}
              className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
              <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />

              {showMainBadge && i === 0 && (
                <span className="absolute left-1.5 top-1.5 rounded-md bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  Main
                </span>
              )}

              {!disabled && (
                <>
                  <button type="button" onClick={() => onRemove(i)} aria-label="Remove photo"
                    className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-lg
                               bg-white/95 text-slate-500 shadow-sm transition hover:text-rose-600">
                    <Trash2 size={14} />
                  </button>
                  {/* Reordering by drag is unreliable on touch; one tap to promote is not. */}
                  {showMainBadge && i > 0 && onMakeMain && (
                    <button type="button" onClick={() => onMakeMain(i)}
                      className="absolute inset-x-1.5 bottom-1.5 rounded-lg bg-white/95 py-1 text-[11px]
                                 font-bold text-slate-600 shadow-sm transition hover:text-blue-600">
                      Make main
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Centered({ children }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6" style={{ fontFamily: FONT }}>
      <div className="w-full max-w-md text-center">{children}</div>
    </div>
  );
}
