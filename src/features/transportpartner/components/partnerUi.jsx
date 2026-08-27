/**
 * Local UI primitives for the transport-partner registration form.
 *
 * Feature-local by the repo's rule — kits are never imported across features, so this is a copy of
 * `hotelpartner/components/partnerUi.jsx` adapted rather than an import of it. The idiom is the same
 * because the audience is the same shape: a non-technical operator filling a long form once, on a
 * phone, not a CRM user at a desk. Where it differs from the hotel kit it is because the data
 * differs — no star rating (a fleet has none), and a photo budget that is shared across the whole
 * registration instead of being per-listing.
 *
 * This page renders OUTSIDE the app Layout and outside `.sa-console`, so neither the tenant kit's
 * gradient shell nor the console's semantic tokens apply. Everything is plain Tailwind, and the font
 * is set explicitly by <Page> — the app sets no global font-family.
 */
import { useRef, useState } from "react";
import { ImagePlus, Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { usePartnerI18n } from "../i18n/partnerI18n";

export const FONT = "'Plus Jakarta Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";

/**
 * `text-base` is 16px and that is load-bearing, not a preference: iOS Safari auto-zooms into any
 * field whose computed font-size is below 16px, and on a form this long the page then jumps on
 * every single tap.
 *
 * `min-h-11` is the 44px touch target from the iOS/Material guidelines — a select at the default
 * 40px is a miss-and-retry on a phone.
 */
export const inputCls =
  "w-full min-h-11 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-base text-slate-800 " +
  "placeholder-slate-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 " +
  "disabled:bg-slate-50 disabled:text-slate-500";

export function Page({ children, lang = "en" }) {
  return (
    <div lang={lang} className="min-h-screen bg-slate-50 text-slate-900" style={{ fontFamily: FONT }}>
      {children}
    </div>
  );
}

/**
 * A form section.
 *
 * `id` doubles as the scroll-spy anchor, so `scroll-mt` has to clear whatever is sticky above it:
 * header + section chips on a phone, header only from `lg:` where the nav moves into the sidebar.
 *
 * Three values, not two, because the header itself is two rows below `sm:` — the language switcher
 * and the save badge wrap onto their own line there rather than crushing the title — and a section
 * scrolled to with the phone's offset would land underneath it.
 */
export function Card({ id, title, hint, right, children }) {
  return (
    <section
      id={id}
      className="scroll-mt-48 rounded-xl border border-slate-200 bg-white shadow-sm sm:scroll-mt-32 lg:scroll-mt-24"
    >
      {/* Stacked below sm:. `right` is a summary line ("2 vehicles · 5 rates · 3/12 photos") that
          does not fit beside a heading on a 320px phone, and squeezing it there either overflowed
          the card or crushed the title to an ellipsis. It gets its own line instead. */}
      {title && (
        <header className="flex flex-col gap-1.5 border-b border-slate-100 px-4 py-3.5 sm:flex-row sm:items-start sm:gap-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
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
      <span className={`text-[11px] font-normal sm:w-44 sm:shrink-0 sm:pt-3.5 ${error ? "text-rose-600" : "text-slate-500"}`}>
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
        {hint && <span className="block text-[11px] font-normal text-slate-400">{hint}</span>}
      </span>
      <span className={`min-w-0 flex-1 ${error ? INVALID : ""}`}>
        {children}
        {error && <span className="mt-1 block text-[11px] font-medium text-rose-600">{error}</span>}
      </span>
    </label>
  );
}

/**
 * Turns whatever control sits inside red, without every caller having to thread an error class into
 * its own input.
 *
 * <p>Descendant variants rather than a prop on each input: this form has inputs, selects and
 * textareas across five sections plus a repeating vehicle card, and asking each one to know about
 * validity is how half of them end up not knowing. The wrapper owns it, so marking a field is one
 * prop at the Row.</p>
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
      <span className={`mb-1 block truncate text-[11px] font-normal ${error ? "text-rose-600" : "text-slate-500"}`}>
        {label}
        {hint && <span className="ml-1 font-normal text-slate-400">· {hint}</span>}
      </span>
      <span className={`block ${error ? INVALID : ""}`}>{children}</span>
      {error && <span className="mt-1 block text-[11px] font-medium text-rose-600">{error}</span>}
    </label>
  );
}

/**
 * {@link Field}'s look without the `<label>`.
 *
 * <p><b>Use this whenever the block contains anything other than one plain control</b> — a photo
 * grid, a row of chips, a hidden file input. A `<label>` forwards every click inside it to its first
 * labelable descendant, so a `<label>` wrapping {@link PhotoUploader} opens the file picker when the
 * operator taps a thumbnail or the delete button on one. That is a real misfire on the hotel form's
 * room-photos block, and on this form every vehicle has a mandatory photo block, so it would fire
 * for every operator on the field they use most.</p>
 */
export function FieldBlock({ label, hint, className = "", children }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <span className="mb-1 block truncate text-[11px] font-normal text-slate-500">
        {label}
        {hint && <span className="ml-1 font-normal text-slate-400">· {hint}</span>}
      </span>
      {children}
    </div>
  );
}

export function Btn({ variant = "primary", size = "md", className = "", children, busy, ...rest }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition " +
    "disabled:cursor-not-allowed disabled:opacity-50";
  const sizes = {
    sm: "min-h-9 px-3 py-1.5 text-[13px]",
    md: "min-h-11 px-4 py-2.5 text-[13px]",
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
  return <div className={`rounded-xl border px-4 py-3 text-[13px] leading-relaxed ${tones[tone]}`}>{children}</div>;
}

/** Toggle pill. Used for the amenity quick-picks and the vehicle-type suggestions. */
export function Chip({ on, disabled, onClick, className = "", children }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={on}
      className={`min-h-11 rounded-lg border px-3.5 text-[13px] font-medium transition
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
 * Number input with −/+ buttons.
 *
 * The bare `type="number"` spinners are ~10px tall and unusable with a thumb; the field itself stays
 * typeable so an operator entering a 49-seat coach is not forced to tap forty-nine times.
 */
export function Stepper({ id, value, onChange, min = 0, max = 99, disabled, invalid }) {
  const { t } = usePartnerI18n();
  const n = value === "" || value === null || value === undefined ? null : Number(value);
  const step = (by) => {
    const next = Math.min(max, Math.max(min, (n ?? min) + by));
    onChange(String(next));
  };
  const btn =
    "grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white " +
    "text-slate-600 transition hover:bg-slate-50 disabled:opacity-40";
  // The input carries `min-w-0`: a number field's intrinsic width is wider than what is left beside
  // two 44px buttons inside a card on a 320px phone, and without it the row overflows instead.
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" className={btn} disabled={disabled || (n ?? min) <= min}
        onClick={() => step(-1)} aria-label={t("decrease")}>
        <Minus size={16} />
      </button>
      <input
        id={id} type="number" inputMode="numeric" min={min} max={max} value={value} disabled={disabled}
        aria-invalid={Boolean(invalid)}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} min-w-0 [appearance:textfield] px-1 text-center font-medium
                    [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
      />
      <button type="button" className={btn} disabled={disabled || (n ?? min) >= max}
        onClick={() => step(1)} aria-label={t("increase")}>
        <Plus size={16} />
      </button>
    </div>
  );
}

/**
 * A yes/no that also has a THIRD state: not answered.
 *
 * <p>`airConditioned` is boxed on the backend precisely so that null and false stay different
 * answers — "the operator has not told us yet" is not "this vehicle has no AC", and a promoted
 * catalog row must never carry a claim the operator never made. A checkbox has only two states and
 * would flatten that on the very first save, so this is a select, exactly like the hotel form's
 * refundable? control.</p>
 */
export function TriState({ value, onChange, disabled, unset = "Not specified", yes = "Yes", no = "No" }) {
  return (
    <select
      className={inputCls}
      disabled={disabled}
      value={value === null || value === undefined ? "" : String(value)}
      onChange={(e) => onChange(e.target.value === "" ? null : e.target.value === "true")}
    >
      <option value="">{unset}</option>
      <option value="true">{yes}</option>
      <option value="false">{no}</option>
    </select>
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
 * Photo picker + thumbnail grid, one per vehicle.
 *
 * `capture` is deliberately NOT set on the input: omitting it lets the phone offer BOTH the camera
 * and the gallery, and an operator almost always already has photos of their fleet.
 *
 * Uploads run one at a time rather than in parallel — a phone on mobile data pushing six 4 MB files
 * at once stalls all six, and sequential uploads let each thumbnail appear as it lands.
 *
 * `remaining` is the registration-wide budget left, not this vehicle's. The server counts every
 * vehicle's gallery together, so the honest place to stop is before the picker, not on a 409 after
 * an upload the operator already waited for.
 */
export function PhotoUploader({
  images, onAdd, onRemove, onMakeMain, onUpload, disabled, showMainBadge,
  mainUrl, hint, remaining = Infinity, accept = "image/jpeg,image/png,image/webp",
}) {
  const { t } = usePartnerI18n();
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [at, setAt] = useState([0, 0]);   // [current, total] — "Uploading 2 of 5"
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const full = remaining <= 0;

  const pick = async (e) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    setError("");
    // Trimmed rather than rejected: picking eight photos with three left should upload three and say
    // so, not fail all eight and make the operator guess which ones would have fitted.
    const files = Number.isFinite(remaining) ? picked.slice(0, Math.max(0, remaining)) : picked;
    if (files.length < picked.length) {
      setError(t("photoFitLimit", { fitted: files.length, picked: picked.length }));
    }
    if (!files.length) { if (inputRef.current) inputRef.current.value = ""; return; }
    setBusy(true);
    try {
      for (let i = 0; i < files.length; i++) {
        setAt([i + 1, files.length]);
        setPct(0);
        const url = await onUpload(files[i], setPct);
        if (url) onAdd(url);
      }
    } catch (err) {
      setError(err?.message || t("genericUploadFailed"));
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
          <input ref={inputRef} type="file" accept={accept} multiple
            className="hidden" onChange={pick} disabled={busy || full} />
          <button type="button" disabled={busy || full} onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed
                       border-slate-300 bg-white px-4 py-5 text-[13px] font-medium text-slate-600
                       transition hover:border-blue-400 hover:bg-blue-50/40 hover:text-blue-600 disabled:opacity-60">
            {busy ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>
                  {t("uploading", { progress: `${at[1] > 1 ? `${at[0]} / ${at[1]} · ` : ""}${pct}%` })}
                </span>
              </>
            ) : (
              <>
                <ImagePlus size={20} />
                <span>
                  {full
                    ? t("photoLimit")
                    : images.length ? t("addMorePhotos") : t("addPhotos")}
                </span>
                <span className="text-[11px] font-normal text-slate-400">
                  {full ? t("removeAnyPhoto") : hint}
                </span>
              </>
            )}
          </button>
        </div>
      )}

      {error && <p className="text-[13px] font-medium text-rose-600">{error}</p>}

      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          {images.map((src, i) => {
            // The cover is whichever photo `primaryImageUrl` names; the server falls back to the
            // first only when the operator has picked none, so the badge has to follow the same rule
            // or it points at a different photo than the catalog will show.
            const isMain = showMainBadge && (mainUrl ? src === mainUrl : i === 0);
            return (
              <div key={`${src}-${i}`}
                className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />

                {isMain && (
                  <span className="absolute left-1.5 top-1.5 rounded-lg bg-blue-600 px-1.5 py-0.5 text-[11px] font-medium text-white">
                    {t("cover")}
                  </span>
                )}

                {!disabled && (
                  <>
                    <button type="button" onClick={() => onRemove(i)} aria-label={t("removePhoto")}
                      className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-lg
                                 bg-white/95 text-slate-500 shadow-sm transition hover:text-rose-600">
                      <Trash2 size={14} />
                    </button>
                    {/* Reordering by drag is unreliable on touch; one tap to promote is not. */}
                    {showMainBadge && !isMain && onMakeMain && (
                      <button type="button" onClick={() => onMakeMain(i)}
                        className="absolute inset-x-1.5 bottom-1.5 rounded-lg bg-white/95 py-1 text-[11px]
                                   font-medium text-slate-600 shadow-sm transition hover:text-blue-600">
                        {t("makeCover")}
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
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
