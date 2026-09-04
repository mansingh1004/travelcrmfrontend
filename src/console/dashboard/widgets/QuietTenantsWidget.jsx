// The earliest churn signal the platform has, and it costs nothing: /super-admin/usage already
// returns bookingsThisMonth per tenant from one cross-tenant query. Nobody was reading it.
//
// TRIAL is excluded deliberately. A trial with no bookings has not gone quiet — it never started,
// which is the activation funnel's problem and a different conversation.
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function QuietTenantsWidget({ data }) {
  const rows = (data?.usage?.tenants ?? [])
    .filter((t) => t.status === "ACTIVE" && Number(t.bookingsThisMonth || 0) === 0)
    .sort((a, b) => Number(b.activeUsers || 0) - Number(a.activeUsers || 0))
    .slice(0, 8);

  if (rows.length === 0) {
    return <p className="px-5 py-8 text-center text-sm text-muted">Every active tenant booked this month.</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {rows.map((t) => (
        <li key={t.publicId}>
          <Link
            to={`/console/tenants/${t.publicId}`}
            className="group flex items-center gap-3 px-5 py-2.5 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
          >
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-heading">
              {t.organizationName || t.tenantName || "Unnamed tenant"}
            </span>
            <span className="shrink-0 text-xs text-muted">{t.activeUsers ?? 0} user(s)</span>
            <ArrowRight size={14} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
