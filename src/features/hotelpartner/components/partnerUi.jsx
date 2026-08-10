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
import { ImagePlus, Loader2, Trash2 } from "lucide-react";

export const FONT = "'Plus Jakarta Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";

export const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[15px] text-slate-800 " +
  "placeholder-slate-400 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 " +
  "disabled:bg-slate-50 disabled:text-slate-500";

/**
 * 16px minimum on inputs is not a style choice: iOS Safari auto-zooms any focused field with a
 * smaller computed size, which on a long form means the page jumps on every tap.
 */
export function Page({ children }) {
  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: FONT }}>
      {children}
    </div>
  );
}

export function Card({ title, hint, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      {title && (
        <header className="border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 className="text-[15px] font-bold text-slate-900">{title}</h2>
          {hint && <p className="mt-0.5 text-[13px] text-slate-500">{hint}</p>}
        </header>
      )}
      <div className="space-y-4 p-4 sm:p-5">{children}</div>
    </section>
  );
}

/** Stacked on a phone, label-left from sm: up. */
export function Row({ label, hint, required, children }) {
  return (
    <label className="flex flex-col gap-1.5 sm:flex-row sm:gap-4">
      <span className="pt-2.5 text-[13px] font-semibold text-slate-700 sm:w-44 sm:shrink-0">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
        {hint && <span className="block text-[12px] font-normal text-slate-400">{hint}</span>}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}

/**
 * Label stacked ABOVE the control — for dense grids (rate rows) where Row's side label would leave
 * no usable width on a phone.
 */
export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-semibold text-slate-600">
        {label}
        {hint && <span className="ml-1 font-normal text-slate-400">· {hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function Btn({ variant = "primary", className = "", children, busy, ...rest }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-bold " +
    "transition disabled:cursor-not-allowed disabled:opacity-50";
  const tones = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
    ghost: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
    danger: "bg-white text-rose-600 border border-rose-200 hover:bg-rose-50",
  };
  return (
    <button className={`${base} ${tones[variant]} ${className}`} disabled={busy || rest.disabled} {...rest}>
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
  return (
    <div className={`rounded-xl border px-4 py-3 text-[14px] ${tones[tone]}`}>{children}</div>
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
export function PhotoUploader({ images, onAdd, onRemove, onUpload, disabled, showMainBadge }) {
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const pick = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setError("");
    setBusy(true);
    try {
      for (const file of files) {
        setPct(0);
        const url = await onUpload(file, setPct);
        if (url) onAdd(url);
      }
    } catch (err) {
      setError(err?.message || "Upload failed.");
    } finally {
      setBusy(false);
      setPct(0);
      // Reset so re-picking the SAME file still fires onChange.
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      {!disabled && (
        <div>
          {/* Driven by the button below via ref, so it needs no id/label pairing. */}
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple
            className="hidden" onChange={pick} disabled={busy} />
          <button type="button" disabled={busy} onClick={() => inputRef.current?.click()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed
                       border-slate-300 bg-white px-4 py-4 text-[14px] font-semibold text-slate-600
                       hover:border-blue-400 hover:text-blue-600 disabled:opacity-60">
            {busy ? (
              <><Loader2 size={16} className="animate-spin" /> Uploading {pct}%</>
            ) : (
              <><ImagePlus size={17} /> Add photos</>
            )}
          </button>
          <p className="mt-1 text-center text-[12px] text-slate-400">JPG, PNG or WebP · up to 5 MB each</p>
        </div>
      )}

      {error && <p className="text-[13px] font-medium text-rose-600">{error}</p>}

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {images.map((src, i) => (
          <div key={`${src}-${i}`} className="relative overflow-hidden rounded-xl border border-slate-200">
            <img src={src} alt="" loading="lazy" className="h-24 w-full object-cover" />
            {showMainBadge && i === 0 && (
              <span className="absolute left-1 top-1 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                Main
              </span>
            )}
            {!disabled && (
              <button type="button" onClick={() => onRemove(i)}
                className="absolute right-1 top-1 rounded bg-white/90 p-1 text-slate-500 hover:text-rose-600">
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
      </div>
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
