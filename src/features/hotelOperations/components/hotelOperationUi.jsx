import { Inbox } from "lucide-react";
import { BOOKING_STATUS } from "../lib/hotelOperationModel";

const FONT = { fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" };

export function Page({ children, width = "max-w-7xl", className = "" }) {
  return (
    <div className="min-h-screen bg-white" style={FONT}>
      <main className={`mx-auto w-full px-1 py-2 sm:px-2 ${width} ${className}`}>{children}</main>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, className = "" }) {
  return (
    <header className={`flex flex-col justify-between gap-4 sm:flex-row sm:items-start ${className}`}>
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold tracking-[-0.025em] text-slate-900 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </header>
  );
}

export function Notice({ children, className = "" }) {
  return <div className={`rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs leading-relaxed ${className}`}>{children}</div>;
}

export function Empty({ icon: Icon = Inbox, title, hint, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-400">
        <Icon className="h-6 w-6" />
      </span>
      <h3 className="mt-4 text-base font-extrabold text-slate-700">{title}</h3>
      {hint && <p className="mt-1 max-w-md text-sm leading-relaxed text-slate-500">{hint}</p>}
      {action}
    </div>
  );
}

export function SkeletonRows({ count = 6 }) {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="grid animate-pulse grid-cols-[1fr_1.4fr_1fr] gap-5 py-4">
          <span className="h-4 rounded bg-slate-100" />
          <span className="h-4 rounded bg-slate-200" />
          <span className="h-4 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export function StatusDot({ status, className = "" }) {
  const config = BOOKING_STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-sm ${config?.tone || "text-slate-600"} ${className}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${config?.dot || "bg-slate-300"}`} />
      {config?.label || status || "Not recorded"}
    </span>
  );
}
