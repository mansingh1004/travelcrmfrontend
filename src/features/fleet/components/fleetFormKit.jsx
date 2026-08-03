// src/features/fleet/components/fleetFormKit.jsx
// ─────────────────────────────────────────────────────────────────────────────────────────────
// The shell every Fleet data-entry form is built from.
//
// Extracted from the Fleet Management (vehicle) redesign once the same treatment was applied to the
// driver and trip forms — three copies of a page shell is how three forms quietly drift apart.
//
// DESIGN: Notion row entry / Linear issue creation, but comfortable rather than clinical. A soft
// tinted page, ONE calm white surface, hairline section dividers, and a left rail carrying the
// section title so a wide monitor is actually used instead of leaving half of it empty. Every token
// is already in the app's Tailwind config — slate ramp, blue-600 accent, rounded-xl, Plus Jakarta
// Sans. No new style language.
//
// KEYBOARD is the point of this kit, not the styling:
//   Enter              → next field (NOT submit — Enter-to-submit creates a half-filled record the
//                        moment someone hits it after the first field, which is exactly what these
//                        forms used to do)
//   Ctrl/Cmd+Enter     → save
//   Ctrl/Cmd+Shift+Enter → save and start the next record
//   Tab                → follows the visual grid, because the DOM order does
// A textarea keeps its own Enter, and SearchableSelect stops propagation before this sees the key.
// ─────────────────────────────────────────────────────────────────────────────────────────────
import { useCallback } from "react";
import { ArrowLeft, Save, Plus, Eraser, LoaderCircle } from "lucide-react";

/** Input class shared by every fleet form. Matches the height/radius the rest of the app uses. */
export const fieldCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 " +
  "placeholder-slate-400 outline-none transition-all " +
  "hover:border-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 " +
  "aria-[invalid=true]:border-red-300 aria-[invalid=true]:focus:ring-red-100";

/**
 * Section with the title in a left rail on desktop.
 *
 * The rail is a fixed 15rem rather than a fraction, so every section's field grid starts at the same
 * x and the form reads as one column of inputs instead of four ragged ones. Below `lg` it collapses
 * to a stacked heading, which is the only sane thing on a laptop.
 */
export function Section({ title, hint, children, first = false }) {
  return (
    <section className={first ? "" : "mt-9 border-t border-slate-100 pt-9"}>
      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
        <div className="mb-5 lg:mb-0">
          {/* Readable, not a tiny grey all-caps label. Minimal chrome means fewer boxes, not a
              colder page — a heading you have to squint at is not comfortable. */}
          <h2 className="text-[15px] font-semibold text-slate-800">{title}</h2>
          {hint && <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">{hint}</p>}
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

const NOTE_TONE = {
  slate: "text-slate-400",
  amber: "text-amber-600",
  red: "text-red-500",
  green: "text-emerald-600",
  blue: "text-blue-600",
};

/**
 * Label + control + a SINGLE message slot, and errors win it.
 *
 * One slot on purpose: a field showing both "required" and a helpful hint is noise at the exact
 * moment the user needs one instruction.
 */
export function Field({
  label, required, optional, error, note, noteTone = "slate", htmlFor, children, className = "",
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      {label && (
        <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold text-slate-600">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
          {optional && <span className="ml-1 font-normal text-slate-400">optional</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-red-500">{error}</p>
      ) : note ? (
        <p className={`mt-1.5 flex items-start gap-1 text-xs ${NOTE_TONE[noteTone] || NOTE_TONE.slate}`}>
          {note}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Enter-advances / Ctrl+Enter-saves keyboard behaviour.
 *
 * @param formRef      ref on the <form>
 * @param onIntent     called with `true` for save-and-new, `false` for a plain save, before submit
 * @param disabled     usually `isSubmitting`
 */
export function useFormKeyboard(formRef, onIntent, disabled) {
  return useCallback(
    (e) => {
      if (e.key !== "Enter" || disabled) return;

      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        onIntent?.(e.shiftKey);
        formRef.current?.requestSubmit();
        return;
      }
      if (e.target.tagName === "TEXTAREA") return;

      e.preventDefault();
      const list = Array.from(
        formRef.current?.querySelectorAll(
          'input:not([type="hidden"]):not([disabled]), select:not([disabled]), ' +
            'textarea:not([disabled]), [role="combobox"]:not([disabled])',
        ) || [],
      );
      const next = list[list.indexOf(e.target) + 1];
      if (next) next.focus();
      else formRef.current?.requestSubmit();   // last field: Enter finishes the form
    },
    [formRef, onIntent, disabled],
  );
}

/**
 * Clear / Save & new / Save. Rendered twice by {@link FleetForm} — once in the header and once at
 * the foot — so Save is reachable from either end without chasing the scroll. Neither bar is
 * sticky: the app Navbar already is, and a second one under it reads as two competing headers.
 */
export function SaveBar({
  isEdit, submitting, onClear, onIntent, saveLabel, compact = false,
}) {
  const pad = compact ? "px-3.5 py-2" : "px-4 py-2.5";
  return (
    <>
      {!isEdit && onClear && (
        <button type="button" onClick={onClear} disabled={submitting}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40">
          <Eraser className="h-3.5 w-3.5" /> Clear
        </button>
      )}
      {!isEdit && (
        <button type="submit" onClick={() => onIntent?.(true)} disabled={submitting}
          className={`inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white ${pad} text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40`}>
          <Plus className="h-3.5 w-3.5" /> Save &amp; new
        </button>
      )}
      <button type="submit" onClick={() => onIntent?.(false)} disabled={submitting}
        className={`inline-flex items-center gap-1.5 rounded-xl bg-blue-600 ${pad} text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50`}>
        {submitting ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        {submitting ? "Saving" : saveLabel}
      </button>
    </>
  );
}

/** The keyboard legend. Small, permanent, and the only chrome that teaches the form. */
export function KeyboardHint({ showSaveAndNew = true }) {
  const kbd = "rounded border border-slate-200 bg-white px-1 py-0.5 font-semibold";
  return (
    <p className="text-[11px] text-slate-400">
      <kbd className={kbd}>Enter</kbd> next field{" · "}
      <kbd className={kbd}>Ctrl</kbd>+<kbd className={kbd}>Enter</kbd> save
      {showSaveAndNew && (
        <>
          {" · "}
          <kbd className={kbd}>Ctrl</kbd>+<kbd className={kbd}>Shift</kbd>+<kbd className={kbd}>Enter</kbd>{" "}
          save &amp; new
        </>
      )}
    </p>
  );
}

/**
 * The page: tinted background, hairline header, one white surface, mirrored footer actions.
 *
 * `actions` is rendered in BOTH bars, so pass a component (not an element) — it is invoked twice.
 */
export function FleetForm({
  formRef, onSubmit, onKeyDown,
  icon: Icon, title, subtitle, badge, onBack,
  actions: Actions, hint, children,
}) {
  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      onKeyDown={onKeyDown}
      noValidate
      className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/60"
      style={{ fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}
    >
      <header className="border-b border-slate-200/70 bg-white">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={onBack} aria-label="Back"
              className="-ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex min-w-0 items-center gap-2.5">
              {Icon && <Icon className="h-4 w-4 shrink-0 text-slate-400" />}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-[15px] font-semibold text-slate-900">{title}</h1>
                  {badge}
                </div>
                {subtitle && <p className="hidden truncate text-xs text-slate-500 sm:block">{subtitle}</p>}
              </div>
            </div>
          </div>
          <div className="hidden shrink-0 items-center gap-2 sm:flex">{Actions && <Actions compact />}</div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-10">
        <div className="rounded-2xl border border-slate-200/70 bg-white px-5 py-7 shadow-sm sm:px-8 sm:py-9 lg:px-10">
          {children}

          <div className="mt-10 flex flex-col-reverse items-stretch gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
            {hint}
            <div className="flex items-center justify-end gap-2">{Actions && <Actions />}</div>
          </div>
        </div>
      </div>
    </form>
  );
}
