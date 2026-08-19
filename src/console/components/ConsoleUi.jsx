import { AlertCircle, Loader2 } from "lucide-react";

export function ConsolePageHeader({ eyebrow, title, description, meta, actions }) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
            {eyebrow}
          </div>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-heading">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm leading-6 text-body">{description}</p>}
        {meta && <div className="mt-2 text-xs text-muted">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function ConsolePanel({ title, description, action, className = "", children }) {
  return (
    <section className={`overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--sa-card-shadow)] ${className}`}>
      {(title || description || action) && (
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-heading">{title}</h2>}
            {description && <p className="mt-0.5 text-xs leading-5 text-muted">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function ConsoleLoadingState({ label = "Loading…" }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-sm text-muted" role="status">
      <Loader2 size={22} className="animate-spin text-accent" />
      <span>{label}</span>
    </div>
  );
}

export function ConsoleErrorState({ message, onRetry }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-6 text-center" role="alert">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-hue-rose-soft text-hue-rose">
        <AlertCircle size={20} />
      </span>
      <div>
        <div className="text-sm font-semibold text-heading">Unable to load this view</div>
        <p className="mt-1 text-sm text-body">{message}</p>
      </div>
      {onRetry && (
        <button type="button" onClick={onRetry}
          className="rounded-lg border border-border-strong px-3 py-2 text-xs font-semibold text-heading hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          Try again
        </button>
      )}
    </div>
  );
}
