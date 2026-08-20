// src/console/pages/TransportRequests.jsx
//
// The SuperAdmin queue for transport orders: what tenants have asked for, and every decision the
// platform makes on one — review, re-price, approve, reject, assign a vehicle, issue or upload the
// duty slip, and quote a cancellation.
//
// This screen sees BOTH sides of the money (`supplierAmount`, `platformEarning`) because the person
// approving needs the margin to approve on. Nothing here may be mirrored into a tenant screen — the
// tenant DTO has no field for either, and an ArchUnit test fails the build if one appears.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Car, CheckCircle2, ClipboardCheck, Download, FileText, Loader2, RefreshCw, Trash2, Upload, X, XCircle,
} from "lucide-react";
import { transportAdminService as svc } from "../api/transportAdminService";
import { ConsolePageHeader, ConsolePanel } from "../components/ConsoleUi";
import { ConsoleTable, ConsolePager } from "../components/ConsoleTable";
import SuperAdminMfaActionModal from "../components/SuperAdminMfaActionModal";

const PAGE_SIZE = 20;

/** The states an operator filters by, in the order a queue is actually worked. */
const STATUS_FILTERS = [
  ["", "All"],
  ["REQUESTED", "New"],
  ["UNDER_REVIEW", "Under review"],
  ["TENANT_APPROVAL_REQUIRED", "Awaiting tenant"],
  ["TENANT_ACCEPTED", "Tenant accepted"],
  ["CONFIRMED", "Confirmed"],
  ["CANCEL_REQUESTED", "Cancel requested"],
  ["CANCELLATION_QUOTED", "Charge quoted"],
  ["CANCELLED", "Cancelled"],
  ["REJECTED", "Rejected"],
];

const money = (v, ccy = "INR") =>
  v === null || v === undefined || v === "" ? "—" : `${ccy === "INR" ? "₹" : `${ccy} `}${Number(v).toLocaleString("en-IN")}`;

const when = (v) => (v ? new Date(v).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");

const human = (v) => (v ? String(v).replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()) : "—");

export default function TransportRequests() {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({});
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailBusy, setDetailBusy] = useState(false);
  // The contracted rates behind the vehicle that was requested. Fetched with the detail rather than
  // carried on the order, because an order snapshots what was ASKED FOR and the rate card is what
  // the platform pays — two different facts with two different lifetimes.
  const [productRates, setProductRates] = useState([]);
  // This order's own ledger rows. Shown beside the order because "what did we earn on this" is a
  // question asked while looking at the order, not while scrolling a platform-wide ledger.
  const [orderLedger, setOrderLedger] = useState([]);

  /** The pending step-up action: {kind, label, payload?, file?}. Null when no modal is open. */
  const [action, setAction] = useState(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [progress, setProgress] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { rows: data, pagination: meta } = await svc.listOrders({ page, size: PAGE_SIZE, status: status || undefined });
      setRows(data);
      setPagination(meta);
    } catch (e) {
      setError(e?.normalized?.message ?? "Could not load the transport queue.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = useCallback(async (row) => {
    setSelected(row);
    setDetail(null);
    setProductRates([]);
    setOrderLedger([]);
    setDetailBusy(true);
    try {
      const full = await svc.getOrder(row.publicId);
      setDetail(full);
      // Best-effort: an order that has never accrued simply has no rows, which is not an error.
      svc.commissionsForOrder(row.publicId).then((l) => setOrderLedger(l ?? [])).catch(() => {});
      if (full?.platformProductPublicId) {
        try {
          const product = await svc.getVehicle(full.platformProductPublicId);
          setProductRates((product?.rates ?? []).filter((r) => r.active !== false));
        } catch {
          // A deleted or unreadable product must not blank the order. The approver simply types
          // without the reference figures, which is what they did before this existed.
        }
      }
    } catch {
      // The row we already have is a usable fallback — the panel degrades rather than blanking.
      setDetail(row);
    } finally {
      setDetailBusy(false);
    }
  }, []);

  /** Every step-up verb funnels through here so the MFA code is collected in exactly one place. */
  const runAction = async (mfaCode) => {
    if (!action || !selected) return;
    setSaving(true);
    setActionError("");
    try {
      switch (action.kind) {
        case "approve":
          await svc.approve(selected.publicId, action.payload, mfaCode);
          break;
        case "reject":
          await svc.reject(selected.publicId, action.payload?.reason, mfaCode);
          break;
        case "assign":
          await svc.assign(selected.publicId, action.payload, mfaCode);
          break;
        case "unassign":
          await svc.unassign(selected.publicId, action.payload?.reason, mfaCode);
          break;
        case "quoteCancellation":
          await svc.quoteCancellation(selected.publicId, action.payload, mfaCode);
          break;
        case "cancel":
          await svc.cancel(selected.publicId, action.payload, mfaCode);
          break;
        case "issueVoucher":
          await svc.issueVoucher(selected.publicId, mfaCode);
          break;
        case "revokeVoucher":
          await svc.revokeVoucher(selected.publicId, action.payload?.reason, mfaCode);
          break;
        case "uploadVoucher":
          await svc.uploadVoucher(selected.publicId, action.file, mfaCode, (e) => {
            if (e?.total) setProgress(Math.round((e.loaded / e.total) * 100));
          });
          break;
        case "removeUpload":
          await svc.removeUploadedVoucher(selected.publicId, mfaCode);
          break;
        default:
          break;
      }
      setAction(null);
      setProgress(null);
      await load();
      await openDetail(selected);
    } catch (e) {
      setActionError(e?.normalized?.message ?? "That did not go through.");
    } finally {
      setSaving(false);
    }
  };

  /** The two verbs with no step-up: they commit nothing the tenant has not already been told. */
  const runPlain = async (fn) => {
    setDetailBusy(true);
    try {
      await fn();
      await load();
      await openDetail(selected);
    } catch (e) {
      setActionError(e?.normalized?.message ?? "That did not go through.");
    } finally {
      setDetailBusy(false);
    }
  };

  async function openVoucher(publicId) {
    try {
      const blob = await svc.downloadVoucher(publicId);
      if (!blob) return;
      // `blob.type` rather than a hardcoded PDF: an uploaded operator slip may be a photograph.
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setActionError("No duty slip is available for this order yet.");
    }
  }

  const columns = useMemo(
    () => [
      {
        id: "order",
        header: "Order",
        accessorKey: "orderCode",
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="font-semibold text-heading">{row.original.orderCode}</div>
            <div className="mt-0.5 text-[11px] text-muted">{when(row.original.createdAt)}</div>
          </div>
        ),
      },
      {
        id: "tenant",
        header: "Agency",
        accessorKey: "tenantName",
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate text-heading">{row.original.tenantName ?? "—"}</div>
            <div className="text-[11px] text-muted">{row.original.tenantCode ?? ""}</div>
          </div>
        ),
      },
      {
        id: "vehicle",
        header: "Vehicle",
        accessorKey: "productName",
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate text-heading">{row.original.productName ?? "—"}</div>
            <div className="text-[11px] text-muted">
              {human(row.original.vehicleType)}
              {row.original.cityName ? ` · ${row.original.cityName}` : ""}
            </div>
          </div>
        ),
      },
      {
        id: "pickup",
        header: "Pickup",
        accessorKey: "pickupAt",
        cell: ({ row }) => (
          <div className="min-w-0 whitespace-nowrap">
            <div className="text-heading">{when(row.original.pickupAt)}</div>
            <div className="truncate text-[11px] text-muted">{row.original.pickupLocation ?? ""}</div>
          </div>
        ),
      },
      {
        id: "money",
        header: "Payable / earning",
        accessorKey: "tenantPayable",
        cell: ({ row }) => (
          <div className="whitespace-nowrap text-right tabular-nums">
            <div className="text-heading">{money(row.original.tenantPayable, row.original.currency)}</div>
            <div className="text-[11px] text-muted">{money(row.original.platformEarning, row.original.currency)}</div>
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorKey: "status",
        cell: ({ row }) => (
          <span className="whitespace-nowrap rounded-full bg-page px-2.5 py-0.5 text-xs font-semibold text-body">
            {human(row.original.status)}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <ConsolePageHeader
        eyebrow="Transport marketplace"
        title="Transport requests"
        description="Every enquiry an agency has sent against the platform vehicle catalog. A tenant can request; only an approval here confirms a journey."
        actions={
          <button
            onClick={load}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-body hover:bg-page"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        }
      />

      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map(([value, label]) => (
          <button
            key={value || "all"}
            onClick={() => {
              setStatus(value);
              setPage(0);
            }}
            className={`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-lg px-3 py-1.5 text-sm font-semibold ${
              status === value ? "bg-accent text-white" : "border border-border text-body hover:bg-page"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <ConsolePanel>
        <ConsoleTable
          columns={columns}
          rows={rows}
          state={loading ? "loading" : error ? "error" : "ready"}
          error={error}
          onRetry={load}
          onRowClick={openDetail}
          isRowActive={(r) => r.publicId === selected?.publicId}
          filtered={!!status}
          emptyTitle="No transport requests"
          emptyHint="Enquiries agencies send against the vehicle catalog appear here."
        />
        <ConsolePager page={page} size={PAGE_SIZE} total={pagination.totalElements || 0} onPage={setPage} />
      </ConsolePanel>

      {selected && (
        <OrderPanel
          order={detail ?? selected}
          rates={productRates}
          ledger={orderLedger}
          busy={detailBusy}
          onClose={() => {
            setSelected(null);
            setDetail(null);
          }}
          onReview={() => runPlain(() => svc.review(selected.publicId))}
          onRevise={(payload) => runPlain(() => svc.requestRevision(selected.publicId, payload))}
          onAction={(next) => {
            setActionError("");
            setProgress(null);
            setAction(next);
          }}
          onVoucher={() => openVoucher(selected.publicId)}
          error={actionError}
        />
      )}

      {action && (
        <SuperAdminMfaActionModal
          title={action.label}
          description={action.description}
          confirmLabel={action.confirmLabel ?? "Confirm"}
          saving={saving}
          progress={progress}
          error={actionError}
          onClose={() => {
            setAction(null);
            setActionError("");
            setProgress(null);
          }}
          onConfirm={runAction}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   The detail panel — everything known about one order, and every verb.
   ═══════════════════════════════════════════════════════════════════════════ */

function OrderPanel({ order, rates, ledger, busy, onClose, onReview, onRevise, onAction, onVoucher, error }) {
  const [approve, setApprove] = useState({ supplierAmount: "", tenantPayable: "", supplierConfirmationNumber: "", cancellationTerms: "" });
  const [revise, setRevise] = useState({ revisedSupplierAmount: "", revisedTenantPayable: "", reason: "" });
  const [assign, setAssign] = useState({ supplierName: "", vehicleRegistration: "", vehicleMakeModel: "", driverName: "", driverPhone: "" });
  const [quote, setQuote] = useState({ charge: "", retainedEarning: "", note: "" });
  const [file, setFile] = useState(null);

  const s = order.status;
  const canApprove = ["REQUESTED", "UNDER_REVIEW", "TENANT_ACCEPTED"].includes(s);
  const canRevise = ["REQUESTED", "UNDER_REVIEW"].includes(s);
  const canAssign = ["CONFIRMED", "TENANT_ACCEPTED"].includes(s);
  const canQuote = s === "CANCEL_REQUESTED";
  const issued = order.voucherStatus === "ISSUED";
  const uploaded = order.voucherSource === "UPLOADED";

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-scrim" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-border bg-surface shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-surface px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-heading">{order.orderCode}</h2>
            <p className="mt-0.5 text-xs text-muted">
              {order.tenantName} · {human(order.status)}
              {busy && <Loader2 className="ml-2 inline size-3 animate-spin" />}
            </p>
          </div>
          <button onClick={onClose} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus text-muted hover:text-body"><X size={18} /></button>
        </header>

        <div className="space-y-6 px-6 py-5">
          {error && (
            <p className="rounded-lg border border-hue-rose/40 bg-hue-rose-soft px-3 py-2 text-sm text-hue-rose">{error}</p>
          )}

          <Section title="The journey">
            <KV k="Service" v={human(order.serviceType)} />
            <KV k="Pickup" v={`${when(order.pickupAt)}${order.serviceTimezone ? ` (${order.serviceTimezone})` : ""}`} />
            <KV k="Release" v={when(order.expectedReleaseAt)} />
            <KV k="From" v={order.pickupLocation} />
            <KV k="To" v={order.dropLocation} />
            <KV k="Party" v={[order.passengers && `${order.passengers} pax`, order.luggagePieces != null && `${order.luggagePieces} bags`, order.vehicleCount && `${order.vehicleCount} vehicle(s)`].filter(Boolean).join(" · ")} />
            <KV k="Lead passenger" v={[order.leadPassengerName, order.leadPassengerPhone].filter(Boolean).join(" · ")} />
            <KV k="Requests" v={order.specialRequests} />
          </Section>

          <Section title="Money">
            {/* Both sides, deliberately: the approval decision IS the margin decision. */}
            <KV k="Supplier pays out" v={money(order.supplierAmount, order.currency)} />
            <KV k="Agency pays" v={money(order.tenantPayable, order.currency)} />
            <KV k="Platform earns" v={money(order.platformEarning, order.currency)} />
            <KV k="CRM booking" v={order.crmBookingCode} />
            <KV k="CRM sync" v={order.crmSyncState ? human(order.crmSyncState) : null} />
            {order.crmSyncError && <KV k="Sync error" v={order.crmSyncError} />}
          </Section>

          {order.assignments?.length > 0 && (
            <Section title="Assigned">
              {order.assignments.map((a, i) => (
                <KV
                  key={a.publicId ?? i}
                  k={a.vehicleRegistration ?? `Vehicle ${i + 1}`}
                  v={[a.vehicleMakeModel, a.driverName, a.driverPhone, a.supplierName].filter(Boolean).join(" · ")}
                />
              ))}
            </Section>
          )}

          {/* What the platform contracted for this vehicle. The whole reason rate cards exist: an
              approval figure typed without them is a guess, and that is how a margin goes negative.
              Never leaves the console — `netRate` is the platform's cost. */}
          {rates?.length > 0 && (
            <Section title="Contracted rates">
              {rates.map((r) => (
                <KV
                  key={r.publicId}
                  k={String(r.serviceType ?? "").replace(/_/g, " ")}
                  v={[
                    r.netRate == null ? null : money(r.netRate, r.currency),
                    String(r.rateModel ?? "").replace(/_/g, " ").toLowerCase(),
                    r.includedKm ? `${r.includedKm} km` : null,
                    r.extraKmRate ? `+${r.extraKmRate}/km` : null,
                    r.driverAllowance ? `DA ${r.driverAllowance}` : null,
                    r.nightHalt ? `NH ${r.nightHalt}` : null,
                    r.publicId === order.platformRatePublicId ? "— the agent picked this one" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                />
              ))}
            </Section>
          )}

          {/* ── Verbs ───────────────────────────────────────────────────── */}

          {s === "REQUESTED" && (
            <Action label="Take this on" hint="Marks it under review so another operator does not double-handle it. Commits nothing.">
              <Btn onClick={onReview}><ClipboardCheck size={14} /> Start review</Btn>
            </Action>
          )}

          {canApprove && (
            <Action label="Approve" hint="Confirms the journey, writes one line onto the agency's CRM booking and accrues the platform's earning exactly once.">
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Supplier amount" value={approve.supplierAmount} onChange={(v) => setApprove((f) => ({ ...f, supplierAmount: v }))} type="number" />
                <Field label="Agency pays" value={approve.tenantPayable} onChange={(v) => setApprove((f) => ({ ...f, tenantPayable: v }))} type="number" />
                <Field label="Operator ref" value={approve.supplierConfirmationNumber} onChange={(v) => setApprove((f) => ({ ...f, supplierConfirmationNumber: v }))} />
                <Field label="Cancellation terms" value={approve.cancellationTerms} onChange={(v) => setApprove((f) => ({ ...f, cancellationTerms: v }))} />
              </div>
              <div className="mt-2 flex gap-2">
                <Btn
                  tone="primary"
                  disabled={!approve.supplierAmount || !approve.tenantPayable}
                  onClick={() =>
                    onAction({
                      kind: "approve",
                      label: "Approve this journey",
                      description: `${order.orderCode} — the agency will owe ${money(approve.tenantPayable, order.currency)}.`,
                      confirmLabel: "Approve",
                      payload: {
                        supplierAmount: Number(approve.supplierAmount),
                        tenantPayable: Number(approve.tenantPayable),
                        supplierConfirmationNumber: approve.supplierConfirmationNumber || null,
                        cancellationTerms: approve.cancellationTerms || null,
                      },
                    })
                  }
                >
                  <CheckCircle2 size={14} /> Approve
                </Btn>
                <Btn
                  tone="danger"
                  onClick={() =>
                    onAction({
                      kind: "reject",
                      label: "Reject this request",
                      description: "The agency sees the reason you give.",
                      confirmLabel: "Reject",
                      payload: { reason: revise.reason || "Not available" },
                    })
                  }
                >
                  <XCircle size={14} /> Reject
                </Btn>
              </div>
            </Action>
          )}

          {canRevise && (
            <Action label="Come back with a different price" hint="The agency must accept the amount before it can be approved, and approval then refuses any other figure.">
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Revised supplier amount" value={revise.revisedSupplierAmount} onChange={(v) => setRevise((f) => ({ ...f, revisedSupplierAmount: v }))} type="number" />
                <Field label="Revised agency pays" value={revise.revisedTenantPayable} onChange={(v) => setRevise((f) => ({ ...f, revisedTenantPayable: v }))} type="number" />
              </div>
              <Field label="Reason" value={revise.reason} onChange={(v) => setRevise((f) => ({ ...f, reason: v }))} />
              <Btn
                className="mt-2"
                disabled={!revise.revisedTenantPayable}
                onClick={() =>
                  onRevise({
                    revisedSupplierAmount: revise.revisedSupplierAmount ? Number(revise.revisedSupplierAmount) : null,
                    revisedTenantPayable: Number(revise.revisedTenantPayable),
                    reason: revise.reason || null,
                  })
                }
              >
                Send revised price
              </Btn>
            </Action>
          )}

          {canAssign && (
            <Action label="Assign a vehicle and driver" hint="Versioned — a change reissues the duty slip and moves no money. This is also what creates the trip in the operator's own Vehicle Diary.">
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Operator" value={assign.supplierName} onChange={(v) => setAssign((f) => ({ ...f, supplierName: v }))} />
                <Field label="Registration" value={assign.vehicleRegistration} onChange={(v) => setAssign((f) => ({ ...f, vehicleRegistration: v }))} />
                <Field label="Make / model" value={assign.vehicleMakeModel} onChange={(v) => setAssign((f) => ({ ...f, vehicleMakeModel: v }))} />
                <Field label="Driver" value={assign.driverName} onChange={(v) => setAssign((f) => ({ ...f, driverName: v }))} />
                <Field label="Driver phone" value={assign.driverPhone} onChange={(v) => setAssign((f) => ({ ...f, driverPhone: v }))} />
              </div>
              <div className="mt-2 flex gap-2">
                <Btn
                  tone="primary"
                  disabled={!assign.vehicleRegistration && !assign.driverName}
                  onClick={() =>
                    onAction({
                      kind: "assign",
                      label: "Assign this vehicle",
                      description: "The agency is notified and the duty slip is reissued.",
                      confirmLabel: "Assign",
                      payload: { ...assign },
                    })
                  }
                >
                  <Car size={14} /> Assign
                </Btn>
                {order.assignments?.length > 0 && (
                  <Btn
                    tone="danger"
                    onClick={() =>
                      onAction({
                        kind: "unassign",
                        label: "Remove the assignment",
                        description: "The journey stays confirmed; only the vehicle and driver are cleared.",
                        confirmLabel: "Remove",
                        payload: { reason: "Reassigning" },
                      })
                    }
                  >
                    <Trash2 size={14} /> Unassign
                  </Btn>
                )}
              </div>
            </Action>
          )}

          {canQuote && (
            <Action label="Quote a cancellation charge" hint="The agency accepts or declines it. Nothing is cancelled until they accept.">
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Charge" value={quote.charge} onChange={(v) => setQuote((f) => ({ ...f, charge: v }))} type="number" />
                <Field label="Platform keeps" value={quote.retainedEarning} onChange={(v) => setQuote((f) => ({ ...f, retainedEarning: v }))} type="number" />
              </div>
              <Field label="Note" value={quote.note} onChange={(v) => setQuote((f) => ({ ...f, note: v }))} />
              <Btn
                className="mt-2"
                disabled={quote.charge === ""}
                onClick={() =>
                  onAction({
                    kind: "quoteCancellation",
                    label: "Quote this cancellation",
                    description: `${money(quote.charge, order.currency)} to cancel ${order.orderCode}.`,
                    confirmLabel: "Send quote",
                    payload: {
                      charge: Number(quote.charge),
                      retainedEarning: quote.retainedEarning === "" ? null : Number(quote.retainedEarning),
                      note: quote.note || null,
                    },
                  })
                }
              >
                Send the quote
              </Btn>
            </Action>
          )}

          {ledger?.length > 0 && (
            <Section title="What this order earned">
              {ledger.map((e) => (
                <KV
                  key={e.publicId}
                  k={e.entryType}
                  v={[money(e.amount, e.currency), e.status, e.reason].filter(Boolean).join(" · ")}
                />
              ))}
            </Section>
          )}

          {/* The platform's OWN cancellation, distinct from answering a tenant's request above. Used
              when the operator falls through and the journey cannot run: it settles the charge and
              the refund in one act rather than waiting for the agency to ask. */}
          {["CONFIRMED", "TENANT_ACCEPTED", "CANCELLATION_QUOTED"].includes(s) && (
            <Action label="Cancel this journey" hint="The platform cancelling, not the agency asking. Records the charge and what is refunded, and reverses the accrual.">
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Charge" value={quote.charge} onChange={(v) => setQuote((f) => ({ ...f, charge: v }))} type="number" />
                <Field label="Platform keeps" value={quote.retainedEarning} onChange={(v) => setQuote((f) => ({ ...f, retainedEarning: v }))} type="number" />
              </div>
              <Field label="Reason" value={quote.note} onChange={(v) => setQuote((f) => ({ ...f, note: v }))} />
              <Btn
                className="mt-2"
                tone="danger"
                onClick={() =>
                  onAction({
                    kind: "cancel",
                    label: "Cancel this journey",
                    description: `${order.orderCode} will be cancelled. The agency is charged ${money(quote.charge || 0, order.currency)}.`,
                    confirmLabel: "Cancel the journey",
                    payload: {
                      charge: quote.charge === "" ? null : Number(quote.charge),
                      retainedEarning: quote.retainedEarning === "" ? null : Number(quote.retainedEarning),
                      reason: quote.note || null,
                    },
                  })
                }
              >
                <XCircle size={14} /> Cancel the journey
              </Btn>
            </Action>
          )}

          <Action
            label="Duty slip"
            hint="The driver's paper. It prints the journey, the vehicle and driver, and — read from the agency's CRM booking — where the guests are staying and where they are being taken. It never prints money."
          >
            <div className="flex flex-wrap gap-2">
              {!issued && (
                <Btn
                  tone="primary"
                  onClick={() =>
                    onAction({
                      kind: "issueVoucher",
                      label: "Issue the duty slip",
                      description: "The agency can download it immediately.",
                      confirmLabel: "Issue",
                    })
                  }
                >
                  <FileText size={14} /> Issue
                </Btn>
              )}

              {issued && (
                <>
                  <Btn onClick={onVoucher}><Download size={14} /> Open{order.voucherNumber ? ` · ${order.voucherNumber}` : ""}</Btn>
                  <Btn
                    tone="danger"
                    onClick={() =>
                      onAction({
                        kind: "revokeVoucher",
                        label: "Withdraw the duty slip",
                        description: "The agency can no longer download it. The journey itself is unaffected.",
                        confirmLabel: "Withdraw",
                        payload: { reason: "Withdrawn by the platform" },
                      })
                    }
                  >
                    Withdraw
                  </Btn>
                </>
              )}

              {uploaded && (
                <Btn
                  onClick={() =>
                    onAction({
                      kind: "removeUpload",
                      label: "Remove the uploaded slip",
                      description: "The platform's own generated slip is served again. The order keeps its number and stays issued.",
                      confirmLabel: "Remove",
                    })
                  }
                >
                  Use the generated one
                </Btn>
              )}
            </div>

            {/* Uploading IS issuing, so it carries the same step-up as Issue. */}
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-body">
              <Upload size={14} />
              <span>{file ? file.name : "Attach the operator's own slip (PDF or image, max 10 MB)"}</span>
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {file && (
              <Btn
                className="mt-2"
                tone="primary"
                onClick={() =>
                  onAction({
                    kind: "uploadVoucher",
                    label: "Upload this duty slip",
                    description: `${file.name} — it replaces the generated one and is what the agency downloads.`,
                    confirmLabel: "Upload",
                    file,
                  })
                }
              >
                <Upload size={14} /> Upload and issue
              </Btn>
            )}
          </Action>
        </div>
      </aside>
    </div>
  );
}

/* ── Small local pieces ──────────────────────────────────────────────────── */

function Section({ title, children }) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{title}</h3>
      <dl className="space-y-1 text-sm">{children}</dl>
    </section>
  );
}

/** Hides itself when empty, so a sparse order does not render a column of dashes. */
function KV({ k, v }) {
  if (v === null || v === undefined || v === "" || v === "—") return null;
  return (
    <div className="flex gap-3">
      <dt className="w-36 shrink-0 text-muted">{k}</dt>
      <dd className="min-w-0 flex-1 text-body">{v}</dd>
    </div>
  );
}

function Action({ label, hint, children }) {
  return (
    <section className="rounded-xl border border-border p-4">
      <h3 className="text-sm font-bold text-heading">{label}</h3>
      {hint && <p className="mb-3 mt-1 text-xs leading-5 text-muted">{hint}</p>}
      {children}
    </section>
  );
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-body outline-none focus:ring-2 focus:ring-focus"
      />
    </label>
  );
}

function Btn({ children, onClick, disabled, tone = "default", className = "" }) {
  const tones = {
    default: "border border-border text-body hover:bg-page",
    primary: "bg-accent text-white hover:opacity-90",
    danger: "border border-hue-rose/40 text-hue-rose hover:bg-hue-rose-soft",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  );
}
